import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Several workers per etap (EX-943). Purely ADDITIVE: `kosztorys_stages.worker_id` stays so the old
// code keeps running until the deploy is live, and is dropped by a later migration in a later push.
//
// A raw table, not a Payload collection: nothing reads it through Payload, and a collection would
// bring its own locked-documents and rels plumbing for no reader (lessons.md). `split_mode` sits on
// the etap as a Payload select, so it is a pg enum like `plane`.
//
// CASCADE from users is a backstop, not the policy: the users delete guard refuses anyone who is on
// an etap, and the reader re-elects a rest holder should one ever vanish anyway.
//
// The backfill turns every assigned etap into a one-person split that takes the whole pool, so no
// figure moves. ON CONFLICT keeps a re-run from duplicating it.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_kosztorys_stages_split_mode" AS ENUM('percent', 'amount');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "kosztorys_stages"
    ADD COLUMN IF NOT EXISTS "split_mode" "enum_kosztorys_stages_split_mode" NOT NULL DEFAULT 'percent';

    CREATE TABLE IF NOT EXISTS "kosztorys_stage_workers" (
      "id" serial PRIMARY KEY,
      "stage_id" integer NOT NULL REFERENCES "kosztorys_stages"("id") ON DELETE CASCADE,
      "worker_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "value" numeric(12, 2) NOT NULL DEFAULT 0,
      "takes_rest" boolean NOT NULL DEFAULT false,
      CONSTRAINT "kosztorys_stage_workers_stage_worker_key" UNIQUE ("stage_id", "worker_id"),
      CONSTRAINT "kosztorys_stage_workers_value_check" CHECK ("value" >= 0)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "kosztorys_stage_workers_one_rest_idx"
    ON "kosztorys_stage_workers" ("stage_id") WHERE "takes_rest";

    CREATE INDEX IF NOT EXISTS "kosztorys_stage_workers_worker_idx"
    ON "kosztorys_stage_workers" ("worker_id");

    INSERT INTO "kosztorys_stage_workers" ("stage_id", "worker_id", "value", "takes_rest")
    SELECT "id", "worker_id", 0, true FROM "kosztorys_stages" WHERE "worker_id" IS NOT NULL
    ON CONFLICT DO NOTHING;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "kosztorys_stage_workers";

    ALTER TABLE "kosztorys_stages" DROP COLUMN IF EXISTS "split_mode";

    DROP TYPE IF EXISTS "public"."enum_kosztorys_stages_split_mode";
  `)
}
