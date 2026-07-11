---
date: 2026-07-11T13:12:36Z
researcher: ex-Plant
git_commit: fdeca5f49eb38ab3dde8697382bfaed76c9c6e27
branch: staging
repository: wykonczymy
topic: 'Scan receipts into investment-expense line items via LLM vision'
tags: [research, codebase, expense-form, line-items, media-upload, ai, openrouter, eval]
status: complete
last_updated: 2026-07-11
last_updated_by: ex-Plant
---

# Research: Scan receipts into investment-expense line items via LLM vision

**Date**: 2026-07-11T13:12:36Z
**Researcher**: ex-Plant
**Git Commit**: fdeca5f49eb38ab3dde8697382bfaed76c9c6e27
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Ground the shaped design in `change.md` against live code: where exactly the batch-scan
feature plugs into the add-expense dialog, how invoice media flows today, the server-action /
env / deps conventions to mirror, and — added mid-research — whether real receipts already in
the DB can serve as a ground-truth eval set for extraction accuracy.

## Summary

The design in `change.md` is a clean fit for the existing architecture — no structural
surprises. The whole add-expense flow already runs on a **positional-index contract**:
`lineItems[i]` ↔ `invoiceFilesRef[i]` (a File held outside form state) ↔ `invoiceMediaIds[i]`
↔ created `transactions` row `i`. Batch-scan slots in by appending one row per image via
`pushValue` and registering each image into the same index-keyed file map — everything
downstream (compress → upload → attach as `invoice`) already works off that index.

Key confirmations and one correction to the shaped design:

- **Server action input**: the repo _deliberately avoids_ `File`/`FormData` in server actions
  (body-size limit) — image uploads go through the `/api/upload-file` **route**, not an action.
  So `extractReceiptAction` should take a small typed input (a `mediaId` or media URL), read the
  bytes server-side, and call the LLM — not receive a raw `File`. This also realizes the
  "one upload, two uses" goal: upload once via the existing route → get `mediaId` → feed it to
  both extraction and the row's `invoice`.
- **Category name→id**: no existing name→id lookup exists (the form stores id-as-string and maps
  _back_ to a number on submit). The new exact-match-or-blank mapping is genuinely new code,
  colocated with the extract feature as planned.
- **AI SDK / OpenRouter**: greenfield — zero existing usage. `zod` is already v4 (`^4.3.5`),
  compatible with `ai`'s `generateObject`.
- **Env / Payload / action wrappers**: all conventions confirmed; adding the vars and the action
  is mechanical.

**On the eval (`db-as-fixtures`)**: real `INVESTMENT_EXPENSE` rows with an attached invoice give
a **ground-truth set for free** — the human-entered `description` / `amount` / `invoiceNote` /
`expenseCategory.name` on each row are exactly the four extraction targets. **Caveat**: the local
prod-dump restore contains only media _metadata_ (a Vercel Blob `url`), **not the image bytes** —
an eval must `fetch()` each blob URL over the network. Sampling those real attachments first (image
vs PDF, thermal receipt vs formal VAT invoice) is the cheapest way to calibrate the prompt before
writing any extraction code.

## Detailed Findings

### Add-expense dialog & line-items field (add-flow spine)

The feature is a **bulk / line-items** form — multiple expense rows, one submit. Chain:
`ExpenseDialog` → `ExpenseForm` → `LineItemsField` (N rows) → files collected out-of-band in
`useInvoiceFiles` → uploaded positionally via `/api/upload-file` → `createBulkTransferAction`
writes one `transactions` row per line item, attaching each media id by index.

- **Field array + append** — `src/components/forms/form-fields/line-items-field.tsx`:
  `<form.Field name="lineItems" mode="array">` (line 130); rows mapped from
  `lineItemsField.state.value` (line 135). New row appended at lines 206-213:
  `onClick={() => lineItemsField.pushValue(emptyItem)}` where `emptyItem` = `EMPTY_LINE_ITEM`
  `{ description:'', amount:'', invoiceNote:'', category:'', expenseCategory:'' }` (lines 28-34,
  125-127). **This `pushValue(item)` is the exact hook the batch-scan loop calls per resolved
  extraction.**
