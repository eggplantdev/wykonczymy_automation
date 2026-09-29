# Review-gate ledger — kosz-szablonow (EX-914) · 2026-09-29

Scope: `086e83b4..9aba2180` (5 commits, 87eab3f4 → 9aba2180). No untracked slice files.
Step 0.5 (browser verification) skipped — Playwright MCP is only driven on an explicit ask; the
manual pass lives in `context/foundation/manual-checks.md` § EX-914.

Fan-out: `/10x-impl-review` (APPROVED — 0 critical · 1 warning · 5 observations), `/code-review`
(no bugs — 3 observations + 4 cleanups), `tailwind-v4-audit` (clean), `feature-first-structure` +
`module-cohesion-audit` + `structure-scatter-audit` (clean), `comment-noise-audit` (flag-only, 6
items). Then `/simplify` (4 angles) and `primitive-reuse-scan`.

## Findings

- [x] 🟡 WARNING · fixed · impl-review F1 + code-review · `src/__tests__/lib/actions/kosztorys-presets.test.ts` · szablon restore never asserted it comes back whole — new „a szablon restored from the trash comes back whole" spec: name, status, sections/items/snapshots counts unchanged, absent from `listPresets` while trashed, listed again after
      test: TDD · integration (DB) — the spec IS the guard for test-plan risk #15
- [x] 🔵 OBSERVATION · fixed · impl-review F2 · `src/__tests__/lib/actions/investment-trash.db.test.ts` · wrong-name delete-forever untested — the refusal now loops over no name and `'zła nazwa'`
      test: TDD · integration (DB) — added in the same spec
