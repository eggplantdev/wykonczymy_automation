# Receipt Scan → Investment-Expense Line Items — Implementation Plan

## Overview

Let a user batch-drop N receipt images into the add-expense dialog. Each image becomes one
blank line-item row with the image pre-attached as that row's invoice. A single global button
("Wypełnij z paragonów") runs one LLM-vision extraction per attached image — bounded parallel
fan-out — and streams the extracted `description` / `amount` (brutto) / `invoiceNote` /
`expenseCategory` into each row as it resolves. Rows that fail extraction stay blank (image still
attached) and are marked. The user reviews inline and saves via the existing bulk-submit path.
**1 receipt = 1 line item. Add-flow only.**

## Current State Analysis

The add-expense flow is a bulk / line-items form built on a **positional-index contract**:
`lineItems[i]` (form state) ↔ `invoiceFilesRef[i]` (a `File` held _outside_ form state) ↔
`invoiceMediaIds[i]` (uploaded at submit) ↔ created `transactions` row `i`. Adding a feature
that produces `(row, image)` pairs slots directly into this contract.

- **Field array + append** — `src/components/forms/form-fields/line-items-field.tsx:130,135,206-213`:
  `<form.Field name="lineItems" mode="array">`; new row via `lineItemsField.pushValue(emptyItem)`
  where `emptyItem = EMPTY_LINE_ITEM` (`{description,amount,invoiceNote,category,expenseCategory}`
  all `''`).
- **File input is not a form field** — uncontrolled `<FileInput>` (`line-items-field.tsx:195-201`)
  → `onFileChange(index, e)`; a `fileInputKey` remounts inputs to clear them on reset.
- **File map** — `src/components/forms/hooks/use-invoice-files.ts:4-21`: `useRef<Map<number,File>>`;
  `handleFileChange` sets/deletes by index; `handleRemoveLineItem` re-indexes the map so files
  stay aligned when a row is removed.
- **Submit path** — `expense-form.tsx` onSubmit: `uploadFilesClient(files, lineItems.length)`
  (`src/lib/utils/upload-file-client.ts:27-38`) builds a positional `mediaId | undefined` array,
  compressing + `POST /api/upload-file` per file; then `createBulkTransferAction(data, mediaIds)`
  (`src/lib/actions/transfers.ts:61,92-115`) attaches `invoice: invoiceMediaIds?.[i]`.
- **Upload primitive** — `/api/upload-file` route (`src/app/(frontend)/api/upload-file/route.ts`)
  → `uploadFile(payload, file)` (`src/lib/utils/upload-file.ts:14-39`) →
  `payload.create({ collection: 'media', file })` → `media.id`. **Files never travel through a
  server action** (body-size limit) — this is why the extract action takes a `mediaId`, not a File.
- **Reference data** — `referenceData.expenseCategories` (`{id,name}[]`,
  `src/lib/queries/reference-data.ts:66-69`) already flows into the form and down to
  `LineItemsField`. There is **no** existing name→id lookup (the form stores id-as-string and maps
  _back_ to a number on submit via `map-line-item.ts`).
- **Category rules** — for `INVESTMENT_EXPENSE`, both `category` (optional "other") and
  `expenseCategory` (required) render; only `expenseCategory` is a required field
  (`transfer-rules.ts:71-73`, validated in `transfer-validation.ts:79-87`). Extraction targets
  `expenseCategory` only.
- **AI SDK / OpenRouter** — greenfield, zero existing usage. `zod` is already v4 (`^4.3.5`).
- **Env layer** — required server vars declared `z.string().min(1)` in `serverSchema`
  (`src/lib/env/schema.ts`), exposed via `serverEnv = serverSchema.parse(process.env)`
  (`src/lib/env/server.ts:8`). `server.ts` is `import 'server-only'`.

Full grounding: `context/changes/receipt-scan-line-items/research.md`.

## Desired End State

In the "Nowy wydatek" dialog the user can:

1. Click **"Dodaj paragony"**, multi-select N receipt photos → N rows appear, each with its image
   attached as the invoice, fields blank.
