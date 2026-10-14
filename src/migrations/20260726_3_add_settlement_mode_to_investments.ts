import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// How an investment is settled (EX-588). Stored as an enum to match the collection's `select` field
// (Payload maps selects to pg enums, never varchar). NOT NULL DEFAULT 'NET' is the whole backfill:
// every existing investment reads netto until the owner says otherwise, so no row can land in a null
// state the panel would have to interpret.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_investments_settlement_mode" AS ENUM('NET', 'GROSS', 'MIXED');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "investments"
    ADD COLUMN IF NOT EXISTS "settlement_mode" "enum_investments_settlement_mode" NOT NULL DEFAULT 'NET';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments"
    DROP COLUMN IF EXISTS "settlement_mode";

    DROP TYPE IF EXISTS "public"."enum_investments_settlement_mode";
  `)
}
