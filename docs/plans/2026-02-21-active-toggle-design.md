# Active Status Toggle in Tables — Design

## Overview

Add inline active/inactive toggle badges to the users, cash registers, and investments tables. Clicking the badge flips the `active` field (or `status` for investments) via a server action with optimistic UI updates.

## Component: ActiveToggleBadge

Extract the existing inline status badge from the investments column into a reusable clickable component.

**Props:**

- `isActive: boolean` — current state
- `onToggle: (id: number, newValue: boolean) => Promise<ActionResultT>` — server action
- `id: number` — row entity ID
- `activeLabel: string` — e.g. "Aktywna", "Aktywny"
- `inactiveLabel: string` — e.g. "Nieaktywna", "Nieaktywny", "Zakończona"

**Behavior:**

- Shows green outlined badge when active, muted badge when inactive
- On click: optimistically flips state, calls `onToggle`
- On failure: rolls back to previous state, shows error toast
- Prevents double-click during pending action

## Server Actions

Three new server actions, all following the same pattern:

### `toggleUserActive(id: number, active: boolean)`

- Collection: `users`
- Field: `active` (boolean)
- Revalidates: `CACHE_TAGS.users`

### `toggleCashRegisterActive(id: number, active: boolean)`

- Collection: `cash-registers`
- Field: `active` (boolean)
- Revalidates: `CACHE_TAGS.cashRegisters`

### `toggleInvestmentStatus(id: number, status: 'active' | 'completed')`

- Collection: `investments`
- Field: `status` (select)
- Revalidates: `CACHE_TAGS.investments`

### Permissions

All three actions: ADMIN, OWNER, MANAGER can toggle.

### Return type

```typescript
type ActionResultT = { error: boolean; message: string }
```

## Column Changes

### Users table (`src/lib/tables/users.tsx`)

- Add `active` column with `ActiveToggleBadge`
- Labels: "Aktywny" / "Nieaktywny"

### Cash registers table (`src/lib/tables/cash-registers.tsx`)

- Add `active` column with `ActiveToggleBadge`
- Labels: "Aktywna" / "Nieaktywna"

### Investments table (`src/lib/tables/investments.tsx`)

- Replace inline status badge JSX with `ActiveToggleBadge`
- Labels: "Aktywna" / "Zakończona"
- Maps `status === 'active'` to `isActive: true`

## Revalidation

Each toggle action revalidates the collection-level cache tag. No entity-level tags needed — the dataset is small, refetching the list is cheap.

## Files Affected

- Create: `src/components/ui/active-toggle-badge.tsx`
- Create: `src/lib/actions/toggle-active.ts` (all 3 actions in one file)
- Modify: `src/lib/tables/users.tsx` — add active column
- Modify: `src/lib/tables/cash-registers.tsx` — add active column
- Modify: `src/lib/tables/investments.tsx` — replace inline badge with component
