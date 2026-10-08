import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-1025: a paragon management refused as a duplicate keeps what it duplicates, `{source, id}`.
// NULL is an ordinary refusal. Not a foreign key: the mark must outlive the expense it points at.
//
// The document identity on a transakcja feeds the duplicate check. `document_date` is ISO
// `YYYY-MM-DD` text, not a timestamptz: a date-only value would drift across the timezone boundary.
// `IF NOT EXISTS` because the spike's migration already added `duplicate_of` to local databases.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_expense_drafts" ADD COLUMN IF NOT EXISTS "duplicate_of" jsonb;
    ALTER TABLE "worker_expense_draft_skipped_receipts" ADD COLUMN IF NOT EXISTS "duplicate_of" jsonb;
    ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "document_number" varchar;
    ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "seller_nip" varchar;
    ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "document_date" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions" DROP COLUMN IF EXISTS "document_date";
    ALTER TABLE "transactions" DROP COLUMN IF EXISTS "seller_nip";
    ALTER TABLE "transactions" DROP COLUMN IF EXISTS "document_number";
    ALTER TABLE "worker_expense_draft_skipped_receipts" DROP COLUMN IF EXISTS "duplicate_of";
    ALTER TABLE "worker_expense_drafts" DROP COLUMN IF EXISTS "duplicate_of";
  `)
}
