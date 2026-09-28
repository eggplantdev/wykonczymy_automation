# Review-gate ledger — e2e-backlog-audit (branch `e2e-backlog-tests`) · 2026-09-15

Scope: the whole uncommitted slice in the worktree
`/Users/konradantonik/workspace/yolo/wykonczymy-worktrees/e2e-backlog-tests` — 18 modified files,
64 new ones (E2E specs + seeds + DOM specs + `audit.md` + one product fix in
`src/components/forms/inspection-form/inspection-form.tsx`).

Step 0.5 (browser verification pass) **skipped**: the standing rule forbids driving Playwright or
`pnpm test:e2e` unprompted, and the slice adds tests rather than app behaviour — the single product
change it carries (`prefillNextDue`) was found by a red DOM test and is guarded by it.

## Findings

<!-- One checkbox per finding, every source folded in. Most-severe first; bug-finding checks keep
     their native severity, structural/style checks stay tag-free. -->

- [x] 🟡 WARNING · dismissed · `test-quality` · `e2e/investment-lock.spec.ts:99` · false positive — line 96 asserts „Zapisz jako szablon" visible immediately before the three negatives
- [x] 🔵 OBSERVATION · dropped · `code-review` · `src/scripts/seed-client-share.ts` · a `media` orphan per E2E run — the preview Blob store is scratch and is periodically re-restored; not worth a cleanup path in a seed
- [x] dismissed · `audit-drift` · `…/audit.md:495` · false positive — the reviewer counted `it(` lines and missed `it.each`; an authoritative per-file vitest run gives 12, matching the audit
- [x] dismissed · `audit-drift` · `…/audit.md:540` · same false positive — the file runs 10, matching the audit (the entry now cites both halves of the split, 8 + 2)
- [x] dropped · `module-cohesion` · `e2e/kosztorys-route-guards.spec.ts:24` · `readGridRow` overlaps `readSummaryFigures` but returns a different shape (one grid's header→cell map vs a page-wide label→joined-string map); unifying them buys indirection, not reuse
- [x] skipped · `module-cohesion` · `e2e/helpers.ts` · 536 lines / ~45 exports, two competing seeding conventions — splitting the seed cluster into its own module is a review-worthy refactor touching every spec's import block; not inside a gate whose subject is the specs themselves
- [x] skipped · `module-cohesion` · 5 seed scripts · the kosztorys fixture ladder (investment → kosztorys → section → items) is copied across all of them — a shared builder is the right shape, but it changes what every new E2E fixture is, which deserves its own review

## Simplify pass

Folded into `## Findings` (tagged `module-cohesion` / `comment-noise` / `code-review`) rather than
kept as a second list. 33 findings: **25 fixed, 3 dismissed, 2 dropped, 2 skipped, 1 dismissed as
already-repaired** — 0 open.

Two findings are deliberately parked as review-worthy refactors rather than filed: splitting
`e2e/helpers.ts` (536 lines / ~45 exports) and hoisting the kosztorys fixture ladder out of the five
seed scripts. Both change what every future E2E fixture looks like, which is its own change, not a
line item in a gate whose subject is the specs.

Two secondary defects surfaced while closing the comment pass and were fixed in the same sweep:
literal U+00A0 / U+202F characters inside two regex literals (`src/__tests__/helpers/money.ts`,
`src/__tests__/components/kosztorys/summary/summary-panel-content.test.tsx`) — `no-irregular-whitespace`
errors, now escaped.

## Tests & suite

- `pnpm exec tsc --noEmit` — clean.
- `pnpm exec eslint` over `e2e/`, `src/__tests__/`, `src/scripts/`, `src/components/forms/inspection-form/`
  — 0 errors (30 pre-existing unused-binding warnings, none from this slice).
- `pnpm exec prettier --check` — clean on every file this slice touched. Five repo files fail
  pre-existing, none of them this slice's doing.
- `pnpm test` (both Vitest projects) — **3612 passed, 298 skipped, 0 failed** across 365 files.
- **`pnpm test:e2e` NOT run** — the standing rule forbids it unprompted (~1 h per pass). Every new
  Playwright spec in this slice is therefore authored-but-unrun by design, and that is the one thing
  this gate does not certify.
