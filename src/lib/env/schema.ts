import { z } from 'zod'
import isValidUrl from '@/lib/utils/is-valid-url'

// NO `import 'server-only'`, so this file is safe to import from the Payload CLI graph.

export const clientSchema = z.object({
  NEXT_PUBLIC_FRONTEND_URL: z.string().refine(isValidUrl, 'Invalid URL'),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
})

export const PROD_BLOB_STORE_ID = 'oJHLWhvHKJrsgWiN'
export const PREVIEW_BLOB_STORE_ID = 'rNjU0fDb7Sz8bHVA'

// Keyed on VERCEL_ENV, never NODE_ENV: a local `next build` sets NODE_ENV=production and would
// switch the guard off on the very machine it protects.
export const blobTokenRefusal = (
  vercelEnv: string | undefined,
  token: string | undefined,
): string | null => {
  const targets = (storeId: string) => token?.startsWith(`vercel_blob_rw_${storeId}_`) === true

  if (vercelEnv === 'production') {
    if (!targets(PREVIEW_BLOB_STORE_ID)) return null
    return (
      `targets the PREVIEW Blob store (${PREVIEW_BLOB_STORE_ID}) in production. ` +
      'That store is wiped and re-restored as scratch, so real invoices written there are lost.'
    )
  }

  if (!targets(PROD_BLOB_STORE_ID)) return null
  return (
    `targets the PRODUCTION Blob store (${PROD_BLOB_STORE_ID}) outside production. ` +
    'Use the preview store token; the production one belongs under BLOB_READ_WRITE_TOKEN_PROD.'
  )
}

function isServiceAccountJson(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed?.client_email === 'string' && typeof parsed?.private_key === 'string'
  } catch {
    return false
  }
}

export const serverSchema = z
  .object({
    DB_POSTGRES_URL: z.string().min(1),
    PAYLOAD_SECRET: z.string().min(1),
    BLOB_READ_WRITE_TOKEN: z.string().min(1),
    EMAIL_USER: z.string().min(1),
    EMAIL_PASS: z.string().min(1),
    EMAIL_HOST: z.string().min(1),
    META_APP_SECRET: z.string().min(1),
    META_APP_ID: z.string().min(1),
    META_APP_TOKEN: z.string().min(1),
    META_VERIFY_TOKEN: z.string().min(1),
    META_PAGE_ACCESS_TOKEN: z.string().min(1),
    META_PAGE_ID: z.string().min(1),
    WPFORMS_WEBHOOK_SECRET: z.string().min(1),
    // a missing allowlist must fail the boot rather than default to „allow", since the webhook fetches URLs a
    // stranger chose.
    LANDING_WEBHOOK_SECRET: z.string().min(1),
    LANDING_BLOB_HOST: z.string().min(1),
    LANDING_CLEANUP_URL: z.url().optional(),
    LEADS_REPLY_FROM: z.string().min(1),
    GOOGLE_SERVICE_ACCOUNT_JSON: z
      .string()
      .min(1, 'GOOGLE_SERVICE_ACCOUNT_JSON is required')
      .refine(
        isServiceAccountJson,
        'GOOGLE_SERVICE_ACCOUNT_JSON must be valid JSON with client_email and private_key',
      ),
    // Optional because every other environment is MEANT to lack it — absence is the gate, not a
    // misconfiguration.
    GOOGLE_SERVICE_ACCOUNT_WRITE_JSON: z
      .string()
      .optional()
      .refine(
        (raw) => raw === undefined || isServiceAccountJson(raw),
        'GOOGLE_SERVICE_ACCOUNT_WRITE_JSON must be valid JSON with client_email and private_key',
      ),
    KOSZTORYS_TEMPLATE_SHEET_ID: z.string().min(1, 'KOSZTORYS_TEMPLATE_SHEET_ID is required'),
    KOSZTORYS_DRIVE_FOLDER_ID: z.string().optional(),
    OPENROUTER_API_KEY: z.string().min(1),
    OPENROUTER_HTTP_REFERER: z.string().optional(),
    OPENROUTER_APP_NAME: z.string().optional(),
    VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
    VERCEL_DEPLOYMENT_ID: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(1),
    // Absence is the gate: never put this pair in `.env`.
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    const refusal = blobTokenRefusal(env.VERCEL_ENV, env.BLOB_READ_WRITE_TOKEN)
    if (refusal) ctx.addIssue({ code: 'custom', path: ['BLOB_READ_WRITE_TOKEN'], message: refusal })

    if (env.VERCEL_ENV === 'production' && env.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_SERVICE_ACCOUNT_WRITE_JSON'],
        message:
          'GOOGLE_SERVICE_ACCOUNT_WRITE_JSON is required in production — without it Google Sheets ' +
          'sync fails silently on every transfer. Set the Editor service-account JSON on Vercel Production.',
      })
    }

    // Not on `development`: that is what `vercel env pull` writes into a laptop's `.env.local`.
    const isDeployment = env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview'
    if (isDeployment && env.VERCEL_DEPLOYMENT_ID === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['VERCEL_DEPLOYMENT_ID'],
        message:
          'VERCEL_DEPLOYMENT_ID is required on Vercel — enable "Automatically expose System Environment Variables".',
      })
    }

    if (env.VERCEL_ENV === 'production') {
      for (const key of ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'] as const) {
        if (env[key] !== undefined) continue
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required in production — without it no push notification is sent.`,
        })
      }
    }
  })
