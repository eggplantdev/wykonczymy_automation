# Investment billing data Implementation Plan

## Overview

Add a structured site address (miejscowość, kod pocztowy, kraj) and an optional „Dane do umowy /
faktury” block (osoba prywatna / firma) to investments, editable in the investment form and shown on
`/inwestycje/[id]`. Groundwork for the follow-up „Umowa” dialog, which will prefill from these fields.

## Current State Analysis

- `investments` has one free-text `address` plus `phone`, `email`, `contactPerson`
  (`src/collections/investments.ts:64-83`). Local data: 63 of 196 investments have an address, in
  mixed shapes („Szaserów 30b/32”, „ul. X 11m12, 02-699 Warszawa”) — not machine-splittable.
- Form: `src/components/forms/investment-form/investment-form.tsx` (TanStack via `useManagedForm`,
  explicit `toData`), schema `investment-schema.ts` (`investmentFormSchema` + `investmentSchema`
  with optional defaults). Used by `add-investment-dialog.tsx` (`EMPTY_DEFAULTS`) and
  `edit-investment-dialog.tsx`.
- Writes: `createInvestmentAction` → `createInvestment()`; `updateInvestmentAction` passes the parsed
  data to `payload.update` (`src/lib/actions/investments.ts:133`). Both revalidate `investments`.
- Reads: `InvestmentRefT` comes from `fetchReferenceData` (every investment, shipped widely). Notes
  are deliberately split out: `fetchInvestmentNotes` + `withNotes` (`src/lib/queries/reference-data.ts:192-220`),
  merged only on the detail page — the pattern for per-investment detail fields.
- Detail page: `src/app/(frontend)/inwestycje/[id]/page.tsx` — `EditInvestmentDialog` +
  `InfoList(buildInvestmentInfoFields(...))`.

## Desired End State

- Edit/add investment form has a site-address group („Ulica i numer”, „Kod pocztowy”, „Miejscowość”,
  „Kraj”) and a „Dane do umowy / faktury” section: „Typ klienta” (Osoba prywatna / Firma); person →
  Imię, Nazwisko; company → Nazwa firmy, NIP, Osoba reprezentująca; checkbox „Adres taki sam jak adres
  inwestycji” (default on); when off → Ulica i numer, Kod pocztowy, Miejscowość, Kraj.
- Every new field is optional; saving an investment with all of them blank works.
- `/inwestycje/[id]` InfoList shows the full site address and, when filled, „Dane do umowy” lines.
- Existing investments untouched — the owner fills them by hand.

### Key Discoveries:

- `withNotes` / `fetchInvestmentNotes` is the precedent for detail-only fields kept out of
  `InvestmentRefT` (`reference-data.ts:192`).
- `updateInvestmentAction` sends the whole parsed form to `payload.update` — new fields ride along
  without action changes beyond the schema.
- Payload `select` fields create a Postgres enum (`enum_investments_status` precedent in
  `20261015_1_add_rejected_investment_status.ts`); the hand-written migration must create the type.
- `buildInvestmentInfoFields` already filters empty values — new rows appear only when filled.
- `updateInvestmentClientFieldsAction` (Protokół odbioru) writes only `contactPerson` + `address` —
  unaffected.

## What We're NOT Doing

- No data migration / auto-split of existing `address` values (manual, per owner).
- No PESEL / nr dowodu storage — the contract will leave a blank line.
- No REGON / KRS, no separate „Klienci” collection.
- No field validation for NIP / kod pocztowy (country varies; all optional).
- No change to the investments list table, leads promotion, or the Protokół odbioru dialog.
- No „Umowa” dialog — that is the follow-up change.

## Implementation Approach

New columns on `investments` (top-level site fields + a Payload `group` named `billing`), one
additive hand-written migration, schema/form extension, and a detail-only read that mirrors the notes
split so `InvestmentRefT` stays lean.

## Critical Implementation Details

- **Migration direction:** additive (`ADD COLUMN` + `CREATE TYPE`) → a human runs
  `pnpm db:migrate:prod` before the push. Locally run `git status src/migrations` before migrating
  the shared DB.
- **Cache:** the new detail fetch is a whole-table map tagged `CACHE_TAGS.investments`, like
  `fetchInvestmentNotes` — every investment write already expires it; no entity tag needed.

## Phase 1: Data model

### Overview

Columns, migration, generated types.

### Changes Required:

#### 1. Collection

**File**: `src/collections/investments.ts`

**Intent**: Relabel `address` to „Ulica i numer” and add the site fields after it, then a `billing`
group after `contactPerson`.

**Contract**: top-level `city`, `postalCode`, `country` (text). Group `billing`: `clientType`
(select `person` | `company`, optional, labels „Osoba prywatna” / „Firma”), `firstName`, `lastName`,
`companyName`, `nip`, `representative` (text), `sameAsSite` (checkbox, default `true`), `street`,
`postalCode`, `city`, `country` (text).

#### 2. Migration

**File**: `src/migrations/20261016_1_investment_billing_data.ts` + `src/migrations/index.ts`

**Intent**: Hand-written additive migration matching the Payload column names; `down` drops them.

