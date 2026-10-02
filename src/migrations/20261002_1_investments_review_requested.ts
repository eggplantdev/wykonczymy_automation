import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// The „Opinia" textarea was used by hand as exactly this flag: `tak` meant „we asked for a review".
// Every other value (`nie`, typos, a date, empty) carries no request, so it maps to false.
//
// Additive — `review` stays, because the code live before this deploy still SELECTs it. So this
// goes to production BEFORE the push; dropping `review` is a separate, post-deploy migration.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "review_requested" boolean NOT NULL DEFAULT false;
    UPDATE "investments" SET "review_requested" = true WHERE trim(lower("review")) = 'tak';
  `)
}

// `review` was never touched, so the manual `tak` marks survive a rollback.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" DROP COLUMN "review_requested";
  `)
}
