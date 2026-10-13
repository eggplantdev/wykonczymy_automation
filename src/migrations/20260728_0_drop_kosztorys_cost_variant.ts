import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// The per-item cost-variant tier never had a consumer (its only reader was deleted in 6bd7c745).
// The concept it was meant to carry shipped on kosztorys_stages.plane instead (EX-565), at the
// etap grain the owner confirmed.
// No backfill: kosztorys data is throwaway until dogfooding lands on `main`. Neither column
// carries an index, constraint or pg enum (both plain varchar, 20260708_2), and kosztorys_items
// has no Payload versioning, so there is no `_kosztorys_items_v` twin to drop from.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items" DROP COLUMN IF EXISTS "cost_variant";
    ALTER TABLE "kosztorys_sections" DROP COLUMN IF EXISTS "default_cost_variant";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items" ADD COLUMN IF NOT EXISTS "cost_variant" varchar;
    ALTER TABLE "kosztorys_sections"
      ADD COLUMN IF NOT EXISTS "default_cost_variant" varchar NOT NULL DEFAULT 'w_tools';
  `)
}
