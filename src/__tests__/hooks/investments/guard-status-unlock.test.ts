import { describe, it, expect } from 'vitest'
import {
  guardInvestmentStatusUnlock,
  INVESTMENT_UNLOCK_FORBIDDEN_MESSAGE,
} from '@/hooks/investments/guard-status-unlock'
import type { RoleT } from '@/lib/auth/roles'

// The exit from `completed` is the single door the whole lock hangs on, so the matrix is role ×
// direction. Everything else about the investment record stays open on purpose — the goal is cutting
// off cash movement, not freezing the kartoteka.
function hookArgs(data: Record<string, unknown>, role: RoleT, previousStatus = 'completed') {
  return {
    data,
    req: { user: { id: 1, role } },
    originalDoc: { id: 1, name: 'Inwestycja', status: previousStatus },
    operation: 'update' as const,
    collection: undefined,
    context: {},
  } as unknown as Parameters<typeof guardInvestmentStatusUnlock>[0]
}

const call = (args: Parameters<typeof guardInvestmentStatusUnlock>[0]) =>
  guardInvestmentStatusUnlock(args)

describe('guardInvestmentStatusUnlock', () => {
  it.each(['MANAGER', 'EMPLOYEE'] as const)(
    'refuses %s reopening a completed investment',
    (role) => {
      expect(() => call(hookArgs({ status: 'active' }, role))).toThrow(
        INVESTMENT_UNLOCK_FORBIDDEN_MESSAGE,
      )
    },
  )

  it.each(['OWNER', 'ADMIN'] as const)('lets %s reopen a completed investment', (role) => {
    expect(() => call(hookArgs({ status: 'active' }, role))).not.toThrow()
  })

  it('refuses a MANAGER moving a completed investment to „planowana" too', () => {
    expect(() => call(hookArgs({ status: 'planowana' }, 'MANAGER'))).toThrow(
      INVESTMENT_UNLOCK_FORBIDDEN_MESSAGE,
    )
  })

  // Closing a settled job is a manager's work — only the way out is narrowed.
  it('lets a MANAGER close an active investment', () => {
    expect(() => call(hookArgs({ status: 'completed' }, 'MANAGER', 'active'))).not.toThrow()
  })

  // The eight kartoteka fields stay editable by everyone: a patch that never names the status is not
  // an unlock, whatever the investment's status is.
  it('lets a MANAGER edit the kartoteka of a completed investment', () => {
    expect(() =>
      call(hookArgs({ notes: 'nowa notatka', phone: '600100200' }, 'MANAGER')),
    ).not.toThrow()
  })

  it('lets a MANAGER re-save a completed investment with the same status', () => {
    expect(() => call(hookArgs({ status: 'completed', notes: 'x' }, 'MANAGER'))).not.toThrow()
  })

  it('does not touch an investment that was never completed', () => {
    expect(() => call(hookArgs({ status: 'planowana' }, 'MANAGER', 'active'))).not.toThrow()
  })
})
