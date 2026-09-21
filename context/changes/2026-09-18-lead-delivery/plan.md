# Lead Delivery — wykonczymy side — Implementation Plan

## Overview

Open an authenticated JSON intake so the `landing_26` contact form lands in `leads` with its
attachments, and give `investments` the file relation it has never had, so a lead can be promoted
into an investment that carries the visitor's photos without copying a single byte.

The files never travel through a function body: the browser uploads them straight to Blob, and the
webhook receives signed URLs it resolves server-side. That is forced by the 4.5 MB Vercel
request-body cap — see Critical Implementation Details.

Two deliverables, sequenced assets-first: the investment side is useful on its own (today an
investment accepts no images at all), and the promotion in the second half has nowhere to land
without it.

## Current State Analysis

**Leads intake exists and is mature.** `captureLead` (`src/lib/leads/capture-lead.ts:57`) is
store-then-notify with ×3 retry per channel, dedup on `(source, externalId)` via the unique index
`leads_source_external_id_idx` (`src/migrations/20260707_0_add_leads.ts:43`), and settled
`notifyStatus` / `autoReplyStatus` so a redelivery re-sends nothing. Two webhooks feed it — Meta
(HMAC, `facebook-leads/route.ts`) and WPForms (plain shared secret, `wpforms/route.ts`). **Both are
JSON-only**: neither reads a file, and no endpoint in the app accepts an unauthenticated multipart
body.

**`leads.source` already has two values**, not one: `facebook_lead_ads | website_form`
(`src/collections/leads.ts:5-8`). `landing_form` is a third.

**An upload pipeline already exists end to end, and nothing in it is invoice-specific.** Client
ingest classifies → HEIC-converts → compresses → size-guards at `MAX_UPLOAD_BYTES = 4MB`
(`src/lib/utils/process-upload-file.ts:8`), uploads one file per request to `POST /api/upload-file`
(`src/app/(frontend)/api/upload-file/route.ts:18`, `requireAuth(MANAGEMENT_ROLES)`), which calls
`uploadFile()` → `payload.create({ collection: 'media', file: {...} })`, and a server action then
attaches the returned ids. Every failure path runs `discardOrphanedUploads` because Blob has no
undelete. Four surfaces use it: transfers invoice cell, edit-transfer form, bulk expense rows,
vehicle inspections.

**`media` is the only blob-backed collection** (`src/payload.config.ts:112-121`), already accepts
`image/*` + `application/pdf`, already generates a 400×300 `thumbnail`, and has **no `beforeDelete`
guard** at all.

**The reference counter is already broken.** `deleteUnreferencedMedia`
(`src/lib/invoices/delete-unreferenced-media.ts:29-37`) counts `transactions` and
`vehicle-inspections` only. `equipment-events.attachments` (`src/collections/equipment-events.ts:102`)
was added later and is **not** counted — its files are deletable out from under it today. The
function's own doc comment says a third collection "must be added here too, or it loses its files to
this function"; the comment was written and then not honoured. Adding two more relations to a
hand-maintained list repeats that.

**`investments` has zero relationship fields.** All 15 are scalar (`src/collections/investments.ts:59-174`),
so there is no `investments_rels` table at all. It is also the app's heaviest object:
`guardInvestmentStatusUnlock` on `beforeChange`, `preventDeleteWithTransactions` on `beforeDelete`.

**`fetchReferenceData()` is a cached list of ALL investments** and is what
`/inwestycje/[id]/page.tsx:48` reads the current investment out of. Asset rows must not be added to
it.

## Desired End State

- A visitor submits the landing form with photos; the enquiry appears in `/zgloszenia` with its
  attachments visible in the answers dialog, tagged `Strona docelowa`.
- A manager opens that lead, clicks **Utwórz inwestycję**, reviews the prefilled form, submits — and
  the new investment page shows the visitor's photos. The bytes were written once, at intake.
- Any investment can be given photos and PDFs from its detail page, its edit dialog, and the create
  dialog, rendered as thumbnails with a lightbox.
- Deleting a file that a live investment (or transfer, inspection, equipment event, or lead) points
  at is refused, and the orphan cleaner can no longer forget a relation.

**Verification:** a real submission from the deployed landing arrives complete; `pnpm test` green;
`pnpm db:migrate:prod` applied by a human before the deploy that reads the new columns.

### Key Discoveries

- `makePreventDelete` (`src/hooks/prevent-delete.ts:37`) already takes a probe list and composes a
  Polish refusal — four collections use it. `media` is not one of them.
- Migration convention for a new `_rels` table, including the mandatory
  `payload_locked_documents_rels` column: `src/migrations/20260903_0_add_equipment.ts:90-126`.
  Enum-value convention: `src/migrations/20260914_0_add_szablon_investment_status.ts:10-23`.
- `investments` and `leads` already own `payload_locked_documents_rels` columns — only the two
  `_rels` tables are new.
- `addTransferInvoicesAction` (`src/lib/actions/transfers.ts:360`) takes the **whole batch** on
  purpose, to dodge the read-modify-write race that a per-file action would have. The investment
  equivalent copies that shape.
