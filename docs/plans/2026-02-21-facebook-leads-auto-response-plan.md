# Facebook Lead Capture & Auto-Response — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Capture Facebook Lead Ad submissions via webhook, store them in Payload CMS, and immediately send a branded auto-response email.

**Architecture:** Meta webhook POST → HMAC verification → Graph API lead fetch → `leads` Payload collection → `payload.sendEmail()` with templated HTML. Email template system ported from moodbox-payload project.

**Tech Stack:** Payload 3.73.0, Nodemailer (already configured), Next.js 16 API routes, Meta Graph API, Vitest

---

### Task 1: Email Template Constants & Types

**Files:**

- Create: `src/utilities/email-templates/email-template-constants.ts`

**Step 1: Create the constants file**

```typescript
export const BRAND_COLORS = {
  primary: '#1a1a1a',
  primaryDark: '#0d0d0d',
  background: '#f5f5f5',
  cardBackground: '#ffffff',
  textColor: '#333333',
  buttonTextColor: '#ffffff',
}

// TODO: Replace with actual wykonczymy logo SVG
export const LOGO_SVG = `
<div style="font-size: 24px; font-weight: bold; color: #1a1a1a;">
  Wykonczymy
</div>`

export type EmailItemT =
  | { type: 'text'; content: string; bold?: boolean; marginBottom?: string }
  | { type: 'button'; label: string; url: string }
  | { type: 'raw'; html: string }
```

> **Note:** Brand colors are placeholder values. Update `BRAND_COLORS` and `LOGO_SVG` with the real wykonczymy brand assets before going live.

**Step 2: Commit**

```bash
git add src/utilities/email-templates/email-template-constants.ts
git commit -m "feat: add email template constants and types"
```

---

### Task 2: Email Template Renderer

**Files:**

- Create: `src/utilities/email-templates/render-email-template.ts`
- Test: `src/__tests__/utilities/render-email-template.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { renderEmailTemplate } from '@/utilities/email-templates/render-email-template'

describe('renderEmailTemplate', () => {
  it('renders a complete HTML email with title and text items', () => {
    const html = renderEmailTemplate({
      title: 'Test Title',
      items: [{ type: 'text', content: 'Hello world' }],
    })

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Test Title')
    expect(html).toContain('Hello world')
  })

  it('renders button items with correct href', () => {
    const html = renderEmailTemplate({
      items: [{ type: 'button', label: 'Click Me', url: 'https://example.com' }],
    })

    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('Click Me')
  })

  it('renders raw HTML items directly', () => {
    const html = renderEmailTemplate({
      items: [{ type: 'raw', html: '<div class="custom">Custom HTML</div>' }],
    })

    expect(html).toContain('<div class="custom">Custom HTML</div>')
  })

  it('renders footer when provided', () => {
    const html = renderEmailTemplate({
      items: [{ type: 'text', content: 'Body' }],
      footer: 'Footer text',
    })

    expect(html).toContain('Footer text')
  })

  it('omits title section when no title provided', () => {
    const html = renderEmailTemplate({
      items: [{ type: 'text', content: 'Body' }],
    })

    expect(html).not.toContain('<h1')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/utilities/render-email-template.test.ts`
Expected: FAIL — module not found

**Step 3: Write the renderer**

Port from moodbox (`/Users/konradantonik/workspace/moodbox-payload_copy/moodbox-payload/src/utilities/email_templates/render_email_template.ts`), adapting imports:

