import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectionSlug, Payload } from 'payload'
import {
  deleteUnreferencedMedia,
  reclaimUnreferencedMedia,
} from '@/lib/media/delete-unreferenced-media'
import { MEDIA_RELATIONS } from '@/lib/media/relating-collections'

const scheduled: (() => unknown)[] = []
let outsideRequestScope = false

vi.mock('next/server', () => ({
  after: (callback: () => unknown) => {
    if (outsideRequestScope) throw new Error('after() was called outside a request scope')
    scheduled.push(callback)
  },
}))

const PAYLOAD_DEFAULT_PAGE = 10

type ReferencedByT = Partial<Record<CollectionSlug, number[]>>

function fakePayload(referencedBy: ReferencedByT) {
  const deleted: number[] = []
  const payload = {
    // One doc per held id, shaped like the real read: the scan asks each relation once with `in`
    // and reads the ids back off the matched docs' upload field.
    find: vi.fn(async ({ collection, where, pagination }) => {
      const field = Object.keys(where)[0]
      const asked: number[] = where[field].in
      const held = referencedBy[collection as CollectionSlug] ?? []
      const matched = asked.filter((id) => held.includes(id)).map((id) => ({ [field]: [id] }))
      // Payload pages at 10 unless told otherwise, and this mock says so out loud: a scan that
      // drops `pagination: false` reads back a short answer and deletes live files.
      return { docs: pagination === false ? matched : matched.slice(0, PAYLOAD_DEFAULT_PAGE) }
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
    expect(vi.mocked(payload.find).mock.calls.map(([args]) => args.collection)).toEqual(
      MEDIA_RELATIONS.map(({ collection }) => collection),
    )
  })

  // The scan is what the `6N` round-trips paid for: one query per relation for the WHOLE batch, not
  // one per id. Asserting the call count is the only way a mock can show the batching survived.
  it('asks each relation once for a whole batch', async () => {
    const { payload, deleted } = fakePayload({ transactions: [2] })
    await deleteUnreferencedMedia(payload, [1, 2, 3])
    expect(payload.find).toHaveBeenCalledTimes(MEDIA_RELATIONS.length)
    expect(deleted).toEqual([1, 3])
  })

  // Blob has no undelete, so an under-read of the reference scan is unrecoverable: a batch of more
  // than one page of held ids must still come back whole.
  it('spares every attached file in a batch larger than one page', async () => {
    const attached = Array.from({ length: PAYLOAD_DEFAULT_PAGE + 2 }, (_unused, index) => index + 1)
    const { payload, deleted } = fakePayload({ transactions: attached })
    await deleteUnreferencedMedia(payload, attached)
    expect(deleted).toEqual([])
  })

  it('leaks rather than throws when a delete fails', async () => {
    const { payload } = fakePayload({})
    vi.mocked(payload.delete).mockRejectedValueOnce(new Error('blob down'))
    await expect(deleteUnreferencedMedia(payload, [7])).resolves.toBeUndefined()
  })

  // A batched scan answers for every id at once, so a scan that throws leaves the whole batch
  // unanswered — and an unanswered reference question must leak, never cascade a live row away.
  it('deletes nothing when the reference scan fails', async () => {
    const { payload, deleted } = fakePayload({})
    vi.mocked(payload.find).mockRejectedValueOnce(new Error('db down'))
    await expect(deleteUnreferencedMedia(payload, [1, 2])).resolves.toBeUndefined()
    expect(deleted).toEqual([])
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

describe('reclaimUnreferencedMedia', () => {
  beforeEach(() => {
    scheduled.length = 0
    outsideRequestScope = false
  })

  it('returns before anything is deleted, and deletes once the response is out', async () => {
    const { payload, deleted } = fakePayload({})

    await reclaimUnreferencedMedia(payload, [7])
    expect(deleted).toEqual([])

    await scheduled[0]()
    expect(deleted).toEqual([7])
  })

  // A script and a node spec have no response to run after, so deferring there would drop the
  // reclaim entirely.
  it('runs inline when there is no request scope to defer into', async () => {
    outsideRequestScope = true
    const { payload, deleted } = fakePayload({})

    await reclaimUnreferencedMedia(payload, [7])

    expect(deleted).toEqual([7])
  })
})
