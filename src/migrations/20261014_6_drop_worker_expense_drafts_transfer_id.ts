import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-1007, the DESTRUCTIVE tail of EX-1005: `worker_expense_draft_transfers` (20261006_2) holds the
// link, and the column stayed only while the old deploy could still write it. The backfill catches a
// row that deploy wrote after 20261006_2 copied the rest; dropping the column drops its index.
// Runs only once that deploy is live — the old code writes the column (42703).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    INSERT INTO "worker_expense_draft_transfers" ("transfer_id", "draft_id")
    SELECT "transfer_id", "id" FROM "worker_expense_drafts" WHERE "transfer_id" IS NOT NULL
    ON CONFLICT DO NOTHING;

    ALTER TABLE "worker_expense_drafts" DROP COLUMN IF EXISTS "transfer_id";
  `)
}

// The column held one transakcja per zgłoszenie, so a draft accepted as several gets back its first.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_expense_drafts"
      ADD COLUMN IF NOT EXISTS "transfer_id" integer REFERENCES "transactions"("id") ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS "worker_expense_drafts_transfer_idx"
      ON "worker_expense_drafts" ("transfer_id");

    UPDATE "worker_expense_drafts" d SET "transfer_id" = first.transfer_id
    FROM (
      SELECT "draft_id", min("transfer_id") AS transfer_id
      FROM "worker_expense_draft_transfers" GROUP BY "draft_id"
    ) first
    WHERE first.draft_id = d.id;
  `)
}
