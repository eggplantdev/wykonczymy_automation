import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// `transactions.invoice` becomes hasMany (EX-659): one invoice can need several photographed pages.
// Payload moves a hasMany relation off the scalar `invoice_id` column onto a `<collection>_rels`
// join table, so the shape below mirrors `payload_locked_documents_rels` — that is the only
// hasMany precedent in this DB.
//
// Order is create → backfill → verify → drop, and the verify step is not ceremony: an
// `INSERT … SELECT` reports success just as happily when it copies zero rows, and dropping
// `invoice_id` afterwards makes that silent loss unrecoverable.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "transactions_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL REFERENCES "transactions"("id") ON DELETE cascade,
      "path" varchar NOT NULL,
      "media_id" integer REFERENCES "media"("id") ON DELETE cascade
    );

    CREATE INDEX IF NOT EXISTS "transactions_rels_order_idx" ON "transactions_rels" ("order");
    CREATE INDEX IF NOT EXISTS "transactions_rels_parent_idx" ON "transactions_rels" ("parent_id");
    CREATE INDEX IF NOT EXISTS "transactions_rels_path_idx" ON "transactions_rels" ("path");
    CREATE INDEX IF NOT EXISTS "transactions_rels_media_id_idx" ON "transactions_rels" ("media_id");

    INSERT INTO "transactions_rels" ("order", "parent_id", "path", "media_id")
    SELECT 0, "id", 'invoice', "invoice_id"
    FROM "transactions"
    WHERE "invoice_id" IS NOT NULL;

    DO $$
    DECLARE
      expected bigint;
      copied bigint;
    BEGIN
      SELECT count(*) INTO expected FROM "transactions" WHERE "invoice_id" IS NOT NULL;
      SELECT count(*) INTO copied FROM "transactions_rels" WHERE "path" = 'invoice';
      IF copied <> expected THEN
        RAISE EXCEPTION 'invoice backfill copied % of % rows', copied, expected;
      END IF;
    END $$;

    DROP INDEX IF EXISTS "transactions_invoice_idx";
    ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_invoice_id_media_id_fk";
    ALTER TABLE "transactions" DROP COLUMN IF EXISTS "invoice_id";
  `)
}

// Reverses the copy before dropping the join table. A row that gained extra pages while hasMany was
// live keeps only its first one — the scalar column cannot hold the rest.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "invoice_id" integer;
    ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_invoice_id_media_id_fk";
    ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoice_id_media_id_fk"
      FOREIGN KEY ("invoice_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX IF NOT EXISTS "transactions_invoice_idx" ON "transactions" ("invoice_id");

    UPDATE "transactions" AS t
    SET "invoice_id" = first_page."media_id"
    FROM (
      SELECT DISTINCT ON ("parent_id") "parent_id", "media_id"
      FROM "transactions_rels"
      WHERE "path" = 'invoice' AND "media_id" IS NOT NULL
      ORDER BY "parent_id", "order" NULLS LAST, "id"
    ) AS first_page
    WHERE t."id" = first_page."parent_id";

    DROP TABLE IF EXISTS "transactions_rels";
  `)
}
