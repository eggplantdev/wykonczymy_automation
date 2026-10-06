# Review-gate ledger — telmak-invoice-check · 2026-10-06

Scope: `339e01f4...HEAD` on `spike/telmak-invoice-check` (18 files, no untracked). Step 0.5 browser
pass skipped — Playwright is not driven unasked; manual checks live in
`context/foundation/manual-checks.md` § EX-982.

## Findings

- [x] 🟡 WARNING · fixed · code-review/impl-review · `src/components/telmak-check/telmak-check-dialog.tsx:34` · a second package dropped without closing kept the first package's auto range — `rangePicked`: an auto range is re-derived, a hand-picked one is kept
      test: no automated test · e2e — dialog state across two picks; manual check § EX-982 added, browser flow in EX-1008
- [x] 🟡 WARNING · fixed · code-review/impl-review · `src/components/tables/telmak-check.tsx:124` · „Dołącz" stayed after attaching and ran nothing on a failed upload — `uploadFiles` returns success (`src/hooks/use-media-upload.ts:62`), success re-runs the comparison so the row resolves
      test: no automated test · e2e — upload → re-compare crosses client/server/Blob; manual check § EX-982 updated, EX-1008
- [x] 🟡 WARNING · fixed · code-review/impl-review · `src/lib/telmak/compare-telmak.ts:93` · an unreadable document's number did not claim its bookings, so they also showed as „Brak faktury w paczce"
      test: test-driven-debugging · unit — red spec „unreadable: a read number still claims its bookings", now green
- [x] 🟡 WARNING · fixed · code-review/impl-review · `src/components/telmak-check/telmak-check-dialog.tsx:40` · a superseded parse/compare (new pick, range change, close mid-parse) wrote over newer state; preview URLs leaked on unmount — latest-wins via `useLatestRequest`, URL revoke in an effect on `parsed`
      test: no automated test · unit — timing-only race; existing `latest-request` primitive is the tested mechanism
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/telmak/compare-telmak.ts:113` · amount compared on `Math.abs`, so a document booked with the opposite sign read as matching — signed compare
      test: TDD · unit — spec „flags a document booked with the opposite sign"
- [x] 🔵 OBSERVATION · fixed · code-review/impl-review · `src/lib/db/telmak-check.ts:8` · SQL number normalisation trimmed only spaces/newlines, not `\t\r`, unlike the JS side — `btrim(…, E' \t\r\n')`
      test: test-driven-debugging · integration — DB spec note now leads with `\t\n`
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/telmak-check/telmak-check-dialog.tsx:115` · flagged-transfer load ran outside the compare `try`, an error went unhandled — folded into compare's try/catch
      test: no automated test · unit — error toast path, trivially visible
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/telmak/read-package.ts:48` · a rejected `task.promise` skipped `task.destroy()` — awaited inside the `try`
      test: no automated test · unit — pdfjs needs a browser worker
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/db/telmak-check.ts:39` · `t.date` window compared as timestamptz — it is a fetch window with a month of slack; the exact range check runs on the issue date in JS
- [x] 🔵 OBSERVATION · dismissed · code-review/impl-review · `src/lib/queries/telmak-check.ts:13` · server query inputs not schema-validated — management-only, parameterised SQL, client always sends ISO dates
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/telmak/compare-telmak.ts:90` · two documents with the same number in one package — rare, and visible as two rows
- [x] 🔵 OBSERVATION · dismissed · code-review/simplify · `src/components/telmak-check/telmak-check-dialog.tsx:77` · the „nieznany format" toast fires for any rejection, incl. a non-Telmak PDF — every rejection is worth reporting; narrowing it risks hiding a real layout change, and the wording is the accepted UI
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/foundation/manual-checks.md` · KWV „Razem" sign never confirmed on a real document — manual check § EX-982 added
- [x] dismissed · impl-review · E2E for the dialog flow — already filed as EX-1008 (`e2e-backlog`)
- [x] dismissed · tailwind-v4-audit · `src/components/telmak-check/telmak-check-dialog.tsx` · `[94vh]`/`[96vw]` arbitrary values — viewport one-offs, no token fits
- [x] fixed · comment-noise-audit · `src/lib/telmak/*`, `src/lib/db/telmak-check.ts`, `src/lib/queries/telmak-check.ts` · restating JSDoc/comments deleted or trimmed; privacy and sign comments kept
- [x] fixed · feature-first-structure · `src/lib/telmak/check-row.ts` · view-model type + `toTelmakCheckRow` moved out of the table column file
- [x] fixed · module-cohesion-audit · `src/lib/telmak/words-to-amount.ts` · `wordsToAmount` extracted from the parser with its own spec
- [x] dismissed · structure-scatter-audit · `src/components/telmak-check/`, `src/lib/telmak/` · supplier-feature homes, one each — no competing home
- [x] dropped · module-cohesion-audit · `normalizeDocNumber` move — fine where it is, churn only
- [x] fixed · simplify · `src/components/telmak-check/telmak-check-dialog.tsx:40` · hand-rolled run counter → existing `useLatestRequest`
- [x] fixed · simplify · `src/lib/telmak/read-package.ts:57` · pdfjs spawned and compiled a worker per PDF → one `PDFWorker` for the package; `readTelmakPackage` takes the read/fallback loop out of the dialog
- [x] fixed · simplify · `src/components/telmak-check/telmak-check-dialog.tsx:109` · second round trip skipped when nothing is flagged; `result` + transfers `Map` → one `check` state, flagged rows sorted once
- [x] fixed · simplify · `src/lib/telmak/compare-telmak.ts:113` · own `pln`/`sameMoney`/date-window → `formatPLN`, `roundToCents`, `isWithinRange`
- [x] fixed · simplify · `src/lib/telmak/compare-telmak.ts:57` · `check-row` recomputed live total / missing-PDF rows → carried on the result row (`appAmount`, `needsFile`)
- [x] fixed · simplify · `src/lib/telmak/compare-telmak.ts:104` · status taken from push order while `STATUS_ORDER` said the same thing again → one `TELMAK_STATUSES` tuple drives the type, the sort and the worst-issue pick
- [x] fixed · simplify · `src/lib/telmak/compare-telmak.ts:54` · `#id` list and row-number key built 2–3× → `ids`, `rowDocNumber`
- [x] fixed · simplify · `src/lib/telmak/parse-telmak.ts:21` · per-kind labels/sign spread over ternaries → fields on `KINDS`; `money` strips „PLN" itself
- [x] fixed · simplify · `src/lib/telmak/parse-telmak.ts:55` · dd-mm-yyyy → ISO written twice → `plDateToIso`; `unreadableDoc` replaces the hand-built fallback document
- [x] fixed · simplify · `src/lib/db/telmak-check.ts:24` · `type` selected and mapped, never read — dropped
- [x] fixed · simplify · `src/components/tables/transfers.tsx:221` · cancelled-row class copied from the transfers list → `transferRowClassName`, used by both
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
