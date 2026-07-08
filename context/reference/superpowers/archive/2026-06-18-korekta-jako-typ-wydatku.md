# Korekta as a typed investment expense — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a `CORRECTION` ("korekta") a negative, typed investment-expense line item (carrying an `expenseCategory` = "typ wydatku inwestycyjnego"), counted once inside its expense type — and remove the separate "Korekty" balance line entirely.

**Owner rule (conditional):** Investment is **optional** on a correction; the expense type is required **only when an investment is attached** (LOSS-style). `requiresInvestment('CORRECTION')` stays false. The driver is one investment-aware predicate, `needsExpenseCategory(type, hasInvestment)` — true for `INVESTMENT_EXPENSE` always and for `CORRECTION` only when `hasInvestment`; it replaces `showsExpenseCategory`, since "shown" and "required" now coincide.

**Architecture:** Two deploy phases. Phase 1 makes the expense type ride + be required on corrections **that have an investment**, in every write path (create form mapper, edit form, validation), while the "Korekty" line still exists — then legacy corrections-with-an-investment are backfilled in-app. Phase 2 removes the "Korekty" line and reroutes corrections from the kosztorys "Transfery" tab to the "Wydatki" tab.

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

- Modify `src/lib/constants/transfers.ts` — make `needsExpenseCategory(type, hasInvestment)` investment-aware (CORRECTION true only when `hasInvestment`). Leave `REQUIRES_INVESTMENT_TYPES` alone (CORRECTION stays optional). Later: delete `showsExpenseCategory`.
- Modify `src/lib/schemas/transfer.ts` — `validateLineItemCategories` requires type for a CORRECTION line item only when the transfer has an investment (thread `hasInvestment`).
- Modify `src/hooks/transfers/validate.ts` — require `expenseCategory` for CORRECTION only when `investment` is set: `needsExpenseCategory(type, !!d.investment)`.
- Create `src/components/forms/expense-form/map-line-item.ts` — pure line-item → payload mapper (extracted from `expense-form.tsx`); `expenseCategory` rides when `needsExpenseCategory(type, hasInvestment)`.
- Modify `src/components/forms/expense-form/expense-form.tsx` — use the extracted mapper, passing `!!value.investment`.
- Modify `src/components/forms/edit-transfer-form/edit-transfer-form.tsx:147` — gate the type field on `needsExpenseCategory(row.type, !!row.investmentId)`.
- Modify `src/components/forms/form-fields/line-items-field.tsx` — replace the two `showsExpenseCategory(...)` call sites with `needsExpenseCategory(...)` and drop the import.
- Tests: `transfer-constants.test.ts`, `transfer-schema.test.ts`, `validate-hook.test.ts`, new `map-line-item.test.ts`.

Phase 2 (remove "Korekty" line + reroute sheet)

- Modify `src/lib/map-category-costs.ts` — drop the "Korekty" field.
- Modify `src/components/investments/financial-stats.tsx` — remove `CORRECTION_LABEL` + its filters.
- Modify `src/lib/constants/transfers.ts` — remove CORRECTION from `SHEET_TRANSFER_TAB_TYPES`.
- Modify `src/lib/actions/sheets-sync.ts` — `EXPENSES_SYNC.typeWhere` ⊇ CORRECTION; `tabSyncForType('CORRECTION')` → expenses.
- Tests: `map-category-costs.test.ts`, `transfer-constants.test.ts`, `sheets-sync.test.ts`, `tab-rows.test.ts`.

---

# PHASE 1 — Enable + require expense type on corrections

### Task 1: make `needsExpenseCategory` investment-aware (CORRECTION optional-investment rule)

**Files:**

- Modify: `src/lib/constants/transfers.ts:152-153` (and `requiresInvestment` left untouched)
- Test: `src/__tests__/transfer-constants.test.ts:46-61`

**Interfaces:**

- Produces: `needsExpenseCategory(type, hasInvestment?)` — true for `INVESTMENT_EXPENSE` (any flag), true for `CORRECTION` only when `hasInvestment` is truthy, false otherwise. `requiresInvestment(type)` is **unchanged** — CORRECTION stays optional.

> The `hasInvestment` parameter is **optional** so existing `needsExpenseCategory(type)` callers keep compiling; they're updated to pass the flag in Tasks 2–4 / the edit form. `showsExpenseCategory` is left in place this task and removed in Task 4b once its call sites move over.

