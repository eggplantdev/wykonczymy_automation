import type { Payload } from 'payload'

/**
 * The owner + cash register every transfer fixture needs: `transactions.sourceRegister` points at a
 * register and `cash_registers.owner_id` is NOT NULL, so neither can be skipped to get one row in.
 *
 * The email lands in the `@test.local` namespace `purgeFixtureUsers` sweeps, which is what makes a
 * crashed run restartable — both the email and the register name are unique.
 */
export async function createRegisterOwner(
  payload: Payload,
  options: { name: string; email: string; registerName: string },
  ctx: { context: Record<string, unknown> },
): Promise<{ ownerId: number; registerId: number }> {
  const owner = await payload.create({
    collection: 'users',
    data: {
      name: options.name,
      role: 'EMPLOYEE',
      email: options.email,
      password: 'test-password-123',
    },
    ...ctx,
  })
  const ownerId = Number(owner.id)

  const register = await payload.create({
    collection: 'cash-registers',
    data: { name: options.registerName, owner: ownerId, type: 'AUXILIARY' },
    ...ctx,
  })

  return { ownerId, registerId: Number(register.id) }
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
