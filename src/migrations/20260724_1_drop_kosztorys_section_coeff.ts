import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Drops the per-section subcontractor markup coeff tier. effectiveCoeff collapses to
// global (investment) → per-item override; the section tier is gone. Kosztorys data is
// throwaway pre-dogfooding, so no backfill. Touches "kosztorys_sections" ONLY — the
// identically-named "investments" columns are the global tier and stay.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_sections" DROP COLUMN IF EXISTS "w_tools_coeff";
    ALTER TABLE "kosztorys_sections" DROP COLUMN IF EXISTS "own_tools_coeff";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_sections" ADD COLUMN IF NOT EXISTS "w_tools_coeff" numeric;
    ALTER TABLE "kosztorys_sections" ADD COLUMN IF NOT EXISTS "own_tools_coeff" numeric;
  `)
}