- [ ] **Step 1: Update the truth-table expectations (failing test)**

`requiresInvestment`'s `trueFor` stays as-is (no CORRECTION). Add a dedicated, parametrized block for the new `needsExpenseCategory` signature in `src/__tests__/transfer-constants.test.ts`:

```ts
describe('needsExpenseCategory — investment-aware', () => {
  it.each([
    ['INVESTMENT_EXPENSE', undefined, true],
    ['INVESTMENT_EXPENSE', false, true],
    ['CORRECTION', true, true],
    ['CORRECTION', false, false],
    ['CORRECTION', undefined, false],
    ['LOSS', true, false],
    ['OTHER', true, false],
  ] as const)('needsExpenseCategory(%s, %s) === %s', (type, hasInvestment, expected) => {
    expect(needsExpenseCategory(type, hasInvestment)).toBe(expected)
  })
})
```

If the existing truth-table block already lists `needsExpenseCategory` with a flat `trueFor`, drop that one entry (its single-arg form is now ambiguous) — this parametrized block supersedes it.

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm exec vitest run src/__tests__/transfer-constants.test.ts`
Expected: FAIL — `('CORRECTION', true)` expected `true`, got `false` (CORRECTION not yet handled).

- [ ] **Step 3: Implement**

In `src/lib/constants/transfers.ts`, make `needsExpenseCategory` investment-aware (this is the body that `showsExpenseCategory` used to carry). **Do not touch `REQUIRES_INVESTMENT_TYPES`.**

```ts
export const needsExpenseCategory = (type: string, hasInvestment?: boolean) =>
  isTransferType(type) &&
  (type === 'INVESTMENT_EXPENSE' || (type === 'CORRECTION' && !!hasInvestment))
```

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm exec vitest run src/__tests__/transfer-constants.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants/transfers.ts src/__tests__/transfer-constants.test.ts
git commit -m "feat(korekta): require expense type on corrections only when they have an investment"
```

---

### Task 2: `validateLineItemCategories` requires a type on CORRECTION line items

**Files:**

- Modify: `src/lib/schemas/transfer.ts:75-89`
- Test: `src/__tests__/transfer-schema.test.ts`

**Interfaces:**

- Consumes: `validateLineItemCategories(type, lineItems, ctx, hasInvestment?)`.
- Produces: emits an issue for an `INVESTMENT_EXPENSE` line item missing `expenseCategory` always, and for a `CORRECTION` line item missing it **only when `hasInvestment`**.

