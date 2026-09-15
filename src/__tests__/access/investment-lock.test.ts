import { describe, it, expect } from 'vitest'
import {
  unlessInvestmentLocked,
  createUnlessInvestmentLocked,
  updateUnlessInvestmentLocked,
} from '@/access/investment-lock'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'

// The panel is the one write path the action wrapper never sees, so this gate IS the lock for
// `/admin`. Both factories fail OPEN by design where the target can't be named — the cases below
// pin which „can't be named" are deliberate (a create that would fail required-field validation
// anyway) and which are not (a relationship arriving as a string id).
const LOCKED_ID = 99

const req = (item?: { investment: unknown }) =>
  ({
    user: { id: 1, role: 'MANAGER' },
    payload: {
      findByID: async () => {
        if (!item) throw new Error('NotFound')
        return item
      },
      db: {
        drizzle: {
          execute: async (query: { queryChunks?: unknown[] }) => {
            const id = (query.queryChunks ?? []).find((chunk) => typeof chunk === 'number')
            return { rows: [{ status: id === LOCKED_ID ? 'completed' : 'active' }] }
          },
        },
      },
    },
  }) as never

const args = (data?: Record<string, unknown>, item?: { investment: unknown }) =>
  ({ req: req(item), data }) as never

describe('unlessInvestmentLocked', () => {
  it('narrows a management role to the investments that are still open', async () => {
    expect(await unlessInvestmentLocked(isAdminOrOwnerOrManager, 'investment')(args())).toEqual({
      'investment.status': { not_equals: 'completed' },
    })
  })

  it('reaches a stage-progress row through its pozycja', async () => {
    expect(await unlessInvestmentLocked(isAdminOrOwnerOrManager, 'item')(args())).toEqual({
      'item.investment.status': { not_equals: 'completed' },
    })
  })

  // Guards the trap the factory's own comment names.
  it('narrows by the role rule it was given, not by a wired-in one', async () => {
    const managerArgs = { req: { user: { id: 1, role: 'MANAGER' } } } as never
    expect(await unlessInvestmentLocked(isAdminOrOwner, 'investment')(managerArgs)).toBe(false)
    expect(
      await unlessInvestmentLocked(isAdminOrOwnerOrManager, 'investment')(managerArgs),
    ).toEqual({
      'investment.status': { not_equals: 'completed' },
    })
  })

  it('refuses a role that has no business here at all, without a query', async () => {
    const denied = await unlessInvestmentLocked(
      isAdminOrOwnerOrManager,
      'investment',
    )({
      req: { user: { id: 1, role: 'EMPLOYEE' } },
    } as never)
    expect(denied).toBe(false)
  })
})

describe('updateUnlessInvestmentLocked', () => {
  const gate = updateUnlessInvestmentLocked(isAdminOrOwnerOrManager, 'investment')

  // A `Where` speaks only about the row as it is STORED, so on its own it guards one direction.
  // The other one — aiming an open row AT a locked investment — is a trap door: once the row lands
  // there, the same `Where` locks it in and only SQL gets it out.
  it('refuses an update that re-points the row at a locked investment', async () => {
    expect(await gate(args({ investment: LOCKED_ID }))).toBe(false)
  })

  it('still narrows by the stored row when the payload names an open investment', async () => {
    expect(await gate(args({ investment: 7 }))).toEqual({
      'investment.status': { not_equals: 'completed' },
    })
  })

  // A patch that does not touch the relationship leaves the direction unasked — the stored-row
  // `Where` is the whole gate then.
  it('falls back to the stored-row narrowing when the payload names no investment', async () => {
    expect(await gate(args({ name: 'renamed' }))).toEqual({
      'investment.status': { not_equals: 'completed' },
    })
  })

  it('refuses a role that has no business here without consulting the payload', async () => {
    const gateForOwners = updateUnlessInvestmentLocked(isAdminOrOwner, 'investment')
    expect(await gateForOwners(args({ investment: 7 }))).toBe(false)
  })
})

describe('createUnlessInvestmentLocked', () => {
  const direct = createUnlessInvestmentLocked(isAdminOrOwnerOrManager, 'investment')
  const viaItem = createUnlessInvestmentLocked(isAdminOrOwnerOrManager, 'item')

  it('refuses a create aimed straight at a locked investment', async () => {
    expect(await direct(args({ investment: LOCKED_ID }))).toBe(false)
  })

  it('reads a relationship sent as a string id', async () => {
    expect(await direct(args({ investment: String(LOCKED_ID) }))).toBe(false)
  })

  it('allows a create on an open investment', async () => {
    expect(await direct(args({ investment: 7 }))).toBe(true)
  })

  // Refusing here would replace the required-relationship error with a misleading one.
  it('waves through a payload that names no investment at all', async () => {
    expect(await direct(args({}))).toBe(true)
  })

  it('refuses a stage-progress create whose pozycja sits on a locked investment', async () => {
    expect(await viaItem(args({ item: 3 }, { investment: LOCKED_ID }))).toBe(false)
  })

  it('allows a stage-progress create whose pozycja sits on an open investment', async () => {
    expect(await viaItem(args({ item: 3 }, { investment: 7 }))).toBe(true)
  })

  // A parent the lookup cannot see is not this gate's error to raise — and it must not become a 500.
  it('waves through a pozycja that cannot be read instead of throwing', async () => {
    expect(await viaItem(args({ item: 3 }))).toBe(true)
  })
})
