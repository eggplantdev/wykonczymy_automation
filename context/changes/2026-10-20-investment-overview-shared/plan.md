# Shared investment overview + reference data provider — Implementation Plan

## Overview

Move the layout's reference data (`fetchReferenceData`) and order settings into a client context provider in
`AuthenticatedShell`, switch every client consumer of the `referenceData` props to a hook, then extract the
investment page's overview block into one `InvestmentOverview` rendered by `/inwestycje/[id]` and the kosztorys
„Inwestycja" tab — with no measurable slowdown on any page.

## Current State Analysis

From `research.md` (baseline, code references, Flight dedupe):

- `Navigation` (`src/components/nav/navigation.tsx:17-27`) awaits `fetchReferenceData()` for management roles and
  hands it only to `TopNav`. Pages fetch it again (same `cache()` object) and drill slices into client
  components; Flight serializes it once per request (`canAddExpensesWithoutInvestment×64` on every OWNER page,
  `×0` for EMPLOYEE).
- `fetchOrderSettings` is fetched by `/inwestycje` and `/inwestycje/[id]` only.
- The two investment views have drifted: the page (`inwestycje/[id]/page.tsx:71-134`) has the trash banner,
  Umowa, Prośba o weryfikację, Arkusz, Kosztorys_v2, Zamów, Kierownik budowy, the standalone status select and the
  „Zdjęcia i pliki" section; the tab (`summary-investment-tab.tsx`) has Dokumentacja + Edytuj, the default
  InfoList, notes and AI notes, and no trashed handling.

## Desired End State

- One provider under `AuthenticatedShell` carries two **pending** promises (reference data, order settings),
  created only for management roles. Every client component that took `referenceData` / a slice of it from a
  server parent reads `useReferenceData()` / `useOrderSettings()` instead — except the EMPLOYEE-reachable
  `WorkerQuickActions` → `ExpenseDraftDialog` `sendableRegisters`, which stays a server prop.
- Page fetches of `fetchReferenceData` remain only where the server itself reads the data.
- `InvestmentOverview` (client) is the page's block, verbatim in behaviour; the kosztorys „Inwestycja" tab renders
  the same component without the Kosztorys_v2 button. A trashed investment is read-only in both.
- Local interleaved A/B passes the criteria in `research.md` § Load timings; the EMPLOYEE page still carries
  `×0` reference-data markers.

### Key Discoveries:

- Promise-in-context pattern: `src/hooks/use-unread-counts.tsx` + `layout.tsx:74` (unawaited fetch).
- `useCurrentUser()` (`src/hooks/use-current-user.tsx`) supplies `currentUserId` / `currentUserRole`, so the hook
  can return a full `ReferenceDataT` (`src/types/reference-data.ts:89-103`) without the server merge.
- `(share)` layouts mount neither `CurrentUserProvider` nor the new provider; `KosztorysEditorBody` and
  `SummaryPanelContent` render there (`(share)/k/[token]:27`, `(share)/podglad-inwestora/[id]:19`,
  `worker-report/report-grid.tsx:91`, `investment-summary-panel.tsx:59`). Lesson: `lessons.md` § Disclosure.
- `KosztorysEditorProvider` takes nothing new (kosztorys `AGENTS.md`).
- `InvestmentAssetsSection` is the only server component in the page block; both pages already fetch `assets`
  (`kosztorys_v2/page.tsx` passes them down).
- `SheetButton` reads `investment.hasSheet`; the tab needs only `trashed` forwarded to derive the lock.
- `EditInvestmentDialog` shows Kierownik budowy only when `workers` is passed; `edit-investment-prefill.tsx:17`
  passes none.

## What We're NOT Doing

- No change to what the reference data contains or how it's cached (`reference-data.ts` untouched).
- No new consumers beyond the overview's Zamów; no change to `KosztorysEditorProvider`, the `(share)` routes or
  the template editor (`szablony/[id]`).
- No redesign of the overview: the page's current block is the spec; the tab adopts it.
- No change to server-side uses (`findInvestmentRef`, `buildFilterConfig`, `expenseCategories`, row building on
  `/pracownicy`, `/kosztorysy`).
- EMPLOYEE `sendableRegisters` stays a server prop.

## Implementation Approach

