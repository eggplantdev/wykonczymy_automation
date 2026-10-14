import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written — migrate:create's snapshot baseline is stale on this branch
// (see AGENTS.md / project memory). Holds the owner's manual field→column
// pointing for sheets whose header text we cannot resolve by name.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztoryses" ADD COLUMN IF NOT EXISTS "sheet_column_mapping" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztoryses" DROP COLUMN IF EXISTS "sheet_column_mapping";
  `)
}
