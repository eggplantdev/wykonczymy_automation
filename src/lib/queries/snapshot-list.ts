'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { listSnapshots, type SnapshotMetaT } from '@/lib/db/snapshots'
import { listTemplateSnapshots } from '@/lib/db/template-snapshots'
import { withTakenByNames } from '@/lib/kosztorys/snapshot-taken-by-names'
import type { ActionResultT } from '@/types/action'

// Without the owner id: the template plane lists its versions in the same drawer.
export type SnapshotListItemT = Omit<SnapshotMetaT, 'investmentId'> & { takenByName: string | null }

// Reads only — a locked kosztorys keeps its history browsable; restoring it is what's refused.
export async function fetchKosztorysSnapshots(
  investmentId: number,
): Promise<ActionResultT<SnapshotListItemT[]>> {
  return protectedAction('fetchKosztorysSnapshots', async ({ payload }) => {
    const db = await getDb(payload)
    return {
      success: true,
      data: await withTakenByNames(payload, await listSnapshots(db, investmentId)),
    }
  })
}

export async function fetchTemplateSnapshots(
  templateId: number,
): Promise<ActionResultT<SnapshotListItemT[]>> {
  return protectedAction('fetchTemplateSnapshots', async ({ payload }) => {
    const db = await getDb(payload)
    return {
      success: true,
      data: await withTakenByNames(payload, await listTemplateSnapshots(db, templateId)),
    }
  })
}
