import { APIError } from 'payload'
import type { CollectionBeforeDeleteHook, Where } from 'payload'
import { describe, expect, it } from 'vitest'
import { makePreventDelete } from '@/hooks/prevent-delete'

// Asserts the error is publicly renderable, not merely that a throw happened — a plain `Error`
// passes „did it throw" and still reaches the admin toast as „Something went wrong.".

function runHook(totalDocs: number) {
  const args = {
    id: 7,
    req: { payload: { count: async () => ({ totalDocs }) } },
  } as unknown as Parameters<CollectionBeforeDeleteHook>[0]
  return hook(args)
}

const hook = makePreventDelete({
  probes: [
    {
      collection: 'transactions',
      where: (id): Where => ({ sourceRegister: { equals: id } }),
      label: 'transakcje',
    },
  ],
  message: (blockers) => `Nie można usunąć kasy (${blockers.join(', ')}).`,
})

describe('makePreventDelete', () => {
  it('throws a public APIError naming the counts when a reference exists', async () => {
    await expect(runHook(5)).rejects.toBeInstanceOf(APIError)
    await expect(runHook(5)).rejects.toMatchObject({
      status: 400,
      message: 'Nie można usunąć kasy (transakcje: 5).',
    })
  })

  it('lets the delete through when nothing references the row', async () => {
    await expect(runHook(0)).resolves.toBeUndefined()
  })
})
