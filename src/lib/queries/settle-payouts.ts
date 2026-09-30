'use server'

import config from '@payload-config'
import { getPayload } from 'payload'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import {
  settleRowsForInvestment,
  settleRowsForWorker,
  type SettleRowT,
} from '@/lib/kosztorys/worker-payout-pairs'
import { getDb } from '@/lib/db/get-db'
import { sumRegisterBalance } from '@/lib/db/sum-transfers'
import { selectWorkerPayoutPairs } from '@/lib/db/worker-payout-pairs'
import { perfStart } from '@/lib/perf'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import type { CashRegisterRefT } from '@/types/reference-data'

export type SettleTargetT = { kind: 'worker' | 'investment'; id: number }

export type SettlePayoutRowsT = {
  rows: SettleRowT[]
  cashRegisters: CashRegisterRefT[]
  defaultCashRegisterId: number | undefined
  /** Read here because the preselected register never fires the select's change that loads it. */
  defaultRegisterBalance: number | undefined
}

/**
 * Read on open rather than shipped with the list page: every pair of every worker is far more than
 * one dialog needs, and a figure read when the page rendered may be minutes old by the time the owner
 * clicks. Uncached for the same reason the action is: the editor's autosaves expire the cached pairs
 * a beat late, and a reload after a stale refusal that re-read them would be refused again.
 */
export async function fetchSettlePayoutRows(target: SettleTargetT): Promise<SettlePayoutRowsT> {
  const elapsed = perfStart()
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  const payload = await getPayload({ config })
  const [refData, pairs] = await Promise.all([
    fetchReferenceData(),
    getDb(payload).then((db) =>
      selectWorkerPayoutPairs(
        db,
        target.kind === 'investment' ? { investmentIds: [target.id] } : undefined,
      ),
    ),
  ])
  const rows =
    target.kind === 'worker'
      ? settleRowsForWorker(
          pairs,
          target.id,
          new Map(refData.investments.map((inv) => [inv.id, inv.name])),
        )
      : settleRowsForInvestment(
          pairs,
          target.id,
          new Map(refData.workers.map((worker) => [worker.id, worker.name])),
        )
  const defaultCashRegisterId = refData.workers.find(
    (worker) => worker.id === session.user.id,
  )?.defaultCashRegisterId
  const defaultRegisterBalance =
    defaultCashRegisterId === undefined
      ? undefined
      : await sumRegisterBalance(payload, defaultCashRegisterId)
  console.log(`[PERF] fetchSettlePayoutRows(${target.kind}:${target.id}) ${elapsed()}ms`)

  return {
    rows,
    cashRegisters: refData.cashRegisters,
    defaultCashRegisterId,
    defaultRegisterBalance,
  }
}
