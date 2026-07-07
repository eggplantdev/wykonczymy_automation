# Lead Capture — FB Lead Ads Webhook → Leads Store Implementation Plan

## Overview

Turn the existing console-logging Facebook Lead Ads webhook into a resilient, source-agnostic
lead-capture path: HMAC signature verification, a new `leads` Payload collection (append-only event
log), type-driven field extraction with a Zod safety net, store-then-notify ordering (a mail failure
never loses a lead), and a frontend leads table with an editable follow-up status. All five
risk-anchored tests from the design ship in this increment.

## Current State Analysis

- **Webhook exists but only logs.** `src/app/(frontend)/api/webhooks/facebook-leads/route.ts` does
  the Meta GET verify handshake and a POST that fetches `field_data` per `leadgen_id` and
  `console.log`s it. **No HMAC verification, no persistence, no notification.** Proven end-to-end on a
  real test lead.
- **No `leads` collection.** Collections live in `src/collections/`, follow a fixed skeleton
  (`investments.ts`, `expense-categories.ts`), and register in `src/payload.config.ts` (import +
  `collections` array). Slug must also be added to `CACHE_TAGS` in `src/lib/cache/tags.ts` or the
  revalidate hooks fail typecheck.
- **Migrations are hand-written** (repo convention — `migrate:create` snapshots are stale). Structure:
  `up`/`down` with `db.execute(sql\`...\`)`; enum type created before the table; registered in
`src/migrations/index.ts`(import + array entry, order = execution order). Compound unique index
must be raw SQL — Payload's`unique: true` is single-column only.
- **Email adapter is configured** (`nodemailerAdapter`, `payload.config.ts:46-58`); `payload.sendEmail`
  is used once (`api/test-email/route.ts`). SMTP creds already in env (`EMAIL_USER/PASS/HOST`).
- **Table stack is established.** Generic `DataTable<TData>` (`src/components/ui/data-table/`),
  columns via `createColumnHelper` in `src/lib/tables/*.tsx`, server fetch in `src/lib/queries/*`
  wrapped in `unstable_cache`, page under `src/app/(frontend)/<route>/page.tsx`, nav via
  `SECTION_LINKS` in `src/lib/constants/sections.ts`. Inline editable column = `ActiveToggleBadge` +
  `useOptimisticToggle` + a server action (`toggle-active.ts` / `investments.tsx:134-148`).
- **Env is validated** (`src/lib/env-schema.ts` → `serverEnv`); META vars already present, every var
  required (no `.default()`).

### Key Discoveries

- Bilingual `{ en, pl }` labels are the repo convention (`investments.ts:32-75`) — the design's earlier
  "Polish-only" note was wrong and has been corrected in the spec.
- Compound uniqueness pattern to copy: `src/migrations/20260527_add_unique_google_sheet_id.ts:8-18`
  (`CREATE UNIQUE INDEX IF NOT EXISTS ... ON leads (source, external_id)`). Postgres allows multiple
  NULLs under a unique index, so a NULL `external_id` won't collide.
- Column-name mapping is snake_case: field `externalId` → column `external_id`, `contactStatus` →
  `contact_status`, `formName` → `form_name`, `submittedAt` → `submitted_at`.
- Revalidation caveat: the webhook runs in **route-handler context**, so use `revalidateTag`, NOT
  `updateTag` (`src/lib/cache/revalidate.ts:5-7`). The server action for editable status runs in
  Server-Action context → `updateTag` there.
- `payload.sendEmail` shape: `{ to, subject, text | html }` (`api/test-email/route.ts:59-63`).

## Desired End State

