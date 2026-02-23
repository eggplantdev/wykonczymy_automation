import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-vercel-postgres'
import { CACHE_TAGS } from '@/lib/cache/tags'
import {
  getDb,
  sumAllWorkerSaldos,
  sumAllRegisterBalances,
  sumAllInvestmentFinancials,
  type InvestmentFinancialsT,
} from '@/lib/db/sum-transfers'
import { perfStart } from '@/lib/perf'

import type {
  CashRegisterRefT,
  InvestmentRefT,
  WorkerRefT,
  OtherCategoryRefT,
  ReferenceDataBaseT,
} from '@/types/reference-data'

export async function fetchReferenceData(): Promise<ReferenceDataBaseT> {
  'use cache'
  cacheLife('max')
  cacheTag(
    CACHE_TAGS.cashRegisters,
    CACHE_TAGS.investments,
    CACHE_TAGS.users,
    CACHE_TAGS.otherCategories,
  )

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const db = await getDb(payload)

  const [crResult, invResult, usersResult, catResult] = await Promise.all([
    db.execute(sql`
      SELECT id, name, type::text, active::boolean, owner_id::integer
      FROM cash_registers
      ORDER BY name
    `),
    db.execute(sql`
      SELECT id, name, status::text, labor_costs,
             address, phone, email, contact_person, notes
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
  ])

  const totalRows =
    crResult.rows.length + invResult.rows.length + usersResult.rows.length + catResult.rows.length
  console.log(`[PERF] query.fetchReferenceData ${elapsed()}ms (4 SQL, ${totalRows} rows)`)

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
    laborCosts: Number(row.labor_costs ?? 0),
    address: (row.address as string) ?? '',
    phone: (row.phone as string) ?? '',
    email: (row.email as string) ?? '',
    contactPerson: (row.contact_person as string) ?? '',
    notes: (row.notes as string) ?? '',
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workers: WorkerRefT[] = usersResult.rows.map((row: any) => ({
    id: Number(row.id),
    name: row.name as string,
    type: (row.role as string) ?? 'EMPLOYEE',
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

  return { cashRegisters, investments, workers, otherCategories }
}

export type WorkerSaldoMapT = Record<string, number>

export async function fetchWorkerSaldos(): Promise<WorkerSaldoMapT> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers)

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const map = await sumAllWorkerSaldos(payload)
  const record = Object.fromEntries(map)
  console.log(`[PERF] query.fetchWorkerSaldos ${elapsed()}ms (${map.size} workers)`)
  return record
}

export type RegisterBalanceMapT = Record<string, number>

export async function fetchRegisterBalances(): Promise<RegisterBalanceMapT> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers)

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const map = await sumAllRegisterBalances(payload)
  const record = Object.fromEntries(map)
  console.log(`[PERF] query.fetchRegisterBalances ${elapsed()}ms (${map.size} registers)`)
  return record
}

export type InvestmentFinancialsMapT = Record<string, InvestmentFinancialsT>

export async function fetchInvestmentFinancials(): Promise<InvestmentFinancialsMapT> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers)

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const map = await sumAllInvestmentFinancials(payload)
  const record: InvestmentFinancialsMapT = {}
  for (const [id, financials] of map) {
    record[String(id)] = financials
  }
  console.log(`[PERF] query.fetchInvestmentFinancials ${elapsed()}ms (${map.size} investments)`)
  return record
}
