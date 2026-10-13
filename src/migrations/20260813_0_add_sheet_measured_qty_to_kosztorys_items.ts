import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// „Pomiar z natury" as the SHEET typed it, kept for reconciliation only (EX-686). This does not
// revive the column EX-494 dropped: nothing prices it, nothing sums it, and Σ etapów remains the
// only truth about executed work. NULL is the resting state and carries meaning — „the sheet makes
// no claim here" — which is why there is no default and no backfill.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items"
    ADD COLUMN IF NOT EXISTS "sheet_measured_qty" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items"
    DROP COLUMN IF EXISTS "sheet_measured_qty";
  `)
}