- **File input is NOT a form field** — a plain uncontrolled `<FileInput>` (lines 195-201) whose
  `onChange` → `onFileChange(index, e)`; a `fileInputKey` remounts inputs to clear on reset.
- **Form + schema** — `src/components/forms/expense-form/expense-form.tsx` (uses `useAppForm`,
  default `type='INVESTMENT_EXPENSE'` at line 105); schemas in
  `src/components/forms/expense-form/expense-schema.ts`:
  - client `lineItemClientSchema` (lines 42-48): all-string `{description, amount, invoiceNote,
category, expenseCategory}`.
  - server `createBulkExpenseSchema` (lines 95-118): coerced numbers; `category`/`expenseCategory`
    are `z.number().positive().optional()`. **Invoice media is not in the row schema** — it's a
    separate positional array.
- **`useAppForm`** — `src/components/forms/hooks/form-hooks.ts` (a TanStack `createFormHook`,
  lines 14-26). Submit is wrapped by `useFormSubmit('expense')`; the action closure uploads files
  then calls `createBulkTransferAction(data, invoiceMediaIds)`.

### Invoice media flow (one upload, reused as invoice)

Files live **outside form state**, keyed by row index, uploaded positionally, matched to created
rows by index:

1. Capture — `<FileInput>` `onChange` → `onFileChange(index, e)` (line-items-field.tsx:195).
2. Store — `src/components/forms/hooks/use-invoice-files.ts`: `useRef<Map<number, File>>` (line 4);
   `handleFileChange` (17-21) sets/deletes; `handleRemoveLineItem` (6-15) re-indexes so files stay
   aligned. The row holds **no** media id or File.
3. Upload on submit — `uploadFilesClient(files, lineItems.length)`
   (`src/lib/utils/upload-file-client.ts:27-38`) builds a positional array; each file is
   `compressImage`d then `POST /api/upload-file` (FormData), returns `mediaId`.
4. Route — `src/app/(frontend)/api/upload-file/route.ts`: auth-gated to `MANAGEMENT_ROLES`,
   **not** a server action (comment lines 8-16: dodges server-action body-size limit) →
   `uploadFile(payload, file)`.
5. Payload create — `src/lib/utils/upload-file.ts:14-39`: `Buffer.from(await file.arrayBuffer())`
   → `payload.create({ collection: 'media', file: {...}, data: {} })` → returns `media.id`.
6. Attach — `createBulkTransferAction` (`src/lib/actions/transfers.ts:92-115`) sets
   `invoice: invoiceMediaIds?.[i]` (line 109) — positional match.

**For batch-scan**: upload each image once via this same route → `mediaId`; pass `mediaId` to
`extractReceiptAction`, and register it into the index-keyed file/media map so the existing submit
path attaches it as that row's `invoice`. No new upload plumbing needed.

### `category` (other) vs `expenseCategory`

Two distinct reference lists, gated by transfer type in `src/lib/constants/transfer-rules.ts`:

- `expenseCategory` ("Typ wydatku inwestycyjnego") — `needsExpenseCategory(type, hasInvestment)`
  (lines 71-73): true for `INVESTMENT_EXPENSE`, or `CORRECTION` only with an investment.
- `category` ("Kategoria", the misc/"other") — `showsOtherCategory(type)` (lines 68-69): true for
  `OTHER`, `INVESTMENT_EXPENSE`, `PAYOUT`.

For `INVESTMENT_EXPENSE` both render but **only `expenseCategory` is required** (`category` is
"Opcjonalnie"). Requirement enforced in `validateLineItemCategories`
(`src/lib/schemas/transfer-validation.ts:79-87`). Confirms the change.md scope: extraction targets
`expenseCategory` only; `category` ("other") is out of scope. `mapLineItem`
(`src/components/forms/expense-form/map-line-item.ts:32-37`) drops `expenseCategory` for types
that don't use it and does `Number(item.expenseCategory)`.

### Server-action conventions to mirror

