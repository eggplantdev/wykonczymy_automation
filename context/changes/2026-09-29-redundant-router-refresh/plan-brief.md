# Redundant `router.refresh()` removal (EX-908) — Plan Brief

> Full plan: `context/changes/2026-09-29-redundant-router-refresh/plan.md`
> Research: `context/changes/2026-09-29-redundant-router-refresh/research.md`
> Baseline: `context/changes/2026-09-29-redundant-router-refresh/baseline.md`

## What & Why

Sixteen client sites call `router.refresh()` after a Server Action whose `updateTag` already renders
the route into the action's POST. Each one costs a second full server render and a second download
of the same flight, with no new data. On a 411-item kosztorys that is ~395 KB decoded per cell edit.
We remove them.

## Starting Point

The baseline, taken on a prod build against the test DB, measured 2 renders per write at every site
and 3 at the catalogue-compare save (K). The control, „Usuń sekcję", which has no refresh, is 1 POST
and 0 GET, and it still updates. That is the target shape.

## Desired End State

Every write shows its result without a reload, from the action's own render: 1 POST and no follow-up
RSC GET. The only `router.refresh()` left is on the three editor dialogs' `catch` path, where a
transport rejection means no render arrived. An after-run on the same fixtures proves the drop site
by site.

## Key Decisions Made

| Decision                    | Choice                                                                                                       | Why (1 sentence)                                                                                      | Source   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | -------- |
| Which sites go              | All 16 success paths                                                                                         | The mechanism and the baseline both show the refresh re-renders warm data with nothing new            | Research |
| L (`handleTreeReplaced`)    | `refetch` flag passed only from the `catch` branches                                                         | A thrown action delivers no flight, so only there is the refresh the one fresh read                   | Plan     |
| P (700 ms trailing refresh) | Delete the timer entirely                                                                                    | The POST (or the `deferRefresh` GET) already carries the totals; the timer doubles the biggest flight | Plan     |
| K's `onSaved`               | Delete the prop end to end                                                                                   | Its one caller only refreshed                                                                         | Plan     |
| Test coverage               | Manual checks + one `e2e-backlog` issue for A–H/K; tighten `kosztorys-grid-writes.spec` to ≤1 fetch per edit | Existing guards cover the risky paths; the rest is the same one-line deletion                         | Plan     |
| Risk anchor                 | Test-plan risk #16 „write not visible after save", added in Phase 1                                          | Manual checks and the backlog issue need a named risk                                                 | Plan     |
| Router mocks in specs       | Remove only where the rendered tree no longer calls `useRouter`                                              | No mock claiming a dependency that is gone; no churn beyond that                                      | Plan     |
| J on staging                | Removed now; staging confirmation as a manual check after the human deploys                                  | Only preview can show the remote-cache race hypothesis, and `62a0590a` already removed its cause      | Research |

## Scope

**In scope:**

- Sites A–P: remove the refresh and the now-unused `useRouter`.
- Reword every comment that names the refresh as the data source.
- The L flag.
- Tighten the grid-writes assertion.
- After-run, manual checks, the backlog issue, and the `lessons.md` rule.

**Out of scope:**

- Any action's revalidation.
- EX-909 (the szablony `after()` expiry).
- `refreshDataAction`.
- New E2E specs.
- Running `pnpm test:e2e` unasked.
- The prefetch-poisoning race (EX-808, rejected).

## Architecture / Approach

The write's response **is** the render. A client refetch belongs only after a write that did not go
through a revalidating action: a route handler, an upload API, a thrown action, or an
`after()`-expired action. Remove layer by layer (forms/lists → sheets → editor). The editor goes last
because it holds the one contract change and the restore-latch timing. `resolve()` fires before the
action's tree commits, so the latch armed after `await` still lands on the action's own render.

## Phases at a Glance

| Phase                                    | What it delivers                                                                        | Key risk                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1. Risk anchor + forms, transfers, trash | Risk #16; J, E, I, F, G, H without the refresh                                          | J was re-added once on an unreproduced diagnosis                                                  |
| 2. Sheet actions                         | A, B, C, D without the refresh                                                          | Watch item: row state painted ~150–200 ms after the old GET                                       |
| 3. Kosztorys editor                      | K, M, N, O, P removed; L behind a `catch` flag; spec tightened                          | Restore latch must still remount on the action's render; the clear empty state lagged the old GET |
| 4. After-run + checks + docs             | Before/after delta per site, `manual-checks.md`, `e2e-backlog` issue, `lessons.md` rule | A site not dropping to 1 render is a finding                                                      |

**Prerequisites:** the baseline done (✓); the test DB on 5435 with the baseline fixtures (inv 383,
384, 389, 390, 391, 149, 386; kosztorys 44).
**Estimated effort:** ~1 session for Phases 1–3 (deletions + comment rewording), ~1 session for
the after-run.

## Open Risks & Assumptions

- **Latch timing:** if a restore or reload stops remounting the body, research Open Q3 was wrong.
  Stop and report; don't re-add an unconditional refresh.
- **Watch items:** A/B row state and the L clear empty state were painted after the refresh GET.
  They must still appear from the POST.
- **J on Vercel:** local proof can't rule out a remote-cache ordering issue. The staging manual
  check closes it.

## Success Criteria (Summary)

- Every touched write is visible without a reload, with 1 POST and 0 non-prefetch RSC GET.
- The after-run shows the render count per write halved (K: 3 → 1; P: no trailing GET).
- The editor's replace-tree flows still remount, and a thrown clear/reload/import still refetches.
