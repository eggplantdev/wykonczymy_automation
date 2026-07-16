# Investment „Planowana" Status Implementation Plan

## Overview

Add a third investment status, `planowana` ("planned / prospect"), so the owner can build a kosztorys
for a client who has not yet decided to work with us — a proposal — without inventing a
standalone-kosztorys code path. A planowana investment is the container the kosztorys needs (VAT,
markup coefficients, global discount, URL); the kosztorys wiring is untouched. When the client commits,
the owner promotes the investment to `aktywna` (the existing status); the kosztorys carries over intact.

## Current State Analysis

- **The kosztorys is investment-scoped by construction.** `kosztorys-sections.investment` is
  `required: true`; every kosztorys action takes a required `investmentId`; VAT / coeffs / global
  discount all live on the `investments` row and cascade to the tree. There is no way to create a
  kosztorys without an investment, and making one would be a large structural change (re-home those
  fields, fork every "has/no investment" path, new URL). Owner ruled that out.
- **Status is a binary today, and the investment list rents shared binary helpers.**
  - `collections/investments.ts:6-9` — `STATUS_OPTIONS` = `active` | `completed`, default `active`.
  - `lib/queries/reference-data.ts:91-92` — casts status to `'active'|'completed'` and derives a
    boolean `active: row.status === 'active'`. `InvestmentRefT.active` is consumed widely.
  - `investment-data-table.tsx:34-44` — uses `useOptimisticToggle(data, getStatusUpdate, toggleInvestmentStatus)`
    and `useActiveFilter(optimisticData, isActive)` (both binary; both shared with users/cash-registers).
  - `tables/investments.tsx:135-149` — the Status cell is an interactive `ActiveToggleBadge`
    (`isActive={value === 'active'}`), one click flips it.
  - `lib/actions/toggle-active.ts:63-69` + `investment-data-table.tsx:20` — both hard-write
    `active ? 'active' : 'completed'`. **This is where a prospect gets silently overwritten to
    completed.**
  - `inwestycje/[id]/page.tsx:78` — status label is a 2-way ternary.
  - `inwestycje/page.tsx:20` — `activeCount = filter(status === 'active')`.
- **The financial plane self-handles.** `sum-transfers.ts:130` (`sumAllInvestmentFinancials`) is keyed
  on the `transactions` table and only emits a row for an investment that _has_ transactions. A
  prospect has none → contributes 0 to every rollup/margin/dashboard. No financial-layer change owed.
- **Auto-seed already works.** `createInvestmentAction` (`lib/actions/investments.ts`) already seeds a
  blank kosztorys (or from preset) on every investment create, regardless of status. Creating a
  planowana investment therefore produces a ready-to-fill kosztorys with zero new code.
- **Migration convention:** hand-write (AGENTS.md); latest example
  `src/migrations/20260716_1_add_global_discount_to_investments.ts`. `investments` is a **real**
  (prod-restored) table, but this change is purely additive (`ALTER TYPE ADD VALUE`) — no data
  migration.

### Key Discoveries:

- The third status collides with a **shared binary abstraction**, not with the financial layer. The
  work is decoupling the investment list from `useOptimisticToggle` / `useActiveFilter` /
  `ActiveToggleBadge` — users and cash-registers keep those helpers unchanged.
- `toggle-active.ts:67` and `investment-data-table.tsx:20` are dead-ends for a 3-state world; they are
  **removed**, not extended. Deleting the inline toggle removes the silent-overwrite footgun entirely.
- Keep `InvestmentRefT.active` as a derived convenience (`status === 'active'`) so existing consumers
  don't churn — just stop it being a _write_ path.
- Auto-seed means the "create a proposal" entry point already exists: the Dodaj form with status set to
  Planowana. No new creation flow.

## Desired End State

- The Dodaj / Edytuj investment form offers three statuses: Planowana, Aktywna, Zakończona. Default on
  create stays Aktywna.
- Creating a Planowana investment auto-seeds its blank kosztorys (unchanged behavior); the editor opens
  on a typable grid.
