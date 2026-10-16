import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md). Additive: migrate prod
// before pushing the code, or every kosztorys tree read fails on the missing columns.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items"
    ADD COLUMN IF NOT EXISTS "ai_new_information" varchar,
    ADD COLUMN IF NOT EXISTS "ai_recheck" boolean NOT NULL DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items"
    DROP COLUMN IF EXISTS "ai_new_information",
    DROP COLUMN IF EXISTS "ai_recheck";
  `)
}
