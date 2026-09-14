import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-758 equipment register: one row per physical item, plus an append-only event log. An item
// stores no "where is it" column — the current location is always the newest event for that item,
// which is what keeps the trail of who had it when it went missing.
//
// Dates are `timestamp(3) with time zone` pinned to midnight UTC, NOT `date`: this DB's existing
// day-only convention and the only shape Payload's adapter models for a `date` field. Day
// comparison is therefore the warranty logic's job (src/lib/equipment/), where it is pure and
// test-pinned, not the column type's.
//
// Filename lexical order IS the run order (readMigrationFiles), so this sorts after everything it
// references and before anything referencing it.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_equipment_status') THEN
        CREATE TYPE "enum_equipment_status" AS ENUM
          ('IN_USE', 'RETIRED', 'SOLD', 'LOST', 'STOLEN');
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS "warehouses" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "warehouses_name_idx" ON "warehouses" ("name");
    CREATE INDEX IF NOT EXISTS "warehouses_updated_at_idx" ON "warehouses" ("updated_at");
    CREATE INDEX IF NOT EXISTS "warehouses_created_at_idx" ON "warehouses" ("created_at");

    CREATE TABLE IF NOT EXISTS "equipment" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "serial_number" varchar,
      "make" varchar,
      "model" varchar,
      "purchase_date" timestamp(3) with time zone,
      "warranty_until" timestamp(3) with time zone,
      "purchase_price" numeric,
      "note" varchar,
      "status" "enum_equipment_status" NOT NULL DEFAULT 'IN_USE',
      "warranty_notified_bucket" smallint,
      "warranty_notified_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );

    -- Nullable but unique: nobody will copy a hundred nameplates to start the register, yet two
    -- rows carrying the same serial are a data-entry mistake. Postgres treats NULLs as distinct, so
    -- the blank ones do not collide. Single-column, so Payload's field-level flag agrees with it.
    CREATE UNIQUE INDEX IF NOT EXISTS "equipment_serial_number_idx"
      ON "equipment" ("serial_number");
    CREATE INDEX IF NOT EXISTS "equipment_warranty_until_idx" ON "equipment" ("warranty_until");
    CREATE INDEX IF NOT EXISTS "equipment_updated_at_idx" ON "equipment" ("updated_at");
    CREATE INDEX IF NOT EXISTS "equipment_created_at_idx" ON "equipment" ("created_at");

    CREATE TABLE IF NOT EXISTS "equipment_events" (
      "id" serial PRIMARY KEY NOT NULL,
      "equipment_id" integer NOT NULL REFERENCES "equipment"("id") ON DELETE cascade,
      "occurred_at" timestamp(3) with time zone NOT NULL,
      -- Exactly one of the three is set; src/hooks/equipment/validate.ts is the enforcement.
      -- There is no event-type column on purpose: the target IS the kind, and a second column
      -- saying the same thing would be the first to disagree with itself.
      "holder_id" integer REFERENCES "users"("id") ON DELETE restrict,
      "warehouse_id" integer REFERENCES "warehouses"("id") ON DELETE restrict,
      "service_provider" varchar,
      "investment_id" integer REFERENCES "investments"("id") ON DELETE set null,
      "cost" numeric,
      "note" varchar,
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );

    -- Every read is "newest row for this item", done once per item by the listing, the employee
    -- card and the warranty sweep. This composite is the index that matters.
    CREATE INDEX IF NOT EXISTS "equipment_events_equipment_occurred_at_idx"
      ON "equipment_events" ("equipment_id", "occurred_at" DESC);
    CREATE INDEX IF NOT EXISTS "equipment_events_holder_idx" ON "equipment_events" ("holder_id");
    CREATE INDEX IF NOT EXISTS "equipment_events_warehouse_idx"
      ON "equipment_events" ("warehouse_id");
    CREATE INDEX IF NOT EXISTS "equipment_events_updated_at_idx"
      ON "equipment_events" ("updated_at");
    CREATE INDEX IF NOT EXISTS "equipment_events_created_at_idx"
      ON "equipment_events" ("created_at");

    -- attachments is a hasMany upload, which Payload keeps on a <collection>_rels join table
    -- rather than a scalar FK column. Shape mirrors vehicle_inspections_rels (20260818_1).
    CREATE TABLE IF NOT EXISTS "equipment_events_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL REFERENCES "equipment_events"("id") ON DELETE cascade,
      "path" varchar NOT NULL,
      "media_id" integer REFERENCES "media"("id") ON DELETE cascade
    );

    CREATE INDEX IF NOT EXISTS "equipment_events_rels_order_idx"
      ON "equipment_events_rels" ("order");
    CREATE INDEX IF NOT EXISTS "equipment_events_rels_parent_idx"
      ON "equipment_events_rels" ("parent_id");
    CREATE INDEX IF NOT EXISTS "equipment_events_rels_path_idx"
      ON "equipment_events_rels" ("path");
    CREATE INDEX IF NOT EXISTS "equipment_events_rels_media_id_idx"
      ON "equipment_events_rels" ("media_id");

    -- Payload's lock-check SELECT names a column per collection and throws without it (20260709_1).
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "equipment_id" integer
      REFERENCES "equipment"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_equipment_id_idx"
      ON "payload_locked_documents_rels" ("equipment_id");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "equipment_events_id" integer
      REFERENCES "equipment_events"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_equipment_events_id_idx"
      ON "payload_locked_documents_rels" ("equipment_events_id");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "warehouses_id" integer
      REFERENCES "warehouses"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_warehouses_id_idx"
      ON "payload_locked_documents_rels" ("warehouses_id");

    -- Fourth recipient list. Its own, not a reuse of fleetDigest: fleet and equipment may well be
    -- watched by different people. Shape 1:1 with 20260826_0; the row id is a varchar because
    -- Payload mints array-row ids itself.
    CREATE TABLE IF NOT EXISTS "notification_recipients_equipment_digest" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL REFERENCES "notification_recipients"("id") ON DELETE CASCADE,
      "id" varchar PRIMARY KEY,
      "email" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "notification_recipients_equipment_digest_order_idx"
      ON "notification_recipients_equipment_digest" ("_order");
    CREATE INDEX IF NOT EXISTS "notification_recipients_equipment_digest_parent_id_idx"
      ON "notification_recipients_equipment_digest" ("_parent_id");

    INSERT INTO "notification_recipients_equipment_digest" ("_order", "_parent_id", "id", "email")
      VALUES
        (1, 1, 'seed_equipment_digest_1', 'bartek@wykonczymy.com.pl'),
        (2, 1, 'seed_equipment_digest_2', 'admin@wykonczymy.com.pl')
      ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "warehouses" ("name") VALUES ('Magazyn główny')
      ON CONFLICT ("name") DO NOTHING;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "notification_recipients_equipment_digest";

    DROP INDEX IF EXISTS "payload_locked_documents_rels_warehouses_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "warehouses_id";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_equipment_events_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "equipment_events_id";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_equipment_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "equipment_id";

    DROP TABLE IF EXISTS "equipment_events_rels";
    DROP TABLE IF EXISTS "equipment_events";
    DROP TABLE IF EXISTS "equipment";
    DROP TABLE IF EXISTS "warehouses";

    DROP TYPE IF EXISTS "enum_equipment_status";
  `)
}
