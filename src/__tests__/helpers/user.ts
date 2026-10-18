import type { Payload } from 'payload'
import type { RoleT } from '@/lib/auth/roles'

// The email must end in `@test.local`, or `purgeFixtureUsers` never removes the account.
export async function createTestUser(
  payload: Payload,
  {
    email,
    name = email,
    role = 'EMPLOYEE',
    password = 'test-password-123',
  }: { email: string; name?: string; role?: RoleT; password?: string },
): Promise<number> {
  const user = await payload.create({
    collection: 'users',
    data: { name, role, email, password },
    overrideAccess: true,
    context: { skipRevalidation: true },
  })
  return Number(user.id)
}
