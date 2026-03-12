# Cash Register Balance Pie Chart

## Goal

Replace the stat card section on the dashboard with a pie chart showing cash register balances by type, integrated into the cash registers section. The chart reacts to the existing cash register filters (type, owner, active).

## Current State

- `DashboardStats` (client component) — toggleable stat cards above tables, showing grouped register balances
- `CashRegistersTable` inside `DashboardTables` — has type/owner/active filters via `useClientMultiFilter`
- Filters and chart are currently separate: stat cards live above, table lives below

## Design

### What changes

1. **Remove `DashboardStats`** component entirely (the toggleable stat cards)
2. **Add a pie chart inside the cash registers `CollapsibleSection`**, above the table
3. The pie chart segments = register types (Glowna, Pomocnicza, Wirtualna, Pracownicza)
4. Each segment value = sum of balances for that type
5. **Chart reacts to the same filters** the table uses (type, owner, active) — when you filter the table, the chart updates too
6. Legend is inline with the chart (not separate cards)
7. "Suma" total displayed in the center or next to the chart

### Filter integration

The key architectural change: the cash registers table filters already exist inside `CashRegistersTable`. The pie chart lives inside the same component and consumes the same filtered data — no state lifting needed.

```
CashRegistersTable (existing, already holds filter state)
  ├── Toolbar (type filter, owner filter, active filter, search, column toggle)
  ├── PieChart (grouped by type from filtered data — same `filteredData` the table uses)
  └── DataTable (same filtered data)
```

The chart is computed from the already-filtered `filteredData` array inside `CashRegistersTable`, grouped by `cr.type`.

### Chart library

Use `recharts` (already popular with Next.js/React ecosystem) or a lightweight alternative. Check if already in `package.json` first. If not, `recharts` is the simplest option — it has `PieChart`, `Pie`, `Cell`, `Legend`, `Tooltip` out of the box.

### Files to change

- **Delete:** `src/components/dashboard/dashboard-stats.tsx`
- **Create:** `src/components/dashboard/register-balance-chart.tsx` — pie chart component
- **Modify:** `src/components/dashboard/dashboard-tables.tsx` — lift filter state, add chart above table
- **Modify:** `src/components/dashboard/manager-dashboard.tsx` — remove `DashboardStats` usage, remove `registerGroups` computation
- **Modify:** `src/lib/queries/dashboard.ts` — remove unused return fields (`totalBalance` etc. if no longer needed)

### Pie chart spec

- Segments: one per register type present in filtered data
- Colors: consistent per type (e.g., MAIN=blue, AUXILIARY=green, VIRTUAL=gray, WORKER=orange)
- Legend: inline, showing type label + formatted PLN amount
- Center label: total sum of visible segments
- Responsive: reasonable size on mobile, doesn't dominate the section
- Negative balances: show absolute value with a visual indicator (e.g., red segment or label prefix)

### Edge cases

- All registers filtered out → show empty state
- Single type remaining → full circle with that type
- Negative total → display clearly, don't break chart
- Manager role sees fewer register types (no MAIN) → chart only shows what's in `visibleRegisters`
