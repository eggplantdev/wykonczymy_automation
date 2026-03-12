import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS updated_by_id integer
    REFERENCES users(id) ON DELETE SET NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE transactions
    DROP COLUMN IF EXISTS updated_by_id;
  `)
}
