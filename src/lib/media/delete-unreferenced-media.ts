import { after } from 'next/server'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { findDraftHeldMedia } from '@/lib/db/worker-expense-drafts'
import { findReportHeldMedia } from '@/lib/db/worker-reports'
import { MEDIA_RELATIONS, mediaReferenceWhere } from '@/lib/media/relating-collections'
import { uploadFieldIds, type UploadFieldT } from '@/lib/media/upload-field'
import { logError } from '@/lib/utils/log-error'

/**
 * The `_rels` FKs are ON DELETE cascade, so deleting a row still attached elsewhere silently strips
 * that page from whatever else holds it.
 */
export async function deleteUnreferencedMedia(payload: Payload, mediaIds: number[]): Promise<void> {
  if (mediaIds.length === 0) return

  let referenced: Set<number>
  try {
    referenced = await findReferencedMedia(payload, mediaIds)
  } catch (err) {
    logError('[media] reference scan failed, deleting nothing', err)
    return
  }

  for (const id of mediaIds) {
    if (referenced.has(id)) continue
    try {
      await payload.delete({ collection: 'media', id })
    } catch (err) {
      logError('[media] delete unreferenced media failed', err)
    }
  }
}

/**
 * Outside a request scope — a script, a node spec — `after` throws, so that case runs it inline.
 */
export async function reclaimUnreferencedMedia(
  payload: Payload,
  mediaIds: number[],
): Promise<void> {
  const reclaim = () => deleteUnreferencedMedia(payload, mediaIds)
  try {
    after(reclaim)
  } catch {
    await reclaim()
  }
}

async function findReferencedMedia(payload: Payload, mediaIds: number[]): Promise<Set<number>> {
  const candidates = new Set(mediaIds)
  const referenced = new Set<number>()

  for (const { collection, field } of MEDIA_RELATIONS) {
    const { docs } = await payload.find({
      collection,
      where: mediaReferenceWhere(field, mediaIds),
      depth: 0,
      pagination: false,
    })
    for (const doc of docs) {
      for (const id of uploadFieldIds((doc as unknown as Record<string, UploadFieldT>)[field])) {
        if (candidates.has(id)) referenced.add(id)
      }
    }
  }

  const db = await getDb(payload)
  for (const id of await findDraftHeldMedia(db, mediaIds)) referenced.add(id)
  for (const id of await findReportHeldMedia(db, mediaIds)) referenced.add(id)

  return referenced
}
