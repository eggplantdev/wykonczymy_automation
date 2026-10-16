import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-983, the DESTRUCTIVE tail of EX-966: the `/p` link and the `kosztorys-worker-shares` collection
// are gone from the code (ab573bda6), so the table and its lock-rels column are read by nothing.
// Runs only once that deploy is live — the old code's Payload lock-check SELECTs the column (42703).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_kosztorys_worker_shares_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "kosztorys_worker_shares_id";
    DROP TABLE IF EXISTS "kosztorys_worker_shares";
  `)
}

// Structure only — the links do NOT come back; every worker's old `/p` token stays dead.
export async function down({ db }: MigrateDownArgs): Promise<void> {
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
  `)
}
