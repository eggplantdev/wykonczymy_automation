# Facebook Lead Capture & Auto-Response System

## Overview

Automate the flow from Facebook Lead Ads to email response. When a potential client fills out a contact form on Facebook/Instagram, the system captures their data into Payload CMS and immediately sends a branded template email.

## Architecture

### Data Flow

```
Facebook Lead Ad form submitted
  → Meta sends webhook POST to /api/webhooks/facebook-leads
  → Verify signature (X-Hub-Signature-256, HMAC-SHA256)
  → Fetch full lead data from Graph API (webhook only sends lead ID + form ID)
  → Create document in `leads` collection (status: "new")
  → Send template email via payload.sendEmail()
  → Update lead status to "contacted"
  → If email fails → status remains "new", errorMessage stored
```

### Why Webhooks Over Polling

- Real-time lead capture (seconds, not minutes/hours)
- No wasted API calls when no leads exist
- Same pattern already proven in moodbox-payload project
- No cron job needed for Phase 1 (Vercel free tier limitation irrelevant)

## New Payload Collection: `leads`

| Field          | Type   | Notes                                        |
| -------------- | ------ | -------------------------------------------- |
| facebookLeadId | text   | Unique, from Meta, prevents duplicates       |
| name           | text   | From lead form                               |
| email          | email  | From lead form                               |
| phone          | text   | From lead form                               |
| status         | select | `new` / `contacted` / `failed`               |
| source         | select | `facebook_lead_ad` / `website_form` (future) |
| campaignName   | text   | Optional, from Meta ad metadata              |
| errorMessage   | text   | Populated if email sending failed            |
| contactedAt    | date   | Timestamp when email was successfully sent   |

### Access Control

- Read: ADMIN, OWNER
- Create: Public (webhook endpoint, verified by HMAC)
- Update: ADMIN, OWNER
- Delete: ADMIN only

## New API Route: `/api/webhooks/facebook-leads`

### GET Handler — Meta Verification Challenge

Meta sends a one-time GET request to verify webhook ownership:

```
GET /api/webhooks/facebook-leads?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE
```

Response: return `hub.challenge` value if `hub.verify_token` matches `META_VERIFY_TOKEN`.

### POST Handler — Lead Notification

1. Read raw body, verify `X-Hub-Signature-256` header using HMAC-SHA256 with `META_APP_SECRET`
2. Parse payload — extract `leadgen_id` from the webhook event
3. Fetch full lead data from Graph API: `GET /{leadgen_id}?access_token={PAGE_TOKEN}`
4. Map fields: name, email, phone
5. Check for duplicate `facebookLeadId` — skip if already exists
6. Create lead document in Payload
7. Send template email
8. Update lead status

### Webhook Payload Structure (from Meta)

```json
{
  "entry": [
    {
      "id": "PAGE_ID",
      "time": 1234567890,
      "changes": [
        {
          "field": "leadgen",
          "value": {
            "form_id": "FORM_ID",
            "leadgen_id": "LEAD_ID",
            "created_time": 1234567890,
            "page_id": "PAGE_ID"
          }
        }
      ]
    }
  ]
}
```

### Lead Data Response (from Graph API)

```json
{
  "id": "LEAD_ID",
  "form_id": "FORM_ID",
  "field_data": [
    { "name": "full_name", "values": ["Jan Kowalski"] },
    { "name": "email", "values": ["jan@example.com"] },
    { "name": "phone_number", "values": ["+48123456789"] }
  ],
  "campaign_name": "Campaign Name"
}
```

## Email Template System

Ported from moodbox-payload, adapted for wykonczymy branding:

### Structure

```
src/utilities/email-templates/
├── email-template-constants.ts    # Brand colors, logo SVG, EmailItemT type
├── render-email-template.ts       # Main renderer (inline CSS, full HTML doc)
└── templates/
    └── lead-auto-response.ts      # "Thank you for contacting us" template
```

### EmailItemT Types

- `text` — paragraph with optional bold, margin control
- `button` — CTA button with label and URL
- `raw` — arbitrary HTML block

### Template Pattern

```typescript
function generateLeadAutoResponseHTML(leadName: string): string {
  const items: EmailItemT[] = [
    { type: 'text', content: `Hello ${leadName},` },
    { type: 'text', content: 'Thank you for your interest...' },
    { type: 'button', label: 'Visit Our Website', url: 'https://wykonczymy.com.pl' },
  ]
  return renderEmailTemplate({ title: '...', items, footer: '...' })
}
```

Template content to be defined later. System is template-agnostic.

## Dashboard Integration

### Leads on Admin Dashboard

- Lead count badge showing number of leads with status `new` or `failed`
- Leads data table (TanStack Table) on the frontend with:
  - Name, email, phone, status, source, date
  - Filter by status
  - Manual "retry send" action for `failed` leads

### Survey Responses (Phase 2+)

- Viewed on custom frontend with TanStack Tables (not Payload admin)
- More complex survey system planned for later

## Meta Developer Setup (Client Action Required)

### Prerequisites — Waiting on Client

- [ ] Access to client's Meta Business account
- [ ] Determine if Meta App already exists at developers.facebook.com/apps

### Setup Steps (once access is granted)

1. Create Meta App (or use existing) at developers.facebook.com
2. Add "Webhooks" product to the app
3. Add "Facebook Login" product (needed for page token)
4. Generate long-lived Page Access Token with permissions:
   - `leads_retrieval` — fetch lead form data
   - `pages_manage_ads` — access ad campaign metadata
5. Subscribe app to Page's `leadgen` webhook topic
6. Set webhook URL to `https://wykonczymy.com.pl/api/webhooks/facebook-leads`
7. Submit for Meta App Review (`leads_retrieval` requires review)

### Environment Variables

```env
META_APP_SECRET          # From Meta App → Settings → Basic → App Secret
META_PAGE_ACCESS_TOKEN   # Long-lived Page Access Token
META_VERIFY_TOKEN        # Custom string you define for webhook handshake
```

## Future Considerations

### Own Website Form (Considered)

Instead of (or in addition to) Facebook Lead Ads, leads could come from a form on the wykonczymy website. This would:

- Bypass all Meta API complexity
- Write directly to the same `leads` collection with `source: "website_form"`
- Use the same email template system
- Be a simple server action + Zod validation

### Later Phases

- **Email template management** — multiple templates, possibly editable from admin
- **Survey system** — more complex than moodbox, displayed on frontend with TanStack Tables
- **Follow-up email sequences** — would require Vercel cron (once/day on free tier, or upgrade to Pro)
- **Campaign tracking** — which Facebook campaign generated which leads
- **Lead conversion tracking** — status progression beyond `contacted`

## Reference: Moodbox Patterns Being Reused

| Pattern                    | Moodbox Location                                      | Adaptation                                 |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------ |
| Email template renderer    | `src/utilities/email_templates/`                      | New branding, same architecture            |
| Webhook HMAC verification  | `src/lib/shopify/webhooks/verifyShopifyHmacHeader.ts` | Swap Shopify header for Meta header        |
| Scheduled email collection | `src/collections/ScheduledEmails.ts`                  | Simplified — no scheduling, immediate send |
| Server action pattern      | `src/app/actions/submitSurveyA.ts`                    | Same try/catch + validation pattern        |
