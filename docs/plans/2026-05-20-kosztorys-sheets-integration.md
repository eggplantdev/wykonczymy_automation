# Kosztorys ↔ App Integration — Decision Brief

**Status:** Option B chosen for v1 (Google Sheets API on transfer create). Spike then iterate.
**Date:** 2026-05-20
**Branch suggestion:** `feature/kosztorys-sheets-sync`

## Decision

Start with **Option B — Google Sheets API integration, triggered on transfer create**. Owner keeps editing the sheet in Drive; app pushes material transactions in real time as they're created in the app.

Why this first (vs. Option A — embed):

- Cheapest first slice: a single `afterChange` hook + a thin Sheets API wrapper.
- Owner's editing experience is unchanged. No new tool to learn.
- Append-only model means we never collide with owner edits.
- If reconciliation/dashboarding pain emerges later, we can graduate to Option A without throwing away the data — by then we'll know exactly which queries we wished we had.

Option A is documented below as the alternative; revisit it if Option B's two-sources-of-truth pain dominates.

## Context

The team maintains parallel records:

- **App** (Payload 3.73 + Next.js 16, this repo) — source of truth for transfers, cash registers, investments, materials purchases (budowlane + dekoracyjne), zaliczka. All audited, role-protected, materials and zaliczka already track one-to-one with what the sheet captures.
- **Google Sheets template "kosztorys"** — per-investment labor estimate. Owner currently retypes app values into the sheet manually. Each new investment starts from a fresh copy of the template.

**Goal:** eliminate the manual retyping while preserving the owner's editing freedom in Sheets.

**Out of scope (for now):** structural editing of the kosztorys inside the app, contractor self-service UI, client portal. Client and contractor only get exported summaries today; they don't need live access.

## What's Already in the Codebase (don't rebuild)

Discovered during scoping — these are ready to compose with:

- `@tanstack/react-table` 8.21 + `@tanstack/react-virtual` 3.13
- Virtualized DataTable: `src/components/ui/data-table/` (`data-table.tsx`, `data-table-row.tsx`, `virtualized-table-body.tsx`)
- Column-config convention: `src/lib/tables/{transfers,users,investments,cash-registers}.tsx`
- Export pipeline: `src/lib/export/sort-rows.ts` plus `src/components/transfers/{transfer-export-toolbar,csv-button,print-button}.tsx`
- TanStack Form + `useAppForm()` hook
- `protectedAction()` server-action wrapper (`src/lib/actions/`)
- Cache tag revalidation: `src/lib/cache/`, `updateTag`/`revalidateTag` split (see CLAUDE.md notes)
- `jszip` available for archive building
- Payload `afterChange` hooks pattern
- Optimistic updates via `useOptimisticFormStore` (Zustand)

## Findings From Analyzing the Source Sheet

Source file analyzed: `Kopia kosztorys wzór dla konrada do testów.xlsx` (6 tabs, 464×33 main sheet). Every formula referencing `materiały` was traced.

### Sheet structure

| Tab                                                              | Size        | Purpose                                                                                                                                   |
| ---------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `kosztorys_robocizny`                                            | 464×33      | Main labor estimate. Per-row: planned qty, measured qty, unit, unit price, discount, 10 stage qtys, 10 stage values, line total, balance. |
| `materiały ` (trailing space!)                                   | 1001×8      | Flat append-only ledger. Cols A–D = budowlane, cols E–H = wykończeniowe. Empty by default.                                                |
| `zakres pracy z narzędziami   ` / `zakres pracy z bez narzędzi ` | 487×34 each | Derived views. Apply `P*0.65` factor and `-15%` deduction.                                                                                |
| `Podsumowanie`                                                   | 26×3        | Top-level summary (currently broken — see Sheet Bugs below).                                                                              |
| `pokoje `                                                        | 17×12       | Room dimensions. Computes wall m² via `H*2.58`, floor m² via `B*C`.                                                                       |

### Canonical formulas (main sheet)

