# Korekta as a typed investment expense — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a `CORRECTION` ("korekta") a negative, typed investment-expense line item (carrying an `expenseCategory` = "typ wydatku inwestycyjnego"), counted once inside its expense type — and remove the separate "Korekty" balance line entirely.

**Architecture:** Two deploy phases. Phase 1 enables + requires the expense type on corrections in every write path (create form mapper, edit form, validation) while the "Korekty" line still exists — then the 34 legacy corrections are backfilled in-app. Phase 2 removes the "Korekty" line and reroutes corrections from the kosztorys "Transfery" tab to the "Wydatki" tab.

**Tech Stack:** Next.js + Payload CMS, TanStack Form, Zod, Vitest, `@vercel/postgres` raw SQL, Google Sheets sync.

## Global Constraints

- Polish UI, English code. Do NOT add `readonly` to props/types.
- Hand-write migrations only if needed (none expected here — no schema change).
- Never run SQL/migrations/dumps against the Neon prod URL; a human does prod + backfill.
- Single test file: `pnpm exec vitest run <path>`. Full suite: `pnpm exec vitest run`.
- Commit only files this plan touches, by explicit path. Never `git push`.
- Spec: `docs/superpowers/specs/2026-06-18-korekta-jako-typ-wydatku-design.md`.

## File structure

Phase 1 (behavior: corrections carry a required expense type)

- Modify `src/lib/constants/transfers.ts` — `needsExpenseCategory` ⊇ CORRECTION; `REQUIRES_INVESTMENT_TYPES` ⊇ CORRECTION.
- Modify `src/lib/schemas/transfer.ts` — `validateLineItemCategories` requires type for CORRECTION line items.
- Modify `src/hooks/transfers/validate.ts` — require `expenseCategory` for CORRECTION.
- Create `src/components/forms/expense-form/map-line-item.ts` — pure line-item → payload mapper (extracted from `expense-form.tsx`).
- Modify `src/components/forms/expense-form/expense-form.tsx` — use the extracted mapper.
- (`edit-transfer-form.tsx:147` needs NO edit — its gate is `needsExpenseCategory(row.type)`, which now includes CORRECTION.)
- Tests: `transfer-constants.test.ts`, `transfer-schema.test.ts`, `validate-hook.test.ts`, new `map-line-item.test.ts`.

Phase 2 (remove "Korekty" line + reroute sheet)

- Modify `src/lib/map-category-costs.ts` — drop the "Korekty" field.
- Modify `src/components/investments/financial-stats.tsx` — remove `CORRECTION_LABEL` + its filters.
- Modify `src/lib/constants/transfers.ts` — remove CORRECTION from `SHEET_TRANSFER_TAB_TYPES`.
- Modify `src/lib/actions/sheets-sync.ts` — `EXPENSES_SYNC.typeWhere` ⊇ CORRECTION; `tabSyncForType('CORRECTION')` → expenses.
- Tests: `map-category-costs.test.ts`, `transfer-constants.test.ts`, `sheets-sync.test.ts`, `tab-rows.test.ts`.

---

# PHASE 1 — Enable + require expense type on corrections

### Task 1: `needsExpenseCategory` and `requiresInvestment` include CORRECTION

**Files:**

- Modify: `src/lib/constants/transfers.ts:120-125,152-153`
- Test: `src/__tests__/transfer-constants.test.ts:46-61`

**Interfaces:**

- Produces: `needsExpenseCategory(type)` true for `INVESTMENT_EXPENSE` and `CORRECTION`; `requiresInvestment(type)` additionally true for `CORRECTION`.

- [ ] **Step 1: Update the truth-table expectations (failing test)**

In `src/__tests__/transfer-constants.test.ts`, change the two `trueFor` arrays:

```ts
  requiresInvestment: {
    fn: requiresInvestment,
    trueFor: ['INVESTOR_DEPOSIT', 'INVESTMENT_EXPENSE', 'LABOR_COST', 'RABAT', 'CORRECTION'],
  },
```

```ts
  needsExpenseCategory: {
    fn: needsExpenseCategory,
    trueFor: ['INVESTMENT_EXPENSE', 'CORRECTION'],
  },
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm exec vitest run src/__tests__/transfer-constants.test.ts`
Expected: FAIL — `CORRECTION → true` expected, got `false` for both helpers.

