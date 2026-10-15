# Investment status „Odrzucona” + active-only booking pickers — Implementation Plan (EX-1066)

## Overview

Add a fifth pickable investment status, `rejected` („Odrzucona”), for an offer the client declined at
Wycena / Planowana. Hidden by default in the investments list, dimmed like Zakończona, left out of the
nightly kosztorys snapshots. Separately, the investment picker of every booking form (wpłata, wydatek,
edycja przelewu) offers **only Aktywne and Planowane** investments — no „Wszystkie” escape, no URL
prefill of any other. No server-side refusal: the owner ruled the lock meaningful only on Zakończona.

**Owner rulings on the picker set (2026-10-15):** Planowana **stays** in the booking forms — money is
already booked on planned investments in practice. Wycena is **pending an owner decision** (EX-1066);
this plan excludes it, and reversing that is one entry in `BOOKING_PICKER_STATUSES`.

## Current State Analysis

- The status list is one tuple `as const` in `src/lib/constants/investment-status.ts:4`; the zod enum,
  collection options, `<SelectItem>`s and the status filter derive from it. `INVESTMENT_STATUS_LABELS`
  and `STATUS_CLASSNAMES` (`investment-status-badge.tsx:5-11`) are `Record<InvestmentStatusT,…>` —
  type-forced. `PICKABLE_INVESTMENT_STATUSES` (`:19-24`) is not.
- Postgres enum `"enum_investments_status"`; values were added by hand in `20260718_0`, `20260914_0`,
  `20260929_3`. Latest migration file is `20261015_0_document_settings_column_map.ts`.
- `use-status-filter.ts:10` `DEFAULT_STATUSES = ['quote','planowana','active']`; a missing key in the
  persisted map reads as unselected — so a new status with no `INHERITED_FLAG` entry is hidden for
  everyone, new and old maps alike. That is the wanted behaviour here.
- Booking pickers: `deposit-form.tsx:211` and `expense-form.tsx:437` pass
  `investments.filter(isBookableInvestment)` (= not completed) to `EntityComboboxField`, whose internal
  `activeOnly` state (`entity-combobox-field.tsx:71`, default on) hides non-active rows until the user
  ticks „Wszystkie”. `edit-transfer-form.tsx:170-174` passes the **unfiltered** list. URL prefill
  `use-investment-from-url.ts:22-26` seeds any bookable (incl. quote/planowana) investment, and
  `activeOrSelected` (`is-active-ref.ts:17`) then keeps it visible.
- `active` on an investment ref is `row.status === 'active'` (`lib/queries/reference-data.ts`), so
  „active” in the pickers already means exactly status Aktywna.
- `isBookableInvestment` also drives the transfers table's edit/cancel buttons
  (`tables/transfers.tsx:283-297`, reason „zakończona”). It must stay completed-only.
- Daily snapshots: `listDailyEligibleInvestmentIds` (`lib/db/snapshots.ts:83`) excludes completed and
  szablon. Investments list dims only completed (`investment-data-table.tsx:85`).

## Desired End State

- „Odrzucona” is selectable in the investment form, renders a badge, is unticked by default in the
  list's status filter and dims its row. A status change from/to it needs no special role.
- The wpłata, wydatek and edit-transfer investment pickers list only Aktywne and Planowane
  investments — plus, in the edit form and in a prefilled draft, the investment the transfer already
  holds. There is no „Aktywne / Wszystkie” checkbox on those three. Opening „Dodaj wydatek” from a
  Wycena's or Odrzucona's page leaves the investment empty; from a Planowana's page it preselects it.
- The equipment-target picker (`equipment-target-field.tsx:96`) is unchanged — it is not a booking.
- No server gate changes; existing transfers on Wycena investments (Agatha 208, Żubrowa 177) stay
  editable and cancellable.
- The night run captures no daily snapshot for an Odrzucona investment; its existing history is kept.

### Key Discoveries:

- `EntityComboboxField` has four investment-variant callers; three are booking forms, one
  (`equipment-target-field.tsx:96`) is not — the active-only lock has to be opt-in per call site.
- The ref's `active` flag (`row.status === 'active'`) cannot express the booking set any more —
  Planowana is in it — and widening the flag would leak into every other `active` reader (lead
  assets, equipment target, „N aktywnych”). The booking set is its own status predicate.
- `activeOrSelected` (`is-active-ref.ts:17`) carries the EX-643 guarantee: whatever the field already
  holds survives the filter, so an edit never silently empties it. The booking filter must keep the
  same „predicate ∪ current selection” shape.
