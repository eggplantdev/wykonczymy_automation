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
| `contactStatus`   | select                  | `new` (default) · `contacted`. **Human** follow-up — did someone actually reach out to this person. Manually editable in the leads table. Extensible (`converted`, `rejected`).  |
| `notifyStatus`    | select                  | `pending` (default) · `sent` · `failed` · `skipped`. Outcome of the internal heads-up email. `failed` = **captured but not notified** — queryable + re-sendable.                 |
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
       storeLead(...)                              // Payload Local API, skip if externalId exists — LEAD IS NOW SAFE
       try notifyNewLead(...) → update notifyStatus = 'sent'   // heads-up to LEADS_NOTIFY_EMAIL (NOT the lead)
       catch → update notifyStatus = 'failed'      // captured-but-not-notified: recorded, never silent
  3. return 200                                     // always 200 so Meta doesn't retry a stored lead
```

**Store-then-notify ordering is deliberate:** the lead is persisted before any email is attempted,
so a mail failure can never lose the lead. The notification outcome is written back to `notifyStatus`,
turning "captured but mail dropped" into a queryable state (`notifyStatus = 'failed'`) with a manual
admin re-send. **Blind spot (honest):** this catches send _errors_ (throw / SMTP reject); it does
NOT catch mail the SMTP server accepts then drops downstream — no delivery webhook exists yet. Closed
later by Sentry + a mail provider with delivery events. Automatic retry of `failed` rows (cron) is
future work; the first increment records + allows manual re-send only.

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

**Admin labels:** bilingual `{ en, pl }` label objects — this **is** the convention in this repo's
own collections (`investments.ts`, `transfers.ts`), verified during planning. (The earlier
"Polish-only" note was copied from moodbox and is wrong for this repo.) Status values/pattern follow
`ScheduledEmails` (`pending`/`sent`/`failed`/…).

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

The first buildable increment = capture + extract + notify + safety net + table view, shipped
together (they are what make the store useful, safe, and actually seen):

1. **Capture** — HMAC verify → store raw into `leads`.
2. **Extract** — type-driven `email`/`name`/`phone`.
3. **Notify you** — internal heads-up email per lead.
   (Safety-net Zod alert is part of this increment, not a separate phase.)
4. **Submissions table view** — a frontend page (`/zgloszenia`, nav label "Zgłoszenia") listing all
   form submissions (each `leads` row = one submission), reusing the existing
   `src/components/ui/data-table/` pattern. Columns: `name`/`email`/`phone`, `formName`,
   `submittedAt`, `contactStatus` (editable), `notifyStatus`, `autoReplyStatus`, `isTest`.
   `contactStatus` is manually editable inline (via a `protectedAction`). No realtime — data is
   current on load/navigation. Code slug stays `leads`; only the UI names it "submissions".

Future work (NOT in this increment):

- **Notification bell + websockets/polling** — live "new lead" badge in `top-nav`; needs an
  unseen-tracking mechanism and a streaming/poll transport the app lacks. Deferred deliberately.
- Read full form definition / richer form handling for other sources.
- Change the FB form's confirmation/redirect message.
- **Lead-facing auto-reply** — only once email extraction is proven reliable against real leads.
- Sentry (supersedes the email safety net).
- Person/contact view (dedupe by email) on top of the event log.
- **`clients` vs `investments`** — see Open Question below.

## Testing

MVP-grade, so covered. Anchored on risk, cheapest layer that gives real signal, asserting
observable behavior (not implementation). No live webhook needed — the backfill dump is the fixture.

**Risk 1 — extraction picks the wrong field / drops email (highest).** `normalize-lead` is a pure
function → **unit tests** against a sanitised slice of the real 62-lead dataset:

- EMAIL/PHONE/FULL_NAME lifted correctly from typed fields
- `CUSTOM` fields stay in `rawData`, never promoted
- email-regex fallback fires when the typed field is absent
- `values` array handled (not assumed scalar)
- `<test lead: …>` prefix → `isTest = true`
- **missing email → returns emailless result AND flags the safety-net path** (assert the observable:
  a lead with no email still normalizes + is marked for the alert, never throws/drops)

**Risk 2 — forged/tampered webhook accepted (security).** `verify-signature` pure → **unit tests**:
valid signature passes; tampered body, wrong secret, missing header each reject.

**Risk 3 — Meta retry creates duplicate rows/notifications.** `store-lead` idempotency →
**integration test** (Payload Local API against test db): inserting the same `(source, externalId)`
twice yields one row; assert the persisted row count, not the function's return.

**Risk 4 — bad shape silently swallowed.** `lead-schema` Zod → **unit tests**: known-good lead
parses; malformed shapes fail and route to the alert.

**Risk 5 — lead captured but notification silently dropped.** → **integration test**: with the mail
send stubbed to throw, assert the lead is **still persisted** and its `notifyStatus = 'failed'`
(assert persisted state, not the handler's return). Proves a mail failure never loses the lead and
never goes silent.

`normalize-lead` and `verify-signature` are pure with known inputs → **TDD candidates** (write the
failing test first). `store-lead` idempotency is protect-existing-behavior → test alongside impl.
Route authoring through `/10x-tdd` (pure units) and `/10x-implement` (the rest) per AGENTS.md.

## Open question — `clients` vs `investments`

The user wants a place to enrich a lead into a full client record (address + details filled in after
back-and-forth). **`src/collections/investments.ts` already carries that data**: `name`, `address`,
`phone`, `email`, `contactPerson`, `notes`, `status`. An investment is effectively the client+project
entity today. So the fork is:

- **(A) Reuse `investments`** — a lead "converts" by creating/linking an investment; no new collection.
  Fewer moving parts, but conflates "a person who enquired" with "a booked job" (an investment implies
  work exists).
- **(B) New `clients` collection** — leads convert into a `client`; `investments` gains a relation to
  `clients`. Cleaner separation (client identity ≠ a specific job; one client → many investments), but
  a schema change + migration + reworking how investments reference client data.

**Direction chosen: (B)** — a lean `clients` collection, `investments` gains a relation to it. An
investment is a different beast (a booked job with financials); a client is an identity that may
precede any job and span several. **But not in this increment** — the lead-capture increment ships
without it. `leads` is a self-contained event log; converting/enriching a lead into a `client` is a
follow-up once real leads flow. Recorded here so B is a deliberate decision, not a default.

## Out of scope

Lead-facing auto-reply, Sentry, contact dedupe, per-form/per-campaign templates, multi-source
adapters beyond FB Lead Ads.
