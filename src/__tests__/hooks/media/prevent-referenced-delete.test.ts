import { APIError } from 'payload'
import type { CollectionBeforeDeleteHook, CollectionSlug } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { preventReferencedMediaDelete } from '@/hooks/media/prevent-referenced-delete'
import { MEDIA_RELATIONS, RAW_MEDIA_HOLDERS } from '@/lib/media/relating-collections'

const rawHolders = vi.hoisted(() => new Map<string, number>())
vi.mock('@/lib/db/get-db', () => ({ getDb: async () => ({}) }))
vi.mock('@/lib/db/media-detachments', () => ({
  countMediaHolders: async (_db: unknown, table: string) => rawHolders.get(table) ?? 0,
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

  it.each(MEDIA_RELATIONS)('probes $collection.$field', async ({ collection, label }) => {
    await expect(runHook({ [collection]: 1 })).rejects.toMatchObject({
      message: expect.stringContaining(`${label}: 1`),
    })
  })

  it.each(RAW_MEDIA_HOLDERS)('probes the raw $table table', async ({ table, label }) => {
    rawHolders.set(table, 1)
    try {
      await expect(runHook({})).rejects.toMatchObject({
        message: expect.stringContaining(`${label}: 1`),
      })
    } finally {
      rawHolders.delete(table)
    }
  })
})
