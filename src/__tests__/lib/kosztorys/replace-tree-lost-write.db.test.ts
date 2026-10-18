import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { replaceTreeWithSnapshot } from '@/lib/kosztorys/replace-tree-with-snapshot'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { getDb } from '@/lib/db/get-db'
import { getSnapshot, listSnapshots } from '@/lib/db/snapshots'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { firstUserId } from '@/__tests__/helpers/user'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

let onSnapshotRead: (() => Promise<void>) | undefined
vi.mock('@/lib/kosztorys/serialize-kosztorys', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/kosztorys/serialize-kosztorys')>()
  return {
    ...actual,
    // Forwards every argument: the replacement passes its transaction-scoped `req`, and a mock that
    // dropped it would quietly move the read back onto its own connection — testing the wrong thing.
    serializeKosztorys: async (...args: Parameters<typeof actual.serializeKosztorys>) => {
      const tree = await actual.serializeKosztorys(...args)
      await onSnapshotRead?.()
      return tree
    },
  }
})

describe.skipIf(!ENV_READY)('wholesale replacement vs a concurrent autosave (DB)', () => {
  let payload: Payload
  let investmentId: number
  let itemId: number
  let takenBy: number

  beforeAll(async () => {
    payload = await bootTestPayload()

    takenBy = await firstUserId(payload)

    investmentId = await createTestInvestment(payload, 'replace-tree-lost-write-test', {
      vatRate: 0.23,
      wToolsCoeff: 0.7,
      ownToolsCoeff: 0.5,
    })
    const { itemIds } = await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name: 'Sekcja A',
          items: [{ description: 'Malowanie', unit: 'm2', plannedQty: 10, clientPrice: 100 }],
        },
      ],
      stages: [{ label: 'Etap 1' }],
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
      const before = await serializeKosztorys(investmentId)
      const snapshotsBefore = await listSnapshots(await getDb(payload), investmentId)

      // Runs with no `req`, so it is a separate connection committing on its own — exactly what an
      // autosave from another tab is.
      onSnapshotRead = async () => {
        onSnapshotRead = undefined // the replacement's retry, if any, must not race itself
        await payload.update({
          collection: 'kosztorys-items',
          id: itemId,
          data: { description: 'Malowanie — poprawka z drugiej karty' },
          context: { skipRevalidation: true },
        })
      }

      await replaceTreeWithSnapshot(payload, {
        investmentId,
        label: 'Zastąpienie',
        takenBy,
        tree: { ...before, sections: [], items: [], stages: [], progress: [] },
      })

      const after = await serializeKosztorys(investmentId)
      expect(after.items).toEqual([])

      const db = await getDb(payload)
      const snapshotsAfter = await listSnapshots(db, investmentId)
      expect(snapshotsAfter).toHaveLength(snapshotsBefore.length + 1)

      const restorable = await getSnapshot(db, snapshotsAfter[0].id)
      expect(restorable?.payload.items.map((item) => item.description)).toEqual([
        'Malowanie — poprawka z drugiej karty',
      ])
    },
  )
})
