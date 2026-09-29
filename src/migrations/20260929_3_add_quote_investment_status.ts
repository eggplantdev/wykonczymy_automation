import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Fifth investment status `quote` („Wycena"), behaving exactly like `planowana`. Additive — no
// data migration. AFTER 'planowana' keeps the enum in lifecycle order. The value is not *used* in
// this transaction, which is what lets ADD VALUE run inside Payload's migration transaction.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_investments_status" ADD VALUE IF NOT EXISTS 'quote' AFTER 'planowana';
  `)
}

// Postgres has no DROP VALUE — reverting would mean recreating the enum type and its
// dependent column. Documented no-op.
export async function down(_args: MigrateDownArgs): Promise<void> {}
