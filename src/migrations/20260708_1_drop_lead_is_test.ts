import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written — migrate:create's snapshot baseline is stale on this branch
// (see AGENTS.md / project memory). Drops the `is_test` lead flag: the test/real
// distinction added complexity with no operational value, so it was removed from
// the collection and the whole pipeline.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "is_test";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "is_test" boolean DEFAULT false;
  `)
}
