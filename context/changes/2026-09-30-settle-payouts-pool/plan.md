# Kwota do rozdysponowania i saldo kasy w „Rozlicz wypłaty” — Implementation Plan

## Overview

The owner settles payouts from a fixed sum of cash in hand („wpłacam 10 000 zł, 4 000 zł na pierwszą
inwestycję — ile mi jeszcze zostało z tych 10 000 zł”). The dialog shows only per-pair figures and a
„Razem”, so the remainder is mental arithmetic, and the register's saldo is not shown at all (unlike
every other form with a „Kasa” field). This change adds an optional client-side calculator and the
register saldo.

## Current State Analysis

- `src/components/forms/settle-payouts-form/settle-payouts-form.tsx` — TanStack form (`date`,
  `sourceRegister`, `description`, `rows`), computes `total` over ticked valid rows, `canSubmit` =
  ≥1 ticked row and every ticked amount valid. Uses the bare `CashRegisterField`, so no saldo.
- `settle-payouts-table.tsx` — footer is one `ColumnTotalRow` („Razem”) under the amount column.
- Other forms show saldo through `SourceRegisterField` + `useRegisterBalance`
  (`src/components/forms/hooks/use-register-balance.ts`), which fetches only on the select's
  `onChange`. Here the user's default register is preselected, so `onChange` never fires.
- The spike (2026-09-30) is already in the working tree and was approved by the owner from
  screenshots; it passes `tsc` and `eslint`.

## Desired End State

- Optional „Do rozdysponowania” input between „Kasa” and „Data”. Never sent to the action, never
  persisted; empty = the dialog behaves exactly as before.
- When filled, a second footer row „Zostało do rozdysponowania” = kwota − Razem, green at 0, red below.
- Razem > kwota disables „Wypłać” and shows „Przekroczono kwotę do rozdysponowania o X” next to it.
- „Aktualne saldo” under „Kasa”, loaded on mount for the preselected register and on every change;
  „Saldo po wypłacie” = saldo − Razem shown while Razem > 0. Informational only — never blocks.
- Row prefill unchanged.

### Key Discoveries:

- `ColumnTotalRow` (`src/components/tables/data-table/column-total-row.tsx`) is reusable as-is for
  the second footer row — fragment of two rows in `footer`.
- `SignedMoneyDisplay` already colours by sign; „Saldo po transakcji” elsewhere uses the same shape.
- The DOM spec renders with `defaultCashRegisterId={5}`, so the mount fetch will call
  `getRegisterBalance` — a `'use server'` module stubbed to THROW in jsdom. The spec must
  `vi.mock('@/lib/queries/register-balance')`, or every test silently hits the error toast path.

## What We're NOT Doing

- No auto-distribution of the kwota across rows (the owner allocates by hand).
- No blocking on saldo < Razem (a register may legitimately go negative).
- No persistence of the kwota (not in the action payload, not in the opis, not in localStorage).
- Not changing the mount-time saldo behaviour of the other forms.

## Implementation Approach

Keep the spike's structure; the work is hardening + tests. The kwota is a form field (`pool`) so it
lives in the same store as the rows and survives a stale-figures reload (only `rows` is re-seeded).

## Phase 1: Harden the spike and cover it

### Overview

Review the spike diff for leftovers, then pin the calculator, the guard and the saldo with DOM specs.

### Changes Required:

#### 1. Settle form

**File**: `src/components/forms/settle-payouts-form/settle-payouts-form.tsx`

**Intent**: Keep `pool` field, `poolLeft`/`overPool` derivation, guard in `canSubmit`, the
`SourceRegisterField` swap, mount fetch of the default register's saldo and „Saldo po wypłacie”.
Tidy imports to the repo's barrel where one exists.

**Contract**: `FormValuesT.pool: string`; `poolLeft: number | null` (null ⇔ field empty);
`canSubmit` additionally requires `!overPool`. Action payload unchanged.

#### 2. Settle table

**File**: `src/components/forms/settle-payouts-form/settle-payouts-table.tsx`

**Intent**: Second `ColumnTotalRow` „Zostało do rozdysponowania” when `poolLeft !== null`.

**Contract**: new prop `poolLeft: number | null`.

#### 3. DOM spec

**File**: `src/__tests__/components/forms/settle-payouts-form/settle-payouts-form.test.tsx`

**Intent**: Mock `@/lib/queries/register-balance`; add cases:

- kwota 10 000 with one row at 4 000 → „Zostało do rozdysponowania” reads 6 000,00 zł;
- empty kwota → no such row, submit enabled as before;
- Razem > kwota → „Wypłać” disabled + „Przekroczono … o X”; lowering the amount re-enables it;
- mount with default register → „Aktualne saldo” shows the mocked saldo and „Saldo po wypłacie” =
  saldo − Razem; kwota never appears in the `settlePayoutsAction` payload.

### Success Criteria:

#### Automated Verification:

- Settle form DOM spec passes: `pnpm exec vitest run src/__tests__/components/forms/settle-payouts-form/settle-payouts-form.test.tsx`
- Lint clean on the touched dir: `pnpm exec eslint src/components/forms/settle-payouts-form/`

#### Manual Verification:

- „Rozlicz wypłaty” (Pracownicy → Rozlicz): type 10 000 in „Do rozdysponowania”, put 4 000 on one
  row → footer „Zostało do rozdysponowania” 6 000,00 zł; push Razem above the kwota → „Wypłać”
  greyed out with the „Przekroczono…” message.
- With a default register, „Aktualne saldo” appears without touching „Kasa”; changing the register
  refreshes it; „Saldo po wypłacie” drops by Razem.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

DOM layer only — the change is a client-side calculator and a disabled control, exactly what the
DOM layer exists for. Server action and booking path are untouched (test-plan risk #16 stays covered
by `settle-payouts.test.ts`).

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`

## References

- Spike + decisions: `context/changes/2026-09-30-settle-payouts-pool/change.md`
- Saldo pattern: `src/components/forms/form-fields/source-register-field.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Harden the spike and cover it

#### Automated

- [x] 1.1 Settle form DOM spec passes
- [x] 1.2 Lint clean on the touched dir
