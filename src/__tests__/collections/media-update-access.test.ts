import { describe, it, expect } from 'vitest'
import type { Access, PayloadRequest } from 'payload'
import { Media } from '@/collections/media'
import { ROLES, type RoleT } from '@/lib/auth/roles'

// Marking a rzut is a MANAGER's job as much as an OWNER's — they are the ones handling the files —
// so `update` was loosened off `isAdminOrOwner`. `delete` was deliberately NOT: an invoice is
// tax-retained and Blob has no undelete.

const asRequest = (role: RoleT): PayloadRequest =>
  ({ user: { id: 1, role } }) as unknown as PayloadRequest

const updateAccess = Media.access?.update as Access
const deleteAccess = Media.access?.delete as Access

describe.each(ROLES)('media row access — %s', (role) => {
  const canUpdate = role !== 'EMPLOYEE'
  const canDelete = role === 'ADMIN' || role === 'OWNER'

  it(`update is ${canUpdate ? 'allowed' : 'refused'}`, () => {
    expect(updateAccess({ req: asRequest(role) })).toBe(canUpdate)
  })

  it(`delete is ${canDelete ? 'allowed' : 'refused'}`, () => {
    expect(deleteAccess({ req: asRequest(role) })).toBe(canDelete)
  })
})
