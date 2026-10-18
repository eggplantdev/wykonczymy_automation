import type { Payload } from 'payload'
import type { RoleT } from '@/lib/auth/roles'
import type { CashRegister } from '@/payload-types'
import { createTestUser } from '@/__tests__/helpers/user'

type RegisterOverridesT = Partial<
  Omit<CashRegister, 'id' | 'name' | 'owner' | 'createdAt' | 'updatedAt'>
>

export async function createRegisterOwner(
  payload: Payload,
  options: { name: string; email: string; registerName: string; role?: RoleT },
  ctx: { context: Record<string, unknown> },
): Promise<{ ownerId: number; registerId: number }> {
  const ownerId = await createTestUser(payload, {
    name: options.name,
    email: options.email,
    role: options.role,
  })
  const registerId = await createTestRegister(payload, ownerId, options.registerName, {}, ctx)
  return { ownerId, registerId }
}

export async function createTestRegister(
  payload: Payload,
  ownerId: number,
  name: string,
  overrides: RegisterOverridesT = {},
  ctx: { context: Record<string, unknown> } = { context: { skipRevalidation: true } },
): Promise<number> {
  const register = await payload.create({
    collection: 'cash-registers',
    data: { name, owner: ownerId, type: 'AUXILIARY', ...overrides },
    overrideAccess: true,
    ...ctx,
  })
  return Number(register.id)
}

/** An existing scan rather than a fresh upload: creating one would push bytes to the Blob store. */
export async function findExistingMediaId(payload: Payload): Promise<number> {
  const media = await payload.find({
    collection: 'media',
    limit: 1,
    sort: 'id',
    depth: 0,
    overrideAccess: true,
  })
  const scan = media.docs[0]
  if (!scan) throw new Error('no media row in the DB to attach as a faktura')
  return Number(scan.id)
}
