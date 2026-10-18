import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { getSnapshot } from '@/lib/db/snapshots'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { firstUserId } from '@/__tests__/helpers/first-user-id'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { authState } from '@/__tests__/stubs/require-auth'

vi.mock('@/lib/auth/require-auth', () => import('@/__tests__/stubs/require-auth'))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

let onSnapshotRead: (() => Promise<void>) | undefined
vi.mock('@/lib/kosztorys/serialize-kosztorys', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/kosztorys/serialize-kosztorys')>()
  return {
    ...actual,
    // Forwards every argument: a mock that dropped `req` would move the read onto its own connection.
    serializeKosztorys: async (...args: Parameters<typeof actual.serializeKosztorys>) => {
      const tree = await actual.serializeKosztorys(...args)
      await onSnapshotRead?.()
      return tree
    },
  }
})

const { restoreSnapshotAction, saveSnapshotAction } =
  await import('@/lib/actions/kosztorys-snapshots')

describe.skipIf(!ENV_READY)('version restore vs a concurrent autosave (DB)', () => {
  let payload: Payload
  let investmentId: number
  let itemId: number

  beforeAll(async () => {
    payload = await bootTestPayload()
    authState.userId = await firstUserId(payload)
    investmentId = await createTestInvestment(payload, 'restore-lost-write-test')
    const { itemIds } = await createKosztorysTree(payload, investmentId, {
      sections: [{ name: 'Sekcja A', items: [{ description: 'Malowanie', unit: 'm2' }] }],
    })
    itemId = itemIds[0]
  })

  afterAll(async () => {
    onSnapshotRead = undefined
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  // Timeout: an untimed `it` hangs the serial pre-push integration leg forever with no output.
  it(
    'keeps an edit committed between the snapshot read and the wipe restorable',
    { timeout: 30_000 },
    async () => {
      const db = await getDb(payload)
      expect((await saveSnapshotAction(investmentId, 'wersja A')).success).toBe(true)
      const named = await db.execute(sql`
        SELECT id FROM kosztorys_snapshots
        WHERE investment_id = ${investmentId} AND kind = 'named'
        ORDER BY id DESC LIMIT 1
      `)
      const snapshotId = Number(named.rows[0].id)

      // No `req`: a separate connection committing on its own, as an autosave from another tab does.
      onSnapshotRead = async () => {
        onSnapshotRead = undefined // the restore's retry, if any, must not race itself
        await payload.update({
          collection: 'kosztorys-items',
          id: itemId,
          data: { description: 'Malowanie — poprawka z drugiej karty' },
          context: { skipRevalidation: true },
        })
      }

      expect((await restoreSnapshotAction(snapshotId, investmentId)).success).toBe(true)

      const after = await serializeKosztorys(investmentId)
      expect(after.items.map((item) => item.description)).toEqual(['Malowanie'])

      const auto = await db.execute(sql`
        SELECT id FROM kosztorys_snapshots
        WHERE investment_id = ${investmentId} AND kind = 'auto'
        ORDER BY id DESC LIMIT 1
      `)
      const beforeRestore = await getSnapshot(db, Number(auto.rows[0].id))
      expect(beforeRestore?.payload.items.map((item) => item.description)).toEqual([
        'Malowanie — poprawka z drugiej karty',
      ])
    },
  )
})