```typescript
import { BRAND_COLORS, LOGO_SVG, type EmailItemT } from './email-template-constants'

type RenderEmailTemplatePropsT = {
  title?: string
  items: EmailItemT[]
  footer?: string
}

export function renderEmailTemplate({ title, items, footer }: RenderEmailTemplatePropsT): string {
  const contentHtml = items
    .map((el) => {
      if (el.type === 'text') {
        const margin = el.marginBottom ?? '15px'
        const boldStyle = el.bold ? 'font-weight: bold;' : ''

        return `
          <p style="
            color: ${BRAND_COLORS.textColor};
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: ${margin};
            ${boldStyle}
          ">
            ${el.content}
          </p>`
      }

      if (el.type === 'button') {
        return `
          <p style="margin: 32px 0; text-align: center;">
            <a href="${el.url}" style="
              background-color: ${BRAND_COLORS.primary};
              color: ${BRAND_COLORS.buttonTextColor};
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 4px;
              font-weight: bold;
              display: inline-block;
              font-size: 16px;
            ">
              ${el.label}
            </a>
          </p>`
      }

      if (el.type === 'raw') {
        return el.html
      }

      return ''
    })
    .join('\n')

  const titleHtml = title
    ? `
      <h1 style="
        color: ${BRAND_COLORS.primaryDark};
        font-size: 28px;
        margin-bottom: 32px;
        text-align: center;
      ">
        ${title}
      </h1>`
    : ''

  const footerHtml = footer
    ? `
      <p style="
        color: ${BRAND_COLORS.primary};
        font-weight: bold;
        text-align: center;
        margin-top: 30px;
      ">
        ${footer}
      </p>`
    : ''

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="
        background-color: ${BRAND_COLORS.background};
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 20px;
      ">
        <div style="
          max-width: 600px;
          margin: 0 auto;
          background-color: ${BRAND_COLORS.cardBackground};
          padding: 30px;
          border-radius: 8px;
        ">
          <div style="text-align: center; margin-bottom: 20px;">
            ${LOGO_SVG}
          </div>

          ${titleHtml}

          ${contentHtml}

          ${footerHtml}
        </div>
      </body>
    </html>`
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/utilities/render-email-template.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/utilities/email-templates/render-email-template.ts src/__tests__/utilities/render-email-template.test.ts
git commit -m "feat: add email template renderer with tests"
```

---

### Task 3: Lead Auto-Response Email Template

**Files:**

- Create: `src/utilities/email-templates/templates/lead-auto-response.ts`
- Create: `src/utilities/email-templates/build-lead-auto-response-email.ts`

**Step 1: Create the template**

```typescript
import type { EmailItemT } from '../email-template-constants'
import { renderEmailTemplate } from '../render-email-template'

export function generateLeadAutoResponseHTML(leadName: string): string {
  const items: EmailItemT[] = [
    {
      type: 'text',
      content: `Dzień dobry ${leadName},`,
    },
    {
      type: 'text',
      content:
        'Dziękujemy za zainteresowanie naszymi usługami. Otrzymaliśmy Twoje zgłoszenie i skontaktujemy się z Tobą najszybciej jak to możliwe.',
    },
    {
      type: 'text',
      content: 'W międzyczasie zapraszamy do odwiedzenia naszej strony:',
    },
    {
      type: 'button',
      label: 'Odwiedź naszą stronę',
      url: 'https://wykonczymy.com.pl',
    },
    {
      type: 'text',
      content: 'Pozdrawiamy,<br>Zespół Wykonczymy',
      marginBottom: '0',
    },
  ]

  return renderEmailTemplate({
    title: 'Dziękujemy za kontakt!',
    items,
  })
}
```

> **Note:** Email copy is placeholder Polish text. Replace with final content before going live.

**Step 2: Create the builder function**

```typescript
import { generateLeadAutoResponseHTML } from './templates/lead-auto-response'

export function buildLeadAutoResponseEmail(leadName: string): {
  subject: string
  html: string
} {
  const subject = 'Wykonczymy — Dziękujemy za kontakt'
  const html = generateLeadAutoResponseHTML(leadName)

  return { subject, html }
}
```

**Step 3: Commit**

```bash
git add src/utilities/email-templates/templates/lead-auto-response.ts src/utilities/email-templates/build-lead-auto-response-email.ts
git commit -m "feat: add lead auto-response email template"
```

---

### Task 4: Leads Payload Collection

**Files:**

- Create: `src/collections/leads.ts`
- Modify: `src/payload.config.ts` (add Leads to collections array)

**Step 1: Create the leads collection**

```typescript
import type { CollectionConfig } from 'payload'
import { isAdminOrOwner } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

const STATUS_OPTIONS = [
  { label: { en: 'New', pl: 'Nowy' }, value: 'new' },
  { label: { en: 'Contacted', pl: 'Skontaktowano' }, value: 'contacted' },
  { label: { en: 'Failed', pl: 'Błąd' }, value: 'failed' },
] as const

const SOURCE_OPTIONS = [
  { label: { en: 'Facebook Lead Ad', pl: 'Facebook Lead Ad' }, value: 'facebook_lead_ad' },
  { label: { en: 'Website Form', pl: 'Formularz na stronie' }, value: 'website_form' },
] as const