- Client-direct-to-Blob (`upload()` / `handleUpload` from `@vercel/blob/client`) is Vercel's own
  documented answer to the 4.5 MB cap, and `onBeforeGenerateToken` enforces size and content-type
  **at the storage layer**. Its `onUploadCompleted` callback does **not** fire on localhost —
  Blob cannot reach a dev machine — so nothing may depend on it in dev.
- **The Vercel request-body cap is 4.5 MB and still is** (verified 2026-09-20 against
  `vercel.com/docs/functions/limitations`, `last_updated: 2026-08-24` — 413
  `FUNCTION_PAYLOAD_TOO_LARGE`). It applies to **every** function: Server Actions, Route Handlers,
  middleware alike. `next.config.ts:12-15` already says so and is correct. A route handler escapes
  only Next's own `serverActions.bodySizeLimit` (1 MB default), never the platform cap. This killed
  the first draft of Phase 5 — see Critical Implementation Details.
- **PDFs are the only thing that trips the 4 MB guard.** `processUploadFile` opens with
  `if (!isImageFile(file)) return guardSize(file)` — a PDF skips compression entirely. EX-457's
  manual checks put a 47 MB JPEG and a 45 MB HEIC through and both passed (CompressorJS takes them
  to ~128 KB). So an intake capped at 4 MB per file rejects exactly the multi-page scans and
  designer decks that `change.md` calls the substance of an enquiry.

## What We're NOT Doing

- **No second upload collection.** Reversed decision — see "Decision reversal" below.
- **No automatic lead → investment creation.** A human reviews every promotion.
- **No landing-side work.** The form's address field, the `submissions` queue, the retry cron, the
  blob store, the token route and the forward are `landing_26`'s half of this change. This plan owns
  only the receiver, plus the wire contract both sides must agree on.
- **No backfill.** Existing `website_form` leads are not re-tagged and get no attachments.
- **No `kind` at intake.** The visitor does not classify files; staff set `kind` later.
- **No retention/deletion policy for lead photos** (landing roadmap OQ 7) — a policy decision, not a
  build one.
- **No private Blob store.** Bytes stay on public blob URLs, as every invoice already is. Worth
  revisiting later — Blob now supports `access: 'private'`, and client uploads make it no harder —
  but changing it for lead photos alone would split the media library across two access models.

## Decision reversal — record before coding

`change.md` records, 2026-09-18: _"assets are generic; one upload collection serves both sides …
Not `media` — that is the invoice library under the 'Finanse' admin group."_ That decision is
**overturned**: the objection was an admin-panel labelling concern, and the evidence against it is
structural — the entire pipeline (`process-upload-file`, `/api/upload-file`, `uploadFile`,
`discardOrphanedUploads`, the blob plugin entry, the thumbnail size) is generic, and a second
collection would fork `deleteUnreferencedMedia` into two hand-maintained reference counters when the
one that exists has already silently missed a relation. The labelling concern is answered by a
`kind` field, which is cheaper than a collection.

`change.md`'s own rule: _"a decision recorded on one side is not agreed until it reads the same on
the other."_ So this rewrite lands in **both** `wykonczymy` and `landing_26` copies, with the
reason, before Phase 1 code.

## Implementation Approach

Assets first (Phases 1–3), because promotion has nothing to attach to until `investments.assets`
exists and because that half ships value on its own. Intake second (Phases 4–5). Promotion last
(Phase 6), since it is the only piece that needs both halves.

Migrations are additive throughout — every one of them adds a column, an enum value or a table, so
per the AGENTS.md ordering rule each is applied to prod **before** the deploy that reads it.

## Critical Implementation Details

**The transport is signed JSON carrying blob URLs — not multipart, and not because multipart is
hard.** Multipart was verified to work (see Rejected Alternative below); it is capacity that fails.
The Vercel request-body cap is **4.5 MB on every function**, so no arrangement of a
browser → landing → wykonczymy push can carry 15 × 8 MB. The fix is topological:

```
  BROWSER                    LANDING FN            BLOB STORE          WYKONCZYMY FN
  1  ├── POST /api/upload ──────►│  form data, ~2 KB   │                     │
  2  │◄── signed token ──────────┤  ~300 B             │                     │
  3  ├───────── PUT 40 MB PDF ───┼────────────────────►│   no function here  │
  4  │◄──────── blob url ────────┼─────────────────────┤                     │
  5  ├── POST form {urls[]} ────►│  ~2 KB              │                     │
  6  │◄── „Dziękujemy" ──────────┤                     │                     │
  7  │                           ├── signed JSON ──────┼────────────────────►│  ~2 KB
  8  │                           │                     │◄── GET the bytes ───┤  40 MB, OUTBOUND
```

**The rule that makes it work: the cap is on what a function _receives_, never on what it
_fetches_.** Step 8 pulls 40 MB into a function and is bounded only by duration (300s) and memory
(2 GB). Step 3 bypasses functions entirely — an HTTPS PUT to object storage, chunked by
`upload()` from `@vercel/blob/client` when `multipart: true`.

**Consequences for this repo, all simplifying:**

- The body is JSON, so `request.text()` is correct again and `verifySignature`
  (`src/lib/leads/verify-signature.ts:8`) needs **no change** — it already takes a string.
