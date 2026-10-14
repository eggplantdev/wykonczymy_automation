import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-695 client preview settings: one row per investment describing what its client sees, plus the
// firm-wide defaults global every investment falls back to.
// `investment_id` is UNIQUE (one settings row per investment) and ON DELETE CASCADE.
// `payload_locked_documents_rels` gets its `kosztorys_client_view_id` column here — Payload's
// lock-check SELECT references a column per collection and throws without it (20260709_1). The
// global needs no such column: globals are locked through `payload_locked_documents.global_slug`.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "kosztorys_client_view" (
      "id" serial PRIMARY KEY,
      "investment_id" integer NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
      "hidden_columns" jsonb DEFAULT '[]'::jsonb,
      "hide_empty_rows" boolean NOT NULL DEFAULT true,
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "kosztorys_client_view_investment_id_idx"
      ON "kosztorys_client_view" ("investment_id");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "kosztorys_client_view_id" integer
      REFERENCES "kosztorys_client_view"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_kosztorys_client_view_id_idx"
      ON "payload_locked_documents_rels" ("kosztorys_client_view_id");

    CREATE TABLE IF NOT EXISTS "kosztorys_client_view_defaults" (
      "id" serial PRIMARY KEY,
      "hidden_columns" jsonb DEFAULT '[]'::jsonb,
      "hide_empty_rows" boolean NOT NULL DEFAULT true,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "kosztorys_client_view_defaults";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_kosztorys_client_view_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "kosztorys_client_view_id";
    DROP TABLE IF EXISTS "kosztorys_client_view";
  `)
}
