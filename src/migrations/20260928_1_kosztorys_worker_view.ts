import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-875 worker view: one named link per (investment, worker), plus the firm-wide worker view
// settings global. The pair is unique here because Payload's `unique` is single-column; both FKs
// CASCADE — a link whose investment or worker is gone must not stay reachable.
// `payload_locked_documents_rels` gets its `kosztorys_worker_shares_id` column — Payload's
// lock-check SELECT references a column per collection and throws without it (20260709_1). The
// global needs none: globals lock through `payload_locked_documents.global_slug`.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "kosztorys_worker_shares" (
      "id" serial PRIMARY KEY NOT NULL,
      "investment_id" integer NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
      "worker_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "token" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "kosztorys_worker_shares_token_idx"
      ON "kosztorys_worker_shares" ("token");
    CREATE UNIQUE INDEX IF NOT EXISTS "kosztorys_worker_shares_investment_worker_idx"
      ON "kosztorys_worker_shares" ("investment_id", "worker_id");
    CREATE INDEX IF NOT EXISTS "kosztorys_worker_shares_worker_idx"
      ON "kosztorys_worker_shares" ("worker_id");
    CREATE INDEX IF NOT EXISTS "kosztorys_worker_shares_updated_at_idx"
      ON "kosztorys_worker_shares" ("updated_at");
    CREATE INDEX IF NOT EXISTS "kosztorys_worker_shares_created_at_idx"
      ON "kosztorys_worker_shares" ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "kosztorys_worker_shares_id" integer
      REFERENCES "kosztorys_worker_shares"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_kosztorys_worker_shares_id_idx"
      ON "payload_locked_documents_rels" ("kosztorys_worker_shares_id");

    CREATE TABLE IF NOT EXISTS "kosztorys_worker_view_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "hidden_columns" jsonb DEFAULT '[]'::jsonb,
      "hide_empty_rows" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "kosztorys_worker_view_settings";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_kosztorys_worker_shares_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "kosztorys_worker_shares_id";
    DROP TABLE IF EXISTS "kosztorys_worker_shares";
  `)
}
