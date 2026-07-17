import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-501: one global discount per investment — overrides per-item discounts and is subtracted once
// from the executed total. `global_discount_type` null = no global discount (per-item applies).
// `global_discount_value` non-null default 0 so existing rows backfill without a data migration.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "global_discount_type" text;
    ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "global_discount_value" numeric NOT NULL DEFAULT 0;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" DROP COLUMN IF EXISTS "global_discount_type";
    ALTER TABLE "investments" DROP COLUMN IF EXISTS "global_discount_value";
  `)
}
