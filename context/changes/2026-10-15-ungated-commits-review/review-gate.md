# Review-gate ledger — commits no gate covered, 14.10 14:35 → 18:00 + EX-855 · 2026-10-15

Scope: the code commits on `staging` that sit outside every existing ledger —
`2026-10-14-expense-duplicate-finder` (to `9ca8fadf9`), `2026-10-14-kosztorys-editor-text-size`
(+ its gate fixes `ec3490edb` `e3a20abf0`) and `2026-10-15-staging-sweep-review` (14.10 18:00 →
`d9f419c83`):

- **„Uwagi AI” + „Nowe informacje”:** `f5ab44a87 1a03c8bd8 bd75b00ab f7942a6a3 5e0a7e194`
  (migrations `20261014_1…_3`, already on `origin/main`)
- **media „Do analizy AI” marker:** `bb6dba5ae 8fe92bde6` (+ the AI-kosztorys scripts in
  `context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/`)
- **UI:** `9b27abfca` (Textarea on Safari), `25ff90940` (input shadow), `4e63ba036` (Komentarz AI blank line)
- **scripts/tests:** `8903c275d` (`load-ai-draft.ts`), `cb8474402`
- **EX-855 `03613a901`:** the `db-vercel-postgres` → `db-postgres` swap — authored 13.10, merged 14.10
  17:28; 340 files, almost all a one-line import swap; reviewed on its non-mechanical hunks.

Out of scope: `485964557` / `b7b62700d` EX-1033 — another session's slice with an active `plan.md`;
it gets its own gate. Doc/chore commits touching only `context/` AI-case data are not code-reviewed.
The dirty tree belongs to the in-flight staging-sweep gate and to another session — `/simplify` does
not touch it.

Checks: code-review, comment-noise-audit (flag-only), feature-first-structure + module-cohesion-audit

- structure-scatter-audit, tailwind-v4-audit. `/10x-impl-review` dropped — no `plan.md` behind these
  commits. Step 0.5 browser pass dropped: Playwright only on explicit ask.

## Findings

- [ ] · 🟡 WARNING · fixed (pending green test) · `src/payload.config.ts:66` · nothing listens to the pg `Pool`'s `error` event after the db-postgres swap — Neon dropping an idle client re-emits it on the pool, and an unlistened `error` is an uncaught exception that kills the instance. `onInit: logIdlePoolErrors` (`src/lib/db/log-pool-errors.ts`) now logs it with a `TODO(EX-958) SENTRY-REQUIRED` marker. Box stays open until the spec runs green.
      test: test-driven-debugging · unit — `src/__tests__/lib/db/log-pool-errors.test.ts` (an `error` emit on the pool must not throw, and must be logged); not run yet, because the tests hook needs an explicit ask
- [x] · 🔵 OBSERVATION · fixed · `src/hooks/use-plan-marker.ts` · 8fe92bde6 made the tick „Do analizy AI”, but the gallery button, its toast and its marked state still said „rzut/projekt” — now „Oznacz do analizy AI” / „Plik oznaczony do analizy AI” / „Oznaczony do analizy AI”. The same rename was applied to the `AGENTS.md` cache section and the `lib/queries/investment-assets.ts:46` comment.
      test: no automated test · — copy only; manual check added to `manual-checks.md`
- [x] · 🔵 OBSERVATION · dropped · `src/migrations/20261014_3*` · `down()` doesn't reverse the notes data move — the migration is already applied on prod and run by a human; a reversible down for a one-off ~16-row move isn't worth writing
      test: no automated test · — migration already applied
- [x] · 🔵 OBSERVATION · dismissed · `context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/load-ai-draft.ts:164` · a reload resets the AI stage to „analyzed” — intended: reloading a draft IS a re-analysis; local-only script
      test: no automated test · — local script
- [x] · 🔵 OBSERVATION · dismissed · `src/migrations/20261014_1*` · the enum comment says the value can't be dropped in `down()` — literally true (Postgres has no `DROP VALUE`)
      test: no automated test · — comment only
