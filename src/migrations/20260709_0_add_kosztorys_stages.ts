import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Additive S-04 schema: dynamic stages (etapy) per investment and sparse per-item,
// per-stage progress. A stage is an ordinal (+ optional label); progress is a single
// qty_done per (item, stage) — a missing row means 0. The two UNIQUE constraints are
// load-bearing: (investment_id, ordinal) keeps stage numbering unique, and
// (item_id, stage_id) backs setStageProgressAction's ON CONFLICT upsert.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "kosztorys_stages" (
      "id" serial PRIMARY KEY,
      "investment_id" integer NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
      "ordinal" integer NOT NULL,
      "label" varchar,
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      CONSTRAINT "kosztorys_stages_investment_ordinal_unique" UNIQUE ("investment_id", "ordinal")
    );
    CREATE INDEX IF NOT EXISTS "kosztorys_stages_investment_id_idx"
      ON "kosztorys_stages" ("investment_id");

    CREATE TABLE IF NOT EXISTS "stage_progress" (
      "id" serial PRIMARY KEY,
      "item_id" integer NOT NULL REFERENCES "kosztorys_items"("id") ON DELETE CASCADE,
      "stage_id" integer NOT NULL REFERENCES "kosztorys_stages"("id") ON DELETE CASCADE,
      "qty_done" numeric NOT NULL DEFAULT 0,
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      CONSTRAINT "stage_progress_item_stage_unique" UNIQUE ("item_id", "stage_id")
    );
    CREATE INDEX IF NOT EXISTS "stage_progress_item_id_idx" ON "stage_progress" ("item_id");
    CREATE INDEX IF NOT EXISTS "stage_progress_stage_id_idx" ON "stage_progress" ("stage_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "stage_progress";
    DROP TABLE IF EXISTS "kosztorys_stages";
  `)
}
