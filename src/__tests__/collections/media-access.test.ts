import { describe, it, expect } from 'vitest'
import type { Access, PayloadRequest } from 'payload'
import { Media } from '@/collections/media'
import { isAuthenticatedBoolean } from '@/access'
import { ROLES, type RoleT } from '@/lib/auth/roles'

// Client uploads gate on two Payload-side checks: the token route that lets the browser write one
// blob key, and the create access on the row it then asks for. The two must agree — a token handed
// out wider than the row gate buys write access to the store with no row to show for it, and
// neither failure is loud. Every role passes both since an EMPLOYEE's expense draft carries receipt
// photos (EX-971).
//
// `update` and `delete` stay on `isAdminOrOwner` even though marking a rzut is a MANAGER's job:
// `setMediaKindAction` writes with `overrideAccess: true`, so the collection rule buys the feature
// nothing, while opening it would hand MANAGER the `/admin` file swap — and a swap runs the storage
// plugin's `handleDelete` over the old bytes, i.e. destroys a tax-retained faktura that Blob cannot
// undelete.

const asRequest = (role: RoleT): PayloadRequest =>
  ({ user: { id: 1, role } }) as unknown as PayloadRequest

const createAccess = Media.access?.create as Access
const updateAccess = Media.access?.update as Access
const deleteAccess = Media.access?.delete as Access

describe.each(ROLES)('media access — %s', (role) => {
  const canWriteRow = role === 'ADMIN' || role === 'OWNER'

  it('row creation is allowed', () => {
    expect(createAccess({ req: asRequest(role) })).toBe(true)
  })

  it('blob write token is allowed', () => {
    expect(isAuthenticatedBoolean({ req: asRequest(role) })).toBe(true)
  })

  it(`update is ${canWriteRow ? 'allowed' : 'refused'}`, () => {
    expect(updateAccess({ req: asRequest(role) })).toBe(canWriteRow)
  })

  it(`delete is ${canWriteRow ? 'allowed' : 'refused'}`, () => {
    expect(deleteAccess({ req: asRequest(role) })).toBe(canWriteRow)
  })
})