- **Wrapper** — `protectedAction(label, handler, revalidate?)`
  (`src/lib/actions/run-action.ts:33-63`): does `requireAuth(MANAGEMENT_ROLES)` → `getPayload({
config })` → runs `handler({ payload, user })` in try/catch with `[PERF]`/`[ACTION_ERROR]`
  logging; calls `revalidateCollections` only if a `revalidate` list is passed.
  `ActionCtxT = { payload, user }` (line 13). **`extractReceiptAction` = `protectedAction('extractReceiptAction', handler)` with no third arg** (pure read). Actions never call
  `getPayload` themselves; `requireAuth`/`perfStart` are handled by the wrapper.
- **Read-only exemplar** — `src/lib/actions/notifications.ts:12-17` (`getUnreadLeadsCount`,
  no revalidate, returns `data`). Mutation exemplar — `src/lib/actions/workers.ts:6-25`
  (`validateAction` + `['users']` revalidate).
- **`ActionResultT`** — `src/types/action.ts:1-4`: discriminated union on `success`; error variant
  `{ success: false; error: string }` (Polish user-facing string).
- **No server action takes `File`/`FormData`** — the deliberate pattern is the upload _route_ +
  a typed action input. (Correction to any reading of change.md that implies passing a File to
  the action.)

### Reference data: `expenseCategories`

- Collection `src/collections/expense-categories.ts` (slug `expense-categories`, single `name`
  text field, required+unique; registered `src/payload.config.ts:75`).
- Loaded via **raw SQL** (`src/lib/queries/reference-data.ts:66-69`):
  `SELECT id, name FROM expense_categories ORDER BY name` → `{ id: number; name: string }`
  (`ExpenseCategoryRefT`, `src/types/reference-data.ts:39-42`), wrapped in `unstable_cache`
  (tag `collection:expense-categories`).
- Passed page → `fetchReferenceData()` → `ExpenseForm` `referenceData` prop → `LineItemsField`.
- **No existing name→id lookup** — the form stores id-as-string and maps back to a number on
  submit (`expense-category-field.tsx:12-15`, `map-line-item.ts`). The exact-match-or-blank
  name→id resolver is new; nearest existing utility is `toNameMap` (id→name for display) in
  `src/lib/queries/transfer-mapping.ts:32`. Build the inverse (name→id, case/trim-normalized,
  blank on miss).

### Env layer, deps, Payload instance

- **Env** — declare server-only required vars in `serverSchema` (`src/lib/env/schema.ts`),
  every var `z.string().min(1)` (no default). Add:
  `OPENROUTER_API_KEY: z.string().min(1)`, `OPENROUTER_HTTP_REFERER: z.string().optional()`,
  `OPENROUTER_APP_NAME: z.string().optional()` (optional pattern mirrors
  `KOSZTORYS_DRIVE_FOLDER_ID` at schema.ts:44). Exposed automatically via
  `serverEnv = serverSchema.parse(process.env)` (`src/lib/env/server.ts:8`); read
  `serverEnv.OPENROUTER_API_KEY`. **Trap**: `server.ts` is `import 'server-only'` — never pull
  it (or `src/lib/ai/openrouter.ts`, if it imports `serverEnv`) into the Payload CLI graph
  (`payload.config.ts` / collections), or `payload generate:types` throws. `schema.ts` has no
  `server-only` and is safe anywhere.
- **Deps** — no AI SDK present. Add `ai` + `@openrouter/ai-sdk-provider` by **hand-editing
  `package.json`** (arm64 lightningcss rule), then `pnpm install --force` + `rm -rf .next` if the
  native re-link breaks. `zod ^4.3.5`, `next ^16.1.7`, `payload 3.73.0`, `sharp ^0.34.5`.
- **Payload from a server action** — always via the injected `ctx.payload`; the wrapper calls
  `getPayload({ config })` with `import config from '@payload-config'`
  (`src/lib/actions/run-action.ts:2-4,46`).

### DB receipts as a ground-truth eval set (`db-as-fixtures`)

The added requirement — pull real receipts from the DB for tests, and compare what users attach
against the transaction fields — is well-supported by the data model:

