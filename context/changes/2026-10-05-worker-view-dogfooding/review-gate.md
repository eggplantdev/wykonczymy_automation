# Review-gate ledger — worker-view-dogfooding · 2026-10-05

Scope: `28bba599..0f896c65` on `staging` (commits 7effd260, 247f6e48, a9fafa0d, f51b3ea8, 0f896c65).
Step 0.5 (browser verification) skipped — no browser pass unprompted; the manual checks wait in
`context/foundation/manual-checks.md` § `2026-10-05 — worker-view-dogfooding`.
Checks run: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`.

## Findings

- [x] 🟡 WARNING · fixed · code-review + impl-review F1 · `src/components/kosztorys/worker-report/report-grid.tsx:40-49` · a negative „Zgłaszam” vanished from the column on a mode switch while „Popraw błędy” kept blocking „Wyślij” — reseed through `parseDecimalInput`, which keeps negatives
      test: test-driven-debugging · unit (dom) — `report-grid.test.tsx` „keeps a negative in the column…”, red before the fix
- [x] 🟡 WARNING · fixed · code-review + impl-review F2 · `src/proxy.ts:15-20` · an old `/zgloszenie-prac/…` link redirected the worker (no account) to `/zaloguj` instead of „link nieaktywny” — catch-all `notFound()` + not-found re-export + proxy allowlist
      test: TDD · unit — `proxy.test.ts` „reaches a worker link from before the move to /z/”; the rendered page is in EX-984 (e2e-backlog)
- [x] 🟡 WARNING · fixed · review gate (follow-up to F2) · `src/proxy.ts:15-20`, `src/app/(share)/p/` · same defect on EX-966's retired `/p/…` rozpiska link: without a session it went to login, against EX-966's own intent („resolves to the not-found page”) — same fix as F2
      test: TDD · unit — `proxy.test.ts` asserts `/p/…` passes, red before the fix; the rendered page is in EX-984
- [x] 🟡 WARNING · fixed · impl-review F3 + code-review · `src/components/kosztorys/editor/grid/report-column.tsx` · dead full-sheet „Zgłaszam”/„Czeka” branch kept alive plus the pending-qty query on every link load — removed the whole chain (`pendingQtyByItem` from db → query → view → form → grid, `pendingColumn`, dictionary keys, the CSS rule)
      test: no automated test · unit — deletion; gated by typecheck + the touched specs
- [x] 🔵 OBSERVATION · fixed · impl-review F4 · `report-grid.tsx:74` · the „Tylko zgłaszane przeze mnie” count left out a negative line — same `parseDecimalInput` fix
      test: test-driven-debugging · unit (dom) — the F1 spec asserts „(1)”
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/kosztorys/worker-report/worker-summary.tsx` · the rozliczenie labels in „Inwestycja” stayed Polish on a uk/ru link (EX-966 scope gap) — through `useTranslation('report')`, 13 keys in pl/uk/ru; the PDF stays Polish on purpose
      test: TDD · unit (dom) — `worker-summary.test.tsx` „speaks the worker’s language”
