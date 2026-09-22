import { describe, expect, it } from 'vitest'

import {
  PREVIEW_BLOB_STORE_ID,
  PROD_BLOB_STORE_ID,
  blobTokenRefusal,
  serverSchema,
} from '@/lib/env/schema'

// Literal, NOT derived from the constants under test: a token built from them asserts only that the
// guard agrees with itself, so a typo'd or rotated id would leave the whole suite green with a dead
// guard. This is the one place the real store ids are pinned.
const PROD_TOKEN = 'vercel_blob_rw_oJHLWhvHKJrsgWiN_aaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const PREVIEW_TOKEN = 'vercel_blob_rw_rNjU0fDb7Sz8bHVA_bbbbbbbbbbbbbbbbbbbbbbbbbbbb'

// Everything the schema demands apart from the field under test, so a failure names the guard
// rather than an unrelated missing var.
const baseEnv = {
  DB_POSTGRES_URL: 'postgres://user:pass@localhost:5433/db',
  PAYLOAD_SECRET: 'secret',
  BLOB_READ_WRITE_TOKEN: PREVIEW_TOKEN,
  EMAIL_USER: 'user',
  EMAIL_PASS: 'pass',
  EMAIL_HOST: 'smtp.example.com',
  META_APP_SECRET: 'x',
  META_APP_ID: 'x',
  META_APP_TOKEN: 'x',
  META_VERIFY_TOKEN: 'x',
  META_PAGE_ACCESS_TOKEN: 'x',
  META_PAGE_ID: 'x',
  WPFORMS_WEBHOOK_SECRET: 'x',
  LANDING_WEBHOOK_SECRET: 'x',
  LANDING_BLOB_HOST: 'landing-assets.public.blob.vercel-storage.com',
  LEADS_REPLY_FROM: 'reply@example.com',
  GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: 'sa@example.iam.gserviceaccount.com',
    private_key: 'key',
  }),
  KOSZTORYS_TEMPLATE_SHEET_ID: 'sheet-id',
  OPENROUTER_API_KEY: 'x',
  CRON_SECRET: 'x',
}

const WRITER_JSON = JSON.stringify({
  client_email: 'writer@example.iam.gserviceaccount.com',
  private_key: 'key',
})

// Production carries the Editor credential, so a spec about anything ELSE in production has to
// carry it too — otherwise it fails on the guard below instead of on its own subject.
const productionEnv = {
  ...baseEnv,
  VERCEL_ENV: 'production',
  GOOGLE_SERVICE_ACCOUNT_WRITE_JSON: WRITER_JSON,
}

describe('serverSchema — production Blob token guard', () => {
  it('accepts the production store token in production', () => {
    const result = serverSchema.safeParse({ ...productionEnv, BLOB_READ_WRITE_TOKEN: PROD_TOKEN })

    expect(result.success).toBe(true)
  })

  it('rejects the production store token when VERCEL_ENV is absent (local dev)', () => {
    const result = serverSchema.safeParse({ ...baseEnv, BLOB_READ_WRITE_TOKEN: PROD_TOKEN })

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(
      'BLOB_READ_WRITE_TOKEN',
    )
  })

  it('rejects the production store token on preview', () => {
    const result = serverSchema.safeParse({
      ...baseEnv,
      BLOB_READ_WRITE_TOKEN: PROD_TOKEN,
      VERCEL_ENV: 'preview',
    })

    expect(result.success).toBe(false)
  })

  it('accepts the preview store token outside production', () => {
    const result = serverSchema.safeParse(baseEnv)

    expect(result.success).toBe(true)
  })

  it('rejects the preview store token in production', () => {
    const result = serverSchema.safeParse(productionEnv)

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(
      'BLOB_READ_WRITE_TOKEN',
    )
  })

  it('pins the store ids the guard compares against', () => {
    expect(PROD_BLOB_STORE_ID).toBe('oJHLWhvHKJrsgWiN')
    expect(PREVIEW_BLOB_STORE_ID).toBe('rNjU0fDb7Sz8bHVA')
  })

  // zod v3 skipped a whole-object refinement once any field failed; v4 still runs it for a present
  // but invalid string. Asserted because a future major flipping back would crash the boot instead
  // of reporting the missing var.
  it('reports the missing token without the guard throwing', () => {
    const result = serverSchema.safeParse({ ...baseEnv, BLOB_READ_WRITE_TOKEN: '' })

    expect(result.success).toBe(false)
  })
})

