import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md). Additive: migrate prod
// before pushing the code, or saving „Nowe informacje” fails on an enum without the value.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_investments_ai_stage" ADD VALUE IF NOT EXISTS 'new_information';
  `)
}

// Irreversible: Postgres cannot drop an enum value.
export async function down(_args: MigrateDownArgs): Promise<void> {}
