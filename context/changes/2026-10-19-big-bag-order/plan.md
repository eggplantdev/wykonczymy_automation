# Big bag / container order — Implementation Plan

## Overview

A management user orders a big bag or a container from an investment. A short step picks the kind
and quantity. The existing expense form then opens prefilled (still fully editable), and saving it
books the expense marked „Czeka”. A dialog follows with a ready, editable SMS to the supplier, sent
from the manager's own phone through an `sms:` link. When the delivery arrives, a click on the
„Czeka” badge on the transaction flips it to „Dostarczone”.

**Why:** today big bags and containers are booked by hand after the fact and often forgotten, so the
company absorbs the cost. If the order goes through the app, the expense is booked when it is ordered.

## Current State Analysis

All grounding is in `research.md`, and every open question there is resolved. In short:

- **The expense form** (`src/components/forms/expense-form/expense-form.tsx`) is mounted only in the
  top nav.
  - Its `prefill` is bound to a worker expense draft (`expenseDraftId`), so it can't carry order values.
  - Initial values come from `prefill` → the stored draft → `blankValues` (`:207-215`).
- **`createBulkTransferAction`** (`src/lib/actions/transfers.ts:128-247`) creates rows in a single
  transaction and returns `{ success: true }`.
  - Its third parameter is draft-only.
  - `useFormSubmit` awaits the action only with `keepOpen` / `awaitBeforeClose`.
- **No quantity, phone, site manager or order status exists anywhere.**
  - `payoutStatus` (`src/collections/transfers.ts:288-299`, migration
    `20261011_1_add_payout_confirmation.ts`) is the sibling field to mirror.
  - Hidden globals edited inline (`notification-recipients` + `RecipientListCard`) are the settings
    pattern.
- **Updates on a locked investment are refused.** Any transfer update on a locked (e.g. completed)
  investment throws 403 in `validate.ts:76-85`, unless `isInvoiceOnlyPatch`
  (`src/hooks/transfers/invoice-only-patch.ts`) says only `invoice` changed.
- **The investment form is mounted in four places:** the investment page, the „Akcje” column, the
  kosztorys summary tab and the add dialog. It receives no worker list.
- **The investments list page** (`src/app/(frontend)/inwestycje/page.tsx`) fetches only
  `fetchAllInvestments` + `getPresets`.

## Desired End State

- **Investment page and „Akcje” on `/inwestycje`:** a „Zamów big bag / kontener” button shows on every
  investment offered for booking (`isOfferedForBooking`), and is absent on locked ones.
- **Order flow:**
  1. The step dialog picks big bag / kontener and a quantity, and shows quantity × price.
  2. „Dalej” opens the expense form:
     - type „Wydatek inwestycyjny”;
     - the investment set;
     - category „Materiały budowlane” and other-category „big bag” / „kontener”, matched by
       case-insensitive „contains”;
     - description „2 × big bag”;
     - amount = quantity × price.
  3. Saving creates the transaction with order status „Czeka”, then shows the SMS dialog:
     - a supplier picker, preselected to the global default (star toggle);
     - an editable message in the agreed template, with the address without country and the site
       manager's name + phone;
     - a warning when the site manager or the phone is missing;
     - „Wyślij SMS” opens `sms:`, with no recipient when the supplier list is empty.
- **Badge:** transaction cards and tables show the order status as a badge, which management clicks
  to toggle „Czeka” ⇄ „Dostarczone”. It is muted and not clickable on a cancelled row. On a locked
  investment it is read-only, like every other transfer edit there.
- **Order settings:** `/inwestycje` shows a „Zamówienia big bag / kontener” card with the suppliers
  (name + phone) and both prices. Management sees it; only ADMIN/OWNER edit it.
- **Phones and site manager:**
  - The worker form has a „Telefon” field.
  - The investment page has an inline „Kierownik budowy” select listing active accounts.

### Key Discoveries:

- `expense-form.tsx:226` writes the shared draft store on every change unless `prefill` is set. The
  order form must skip that write too, or it would wipe a half-typed „Nowy wydatek”.
- `use-form-submit.ts:40-49`: on the awaited path, `onSubmitSuccess` runs only after a confirmed
  write, so it can open the SMS step directly.
