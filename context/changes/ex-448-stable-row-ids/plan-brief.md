# Stable per-row ids for expense line-items — Plan Brief

> Full plan: `context/changes/ex-448-stable-row-ids/plan.md`

## What & Why

Expense line-item rows are identified by their array index. Because the index shifts on
insert/remove, the code carries a reindex/remount apparatus to keep out-of-form state (invoice
files, AI-generation markers) aligned to moving rows. Give each row a stable client-side `id`, key
that state by id, and delete the machinery. This removes the root cause behind two already-patched
row-removal bugs (EX-447).

## Starting Point

Today: `key={index}`, `Map<number,File>` file store with `reindexAfterRemoval`, `Set<number>`
generation markers with `reindexSet`/`onRowRemoved`, and a global `fileInputKey` bump that
force-remounts uncontrolled file inputs after every mutation (because `getFile` reads a
non-reactive ref).

## Desired End State

Each row has a stable `id`. Removing a mid-batch row leaves every surviving row's file and markers
correctly bound with zero reindexing. `reindexAfterRemoval`, `reindexSet`, `onRowRemoved`, and
`fileInputKey` are gone. Submit and failed-submit recovery still attach the right file per row.

## Key Decisions Made

| Decision           | Choice                                                       | Why                                                                                           | Source |
| ------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------ |
| Submit boundary    | Convert id→position at the boundary                          | Keeps `resolveInvoiceMediaIds` + server positional contract untouched — smallest blast radius | Plan   |
| Where the id lives | In form state + client zod schema                            | id rides with the row through push/remove/persist/recover for free; server never sees it      | Plan   |
| `fileInputKey`     | Fully removed; file store made reactive, FV label controlled | Kills the sledgehammer per the ticket; reactive store re-renders on attach/rename             | Plan   |
| Tests              | Rewrite 2 unit tests + add id-identity regression test       | Pin the exact remove-mid-batch bug class the ticket targets                                   | Plan   |

## Scope

**In scope:** `expense-schema.ts`, `bulk-expense-form.ts`, `line-items-field.tsx`,
`line-item-invoice-field.tsx`, `expense-form.tsx`, `use-invoice-files.ts`,
`use-receipt-generation.ts`, `use-form-submit.ts` (recovery seam), a positional-projection helper,
and the two unit tests.

**Out of scope:** `resolveInvoiceMediaIds` signature + server contract; `FormFileInput` (unrelated
generic control); `FileInput` public API; any persistence/migration; the AI extraction flow.

## Architecture / Approach

The index plays two fused roles: editor-lifecycle identity (shifts on edit → the bug) and the
submit/recovery wire order. Move only the first to a stable `id`; keep the second positional and
bridge with one id→position projection at submit and one position→id projection at recovery.
`form.setFieldValue(\`lineItems[${index}]\`)` stays index-based throughout — the id only replaces
out-of-form map/set keys.

## Phases at a Glance

| Phase                       | What it delivers                                                         | Key risk                                                                 |
| --------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1. Row id foundation        | `id` on schema + factory + keys; additive, behavior-neutral              | Missing a row-creation site → a row without an id                        |
| 2. Rekey by id (+ boundary) | id-keyed file map/markers, machinery deleted, submit+recovery projection | Recovery position→id alignment; must land atomically for green typecheck |
| 3. Retire fileInputKey      | reactive file store + mirror ref, controlled FV label                    | Async `getFiles()` stale-closure — mitigated by mirror ref               |
| 4. Tests                    | rewritten + new id-identity unit tests                                   | Depends on EX-447 e2e for cross-boundary net                             |

**Prerequisites:** clean tree on branch `konradantonik/ex-448-…` (the current S-07 work must be
committed/stashed first — do not tangle the two).
**Estimated effort:** ~1 focused session across 4 phases; net-negative line count.

## Open Risks & Assumptions

- Assumes EX-447's receipt-batch-scan e2e exists and passes as the cross-boundary regression net;
  if not, it is owed to `e2e-backlog`.
- Phase 2's two unit tests may be transiently red until Phase 4 rewrites them — land them close
  together (or temporarily xfail) rather than gating Phase 2 on the old tests.
- Reactive file store adds re-renders on file ops; acceptable given existing per-op setState calls.

## Success Criteria (Summary)

- Remove a middle row in a multi-receipt scan → other rows keep their correct images/markers.
- Submit and failed-submit recovery both attach the correct file per row.
- `grep -rn fileInputKey src/` is empty; the two unit tests + the id-identity test pass.
