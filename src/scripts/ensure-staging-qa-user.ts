// Idempotent find-or-upsert of the permanent staging OWNER + MANAGER + EMPLOYEE used to log in to the Vercel
// preview app for manual verification passes (see context/reference/manual-verification.md).
// Unlike seed-e2e-user.ts this deliberately targets a REMOTE db (the preview Neon branch), so the
// guard is the inverse of a localhost check: it refuses anything but the preview URL, and prod even
// if the two were ever set equal — this machine holds the prod credential too.
//
// RUN: pnpm qa:staging-user
import { pathToFileURL } from 'node:url'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

const STAGING_QA_EMAIL = process.env.STAGING_QA_EMAIL
const STAGING_QA_MANAGER_EMAIL = process.env.STAGING_QA_MANAGER_EMAIL
const STAGING_QA_WORKER_EMAIL = process.env.STAGING_QA_WORKER_EMAIL
const STAGING_QA_PASSWORD = process.env.STAGING_QA_PASSWORD

type QaUserT = { email: string; name: string; role: 'OWNER' | 'MANAGER' | 'EMPLOYEE' }

function assertPreviewDb(): void {
  const target = process.env.DB_POSTGRES_URL
  const preview = process.env.DB_POSTGRES_URL_PREVIEW
  if (!target || target !== preview || target === process.env.DB_POSTGRES_URL_PROD) {
    throw new Error(
      '[ensure-staging-qa-user] refusing: DB_POSTGRES_URL is not DB_POSTGRES_URL_PREVIEW — run it via `pnpm qa:staging-user`',
    )
  }
}

async function upsertQaUser(payload: Payload, user: QaUserT, password: string): Promise<void> {
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: user.email } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    await payload.update({
      collection: 'users',
      id: existing.docs[0].id,
      // Five failed logins lock the account, and a new password alone does not lift that.
      data: { password, role: user.role, loginAttempts: 0, lockUntil: null },
      // The Users afterChange hook calls revalidateTag, which throws outside a request
      // context (Local API script). skipRevalidation bypasses it.
      context: { skipRevalidation: true },
    })
    console.log(
      `[ensure-staging-qa-user] ${user.role} password reset for id ${existing.docs[0].id}`,
    )
    return
  }

  const created = await payload.create({
    collection: 'users',
    data: { email: user.email, password, name: user.name, role: user.role },
    context: { skipRevalidation: true },
  })
  console.log(`[ensure-staging-qa-user] created ${user.role} id ${created.id}: ${user.email}`)
}

export async function ensureStagingQaUser(): Promise<void> {
  assertPreviewDb()

  if (
    !STAGING_QA_EMAIL ||
    !STAGING_QA_MANAGER_EMAIL ||
    !STAGING_QA_WORKER_EMAIL ||
    !STAGING_QA_PASSWORD
  ) {
    throw new Error(
      '[ensure-staging-qa-user] STAGING_QA_EMAIL / STAGING_QA_MANAGER_EMAIL / STAGING_QA_WORKER_EMAIL / STAGING_QA_PASSWORD must be set in .env',
    )
  }

  const payload = await getPayload({ config })

  await upsertQaUser(
    payload,
    { email: STAGING_QA_EMAIL, name: 'Staging QA', role: 'OWNER' },
    STAGING_QA_PASSWORD,
  )
  await upsertQaUser(
    payload,
    { email: STAGING_QA_MANAGER_EMAIL, name: 'Staging QA Manager', role: 'MANAGER' },
    STAGING_QA_PASSWORD,
  )
  await upsertQaUser(
    payload,
    { email: STAGING_QA_WORKER_EMAIL, name: 'Staging QA Pracownik', role: 'EMPLOYEE' },
    STAGING_QA_PASSWORD,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  ensureStagingQaUser()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[ensure-staging-qa-user]', err)
      process.exit(1)
    })
}
