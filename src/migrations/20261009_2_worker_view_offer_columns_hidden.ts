import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// „Przedmiar ofertowy” and „% wykonania (względem przedmiaru ofertowego)” become ticks on the worker
// document, unticked by default. The stored set is the HIDDEN one, so they are appended to it.
//
// Run straight AFTER the deploy: the old code reads a stored `plannedQty` as the pre-EX-921 name of the
// Aktualizacja przedmiaru, so migrating first hides it on every worker link; until this runs, both new
// columns show. No stored row carries that legacy name (prod, 2026-10-09), so nothing is rewritten.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "kosztorys_worker_view_settings"
       SET "hidden_columns" = "hidden_columns" || '["plannedQty"]'::jsonb
     WHERE jsonb_typeof("hidden_columns") = 'array'
       AND NOT "hidden_columns" ? 'plannedQty';

    UPDATE "kosztorys_worker_view_settings"
       SET "hidden_columns" = "hidden_columns" || '["plannedDonePercent"]'::jsonb
     WHERE jsonb_typeof("hidden_columns") = 'array'
       AND NOT "hidden_columns" ? 'plannedDonePercent';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "kosztorys_worker_view_settings"
       SET "hidden_columns" = "hidden_columns" - 'plannedQty' - 'plannedDonePercent'
     WHERE jsonb_typeof("hidden_columns") = 'array';
  `)
}
