import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Purely ADDITIVE: migrate prod before pushing the code that reads these columns.
//
// `description_translations` is one jsonb map per row ({ uk: { text, source } }) so a new language
// is a new key, not a migration. NOT NULL with a '{}' default: every existing row reads as
// „no translation" without a backfill.
//
// `users.language` is a plain varchar, not a Payload select — a select always creates a Postgres
// enum, which would need an ALTER TYPE per new language. NULL reads as Polish.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items" ADD COLUMN IF NOT EXISTS "description_translations" jsonb NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE "work_catalogue_items" ADD COLUMN IF NOT EXISTS "description_translations" jsonb NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "language" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items" DROP COLUMN IF EXISTS "description_translations";
    ALTER TABLE "work_catalogue_items" DROP COLUMN IF EXISTS "description_translations";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "language";
  `)
}
