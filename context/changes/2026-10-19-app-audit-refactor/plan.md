# App audit and refactor — Implementation Plan

## Overview

Audit and refactor everything under `src/` except tests, migrations and generated types, before the
next features land. Each phase fixes what its directories hold, records every finding in one ledger,
ticks the `change.md` Directories table, and closes with a click-through under the roles its surface
touches. Three owner decisions (2026-10-19) ride along: a MANAGER may not toggle a cash register's
active state, the hand-written `useMemo`/`useCallback` go only after a guard proves the compiler
covers each file, and `/kasa/[id]` sends an EMPLOYEE to his own page like every other management
route.

## Current State Analysis

From `research.md` (baseline `28186af47`):

- The code is mostly healthy: 0.17 % duplication, no dead files under `src/`. The value is
  concentrated in the kosztorys editor pair, the `lib/actions` ↔ `lib/db` boundary, `src/hooks`
  mixing Payload hooks with React hooks, and ~13 small duplication sites.
- Guards that don't guard: depcruise's env rule targets a path that doesn't exist, and no script runs
  depcruise; the `ui/` ↛ feature rule is review-only. Moving files carries lint violations along,
  since lint runs on staged files only.
- Access: `toggleCashRegisterActive` admits every management role with `overrideAccess: true`;
  `sheets-sync.ts` exports three unauthenticated functions from a `'use server'` file;
  `/kasa/[id]` 404s an EMPLOYEE.
- 96 hand-written `useMemo`/`useCallback` in 25 files, 52 of them in the editor pair, despite React
  Compiler being on (`next.config.ts:5`).
- Test net: `lib/*` is well covered; `components/*` relies on `tsc`, E2E and the click-through.

## Desired End State

- Every row of the `change.md` Directories table is ticked Audited and Refactored, with the roles it
  was clicked through under.
- `ledger.md` in the change folder holds one checkbox line per finding, all at a terminal disposition.
- `ui/` cannot import a feature directory without a lint error; dependency-cruiser is gone from the
  repo, its one useful job (counting cycles) done during this change.
- No Payload collection hook lives in `src/hooks/`; no read lives in `lib/actions`; no multi-step
  flow lives in `lib/db`.
- No hand-written `useMemo`/`useCallback` remains where the compiled output caches the value; every
  memo kept is pinned by a compiled-output spec or listed in the ledger with the reason.
- `use-kosztorys-editor.ts` is a composition of focused sub-hooks; `kosztorys-editor-body.tsx` is
  split along its modes.
- A MANAGER sees no active toggle on `/kasy` and the server refuses the write; an EMPLOYEE opening
  `/kasa/{id}` lands on his own page.

### Key Discoveries:

- `toggle-active.ts:80-87` — `toggleCashRegisterActive` has no `refusal`; `toggleUserActive` shows the
  pattern (`refusal` callback, `accountChangeRefusal`). `cash-registers.ts:12-28`
  (`withinManagerScope`) already strips `active` for non-ADMIN/OWNER via `isAdminOrOwnerRole`.
- `toggle-active.db.test.ts` asserts persisted state for the user toggle — the register case goes
  beside it.
- `kasa/[id]/page.tsx` gates with `requireAuth` + `notFound()`; the other `[id]` pages use
  `requireManagementPage` (`inwestycje/[id]/page.tsx:39`), which redirects a non-manager to
  `/zaloguj` → `/` → his own `/pracownicy/{id}`.
- `eslint-plugin-react-hooks@7.0.1` ships the compiler's diagnostics (`preserve-manual-memoization`,
  `incompatible-library`, `refs`, `immutability`, …) and `recommended` already enables them — but
  lint runs only on staged files, so nobody has seen them for the 25 memo files.
- `.dependency-cruiser.cjs` — added 2026-06 for the M4L2 structural map, never run since; its env
  rule targets a non-existent path. Only `no-circular` has no other guard.