- `validate.ts:63-73` stamps `payoutStatus` by type. The order status is stamped by the creating
  flow instead, so `validate.ts` stays untouched.
- `resolve-expense-category-id.ts` is exact-match on purpose (AI-hallucination guard). The order needs
  a separate „contains” matcher, and the existing one must not be loosened.
- `lessons.md:537` warns that a hand-set investment label must stay out of `investmentSchema`.
- `src/lib/utils/is-active-ref.ts:14` has `activeOrSelected`, for pickers that must keep showing a
  stored but now inactive account.

## What We're NOT Doing

- **No worker-side ordering.** MANAGER and above only, for now.
- **No delivery date and no SMS gateway.** The SMS goes out from the manager's own phone.
- **No quantity column.** The quantity lives only in the description.
- **No change to the no-invoice confirm.** The order shows „brak faktury” like any expense.
- **No status beyond „Czeka” / „Dostarczone”.** A cancelled order uses the existing cancellation.
- **No phone layout work.** At 390px this is out of scope per AGENTS.md.
- **No own-phone edit.** Management sets phones in „Edytuj pracownika”.
- **No site manager field in the investment form or schema** (see Implementation Approach).
- **No filter on order status** in the transfers toolbar.
- **The temporary `src/components/dashboard/sms-test-dialog.tsx` is not touched.** Removing it is a
  separate decision.

## Implementation Approach

Five phases, data first. One additive migration carries every schema change.

**The site manager is set by an inline select on the investment page,** with its own action
(`setInvestmentSiteManagerAction`), not through the investment form. Three reasons:

- `lessons.md:537`: a field the whole-record form doesn't own must stay out of `investmentSchema`, or a
  stale copy overwrites it.
- The form has four mounts with no worker list. Threading one through all of them is churn for one
  select.
- It mirrors `InvestmentStatusInlineSelect`, which already sits on that page.

**The order flow is one controlled dialog with three steps** („pick” → „form” → „sms”). It is
rendered once per surface: on the investment page via its button, and at table level in
`InvestmentDataTable`, held in `useState` like `settleTarget`. The steps swap content inside one
`Dialog`, so no store and no host are needed, and the SMS step reads the kind and quantity straight
from the pick step.

**The expense form gets an `orderValues` prop.** When it is set:

- `orderValues` replaces `blankValues`;
- the draft store is never written;
- the save is awaited;
- the action receives the order flag.

## Critical Implementation Details

- **Lock gate:** the flip is a `payload.update`, so `validate.ts`'s lock check refuses it on a locked
  investment — intended, no exemption. The table hides the flip there with the existing
  `lockedInvestmentIds` courtesy (`tables/transfers.tsx:276`); the hook is the real gate.
- **Supplier ids are kept on save.** The default supplier is stored as the supplier row's id. The
  settings save must send each existing row's `id` back, because Payload mints new ids for rows
  without one and the default would silently point at nothing.
- **Order status lands only on investment expenses.** The order flag stamps `awaiting` only when
  `isInvestmentExpense(type)`. If the user switches the form to a non-expense type, the row gets no
  order status. There is no CHECK constraint, because the netto variant must also carry it.

## Phase 1: Data model

### Overview

