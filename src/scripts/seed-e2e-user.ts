// Idempotent find-or-create of the OWNER user the E2E suite logs in as. Callable both
// as a module (global-setup imports seedE2eUser) and standalone (`pnpm seed:e2e`).
//
// RUN: node --env-file=.env --import tsx src/scripts/seed-e2e-user.ts
//
// SAFETY: hits whatever DB DB_POSTGRES_URL points at — local docker (5433) only, never prod.
import { pathToFileURL } from 'node:url'
import { getPayload } from 'payload'
import config from '@payload-config'
import { E2E_EMAIL, E2E_PASSWORD } from '@/scripts/e2e-user-credentials'

export async function seedE2eUser(): Promise<void> {
  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: E2E_EMAIL } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log(`[seed-e2e-user] user already exists: ${E2E_EMAIL}`)
    return
  }

  await payload.create({
    collection: 'users',
    data: {
      email: E2E_EMAIL,
      password: E2E_PASSWORD,
      name: 'E2E User',
      role: 'OWNER',
    },
    // The Users afterChange hook calls revalidateTag, which throws outside a request
    // context (Local API script / global-setup). skipRevalidation bypasses it.
    context: { skipRevalidation: true },
  })
  console.log(`[seed-e2e-user] created OWNER: ${E2E_EMAIL}`)
}

// Only run the CLI flow when executed directly, so importing from global-setup is side-effect free.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedE2eUser()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed-e2e-user]', err)
      process.exit(1)
    })
}
