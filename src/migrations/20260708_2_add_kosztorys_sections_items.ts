import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Additive S-01 schema for the in-app kosztorys: two new tables plus investment-level
// markup coefficients. Netto only — VAT (per-investment) is S-12, so no vat_rate here.
// Subcontractor prices are derived from a markup coefficient (investment → section →
// per-item override), not stored, so no subcontractor_*_price columns.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "kosztorys_sections" (
      "id" serial PRIMARY KEY,
      "investment_id" integer NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
      "name" varchar NOT NULL,
      "display_order" integer NOT NULL DEFAULT 0,
      "default_cost_variant" varchar NOT NULL DEFAULT 'w_tools',
      "w_tools_coeff" numeric,
      "own_tools_coeff" numeric,
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "kosztorys_sections_investment_id_idx"
      ON "kosztorys_sections" ("investment_id");

    CREATE TABLE IF NOT EXISTS "kosztorys_items" (
      "id" serial PRIMARY KEY,
      "investment_id" integer NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
      "section_id" integer NOT NULL REFERENCES "kosztorys_sections"("id") ON DELETE CASCADE,
      "display_order" integer NOT NULL DEFAULT 0,
      "description" varchar,
      "unit" varchar,
      "planned_qty" numeric NOT NULL DEFAULT 0,
      "measured_qty" numeric NOT NULL DEFAULT 0,
      "discount_type" varchar,
      "discount_value" numeric NOT NULL DEFAULT 0,
      "client_price" numeric NOT NULL DEFAULT 0,
      "w_tools_override_type" varchar,
      "w_tools_override_value" numeric NOT NULL DEFAULT 0,
      "own_tools_override_type" varchar,
      "own_tools_override_value" numeric NOT NULL DEFAULT 0,
      "cost_variant" varchar,
      "hidden_in_export" boolean NOT NULL DEFAULT false,
      "note" varchar,
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "kosztorys_items_investment_id_idx"
      ON "kosztorys_items" ("investment_id");
    CREATE INDEX IF NOT EXISTS "kosztorys_items_section_id_idx"
      ON "kosztorys_items" ("section_id");

    ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "w_tools_coeff" numeric NOT NULL DEFAULT 0.65;
    ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "own_tools_coeff" numeric NOT NULL DEFAULT 0.55;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "kosztorys_items";
    DROP TABLE IF EXISTS "kosztorys_sections";
    ALTER TABLE "investments" DROP COLUMN IF EXISTS "w_tools_coeff";
    ALTER TABLE "investments" DROP COLUMN IF EXISTS "own_tools_coeff";
  `)
}