One additive migration, plus the Payload config and constants that the later phases read.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20261019_0_big_bag_order.ts` (+ register in `src/migrations/index.ts`)

**Intent**: Add every column and table the feature needs, additive only, so a human migrates prod
before the push.

**Contract**:

- `users.phone` — `varchar`, nullable (pattern `20261009_3_worker_expense_without_investment.ts`).
- `investments.site_manager_id` — `integer`, FK → `users(id)` `ON DELETE SET NULL`, plus an index
  (pattern `20260904_0_equipment_event_author.ts:14-21`).
- `enum_transactions_order_status` (`'awaiting'`, `'delivered'`) inside a `DO $$ … duplicate_object`
  guard, and `transactions.order_status`: nullable, no default, no backfill (pattern
  `20261011_1_add_payout_confirmation.ts`).
- The `order_settings` global:
  - columns `big_bag_price numeric`, `container_price numeric`, `default_supplier_id varchar`,
    timestamps;
  - a seeded id=1 row with 800 / 1500 and `setval`;
  - a child table `order_settings_suppliers` (`_order`, `_parent_id` FK cascade, varchar `id`, `name`,
    `phone`).
  - Pattern: `20260826_0_notification_recipients.ts`.
- `down` reverses all of it, including `DROP TYPE`.

#### 2. Payload config

**Files**:

- `src/collections/users.ts`
- `src/collections/investments.ts`
- `src/collections/transfers.ts`
- `src/globals/order-settings.ts` (new; register in `payload.config.ts`)

**Intent**: Expose the new columns to Payload so the Local API reads and writes them. REST and
`/admin` writes stay closed where the value has a dedicated action.

**Contract**:

- `users.phone`: `text`.
- `investments.siteManager`: `relationship` to `users`, with `access.update: () => false` (written
  only by its action).
- `transactions.orderStatus`: `select`, mirroring `payoutStatus` (`access.create/update: () => false`,
  readOnly).
- Global `order-settings`:
  - `admin.hidden: true`;
  - read `isAdminOrOwnerOrManager`, update `isAdminOrOwner`;
  - fields `bigBagPrice`, `containerPrice` (number, required, min 0) and `defaultSupplierId` (text);
  - `suppliers` array of `{ name, phone }`, both required, `required: false`, so an empty list is
    allowed.
- Then `pnpm generate:types`.

#### 3. Constants

**File**: `src/lib/constants/orders.ts` (new)

**Intent**: Give every later phase one source for the order kinds and the status values.

**Contract**:

- `ORDER_STATUSES = ['awaiting', 'delivered'] as const`, plus `OrderStatusT` and an `isOrderStatus`
  guard (shape of `payout-confirmation.ts`).
- `ORDER_ITEMS`, an `as const` map keyed `bigBag` / `container`. Each entry holds:
  - its SMS/description label („big bag”, „kontener”);
  - the other-category name fragment;
  - the settings price key.
- Also export `ORDER_EXPENSE_CATEGORY_FRAGMENT = 'materiały budowlane'`.

### Success Criteria:

#### Automated Verification:

- Migration applies to the test DB: `pnpm db:migrate:test`
- Migration applies to the local dev DB (5433): `pnpm exec payload migrate`
- `src/payload-types.ts` regenerated with `phone`, `siteManager`, `orderStatus` and the `OrderSetting`
  global: `pnpm generate:types`

#### Manual Verification:

- After restarting `pnpm dev`, `/inwestycje`, an investment page and `/pracownicy` load with no
  „column does not exist” error.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Contacts — worker phone and site manager

### Overview

Management can record a worker's phone and pick an investment's site manager, and both reach the
reference data the SMS reads.

### Changes Required:

#### 1. Worker phone in the worker form

**Files**:

- `src/components/forms/worker-form/worker-schema.ts`
- `worker-form.tsx`
- `src/components/dialogs/add-worker-dialog.tsx`
- `src/components/dialogs/edit-worker-dialog.tsx`

**Intent**: Add an optional „Telefon” text field to create and edit. It rides through
`createWorkerAction` / `updateWorkerAction` unchanged.

**Contract**:

- `phone: z.string().trim()`, optional, defaulting to `''`, in both schemas.
- `toData` sends it.
- `EMPTY_DEFAULTS` and the edit `defaultValues` carry it.
- Input `type="tel"`.

#### 2. Reference data

**Files**:

- `src/lib/queries/reference-data.ts`
- `src/types/reference-data.ts`

**Intent**: Expose the phone on `WorkerRefT` and the site manager id on `InvestmentRefT`. Both reads
are already tagged `users` + `investments`, so no new tag is needed.

**Contract**:

- `WorkerRefT.phone: string` (empty when null).
- `InvestmentRefT.siteManagerId: number | undefined`.
- The workers SELECT (`:78-82`) and the investments SELECT (`:69-70`) gain the columns.

#### 3. Site manager action and inline select

**Files**:

- `src/lib/actions/investments.ts`
- `src/components/investments/investment-site-manager-select.tsx` (new)
- `src/app/(frontend)/inwestycje/[id]/page.tsx`

**Intent**:

- Set or clear the „Kierownik budowy” from the investment page, beside `InvestmentStatusInlineSelect`
  and hidden when the investment is trashed.
- Options: `activeOrSelected(refData.workers, current)`, plus „— brak —”.
- The flip is optimistic, rolls back on failure and shows a toast (pattern
  `investment-status-inline-select.tsx`).

**Contract**:

- `setInvestmentSiteManagerAction(id: number, userId: number | null)` is a `protectedAction`.
- It validates that `userId` is null or a live, active account, then
  `payload.update({ collection: 'investments', id, data: { siteManager }, user })`.
- It expires the same tags as `setInvestmentStatusAction`.

### Success Criteria:

#### Automated Verification:

- DB spec for the site manager: `pnpm exec vitest run src/__tests__/lib/actions/investment-site-manager.db.test.ts`
  - it sets and clears the site manager and leaves the other investment fields unchanged;
  - it refuses a trashed or inactive account.
- The worker-phone round trip is added to the existing worker action DB spec. If none exists, add
  `src/__tests__/lib/actions/workers-phone.db.test.ts`.
  - Create stores the phone; update changes it.

#### Manual Verification:

- „Edytuj pracownika” → set „Telefon” → reopen: the number is kept.
- Investment page → „Kierownik budowy” → pick an account → reload: the choice is kept, and the address,
  postal code and city are unchanged.

**Implementation Note**: commit and continue.

---

## Phase 3: Order settings — suppliers, default, prices

### Overview

The settings global gets a cached read, two actions, and a card on `/inwestycje`.

### Changes Required:

#### 1. Read

**Files**:

- `src/lib/queries/order-settings.ts` (new)
- `src/lib/cache/tags.ts`

**Intent**: A `cached()` read of the global, the twin of `fetchRecipientLists`, tagged with its own
tag.

**Contract**:

- `ORDER_SETTINGS_TAG = 'global:order-settings'`.
- `fetchOrderSettings(): Promise<OrderSettingsT>`, where `OrderSettingsT` is
  `{ suppliers: { id: string; name: string; phone: string }[]; bigBagPrice: number; containerPrice: number; defaultSupplierId: string | undefined }`.
- The type lives in `src/types/` or beside the query, following `feature-first-structure`.

#### 2. Actions

**File**: `src/lib/actions/order-settings.ts` (new)

**Intent**:

- ADMIN/OWNER save the list and the prices.
- Any management role sets the default supplier.
- Each write touches only its own keys, so neither wipes the other.

**Contract**:

- `saveOrderSettingsAction({ suppliers, bigBagPrice, containerPrice })`:
  - an `ownerOnlyAction`;
  - zod: names and phones trimmed and non-empty, prices `> 0`, `id` optional per row;
  - `updateGlobal` with only those three keys;
  - if the current default is no longer in the list, clear it in the same write.
- `setDefaultSupplierAction(supplierId: string)`:
  - a `protectedAction`;
  - refuses an id that is not in the stored list;
  - writes `defaultSupplierId` only.
- Both expire `ORDER_SETTINGS_TAG`.

#### 3. Settings card on `/inwestycje`

**Files**:

- `src/components/orders/order-settings-card.tsx` (new)
- `src/components/forms/order-settings-form/order-settings-form.tsx` (new)
- `src/app/(frontend)/inwestycje/page.tsx`

**Intent**:

- The card is titled „Zamówienia big bag / kontener”. It lists the suppliers (name, phone, a star on
  the default) and both prices.
- „Edytuj” is shown only to `isAdminOrOwnerRole`. It opens a `FormDialog` with a TanStack array field
  for the suppliers and two price inputs (pattern `RecipientListCard` + `RecipientListForm`).
- An empty list shows a hint that the SMS will go out without a recipient.

**Contract**:

- The page fetches `fetchOrderSettings()` and renders the card above the table.
- The form keeps each row's `id` through the round trip.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/actions/order-settings.db.test.ts`. It covers:
  - the save keeps the default when its row survives and clears it when the row is removed;
  - setting the default keeps the list and the prices;
  - a MANAGER is refused on the save and allowed on the default;
  - an unknown supplier id is refused.
