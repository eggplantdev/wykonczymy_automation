import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-992: a praca spoza rozpiski is typed in the worker's language; the manager reviews and accepts
// its Polish. Both null = not translated yet (or the translation failed); `pl` with no Polish = the
// worker already wrote Polish.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_report_lines"
      ADD COLUMN IF NOT EXISTS "polish_description" text,
      ADD COLUMN IF NOT EXISTS "description_language" text;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "worker_report_lines"
      DROP COLUMN IF EXISTS "polish_description",
      DROP COLUMN IF EXISTS "description_language";
  `)
}
