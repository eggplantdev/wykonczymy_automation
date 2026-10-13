import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-729: „Koszt" becomes required on a przegląd. Without it the fleet listing's new cost column
// would render one `0 zł` for two different claims — „it cost nothing" and „nobody typed a price".
// The column can only tell the truth once the source cannot be left empty.
//
// The backfill turns „unknown" into „zero" and is not reversible, so a human checks the affected
// count before running this against prod:
//   SELECT count(*) FROM vehicle_inspections WHERE cost IS NULL;
//
// DEPLOY ORDER IS AGENTS.md's ADDITIVE DEFAULT — migrate prod BEFORE pushing. A tightening reads as
// destructive, but the two windows are not symmetric. Migrating first leaves old code able to submit
// an empty koszt for a few minutes: Postgres rejects it loudly with 23502, which is exactly the input
// this change exists to forbid. Pushing first leaves legacy NULL rows under a `required` field, and
// Payload backfills an absent value from the stored doc where a stored NULL counts as present — so
// every partial update on such a row (the sweep's notify stamp, any /admin edit) throws
// ValidationError until someone runs the migration. That window is unbounded and silent.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "vehicle_inspections" SET "cost" = 0 WHERE "cost" IS NULL;

    ALTER TABLE "vehicle_inspections" ALTER COLUMN "cost" SET NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Only the constraint comes off — a backfilled zero is indistinguishable from a typed one.
  await db.execute(sql`
    ALTER TABLE "vehicle_inspections" ALTER COLUMN "cost" DROP NOT NULL;
  `)
}