- `wpforms/route.ts` becomes a near-exact template, HMAC swapped for its plain secret compare.
- Per-file and per-type limits move to `onBeforeGenerateToken` on the landing, where **Blob
  enforces them server-side** (`maximumSizeInBytes`, `allowedContentTypes`). That is strictly
  stronger than a ceiling we check after the bytes have already arrived.

**SSRF — the new risk this topology introduces.** wykonczymy now fetches URLs supplied by another
service. The HMAC proves the landing sent them, not that they are safe: a bug or a compromise on
that side turns our webhook into a request forwarder aimed at anything, including internal
addresses. **Allowlist the host** before fetching — it must be the landing's
`*.public.blob.vercel-storage.com` store, matched on the parsed `URL.hostname`, never on
`startsWith`. Reject anything else with a 400 and an alert. This is not optional and has no
equivalent in the multipart design, where the bytes arrived inline.

**Bound the download too.** An allowlisted host can still serve something enormous. Check
`content-length` before reading, cap the accumulated bytes while reading (the header is a claim,
not a guarantee), and abort past `MAX_ASSET_BYTES`. Failing that, one submission can exhaust the
function's memory.

**The form is filled before a byte is stored — the landing's half, recorded here because it is the
only thing standing between a public endpoint and free storage.** A marketing form has no user to
authenticate, so the gate is form _validity_: the token route passes the submitted fields in
`clientPayload` and re-runs the **same zod schema server-side** inside `onBeforeGenerateToken`,
minting a token only if it passes. A bot must therefore produce a complete, valid enquiry before it
can touch the store, and rate limiting becomes defence in depth rather than the only wall. The cost
is a deliberate UX order: files upload **on submit**, not on pick, so the visitor waits once at the
end rather than seeing progress bars while still typing. Never mint a token from an unvalidated
payload — `clientPayload` is client-supplied and is exactly as trustworthy as the caller.

**Serial media writes.** `deleteUnreferencedMedia`'s doc comment records that concurrent Payload
writes on Neon share a session and silently commit only one. Download may be concurrent; the
`payload.create` calls that follow are **one at a time**, never `Promise.all`.

**Duration budget.** 15 files × (download + re-upload) inside one 300s invocation. Comfortable for
photos, tight only for a pathological set of large PDFs — which is why the failure path stores the
lead and alerts rather than failing the request.

### Rejected alternative: multipart forward

Kept here because it was built far enough to verify, and the verification is reusable if the
platform cap ever moves. The mechanism is sound — proven in Node 24 with a deliberately non-UTF-8
payload: HMAC over `arrayBuffer()` bytes matches, the file round-trips byte-identical, and the
three failure modes all behave (`request.text()` inflates 4400 → 7780 bytes on U+FFFD substitution
and breaks the digest; a content-type without the boundary throws `Failed to parse body as
FormData`; a second read throws `Body is unusable`). It fails only on capacity: 4.5 MB total,
which rejects multi-page scans and designer decks.

## Phase 1: `media.kind` + delete safety

### Overview

Make `media` able to say what a file is, stop it being deleted out from under a live record, and
replace the hand-maintained reference list with one registry that cannot be forgotten.

### Changes Required:

#### 1. `kind` field on media

**File**: `src/collections/media.ts`

**Intent**: A `select` naming what the file is, so the invoice library and client-facing photos stay
distinguishable in `/admin` now that they share a collection. Added to `admin.defaultColumns`.

**Contract**: `kind`, `select`, not required, no default (existing rows stay null — they are
invoices by provenance, but back-filling a guess is worse than a blank). Options
`faktura | projekt | zdjecie | inne` with Polish labels.

#### 2. Relation registry

**File**: `src/lib/media/relating-collections.ts` (new)

**Intent**: One exported list naming every collection+field that points at `media`. Both the
prevent-delete probes and the orphan counter derive from it, so adding a relation in a later phase
is one line in one place instead of two edits someone forgets.

