import { describe, it, expect } from 'vitest'
import { removalRefusal } from '@/lib/workers/account-removal'
import { SELF_REMOVAL_MESSAGE } from '@/lib/constants/worker-lock'

const subject = (
  role: 'ADMIN' | 'OWNER' | 'MANAGER' | 'EMPLOYEE',
  otherLiveOfRole: number,
  isTrashed = false,
) => ({ role, otherLiveOfRole, isTrashed })

describe('removalRefusal', () => {
  it('refuses removing your own account, even with other owners left', () => {
    expect(removalRefusal(subject('OWNER', 3), { isSelf: true })).toBe(SELF_REMOVAL_MESSAGE)
  })

  it.each(['OWNER', 'ADMIN'] as const)('refuses the last live %s', (role) => {
    expect(removalRefusal(subject(role, 0), { isSelf: false })).toMatch(/ostatniego aktywnego/)
  })

  it('allows an OWNER while another live one remains', () => {
    expect(removalRefusal(subject('OWNER', 1), { isSelf: false })).toBeUndefined()
  })

  // A trashed account already counts as gone, so deleting it for good takes nobody out of the count.
  it('allows deleting a trashed last OWNER', () => {
    expect(removalRefusal(subject('OWNER', 0, true), { isSelf: false })).toBeUndefined()
  })

  it.each(['MANAGER', 'EMPLOYEE'] as const)('never guards the last %s', (role) => {
    expect(removalRefusal(subject(role, 0), { isSelf: false })).toBeUndefined()
  })
})
