# Users Frontend Pages — Design Spec

**Date:** 2026-04-11
**Status:** Approved

## Goal

Add frontend visibility for the users collection: a list page, an individual detail page, a sidebar nav link, and removal of the auto-create WORKER register hook. All built from existing components — no new UI primitives.

## Scope

### Phase 1 (this spec)

1. **Users list page** at `/pracownicy`
2. **User detail page** at `/pracownicy/[id]`
3. **Sidebar nav link** for "Pracownicy"
4. **Hook removal** — delete `autoCreateWorkerRegister` and related admin description

### Phase 2 (deferred)

- User balance calculation (SUM of PAYOUT transfers where `worker = userId`)
- Verifying/fixing `worker` field population on PAYOUT transfers
- UI for creating user-linked transfers

## Routes

| Route              | Purpose                | Access                |
| ------------------ | ---------------------- | --------------------- |
| `/pracownicy`      | Users list table       | ADMIN, OWNER, MANAGER |
| `/pracownicy/[id]` | Individual user detail | ADMIN, OWNER, MANAGER |

## Users List Page (`/pracownicy`)

### Data Fetching

- Server component using `getPayload({ config })` to fetch users
- Cached with `unstable_cache` and `CACHE_TAGS.users`

### Table Columns

| Column           | Source                     | Notes                               |
| ---------------- | -------------------------- | ----------------------------------- |
| Name             | `user.name`                | Primary column                      |
| Role             | `user.role`                | Badge with `ROLE_LABELS`            |
| Email            | `user.email`               |                                     |
| Active           | `user.active`              | Status indicator                    |
| Default Register | `user.defaultCashRegister` | Register name or empty              |
| Balance          | —                          | Hidden in phase 1, added in phase 2 |

### Features (existing components)

- `DataTable` — main table
- `SearchFilterInput` — search by name, email
- `ActiveFilterButton` — filter active/inactive
- `ColumnToggle` — column visibility with localStorage
- Row click → `/pracownicy/[id]`

## User Detail Page (`/pracownicy/[id]`)

### Layout (follows investment detail pattern)

1. `PageWrapper` — user name as title, back link to `/pracownicy`
2. `InfoList` — role, email, active status, default cash register
3. `SaldoDisplay` — balance display (hardcoded 0 for phase 1)
4. `TransfersSection` — transfers filtered by `worker = userId`

### Data Fetching

- Fetch user by ID via Payload
- Fetch transfers where `worker = userId` via existing `TransfersSection` server component

## Navigation

- Add "Pracownicy" to sidebar after "Inwestycje", before "Raporty"
- Handled like Raporty: standalone link (not a dashboard hash link), role-gated
- Visible to ADMIN, OWNER, MANAGER
- Icon: `Users` from lucide-react

## Hook Removal

### Delete

- `autoCreateWorkerRegister` function in `src/collections/users.ts`
- Its entry in the `afterChange` hooks array
- Admin description on `defaultCashRegister` field: "Jeśli tworzysz pracownika i nie wybierzesz domyślnej kasy, zostanie ona utworzona automatycznie."

### Keep

- `defaultCashRegister` relationship field (manual assignment still useful)
- `makeRevalidateAfterChange('users')` hook
- `makeRevalidateAfterDelete('users')` hook
- All access control unchanged

## Component Reuse

No new components. Everything from existing:

- **List:** `DataTable`, `SearchFilterInput`, `ActiveFilterButton`, `ColumnToggle`
- **Detail:** `PageWrapper`, `InfoList`, `SaldoDisplay`, `TransfersSection`
- **Data:** `fetchReferenceData`, `unstable_cache`, `requireAuth`
- **Actions:** `protectedAction` pattern if needed

## User Balance (Phase 2 — NOT this spec)

When implemented, balance will be: `SUM(amount) FROM transactions WHERE type = 'PAYOUT' AND worker = userId AND cancelled IS NOT TRUE`. Derived from transfers, not stored on the user document. No cash register involvement.
