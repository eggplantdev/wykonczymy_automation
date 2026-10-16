import type { CollectionSlug, Payload } from 'payload'
import { reclaimUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'
import { uploadFieldIds, type UploadFieldT } from '@/lib/media/upload-field'
import { perfStart } from '@/lib/perf'

type UploadFieldTargetT = {
  collection: CollectionSlug
  field: string
  id: number
}

export const investmentAssetsField = (investmentId: number) =>
  ({ collection: 'investments', field: 'assets', id: investmentId }) as const

/**
 * Two writers on one field inside the same find→update window still lose one of their lists.
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

  await reclaimUnreferencedMedia(
    payload,
    currentIds.filter((mediaId) => !next.includes(mediaId)),
  )
}

export function appendUploadIds(mediaIds: number[]) {
  return (current: number[]): number[] => [...new Set([...current, ...mediaIds])]
}
