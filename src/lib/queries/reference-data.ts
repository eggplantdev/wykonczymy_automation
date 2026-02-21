import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-vercel-postgres'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/sum-transfers'
import { perfStart } from '@/lib/perf'

import type { ReferenceItemT, ReferenceDataBaseT } from '@/types/reference-data'

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

  const result = await db.execute(sql`
    SELECT 'cashRegisters' AS collection, id, name, type::text, active::boolean, owner_id::integer, NULL::integer AS default_cash_register_id FROM cash_registers
    UNION ALL
    SELECT 'investments', id, name, NULL, (status = 'active')::boolean, NULL::integer, NULL::integer FROM investments
    UNION ALL
    SELECT 'workers', id, name, role::text, active::boolean, NULL::integer, default_cash_register_id::integer FROM users
    UNION ALL
    SELECT 'otherCategories', id, name, NULL, true, NULL::integer, NULL::integer FROM other_categories
  `)
  console.log(`[PERF] query.fetchReferenceData ${elapsed()}ms (1 SQL, ${result.rows.length} rows)`)

  const cashRegisters: ReferenceItemT[] = []
  const investments: ReferenceItemT[] = []
  const workers: ReferenceItemT[] = []
  const otherCategories: ReferenceItemT[] = []

  for (const row of result.rows) {
    const collection = row.collection as string
    const item = { id: Number(row.id), name: row.name as string, active: row.active as boolean }

    if (collection === 'cashRegisters') {
      cashRegisters.push({
        ...item,
        type: (row.type as string) ?? 'AUXILIARY',
        ownerId: row.owner_id ? Number(row.owner_id) : undefined,
      })
    } else if (collection === 'investments') {
      investments.push(item)
    } else if (collection === 'workers') {
      workers.push({
        ...item,
        type: (row.type as string) ?? 'EMPLOYEE',
        defaultCashRegisterId: row.default_cash_register_id
          ? Number(row.default_cash_register_id)
          : undefined,
      })
    } else if (collection === 'otherCategories') {
      otherCategories.push(item)
    }
  }

  return { cashRegisters, investments, workers, otherCategories }
}
