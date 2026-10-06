# Telmak invoice check — Implementation Plan

## Overview

Harden the clickable spike of the Telmak invoice check on `/kasa/[id]`: a manager drops the month's
package of Telmak PDFs, the browser reads them deterministically (pdfjs, no LLM), and the dialog lists
every document that disagrees with the register's transactions, followed by those transactions in the
transfers-list shape, with a one-click attach of the package PDF to a transaction that lacks one. The
UI is accepted as-is; this change moves the spike's code into the repo's layers, replaces the
name-based gate, and puts the parser, the comparison and the SQL under test.

## Current State Analysis

Everything lives uncommitted in the worktree `wykonczymy-worktrees/telmak-invoice-check` (branch
`spike/telmak-invoice-check`, based on `339e01f4`):

- `src/lib/telmak/parse-telmak.ts` — line-based parser for WV / KWV / WZ / FP. Every field required,
  every redundant figure cross-checked (amount in words, „Wartość brutto”, KWV „Razem”, „Pozostało”,
  file name vs number, Telmak NIP); any mismatch lands in `problems[]`.
- `src/lib/telmak/pdf-lines.ts` — browser-only pdfjs text extraction into visual lines (cells joined
  with `|`), loaded by dynamic import, worker via `new URL('pdfjs-dist/build/pdf.worker.min.mjs',
import.meta.url)`. Verified under Turbopack dev only.
- `src/lib/telmak/compare-telmak.ts` — matches by normalized first line of `invoice_note`, statuses
  `unreadable / missing-in-app / app-only / amount / date / cancelled / other-register / no-file / ok`.
- `src/lib/queries/telmak-check.ts` — `'use server'`, holds the raw SQL **and** the auth check, plus
  `fetchTelmakTransferRows` (transfers-list rows by id).
- `src/components/telmak-check/telmak-check-dialog.tsx` (~420 lines) — dialog, the comparison
  `DataTable`'s column definitions, the attach button.
- `src/app/(frontend)/kasa/[id]/page.tsx:72` — gated by `register.name === 'Telmak'` (unformatted line).
- `package.json` — `pdfjs-dist` 6.4.299 added; `pnpm-lock.yaml` updated.

