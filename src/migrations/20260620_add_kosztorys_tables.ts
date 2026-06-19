import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// POC kosztorys (rozpiska robocizny w aplikacji). Hand-written (migrate:create is
// broken on this branch). All tables are per-investment with ON DELETE CASCADE —
// hard-delete, no orphans. Column names are snake_case to match Payload's adapter
// mapping of camelCase field names (e.g. measuredQty -> measured_qty).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "kosztorys_sections" (
      "id" serial PRIMARY KEY NOT NULL,
      "investment_id" integer NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
      "name" varchar NOT NULL,
      "display_order" integer NOT NULL DEFAULT 0,
      "vat_rate" numeric NOT NULL DEFAULT 0.08,
      "default_cost_variant" varchar NOT NULL DEFAULT 'w_tools',
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "kosztorys_items" (
      "id" serial PRIMARY KEY NOT NULL,
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
      "subcontractor_w_tools_price" numeric NOT NULL DEFAULT 0,
      "subcontractor_own_tools_price" numeric NOT NULL DEFAULT 0,
      "cost_variant" varchar,
      "vat_rate" numeric,
      "hidden_in_export" boolean NOT NULL DEFAULT false,
      "note" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "kosztorys_stages" (
      "id" serial PRIMARY KEY NOT NULL,
      "investment_id" integer NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
      "ordinal" integer NOT NULL,
      "label" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "kosztorys_stages_investment_ordinal_unique" UNIQUE ("investment_id", "ordinal")
    );

    CREATE TABLE IF NOT EXISTS "stage_progress" (
      "id" serial PRIMARY KEY NOT NULL,
      "item_id" integer NOT NULL REFERENCES "kosztorys_items"("id") ON DELETE CASCADE,
      "stage_id" integer NOT NULL REFERENCES "kosztorys_stages"("id") ON DELETE CASCADE,
      "qty_done" numeric NOT NULL DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "stage_progress_item_stage_unique" UNIQUE ("item_id", "stage_id")
    );

    CREATE TABLE IF NOT EXISTS "kosztorys_rooms" (
      "id" serial PRIMARY KEY NOT NULL,
      "investment_id" integer NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
      "name" varchar,
      "floor_m2" numeric,
      "perimeter" numeric,
      "height" numeric,
      "wall_m2" numeric,
      "ceiling_decor_m2" numeric,
      "baseboard_m" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "kosztorys_sections_investment_idx" ON "kosztorys_sections" ("investment_id");
    CREATE INDEX IF NOT EXISTS "kosztorys_items_investment_idx" ON "kosztorys_items" ("investment_id");
    CREATE INDEX IF NOT EXISTS "kosztorys_items_section_idx" ON "kosztorys_items" ("section_id");
    CREATE INDEX IF NOT EXISTS "kosztorys_stages_investment_idx" ON "kosztorys_stages" ("investment_id");
    CREATE INDEX IF NOT EXISTS "stage_progress_item_idx" ON "stage_progress" ("item_id");
    CREATE INDEX IF NOT EXISTS "stage_progress_stage_idx" ON "stage_progress" ("stage_id");
    CREATE INDEX IF NOT EXISTS "kosztorys_rooms_investment_idx" ON "kosztorys_rooms" ("investment_id");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "kosztorys_sections_id" integer REFERENCES "kosztorys_sections"("id") ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS "kosztorys_items_id" integer REFERENCES "kosztorys_items"("id") ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS "kosztorys_stages_id" integer REFERENCES "kosztorys_stages"("id") ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS "stage_progress_id" integer REFERENCES "stage_progress"("id") ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS "kosztorys_rooms_id" integer REFERENCES "kosztorys_rooms"("id") ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_kosztorys_sections_id_idx" ON "payload_locked_documents_rels" ("kosztorys_sections_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_kosztorys_items_id_idx" ON "payload_locked_documents_rels" ("kosztorys_items_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_kosztorys_stages_id_idx" ON "payload_locked_documents_rels" ("kosztorys_stages_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_stage_progress_id_idx" ON "payload_locked_documents_rels" ("stage_progress_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_kosztorys_rooms_id_idx" ON "payload_locked_documents_rels" ("kosztorys_rooms_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "kosztorys_sections_id",
      DROP COLUMN IF EXISTS "kosztorys_items_id",
      DROP COLUMN IF EXISTS "kosztorys_stages_id",
      DROP COLUMN IF EXISTS "stage_progress_id",
      DROP COLUMN IF EXISTS "kosztorys_rooms_id";

    DROP TABLE IF EXISTS "stage_progress";
    DROP TABLE IF EXISTS "kosztorys_items";
    DROP TABLE IF EXISTS "kosztorys_stages";
    DROP TABLE IF EXISTS "kosztorys_rooms";
    DROP TABLE IF EXISTS "kosztorys_sections";
  `)
}
