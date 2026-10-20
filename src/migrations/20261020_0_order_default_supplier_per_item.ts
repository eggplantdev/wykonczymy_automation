import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Additive — migrate prod before pushing the code that reads the columns. `default_supplier_id`
// stays until a later destructive migration (TODO(EX-1119)), so the old code keeps working.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "order_settings"
      ADD COLUMN IF NOT EXISTS "default_big_bag_supplier_id" varchar,
      ADD COLUMN IF NOT EXISTS "default_container_supplier_id" varchar;

    UPDATE "order_settings"
      SET "default_big_bag_supplier_id" = "default_supplier_id"
      WHERE "default_big_bag_supplier_id" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "order_settings"
      DROP COLUMN IF EXISTS "default_big_bag_supplier_id",
      DROP COLUMN IF EXISTS "default_container_supplier_id";
  `)
}