- `isBookableInvestment` is read by the transfers table — narrowing it would re-introduce the lock the
  owner declined (`research.md` follow-up).
- Postgres refuses using a value added by `ALTER TYPE … ADD VALUE` in the same transaction; this
  migration only adds it (lesson „Status inwestycji to etykieta, nie bramka”, rule 3).

## What We're NOT Doing

- No server-side refusal of bookings on quote / planowana / rejected; `isLockedStatus`,
  `lockMessageOf`, `hooks/transfers/validate.ts`, `lockInvestmentGates`, `access/investment-lock.ts`
  untouched. Kosztorys stays editable on every non-completed status.
- No change to `isBookableInvestment` or the transfers table's edit/cancel buttons.
- No change to the worker report share link or the worker's own page.
- No retention change for existing daily/named snapshots of an Odrzucona investment.
- No data fix for Agatha 208 / Żubrowa 177 — flipping them to Aktywna is the owner's call in the UI.
- No i18n: status labels render from `.pl` only.

## Implementation Approach

Two independent slices in one change: (1) the status value end-to-end, behind a hand-written enum
migration, plus its two „treat like a closed offer” defaults (dim, no daily snapshot); (2) one named
status set for the booking pickers, and an opt-in „fixed filter, no toggle” mode on
`EntityComboboxField` switched on at the three booking call sites, with the URL prefill aligned to the
same set. Docs last.

## Critical Implementation Details

- **Migration ordering against the shared tree.** Run `git status src/migrations` before creating the
  file — parallel sessions may have taken `20261015_1`. Take the next free suffix and register it in
  `src/migrations/index.ts` in order.
- **Additive migration → prod before push.** A human runs `pnpm db:migrate:prod` before this ships; the
  agent runs only the local migrate. Rollback is not data-free: old code crashes on an unknown label
  (`investment-info-fields.tsx:35`), so `UPDATE investments SET status = 'quote' WHERE status =
  'rejected'` precedes a code revert.

## Phase 1: Status „Odrzucona”

### Overview

The new enum value from DB to badge, hidden by default, dimmed, out of the night snapshot run.

### Changes Required:

#### 1. Enum migration

**File**: `src/migrations/20261015_1_add_rejected_investment_status.ts` (next free suffix), `src/migrations/index.ts`

**Intent**: Add `'rejected'` to `"enum_investments_status"`; register the migration.

**Contract**: `up` = `ALTER TYPE "enum_investments_status" ADD VALUE IF NOT EXISTS 'rejected';` and
nothing else. `down` is a no-op with a one-line why (Postgres has no `DROP VALUE`). Header copies the
hand-written-migration note from the latest migration file.

#### 2. Status constants

**File**: `src/lib/constants/investment-status.ts`

**Intent**: Make `rejected` a real, pickable status.

**Contract**: `'rejected'` appended after `'completed'` in `INVESTMENT_STATUSES` and in
`PICKABLE_INVESTMENT_STATUSES`; label `rejected: { pl: 'Odrzucona', en: 'Rejected' }`.

#### 3. Badge colour

**File**: `src/components/investments/investment-status-badge.tsx`

**Intent**: Type-forced `STATUS_CLASSNAMES.rejected` entry.

**Contract**: a colour not yet used by the map (taken: sky, amber, emerald, muted, violet) and reading
as „closed, negative” — rose/red family, same class shape as its siblings.

#### 4. Dim the row

**File**: `src/components/investments/investment-data-table.tsx:85`

**Intent**: An Odrzucona row reads as closed, like Zakończona.

**Contract**: `getRowClassName` dims `completed` and `rejected`.

#### 5. Nightly snapshots skip it

**File**: `src/lib/db/snapshots.ts:83` (+ the comment above it)

**Intent**: A declined offer's kosztorys no longer changes; stop capturing daily rows for it.

**Contract**: `listDailyEligibleInvestmentIds` excludes `rejected` alongside completed and szablon.
`gcSnapshots` untouched (its completed-only expiry stays).

#### 6. Spec rows

**Files**:
- `src/__tests__/use-status-filter.test.ts` — `rejected` row in the fixture; default selection hides
  it; „all selected” includes it; `selectionFrom` on a map saved before `rejected` existed reads it as
  unselected.
- `src/__tests__/lib/constants/investment-lock.test.ts` — row `['rejected', true, false]`
  (bookable for the transfers-table predicate, not locked).
- `src/__tests__/hooks/investments/stamp-completed-at.test.ts:52` and
  `src/__tests__/hooks/investments/guard-template-status.test.ts:25,34` — add `'rejected'` to the
  `it.each` lists.