```
T(i)        = O(i)*Q(i) - (Q(i)*R(i))*O(i)              -- line total (measured qty × price, with discount)
V(i)..AE(i) = stage_qty(i)*Q(i) - (stage_qty*Q(i)*R(i)) -- per-stage value
AF(i)       = T(i) - sum(V(i)..AE(i))                    -- balance remaining
B458..AF458 = row 457 * 1.08                             -- brutto from netto (8% VAT for usługi remontowe)
```

Category subtotals are `=SUM(T_start:T_end)` on the section header row.

### How materiały connects (4 cells in entire workbook)

```
kosztorys_robocizny!Q459 = 'materiały '!A2   -- label "Materiały budowlane"
kosztorys_robocizny!T459 = 'materiały '!B1   -- =SUM(B3:B1001), total budowlane
kosztorys_robocizny!Q460 = 'materiały '!E2   -- label "Materiały wykończeniowe"
kosztorys_robocizny!T460 = 'materiały '!F1   -- =SUM(F3:F1001), total wykończeniowe
```

The materiały tab is essentially `transfers` (filtered by category) pretending to be a spreadsheet. The sheet's own SUM formulas do all the aggregation. **Implication: we never need to write specific cells — append rows and the SUMs update themselves.**

### Sheet bugs worth surfacing to the owner

1. `Podsumowanie!B6` (Robocizna) → `kosztorys_robocizny!T395`, but T395 is an empty Kuchnia line, not a labor subtotal. Reference broke after row insertions.
2. `Podsumowanie!B7` (Materiały) → `kosztorys_robocizny!T398`, but T398 is `Wiatrołap → sufit podwieszany`, not a materials total. Same problem.
3. `kosztorys_robocizny!T461` (`aktualnie do zapłaty R+M netto`) sums labor stages plus T459 (budowlane) — but **forgets to add T460 (wykończeniowe)**. Cell formula: `=SUM(V457:AA457)-SUM(V459:AA464)+T459`.

The Podsumowanie tab is currently lying. Fix before relying on its numbers.

## Chosen Approach (Option B) — Phased Build

Sheet stays in Google Drive. App pushes material transactions to the linked sheet via Sheets API. We will start with the simplest possible slice and add resilience features as they become necessary.

### Phase 1 — Walking skeleton (target: 1–2 days)

The goal of Phase 1 is to prove the auth and write path end-to-end with the simplest possible code. No outbox, no auto-copy, no cancellation handling yet. One transfer in the app → one row appended to a manually-linked sheet.

