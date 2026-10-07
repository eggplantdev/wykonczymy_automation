# Review-gate ledger — telmak-invoice-check · 2026-10-06

Scope: `339e01f4...HEAD` on `spike/telmak-invoice-check` (18 files, no untracked). Step 0.5 browser
pass skipped — Playwright is not driven unasked; manual checks live in
`context/foundation/manual-checks.md` § EX-982.

## Findings

- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/db/telmak-check.ts:39` · `t.date` window compared as timestamptz — it is a fetch window with a month of slack; the exact range check runs on the issue date in JS
- [x] 🔵 OBSERVATION · dismissed · code-review/impl-review · `src/lib/queries/telmak-check.ts:13` · server query inputs not schema-validated — management-only, parameterised SQL, client always sends ISO dates
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/telmak/compare-telmak.ts:90` · two documents with the same number in one package — rare, and visible as two rows
- [x] 🔵 OBSERVATION · dismissed · code-review/simplify · `src/components/telmak-check/telmak-check-dialog.tsx:77` · the „nieznany format" toast fires for any rejection, incl. a non-Telmak PDF — every rejection is worth reporting; narrowing it risks hiding a real layout change, and the wording is the accepted UI
- [x] dismissed · impl-review · E2E for the dialog flow — already filed as EX-1008 (`e2e-backlog`)
- [x] dismissed · tailwind-v4-audit · `src/components/telmak-check/telmak-check-dialog.tsx` · `[94vh]`/`[96vw]` arbitrary values — viewport one-offs, no token fits
- [x] dismissed · structure-scatter-audit · `src/components/telmak-check/`, `src/lib/telmak/` · supplier-feature homes, one each — no competing home
- [x] dropped · module-cohesion-audit · `normalizeDocNumber` move — fine where it is, churn only
- [x] skipped · simplify · `src/lib/db/telmak-check.ts:8` · make the SQL number match a loose superset (whitespace-free `position`) and drop the mirror — changes which rows the query returns; current mirror is pinned by the DB spec
- [x] dropped · simplify · `src/lib/telmak/read-package.ts` · worker pool / parallel parse — only if a real package still reads slowly after the shared worker
- [x] dropped · simplify · `src/lib/queries/telmak-check.ts` · merge the two server calls into one — skipping the empty call covers the common case
- [x] dismissed · simplify · `src/components/telmak-check/telmak-check-dialog.tsx:44` · `useObjectUrls` — needs a parallel `File[]` state; current single effect + superseded-run revoke is already one owner
- [x] dismissed · simplify · `TelmakDocT.fileName` / `kind` unused outside parser — `fileName` is what the EX-449 capture will log; `kind` is asserted by the parser spec
- [x] dismissed · simplify · `src/lib/telmak/read-package.ts` O(n²) line grouping, `pkg.find` per row, `indexOf` in sort — n≈100, microseconds
- [x] dropped · simplify · `src/lib/telmak/parse-telmak.ts:52` · rename `money` (clashes with the Zod helper name) — local, no import collision

## Simplify pass

Ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 11 applied, 3 dropped, 3 dismissed, 1 skipped; each finding folded into ## Findings (tagged simplify). No separate report.

## Tests & suite

- typecheck (`tsc --noEmit`) — clean
- eslint on touched files — clean
- telmak unit + DB specs (`src/__tests__/lib/telmak`, `telmak-check.db.test.ts` vs 5435) — 49 passed
- upload-hook DOM specs (4 files) — 14 passed; transfers-table specs (4 files) — 18 passed
- full `pnpm test` / `test:integration` / `test:e2e` — deferred by user rule (never unasked); build green earlier in the run
- E2E — deferred to EX-1008
