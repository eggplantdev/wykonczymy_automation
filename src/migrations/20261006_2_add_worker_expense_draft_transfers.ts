import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// One zgłoszenie may be accepted as several transakcje, and `transfer_id` held only the first. A
// transakcja comes from at most one zgłoszenie, hence the primary key on `transfer_id`.
// `transfer_id` on the draft stays until the code that writes it is gone from production: the
// running deploy keeps writing it between this migration and the next push, and the migration that
// drops it copies those rows over first.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "worker_expense_draft_transfers" (
      "transfer_id" integer PRIMARY KEY REFERENCES "transactions"("id") ON DELETE CASCADE,
      "draft_id" integer NOT NULL REFERENCES "worker_expense_drafts"("id") ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "worker_expense_draft_transfers_draft_idx"
      ON "worker_expense_draft_transfers" ("draft_id");

    INSERT INTO "worker_expense_draft_transfers" ("transfer_id", "draft_id")
    SELECT "transfer_id", "id" FROM "worker_expense_drafts" WHERE "transfer_id" IS NOT NULL
    ON CONFLICT DO NOTHING;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "worker_expense_draft_transfers";
  `)
}
