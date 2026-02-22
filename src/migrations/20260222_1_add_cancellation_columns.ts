import { type MigrateUpArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add cancellation-related columns to transactions table.
 * - cancelled: marks the original transaction as annulled
 * - cancelled_transaction_id: links CANCELLATION row to its original
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cancelled boolean DEFAULT false;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cancelled_transaction_id integer
      REFERENCES transactions(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_transactions_cancelled ON transactions(cancelled) WHERE cancelled = true;
    CREATE INDEX IF NOT EXISTS idx_transactions_cancelled_tx ON transactions(cancelled_transaction_id);
  `)
}

export async function down({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS idx_transactions_cancelled_tx;
    DROP INDEX IF EXISTS idx_transactions_cancelled;
    ALTER TABLE transactions DROP COLUMN IF EXISTS cancelled_transaction_id;
    ALTER TABLE transactions DROP COLUMN IF EXISTS cancelled;
  `)
}
