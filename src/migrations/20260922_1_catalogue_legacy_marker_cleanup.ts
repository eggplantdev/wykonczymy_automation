import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
//
// Four katalog rows still carry the „[stary arkusz]" marker in their description. `match_key` was
// always computed WITHOUT it, so while `catalogueKey` stripped the marker the two agreed; the
// commit that retired the marker dropped the strip, and those four rows now compute a key their
// own column disagrees with. The picker matches a freshly computed key against the stored column,
// so an insert would miss the row, hit `ON CONFLICT DO NOTHING` and quietly duplicate the praca.
//
// The data is what is stale here, not the code: the marker era is closed, so the description loses
// the marker and lands back on the key it has always carried. No `match_key` is touched — that is
// the point.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "work_catalogue_items"
    SET "description" = btrim(replace("description", '[stary arkusz]', ''))
    WHERE "description" LIKE '%[stary arkusz]%'
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Irreversible by design: which rows carried the marker is not recorded anywhere else, and
  // re-appending it would re-break the very agreement this migration restored.
}
