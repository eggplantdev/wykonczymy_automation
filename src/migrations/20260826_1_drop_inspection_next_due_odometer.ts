import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-745. „Następna wymiana przy (km)" let the digest judge an oil change on a figure the fleet
// table and the vehicle page never read, so one car came out overdue in the mail and clean in the
// app. The alarm is the flat 10 000 km interval on every surface now, and nothing reads this column.
// DEPLOY ORDER IS THE REVERSE OF AGENTS.md's DEFAULT, as for every destructive migration: ship the
// code first, migrate second — the column is what the OLD code selects.
// No backfill: the figure was a manual convenience, and the interval it stood in for is derived from
// `odometer`, which stays.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "vehicle_inspections" DROP COLUMN IF EXISTS "next_due_odometer";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "vehicle_inspections" ADD COLUMN IF NOT EXISTS "next_due_odometer" integer;
  `)
}