- `pnpm exec vitest run src/__tests__/components/forms/order-settings-form/order-settings-form.test.tsx`
  - adding, removing and editing a row sends the expected payload, existing ids included.

#### Manual Verification:

- As OWNER on `/inwestycje`: edit the card → add two suppliers, change a price → save. The card shows
  them.
- As MANAGER: the card is visible with no „Edytuj”.

**Implementation Note**: commit and continue.

---

## Phase 4: Order flow

### Overview

The button, the three-step dialog, the profiled expense form, the order flag on the create action,
and the SMS step.

### Changes Required:

#### 1. Pure helpers

**Files** (new):

- `src/lib/orders/find-category-by-name.ts`
- `src/lib/orders/compose-order-sms.ts`
- `src/lib/orders/order-form-values.ts`

**Intent**: Keep the decisions that can be tested without a DOM out of the components.

**Contract**:

- `findCategoryIdByName(fragment, categories): string`
  - case-insensitive, trimmed `includes`;
  - the first match by the list's order, or `''`.
- `composeOrderSms({ itemLabel, quantity, address, contact })` returns the agreed template verbatim.
  - The „Kontakt na miejscu” paragraph is dropped when `contact` is undefined.
  - The address comes from `formatAddress({ street, postalCode, city, country: '' })`.
