import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-vercel-postgres'
import { CACHE_TAGS } from '@/lib/cache/tags'
import type { RoleT } from '@/lib/auth/roles'
import type { Where } from 'payload'
import {
  sumAllRegisterBalances,
  sumAllWorkerBalances,
  sumAllInvestmentFinancials,
  sumFilteredByType,
  sumCategoryByTypeSettled,
  sumDepositRowsForInvestment,
  deriveCategoryBreakdowns,
} from '@/lib/db/sum-transfers'
import { sumZaliczkiByStage } from '@/lib/kosztorys/zaliczki'
import { getDb } from '@/lib/db/get-db'
import type {
  InvestmentFinancialsT,
  TypeSettledTotalT,
  CategoryBreakdownsT,
} from '@/types/investment-financials'
import { perfStart } from '@/lib/perf'

import type {
  CashRegisterRefT,
  CashRegisterTypeT,
  InvestmentRefT,
  InvestmentStatusT,
  WorkerRefT,
  OtherCategoryRefT,
  ExpenseCategoryRefT,
  KosztorysStageRefT,
  ReferenceDataBaseT,
} from '@/types/reference-data'

export const fetchReferenceData = unstable_cache(
  async (): Promise<ReferenceDataBaseT> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const db = await getDb(payload)

    const [crResult, invResult, usersResult, catResult, expCatResult, stageResult] =
      await Promise.all([
        db.execute(sql`
        SELECT id, name, type::text, active::boolean, owner_id::integer
        FROM cash_registers
        ORDER BY name
      `),
        // The sheet id lives on kosztoryses now (1:1 via partial unique index on
        // investment_id). LEFT JOIN so investments without a kosztorys still appear,
        // and we project a boolean instead of leaking the sheet id into the cache.
        db.execute(sql`
        SELECT i.id, i.name, i.status::text,
               i.address, i.phone, i.email, i.contact_person, i.notes, i.review,
               (k.google_sheet_id IS NOT NULL) AS has_sheet
        FROM investments i
        LEFT JOIN kosztoryses k ON k.investment_id = i.id
        ORDER BY i.name
      `),
        db.execute(sql`
        SELECT id, name, role::text, active::boolean, email, default_cash_register_id::integer
        FROM users
        ORDER BY name
      `),
        db.execute(sql`
        SELECT id, name FROM other_categories
        ORDER BY name
      `),
        db.execute(sql`
        SELECT id, name FROM expense_categories
        ORDER BY name
      `),
        db.execute(sql`
        SELECT id, investment_id, ordinal, label FROM kosztorys_stages
        ORDER BY investment_id, ordinal
      `),
      ])

    const totalRows =
      crResult.rows.length +
      invResult.rows.length +
      usersResult.rows.length +
      catResult.rows.length +
      expCatResult.rows.length
    console.log(`[PERF] query.fetchReferenceData ${elapsed()}ms (5 SQL, ${totalRows} rows)`)

    const cashRegisters: CashRegisterRefT[] = crResult.rows.map((row) => ({
      id: Number(row.id),
      name: row.name as string,
      type: (row.type as CashRegisterTypeT) ?? 'AUXILIARY',
      active: row.active as boolean,
      ownerId: row.owner_id ? Number(row.owner_id) : undefined,
    }))

    const investments: InvestmentRefT[] = invResult.rows.map((row) => ({
      id: Number(row.id),
      name: row.name as string,
      status: (row.status as InvestmentStatusT) ?? 'active',
      active: row.status === 'active',
      address: (row.address as string) ?? '',
      phone: (row.phone as string) ?? '',
      email: (row.email as string) ?? '',
      contactPerson: (row.contact_person as string) ?? '',
      notes: (row.notes as string) ?? '',
      review: (row.review as string) ?? '',
      hasSheet: Boolean(row.has_sheet),
    }))

    const workers: WorkerRefT[] = usersResult.rows.map((row) => ({
      id: Number(row.id),
      name: row.name as string,
      role: (row.role as RoleT) ?? 'EMPLOYEE',
      active: row.active as boolean,
      email: (row.email as string) ?? '',
      defaultCashRegisterId: row.default_cash_register_id
        ? Number(row.default_cash_register_id)
        : undefined,
    }))

    const otherCategories: OtherCategoryRefT[] = catResult.rows.map((row) => ({
      id: Number(row.id),
      name: row.name as string,
    }))

    const expenseCategories: ExpenseCategoryRefT[] = expCatResult.rows.map((row) => ({
      id: Number(row.id),
      name: row.name as string,
    }))

    const kosztorysStagesByInvestment: Record<number, KosztorysStageRefT[]> = {}
    for (const row of stageResult.rows) {
      const invId = Number(row.investment_id)
      const ordinal = Number(row.ordinal)
      const stage: KosztorysStageRefT = {
        id: Number(row.id),
        ordinal,
        label: (row.label as string) ?? `Etap ${ordinal}`,
      }
      ;(kosztorysStagesByInvestment[invId] ??= []).push(stage)
    }

    return {
      cashRegisters,
      investments,
      workers,
      otherCategories,
      expenseCategories,
      kosztorysStagesByInvestment,
    }
  },
  ['reference-data'],
  {
    tags: [
      CACHE_TAGS.cashRegisters,
      CACHE_TAGS.investments,
      CACHE_TAGS.users,
      CACHE_TAGS.otherCategories,
      CACHE_TAGS.expenseCategories,
      // hasSheet derives from kosztoryses via JOIN — invalidate on kosztorys
      // create/link/unlink/delete too, otherwise the listing's "kosztorys" badge
      // stays stale.
      CACHE_TAGS.kosztoryses,
    ],
  },
)

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
  ['investment-financials'],
  { tags: [CACHE_TAGS.transfers] },
)

export async function fetchFilteredByType(where: Where): Promise<TypeSettledTotalT[]> {
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      return sumFilteredByType(payload, where)
    },
    ['filtered-by-type', JSON.stringify(where)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}

// Per-etap zaliczka sums for one investment (tagged deposits), keyed stage id → cash.
// Cached under CACHE_TAGS.transfers so deposit mutations keep the editor's join live.
// Record (not Map) — plain object crosses the server→client prop boundary.
export async function fetchZaliczkiByStage(investmentId: number): Promise<Record<number, number>> {
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      const rows = await sumDepositRowsForInvestment(payload, investmentId)
      return Object.fromEntries(sumZaliczkiByStage(rows))
    },
    ['zaliczki-by-stage', String(investmentId)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}

export async function fetchCategoryBreakdowns(where: Where): Promise<CategoryBreakdownsT> {
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      return deriveCategoryBreakdowns(await sumCategoryByTypeSettled(payload, where))
    },
    ['category-breakdowns', JSON.stringify(where)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}
