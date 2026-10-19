---
change_id: transfer-actions-db-spec
title: Transfer actions asserted on persisted state — close test-plan risk #3
status: archived
created: 2026-09-29
updated: 2026-10-18
archived_at: 2026-10-18T10:29:04Z
branch: staging
worktree: null
---

## Notes

transfer-actions DB spec: rewrite transfer-actions.test.ts write assertions to a .db.test.ts that reads persisted state back (register balance, investment figures incl. LABOR_COST / RABAT / LOSS / CANCELLATION) — closes test-plan risk #3. Source: context/changes/2026-09-15-test-suite-audit/research.md §2 + re-measure 2026-09-29.

## Outcome

- `src/__tests__/lib/actions/transfers.db.test.ts` books every figure-moving type (BONUS included) through
  the real actions and asserts registers, buckets, bilans and „Pozostało" against hand-computed literals;
  covers cancel, the robocizna edit, refusals and bulk rollback. Marża is not asserted — owner,
  2026-09-29: its definition is undecided.
- `cancelTransferAction` / `updateTransferAction` now write their pair (flag + CANCELLATION row, amount +
  `amount-edits` row) in one `withPayloadTransaction`; the atomicity tests were red before the fix.
- Slimming or moving the mocked `transfer-actions.test.ts` was handed to test-suite-audit, which owns
  that file's layout.

## Open questions found, not acted on

- `updateTransferAction` blanks `description` and the document fields when the caller omits them, and
  silently ignores a new amount on any type but LABOR_COST while returning success. The form probably
  always sends every field; intent unchecked.
- The invoice actions skip `fetchAndAuthorize`, so an invoice can be attached to a row on a locked
  investment or to a cancelled row. Intent unchecked.
