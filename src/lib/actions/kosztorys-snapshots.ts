'use server'

import { z } from 'zod'
import { investmentAction } from '@/lib/actions/investment-action'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import { KOSZTORYS_TREE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { getSnapshot, insertSnapshot, listSnapshots, type SnapshotMetaT } from '@/lib/db/snapshots'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import type { ActionResultT } from '@/types/action'

export async function snapshotAction(investmentId: number): Promise<ActionResultT> {
  return investmentAction('snapshotAction', { investmentId }, async ({ payload, user }) => {
    const db = await getDb(payload)
    await captureAutoSnapshot(db, investmentId, user.id)
    return { success: true }
  })
}

const saveSnapshotSchema = z.object({ label: z.string().trim().min(1, 'Podaj nazwę wersji') })

export async function saveSnapshotAction(
  investmentId: number,
  label: string,
): Promise<ActionResultT> {
  return investmentAction(
    'saveSnapshotAction',
    { investmentId },
    async ({ payload, user }) => {
      const parsed = validateAction(saveSnapshotSchema, { label })
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

export type RestoreResultT = { droppedWorkerAssignments: number }

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

export type SnapshotListItemT = SnapshotMetaT & { takenByName: string | null }

export async function listSnapshotsAction(
  investmentId: number,
): Promise<ActionResultT<SnapshotListItemT[]>> {
  // Reads only — a locked kosztorys keeps its history browsable; restoring it is what's refused.
  return protectedAction('listSnapshotsAction', async ({ payload }) => {
    const db = await getDb(payload)
    const snapshots = await listSnapshots(db, investmentId)

    const userIds = [
      ...new Set(snapshots.map((s) => s.takenBy).filter((id): id is number => id != null)),
    ]
    const nameById = new Map<number, string>()
    if (userIds.length > 0) {
      const users = await payload.find({
        collection: 'users',
        where: { id: { in: userIds } },
        limit: userIds.length,
        depth: 0,
        overrideAccess: true,
      })
      for (const u of users.docs) nameById.set(Number(u.id), u.name ?? u.email)
    }

    const data = snapshots.map((s) => ({
      ...s,
      takenByName: s.takenBy == null ? null : (nameById.get(s.takenBy) ?? null),
    }))
    return { success: true, data }
  })
}
