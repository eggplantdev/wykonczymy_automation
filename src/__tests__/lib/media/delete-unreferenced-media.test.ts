import { describe, expect, it, vi } from 'vitest'
import type { CollectionSlug, Payload } from 'payload'
import { deleteUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'
import { MEDIA_RELATIONS } from '@/lib/media/relating-collections'

type ReferencedByT = Partial<Record<CollectionSlug, number[]>>

function fakePayload(referencedBy: ReferencedByT) {
  const deleted: number[] = []
  const payload = {
    count: vi.fn(async ({ collection, where }) => {
      const id = where.invoice?.equals ?? where.attachments?.equals
      return { totalDocs: referencedBy[collection as CollectionSlug]?.includes(id) ? 1 : 0 }
    }),
    delete: vi.fn(async ({ id }: { id: number }) => {
      deleted.push(id)
    }),
  }
  return { payload: payload as unknown as Payload, deleted }
}

describe('deleteUnreferencedMedia', () => {
  it('deletes a media row nothing points at', async () => {
    const { payload, deleted } = fakePayload({})
    await deleteUnreferencedMedia(payload, [7])
    expect(deleted).toEqual([7])
  })

  it('spares a page still attached to a transaction', async () => {
    const { payload, deleted } = fakePayload({ transactions: [7] })
    await deleteUnreferencedMedia(payload, [7])
    expect(deleted).toEqual([])
  })

  it('spares an attachment still held by a vehicle inspection', async () => {
    const { payload, deleted } = fakePayload({ 'vehicle-inspections': [7] })
    await deleteUnreferencedMedia(payload, [7])
    expect(deleted).toEqual([])
  })

  // The counter was a hand-maintained list of two collections and `equipment-events.attachments`
  // was added to neither, so a handover's photos were deletable out from under it. Driving both
  // readers off MEDIA_RELATIONS is what closes it — this asserts the relation the list forgot.
  it('spares an attachment still held by an equipment event', async () => {
    const { payload, deleted } = fakePayload({ 'equipment-events': [7] })
    await deleteUnreferencedMedia(payload, [7])
    expect(deleted).toEqual([])
  })

  it('checks every registered relation before deleting', async () => {
    const { payload } = fakePayload({})
    await deleteUnreferencedMedia(payload, [7])
    expect(vi.mocked(payload.count).mock.calls.map(([args]) => args.collection)).toEqual(
      MEDIA_RELATIONS.map(({ collection }) => collection),
    )
  })

  it('leaks rather than throws when a delete fails', async () => {
    const { payload } = fakePayload({})
    vi.mocked(payload.delete).mockRejectedValueOnce(new Error('blob down'))
    await expect(deleteUnreferencedMedia(payload, [7])).resolves.toBeUndefined()
  })

  // The deployed database loses all but one of a set of concurrent Payload writes, and reports
  // success for every one of them — which left every page but one of a deleted multi-page invoice
  // in storage with nothing pointing at it. Overlapping calls are the defect, so that is what this
  // asserts; a mock cannot show the lost row itself.
  it('never has two deletes in flight at once', async () => {
    const { payload, deleted } = fakePayload({})
    let inFlight = 0
    let maxInFlight = 0
    vi.mocked(payload.delete).mockImplementation((async ({ id }: { id: number }) => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1
      deleted.push(id)
    }) as unknown as Payload['delete'])

    await deleteUnreferencedMedia(payload, [1, 2, 3, 4])

    expect(maxInFlight).toBe(1)
    expect(deleted).toEqual([1, 2, 3, 4])
  })
})
