# Review-gate ledger — invoice-download-date-range · 2026-10-11

Base `f09580cad` (staging) … HEAD. Verification pass (Step 0.5) skipped — browser pass needs an explicit Playwright ask.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · plan Progress · specs and gate not run — typecheck, unit suite and build run green (see Tests & suite)
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/queries/fetch-transfers-for-invoices.ts:33` · server accepted Od later than Do and returned an empty archive — refused by `isClosedRange`
      test: TDD · unit — `it.each` row „an inverted range" in `fetch-transfers-for-invoices.test.ts`
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `src/components/transfers/invoice-download-dialog.tsx:105` · double spinner — picker `isPending` is a full-screen overlay on top of the counter's spinner; dropped `isPending`
      test: no automated test · — visual only, covered by manual checks
- [x] 🔵 OBSERVATION · dropped · impl-review + code-review · `invoice-download-dialog.tsx` · counter goes blank after a failed count — the error toast already reports it, as the plan specified
      test: no automated test · — not a defect
- [x] 🔵 OBSERVATION · dismissed · code-review + simplify(altitude) · `src/lib/queries/transfer-filters.ts` `withDateRange` · strips every `date` leaf, so a page scope with its own date restriction would lose it — unreachable: `buildTransferFilters` is the only writer of `date`; the investment/register/worker scopes add none
      test: no automated test · — no reachable input
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/hooks/use-file-archive.ts:25` · comment claimed the hook was split out of `InvoiceDownloadDialog` (false history) — reworded to the real reason (separate auth needs)
- [x] 🔵 OBSERVATION · fixed · impl-review · `change.md` Notes · said the counter is computed server-side — it counts the same rows the ZIP packs
- [x] fixed · code-review · `src/lib/utils/date-range.ts` · „closed range" rule duplicated in the dialog (`count` + `isInverted`) and the server guard — one `isClosedRange` (valid ISO days, in order)
- [x] fixed · feature-first-structure · `src/components/transfers/transfer-table-config.ts` · `TransferRowsFetchT` repeated the action's options shape — exports and reuses `FetchFilteredTransfersOptsT`
- [x] fixed · simplify(reuse) · `src/components/filters/date-filters.tsx` · `dayBound(searchParams.get('from'/'to'))` duplicated in the dialog — `urlDateRange` in `date-range.ts`
- [x] fixed · simplify(reuse) · `invoice-download-dialog.tsx` · hand-built Dialog/Header/Footer — `FormDialogShell` (adds the standard „Anuluj", keeps `sm:max-w-dialog`)
- [x] fixed · simplify(reuse+simplification) · `src/lib/i18n/dictionaries/{pl,uk,ru}.ts` · `invoicesDialogTitle` identical to `invoicesAria` in all three — key dropped, title reads `invoicesAria`
- [x] fixed · simplify(simplification) · `invoice-download-dialog.tsx` · counting spinner re-checked `isComplete && !isInverted` that `count()` already guarantees — gated on `isCounting` alone
- [x] fixed · simplify(simplification) · `invoice-download-dialog.tsx` · `{ from, to }` destructure only for a guard — `isClosedRange(range)` narrows instead
- [x] skipped · simplify(simplification) · `invoice-download-dialog.tsx` · `isCounting` as `useTransition` — the transition's pending flag would outlive `disown()` on close and show a stale spinner on a quick reopen; explicit state is clearer
- [x] dismissed · simplify(simplification) · `src/__tests__/lib/queries/fetch-transfers-for-invoices.test.ts:54` · swap rule asserted at action level too — it is the only spec proving the action wires `range` through `withDateRange`
- [x] dropped · simplify(simplification) · `fetch-transfers-for-invoices.test.ts` · two near-identical `beforeEach` blocks — not worth the churn
- [x] dropped · simplify(altitude) · `src/lib/queries/transfer-filters.ts:155` · table passes raw `from`/`to` to the filter while the dialog prefill validates — pre-existing; the picker only writes ISO days, a junk value needs a hand-typed URL
- [x] dropped · simplify(reuse) · `src/components/transfers/transfer-filters.tsx:126` · `hasDateFilter` could use `urlDateRange` — outside the diff and changes what counts as an active filter
- [x] dismissed · simplify(efficiency) · whole diff · no wasted work at this scale — one fetch per completed range, the same rows feed the ZIP
- [x] fixed · comment-noise-audit · `date-range.ts:12`, `invoice-download-dialog.tsx:25-27,77`, `invoice-download-dialog.test.tsx:10`, `transfer-filters.test.ts:258` · restating / narrating comments — deleted or trimmed
- [x] fixed · comment-noise-audit · `fetch-transfers-for-invoices.ts:33` · „widen to all time" was inaccurate (junk matches nothing) — reworded: refused because it would read as an honest empty month
- [x] dismissed · module-cohesion-audit · structure-scatter-audit · tailwind-v4-audit · no findings

## Simplify pass

Ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 6 applied, 1 skipped, 4 dropped/dismissed; each folded into ## Findings (tagged simplify). `primitive-reuse-scan` was not run on its own; the reuse agent's primitive sweep found `FormDialogShell`.

## Tests & suite

- `pnpm typecheck` — green
- `pnpm test` (unit, node + dom) — 548 files / 5705 tests passed, 140 files skipped (DB-backed, run by `test:integration`)
- `pnpm build` — green (compiled, 40/40 static pages)
- lint, `test:integration`, `test:e2e` — not run (not requested)
