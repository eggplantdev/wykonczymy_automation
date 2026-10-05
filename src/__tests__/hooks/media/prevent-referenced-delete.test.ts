import { APIError } from 'payload'
import type { CollectionBeforeDeleteHook, CollectionSlug } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { preventReferencedMediaDelete } from '@/hooks/media/prevent-referenced-delete'
import { MEDIA_RELATIONS } from '@/lib/media/relating-collections'

// The raw-table probes, held by tables Payload has no collection for.
const rawHolders = vi.hoisted(() => ({ drafts: 0, reports: 0 }))
vi.mock('@/lib/db/get-db', () => ({ getDb: async () => ({}) }))
vi.mock('@/lib/db/worker-expense-drafts', () => ({
  countDraftsHoldingMedia: async () => rawHolders.drafts,
}))
vi.mock('@/lib/db/worker-reports', () => ({
  countReportsHoldingMedia: async () => rawHolders.reports,
}))

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

  it.each([
    ['drafts', 'zgłoszenia wydatków'],
    ['reports', 'zgłoszenia prac'],
  ] as const)('probes the raw %s table', async (holder, label) => {
    rawHolders[holder] = 1
    try {
      await expect(runHook({})).rejects.toMatchObject({
        message: expect.stringContaining(`${label}: 1`),
      })
    } finally {
      rawHolders[holder] = 0
    }
  })
})
