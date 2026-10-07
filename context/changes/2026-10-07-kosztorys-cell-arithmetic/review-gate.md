# Review-gate ledger — kosztorys-cell-arithmetic · 2026-10-07

Scope: `8c31df99^..8c31df99` (merged into `staging` as `243c98da`) — `src/lib/utils/evaluate-arithmetic.ts`
(new), `src/lib/utils/parse-decimal-input.ts`, three specs. Two source files, so the review ran inline in
the main thread rather than as a subagent fan-out; no `className` in the diff, so the Tailwind audit
dropped out. No verification skill pass (Step 0.5) — the manual checks are the browser leg.

## Findings

- [x] 🔵 OBSERVATION · skipped · code-review · `src/lib/utils/parse-decimal-input.ts:31` · a pasted date or
      range (`2024-10-07`, `12-15`) now lands as its arithmetic (2007, −3) where it used to be ignored as
      garbage — skipped: paste and typing deliberately share one parse (`cell-edit.ts` `cellPaste`), a
      sheet copy carries rendered values not expressions, and the result is visible in the cell. Requiring
      `=` on paste only would be an owner call, not a review fix.
      test: no automated test — no behaviour changed
- [x] 🔵 OBSERVATION · skipped · code-review · `src/lib/utils/parse-decimal-input.ts:35` · an expression
      result is rounded to 2 places in every cell, including the subcontractor coefficient, which stores 6
      (`round.ts`) — `=1/3` gives 0,33 there. Skipped: 2 places was the owner's choice for the whole grid;
      a typed plain coefficient keeps full precision.
      test: no automated test — no behaviour changed
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/utils/evaluate-arithmetic.ts:16` · recursive descent
      overflows the stack on thousands of nested `(` and throws out of `onChange` — dropped: needs a pasted
      wall of parentheses, nobody types that.
      test: no automated test — unreachable in practice
- [x] fixed · impl-review · `context/changes/2026-10-07-kosztorys-cell-arithmetic/change.md` · `worktree:`
      pointed at a removed worktree — set to `null`.
- [x] dismissed · impl-review · plan.md Phase 1 · code matches the plan's contract: plain parse first, the
      evaluator only on `invalid`, `roundToCents` reused, `parseDecimalInput`/`toMoney` untouched, the
      worker-report page keeps `parseDecimalInput`.
- [x] dismissed · comment-noise · `evaluate-arithmetic.ts:1-7`, `parse-decimal-input.ts:26-28` · every
      line carries a why (no `eval`, `x` for room dimensions, every comma a separator, rounding vs the
      `decimalText` round trip).
- [x] dismissed · feature-first-structure / module-cohesion / structure-scatter · `src/lib/utils/evaluate-arithmetic.ts`
      · domain-free pure helper beside its only consumer's parse module; one concern per file.

## Simplify pass

Ran inline (two source files) — 0 applied, 0 proposed, 1 dismissed: `parseExpression`/`parseTerm` share a
loop shape, but folding them into a precedence table would cost readability for 8 lines.

## Tests & suite

- vitest, the three specs of this change — 74 passed.
- `pnpm typecheck` — **red, not from this slice**: `src/scripts/load-ai-draft.ts:85` (TS2345, `payload.create`
  falls to the `draft: true` overload), a script from `7f2934cb` feat(kosztorys-ai). Still red after
  `pnpm generate:types`. The run happened in a shared tree where another session had that very file and
  ~15 others dirty (the `kosztorys-przedmiar-aktualny` gate), so it says nothing about this slice — re-run
  once that tree settles. A red typecheck blocks the pre-push leg of a `staging` push.
- `pnpm lint` — 449 errors repo-wide, none in this slice's files (`eslint` on the five touched files: clean);
  the bulk is `.playwright-mcp/` artefacts and pre-existing `src/migrations` / `src/lib` hits.
- Full `pnpm test` / E2E — not run (user chose specs + typecheck + lint).
