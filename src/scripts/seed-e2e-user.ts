// Idempotent find-or-create of the OWNER user the E2E suite logs in as. Callable both
// as a module (global-setup imports seedE2eUser) and standalone (`pnpm seed:e2e`).
//
// RUN: node --env-file=.env --import tsx src/scripts/seed-e2e-user.ts
//
// SAFETY: hits whatever DB DB_POSTGRES_URL points at — standalone runs the dev docker (5433),
// global-setup overrides it to the 5435 test DB. Local only, never prod.
import { pathToFileURL } from 'node:url'
import { getPayload } from 'payload'
import config from '@payload-config'
import { E2E_EMAIL, E2E_PASSWORD } from '@/scripts/e2e-user-credentials'

// Hard stop before creating a known-password OWNER against a non-local DB. A committed
// plaintext password landing in a remote/prod DB is the exact accident this prevents; the
// SAFETY comment above is not enough on its own.
function assertLocalDb(): void {
  const url = process.env.DB_POSTGRES_URL ?? ''
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    host = ''
  }
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(
      `[seed-e2e-user] refusing to seed: DB_POSTGRES_URL host "${host}" is not localhost. ` +
        'This creates a known-password OWNER and must only run against the local dev/test DB.',
    )
  }
}

export async function seedE2eUser(): Promise<void> {
  assertLocalDb()
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