1. **Google Cloud setup**
   - Create or reuse a Google Cloud project.
   - Enable Sheets API (Drive API not needed yet — we'll add it in Phase 3 for auto-copy).
   - Create a service account, download the JSON key.
   - Manually share the existing test sheet with the service account's email (Editor access).
2. **Env wiring**
   - Add `GOOGLE_SERVICE_ACCOUNT_JSON` (whole JSON, single line) to `.env`.
   - Add it to `src/lib/env.ts` validation.
3. **Investments collection**
   - Add `googleSheetId: string | null` field to `src/collections/Investments.ts`.
   - Admin-editable, hidden from non-admin. Owner pastes the sheet ID manually for now — auto-copy comes in Phase 3.
4. **Sheets client**
   - New file `src/lib/google/sheets.ts`.
   - Export one function: `appendMateriałyRow(sheetId, { amount, description, transferId, kind })`. Internally uses `googleapis` SDK with `spreadsheets.values.append` against `'materiały '!A:H` (note trailing space in tab name — see Findings).
   - `kind: 'budowlane'` writes to cols A–D, `kind: 'wykończeniowe'` writes to cols E–H.
   - Write `transferId` to col D (budowlane) or col H (wykończeniowe) — both currently used for "komentarz" / "czy rozliczono" respectively; check with owner whether to use a fresh col I for dedup instead.
5. **Hook the transfer create**
   - `Transfers.hooks.afterChange`, operation === 'create', branch on transfer.type ∈ material categories.
   - Resolve the linked investment, read its `googleSheetId`; if missing, log and skip.
   - Call `appendMateriałyRow`. **Phase 1 is fire-and-forget** — log errors, don't throw, don't block the transfer commit. Failure modes are documented in Phase 2.
6. **Manual smoke test**
   - Create a test investment with the test sheet's ID.
   - Create a material transfer.
   - Verify the row appears.

**Definition of done for Phase 1:** transfer creation in dev consistently appends a row to the linked sheet, and a failed Sheets API call doesn't break the transfer flow.

### Phase 2 — Reliability (after Phase 1 lands)

Once the walking skeleton works, address the failure modes:

1. **Outbox pattern.** Add a `sync-outbox` collection (`transfer_id`, `action`, `target_sheet_id`, `attempts`, `status`, `last_error`). The Phase 1 hook switches from direct API call to outbox insert (in the same DB transaction as the transfer). A background drainer reads pending rows and pushes.
2. **Drainer.** Either a Vercel cron route handler (`src/app/(payload)/api/cron/drain-sheet-outbox/route.ts`) running every minute, or a Payload hook that fires a non-blocking task. Cron is simpler and easier to reason about.
3. **Dedup.** Read column I (or chosen dedup column) before append. Skip if `transferId` already present.
4. **Cancellation handling.** When a transfer is cancelled in the app (matching existing `transfers.cancelled` audit pattern), append a _correction row_ with negative amount referencing the original transfer.id. Do NOT mutate the original sheet row.
5. **Edit handling.** Decide policy: either treat edits as "cancel + new" (cleanest, matches existing audit pattern) or read+update the original row (simpler but collides with owner edits). Recommend the former.
6. **Retry policy.** Exponential backoff in the drainer. Surface persistently-failing outbox rows to admins (count badge in admin UI, or daily digest email).

### Phase 3 — Auto-provision sheet on investment creation (later)

Manual sheet linking is fine for the first few investments. Once it's annoying:

1. Enable Drive API.
2. Add `createKosztorysFromTemplate(name)` to `src/lib/google/sheets.ts`. Uses `files.copy` against a known template file ID; renames to `Kosztorys – {name}`; optionally moves to a shared Drive folder; returns new sheet ID.
3. `Investments.hooks.afterChange`, operation === 'create' → call `createKosztorysFromTemplate`, store ID. Failure is non-fatal: log + flag for manual retry.

## Alternative Considered — Option A (Embed in app)

Documented for completeness. **Not chosen for v1.** Revisit if Option B's two-sources-of-truth pain dominates (e.g., we keep needing cross-investment dashboards we can't build).

There are actually two sub-flavors under "embed" — they're meaningfully different:

### A1. Structured Payload tables + custom inline-edit UI

Three new collections (`kosztorys-sections`, `kosztorys-line-items`, `kosztorys-stage-entries`) with derived values computed on read. UI is the existing `data-table` with a kosztorys column config in `src/lib/tables/kosztorys.tsx`, plus a small `<EditableNumberCell>` component. Add-row / add-section / delete via menus, not dialogs.

- **Pros:** data is fully queryable in Postgres; reconciliation, cross-investment analytics, validation all become trivial; export pipeline reuses what's already in the repo; no external dependency.
- **Cons:** structural edits (add row, add section, rename) go through buttons and small forms — slower than typing in Excel. Owner has to learn the tool. ~1 week of focused work.
- **When to switch to it:** if dashboards across investments become a regular request, or if reconciliation between transfers and kosztorys becomes a recurring manual task.

### A2. Embedded spreadsheet library + JSON blob

Mount Univer / Handsontable / x-spreadsheet as a React component. Store the sheet as the library's proprietary JSON in Payload. Excel-feel preserved but the data is **opaque to Postgres** — can't easily query across investments. Effectively a worse Google Sheets that lives in our app. **Generally inferior to both Option B and Option A1.** Mentioned here only to flag the trap.

## Architectural Patterns to Apply (Option B)

## Architectural Patterns to Apply (Either Option)

