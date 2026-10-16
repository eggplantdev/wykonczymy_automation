import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Per-investment materiały netto rate (EX-596), a fraction like vat_rate. NULL is load-bearing: it
// is how "never set" stays distinct from "deliberately 0%", which is what keeps every existing
// investment's marża and bilans exactly where they are. Hence no default and no backfill.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments"
    ADD COLUMN IF NOT EXISTS "materials_net_rate" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments"
    DROP COLUMN IF EXISTS "materials_net_rate";
  `)
}