- `eslint.config.mjs:103-113` — the „hooks ↛ `lib/cache/revalidate`" rule globs `src/hooks/**`;
  it must follow the Payload hooks when they move.
- The in-flight `hooks/transfers/delete-invoice-media.ts` work landed in `380b54550` — the
  `src/hooks` move is unblocked.

## What We're NOT Doing

- No behaviour change beyond the three owner decisions and bugs proven by a failing test. A finding
  that would change what a role may do is surfaced to the owner, not applied.
- No rename of persisted keys, the `'kosztoryses'` slug, cache tags, Polish URLs, hidden-set column
  ids or sheet column positions.
- No change to `COMPANY_FUNDING`'s client-only gate, `LABOR_COST`/`RABAT` bookability, or the
  MANAGER „redundant" props (accepted rulings).
- No merging of the kosztorys and szablon tables — only their action internals.
- No tests, migrations or `payload-types.ts`; no new E2E specs unless a phase's risk crosses
  client → action → DB → revalidation and no spec covers it.
- No prod DB, Sheets, Blob or mail effect from any step.

## Implementation Approach

Guards first, so every later move is checked by a machine. dependency-cruiser is removed at archive
(`package.json` hand-edited, `.dependency-cruiser.cjs` deleted, a one-off note in
`context/map/artifact-2-structure.md`). Then the access fixes (small, owner-
decided, test-first). Then outward from the best-netted layer: `lib/*` → the actions/db/queries
boundary → the Payload hook move → `components/*`. The memo removal runs after the components
cleanup with its own guard, and the editor split goes last because it is the riskiest and reuses
that guard.

Each phase:

1. Appends a `## Phase N — <name>` section to `ledger.md`, dated, with its baseline numbers.
2. Records one line per finding: `- [x] · fixed|dismissed|dropped|skipped · CODE · path:line ·
reason`. Codes: `DUP` duplication, `LAYER` wrong home, `CYCLE` import cycle, `DEAD` dead code,
   `ACCESS` role gate, `BUG` correctness, `MEMO` hand-written memo, `GOD` oversized module,
   `NOISE` leftover noise. A finding filed to Linear (project Wykonczymy) carries the id.
3. Ticks its rows in the `change.md` Directories table.
4. Lists its click-through as Manual Verification; `/10x-implement` rolls those into
   `context/foundation/manual-checks.md`. The agent drives the browser only when the user says so
   in that session; otherwise the user runs the checks.

## Critical Implementation Details

- **Transaction handles.** Moving a multi-step flow out of `lib/db` must keep every step on one
  transaction handle (`withPayloadTransaction`, `lessons.md:100-110`). The flow becomes an
  orchestrator in `lib/actions` that passes the handle down; each `lib/db` function stays one
  statement.
- **Memo removal is file-atomic.** Stripping memos from a file the compiler bails out on removes all
  memoization from it. Check compiler coverage per file first and strip only files that compile clean.
- **Never fire a server action inside a `setRows` updater** when splitting the editor
  (`lessons.md:392`) — updaters run twice in strict mode.

## Phase 1: Guards and ledger

### Overview

Make the layering rules machine-checked before anything moves, and open the ledger.

### Changes Required:

#### 1. depcruise as a cycle meter only

**File**: `.dependency-cruiser.cjs`

**Intent**: depcruise was installed for a one-off structural map and never wired in; its other rules
duplicate ESLint (hooks ↛ `revalidate`), `pnpm build` (`env/server` in the Payload graph) and knip
(orphans). Cut the config down to `no-circular` and use it by hand during this change to count
cycles before/after Phases 2, 6 and 8. No script, no pre-push gate. The package and config go at
archive.

**Contract**: `pnpm exec depcruise src --config .dependency-cruiser.cjs` reports only `no-circular`;
the count goes into the ledger baseline.

#### 2. `ui/` import boundary

**File**: `eslint.config.mjs`, `src/components/ui/{badge,pie-legend,slice-pie,form-dialog,pending-submit-indicator}.tsx`,
`src/components/ui/use-history-back.ts`, `src/components/ui/{column-order-dialog,column-toggle-menu}.tsx`