Spike result on the September package matched the manual report exactly: 116 documents, 113 app rows,
111 ok, 5 discrepancies (FP 141 and WZ 4-07716 missing, #5627 amount, #5115 cancelled, #5126 no PDF).

## Desired End State

The same dialog, same behaviour, but:

- shown on the Telmak register by its id, to management roles only;
- raw SQL in `src/lib/db`, auth in `src/lib/queries`, column definitions in `src/components/tables/`;
- parser and comparison covered by node unit specs on fabricated line fixtures;
- the SQL covered by a DB spec against the 5435 test DB;
- `next build` emits the pdfjs worker and the dialog parses a package on a production build;
- an `e2e-backlog` Linear issue records the deferred browser path.

### Key Discoveries:

- Telmak is register **11**, type `VIRTUAL`; a second supplier register „Farby Dulux Telmak” (42,
  `AUXILIARY`) exists — the number lookup already spans all registers, so a 42-booked document surfaces
  as „Inna kasa”. Owner ruling (this plan): gate on 11 only.
- `/kasa/[id]` is management-only already; the dialog keeps `requireAuth(MANAGEMENT_ROLES)` on both reads.
- Only 363 of 905 rows in register 11 carry a Telmak document number in the note — older rows predate
  the receipt scan. The comparison only flags `app-only` within the chosen issue-date range, so history
  doesn't flood it, but a range reaching back before the scan era will show many „brak numeru”.
- AGENTS.md: `src/lib/db` = one statement + its mapper; auth/orchestration in `src/lib/queries`; a
  client-invoked read is a `'use server'` function in `lib/queries`. Per-domain column defs live in
  `src/components/tables/`.
- DB specs are discovered by `scripts/test-integration.sh` grepping `skipIf(!ENV_READY)`; pattern:
  `src/__tests__/lib/db/equipment.db.test.ts`.
- Fixtures must not carry real PII (memory `feedback_no_real_pii_in_fixtures`): the parser fixtures
  are hand-built line arrays in the Telmak layout with invented buyers/addresses.

## What We're NOT Doing

- No new register field / migration for the gate (owner chose the id constant).
- No support for suppliers other than Telmak; the parser stays Telmak-specific.
- No persistence of the package — nothing is stored unless one PDF is explicitly attached.
- No LLM / OCR fallback for unreadable documents; an unknown layout stays a toast + EX-449 marker.
- No E2E spec now — filed to the E2E backlog.
- No i18n of the dialog: `/kasa` is a management screen that does not opt into translation.

## Implementation Approach

Pure logic first (cheapest layer, fixes the contract the rest leans on), then the SQL plane with its
DB spec, then the UI moves and the build check. Each phase keeps the dialog working at
`localhost:3002/kasa/11`.

## Critical Implementation Details

**Build-time worker.** `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` is resolved by
the bundler; Turbopack dev resolved it, the production build has not been checked. If `next build`
does not emit the worker asset, do not add a copy-to-`public/` build step without asking — try the
bundler-supported forms first, and stop and report if none works.

---

## Phase 1: Logic under unit test

### Overview

Pin the parser and the comparison with node specs and introduce the register constant.

### Changes Required:

#### 1. Register constant

**File**: `src/lib/telmak/telmak-register.ts` (new)

**Intent**: One named home for „which register is Telmak's”, read by the page gate.

**Contract**: `export const TELMAK_REGISTER_ID = 11` with a one-line why (id is shared by prod and
every dump-restored DB).

#### 2. Parser spec

**File**: `src/__tests__/lib/telmak/parse-telmak.test.ts` (new)

**Intent**: Lock the layout contract: a valid WV, KWV (negative amount, „Razem do zwrotu”), WZ and FP
each parse to number / date / amount / remark; each cross-check failure yields its problem text;
a page without the Telmak NIP is rejected; a missing remark (next line „Wystawił(a)…”) gives `null`.
Also `wordsToAmount` (tysiąc/tysiące/tysięcy, grosze) and `normalizeDocNumber`.

**Contract**: fixtures are `string[]` line arrays built by a local helper in the spec, invented
buyer/address data only.

#### 3. Comparison spec

**File**: `src/__tests__/lib/telmak/compare-telmak.test.ts` (new)

**Intent**: One case per status (`unreadable`, `missing-in-app`, `app-only` with and without a note
number, `amount`, `date`, `cancelled`, `other-register`, `no-file`, `ok`), split bookings summing to
the document amount → `ok`, KWV matched against a negative CORRECTION, result ordering by status,
and the counts.

**Contract**: exercises `compareTelmak(docs, appRows, registerId, from, to)` and `issueDateOf` only.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/telmak/parse-telmak.test.ts` passes
- `pnpm exec vitest run src/__tests__/lib/telmak/compare-telmak.test.ts` passes

#### Manual Verification:

- none for this phase (pure logic)

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: SQL into `lib/db`, under a DB spec

### Overview

Split the statement from the auth wrapper and assert the SQL on a real Postgres.

### Changes Required:

#### 1. Data-access module

**File**: `src/lib/db/telmak-check.ts` (new)

**Intent**: The raw statement plus its row mapper, moved verbatim from `lib/queries/telmak-check.ts`;
takes the `db` handle, no auth, no `'use server'`.

**Contract**: `loadTelmakCheckRows(db, { registerId, from, to, numbers }): Promise<TelmakAppRowT[]>`.

#### 2. Query wrapper

**File**: `src/lib/queries/telmak-check.ts`

**Intent**: Keep `fetchTelmakCheckRows` and `fetchTelmakTransferRows` as the `'use server'` entry
points: auth (`MANAGEMENT_ROLES`) → `getDb` → `loadTelmakCheckRows`. Signatures unchanged, so the
dialog does not move.

#### 3. DB spec

**File**: `src/__tests__/lib/db/telmak-check.db.test.ts` (new)

**Intent**: Against the 5435 test DB, with its own register + transactions (marker-tagged, cleaned
up): a note whose first line is `"WV 4-0001/PRG/09/2026\n…"` with stray spaces matches number
`WV4-0001/PRG/09/2026`; a row booked within ±1 month of the range is returned, one outside is not; a
row in another register is returned only when its number is asked for; a `CANCELLATION` row is never
returned; an attached invoice comes back in `invoices` with url / filename / mimeType.

**Contract**: follows `src/__tests__/lib/db/equipment.db.test.ts` (`describe.skipIf(!ENV_READY)`,
`server-only` mock, `skipRevalidation` on creates).

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/db/telmak-check.db.test.ts` passes against `db-test` (5435)

#### Manual Verification:

- The dialog on `localhost:3002/kasa/11` still returns the same 5 discrepancies for the September package

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: UI placement, gate, build

### Overview

Put the column definitions where the repo keeps them, gate by id, prove the production build.

### Changes Required:

#### 1. Comparison columns

**File**: `src/components/tables/telmak-check.tsx` (new)

**Intent**: Move `CheckRowT`, `toCheckRow`, `buildCheckColumns` and `AttachButton` out of the dialog.
The dialog keeps state, the package lifecycle (object URLs revoked on close), the auto-compare on
pick and on range change, and the two sections.

**Contract**: `buildTelmakCheckColumns(onAttached: (transactionId: number) => void)`,
`toTelmakCheckRow(result, parsed)`.

#### 2. Page gate

**File**: `src/app/(frontend)/kasa/[id]/page.tsx`

**Intent**: Show `TelmakCheckDialog` when `registerId === TELMAK_REGISTER_ID`; formatted with prettier.

#### 3. Build check

**Intent**: `pnpm build` in the worktree, then `next start` and parse a package — confirms the pdfjs
worker ships and pdfjs stays out of the page's initial chunk (dynamic import only).

#### 4. E2E backlog

**Intent**: File a Linear issue in project „Wykonczymy”, label `e2e-backlog`: drop a package →
discrepancy table → „Dołącz do #id” attaches and the row's Faktura column fills. Needs synthetic
Telmak PDFs (no real invoices in `e2e/fixtures/`).

### Success Criteria:

#### Automated Verification:

- `pnpm build` succeeds in the worktree and the output contains the `pdf.worker` asset

#### Manual Verification:

- On a production build (`next start`), the Telmak dialog parses the September package and shows the
  5 discrepancies; the browser console shows no pdfjs worker error
- The „Sprawdź faktury” button is on `/kasa/11` and absent on `/kasa/42` and any other register
- „Faktura z paczki” preview opens the package PDF; „Dołącz do #5126” attaches it on the local DB and
  the row in „Transakcje do weryfikacji” shows the invoice icon
- An unrelated PDF in the package raises the „nieznany format” toast and lists as „Nieznany format”

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- Parser: each document kind, each cross-check, NIP, remark edge, amount-in-words.
- Comparison: every status, split bookings, KWV sign, ordering, counts.

### Integration Tests:

- SQL: note normalization, booking window, cross-register by number, CANCELLATION excluded,
  invoice aggregation.

### Manual Testing Steps:

1. Open `/kasa/11`, „Sprawdź faktury”, leave the range empty, drop the September package.
2. Range auto-fills to the package's issue dates; table shows the 5 discrepancies.
3. Change the range — the comparison re-runs.
4. „Pokaż wszystkie” lists the 111 ok rows; toggle back.
5. Preview a package PDF; attach to #5126; close the dialog and confirm nothing else was uploaded.

## Performance Considerations

pdfjs (~1 MB) loads only when a package is picked. 116 PDFs parse sequentially in a few seconds in
dev; acceptable for a monthly task — no parallel worker pool.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (unit + DOM; the human runs it or asks for it — see memory on full-suite runs)
- `pnpm test:integration`
- `pnpm build`

## References

- Spike worktree: `wykonczymy-worktrees/telmak-invoice-check`
- DB spec pattern: `src/__tests__/lib/db/equipment.db.test.ts`
- Attach path reused: `src/hooks/use-invoice-upload.ts`
- Transfers-list columns reused: `src/components/tables/transfers.tsx` (`getTransferColumns`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Logic under unit test

#### Automated

- [x] 1.1 `pnpm exec vitest run src/__tests__/lib/telmak/parse-telmak.test.ts` passes
- [x] 1.2 `pnpm exec vitest run src/__tests__/lib/telmak/compare-telmak.test.ts` passes

### Phase 2: SQL into `lib/db`, under a DB spec

#### Automated

- [ ] 2.1 `pnpm exec vitest run src/__tests__/lib/db/telmak-check.db.test.ts` passes against `db-test` (5435)

### Phase 3: UI placement, gate, build

#### Automated

- [ ] 3.1 `pnpm build` succeeds in the worktree and the output contains the `pdf.worker` asset
