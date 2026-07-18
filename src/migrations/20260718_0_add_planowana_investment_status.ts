import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-506: third investment status `planowana` (prospect/proposal). Additive — no data
// migration; existing rows keep `active`. Postgres 12+ allows ADD VALUE inside Payload's
// transaction as long as the new value isn't *used* in the same transaction (it isn't here).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_investments_status" ADD VALUE IF NOT EXISTS 'planowana';
  `)
}

// Postgres has no DROP VALUE — reverting would mean recreating the enum type and its
// dependent column. Documented no-op.
export async function down(_args: MigrateDownArgs): Promise<void> {}
