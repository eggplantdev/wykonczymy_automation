import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// `hidden_in_export` was written on every insert and read by zero decision branches: its projection
// half (`toClientView`) was retired by kosztorys-client-view-reuse, and hiding rows from the client
// then shipped as a rule — the „ukryj puste pozycje" filter in the per-investment client-view
// settings (EX-695) — rather than a per-row flag.
// DEPLOY ORDER IS THE REVERSE OF AGENTS.md's DEFAULT: ship the code first, migrate prod second. That
// rule assumes an additive migration, where the new code needs the column; here the OLD code does,
// so migrating first leaves the live deploy selecting a dropped column (42703) until it rolls over.
// No backfill: kosztorys data is throwaway until dogfooding lands on `main`. Plain boolean column
// (20260708_2) with no index or constraint, and kosztorys_items has no Payload versioning, so
// there is no `_kosztorys_items_v` twin to drop from.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items" DROP COLUMN IF EXISTS "hidden_in_export";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items"
      ADD COLUMN IF NOT EXISTS "hidden_in_export" boolean NOT NULL DEFAULT false;
  `)
}
