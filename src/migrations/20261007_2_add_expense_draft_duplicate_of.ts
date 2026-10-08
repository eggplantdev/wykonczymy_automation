import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-1025: a paragon management refused as a duplicate keeps what it duplicates, `{source, id}`.
// NULL is an ordinary refusal. Not a foreign key: the mark must outlive the expense it points at.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_expense_drafts" ADD COLUMN IF NOT EXISTS "duplicate_of" jsonb;
    ALTER TABLE "worker_expense_draft_skipped_receipts" ADD COLUMN IF NOT EXISTS "duplicate_of" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_expense_draft_skipped_receipts" DROP COLUMN IF EXISTS "duplicate_of";
    ALTER TABLE "worker_expense_drafts" DROP COLUMN IF EXISTS "duplicate_of";
  `)
}