- The investment list shows a **read-only** color-coded status badge and a **3-way status filter**
  (Wszystkie / Planowane / Aktywne / Zakończone); the default view shows Aktywne + Planowane.
- Status is changed only via Edytuj (a deliberate action). There is no inline one-click status toggle.
- A Planowana investment contributes 0 to every financial figure and is excluded from `activeCount`.
- `toggleInvestmentStatus` no longer exists; `toggleUserActive` / `toggleCashRegisterActive` are
  untouched.

**Verification:** create an investment as Planowana → it appears under the Planowane filter with a
„Planowana" badge and an auto-seeded kosztorys; its figures are all 0 and it is absent from `activeCount`;
edit it to Aktywna → it moves to the Aktywne filter; no way to change status by clicking the row badge.

## What We're NOT Doing

- **Not** making the kosztorys wiring investment-optional (no standalone kosztorys, no re-homing of
  VAT/coeffs/discount, no new URL).
- **Not** building the client-facing proposal export / offer-view PDF — separate later slice.
- **Not** changing `toggleUserActive` / `toggleCashRegisterActive` or the shared `useActiveFilter` /
  `useOptimisticToggle` / `ActiveToggleBadge` (users & cash-registers keep the binary machine).
- **Not** adding a per-row inline status control (cycling badge) — status lives in the edit dialog.
- **Not** touching the financial calculation layer (transaction-keyed; prospects are 0 by construction).

## Implementation Approach

Four phases, each independently verifiable. Phase 1 makes the enum value exist end-to-end (schema →
migration → types → read path). Phase 2 makes it _settable_ through the form. Phase 3 decouples the
list UI from the shared binary helpers (read-only badge + 3-way filter). Phase 4 deletes the now-dead
binary write path, fixes the remaining 2-way display spots, and lands tests. Between phases the app is
never broken — at worst a planowana row renders under the old badge as "Zakończona" until Phase 3.

## Critical Implementation Details

**Migration — `ALTER TYPE ADD VALUE` cannot be used and referenced in the same transaction.** Payload
wraps each migration in a transaction; Postgres 12+ permits `ALTER TYPE ... ADD VALUE IF NOT EXISTS`
inside a transaction as long as the new value is not _used_ in that same transaction. This migration
only adds the value (no row writes with it), so it is safe. `down()` cannot remove an enum value
(Postgres has no `DROP VALUE`) without recreating the type and its dependent column — make `down()` a
documented no-op. Apply to prod with `pnpm db:migrate:prod` (human) before the code that reads it ships.

## Phase 1: Enum value exists end-to-end (schema, migration, types, read path)

### Overview

Add `planowana` to the status enum on the collection and in the DB, regenerate Payload types, and widen
every hand-written status union. Keep the derived boolean `active = status === 'active'` (a prospect is
correctly _not_ active).

### Changes Required:

#### 1. Collection status options

**File**: `src/collections/investments.ts`

**Intent**: Add a third status option so Payload admin + generated types know about `planowana`. Default
stays `active`.

**Contract**: Append `{ label: { en: 'Planned', pl: 'Planowana' }, value: 'planowana' }` to
`STATUS_OPTIONS`. `defaultValue: 'active'` unchanged.

#### 2. Migration — widen the enum

**File**: `src/migrations/<timestamp>_add_planowana_investment_status.ts` (new; mirror
`20260716_1_add_global_discount_to_investments.ts` structure)

**Intent**: Add the enum value to the real `investments` status type. Additive, no data migration.