- **Append-only model.** Never write to specific cells; always append rows. The sheet's existing SUM formulas aggregate. Removes coupling to row numbers entirely.
- **Outbox pattern.** Don't make Google Sheets a synchronous dependency of every transfer write. Insert into `sync-outbox` in the same DB transaction as the transfer. A background drainer pushes to Sheets. Survives Sheets-API outages without blocking business operations.
- **Dedup via hidden column.** Write `transfer.id` to a hidden column (e.g., col I in materiały tab). Before append, read that column and skip transfers already present. Makes the sync safely retryable.
- **Cancellation as append.** When a transfer is cancelled in the app, append a _correction_ row (negative amount, same `transfer.id` reference) rather than mutating the original sheet row. Matches the existing `transfers.cancelled` audit pattern.
- **Snapshot-at-milestone** (later, when structured stage closing is added): closing a billing stage snapshots the relevant kosztorys rows into a `kosztorys-stage-snapshots` collection linked to a transfer. Working document stays mutable; commitment is immutable.

## Open Questions

Resolved:

- ~~Mobile editing for owner~~ — confirmed not a real workflow, dropped.
- ~~Which option for v1?~~ — Option B chosen.

To resolve during Phase 1:

1. **Dedup column.** Write `transferId` to col D / H (existing "komentarz" / "czy rozliczono" — risky, owner might use those) or add a fresh col I marked hidden. Recommendation: col I, confirm with owner.
2. **Material transfer types.** Which `transfer.type` values map to which sheet block? Likely `INVESTMENT_EXPENSE` with a category tag distinguishing budowlane vs. wykończeniowe — confirm the actual fields in `src/collections/Transfers.ts`.
3. **Cancellation handling timing.** Ship in Phase 1 (simplest: skip — only `create` triggers a push) or Phase 2 (correction row pattern). Recommend skip in Phase 1, add in Phase 2.

To resolve when Phase 3 is in scope: 4. When an investment is deleted/archived in the app, what happens to its sheet? (Delete via Drive API, move to "Archived" Drive folder, leave untouched?) 5. Who owns the Google Cloud project for the service account, and what's the key rotation policy? 6. Should the template live as a fixed file in Drive that we copy, or be regenerated from a JSON definition in the repo? (Fixed file in Drive is simpler and lets the owner improve the template without code changes.)

## Test Coverage Targets

Phase 1:

- **Happy path:** creating a material transfer in dev appends a row to the linked sheet.
- **Sheet missing:** transfer creation on an investment with no `googleSheetId` doesn't throw — just logs and skips.
- **Sheet API failure isolation:** Sheets API down does not block transfer creation. The transfer commits cleanly; the failure is logged.

Phase 2:

- **Reconciliation:** `sum(transfers where category=material AND investment_id=X) == sum of appended sheet rows`.
- **Idempotency:** running the drainer twice on the same outbox row does not duplicate the sheet row.
- **Cancellation:** cancelling a transfer in the app appends a correction row within N seconds.
- **Outbox durability:** Sheets API outage during drain leaves outbox state recoverable; retries succeed when API recovers.

Phase 3:

- **Drive-copy failure isolation:** Drive API down on investment creation does not block creating the investment.

## Quick Reference — Project Conventions This Will Touch

- Server actions: `'use server'` + `protectedAction()` wrapper + `requireAuth()` + `perfStart()` + `ActionResultT` return type. Don't bypass.
- Cache: server actions use `updateTag()` from `lib/cache/revalidate.ts`. Payload hooks use `revalidateTag()` directly. Do NOT import `lib/cache/revalidate.ts` from hooks.
- Migrations: `pnpm migrate:create` first, then edit. Never write migrations from scratch (Payload internal tables like `payload_locked_documents_rels` are easy to miss).
- Code style: no `readonly` on type properties, props, or parameters. Remove existing `readonly` when editing files that have it.
- Forms: TanStack React Form + `useAppForm()`, Zod 4 for validation.
- Polish UI labels, English code identifiers.
