import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-vercel-postgres'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/sum-transfers'
import { perfStart } from '@/lib/perf'

import type { ReferenceItemT, ReferenceDataT } from '@/types/reference-data'

export async function fetchReferenceData(): Promise<ReferenceDataT> {
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

  const result = await db.execute(sql`
    SELECT 'cashRegisters' AS collection, id, name, type::text FROM cash_registers WHERE active = true
    UNION ALL
    SELECT 'investments' AS collection, id, name, NULL AS type FROM investments WHERE status = 'active'
    UNION ALL
    SELECT 'workers' AS collection, id, name, role::text AS type FROM users WHERE active = true
    UNION ALL
    SELECT 'otherCategories' AS collection, id, name, NULL AS type FROM other_categories
  `)
  console.log(`[PERF] query.fetchReferenceData ${elapsed()}ms (1 SQL, ${result.rows.length} rows)`)

  const cashRegisters: ReferenceItemT[] = []
  const investments: ReferenceItemT[] = []
  const workers: ReferenceItemT[] = []
  const otherCategories: ReferenceItemT[] = []

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
