import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-711 fleet module: company cars plus one row per inspection event. A vehicle stores no
// "last/next inspection" fields — the current deadline for a (vehicle, type) pair is always
// `next_due_at` of the newest event of that type, which is what makes "already done" free.
//
// Dates are `timestamp(3) with time zone` pinned to midnight UTC, NOT `date`: that is this DB's
// existing day-only convention (all 3591 `transactions.date` rows sit at 00:00:00+00) and the only
// shape Payload's adapter models for a `date` field. Day comparison is therefore the deadline
// logic's job (src/lib/fleet/), where it is pure and test-pinned, not the column type's.
//
// Sorts after 20260818_0 on purpose — filename lexical order IS the run order (readMigrationFiles),
// so a table-creating migration must sort before anything referencing it.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_vehicles_status') THEN
        CREATE TYPE "enum_vehicles_status" AS ENUM ('ACTIVE', 'RETIRED');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_vehicle_inspections_type') THEN
        CREATE TYPE "enum_vehicle_inspections_type" AS ENUM
          ('TECHNICAL', 'INSURANCE', 'OIL_CHANGE', 'WARRANTY', 'TYRES');
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS "vehicles" (
      "id" serial PRIMARY KEY NOT NULL,
      "registration" varchar NOT NULL,
      "make" varchar NOT NULL,
      "model" varchar NOT NULL,
      "year" integer,
      "vin" varchar,
      "status" "enum_vehicles_status" NOT NULL DEFAULT 'ACTIVE',
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );

    -- Plate is the vehicle's identity, so a second row for the same car is a data-entry mistake,
    -- not a legitimate state. Single-column, so Payload's field-level unique flag agrees with it.
    CREATE UNIQUE INDEX IF NOT EXISTS "vehicles_registration_idx" ON "vehicles" ("registration");
    CREATE INDEX IF NOT EXISTS "vehicles_updated_at_idx" ON "vehicles" ("updated_at");
    CREATE INDEX IF NOT EXISTS "vehicles_created_at_idx" ON "vehicles" ("created_at");

    CREATE TABLE IF NOT EXISTS "vehicle_inspections" (
      "id" serial PRIMARY KEY NOT NULL,
      "vehicle_id" integer NOT NULL REFERENCES "vehicles"("id") ON DELETE cascade,
      "type" "enum_vehicle_inspections_type" NOT NULL,
      "performed_at" timestamp(3) with time zone NOT NULL,
      "next_due_at" timestamp(3) with time zone,
      "odometer" integer,
      "next_due_odometer" integer,
      "cost" numeric,
      "note" varchar,
      "notified_threshold" smallint,
      "notified_at" timestamp(3) with time zone,
      "odometer_notified_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );

    -- Every deadline read is "newest row for this (vehicle, type) pair", done once per vehicle per
    -- type by both the listing and the reminder sweep. This composite is the index that matters.
    CREATE INDEX IF NOT EXISTS "vehicle_inspections_vehicle_type_performed_at_idx"
      ON "vehicle_inspections" ("vehicle_id", "type", "performed_at" DESC);
    CREATE INDEX IF NOT EXISTS "vehicle_inspections_vehicle_idx"
      ON "vehicle_inspections" ("vehicle_id");
    CREATE INDEX IF NOT EXISTS "vehicle_inspections_updated_at_idx"
      ON "vehicle_inspections" ("updated_at");
    CREATE INDEX IF NOT EXISTS "vehicle_inspections_created_at_idx"
      ON "vehicle_inspections" ("created_at");

    -- attachments is a hasMany upload, which Payload keeps on a <collection>_rels join table
    -- rather than a scalar FK column. Shape mirrors transactions_rels (20260810_0).
    CREATE TABLE IF NOT EXISTS "vehicle_inspections_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL REFERENCES "vehicle_inspections"("id") ON DELETE cascade,
      "path" varchar NOT NULL,
      "media_id" integer REFERENCES "media"("id") ON DELETE cascade
    );

    CREATE INDEX IF NOT EXISTS "vehicle_inspections_rels_order_idx"
      ON "vehicle_inspections_rels" ("order");
    CREATE INDEX IF NOT EXISTS "vehicle_inspections_rels_parent_idx"
      ON "vehicle_inspections_rels" ("parent_id");
    CREATE INDEX IF NOT EXISTS "vehicle_inspections_rels_path_idx"
      ON "vehicle_inspections_rels" ("path");
    CREATE INDEX IF NOT EXISTS "vehicle_inspections_rels_media_id_idx"
      ON "vehicle_inspections_rels" ("media_id");

    -- Payload's lock-check SELECT names a column per collection and throws without it (20260709_1).
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "vehicles_id" integer
      REFERENCES "vehicles"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_vehicles_id_idx"
      ON "payload_locked_documents_rels" ("vehicles_id");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "vehicle_inspections_id" integer
      REFERENCES "vehicle_inspections"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_vehicle_inspections_id_idx"
      ON "payload_locked_documents_rels" ("vehicle_inspections_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_vehicle_inspections_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "vehicle_inspections_id";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_vehicles_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "vehicles_id";

    DROP TABLE IF EXISTS "vehicle_inspections_rels";
    DROP TABLE IF EXISTS "vehicle_inspections";
    DROP TABLE IF EXISTS "vehicles";

    DROP TYPE IF EXISTS "enum_vehicle_inspections_type";
    DROP TYPE IF EXISTS "enum_vehicles_status";
  `)
}