Provider first, measured on its own (it touches every management page), then the mechanical consumer switch,
then the overview, then the final measurement. Work in a dedicated worktree
(`scripts/worktree-new.sh investment-overview-shared staging`); the perf worktree
(`../wykonczymy-worktrees/perf-investment-overview`, staging `a5b463e75`) stays the before build.

## Critical Implementation Details

- **Never await in the shell.** `AuthenticatedShell` creates both promises unawaited (like `fetchUnreadCounts()`
  at `layout.tsx:74`), so `children` keeps rendering beside `Navigation`. Awaiting above `children` serializes
  every page fetch behind ~5 SQL.
- **PII gate.** The promise is created only when `isManagementRole(user.role)`; otherwise the provider gets
  `null`. An unawaited promise passed to a client component is still serialized when it resolves.
- **Same object, same bytes.** Pass the `fetchReferenceData()` promise itself, never a `.then(...)`-mapped copy —
  Flight dedupes by identity, so a page that still passes a slice of the same object adds nothing, and a mapped
  copy re-serializes all workers. Any client-side derivation (`/zgloszenia`'s `investments.map`, the TopNav
  merge) happens in the client after `use()`.
- **Where `use()` runs.** Read the hook as deep as the data is needed (dialog/form bodies, the column factory's
  consumer), not at page-level wrappers, so a button never suspends. Every consumer page awaits the same cached
  fetch today, so no boundary waits longer than now; a consumer reached from a page whose fetch is dropped sits
  under that route's `loading.tsx`.
- **Hook outside the provider.** `useReferenceData()` returns `null` when there is no promise (EMPLOYEE, or a
  render outside the provider). Management-only consumers render nothing on `null`; none may throw, because
  `TransferDataTable` and the kosztorys body also render for EMPLOYEE / under `(share)`.

## Phase 1: Provider and hooks

### Overview

Add the provider + hooks, mount them in the shell, move `Navigation`/`TopNav` onto them, add the test seam.

### Changes Required:

#### 1. Provider + hooks

**File**: `src/hooks/use-reference-data.tsx` (new)

**Intent**: Context carrying the pending reference-data and order-settings promises, mirroring
`use-unread-counts.tsx`.

**Contract**: `ReferenceDataProvider({ referenceData: Promise<ReferenceDataBaseT> | null, orderSettings:
Promise<OrderSettingsT> | null, children })`; `useReferenceData(): ReferenceDataT | null` (merges
`currentUserId` / `currentUserRole` from `useCurrentUser()`); `useOrderSettings(): OrderSettingsT | null`.

#### 2. Shell

**File**: `src/app/(frontend)/layout.tsx`

**Intent**: Create both promises (management roles only, unawaited) and wrap the shell in
`ReferenceDataProvider` inside `CurrentUserProvider`.

**Contract**: `fetchReferenceData()` / `fetchOrderSettings()` called once each in `AuthenticatedShell`, gated by
`isManagementRole`.

#### 3. Nav

**Files**: `src/components/nav/navigation.tsx`, `src/components/nav/top-nav.tsx`

**Intent**: `Navigation` stops fetching; `TopNav`'s Deposit / InternalTransfer / Expense dialogs read the hook.

