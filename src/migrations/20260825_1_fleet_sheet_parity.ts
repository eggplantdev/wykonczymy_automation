import { type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Parity with the owner's vehicle-control sheet: the five of its columns that had nowhere to go.
//
// `exemptions` is a jsonb array of scheduled inspection types the car will never have — the
// przyczepa's przegląd is „bezterminowo". Separate from `flags` because it is a permanent property
// of the car, not a mark that clears itself once the work is recorded.
//
// `cost` goes back to nullable, partly reversing 20260824_1: the sheet carries no prices, so a
// required column would have written nine „0 zł" that mean „nobody knows". Unknown renders „—" now.
//
// ADD VALUE is legal inside the transactional runner as long as the new value is not USED in the
// same transaction — it is not; the first ODOMETER row comes from the import afterwards.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_vehicle_inspections_type" ADD VALUE IF NOT EXISTS 'ODOMETER';

    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "tyres" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "note" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "exemptions" jsonb;

    ALTER TABLE "vehicle_inspections" ADD COLUMN IF NOT EXISTS "insurer" varchar;
    ALTER TABLE "vehicle_inspections" ADD COLUMN IF NOT EXISTS "policy_number" varchar;
    ALTER TABLE "vehicle_inspections" ALTER COLUMN "cost" DROP NOT NULL;
  `)
}

export async function down(): Promise<void> {
  // No true inverse exists: Postgres cannot drop an enum value, and restoring `cost NOT NULL` means
  // writing „0 zł" over every unknown price — the exact lie this migration removed. Roll back by
  // restoring the dump `db:migrate:prod` takes before it migrates.
  throw new Error('20260825_1_fleet_sheet_parity is irreversible — restore from the dump')
}