- [x] 🔵 OBSERVATION · fixed · impl-review F6 + code-review · `src/components/trash/delete-forever-dialog.tsx`, `src/components/presets/preset-row-actions.tsx:24` · fallback toasts worded for an investment — `failed` entry per copy object; row action says „Nie udało się przenieść szablonu do kosza"
      test: no automated test — fallback copy only, reached when `res.error` is undefined
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/actions/investment-trash.ts:20`, `src/lib/investments/delete-investment-forever.ts:5` · `MISSING_MESSAGE` / `NOT_TRASHED_MESSAGE` say „Inwestycja" for a szablon — reachable only from a stale tab; neutral wording would blur the investment case for the common path
      test: no automated test — wording only
- [x] 🔵 OBSERVATION · skipped · code-review · `src/lib/actions/kosztorys-presets.ts:92-105` · „Nadpisz" checks the target is live outside the transaction; a trash in the ms gap writes into a trashed szablon — recoverable through its „Przed nadpisaniem" version, the pre-change hard delete had the same race class
      test: no automated test — a millisecond race is not worth a test
- [x] 🔵 OBSERVATION · dismissed · impl-review F5 · `src/lib/actions/kosztorys-presets.ts:60` · a stale tab on a trashed szablon can still be a „Zapisz jako szablon" source — the deliberately ungated source (documented at :60); worst case a duplicate, never loss; a trashed investment behaves the same
      test: no automated test — accepted design
- [x] 🔵 OBSERVATION · dismissed · impl-review F3 · `src/__tests__/lib/actions/kosztorys-presets.test.ts` · cascade assertion rewritten in place instead of moved to `investment-trash.db.test.ts` — coverage intact; it now shares `rowCounts` with the restore spec, which is the better home
- [x] 🔵 OBSERVATION · fixed · impl-review F4 + code-review · `src/lib/db/presets.ts` · live-szablon predicate spelled twice (aliased queries inlined it) — one `liveTemplate(alias?)`, now the only handle (simplify dropped the `LIVE_TEMPLATE` alias)
- [x] fixed · main-thread · `src/components/trash/delete-forever-dialog.tsx` · slice reordered the typed-name description — restored `askReason` first, so the investment text is byte-identical to before
- [x] fixed · comment-noise · `src/components/trash/delete-forever-dialog.tsx:24-25` · comment restating why a szablon asks for its name — deleted (the copy + server rule say it)
- [x] fixed · comment-noise · `src/lib/actions/kosztorys-presets.ts:154` · „The UPDATE only says nothing renamed" narration — deleted
- [x] fixed · comment-noise · `src/lib/actions/kosztorys-presets.ts:135-136` · owner-only comment trimmed to the rationale that survives the strip test
- [x] fixed · comment-noise · `src/__tests__/lib/actions/investment-trash.db.test.ts:124-125` · comment restating the test name — deleted
- [x] fixed · comment-noise · `src/__tests__/lib/actions/kosztorys-presets.test.ts:534` · comment restating the test name — deleted
- [x] fixed · comment-noise · `src/__tests__/components/presets/preset-row-actions.test.tsx:9-10` · vanished-state „not the old hard delete" — trimmed
- [x] fixed · main-thread · `context/changes/2026-09-29-kosz-pozostalych-encji/research.md` · committed unformatted in cc1d40b8 (`--no-verify`) — prettier applied
- [x] fixed · simplify · `src/lib/kosztorys/create-template.ts`, `src/lib/actions/kosztorys-presets.ts` · three hand-written holder→message mappings and a second vocabulary (`'name-taken' | 'name-in-trash'`) — `createTemplate` returns `PresetNameHolderT`; one `nameHeldError` serves all three sites
- [x] fixed · simplify · `src/lib/actions/kosztorys-presets.ts` · `presetIdSchema` left with one user after `deletePresetAction` went — inlined into the rename schema
- [x] fixed · simplify · `src/components/trash/delete-forever-dialog.tsx` · typed-name rule negated on the client (`!used && !isTemplate`) vs `isTemplate || used` on the server — `mustTypeName` spelled the server's way
- [x] fixed · simplify · `src/__tests__/lib/actions/kosztorys-presets.test.ts`, `src/__tests__/lib/db/presets.test.ts` · two spec-local „put in trash" UPDATEs — `trashDaysAgo(db, id, 0)` from `@/__tests__/helpers/investment`
- [x] fixed · reuse-scan · `src/__tests__/lib/actions/kosztorys-presets.test.ts` (cascade), `src/__tests__/lib/actions/investment-trash.db.test.ts:126` · raw `SELECT name` for a live szablon — `getPresetName(db, id)`, as `presets.test.ts` already does
- [x] skipped · simplify (altitude) · `src/components/trash/*`, `src/lib/actions/investment-trash.ts:109-111` · kind is one `isTemplate` boolean branched in four files, and the typed-name rule lives on client + server — a `kind` + `TRASH_KINDS` table and a per-kind `MUST_TYPE_NAME` SQL fragment are the shape EX-915 (Flota) must build anyway; design note posted on EX-915
- [x] dropped · simplify (altitude) · `src/lib/db/catalogue-usage.ts:16`, `src/lib/queries/reference-data.ts:73` · „live real investment" predicate hand-spelled twice — pre-existing, two sites (the third, `snapshots.ts:82`, also excludes locked, so it is a different predicate), and `catalogue-usage.ts` is another session's in-flight file
- [x] dropped · simplify (efficiency) · `src/lib/cache/tags.ts:66` · `INVESTMENT_TRASH_TAGS` expires `presets` on an investment trash and `investments` on a szablon trash — rare click-driven writes, the tags.ts comment already weighs it; a per-kind split costs more than the recompute
- [x] dropped · code-review · `src/components/presets/preset-row-actions.tsx` · `setConfirmingTrash(false)` after the await is redundant — mirrors `TrashInvestmentButton`, harmless
- [x] dropped · code-review · `src/components/presets/preset-row-actions.tsx` · dedup against `TrashInvestmentButton` — the props would be the whole body (copy, toast, refresh); no win
- [x] dropped · code-review · `src/components/trash/trashed-investment-actions.tsx:22-25` · restore-toast copy outside the dialog's copy map — folded into the EX-915 kind-table note rather than a module now
- [x] dropped · code-review · `src/lib/db/presets.ts` · exporting `PresetNameHolderT` questioned — now load-bearing (`createTemplate`'s return type)
- [x] dismissed · suite · `src/__tests__/resolve-id.test.ts` · „CACHE_TAGS values follow collection: prefix" fails on `kosztorysSnapshots: 'table:kosztorys-snapshots'` — introduced by 0a9745fc (investor-change-history), not this slice
- [x] dismissed · suite · `src/__tests__/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.test.tsx` · 3 tests throw `sections.length` of undefined in `KosztorysAddMenu` — 2cee8858 (kosztorys-empty-section p3) added the prop without updating the spec; not this slice
- [x] filed · e2e · browser path /szablony → do kosza → /kosz „Szablony" → przywróć → usuń na zawsze (z nazwą) — filed EX-923 (`e2e-backlog`, related EX-874, EX-914)

## Simplify pass

Ran /simplify (reuse / simplification / efficiency / altitude) — 5 applied, 1 skipped, 3 dropped;
each folded into ## Findings (tagged `simplify`). No separate report. `primitive-reuse-scan` — 1
applied (tagged `reuse-scan`).

## Tests & suite

- typecheck (`tsc --noEmit`): clean
- eslint on touched files: clean
- DOM: `src/__tests__/components/trash/` + `preset-row-actions.test.tsx` — 3 files, 7 tests green
- DB (5435): `presets.test.ts`, `kosztorys-presets.test.ts`, `actions/investment-trash.db.test.ts`,
  `db/investment-trash.db.test.ts` — 4 files, 58 tests green
- `pnpm test` (fast legs, user's pick — no E2E): 4437 passed, 4 failed in 2 files, both from other
  changes (see the two `suite` findings)
- E2E: not run — deferred into EX-923

Archive blocked: `manual-checks.md` § EX-914 is unticked.
