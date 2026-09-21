import { z } from 'zod'
import isValidUrl from '@/lib/utils/is-valid-url'

// Pure schemas — NO side effects and NO `import 'server-only'`, so this file is safe to
// import from both env entries (env/index.ts / env/server.ts) and from the Payload CLI graph.
// Hard rule: every var is required (no `.default()`) so a missing one fails the build gate;

export const clientSchema = z.object({
  // Public (inlined into the browser bundle) — read via statically-keyed object in env.ts.
  NEXT_PUBLIC_FRONTEND_URL: z.string().refine(isValidUrl, 'Invalid URL'),
})

// The two Blob stores' ids, which a token carries verbatim (`vercel_blob_rw_<STORE_ID>_…`).
// Not secrets — each is also its store's public CDN hostname.
export const PROD_BLOB_STORE_ID = 'oJHLWhvHKJrsgWiN'
export const PREVIEW_BLOB_STORE_ID = 'rNjU0fDb7Sz8bHVA'

// Local dev runs against a restored prod dump, so `media.filename` values are the REAL invoice
// keys — a delete on localhost against the production store destroys a tax-retained faktura, and
// Blob has no undelete. Non-production therefore reads and writes the preview store only; the
// production token stays reachable to the backup scripts as BLOB_READ_WRITE_TOKEN_PROD.
// Keyed on VERCEL_ENV, never NODE_ENV: a local `next build` sets NODE_ENV=production and would
// switch the guard off on the very machine it protects.
//
// Both directions are refused, because both destroy data. The preview store is periodically wiped
// and re-restored as scratch, so a production deploy pointed at it writes real client invoices into
// a store nobody treats as durable — a slower loss than a stray del(), not a smaller one.
// Deliberately NOT an allow-list: an unrecognised store id passes, so rotating either store can
// never refuse a production boot on the strength of a stale constant here.
//
// One function, because two call sites enforce this: `serverSchema` below, and `payload.config.ts`
// — the file that hands the token to the Blob plugin whose handleDelete calls del(), which cannot
// import `env/server` (`server-only` throws under the Payload CLI) and whose graph parses no
// schema, so without its own check the /admin delete path would reach the store unvalidated.
// Returns the refusal text, or null when the pairing is allowed.
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
    // Meta
    META_APP_SECRET: z.string().min(1),
    META_APP_ID: z.string().min(1),
    META_APP_TOKEN: z.string().min(1),
    META_VERIFY_TOKEN: z.string().min(1),
    META_PAGE_ACCESS_TOKEN: z.string().min(1),
    META_PAGE_ID: z.string().min(1),
    WPFORMS_WEBHOOK_SECRET: z.string().min(1),
    // Landing (`landing_26`) intake. Both required: a missing host allowlist must fail the boot
    // rather than default to „allow", since the webhook fetches URLs a stranger chose. The host
    // differs between preview and production — pointing production at the preview store's host
    // would make every real submission's photos unfetchable.
    LANDING_WEBHOOK_SECRET: z.string().min(1),
    LANDING_BLOB_HOST: z.string().min(1),
    // A *from*-address is not a recipient: it is infrastructure the SMTP account has to match, so it
    // stays in env while the recipient lists live in the `notification-recipients` global.
    LEADS_REPLY_FROM: z.string().min(1),
    // Google (Sheets + Drive for kosztorys integration)
    GOOGLE_SERVICE_ACCOUNT_JSON: z
      .string()
      .min(1, 'GOOGLE_SERVICE_ACCOUNT_JSON is required')
      .refine(
        isServiceAccountJson,
        'GOOGLE_SERVICE_ACCOUNT_JSON must be valid JSON with client_email and private_key',
      ),
    // Optional because every other environment is MEANT to lack it — absence is the gate, not a
    // misconfiguration. Do not make this required. Why the gate is a credential: `lib/google/auth.ts`.
    // Refined when present: a malformed Editor credential would otherwise pass boot and fail inside
    // a deferred write that sheets-sync swallows, in the one environment that writes at all.
    GOOGLE_SERVICE_ACCOUNT_WRITE_JSON: z
      .string()
      .optional()
      .refine(
        (raw) => raw === undefined || isServiceAccountJson(raw),
        'GOOGLE_SERVICE_ACCOUNT_WRITE_JSON must be valid JSON with client_email and private_key',
      ),
    KOSZTORYS_TEMPLATE_SHEET_ID: z.string().min(1, 'KOSZTORYS_TEMPLATE_SHEET_ID is required'),
    KOSZTORYS_DRIVE_FOLDER_ID: z.string().optional(),
    // OpenRouter (receipt-scan vision extraction). Referer/app-name are optional attribution
    // headers OpenRouter surfaces on its dashboard; only the key is required to make calls.
    OPENROUTER_API_KEY: z.string().min(1),
    OPENROUTER_HTTP_REFERER: z.string().optional(),
    OPENROUTER_APP_NAME: z.string().optional(),
    // Vercel-injected at runtime; absent locally (where NODE_ENV is the right signal).
    VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
    CRON_SECRET: z.string().min(1),
  })
  .superRefine((env, ctx) => {
    const refusal = blobTokenRefusal(env.VERCEL_ENV, env.BLOB_READ_WRITE_TOKEN)
    if (refusal) ctx.addIssue({ code: 'custom', path: ['BLOB_READ_WRITE_TOKEN'], message: refusal })

    // Optional everywhere, mandatory HERE: production is the only environment that writes, and a
    // failed write is invisible — sheets-sync defers it through after() and swallows the throw. So
    // deleting this var would not break a request, it would silently stop every transfer from
    // reaching the owner's sheet. Fail the boot instead.
    if (env.VERCEL_ENV === 'production' && env.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_SERVICE_ACCOUNT_WRITE_JSON'],
        message:
          'GOOGLE_SERVICE_ACCOUNT_WRITE_JSON is required in production — without it Google Sheets ' +
          'sync fails silently on every transfer. Set the Editor service-account JSON on Vercel Production.',
      })
    }
  })
