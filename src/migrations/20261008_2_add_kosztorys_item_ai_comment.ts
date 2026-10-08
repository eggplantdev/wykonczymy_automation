import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-1030: Komentarz AI — what the inquiry left unknown for a pozycja's AI przedmiar and what the
// agent assumed in its place. Kept apart from Komentarz, which the investor may be shown.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items"
      ADD COLUMN IF NOT EXISTS "ai_missing_data" varchar,
      ADD COLUMN IF NOT EXISTS "ai_assumptions" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items"
      DROP COLUMN IF EXISTS "ai_assumptions",
      DROP COLUMN IF EXISTS "ai_missing_data";
  `)
}
