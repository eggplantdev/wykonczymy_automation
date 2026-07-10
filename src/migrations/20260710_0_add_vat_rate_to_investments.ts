import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// S-05: one VAT rate per investment, stored as a fraction (0.08 = 8%). Non-null default so
// existing rows backfill to 8% without a data migration. Kosztorys prices stay netto; brutto
// is computed (net × (1 + vat_rate)).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "vat_rate" numeric NOT NULL DEFAULT 0.08;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" DROP COLUMN IF EXISTS "vat_rate";
  `)
}
