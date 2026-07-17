---
change_id: investment-planowana-status
title: Add a third investment status „Planowana" so a kosztorys can be built for an undecided prospect
status: plan_reviewed
created: 2026-07-16
updated: 2026-07-17
archived_at: null
branch: null
worktree: null
---

## Notes

The owner needs to build a kosztorys to send to a client as a **proposal**, before the client has
decided to work with us — i.e. before there is a real job. A kosztorys cannot exist without an
investment (the investment record is the container for VAT, markup coefficients, global discount, the
URL, and every action's required `investmentId`; verified — no standalone-kosztorys path exists).

**Decision (owner):** do NOT make the kosztorys wiring investment-optional (that would re-home
VAT/coeffs/discount, fork every "has/no investment" code path, and invent a new URL — a large
structural change). Instead add a third **investment status `planowana`** ("prospect / proposal for an
undecided client"). The kosztorys wiring is untouched: creating a planowana investment auto-seeds a
blank kosztorys exactly as today (EX-463); when the client commits, the owner promotes it to
`aktywna` and the kosztorys is intact; if they decline it stays planowana or is deleted. The client
never sees the word "investment" — to them it is a kosztorys/oferta.

**Blast radius (measured, not guessed):** the investment list _rents_ three shared **binary** helpers —
`useOptimisticToggle` (binary write), `useActiveFilter` (two-bucket), `ActiveToggleBadge` (one-click
flip) — also used by users/cash-registers. A third status collides with that binary abstraction. Two
lines hard-write `active ? 'active' : 'completed'` (`toggle-active.ts:67`,
`investment-data-table.tsx:20`) — the exact spot where a prospect would be silently overwritten to
_completed_. The fix decouples the investment list from the shared binary machine (users/cash-registers
untouched). The financial rollup (`sum-transfers.ts`) is transaction-keyed, so a prospect (no
transactions) contributes 0 to every figure — no financial-layer change owed.

**Locked design decisions (owner delegated):**

- Add-form status default stays `active`; owner picks Planowana for a prospect.
- List gains a 3-way status filter (Wszystkie / Planowane / Aktywne / Zakończone); default view shows
  Aktywne + Planowane.
- Status changes happen in the Edytuj dialog (3-value select); the row shows a **read-only** status
  badge. The inline one-click toggle is removed (no accidental prospect→completed conversion).

Out of scope: the client-facing proposal export/PDF (offer view) — a separate later slice.
