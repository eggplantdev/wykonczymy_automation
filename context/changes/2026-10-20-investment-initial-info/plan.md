# Investment „Wstępne informacje” Implementation Plan

## Overview

EX-1120. Add a collapsible „Wstępne informacje” section to the investment add/edit form, holding one optional
field for now: „Rynek” (pierwotny / wtórny, empty = unknown). The AI kosztorys agent gets every field
of this section in the case inputs next to Notatki, and its method states that a set „Rynek” wins over
reading Notatki. Also fixes the „Kierownik budowy” select in the edit form, which stretches to the full
width with its text centred.

## Current State Analysis

- `investments` stores contact, address and a `billing` group (`src/collections/investments.ts:114`);
  migration `20261016_1_investment_billing_data.ts` added it as flat `billing_*` columns plus a Postgres enum.
- The edit dialog reads the record through `fetchInvestmentDetails` (raw SQL,
  `src/lib/queries/reference-data.ts:195`, tag `investments`) → `InvestmentDetailsT`
  (`src/types/reference-data.ts:59`), defaults in `NO_INVESTMENT_DETAILS`
  (`src/lib/investments/investment-details.ts`).
- The form schema (`investment-schema.ts`) uses `''` for an unchosen select and transforms it to `null`
  for Payload (`billing.clientType`), mapped back by `toBillingFormValues`.
- `create`/`updateInvestmentAction` pass the parsed schema straight to `payload.create/update`, so a
  new schema key lands without action changes.
- The AI agent sees only Notatki: `adopt-case-prod.ts` writes them to `inputs/client-inquiry.md`;
  `round-case-prod.ts` diffs Notatki lines against the previous round's record. Both read
  `/investments/:id` over REST, which already returns any new group.
- „Kierownik budowy”: `InvestmentSiteManagerSelect` uses the `toolbarSm` button trigger, which is
  `w-fit`, but the vertical `Field` wrapping it in the form forces `[&>*]:w-full`
  (`src/components/ui/field.tsx:61`), so the button stretches and its content centres.

## Desired End State

- Add and edit dialogs show a collapsed „Wstępne informacje” section with a „Rynek” select
  („Rynek pierwotny” / „Rynek wtórny”, placeholder „— nie wiadomo —”); the choice persists and reopens.
- A new AI case carries `inputs/initial-info.md` listing every field of the section by its Polish label
  („Rynek: wtórny” or „Rynek: — (puste)”); a later round writes the current section and flags a change.
- The ai-cases README tells the agent: „Rynek” set → it wins over Notatki; empty → guess as now and add
  a „Do ustalenia z klientem” question.
- „Kierownik budowy” in the edit form is as wide as its content, left-aligned.

### Key Discoveries:

- Group-to-columns pattern: `src/migrations/20261016_1_investment_billing_data.ts`.
- Select-with-labels constant module importable from the Payload CLI graph:
  `src/lib/constants/investment-client-type.ts`.
- Draft restore spreads over `defaultValues` (`use-managed-form.ts:78`), so an add-draft saved before
  this release still gets `initialInfo` from the defaults.

## What We're NOT Doing

- Wiring the landing-page ankieta into these fields, or adding more fields (follow-up).
- Showing „Rynek” on the investment page overview (`investment-info-fields`) — form only.
- A way to clear a chosen „Rynek” back to empty — same limitation as „Typ klienta”.
- Backfilling „Rynek” for existing investments.

## Implementation Approach

Mirror `billing` exactly: a Payload `group` named `initialInfo` (columns `initial_info_*`), a constants
module that owns field labels and options, the same `''` ↔ `null` mapping in the form, the same details
read. The agent side reads the group from REST and renders it through one label map, so a future field
needs only the map entry, the column and the form control — the scripts don't change.

## Phase 1: Data model

### Overview

Persist `initialInfo.market` and expose it through the details read the edit dialog uses.

### Changes Required:

#### 1. Constants

**File**: `src/lib/constants/investment-initial-info.ts` (new)

**Intent**: Own the market values and every Polish/English label of the section, importable by the
collection (Payload CLI graph — no `server-only`), the form and the AI scripts.

**Contract**: `INVESTMENT_MARKETS = ['primary', 'secondary'] as const`, `InvestmentMarketT`,
`INVESTMENT_MARKET_LABELS` (`{ pl, en }` per value: „Rynek pierwotny” / „Rynek wtórny”), and
`INVESTMENT_INITIAL_INFO_LABELS` keyed by field name (`market: { pl: 'Rynek', en: 'Market' }`) plus the
section title.

#### 2. Collection

**File**: `src/collections/investments.ts`

**Intent**: Add a `group` `initialInfo` (label „Wstępne informacje”) with an optional `select` `market`.

**Contract**: Payload field `initialInfo.market` → column `initial_info_market`, enum
`enum_investments_initial_info_market`.

#### 3. Migration + types

**File**: `src/migrations/20261020_1_investment_initial_info.ts` (new), `src/migrations/index.ts`,
`src/payload-types.ts`

**Intent**: Hand-written additive migration (copy the billing one): create the enum, add the nullable
column; `down` drops both. Register in the index, then `pnpm generate:types`.

**Contract**: Additive → a human migrates prod with `pnpm db:migrate:prod` before the push.

#### 4. Details read

**Files**: `src/types/reference-data.ts`, `src/lib/queries/reference-data.ts`,
`src/lib/investments/investment-details.ts`

**Intent**: `InvestmentDetailsT` gains `initialInfo: InvestmentInitialInfoT` (`{ market: InvestmentMarketT | null }`);
`fetchInvestmentDetails` selects `initial_info_market::text`; `NO_INVESTMENT_INITIAL_INFO` joins
`NO_INVESTMENT_DETAILS`.

### Success Criteria:

#### Automated Verification:

- Migration applies to the local DB: `pnpm payload migrate` (after `git status src/migrations`)
- New `src/__tests__/lib/queries/investment-initial-info.db.test.ts` passes: updating an investment
  with `initialInfo.market: 'secondary'` reads back through `fetchInvestmentDetails`; `''` from the form
  persists as `null` (written test-first; DB project on 5435 — run it as `src/__tests__/AGENTS.md` says,
  the test template rebuilds for a new migration)

#### Manual Verification:

- (covered by Phase 2's UI checks)

---

## Phase 2: Form

### Overview

The „Wstępne informacje” section in add/edit, plus the „Kierownik budowy” width fix.

### Changes Required:

#### 1. Schema and values

**Files**: `src/components/forms/investment-form/investment-schema.ts`, `billing-form-values.ts`
(or a sibling `initial-info-form-values.ts`), `empty-form-values.ts`,
`src/components/dialogs/edit-investment-dialog.tsx`

**Intent**: `initialInfoFormSchema` with `market: z.enum(['', ...INVESTMENT_MARKETS])`; in
`investmentSchema` the `''` → `null` transform, as `billing.clientType`. Empty and edit defaults map
`null` → `''`. `InvestmentCreateDataT` carries the parsed `initialInfo` like `billing`.

#### 2. Section

**File**: `src/components/forms/investment-form/investment-form.tsx`

**Intent**: A `CollapsibleSection` „Wstępne informacje” (`size="sm"`, `withSeparator={false}`,
`defaultOpen={false}`) placed right after „Kontakt”, with a `field.Select` „Rynek”, placeholder
„— nie wiadomo —”, options from `INVESTMENT_MARKET_LABELS[...].pl`. Labels come from the constants module.

#### 3. „Kierownik budowy” width

**File**: `src/components/forms/investment-form/investment-form.tsx`

**Intent**: Stop the vertical `Field`'s `[&>*]:w-full` from stretching the trigger, without touching
`ui/field.tsx` or `ui/select.tsx` (the latter is another agent's in-flight edit) — e.g. a wrapper element
between `Field` and the select. The overview's use of the same select is unchanged.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/components/forms/investment-form/investment-schema.test.ts` (new or extended):
  `investmentSchema` turns `initialInfo.market: ''` into `null` and keeps `'primary'`

#### Manual Verification:

- Inwestycje → „Dodaj inwestycję”: „Wstępne informacje” is collapsed after „Kontakt”; choose „Rynek
  wtórny”, save; edit the same inwestycja → the section shows „Rynek wtórny”.
- Edit an inwestycja without „Rynek” → the select shows „— nie wiadomo —”; saving other fields leaves
  it empty.
- Edit dialog → „Kierownik budowy” is as wide as the chosen name, left-aligned; choosing a worker still
  saves on pick.

---

## Phase 3: AI agent reads the section

### Overview

The case inputs carry every field of „Wstępne informacje”; the method says how to use „Rynek”.

### Changes Required:

#### 1. Shared renderer

**File**: `scripts/ai-kosztorys/prod-client.ts`

**Intent**: `initialInfoLines(initialInfo)` renders each key of the REST `initialInfo` object as
`<label>: <value label>` using `INVESTMENT_INITIAL_INFO_LABELS` and the option label maps; an empty value
prints „— (puste)”; an unknown key or value falls back to its raw text, so a new field shows up without
a script change.

#### 2. Case scaffolding and rounds

**Files**: `scripts/ai-kosztorys/adopt-case-prod.ts`, `scripts/ai-kosztorys/round-case-prod.ts`

**Intent**: Adopt writes `inputs/initial-info.md` next to `client-inquiry.md` and prints it. A round
writes `initial-info.md` into the round dir, stores the lines in its record (`initialInfo: string[]`),
and prints the changed lines as „new initial info”; the round-2 baseline reads `inputs/initial-info.md`
when present, else treats it as empty.

#### 3. Method rule

**File**: `../wykonczymy-ai-cases/README.md` (committed in ai-cases)

**Intent**: Under the inputs step: read `inputs/initial-info.md` before Notatki. „Rynek” set → it wins
over what Notatki suggest (rynek pierwotny = stan deweloperski); empty → read Notatki as now and add a
„Do ustalenia z klientem” question about the market. Same for a later round's `initial-info.md`.

### Success Criteria:

#### Automated Verification:

- `DRY=1` adopt against a prod investment prints the „Wstępne informacje” lines (read-only; only after
  prod has the column)

#### Manual Verification:

- Next adopted case has `inputs/initial-info.md` with „Rynek: …” matching the inwestycja.

---

## Testing Strategy

### Unit Tests:

- Schema `''` → `null` for `initialInfo.market` (Payload's select rejects `''`).

### Integration Tests:

- Persist + read back through `fetchInvestmentDetails` (the edit dialog's source).

## Migration Notes

Additive. Local: `pnpm payload migrate`. Prod: a human runs `pnpm db:migrate:prod` **before** pushing.
Preview/staging: `pnpm db:migrate:preview` after merge. Existing investments read `null` = unknown.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- Touched specs only (no full `pnpm test` unless asked)

## References

- Linear: EX-1120
- Pattern: `src/migrations/20261016_1_investment_billing_data.ts`, `billing` group in `src/collections/investments.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data model

#### Automated

- [ ] 1.1 Migration applies to the local DB
- [ ] 1.2 investment-initial-info.db.test.ts passes — written in 86f309cb2 (at `src/__tests__/lib/actions/`, it drives the action), not run yet

### Phase 2: Form

#### Automated

- [ ] 2.1 investment-schema.test.ts passes — written in b7cfbaeab, not run yet

### Phase 3: AI agent reads the section

#### Automated

- [ ] 3.1 DRY adopt prints the „Wstępne informacje” lines — code in e7301c93d; runnable once prod has the column