**Contract**: `TopNav` loses its `referenceData` prop; dialogs render only when the hook returns data (same as
today's `undefined` for EMPLOYEE).

#### 4. Test seam

**Files**: `src/__tests__/stubs/use-reference-data.ts` (new), `src/__tests__/setup/dom.ts`

**Intent**: Mirror the `use-current-user` seam: stub returns `referenceDataFor(authState.role)` (null for
EMPLOYEE) and a default order-settings fixture; `vi.mock('@/hooks/use-reference-data', passThrough(...))`.

**Contract**: specs steer it through `authState` like the current-user stub.

### Success Criteria:

#### Automated Verification:

- Top-nav dialog specs pass on the hook: `pnpm exec vitest run src/__tests__/components/forms/deposit-form`
  (and the expense / internal-transfer form specs that render through TopNav)
- `canAddExpensesWithoutInvestment` count unchanged on the after build (`baseline.mjs`): ×64 on OWNER pages,
  ×0 for EMPLOYEE

#### Manual Verification:

- As OWNER on any page: „Wpłata", „Transfer między kasami" and „Wydatek" from the top bar open with the same
  kasy / inwestycje / pracownicy lists as before and save.
- As a worker (EMPLOYEE) on the phone: the own page loads and the top bar shows no management dialogs.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Perf checkpoint (layout only)

### Overview

Measure the provider alone before anything else moves, so a layout regression is caught where it is cheap to
attribute.

### Changes Required:

#### 1. Interleaved A/B

**Files**: none in the repo — `dumps/perf/measure-overview.mjs` and `baseline.mjs` in the perf worktree.

**Intent**: Build the change worktree and `start.mjs 3101`; run warm-up + before (:3100) → after (:3101) → before
→ after, `PERF_WORKER=77`, `fetch-cache` cleared on both first.

**Contract**: results under `dumps/perf/results/after-p2-*.json`; a summary table appended to `research.md` as
„### Load timings (after phase 1)".

### Success Criteria:

#### Automated Verification:

- Pass criteria from `research.md` § Load timings hold on every page (warm SQL and depth identical, doc KB ±2 KB,
  TTFB/LCP within max(15 %, 20 ms) after a re-measure)
- refData copies stay 1 on OWNER pages and 0 for EMPLOYEE

#### Manual Verification:

- None (measurement phase).

---

## Phase 3: Switch every consumer

### Overview

Remove `referenceData` / slice props from server → client edges; consumers read the hooks. Drop page fetches
that no longer feed anything server-side.

### Changes Required:

#### 1. Pages that drop their fetch

**Files**: `src/app/(frontend)/sprzet/page.tsx`, `sprzet/[id]/page.tsx`, `kasy/page.tsx`,
`zgloszenia/page.tsx`, `zgloszenia-wydatkow/page.tsx`, `inwestycje/page.tsx`

**Intent**: Stop fetching reference data / order settings and stop passing them; receivers
(`EquipmentDataTable` → `AddEquipmentDialog`, `TransferEquipmentDialog`, `CashRegistersTable` →
`AddCashRegisterDialog`, `LeadsDataTable` (investment options mapped client-side),
`PendingExpenseDrafts` / `ExpenseDraftsDataTable` → `useExpenseDraftAcceptance` → `ExpenseForm`,
`InvestmentDataTable` → `EditInvestmentDialog` / `OrderDialog`) read the hooks.

**Contract**: those props are removed from the receivers' types.

#### 2. Pages that keep their fetch (server use) but stop passing it

**Files**: `kasa/[id]/page.tsx` (`EditCashRegisterDialog`, `TelmakCheckDialog`), `pracownicy/page.tsx`
(`UserDataTable` cashRegisters), `pracownicy/[id]/page.tsx` (`EditWorkerDialog` cashRegisters — management
branch only), `kosztorysy/page.tsx` (`KosztorysDataTable` `availableInvestments` derived client-side),
`inwestycje/[id]/page.tsx` (handled in Phase 4), `components/dashboard/manager-dashboard*.tsx`
(`PendingExpenseDrafts`), `components/tables/transfer-table-server.tsx` (`TransferDataTable` →
`getTransferColumns` → `EditTransferDialog` / `EditTransferForm`).

**Intent**: Same switch; the server keeps its own read.

**Contract**: `WorkerQuickActions` → `ExpenseDraftDialog` `sendableRegisters` stays a server prop (EMPLOYEE
reaches it). `TransferDataTable`'s actions column reads the hook only when it renders (it is excluded for
EMPLOYEE today).

#### 3. Kosztorys

**Files**: `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`, `src/components/kosztorys/.../kosztorys-editor-v2.tsx`

**Intent**: `KosztorysEditorV2` reads `workers` from the hook when it has an investment and passes them down
as today; the page stops passing `workers`. `KosztorysEditorBody`, the panel and `SummaryPanelContent` keep their
`workers` prop (they render under `(share)`).

**Contract**: template route (`szablony/[id]`) and every `(share)` mount unchanged.

#### 4. Edit dialog

**Files**: `src/components/dialogs/edit-investment-dialog.tsx`, `edit-investment-prefill.tsx`

**Intent**: Read workers from the hook; an explicit `showSiteManager` flag replaces "workers passed" as the
Kierownik budowy toggle.

**Contract**: `showSiteManager?: boolean` (prefill passes none → field hidden as today).

#### 5. Specs

