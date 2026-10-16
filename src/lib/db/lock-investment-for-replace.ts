import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from './get-db'

// Each of those wipes the tree its own transaction can see and then re-INSERTs etapy 1..n: under
// READ COMMITTED the loser's DELETE never sees the winner's freshly committed rows, so its INSERT
// meets `kosztorys_stages_investment_ordinal_unique` and the owner gets a raw duplicate-key dump.
export async function lockInvestmentForReplace(
  db: DbExecutorT,
  investmentId: number,
): Promise<void> {
  await db.execute(sql`SELECT id FROM investments WHERE id = ${investmentId} FOR UPDATE`)
}
