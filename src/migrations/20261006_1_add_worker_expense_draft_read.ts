import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// `scan_mode` is the worker's „Jeden wydatek" / „Kilka wydatków" choice; `ai_read` is what the AI read
// from the draft's photos at send, which prefills the manager's „Nowy wydatek". The default matches
// the one-row prefill every existing draft opened with.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_expense_drafts"
      ADD COLUMN IF NOT EXISTS "scan_mode" varchar NOT NULL DEFAULT 'one-invoice',
      ADD COLUMN IF NOT EXISTS "ai_read" jsonb;
    ALTER TABLE "worker_expense_drafts" DROP CONSTRAINT IF EXISTS "worker_expense_drafts_scan_mode_check";
    ALTER TABLE "worker_expense_drafts"
      ADD CONSTRAINT "worker_expense_drafts_scan_mode_check"
      CHECK ("scan_mode" IN ('one-invoice', 'one-per-photo'));
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_expense_drafts"
      DROP CONSTRAINT IF EXISTS "worker_expense_drafts_scan_mode_check",
      DROP COLUMN IF EXISTS "ai_read",
      DROP COLUMN IF EXISTS "scan_mode";
  `)
}
