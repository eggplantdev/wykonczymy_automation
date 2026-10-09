import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-1017: a pozycja remembers its katalog prac entry. No FK on purpose: a snapshot or a closed
// investment may name an entry deleted since, and katalog ids are serial and never reused, so a dead
// id just resolves to nothing. Linking existing rows is `src/scripts/link-kosztorys-items-to-catalogue.ts`.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items" ADD COLUMN IF NOT EXISTS "catalogue_item_id" integer;
    CREATE INDEX IF NOT EXISTS "kosztorys_items_catalogue_item_id_idx"
      ON "kosztorys_items" ("catalogue_item_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "kosztorys_items_catalogue_item_id_idx";
    ALTER TABLE "kosztorys_items" DROP COLUMN IF EXISTS "catalogue_item_id";
  `)
}
