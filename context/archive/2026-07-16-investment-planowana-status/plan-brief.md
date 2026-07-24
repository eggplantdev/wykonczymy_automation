# Investment „Planowana" Status — Plan Brief

> Full plan: `context/changes/investment-planowana-status/plan.md`

## What & Why

The owner needs to build a kosztorys to send a client as a **proposal**, before the client has decided
to work with us. A kosztorys can't exist without an investment, and making it investment-optional is a
large structural change. Instead we add a third investment status, `planowana` ("prospect / proposal"):
a planowana investment is the container the kosztorys already needs, and when the client commits it is
promoted to `aktywna` with the kosztorys intact.

## Starting Point

Investment status is a **binary** (`active` / `completed`). The investment list rents three shared,
binary helpers — `useOptimisticToggle`, `useActiveFilter`, `ActiveToggleBadge` — also used by users and
cash-registers. Creating any investment already auto-seeds a blank kosztorys (EX-463). The financial
rollup is transaction-keyed.

## Desired End State

The investment form offers three statuses; a Planowana investment appears under a new 3-way status
filter with a read-only badge and an auto-seeded kosztorys, contributes 0 to every financial figure, and
is promoted to Aktywna via the edit dialog. There is no one-click status toggle on the list.

## Key Decisions Made

| Decision                            | Choice                                             | Why                                                                                                                              | Source           |
| ----------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Container for a pre-job proposal    | Third investment status `planowana`                | Keeps the kosztorys wiring untouched; avoids re-homing VAT/coeffs/discount + new URL                                             | Frame/discussion |
| Add-form default status             | Stays `active`                                     | Real jobs are still added directly; pick Planowana for a prospect                                                                | Owner            |
| List filter shape                   | 3-way status filter (default: Aktywne + Planowane) | Direct "navigate/select by status" — the stated goal                                                                             | Owner            |
| Status change mechanism             | Edit dialog only; row badge read-only              | Removes the silent prospect→completed overwrite footgun                                                                          | Owner            |
| Financial-layer changes             | None                                               | `sum-transfers.ts` is transaction-keyed; a prospect (0 transactions) contributes 0                                               | Research         |
| Shared binary helpers               | Left intact; investment list decoupled from them   | Users/cash-registers unaffected                                                                                                  | Research         |
| Derived `active` on investment refs | Unchanged (`status === 'active'`)                  | No money booked against a prospect — promote to Aktywna first; hiding it from transfer comboboxes + dashboard filter is intended | Plan review (F2) |

## Scope

**In scope:** enum value + migration; form/select + schema; read-only status badge; 3-way status filter;
delete `toggleInvestmentStatus`; 3-value status label; `useStatusFilter` unit test.

**Out of scope:** standalone/investment-optional kosztorys; the client-facing proposal export/offer-view
PDF; any change to users/cash-registers or the shared binary helpers; the financial calc layer.

## Architecture / Approach

One added enum value flows schema → migration → generated types → widened hand-written unions. The
investment list stops renting the shared binary helpers: the interactive `ActiveToggleBadge` becomes a
read-only `InvestmentStatusBadge`, and `useActiveFilter` + `ActiveFilterButton` become `useStatusFilter`

- a 3-way `StatusFilter`. The dead binary write path (`toggleInvestmentStatus`, the inline optimistic
  toggle) is deleted. Nothing touches the kosztorys wiring or the financial layer.

## Phases at a Glance

| Phase                | What it delivers                                              | Key risk                                                                  |
| -------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1. Enum end-to-end   | `planowana` exists in schema, DB, types, read path            | `ALTER TYPE ADD VALUE` in a transaction (safe: value not used same tx)    |
| 2. Settable via form | Create/promote a prospect through the form                    | none — actions are unchanged passthroughs                                 |
| 3. List decoupling   | Read-only badge + 3-way status filter; off the binary helpers | scope creep into the shared helpers (must not touch users/cash-registers) |
| 4. Cleanup + tests   | Delete dead toggle, 3-value label, `useStatusFilter` test     | leaving a dangling importer of the deleted action                         |

**Prerequisites:** none. **Estimated effort:** ~1–2 sessions across 4 tight phases.

## Open Risks & Assumptions

- Migration must be applied to prod (`pnpm db:migrate:prod`, human) before the reading code ships — it
  touches the real `investments` table. Additive, so low risk.
- Assumes the owner is fine promoting a prospect via the edit dialog (2 clicks), not an inline control.
- Browser E2E (list filter + promote) is owed; defer to the `e2e-backlog` Linear issue at the review gate.

## Success Criteria (Summary)

- Create an investment as Planowana → it shows under Planowane with a „Planowana" badge and an
  auto-seeded kosztorys, and every financial figure is 0.
- Editing it to Aktywna moves it into the Aktywne view; the row badge is never clickable.
- Users and cash-registers behave exactly as before.