**Contract**: `up`: `ALTER TYPE "enum_investments_status" ADD VALUE IF NOT EXISTS 'planowana';`
`down`: documented no-op (Postgres can't drop an enum value). Register in `src/migrations/index.ts`.

#### 3. Regenerate Payload types

**File**: `src/payload-types.ts` (generated — never `git add` it per AGENTS.md; regenerate via
`pnpm generate:types`)

**Intent**: `status` union picks up `'planowana'` automatically.

**Contract**: `status: 'active' | 'completed' | 'planowana'` after regen.

#### 4. Widen hand-written status unions + read path

**Files**: `src/types/reference-data.ts:19` (`InvestmentRefT.status`),
`src/components/tables/investments.tsx:19` (`InvestmentRowT.status`),
`src/lib/queries/reference-data.ts:91` (cast).

**Intent**: Add `'planowana'` to each union / cast. Leave `active: row.status === 'active'` (line 92)
as-is — a prospect derives `active: false`, which is correct (it is not an active job).

**Contract**: `status: 'active' | 'completed' | 'planowana'` in both types and the SQL-row cast.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Migration file present and registered in `src/migrations/index.ts`

#### Manual Verification:

- In Payload admin, an investment's Status field offers Planowana/Aktywna/Zakończona.
- Local DB: after `payload migrate`, `SELECT unnest(enum_range(NULL::enum_investments_status))` includes
  `planowana`.

---

## Phase 2: Status is settable through the form

### Overview

Expose Planowana in the investment form's status select so a prospect can be created and an existing
investment promoted. Default on create stays Aktywna. No action changes — create/update already pass
`status` through and auto-seed the kosztorys.

### Changes Required:

#### 1. Form schema enum

**File**: `src/components/forms/investment-form/investment-schema.ts:12`

**Intent**: Accept `planowana` in the form/domain schema so validation doesn't reject it.

**Contract**: `status: z.enum(['active', 'completed', 'planowana'])`. The derived `investmentSchema`
inherits it (no separate edit).

#### 2. Form status select option

**File**: `src/components/forms/investment-form/investment-form.tsx:106-113`

**Intent**: Add a Planowana option to the status `<field.Select>`. Order it lifecycle-first
(Planowana, Aktywna, Zakończona).

**Contract**: Add `<SelectItem value="planowana">Planowana</SelectItem>`.

#### 3. Confirm create/update passthrough (no code change expected)

**Files**: `src/lib/actions/investments.ts` (`createInvestmentAction`, `updateInvestmentAction`),
`src/components/dialogs/add-investment-dialog.tsx:19` (default stays `'active'`).

**Intent**: Verify the actions persist `status` verbatim and the auto-seed fires for a planowana
create (it is status-agnostic). No change unless a status check is found.

**Contract**: Creating with `status: 'planowana'` persists that status and seeds a blank kosztorys.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Dodaj inwestycję → set status Planowana → save → the investment persists as Planowana and opening its
  Kosztorys_v2 lands on a typable grid (auto-seed worked).
- Edytuj an existing investment → change Aktywna→Planowana→Zakończona → each persists.

---

## Phase 3: Decouple the list UI from the shared binary helpers

### Overview

Replace the interactive binary status badge with a **read-only** 3-state badge, and the binary
"Aktywne/Wszystkie" toggle with a **3-way status filter** (default: Aktywne + Planowane). Stop the
investment table using `useOptimisticToggle` and `useActiveFilter`. Users/cash-registers keep those
helpers.

### Changes Required:

#### 1. Read-only investment status badge

**File**: `src/components/ui/investment-status-badge.tsx` (new)

**Intent**: A non-interactive, color-coded badge rendering one of three statuses. Distinct from the
shared `ActiveToggleBadge` (which is binary + interactive).

**Contract**: Props `{ status: 'active' | 'completed' | 'planowana' }`. Labels Aktywna / Zakończona /
Planowana. Use existing badge variants / `@theme` tokens (no arbitrary colors); planowana visually
distinct from the other two.

#### 2. Status column → read-only badge

**File**: `src/components/tables/investments.tsx:40-50,135-149`

**Intent**: Render `InvestmentStatusBadge` in the Status cell; drop the `onToggle` plumbing.

**Contract**: Remove `onToggle` from `InvestmentColumnOptionsT` and `getInvestmentColumns`; Status cell
becomes `<InvestmentStatusBadge status={info.getValue()} />`. Remove the `ActiveToggleBadge` import.

#### 3. 3-way status filter hook + control

**Files**: `src/hooks/use-status-filter.ts` (new), `src/components/ui/status-filter.tsx` (new)

**Intent**: A filter over `{ all | planowana | active | completed }` defaulting to a view that shows
Aktywne + Planowane (hides Zakończone), plus a segmented control to switch. Generic enough to sit in
`components/ui/` but investment-status-shaped is fine (no other caller yet).

**Contract**: `useStatusFilter(data, getStatus)` → `{ filteredData, statusView, setStatusView }`.
Default `statusView` = a value meaning "Aktywne + Planowane". Segmented options: Wszystkie / Planowane /
Aktywne / Zakończone. Labels in Polish.

#### 4. Rewire the data table

**File**: `src/components/investments/investment-data-table.tsx`

**Intent**: Drop `useOptimisticToggle`, `getStatusUpdate`, `isActive`, `useActiveFilter`,
`toggleInvestmentStatus`, and the `ActiveFilterButton`. Feed the table through `useStatusFilter` then
the existing `useSearchFilter`. Render the new `StatusFilter` in the toolbar. Keep
`getRowClassName` dimming `completed`; leave planowana undimmed (its badge distinguishes it).

**Contract**: `columns` no longer receives `onToggle`. The toolbar renders `<StatusFilter .../>` in
place of `<ActiveFilterButton .../>`. `optimisticData` usage removed (no optimistic status write on the
list anymore).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Unit test for `useStatusFilter` bucketing passes: `pnpm exec vitest run src/__tests__/use-status-filter.test.ts`

#### Manual Verification:

- The investment list shows a color-coded, non-clickable status badge; clicking it does nothing.
- The status filter switches views: Planowane isolates prospects; default view shows Aktywne + Planowane,
  hides Zakończone; Wszystkie shows all.
- Search + status filter compose correctly.

---

## Phase 4: Delete the dead binary write path, fix display spots, tests

### Overview

Remove `toggleInvestmentStatus` (now unused), update the remaining 2-way display ternary and the
`activeCount`, and land the regression tests. This is the phase that closes the silent-overwrite footgun
by deleting the code that could cause it.

### Changes Required:

#### 1. Remove the investment toggle action

**File**: `src/lib/actions/toggle-active.ts:63-69`

**Intent**: Delete `toggleInvestmentStatus` and drop `'investments'` from the `ToggleConfigT.collection`
union if nothing else uses it. Keep the generic `toggleActive` and the user/cash-register wrappers.

**Contract**: `toggleInvestmentStatus` export removed; `toggle-active.ts` gate on typecheck (no dangling
importers — Phase 3 removed the only one).

#### 2. Status label on the detail page

**File**: `src/app/(frontend)/inwestycje/[id]/page.tsx:78`

**Intent**: Replace the 2-way ternary with a 3-value label map so a prospect reads „Planowana".

**Contract**: `{ active: 'Aktywna', completed: 'Zakończona', planowana: 'Planowana' }[investment.status]`.

#### 3. Active count (verify, likely unchanged)

**File**: `src/app/(frontend)/inwestycje/page.tsx:20`

**Intent**: Confirm `activeCount` counts only `status === 'active'` (a prospect is excluded — correct).
Optionally add a `plannedCount` label if the page surfaces counts per status; otherwise no change.

**Contract**: `activeCount` unchanged; planowana naturally excluded.

#### 4. Tests

**Files**: `src/__tests__/toggle-actions.test.ts`, `src/__tests__/use-status-filter.test.ts` (new)

**Intent**: Remove the deleted investment-toggle assertions from `toggle-actions.test.ts` (keep
user/cash-register). Add a focused unit test for `useStatusFilter` bucketing — the one piece of new
logic — covering: default view = active + planowana, each single-status view, and Wszystkie. This is the
regression guard for the filter; the silent-overwrite path is closed structurally by deleting the
action, so no test asserts it.

**Contract**: `use-status-filter.test.ts` asserts observable filtered output for each `statusView` over
a fixture with one row of each status.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Tests pass: `pnpm exec vitest run src/__tests__/use-status-filter.test.ts src/__tests__/toggle-actions.test.ts`
- No dangling references: `grep -rn "toggleInvestmentStatus" src/` returns nothing.

#### Manual Verification:

- Investment detail page shows „Planowana" for a prospect.
- The Aktywne count on the list excludes prospects.
- End-to-end: create prospect → promote to Aktywna via Edytuj → it leaves the Planowane filter and joins
  Aktywne; figures move only once real transactions exist.

**Implementation Note**: After Phase 4's automated verification passes, pause for the human to confirm
the manual end-to-end (create prospect → build kosztorys → promote) before archiving.

## Testing Strategy

### Unit Tests:

- `useStatusFilter` bucketing (new) — the only new pure logic. Assert filtered output per `statusView`.
- Trim `toggle-actions.test.ts` to the surviving user/cash-register togglers.

### Integration Tests:

- None owed at the DB layer: create/update are unchanged passthroughs; the auto-seed already has
  coverage; financials are transaction-keyed and prospects add nothing.

### Browser E2E (deferred to the E2E backlog):

The list filter + promote flow is browser-level. Per AGENTS.md a browser-level slice owes its E2E —
author at the review gate or **defer** into the E2E backlog (Linear issue labelled `e2e-backlog`,
project "Wykonczymy"). Proposed spec: create prospect → appears under Planowane with the badge → Edytuj →
Aktywna → moves to Aktywne; status badge is not clickable. Record the issue id at the review gate.

### Manual Testing Steps:

1. Dodaj inwestycję, status Planowana → save → confirm it lands under Planowane with a „Planowana" badge
   and its Kosztorys_v2 opens on a typable grid.
2. Confirm the prospect's Koszty/Bilans/Marża are all 0 and it is not in the Aktywne count.
3. Edytuj → Aktywna → it moves to the Aktywne filter.
4. Confirm clicking the row status badge does nothing.

## Performance Considerations

None. One added enum value, one client-side filter swap. No new queries.

## Migration Notes

- Additive `ALTER TYPE ADD VALUE IF NOT EXISTS 'planowana'` on the real `investments` table — no data
  migration, existing rows keep `active`. `down()` is a documented no-op (Postgres can't drop an enum
  value). Apply to prod with `pnpm db:migrate:prod` (human) **before** the reading code ships; the
  `.husky/pre-push` gate reminds on a `main` push that adds a migration.

## References

- Change brief: `context/changes/investment-planowana-status/change.md`
- Similar migration: `src/migrations/20260716_1_add_global_discount_to_investments.ts`
- Shared binary helpers kept intact: `src/hooks/use-active-filter.ts`,
  `src/components/ui/active-toggle-badge.tsx`, `src/lib/actions/toggle-active.ts`
- Transaction-keyed rollup (why prospects are 0): `src/lib/db/sum-transfers.ts:130`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Enum value exists end-to-end

#### Automated

- [ ] 1.1 Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- [ ] 1.2 Lint passes: `pnpm lint`
- [ ] 1.3 Migration file present and registered in `src/migrations/index.ts`

### Phase 2: Status is settable through the form

#### Automated

- [ ] 2.1 Type checking passes: `pnpm exec tsc --noEmit`
- [ ] 2.2 Lint passes: `pnpm lint`

### Phase 3: Decouple the list UI from the shared binary helpers

#### Automated

- [ ] 3.1 Type checking passes: `pnpm exec tsc --noEmit`
- [ ] 3.2 Lint passes: `pnpm lint`
- [ ] 3.3 `useStatusFilter` unit test passes: `pnpm exec vitest run src/__tests__/use-status-filter.test.ts`

### Phase 4: Delete the dead binary write path, fix display spots, tests

#### Automated

- [ ] 4.1 Type checking passes: `pnpm exec tsc --noEmit`
- [ ] 4.2 Lint passes: `pnpm lint`
- [ ] 4.3 Tests pass: `pnpm exec vitest run src/__tests__/use-status-filter.test.ts src/__tests__/toggle-actions.test.ts`
- [ ] 4.4 No dangling references: `grep -rn "toggleInvestmentStatus" src/` returns nothing
