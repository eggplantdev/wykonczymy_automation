import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// A worker's photo can hold several paragony, so a skipped paragon's pages no longer name its row in
// the draft's AI read; `read_row` is that row's index, which a restore copies over. Nullable, no
// backfill: prod holds no skipped paragon yet, and a NULL restores with an empty read.
// Additive — migrate prod before pushing the code that writes the column.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_expense_draft_skipped_receipts"
    ADD COLUMN IF NOT EXISTS "read_row" integer CHECK ("read_row" >= 0);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_expense_draft_skipped_receipts" DROP COLUMN IF EXISTS "read_row";
  `)
}
