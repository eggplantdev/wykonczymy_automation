import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { findReferencedMediaIds } from '@/lib/db/media-detachments'
import {
  deleteUnreferencedMedia,
  reclaimUnreferencedMedia,
} from '@/lib/media/delete-unreferenced-media'

const scheduled: (() => unknown)[] = []
let outsideRequestScope = false

vi.mock('next/server', () => ({
  after: (callback: () => unknown) => {
    if (outsideRequestScope) throw new Error('after() was called outside a request scope')
    scheduled.push(callback)
  },
}))
vi.mock('@/lib/db/media-detachments', () => ({ findReferencedMediaIds: vi.fn() }))

function fakePayload(referenced: number[]) {
  vi.mocked(findReferencedMediaIds).mockResolvedValue(referenced)
  const deleted: number[] = []
  const payload = {
    db: { drizzle: { execute: async () => ({ rows: [] }) } },
    delete: vi.fn(async ({ id }: { id: number }) => {
      deleted.push(id)
    }),
  }
  return { payload: payload as unknown as Payload, deleted }
}

describe('deleteUnreferencedMedia', () => {
  it('deletes only the files nothing else holds', async () => {
    const { payload, deleted } = fakePayload([2])
    await deleteUnreferencedMedia(payload, [1, 2, 3])
    expect(deleted).toEqual([1, 3])
  })

  it('leaks rather than throws when a delete fails', async () => {
    const { payload } = fakePayload([])
    vi.mocked(payload.delete).mockRejectedValueOnce(new Error('blob down'))
    await expect(deleteUnreferencedMedia(payload, [7])).resolves.toBeUndefined()
  })

  it('deletes nothing when the reference scan fails', async () => {
    const { payload, deleted } = fakePayload([])
    vi.mocked(findReferencedMediaIds).mockRejectedValueOnce(new Error('db down'))
    await expect(deleteUnreferencedMedia(payload, [1, 2])).resolves.toBeUndefined()
    expect(deleted).toEqual([])
  })

  it('never has two deletes in flight at once', async () => {
    const { payload, deleted } = fakePayload([])
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
    const { payload, deleted } = fakePayload([])

    await reclaimUnreferencedMedia(payload, [7])
    expect(deleted).toEqual([])

    await scheduled[0]()
    expect(deleted).toEqual([7])
  })

  it('runs inline when there is no request scope to defer into', async () => {
    outsideRequestScope = true
    const { payload, deleted } = fakePayload([])

    await reclaimUnreferencedMedia(payload, [7])

    expect(deleted).toEqual([7])
  })
})
