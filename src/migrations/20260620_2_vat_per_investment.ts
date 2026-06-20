import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// VAT per inwestycja: jedna stawka na inwestycji (jak współczynniki narzutu). Zejście z
// odrzuconego wariantu kaskadowego sekcja→pozycja — usuwamy martwe kolumny vat_rate z
// kosztorys_sections i kosztorys_items (UI ich nie edytuje). Hand-written (migrate:create broken).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments"
      ADD COLUMN IF NOT EXISTS "vat_rate" numeric NOT NULL DEFAULT 0.08;

    ALTER TABLE "kosztorys_items" DROP COLUMN IF EXISTS "vat_rate";
    ALTER TABLE "kosztorys_sections" DROP COLUMN IF EXISTS "vat_rate";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_sections"
      ADD COLUMN IF NOT EXISTS "vat_rate" numeric NOT NULL DEFAULT 0.08;
    ALTER TABLE "kosztorys_items"
      ADD COLUMN IF NOT EXISTS "vat_rate" numeric;

    ALTER TABLE "investments" DROP COLUMN IF EXISTS "vat_rate";
  `)
}
