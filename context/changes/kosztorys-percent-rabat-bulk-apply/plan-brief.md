# Percent Global Rabat → Bulk-Apply — Plan Brief

> Full plan: `context/changes/kosztorys-percent-rabat-bulk-apply/plan.md`

## What & Why

Owner decision: a percent global rabat should not hide/override per-item rabaty — it should BE
per-item rabaty. Entering X% and clicking „Zastosuj" writes `percent X` into every item row
(overwriting existing values); rows stay individually editable afterwards. Amount-mode global
rabat (flat PLN off the total) keeps today's semantics unchanged.

## Starting Point

Today `globalDiscount` (percent or amount) is stored on the investment; when active it
short-circuits per-item rabat in calc, hides the rabat columns, and is subtracted once at the
total. Snapshots persist the setting.

## Desired End State

Percent is a one-shot tool (input + „Zastosuj", resets after apply, nothing stored). Stored global
discount is amount-or-null. Version snapshots carry no global-discount settings — rabat never
travels via restore or presets.

## Key Decisions Made

| Decision          | Choice                                         | Why                                                          |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Percent model     | One-time overwrite of ALL item rows (model A)  | Matches the sheet's drag-the-column move; uniform result     |
| Trigger           | Explicit „Zastosuj" button                     | Destructive write stays deliberate                           |
| Field after apply | Resets to empty                                | Honest: rabat lives in rows, no stale pseudo-state           |
| Guard rails       | No confirm dialog, no undo entry               | Owner accepts overwrite; recovery = re-typing                |
| Amount mode       | Unchanged (stored, hides columns, total-level) | A lump sum can't live in rows without inventing distribution |
| Snapshots         | Drop `globalDiscountType/Value`                | Rabat is per-investment, never auto-granted                  |
| Bulk write        | One raw-SQL server action                      | 1000+ rows; N Payload updates won't fly                      |

## Scope

**In scope:** bulk server action, settings UI rework, editor optimistic patch, type narrowing to
amount-only, snapshot field removal, test updates.

**Out of scope:** amount-mode changes, presets (already rabat-free), RABAT transaction plane,
data migration/backfill (kosztorys data is throwaway).

## Phases at a Glance

| Phase                              | What it delivers                   | Key risk                               |
| ---------------------------------- | ---------------------------------- | -------------------------------------- |
| 1. Bulk-apply action + settings UI | Usable end-to-end percent tool     | Optimistic patch vs unsaved grid edits |
| 2. Amount-only + snapshot cleanup  | Narrowed stored model, tests green | Typecheck ripple through consumers     |

**Prerequisites:** none — branch work, no prod migration owed until ship.
**Estimated effort:** ~1-2 sessions.

## Success Criteria (Summary)

- Apply 10% → every row shows rabat 10%, totals drop, persists across reload
- Amount rabat still hides columns and subtracts once
- Restore keeps the live amount discount; snapshots carry no rabat settings