- **`transactions` table** (collection object `Transfers`, `slug: 'transactions'`,
  `src/collections/transfers.ts:53`). The four extraction targets map 1:1 onto real columns of an
  `INVESTMENT_EXPENSE` row:
  - `description` (text, transfers.ts:76-79)
  - `amount` (number, required, 80-92)
  - `invoiceNote` (textarea, 194-204 — "required if no invoice file"; for eval, pick rows _with_
    an invoice)
  - `expenseCategory` (relationship→`expense-categories`, 151-159; the ground-truth _name_ is the
    `name` field on that collection)
  - `invoice` (**`type: 'upload'`, `relationTo: 'media'`**, 188-193) — the receipt image itself
  - out of scope: `otherCategory`/`otherDescription` (for `OTHER`-type).
- **Media storage is Vercel Blob**, not local disk: `vercelBlobStorage` plugin registered at
  `src/payload.config.ts:80-85` with `collections: { media: true }`. The media row stores an
  absolute blob `url` (migration `src/migrations/20260211_212425.ts:42`); read access is public
  (`media.ts:42 read: () => true`). Retrieve bytes by `fetch(url)` — exactly what the live invoice
  download does (`src/components/transfers/invoice-download-button.tsx:63`).
- **Query shape** — plain join `transactions.invoice_id → media.id`, filter
  `WHERE type = 'INVESTMENT_EXPENSE' AND invoice_id IS NOT NULL`. Columns:
  `invoice_id` FK→media (migration `src/migrations/20260211_213603.ts:19,31`), `description`,
  `amount`, `invoice_note`, `expense_category_id`
  (`src/migrations/20260309_add_expense_categories.ts:28`). Existing resolve pattern:
  `fetch-transfer-rows.ts:25` → `extractInvoiceIds` → `fetchMediaByIds`
  (`src/lib/queries/media.ts:13-37`) → `{ url, filename, mimeType }`.
- **Local test DB is a prod-dump restore** (`db:dump` → `dumps/dump-latest.sql` → `db:import:test`
  into 5435 `wykonczymy-test`; `package.json:29,31`). So the metadata rows (real
  description/amount/category + blob URL) are present locally. **`media` allows `image/*` AND
  `application/pdf`** (`src/collections/media.ts` mimeTypes) — so real attachments are a mix of
  photos and PDFs; the eval and prompt must handle both.

**Critical caveat**: `pg_dump` captures Postgres rows only. Because receipts live in Vercel Blob
(external object store), **the dump contains the blob `url` + filename + mime, NOT the image
bytes**. A local eval must `fetch()` each blob URL over the network (public URLs, work without the
DB online; but 404 if a blob was rotated/deleted). No seed script creates media/invoice rows
(`src/scripts/*` seed only kosztorys/leads) — real receipts come only from the dump.

Eval recipe: SQL/Payload query rows where `type='INVESTMENT_EXPENSE' AND invoice_id IS NOT NULL`
→ collect `{description, amount, invoice_note, expenseCategory.name, media.url, media.mimeType}`
→ `fetch` each `url` → run `extractReceiptAction`'s core against the bytes → score against the
persisted fields. Test patterns to mirror: `src/__tests__/invoice-zip.test.ts` (fetches invoice
URLs), `map-line-item.test.ts`, `bulk-transaction.test.ts`.

## Code References

- `src/components/forms/form-fields/line-items-field.tsx:130,135,195-201,206-213` — field array,
  file input, `pushValue` append
- `src/components/forms/expense-form/expense-form.tsx:99-166,105,122` — `useAppForm`, default type,
  onSubmit / upload / submit
- `src/components/forms/expense-form/expense-schema.ts:42-48,95-118` — client & server row schemas
- `src/components/forms/expense-form/map-line-item.ts:22-37` — form→server row mapping
- `src/components/forms/hooks/use-invoice-files.ts:4-21` — index-keyed File map
- `src/lib/utils/upload-file-client.ts:6-38` / `src/lib/utils/upload-file.ts:14-39` /
  `src/app/(frontend)/api/upload-file/route.ts:8-40` — compress → route → `payload.create(media)`
