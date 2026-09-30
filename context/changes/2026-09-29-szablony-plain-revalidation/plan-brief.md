# Szablony onto plain revalidation (EX-909) — Plan Brief

> Full plan: `context/changes/2026-09-29-szablony-plain-revalidation/plan.md`
> Research: `context/changes/2026-09-29-szablony-plain-revalidation/research.md`

## What & Why

Since EX-893 opening a szablon is a plain read-only page, but szablony still carry EX-876's special
cache path: `presets` expired in `after()` plus two uncached name reads it forces. The path saves no
renders any more, and it leaves `/szablony` stale after browser Back from a new szablon (0/4 in the
baseline). Move szablony onto the same inline revalidation as investments, and prove with a
before/after measurement that nothing got slower.

## Starting Point

Two `expireCollectionsAfterResponse` callers (create, the szablon write tail in `investmentAction`)
and two uncached reads (`getTemplateView`, `getPresetNameForCrumb`). Every other szablon writer
already expires `presets` inline. The before-baseline is recorded in `baseline.md`.

## Desired End State

Every `presets` expiry is inline; the helper, its test, stub and lessons paragraph are gone; page
and crumb read the name from the cached library; Back / „Wróć" list a new szablon without a reload,
guarded by an E2E test; `baseline.md` has an after-section that meets the pass criteria.

## Key Decisions Made

| Decision                    | Choice                                             | Why                                                                            | Source   |
| --------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| Create expiry               | Inline `['presets']`, +1 small `/szablony` render  | Cheap list render; buys cached name reads and a fresh router cache             | Research |
| Template tail               | `revalidateCollections(['presets'], opts)`         | Rides the render the tree write already makes; `opts` keeps `deferRefresh`    | Research |
| Snapshot on a szablon       | Accept +1 render per ≤10 min                       | One path, helper fully deleted                                                 | Plan     |
| Name read                   | `React.cache` over cached `getPresets()`           | 0 queries warm; every szablon writer verified to expire `presets` inline       | Plan     |
| `SKIP_HOOK_REVALIDATION`    | Keep on create                                     | Hook expires only `investments`, which `/szablony` does not read               | Plan     |
| Regression guard            | New E2E test „Nowy szablon → Back" (run on go)     | The stale state is the browser router cache — only a browser sees it           | Plan     |
| After-run                   | Flows 1, 2, 3, 5, 6 on the baseline rig            | Meets the research pass criteria 1:1, with a control flow                      | Plan     |

## Scope

**In scope:** create action, `investmentAction` tail, `revalidate.ts` helper removal + its test and
stub, `presets.ts` reads, szablon page + crumb, `investment-action.test.ts`, `lessons.md`, one E2E
test, `baseline.md` after-run, manual-checks entry.

**Out of scope:** `savePresetAction`'s source re-render, whether a snapshot stamps
`content_edited_at`, stage progress on a szablon (unreachable), any editor/list UI change.

## Architecture / Approach

Phase 1 makes all `presets` expiry inline (safe alone — the uncached reads stay correct). Phase 2
switches the reads to the cache, which is correct only because of Phase 1. Phase 3 guards and
measures.

## Phases at a Glance

| Phase                             | What it delivers                                    | Key risk                                                 |
| --------------------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| 1. Inline expiry, helper deleted  | No `after()` expiry; tests re-pointed               | Dropping `opts` in the tail → +1 render per autosave     |
| 2. Name from the cache            | Page + crumb on one cached read                     | A future writer forgetting `presets` → false 404         |
| 3. Guard + after-run              | E2E test, `baseline.md` after-section, manual checks| Crediting EX-908's saved GET to this change              |

**Prerequisites:** EX-908 merged (done, `e2b1ce60`); test DB with szablony 498–500 or a fresh
`db:import:test` + `seed:e2e`.
**Estimated effort:** one session — ~1 h code, ~40 min after-run.

## Open Risks & Assumptions

- The Back fix relies on the inline revalidation invalidating the client router cache — a hypothesis
  until the after-run's flow 6 passes.
- The cached name read trusts that every szablon writer expires `presets`; verified today, not
  enforced by anything.

## Success Criteria (Summary)

- „Nowy szablon" → Back shows the new szablon on the list, no reload.
- Autosave in a szablon: 1 render per edit, time within noise of the baseline.
- No `expireCollectionsAfterResponse` left in the codebase.
