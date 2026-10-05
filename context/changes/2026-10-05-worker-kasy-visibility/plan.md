# Worker's Kasy Visibility Implementation Plan

## Overview

EX-960. Since EX-918 a worker goes to the Kosz together with every kasa he owns, and comes back with
them. The `/pracownicy` listing does not show this: its only kasa column is „Domyślna kasa”. So the owner
clicks „Do kosza” without knowing how many kasy go along. This plan adds:

1. a „Kasy” column on `/pracownicy` with the number of kasy the worker owns, and their names on hover;
2. a „Kasy” section on `/pracownicy/[id]` listing those kasy, each linking to `/kasa/[id]`.

## Current State Analysis

- `src/app/(frontend)/pracownicy/page.tsx:31` already builds `registerNames` for each row, from
  `refData.cashRegisters.filter((register) => register.ownerId === worker.id)`. It is used only by the
  trash dialog's description (`describeWorkerTrash`, `src/components/tables/users.tsx:151`).
- `fetchReferenceData` (`src/lib/queries/reference-data.ts:119`) splits kasy into live `cashRegisters`
  and `trashedCashRegisters`. Every listing reads the live half, so counting from `cashRegisters` counts
  exactly the kasy the trash dialog names and „Do kosza” moves. No new query is needed.
- `CashRegisterRefT` carries `id`, `name`, `type`, `active`, `ownerId`. That is everything the
  worker-page section needs.
- The worker page (`src/app/(frontend)/pracownicy/[id]/page.tsx`) already fetches `fetchReferenceData()`.
  It renders `InfoList` → „Wypłaty” → `HeldEquipmentSection` („Na stanie”) → transfers.
  `HeldEquipmentSection` (`src/components/equipment/held-equipment-section.tsx`) is the pattern to
  mirror: an `h2`, a `Description` empty state, a `SummaryTable` with `Link`ed names.
- `/kasa/[id]` admits every role (`requireAuth(ROLES)`). The worker page is ADMIN/OWNER/MANAGER only,
  so every reader of the section can follow the links.

## Desired End State

- `/pracownicy` has a sortable „Kasy” column. It shows the number of live kasy the worker owns, or „—”
  when he owns none, and the kasa names on hover. The number equals the count of kasy the „Do kosza”
  dialog lists for that row.
- `/pracownicy/[id]` has a „Kasy” section. It lists every live kasa the worker owns, each linking to
  `/kasa/[id]`, and marks an inactive kasa as „nieaktywna”. A worker with no kasy gets an empty state
  sentence.

### Key Discoveries:

- `src/app/(frontend)/pracownicy/page.tsx:31-33`: the owned-kasy filter already exists. The worker page
  needs the same filter, so it moves into one helper that both pages call.
- `src/lib/workers/describe-trash.ts`: home of the worker-trash wording. The new helper sits beside it
  in `src/lib/workers/`.
- An inactive kasa is still live (not trashed) and still goes to the Kosz with its owner, so it counts
  and is listed. It is labelled, not hidden.

## What We're NOT Doing

- No link from the count to a filtered `/kasy`. The owner filter there is `useClientMultiFilter`
  (client state, no URL param), so a link would need a new URL param. The worker-page list already
  answers „which kasy”.
- No trashed kasy in the count or the list. They are not the worker's to take along, and the trash
  dialog doesn't name them either.
- No balances in the worker-page section. „Which kasy, and where to go” is the ask, and balances are on
  `/kasy` and `/kasa/[id]`.
- No new query, no migration, no change to `fetchReferenceData`.

## Implementation Approach

Pure presentation over data already loaded. Extract the owner filter into one helper, add a derived
column in the users table, and add a small server-rendered section component on the worker page.

## Phase 1: „Kasy” count on `/pracownicy`

### Overview

Single source for "kasy this worker owns", plus the listing column.

### Changes Required:

#### 1. Owned-kasy helper

**File**: `src/lib/workers/owned-registers.ts` (new)

**Intent**: One definition of "the kasy that go to the Kosz with this worker". The listing count, the
trash dialog and the worker page all read the same set.

