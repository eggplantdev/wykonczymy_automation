import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// The same shape as `cash_registers.trashed_at`, and for the same reason not Payload's `trash: true`.
//
// Additive — nullable, no DEFAULT, no backfill: every existing account stays live. So this goes to
// production BEFORE the code that filters on it ships.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trashed_at" timestamp(3) with time zone;
  `)
}

// Loses only which accounts were in the trash — they come back as live accounts.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN "trashed_at";
  `)
}