- [x] · filed `EX-1058` · `src/lib/queries/reference-data.ts:78,137` · every investment's „Uwagi AI” (~80K chars locally, growing with every AI run) goes into `fetchReferenceData` and from there into the client payload of every management page and every `router.refresh()`; no client consumer reads it. Already filed today by the round-trip audit as EX-1058 (notes + aiNotes, ~25-file type ripple); a note about the listing-row part fixed here was appended to it
- [x] · fixed · `src/types/table-rows.ts:62`, `src/lib/queries/shape-investments.ts:112` · 5e0a7e194 put `aiNotes` on the listing row only so the row type-checks against `EditInvestmentDialog`'s full `InvestmentRefT` prop, which the dialog never reads → the prop is now a `Pick` of the nine fields the dialog reads; `aiNotes`, `aiStage` and `materialsNetRate` (dialog-only, no column reads them) were dropped from the row, the shaper and the `investments.test.tsx` fixture, together with the comment that justified them
- [x] · fixed · `src/lib/db/log-pool-errors.ts:4,10` · a hand-rolled `PoolLikeT` + cast where db-postgres already augments `DatabaseAdapter` with `pool: Pool` → `payload.db.pool?.on(...)`; `?.` stays for `disableDBConnect` inits
- [x] · fixed · `src/components/dialogs/media-upload-dialog.tsx:61` · raw muted hint `<p>` → the `Description` primitive (`size="xs" withIcon={false}`), with identical classes
- [x] · fixed · `src/components/ui/textarea.tsx` · comment-noise: dropped the sentence „A caller's `rows` stays the floor.”, which restates `Math.max(rows ?? 0, …)`
- [x] · dropped · `src/lib/constants/investment-ai-stage.ts:68` · `AI_PROGRESS_LABELS.new_information` hand-copies the stage label — `Record<AiProgressStepT, string>` already makes tsc catch a missing entry, and deriving the map needs `Object.fromEntries` plus a cast
- [x] · dropped · `src/components/investments/investment-ai-notes.tsx` · repeats `InvestmentNotes`' three `CollapsibleSection` props — not worth a wrapper
- [x] · dropped · 11 `InvestmentRefT` test fixtures · each needed `aiNotes: ''` although a shared `investment()` factory exists — an old scatter this diff only touched; churn without a behaviour gain
- [x] · dismissed · `src/components/ui/input.tsx` · tailwind audit: `shadow-sm` → `shadow-xs` — it matches the outline buttons' `shadow-sm` on purpose; the soft shadow has a manual check
- [x] · dismissed · structure audits (6) · new files sit where the feature-first rules put them; the flagged exports predate the diff
- [x] · filed `EX-1063` · `src/lib/queries/reference-data.ts:190` (+13 other `-vN` keys) · altitude: hand-bumped `unstable_cache` keys — Next already keys on `cb.toString()`, and what a bump really guards against is a cross-deploy shape/meaning change → a deploy-scoped key wrapper; a ~33-site cache-layer refactor that deserves its own review
- [x] · filed `EX-1064` · `src/hooks/use-plan-marker.ts:37-49` · altitude: the „Do analizy AI” marker lives in two string systems — the dialog is translated (`media` namespace), the gallery button is hard-coded Polish, so a Українська manager sees both languages; the pl/ru/uk dictionaries are dirty with another session's work, so it's blocked now
- [x] · skipped · `src/scripts/load-ai-draft.ts:127` · altitude: make „AI writes only its own columns” a type check (`data: {…} satisfies Partial<AiDraftT>`) — needs `AiDraftT` exported from `src/lib/kosztorys/ai-draft.ts`, which is another session's untracked in-flight file; the fix rides with that session
- [x] · fixed · `src/components/ui/textarea.tsx:18` · altitude: 25ff90940 („soft shadow on text inputs”) gave `Input` `shadow-sm` but not `Textarea` → `shadow-sm` added to `Textarea` on the owner's go (2026-10-15)
- [x] · dismissed · `src/components/ui/textarea.tsx` · altitude: questioned deleting „A caller's `rows` stays the floor” — `Math.max(rows ?? 0, …)` says exactly that; the strip test holds
- [x] · dismissed · efficiency · `textarea.tsx` per-render `split('\n')`, the serial `delete-unreferenced-media` loop (inside `after()`), the serial landing downloads (peak memory on purpose), the three migrations — no user-visible cost

## Simplify pass

Reuse + simplification + efficiency + altitude over the scope. Applied: the typed pool listener, `Description` in the upload dialog, and the `EditInvestmentDialog` `Pick` that drops three dead fields from the listing row. Reference-data payload → EX-1058 (already open, note appended); deploy-scoped cache key → EX-1063; marker i18n → EX-1064. The rest was dropped or dismissed, as above.

## Tests & suite

Not run — the agent tests hook requires an explicit ask. Owed: `pnpm typecheck` (gates the row-field deletion and the `payload.db.pool` typing), `src/__tests__/lib/db/log-pool-errors.test.ts`, `src/__tests__/hooks/use-plan-marker.test.tsx`, `src/__tests__/components/tables/investments.test.tsx`, `src/__tests__/lib/queries/shape-investments.test.ts`.
