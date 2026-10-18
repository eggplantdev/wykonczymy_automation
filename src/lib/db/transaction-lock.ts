import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from './get-db'

export async function lockTransactionRow(db: DbExecutorT, transactionId: number): Promise<void> {
  await db.execute(sql`SELECT 1 FROM transactions WHERE id = ${transactionId} FOR UPDATE`)
}
