import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
//
// The investment trash (kosz-inwestycji): NULL = live, a timestamp = in the trash since then. Not
// Payload's `trash: true` / `deleted_at` — that one fails reads closed, which would blind the media
// reference probes to a trashed investment's assets and let a cleanup delete their Blob bytes.
//
// Additive — nullable, no DEFAULT, no backfill: every existing investment stays live. So this goes to
// production BEFORE the code that filters on it ships.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" ADD COLUMN "trashed_at" timestamp(3) with time zone;
  `)
}

// Loses only which investments were in the trash — they come back as live investments.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" DROP COLUMN "trashed_at";
  `)
}