- `orderFormValues({ kind, quantity, investmentId, prices, referenceData })` returns the
  `BulkExpenseFormValuesT`:
  - type `INVESTMENT_EXPENSE` and the investment;
  - source register `getDefaultCashRegister`;
  - one line item: description `${quantity} × ${label}`, amount `quantity × price`, and both
    categories via the matcher.

#### 2. Order flag on the create action

**File**: `src/lib/actions/transfers.ts`

**Intent**: Stamp `awaiting` on the rows the order flow creates, in the same write.

**Contract**:

- `createBulkTransferAction(data, invoiceMediaIds?, draft?, flags?: { order?: boolean })`.
- When `flags?.order && isInvestmentExpense(parsed.data.type)`, each `payload.create` data gets
  `orderStatus: 'awaiting'`.
- The draft path is unchanged.

#### 3. Profiled expense form

**File**: `src/components/forms/expense-form/expense-form.tsx`

**Intent**: Accept order values without touching the worker-draft `prefill` path.

**Contract**: a new prop `orderValues?: BulkExpenseFormValuesT`. When it is set:

- the initial values are `orderValues`, and the stored draft is ignored;
- the `onChange` listener skips `updateFormData`;
- `submit` runs with `awaitBeforeClose: true`;
- the action gets `{ order: true }`;
- `handleReset` restores `orderValues`.

#### 4. Order dialog and buttons

**Files** (new):

- `src/components/orders/order-dialog.tsx`
- `order-pick-step.tsx`
- `order-sms-step.tsx`
- `default-supplier-button.tsx`
- `order-button.tsx`

**Intent**:

- One controlled `Dialog` with steps `pick` → `form` → `sms`.
- **Pick:**
  - a kind toggle (big bag / kontener) and an integer quantity ≥ 1;
  - a live „Kwota: 2 × 800 zł = 1600 zł”;
  - „Dalej”.
- **Form:** `ExpenseForm` with `orderValues`. `onSubmitSuccess` moves to `sms`.
- **SMS:**
  - a supplier `Select`, preselected to the default (else the first supplier);
  - a `DefaultSupplierButton` (Star/Check toggle, pattern `save-default-register-button.tsx`);
  - a `Textarea` seeded once from `composeOrderSms`;
  - warnings:
    - no site manager → „Inwestycja nie ma kierownika budowy — ustaw go na stronie inwestycji.”;
    - no phone → „Kierownik budowy nie ma numeru telefonu.”;
    - no suppliers → „Lista dostawców jest pusta — wpisz numer w telefonie.”;
  - „Wyślij SMS” sets `window.location.href = sms:${phone without spaces}?&body=…` (pattern
    `sms-test-dialog.tsx`), with an empty phone when there is no supplier;
  - „Zamknij”.
- **The site manager** resolves as `referenceData.workers.find(id === siteManagerId)`, gated by
  `isActiveRef`.

**Contract**:

- `OrderDialog` props:
  - `investment: { id; street; postalCode; city; siteManagerId }`;
  - `referenceData: ReferenceDataT`;
  - `orderSettings: OrderSettingsT`;
  - `open` / `onOpenChange`.
- `OrderButton` owns its open state for the investment page.

#### 5. Mounting

**Files**:

- `src/app/(frontend)/inwestycje/[id]/page.tsx`
- `src/app/(frontend)/inwestycje/page.tsx`
- `src/components/investments/investment-data-table.tsx`
- `src/components/tables/investments.tsx`

