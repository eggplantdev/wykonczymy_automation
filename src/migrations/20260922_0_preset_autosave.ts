import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
//
// The szablon workbench saves itself, so the payload is rewritten with no gesture from the user.
// `mirrored_at` is the throttle's marker — the atomic `UPDATE … WHERE mirrored_at < now() -
// interval` decides whether a given write happens at all, because Node's clock is not shared
// between serverless instances. `updated_at` is what the szablon library reads: without it a list
// sorted by `created_at` would never move, however many times a szablon changed.
//
// Both nullable, no backfill: `mirrored_at IS NULL` means „never mirrored", so the throttle lets
// the first write through, and `updated_at DESC NULLS LAST` keeps rows predating the column in view.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_presets" ADD COLUMN IF NOT EXISTS "mirrored_at" timestamp(3) with time zone;
    ALTER TABLE "kosztorys_presets" ADD COLUMN IF NOT EXISTS "updated_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_presets" DROP COLUMN IF EXISTS "updated_at";
    ALTER TABLE "kosztorys_presets" DROP COLUMN IF EXISTS "mirrored_at";
  `)
}
