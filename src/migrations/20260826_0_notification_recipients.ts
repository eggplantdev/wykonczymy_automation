import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Shapes copied from what Payload's Drizzle layer emits for an array field — the row `id` is a
// varchar, not a serial, because Payload mints array-row ids itself rather than letting Postgres.
// The global needs no `payload_locked_documents_rels` column: globals are locked through
// `payload_locked_documents.global_slug` (only collections need one — 20260709_1).
// The seed is literal, not read from env: the addresses are identical on every environment, and
// `findGlobal` on an unseeded global returns defaults, so `minRows: 1` could never fire on a row
// that was never created.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "notification_recipients" (
      "id" serial PRIMARY KEY,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );

    CREATE TABLE IF NOT EXISTS "notification_recipients_fleet_digest" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL REFERENCES "notification_recipients"("id") ON DELETE CASCADE,
      "id" varchar PRIMARY KEY,
      "email" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "notification_recipients_fleet_digest_order_idx"
      ON "notification_recipients_fleet_digest" ("_order");
    CREATE INDEX IF NOT EXISTS "notification_recipients_fleet_digest_parent_id_idx"
      ON "notification_recipients_fleet_digest" ("_parent_id");

    CREATE TABLE IF NOT EXISTS "notification_recipients_new_lead" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL REFERENCES "notification_recipients"("id") ON DELETE CASCADE,
      "id" varchar PRIMARY KEY,
      "email" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "notification_recipients_new_lead_order_idx"
      ON "notification_recipients_new_lead" ("_order");
    CREATE INDEX IF NOT EXISTS "notification_recipients_new_lead_parent_id_idx"
      ON "notification_recipients_new_lead" ("_parent_id");

    CREATE TABLE IF NOT EXISTS "notification_recipients_ops_alerts" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL REFERENCES "notification_recipients"("id") ON DELETE CASCADE,
      "id" varchar PRIMARY KEY,
      "email" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "notification_recipients_ops_alerts_order_idx"
      ON "notification_recipients_ops_alerts" ("_order");
    CREATE INDEX IF NOT EXISTS "notification_recipients_ops_alerts_parent_id_idx"
      ON "notification_recipients_ops_alerts" ("_parent_id");

    INSERT INTO "notification_recipients" ("id", "updated_at", "created_at")
      VALUES (1, now(), now())
      ON CONFLICT ("id") DO NOTHING;
    SELECT setval(
      pg_get_serial_sequence('notification_recipients', 'id'),
      GREATEST(1, (SELECT MAX("id") FROM "notification_recipients"))
    );

    INSERT INTO "notification_recipients_fleet_digest" ("_order", "_parent_id", "id", "email")
      VALUES
        (1, 1, 'seed_fleet_digest_1', 'bartek@wykonczymy.com.pl'),
        (2, 1, 'seed_fleet_digest_2', 'admin@wykonczymy.com.pl')
      ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "notification_recipients_new_lead" ("_order", "_parent_id", "id", "email")
      VALUES (1, 1, 'seed_new_lead_1', 'bartek@wykonczymy.com.pl')
      ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "notification_recipients_ops_alerts" ("_order", "_parent_id", "id", "email")
      VALUES (1, 1, 'seed_ops_alerts_1', 'admin@wykonczymy.com.pl')
      ON CONFLICT ("id") DO NOTHING;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "notification_recipients_ops_alerts";
    DROP TABLE IF EXISTS "notification_recipients_new_lead";
    DROP TABLE IF EXISTS "notification_recipients_fleet_digest";
    DROP TABLE IF EXISTS "notification_recipients";
  `)
}