**Intent**: Add a `no-restricted-imports` block for `src/components/ui/**` that forbids
`@/components/*` outside `ui/`, `@/stores/*` and domain `@/lib/*` modules, then make it pass: move
the domain components out of `ui/` (e.g. `RoleBadge` to `components/users/`), pass formatters and
store state in as props, move `use-history-back` to `src/hooks/`, break the
column-order ↔ column-toggle cycle.

**Contract**: `pnpm exec eslint src/components/ui` reports zero `no-restricted-imports` errors. No
visual change.

#### 3. Full-lint baseline

**File**: `ledger.md`

**Intent**: Run `pnpm lint` once over the whole tree and record the counts
(errors / warnings by rule, compiler diagnostics among them) as the baseline. Fix errors that are
mechanical; carry the rest into the phase that owns their directory.

#### 4. Ledger

**File**: `context/changes/2026-10-19-app-audit-refactor/ledger.md`

**Intent**: Create it with the code taxonomy and line format above, a `## Phase 1` section, and the
baseline numbers (LOC, duplication %, cycle count, lint counts, memo count).

### Success Criteria:

#### Automated Verification:

- `pnpm exec depcruise src --config .dependency-cruiser.cjs` reports only `no-circular`; count recorded in `ledger.md`
- `pnpm exec eslint src/components/ui` reports no `no-restricted-imports` error
- A deliberate `@/components/investments/...` import in a `ui/` file fails lint (checked, then reverted)

#### Manual Verification:

- ADMIN: role badges on `/pracownicy`, pie legends on an investment's summary, a form dialog's
  pending indicator and the column order/toggle menu on `/transakcje` look and behave as before
- MANAGER: same surfaces, same result

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Access fixes

### Overview

The three owner decisions plus the two access/correctness findings, each test-first.

### Changes Required:

#### 1. MANAGER cannot toggle a register's active state

**File**: `src/lib/actions/toggle-active.ts`, `src/components/cash-registers/cash-registers-table.tsx`,
`src/__tests__/lib/actions/toggle-active.db.test.ts`

