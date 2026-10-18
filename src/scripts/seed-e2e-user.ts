import { pathToFileURL } from 'node:url'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { assertLocalDb } from '@/scripts/assert-local-db'
import { E2E_OWNER } from '@/scripts/e2e-user-credentials'

export async function seedE2eUser(payload: Payload): Promise<number> {
  assertLocalDb('seed-e2e-user')

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: E2E_OWNER.email } },
    limit: 1,
  })

  const [found] = existing.docs
  if (found) {
    console.log(`[seed-e2e-user] user already exists: ${E2E_OWNER.email}`)
    return found.id
  }

  const created = await payload.create({
    collection: 'users',
    data: {
      ...E2E_OWNER,
      name: 'E2E User',
      role: 'OWNER',
    },
    // The Users afterChange hook calls revalidateTag, which throws outside a request
    // context (Local API script / global-setup).
    context: { skipRevalidation: true },
  })
  console.log(`[seed-e2e-user] created OWNER: ${E2E_OWNER.email}`)
  return created.id
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  getPayload({ config })
    .then(seedE2eUser)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed-e2e-user]', err)
      process.exit(1)
    })
}
