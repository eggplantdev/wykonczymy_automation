# Toggle Stat Buttons — Unified Financial Stat Display

## Problem

The app has two different visual treatments for the same pattern (toggleable financial summaries with a computed total):

1. **Cash register dashboard** (`RegisterBalanceChart`) — compact `Button variant="outline"` with colored borders, green/red values, toggle visibility, "Saldo" summary below
2. **Investment detail + Reports** (`InvestmentStats`) — large `StatCard` blocks in a grid, monochrome, toggle via opacity, "Bilans" computed from visible fields

The goal is to unify both under the `RegisterBalanceChart` visual style via a shared component.

## Design Decisions

- **Pure visual reskin** — no changes to data fetching, toggle logic semantics, bilans calculation, or export feature
- **Bilans/Saldo becomes a summary line** below the buttons (not a button itself), matching the dashboard pattern
- **Colors:** fixed color map for known fields + auto-cycling palette for dynamic expense categories
- **`StatCard` deleted entirely** — `/kasa/[id]` gets a simple `Description` for Saldo (full income/expense breakdown deferred to follow-up)
- **Pattern:** Strategy — `ToggleStatButtons` owns rendering, consumers provide data mapping

## New Component: `ToggleStatButtons`

**File:** `src/components/ui/toggle-stat-buttons.tsx`

A `'use client'` component that renders:

1. A `flex-wrap` row of `Button variant="outline"` with colored borders
2. Each button: label + formatted value (green if >= 0, red if negative)
3. Click toggles visibility (opacity-40 when hidden)
4. A `Description` summary line below showing computed total from visible entries

### Props

```ts
type StatEntryT = {
  readonly label: string
  readonly value: string // formatted display value
  readonly amount: number // raw number for sum calculation
  readonly borderColor: string // CSS color for border
}

type ToggleStatButtonsPropsT = {
  readonly entries: readonly StatEntryT[]
  readonly summaryLabel: string // e.g. "Saldo" or "Bilans"
  readonly helpText?: string // optional instruction text below buttons
  readonly onToggle?: (label: string) => void // called on each toggle, consumers sync external state
}
```

Toggle state is internal (`useState<Set<string>>`) keyed by `label`. Labels must be unique within an entries array. The `onToggle` callback fires with the toggled label, letting consumers sync external state (e.g. `FinancialStats` passes `useHeaderFieldsStore.toggle` directly).

### Accessibility

Each button must include `aria-pressed={isVisible}` and `aria-label` with show/hide intent (e.g. `"Ukryj Koszty robocizny"` / `"Pokaż Koszty robocizny"`), carried over from the current `InvestmentStats` implementation.

### Value coloring

```ts
function valueColor(value: number): string {
  return value >= 0 ? 'var(--color-chart-green)' : 'var(--color-destructive)'
}
```

Reused from existing `RegisterBalanceChart` logic.

## Refactored: `RegisterBalanceChart`

**File:** `src/components/dashboard/register-balance-chart.tsx`

Becomes a thin wrapper:

1. Groups `CashRegisterRowT[]` by type (existing logic)
2. Maps each group → `StatEntryT` with `REGISTER_TYPE_BORDER_COLORS[type]`. The register count per type is baked into the label string (e.g. `"Główne (3)"`).
3. Renders `<ToggleStatButtons entries={...} summaryLabel="Saldo" helpText="Naciśnij wybraną kategorię lub wybierz filtry aby zaktualizować saldo." />`

No behavior change.

## New: `FinancialStats` (replaces `InvestmentStats`)

**File:** `src/components/investments/financial-stats.tsx`

Replaces `src/components/investments/investment-stats.tsx`.

1. Receives `fields: readonly HeaderFieldT[]` (same prop as before)
2. Filters out `BILANS_LABEL` field — Bilans becomes the summary line
3. Maps remaining fields → `StatEntryT` with colors:

```ts
const FIXED_FIELD_COLORS: Record<string, string> = {
  'Koszty robocizny': 'var(--color-chart-orange)',
  'Wpłaty od inwestora': 'var(--color-chart-green)',
}

const CATEGORY_PALETTE = [
  'var(--color-chart-blue)',
  'var(--color-chart-teal)',
  'var(--color-chart-purple)',
  // cycles for additional categories
]
```

4. Renders `<ToggleStatButtons entries={...} summaryLabel="Bilans" onToggle={toggle} />`
5. Passes `useHeaderFieldsStore.toggle` directly as `onToggle` (export feature preserved — `PrintButton` still reads from the same store via `calculateBilans`)

**Palette cycling:** dynamic categories use `CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]` where `index` is the category's position in the fields array.

## `/kasa/[id]` Change

Replace `<StatCard label="Saldo" value={formatPLN(saldo)} className="w-fit" />` with a `Description` showing Saldo inline. Full income/expense breakdown is a separate follow-up task.

Note: the `headerFields` array passed to `TransfersSection` for the print/export feature is left untouched.

## Files Changed

| File                                                  | Action                                               |
| ----------------------------------------------------- | ---------------------------------------------------- |
| `src/components/ui/toggle-stat-buttons.tsx`           | **New** — shared component                           |
| `src/components/ui/stat-card.tsx`                     | **Delete**                                           |
| `src/components/dashboard/register-balance-chart.tsx` | **Refactor** — thin wrapper over `ToggleStatButtons` |
| `src/components/investments/investment-stats.tsx`     | **Delete** — replaced by `financial-stats.tsx`       |
| `src/components/investments/financial-stats.tsx`      | **New** — renamed + restyled replacement             |
| `src/app/(frontend)/kasa/[id]/page.tsx`               | **Update** — replace `StatCard` with `Description`   |
| `src/app/(frontend)/inwestycje/[id]/page.tsx`         | **Update** — import `FinancialStats`                 |
| `src/app/(frontend)/raporty/page.tsx`                 | **Update** — import `FinancialStats`                 |

## Equivalence Note

The `ToggleStatButtons` internal sum (visible entries reduced by `amount`) must produce the same result as `calculateBilans()` in `src/lib/export/header-fields.ts`, which `PrintButton` uses via the Zustand store. This is guaranteed because both sum `amount` for visible non-Bilans fields. The `onToggle` callback keeps the store in sync so both paths see the same visibility state.

## Out of Scope

- Data fetching changes
- `/kasa/[id]` income/expense breakdown (follow-up)
- Changing the Zustand store or export logic
- Color scheme iteration (can be adjusted after implementation)
