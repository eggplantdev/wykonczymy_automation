---
change_id: big-bag-order
title: Order a big bag or container from an investment, with a ready SMS to the supplier
status: implementing
created: 2026-10-19
updated: 2026-10-19
archived_at: null
branch: big-bag-order
worktree: .claude/worktrees/big-bag-order
---

## Notes

big-bag-order — Zamów big bag / kontener z inwestycji: profilowany formularz wydatku + gotowy SMS do
dostawcy + status Czeka/Dostarczone

### Problem

Big bags and containers are booked as an ordinary investment expense, and people forget to book them —
the company absorbs the cost. Making the order itself go through the app books the expense at order time.

### Decisions (shaping, 2026-10-19)

- **Who orders:** MANAGER for now (management roles; may widen later). The order creates a transfer
  directly — no worker expense draft.
- **Where:** the investment page, and the „Akcje” column of the investments list. The investment is
  always known, so it is prefilled.
- **Flow:** „Zamów big bag / kontener” → the existing expense form, *profiled* (prefilled, every field
  still editable) → save → a dialog with a prefilled SMS → send via `sms:` link from the manager's own
  phone (pattern: `src/components/dashboard/sms-test-dialog.tsx`; no SMS gateway).
- **Expense prefill:** `INVESTMENT_EXPENSE`, category „Materiały budowlane”, sub-category („Inne
  kategorie”) „big bag” or „kontener” — both already exist. Editable: netto variant, „wliczony w
  robociznę”, category. Category/sub-category are found by name — case-insensitive „contains”
  („big bag” matches „Big bag 1 m³”). No match → the field stays empty and the user picks it; the form
  is editable, so a renamed category costs one click, not a wrong booking.
- **Amount:** quantity × unit price from a price list — big bag 800 zł, kontener 1500 zł — recomputed on
  quantity change, editable by hand. Prices live in global settings (ADMIN/OWNER), not in code.
- **Status:** `Czeka` → `Dostarczone`, only on expenses created by the order button (independent of the
  category the user ends up choosing). No „potwierdzone”, no pickup tracking. A cancelled order goes
  through the existing transfer cancellation, not a status. Mirrors `payoutStatus`: a badge on the
  transfer card and table, clickable to flip `Czeka` → `Dostarczone` (like
  `investment-status-inline-select`).
- **Supplier numbers:** a list in a new hidden order-settings global (with the prices) — entries are
  name + phone. Not `notification-recipients`: its owner-only save rewrites only its own lists.
  One entry is the global default, set from the order dialog the way `SaveDefaultRegisterButton` sets the
  per-account default register, but stored globally. MANAGER may change the default (dedicated
  `protectedAction`); the list itself stays ADMIN/OWNER.
- **Contact on site:**
  - `users` gets a new `phone` field (worker form).
  - `investments` gets a new „Kierownik budowy” relationship to any active, non-trashed account. The
    existing free-text `contactPerson` is the client's contact and stays untouched.
  - The SMS takes name + phone via investment → kierownik → phone. No kierownik or no phone → the contact
    line is dropped and the form warns.
- **SMS template** (editable in the dialog before sending; no delivery date):

  ```
  Dzień dobry,

  Prosimy o zamówienie:
  2 × big bag
  Adres: ul. Przykładowa 12, 00-000 Warszawa

  Kontakt na miejscu: Jan Kowalski, 601 234 567

  Będę wdzięczny za potwierdzenie.

  Dzięki,
  Zespół Wykończymy
  ```

- **Address in the SMS:** „Adres: …” under the ordered items — the investment's street, postal code and
  city, no country.
- **No-invoice confirm** stays as for any expense — no order-only branch in the form.
- **Locked investment:** no order button (investment page and „Akcje”).
- **Settings card** (suppliers + both prices) on `/inwestycje`, edited by ADMIN/OWNER — provisional;
  the owner may move it after seeing it.
