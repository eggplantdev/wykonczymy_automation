import { APIError } from 'payload'
import type { CollectionBeforeDeleteHook, CollectionSlug } from 'payload'
import { describe, expect, it } from 'vitest'
import { preventReferencedMediaDelete } from '@/hooks/media/prevent-referenced-delete'
import { MEDIA_RELATIONS } from '@/lib/media/relating-collections'

function runHook(referencedBy: Partial<Record<CollectionSlug, number>>) {
  const args = {
    id: 7,
    req: {
      payload: {
        count: async ({ collection }: { collection: CollectionSlug }) => ({
          totalDocs: referencedBy[collection] ?? 0,
        }),
      },
    },
  } as unknown as Parameters<CollectionBeforeDeleteHook>[0]
  return preventReferencedMediaDelete(args)
}

describe('preventReferencedMediaDelete', () => {
  it('lets a file nothing points at go', async () => {
    await expect(runHook({})).resolves.toBeUndefined()
  })

  it('refuses with a public error naming the blocking collection', async () => {
    await expect(runHook({ transactions: 2 })).rejects.toBeInstanceOf(APIError)
    await expect(runHook({ transactions: 2 })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('transakcje: 2'),
    })
  })

  // Every registry entry must actually be probed — an unprobed relation is a file deletable out
  // from under a live record, which is the defect the registry exists to close.
  it.each(MEDIA_RELATIONS)('probes $collection.$field', async ({ collection, label }) => {
    await expect(runHook({ [collection]: 1 })).rejects.toMatchObject({
      message: expect.stringContaining(`${label}: 1`),
    })
  })
})
