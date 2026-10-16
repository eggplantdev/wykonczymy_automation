import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-711: „Serwis" — the ad-hoc repair, distinct from the yearly przegląd okresowy (TECHNICAL) and
// from a warranty-period service (WARRANTY) — plus `vehicles.flags`, the manual „do wymiany" marks.
//
// `flags` is a jsonb map `inspection type → the day it was marked`, not a boolean per type: the day
// is what lets a mark clear itself once the work is recorded (src/lib/fleet/flags.ts). Nothing
// queries it, so one column beats a child table.
//
// ADD VALUE is legal inside the transactional runner as long as the new value is not USED in the
// same transaction — it is not; the first SERVICE row comes from the app afterwards.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_vehicle_inspections_type" ADD VALUE IF NOT EXISTS 'SERVICE';
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "flags" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres cannot remove an enum value; 'SERVICE' stays. Only the column is reversible.
  await db.execute(sql`
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "flags";
  `)
}
