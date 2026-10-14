import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md). Additive: migrate prod
// before pushing the code, or every read of the reference data fails on the missing column.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments"
    ADD COLUMN IF NOT EXISTS "ai_notes" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments"
    DROP COLUMN IF EXISTS "ai_notes";
  `)
}