- [ ] **Step 3: Implement**

In `src/lib/constants/transfers.ts`, add CORRECTION to the required-investment list:

```ts
const REQUIRES_INVESTMENT_TYPES: TransferTypeT[] = [
  'INVESTOR_DEPOSIT',
  'INVESTMENT_EXPENSE',
  'LABOR_COST',
  'RABAT',
  'CORRECTION',
]
```

And widen `needsExpenseCategory`:

```ts
export const needsExpenseCategory = (type: string) =>
  isTransferType(type) && (type === 'INVESTMENT_EXPENSE' || type === 'CORRECTION')
```

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm exec vitest run src/__tests__/transfer-constants.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants/transfers.ts src/__tests__/transfer-constants.test.ts
git commit -m "feat(korekta): require expense type + investment for corrections"
```

---

### Task 2: `validateLineItemCategories` requires a type on CORRECTION line items

**Files:**

- Modify: `src/lib/schemas/transfer.ts:75-89`
- Test: `src/__tests__/transfer-schema.test.ts`

**Interfaces:**

- Consumes: `validateLineItemCategories(type, lineItems, ctx)` from Task 0 baseline.
- Produces: emits an issue for a CORRECTION (or INVESTMENT_EXPENSE) line item missing `expenseCategory`.

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/transfer-schema.test.ts` (import `validateLineItemCategories` from `@/lib/schemas/transfer` if not already):

```ts
describe('validateLineItemCategories — CORRECTION', () => {
  it('flags a CORRECTION line item with no expenseCategory', () => {
    const issues: { path: (string | number)[] }[] = []
    const ctx = { addIssue: (i: { path: (string | number)[] }) => issues.push(i) } as never
    validateLineItemCategories('CORRECTION', [{ category: 1, expenseCategory: undefined }], ctx)
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toEqual(['lineItems', 0, 'expenseCategory'])
  })

  it('passes a CORRECTION line item that has an expenseCategory', () => {
    const issues: unknown[] = []
    const ctx = { addIssue: (i: unknown) => issues.push(i) } as never
    validateLineItemCategories('CORRECTION', [{ expenseCategory: 5 }], ctx)
    expect(issues).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm exec vitest run src/__tests__/transfer-schema.test.ts`
Expected: FAIL — first test gets 0 issues (CORRECTION not yet validated).

- [ ] **Step 3: Implement**

In `src/lib/schemas/transfer.ts`, broaden the line-item rule to use `needsExpenseCategory`:

```ts
import { needsExpenseCategory } from '@/lib/constants/transfers'
// ...
export function validateLineItemCategories(
  type: string,
  lineItems: { category?: unknown; expenseCategory?: unknown }[],
  ctx: z.RefinementCtx,
) {
  lineItems.forEach((item, index) => {
    if (needsExpenseCategory(type) && !item.expenseCategory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Typ wydatku inwestycyjnego jest wymagany',
        path: ['lineItems', index, 'expenseCategory'],
      })
    }
  })
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm exec vitest run src/__tests__/transfer-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/transfer.ts src/__tests__/transfer-schema.test.ts
git commit -m "feat(korekta): require expense type on correction line items"
```

---

### Task 3: `validateTransfer` hook requires `expenseCategory` for CORRECTION

**Files:**

- Modify: `src/hooks/transfers/validate.ts:90-93`
- Test: `src/__tests__/validate-hook.test.ts`

**Interfaces:**

- Produces: hook throws `Expense category is required...` for a CORRECTION lacking `expenseCategory`.

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/validate-hook.test.ts` inside the `expenseCategory` describe block. CORRECTION needs a negative amount (`getAmountError`), a sourceRegister and an investment to isolate the category rule:

```ts
it('CORRECTION without expenseCategory → throws', () => {
  const data = { ...base, amount: -100, type: 'CORRECTION', sourceRegister: 1, investment: 1 }
  expect(() => validateTransfer(hookArgs(data))).toThrow(/[Ee]xpense category/)
})