**Files**: the ~25 specs passing reference data as props (forms, orders, tables, worker-expenses, kosztorys,
leads) — list in `research.md` / `src/__tests__/helpers/reference-data.ts` users.

**Intent**: Drop the props; steer through `authState` / the stub. A spec that needs specific data overrides the
stub through the seam.

### Success Criteria:

#### Automated Verification:

- Touched specs pass: `pnpm exec vitest run <each touched spec>`
- No `referenceData=` / `workers={refData` props left between a server page and a client component
  (`rg "referenceData=|refData\.(workers|cashRegisters)" src/app` returns only server-side reads)

#### Manual Verification:

- As OWNER: `/sprzet` „Dodaj sprzęt" and `/sprzet/[id]` „Przekaż" list the same pracownicy / inwestycje.
- `/kasy` „Dodaj kasę" lists the pracownicy; `/kasa/[id]` „Edytuj" and „Sprawdzenie Telmak" open and save.
- `/zgloszenia` investment filter lists the inwestycje; `/zgloszenia-wydatkow` accepting a zgłoszenie opens the
  expense form prefilled and saves.
- `/inwestycje` row „Edytuj" (Kierownik budowy present) and „Zamów" work; `/kosztorysy` „Dodaj kosztorys" lists
  inwestycje without a kosztorys.
- `/pracownicy` and `/pracownicy/[id]` (as OWNER) „Edytuj" lists kasy; a transfer row's „Edytuj" opens and saves.
- Kosztorys editor: etap split, „Pracownicy" menu and the Podsumowanie subcontractor view show the same pracownicy.
- As a worker (EMPLOYEE) on the phone: own page, „Wyślij zgłoszenie wydatku" lists only own kasy.
- Investor link (`/k/...`) and „Podgląd inwestora" render unchanged.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Shared `InvestmentOverview`

### Overview

Extract the page block into one client component; the kosztorys tab renders it.

### Changes Required:

#### 1. Component

**File**: `src/components/investments/investment-overview.tsx` (new, `'use client'`)

**Intent**: The page block from `inwestycje/[id]/page.tsx:71-134` as-is: trash banner; buttons Edytuj (with
`showSiteManager`), Umowa, Prośba o weryfikację (lock `completed`), Arkusz (`hasSheet`), Kosztorys_v2 (only when
`showKosztorysButton`), Zamów (`!trashed && isOfferedForBooking`, data from the hooks); InfoList via
`buildInvestmentInfoFields(investment, { isReadOnly: trashed, hideStatus: !trashed })` + Kierownik budowy
select; standalone status select; notes (`readOnly={trashed}`); AI notes; „Zdjęcia i pliki" section rendering
`InvestmentAssetsControl` from an `assets` prop.

**Contract**: `{ investment: InvestmentWithDetailsT; trashed: boolean; assets: MediaFileT[];
showKosztorysButton?: boolean }`. Workers / order settings come from the hooks; Zamów and Kierownik render
nothing when the hook returns `null`.

#### 2. Investment page

**Files**: `src/app/(frontend)/inwestycje/[id]/page.tsx`, `src/components/investments/investment-assets-section.tsx`

**Intent**: Page fetches `assets` (`fetchInvestmentAssets`) in its `Promise.all`, drops `fetchOrderSettings`,
renders `<InvestmentOverview showKosztorysButton …/>`. `InvestmentAssetsSection` is deleted (no other user).

**Contract**: the page keeps `fetchReferenceData` for `findInvestmentRef`, `buildFilterConfig`,
`expenseCategories`.

#### 3. Kosztorys tab

**Files**: `kosztorys_v2/page.tsx`, `kosztorys-editor-v2.tsx`, `kosztorys-editor-body.tsx` (`:516-547`),
the totals panel, `summary-panel-content.tsx`, `summary-investment-tab.tsx`

**Intent**: Forward `trashed` (from `findInvestmentRef`) to the tab; the tab renders `InvestmentOverview`
without the Kosztorys_v2 button. Rendered only on the investment route (the tab is absent under `(share)`).

**Contract**: one new optional `trashed?: boolean` prop along body → panel → `SummaryPanelContent`; nothing
added to `KosztorysEditorProvider`.

#### 4. Spec

**File**: `src/__tests__/components/investments/investment-overview.test.tsx` (new)