2. Click **"Wypełnij z paragonów"** → each row with an attached, un-filled image gets its
   `description`, `amount` (brutto), `invoiceNote`, and `expenseCategory` populated from the image;
   rows stream in as extractions resolve; a progress indicator shows N read of M.
3. See rows that failed extraction remain blank with a subtle "nie odczytano" marker + a toast
   summary; edit any row by hand.
4. Save via the existing bulk path — each scanned image is uploaded **once** (at fill time) and
   reused as the row's invoice, producing no duplicate media.

Verify: dropping the seed receipts fills the correct fields; a hallucinated category resolves to
blank (never a wrong id); a forced extraction failure leaves the row blank+marked; saved
`transactions` rows carry the right `invoice` media id with no duplicates.

### Key Discoveries:

- Positional-index contract is the spine — reuse it (`line-items-field.tsx`, `use-invoice-files.ts`).
- Server action must take a `mediaId`, not a File (`upload-file/route.ts` comment 8-16).
- `referenceData.expenseCategories` already in the form; name→id map is new, client-side, colocated.
- `media` accepts `image/*` **and** `application/pdf` (`src/collections/media.ts`); most stored
  invoices are in fact PDFs (479 PDF vs 470 image media rows in the restored dev DB). PDF
  extraction was deferred out of Phases 1–4 and lands in **Phase 5** via OpenRouter's file-parser
  plugin (closes research Open Question #3 — no client-side rasterization needed).

## What We're NOT Doing

- No edit-transfer form support — **add-flow only**.
- No `category` ("other") extraction — only `expenseCategory`.
- ~~No PDF extraction — PDFs can be attached but are skipped by the fill button.~~ **Added in
  Phase 5**: PDFs are extracted via OpenRouter's file-parser (`pdf-text` engine), same model.
- No accuracy eval harness — the DB-fixtures eval (fetch real blob bytes, score vs persisted
  fields) is a deliberate follow-up; see research Open Questions.
- No per-row re-read button, no drag-drop dropzone — global fill button + multi-file picker only.
- No auto-retry on extraction failure — one attempt, then blank+marked.
- No change to `createBulkTransferAction`'s server contract beyond what already accepts a positional
  `invoiceMediaIds` array.

## Implementation Approach

Four phases, each independently verifiable. Phases 1–2 build the server-side extraction primitive
(deps → AI client → schema → action) with no UI. Phase 3 ships batch multi-file add as a pure UI
addition that rides the existing submit path (images upload at submit, as today). Phase 4 adds the
fill button and the upload-once mediaId threading, so scanned rows upload exactly once.

The client holds a second index-keyed map, `Map<number, number>` (row index → already-uploaded
mediaId), parallel to the existing `Map<number, File>`. The fill button populates it; the submit
path prefers a stored mediaId over re-uploading the File. Both maps are re-indexed together on row
removal.

## Critical Implementation Details

**Upload-once threading (Phase 4).** Today `uploadFilesClient` uploads every File at submit. After
Phase 4, an image scanned by the fill button is already uploaded (mediaId stored). The submit path
must, per index, use a stored mediaId if present and otherwise upload the File — never both. When a
row's image is replaced or removed after a fill, its stored mediaId must be cleared so a stale id
can't attach to the wrong image.

**Skip-non-empty (Phase 4).** The global fill button processes only rows that have an attached
image AND blank `description`+`amount`. Rows the user filled by hand are left untouched, so
re-clicking the button never clobbers manual edits.

**server-only trap.** `src/lib/ai/openrouter.ts` imports `serverEnv` (which is `server-only`). It
must be imported only from the server action — never from `payload.config.ts` / collections, or
`payload generate:types` throws.

## Phase 1: Foundation (deps, env, AI client, schema)

### Overview

Add the AI SDK dependency and OpenRouter env vars, create the provider client + extraction schema.
No UI, no action yet.

### Changes Required:

#### 1. Dependencies

**File**: `package.json`

**Intent**: Add the Vercel AI SDK and OpenRouter provider so we can call `generateObject` with a
Zod schema. Hand-edit per the arm64 lightningcss rule; run `pnpm install --force` then `rm -rf .next`
if the native re-link breaks the CSS build.

**Contract**: Add to `dependencies`: `ai` (v6) and `@openrouter/ai-sdk-provider`. No other script or
config change.

#### 2. Env vars

**File**: `src/lib/env/schema.ts`

**Intent**: Declare the OpenRouter key (required) plus two optional attribution vars, read via
`serverEnv`.

**Contract**: In `serverSchema`: `OPENROUTER_API_KEY: z.string().min(1)`,
`OPENROUTER_HTTP_REFERER: z.string().optional()`, `OPENROUTER_APP_NAME: z.string().optional()`. No
change to `server.ts` (picked up by `serverEnv`). Add `OPENROUTER_API_KEY` to `.env` locally.

#### 3. AI provider client + extraction helper

**File**: `src/lib/ai/openrouter.ts` (new)

**Intent**: One place that owns the OpenRouter provider, the model constant (cheapest-that-works,
one-line swap), and an `extractReceipt` helper that runs vision extraction into the Zod schema.

**Contract**: Exports `RECEIPT_MODEL` (start `'openai/gpt-4o-mini'`) and
`extractReceipt(imageUrl: string, expenseCategoryNames: string[]): Promise<ReceiptExtractionT>`.
Builds the OpenRouter provider from `serverEnv.OPENROUTER_API_KEY` (+ optional referer/app-name
headers), calls `generateObject({ model, schema: receiptExtractionSchema, messages: [image + text
prompt] })`. Prompt: instruct brutto/total for `amount`, list the passed category names and require
the model to return one verbatim or empty. Pass the public blob URL as the image part (blob URLs are
public — no server-side byte fetch needed). `import 'server-only'` at top implicitly via `serverEnv`.

#### 4. Extraction schema

**File**: `src/lib/ai/receipt-extraction-schema.ts` (new, colocated with the AI client)

**Intent**: The structured-output contract the model must fill; drives `generateObject` typing.

**Contract**: `receiptExtractionSchema = z.object({ description: z.string(), amount:
z.number().nullable(), invoiceNote: z.string(), expenseCategoryName: z.string() })` and
`type ReceiptExtractionT = z.infer<...>`. `amount` nullable so "not found" is expressible (mapped to
blank in the form); string fields default to `''` when absent.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm tsc --noEmit` (or the repo's typecheck script)
- Dev CSS build still works after install: `pnpm dev` starts without the lightningcss error
- Schema unit test passes: `pnpm exec vitest run src/__tests__/receipt-extraction-schema.test.ts`

---

## Phase 2: Server action + category name→id util

### Overview

Add the pure-read `extractReceiptAction` and the client-side exact-match-or-blank name→id resolver.

### Changes Required:

#### 1. Extract action

**File**: `src/lib/actions/extract-receipt.ts` (new, in `src/lib/actions`)

**Intent**: A `protectedAction` that turns a media id into extracted fields. No mutation, no cache
revalidation.

**Contract**: `'use server'`; `extractReceiptAction(input: { mediaId: number;
expenseCategoryNames: string[] }): Promise<ActionResultT<ReceiptExtractionT>>` wrapped in
`protectedAction('extractReceiptAction', handler)` (no third arg). Handler: resolve the media doc via
`ctx.payload` (findByID / `fetchMediaByIds`) → `{ url, mimeType }`; if `mimeType` is not `image/*`
(e.g. PDF) return `{ success: false, error: 'Nie można odczytać pliku PDF' }`; else
`extractReceipt(url, expenseCategoryNames)` → `{ success: true, data }`. Returns the raw
`expenseCategoryName` (name→id mapping happens client-side where the id map lives).

#### 2. Category name→id resolver

**File**: colocated with the batch-scan feature (e.g.
`src/components/forms/form-fields/resolve-expense-category-id.ts`, new)

**Intent**: Map an extracted category _name_ to an id, exact-match-or-blank, so a hallucinated name
can never reach the form.

**Contract**: `resolveExpenseCategoryId(name: string, categories: ExpenseCategoryRefT[]): string`
— trim + case-normalize both sides; return `String(match.id)` on exact match, else `''`. Returns the
id-as-string the form field expects (`expense-category-field.tsx:12-15`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm tsc --noEmit`
- Resolver unit test passes: `pnpm exec vitest run src/__tests__/resolve-expense-category-id.test.ts`
  (exact match → id; case/whitespace variance → id; unknown name → `''`; empty name → `''`)

---

## Phase 3: Batch multi-file add (rows + attached images)

### Overview

Add a "Dodaj paragony" multi-file picker that appends one row per image and registers each image in
the index-keyed file map. Pure UI; images upload at submit via the existing path (no fill yet).

### Changes Required:

#### 1. Batch-add control + handler

**File**: `src/components/forms/form-fields/line-items-field.tsx`

**Intent**: A multi-file input beside "Dodaj pozycję" that, per selected file, pushes an empty row
and registers the file at the matching index so it becomes that row's invoice.

**Contract**: New "Dodaj paragony" `<input type="file" multiple accept="image/*,application/pdf">`.
On change, for each file in order: `lineItemsField.pushValue(emptyItem)` then register the file at
the new row's index via a batch variant of the file-map setter (see #2). Must compute indices off the
current array length so rows and files stay index-aligned. Reuse `fileInputKey` remount to clear the
picker. If the only existing row is the initial untouched blank, drop it so the first scanned image
is row 0 (avoid a leading empty row).

#### 2. Batch file-map registration

**File**: `src/components/forms/hooks/use-invoice-files.ts`

**Intent**: Register N files at N consecutive indices in one call, keeping the existing per-row
`handleFileChange` intact.

**Contract**: Add `registerFilesAt(startIndex: number, files: File[])` (or accept an index→File batch)
that sets the ref-map entries. Existing `handleRemoveLineItem` re-indexing must continue to hold for
batch-added rows.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm tsc --noEmit`
- File-map alignment unit test passes:
  `pnpm exec vitest run src/__tests__/use-invoice-files.test.ts` (batch register N files → indices
  0..N-1; remove middle row → remaining files re-align)

---

## Phase 4: Fill orchestration (global button, upload-once, streaming, failure UX)

### Overview

Add the "Wypełnij z paragonów" button that uploads each target image once → mediaId, runs bounded
parallel extraction, streams fields into rows, marks failures, and threads stored mediaIds through
submit so scanned images upload exactly once.

### Changes Required:

#### 1. mediaId map (upload-once state)

**File**: `src/components/forms/hooks/use-invoice-files.ts`

**Intent**: Track images already uploaded during fill so submit doesn't re-upload them.

**Contract**: Add a parallel `useRef<Map<number, number>>` (index → mediaId) with a setter and a
getter, re-indexed alongside the File map in `handleRemoveLineItem`. `handleFileChange` (per-row
replace) must **clear** any stored mediaId for that index. Expose the map to the submit path.

#### 2. Bounded-concurrency helper

**File**: colocated with the feature (e.g. `src/components/forms/form-fields/map-with-concurrency.ts`,
new) — or `src/lib/utils/` if judged reusable

**Intent**: Run an async fn over items with at most N in flight.

**Contract**: `mapWithConcurrency<T,R>(items: T[], limit: number, fn: (item: T, index: number) =>
Promise<R>): Promise<R[]>` preserving input order in results. `limit = 4`.

#### 3. Fill button + orchestration

**File**: `src/components/forms/form-fields/line-items-field.tsx` (+ a small hook, e.g.
`use-receipt-fill.ts`, if the logic is sizeable)

**Intent**: One click reads every eligible row's image and fills its fields, streaming results and
showing progress.

**Contract**: "Wypełnij z paragonów" button (disabled while running / when no eligible rows). Eligible
= row has an attached image AND blank `description`+`amount`. For each eligible row via
`mapWithConcurrency(..., 4, ...)`: (a) if no stored mediaId, upload the File via `uploadFileClient`
→ store mediaId in the map; (b) call `extractReceiptAction({ mediaId, expenseCategoryNames })` where
names come from `referenceData.expenseCategories`; (c) on success, `setFieldValue` for that row's
`description`, `amount` (null → `''`), `invoiceNote`, and `expenseCategory =
resolveExpenseCategoryId(name, categories)`; (d) on failure, add the index to a local failed-indices
`Set` and continue. Track in-flight indices for per-row spinner + a "Odczytano X/M" progress line.
End with a toast summarizing failures. Failed rows render a subtle "nie odczytano" marker (local
state, re-indexed on row removal).

#### 4. Submit path: prefer stored mediaId over re-upload

**File**: `src/components/forms/expense-form/expense-form.tsx` (+
`src/lib/utils/upload-file-client.ts` if a new resolver helper is cleaner)

**Intent**: At submit, attach a stored mediaId when present; upload the File only for rows without
one — never both.

**Contract**: Build the positional `invoiceMediaIds` array by, per index: use `mediaIdMap[i]` if set,
else `uploadFileClient(file)` for `fileMap[i]`, else `undefined`. Feed to
`createBulkTransferAction(data, invoiceMediaIds)` unchanged. No duplicate media for scanned rows.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm tsc --noEmit`
- Concurrency helper unit test passes:
  `pnpm exec vitest run src/__tests__/map-with-concurrency.test.ts` (never exceeds limit; preserves
  order; propagates/isolates a rejecting item per its contract)
- Submit-resolver unit test passes: `pnpm exec vitest run src/__tests__/invoice-media-resolve.test.ts`
  (stored mediaId wins → no upload call; File-only → uploads; neither → undefined)

---

## Phase 5: PDF extraction (OpenRouter file-parser)

### Overview

Let the scanner read `application/pdf` invoices — the majority of stored media — without a new
model or client-side rasterization. OpenRouter's `file-parser` plugin (`pdf-text` engine, free)
parses the PDF server-side and feeds the text to the existing `RECEIPT_MODEL` (`gpt-4o-mini`).
Closes research Open Question #3. Also strips the leftover `TEMP DEBUG — remove before merge`
logging in `openrouter.ts` and `use-receipt-fill.ts` in the same pass.

### Changes Required:

#### 1. PDF-plugin decision helper (the TDD'd unit)

**File**: `src/lib/ai/receipt-pdf-plugins.ts` (new, colocated with the AI client)

**Intent**: Encode the one decision with cost consequences — a PDF gets the free `pdf-text`
file-parser engine; an image gets no plugin (plain vision call). Kept a pure function in its own
file so it's unit-testable without the `server-only` `openrouter.ts` graph, and so the engine
choice can never silently drift to the paid `mistral-ocr` fallback.

**Contract**: exports `RECEIPT_PDF_ENGINE = 'pdf-text'` and
`receiptPdfPlugins(mediaType: string): FileParserPluginT[] | undefined` — returns
`[{ id: 'file-parser', pdf: { engine: RECEIPT_PDF_ENGINE } }]` for `'application/pdf'`, else
`undefined`.

#### 2. Wire the plugin into extraction + strip debug logging

**File**: `src/lib/ai/openrouter.ts`

**Intent**: Pass the file-parser plugin to the model for PDFs; leave the image path untouched.

**Contract**: `openrouter(RECEIPT_MODEL, { plugins: receiptPdfPlugins(mediaType) })`
(`undefined` plugins for images = today's behavior). Remove the `TEMP DEBUG` HEAD-probe block,
the `openrouterImageUrlRegex`, and the request/response/failure `console.*` dumps.

#### 3. Drop the PDF rejection in the action

**File**: `src/lib/actions/extract-receipt.ts`

**Intent**: Stop short-circuiting PDFs; the extractor now handles them.

**Contract**: Remove the `if (!mimeType.startsWith('image/')) return { success:false, error:'Nie
można odczytać pliku PDF' }` branch. Keep the `!url || !mimeType` guard. `mimeType` still flows to
`extractReceipt` as `mediaType`.

#### 4. Allow PDFs in the scan picker + strip debug logging

**Files**: `src/components/forms/form-fields/line-items-field.tsx`,
`src/components/forms/hooks/use-receipt-fill.ts`

**Intent**: Let the user pick PDFs in "Dodaj paragony"; drop the stale "image only" filter comment
and the temp per-row `console.error`.

**Contract**: Scan `<input>` `accept="image/*"` → `accept="image/*,application/pdf"`
(`line-items-field.tsx:268`). In `use-receipt-fill.ts`, remove the `TEMP DEBUG` `console.error`
and correct the "Eligible = attached image" comment (eligibility is file-present + blank, not
image-typed).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm tsc --noEmit`
- Plugin-decision unit test passes:
  `pnpm exec vitest run src/__tests__/receipt-pdf-plugins.test.ts` (PDF → `pdf-text` file-parser
  plugin; image types → `undefined`)
- Full unit suite green: `pnpm exec vitest run`

---

## Testing Strategy

### Unit Tests:

- `receiptExtractionSchema` — shape, `amount` nullable, string defaults (Phase 1).
- `resolveExpenseCategoryId` — exact match, case/whitespace normalization, unknown → `''` (Phase 2).
- `use-invoice-files` batch register + re-index on removal (Phase 3).
- `mapWithConcurrency` — concurrency cap, order preservation, failure isolation (Phase 4).
- Invoice mediaId resolver — stored-id-wins vs upload vs undefined (Phase 4).

### Integration Tests:

- None automated for the LLM path in this cut (non-deterministic; needs live provider). The
  DB-fixtures accuracy eval is a deferred follow-up (research Open Questions).

## Performance Considerations

Bounded pool (4 concurrent) caps OpenRouter burst / rate-limit risk on large drops while keeping
rows streaming. Images are compressed before upload (existing `compressImage`) and uploaded once.
Model isolated to `RECEIPT_MODEL` for a one-line cost/latency swap.

## Migration Notes

No schema or data migration — the feature only adds a read-only action and client UI; it reuses the
existing `media` and `transactions` write paths.

## References

- Research: `context/changes/receipt-scan-line-items/research.md`
- Change identity: `context/changes/receipt-scan-line-items/change.md`
- Positional-index spine: `src/components/forms/form-fields/line-items-field.tsx:130-213`,
  `src/components/forms/hooks/use-invoice-files.ts:4-21`
- Submit / attach: `src/components/forms/expense-form/expense-form.tsx`,
  `src/lib/utils/upload-file-client.ts:27-38`, `src/lib/actions/transfers.ts:61,92-115`
- Action convention: `src/lib/actions/run-action.ts:33-63`,
  `src/lib/actions/notifications.ts:12-17` (read-only exemplar)
- Env: `src/lib/env/schema.ts`, `src/lib/env/server.ts:8`
- Reference data: `src/lib/queries/reference-data.ts:66-69`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not
> rename step titles. See `references/progress-format.md`.

### Phase 1: Foundation (deps, env, AI client, schema)

#### Automated

- [x] 1.1 Type checking passes (`pnpm generate:types && pnpm tsc --noEmit`)
- [x] 1.2 Dev CSS build still works after install (`pnpm dev` starts, no lightningcss error)
- [x] 1.3 Schema unit test passes (`receipt-extraction-schema.test.ts`)

### Phase 2: Server action + category name→id util

#### Automated

- [x] 2.1 Type checking passes (`pnpm tsc --noEmit`)
- [x] 2.2 Resolver unit test passes (`resolve-expense-category-id.test.ts`)

### Phase 3: Batch multi-file add (rows + attached images)

#### Automated

- [x] 3.1 Type checking passes (`pnpm tsc --noEmit`)
- [x] 3.2 File-map alignment unit test passes (`use-invoice-files.test.ts`)

### Phase 4: Fill orchestration (global button, upload-once, streaming, failure UX)

#### Automated

- [x] 4.1 Type checking passes (`pnpm tsc --noEmit`)
- [x] 4.2 Concurrency helper unit test passes (`map-with-concurrency.test.ts`)
- [x] 4.3 Submit-resolver unit test passes (`invoice-media-resolve.test.ts`)

### Phase 5: PDF extraction (OpenRouter file-parser)

#### Automated

- [x] 5.1 Plugin-decision unit test passes (`receipt-pdf-plugins.test.ts`) — 466881f
- [x] 5.2 Type checking passes (`pnpm tsc --noEmit`) — 466881f
- [x] 5.3 Full unit suite green (`pnpm exec vitest run`) — 466881f
