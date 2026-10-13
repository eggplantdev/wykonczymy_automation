import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// The metoda płatności is now asked on two types only — a wpłata od inwestora, where it IS the
// netto/brutto plane, and a wydatek inwestycyjny netto. Everywhere else the row stores null instead
// of the „Gotówka" default nobody chose, so the transfers column and its filter keep meaning
// „zapłacono tak", not „tak albo nikt nie pytał".
// Additive in the deploy-order sense (the new code writes NULLs the old constraint would refuse), so
// this migrates prod BEFORE the code ships. No backfill: existing rows keep the method they were
// booked with — this changes what gets written from now on, not what was.
// `down` fails on any row already written without a method, which is the honest outcome: filling
// those in with „Gotówka" would invent the answer this migration exists to stop inventing.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions" ALTER COLUMN "payment_method" DROP NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions" ALTER COLUMN "payment_method" SET NOT NULL;
  `)
}