> The transfer-level `investment` is not on the line item, so `hasInvestment` must be threaded from the bulk schema's `superRefine` (`expense-schema.ts`) — pass `!!data.investment` at the call site.

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/transfer-schema.test.ts` (import `validateLineItemCategories` from `@/lib/schemas/transfer` if not already):

```ts
describe('validateLineItemCategories — CORRECTION (investment-conditional)', () => {
  const collect = () => {
    const issues: { path: (string | number)[] }[] = []
    const ctx = { addIssue: (i: { path: (string | number)[] }) => issues.push(i) } as never
    return { issues, ctx }
  }

  it('flags a CORRECTION line item with no type WHEN it has an investment', () => {
    const { issues, ctx } = collect()
    validateLineItemCategories('CORRECTION', [{ expenseCategory: undefined }], ctx, true)
    expect(issues).toHaveLength(1)
    expect(issues[0].path).toEqual(['lineItems', 0, 'expenseCategory'])
  })

  it('does NOT flag a CORRECTION line item with no type when it has no investment', () => {
    const { issues, ctx } = collect()
    validateLineItemCategories('CORRECTION', [{ expenseCategory: undefined }], ctx, false)
    expect(issues).toHaveLength(0)
  })

  it('passes a CORRECTION line item that has a type', () => {
    const { issues, ctx } = collect()
    validateLineItemCategories('CORRECTION', [{ expenseCategory: 5 }], ctx, true)
    expect(issues).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm exec vitest run src/__tests__/transfer-schema.test.ts`
Expected: FAIL — first test gets 0 issues (CORRECTION not yet validated).

- [ ] **Step 3: Implement**

In `src/lib/schemas/transfer.ts`, add the `hasInvestment` param and use the investment-aware `needsExpenseCategory`:

```ts
import { needsExpenseCategory } from '@/lib/constants/transfers'
// ...
export function validateLineItemCategories(
  type: string,
  lineItems: { category?: unknown; expenseCategory?: unknown }[],
  ctx: z.RefinementCtx,
  hasInvestment?: boolean,
) {
  lineItems.forEach((item, index) => {
    if (needsExpenseCategory(type, hasInvestment) && !item.expenseCategory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Typ wydatku inwestycyjnego jest wymagany',
        path: ['lineItems', index, 'expenseCategory'],
      })
    }
  })
}
```

Then update the call site in `src/components/forms/expense-form/expense-schema.ts` to pass `!!data.investment` as the fourth argument. (The single-transfer path uses `validateTransferFields`, not this helper, so no change there.)

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm exec vitest run src/__tests__/transfer-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/transfer.ts src/components/forms/expense-form/expense-schema.ts src/__tests__/transfer-schema.test.ts
git commit -m "feat(korekta): require expense type on correction line items only when investment present"
```

---

### Task 3: `validateTransfer` hook requires `expenseCategory` for CORRECTION

**Files:**

- Modify: `src/hooks/transfers/validate.ts:90-93`
- Test: `src/__tests__/validate-hook.test.ts`

**Interfaces:**

- Produces: hook throws `Expense category is required...` for a CORRECTION that **has an investment** but no `expenseCategory`; a CORRECTION with no investment passes.

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/validate-hook.test.ts` inside the `expenseCategory` describe block. CORRECTION needs a negative amount (`getAmountError`) and a sourceRegister; the investment flag is what toggles the type requirement:

```ts
it('CORRECTION with an investment but no expenseCategory → throws', () => {
  const data = { ...base, amount: -100, type: 'CORRECTION', sourceRegister: 1, investment: 1 }
  expect(() => validateTransfer(hookArgs(data))).toThrow(/[Ee]xpense category/)
})

it('CORRECTION with an investment + expenseCategory → passes', () => {
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

it('CORRECTION with NO investment and no expenseCategory → passes (type not required)', () => {
  const data = { ...base, amount: -100, type: 'CORRECTION', sourceRegister: 1 }
  expect(() => validateTransfer(hookArgs(data))).not.toThrow()
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm exec vitest run src/__tests__/validate-hook.test.ts`
Expected: FAIL — "CORRECTION with an investment but no expenseCategory" does not throw.

- [ ] **Step 3: Implement**

In `src/hooks/transfers/validate.ts`, replace the literal type check with the investment-aware helper. Add `needsExpenseCategory` to the existing import from `@/lib/constants/transfers`, then:

```ts
// expenseCategory — required for INVESTMENT_EXPENSE, and for CORRECTION once it has an investment
if (needsExpenseCategory(type, !!d.investment) && !d.expenseCategory) {
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

### Task 4: Extract + fix the line-item submit mapper — the create-drop bug (regression guard)

> **This is the reported bug** ("investment type was selected but it didn't show"). `expense-form.tsx:142-144` hard-gates `expenseCategory` to `type === 'INVESTMENT_EXPENSE'`, so a CORRECTION-with-investment silently drops the selected type on submit (persists NULL). The failing test below reproduces it before the fix — it stays as the regression guard for this path.

**Files:**

- Create: `src/components/forms/expense-form/map-line-item.ts`
- Modify: `src/components/forms/expense-form/expense-form.tsx:137-146`
- Test: `src/__tests__/map-line-item.test.ts`

**Interfaces:**

- Produces: `mapLineItem(item, type, hasInvestment?)` returning the server line-item shape `{ description, amount, invoiceNote?, category?, expenseCategory? }`, where `expenseCategory` is included whenever `needsExpenseCategory(type, hasInvestment)` (INVESTMENT_EXPENSE always; CORRECTION only with an investment).

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
  it('keeps expenseCategory for a CORRECTION line item WHEN it has an investment', () => {
    expect(mapLineItem(item, 'CORRECTION', true).expenseCategory).toBe(7)
  })

  it('drops expenseCategory for a CORRECTION line item with no investment', () => {
    expect(mapLineItem(item, 'CORRECTION', false).expenseCategory).toBeUndefined()
  })

  it('keeps expenseCategory for an INVESTMENT_EXPENSE line item (any investment flag)', () => {
    expect(mapLineItem(item, 'INVESTMENT_EXPENSE').expenseCategory).toBe(7)
  })

  it('drops expenseCategory for a type that does not use it (OTHER)', () => {
    expect(mapLineItem(item, 'OTHER', true).expenseCategory).toBeUndefined()
  })

  it('coerces amount to a number', () => {
    expect(mapLineItem(item, 'CORRECTION', true).amount).toBe(-1000)
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
 *  ("typ wydatku inwestycyjnego") rides only for types that use it — for a CORRECTION,
 *  only once the transfer has an investment. */
export function mapLineItem(
  item: FormLineItemT,
  type: TransferTypeT,
  hasInvestment?: boolean,
): PayloadLineItemT {
  return {
    description: item.description,
    amount: Number(item.amount),
    invoiceNote: item.invoiceNote || undefined,
    category: item.category ? Number(item.category) : undefined,
    expenseCategory:
      needsExpenseCategory(type, hasInvestment) && item.expenseCategory
        ? Number(item.expenseCategory)
        : undefined,
  }
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm exec vitest run src/__tests__/map-line-item.test.ts`
Expected: PASS.

- [ ] **Step 5: Use the mapper in the form**

In `src/components/forms/expense-form/expense-form.tsx`, replace the inline `lineItems: value.lineItems.map((item) => ({ ... }))` (lines ~137-146) with:

```ts
        lineItems: value.lineItems.map((item) => mapLineItem(item, type, !!value.investment)),
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

### Task 4b: Edit-form gate + retire `showsExpenseCategory`

> The original plan dismissed the edit form ("needs NO edit"). That reasoning relied on `needsExpenseCategory` flat-including CORRECTION, which it no longer does. The edit form must pass the investment flag, and the now-duplicate `showsExpenseCategory` predicate collapses into `needsExpenseCategory`.

**Files:**

- Modify: `src/components/forms/edit-transfer-form/edit-transfer-form.tsx:147`
- Modify: `src/components/forms/form-fields/line-items-field.tsx` (2 call sites, lines ~62 and ~79; drop the `showsExpenseCategory` import)
- Modify: `src/lib/constants/transfers.ts` (delete `showsExpenseCategory`)

**Interfaces:**

- Consumes: `needsExpenseCategory(type, hasInvestment?)` (Task 1).
- Produces: one predicate (`needsExpenseCategory`) drives every display + validation gate; `showsExpenseCategory` no longer exists.

- [ ] **Step 1: Move the call sites onto `needsExpenseCategory`**

In `src/components/forms/form-fields/line-items-field.tsx`:

- `getInlineCategory`: `if (needsExpenseCategory(type, hasInvestment)) { ... }`
- `getSecondRowCategory`: `if (needsExpenseCategory(type) && showsOtherCategory(type)) ...`
- Replace `showsExpenseCategory` in the import from `@/lib/constants/transfers` with `needsExpenseCategory`.

In `src/components/forms/edit-transfer-form/edit-transfer-form.tsx:147`, gate on the investment:

```tsx
{
  needsExpenseCategory(row.type, !!row.investmentId) && (
    <ExpenseCategoryField form={form} expenseCategories={referenceData.expenseCategories} />
  )
}
```

(The import at line 12 is already `needsExpenseCategory` — no import change.)

- [ ] **Step 2: Delete `showsExpenseCategory`**

In `src/lib/constants/transfers.ts`, remove the `showsExpenseCategory` export now that nothing references it.

- [ ] **Step 3: Typecheck + full suite (gate on typecheck, not grep — it catches any missed reference)**

Run: `pnpm exec tsc --noEmit && pnpm exec vitest run`
Expected: no type errors (no dangling `showsExpenseCategory`); all green. If tsc flags a remaining reference, fix it before continuing.

- [ ] **Step 4: Manual check — the bug is gone**

With the dev server, create a CORRECTION with an investment + a type → it appears with its type in the investment's transfers table. Open an existing such correction via "edytuj transakcję" → the type field shows and is editable. A CORRECTION with no investment shows no type field.

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants/transfers.ts src/components/forms/form-fields/line-items-field.tsx src/components/forms/edit-transfer-form/edit-transfer-form.tsx
git commit -m "fix(korekta): show/edit the type on corrections with an investment; drop showsExpenseCategory"
```

---

### Task 5 (manual, no code): Phase 1 deploy + in-app backfill — ✅ DONE (2026-06-18)

- [x] Deploy Phase 1 (human pushes). The "Korekty" line still exists, so balances are unchanged.
- [x] Backfill only the corrections that **have an investment** but no type: open each via "edytuj transakcję", set its "Typ wydatku inwestycyjnego", save. Leave corrections with no investment untouched — they are valid and carry no type (owner decision). Enumerate the affected set (investment set, `expenseCategory` NULL) against **fresh prod data** (pull a current dump via the `restore-prod-backup-local` skill); the local snapshot's count is stale.
- [x] Verify: each backfilled correction now shows its type in the transfers table and folds into its expense type on the investment page (still also visible in the "Korekty" line at this point — that is expected until Phase 2).

> Do NOT start Phase 2 until the backfill is complete — removing the "Korekty" line before backfill makes untyped corrections vanish from the balance.

---

# PHASE 2 — Remove the "Korekty" line + reroute the sheet

### Task 6: Remove the "Korekty" field from the financial breakdown — ✅ DONE (commit `4e457c9`)

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

### Task 7: Remove `CORRECTION_LABEL` from FinancialStats — ✅ DONE (commit `f7aba3f`)

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

### Task 8: Route corrections to the kosztorys "Wydatki" tab (not "Transfery") — ✅ DONE (commit `3621de6`)

> **Two follow-ups beyond the original plan** (both committed):
>
> - **Sync gate:** `SHEET_SYNCED_TYPES` in `src/hooks/transfers/sync-sheet.ts` was built from `SHEET_TRANSFER_TAB_TYPES`; removing CORRECTION from that list would have made a correction edit/delete sync to **no** tab. Added CORRECTION back to the gate explicitly.
> - **Frozen summary column:** `SHEET_TRANSFER_TAB_TYPES` also fed the transfers-tab SUMIF summary layout via `transferSummaryKeys()`, so a tab rebuild (reset/relink) would have **shrunk the summary and shifted Strata into Korekta's column** — breaking kosztorys formulas keyed to a fixed position across many client sheets. Decoupled layout from routing: a fixed `TRANSFERS_SUMMARY_TYPES` keeps the 5th slot, relabelled `Korekta → wydatki inwest.` (its SUMIF totals 0). Guarded by a column-position test in `sheets.test.ts`; rule recorded in `context/foundation/lessons.md`.

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

**Spec coverage:** Area 1 (form mapper) → Task 4 (the create-drop bug). Area 2 (edit form) → Task 4b (gate on `needsExpenseCategory(row.type, !!row.investmentId)`). Area 3 (validation) → Tasks 1–3 (all investment-conditional). Area 4 (remove Korekty line) → Tasks 6–7. Area 5 (sheets) → Task 8. Data backfill + rollout phases → Tasks 5 and 9. Complete-removal-of-corrections-sum → Task 6 (no `'Korekty'` field) + Task 7 (no label). No gaps.

**Owner rule:** Investment optional on CORRECTION (`requiresInvestment` untouched); type required only when an investment is attached. Enforced consistently — `needsExpenseCategory(type, hasInvestment)` is the single predicate behind create display (`line-items-field`), edit display (Task 4b), the mapper (Task 4), the Zod line-item check (Task 2), and the hook (Task 3). `showsExpenseCategory` is retired in Task 4b.

**Placeholder scan:** Step 5/6 of Task 8 reference existing mock-heavy test blocks by line and describe the exact assertion change rather than re-pasting ~60-line googleapis mock setups; the new `expenseRow` cases are spelled out in full. All other steps carry complete code.

**Type consistency:** `needsExpenseCategory(type, hasInvestment?)` (Task 1) is reused by Tasks 2, 3, 4, 4b and both forms — one definition, no drift. The optional `hasInvestment` keeps single-arg INVESTMENT_EXPENSE callers compiling. `mapLineItem(item, type, hasInvestment?)` signature is stable across Task 4. `EXPENSES_SYNC` / `tabSyncForType` names match `sheets-sync.ts`.