it('CORRECTION with expenseCategory → passes', () => {
  const data = {
    ...base,
    amount: -100,
    type: 'CORRECTION',
    sourceRegister: 1,
    investment: 1,
    expenseCategory: 1,
  }
  expect(() => validateTransfer(hookArgs(data))).not.toThrow()
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm exec vitest run src/__tests__/validate-hook.test.ts`
Expected: FAIL — "CORRECTION without expenseCategory" does not throw.

- [ ] **Step 3: Implement**

In `src/hooks/transfers/validate.ts`, replace the literal type check with the helper. Add `needsExpenseCategory` to the existing import from `@/lib/constants/transfers`, then:

```ts
// expenseCategory — required for INVESTMENT_EXPENSE and CORRECTION
if (needsExpenseCategory(type) && !d.expenseCategory) {
  errors.push('Expense category is required for investment-related expenses.')
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm exec vitest run src/__tests__/validate-hook.test.ts`
Expected: PASS (all 28).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/transfers/validate.ts src/__tests__/validate-hook.test.ts
git commit -m "feat(korekta): hook requires expense type for corrections"
```

---

### Task 4: Extract + fix the line-item submit mapper (send `expenseCategory` for CORRECTION)

**Files:**

- Create: `src/components/forms/expense-form/map-line-item.ts`
- Modify: `src/components/forms/expense-form/expense-form.tsx:137-146`
- Test: `src/__tests__/map-line-item.test.ts`

**Interfaces:**

- Produces: `mapLineItem(item, type)` returning the server line-item shape `{ description, amount, invoiceNote?, category?, expenseCategory? }`, where `expenseCategory` is included whenever `needsExpenseCategory(type)` (i.e. INVESTMENT_EXPENSE **or** CORRECTION).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/map-line-item.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mapLineItem } from '@/components/forms/expense-form/map-line-item'

const item = {
  description: 'x',
  amount: '-1000',
  invoiceNote: '',
  category: '',
  expenseCategory: '7',
}

describe('mapLineItem', () => {
  it('keeps expenseCategory for a CORRECTION line item', () => {
    expect(mapLineItem(item, 'CORRECTION').expenseCategory).toBe(7)
  })

  it('keeps expenseCategory for an INVESTMENT_EXPENSE line item', () => {
    expect(mapLineItem(item, 'INVESTMENT_EXPENSE').expenseCategory).toBe(7)
  })

  it('drops expenseCategory for a type that does not use it (OTHER)', () => {
    expect(mapLineItem(item, 'OTHER').expenseCategory).toBeUndefined()
  })

  it('coerces amount to a number', () => {
    expect(mapLineItem(item, 'CORRECTION').amount).toBe(-1000)
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm exec vitest run src/__tests__/map-line-item.test.ts`
Expected: FAIL — module `map-line-item` not found.

- [ ] **Step 3: Implement the mapper**

Create `src/components/forms/expense-form/map-line-item.ts`:

```ts
import { needsExpenseCategory, type TransferTypeT } from '@/lib/constants/transfers'

type FormLineItemT = {
  description: string
  amount: string
  invoiceNote: string
  category: string
  expenseCategory: string
}

type PayloadLineItemT = {
  description: string
  amount: number
  invoiceNote: string | undefined
  category: number | undefined
  expenseCategory: number | undefined
}

/** Map one form line item (string fields) to the server shape. expenseCategory
 *  ("typ wydatku inwestycyjnego") rides only for types that use it. */
export function mapLineItem(item: FormLineItemT, type: TransferTypeT): PayloadLineItemT {
  return {
    description: item.description,
    amount: Number(item.amount),
    invoiceNote: item.invoiceNote || undefined,
    category: item.category ? Number(item.category) : undefined,
    expenseCategory:
      needsExpenseCategory(type) && item.expenseCategory ? Number(item.expenseCategory) : undefined,
  }
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm exec vitest run src/__tests__/map-line-item.test.ts`
Expected: PASS.

- [ ] **Step 5: Use the mapper in the form**

In `src/components/forms/expense-form/expense-form.tsx`, replace the inline `lineItems: value.lineItems.map((item) => ({ ... }))` (lines ~137-146) with:

```ts
        lineItems: value.lineItems.map((item) => mapLineItem(item, type)),
```

Add the import: `import { mapLineItem } from '@/components/forms/expense-form/map-line-item'`.

- [ ] **Step 6: Typecheck + full suite**

Run: `pnpm exec tsc --noEmit && pnpm exec vitest run`
Expected: no type errors; all green.

- [ ] **Step 7: Commit**

```bash
git add src/components/forms/expense-form/map-line-item.ts src/components/forms/expense-form/expense-form.tsx src/__tests__/map-line-item.test.ts
git commit -m "fix(korekta): send expense type from the form for corrections"
```

---

### Task 5 (manual, no code): Phase 1 deploy + in-app backfill

- [ ] Deploy Phase 1 (human pushes). The "Korekty" line still exists, so balances are unchanged.
- [ ] Backfill the 34 legacy corrections in-app via "edytuj transakcję": open each correction, set its "Typ wydatku inwestycyjnego" (and investment if missing — note: one legacy correction has no investment). Save.
- [ ] Verify: each backfilled correction now shows its type in the transfers table and folds into its expense type on the investment page (still also visible in the "Korekty" line at this point — that is expected until Phase 2).

> Do NOT start Phase 2 until the backfill is complete — removing the "Korekty" line before backfill makes untyped corrections vanish from the balance.

---

# PHASE 2 — Remove the "Korekty" line + reroute the sheet

### Task 6: Remove the "Korekty" field from the financial breakdown

**Files:**

- Modify: `src/lib/map-category-costs.ts:26-32`
- Test: `src/__tests__/map-category-costs.test.ts`

**Interfaces:**

- Produces: `buildFinancialFields` never emits a field labelled `'Korekty'`. Categorized corrections are reflected only through `categoryCosts` (counted once).

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/map-category-costs.test.ts`:

```ts
describe('buildFinancialFields — corrections fold into their type (no separate line)', () => {
  it('never emits a "Korekty" field, even when totalCorrections != 0', () => {
    const fields = buildFinancialFields({ ...base, totalCorrections: -2000 }, [])
    expect(fields.find((f) => f.label === 'Korekty')).toBeUndefined()
  })

  it('a categorized correction is reflected once, inside its expense type', () => {
    // category 1 net = expense 1000 + correction -200 = 800 → amount -800
    const financials = {
      ...base,
      categoryCosts: [{ categoryId: 1, total: 800 }],
      totalCorrections: -200,
    }
    const fields = buildFinancialFields(financials, [{ id: 1, name: 'Materiały budowlane' }])
    const cat = fields.find((f) => f.label === 'Materiały budowlane')
    expect(cat!.amount).toBe(-800)
    expect(fields.find((f) => f.label === 'Korekty')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm exec vitest run src/__tests__/map-category-costs.test.ts`
Expected: FAIL — a `'Korekty'` field is still emitted when `totalCorrections !== 0`.

- [ ] **Step 3: Implement**

In `src/lib/map-category-costs.ts`, drop `totalCorrections` from the destructure and remove the conditional "Korekty" entry:

```ts
export function buildFinancialFields(
  financials: InvestmentFinancialsT,
  expenseCategories: { id: number; name: string }[],
): FinancialFieldT[] {
  const { categoryCosts, totalIncome, totalLaborCosts, totalRabat } = financials

  return [
    ...mapCategoryCostsToFields(categoryCosts, expenseCategories),
    {
      label: 'Robocizna',
      value: formatPLN(totalLaborCosts),
      amount: -totalLaborCosts,
    },
    { label: 'Wpłaty', value: formatPLN(totalIncome), amount: totalIncome },
    ...(totalRabat !== 0
      ? [{ label: 'Rabat', value: formatPLN(totalRabat), amount: totalRabat }]
      : []),
  ]
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm exec vitest run src/__tests__/map-category-costs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/map-category-costs.ts src/__tests__/map-category-costs.test.ts
git commit -m "feat(korekta): drop the separate Korekty balance line"
```

---

### Task 7: Remove `CORRECTION_LABEL` from FinancialStats

**Files:**

- Modify: `src/components/investments/financial-stats.tsx:17,51-69`

**Interfaces:**

- Consumes: `buildFinancialFields` output that no longer contains a `'Korekty'` field (Task 6).

- [ ] **Step 1: Implement (no unit test — presentational filtering; covered by typecheck + render path)**

In `src/components/investments/financial-stats.tsx`:

- Delete `const CORRECTION_LABEL = 'Korekty'` (line 17).
- In the `expenseRow` filter, remove the line `f.label !== CORRECTION_LABEL &&`.
- In the `incomeRow` filter, remove `f.label === CORRECTION_LABEL ||`, leaving:

```ts
const incomeRow = fields
  .filter((f) => f.label === INCOME_LABEL || f.label === RABAT_LABEL)
  .map((f) => addBtnBorderColor(f, 'border-chart-green'))
```

- [ ] **Step 2: Typecheck + full suite**

Run: `pnpm exec tsc --noEmit && pnpm exec vitest run`
Expected: no type errors (no dangling `CORRECTION_LABEL`); all green.

- [ ] **Step 3: Commit**

```bash
git add src/components/investments/financial-stats.tsx
git commit -m "refactor(korekta): drop CORRECTION_LABEL from financial stats"
```

---

### Task 8: Route corrections to the kosztorys "Wydatki" tab (not "Transfery")

**Files:**

- Modify: `src/lib/constants/transfers.ts:81-88` (remove CORRECTION from `SHEET_TRANSFER_TAB_TYPES`)
- Modify: `src/lib/actions/sheets-sync.ts:66-70,80-85`
- Test: `src/__tests__/transfer-constants.test.ts`, `src/__tests__/lib/actions/sheets-sync.test.ts`, `src/__tests__/lib/google/tab-rows.test.ts`

**Interfaces:**

- Produces: `isSheetTransferTabType('CORRECTION') === false`; `tabSyncForType('CORRECTION')` resolves to the expenses sync; `EXPENSES_SYNC` matches `type IN ('INVESTMENT_EXPENSE','CORRECTION')`.

- [ ] **Step 1: Write the failing constant test**

In `src/__tests__/transfer-constants.test.ts`, add (import `isSheetTransferTabType` and `SHEET_TRANSFER_TAB_TYPES`):

```ts
describe('SHEET_TRANSFER_TAB_TYPES — corrections moved to the expenses tab', () => {
  it('does not contain CORRECTION', () => {
    expect(SHEET_TRANSFER_TAB_TYPES).not.toContain('CORRECTION')
  })
  it('isSheetTransferTabType is false for CORRECTION', () => {
    expect(isSheetTransferTabType('CORRECTION')).toBe(false)
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm exec vitest run src/__tests__/transfer-constants.test.ts`
Expected: FAIL — CORRECTION is still a transfers-tab type.

- [ ] **Step 3: Implement the constant + routing**

In `src/lib/constants/transfers.ts`, remove `'CORRECTION'` from `SHEET_TRANSFER_TAB_TYPES`:

```ts
export const SHEET_TRANSFER_TAB_TYPES = [
  'INVESTOR_DEPOSIT',
  'LABOR_COST',
  'RABAT',
  'PAYOUT',
  'LOSS',
] as const satisfies readonly TransferTypeT[]
```

In `src/lib/actions/sheets-sync.ts`, widen the expenses sync and its router:

```ts
const EXPENSES_SYNC: TabSyncSpecT = {
  cfg: EXPENSES_TAB_CONFIG,
  typeWhere: { in: ['INVESTMENT_EXPENSE', 'CORRECTION'] },
  buildRow: expenseRow,
}
```

```ts
const tabSyncForType = (type: unknown): TabSyncSpecT | undefined =>
  type === 'INVESTMENT_EXPENSE' || type === 'CORRECTION'
    ? EXPENSES_SYNC
    : isSheetTransferTabType(type)
      ? TRANSFERS_SYNC
      : undefined
```

- [ ] **Step 4: Run the constant test**

Run: `pnpm exec vitest run src/__tests__/transfer-constants.test.ts`
Expected: PASS.

- [ ] **Step 5: Fix the sheet-sync routing tests**

In `src/__tests__/lib/actions/sheets-sync.test.ts`, the suites `syncSingleTransferToSheet — transfers tab routing` (~line 632) and `applyMaterialSync — transfers tab` (~line 443) assert a CORRECTION row lands on the transfers tab. Update the CORRECTION cases so a correction routes to the **expenses** tab (assert it appends to `EXPENSES_TAB_CONFIG`'s range / `expenseRow` output, mirroring the existing INVESTMENT_EXPENSE expectations in the `applyMaterialSync` and `syncSingleTransferToSheet` expenses suites). Run after editing:

Run: `pnpm exec vitest run src/__tests__/lib/actions/sheets-sync.test.ts`
Expected: PASS.

- [ ] **Step 6: Fix the tab-rows CORRECTION expectation**

In `src/__tests__/lib/google/tab-rows.test.ts`, the case `fills kategoria from expenseCategory (CORRECTION)` (~line 29) tests `transferRow` for a correction. Corrections no longer use `transferRow`; replace it with an `expenseRow` expectation for a typed correction (negative amount preserved, `typ` filled from `expenseCategory`), and add a case asserting `expenseRow` returns `undefined` for a correction with no `expenseCategory`:

```ts
it('expenseRow builds a row for a typed CORRECTION and preserves the negative amount', () => {
  const row = expenseRow({
    id: 9,
    type: 'CORRECTION',
    amount: -120,
    investment: 31,
    expenseCategory: { id: 2, name: 'Materiały budowlane' },
    ...base,
  } as never)
  expect(row).toBeDefined()
  expect(row!.amount).toBe(-120)
  expect(row!.typ).toBe('Materiały budowlane')
})

it('expenseRow skips an untyped CORRECTION', () => {
  const row = expenseRow({
    id: 10,
    type: 'CORRECTION',
    amount: -50,
    investment: 31,
    ...base,
  } as never)
  expect(row).toBeUndefined()
})
```

(Adjust the `typ` / row-field names to whatever `expenseRow` actually returns — confirm against `src/lib/google/tab-rows.ts:expenseRow`.)

Run: `pnpm exec vitest run src/__tests__/lib/google/tab-rows.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck + full suite**

Run: `pnpm exec tsc --noEmit && pnpm exec vitest run`
Expected: no type errors; all green.

- [ ] **Step 8: Commit**

```bash
git add src/lib/constants/transfers.ts src/lib/actions/sheets-sync.ts src/__tests__/transfer-constants.test.ts src/__tests__/lib/actions/sheets-sync.test.ts src/__tests__/lib/google/tab-rows.test.ts
git commit -m "feat(korekta): route corrections to the kosztorys expenses tab"
```

---

### Task 9 (manual, no code): Phase 2 deploy + sheet re-sync

- [ ] Deploy Phase 2 (human pushes).
- [ ] For each investment that has corrections, run the material re-sync ("synchronizacja materiałów" / reset). The reconciler removes the old correction rows from the "Transfery" tab and appends them to "Wydatki".
- [ ] Verify on one investment (e.g. ID 77): no "Korekty" line on the investment page; corrections reduce the relevant expense types; corrections appear on the "Wydatki" sheet tab and are gone from "Transfery".

---

## Self-Review

**Spec coverage:** Area 1 (form mapper) → Task 4. Area 2 (edit form) → covered by Task 1 (`needsExpenseCategory` drives `edit-transfer-form.tsx:147`; no edit needed). Area 3 (validation) → Tasks 1–3. Area 4 (remove Korekty line) → Tasks 6–7. Area 5 (sheets) → Task 8. Data backfill + rollout phases → Tasks 5 and 9. Complete-removal-of-corrections-sum → Task 6 (no `'Korekty'` field) + Task 7 (no label). No gaps.

**Placeholder scan:** Step 5/6 of Task 8 reference existing mock-heavy test blocks by line and describe the exact assertion change rather than re-pasting ~60-line googleapis mock setups; the new `expenseRow` cases are spelled out in full. All other steps carry complete code.

**Type consistency:** `needsExpenseCategory` (Task 1) is reused by Tasks 2, 3, 4 and the edit form — one definition, no drift. `mapLineItem(item, type)` signature is stable across Task 4. `EXPENSES_SYNC` / `tabSyncForType` names match `sheets-sync.ts`.