A new production lead flows: Meta POSTs → signature verified → `field_data` fetched → validated →
normalized → persisted to `leads` (idempotent on `(source, externalId)`) → an internal heads-up email
lands at `LEADS_NOTIFY_EMAIL` with `notifyStatus` written back. A Management-role user opens `/leady`,
sees every lead (name/email/phone/form/date, notify + auto-reply status badges, test flag), and can
toggle each lead's follow-up status `new ↔ contacted` inline. A malformed lead or a missing-email lead
triggers a safety-net alert instead of a silent gap. A mail failure leaves the lead persisted with
`notifyStatus = 'failed'`. Verified by: all five risk tests green, typecheck/lint clean, migration
applies to the local DB, and a manual test lead visible in `/leady`.

## What We're NOT Doing

- **No `clients` collection / lead→client conversion** — direction is option B, deferred to a later
  change. `leads` is self-contained here.
- **No lead-facing auto-reply** — `autoReplyStatus` exists as a forward-looking column, stays
  `pending`; nothing sends to leads.
- **No Sentry** — the Zod email alert is the interim safety net.
- **No notification bell / websockets / polling** — the table is current on load/navigation only.
- **No automatic retry of `failed` notifications** (no cron) — manual re-send only, later.
- **No backfill of historical leads** — separate task; webhook covers new leads only.
- **No prod migration / deploy / push** — a human applies the migration to Neon and pushes.

## Implementation Approach

Bottom-up in strict dependency order. Phase 1 lays the schema + config so everything downstream has a
table to write to. Phase 2 builds the pure units (verify/normalize/schema) test-first — they have no
DB or network dependency, so they're the cheapest to get right in isolation. Phase 3 assembles
persistence + notification + the webhook rewrite, with integration tests for the two silent-loss
failure modes. Phase 4 is the read side — a table page mirroring the investments pattern wholesale.

## Critical Implementation Details

- **Migration ordering:** the `enum_leads_contact_status` type must be `CREATE TYPE`'d before the
  `CREATE TABLE` that references it, in the same `up`. The compound unique index and the `email` index
  are created in the same `up` after the table.
- **Store-then-notify is load-bearing:** persist the lead (Phase 3) _before_ attempting any email, so a
  throw in `notify` can never lose the lead — it only flips `notifyStatus` to `failed`. Tests assert
  the persisted row, not the handler return.
- **Route-handler revalidation:** in the webhook use `revalidateTag(CACHE_TAGS.leads)` after
  `payload.create`; do NOT import `lib/cache/revalidate.ts` (its `updateTag` throws outside a Server
  Action). The Phase-4 status action is the opposite — it uses the `updateTag` path.
- **HMAC over the RAW body:** signature verification must hash the exact raw request bytes, so read the
  body once as text (`await request.text()`) and `JSON.parse` from that same string — do not
  `request.json()` first (re-serializing changes bytes and breaks the HMAC).

## Phase 1: Data Model & Config

### Overview

Create the `leads` collection, its hand-written migration, register it, and add the notification env
var. Nothing reads or writes it yet — this is the foundation.

### Changes Required:

#### 1. Leads collection config

**File**: `src/collections/leads.ts` (new)

**Intent**: Define the append-only `leads` event log per the design's data-model table, matching the
repo's collection skeleton.

**Contract**: `export const Leads: CollectionConfig` with `slug: 'leads'`, bilingual `labels`,
`admin: { useAsTitle: 'name', defaultColumns, group }`, `access: { read/create/update:
isAdminOrOwnerOrManager, delete: isAdminOrOwner }`, `afterChange`/`afterDelete`
`makeRevalidate*('leads')` hooks. Fields: `source` (select, required), `email` (email, indexed via
`index: true`), `name` (text), `phone` (text), `rawData` (json), `externalId` (text), `formId` (text),
`formName` (text), `submittedAt` (date), `isTest` (checkbox, default false), `contactStatus` (select,
options `new`/`contacted`, default `new`), `notifyStatus` (select, options
`pending`/`sent`/`failed`/`skipped`, default `pending`), `autoReplyStatus` (select, same options,
default `pending`). Status option consts declared as module `as const` arrays with `{ en, pl }` labels.

#### 2. Migration

**File**: `src/migrations/<YYYYMMDD>_add_leads.ts` (new) + register in `src/migrations/index.ts`

