import { describe, it, expect } from 'vitest'
import type { Access, PayloadRequest } from 'payload'
import { Media } from '@/collections/media'
import { isAdminOrOwnerOrManagerBoolean } from '@/access'
import { ROLES, type RoleT } from '@/lib/auth/roles'

// Client uploads moved the gate off a Route Handler's `requireAuth(MANAGEMENT_ROLES)` onto two
// Payload-side checks: the token route that lets the browser write one blob key, and the create
// access on the row it then asks for. Both have to refuse EMPLOYEE — a token handed out too widely
// buys write access to the store with no row to show for it, and neither failure is loud.

const asRequest = (role: RoleT): PayloadRequest =>
  ({ user: { id: 1, role } }) as unknown as PayloadRequest

const createAccess = Media.access?.create as Access

describe.each(ROLES)('media upload gates — %s', (role) => {
  const allowed = role !== 'EMPLOYEE'

  it(`row creation is ${allowed ? 'allowed' : 'refused'}`, () => {
    expect(createAccess({ req: asRequest(role) })).toBe(allowed)
  })

  it(`blob write token is ${allowed ? 'allowed' : 'refused'}`, () => {
    expect(isAdminOrOwnerOrManagerBoolean({ req: asRequest(role) })).toBe(allowed)
  })
})