- [x] 🔵 OBSERVATION · dropped · impl-review F8 · `report-grid.tsx:122` · „Wszystkie prace (+N)” still shows while „Tylko zgłaszane” is on — cosmetic, the investor view behaves the same
- [x] 🔵 OBSERVATION · dropped · code-review · `report-grid.tsx:103,141` · `w-screen` can add a scrollbar's width of horizontal overflow on desktop — pre-existing, cosmetic, phone is the target
- [x] 🔵 OBSERVATION · skipped · code-review · `src/lib/i18n/dictionaries/{uk,ru}.ts` · uk/ru „Лише заявлені” drops the „przeze mnie” — wording is the owner's call, outside the plan
- [x] 🔵 OBSERVATION · dismissed · impl-review F5 · `plan.md` criterion 1.2 · grep wording looks contradictory — intentional negative case
- [x] 🔵 OBSERVATION · dismissed · impl-review F6 · `report-grid.test.tsx` · specs drive the draft + rerender instead of typing — dsg never activates a cell in jsdom; the comment now says so. Also added „ł” to the slug test (`Mieszkanie Białołęka`)
- [x] fixed · impl-review F7 · `change.md`, `manual-checks.md`, `report-viewport.ts`, `toggle-group.tsx`, `kosztorys-editor-domain-notes.md` · stale „Podsumowanie” / `/zgloszenie-prac/` / „Do poprawy…” wording
- [x] fixed · structure-scatter-audit · `AGENTS.md:446` · phone-scope exception still named `(share)/zgloszenie-prac/[name]/[token]`
- [x] fixed · feature-first-structure · `summary/blocks/worker-summary.tsx` → `worker-report/worker-summary.tsx` · its only consumer is the report grid
- [x] fixed · module-cohesion-audit · `worker-view/name-slug.ts` → `worker-links.ts` · the module builds both worker links, not a slug
- [x] fixed · module-cohesion-audit · `row-conditions/queries.ts` → `registry.ts` · `CLIENT_EMPTY_CONDITION_ID` / `REPORT_UNREPORTED_CONDITION_ID` beside the other condition ids
- [x] filed · module-cohesion-audit · `kosztorys-editor-body.tsx` (763 LOC) · god module — already tracked in EX-954
- [x] fixed · comment-noise-audit · `toggle-group.tsx:20`, `kosztorys-editor-body.tsx:122`, `use-kosztorys-view-state.ts:52-53`, `report-grid.tsx:105`, `report-grid.test.tsx` draftOf, `worker-links.ts` doc comment · restatements / vanished state
- [x] dismissed · comment-noise-audit · `worker-summary.tsx:8-9`, `(share)/z/…/page.tsx` · carry a reason / already trimmed
- [x] fixed · code-review · `src/__tests__/setup/dom.ts` · `window.scrollTo` stubbed per spec — once in the dom setup now
- [x] dismissed · tailwind-v4-audit · diff clean; `text-amber-700` only moved
- [x] fixed · simplify (reuse) · `src/components/kosztorys/worker-report/worker-summary.tsx:44` · an unnamed etap read Polish „Etap N” on a uk/ru link — `WorkerStageLineT.label` stays raw, each surface names it through `stageLabel` in its own language
      test: TDD · unit (dom) — `worker-summary.test.tsx` asserts „Етап 2”
- [x] fixed · simplify (reuse + altitude) · `src/lib/kosztorys/print/worker.ts:33-76` · the PDF hard-coded the 13 rozliczenie labels the dictionary now holds — reads `pl.report.summary*`, so screen and paper cannot drift
- [x] fixed · simplify (reuse) · `src/app/(share)/p/[...rest]/page.tsx` · second copy of the retired-link page — re-exports the `zgloszenie-prac` one
- [x] fixed · simplify (simplification + altitude) · `report-grid.tsx:40-49` · the reseed state was derivable from the draft — read straight from `draft.qtyByItem`, the remount key reseeds
- [x] fixed · simplify (simplification) · `report-column.tsx:71-106` · `withReportColumn` took an options object only to early-return on „Inwestycja” — the branch moved into `reportEditorSeams`, helper renamed `compactReportColumns`
- [x] fixed · simplify (simplification) · `manual-checks.md:1515` · evidence cited the deleted `summary/blocks/worker-summary.tsx:47` — now `worker-report/worker-summary.tsx:93`
- [x] skipped · simplify (simplification) · `ReportModeFooter` `createPortal` · possibly unnecessary, but dropping it changes where the footer mounts — unverifiable without a browser pass
- [x] dropped · simplify (simplification) · `MUTED_VALUE` constant, `SHARE_PREFIXES` list for four `startsWith` · cosmetic
- [x] dismissed · simplify (efficiency + altitude) · no findings; the retired-link files fit two prefixes, the remount is not a bandaid
- [x] filed · E2E obligation · `/z/` link sent without a session, mode footer at 390px, uk rozliczenie labels, Podgląd without „Wyślij”, both retired links → „link nieaktywny” — extended into EX-984 (e2e-backlog)

## Simplify pass

Ran /simplify (4 agents) — 6 applied, 0 proposed, 4 dismissed/dropped/skipped; each finding folded into ## Findings (tagged simplify).

## Tests & suite

- typecheck: `src/` clean; the only errors are stale generated `.next-e2e/**/validator.ts` naming the removed `(share)/p/[name]/[token]/page.js` — not source.
- touched specs: 21 files / 191 tests green (+ `proxy.test.ts` 5/5 after the `/p/` fix).
- eslint on changed files: clean.
- after /simplify: typecheck `src/` clean; touched specs 12 files / 88 tests green (print/worker, worker-view summary, worker-report/*, editor-body ×3, actions menu, proxy); eslint clean.
- full suite: deferred by user (pre-push runs it); E2E in EX-984.
