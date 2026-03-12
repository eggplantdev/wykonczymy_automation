# Toggle Stat Buttons Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify two financial stat display patterns (`RegisterBalanceChart` buttons and `InvestmentStats` cards) into a single shared `ToggleStatButtons` component.

**Architecture:** Extract the toggle-button rendering pattern from `RegisterBalanceChart` into a reusable `ToggleStatButtons` component. Then refactor both `RegisterBalanceChart` (dashboard) and `InvestmentStats` (investments/reports) to use it. Delete `StatCard` entirely.

**Tech Stack:** React, TypeScript, Zustand (existing store), Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-03-12-toggle-stat-buttons-design.md`

---

## File Structure

| File                                                  | Action       | Responsibility                                                                           |
| ----------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| `src/components/ui/toggle-stat-buttons.tsx`           | **Create**   | Shared toggle button row + summary line                                                  |
| `src/__tests__/toggle-stat-buttons.test.ts`           | **Create**   | Unit tests for toggle logic and summary calculation                                      |
| `src/components/dashboard/register-balance-chart.tsx` | **Refactor** | Thin wrapper: groups registers → `StatEntryT[]` → `ToggleStatButtons`                    |
| `src/components/investments/financial-stats.tsx`      | **Create**   | Replaces `InvestmentStats`: maps `HeaderFieldT[]` → `StatEntryT[]` → `ToggleStatButtons` |
| `src/app/(frontend)/inwestycje/[id]/page.tsx`         | **Update**   | Import `FinancialStats` instead of `InvestmentStats`                                     |
| `src/app/(frontend)/raporty/page.tsx`                 | **Update**   | Import `FinancialStats` instead of `InvestmentStats`                                     |
| `src/app/(frontend)/kasa/[id]/page.tsx`               | **Update**   | Replace `StatCard` with `Description` for saldo                                          |
| `src/components/investments/investment-stats.tsx`     | **Delete**   | Replaced by `financial-stats.tsx`                                                        |
| `src/components/ui/stat-card.tsx`                     | **Delete**   | No longer used                                                                           |

---

## Chunk 1: ToggleStatButtons Component (TDD)

### Task 1: Write failing tests for ToggleStatButtons logic

**Files:**

- Create: `src/__tests__/toggle-stat-buttons.test.ts`

The component is a `'use client'` React component, but its core logic (summary calculation, toggle state) can be tested as pure functions if we extract them, or via render tests. Since this project uses Vitest without jsdom for most tests, we'll test the pure logic: `computeSummary` and `valueColor`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { computeSummary, valueColor } from '@/components/ui/toggle-stat-buttons'

describe('valueColor', () => {
  it('returns green for positive values', () => {
    expect(valueColor(100)).toBe('var(--color-chart-green)')
  })

  it('returns green for zero', () => {
    expect(valueColor(0)).toBe('var(--color-chart-green)')
  })

  it('returns destructive for negative values', () => {
    expect(valueColor(-50)).toBe('var(--color-destructive)')
  })
})

describe('computeSummary', () => {
  const entries = [
    { label: 'A', value: '100 zł', amount: 100, borderColor: 'blue' },
    { label: 'B', value: '-50 zł', amount: -50, borderColor: 'red' },
    { label: 'C', value: '200 zł', amount: 200, borderColor: 'green' },
  ] as const

  it('sums all amounts when nothing is hidden', () => {
    const hidden = new Set<string>()
    expect(computeSummary(entries, hidden)).toBe(250)
  })

  it('excludes hidden entries from sum', () => {
    const hidden = new Set(['B'])
    expect(computeSummary(entries, hidden)).toBe(300)
  })

  it('returns 0 when all entries are hidden', () => {
    const hidden = new Set(['A', 'B', 'C'])
    expect(computeSummary(entries, hidden)).toBe(0)
  })

  it('returns 0 for empty entries', () => {
    expect(computeSummary([], new Set())).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/__tests__/toggle-stat-buttons.test.ts`
Expected: FAIL — module `@/components/ui/toggle-stat-buttons` does not exist yet.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/toggle-stat-buttons.test.ts
git commit -m "test: add failing tests for ToggleStatButtons logic"
```

### Task 2: Implement ToggleStatButtons component

**Files:**

- Create: `src/components/ui/toggle-stat-buttons.tsx`

- [ ] **Step 1: Create the component with exported pure functions**

```tsx
'use client'

import { useState } from 'react'
import { formatPLN } from '@/lib/format-currency'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'

type StatEntryT = {
  readonly label: string
  readonly value: string
  readonly amount: number
  readonly borderColor: string
}

type ToggleStatButtonsPropsT = {
  readonly entries: readonly StatEntryT[]
  readonly summaryLabel: string
  readonly helpText?: string
  readonly onToggle?: (label: string) => void
}

export function valueColor(value: number): string {
  return value >= 0 ? 'var(--color-chart-green)' : 'var(--color-destructive)'
}

