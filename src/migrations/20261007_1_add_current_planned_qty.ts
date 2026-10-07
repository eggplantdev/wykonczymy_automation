import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-921: „Aktualizacja przedmiaru”. Only a hand edit is stored — NULL means the row follows
// Przedmiar ofertowy, so there is no backfill and an unedited row keeps following it.
//
// The investor document stores what is HIDDEN, so an investment with saved settings would show the
// new value column ticked. The owner ruled it unticked by default: append it to every stored set.
// NULL sets resolve to the code default, which already leaves it unticked.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items" ADD COLUMN IF NOT EXISTS "current_planned_qty" numeric;

    UPDATE "kosztorys_client_view"
       SET "hidden_columns" = "hidden_columns" || '["currentPlannedNet"]'::jsonb
     WHERE jsonb_typeof("hidden_columns") = 'array'
       AND NOT "hidden_columns" ? 'currentPlannedNet';

    UPDATE "kosztorys_client_view_defaults"
       SET "hidden_columns" = "hidden_columns" || '["currentPlannedNet"]'::jsonb
     WHERE jsonb_typeof("hidden_columns") = 'array'
       AND NOT "hidden_columns" ? 'currentPlannedNet';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "kosztorys_client_view_defaults"
       SET "hidden_columns" = "hidden_columns" - 'currentPlannedNet'
     WHERE jsonb_typeof("hidden_columns") = 'array';

    UPDATE "kosztorys_client_view"
       SET "hidden_columns" = "hidden_columns" - 'currentPlannedNet'
     WHERE jsonb_typeof("hidden_columns") = 'array';

    ALTER TABLE "kosztorys_items" DROP COLUMN IF EXISTS "current_planned_qty";
  `)
}
