# Review-gate ledger — invoice-download-date-range · 2026-10-11

Base `f09580cad` (staging) … HEAD. Verification pass (Step 0.5) skipped — browser pass needs an explicit Playwright ask.

## Findings

_Trimmed at archive (2026-10-12): 14 fixed findings removed; their record is the commits. Dismissed / dropped / filed kept._

- [x] 🔵 OBSERVATION · dropped · impl-review + code-review · `invoice-download-dialog.tsx` · counter goes blank after a failed count — the error toast already reports it, as the plan specified
      test: no automated test · — not a defect
- [x] 🔵 OBSERVATION · dismissed · code-review + simplify(altitude) · `src/lib/queries/transfer-filters.ts` `withDateRange` · strips every `date` leaf, so a page scope with its own date restriction would lose it — unreachable: `buildTransferFilters` is the only writer of `date`; the investment/register/worker scopes add none
      test: no automated test · — no reachable input
- [x] skipped · simplify(simplification) · `invoice-download-dialog.tsx` · `isCounting` as `useTransition` — the transition's pending flag would outlive `disown()` on close and show a stale spinner on a quick reopen; explicit state is clearer
- [x] dismissed · simplify(simplification) · `src/__tests__/lib/queries/fetch-transfers-for-invoices.test.ts:54` · swap rule asserted at action level too — it is the only spec proving the action wires `range` through `withDateRange`
- [x] dropped · simplify(simplification) · `fetch-transfers-for-invoices.test.ts` · two near-identical `beforeEach` blocks — not worth the churn
- [x] dropped · simplify(altitude) · `src/lib/queries/transfer-filters.ts:155` · table passes raw `from`/`to` to the filter while the dialog prefill validates — pre-existing; the picker only writes ISO days, a junk value needs a hand-typed URL
- [x] dropped · simplify(reuse) · `src/components/transfers/transfer-filters.tsx:126` · `hasDateFilter` could use `urlDateRange` — outside the diff and changes what counts as an active filter
- [x] dismissed · simplify(efficiency) · whole diff · no wasted work at this scale — one fetch per completed range, the same rows feed the ZIP
- [x] dismissed · module-cohesion-audit · structure-scatter-audit · tailwind-v4-audit · no findings

## Simplify pass

Ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 6 applied, 1 skipped, 4 dropped/dismissed; each folded into ## Findings (tagged simplify). `primitive-reuse-scan` was not run on its own; the reuse agent's primitive sweep found `FormDialogShell`.

## Tests & suite

- `pnpm typecheck` — green
- `pnpm test` (unit, node + dom) — 548 files / 5705 tests passed, 140 files skipped (DB-backed, run by `test:integration`)
- `pnpm build` — green (compiled, 40/40 static pages)
- lint, `test:integration`, `test:e2e` — not run (not requested)