- `src/__tests__/lib/kosztorys/capture-daily-snapshots.test.ts:96` — a `rejected` investment is not
  eligible.

**Intent**: Every `string`-typed predicate gets its explicit row (lesson rule 2); the DB status spec
`investments-status.db.test.ts:39` covers the enum via `PICKABLE_INVESTMENT_STATUSES` with no edit.

### Success Criteria:

#### Automated Verification:

- Local migration applies: `pnpm payload migrate` against the docker DB (5433), then
  `pnpm db:migrate:test` (5435) — both after `git status src/migrations`
- Types regenerated: `pnpm generate:types`
- Status / lock / hook specs pass: `pnpm exec vitest run src/__tests__/use-status-filter.test.ts src/__tests__/lib/constants/investment-lock.test.ts src/__tests__/hooks/investments/stamp-completed-at.test.ts src/__tests__/hooks/investments/guard-template-status.test.ts`
- DB specs pass against 5435: `pnpm exec vitest run src/__tests__/lib/kosztorys/capture-daily-snapshots.test.ts` and the `investments-status.db.test.ts` spec

#### Manual Verification:

- Investment form offers „Odrzucona”; saving a Wycena as Odrzucona and back to Wycena works as a
  MANAGER (no owner-only guard).
- Investments list: an Odrzucona row is hidden by default, appears when „Odrzucona” is ticked in the
  status filter, renders the new badge and is dimmed.

---

## Phase 2: Booking pickers list only Aktywne and Planowane

### Overview

One named status set for the booking pickers; an opt-in mode on `EntityComboboxField` that applies a
fixed filter and drops the toggle, switched on in the three booking forms; URL prefill follows the same
set.

### Changes Required:

#### 1. The booking status set

**File**: `src/lib/constants/investment-status.ts`

**Intent**: Spell once which statuses a booking form offers — the owner's rulings, not the `active`
flag.

**Contract**: `BOOKING_PICKER_STATUSES = ['active', 'planowana'] as const satisfies readonly
InvestmentStatusT[]` and a predicate `isOfferedForBooking(investment: { status: string }): boolean`.
A short comment names the owner rulings (Planowana stays, 2026-10-15; Wycena pending, EX-1066).

#### 2. Fixed-filter mode

**File**: `src/components/forms/form-fields/entity-combobox-field.tsx`

**Intent**: Let a caller replace the „Aktywne / Wszystkie” toggle with a filter the user may not widen.

**Contract**: new optional prop taking a predicate over the item. When set, the list is the items the
predicate accepts **plus the currently selected item** (the `activeOrSelected` guarantee — extract or
generalise the helper in `is-active-ref.ts` rather than re-spell it), and no `ActiveFilterLabel` is
rendered (neither in the combobox nor in the empty-state message). The item type must carry what the
predicate reads (`status` for investments). Default behaviour for every other caller is unchanged.

#### 3. Booking call sites

**Files**: `src/components/forms/deposit-form/deposit-form.tsx:208-212`,
`src/components/forms/expense-form/expense-form.tsx:434-438`,
`src/components/forms/edit-transfer-form/edit-transfer-form.tsx:171-175`

**Intent**: The three booking pickers list only Aktywne and Planowane investments, keeping the one
already held.

**Contract**: each passes `isOfferedForBooking` as the fixed filter. Deposit / expense keep their
`.filter(isBookableInvestment)` pre-filter (it still drops a completed investment carried in by a draft
prefill); the edit form keeps the unfiltered list so the transfer's current investment survives.
`equipment-target-field.tsx` is not touched.

#### 4. URL prefill

**File**: `src/components/forms/hooks/use-investment-from-url.ts`

**Intent**: „Dodaj wpłatę / wydatek” from a Wycena or Odrzucona page must not seed that investment —
otherwise the keep-the-selection rule shows it and the picker set is bypassed.

**Contract**: the seed check uses `isOfferedForBooking` instead of `isBookableInvestment`; docblock
updated to say the seed repeats the picker's set.

#### 5. Specs

**Files**:
- `src/__tests__/lib/constants/investment-status.test.ts` (new, node) — one row per
  status for `isOfferedForBooking`: active, planowana → true; quote, rejected, completed, szablon →
  false. The predicate takes `string`, so this table is the only guard against a new status.
- `src/__tests__/components/forms/hooks/use-investment-from-url.test.ts` (new, node) —
  `vi.mock('next/navigation')` → `usePathname`; `/inwestycje/<active id>` and `<planowana id>` seed the
  id; quote / rejected / completed ids seed `''`; `/kasa/<id>` seeds `''`; an id missing from the
  list seeds `''`.
