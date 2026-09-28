import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
//
// When an investment was marked Zakończona: the investor's change history is kept for a year past
// this date and then deleted (gcSnapshots). NULL = not completed; the stampCompletedAt hook sets it
// on the transition into `completed` and clears it on reopening.
//
// Backfill (owner, 2026-09-28): an investment already completed takes its `updated_at` — the only
// date the row carries that is at least as late as the completion.
//
// Additive — nullable, no DEFAULT. So this goes to production BEFORE the code that reads it ships.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" ADD COLUMN "completed_at" timestamp(3) with time zone;
    UPDATE "investments" SET "completed_at" = "updated_at" WHERE "status" = 'completed';
  `)
}

// Loses only the completion dates; the retention sweep then keeps every completed investment's
// history (a NULL date reads as „keep").
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" DROP COLUMN "completed_at";
  `)
}
