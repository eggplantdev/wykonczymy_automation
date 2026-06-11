import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (mirrors 20260325_add_correction_enum) — migrate:create's snapshot
// baseline is stale on this branch (see AGENTS.md / project memory).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE enum_transactions_type ADD VALUE IF NOT EXISTS 'RABAT';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres does not support removing enum values — no-op
}
