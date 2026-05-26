import { unstable_cache, cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-vercel-postgres'
import { CACHE_TAGS } from '@/lib/cache/tags'
import type { RoleT } from '@/lib/auth/roles'
import type { Where } from 'payload'
import {
  getDb,
  sumAllRegisterBalances,
  sumAllWorkerBalances,
  sumAllInvestmentFinancials,
  sumFilteredByType,
  sumCategoryBreakdown,
  type InvestmentFinancialsT,
  type TypeTotalT,
  type CategoryCostT,
} from '@/lib/db/sum-transfers'
import { perfStart } from '@/lib/perf'

import type {
  CashRegisterRefT,
  InvestmentRefT,
  WorkerRefT,
  OtherCategoryRefT,
  ExpenseCategoryRefT,
  ReferenceDataBaseT,
} from '@/types/reference-data'

export const fetchReferenceData = unstable_cache(
  async (): Promise<ReferenceDataBaseT> => {
    // 'use cache'
    // cacheLife('max')
    // cacheTag(
    //   CACHE_TAGS.cashRegisters,
    //   CACHE_TAGS.investments,
    //   CACHE_TAGS.users,
    //   CACHE_TAGS.otherCategories,
    //   CACHE_TAGS.expenseCategories,
    // )

    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const db = await getDb(payload)

    const [crResult, invResult, usersResult, catResult, expCatResult] = await Promise.all([
      db.execute(sql`
        SELECT id, name, type::text, active::boolean, owner_id::integer
        FROM cash_registers
        ORDER BY name
      `),
      db.execute(sql`
        SELECT id, name, status::text,
               address, phone, email, contact_person, notes, review, google_sheet_id
        FROM investments
        ORDER BY name
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
    ])

    const totalRows =
      crResult.rows.length +
      invResult.rows.length +
      usersResult.rows.length +
      catResult.rows.length +
      expCatResult.rows.length
    console.log(`[PERF] query.fetchReferenceData ${elapsed()}ms (5 SQL, ${totalRows} rows)`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw SQL rows
    const cashRegisters: CashRegisterRefT[] = crResult.rows.map((row: any) => ({
      id: Number(row.id),
      name: row.name as string,
      type: (row.type as string) ?? 'AUXILIARY',
      active: row.active as boolean,
      ownerId: row.owner_id ? Number(row.owner_id) : undefined,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const investments: InvestmentRefT[] = invResult.rows.map((row: any) => ({
      id: Number(row.id),
      name: row.name as string,
      status: (row.status as 'active' | 'completed') ?? 'active',
      active: row.status === 'active',
      address: (row.address as string) ?? '',
      phone: (row.phone as string) ?? '',
      email: (row.email as string) ?? '',
      contactPerson: (row.contact_person as string) ?? '',
      notes: (row.notes as string) ?? '',
      review: (row.review as string) ?? '',
      hasSheet: Boolean(row.google_sheet_id),
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workers: WorkerRefT[] = usersResult.rows.map((row: any) => ({
      id: Number(row.id),
      name: row.name as string,
      role: (row.role as RoleT) ?? 'EMPLOYEE',
      active: row.active as boolean,
      email: (row.email as string) ?? '',
      defaultCashRegisterId: row.default_cash_register_id
        ? Number(row.default_cash_register_id)
        : undefined,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const otherCategories: OtherCategoryRefT[] = catResult.rows.map((row: any) => ({
      id: Number(row.id),
      name: row.name as string,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expenseCategories: ExpenseCategoryRefT[] = expCatResult.rows.map((row: any) => ({
      id: Number(row.id),
      name: row.name as string,
    }))

    return { cashRegisters, investments, workers, otherCategories, expenseCategories }
  },
  ['reference-data'],
  {
    tags: [
      CACHE_TAGS.cashRegisters,
      CACHE_TAGS.investments,
      CACHE_TAGS.users,
      CACHE_TAGS.otherCategories,
      CACHE_TAGS.expenseCategories,
    ],
  },
)

export type RegisterBalanceMapT = Record<string, number>

export const fetchRegisterBalances = unstable_cache(
  async (): Promise<RegisterBalanceMapT> => {
    // 'use cache'
    // cacheLife('max')
    // cacheTag(CACHE_TAGS.transfers)

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
    // 'use cache'
    // cacheLife('max')
    // cacheTag(CACHE_TAGS.transfers)

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

export async function fetchFilteredByType(where: Where): Promise<TypeTotalT[]> {
  // 'use cache'
  // cacheLife('max')
  // cacheTag(CACHE_TAGS.transfers)

  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      return sumFilteredByType(payload, where)
    },
    ['filtered-by-type', JSON.stringify(where)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}

export async function fetchCategoryBreakdown(where: Where): Promise<CategoryCostT[]> {
  // 'use cache'
  // cacheLife('max')
  // cacheTag(CACHE_TAGS.transfers)

  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      return sumCategoryBreakdown(payload, where)
    },
    ['category-breakdown', JSON.stringify(where)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}
