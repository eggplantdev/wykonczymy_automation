# Review-gate ledger — spike/transfer-cards · 2026-10-09

Scope: `61a5f15b5...HEAD` (merge-base with `staging`), spike commits `a149f94c0` + `8ae4a546e`.
Excluded: `src/components/worker-reports/worker-report-review.tsx` (`55978010d`, a separate feature commit on this branch).

_Trimmed at archive (2026-10-15): 13 of 21 findings were `fixed` and are removed — their record is the commit. What remains is what the gate chose not to act on. Pre-trim tally: 13 fixed, 3 dismissed, 4 dropped, 1 skipped, 0 open._

## Findings

- [x] dismissed · code-review · `transfer-view-switch.tsx` · `router.replace` outside a transition — moot, the switch no longer navigates
- [x] skipped · primitive-reuse · `transfer-view-switch.tsx` · hand-rolled segmented toggle vs `ToggleGroup` — swapping changes the look (`bg-primary` pill); a design call, not a cleanup
- [x] dropped · primitive-reuse · `transfer-card.tsx` · `Chip` / badge could build on `BADGE_BASE` — it adds `font-medium` + `whitespace-nowrap`, which changes the chip; not worth it
- [x] dropped · primitive-reuse · `media-preview-trigger.tsx`, `note-popover.tsx`, `invoice-cell.tsx` · `outline`+`xs` spelled three times — one-line `buttonVariants` call each, a constant adds nothing
- [x] dropped · primitive-reuse · `transfer-card.tsx` · amount via `renderCell(row, 'amount')` — the card's amount is a different size with line-through; the shared part is one `isMuted` line
- [x] dropped · code-review · `cancel-transfer-button.tsx` · „Anuluj” untranslated — the whole component (label, confirm dialog) predates i18n; translating one word would mix languages
- [x] dismissed · tailwind-v4-audit · inline `style` with `var(--color-…)` — the hue is picked per row at runtime; same precedent as `StatButton`
- [x] dismissed · user · `transfer-card-list.tsx` · no virtualization — the listing paginates at ≤100 rows (`ALLOWED_LIMITS`), and the table view isn't virtualized either

## Simplify pass

Not run as a separate pass — the reuse-scan and cohesion findings above are the simplification, applied directly.

## Tests & suite

Not run (needs your explicit go). Touched spec: `src/__tests__/transfer-constants.test.ts` (colour expectations re-pointed).
