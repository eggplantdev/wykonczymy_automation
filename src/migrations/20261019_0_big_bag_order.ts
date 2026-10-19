import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Big bag / container orders: a worker phone, the investment's site manager, the order status on a
// transaction, and the order-settings global (suppliers + prices).
//
// `site_manager_id` is ON DELETE set null: the site manager is a descriptive label, and a removed
// account must not pin every investment it ever ran.
// `order_status` is nullable, no default, no backfill: only the order flow stamps it, and no figure
// reads it. No CHECK on `type` — both the brutto and the netto expense carry it.
// The settings row is seeded with the owner's prices; `findGlobal` on an unseeded global returns
// defaults, so the `required` prices could never hold without the row.
// Additive — migrate prod before pushing the code that reads the columns.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar;

    ALTER TABLE "investments"
      ADD COLUMN IF NOT EXISTS "site_manager_id" integer
      REFERENCES "users"("id") ON DELETE set null;
    CREATE INDEX IF NOT EXISTS "investments_site_manager_idx" ON "investments" ("site_manager_id");

    DO $$ BEGIN
      CREATE TYPE "public"."enum_transactions_order_status" AS ENUM('awaiting', 'delivered');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    ALTER TABLE "transactions"
      ADD COLUMN IF NOT EXISTS "order_status" "enum_transactions_order_status";

    CREATE TABLE IF NOT EXISTS "order_settings" (
      "id" serial PRIMARY KEY,
      "big_bag_price" numeric NOT NULL,
      "container_price" numeric NOT NULL,
      "default_supplier_id" varchar,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );

    CREATE TABLE IF NOT EXISTS "order_settings_suppliers" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL REFERENCES "order_settings"("id") ON DELETE CASCADE,
      "id" varchar PRIMARY KEY,
      "name" varchar NOT NULL,
      "phone" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "order_settings_suppliers_order_idx"
      ON "order_settings_suppliers" ("_order");
    CREATE INDEX IF NOT EXISTS "order_settings_suppliers_parent_id_idx"
      ON "order_settings_suppliers" ("_parent_id");

    INSERT INTO "order_settings" ("id", "big_bag_price", "container_price", "updated_at", "created_at")
      VALUES (1, 800, 1500, now(), now())
      ON CONFLICT ("id") DO NOTHING;
    SELECT setval(
      pg_get_serial_sequence('order_settings', 'id'),
      GREATEST(1, (SELECT MAX("id") FROM "order_settings"))
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "order_settings_suppliers";
    DROP TABLE IF EXISTS "order_settings";

    ALTER TABLE "transactions" DROP COLUMN IF EXISTS "order_status";
    DROP TYPE IF EXISTS "public"."enum_transactions_order_status";

    DROP INDEX IF EXISTS "investments_site_manager_idx";
    ALTER TABLE "investments" DROP COLUMN IF EXISTS "site_manager_id";

    ALTER TABLE "users" DROP COLUMN IF EXISTS "phone";
  `)
}
