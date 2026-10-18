import type { CollectionSlug, Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { closeDetachments, recordDetachments } from '@/lib/db/media-detachments'
import { uploadFieldIds, type UploadFieldT } from '@/lib/media/upload-field'
import { perfStart } from '@/lib/perf'

type UploadFieldTargetT = {
  collection: CollectionSlug
  field: string
  id: number
}

export const investmentAssetsField = (investmentId: number) =>
  ({ collection: 'investments', field: 'assets', id: investmentId }) as const

// Dropped files are recorded before the update: a crash in between leaves an attached file in the
// trash, which the nightly sweep heals, never a detached file without provenance.
export async function setUploadField(
  payload: Payload,
  { collection, field, id }: UploadFieldTargetT,
  nextIds: (currentIds: number[]) => number[],
): Promise<void> {
  const step = perfStart()

  const doc = await payload.findByID({ collection, id, depth: 0 })
  const currentIds = uploadFieldIds((doc as unknown as Record<string, UploadFieldT>)[field])
  const next = nextIds(currentIds)
  const dropped = currentIds.filter((mediaId) => !next.includes(mediaId))
  const added = next.filter((mediaId) => !currentIds.includes(mediaId))
  console.log(`[PERF]   findByID(${collection}/${id}) ${step()}ms`)

  const db = await getDb(payload)
  await recordDetachments(db, { collection, field, id }, dropped)

  await payload.update({ collection, id, data: { [field]: next } })
  console.log(`[PERF]   payload.update(${collection}/${id}) ${step()}ms`)

  await closeDetachments(db, added)
}

export function appendUploadIds(mediaIds: number[]) {
  return (current: number[]): number[] => [...new Set([...current, ...mediaIds])]
}