**Intent**: First a failing DB spec: a MANAGER calling `toggleCashRegisterActive` gets a refusal and
the register's `active` is unchanged in the DB; an OWNER's call persists. Then add a `refusal` to the
register config that refuses any non-ADMIN/OWNER actor, and stop rendering the toggle for MANAGER
(the table gets the viewer's role the way `cash-register-form.tsx:51` does).

**Contract**: `toggleCashRegisterActive` returns `{ success: false, error }` for MANAGER with no
write; the `/kasy` table shows active state read-only to MANAGER.

#### 2. `/kasa/[id]` redirects an EMPLOYEE

**File**: `src/app/(frontend)/kasa/[id]/page.tsx`

**Intent**: Replace the `requireAuth` + `isManagementRole` → `notFound()` gate with
`requireManagementPage`, as the other `[id]` pages do. Keep the `canViewRegister` → `notFound()`
check so a MANAGER on a MAIN register still gets 404.

**Contract**: EMPLOYEE `/kasa/{id}` → his own `/pracownicy/{id}`; anon → `/zaloguj`; MANAGER on MAIN
→ 404.

#### 3. Sheet helpers out of `'use server'`

**File**: `src/lib/actions/sheets-sync.ts` → a plain server module (e.g. `src/lib/google/transfer-sheet-sync.ts`),
`src/hooks/transfers/sync-sheet.ts` and other importers

**Intent**: `removeTransferFromSheet`, `syncSingleTransferToSheet` and `syncBulkExpensesToSheet` are
called only from server code; moving them out of the `'use server'` file means they can never be an
unauthenticated action endpoint, and breaks the Payload hook → action → `payload.config` cycle.

**Contract**: the three functions keep their signatures; `sheets-sync.ts` exports only wrapped
actions; depcruise cycle count drops by at least one.

#### 4. `BalanceCell` sign after rounding

**File**: `src/components/ui/balance-cell.tsx`, `src/components/payouts/settle-payouts-table.tsx` (or
wherever it lives), a DOM spec under `src/__tests__/components/ui/`

**Intent**: Failing spec first: `-0.004` renders „0,00 zł" without the negative colour. Then reuse
`signedMoneyColor` (`signed-money-display.tsx:7-10`) in `BalanceCell` and in the settle-payouts
re-implementation. If the spec passes before the fix, record it as dismissed and skip the change.

**Contract**: sign colour derives from the rounded amount everywhere.

### Success Criteria:

#### Automated Verification:

- `toggle-active.db.test.ts` passes under `pnpm test:integration`, and its new case failed before the fix
- `pnpm exec vitest run src/__tests__/lib/actions/toggle-active.test.ts` passes
- The `BalanceCell` DOM spec passes (and failed before the fix, or the finding is dismissed)
- depcruise cycle count is lower than the Phase 1 baseline

#### Manual Verification:

- MANAGER on `/kasy`: no active toggle on any row; the form has no type/active fields as before
- OWNER on `/kasy`: toggle a register inactive and back — state persists after reload
- EMPLOYEE opening `/kasa/1`: lands on his own worker page, no 404
- MANAGER opening a MAIN register's URL: 404 as before
- ADMIN: add an expense on an investment with a linked sheet — the sheet sync still runs (local: the
  Viewer-only account refuses the write; check the server log shows the attempt, not a missing import)
- ADMIN on `/wyplaty` → „Rozlicz": a balance that rounds to zero shows „0,00 zł" uncoloured

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: `lib/*` mechanical cleanups

### Overview

The well-netted duplication and dead-export work across `lib/`, `collections/` and `types/`.

### Changes Required:

#### 1. Sort params

**File**: `src/lib/queries/{transfer,lead,expense-draft,worker-report}-sort.ts`,
`src/lib/{transfers,leads,worker-expenses,kosztorys/worker-report}/sortable-columns.ts`, new `src/lib/table/server-sort.ts`

**Intent**: One factory builds the param parser and the `isServerSortable*Column` guard from a
column list; the eight files become one-line configs or disappear. The parsers leave `lib/queries`
(they don't query).

**Contract**: the URL params each list accepts are unchanged.

#### 2. Trashed-aware uniqueness and `trashedAt` field

**File**: `src/lib/actions/{equipment,fleet,workers}.ts`, 7 collections listed in research §2.4

**Intent**: One shared uniqueness check; one `trashedAtField` factory for the seven collections.

**Contract**: generated schema unchanged — `pnpm generate:types` produces no diff in
`payload-types.ts`.

#### 3. Label maps

**File**: `src/collections/{transfers,cash-registers}.ts`, `src/lib/constants/transfers.ts`,
`src/components/tables/cash-registers.tsx`

**Intent**: Collections build their `options` from the `lib` maps (as `vehicles.ts:86` does); move
`REGISTER_TYPE_LABELS` / `_BORDER_COLORS` to `lib/cash-registers/`. Pick one label for MAIN
(„Główna" vs „Główne") by reading where each shows; persisted values stay.

**Contract**: option values unchanged; labels identical to what each surface shows today, except
the one MAIN wording unified.

#### 4. Dead and over-exported code

**File**: `src/lib/db/{notifications,payout-confirmation,worker-expense-drafts,worker-reports,work-catalogue}.ts`,
the knip „exported but used in-file" list

**Intent**: For each production-dead count function, name the bug its spec would stop catching
(`lessons.md`); move the ones that guard `shell-badge-counts` into test helpers, delete the rest.
Drop `export` from in-file-only symbols. Gate every deletion on `pnpm typecheck`.

#### 5. Single-feature homes

**File**: `src/types/{fleet,leads,company-knowledge,notifications}.ts`, the single-consumer
`src/lib/utils/*` files in research §3, `src/lib/schemas/transfer-validation.ts`

**Intent**: Move each next to its only consumer; merge the overlapping `date.ts` / `date-range.ts` /
`days.ts` where they duplicate.

#### 6. Deprecated APIs carried over from Phase 1

**File**: `src/lib/utils/print-window.ts`, `src/components/transfers/print-transfers-button.tsx`,
`src/lib/ai/{openrouter,translate,worker-report-scan}.ts`

**Intent**: `writeAndPrint` builds the print page without `document.write`, and the transfers
printout goes through it instead of its own write-close-print copy. The three `generateObject`
calls become `generateText` with `Output.object` (AI SDK 6+ migration).

**Contract**: every printout (transfers, offer, worker sheet, protocol, contract) looks and prints
as before; receipt, paper-report and translation reads return the same shapes.

### Success Criteria:

#### Automated Verification:

- Specs under `src/__tests__/lib/{queries,table,transfers,leads,worker-expenses,kosztorys/worker-report,constants}` pass
- `pnpm generate:types` leaves `src/payload-types.ts` unchanged
- `pnpm knip` reports no new unused export or file

#### Manual Verification:

- ADMIN: sort every server-sorted list (Transakcje, Leady, Zgłoszenia wydatków, Zgłoszenia prac) by
  each sortable column, reload — order and URL survive
- ADMIN: create an equipment item / vehicle / worker with a name a trashed one already has — same
  refusal or acceptance as before
- MANAGER: register type labels on `/kasy` and on the dashboard tiles read the same as each other
- ADMIN: print transfers, an offer and a contract — logo and layout as before, the window closes
  after printing
- ADMIN: scan a receipt and a paper worker report, translate a kosztorys description — same result

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: actions / db / queries boundary

### Overview

Put each piece of data access where AGENTS.md „Where code lives" says it lives.

### Changes Required:

#### 1. Reads out of `lib/actions`

**File**: `src/lib/actions/{kosztorys-snapshots,template-snapshots,template-tree,investments,kosztorys-import,sheets-sync}.ts`

**Intent**: Move each read to `lib/queries` (a client-invoked read stays `'use server'` there);
reuse `readKosztorysRevision` for the template-tree twin. `worker-expense-drafts.ts:180` stays — it
persists the AI read (record as dismissed).

#### 2. Flows out of `lib/db`

**File**: `src/lib/db/worker-expense-drafts.ts` (`decideExpenseParagons` :514, `mergeExpenseDrafts`
:674), `snapshots.ts:188`, `worker-reports.ts:298`

**Intent**: Split each into single-statement `lib/db` functions plus an orchestrator in
`lib/actions` (mutations) or `lib/queries` (`readWorkerReport`), keeping one transaction handle.

**Contract**: the callers' signatures and results are unchanged; refusal messages unchanged.

#### 3. `lib/actions/kosztorys.ts` by aggregate

**File**: `src/lib/actions/kosztorys.ts` → `kosztorys-items.ts`, `kosztorys-sections.ts`,
`kosztorys-settings.ts`, `kosztorys-stages.ts`

**Intent**: One file per aggregate; dedupe the section-insert and new-slot internals with
`template-structure.ts` behind a shared helper that takes the table — the tables stay separate.

### Success Criteria:

#### Automated Verification:

- `pnpm test:integration` passes (DB specs, parity, golden master)
- Specs under `src/__tests__/lib/{actions,db,queries}` pass

#### Manual Verification:

- ADMIN: accept, merge and reject expense drafts from `/zgloszenia-wydatkow` — settled amounts and
  paragon decisions persist as before
- ADMIN: open a worker report preview and the report page `(share)/z/…` at 390 px — same figures
- ADMIN/MANAGER in the kosztorys v2 editor: add/rename/delete a section, add an item, edit stages and
  investment settings, restore a snapshot — all persist after reload
- ADMIN in a Szablon: add a section and an item — persist after reload

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 5: Payload hooks out of `src/hooks`

### Overview

`src/hooks` becomes React hooks only; Payload collection hooks move beside their collections.

### Changes Required:

#### 1. Move

**File**: `src/hooks/{cash-registers,equipment,investments,media,transfers,users}/`,
`src/hooks/{prevent-delete,reset-bookkeeping,revalidate-collection}.ts` → `src/collections/hooks/`

**Intent**: Pure move plus import updates in the collections.

#### 2. Guards and docs follow

**File**: `eslint.config.mjs:103-113`, `AGENTS.md` (Data Fetching And
Cache, Where code lives), `context/map/repo-map.md`

**Intent**: The „hooks ↛ `lib/cache/revalidate`" lint rule points at the new path;
AGENTS.md names `src/collections/hooks/` as the home of Payload hooks.

### Success Criteria:

#### Automated Verification:

- An `@/lib/cache/revalidate` import in a moved hook fails lint (checked, then reverted)
- Hook DB specs (`src/__tests__/hooks/**`, moved to mirror the new path) pass under `pnpm test:integration`

#### Manual Verification:

- ADMIN: create, edit and cancel a transfer — balances update without a reload
- ADMIN: delete an expense with a faktura — the faktura disappears from the media list
- ADMIN: try to delete a cash register that has transfers — refused as before

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 6: `components/*` cleanups

### Overview

Everything in `components/` except the kosztorys editor pair, one directory at a time in the order of
the Directories table.

### Changes Required:

#### 1. Hook homes

**File**: the misplaced hooks in research §3 (`use-expense-draft-acceptance.tsx`, `use-report-preview.tsx`,
`use-report-draft.ts`, `use-client-snapshot.ts`, and the editor hooks outside `editor/hooks/`)

**Intent**: Move per the „hook's home follows its consumer count" rule.

#### 2. Duplication

**File**: `worker-expense-drafts-table.tsx:84-136` + `worker-report-history-table.tsx:73-126`;
`transfer-view-switch.tsx`, `ui-scale-switch.tsx`; `login-form.tsx` + `forgot-password-form.tsx`

**Intent**: One client filter + pagination hook for the two tables; the two switches wrap
`ui/toggle-group.tsx` with zero visual change (if the primitive restyles, keep markup and add only
the behaviour); the auth clone only if the shared part is more than the params.

#### 3. Cycles and large files

**File**: `form-base` ↔ `form-hooks` ↔ `form-checkbox`; `expense-form` ↔ `use-paragon-decisions`
(`ParagonRowT`); `line-items-field.tsx` (row-select helpers, file-scan ingestion); i18n dictionaries
↔ `translations.ts`; worker-report UI spread over four directories

**Intent**: Break each cycle by moving the shared type or helper down a level; split
`line-items-field.tsx` along its three concerns; consolidate worker-report UI only where a file sits
in a directory none of its consumers share. Read `context/map/repo-map.md:158-163` before touching
a cycle recorded there as intentional.

#### 4. Per-directory audit

**File**: each `components/*` row of the Directories table

**Intent**: Read each directory against AGENTS.md, ledger every finding, fix the confident ones.

### Success Criteria:

#### Automated Verification:

- Specs under `src/__tests__/components/**` for every touched directory pass
- depcruise cycle count is lower than after Phase 2

#### Manual Verification:

- EMPLOYEE at 390 px on his own `/pracownicy/{id}`: send an expense draft with a receipt scan, delete
  a draft, accept a payout, open a report link
- ADMIN: add a transfer with line items from a scanned faktura; switch the Transakcje list/card view
  and the UI scale — same look as before
- ADMIN and MANAGER: filter and page through Zgłoszenia wydatków and the worker report history
- anon: log in, use „Zapomniane hasło" — same flow as before

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 7: Memo guard and removal (outside the editor pair)

### Overview

Owner decision 2: tests first, then removal. 23 files, 44 memos.

### Changes Required:

#### 1. Compiler coverage guard

**File**: new `scripts/check-compiler-coverage.mjs`, `package.json`

**Intent**: For each file that holds a hand-written memo, run `babel-plugin-react-compiler` (the
version Next uses) over it and report whether every component/hook compiled — `_c(` in the output
and no bailout from the compiler's logger. Pair it with an ESLint run of the compiler diagnostics
(`react-hooks/preserve-manual-memoization`, `incompatible-library`, `refs`, `immutability`) over the
same files. A file that bails out is ledgered as `MEMO · skipped` with the diagnostic, or fixed if
the cause is a plain rule violation.

**Contract**: `pnpm check:compiler <files…>` exits non-zero when any listed file has a component or
hook the compiler skipped.

#### 2. Behaviour specs where missing

**File**: under `src/__tests__/` mirroring each memo file that no spec imports

**Intent**: Before stripping, each file whose memo feeds observable output (filtered rows, persisted
values, element height) gets a spec asserting that output, so a stripped memo that changes behaviour
fails a test. Files whose memo is a stable callback with no observable effect skip this — say so in
the ledger.

#### 3. Strip

**File**: the 23 files

**Intent**: Remove the memos from each file that passes the guard; re-run the guard after each file.

### Success Criteria:

#### Automated Verification:

- `pnpm check:compiler` passes for every stripped file
- The new and existing specs for the 23 files pass
- `grep -rE '\buse(Memo|Callback)\(' src` outside the editor pair lists only ledgered skips

#### Manual Verification:

- ADMIN: filter and search the Katalog prac, Sprzęt, Flota, Pracownicy, Inwestycje and Kasy tables;
  toggle an active state optimistically — no flicker, no lost filter
- ADMIN: a persisted preference (sidebar collapse, a filter) survives a reload

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 8: Kosztorys editor split

### Overview

The god hook and god component, last, netted by the four `use-kosztorys-editor-*` renderHook specs,
12 E2E specs and the Phase 7 guard.

### Changes Required:

#### 1. `use-kosztorys-editor.ts` into sub-hooks

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts` → `editor/hooks/use-undo-bursts.ts`,
`use-editor-totals.ts`, `use-section-crud.ts`, `use-catalogue-ops.ts`, `use-grid-change-pipeline.ts`
(names indicative)

**Intent**: Extract along the seams in research §1; the entry hook composes them and keeps its
return shape, so callers don't change. No server action inside a `setRows` updater.

**Contract**: `useKosztorysEditor`'s return type is unchanged.

#### 2. `kosztorys-editor-body.tsx` along its modes

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: Split history / report / preview modes and the row-height measurement (370–465) into
their own components or hooks; the body renders the active mode.

#### 3. Strip the editor's memos

**File**: both files and their extracts

**Intent**: Same procedure as Phase 7; the `:384` perf comment goes with its memo once the guard
shows the compiler covers it.

#### 4. Break the editor cycles

**File**: `kosztorys-actions-context.tsx` ↔ its four action modules; `kosztorys-v2-columns` →
`use-kosztorys-editor` → `kosztorys-v2-columns`

**Intent**: Move the shared types down so the context depends on them, not the reverse.

### Success Criteria:

#### Automated Verification:

- `use-kosztorys-editor-*.test.tsx` and every spec under `src/__tests__/components/kosztorys/**` pass
- `pnpm check:compiler` passes for every editor file
- depcruise cycle count is lower than after Phase 6

#### Manual Verification:

- ADMIN on a large kosztorys (perf seed, ~1000 rows): typing in a cell, undo/redo of a paste burst,
  scrolling — no visible lag compared to `staging` before this change
- ADMIN: add/move/delete a section, add an item from the catalogue, edit stage quantities, apply a
  global rabat — totals and „Pozostało" update and persist
- ADMIN: switch to history, the worker report view and the offer preview, and back
- MANAGER: same editor, no financial figures shown
- ADMIN at 390 px: the editor renders, scrolls and accepts a cell edit

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- New: the register-toggle refusal (DB, persisted state), `BalanceCell` rounding, specs for memo files
  with observable output, the sort-param factory.
- Every move mirrors its spec path (`src/__tests__/<source path>`).

### Integration Tests:

- `pnpm test:integration` at Phases 4 and 5 (DB layer and Payload hooks move).
- E2E is not run by the agent; the user runs `pnpm test:e2e` before the review gate.

### Manual Testing Steps:

The per-phase click-throughs above, under the roles each lists, rolled into
`context/foundation/manual-checks.md`.

## Performance Considerations

Only the editor matters: Phase 8's manual check compares a ~1000-row kosztorys against `staging`
before the change. If the compiler can't cover a perf-critical memo, it stays and is ledgered. Outcome: the
editor and work-catalogue memos stayed (ledger „Perf fix”).

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:integration`
- `pnpm build`
- `pnpm test:e2e` — run by the user

## References

- Research: `context/changes/2026-10-19-app-audit-refactor/research.md`
- Method: `context/archive/2026-09-15-test-suite-audit/`
- Lessons: `context/foundation/lessons.md` (:100-110 transactions, :392 updaters, :556-557 guards,
  :597-608 editor action sets)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Guards and ledger

#### Automated

- [x] 1.1 depcruise reports only `no-circular`; baseline count in the ledger — 6a20d37cb
- [x] 1.2 `ui/` has no `no-restricted-imports` error — 6a20d37cb
- [x] 1.3 A deliberate feature import in `ui/` fails lint — 6a20d37cb

### Phase 2: Access fixes

#### Automated

- [x] 2.1 Register-toggle DB spec passes and failed before the fix — 05cb76595
- [x] 2.2 `toggle-active.test.ts` passes — 05cb76595
- [x] 2.3 `BalanceCell` spec passes (or finding dismissed) — 134b6123d
- [x] 2.4 Cycle count below the Phase 1 baseline — d0f94af0f

### Phase 3: `lib/*` mechanical cleanups

#### Automated

- [x] 3.1 Touched `lib` specs pass (4f38b3556)
- [x] 3.2 `pnpm generate:types` leaves `payload-types.ts` unchanged (4f38b3556)
- [x] 3.3 `pnpm knip` reports nothing new (4f38b3556)
- [x] 3.4 No `document.write` / `generateObject` left in `src/`; print and AI specs pass — skipped for `print-window.ts:28` (ledger `DEAD`: the print window needs it)

### Phase 4: actions / db / queries boundary

#### Automated

- [x] 4.1 `pnpm test:integration` passes (821dbe832, 159 files / 880 tests)
- [x] 4.2 `lib/{actions,db,queries}` specs pass (555a7a7f1)

### Phase 5: Payload hooks out of `src/hooks`

#### Automated

- [x] 5.1 A `lib/cache/revalidate` import in a moved hook fails lint (84c3eb997)
- [x] 5.2 Hook DB specs pass under `pnpm test:integration` (84c3eb997)

### Phase 6: `components/*` cleanups

#### Automated

- [x] 6.1 Specs for touched component directories pass (522dc05a4)
- [x] 6.2 Cycle count below the Phase 2 count (522dc05a4)

### Phase 7: Memo guard and removal (outside the editor pair)

#### Automated

- [x] 7.1 `pnpm check:compiler` passes for every stripped file (3430b481c)
- [x] 7.2 Specs for the 23 files pass (3430b481c)
- [x] 7.3 Remaining memos outside the editor pair are all ledgered skips (3430b481c)

### Phase 8: Kosztorys editor split

#### Automated

- [x] 8.1 Editor specs pass (37cb5f2d2)
- [x] 8.2 `pnpm check:compiler` passes for every editor file — superseded: compiling is not caching; the editor's hand memos were restored and pinned by compiled-output specs (ledger „Perf fix”)
- [x] 8.3 Cycle count below the Phase 6 count (37cb5f2d2)
