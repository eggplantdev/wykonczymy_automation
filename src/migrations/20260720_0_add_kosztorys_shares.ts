import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// S-11/EX-532 client share view: one row = one live public link to an investment's kosztorys.
// `investment_id` is UNIQUE (one link per kosztorys; rotate overwrites the token in place) and
// ON DELETE CASCADE so deleting an investment can never strand a live public URL.
// `payload_locked_documents_rels` gets its `kosztorys_shares_id` column here — Payload's
// lock-check SELECT references a column per collection and throws without it (20260709_1).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "kosztorys_shares" (
      "id" serial PRIMARY KEY,
      "investment_id" integer NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
      "token" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "kosztorys_shares_token_idx"
      ON "kosztorys_shares" ("token");
    CREATE UNIQUE INDEX IF NOT EXISTS "kosztorys_shares_investment_id_idx"
      ON "kosztorys_shares" ("investment_id");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "kosztorys_shares_id" integer
      REFERENCES "kosztorys_shares"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_kosztorys_shares_id_idx"
      ON "payload_locked_documents_rels" ("kosztorys_shares_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_kosztorys_shares_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "kosztorys_shares_id";
    DROP TABLE IF EXISTS "kosztorys_shares";
  `)
}