**Intent**:

- Investment page: `OrderButton` in the button row when `!trashed && isOfferedForBooking(investment)`.
  It is fed `refData`, the details already loaded, and `fetchOrderSettings()`.
- List page: fetch `fetchReferenceData()`, `fetchInvestmentDetails()` and `fetchOrderSettings()` with
  the existing reads, and pass them to `InvestmentDataTable`.
- „Akcje”: an `onOrder` callback (shape of `onSettle`), shown when `isOfferedForBooking(row)`. The
  table resolves the investment's address and site manager from refData plus details, and renders one
  `OrderDialog`.

**Contract**: `getInvestmentColumns({ userRole, onSettle, onOrder })`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/orders/` covers:
  - the matcher: „Big bag 1 m³” matches „big bag”, no match → `''`, first match wins;
  - the SMS: the template verbatim, the contact line dropped, the address without country;
  - the form values: amount, description and categories.
- `pnpm exec vitest run src/__tests__/lib/actions/transfers-order-flag.db.test.ts`:
  - with the flag → `awaiting` on every created row;
  - without the flag → null;
  - flag + a non-expense type → null;
  - flag + `INVESTMENT_EXPENSE_NET` → `awaiting`.
- `pnpm exec vitest run src/__tests__/components/orders/order-dialog.test.tsx`:
  - the quantity change recomputes the amount shown;
  - „Dalej” → the form shows the prefilled description and amount;
  - a steered `createBulkTransferAction` success → the SMS step with the default supplier
    preselected;
  - an empty list → the „Wyślij SMS” href has no recipient;
  - no site manager → the warning, and no „Kontakt” line.

#### Manual Verification:

- Investment page → „Zamów big bag / kontener” → kontener × 2 → „Dalej”. The form shows
  „2 × kontener”, 3000 zł, „Materiały budowlane” / „kontener”. Save (confirm „brak faktury”) → the
  SMS dialog opens with the address without country and the site manager's name + phone.
- From the phone (LAN IP): „Wyślij SMS” opens the messages app with the default supplier and the text.
- `/inwestycje` → „Akcje” on an active investment shows the order button. A completed investment has
  none.
- An investment with no site manager: the SMS dialog warns and the text has no „Kontakt” line.

**Implementation Note**: commit and continue.

---

## Phase 5: Order status — display and flip

### Overview

The status shows on cards and tables, and management toggles it.

### Changes Required:

#### 1. Row shape

**Files**:

- `src/types/transfers.ts`
- `src/lib/transfers/transfer-mapping.ts`
- the transfer fixtures that build `TransferRowT`

**Intent**: Carry `orderStatus` on `TransferRowT` from `payload.find` rows.

**Contract**: `orderStatus: OrderStatusT | undefined`.

#### 2. Flip action

**File**: `src/lib/actions/order-status.ts` (new)

**Intent**: Toggle the status with a plain `payload.update`. On a locked investment the existing
validate hook refuses it, and the action returns that error.

**Contract**:

- `setOrderStatusAction(transferId: number, status: OrderStatusT)`:
  - a `protectedAction`;
  - reads the row and refuses when `cancelled` or when `orderStatus` is null;
  - `payload.update({ collection: 'transactions', id, data: { orderStatus }, context: { skipSheetSync: true }, user })`;
  - expires `['transfers']`.

#### 3. Badge, card, table

**Files**:

- `src/components/orders/order-status-badge.tsx` (new)
- `src/components/transfers/cards/transfer-card.tsx`
- `src/components/tables/transfers.tsx`
- `src/lib/transfers/transfer-text.ts`
- `src/lib/i18n/dictionaries/{pl,uk,ru}.ts`

**Intent**:

- The badge has tones per status (pattern `payout-status-badge.tsx`), muted when cancelled.
- It is a button for management on a non-cancelled row of an unlocked investment:
  - it flips optimistically through `useOptimistic` + `startTransition` + `settleAction`;
  - it rolls back and toasts on failure (pattern `investment-status-inline-select.tsx`).
- Otherwise it is a plain badge (EMPLOYEE on `/pracownicy/[id]`, cancelled rows, locked investments).
  Both views derive the lock the same way: `TransferDataTable` holds `referenceData` and renders the
  table and `TransferCardList` („Karty” view), so it passes the locked-investment set to both.
- Card: in the right slot beside `TransferTypeBadge`, when `orderStatus` is set.
- Table: an „Zamówienie” column near the payout columns, with `meta.printValue` from
  `transfer-text.ts`.
- Labels „Czeka” / „Dostarczone” in all three dictionaries.

**Contract**: `OrderStatusBadge({ transferId, status, cancelled, canFlip })`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/actions/order-status.db.test.ts`:
  - toggles both ways, and only `order_status` changes (amount and description re-read);
  - refuses a cancelled row and a row without an order status;
  - is refused on a completed investment, and the status stays unchanged;
  - an EMPLOYEE is refused.
