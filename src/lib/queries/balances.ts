import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { selectDepositPlaneSums } from '@/lib/db/deposit-plane-sums'
import { selectKosztorysClientTotals } from '@/lib/db/kosztorys-client-totals'
import { selectKosztorysSubcontractorDue } from '@/lib/db/kosztorys-subcontractor-due'
import { selectWorkerPayoutPairs, type WorkerPayoutPairRowT } from '@/lib/db/worker-payout-pairs'
import type { SubcontractorSettlementT } from '@/lib/kosztorys/subcontractor-due'
import type { DepositPlaneSumsT } from '@/lib/kosztorys/deposit-planes'
import {
  sumAllRegisterBalances,
  sumAllWorkerBalances,
  sumAllInvestmentFinancials,
} from '@/lib/db/sum-transfers'
import type { KosztorysClientTotalsT } from '@/lib/kosztorys/settlement-client-totals'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import { perfStart } from '@/lib/perf'

export type RegisterBalanceMapT = Record<string, number>

export const fetchRegisterBalances = unstable_cache(
  async (): Promise<RegisterBalanceMapT> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const map = await sumAllRegisterBalances(payload)
    const record = Object.fromEntries(map)
    console.log(`[PERF] query.fetchRegisterBalances ${elapsed()}ms (${map.size} registers)`)
    return record
  },
  ['register-balances'],
  { tags: [CACHE_TAGS.transfers] },
)

export type WorkerBalanceMapT = Record<string, number>

export const fetchWorkerBalances = unstable_cache(
  async (): Promise<WorkerBalanceMapT> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const map = await sumAllWorkerBalances(payload)
    const record = Object.fromEntries(map)
    console.log(`[PERF] query.fetchWorkerBalances ${elapsed()}ms (${map.size} workers)`)
    return record
  },
  ['worker-balances'],
  { tags: [CACHE_TAGS.transfers] },
)

export type InvestmentFinancialsMapT = Record<string, InvestmentFinancialsT>

export const fetchInvestmentFinancials = unstable_cache(
  async (): Promise<InvestmentFinancialsMapT> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const map = await sumAllInvestmentFinancials(payload)
    const record: InvestmentFinancialsMapT = {}
    for (const [id, financials] of map) {
      record[String(id)] = financials
    }
    console.log(`[PERF] query.fetchInvestmentFinancials ${elapsed()}ms (${map.size} investments)`)
    return record
  },
  // Versioned key — see the note on `reference-data-v2`. Bumped when `InvestmentFinancialsT` gained
  // `netCategoryCosts`: an entry written before that lacks the array, and a reader dereferencing it
  // throws rather than merely showing an old number.
  ['investment-financials-v2'],
  // Two tags, not one: the figures are summed from transfers, but the materiały concession and the
  // settlement mode that gates it are columns on `investments`. Tagged on transfers alone, saving a
  // rate left the listing serving the pre-change marża until an unrelated transfer happened to
  // expire it, while the detail page (uncached) already showed the new one.
  { tags: [CACHE_TAGS.transfers, CACHE_TAGS.investments] },
)

export type KosztorysClientTotalsMapT = Record<string, KosztorysClientTotalsT>

// Every tag whose collection can move these figures. `investments` is load-bearing, not padding: the
// global rabat is a column there, so a rabat change moves the pair without touching a single
// kosztorys row. Sections carry no figure of their own, but deleting one takes its items with it.
//
// Accepted cost (owner): every debounced autosave in the editor expires this entry for the whole
// listing, so the next visit to /inwestycje pays a full recompute. That is the price of the listing
// never showing a stale kosztorys figure — and the recompute is one aggregate returning one row per
// investment, not a re-read of the kosztoryses themselves.
export const KOSZTORYS_CLIENT_TOTALS_TAGS = [
  CACHE_TAGS.kosztorysItems,
  CACHE_TAGS.kosztorysSections,
  CACHE_TAGS.kosztorysStages,
  CACHE_TAGS.stageProgress,
  CACHE_TAGS.investments,
]

/** A per-investment aggregate keyed by id, cached under `cacheKey`. The two kosztorys folds below are
 *  the same query-fold-log shape down to the last line, so it lives here once — a third aggregate
 *  gets it for free instead of copying the `String(investmentId)` keying a third time. */
function cachedInvestmentMap<RowT extends { investmentId: number }>(
  cacheKey: string,
  label: string,
  select: (db: DbExecutorT) => Promise<RowT[]>,
  tags: string[],
) {
  return unstable_cache(
    async (): Promise<Record<string, Omit<RowT, 'investmentId'>>> => {
      const elapsed = perfStart()
      const payload = await getPayload({ config })
      const db = await getDb(payload)
      const rows = await select(db)
      const record: Record<string, Omit<RowT, 'investmentId'>> = {}
      for (const { investmentId, ...figures } of rows) {
        record[String(investmentId)] = figures
      }
      console.log(`[PERF] query.${label} ${elapsed()}ms (${rows.length} investments)`)
      return record
    },
    [cacheKey],
    { tags },
  )
}

export const fetchKosztorysClientTotals = cachedInvestmentMap(
  'kosztorys-client-totals-v1',
  'fetchKosztorysClientTotals',
  selectKosztorysClientTotals,
  KOSZTORYS_CLIENT_TOTALS_TAGS,
)

export type KosztorysSubcontractorDueMapT = Record<string, SubcontractorSettlementT>

// Same tag set as the client pair above, deliberately not a narrower one: every table this fold
// reads (items, stages, progress, and the investment's coefficients) is already in it, and a second
// list would be a second thing to keep in step.
export const fetchKosztorysSubcontractorDue = cachedInvestmentMap(
  'kosztorys-subcontractor-due-v1',
  'fetchKosztorysSubcontractorDue',
  selectKosztorysSubcontractorDue,
  KOSZTORYS_CLIENT_TOTALS_TAGS,
)

export type DepositPlaneSumsMapT = Record<string, DepositPlaneSumsT>

// Transfers only: this fold reads no investment column at all — the VAT rate the legacy bridge needs
// for pre-spike rows arrives later, in `shapeInvestments`.
export const fetchDepositPlaneSums = cachedInvestmentMap(
  'deposit-plane-sums-v3',
  'fetchDepositPlaneSums',
  selectDepositPlaneSums,
  [CACHE_TAGS.transfers],
)

// Both planes move a pair: executed work on the kosztorys side, wypłaty on the transfers side. A flat
// row array rather than `cachedInvestmentMap` — an investment carries one row per worker.
export const fetchWorkerPayoutPairs = unstable_cache(
  async (): Promise<WorkerPayoutPairRowT[]> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const rows = await selectWorkerPayoutPairs(await getDb(payload))
    console.log(`[PERF] query.fetchWorkerPayoutPairs ${elapsed()}ms (${rows.length} pairs)`)
    return rows
  },
  ['worker-payout-pairs-v1'],
  { tags: [...KOSZTORYS_CLIENT_TOTALS_TAGS, CACHE_TAGS.transfers] },
)
