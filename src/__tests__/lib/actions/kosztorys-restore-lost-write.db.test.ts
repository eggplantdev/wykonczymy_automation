import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { getSnapshot } from '@/lib/db/snapshots'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { restoreSnapshotAction, saveSnapshotAction } from '@/lib/actions/kosztorys-snapshots'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { firstUserId } from '@/__tests__/helpers/user'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'

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
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

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

      const readTree = vi.mocked(serializeKosztorys).getMockImplementation()!
      // No `req`: a separate connection committing on its own, as an autosave from another tab does.
      // Forwards every argument: a seam that dropped `req` would move the read onto its own connection.
      vi.mocked(serializeKosztorys).mockImplementationOnce(async (...args) => {
        const tree = await readTree(...args)
        await payload.update({
          collection: 'kosztorys-items',
          id: itemId,
          data: { description: 'Malowanie — poprawka z drugiej karty' },
          context: { skipRevalidation: true },
        })
        return tree
      })

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