**Intent**: Create the `leads` table, its contact-status enum, and indexes by hand.

**Contract**: `up` creates `enum_leads_contact_status AS ENUM('new','contacted')`, plus
`enum_leads_notify_status` / `enum_leads_auto_reply_status AS ENUM('pending','sent','failed','skipped')`,
then `CREATE TABLE leads` (columns snake_case, `id serial PK`, `created_at`/`updated_at timestamp(3)
with time zone DEFAULT now()`, status columns typed to the enums with defaults, `raw_data jsonb`), then
`CREATE UNIQUE INDEX leads_source_external_id_idx ON leads (source, external_id)`, `CREATE INDEX
leads_email_idx ON leads (email)`, plus `created_at`/`updated_at` indexes. `down` drops table then the
three enum types. Register with an `import * as` line + `{ up, down, name }` array entry in `index.ts`.

#### 3. Register collection + cache tag

**File**: `src/payload.config.ts`, `src/lib/cache/tags.ts`

**Intent**: Wire the collection into Payload and the cache-tag map.

**Contract**: import `Leads` and add to the `collections` array; add `leads: 'collection:leads'` to
`CACHE_TAGS`.

#### 4. Notification env var

**File**: `src/lib/env-schema.ts`, `.env.copy`, `.env` (local)

**Intent**: Add the recipient for lead notifications + safety-net alerts.

**Contract**: `LEADS_NOTIFY_EMAIL: z.string().min(1)` in `serverSchema`; documented placeholder in
`.env.copy`; real value in local `.env`. Consumed via `serverEnv.LEADS_NOTIFY_EMAIL`. (Vercel prod env
add is a manual human step, noted in Migration Notes.)

### Success Criteria:

#### Automated Verification:

- Types regenerate cleanly: `pnpm generate:types` (adds `Lead` to `payload-types.ts`)
- Typecheck passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Migration applies to local DB: `pnpm payload migrate` against the docker Postgres (5433)
- `leads` table + `leads_source_external_id_idx` exist in the local DB

#### Manual Verification:

- The `leads` collection appears in the Payload admin panel under the expected group
- A row can be created manually in admin with all fields, and the compound unique index rejects a
  duplicate `(source, externalId)`

**Implementation Note**: After automated verification passes, pause for human confirmation of the
manual admin check before proceeding.

---

## Phase 2: Pure Units (TDD)

### Overview

Build the three pure functions under `src/lib/leads/` test-first. No DB, no network — fixtures come
from a sanitised slice of the real 62-lead dump. Covers risks 1, 2, 4.

### Changes Required:

#### 1. Signature verification (risk 2)

**File**: `src/lib/leads/verify-signature.ts` (+ `verify-signature.test.ts`)

**Intent**: Reject forged/tampered webhooks. Security gate.

**Contract**: `verifySignature(rawBody: string, header: string | null, secret: string): boolean` —
HMAC-SHA256 of `rawBody` with `secret`, constant-time compared (`crypto.timingSafeEqual`) against the
`sha256=` header value. Tests: valid signature passes; tampered body, wrong secret, missing/malformed
header each return false.

#### 2. Lead Zod schema (risk 4)

**File**: `src/lib/leads/lead-schema.ts` (+ `lead-schema.test.ts`)

**Intent**: The safety-net contract for a fetched Graph API lead.

**Contract**: a Zod schema (`leadSchema`) for the expected Graph response shape (`id`, `created_time`,
`field_data: {name, values: string[]}[]`, optional `form_id`) exposing a `safeParse`. Tests: a
known-good lead parses; missing `field_data`, wrong `values` type, absent `id` each fail.

#### 3. Field normalization (risk 1 — highest)

**File**: `src/lib/leads/normalize-lead.ts` (+ `normalize-lead.test.ts`)

**Intent**: Map raw `field_data` → `{ email, name, phone, rawData, isTest }` reliably.

