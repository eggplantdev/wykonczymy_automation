import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Worker work reports (EX-947). Purely ADDITIVE: two raw tables plus the report-link collection.
//
// The report tables are raw, not collections: nothing reads them through Payload. Their FKs into
// the kosztorys tree are `ON DELETE SET NULL` because a report must OUTLIVE a restore, which wipes
// and reinserts the tree with fresh ids — each line carries a copy of opis / j.m. / sekcja, and a
// line that lost its pozycja is re-pointed by hand. Every FK into the tree is indexed: a restore of
// a 1000-item kosztorys otherwise scans the lines table once per deleted item.
//
// `status` is text + CHECK, not a pg enum — nothing in Payload owns it, and a CHECK is cheaper to
// widen. CASCADE from users is a backstop: the users delete guard refuses anyone a report names.
//
// `worker_report_shares` mirrors `kosztorys_worker_shares` (20260928_1): the pair is unique here
// because Payload's `unique` is single-column, and `payload_locked_documents_rels` needs its column.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "worker_reports" (
      "id" serial PRIMARY KEY,
      "investment_id" integer NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
      "worker_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "status" text NOT NULL DEFAULT 'pending',
      "sent_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "decided_at" timestamp(3) with time zone,
      "decided_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "target_stage_id" integer REFERENCES "kosztorys_stages"("id") ON DELETE SET NULL,
      "target_stage_ordinal" integer,
      "target_stage_label" varchar,
      CONSTRAINT "worker_reports_status_check" CHECK ("status" IN ('pending', 'accepted', 'rejected')),
      CONSTRAINT "worker_reports_decided_check" CHECK (("status" = 'pending') = ("decided_at" IS NULL))
    );

    CREATE INDEX IF NOT EXISTS "worker_reports_investment_sent_idx"
      ON "worker_reports" ("investment_id", "sent_at" DESC);
    CREATE INDEX IF NOT EXISTS "worker_reports_worker_investment_sent_idx"
      ON "worker_reports" ("worker_id", "investment_id", "sent_at" DESC);
    CREATE INDEX IF NOT EXISTS "worker_reports_pending_idx"
      ON "worker_reports" ("investment_id") WHERE "status" = 'pending';
    CREATE INDEX IF NOT EXISTS "worker_reports_target_stage_idx"
      ON "worker_reports" ("target_stage_id");

    CREATE TABLE IF NOT EXISTS "worker_report_lines" (
      "id" serial PRIMARY KEY,
      "report_id" integer NOT NULL REFERENCES "worker_reports"("id") ON DELETE CASCADE,
      "position" integer NOT NULL,
      "kind" text NOT NULL,
      "item_id" integer REFERENCES "kosztorys_items"("id") ON DELETE SET NULL,
      "description" text NOT NULL,
      "unit" varchar NOT NULL,
      "section_name" varchar,
      "reported_qty" numeric NOT NULL,
      "accepted_qty" numeric,
      "created_item_id" integer REFERENCES "kosztorys_items"("id") ON DELETE SET NULL,
      "catalogue_item_id" integer REFERENCES "work_catalogue_items"("id") ON DELETE SET NULL,
      CONSTRAINT "worker_report_lines_kind_check" CHECK ("kind" IN ('rozpiska', 'extra')),
      CONSTRAINT "worker_report_lines_reported_check" CHECK ("reported_qty" > 0),
      CONSTRAINT "worker_report_lines_accepted_check" CHECK ("accepted_qty" > 0)
    );

    CREATE INDEX IF NOT EXISTS "worker_report_lines_report_idx"
      ON "worker_report_lines" ("report_id");
    CREATE INDEX IF NOT EXISTS "worker_report_lines_item_idx"
      ON "worker_report_lines" ("item_id");
    CREATE INDEX IF NOT EXISTS "worker_report_lines_created_item_idx"
      ON "worker_report_lines" ("created_item_id");

    CREATE TABLE IF NOT EXISTS "worker_report_shares" (
      "id" serial PRIMARY KEY NOT NULL,
      "investment_id" integer NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
      "worker_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "token" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "worker_report_shares_token_idx"
      ON "worker_report_shares" ("token");
    CREATE UNIQUE INDEX IF NOT EXISTS "worker_report_shares_investment_worker_idx"
      ON "worker_report_shares" ("investment_id", "worker_id");
    CREATE INDEX IF NOT EXISTS "worker_report_shares_worker_idx"
      ON "worker_report_shares" ("worker_id");
    CREATE INDEX IF NOT EXISTS "worker_report_shares_updated_at_idx"
      ON "worker_report_shares" ("updated_at");
    CREATE INDEX IF NOT EXISTS "worker_report_shares_created_at_idx"
      ON "worker_report_shares" ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "worker_report_shares_id" integer
      REFERENCES "worker_report_shares"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_worker_report_shares_id_idx"
      ON "payload_locked_documents_rels" ("worker_report_shares_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_worker_report_shares_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "worker_report_shares_id";
    DROP TABLE IF EXISTS "worker_report_shares";
    DROP TABLE IF EXISTS "worker_report_lines";
    DROP TABLE IF EXISTS "worker_reports";
  `)
}
