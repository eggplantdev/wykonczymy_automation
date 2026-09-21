import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// What a landing submission carries beyond a Facebook lead: the three typed answers, the photos,
// and the pointer to the investment it was promoted into. The two relations land in different
// places, which is Payload's rule rather than a choice: `hasMany` goes to a `_rels` join table
// (new — `leads` had no relationship field), a single relationship to a scalar FK column.
//
// `investment_id` is ON DELETE set null: the link is a pointer, not a record worth blocking an
// investment delete over — the lead itself survives, minus a provenance arrow.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_leads_source" ADD VALUE IF NOT EXISTS 'landing_form';

    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "address" varchar;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "scope" varchar;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "area" varchar;

    CREATE TABLE IF NOT EXISTS "leads_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL REFERENCES "leads"("id") ON DELETE cascade,
      "path" varchar NOT NULL,
      "media_id" integer REFERENCES "media"("id") ON DELETE cascade
    );

    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "investment_id" integer
      REFERENCES "investments"("id") ON DELETE set null;
    CREATE INDEX IF NOT EXISTS "leads_investment_idx" ON "leads" ("investment_id");

    CREATE INDEX IF NOT EXISTS "leads_rels_order_idx" ON "leads_rels" ("order");
    CREATE INDEX IF NOT EXISTS "leads_rels_parent_idx" ON "leads_rels" ("parent_id");
    CREATE INDEX IF NOT EXISTS "leads_rels_path_idx" ON "leads_rels" ("path");
    CREATE INDEX IF NOT EXISTS "leads_rels_media_id_idx" ON "leads_rels" ("media_id");
  `)
}

// Postgres has no DROP VALUE — reverting the enum would mean recreating the type and every column
// that depends on it, so that half is a documented no-op.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "leads_investment_idx";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "investment_id";

    DROP INDEX IF EXISTS "leads_rels_media_id_idx";
    DROP INDEX IF EXISTS "leads_rels_path_idx";
    DROP INDEX IF EXISTS "leads_rels_parent_idx";
    DROP INDEX IF EXISTS "leads_rels_order_idx";
    DROP TABLE IF EXISTS "leads_rels";

    ALTER TABLE "leads" DROP COLUMN IF EXISTS "area";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "scope";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "address";
  `)
}
