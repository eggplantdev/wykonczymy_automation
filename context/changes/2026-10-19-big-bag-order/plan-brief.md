# Big bag / container order — Plan Brief

> Full plan: `context/changes/2026-10-19-big-bag-order/plan.md`
> Research: `context/changes/2026-10-19-big-bag-order/research.md`

## What & Why

Big bags and containers are booked by hand after the fact, people forget, and the company absorbs the
cost. A management user will order them from an investment instead. The order books the expense
straight away (status „Czeka”) and hands over a ready SMS for the supplier.

## Starting Point

- The expense form exists, but it is mounted only in the top nav, and its `prefill` is tied to worker
  drafts.
- These don't exist yet:
  - a phone on users;
  - a site manager on investments;
  - an order status on transactions;
  - a settings store for suppliers and prices.
- `payoutStatus` and the hidden `notification-recipients` global are the patterns to copy.

## Desired End State

- **Investment page and „Akcje”:** a „Zamów big bag / kontener” button on investments open for
  booking.
- **The flow:**
  1. Pick the kind and quantity.
  2. The expense form opens prefilled, every field editable. Saving books it as „Czeka”.
  3. A dialog shows an editable SMS (address, site manager contact) and the default supplier.
  4. „Wyślij SMS” opens the phone's messages app.
- **The badge** on the transaction toggles „Czeka” ⇄ „Dostarczone”.
- **Settings:** suppliers and prices live on a card on `/inwestycje`, edited by ADMIN/OWNER.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Who orders | Management only, creates the transaction directly | Workers' flow can come later; no draft needed | Research |
| Kind + quantity | Short step before the form | Expense form stays unchanged; quantity for the SMS is certain | Plan |
| Form profiling | New `orderValues` prop, not `prefill` | `prefill` is bound to worker drafts and paragon decisions | Research |
| Categories | Case-insensitive „contains” by name; no match → empty | Survives renames like „Big bag 1 m³”; a miss costs one click | Research |
| Quantity storage | Description only („2 × big bag”) | Nothing reads it back | Research |
| No-invoice confirm | Unchanged | No order-only branch in the form | Research |
| Status stamping | Create action's order flag, investment-expense types only | One write; status follows the flow, not the type | Research |
| Status flip | `payload.update` + `skipSheetSync`, both directions | One write path; a misclick undoes in one click | Research / Plan |
| Locked investment | No order button; badge read-only, flip refused by the existing lock gate | No exception — a locked investment takes no transfer edits | Research / Plan |
| Suppliers + prices | New hidden `order-settings` global; ADMIN/OWNER edit, MANAGER sets the default | Keeps owner-only recipients untouched | Research |
| Empty supplier list | SMS opens with no recipient, plus a hint | An order never blocks | Plan |
| Worker phone | „Edytuj pracownika” only | No new permissions | Plan |
| Site manager | Inline select on the investment page with its own action, not in the investment form | Lesson: hand-set labels stay out of `investmentSchema`; the form has 4 mounts with no worker list | Plan |

## Scope

**In scope:**

- the migration;
- the worker phone and the site manager;
- the settings global, its card and its actions;
- the order dialog (pick → form → SMS) on the page and in „Akcje”;
- the order flag;
- the status badge on cards and tables, with the flip.

**Out of scope:**

- worker-side ordering;
- a delivery date or an SMS gateway;
- a quantity column;
- an own-phone edit;
- a status filter;
- the 390px layout;
- removing the temporary `sms-test-dialog.tsx`.

## Architecture / Approach

The order dialog is one controlled `Dialog` with three steps. Pure helpers in `src/lib/orders/`
(category matcher, SMS composer, form values) feed `ExpenseForm` via `orderValues`. Saving calls
`createBulkTransferAction(…, { order: true })`, which stamps `orderStatus: 'awaiting'`. The SMS step
reads the settings (`fetchOrderSettings`, cached and tagged) and the reference data (site manager →
phone). `OrderStatusBadge` flips through `setOrderStatusAction`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data model | Migration, Payload fields, global, constants | Migration drift vs `payload-types` |
| 2. Contacts | Worker phone, site manager select + action | A stored inactive site manager in the picker |
| 3. Order settings | Cached read, two actions, card on `/inwestycje` | Supplier row ids lost on save → orphaned default |
| 4. Order flow | Helpers, order flag, profiled form, dialog, buttons | Draft-store write wiping a half-typed „Nowy wydatek” |
| 5. Order status | Row shape, flip action, badge/column | A clickable badge on a locked investment that always fails |

**Prerequisites:** none. The branch is `big-bag-order`, and the notes-save fix has landed (164f68ed7).
**Estimated effort:** ~2–3 sessions across 5 phases.

## Open Risks & Assumptions

- **Prod migration:** a human runs `pnpm db:migrate:prod` before the push. The migration is additive.
- **Settings card placement** on `/inwestycje` is provisional; the owner may move it.
- **Type switch:** if the user switches the form to a non-expense type, the row gets no order status.
  This is accepted.

## Success Criteria (Summary)

- A manager orders a container in under a minute, and the expense is booked at that moment.
- The supplier receives an SMS with the right quantity, address and on-site contact.
- Pending orders are visible as „Czeka” and closed with one click.
