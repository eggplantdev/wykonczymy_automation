'use server'

import { z } from 'zod'
import { investmentAction } from '@/lib/actions/investment-action'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import { KOSZTORYS_TREE_TAGS } from '@/lib/cache/tags'
import { snapshotLabelSchema } from '@/lib/kosztorys/snapshot-label-schema'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { getSnapshot, insertSnapshot, listSnapshots, type SnapshotMetaT } from '@/lib/db/snapshots'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { withTakenByNames } from '@/lib/kosztorys/snapshot-taken-by-names'
import type { ActionResultT } from '@/types/action'

export async function snapshotAction(investmentId: number): Promise<ActionResultT> {
  return investmentAction('snapshotAction', { investmentId }, async ({ payload, user }) => {
    const db = await getDb(payload)
    await captureAutoSnapshot(db, investmentId, user.id)
    return { success: true }
  })
}

// Named manual snapshot („Zapisz jako…") — required label, exempt from the auto thinning bands.
export async function saveSnapshotAction(
  investmentId: number,
  label: string,
): Promise<ActionResultT> {
  return investmentAction(
    'saveSnapshotAction',
    { investmentId },
    async ({ payload, user }) => {
      const parsed = validateAction(snapshotLabelSchema, { label })
      if (!parsed.success) return parsed
      const db = await getDb(payload)
      const snapshot = await serializeKosztorys(investmentId)
      await insertSnapshot(db, {
        investmentId,
        kind: 'named',
        label: parsed.data.label,
        takenBy: user.id,
        payload: snapshot,
      })
      return { success: true }
    },
    ['kosztorysSnapshots'],
  )
}

const restoreSchema = z.object({ snapshotId: z.number(), investmentId: z.number() })

// `skippedCatalogueItems` is the template plane's: prace whose katalog entry was deleted since.
export type RestoreResultT = { droppedWorkerAssignments: number; skippedCatalogueItems?: number }

export async function restoreSnapshotAction(
  snapshotId: number,
  investmentId: number,
): Promise<ActionResultT<RestoreResultT>> {
  return investmentAction(
    'restoreSnapshotAction',
    { investmentId },
    async ({ payload, user }) => {
      const parsed = validateAction(restoreSchema, { snapshotId, investmentId })
      if (!parsed.success) return parsed

      const snapshot = await getSnapshot(await getDb(payload), parsed.data.snapshotId)
      // Not found, or scoped to a different investment — indistinguishable on purpose (no existence leak).
      if (!snapshot || snapshot.investmentId !== parsed.data.investmentId) {
        return { success: false, error: 'Nie znaleziono wersji' }
      }

      const restored = await withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          await captureAutoSnapshot(txDb, snapshot.investmentId, user.id)
          return restoreKosztorys(payload, req, snapshot.investmentId, snapshot.payload)
        },
        { skipRevalidation: true },
      )
      // The count travels to the client because the restore silently moved money: należne that the
      // snapshot attributed to a since-deleted person lands in the residual bucket instead.
      return { success: true, data: restored }
    },
    [...KOSZTORYS_TREE_TAGS],
  )
}

// Without the owner id: the template plane lists its versions in the same drawer.
export type SnapshotListItemT = Omit<SnapshotMetaT, 'investmentId'> & { takenByName: string | null }

export async function listSnapshotsAction(
  investmentId: number,
): Promise<ActionResultT<SnapshotListItemT[]>> {
  // Reads only — a locked kosztorys keeps its history browsable; restoring it is what's refused.
  return protectedAction('listSnapshotsAction', async ({ payload }) => {
    const db = await getDb(payload)
    return {
      success: true,
      data: await withTakenByNames(payload, await listSnapshots(db, investmentId)),
    }
  })
}
