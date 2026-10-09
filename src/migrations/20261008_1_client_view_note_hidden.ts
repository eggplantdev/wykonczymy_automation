import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Komentarz becomes a tick on the investor document, unticked by default. The document stores what
// is HIDDEN, so every investment with saved settings would show it the moment the code ships: append
// it to every stored set. NULL sets resolve to the code default, which already leaves it unticked.
// Data only, and harmless to the old code: sanitizeClientViewSettings drops a key outside its
// allowlist, so this can run before or after the deploy.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "kosztorys_client_view"
       SET "hidden_columns" = "hidden_columns" || '["note"]'::jsonb
     WHERE jsonb_typeof("hidden_columns") = 'array'
       AND NOT "hidden_columns" ? 'note';

    UPDATE "kosztorys_client_view_defaults"
       SET "hidden_columns" = "hidden_columns" || '["note"]'::jsonb
     WHERE jsonb_typeof("hidden_columns") = 'array'
       AND NOT "hidden_columns" ? 'note';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "kosztorys_client_view_defaults"
       SET "hidden_columns" = "hidden_columns" - 'note'
     WHERE jsonb_typeof("hidden_columns") = 'array';

    UPDATE "kosztorys_client_view"
       SET "hidden_columns" = "hidden_columns" - 'note'
     WHERE jsonb_typeof("hidden_columns") = 'array';
  `)
}
