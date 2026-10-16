import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Katalog prac: the global cennik. One row per (opis, j.m.) pair, carrying „Cena j.m." and both
// subcontractor stawki frozen as amounts.
//
// Purely additive — the table does not exist before this migration, so prod migrates BEFORE the
// code ships (AGENTS.md, Migrations).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "work_catalogue_items" (
      "id" serial PRIMARY KEY NOT NULL,
      "description" varchar NOT NULL,
      "category" varchar,
      "unit" varchar NOT NULL,
      "client_price" numeric NOT NULL,
      "w_tools_rate" numeric NOT NULL,
      "own_tools_rate" numeric NOT NULL,
      "match_key" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );

    -- The praca's identity, folded from opis + j.m. by catalogueKey(). Single-column, so Payload's
    -- field-level unique flag on matchKey agrees with it (a compound key would not — see
    -- lessons.md, „Payload unique: true is single-column only").
    CREATE UNIQUE INDEX IF NOT EXISTS "work_catalogue_items_match_key_idx"
      ON "work_catalogue_items" ("match_key");
    CREATE INDEX IF NOT EXISTS "work_catalogue_items_updated_at_idx"
      ON "work_catalogue_items" ("updated_at");
    CREATE INDEX IF NOT EXISTS "work_catalogue_items_created_at_idx"
      ON "work_catalogue_items" ("created_at");

    -- Payload's lock-check SELECT names a column per collection and throws without it (20260709_1).
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "work_catalogue_items_id" integer
      REFERENCES "work_catalogue_items"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_work_catalogue_items_id_idx"
      ON "payload_locked_documents_rels" ("work_catalogue_items_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_work_catalogue_items_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "work_catalogue_items_id";

    DROP TABLE IF EXISTS "work_catalogue_items";
  `)
}
