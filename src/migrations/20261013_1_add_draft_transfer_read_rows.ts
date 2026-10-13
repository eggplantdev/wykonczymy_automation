import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// A transakcja booked from several merged paragony carries their combined Kwota, so the duplicate
// check cannot match one of those paragony against it; `read_rows` names the rows of the draft's AI
// read it was booked from, and the check probes each. Nullable, no backfill: an old link stands for
// one paragon, which the transakcja's own fields already describe.
// Additive — migrate prod before pushing the code that writes the column.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_expense_draft_transfers"
    ADD COLUMN IF NOT EXISTS "read_rows" integer[] CHECK (0 <= ALL ("read_rows"));
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_expense_draft_transfers" DROP COLUMN IF EXISTS "read_rows";
  `)
}