// The predicate `payload.config.ts` shares with the schema above — covered directly, because that
// call site parses no schema and is the one guarding the /admin delete path.
describe('blobTokenRefusal', () => {
  it('refuses the production store token outside production', () => {
    expect(blobTokenRefusal(undefined, PROD_TOKEN)).toContain(PROD_BLOB_STORE_ID)
    expect(blobTokenRefusal('preview', PROD_TOKEN)).toContain(PROD_BLOB_STORE_ID)
    expect(blobTokenRefusal('development', PROD_TOKEN)).toContain(PROD_BLOB_STORE_ID)
  })

  it('refuses the preview store token in production', () => {
    expect(blobTokenRefusal('production', PREVIEW_TOKEN)).toContain(PREVIEW_BLOB_STORE_ID)
  })

  it('allows each store token in the environment it belongs to', () => {
    expect(blobTokenRefusal('production', PROD_TOKEN)).toBeNull()
    expect(blobTokenRefusal(undefined, PREVIEW_TOKEN)).toBeNull()
  })

  // Deliberately permissive on both sides: rotating a store must never refuse a production boot
  // because a constant here went stale.
  it('allows an unrecognised store, a malformed token and undefined in every environment', () => {
    const other = 'vercel_blob_rw_zzzzzzzzzzzzzzzz_cccccccccccccccccccccccccccc'

    expect(blobTokenRefusal('production', other)).toBeNull()
    expect(blobTokenRefusal(undefined, other)).toBeNull()
    expect(blobTokenRefusal(undefined, PROD_BLOB_STORE_ID)).toBeNull()
    expect(blobTokenRefusal('production', undefined)).toBeNull()
    expect(blobTokenRefusal(undefined, undefined)).toBeNull()
  })
})

// The Editor credential exists only in Vercel Production, which is also the only environment that
// writes to a sheet — so a malformed value has the fewest eyes on it and the longest silence: it
// passes boot and dies inside a deferred write that sheets-sync swallows as non-fatal.
describe('serverSchema — Editor service-account credential', () => {
  it('accepts its absence, which is every environment but production', () => {
    const result = serverSchema.safeParse(baseEnv)
    expect(result.success).toBe(true)
  })

  it('accepts a credential carrying client_email and private_key', () => {
    const result = serverSchema.safeParse({
      ...baseEnv,
      GOOGLE_SERVICE_ACCOUNT_WRITE_JSON: WRITER_JSON,
    })
    expect(result.success).toBe(true)
  })

  it('refuses a value that is not JSON', () => {
    const result = serverSchema.safeParse({
      ...baseEnv,
      GOOGLE_SERVICE_ACCOUNT_WRITE_JSON: '{"client_email": truncated',
    })
    expect(result.success).toBe(false)
  })

  it('refuses JSON missing the private key', () => {
    const result = serverSchema.safeParse({
      ...baseEnv,
      GOOGLE_SERVICE_ACCOUNT_WRITE_JSON: JSON.stringify({
        client_email: 'writer@example.iam.gserviceaccount.com',
      }),
    })
    expect(result.success).toBe(false)
  })

  // Optional everywhere, mandatory in production: deleting the var there breaks no request, it just
  // stops every transfer from reaching the owner's sheet — sheets-sync defers the write and swallows
  // the throw. Boot is the last place the loss is still visible.
  it('refuses its absence in production', () => {
    const { GOOGLE_SERVICE_ACCOUNT_WRITE_JSON: _absent, ...withoutWriter } = productionEnv
    const result = serverSchema.safeParse({ ...withoutWriter, BLOB_READ_WRITE_TOKEN: PROD_TOKEN })

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(
      'GOOGLE_SERVICE_ACCOUNT_WRITE_JSON',
    )
  })

  it('does not demand it on preview, where its absence IS the write gate', () => {
    const result = serverSchema.safeParse({ ...baseEnv, VERCEL_ENV: 'preview' })

    expect(result.success).toBe(true)
  })
})