export function computeSummary(
  entries: readonly StatEntryT[],
  hidden: ReadonlySet<string>,
): number {
  return entries.filter((e) => !hidden.has(e.label)).reduce((sum, e) => sum + e.amount, 0)
}

export function ToggleStatButtons({
  entries,
  summaryLabel,
  helpText,
  onToggle,
}: ToggleStatButtonsPropsT) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  function toggle(label: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
    onToggle?.(label)
  }

  const total = computeSummary(entries, hidden)

  if (entries.length === 0) return null

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {entries.map((entry) => {
          const isHidden = hidden.has(entry.label)
          return (
            <Button
              variant="outline"
              key={entry.label}
              onClick={() => toggle(entry.label)}
              className={cn('border-2', isHidden && 'opacity-40')}
              style={{ borderColor: entry.borderColor }}
              aria-pressed={!isHidden}
              aria-label={`${isHidden ? 'Pokaż' : 'Ukryj'} ${entry.label}`}
            >
              <span className="text-muted-foreground">{entry.label}:</span>
              <span className="font-medium" style={{ color: valueColor(entry.amount) }}>
                {entry.value}
              </span>
            </Button>
          )
        })}
      </div>

      {helpText && <Description>{helpText}</Description>}

      <Description>
        <span>{summaryLabel}: </span>
        <span className={cn('font-semibold', total >= 0 ? 'text-chart-green' : 'text-destructive')}>
          {formatPLN(total)}
        </span>
      </Description>
    </div>
  )
}

export type { StatEntryT, ToggleStatButtonsPropsT }
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test -- src/__tests__/toggle-stat-buttons.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/toggle-stat-buttons.tsx
git commit -m "feat: add ToggleStatButtons shared component"
```

---

## Chunk 2: Refactor RegisterBalanceChart

### Task 3: Refactor RegisterBalanceChart to use ToggleStatButtons

**Files:**

- Modify: `src/components/dashboard/register-balance-chart.tsx`

The current component (82 lines) has its own toggle state, grouping logic, and rendering. After refactoring, it keeps only the grouping logic (registers → `StatEntryT[]`) and delegates rendering to `ToggleStatButtons`.

- [ ] **Step 1: Rewrite the component**

No `'use client'` needed — grouping is pure data transformation. `ToggleStatButtons` already has its own client boundary.

```tsx
import { REGISTER_TYPE_BORDER_COLORS, REGISTER_TYPE_LABELS } from '@/lib/tables/cash-registers'
import { formatPLN } from '@/lib/format-currency'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'
import type { CashRegisterTypeT } from '@/types/reference-data'

type RegisterBalanceChartPropsT = {
  readonly data: readonly CashRegisterRowT[]
}

export function RegisterBalanceChart({ data }: RegisterBalanceChartPropsT) {
  const groups = new Map<CashRegisterTypeT, { balance: number; count: number }>()
  for (const cr of data) {
    const prev = groups.get(cr.type) ?? { balance: 0, count: 0 }
    groups.set(cr.type, { balance: prev.balance + cr.balance, count: prev.count + 1 })
  }

  const entries: StatEntryT[] = Array.from(groups.entries()).map(([type, { balance, count }]) => ({
    label: `${REGISTER_TYPE_LABELS[type]} (${count})`,
    value: formatPLN(balance),
    amount: balance,
    borderColor: REGISTER_TYPE_BORDER_COLORS[type],
  }))

  return (
    <ToggleStatButtons
      entries={entries}
      summaryLabel="Saldo"
      helpText="Naciśnij wybraną kategorię lub wybierz filtry aby zaktualizować saldo."
    />
  )
}
```

Uses `REGISTER_TYPE_LABELS` (same as current code) to preserve existing behavior.

- [ ] **Step 2: Verify manually**

Run: `pnpm dev` and check `/` dashboard. The register balance buttons should look and behave identically — colored borders, toggle opacity, saldo updates.

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (no tests directly cover this component, but no imports should break).

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/register-balance-chart.tsx
git commit -m "refactor: RegisterBalanceChart uses ToggleStatButtons"
```

---

## Chunk 3: Replace InvestmentStats with FinancialStats

### Task 4: Create FinancialStats component

**Files:**

- Create: `src/components/investments/financial-stats.tsx`

Maps `HeaderFieldT[]` → `StatEntryT[]` with fixed colors for known fields and palette cycling for dynamic expense categories. Passes `useHeaderFieldsStore.toggle` as `onToggle` to keep the export feature working.

**Dual visibility state note:** `ToggleStatButtons` owns its own `Set<string>` for rendering, while the Zustand store tracks visibility for export/print. They stay in sync via `onToggle`. This works because the component mounts fresh on navigation and the store resets with empty `{}`. If this assumption changes, the component should accept initial hidden state as a prop.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useHeaderFieldsStore } from '@/stores/header-fields-store'
import { BILANS_LABEL } from '@/lib/export/header-fields'
import { formatPLN } from '@/lib/format-currency'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { HeaderFieldT } from '@/types/export'

