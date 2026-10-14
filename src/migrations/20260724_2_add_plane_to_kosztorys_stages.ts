import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Per-etap tool-plane (EX-565). Stored as an enum to match the collection's `select` field
// (Payload maps selects to pg enums, never varchar). Nullable, no default, no backfill — a NULL
// means "defaulted to z narzędziami, unconfirmed" and drives the TriangleAlert warning; an explicit
// pick (even the default value) writes the enum and clears it. Kosztorys data is throwaway until
// dogfooding lands, so existing stages simply read NULL after this migration.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_kosztorys_stages_plane" AS ENUM('w_tools', 'own_tools');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "kosztorys_stages"
    ADD COLUMN IF NOT EXISTS "plane" "enum_kosztorys_stages_plane";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_stages"
    DROP COLUMN IF EXISTS "plane";

    DROP TYPE IF EXISTS "public"."enum_kosztorys_stages_plane";
  `)
}
