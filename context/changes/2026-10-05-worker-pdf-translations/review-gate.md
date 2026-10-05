# Review-gate ledger — worker-pdf-translations (EX-988) · 2026-10-05

## Findings

- [x] 🟡 WARNING · skipped · impl-review F1 + code-review · `src/lib/kosztorys/print/worker-columns.ts:64` · „Pomiar — suma etapów…” header ~50–55 chars in a 9mm `c-qty` column may overflow in uk/ru (estimate, not rendered) — needs eyes on a real PDF: uk/ru manual checks now require „bez nachodzenia nagłówków”
      test: no automated test — header overflow is a print-layout property jsdom cannot measure; manual check in `manual-checks.md` § EX-988
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/queries/worker-kosztorys-print-endpoint.ts:23` · side reads start alongside the auth-gated read — the plan accepted the parallel fetch; the side reads (reference data, section translations) leak nothing and the result is discarded on `null`
- [x] 🔵 OBSERVATION · fixed · code-review · `worker-kosztorys-print-endpoint.ts:29` + `kasa/[id]/page.tsx:59` · live+trashed worker lookup duplicated — `findWorkerRef` beside `findInvestmentRef` in `lib/queries/reference-data.ts`
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/kosztorys/worker-report/extra-work-rows.tsx:44` · `h`/`godz`, `m3`/`m³` can show identical translated labels in the picker — harmless (either saves a valid Polish unit) and requires both spellings in one rozpiska
- [x] 🔵 OBSERVATION · fixed · code-review · `src/__tests__/lib/kosztorys/print/worker.test.ts:328` · HTML built at collection time — moved into `beforeAll`
- [x] 🔵 OBSERVATION · dropped · code-review · `draft-extra-works.tsx:18` + endpoint language fallback · untested pass-throughs (`translateUnit` call, `?? DEFAULT_LANGUAGE`) — both legs are covered by `translate-unit` specs; a spec would assert the wiring only
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/print/worker.ts:41` · `workerFooterHtml` took `locale` + `grid` (grid carries the locale) — now reads `grid.locale`
- [x] 🔵 OBSERVATION · dismissed · impl-review F2 · `.next-e2e/types/validator.ts:377` · whole-tree typecheck exits 2 on stale untracked E2E build output — not this change; `src/` clean
- [x] fixed · structure-scatter + module-cohesion + feature-first · `src/lib/kosztorys/sheet-import/columns.ts` `fold`/`foldUnit` · consumed far outside the importer — `DIACRITICS`/`fold`/`SUPERSCRIPT_DIGITS`/`foldUnit` moved to `lib/kosztorys/fold.ts`, 18 importers repointed
- [x] fixed · feature-first · `src/lib/kosztorys/worker-report/translate-tree.ts` + `translate-unit.ts` · second consumer (`print/worker.ts`) — moved to `lib/kosztorys/worker-view/` with their specs
- [x] fixed · comment-noise · `translate-tree.ts:11` · narration trimmed
- [x] fixed · comment-noise · `print/worker-columns.ts:37` · trailing sentence cut
- [x] fixed · comment-noise · `worker-kosztorys-print-endpoint.ts:17` · trimmed
- [x] fixed · comment-noise · `print/worker.test.ts:21` · deleted
- [x] fixed · comment-noise · `translate-unit.ts:19` · second sentence deleted
- [x] dismissed · tailwind-v4-audit · — · no findings

## Simplify pass

Ran as the main-thread mutating pass over the triaged fixes (`fold` promotion, translate-\* move, `findWorkerRef` dedup, footer signature) — 0 further proposals; nothing held back.

## Tests & suite

- Touched pure specs (sheet-import, clean-unit, catalogue-name-fixes, worker-view incl. moved translate-\*, print/worker) — 13 files, 177 passed.
- `tsc --noEmit` — clean.
- Full suite — not run (awaiting user go).
