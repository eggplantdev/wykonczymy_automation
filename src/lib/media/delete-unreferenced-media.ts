import { after } from 'next/server'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { findReferencedMediaIds } from '@/lib/db/media-detachments'
import { logError } from '@/lib/utils/log-error'

/**
 * The `_rels` FKs are ON DELETE cascade, so deleting a row still attached elsewhere silently strips
 * that page from whatever else holds it.
 */
export async function deleteUnreferencedMedia(payload: Payload, mediaIds: number[]): Promise<void> {
  if (mediaIds.length === 0) return

  let referenced: Set<number>
  try {
    referenced = new Set(await findReferencedMediaIds(await getDb(payload), mediaIds))
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
