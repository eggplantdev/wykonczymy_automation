import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// The client preview stops being one column set per investment: `variants` holds both the offer and
// the settlement set at once, `mode` says which one the client's link serves.
//
// Purely ADDITIVE on purpose, even though `hidden_columns` / `hide_empty_rows` are dead after it.
// The routes that read this table include the unauthenticated client entrances (`/k/:token`), so a
// migration that both adds and drops has no safe deploy order — whichever side goes first, the other
// deploy spends the gap selecting a column that does not exist (42703) on exactly those routes.
// Adding first is orderless; the old pair is dropped by a follow-up migration once this deploy is
// live.
//
// Existing rows ARE deleted: their column set lived in the two dead columns, and nobody had ticked a
// variant yet (owner, 2026-08-19). Left in place they would carry `variants = {}` — which resolves to
// the CODE default and would silently opt those investments out of the firm-wide default forever.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_kosztorys_client_view_mode" AS ENUM('OFFER', 'SETTLEMENT');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_kosztorys_client_view_defaults_mode" AS ENUM('OFFER', 'SETTLEMENT');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    ALTER TABLE "kosztorys_client_view"
      ADD COLUMN IF NOT EXISTS "mode" "enum_kosztorys_client_view_mode" NOT NULL DEFAULT 'OFFER',
      ADD COLUMN IF NOT EXISTS "variants" jsonb DEFAULT '{}'::jsonb;

    ALTER TABLE "kosztorys_client_view_defaults"
      ADD COLUMN IF NOT EXISTS "mode" "enum_kosztorys_client_view_defaults_mode" NOT NULL DEFAULT 'OFFER',
      ADD COLUMN IF NOT EXISTS "variants" jsonb DEFAULT '{}'::jsonb;

    DELETE FROM "kosztorys_client_view";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_client_view"
      DROP COLUMN IF EXISTS "mode",
      DROP COLUMN IF EXISTS "variants",
      ADD COLUMN IF NOT EXISTS "hidden_columns" jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "hide_empty_rows" boolean NOT NULL DEFAULT true;

    ALTER TABLE "kosztorys_client_view_defaults"
      DROP COLUMN IF EXISTS "mode",
      DROP COLUMN IF EXISTS "variants",
      ADD COLUMN IF NOT EXISTS "hidden_columns" jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "hide_empty_rows" boolean NOT NULL DEFAULT true;

    DROP TYPE IF EXISTS "public"."enum_kosztorys_client_view_defaults_mode";
    DROP TYPE IF EXISTS "public"."enum_kosztorys_client_view_mode";
  `)
}