**Contract**: `CREATE TYPE "enum_investments_billing_client_type" AS ENUM ('person','company')`;
columns `city`, `postal_code`, `country`, `billing_client_type`, `billing_first_name`,
`billing_last_name`, `billing_company_name`, `billing_nip`, `billing_representative`,
`billing_same_as_site boolean DEFAULT true`, `billing_street`, `billing_postal_code`,
`billing_city`, `billing_country` — all nullable varchar except the two above.

#### 3. Types

**File**: `src/payload-types.ts`

**Intent**: Regenerate with `pnpm generate:types`.

### Success Criteria:

#### Automated Verification:

- Migration applies on local dev DB (5433): `pnpm payload migrate`
- Migration applies on test DB (5435): `pnpm db:migrate:test`, and `down` reverts cleanly

#### Manual Verification:

- None for this phase (no UI yet)

---

## Phase 2: Form, read path and detail view

### Overview

Edit the new fields, read them on the detail page, display them.

### Changes Required:

#### 1. Schema + types

**File**: `src/components/forms/investment-form/investment-schema.ts`, `src/types/reference-data.ts`

**Intent**: Add the site fields and a nested `billing` object to `investmentFormSchema`
(strings, `clientType: '' | 'person' | 'company'`, `sameAsSite: boolean`) and optional defaults in
`investmentSchema`. Add `InvestmentDetailsT` (site fields + billing) and widen the type the edit
dialog takes.

**Contract**: `''` clientType maps to `null` on write (Payload select rejects `''`).

#### 2. Detail read

**File**: `src/lib/queries/reference-data.ts`

**Intent**: Extend the notes split so the detail page gets the new columns: fold them into the
existing `fetchInvestmentNotes` query (renamed `fetchInvestmentDetails`, `withNotes` →
`withDetails`) rather than a second round-trip. Update its three callers.

**Contract**: returns `Record<id, InvestmentNotesT & InvestmentDetailsT>`; empty-string / `sameAsSite:
true` fallback for absent rows.

#### 3. Form

**Files**: `investment-form.tsx`, `add-investment-dialog.tsx`, `edit-investment-dialog.tsx`

**Intent**: Site group under „Ulica i numer” (kod + miejscowość in two columns, same container-query
grid as status), then a „Dane do umowy / faktury” `FieldSet` + `FieldLegend`. Person vs company
fields switch on `clientType` (`useStore`); address fields hidden while `sameAsSite`. Extend
`toData`, `EMPTY_DEFAULTS` and the edit defaults.

#### 4. Detail view

**Files**: `src/components/investments/investment-info-fields.tsx`, a small pure formatter under
`src/lib/investments/` (e.g. `format-address.ts`)

**Intent**: „Adres” renders the joined site address (`street, kod miejscowość, kraj`); add
„Zamawiający” (person name, or company name + NIP + „repr. …”) and „Adres do umowy” (only when
`sameAsSite` is off). Empty → filtered out as today.

### Success Criteria:

#### Automated Verification:

- Unit spec for the address/billing formatter: `pnpm exec vitest run src/__tests__/lib/investments/format-address.test.ts`
- `investment-info-fields` spec extended for the new rows: `pnpm exec vitest run src/__tests__/components/investments/investment-info-fields.test.ts`

#### Manual Verification:

- Add an investment with every new field blank → saves, detail page shows no new rows.
- Edit: fill site kod/miejscowość/kraj → „Adres” shows the joined line.
- „Firma” + NIP + osoba reprezentująca, „taki sam” on → „Zamawiający” shows company + NIP; no
  „Adres do umowy” row.
- Switch to „Osoba prywatna”, untick „taki sam”, fill the address → name + „Adres do umowy” shown.
- Protokół odbioru „Zaktualizuj dane inwestycji” still updates contact person + address.

---

## Testing Strategy

### Unit Tests:

- Formatter: blank parts skipped, no dangling commas; company vs person; `sameAsSite` handling.
- Info fields: new rows present only when filled.

### Manual Testing Steps:

See Phase 2 Manual Verification (local, 5435 per `context/reference/manual-verification.md`).

## Migration Notes

Additive. Human applies prod with `pnpm db:migrate:prod` before the push; preview with
`pnpm db:migrate:preview` after merge to staging. Existing rows: all new columns null,
`billing_same_as_site` true.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- DB integration specs pass: `pnpm test:integration`

## References

- Notes split precedent: `src/lib/queries/reference-data.ts:192`
- Form pattern: `src/components/forms/investment-form/investment-form.tsx`
- Follow-up consumer: Protokół odbioru dialog `src/components/kosztorys/editor/dialogs/acceptance-protocol-dialog.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data model

#### Automated

- [x] 1.1 Migration applies on local dev DB (5433) — b6e74bd9f
- [x] 1.2 Migration applies on test DB (5435) and `down` reverts cleanly — b6e74bd9f

### Phase 2: Form, read path and detail view

#### Automated

- [ ] 2.1 Unit spec for the address/billing formatter
- [ ] 2.2 `investment-info-fields` spec extended for the new rows
