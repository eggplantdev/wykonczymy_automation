import { describe, it, expect, beforeAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { STAGE_MEMBER_INSERT_COLUMNS } from '@/lib/db/stage-split'
import { ITEM_INSERT_COLUMNS, SECTION_INSERT_COLUMNS } from '@/lib/kosztorys/insert-rows'
import {
  PROGRESS_INSERT_COLUMNS,
  STAGE_INSERT_COLUMNS,
} from '@/lib/kosztorys/insert-kosztorys-tree'

// Restore rebuilds the kosztorys tree with five hand-written INSERTs (insert-rows.ts, the two
// inline ones in insert-kosztorys-tree.ts, and the etap members in db/stage-split.ts). Nothing otherwise connects those column lists to the
// tables they write: add a column in a migration and restore keeps working, silently dropping the new
// field on every snapshot it reinserts. There is no error to notice — the restored row just carries
// the column's default.
//
// The lists asserted here are the ones the statements are BUILT from, imported, not retyped: a
// hand-written mirror could be made green the lazy way (add the column here, forget the INSERT), and
// that is the failure this guard would then miss. What it still cannot see is the VALUES tuple
// drifting out of alignment with its column list — that one is on the roundtrip spec's coverage.
const EXCLUDED = ['id', 'created_at', 'updated_at']

const INSERT_COLUMNS: Record<string, readonly string[]> = {
  kosztorys_sections: SECTION_INSERT_COLUMNS,
  kosztorys_items: ITEM_INSERT_COLUMNS,
  kosztorys_stages: STAGE_INSERT_COLUMNS,
  stage_progress: PROGRESS_INSERT_COLUMNS,
  kosztorys_stage_workers: STAGE_MEMBER_INSERT_COLUMNS,
}

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('restore INSERT column lists vs live schema (DB)', () => {
  let db: Awaited<ReturnType<typeof getDb>>
  let payload: Payload

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
  })

  it.each(Object.keys(INSERT_COLUMNS))(
    '%s — every column restore must carry is written by the INSERT',
    async (table) => {
      const res = await db.execute(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table}
      `)

      // A typo'd or renamed table would otherwise report "no drift" against an empty schema.
      expect(res.rows.length).toBeGreaterThan(0)

      const live = res.rows
        .map((row) => String(row.column_name))
        .filter((name) => !EXCLUDED.includes(name))
        .sort()

      expect(live).toEqual([...INSERT_COLUMNS[table]].sort())
    },
  )
})
