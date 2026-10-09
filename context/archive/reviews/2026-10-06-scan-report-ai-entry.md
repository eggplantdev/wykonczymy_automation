# Review-gate ledger — scan-report-ai-entry (b56770c5) · 2026-10-06

Checks run inline (proportional to a ~90-line, 7-file diff): code-review, comment-noise, tailwind,
structure, /simplify. No impl-review (no plan.md).

_Trimmed at archive (2026-10-09): 1 of 6 findings were `fixed` and are removed — their record is the commit. Orphan from `.review-gate/` (no change folder). What remains is what the gate chose not to act on._

## Findings

- [x] skipped · code-review · `scan-report-dialog.tsx:41` · a kosztorys with one assignable worker now needs one extra pick (the old per-worker item had him preselected) — follows from the requested single top entry; asked the user instead of auto-preselecting
- [x] dropped · reuse-scan · `scan-report-action.tsx:35`, `scan-report-button.tsx:36` · `WandSparkles text-neon-cyan` + `text-neon-cyan font-semibold` span repeated, as in 4 existing AI buttons — no shared primitive exists; extracting one is a repo-wide refactor not worth it for a two-class pair
- [x] dismissed · code-review · `kosztorys-workers-menu.tsx:31` · scannable list computed before link holders load — a link holder without etapy resolves to blocked and is filtered anyway, so the list does not depend on them
- [x] dismissed · comment-noise · `scan-report-dialog.tsx:34` · PropsT comment on optional investmentId — says which entry point passes it, passes the strip test
- [x] dismissed · tailwind · no arbitrary values or inline styles added

## Simplify pass

Ran /simplify inline — 1 applied, 0 proposed, 0 dismissed; folded into ## Findings.

## Tests & suite

- `scan-report-dialog.test.tsx` 3/3 green; `tsc --noEmit` clean. Menu entry behaviour (top position, disabled with no worker, blocked filtered): no automated test — covered by the 4 manual checks in manual-checks.md § scan-report-ai-entry.
- Full suite: not run (small UI diff).
