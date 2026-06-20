import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Współczynniki narzutu podwykonawcy: globalne na inwestycji + per sekcja (nullable =
// dziedziczy globalny). Pozycja: snapshotowe ceny podwykonawcy zastąpione dwustanowym
// override (typ ∈ {coeff, amount} | null + wartość). Hand-written (migrate:create broken).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments"
      ADD COLUMN IF NOT EXISTS "w_tools_coeff" numeric DEFAULT 0.65,
      ADD COLUMN IF NOT EXISTS "own_tools_coeff" numeric DEFAULT 0.55;

    ALTER TABLE "kosztorys_sections"
      ADD COLUMN IF NOT EXISTS "w_tools_coeff" numeric,
      ADD COLUMN IF NOT EXISTS "own_tools_coeff" numeric;

    ALTER TABLE "kosztorys_items"
      ADD COLUMN IF NOT EXISTS "w_tools_override_type" varchar,
      ADD COLUMN IF NOT EXISTS "w_tools_override_value" numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "own_tools_override_type" varchar,
      ADD COLUMN IF NOT EXISTS "own_tools_override_value" numeric DEFAULT 0;

    ALTER TABLE "kosztorys_items"
      DROP COLUMN IF EXISTS "subcontractor_w_tools_price",
      DROP COLUMN IF EXISTS "subcontractor_own_tools_price";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items"
      ADD COLUMN IF NOT EXISTS "subcontractor_w_tools_price" numeric NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "subcontractor_own_tools_price" numeric NOT NULL DEFAULT 0,
      DROP COLUMN IF EXISTS "w_tools_override_type",
      DROP COLUMN IF EXISTS "w_tools_override_value",
      DROP COLUMN IF EXISTS "own_tools_override_type",
      DROP COLUMN IF EXISTS "own_tools_override_value";

    ALTER TABLE "kosztorys_sections"
      DROP COLUMN IF EXISTS "w_tools_coeff",
      DROP COLUMN IF EXISTS "own_tools_coeff";

    ALTER TABLE "investments"
      DROP COLUMN IF EXISTS "w_tools_coeff",
      DROP COLUMN IF EXISTS "own_tools_coeff";
  `)
}