const FIXED_FIELD_COLORS: Record<string, string> = {
  'Koszty robocizny': 'var(--color-chart-orange)',
  'Wpłaty od inwestora': 'var(--color-chart-green)',
}

const CATEGORY_PALETTE = [
  'var(--color-chart-blue)',
  'var(--color-chart-teal)',
  'var(--color-chart-purple)',
]

type FinancialStatsPropsT = {
  readonly fields: readonly HeaderFieldT[]
}

export function FinancialStats({ fields }: FinancialStatsPropsT) {
  const toggle = useHeaderFieldsStore((s) => s.toggle)

  const displayFields = fields.filter((f) => f.label !== BILANS_LABEL)

  // Palette index only increments for fields without fixed colors,
  // so dynamic categories get consecutive palette slots.
  let paletteIndex = 0
  const entries: StatEntryT[] = displayFields.map((field) => {
    const borderColor =
      FIXED_FIELD_COLORS[field.label] ?? CATEGORY_PALETTE[paletteIndex++ % CATEGORY_PALETTE.length]

    return {
      label: field.label,
      value: field.value,
      amount: field.amount ?? 0,
      borderColor,
    }
  })

  return <ToggleStatButtons entries={entries} summaryLabel="Bilans" onToggle={toggle} />
}
```

**Important:** The `ToggleStatButtons` internal summary and `calculateBilans()` produce identical results because both sum `amount` for visible non-Bilans fields. The `onToggle` callback keeps the Zustand store in sync so `PrintButton` export still works.

- [ ] **Step 2: Commit**

```bash
git add src/components/investments/financial-stats.tsx
git commit -m "feat: add FinancialStats component (replaces InvestmentStats)"
```

### Task 5: Update consumer pages to use FinancialStats

**Files:**

- Modify: `src/app/(frontend)/inwestycje/[id]/page.tsx:20,79-81`
- Modify: `src/app/(frontend)/raporty/page.tsx:19,51-53`

- [ ] **Step 1: Update investment detail page**

In `src/app/(frontend)/inwestycje/[id]/page.tsx`:

- Replace import: `InvestmentStats` → `FinancialStats` from `@/components/investments/financial-stats`
- Replace usage: `<InvestmentStats` → `<FinancialStats`

- [ ] **Step 2: Update reports page**

In `src/app/(frontend)/raporty/page.tsx`:

- Replace import: `InvestmentStats` → `FinancialStats` from `@/components/investments/financial-stats`
- Replace usage: `<InvestmentStats` → `<FinancialStats`

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 4: Verify manually**

Run: `pnpm dev` and check:

- `/inwestycje/[id]` — financial stats render as colored toggle buttons, bilans computes correctly, toggling works, export/print still functions
- `/raporty` — same checks

- [ ] **Step 5: Commit**

```bash
git add src/app/\(frontend\)/inwestycje/\[id\]/page.tsx src/app/\(frontend\)/raporty/page.tsx
git commit -m "refactor: switch investment and reports pages to FinancialStats"
```

---

## Chunk 4: Update /kasa/[id] and Cleanup

### Task 6: Replace StatCard with Description on /kasa/[id]

**Files:**

- Modify: `src/app/(frontend)/kasa/[id]/page.tsx:13,70`

- [ ] **Step 1: Update the page**

In `src/app/(frontend)/kasa/[id]/page.tsx`:

- Remove import: `import { StatCard } from '@/components/ui/stat-card'`
- Add import: `import { Description } from '@/components/ui/description'`
- Replace line 70:

Before:

```tsx
<StatCard label="Saldo" value={formatPLN(saldo)} className="w-fit" />
```

After:

```tsx
<Description>
  Saldo:{' '}
  <span className={cn('font-semibold', saldo >= 0 ? 'text-chart-green' : 'text-destructive')}>
    {formatPLN(saldo)}
  </span>
</Description>
```

- Add `import { cn } from '@/lib/cn'` if not already imported.

- [ ] **Step 2: Verify manually**

Run: `pnpm dev` and check `/kasa/[id]` — saldo shows as inline text with green/red coloring.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(frontend\)/kasa/\[id\]/page.tsx
git commit -m "refactor: replace StatCard with Description on register detail page"
```

### Task 7: Delete dead files

**Files:**

- Delete: `src/components/investments/investment-stats.tsx`
- Delete: `src/components/ui/stat-card.tsx`

- [ ] **Step 1: Verify no other imports exist**

Run:

```bash
grep -r "investment-stats" src/ --include="*.tsx" --include="*.ts"
grep -r "stat-card" src/ --include="*.tsx" --include="*.ts"
```

Expected: No results (all consumers already updated).

- [ ] **Step 2: Delete the files**

```bash
rm src/components/investments/investment-stats.tsx
rm src/components/ui/stat-card.tsx
```

- [ ] **Step 3: Run typecheck and tests**

Run: `pnpm typecheck && pnpm test`
Expected: Both pass with zero errors.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "chore: delete InvestmentStats and StatCard (replaced by ToggleStatButtons)"
```
