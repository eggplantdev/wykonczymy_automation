import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// The same shape as `investments.trashed_at`, and for the same reason not Payload's `trash: true`.
//
// Additive — nullable, no DEFAULT, no backfill: every existing kasa stays live. So this goes to
// production BEFORE the code that filters on it ships.
//
// IF NOT EXISTS: it ran on local DBs as `20260930_2_…` before a merge renumbered it, and Payload
// matches migrations by name, so those DBs run it a second time.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "trashed_at" timestamp(3) with time zone;
  `)
}

// Loses only which kasy were in the trash — they come back as live kasy.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "cash_registers" DROP COLUMN "trashed_at";
  `)
}
