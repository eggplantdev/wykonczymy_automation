import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// EX-949: a stable number per pozycja, printed on the fill-in form. The id cannot serve — restore,
// sheet import and „Wczytaj szablon" wipe and reinsert, reminting every id — so restore and import
// write `ref` back while every other insert draws a fresh one from the sequence.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS "kosztorys_items_ref_seq";
    ALTER TABLE "kosztorys_items" ADD COLUMN IF NOT EXISTS "ref" integer;
    UPDATE "kosztorys_items" SET "ref" = "id" WHERE "ref" IS NULL;
    SELECT setval('kosztorys_items_ref_seq', (SELECT coalesce(max("ref"), 0) + 1 FROM "kosztorys_items"), false);
    ALTER SEQUENCE "kosztorys_items_ref_seq" OWNED BY "kosztorys_items"."ref";
    ALTER TABLE "kosztorys_items"
      ALTER COLUMN "ref" SET DEFAULT nextval('kosztorys_items_ref_seq'),
      ALTER COLUMN "ref" SET NOT NULL;
    ALTER TABLE "kosztorys_items" ADD CONSTRAINT "kosztorys_items_ref_unique" UNIQUE ("ref");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items" DROP COLUMN IF EXISTS "ref";
    DROP SEQUENCE IF EXISTS "kosztorys_items_ref_seq";
  `)
}
