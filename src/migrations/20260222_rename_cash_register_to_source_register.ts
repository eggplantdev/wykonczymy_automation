import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE transactions RENAME COLUMN cash_register_id TO source_register_id;
    ALTER INDEX transactions_cash_register_idx RENAME TO transactions_source_register_idx;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE transactions RENAME COLUMN source_register_id TO cash_register_id;
    ALTER INDEX transactions_source_register_idx RENAME TO transactions_cash_register_idx;
  `)
}