export const Leads: CollectionConfig = {
  slug: 'leads',
  labels: {
    singular: { en: 'Lead', pl: 'Lead' },
    plural: { en: 'Leads', pl: 'Leady' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'status', 'source', 'createdAt'],
    group: { en: 'Marketing', pl: 'Marketing' },
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('leads')],
    afterDelete: [makeRevalidateAfterDelete('leads')],
  },
  access: {
    read: isAdminOrOwner,
    create: () => true, // Webhook endpoint creates leads (verified by HMAC)
    update: isAdminOrOwner,
    delete: isAdminOrOwner,
  },
  fields: [
    {
      name: 'facebookLeadId',
      type: 'text',
      unique: true,
      label: { en: 'Facebook Lead ID', pl: 'Facebook Lead ID' },
      admin: {
        readOnly: true,
        description: {
          en: 'Unique ID from Meta, prevents duplicates',
          pl: 'Unikalny ID z Meta, zapobiega duplikatom',
        },
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      label: { en: 'Name', pl: 'Imię i nazwisko' },
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      label: { en: 'Email', pl: 'Email' },
    },
    {
      name: 'phone',
      type: 'text',
      label: { en: 'Phone', pl: 'Telefon' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      label: { en: 'Status', pl: 'Status' },
      options: [...STATUS_OPTIONS],
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'facebook_lead_ad',
      label: { en: 'Source', pl: 'Źródło' },
      options: [...SOURCE_OPTIONS],
    },
    {
      name: 'campaignName',
      type: 'text',
      label: { en: 'Campaign Name', pl: 'Nazwa kampanii' },
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'errorMessage',
      type: 'text',
      label: { en: 'Error Message', pl: 'Komunikat błędu' },
      admin: {
        readOnly: true,
        condition: (data) => data?.status === 'failed',
      },
    },
    {
      name: 'contactedAt',
      type: 'date',
      label: { en: 'Contacted At', pl: 'Data kontaktu' },
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
  ],
}
```

**Step 2: Register collection in Payload config**

In `src/payload.config.ts`, add the import and add `Leads` to the `collections` array:

```typescript
// Add to imports at top:
import { Leads } from '@/collections/leads'

// Add to collections array (after existing collections):
collections: [Users, CashRegisters, Investments, Transfers, OtherCategories, Media, Leads],
```

**Step 3: Generate migration**

Run: `pnpm payload migrate:create add-leads-collection`

This generates a migration file in `src/migrations/`. Audit the SQL before applying.

**Step 4: Apply migration locally**

Run: `pnpm payload migrate`

**Step 5: Regenerate types**

Run: `pnpm payload generate:types`

This updates `src/payload-types.ts` with the new `Lead` type.

**Step 6: Commit**

```bash
git add src/collections/leads.ts src/payload.config.ts src/migrations/ src/payload-types.ts
git commit -m "feat: add leads collection with migration"
```

---

### Task 5: Meta Webhook Signature Verification

**Files:**

- Create: `src/lib/meta/verify-meta-signature.ts`
- Test: `src/__tests__/lib/verify-meta-signature.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { verifyMetaSignature } from '@/lib/meta/verify-meta-signature'

const TEST_SECRET = 'test-app-secret'

function makeSignature(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
}

describe('verifyMetaSignature', () => {
  it('returns true for a valid signature', () => {
    const body = '{"entry":[]}'
    const signature = makeSignature(body, TEST_SECRET)

    const result = verifyMetaSignature(body, signature, TEST_SECRET)
    expect(result).toBe(true)
  })

  it('returns false for an invalid signature', () => {
    const body = '{"entry":[]}'
    const signature = 'sha256=invalidsignature'

    const result = verifyMetaSignature(body, signature, TEST_SECRET)
    expect(result).toBe(false)
  })

  it('returns false when signature header is missing', () => {
    const body = '{"entry":[]}'

    const result = verifyMetaSignature(body, undefined, TEST_SECRET)
    expect(result).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/lib/verify-meta-signature.test.ts`
Expected: FAIL — module not found

**Step 3: Write the verification function**

```typescript
import { createHmac, timingSafeEqual } from 'crypto'

export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | undefined | null,
  appSecret: string,
): boolean {
  if (!signatureHeader) return false

  const expectedSignature =
    'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')

  try {
    return timingSafeEqual(
      Buffer.from(signatureHeader, 'utf-8'),
      Buffer.from(expectedSignature, 'utf-8'),
    )
  } catch {
    return false
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/lib/verify-meta-signature.test.ts`
Expected: PASS (all 3 tests)

**Step 5: Commit**

```bash
git add src/lib/meta/verify-meta-signature.ts src/__tests__/lib/verify-meta-signature.test.ts
git commit -m "feat: add Meta webhook HMAC signature verification"
```

---

### Task 6: Meta Graph API Lead Fetcher

**Files:**

- Create: `src/lib/meta/fetch-lead-data.ts`

**Step 1: Create the lead fetcher**

```typescript
type MetaFieldDataT = {
  name: string
  values: string[]
}

type MetaLeadResponseT = {
  id: string
  form_id: string
  field_data: MetaFieldDataT[]
  campaign_name?: string
}

type LeadDataT = {
  facebookLeadId: string
  name: string
  email: string
  phone: string | undefined
  campaignName: string | undefined
}

export async function fetchLeadData(leadId: string): Promise<LeadDataT> {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) throw new Error('META_PAGE_ACCESS_TOKEN is not set')

  const url = `https://graph.facebook.com/v21.0/${leadId}?access_token=${token}`
  const response = await fetch(url)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Meta Graph API error (${response.status}): ${error}`)
  }

  const data: MetaLeadResponseT = await response.json()

  const getField = (name: string): string | undefined =>
    data.field_data.find((f) => f.name === name)?.values[0]

  const email = getField('email')
  const name = getField('full_name') ?? getField('first_name') ?? 'Unknown'

  if (!email) throw new Error(`Lead ${leadId} has no email field`)

  return {
    facebookLeadId: data.id,
    name,
    email,
    phone: getField('phone_number'),
    campaignName: data.campaign_name,
  }
}
```

> **Note:** The `field_data` field names (`email`, `full_name`, `phone_number`) depend on how the Lead Ad form is configured in Facebook. These are standard Meta field names, but may need adjustment after inspecting real webhook payloads.

**Step 2: Commit**

```bash
git add src/lib/meta/fetch-lead-data.ts
git commit -m "feat: add Meta Graph API lead data fetcher"
```

---

### Task 7: Facebook Leads Webhook Endpoint

**Files:**

- Create: `src/app/(frontend)/api/webhooks/facebook-leads/route.ts`

**Step 1: Create the webhook route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { verifyMetaSignature } from '@/lib/meta/verify-meta-signature'
import { fetchLeadData } from '@/lib/meta/fetch-lead-data'
import { buildLeadAutoResponseEmail } from '@/utilities/email-templates/build-lead-auto-response-email'

/**
 * GET /api/webhooks/facebook-leads
 * Meta webhook verification challenge (one-time handshake).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/**
 * POST /api/webhooks/facebook-leads
 * Receives lead notifications from Meta, fetches full data, stores in Payload, sends email.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // 1. Verify signature
  const signature = request.headers.get('x-hub-signature-256')
  const appSecret = process.env.META_APP_SECRET

  if (!appSecret) {
    console.error('[facebook-leads] META_APP_SECRET is not set')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // 2. Parse webhook payload
  const body = JSON.parse(rawBody)
  const payload = await getPayload({ config })

  // 3. Process each lead entry
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue

      const leadId = change.value?.leadgen_id
      if (!leadId) continue

      try {
        await processLead(payload, leadId)
      } catch (err) {
        console.error(`[facebook-leads] Error processing lead ${leadId}:`, err)
      }
    }
  }

  // Always return 200 to Meta (even if individual leads fail)
  return NextResponse.json({ received: true }, { status: 200 })
}

async function processLead(payload: Awaited<ReturnType<typeof getPayload>>, leadId: string) {
  // Check for duplicate
  const existing = await payload.find({
    collection: 'leads',
    where: { facebookLeadId: { equals: leadId } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log(`[facebook-leads] Lead ${leadId} already exists, skipping`)
    return
  }

  // Fetch full lead data from Meta Graph API
  const leadData = await fetchLeadData(leadId)

  // Create lead document
  const lead = await payload.create({
    collection: 'leads',
    data: {
      facebookLeadId: leadData.facebookLeadId,
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      source: 'facebook_lead_ad',
      campaignName: leadData.campaignName,
      status: 'new',
    },
  })

  // Send auto-response email
  try {
    const { subject, html } = buildLeadAutoResponseEmail(leadData.name)

    await payload.sendEmail({
      to: leadData.email,
      subject,
      html,
    })

    await payload.update({
      collection: 'leads',
      id: lead.id,
      data: {
        status: 'contacted',
        contactedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[facebook-leads] Email send failed for lead ${lead.id}:`, message)

    await payload.update({
      collection: 'leads',
      id: lead.id,
      data: {
        status: 'failed',
        errorMessage: message,
      },
    })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/(frontend)/api/webhooks/facebook-leads/route.ts
git commit -m "feat: add Facebook leads webhook endpoint with auto-response"
```

---

### Task 8: Environment Variables

**Files:**

- Modify: `.env` (local) — add placeholder variables

**Step 1: Add Meta environment variables to `.env`**

```env
# Meta (Facebook) Lead Ads Integration
META_APP_SECRET=           # From Meta App → Settings → Basic → App Secret
META_PAGE_ACCESS_TOKEN=    # Long-lived Page Access Token with leads_retrieval permission
META_VERIFY_TOKEN=         # Custom string you define for webhook handshake (any random string)
```

**Step 2: Add to `.env.example` if it exists**

Same three variables with empty values.

**Step 3: Commit `.env.example` only (never commit `.env`)**

```bash
git add .env.example
git commit -m "chore: add Meta environment variables to .env.example"
```

---

### Task 9: Manual Retry Server Action (for failed emails)

**Files:**

- Create: `src/lib/actions/retry-lead-email.ts`

**Step 1: Create the server action**

```typescript
'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { buildLeadAutoResponseEmail } from '@/utilities/email-templates/build-lead-auto-response-email'

type RetryResultT = {
  error: boolean
  message: string
}

export async function retryLeadEmail(leadId: number): Promise<RetryResultT> {
  const user = await getCurrentUserJwt()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
    return { error: true, message: 'Unauthorized' }
  }

  try {
    const payload = await getPayload({ config })

    const lead = await payload.findByID({
      collection: 'leads',
      id: leadId,
    })

    if (!lead) {
      return { error: true, message: 'Lead not found' }
    }

    const { subject, html } = buildLeadAutoResponseEmail(lead.name)

    await payload.sendEmail({
      to: lead.email,
      subject,
      html,
    })

    await payload.update({
      collection: 'leads',
      id: leadId,
      data: {
        status: 'contacted',
        contactedAt: new Date().toISOString(),
        errorMessage: '',
      },
    })

    return { error: false, message: 'Email sent successfully' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { error: true, message }
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/actions/retry-lead-email.ts
git commit -m "feat: add manual retry server action for failed lead emails"
```

---

### Task 10: Leads Query for Dashboard

**Files:**

- Create: `src/lib/queries/leads.ts`

**Step 1: Create the query functions**

```typescript
import { getPayload } from 'payload'
import config from '@payload-config'

export async function getLeads(status?: string) {
  const payload = await getPayload({ config })

  const where = status ? { status: { equals: status } } : {}

  return payload.find({
    collection: 'leads',
    where,
    sort: '-createdAt',
    limit: 100,
  })
}

export async function getLeadCounts() {
  const payload = await getPayload({ config })

  const [newCount, failedCount, totalCount] = await Promise.all([
    payload.count({ collection: 'leads', where: { status: { equals: 'new' } } }),
    payload.count({ collection: 'leads', where: { status: { equals: 'failed' } } }),
    payload.count({ collection: 'leads' }),
  ])

  return {
    new: newCount.totalDocs,
    failed: failedCount.totalDocs,
    total: totalCount.totalDocs,
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/queries/leads.ts
git commit -m "feat: add leads query functions for dashboard"
```

---

## Summary of Created Files

```
src/
├── utilities/email-templates/
│   ├── email-template-constants.ts          # Task 1
│   ├── render-email-template.ts             # Task 2
│   ├── build-lead-auto-response-email.ts    # Task 3
│   └── templates/
│       └── lead-auto-response.ts            # Task 3
├── collections/
│   └── leads.ts                             # Task 4
├── lib/meta/
│   ├── verify-meta-signature.ts             # Task 5
│   └── fetch-lead-data.ts                   # Task 6
├── lib/actions/
│   └── retry-lead-email.ts                  # Task 9
├── lib/queries/
│   └── leads.ts                             # Task 10
├── app/(frontend)/api/webhooks/
│   └── facebook-leads/route.ts              # Task 7
└── __tests__/
    ├── utilities/
    │   └── render-email-template.test.ts    # Task 2
    └── lib/
        └── verify-meta-signature.test.ts    # Task 5
```

## Modified Files

- `src/payload.config.ts` — add Leads collection import + registration (Task 4)
- `.env` / `.env.example` — add META\_\* variables (Task 8)

## Not In Scope (Future Phases)

- Dashboard UI (leads table, notification badge) — needs design discussion
- Own website contact form (`source: 'website_form'`)
- Survey system with TanStack Tables
- Follow-up email sequences
- Email template management UI
- Campaign tracking and analytics
