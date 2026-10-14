import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// „Auto" stawka: the katalog row holds no rate of its own and the praca prices off the target
// investment's global coefficient once it lands in a rozpiska. NULL is how that absence is spelled
// — the exact analogue of a NULL override type on the rozpiska side of the seam.
//
// A separate file rather than an edit to 20260901_0: that migration is unpushed but already applied
// to the dev DB and to db-test, so an in-place edit would leave both NOT NULL while `payload
// migrate` reports nothing to do.
//
// Relaxing a constraint is the ADDITIVE direction — the new code needs the column to accept NULL —
// so prod migrates BEFORE the code ships (AGENTS.md, Migrations).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "work_catalogue_items" ALTER COLUMN "w_tools_rate" DROP NOT NULL;
    ALTER TABLE "work_catalogue_items" ALTER COLUMN "own_tools_rate" DROP NOT NULL;
  `)
}

// No row cleanup here on purpose: a down run against a DB that DOES carry an auto row should fail
// loudly rather than delete the owner's row behind his back.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "work_catalogue_items" ALTER COLUMN "w_tools_rate" SET NOT NULL;
    ALTER TABLE "work_catalogue_items" ALTER COLUMN "own_tools_rate" SET NOT NULL;
  `)
}
