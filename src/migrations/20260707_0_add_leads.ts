import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale on this branch — see project memory).
// Enum types are created before the table that references them. The compound unique index on
// (source, external_id) is the idempotency guard for retried webhooks; Postgres allows multiple
// NULLs under it, so a source without an external id won't collide. The payload_locked_documents_rels
// column + index are added here so the admin panel's doc-locking doesn't throw "column does not exist"
// (the miss that needed a follow-up fix for expense_categories — folded in up front here).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_leads_source" AS ENUM('facebook_lead_ads');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_leads_contact_status" AS ENUM('new', 'contacted');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_leads_notify_status" AS ENUM('pending', 'sent', 'failed', 'skipped');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_leads_auto_reply_status" AS ENUM('pending', 'sent', 'failed', 'skipped');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "leads" (
      "id" serial PRIMARY KEY NOT NULL,
      "source" "enum_leads_source" NOT NULL,
      "email" varchar,
      "name" varchar,
      "phone" varchar,
      "raw_data" jsonb,
      "external_id" varchar,
      "form_id" varchar,
      "form_name" varchar,
      "submitted_at" timestamp(3) with time zone,
      "is_test" boolean DEFAULT false,
      "contact_status" "enum_leads_contact_status" DEFAULT 'new' NOT NULL,
      "notify_status" "enum_leads_notify_status" DEFAULT 'pending' NOT NULL,
      "auto_reply_status" "enum_leads_auto_reply_status" DEFAULT 'pending' NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "leads_source_external_id_idx" ON "leads" ("source", "external_id");
    CREATE INDEX IF NOT EXISTS "leads_email_idx" ON "leads" ("email");
    CREATE INDEX IF NOT EXISTS "leads_updated_at_idx" ON "leads" ("updated_at");
    CREATE INDEX IF NOT EXISTS "leads_created_at_idx" ON "leads" ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "leads_id" integer REFERENCES "leads"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_leads_id_idx"
      ON "payload_locked_documents_rels" ("leads_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_leads_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "leads_id";
    DROP TABLE IF EXISTS "leads";
    DROP TYPE IF EXISTS "public"."enum_leads_auto_reply_status";
    DROP TYPE IF EXISTS "public"."enum_leads_notify_status";
    DROP TYPE IF EXISTS "public"."enum_leads_contact_status";
    DROP TYPE IF EXISTS "public"."enum_leads_source";
  `)
}
