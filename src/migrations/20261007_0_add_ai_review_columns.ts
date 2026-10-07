import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-1006: the katalog's Komentarz do pracy, and the AI draft review on a pozycja — AI przedmiar
// (what the agent offered; NULL = the agent never saw the row, 0 = it left the row out), the
// manager's Status and the Powód zmiany. One migration for both tables so prod migrates once.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_kosztorys_items_review_status') THEN
        CREATE TYPE "enum_kosztorys_items_review_status" AS ENUM
          ('accepted', 'rejected', 'edited', 'added');
      END IF;
    END $$;

    ALTER TABLE "kosztorys_items"
      ADD COLUMN IF NOT EXISTS "ai_planned_qty" numeric,
      ADD COLUMN IF NOT EXISTS "change_reason" varchar,
      ADD COLUMN IF NOT EXISTS "review_status" "enum_kosztorys_items_review_status";

    ALTER TABLE "work_catalogue_items" ADD COLUMN IF NOT EXISTS "work_note" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "work_catalogue_items" DROP COLUMN IF EXISTS "work_note";

    ALTER TABLE "kosztorys_items"
      DROP COLUMN IF EXISTS "review_status",
      DROP COLUMN IF EXISTS "change_reason",
      DROP COLUMN IF EXISTS "ai_planned_qty";

    DROP TYPE IF EXISTS "enum_kosztorys_items_review_status";
  `)
}
