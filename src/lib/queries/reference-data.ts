import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-vercel-postgres'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/sum-transfers'
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
      SELECT id, name, type::text, active::boolean, owner_id::integer, balance
      FROM cash_registers
    `),
    db.execute(sql`
      SELECT id, name, status::text, total_costs, total_income, labor_costs,
             address, phone, email, contact_person
      FROM investments
    `),
    db.execute(sql`
      SELECT id, name, role::text, active::boolean, email, default_cash_register_id::integer
      FROM users
    `),
    db.execute(sql`
      SELECT id, name FROM other_categories
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
    balance: Number(row.balance ?? 0),
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const investments: InvestmentRefT[] = invResult.rows.map((row: any) => ({
    id: Number(row.id),
    name: row.name as string,
    status: (row.status as 'active' | 'completed') ?? 'active',
    active: row.status === 'active',
    totalCosts: Number(row.total_costs ?? 0),
    totalIncome: Number(row.total_income ?? 0),
    laborCosts: Number(row.labor_costs ?? 0),
    address: (row.address as string) ?? '',
    phone: (row.phone as string) ?? '',
    email: (row.email as string) ?? '',
    contactPerson: (row.contact_person as string) ?? '',
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
