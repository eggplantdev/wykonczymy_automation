import type { getDb } from '@/lib/db/get-db'
import { selectWorkerPayoutPairs } from '@/lib/db/worker-payout-pairs'
import { classifyPair } from '@/lib/kosztorys/worker-payout-pairs'
import { roundToCents } from '@/lib/utils/round-to-cents'

/** „Pozostało do wypłaty" of one pair as the settle dialog reads it, straight from the DB. */
export async function pairRemaining(
  db: Awaited<ReturnType<typeof getDb>>,
  investmentId: number,
  workerId: number | null,
): Promise<number> {
  const pairs = await selectWorkerPayoutPairs(db, { investmentIds: [investmentId] })
  const pair = pairs.find((row) => row.workerId === workerId)
  if (!pair) throw new Error(`no pair ${investmentId}:${workerId}`)
  return roundToCents(classifyPair(pair).remaining)
}
