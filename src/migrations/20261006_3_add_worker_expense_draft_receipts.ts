import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// A zgłoszenie is decided paragon by paragon: each accepted one keeps the pages it was booked from,
// and a skipped one is kept with its pages, so the history lists every paragon the worker sent.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_expense_draft_transfers"
      ADD COLUMN IF NOT EXISTS "media_ids" integer[] NOT NULL DEFAULT '{}';

    CREATE TABLE IF NOT EXISTS "worker_expense_draft_skipped_receipts" (
      "id" serial PRIMARY KEY,
      "draft_id" integer NOT NULL REFERENCES "worker_expense_drafts"("id") ON DELETE CASCADE,
      "media_ids" integer[] NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "worker_expense_draft_skipped_receipts_draft_idx"
      ON "worker_expense_draft_skipped_receipts" ("draft_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "worker_expense_draft_skipped_receipts";
    ALTER TABLE "worker_expense_draft_transfers" DROP COLUMN IF EXISTS "media_ids";
  `)
}
