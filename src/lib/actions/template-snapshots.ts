'use server'

import { z } from 'zod'
import type { Payload } from 'payload'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import { templateAction } from '@/lib/actions/template-action'
import type { RestoreResultT, SnapshotListItemT } from '@/lib/actions/kosztorys-snapshots'
import { TEMPLATE_TRASHED_MESSAGE } from '@/lib/constants/template-lock'
import { snapshotLabelSchema } from '@/lib/kosztorys/snapshot-label-schema'
import { getDb } from '@/lib/db/get-db'
import { templateGateFor } from '@/lib/db/template-gate'
import { readTemplateLayout } from '@/lib/db/template-structure'
import {
  getTemplateSnapshot,
  insertTemplateSnapshot,
  listTemplateSnapshots,
} from '@/lib/db/template-snapshots'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { withTakenByNames } from '@/lib/kosztorys/snapshot-taken-by-names'
import { restoreTemplateSnapshot } from '@/lib/kosztorys/templates/restore-template-snapshot'
import type { SnapshotKindT } from '@/lib/kosztorys/snapshot-format'
import type { ActionResultT } from '@/types/action'

const TEMPLATE_NOT_FOUND = 'Nie znaleziono szablonu'
const SNAPSHOT_NOT_FOUND = 'Nie znaleziono wersji'

// Capturing a version is not an edit of the szablon, so it goes past `templateAction`, which would
// move „ostatnio edytowany".
async function captureTemplateSnapshot(
  payload: Payload,
  templateId: number,
  version: { kind: SnapshotKindT; label: string | null; takenBy: number },
): Promise<ActionResultT> {
  const db = await getDb(payload)
  const gate = await templateGateFor(db, 'template', templateId)
  if (!gate) return { success: false, error: TEMPLATE_NOT_FOUND, code: 'NOT_FOUND' }
  if (gate.isTrashed) return { success: false, error: TEMPLATE_TRASHED_MESSAGE }
  await insertTemplateSnapshot(db, {
    templateId,
    ...version,
    payload: await readTemplateLayout(db, templateId),
  })
  return { success: true }
}

// The editor's periodic auto version — the same client interval as the kosztorys, gated on the undo
// revision, so an untouched szablon writes nothing.
export async function templateSnapshotAction(templateId: number): Promise<ActionResultT> {
  return protectedAction('templateSnapshotAction', async ({ payload, user }) =>
    captureTemplateSnapshot(payload, templateId, { kind: 'auto', label: null, takenBy: user.id }),
  )
}

export async function saveTemplateSnapshotAction(
  templateId: number,
  label: string,
): Promise<ActionResultT> {
  return protectedAction('saveTemplateSnapshotAction', async ({ payload, user }) => {
    const parsed = validateAction(snapshotLabelSchema, { label })
    if (!parsed.success) return parsed
    return captureTemplateSnapshot(payload, templateId, {
      kind: 'named',
      label: parsed.data.label,
      takenBy: user.id,
    })
  })
}

const restoreSchema = z.object({ snapshotId: z.number(), templateId: z.number() })

// The version must belong to the szablon open in the editor — one from another szablon reads as
// „not found", so a bare snapshot id can't wipe a szablon the user isn't looking at.
export async function restoreTemplateSnapshotAction(
  snapshotId: number,
  templateId: number,
): Promise<ActionResultT<RestoreResultT>> {
  return templateAction<RestoreResultT>(
    'restoreTemplateSnapshotAction',
    { kind: 'template', id: templateId },
    async ({ payload, user }) => {
      const parsed = validateAction(restoreSchema, { snapshotId, templateId })
      if (!parsed.success) return parsed

      const snapshot = await getTemplateSnapshot(await getDb(payload), parsed.data.snapshotId)
      if (!snapshot || snapshot.templateId !== parsed.data.templateId) {
        return { success: false, error: SNAPSHOT_NOT_FOUND }
      }

      const { skippedCatalogueItems } = await withPayloadTransaction(
        payload,
        async (req) =>
          restoreTemplateSnapshot(
            await getDb(payload, req),
            snapshot.templateId,
            snapshot.payload,
            user.id,
          ),
        { skipRevalidation: true },
      )
      return { success: true, data: { droppedWorkerAssignments: 0, skippedCatalogueItems } }
    },
  )
}

export async function listTemplateSnapshotsAction(
  templateId: number,
): Promise<ActionResultT<SnapshotListItemT[]>> {
  return protectedAction('listTemplateSnapshotsAction', async ({ payload }) => {
    const db = await getDb(payload)
    return {
      success: true,
      data: await withTakenByNames(payload, await listTemplateSnapshots(db, templateId)),
    }
  })
}
