import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// The value is not *used* in this transaction, which is what lets ADD VALUE run inside Payload's
// migration transaction — making it the column default is 20260929_4's job for that reason.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_investments_status" ADD VALUE IF NOT EXISTS 'quote';
  `)
}

// Postgres has no DROP VALUE — reverting would mean recreating the enum type and its
// dependent column.
export async function down(_args: MigrateDownArgs): Promise<void> {}
