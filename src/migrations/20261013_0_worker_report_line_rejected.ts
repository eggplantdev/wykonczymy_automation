import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-1049: a line is odrzucona only by an explicit decision, and a report stays pending until every
// line has one. Before this, the first accept closed the whole report and every line not yet looked
// at read as odrzucona to the worker.
// Backfill: a report rejected as a whole rejected each of its lines. A report partly accepted and
// left (prod: #7, #8, #11) goes back to pending — its remaining lines were never decided.
// A partly reviewed report is pending yet carries its last decision, so `decided_at` is required only
// once the report is decided.
// Additive — migrate prod before pushing the code that reads the column.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_report_lines"
    ADD COLUMN IF NOT EXISTS "is_rejected" boolean NOT NULL DEFAULT false;

    ALTER TABLE "worker_report_lines" DROP CONSTRAINT IF EXISTS "worker_report_lines_rejected_check";
    ALTER TABLE "worker_report_lines" ADD CONSTRAINT "worker_report_lines_rejected_check"
      CHECK (NOT "is_rejected" OR "accepted_qty" IS NULL);

    ALTER TABLE "worker_reports" DROP CONSTRAINT IF EXISTS "worker_reports_decided_check";
    ALTER TABLE "worker_reports" ADD CONSTRAINT "worker_reports_decided_check"
      CHECK ("status" = 'pending' OR "decided_at" IS NOT NULL);

    UPDATE "worker_report_lines" l SET "is_rejected" = true
    FROM "worker_reports" r
    WHERE r."id" = l."report_id" AND r."status" = 'rejected' AND l."accepted_qty" IS NULL;

    UPDATE "worker_reports" r SET "status" = 'pending'
    WHERE r."status" <> 'pending' AND EXISTS (
      SELECT 1 FROM "worker_report_lines" l
      WHERE l."report_id" = r."id" AND l."accepted_qty" IS NULL AND NOT l."is_rejected"
    );
  `)
}

// Reports reopened by the backfill stay pending: which of them were „accepted" before is not kept.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "worker_reports" SET "decided_at" = NULL, "decided_by" = NULL WHERE "status" = 'pending';
    ALTER TABLE "worker_reports" DROP CONSTRAINT IF EXISTS "worker_reports_decided_check";
    ALTER TABLE "worker_reports" ADD CONSTRAINT "worker_reports_decided_check"
      CHECK (("status" = 'pending') = ("decided_at" IS NULL));
    ALTER TABLE "worker_report_lines" DROP CONSTRAINT IF EXISTS "worker_report_lines_rejected_check";
    ALTER TABLE "worker_report_lines" DROP COLUMN IF EXISTS "is_rejected";
  `)
}
