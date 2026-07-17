'use server'

import { z } from 'zod'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { getSnapshot, insertSnapshot, listSnapshots, type SnapshotMetaT } from '@/lib/db/snapshots'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import type { ActionResultT } from '@/types/action'

// --- Capture triggers ---

// Periodic auto snapshot — the client's 10-min interval calls this unconditionally (fire-and-forget).
export async function snapshotAction(investmentId: number): Promise<ActionResultT> {
  return protectedAction('snapshotAction', async ({ payload, user }) => {
    const db = await getDb(payload)
    await captureAutoSnapshot(db, investmentId, user.id)
    return { success: true }
  })
}

const saveSnapshotSchema = z.object({ label: z.string().trim().min(1, 'Podaj nazwę wersji') })

// Named manual snapshot ("Zapisz jako…") — required label, exempt from the auto count cap.
export async function saveSnapshotAction(
  investmentId: number,
  label: string,
): Promise<ActionResultT> {
  return protectedAction('saveSnapshotAction', async ({ payload, user }) => {
    const parsed = validateAction(saveSnapshotSchema, { label })
    if (!parsed.success) return parsed
    const db = await getDb(payload)
    const snapshot = await serializeKosztorys(investmentId)
    await insertSnapshot(db, {
      investmentId,
      kind: 'manual',
      label: parsed.data.label,
      takenBy: user.id,
      payload: snapshot,
    })
    return { success: true }
  })
}

// --- Restore + listing ---

const restoreSchema = z.object({ snapshotId: z.number(), investmentId: z.number() })

// Restore a snapshot into the CURRENT investment: `investmentId` is the editor's open context and the
// snapshot must belong to it — a snapshot from another investment is refused as "not found" (a bare
// snapshotId with no such check would wipe-and-reinsert whatever investment the row happens to point
// at, unbounded by what the user is looking at). Then, in ONE transaction, take a forced pre-restore
// auto snapshot (so a mis-restore is itself recoverable) and wipe-and-reinsert the tree. On any throw
// the transaction rolls back and the live tree is untouched. `skipRevalidation` suppresses the per-op
// collection hooks (~1000 rows would otherwise fire revalidateTag each) — the action's revalidate list
// bumps every tag once after commit.
export async function restoreSnapshotAction(
  snapshotId: number,
  investmentId: number,
): Promise<ActionResultT> {
  return protectedAction(
    'restoreSnapshotAction',
    async ({ payload, user }) => {
      const parsed = validateAction(restoreSchema, { snapshotId, investmentId })
      if (!parsed.success) return parsed

      const snapshot = await getSnapshot(await getDb(payload), parsed.data.snapshotId)
      // Not found, or scoped to a different investment — indistinguishable on purpose (no existence leak).
      if (!snapshot || snapshot.investmentId !== parsed.data.investmentId) {
        return { success: false, error: 'Nie znaleziono wersji' }
      }

      await withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          await captureAutoSnapshot(txDb, snapshot.investmentId, user.id)
          await restoreKosztorys(payload, req, snapshot.investmentId, snapshot.payload)
        },
        { skipRevalidation: true },
      )
      return { success: true }
    },
    // Settings (VAT/coeffs) change too, so bump investments alongside the four tree tags.
    ['kosztorysSections', 'kosztorysItems', 'kosztorysStages', 'stageProgress', 'investments'],
  )
}

export type SnapshotListItemT = SnapshotMetaT & { takenByName: string | null }

// Snapshot metadata for the "Wersje" drawer — newest first, WITHOUT the jsonb payload, with
// taken_by resolved to a display name for attribution.
export async function listSnapshotsAction(
  investmentId: number,
): Promise<ActionResultT<SnapshotListItemT[]>> {
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
