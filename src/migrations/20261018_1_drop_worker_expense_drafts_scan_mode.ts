import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// RUN-AFTER-DEPLOY
//
// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Runs only once the deploy that no longer names `scan_mode` is live — the previous code inserts it
// on every send and restore (42703).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_expense_drafts"
      DROP CONSTRAINT IF EXISTS "worker_expense_drafts_scan_mode_check",
      DROP COLUMN IF EXISTS "scan_mode";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_expense_drafts"
      ADD COLUMN IF NOT EXISTS "scan_mode" varchar NOT NULL DEFAULT 'one-invoice';
    ALTER TABLE "worker_expense_drafts" DROP CONSTRAINT IF EXISTS "worker_expense_drafts_scan_mode_check";
    ALTER TABLE "worker_expense_drafts"
      ADD CONSTRAINT "worker_expense_drafts_scan_mode_check"
      CHECK ("scan_mode" IN ('one-invoice', 'one-per-photo'));
  `)
}
