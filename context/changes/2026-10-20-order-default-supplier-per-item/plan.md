# One Default Supplier per Order Item — Implementation Plan

## Overview

Big bags and containers come from separate companies. The order-settings global stores one
`defaultSupplierId`, so ordering a kontener preselects the big bag company. Replace it with one
default per item kind (`bigBag`, `container`) over the same shared supplier list.

## Current State Analysis

- `src/globals/order-settings.ts` — one `defaultSupplierId` text field (a `suppliers` row id), next to
  flat `bigBagPrice` / `containerPrice`.
- `src/lib/constants/orders.ts` — `ORDER_ITEMS` maps each kind to its `label` and `priceKey`; the pick
  step reads `orderSettings[ORDER_ITEMS[kind].priceKey]`.
- `src/lib/actions/order-settings.ts` — `saveOrderSettingsAction` (ADMIN/OWNER) re-sends the default and
  nulls it when its row is gone; `setDefaultSupplierAction(supplierId)` (management) sets it.
- `src/components/orders/order-pick-step.tsx` — supplier select seeded from `defaultSupplierId`; the
  resolved supplier falls back picked → default → `suppliers[0]`; `SaveAsDefaultButton` saves it.
- `src/components/ui/save-as-default-button.tsx` seeds its `savedId` from `defaultId` **once** — a
  changing `defaultId` prop is ignored.
- **Prod (read 2026-10-20):** migration `20261019_0_big_bag_order` applied, `origin/main` runs the
  single-default code. Suppliers: „Mariusz Big Bag” (current default) and „Dariusz Kontener”.

## Desired End State

- The global holds `defaultBigBagSupplierId` and `defaultContainerSupplierId`.
- In the order dialog, switching „big bag” ↔ „kontener” preselects that kind's default supplier.
- „Zapisz jako domyślnego dostawcę” saves the default for the selected kind only; the button's
  „Dostawca domyślny” state reflects the selected kind.
- Saving the supplier list drops each kind's default independently when its row is removed.
- After the prod migration, the big bag default is „Mariusz Big Bag”; the kontener default is empty
  until someone stars „Dariusz Kontener” once.

### Key Discoveries:

- `ORDER_ITEMS[kind].priceKey` (`src/lib/constants/orders.ts:5`) is the existing kind → settings-key
  pattern; a `defaultSupplierKey` beside it keeps one mechanism.
- `SaveAsDefaultButton` ignores prop changes after mount (`save-as-default-button.tsx:25`) — it must be
  remounted per kind.
- `updateGlobal` writes the whole document (`order-settings.ts:16` comment) — both actions keep re-sending
  the keys they don't own.

## What We're NOT Doing

- No per-supplier „what it delivers” tag and no filtering of the supplier list (option B, rejected).
- No guessing the kontener default in the migration — a prod data choice; one star click after deploy.
- Not dropping `default_supplier_id` in this change (see Migration Notes) — follow-up Linear issue.
- No change to prices, SMS template, contact picker or order status.

## Implementation Approach

Flat fields mirroring the prices, a `defaultSupplierKey` on each `ORDER_ITEMS` entry, the set action
takes the kind. Additive migration copies the old default into the big bag one; the old column stays
until a later destructive migration.

## Critical Implementation Details

- **Pick-step state on kind switch:** `handleKindChange` resets the picked supplier to the new kind's
  default (as it already resets the price), and `SaveAsDefaultButton` gets `key={kind}` so its seed
  re-reads. Without the key, after switching to „kontener” the button still shows the big bag
  default's state.
- **No default for the kind:** the existing fallback to `suppliers[0]` stays — the select shows the name,
  so the user sees the wrong company and stars the right one. No empty-select state.

## Phase 1: Data model and actions

### Overview

Schema, migration, types, read mapper and both actions move to per-kind defaults.

### Changes Required:

#### 1. Global and migration

**File**: `src/globals/order-settings.ts`, `src/migrations/20261020_0_order_default_supplier_per_item.ts`, `src/migrations/index.ts`

**Intent**: Replace the `defaultSupplierId` field with `defaultBigBagSupplierId` and
`defaultContainerSupplierId`. Hand-written additive migration adds both varchar columns and copies
`default_supplier_id` into `default_big_bag_supplier_id`; `down()` drops the two new columns.

**Contract**: columns `order_settings.default_big_bag_supplier_id`, `order_settings.default_container_supplier_id`
(nullable varchar). `default_supplier_id` is left in place, unread. Header comment marks it additive
(migrate prod before pushing). Then `pnpm generate:types`.

#### 2. Constants, type, read mapper

**File**: `src/lib/constants/orders.ts`, `src/types/order-settings.ts`, `src/lib/orders/read-order-settings.ts`

