import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// `erased_at` marks a tombstone: the row keeps (source, external_id) so the leads-reconcile cron's
// dedupe still finds it and does not re-create a lead the owner deleted for good.
//
// Additive — nullable, no DEFAULT, no backfill: every existing lead stays live. So this goes to
// production BEFORE the code that filters on it ships.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "trashed_at" timestamp(3) with time zone;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "erased_at" timestamp(3) with time zone;
  `)
}

// Loses which leads were trashed or erased — an erased one comes back as a live, empty lead.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "leads" DROP COLUMN "trashed_at";
    ALTER TABLE "leads" DROP COLUMN "erased_at";
  `)
}
