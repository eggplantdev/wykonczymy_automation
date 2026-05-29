import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Move `google_sheet_id` off `investments` into a new `kosztoryses` collection.
 * Why: lets a kosztorys exist before its investment does (planning/costing a
 * project before committing). The kosztoryses row owns the sheet; `investment`
 * is a nullable FK with ON DELETE SET NULL (kosztorys outlives the investment).
 *
 * Hand-written (NOT migrate:create) because the snapshot baseline on this branch
 * is stale — see project memory `project_migrate_create_stale_snapshots`.
 *
 * Order matters:
 *   1. Create the new table + its unique/partial indexes.
 *   2. Backfill from investments BEFORE dropping the source column.
 *   3. Drop the source column (and its unique index).
 *   4. Wire payload_locked_documents_rels so the admin panel's locking works
 *      (see 20260310_fix_locked_docs_expense_categories for the precedent).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Create the kosztoryses table.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "kosztoryses" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "google_sheet_id" varchar NOT NULL,
      "investment_id" integer REFERENCES "investments"("id") ON DELETE SET NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "kosztoryses_google_sheet_id_idx"
      ON "kosztoryses" ("google_sheet_id");
    CREATE INDEX IF NOT EXISTS "kosztoryses_updated_at_idx"
      ON "kosztoryses" ("updated_at");
    CREATE INDEX IF NOT EXISTS "kosztoryses_created_at_idx"
      ON "kosztoryses" ("created_at");
  `)

  // 2. Partial unique index — one kosztorys per investment, but unlimited
  // unlinked rows (Postgres allows many NULLs under a regular UNIQUE only when
  // the index is partial WHERE NOT NULL).
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "kosztoryses_investment_id_unique_idx"
      ON "kosztoryses" ("investment_id") WHERE "investment_id" IS NOT NULL;
  `)

  // 3. Backfill from investments. Each linked investment becomes one kosztoryses
  // row, named after the investment. Investments without a sheet contribute
  // nothing — they get an unlinked kosztorys later via the new flow.
  await db.execute(sql`
    INSERT INTO "kosztoryses" ("name", "google_sheet_id", "investment_id", "updated_at", "created_at")
    SELECT "name", "google_sheet_id", "id", NOW(), NOW()
    FROM "investments"
    WHERE "google_sheet_id" IS NOT NULL;
  `)

  // 4. Drop the source column (and the unique index from 20260527). DROP COLUMN
  // also drops dependent indexes, so the explicit DROP INDEX is belt-and-braces
  // for older Postgres minor versions.
  await db.execute(sql`
    DROP INDEX IF EXISTS "investments_google_sheet_id_idx";
    ALTER TABLE "investments" DROP COLUMN IF EXISTS "google_sheet_id";
  `)

  // 5. Register the new collection in Payload's locked-documents table.
  // Without this, the admin panel throws "column kosztoryses_id does not exist"
  // on every create/update/delete of a kosztoryses row.
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "kosztoryses_id" integer
      REFERENCES "kosztoryses"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_kosztoryses_id_idx"
      ON "payload_locked_documents_rels" ("kosztoryses_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reverse order: tear down locked-documents wiring, re-add investments.google_sheet_id,
  // copy data back from kosztoryses, then drop the table.
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_kosztoryses_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "kosztoryses_id";
  `)

  await db.execute(sql`
    ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "google_sheet_id" varchar;
  `)

  await db.execute(sql`
    UPDATE "investments" i
    SET "google_sheet_id" = k."google_sheet_id"
    FROM "kosztoryses" k
    WHERE k."investment_id" = i."id";
  `)

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "investments_google_sheet_id_idx"
      ON "investments" ("google_sheet_id");
  `)

  await db.execute(sql`
    DROP INDEX IF EXISTS "kosztoryses_investment_id_unique_idx";
    DROP TABLE IF EXISTS "kosztoryses";
  `)
}
