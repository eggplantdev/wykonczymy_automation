import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (mirrors 20260611_add_rabat_enum) — migrate:create's snapshot baseline is
// stale (see AGENTS.md). Alone in its migration on purpose: Postgres refuses to USE a new
// enum value in the transaction that added it, so anything referencing
// INVESTMENT_EXPENSE_NET must land in a later migration (here: `_1_add_net_amount`).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE enum_transactions_type ADD VALUE IF NOT EXISTS 'INVESTMENT_EXPENSE_NET';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres does not support removing enum values — no-op
}