- `src/lib/actions/transfers.ts:61,92-115,109` — `createBulkTransferAction`, `invoice` attach
- `src/lib/actions/run-action.ts:13,33-63` — `protectedAction` wrapper
- `src/lib/actions/notifications.ts:12-17` — read-only action exemplar
- `src/types/action.ts:1-4` — `ActionResultT`
- `src/lib/queries/reference-data.ts:66-69` — expenseCategories raw-SQL load
- `src/lib/queries/transfer-mapping.ts:32` — `toNameMap` (id→name; invert for name→id)
- `src/lib/env/schema.ts:13-48` / `src/lib/env/server.ts:1,8` — env layer + server-only trap
- `src/collections/transfers.ts:53,76-92,151-159,188-204` — transactions fields (ground-truth)
- `src/collections/media.ts` + `src/payload.config.ts:80-85` — media collection + Vercel Blob
- `src/migrations/20260211_213603.ts:19,31` / `20260309_add_expense_categories.ts:28` — invoice FK,
  expense_category_id
- `src/lib/queries/media.ts:13-37` / `src/lib/queries/fetch-transfer-rows.ts:25` — media resolve
- `src/components/transfers/invoice-download-button.tsx:63` — `fetch(blobUrl)` for bytes

## Architecture Insights

- **Positional-index contract** is the spine of the whole add-expense flow — reuse it, don't
  invent a new row↔image association. This is why batch-scan is low-risk: it's one more producer of
  `(row, file)` pairs at matching indices.
- **Files never travel through server actions** here — routes handle uploads (body-size limit),
  actions take typed inputs. The "one upload, two uses" design is naturally realized by uploading
  first (route → `mediaId`) then passing `mediaId` to the extract action.
- **Reference data via raw SQL + `unstable_cache`**, not the Payload ORM — consistent with the
  repo's "financial/reference reads use raw SQL" convention (AGENTS.md).
- **Exact-match-or-blank** name→id is a deliberate safety valve: a hallucinated category name
  resolves to blank and the required-field validation forces human correction rather than silently
  writing a wrong category. New code, but small and colocated.

## Historical Context (from prior changes)

- `context/changes/receipt-scan-line-items/change.md` — the shaped design (settled forks:
  fan-out one call per image, image reuse as invoice, category exact-match-or-blank, OpenRouter via
  Vercel AI SDK `generateObject` + Zod, add-flow only). This research confirms it against live code
  with one correction (typed `mediaId` input, not a `File`, into the action).
- Reference lessons cited in change.md: ai_devs S01E04 (multimodality / `input_image`) + S01E01
  (structured output) — external repos, not in this codebase.

## Related Research

None found under `context/changes/**/research.md` or `context/archive/**/research.md` for this
domain (transfers/AI). This is the first research artifact for the AI-extraction feature.

## Open Questions

1. **Real-attachment distribution (do this before writing the extractor).** Sample the actual
   `INVESTMENT_EXPENSE` invoices from the restored 5435 DB: what fraction are photos vs PDFs,
   thermal receipts vs formal VAT invoices, multi-item vs single-item, Polish-only? This calibrates
   the prompt and sets a realistic accuracy bar. Needs a human-run query against a live/restored DB
   - fetching a sample of blob URLs — not doable from static code alone.
2. **Blob-byte availability for the eval.** Confirm the sampled blob URLs still resolve (not
   rotated/deleted). If flaky, snapshot a fixed set of images into a local fixtures dir once so the
   eval is deterministic and offline.
3. **PDF inputs.** ✅ **RESOLVED (Phase 5, `466881f`).** No rasterization and no model change:
   OpenRouter's `file-parser` plugin (`pdf-text` engine, free) parses the PDF server-side and
   feeds the text to the existing `gpt-4o-mini`. Wired via `receiptPdfPlugins(mediaType)` — PDFs
   get the plugin, images stay a plain vision call. (PDFs are in fact the majority of stored
   invoices: 479 PDF vs 470 image media rows in the restored dev DB.)
4. **Model choice / cost.** change.md starts at `~openai/gpt-4o-mini`; the eval set (Q1) is what
   turns "cheapest that works" from a guess into a measurement — one-line const swap to tune.
5. **Amount semantics.** Which amount does a receipt map to — gross total, per the row's `amount`
   (required)? Confirm against ground-truth rows whether users enter gross or net.
