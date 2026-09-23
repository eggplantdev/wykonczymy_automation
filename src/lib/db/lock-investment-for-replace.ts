import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from './get-db'

// Takes the investment row for the rest of the caller's transaction, serializing the wholesale
// kosztorys replacements against each other (a sheet import, „Wczytaj szablon", „Przywróć wersję").
// Each of those wipes the tree its own transaction can see and then re-INSERTs etapy 1..n: under
// READ COMMITTED the loser's DELETE never sees the winner's freshly committed rows, so its INSERT
// meets `kosztorys_stages_investment_ordinal_unique` and the owner gets a raw duplicate-key dump.
// Held, the second attempt waits, re-reads, and wipes what the first one actually left behind.
//
// It also fixes the acquisition ORDER. A replacement writes the investment row anyway (editor
// settings, at the end of `restoreKosztorys`), so taking it up front is the difference between two
// of them queueing and them grabbing the investment and the kosztorys rows in opposite orders — a
// deadlock rather than a wait. Re-taking it later in the same transaction costs nothing, so every
// entry point may ask for it without checking whether an outer one already did.
export async function lockInvestmentForReplace(
  db: DbExecutorT,
  investmentId: number,
): Promise<void> {
  await db.execute(sql`SELECT id FROM investments WHERE id = ${investmentId} FOR UPDATE`)
}
