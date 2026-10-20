import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_investments_initial_info_market" AS ENUM('primary', 'secondary');
    ALTER TABLE "investments"
      ADD COLUMN "initial_info_market" "enum_investments_initial_info_market";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" DROP COLUMN "initial_info_market";
    DROP TYPE "public"."enum_investments_initial_info_market";
  `)
}
