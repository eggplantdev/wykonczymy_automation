import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-536 netto/brutto wpłata bucket flag. Stored as an enum to match the collection's `select`
// field (Payload maps selects to pg enums, never varchar). Nullable, no default, no backfill —
// legacy deposits stay NULL and subtract at face on both axes. Three-state (NET/GROSS/NULL) so a
// NULL can never collapse into NET under a `!flag` shortcut; the enum IS the CHECK constraint.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_transactions_vat_plane" AS ENUM('NET', 'GROSS');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "transactions"
    ADD COLUMN IF NOT EXISTS "vat_plane" "enum_transactions_vat_plane";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions"
    DROP COLUMN IF EXISTS "vat_plane";

    DROP TYPE IF EXISTS "public"."enum_transactions_vat_plane";
  `)
}
