import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// One sheet per investment: two investments sharing a tab would each treat the
// other's rows as orphans and delete them on sync (review T1.3). Postgres allows
// multiple NULLs under a unique index, so unlinked investments are unaffected.
// Hand-written (mirrors 20260525_add_google_sheet_id) because migrate:create's
// snapshot baseline is stale on this branch — see project memory.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS investments_google_sheet_id_idx
    ON investments (google_sheet_id);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS investments_google_sheet_id_idx;
  `)
}
