# Review-gate ledger — EX-909 szablony-plain-revalidation · 2026-09-30

Base `a12d4a55` (merge-base with `staging`), branch `szablony-plain-revalidation`, worktree
`wykonczymy-worktrees/szablony-plain-revalidation`. Fan-out: `/10x-impl-review`, `/code-review`,
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`
(no `.tsx` styling in the diff → `tailwind-v4-audit` dropped). Step 0.5 (browser verification) not
run — the Playwright browser is never driven unasked; its boxes live in `manual-checks.md` § EX-909.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `context/foundation/manual-checks.md` · § EX-909 lacked the crumb, the nonexistent/trashed szablon 404 and the EMPLOYEE no-crumb checks — added
- [x] 🟡 WARNING · fixed · code-review · `src/__tests__/lib/actions/investment-action.test.ts:127` · the stamps test never asserted that an ordinary investment skips the `presets` expiry — `not.toHaveBeenCalled()` added
      test: TDD · unit — the assertion is the guard; green
- [x] 🟡 WARNING · fixed · code-review · `e2e/szablony-list.spec.ts` · the Back-shows-the-new-szablon E2E was appended to `kosztorys-presets.spec.ts`, whose fixtures it doesn't share — moved to its own spec
      test: TDD · e2e — the spec itself is the regression guard for EX-909; authored, run owed (3.2)
- [x] 🟡 WARNING · fixed · feature-first-structure / structure-scatter-audit · `src/components/nav/template-crumb.tsx:13`, `src/app/(frontend)/szablony/[id]/page.tsx:15` · hand-rolled id validation beside `investment-id.ts`; the role gate sat in the crumb instead of the query — now `isInvestmentId` / `parseInvestmentId`, and `getTemplateName` gates itself like `getInvestmentName`
      test: no automated test · — covered by the existing `investment-id` spec and manual checks 7–8
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/queries/presets.ts` · a `listPresets` read in flight across an inline `updateTag` can store a pre-write entry — millisecond window, ~5 users, and the next szablon write heals it; not worth a lock
      test: no automated test · — race not reproducible deterministically
- [x] 🔵 OBSERVATION · dismissed · impl-review · `context/foundation/lessons.md` · plan said delete the EX-876 bullet; it was rewritten instead — it still carries the „Otwórz szablon" return-the-state rule, so a rewrite is the right call
- [x] fixed · impl-review · `src/lib/cache/revalidate.ts` · doc still named the deleted `after()` exit as a second route — reworded to the route-handler case only
- [x] fixed · code-review · `src/lib/actions/investment-action.ts:88` · comment claimed the tree write re-renders the route, contradicting the `deferRefresh` the next line forwards — rewritten to say the expiry follows the caller's `deferRefresh` (raised again by the simplify altitude pass)
- [x] fixed · comment-noise-audit · `src/lib/actions/kosztorys-presets.ts`, `src/lib/queries/presets.ts`, `e2e/szablony-list.spec.ts` · narration trimmed to the why (inline expiry vs Back, cached-name safety, no reload in the spec)
- [x] dismissed · module-cohesion-audit · `src/lib/queries/presets.ts` · flagged mixed concerns — list, picker and name reads share one cache tag and one liveness predicate; cohesive
- [x] dismissed · simplify · `src/components/nav/template-crumb.tsx:13` · guard then `Number(id)` re-parses — the guard keeps junk ids off the auth + library read; intended
- [x] dismissed · simplify · `src/lib/queries/presets.ts` · `getTemplateName` scans the whole library for one name — deliberate: shares the `presets` tag instead of an uncached single-row read; ~65 rows
- [x] dropped · simplify · `src/app/(frontend)/szablony/[id]/page.tsx:22` · `name === undefined` vs the crumb's `!name` — an empty szablon name can't be saved; cosmetic
- [x] dismissed · simplify · `src/app/(frontend)/szablony/[id]/page.tsx:19` · run the name read inside the tree's `Promise.all` — `buildKosztorysTree` throws on an unknown id, so parallel turns the 404 into the error page; kept serial with a why-comment
- [x] dismissed · simplify · `src/lib/queries/presets.ts` · page checks the role twice (`requireManagementPage` + `getTemplateName`) — `getCurrentUserJwt` is React-`cache`d, second check is free; gate-in-query is the repo's crumb pattern
- [x] dismissed · simplify · `src/lib/actions/investment-action.ts:91` · second expiry call beside `protectedAction`'s list — `isTemplate` is only known after the gate runs; no general form without widening `protectedAction`

## Simplify pass

Ran /simplify (reuse / simplification / efficiency / altitude) — 1 applied, 0 proposed, 6 dismissed/dropped; each folded into ## Findings (tagged simplify).

## Tests & suite

- `pnpm exec tsc --noEmit` — clean (after the simplify pass).
- `investment-action`, `revalidate`, `investment-id` specs — 30/30.
- `kosztorys-presets.test.ts` (DB, 5435) — pass.
- Full `pnpm test` — 416 files / 4532 tests passed, 0 failed (83 files skipped, env-gated).
- `e2e/szablony-list.spec.ts` — **not run, blocked by worktree infra**, not by the slice. Turbopack
  rejects the symlinked `node_modules` ("points out of the filesystem root"). The lessons.md fallback,
  `next build --webpack`, fails Next's build type check on the untouched
  `(payload)/admin/[[...segments]]/page.tsx`, most likely because Payload's types resolve through the
  symlink twice. `tsc --noEmit` is clean. Run it from a real checkout; plan 3.2 stays open until then.
