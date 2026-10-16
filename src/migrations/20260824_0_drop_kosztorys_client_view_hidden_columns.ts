import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-722, the deferred half of 20260819_0: that migration added `mode` + `variants` and deliberately
// left the pair it replaces standing, because `kosztorys_client_view` is read by the unauthenticated
// `/k/:token` entry and one migration doing ADD and DROP at once has no safe deploy order — one side
// always spends the transition window selecting a column that isn't there (Postgres 42703), on the
// public route. Splitting it means the ADD lands under the old code (which ignores the new columns)
// and the DROP under the new (which never names the old ones).
// DEPLOY ORDER IS THE REVERSE OF AGENTS.md's DEFAULT, as for every destructive migration: ship the
// code first, migrate second. The default assumes the NEW code needs the column; here the OLD code
// does. This migration is owed only once the deploy carrying 20260819_0 is live on the target.
// No backfill: the settings the old pair held are re-entered per variant, and kosztorys data is
// throwaway until dogfooding lands on `main`. Neither column carries an index or constraint, and
// neither table has Payload versioning, so there is no `_v` twin to follow.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_client_view"
      DROP COLUMN IF EXISTS "hidden_columns",
      DROP COLUMN IF EXISTS "hide_empty_rows";

    ALTER TABLE "kosztorys_client_view_defaults"
      DROP COLUMN IF EXISTS "hidden_columns",
      DROP COLUMN IF EXISTS "hide_empty_rows";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_client_view"
      ADD COLUMN IF NOT EXISTS "hidden_columns" jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "hide_empty_rows" boolean NOT NULL DEFAULT true;

    ALTER TABLE "kosztorys_client_view_defaults"
      ADD COLUMN IF NOT EXISTS "hidden_columns" jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "hide_empty_rows" boolean NOT NULL DEFAULT true;
  `)
}
