# Receipt Scan → Investment-Expense Line Items — Plan Brief

> Full plan: `context/changes/receipt-scan-line-items/plan.md`
> Research: `context/changes/receipt-scan-line-items/research.md`

## What & Why

Entering investment expenses means retyping every receipt by hand. This feature lets a user
batch-drop N receipt photos into the add-expense dialog, then press one button that reads each image
with an LLM and fills the line-item fields — description, amount (brutto), invoice note, and expense
category — with the same image attached as that row's invoice. **1 receipt = 1 row.**

## Starting Point

The add-expense dialog is a bulk line-items form built on a positional-index contract:
`lineItems[i]` ↔ a `File` held outside form state (`use-invoice-files.ts`) ↔ `invoiceMediaIds[i]`
uploaded at submit ↔ created `transactions` row `i`. Rows are added via
`lineItemsField.pushValue`; images upload through `/api/upload-file` (never through a server action).
No AI SDK exists in the repo today; `referenceData.expenseCategories` already flows into the form.

## Desired End State

In "Nowy wydatek": **"Dodaj paragony"** turns N selected images into N blank rows with invoices
attached; **"Wypełnij z paragonów"** fills each row from its image via bounded parallel extraction,
streaming results in with a progress counter. Failed rows stay blank with a "nie odczytano" marker +
a toast; any row is hand-editable. Save uses the existing bulk path, with each scanned image uploaded
exactly once (no duplicate media).

## Key Decisions Made

| Decision            | Choice                                              | Why (1 sentence)                                                                 | Source   |
| ------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| Action input        | Typed `mediaId`, not a `File`                       | Repo never passes files through server actions (body-size limit).                | Research |
| Add mechanic        | Batch multi-file → one row per image                | Drop 10 receipts, get 10 ready-to-fill rows — the core value.                     | Plan     |
| Fill trigger        | One global "Wypełnij z paragonów" button            | Matches "add them, then a button"; skips rows filled by hand.                     | Plan     |
| Upload reuse        | Upload once at fill → thread mediaId through submit  | True "one upload, two uses"; no duplicate media in Payload/Blob.                  | Plan     |
| Partial failure     | Blank row (image attached) + marker + toast         | Upload already succeeded; user keeps the invoice and just types values.          | Plan     |
| Fan-out             | Bounded pool of 4 concurrent                        | Avoids OpenRouter rate-limit bursts on large drops; steady streaming.            | Plan     |
| Category name→id    | Exact-match-or-blank, client-side                   | A hallucinated category can never reach the form; id map already lives client.   | Research |
| Amount              | Gross total (brutto)                                | Matches what users enter today for INVESTMENT_EXPENSE.                            | Plan     |
| Provider            | OpenRouter via AI SDK `generateObject` + Zod        | Native structured output; matches repo Zod/server-action conventions.            | Change   |
| Testing             | Unit-test pure pieces; defer accuracy eval          | Locks deterministic logic cheaply; real-accuracy eval needs live blob fetch.     | Plan     |

## Scope

**In scope:** batch add, global fill button, upload-once mediaId threading, `expenseCategory`
extraction, partial-failure UX, unit tests for the pure logic. Add-flow only.

**Out of scope:** edit-transfer form, `category` ("other") extraction, PDF extraction (attachable but
skipped), accuracy eval harness, per-row re-read, drag-drop dropzone, auto-retry.

## Architecture / Approach

New: `src/lib/ai/openrouter.ts` (provider + model const + `extractReceipt` helper), a Zod extraction
schema, `extractReceiptAction` (`protectedAction`, pure read), a client name→id resolver, a bounded
concurrency helper, and batch-add + fill UI in `LineItemsField`. Client state gains a parallel
`Map<index, mediaId>` beside the existing `Map<index, File>`; the fill button populates it (upload
once), and the submit path prefers a stored mediaId over re-uploading. The extract action takes a
`mediaId` + category names, reads the media's public blob URL, and returns the four fields; the
client maps the returned category name → id.

## Phases at a Glance

| Phase                    | What it delivers                                              | Key risk                                                    |
| ------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------- |
| 1. Foundation            | Deps + env + AI client + extraction schema                   | arm64 lightningcss re-link breaking the CSS build           |
| 2. Server action         | `extractReceiptAction` + name→id resolver                    | Vision message shape / PDF handling in `generateObject`     |
| 3. Batch add             | N images → N rows with attached invoices (submit-time upload) | Row↔file index alignment on batch push + removal           |
| 4. Fill orchestration    | Global button, upload-once threading, streaming, failure UX  | Double-upload / stale mediaId if maps drift; skip-non-empty |

**Prerequisites:** `OPENROUTER_API_KEY` in `.env`; dev DB with real receipt media for manual checks.
**Estimated effort:** ~2–3 sessions across the 4 phases.

## Open Risks & Assumptions

- Extraction accuracy is unmeasured in this cut — the DB-fixtures eval (fetch real blob bytes, score
  vs persisted fields) is a deliberate follow-up.
- Assumes the chosen model reads Polish thermal receipts acceptably at `openai/gpt-4o-mini`; the
  model constant is a one-line swap if not.
- Blob URLs are public and passable directly as the vision image part (no server-side byte fetch);
  if a provider rejects URL input, fall back to fetching bytes in the action.
- PDF attachments are skipped by extraction; users of PDF invoices still fill those rows by hand.

## Success Criteria (Summary)

- Dropping N receipts yields N rows filled with correct description/amount(brutto)/category on one
  click, streaming in with progress.
- A hallucinated category resolves to blank (never a wrong id); a failed extraction leaves the row
  blank + marked without breaking the batch.
- Saved rows carry the right invoice media with no duplicate media docs; hand-filled rows are never
  clobbered.
