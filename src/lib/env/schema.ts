import { z } from 'zod'
import isValidUrl from '@/lib/is-valid-url'

// Pure schemas — NO side effects and NO `import 'server-only'`, so this file is safe to
// import from both env entries (env/index.ts / env/server.ts) and from the Payload CLI graph.
// Hard rule: every var is required (no `.default()`) so a missing one fails the build gate;
// `.optional()` is only for vars that are genuinely absent in some environments.

export const clientSchema = z.object({
  // Public (inlined into the browser bundle) — read via statically-keyed object in env.ts.
  NEXT_PUBLIC_FRONTEND_URL: z.string().refine(isValidUrl, 'Invalid URL'),
})

export const serverSchema = z.object({
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
  // Recipient for new-lead heads-up notifications (sales inbox — not the lead)
  LEADS_NOTIFY_EMAIL: z.string().min(1),
  // Recipient for integration shape-alerts (ops/dev inbox — schema fail / no email extracted)
  LEADS_ALERT_EMAIL: z.string().min(1),
  // From-address on the customer-facing auto-reply confirmation (needs SPF/DKIM on its domain)
  LEADS_REPLY_FROM: z.string().min(1),
  // Google (Sheets + Drive for kosztorys integration)
  GOOGLE_SERVICE_ACCOUNT_JSON: z
    .string()
    .min(1, 'GOOGLE_SERVICE_ACCOUNT_JSON is required')
    .refine((raw) => {
      try {
        const parsed = JSON.parse(raw)
        return typeof parsed?.client_email === 'string' && typeof parsed?.private_key === 'string'
      } catch {
        return false
      }
    }, 'GOOGLE_SERVICE_ACCOUNT_JSON must be valid JSON with client_email and private_key'),
  KOSZTORYS_TEMPLATE_SHEET_ID: z.string().min(1, 'KOSZTORYS_TEMPLATE_SHEET_ID is required'),
  KOSZTORYS_DRIVE_FOLDER_ID: z.string().optional(),
  // Vercel-injected at runtime; absent locally (where NODE_ENV is the right signal).
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
})
