import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_transactions_worker_type
      ON transactions(worker_id, type)
      WHERE worker_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_transactions_date
      ON transactions(date);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS idx_transactions_worker_type;
    DROP INDEX IF EXISTS idx_transactions_date;
  `)
}
