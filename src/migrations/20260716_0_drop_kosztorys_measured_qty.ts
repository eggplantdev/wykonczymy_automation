import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-494/EX-489 follow-up: „Pomiar z natury" is the sheet's O = SUM(D:M), so it is always the stage
// sum — never a typed input. The `measured_qty` column is therefore redundant (== Σ stages) and
// carries stale values from when it WAS typed, so it's dropped outright. No backfill: kosztorys data
// is throwaway until dogfooding lands on `main` (AGENTS.md → Databases And Live Data).
// kosztorys-items has no Payload versioning, so there is no `_kosztorys_items_v` twin table.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items" DROP COLUMN IF EXISTS "measured_qty";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items" ADD COLUMN IF NOT EXISTS "measured_qty" numeric NOT NULL DEFAULT 0;
  `)
}
