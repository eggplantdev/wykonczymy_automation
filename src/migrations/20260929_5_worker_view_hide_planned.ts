import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Purely ADDITIVE: the worker link reads this table, so the old code must keep running against the
// new schema until the deploy is live. DEFAULT true backfills the existing row with the owner's
// requested default (przedmiar off once work exists).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_worker_view_settings" ADD COLUMN IF NOT EXISTS "hide_planned_once_executed" boolean DEFAULT true;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_worker_view_settings" DROP COLUMN IF EXISTS "hide_planned_once_executed";
  `)
}