**Intent**: Each `ORDER_ITEMS` entry gains `defaultSupplierKey`; `OrderSettingsT` swaps
`defaultSupplierId` for the two fields; the mapper reads both (`?? undefined`).

**Contract**: `ORDER_ITEMS.bigBag.defaultSupplierKey === 'defaultBigBagSupplierId'`,
`ORDER_ITEMS.container.defaultSupplierKey === 'defaultContainerSupplierId'`.

#### 3. Actions

**File**: `src/lib/actions/order-settings.ts`

**Intent**: `saveOrderSettingsAction` keeps or nulls each kind's default independently.
`setDefaultSupplierAction` takes the kind and writes only that kind's key.

**Contract**: `setDefaultSupplierAction(kind: OrderItemT, supplierId: string)`; `kind` validated against
`ORDER_ITEM_KINDS`.

#### 4. DB spec

**File**: `src/__tests__/lib/actions/order-settings.db.test.ts`

**Intent**: Baseline carries two different defaults; cover: save keeps both when rows survive; removing
one default's row nulls only that kind; `setDefaultSupplierAction('container', …)` leaves the big bag
default untouched; unknown supplier refused; bad kind refused. `afterAll` restores both fields.

### Success Criteria:

#### Automated Verification:

- Migration applies on local dev and copies the default: `pnpm payload migrate` then
  `select default_supplier_id, default_big_bag_supplier_id, default_container_supplier_id from order_settings`
- Settings action DB spec passes: `pnpm exec vitest run --project db src/__tests__/lib/actions/order-settings.db.test.ts` (against 5435)

#### Manual Verification:

- None beyond Phase 2's.

---

## Phase 2: Order dialog

### Overview

The pick step reads and saves the default for the selected kind.

### Changes Required:

#### 1. Pick step

**File**: `src/components/orders/order-pick-step.tsx`

**Intent**: The kind's default is `orderSettings[ORDER_ITEMS[kind].defaultSupplierKey]`; it seeds and
resets the picked supplier, is the fallback in the resolved supplier, feeds `SaveAsDefaultButton`
(`key={kind}`), whose `onSave` binds the kind. Labels unchanged.

#### 2. Specs and fixtures

**File**: `src/__tests__/components/orders/order-dialog.test.tsx`, `src/__tests__/components/forms/order-settings-form/order-settings-form.test.tsx`, `src/__tests__/components/tables/investments.test.tsx`

**Intent**: Fixtures switch to the two fields. Dialog spec: big bag preselects its default; switching to
„kontener” preselects the container default and the SMS goes to its phone; starring on „kontener”
calls `setDefaultSupplierAction('container', id)`; the button shows „Dostawca domyślny” per kind.

### Success Criteria:

#### Automated Verification:

- Dialog and settings-form specs pass: `pnpm exec vitest run src/__tests__/components/orders/order-dialog.test.tsx src/__tests__/components/forms/order-settings-form/order-settings-form.test.tsx src/__tests__/components/tables/investments.test.tsx`

#### Manual Verification:

- Order dialog on an investment: „big bag” preselects the big bag default; switching to „kontener”
  preselects the kontener default (or the first supplier when none is set).
- On „kontener”, pick another supplier and click „Zapisz jako domyślnego dostawcę” → toast; reopen the
  dialog: „kontener” preselects it, „big bag” still preselects its own default.
- „Dalej” → book the expense → the SMS app opens addressed to the kontener supplier's number.
- Owner removes the kontener default supplier in the gear's settings → the big bag default survives.

---

## Testing Strategy

### Unit Tests:

- Dialog: per-kind preselection, per-kind save, SMS phone follows the kind.

### Integration Tests:

- Settings actions: independent keep/null per kind; set action writes one key only.

## Migration Notes

- Additive → a human runs `pnpm db:migrate:prod` **before** pushing. Old prod code keeps reading
  `default_supplier_id` until the deploy; it is not written after the deploy, so a star click in that
  window is lost to the new code (accepted, ~minutes).
- `default_supplier_id` is dropped later by a destructive migration (push first, migrate after) —
  file a Linear issue in „Wykonczymy” at implementation end.
- After deploy, someone stars „Dariusz Kontener” once on „kontener”.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

## References

- Original change: `context/archive/2026-10-19-big-bag-order/change.md`
- Kind → key pattern: `src/lib/constants/orders.ts:5`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data model and actions

#### Automated

- [x] 1.1 Migration applies on local dev and copies the default
- [x] 1.2 Settings action DB spec passes

### Phase 2: Order dialog

#### Automated

- [x] 2.1 Dialog and settings-form specs pass