**Intent**: Guard the two variants the tab used to lack: trashed → banner, no Edytuj / Umowa / Zamów /
Kierownik, notes read-only; `showKosztorysButton` false → no Kosztorys_v2 button; EMPLOYEE stub (`null` hook) →
no Zamów, no throw.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/investments/investment-overview.test.tsx`
- Existing kosztorys summary-panel specs pass: `pnpm exec vitest run src/__tests__/components/kosztorys/summary`

#### Manual Verification:

- `/inwestycje/[id]` looks and behaves exactly as before (buttons, Kierownik budowy, status, notatki, AI notes,
  „Zdjęcia i pliki").
- Kosztorys editor → Podsumowanie → „Inwestycja": same block as the investment page minus „Kosztorys v2";
  „Zamów" opens the order dialog with the investment's address and kierownik; status / Etap AI / Kierownik
  budowy change and stick after reload.
- A completed investment shows „Prośba o weryfikację" in both views; one with an arkusz shows „Arkusz".
- An investment in the Kosz: both views show the banner and are read-only.
- Investor link (`/k/...`) Podsumowanie unchanged.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 5: Final perf run

### Overview

Repeat the interleaved A/B against the before build with everything in, and record it.

### Changes Required:

#### 1. Measurement

**Files**: `research.md` („### Load timings (after)"), perf worktree `dumps/perf/results/after-final-*.json`

**Intent**: Same protocol as Phase 2 over the full page list, plus `baseline.mjs` for RSC KB / copies. Field
check after release: `dumps/perf/obs.mjs` per `research.md` § Production timings — recorded later, not a merge
gate.

### Success Criteria:

#### Automated Verification:

- `research.md` pass criteria hold on every page; `kosztorys_v2` and `/inwestycje/26` grow < 5 KB
- refData copies 1 (OWNER) / 0 (EMPLOYEE)

#### Manual Verification:

- None (measurement phase).

---

## Testing Strategy

### Unit Tests:

- `investment-overview.test.tsx` (Phase 4) — trashed, tab variant, no-data hook.
- Existing DOM specs move onto the reference-data seam (Phase 1 stub, Phase 3 migrations).

### Integration Tests:

- None new: no SQL or action changes.

### Manual Testing Steps:

1. Every management dialog that lists kasy / pracownicy / inwestycje still lists them (Phase 3 list).
2. Kosztorys „Inwestycja" tab ≡ investment page block, Zamów works there.
3. EMPLOYEE phone page and investor links unchanged.

## Performance Considerations

The only risk is ordering (awaiting above `children`) and a mapped copy defeating Flight dedupe; both are covered
by Critical Implementation Details and gated by Phases 2 and 5.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (asked for before running)
- `pnpm build`

## References

- Research + baselines: `context/changes/2026-10-20-investment-overview-shared/research.md`
- Provider pattern: `src/hooks/use-unread-counts.tsx`, `src/app/(frontend)/layout.tsx:74`
- Page block: `src/app/(frontend)/inwestycje/[id]/page.tsx:71-134`
- Measurement kit: `scripts/perf/`, `context/reference/perf-measurement.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Provider and hooks

#### Automated

- [x] 1.1 Top-nav dialog specs pass on the hook — 0954a5ebf
- [x] 1.2 `canAddExpensesWithoutInvestment` count unchanged (×64 OWNER, ×0 EMPLOYEE) — p2

### Phase 2: Perf checkpoint (layout only)

#### Automated

- [x] 2.1 Pass criteria from research.md § Load timings hold on every page — p2
- [x] 2.2 refData copies stay 1 on OWNER pages and 0 for EMPLOYEE — p2

### Phase 3: Switch every consumer

#### Automated

- [ ] 3.1 Touched specs pass
- [ ] 3.2 No reference-data props left between a server page and a client component

### Phase 4: Shared `InvestmentOverview`

#### Automated

- [ ] 4.1 `investment-overview.test.tsx` passes
- [ ] 4.2 Existing kosztorys summary-panel specs pass

### Phase 5: Final perf run

#### Automated

- [ ] 5.1 research.md pass criteria hold on every page; `kosztorys_v2` and `/inwestycje/26` grow < 5 KB
- [ ] 5.2 refData copies 1 (OWNER) / 0 (EMPLOYEE)
