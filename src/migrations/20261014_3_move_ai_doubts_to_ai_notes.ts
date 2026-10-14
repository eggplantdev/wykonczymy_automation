import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Before „Uwagi AI” existed the AI kosztorys script put its doubts in Notatki, above this separator
// line and the client's mail. The script now writes only „Uwagi AI” and reads all of Notatki as the
// inquiry, so the old doubts move out: above the line → ai_notes, below it → notes.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "investments"
    SET "ai_notes" = btrim(split_part("notes", '———— mail klienta ————', 1), E' \n\r\t'),
        "notes" = btrim(split_part("notes", '———— mail klienta ————', 2), E' \n\r\t')
    WHERE position('———— mail klienta ————' IN "notes") > 0
      AND "ai_notes" IS NULL;
  `)
}

// Irreversible: after `up` a moved row is indistinguishable from one the script wrote.
export async function down(_args: MigrateDownArgs): Promise<void> {}