- If the keep-the-selection helper is generalised, `src/__tests__/lib/utils/is-active-ref.test.ts`
  gains the predicate case.

**Intent**: Guard the status set and the one non-visual path into a booking: the URL seed.

### Success Criteria:

#### Automated Verification:

- Status-set spec passes: `pnpm exec vitest run src/__tests__/lib/constants/investment-status.test.ts`
- URL-seed spec passes: `pnpm exec vitest run src/__tests__/components/forms/hooks/use-investment-from-url.test.ts`
- Selection-helper spec passes: `pnpm exec vitest run src/__tests__/lib/utils/is-active-ref.test.ts`

#### Manual Verification:

- „Dodaj wpłatę” and „Dodaj wydatek”: the Inwestycja picker lists Aktywne and Planowane investments,
  no Wycena / Odrzucona / Zakończona, and shows no „Aktywne / Wszystkie” checkbox.
- „Dodaj wydatek” opened from a Wycena investment's page leaves Inwestycja empty; from an Aktywna or a
  Planowana page it is preselected.
- Edit an existing transfer booked on a Wycena investment (local copy of Agatha 208): the picker shows
  that investment selected, saving without touching it keeps it, and the list offers only Aktywne and
  Planowane besides it.
- Equipment target picker still shows the „Aktywne / Wszystkie” checkbox.
- Transfers table: edit / cancel buttons on a Wycena transfer still enabled.

---

## Phase 3: Docs

### Overview

Make the living docs true again.

### Changes Required:

#### 1. Lesson

**File**: `context/foundation/lessons.md` — section „Status inwestycji to etykieta, nie bramka”

**Intent**: Its update (6) says a new (Wycena) investment is absent from the pickers „do przestawienia
na Aktywną” — now a guarantee, not a default. Record the EX-1066 rule: booking pickers offer
`BOOKING_PICKER_STATUSES` (Aktywna + Planowana) with no toggle, that set is a status predicate and not
the ref's `active` flag, the server still refuses only Zakończona, and `isBookableInvestment` stays
completed-only because the transfers table reads it.

**Contract**: one appended „Update (EX-1066, 2026-10-15)” paragraph in that section; nothing else.

#### 2. Domain notes — snapshot retention

**File**: `context/reference/kosztorys-editor-domain-notes.md:994-996`

**Intent**: The retention paragraph lists which statuses count as „live”; Odrzucona is not captured
nightly and its history is kept as is.

**Contract**: one sentence in that paragraph.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check (prose only).

#### Manual Verification:

- None.

---

## Testing Strategy

### Unit Tests:

- Status filter: default hides `rejected`; a pre-`rejected` persisted map hides it.
- Lock predicates: explicit `rejected` row (bookable for the table, not locked).
- Booking set: one row per status for `isOfferedForBooking`.
- URL seed: only an Aktywna or Planowana investment on `/inwestycje/[id]` is seeded.

### Integration Tests:

- `capture-daily-snapshots.test.ts`: `rejected` not eligible for the night run.
- `investments-status.db.test.ts`: the enum accepts `rejected` (automatic via the pickable list).

### Manual Testing Steps:

See each phase's Manual Verification; run locally (5435 / docker DB) per
`context/reference/manual-verification.md`.

## Migration Notes

Additive enum value. Local: apply against docker 5433 (and 5435 for DB specs). Prod: a human runs
`pnpm db:migrate:prod` **before** the push that ships this code. Revert requires moving every
`rejected` row back to an old status first.

## Whole-tree Gate

Run once, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit + DOM suite (pre-push leg) — only when asked; touched specs above are the default gate.

## References

- Research: `context/changes/2026-10-15-investment-status-rejected/research.md` (incl. the follow-up)
- Precedent: `context/archive/2026-09-29-investment-wycena-status/`
- Lock history: `context/archive/2026-08-28-investment-lock-on-completed/change.md`
- Linear: EX-1066

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Status „Odrzucona”

#### Automated

- [x] 1.1 Local migration applies against the docker DB — 06af1643f
- [x] 1.2 Types regenerated — 06af1643f
- [ ] 1.3 Status / lock / hook specs pass
- [ ] 1.4 DB specs pass against 5435

### Phase 2: Booking pickers list only Aktywne and Planowane

#### Automated

- [ ] 2.1 Status-set spec passes
- [ ] 2.2 URL-seed spec passes
- [ ] 2.3 Selection-helper spec passes

### Phase 3: Docs

#### Automated

- [x] 3.1 No phase-scoped automated check (prose only) — 0a0c60897