**Contract**: `MEDIA_RELATIONS: readonly { collection: CollectionSlug; field: string; label: string }[]`
— `label` is the Polish noun `makePreventDelete` interpolates. Initial entries: `transactions.invoice`
(„transakcje"), `vehicle-inspections.attachments` („przeglądy"), `equipment-events.attachments`
(„przekazania sprzętu").

#### 3. Orphan counter driven by the registry

**File**: `src/lib/invoices/delete-unreferenced-media.ts`

**Intent**: Replace the two hardcoded `payload.count` calls with a loop over `MEDIA_RELATIONS`. This
fixes the live `equipment-events` leak. Keep the serial-per-id loop and the best-effort `try/catch`
verbatim — both are load-bearing and their reasons are already documented in the file.

**Contract**: signature unchanged. The doc comment's "both collections that relate to `media`"
paragraph is replaced by a pointer to the registry.

#### 4. Prevent-delete on media

**File**: `src/collections/media.ts`

**Intent**: A `beforeDelete` hook refusing to delete a file anything still points at — the hazard the
file's own `transactions_rels` comment describes, currently unguarded.

**Contract**: `makePreventDelete({ probes: MEDIA_RELATIONS.map(…), message })` in Polish, matching the
phrasing of `preventDeleteWithTransactions` (`src/collections/investments.ts:24`). Note the
interaction: `deleteUnreferencedMedia` only deletes rows with zero references, so the new hook never
fires on that path — it guards `/admin` and any direct `payload.delete`.

#### 5. Migration

**File**: `src/migrations/<date>_0_media_kind.ts` (new, hand-written)

**Contract**: `CREATE TYPE enum_media_kind` guarded by the `DO $$ … pg_type` block;
`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "kind" "enum_media_kind"` (nullable). `down` drops the
column only — Postgres has no `DROP VALUE`, and the type drop is safe here since the type is new;
follow whichever the neighbouring migrations do.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/hooks/prevent-delete.test.ts` still passes with the new media probes
- New spec: `deleteUnreferencedMedia` keeps a file referenced by `equipment-events` (the regression
  the registry fixes) and deletes one referenced by nothing
- New spec: deleting an attached media row throws, naming the blocking collection
- `pnpm exec vitest run src/__tests__/lib/invoices/` passes

#### Manual Verification:

- `/admin` media list shows the `kind` column and filters by it
- Deleting an invoice attached to a transfer is refused with a readable Polish message

---

## Phase 2: `investments.assets` relation

### Overview

Give investments their first relationship field and the server actions that write it.

### Changes Required:

#### 1. `assets` field

**File**: `src/collections/investments.ts`

**Intent**: A `hasMany` upload relation to `media` holding the investment's photos and documents.

**Contract**: `assets`, `type: 'upload'`, `relationTo: 'media'`, `hasMany: true`, Polish label
„Zdjęcia i pliki". Placed after `review`, before `status`.

#### 2. Registry entry

**File**: `src/lib/media/relating-collections.ts`

**Contract**: append `investments.assets` („inwestycje"). Both the prevent-delete probe and the
orphan counter pick it up with no further edit — that is the point of Phase 1.

#### 3. Attach / detach actions

**File**: `src/lib/actions/investments.ts`

**Intent**: Add and remove asset ids on an existing investment, following the transfer-invoice
shape exactly.

**Contract**: `addInvestmentAssetsAction(investmentId, mediaIds: number[])` — takes the whole batch,
read-modify-write under `protectedAction`, `MANAGEMENT_ROLES`. `removeInvestmentAssetAction(investmentId, mediaId)`
— awaits `deleteUnreferencedMedia` on the dropped id after the update, as `setTransferInvoices`
(`src/lib/actions/transfers.ts:346`) does. Both revalidate `CACHE_TAGS.investments` +
`entityTag('investments', id)`. A `completed` investment is **not** refused — the status lock freezes
financial state, not documentation.

#### 4. `createInvestmentAction` accepts assets

**File**: `src/lib/actions/investments.ts`, `src/components/forms/investment-form/investment-schema.ts`

**Intent**: Files picked on the create form are uploaded before submit (the existing ingest pattern),
so the action receives ids and writes them with the row.

**Contract**: `assets: z.array(z.number()).default([])` on `investmentSchema`, mirroring
`inspection-schema.ts:38`. It IS an investments column, so unlike `presetId` it is not stripped.

#### 5. Migration

**File**: `src/migrations/<date>_1_investments_assets.ts` (new, hand-written)

**Contract**: `CREATE TABLE "investments_rels"` in the shape of `equipment_events_rels`
(`src/migrations/20260903_0_add_equipment.ts:90-107`) — `id serial PK`, `order`, `parent_id`
→ `investments(id) ON DELETE cascade`, `path varchar NOT NULL`, `media_id` → `media(id) ON DELETE cascade`,
plus the four indexes. `investments` already has its `payload_locked_documents_rels` column, so
nothing there changes. `down` drops the indexes then the table.

### Success Criteria:

#### Automated Verification:

- DB spec: attaching two media ids to an investment persists both in order; removing one leaves the
  other and deletes the now-unreferenced media row
- DB spec: `makePreventDelete` refuses to delete a media row an investment points at
- `pnpm exec vitest run src/__tests__/lib/actions/` passes

#### Manual Verification:

- An investment shows its attached files in `/admin` after the action writes them

---

## Phase 3: Investment assets UI

### Overview

Thumbnails with a lightbox on the detail page, plus attach in the edit and create dialogs.

### Changes Required:

#### 1. Lightbox primitive

**File**: `src/components/ui/media-lightbox.tsx` (new)

**Intent**: Domain-agnostic viewer — a full-size overlay over a list of media, with prev/next and
Escape. Lives in `ui/` because it knows nothing about investments; per the AGENTS.md rule it must not
import a feature directory.

**Contract**: takes `items: { id, url, mimeType, alt }[]` and an open index. Built on the existing
Radix `Dialog` primitive rather than a new dependency.

#### 2. Asset gallery

**File**: `src/components/investments/investment-assets.tsx` (new)

**Intent**: The strip itself — image thumbnails via `media.sizes.thumbnail`, PDFs as a file chip,
an attach control and a per-file remove, wired to the Phase-2 actions.

**Contract**: client component; ingest via `useFilePickIngest` (`forms/hooks/`) + `submitWithInvoicePages`,
the same custody + orphan-cleanup path the other four surfaces use. `next/image` `sizes` must match
the rendered thumbnail width at each breakpoint — the scale here is `sm`=768 / `md`=1024 / `lg`=1280,
not Tailwind's stock.

#### 3. Detail-page section

**File**: `src/app/(frontend)/inwestycje/[id]/page.tsx`

**Intent**: Render the gallery between `InfoList` and the stats toggle, in its own `Suspense` so it
never blocks first paint — the pattern `InvestmentSummaryPanel` already uses.

**Contract**: the assets are **not** added to `fetchReferenceData()`; the section fetches its own
investment-with-assets read (`src/lib/queries/`, `unstable_cache`, tagged
`entityTag('investments', id)`).

#### 4. Dialogs

**File**: `src/components/dialogs/add-investment-dialog.tsx`,
`src/components/dialogs/edit-investment-dialog.tsx`, `src/components/forms/investment-form/investment-form.tsx`

**Intent**: A file picker on the shared form so files can be attached at create time and at edit
time, not only from the detail page.

**Contract**: `EMPTY_DEFAULTS` gains `assets: []`. The form holds `File[]` outside the form value
(unserialisable for drafts — the reason `use-file-pick-ingest.ts:12-14` records) and resolves them to
ids in the submit path.

### Success Criteria:

#### Automated Verification:

- DOM spec: the gallery renders an empty state with no assets, a thumbnail per image, a chip per PDF
- DOM spec: the lightbox opens on a thumbnail click, steps next/prev, and closes on Escape
- `pnpm exec vitest run --project dom src/__tests__/components/investments/` passes

#### Manual Verification:

- Attach three photos + a PDF from the detail page; they appear without a reload
- Attach a photo while creating a new investment; it is on the new investment's page
- The strip does not overflow horizontally at 375px
- A HEIC photo from an iPhone converts and uploads

---

## Phase 4: Leads schema for the landing

### Overview

The columns, the enum value and the two relations the intake will write.

### Changes Required:

#### 1. New fields

**File**: `src/collections/leads.ts`

**Contract**:

- `source` gains `landing_form` („Strona docelowa").
- `address`, `scope`, `area` — all `text`. `area` is text deliberately: the field's label invites a
  range („np. 30–60 m²"), which no numeric column holds.
- `assets` — `upload` → `media`, `hasMany`.
- `investment` — `relationship` → `investments`, `hasMany: false`, `admin.readOnly` (written only by
  the promotion action).
- The three text fields and `assets` carry `admin.condition` hiding them for `facebook_lead_ads`
  leads, which can never have them.

#### 2. Input type

**File**: `src/lib/leads/store-lead.ts`

**Contract**: `StoreLeadInputT` gains `address?`, `scope?`, `area?`, `assets?: number[]`; `source`
widens to include `'landing_form'`. `storeLead`'s create data passes them through. The dedup path
(`findExisting`, the unique-index race recovery) is untouched.

#### 3. Registry entry

**File**: `src/lib/media/relating-collections.ts`

**Contract**: append `leads.assets` („zgłoszenia").

#### 4. Migration

**File**: `src/migrations/<date>_2_leads_landing.ts` (new, hand-written)

**Contract**: `ALTER TYPE "enum_leads_source" ADD VALUE IF NOT EXISTS 'landing_form'` (the
`20260709_2` pattern); three `ADD COLUMN IF NOT EXISTS … varchar`; `CREATE TABLE "leads_rels"` in the
equipment shape with **two** relation columns — `media_id` → `media(id) ON DELETE cascade` and
`investments_id` → `investments(id) ON DELETE cascade` — plus indexes for both. `leads` already owns
its `payload_locked_documents_rels` column.

Note the asymmetry: `investments_id ON DELETE cascade` means deleting an investment silently drops
the provenance link. That is correct — the link is a pointer, not a record worth blocking a delete
over, and `preventDeleteWithTransactions` already guards the investment itself.

### Success Criteria:

#### Automated Verification:

- `pnpm generate:types` produces `Lead` with the five new fields (types are gitignored — verify, do
  not commit)
- DB spec: a lead round-trips `address` / `scope` / `area` and a two-file `assets` list
- Existing lead specs still pass unchanged: `pnpm exec vitest run src/__tests__/leads/`

#### Manual Verification:

- In `/admin`, a Facebook lead does not show the three landing-only fields; a landing lead does

---

## Phase 5: `POST /api/webhooks/landing`

### Overview

Signed JSON in, blob URLs resolved to `media` rows server-side, then `captureLead`.

### Changes Required:

#### 1. Wire schema + shared fixture

**File**: `src/lib/leads/landing.ts` (new), `src/__tests__/fixtures/landing-submission.ts` (new)

**Intent**: The envelope both repos must agree on, duplicated rather than packaged (the recorded
2026-09-18 decision) and pinned by a fixture committed byte-identically in both repos.

**Contract**: `landingSubmissionSchema` — strict on the envelope, permissive on the tail, the rule
`leadSchema` already follows. Envelope: `submissionId` (uuid → `externalId`), `locale`,
`submittedAt`, `formId`/`formName`, the typed answers (`name`, `email`, `phone`, `address`, `scope`,
`area`, `message`), `rawData` + `formQuestions` in the shape `buildLeadAnswers` already parses, and
**`assets: { url, filename, contentType, size }[]`**. Plus `landingToStoreLeadInput(submission,
mediaIds)`, mirroring `wpformsToStoreLeadInput`.

`size` is declared by the sender and is a hint, not a guarantee — it lets us reject an
over-ceiling asset before spending a round trip, but the download still counts bytes itself.

#### 2. Constants

**File**: `src/lib/leads/landing.ts`

**Contract**: `MAX_LANDING_ASSETS = 15`, `MAX_ASSET_BYTES = 8 * 1024 * 1024`,
`LANDING_BLOB_HOST` — the exact hostname of the landing's blob store, from
`serverEnv.LANDING_BLOB_HOST` so it differs between preview and production without a code change.
Accepted types mirror `media.mimeTypes`: `image/*`, `application/pdf`.

These are a **second** line of defence. The binding limits live in the landing's
`onBeforeGenerateToken`, where Blob refuses an over-size or wrong-type upload before it exists.

#### 3. Asset fetcher

**File**: `src/lib/leads/fetch-landing-asset.ts` (new)

**Intent**: Turn one allowlisted URL into one `media` row, with the host and size guards that make
fetching a foreign URL safe.

**Contract**: `fetchLandingAsset(payload, asset) => Promise<number>` (the media id).

1. Parse with `new URL()`; **reject unless `url.hostname === LANDING_BLOB_HOST` and the protocol is
   `https:`** — exact match on the parsed hostname, never `includes`/`startsWith`, which
   `evil.com/?x=blob.vercel-storage.com` defeats.
2. `fetch` with a timeout signal; reject a non-2xx, a `content-length` over `MAX_ASSET_BYTES`, and
   a `content-type` outside the allowlist.
3. Read into a buffer counting bytes, aborting past the ceiling regardless of what the header
   claimed.
4. `uploadFile()`-equivalent `payload.create({ collection: 'media', file: {...} })`, reusing
   `uniqueFileName`. `kind` is left unset — staff classify at promotion.

Redirects are **not** followed (`redirect: 'error'`): a redirect off an allowlisted host is exactly
the SSRF bypass the allowlist exists to stop.

#### 4. The route

**File**: `src/app/(frontend)/api/webhooks/landing/route.ts` (new)

**Intent**: Verify, parse, resolve assets, capture the lead. Store-then-notify by construction —
`captureLead` runs last and owns the e-mails.

**Contract**: `const raw = await request.text()` (JSON — safe here, unlike the rejected multipart
draft) · HMAC via `verifySignature(raw, request.headers.get('x-landing-signature'),
serverEnv.LANDING_WEBHOOK_SECRET)`, `403` on failure · `400` + `notifyShapeAlert` on a schema
failure · assets resolved **serially** through `fetchLandingAsset`, failures collected rather than
thrown · `captureLead(payload, landingToStoreLeadInput(parsed, mediaIds))` with default options so
both e-mails send · `revalidateTag(CACHE_TAGS.leads, EXPIRE_NOW)` — `revalidateTag`, not
`updateTag`, this is a Route Handler · `200 { received: true }`.

**Partial asset failure**: the lead is stored with whatever resolved, an ops alert names what did
not, and the answer is still `200` so the landing clears its queue row. Losing the enquiry is the
outcome the whole queue exists to prevent; an incomplete photo set is the lesser failure, and the
alert makes it visible.

**Recovery is better than it was under multipart**: a failed asset's URL is still live in the
landing's store until that queue row is deleted, so the alert can carry the URL and the file can be
attached by hand. The multipart draft had no such second chance — the bytes were gone with the
request.

#### 5. Alert

**File**: `src/lib/leads/notify.ts`

**Contract**: `notifyAssetFailure(payload, { submissionId, failed: { url, reason }[], stored })` to
`opsAlerts`, in the existing `renderBrandedEmail` shape. Separate from `notifyShapeAlert` — the
subject must say the lead arrived and is incomplete, not that a shape drifted.

#### 6. Env

**File**: `src/lib/env/schema.ts`, `.env`

**Contract**: `LANDING_WEBHOOK_SECRET: z.string().min(1)` and `LANDING_BLOB_HOST: z.string().min(1)`
beside `WPFORMS_WEBHOOK_SECRET:81`. Both required — a missing host allowlist must fail the boot, not
default to "allow".

#### 7. Contract doc

**File**: `context/reference/landing-intake-contract.md` (new, mirrored in `landing_26`)

**Intent**: The one artifact both repos read. Names the envelope, the header, the ceilings, the
failure answers, and the two rules that live on the landing side: **the token is minted only after
the form validates server-side**, and the blob host must match what wykonczymy allowlists.

### Success Criteria:

#### Automated Verification:

- Route spec (mirroring `src/__tests__/leads/wpforms-route.test.ts`): 403 on a bad signature · 403
  on a missing one · 400 + alert on a bad envelope · 200 capturing as `landing_form` with two
  assets attached · 200 + `notifyAssetFailure` when one asset fails · redelivery of the same
  `submissionId` creates no second lead and sends no second e-mail
- **SSRF spec** — `fetchLandingAsset` rejects: a different host, `http:`, a redirect off the
  allowlisted host, `http://169.254.169.254/...` (link-local), and a hostname that merely _contains_
  the allowlisted string
- Size spec: an oversized `content-length` is rejected without reading the body; a lying
  `content-length` is caught by the byte counter mid-read
- Unit spec for `landingToStoreLeadInput`, mirroring `src/__tests__/leads/wpforms.test.ts`
- Fixture parses and a signature computed over the serialised fixture verifies
- `pnpm exec vitest run src/__tests__/leads/` passes

#### Manual Verification:

- A signed JSON POST from `curl`, pointing at a real blob URL, creates a lead with its files
- The same request replayed creates nothing and sends nothing
- A request whose `assets[].url` points off-host is refused and alerts
- A tampered body is refused

## Phase 6: Promotion

### Overview

Lead → investment, carrying the files as a relation.

### Changes Required:

#### 1. Attachments in the answers dialog

**File**: `src/components/leads/lead-answers-dialog.tsx`, `src/lib/queries/leads.ts`,
`src/types/leads.ts`

**Intent**: Show a lead's files where its answers are read. Reuses the Phase-3 gallery in a
read-only mode rather than growing a second thumbnail renderer.

**Contract**: `LeadRowT` gains `assets` and `investmentId`. `getLeadsPage` projects them — note it
already computes `answers` for every row on the page, so this is the same shape of work; keep
`depth: 0` and read the ids, resolving urls in one batched media query rather than raising `depth`.

#### 2. Promotion trigger

**File**: `src/components/leads/promote-lead-dialog.tsx` (new), `src/components/tables/leads.tsx`

**Intent**: A „Utwórz inwestycję" action beside „Szczegóły" that opens the existing create form with
the lead's data prefilled and its file ids carried along.

**Contract**: renders `InvestmentForm` inside `FormDialog` with defaults mapped
`name ← lead.name` · `address ← lead.address` · `phone` · `email` · `contactPerson ← lead.name` ·
`notes ← scope + area + message`, joined with labels. Hidden (or shown as a link to the investment)
when `lead.investmentId` is already set. The human edits before submitting — that is the "never
automatically" decision made concrete.

#### 3. Promotion action

**File**: `src/lib/actions/promote-lead.ts` (new)

**Intent**: One action creating the investment, attaching the lead's assets, and recording
provenance.

**Contract**: `promoteLeadAction(leadId, data: InvestmentFormDataT)` under `protectedAction`,
`MANAGEMENT_ROLES`. Creates via the same path as `createInvestmentAction` (extract the shared body
rather than duplicating it — the preset-seed warning behaviour must not fork), passing the lead's
asset ids as `assets`. Then updates the lead: `investment` ← the new id, `contactStatus` ←
`'contacted'`. Revalidates `['investments', 'leads']`.

**The bytes are not copied.** Both rows point at the same `media` ids, which is the whole reason for
one shared collection. The Phase-1 prevent-delete guard is what makes that safe: deleting the lead no
longer strips the investment's photos.

### Success Criteria:

#### Automated Verification:

- DB spec: promoting a lead with two files creates an investment holding **the same two media ids**
  (asserted by id, not count — a copy would pass a count assertion), sets `leads.investment`, and
  flips `contactStatus` to `contacted`
- DB spec: deleting the promoted lead afterwards leaves both media rows and the investment's
  relation intact
- DOM spec: the promote dialog prefills name/address/phone/email from the lead
- `pnpm exec vitest run src/__tests__/lib/actions/promote-lead.test.ts` passes

#### Manual Verification:

- Promote a landing lead end to end; the new investment page shows the visitor's photos
- The promoted lead shows as contacted and offers a link to the investment instead of the button
- The nav's unread-leads badge drops by one

**Implementation Note**: when a phase's automated verification passes, commit and continue — manual
verification is collected once, at the end, into `context/foundation/manual-checks.md`.

---

## Testing Strategy

Route by risk, not by file, per AGENTS.md. The cheapest layer that gives a real signal wins.

### Unit (node)

Pure mapping and policy: `landingToStoreLeadInput`, the registry-driven orphan counter, the
prevent-delete probe composition, and — most importantly — `fetchLandingAsset`'s host allowlist and
size guards. The SSRF cases are cheap unit tests and there is no reason to buy them at a higher
layer.

### DB-backed (node, 5435 `db-test`)

Everything that turns on a real relation or a real unique index: the `investments_rels` and
`leads_rels` round-trips, the promotion's shared-media assertion, the redelivery idempotency. These
live under the tree `scripts/test-integration.sh` greps, so they must be under `src/__tests__/**`
mirroring their source path in full.

### DOM (jsdom)

The gallery's empty state, the lightbox's keyboard behaviour, the promote dialog's prefill. Note
`'use server'` modules are stubbed and **throw** when called — assert the UI on the way to the
action, or `vi.mock` it.

### E2E

One risk genuinely crosses client → server action → DB → revalidation and is worth a browser: attach
a file to an investment and see it survive a reload. **Do not run the suite unprompted** — author the
spec or defer it to the `e2e-backlog` Linear label at the review gate.

### Manual

The `curl` signature checks in Phase 5 and the end-to-end promotion in Phase 6 are the two that no
automated layer covers cheaply.

## Performance Considerations

- The detail-page gallery streams in its own `Suspense` and must not enter `fetchReferenceData()`,
  which is a cached list of every investment.
- `getLeadsPage` already builds `answers` for all 50 rows on a page; resolving asset urls must be one
  batched media query, not `depth: 1` on the lead find.
- The webhook streams each asset in and straight back out to Blob, one at a time, so peak memory is
  one file (≤8 MB), not the whole set. 15 files × (download + re-upload) must fit the 300s duration;
  comfortable for photos, tight only for a pathological set of large PDFs — which is why a timeout
  stores the lead and alerts rather than failing the request.
- Media creation in the webhook is serial on purpose — concurrent Payload writes on Neon share a
  session and silently commit one.

## Migration Notes

Three additive migrations, hand-written (AGENTS.md: `migrate:create` emits phantom drift). All are
**additive**, so the order is: apply to prod **before** pushing the code that reads them. A human runs
`pnpm db:migrate:prod`; the agent never does.

**Each one must also be registered in `src/migrations/index.ts`** — the file is a hand-maintained
array of `{ up, down, name }`, and a migration that is written but not listed there simply never
runs. `migrate:create` is what normally appends the entry, and it is the tool this repo does not
use. Latest entry today: `20260915_0_transactions_amount_sort_index`.

`LANDING_WEBHOOK_SECRET` and `LANDING_BLOB_HOST` must exist in Vercel before the deploy that ships
Phase 5, or boot fails. `LANDING_BLOB_HOST` differs between preview and production — pointing
production at the preview store's host would make every real submission's assets unfetchable.

Existing data is untouched: no `website_form` lead is re-tagged, no media row gets a `kind`.

## Whole-tree Gate

Run **once**, after Phase 6.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full suite passes: `pnpm test`
- Build succeeds: `pnpm build`
- Golden master unaffected: `pnpm test:parity`

## References

- Shared change identity (both repos): `context/changes/2026-09-18-lead-delivery/change.md`
- Landing side: `/workspace/yolo/landing_26` — `context/foundation/roadmap.md` S2 (north star) and S6
- Upload pipeline to copy: `src/lib/invoices/submit-with-invoice-pages.ts`,
  `src/hooks/use-invoice-upload.ts`
- Webhook to mirror: `src/app/(frontend)/api/webhooks/wpforms/route.ts` + its spec
- `_rels` migration shape: `src/migrations/20260903_0_add_equipment.ts:90-126`
- Enum-value migration shape: `src/migrations/20260914_0_add_szablon_investment_status.ts:10-23`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: `media.kind` + delete safety

#### Automated

- [x] 1.1 `prevent-delete.test.ts` passes with the new media probes — 8c5885f0
- [x] 1.2 Orphan counter keeps an `equipment-events` file and deletes an unreferenced one — 8c5885f0
- [x] 1.3 Deleting an attached media row throws, naming the blocker — 8c5885f0
- [x] 1.4 `pnpm exec vitest run src/__tests__/lib/invoices/` passes — 8c5885f0

### Phase 2: `investments.assets` relation

#### Automated

- [x] 2.1 Attach/remove asset ids persists in order and cleans the orphan — eb941b74
- [x] 2.2 Prevent-delete refuses a media row an investment points at — eb941b74
- [x] 2.3 `pnpm exec vitest run src/__tests__/lib/actions/` passes — eb941b74

### Phase 3: Investment assets UI

#### Automated

- [x] 3.1 Gallery renders empty state, image thumbnails, PDF chips — ebf7beaa
- [x] 3.2 Lightbox opens, steps prev/next, closes on Escape — ebf7beaa
- [x] 3.3 `pnpm exec vitest run --project dom src/__tests__/components/investments/` passes — ebf7beaa

### Phase 4: Leads schema for the landing

#### Automated

- [x] 4.1 `pnpm generate:types` yields `Lead` with the five new fields — 60f8184d
- [x] 4.2 Lead round-trips `address` / `scope` / `area` and a two-file `assets` list — 60f8184d
- [x] 4.3 `pnpm exec vitest run src/__tests__/leads/` passes unchanged — 60f8184d

### Phase 5: `POST /api/webhooks/landing`

#### Automated

- [x] 5.1 Route spec: 403 bad/missing signature, 400 + alert on bad envelope — afc4e188
- [x] 5.2 Route spec: 200 capturing as `landing_form` with two assets attached — afc4e188
- [x] 5.3 Route spec: partial asset failure stores the lead, alerts, answers 200 — afc4e188
- [x] 5.4 Route spec: redelivery of the same `submissionId` creates and sends nothing — afc4e188
- [x] 5.5 SSRF spec: off-host, `http:`, redirect-off-host, link-local and substring-host all rejected — afc4e188
- [x] 5.6 Size spec: oversized `content-length` rejected pre-read; lying header caught mid-read — afc4e188
- [x] 5.7 `landingToStoreLeadInput` unit spec passes — afc4e188
- [x] 5.8 Fixture parses and a signature over the serialised fixture verifies — afc4e188

### Phase 6: Promotion

#### Automated

- [x] 6.1 Promotion creates an investment holding the SAME media ids, sets `leads.investment`, flips `contactStatus` — PENDING_SHA
- [x] 6.2 Deleting the promoted lead leaves the media rows and the investment relation intact — PENDING_SHA
- [x] 6.3 Promote dialog prefills name/address/phone/email — PENDING_SHA
- [x] 6.4 `pnpm exec vitest run src/__tests__/lib/actions/promote-lead.test.ts` passes — PENDING_SHA
