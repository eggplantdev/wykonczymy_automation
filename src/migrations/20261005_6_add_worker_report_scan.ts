import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// `source` keeps a kierownik's scan off the worker's own history on his link; `scanned_ref` keeps the
// number the AI read on a line it could not resolve, so the kierownik sees what the paper said.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_reports"
      ADD COLUMN IF NOT EXISTS "source" varchar NOT NULL DEFAULT 'link',
      ADD COLUMN IF NOT EXISTS "created_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL;
    ALTER TABLE "worker_reports" DROP CONSTRAINT IF EXISTS "worker_reports_source_check";
    ALTER TABLE "worker_reports"
      ADD CONSTRAINT "worker_reports_source_check" CHECK ("source" IN ('link', 'scan'));

    ALTER TABLE "worker_report_lines"
      ADD COLUMN IF NOT EXISTS "is_uncertain" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "scanned_ref" varchar;

    CREATE TABLE IF NOT EXISTS "worker_report_media" (
      "report_id" integer NOT NULL REFERENCES "worker_reports"("id") ON DELETE CASCADE,
      "media_id" integer NOT NULL REFERENCES "media"("id") ON DELETE CASCADE,
      "position" integer NOT NULL,
      PRIMARY KEY ("report_id", "media_id")
    );

    CREATE INDEX IF NOT EXISTS "worker_report_media_media_idx" ON "worker_report_media" ("media_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "worker_report_media";
    ALTER TABLE "worker_report_lines" DROP COLUMN IF EXISTS "scanned_ref", DROP COLUMN IF EXISTS "is_uncertain";
    ALTER TABLE "worker_reports" DROP COLUMN IF EXISTS "created_by_id", DROP COLUMN IF EXISTS "source";
  `)
}
