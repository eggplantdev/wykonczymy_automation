import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-945: an etap's workers live in `kosztorys_stage_workers` since EX-943 (20260930_1); this column
// was kept only for the code deployed before it. Destructive — production runs this after the push.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "kosztorys_stages_worker_id_idx";

    ALTER TABLE "kosztorys_stages" DROP COLUMN IF EXISTS "worker_id";
  `)
}

// One worker per etap is all the column can hold, so a rollback keeps the rest holder.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_stages"
    ADD COLUMN IF NOT EXISTS "worker_id" integer
    REFERENCES "users"("id") ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS "kosztorys_stages_worker_id_idx"
      ON "kosztorys_stages" ("worker_id");

    UPDATE "kosztorys_stages" s SET "worker_id" = m."worker_id"
    FROM "kosztorys_stage_workers" m
    WHERE m."stage_id" = s."id" AND m."takes_rest";
  `)
}
