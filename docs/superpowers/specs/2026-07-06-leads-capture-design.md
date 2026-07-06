# Leads capture — centralized interaction store (design)

**Date:** 2026-07-06
**Status:** approved, pending spec review
**Related:** `docs/facebook-leads-setup.md` (webhook/token/backfill/data-shape reference),
memory `project_facebook_leads_webhook.md`

## Goal

A **centralized, source-agnostic store of everyone who has shown interest in the company.**
Facebook Lead Ads is the first ingestion source (adapter #1); future sources (our own website
forms, where we control the field names) plug into the same store. This spec covers the FB Lead
Ads adapter + the shared collection + admin notification. The lead-facing auto-reply is explicitly
out of scope for the first increment (see Phasing).

## Data model — `leads` collection (Payload)

Append-only **event log**: one row per submission, never deduped. A returning person = two rows.
A person/contact view (dedupe by email) is deliberately deferred until email extraction is proven
and we control the forms. Polish admin labels, English slug/code.

| Field             | Type                    | Notes                                                                                                                                                                            |
| ----------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`          | select                  | `facebook_lead_ads` now; extensible. Required.                                                                                                                                   |
| `email`           | text, nullable, indexed | lifted from Meta `EMAIL`-typed field                                                                                                                                             |
| `name`            | text, nullable          | lifted from Meta `FULL_NAME`-typed field                                                                                                                                         |
| `phone`           | text, nullable          | lifted from Meta `PHONE`-typed field                                                                                                                                             |
| `rawData`         | json                    | full `field_data` as a **key/value array** — ground truth, never lossy                                                                                                           |
| `externalId`      | text                    | `leadgen_id`; **unique per source** (idempotency)                                                                                                                                |
| `formId`          | text, nullable          | source form id                                                                                                                                                                   |
| `formName`        | text, nullable          | source form name (provenance)                                                                                                                                                    |
| `submittedAt`     | date                    | Meta `created_time`                                                                                                                                                              |
| `isTest`          | checkbox                | true when values are prefixed `<test lead: …>`                                                                                                                                   |
| `autoReplyStatus` | select                  | `pending` (default) · `sent` · `failed` · `skipped`. **Forward-looking** — populated by the future auto-reply phase; stays `pending` in the first increment (nothing sends yet). |

Idempotency: unique `(source, externalId)`. Meta retries webhooks, so an existing row → skip
(no duplicate row, no duplicate notification).

### Why raw array + only three typed columns

Proven by the live 62-lead dump (`docs/facebook-leads-setup.md` §Data shape):

- Field `name`s are raw, unsanitised, and **per-form** (`full name` has a space;
  `z_jakiej_dzielnicy_warszawy_jesteś?` keeps the `?`). Hardcoded columns break on the next form.
- The dzielnica/pomieszczenie fields are Meta type `CUSTOM` = free text (answers wildly varied),
  **not** enums — never model as `select`.
- Only `FULL_NAME`/`PHONE`/`EMAIL` are Meta-typed and safe to lift to columns.
- `values` is an **array** — store `values[0]` (or the array), never assume scalar.

## Webhook flow

Route (`src/app/(frontend)/api/webhooks/facebook-leads/route.ts`) stays thin and orchestrates
focused units under `src/lib/leads/`:

```
POST:
  1. read RAW body → verifySignature(x-hub-signature-256, META_APP_SECRET)  → 403 on mismatch
  2. for each leadgen_id:
       fetchLead(leadgen_id)                       // Graph API, existing pattern
       validateLead(zod)                           // safety net
         └─ on parse fail OR expected-but-missing email → notifyAdmin(alert)   // poor-man's Sentry
       normalizeLead(field_data, questions)        // → {email,name,phone,raw,isTest}
       storeLead(...)                              // Payload Local API, skip if externalId exists
       notifyNewLead(...)                          // internal heads-up to LEADS_NOTIFY_EMAIL (NOT the lead)
  3. return 200
```

### Units (`src/lib/leads/`)

- `verify-signature.ts` — HMAC-SHA256 of the raw body with `META_APP_SECRET`, constant-time compare
  against the `x-hub-signature-256` header. **Security gate.**
- `fetch-lead.ts` — `GET /{leadgen_id}` with `META_PAGE_ACCESS_TOKEN` (existing call, extracted).
- `normalize-lead.ts` — map `field_data` → `{email,name,phone,rawData,isTest}`. Primary: match by
  Meta field **type** (`EMAIL`/`PHONE`/`FULL_NAME`) using the form `questions` definition; fallback:
  email-regex on values. Detect `<test lead: …>` prefix → `isTest`.
- `lead-schema.ts` — Zod schema for the expected lead shape (the safety net's contract).
- `store-lead.ts` — insert via `getPayload({config})`, idempotent on `(source, externalId)`.
- `notify.ts` — send via **`payload.sendEmail(...)`** (the repo already configures
  `nodemailerAdapter` in `payload.config.ts` — do NOT hand-roll a transport). Two messages:
  (a) new-lead heads-up, (b) shape-mismatch alert. Both to `LEADS_NOTIFY_EMAIL`.

**Admin labels:** plain Polish strings (this repo has no Payload localization — do NOT use
moodbox's bilingual `{ pl, en }` label objects). Status values/pattern follow moodbox's
`ScheduledEmails` (`pending`/`sent`/`failed`/…), labels in Polish only.

## Reliability / extraction

Extraction keys off Meta's field **types**, not name-guessing — reliable because `EMAIL`/`PHONE`/
`FULL_NAME` are Meta-validated. To resolve type from the per-lead `field_data` (which carries only
the key), fetch the form `questions` (`GET /{form_id}?fields=questions`) to build a key→type map;
cache per `form_id` within the request/process. Email-regex on values is the fallback.

## Safety net (interim monitoring)

No Sentry yet. Each lead is validated with Zod; on parse failure, or when a lead we expected to
carry an email doesn't, `notifyAdmin` emails `LEADS_NOTIFY_EMAIL`. This turns "unreliable data" into
an observable signal instead of a silent gap. **Wiring up Sentry is the planned next step** and will
supersede this email alert.

## Env

New: `LEADS_NOTIFY_EMAIL` (default `konradantonik@gmail.com`) — recipient for both the new-lead
notification and the safety-net alert; independent of the sending account (`EMAIL_USER`). Add to
`env-schema.ts`, `.env.copy`, and Vercel prod.

## Phasing

The first buildable increment = capture + extract + notify + safety net, shipped together (they are
what make the store useful and safe):

1. **Capture** — HMAC verify → store raw into `leads`.
2. **Extract** — type-driven `email`/`name`/`phone`.
3. **Notify you** — internal heads-up email per lead.
   (Safety-net Zod alert is part of this increment, not a separate phase.)

Future work (NOT in this increment): 4. Read full form definition / richer form handling for other sources. 5. Change the FB form's confirmation/redirect message. 6. **Lead-facing auto-reply** — only once email extraction is proven reliable against real leads. 7. Sentry (supersedes the email safety net). 8. Person/contact view (dedupe by email) on top of the event log.

## Testing

Per project convention (POC → skip; MVP → add): tests come once extraction is exercised against
real leads. Backfill (`docs/facebook-leads-setup.md`) gives a real dataset to validate
`normalize-lead` against without waiting for live webhooks.

## Out of scope

Lead-facing auto-reply, Sentry, contact dedupe, per-form/per-campaign templates, multi-source
adapters beyond FB Lead Ads.