**Contract**: `ownedRegisters(cashRegisters: CashRegisterRefT[], workerId: number): CashRegisterRefT[]`.
It filters on `ownerId === workerId`. The caller passes the live `refData.cashRegisters`.

#### 2. Listing data

**File**: `src/app/(frontend)/pracownicy/page.tsx`

**Intent**: Build `registerNames` through `ownedRegisters` instead of the inline filter. The row shape
stays the same; `UserRowT.registerNames` already carries what the column needs.

**Contract**: `UserRowT` unchanged.

#### 3. „Kasy” column

**File**: `src/components/tables/users.tsx`

**Intent**: Add a column after „Domyślna kasa”. It shows `registerNames.length`, „—” when zero, and the
names (comma-joined) in a `title` on hover. It sorts by the count.

**Contract**: `col.accessor((row) => row.registerNames.length, { id: 'registers', header: 'Kasy', meta: { align: 'right' } })`.
The new id is picked up by `ColumnToggle` automatically.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check. The change is a derived column over an existing field, and the
  whole-tree typecheck covers the helper's signature.

#### Manual Verification:

- `/pracownicy` → the „Kasy” column shows each worker's number of kasy, and „—” for a worker with none.
  Hovering the number lists the kasa names.
- `/pracownicy` → for a worker with kasy, click „Usuń pracownika”: the dialog names exactly as many kasy
  as the „Kasy” column shows.
- `/pracownicy` → sort by „Kasy”: workers order by the number. „Kasy” can be hidden and shown from the
  column toggle.

---

## Phase 2: „Kasy” section on `/pracownicy/[id]`

### Overview

List the worker's kasy with links on his page.

### Changes Required:

#### 1. Section component

**File**: `src/components/users/owned-registers-section.tsx` (new)

**Intent**: Mirror `HeldEquipmentSection`: an `h2` „Kasy”, the empty state „Nie ma żadnej kasy.”
(`Description`), otherwise one row per kasa. Each name is a `Link` to `/kasa/[id]`, followed by a muted
„nieaktywna” when `active === false`. Server component, no actions; managing a kasa happens on its own
page.

**Contract**: `OwnedRegistersSection({ registers }: { registers: CashRegisterRefT[] })`.

#### 2. Worker page

**File**: `src/app/(frontend)/pracownicy/[id]/page.tsx`

**Intent**: Render `OwnedRegistersSection` with `ownedRegisters(refData.cashRegisters, userId)`, placed
before `HeldEquipmentSection`, so "what he owns / holds" reads as one block above the transfers.

**Contract**: No new fetch. `refData` is already loaded on this page.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check. It is a presentational server component over already-loaded data,
  with no branching beyond the empty state and the label.

#### Manual Verification:

- `/pracownicy/[id]` for a worker who owns kasy → the „Kasy” section lists every one of them, and each
  name opens that kasa's page.
- A worker who owns a kasa set to inactive → that kasa is listed with „nieaktywna”.
- A worker with no kasy → „Kasy” shows „Nie ma żadnej kasy.”
- A worker whose kasa sits in the Kosz on its own → that kasa is not listed, and the listing count
  doesn't include it either.

---

## Testing Strategy

### Unit Tests:

- None. `ownedRegisters` is a one-line filter, and its only rule (live kasy only) is enforced upstream
  by `splitTrashed`, which already has its own spec. A test here would assert `Array.filter`.

### Manual Testing Steps:

1. Pick a worker who owns 2+ kasy, one of them inactive. Check the listing count, the hover names, the
   trash dialog wording, the worker-page list with the „nieaktywna” label, and the links.
2. Pick a worker with no kasy. Check „—” on the listing and the empty state on his page.

## Whole-tree Gate

Run once, after the final phase.

- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`

## References

- Linear: EX-960. Context: EX-918 (worker trash takes his kasy along).
- Pattern: `src/components/equipment/held-equipment-section.tsx`
- Live/trashed split: `src/lib/queries/reference-data.ts:119`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: „Kasy” count on `/pracownicy`

#### Automated

- [x] 1.1 No phase-scoped automated check (covered by the whole-tree typecheck)

### Phase 2: „Kasy” section on `/pracownicy/[id]`

#### Automated

- [x] 2.1 No phase-scoped automated check (covered by the whole-tree typecheck)
