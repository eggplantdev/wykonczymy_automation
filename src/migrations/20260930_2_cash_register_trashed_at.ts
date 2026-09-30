import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
//
// The kasa trash (kosz-kas, EX-917): NULL = live, a timestamp = in the trash since then. The same
// shape as `investments.trashed_at`, and for the same reason not Payload's `trash: true`.
//
// Additive — nullable, no DEFAULT, no backfill: every existing kasa stays live. So this goes to
// production BEFORE the code that filters on it ships.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "cash_registers" ADD COLUMN "trashed_at" timestamp(3) with time zone;
  `)
}

// Loses only which kasy were in the trash — they come back as live kasy.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "cash_registers" DROP COLUMN "trashed_at";
  `)
}