**Contract**: `normalizeLead(fieldData, questions?)` — lift `EMAIL`/`PHONE`/`FULL_NAME` by Meta field
**type** (from the form `questions` key→type map when provided), fall back to email-regex on values;
keep everything as the `rawData` key/value array; detect `<test lead: …>` prefix → `isTest`; read
`values[0]` (array, never assume scalar). Tests (against dump slice): typed fields lifted; `CUSTOM`
fields stay only in `rawData`; regex fallback fires when the typed field is absent; `values` array
handled; test-prefix → `isTest = true`; **missing email → returns an emailless result AND flags the
safety-net path, never throws/drops**.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm exec vitest run src/lib/leads/verify-signature.test.ts src/lib/leads/lead-schema.test.ts src/lib/leads/normalize-lead.test.ts`
- Typecheck passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Spot-check the normalize fixtures against `.local/fb-leads/fb_leads_dataset.json` to confirm they
  mirror real field shapes (not invented)

---

## Phase 3: Persistence, Notify & Webhook Wiring

### Overview

Assemble store + notify units and rewire the webhook to the full flow. Integration tests cover risks 3
(idempotency) and 5 (captured-but-not-notified) against the Payload Local API.

### Changes Required:

#### 1. Store lead (idempotent)

**File**: `src/lib/leads/store-lead.ts` (+ `store-lead.test.ts`)

**Intent**: Persist a normalized lead exactly once per `(source, externalId)`.

**Contract**: `storeLead(payload, input)` — `payload.find` by `(source, externalId)`; if present return
the existing row (skip, no duplicate); else `payload.create({ collection: 'leads', ... })`. Returns
`{ lead, created: boolean }`. Integration test: inserting the same `(source, externalId)` twice yields
one row — assert persisted row **count**, not the return value.

#### 2. Notify

**File**: `src/lib/leads/notify.ts`

**Intent**: Send the internal heads-up and the safety-net alert (both to `LEADS_NOTIFY_EMAIL`, never to
the lead).

**Contract**: `notifyNewLead(payload, lead)` and `notifyShapeAlert(payload, context)`, each calling
`payload.sendEmail({ to: serverEnv.LEADS_NOTIFY_EMAIL, subject, html })`. `notifyNewLead` throws on
send failure (caller catches → `notifyStatus = 'failed'`).

#### 3. Webhook rewrite

**File**: `src/app/(frontend)/api/webhooks/facebook-leads/route.ts`

**Intent**: Replace the log-only POST with verify → fetch → validate → normalize → store → notify;
keep GET unchanged.

**Contract**: POST reads `await request.text()` (raw), `verifySignature(raw, header, META_APP_SECRET)`
→ 403 on mismatch; `JSON.parse(raw)`; per `leadgen_id`: `fetchLead` (extracted from the current inline
Graph call into `src/lib/leads/fetch-lead.ts`), `leadSchema.safeParse` → on fail or missing-expected-email
`notifyShapeAlert`; `normalizeLead`; `storeLead`; then `try notifyNewLead → update notifyStatus='sent'`
/ `catch → update notifyStatus='failed'`; `revalidateTag(CACHE_TAGS.leads)`; always return 200. Store
happens before notify (never lose a lead).

#### 4. Captured-but-not-notified integration test (risk 5)

**File**: `src/lib/leads/store-lead.test.ts` or a route-level test

**Intent**: Prove a mail failure never loses the lead and never goes silent.

**Contract**: with `payload.sendEmail` stubbed to throw, drive store-then-notify and assert the lead is
**persisted** with `notifyStatus = 'failed'` — assert persisted state, not the handler return.

### Success Criteria:

#### Automated Verification:

- Integration + unit tests pass: `pnpm exec vitest run src/lib/leads/`
- Typecheck passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Fire a real lead via the Lead Ads Testing Tool → a row appears in `leads`, a heads-up email arrives,
  `notifyStatus = 'sent'`
- Re-fire the same lead (or replay) → no duplicate row, no second email
- Post a body with a bad/missing signature → 403, nothing stored

**Implementation Note**: After automated verification passes, pause for human confirmation of the live
test-lead check before proceeding.

---

## Phase 4: Submissions Table View

### Overview

A `/zgloszenia` page listing all form submissions (each `leads` row = one submission) with an
inline-editable follow-up status, mirroring the investments table pattern. Nav label "Zgłoszenia".
The code slug stays `leads` (source-agnostic store); only the UI names it "submissions".

### Changes Required:

#### 1. Query

**File**: `src/lib/queries/leads.ts` (new)

**Intent**: Server-side fetch of all submissions for the table, cached + tagged.

**Contract**: `fetchAllLeads(): Promise<LeadRowT[]>` — `requireAuth(MANAGEMENT_ROLES)`,
`getPayload({config})`, `payload.find({ collection: 'leads', sort: '-submittedAt', limit })`, shaped to
`LeadRowT`, wrapped in `unstable_cache` tagged `CACHE_TAGS.leads`.

#### 2. Columns

**File**: `src/lib/tables/leads.tsx` (new)

**Intent**: TanStack column defs including the editable status cell.

**Contract**: export `LeadRowT` and `getLeadColumns({ onToggle })`. Columns: `name`, `email`, `phone`,
`formName`, `submittedAt` (formatted), `contactStatus` (→ `ActiveToggleBadge`, `new` vs `contacted`,
labels "Nowy"/"Skontaktowano", wired to `onToggle`), `notifyStatus` + `autoReplyStatus` (read-only
badges), `isTest` (badge). `meta.align`/`canHide` as in `investments.tsx`.

#### 3. Status server action

**File**: `src/lib/actions/toggle-lead-contact-status.ts` (new)

**Intent**: Persist the inline `contactStatus` toggle.

**Contract**: `toggleLeadContactStatus(id: number, contacted: boolean): Promise<ActionResultT>` —
`'use server'`, `requireAuth(MANAGEMENT_ROLES)`, `payload.update({ collection: 'leads', id, data: {
contactStatus: contacted ? 'contacted' : 'new' } })`, `revalidateCollection('leads')` (the
`updateTag` path — Server Action context). Mirror `toggle-active.ts`.

#### 4. Page + client table + nav

**File**: `src/app/(frontend)/zgloszenia/page.tsx` (new),
`src/components/leads/leads-data-table.tsx` (new), `src/lib/constants/sections.ts`

**Intent**: Render the table and add the nav entry.

**Contract**: server page `requireAuth(MANAGEMENT_ROLES)` → `fetchAllLeads()` → `<PageWrapper
title="Zgłoszenia"><LeadsDataTable data={leads} /></PageWrapper>`. Client `LeadsDataTable` uses
`useOptimisticToggle(data, getContactStatusUpdate, toggleLeadContactStatus)` + `useMemo(getLeadColumns)`

- `<DataTable storageKey="leads" .../>`. Append `{ href: '/zgloszenia', label: 'Zgłoszenia', icon:
<lucide> }` to `SECTION_LINKS`.

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Build passes: `pnpm build`

#### Manual Verification:

- `/zgloszenia` lists captured submissions with all columns; test leads visibly flagged
- Toggling `contactStatus` updates instantly (optimistic) and persists across a refresh
- A non-Management user cannot reach `/zgloszenia`
- Notify + auto-reply status badges render (auto-reply stays `pending`)

**Implementation Note**: After automated verification passes, pause for human confirmation of the UI
check. This is the final phase.

---

## Testing Strategy

### Unit Tests:

- `verify-signature`: valid / tampered / wrong-secret / missing-header (risk 2)
- `lead-schema`: good parse / malformed shapes fail (risk 4)
- `normalize-lead`: typed lift, CUSTOM stays raw, regex fallback, array handling, test-prefix,
  missing-email path (risk 1)

### Integration Tests:

- `store-lead` idempotency: same `(source, externalId)` twice → one row (risk 3)
- captured-but-not-notified: `sendEmail` throws → lead persisted with `notifyStatus = 'failed'` (risk 5)

### Manual Testing Steps:

1. Fire a lead via the Lead Ads Testing Tool → row in `/zgloszenia`, heads-up email, `notifyStatus='sent'`.
2. Re-fire same lead → no duplicate, no second email.
3. POST with a bad signature → 403, nothing stored.
4. Toggle `contactStatus` in `/zgloszenia` → instant + persists.
5. Non-Management user blocked from `/zgloszenia`.

## Performance Considerations

Leads volume is low (tens–hundreds); a single `payload.find` with a sane `limit` + `unstable_cache` is
ample. No virtualization needed initially (`DataTable` supports it later if the list grows).

## Migration Notes

- Local: `pnpm payload migrate` against docker Postgres (5433) after writing the migration.
- **Prod (human only):** apply via `pnpm db:migrate:prod` **before** pushing the code that needs it;
  never run against Neon from the agent.
- **Vercel prod env:** a human adds `LEADS_NOTIFY_EMAIL` (and confirms the META vars) and redeploys —
  env changes don't reach existing deployments.

## References

- Design spec: `docs/superpowers/specs/2026-07-06-leads-capture-design.md`
- Webhook/token/data-shape reference: `docs/facebook-leads-setup.md`
- Collection skeleton: `src/collections/investments.ts`, `src/collections/expense-categories.ts`
- Compound unique index migration: `src/migrations/20260527_add_unique_google_sheet_id.ts:8-18`
- Table pattern: `src/lib/tables/investments.tsx`, `src/components/investments/investment-data-table.tsx`
- Editable status: `src/lib/actions/toggle-active.ts`, `src/hooks/use-optimistic-toggle.ts`
- Email: `src/app/(frontend)/api/test-email/route.ts:59-63`, `src/payload.config.ts:46-58`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename
> step titles. See `references/progress-format.md`.

### Phase 1: Data Model & Config

#### Automated

- [x] 1.1 Types regenerate cleanly (`pnpm generate:types`)
- [x] 1.2 Typecheck passes (`pnpm exec tsc --noEmit`)
- [x] 1.3 Lint passes (`pnpm lint`)
- [x] 1.4 Migration applies to local DB (`pnpm payload migrate`)
- [x] 1.5 `leads` table + compound unique index exist in local DB

#### Manual

- [x] 1.6 `leads` collection visible in admin under its group
- [x] 1.7 Manual row creates; duplicate `(source, externalId)` rejected

### Phase 2: Pure Units (TDD)

#### Automated

- [ ] 2.1 verify-signature / lead-schema / normalize-lead unit tests pass
- [ ] 2.2 Typecheck passes
- [ ] 2.3 Lint passes

#### Manual

- [ ] 2.4 Normalize fixtures spot-checked against the real dump

### Phase 3: Persistence, Notify & Webhook Wiring

#### Automated

- [ ] 3.1 Integration + unit tests pass (`pnpm exec vitest run src/lib/leads/`)
- [ ] 3.2 Typecheck passes
- [ ] 3.3 Lint passes

#### Manual

- [ ] 3.4 Live test lead → row + email + `notifyStatus='sent'`
- [ ] 3.5 Re-fired lead → no duplicate, no second email
- [ ] 3.6 Bad signature → 403, nothing stored

### Phase 4: Submissions Table View

#### Automated

- [ ] 4.1 Typecheck passes
- [ ] 4.2 Lint passes
- [ ] 4.3 Build passes (`pnpm build`)

#### Manual

- [ ] 4.4 `/zgloszenia` lists submissions with all columns; test leads flagged
- [ ] 4.5 contactStatus toggle instant + persists
- [ ] 4.6 Non-Management user blocked from `/zgloszenia`
- [ ] 4.7 Notify + auto-reply badges render (auto-reply stays `pending`)
