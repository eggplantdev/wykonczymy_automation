import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-vercel-postgres'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/sum-transfers'

type RefItemT = { readonly id: number; readonly name: string }
type TypedRefItemT = RefItemT & { readonly type: string }

export type ReferenceDataT = {
  readonly cashRegisters: TypedRefItemT[]
  readonly investments: RefItemT[]
  readonly workers: TypedRefItemT[]
  readonly otherCategories: RefItemT[]
}

export async function fetchReferenceData(): Promise<ReferenceDataT> {
  'use cache'
  cacheLife('max')
  cacheTag(
    CACHE_TAGS.cashRegisters,
    CACHE_TAGS.investments,
    CACHE_TAGS.users,
    CACHE_TAGS.otherCategories,
  )

  const start = performance.now()
  const payload = await getPayload({ config })
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT 'cashRegisters' AS collection, id, name, type::text FROM cash_registers WHERE active = true
    UNION ALL
    SELECT 'investments' AS collection, id, name, NULL AS type FROM investments WHERE status = 'active'
    UNION ALL
    SELECT 'workers' AS collection, id, name, role::text AS type FROM users WHERE active = true
    UNION ALL
    SELECT 'otherCategories' AS collection, id, name, NULL AS type FROM other_categories
  `)
  console.log(
    `[PERF] query.fetchReferenceData ${(performance.now() - start).toFixed(1)}ms (1 SQL, ${result.rows.length} rows)`,
  )

  const cashRegisters: TypedRefItemT[] = []
  const investments: RefItemT[] = []
  const workers: TypedRefItemT[] = []
  const otherCategories: RefItemT[] = []

  for (const row of result.rows) {
    const collection = row.collection as string
    const item = { id: Number(row.id), name: row.name as string }

    if (collection === 'cashRegisters') {
      cashRegisters.push({ ...item, type: (row.type as string) ?? 'AUXILIARY' })
    } else if (collection === 'investments') {
      investments.push(item)
    } else if (collection === 'workers') {
      workers.push({ ...item, type: (row.type as string) ?? 'EMPLOYEE' })
    } else if (collection === 'otherCategories') {
      otherCategories.push(item)
    }
  }

  return { cashRegisters, investments, workers, otherCategories } as ReferenceDataT
}
