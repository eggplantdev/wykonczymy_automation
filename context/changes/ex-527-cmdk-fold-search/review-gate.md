# Review-gate ledger — EX-527 cmdk fuzzy→substring fold search · 2026-07-18

Scope: extract the diacritic/case fold filter out of `command.tsx` into a shared `src/lib/utils/fold-text.ts`; close the `ł` caveat (explicit `ł→l`/`Ł→L` fold so `lodz` matches „Łódź"); unit-spec `foldText`/`foldFilter`. The behavior change (cmdk fuzzy-subsequence → contiguous substring) was already live; EX-527 is its verify+harden follow-up.
Files: `src/lib/utils/fold-text.ts` (new), `src/__tests__/lib/utils/fold-text.test.ts` (new), `src/components/ui/command.tsx` (inline → import).
Fan-out: `/code-review` + `comment-noise-audit` + file-org audits (module-cohesion, feature-first, structure-scatter). Dropped: `/10x-impl-review` (no plan.md), `tailwind-v4-audit` (no styling touched).
Manual verification: delegated to a second agent (owner, 2026-07-18) — the 5 cmdk consumers eyeballed in-browser. Archive-blocking until it signs off.

## Findings

<!-- one checkbox per finding; most-severe first -->

- [x] fixed · code-review · `fold-text.test.ts` · test-coverage gap — asserted letters covered `ś ć ó ź ł` but never `ż ą ę ń`; added a pangram case (`foldText('Zażółć gęślą jaźń') → 'zazolc gesla jazn'`) exercising all 9 diacritics. code-review verified the fold is correct for all 18 letters; this just guards it.
      test: TDD · unit — the added assertion IS the guard.
- [x] fixed · comment-noise · `fold-text.ts:12` · `foldFilter` header restated "diacritic/case-insensitive contiguous substring match (returns 1/0)" — the code + `? 1 : 0` already say it. Trimmed to keep only the WHY (replaces cmdk's fuzzy scorer that drops accented options).
- [x] 🔵 dismissed · code-review · cmdk relevance ranking · a hard 1/0 collapses cmdk's descending-score sort to source/DOM order. All 5 consumers are small alphabetical/source-ordered option lists (not fuzzy palettes), so deterministic order is fine — arguably better. Verified against cmdk 1.1.1 internals (`score > 0` = match). Benign.
- [x] 🔵 dismissed · code-review · empty/whitespace query · cmdk short-circuits `search === ''` before the filter (never hits `''.includes`); a trailing-space query matching nothing mirrors the old subsequence scorer — not a regression.
- [x] dismissed · efficiency (simplify) · `fold-text.ts:14` · `foldFilter` re-folds `search`/`value` per keystroke; memoizing via a Map cache is premature at 5 small lists (sub-ms, unbounded-growth risk). The `/\p{Diacritic}/gu` regex is a module literal (compiled once). Leave as-is.
- [x] dismissed · reuse/altitude/cohesion/scatter (simplify + audits) · no existing diacritic/slugify/normalize helper to reuse (grep confirmed — `sheet-configs.normalize` is trim+lowercase only, `sanitize-filename` deliberately KEEPS diacritics); `src/lib/utils/fold-text.ts` is the correct first home; `ł→l` sits at the right depth (inside the one fold primitive); `foldFilter`-as-`Command`-default pre-existed this diff and fits all 5 Polish-label consumers.

## Simplify pass

Ran /simplify (4 angles: reuse / simplification / efficiency / altitude) — **all clean, 0 applied, 0 proposed**. Findings folded above (tagged simplify/efficiency, all dismissed). The 2 fix-now items (pangram test, comment trim) came from the review fan-out and were applied directly before /simplify. No separate report file.

## Tests & suite

- unit (`fold-text.test.ts`): 7 passed (was 6; +1 pangram) — re-run after the fixes
- lint (eslint, 3 changed files): green
- typecheck (`tsc --noEmit`): green
- full suite (test:e2e / build): fast legs only (per the same-session decision) — no e2e surface for a pure string util; browser behavior owned by the manual pass below.

## Archive status

**In review — NOT archived.** Findings ledger is fully closed (all `[x]`), but blocker #2 is open:

- **Manual verification pending** — EX-527 is a _verify_ ticket; its core is eyeballing the 5 cmdk consumers (form-combobox, transfers filter-select/multi-select, preset dialog, kosztorys `Widok ▾`) with accent-free Polish input. Owner delegated this to a second agent (2026-07-18); not yet signed off. Archive unblocks when that agent confirms.
- The behavior change to sanity-check in-browser: cmdk fuzzy-subsequence → contiguous substring (`wrs` no longer hits „Wartość rows"). Unit-locked; needs the human/agent eyeball for the per-consumer UX call.