- `pnpm exec vitest run src/__tests__/components/orders/order-status-badge.test.tsx`:
  - a click flips the label;
  - a failed action restores it and toasts;
  - a cancelled row has no button.

#### Manual Verification:

- An investment's transactions → the order row shows „Czeka” → click → „Dostarczone” → reload: kept.
  Click again → „Czeka”.
- Cancel the order transaction: the badge is muted and not clickable.
- Mark the investment completed: in its transactions list, in both „Tabela” and „Karty”, the badge
  is shown but not clickable.
- As EMPLOYEE on their own `/pracownicy/[id]`, if an order row is visible: no button.
- Print the transactions table: the „Zamówienie” column prints „Czeka” / „Dostarczone”.

**Implementation Note**: commit and continue. At the review gate, the browser-level flow (button →
form → SMS step → badge flip) owes an E2E: author it, or file it labelled `e2e-backlog`.

---

## Testing Strategy

### Unit Tests:

- Matcher, SMS composer and form values: pure, in `src/__tests__/lib/orders/`.
- Edge cases:
  - quantity 1;
  - both categories missing;
  - an address with no postal code;
  - a phone with spaces.

### Integration Tests:

- DB specs per action: settings, default supplier, site manager, order flag, status flip. Each asserts
  persisted state, not the return value.

### Manual Testing Steps:

See each phase's Manual Verification. They roll into `context/foundation/manual-checks.md` at the end.

## Performance Considerations

- The investments list page adds `fetchReferenceData`, `fetchInvestmentDetails` and
  `fetchOrderSettings`. All three are `cached()` and already warm from other pages.
- The flip is one Local API update with sheet sync skipped.

## Migration Notes

- `20261019_0_big_bag_order.ts` is purely additive.
- A human runs `pnpm db:migrate:prod` before the push.
- No backfill: existing transactions have no order status.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit + DOM suite passes: `pnpm test`
- Integration suite passes: `pnpm test:integration`

## References

- Research: `context/changes/2026-10-19-big-bag-order/research.md`
- Status pattern: `src/collections/transfers.ts:288-299`, `20261011_1_add_payout_confirmation.ts`
- Inline flip: `src/components/investments/investment-status-inline-select.tsx`
- Global + inline card: `src/globals/notification-recipients.ts`,
  `src/components/notification-recipients/recipient-list-card.tsx`
- Default toggle: `src/components/forms/form-fields/save-default-register-button.tsx`
- SMS link: `src/components/dashboard/sms-test-dialog.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data model

#### Automated

- [x] 1.1 Migration applies to the test DB — 0c8d144e8
- [x] 1.2 Migration applies to the local dev DB — 0c8d144e8
- [x] 1.3 payload-types regenerated with the new fields and global — 0c8d144e8

### Phase 2: Contacts — worker phone and site manager

#### Automated

- [x] 2.1 Site manager action DB spec passes
- [x] 2.2 Worker phone round-trip DB spec passes

### Phase 3: Order settings — suppliers, default, prices

#### Automated

- [ ] 3.1 Order settings actions DB spec passes
- [ ] 3.2 Order settings form DOM spec passes

### Phase 4: Order flow

#### Automated

- [ ] 4.1 Order helpers unit specs pass
- [ ] 4.2 Order flag DB spec passes
- [ ] 4.3 Order dialog DOM spec passes

### Phase 5: Order status — display and flip

#### Automated

- [ ] 5.1 Order status flip DB spec passes
- [ ] 5.2 Order status badge DOM spec passes
