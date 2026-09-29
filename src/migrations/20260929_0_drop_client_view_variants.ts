import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-886, the deferred half of 20260928_2: that migration brought back the flat
// `hidden_columns` / `hide_empty_rows` pair, backfilled it from `mode` + `variants`, and left the
// variant pair standing because the unauthenticated `/k/:token` route read it under the old code.
// DEPLOY ORDER (destructive — AGENTS.md › Migrations): the code that no longer names `mode` /
// `variants` ships first, this migration second — and never before 20260928_2 on the same target,
// whose backfill reads both columns.
// `down()` restores the shape only; the variant sets themselves are not recoverable.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_client_view"
      DROP COLUMN IF EXISTS "mode",
      DROP COLUMN IF EXISTS "variants";

    ALTER TABLE "kosztorys_client_view_defaults"
      DROP COLUMN IF EXISTS "mode",
      DROP COLUMN IF EXISTS "variants";

    DROP TYPE IF EXISTS "public"."enum_kosztorys_client_view_mode";
    DROP TYPE IF EXISTS "public"."enum_kosztorys_client_view_defaults_mode";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
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
  `)
}
