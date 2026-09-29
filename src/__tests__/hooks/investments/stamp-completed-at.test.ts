import { describe, it, expect, vi, afterEach } from 'vitest'
import type { CollectionBeforeChangeHook } from 'payload'
import { Investments } from '@/collections/investments'
import { INVESTMENT_UNLOCK_FORBIDDEN_MESSAGE } from '@/hooks/investments/guard-status-unlock'
import type { RoleT } from '@/lib/auth/roles'

const NOW = new Date('2026-09-28T10:00:00.000Z')
const EARLIER = '2026-01-15T08:00:00.000Z'

// Through the collection's own beforeChange array, so a refused unlock aborts the save the way Payload
// does — the stamp's cleared date never reaches the row.
async function save(
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown> | undefined,
  role: RoleT = 'OWNER',
) {
  let current = data
  for (const hook of Investments.hooks?.beforeChange ?? []) {
    const args = {
      data: current,
      req: { user: { id: 1, role } },
      originalDoc,
      operation: originalDoc ? 'update' : 'create',
      collection: undefined,
      context: {},
    } as unknown as Parameters<CollectionBeforeChangeHook>[0]
    current = (await hook(args)) ?? current
  }
  return current
}

describe('stampCompletedAt', () => {
  afterEach(() => vi.useRealTimers())

  const at = () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  }

  it('stamps the moment an active investment is completed', async () => {
    at()
    const result = await save({ status: 'completed' }, { status: 'active' })
    expect(result.completedAt).toBe(NOW.toISOString())
  })

  it('stamps a create that is completed from the start', async () => {
    at()
    const result = await save({ name: 'Nowa', status: 'completed' }, undefined)
    expect(result.completedAt).toBe(NOW.toISOString())
  })

  it.each(['active', 'planowana', 'quote'])(
    'clears the date when reopened to %s',
    async (status) => {
      const result = await save({ status }, { status: 'completed', completedAt: EARLIER })
      expect(result.completedAt).toBeNull()
    },
  )

  // Otherwise every address fix on a closed job would push its history's deletion a year out.
  it('leaves the date alone when a completed investment is re-saved as completed', async () => {
    const result = await save(
      { status: 'completed', completedAt: EARLIER, notes: 'x' },
      { status: 'completed', completedAt: EARLIER },
    )
    expect(result.completedAt).toBe(EARLIER)
  })

  it('leaves the date alone on a write that does not name the status', async () => {
    const result = await save({ notes: 'x' }, { status: 'completed', completedAt: EARLIER })
    expect(result).not.toHaveProperty('completedAt')
  })

  it('does not stamp a move between two open statuses', async () => {
    const result = await save({ status: 'active' }, { status: 'planowana' })
    expect(result).not.toHaveProperty('completedAt')
  })

  it('a refused unlock throws before the date is cleared', async () => {
    const data = { status: 'active', completedAt: EARLIER }
    await expect(
      save(data, { status: 'completed', completedAt: EARLIER }, 'MANAGER'),
    ).rejects.toThrow(INVESTMENT_UNLOCK_FORBIDDEN_MESSAGE)
    expect(data.completedAt).toBe(EARLIER)
  })
})
