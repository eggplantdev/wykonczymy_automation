# Review-gate ledger — kosz-inwestycji-manager · 2026-09-29

Scope: commits `4681c323` (code + specs), `1f7878fa` (archive note), `71f70a74` (epilogue) on
`staging`, interleaved with another session's commits — reviewed as `git show` of those three, not
a `base...HEAD` range. No new source files.

Step 0.5 (browser verification) skipped: no Playwright without an explicit ask, and the local QA
harness has no MANAGER login. The four boxes stay open in `manual-checks.md`.

## Findings

- [x] 🔵 OBSERVATION · skipped · impl-review · `src/lib/actions/sheets.ts:276` / `linked-sheet-actions.tsx:32` · a MANAGER may now delete an investment forever but still not a linked sheet record — changes what a user may do, so it is the owner's call, not a review fix; surfaced in the close-out
      test: no automated test — no code change
- [x] 🔵 OBSERVATION · dismissed · code-review, impl-review · `src/collections/investments.ts:42` · collection `delete: isAdminOrOwner` is narrower than the app — every app path uses `overrideAccess: true`, the narrower rule fails closed, `/admin` and REST are unused (plan decision „Zostawić")
      test: no automated test — no code change
- [x] dropped · impl-review · `plan.md` criterion 1.3 · its grep also matches `INVESTMENT_UNLOCK_FORBIDDEN_MESSAGE` — intent verified by hand; phase blocks are read-only
- [x] dropped · simplify · `src/__tests__/lib/actions/investment-trash.db.test.ts:17` · session mock duplicates the one in `media-kind.db.test.ts` — two specs with different shapes (settable role vs `mockResolvedValue`); a shared stub's params would equal the code
- [x] dismissed · simplify · `src/lib/queries/trash.ts:19` · `/kosz` guards twice (`requireManagementPage` + `requireAuth`) — the repo's page-redirect + DAL-throw pattern (`szablony`, `pracownicy`); `getCurrentUserJwt` is `cache()`d, so no extra verify
- [x] dropped · simplify · `src/__tests__/lib/actions/*.test.ts` · ~30 action specs mock `requireAuth` and so cannot catch a wrong role list — mock the JWT per spec where the role is the risk (done here); no repo-wide rewrite
- [x] dismissed · comment-noise · slice adds no comments besides the spec header, which carries rationale
- [x] dismissed · structure-scatter, module-cohesion, feature-first · no new files, no moved code
- [x] dropped · tailwind-v4-audit, primitive-reuse-scan · no class or markup changes — the only UI edit removes a conditional

## Simplify pass

Ran /simplify — 1 applied, 0 proposed, 3 dropped/dismissed; each finding folded into ## Findings (tagged simplify). Efficiency: no findings.

## Tests & suite

- typecheck ✓ · lint 0 errors (80 warnings, pre-existing)
- unit: 4 failures predating this slice (`resolve-id.test.ts` CACHE_TAGS, `kosztorys-editor-toolbar.test.tsx`) — none imports a changed module
- integration: 78 files / 380 tests ✓
- after gate fixes: `investment-trash.db.test.ts` 8/8 ✓, `use-nav-links.test.tsx` unchanged since the suite run
- E2E: none owed — the plan routes the trash's browser coverage to EX-874
