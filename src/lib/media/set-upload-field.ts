import type { CollectionSlug, Payload } from 'payload'
import { deleteUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'
import { uploadFieldIds, type UploadFieldT } from '@/lib/media/upload-field'
import { perfStart } from '@/lib/perf'

type UploadFieldTargetT = {
  collection: CollectionSlug
  /** The hasMany upload field on `collection`, e.g. `invoice` / `assets`. */
  field: string
  id: number
}

/**
 * Rewrite one doc's hasMany upload field to whatever `nextIds` derives from the current list, then
 * delete the media the new list dropped once nothing else references it.
 *
 * Every attach/detach surface shares this because every one of them shares the hazards: the
 * read-modify-write races if a caller sends one file per call, and the reclaim must be awaited (see
 * below). A per-collection copy is a second place for a fix to miss, and a missed one leaks Blob
 * files silently.
 */
export async function setUploadField(
  payload: Payload,
  { collection, field, id }: UploadFieldTargetT,
  nextIds: (currentIds: number[]) => number[],
): Promise<void> {
  const step = perfStart()

  const doc = await payload.findByID({ collection, id, depth: 0 })
  const currentIds = uploadFieldIds((doc as unknown as Record<string, UploadFieldT>)[field])
  const next = nextIds(currentIds)
  console.log(`[PERF]   findByID(${collection}/${id}) ${step()}ms`)

  await payload.update({ collection, id, data: { [field]: next } })
  console.log(`[PERF]   payload.update(${collection}/${id}) ${step()}ms`)

  // Awaited, not fire-and-forget: the serverless invocation can be frozen the moment the response
  // is written, which would drop the deletes and leak exactly the files this reclaims.
  await deleteUnreferencedMedia(
    payload,
    currentIds.filter((mediaId) => !next.includes(mediaId)),
  )
}

/**
 * Appends without duplicating — the admin picker and a double submit can both send a held id, and
 * one batch can carry the same id twice when the picker is opened over an already-held file.
 */
export function appendUploadIds(mediaIds: number[]) {
  return (current: number[]): number[] => [...new Set([...current, ...mediaIds])]
}
