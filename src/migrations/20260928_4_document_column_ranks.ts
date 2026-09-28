import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// The owner's column order for the two closed documents, stored beside the hidden set it is edited
// with. Purely ADDITIVE: `/k/:token` and the worker link read these tables, so the old code must keep
// running against the new schema until the deploy is live.
//
// Nullable with NO default and no backfill: NULL reads as „never ordered" and resolves to the
// document's built-in order in the settings sanitizers.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_client_view" ADD COLUMN IF NOT EXISTS "column_ranks" jsonb;
    ALTER TABLE "kosztorys_client_view_defaults" ADD COLUMN IF NOT EXISTS "column_ranks" jsonb;
    ALTER TABLE "kosztorys_worker_view_settings" ADD COLUMN IF NOT EXISTS "column_ranks" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_client_view" DROP COLUMN IF EXISTS "column_ranks";
    ALTER TABLE "kosztorys_client_view_defaults" DROP COLUMN IF EXISTS "column_ranks";
    ALTER TABLE "kosztorys_worker_view_settings" DROP COLUMN IF EXISTS "column_ranks";
  `)
}
