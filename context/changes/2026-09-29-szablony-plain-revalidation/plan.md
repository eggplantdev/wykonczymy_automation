# Szablony onto plain revalidation (EX-909) Implementation Plan

## Overview

Put szablony on the same cache path as investments: every `presets` expiry happens inline inside
the action, the szablon page and its crumb read the name from the cached library, and
`expireCollectionsAfterResponse` — the EX-876 „second exit" — is deleted with everything that
exists only for it. A before/after measurement on the prod build proves no flow got slower, and
the stale `/szablony` after Back (reproduced 0/4 in the baseline) gets fixed and guarded.

## Current State Analysis

Verified against `staging` at `fae76527` (EX-908 merged in `e2b1ce60`):

- Two callers of `expireCollectionsAfterResponse` (`src/lib/cache/revalidate.ts:62`):
  - `createEmptyPresetAction` (`src/lib/actions/kosztorys-presets.ts:120-138`) — `protectedAction`
    with no tag list, expiry in `after()`.
  - The template tail of `investmentAction` (`src/lib/actions/investment-action.ts:89-92`) —
    `markPresetEdited` + after-response expiry on every successful write into a szablon.
- Two uncached name reads that exist only because of that expiry: `getTemplateView` and
  `getPresetNameForCrumb` (`src/lib/queries/presets.ts:70-87`), consumed by
  `src/app/(frontend)/szablony/[id]/page.tsx:19` and `src/components/nav/template-crumb.tsx:13`.
- Every other szablon writer already expires `presets` inline: `savePresetAction` (`:114`),
  `renamePresetAction` (`:165`), trash / restore / hard delete via `INVESTMENT_TRASH_TAGS` /
  `INVESTMENT_DELETE_TAGS` (`src/lib/cache/tags.ts:66-80`, `src/lib/actions/investment-trash.ts`).
- `listPresets` and `getPresetName` filter the same `liveTemplate()` predicate
  (`src/lib/db/presets.ts:49-55, 145-161`), so the cached list answers „is this a live szablon"
  identically — a trashed szablon still 404s.
- Baseline (`baseline.md`): create renders nothing in its POST, 1 editor render per create;
  cell autosave = 2 renders per edit before EX-908 (expected 1 after it); Back / „Wróć" to
  `/szablony` after create lists the new row **0/4** — the client router cache, not the server
  cache, is stale.

## Desired End State

- No `after()`-based expiry anywhere in `src/lib`; `expireCollectionsAfterResponse`, its test,
  its stub export and its `lessons.md` paragraph are gone.
- „Nowy szablon" expires `presets` inside its POST (one small `/szablony` render), then navigates.
- A write into a szablon expires `presets` inline with the handler's own `opts`, so a
  `deferRefresh` autosave stays deferred.
- The szablon page title and crumb share one cached read per request.
- Browser Back and „Wróć" from a freshly created szablon list it on `/szablony` without a reload,
  and an E2E test holds that.
- `baseline.md` carries an „after" section for flows 1, 2, 3, 5, 6 that meets the pass criteria.

### Key Discoveries:

- `revalidateCollections(slugs, opts)` already exists for the inline path
  (`src/lib/cache/revalidate.ts:38-43`); `investmentAction` receives `opts` as its 5th argument
  (`investment-action.ts:45`) and currently only forwards it to `protectedAction`.
- `fetchReferenceData` (`src/lib/queries/reference-data.ts:45`) is the in-repo pattern for a
  `React.cache` wrapper over a cached read shared by a page and a parallel-route slot.
- A failed create (name taken / in the trash) returns before the expiry, so the dialog's error
  path renders nothing either way (research Open Question 1 — resolved).
- `SKIP_HOOK_REVALIDATION` on create stays: the investments hook would expire only
  `investments`, which `/szablony` does not read (research Open Question 2 — resolved).
- `e2e/kosztorys-presets.spec.ts` has no „Nowy szablon" test — the guard is a new test there.

## What We're NOT Doing

- `savePresetAction` rendering the source kosztorys for a list nobody sees (research §1 #5,
  opposite direction) — out of scope.
- Changing whether a snapshot write stamps `content_edited_at` — the snapshot's +1 render per
  ≤10 min is accepted (decision), not engineered away.
- Stage-progress on a szablon (flow 4) — unreachable in the UI (baseline §4); `opts` is still
  carried for any `deferRefresh` caller.
- Any change to the szablon editor, the `/szablony` list component, or `SKIP_HOOK_REVALIDATION`.
- Running `pnpm test:e2e` unasked — the new test is authored, and run only on the user's go.

## Implementation Approach

Two code phases that each leave the tree consistent, then a verification phase. Phase 1 makes
every `presets` expiry inline, which is what makes a cached name read correct; Phase 2 switches
the reads over. Phase 1 alone is already safe (the uncached reads stay correct under an inline
expiry), so the order is a dependency, not a risk.

## Critical Implementation Details

- **Carry `opts` in the template tail.** The tail must call `revalidateCollections(['presets'], opts)`
  with the same `opts` `investmentAction` received. Dropping it turns every deferred autosave's
  `EXPIRE_NEXT` into an inline `updateTag`, i.e. +1 render in the POST — the one way this change
  can make autosave worse (research §2).
- **After-run comparison excludes EX-908's delta.** Compare flow 3 against the baseline minus the
  trailing GET — expected **1 render per edit** — or EX-908's saving is credited to EX-909
  (baseline §3 ordering note).

## Phase 1: Inline `presets` expiry, helper deleted

### Overview

Both after-response sites expire inline; `expireCollectionsAfterResponse` loses its last caller and
is removed together with its test, stub and docs.

### Changes Required:

#### 1. Create action

**File**: `src/lib/actions/kosztorys-presets.ts`

**Intent**: „Nowy szablon" expires `presets` inside its POST like every other szablon lifecycle
action, so the router cache holding `/szablony` is invalidated by the action itself.

**Contract**: `createEmptyPresetAction` passes `['presets']` as `protectedAction`'s revalidate
list; the `expireCollectionsAfterResponse` call, its comment and the import go.
`SKIP_HOOK_REVALIDATION` stays.

#### 2. Template tail

**File**: `src/lib/actions/investment-action.ts`

**Intent**: a successful write into a szablon expires `presets` inline, riding the render the
tree write already triggers.

**Contract**: inside the `result.success && gate.isTemplate` branch,
`revalidateCollections(['presets'], opts)` replaces `expireCollectionsAfterResponse(['presets'])`.
The comment keeps the `markPresetEdited` rationale (raw SQL, not `payload.update`) and drops the
„pickers expire after the response" sentence, which is false once the tail is inline.

#### 3. Helper removal

**Files**: `src/lib/cache/revalidate.ts`, `src/__tests__/lib/cache/revalidate.test.ts`,
`src/__tests__/stubs/cache-revalidate.ts`

**Intent**: delete the function with no caller, its describe block, and its stub export.

**Contract**: `expireCollectionsAfterResponse` and the `after` import go. The
`revalidateCollections` doc comment's last sentence („The only write that re-renders nothing is
one that invalidates nothing before the response — `expireCollectionsAfterResponse` below.") is
reworded to point at a route handler as the render-free exit (lessons.md EX-597 rule), not
deleted — the `deferRefresh`-relocates-the-render warning above it stays.

#### 4. Action spec

**File**: `src/__tests__/lib/actions/investment-action.test.ts`

**Intent**: the szablon stamp test asserts the inline expiry, and a new case pins that `opts`
travels with it.

**Contract**: the existing „stamps the szablon as edited only when the target is a szablon" case
asserts `revalidateCollections` is called with `['presets']` for a szablon and not for an
ordinary investment; a new case calls `investmentAction` on a szablon with
`{ deferRefresh: true }` and asserts `revalidateCollections(['presets'], { deferRefresh: true })`.
`expireCollectionsAfterResponse` disappears from the imports and `beforeEach`.

#### 5. Lessons

**File**: `context/foundation/lessons.md`

**Intent**: the „Second exit (EX-876)" paragraph (`:685-691`) documents a tool that no longer
exists; the EX-908 paragraph above it lists „an `after()`-expired action" among render-free writes.

**Contract**: delete the „Second exit" bullet; in the EX-908 paragraph drop „an `after()`-expired
action" from the list. Add one sentence to the rule bullet recording why the exit was removed:
it forced every reader that had to see the write to bypass the cache (EX-909).

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/actions/investment-action.test.ts` passes
- `pnpm exec vitest run src/__tests__/lib/cache/revalidate.test.ts` passes
- `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-presets.test.ts` passes
- `grep -rn "expireCollectionsAfterResponse" src context/foundation` returns nothing

#### Manual Verification:

- „Nowy szablon" → „Załóż" opens the new szablon with its name in the crumb, no „Nie znaleziono"
  flash
- A name already taken (other letter case) → toast „Szablon o tej nazwie już istnieje", the dialog
  stays open, the list is unchanged

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Szablon name from the cached library

### Overview

Page and crumb read the name from `getPresets()` through one request-scoped read; both uncached
functions go.

### Changes Required:

#### 1. Cached name read

**File**: `src/lib/queries/presets.ts`

**Intent**: one `React.cache`-wrapped read that finds a live szablon in the cached library by id,
shared by the page and the crumb in the same request.

**Contract**: a new exported read (e.g. `getTemplateName(id: number): Promise<string | undefined>`)
built on `getPresets()`; `getTemplateView` and `getPresetNameForCrumb` are deleted. `getPresetName`
(the db function) stays — `kosztorys-presets.test.ts` and `presets.test.ts` use it. The auth check
stays with the callers: the page already calls `requireManagementPage()`; the crumb keeps its
`requireAuth(MANAGEMENT_ROLES)` guard, moved into `template-crumb.tsx` or kept in a thin wrapper —
whichever keeps the crumb from rendering a name to a non-management role.

#### 2. Page and crumb

**Files**: `src/app/(frontend)/szablony/[id]/page.tsx`, `src/components/nav/template-crumb.tsx`

**Intent**: switch both consumers to the shared read.

**Contract**: page — `notFound()` when the read returns `undefined`, `investmentName` from it.
Crumb — same `Number.isInteger` guard on the param as today, `null` when no name.

### Success Criteria:

#### Automated Verification:

- `grep -rn "getTemplateView\|getPresetNameForCrumb" src` returns nothing
- `pnpm exec vitest run src/__tests__/lib/db/presets.test.ts` passes

#### Manual Verification:

- Opening a szablon from `/szablony` shows its name in the page title and crumb
- A trashed szablon's URL (`/szablony/<id>`) shows „Nie znaleziono"
- Renaming a szablon shows the new name in the crumb after the rename, without a reload
- As EMPLOYEE, `/szablony/<id>` does not render the crumb name

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Regression guard and after-run

### Overview

The stale-Back bug gets its browser-level guard, and the before/after measurement closes the
change's performance claim.

### Changes Required:

#### 1. E2E guard

**File**: `e2e/kosztorys-presets.spec.ts`

**Intent**: pin the bug that slipped through — after „Nowy szablon", browser Back to `/szablony`
lists the new szablon without a reload.

**Contract**: a new test: open `/szablony` → „Nowy szablon" → unique name → „Załóż" → wait for the
crumb with that name → `page.goBack()` → the row with that name is visible, with no `page.reload()`
anywhere in the test. Red evidence is the baseline's MCP reproduction (§6, 0/4); the spec is run
only when the user says so.

#### 2. After-run

**File**: `context/changes/2026-09-29-szablony-plain-revalidation/baseline.md`

**Intent**: record the after-measurement beside the before, same rig and columns.

**Contract**: an `# After` section for flows 1, 2, 3 (small + 1000-item fixture), 5 and 6, rig
identical to the before-run (prod `.next-e2e` build on :3100 via `pnpm test:e2e:warm:server`,
5435 test DB, OWNER `e2e@wykonczymy.test`, Playwright MCP, ≥3 warm runs). Reuses szablony 498–500
if still present. Ends with a verdict per pass criterion:
- flow 1 and flow 5: identical request/render counts, time within noise;
- flow 2: exactly one POST render of `/szablony` added, time-to-visible within noise, no „Nie
  znaleziono" flash;
- flow 3: 1 render per edit (baseline minus EX-908's trailing GET), time within noise;
- flow 6: Back and „Wróć" list the new row.
A regression on any criterion stops the change for a decision, not a silent rollback.

#### 3. Manual-checks registry

**File**: `context/foundation/manual-checks.md`

**Intent**: roll this plan's Manual Verification bullets into the registry under a
`szablony-plain-revalidation (EX-909)` heading, as `/10x-implement` does at the final phase.

**Contract**: one section; the flow-6 check is ticked from the after-run.

### Success Criteria:

#### Automated Verification:

- `e2e/kosztorys-presets.spec.ts` type-checks (covered by the whole-tree `pnpm typecheck`); the
  E2E run itself waits for the user's go
- `baseline.md` has an `# After` section with a verdict line for each of flows 1, 2, 3, 5, 6

#### Manual Verification:

- Browser Back from a new szablon to `/szablony` lists it without a reload
- „Wróć" in the crumb from a new szablon lists it on `/szablony` without a reload
- A cell edit in a 1000-item szablon saves with one render per edit and no visible delay versus
  the baseline

**Implementation Note**: The after-run is the change's acceptance test — do not archive before its
verdict is written.

---

## Testing Strategy

### Unit Tests:

- `investment-action.test.ts`: szablon write → inline `presets` expiry; ordinary investment → none;
  `deferRefresh` carried into the `presets` expiry.

### Integration Tests:

- Existing `kosztorys-presets.test.ts` (DB) covers create / name-taken / trashed-name refusals;
  unchanged, run as a phase check.

### E2E:

- New „Nowy szablon → Back" test in `e2e/kosztorys-presets.spec.ts` (test-plan risk #17: a write
  visible with no reload).

### Manual Testing Steps:

1. „Nowy szablon" → open → Back → new row listed.
2. Same via „Wróć".
3. Rename a szablon, check the crumb.
4. Trashed szablon URL → „Nie znaleziono".

## Performance Considerations

Net expected: create +1 small `/szablony` render inside its POST; snapshot on a szablon +1 render
per ≤10 min; every other flow 0; each szablon page render −2 uncached queries on a warm cache. The
after-run is the proof.

## Whole-tree Gate

Run **once**, after the final phase:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` — only with the user's go (repo rule: no full suite unasked)
- `pnpm test:e2e` for `kosztorys-presets.spec.ts` — only with the user's go

## References

- Research: `context/changes/2026-09-29-szablony-plain-revalidation/research.md`
- Before-baseline: `context/changes/2026-09-29-szablony-plain-revalidation/baseline.md`
- Measurement protocol: `context/changes/2026-09-29-redundant-router-refresh/research.md`
  („Measurement protocol", EX-908)
- `context/foundation/lessons.md:653-695` — EX-597 / EX-908 / „Second exit"
- Linear: EX-909 (from EX-895)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Inline `presets` expiry, helper deleted

#### Automated

- [x] 1.1 `investment-action.test.ts` passes — 94814a9a
- [x] 1.2 `revalidate.test.ts` passes — 94814a9a
- [x] 1.3 `kosztorys-presets.test.ts` passes — 94814a9a
- [x] 1.4 No `expireCollectionsAfterResponse` left in `src` or `context/foundation` — 94814a9a

### Phase 2: Szablon name from the cached library

#### Automated

- [x] 2.1 No `getTemplateView` / `getPresetNameForCrumb` left in `src` — 879fd90b
- [x] 2.2 `presets.test.ts` passes — 879fd90b

### Phase 3: Regression guard and after-run

#### Automated

- [x] 3.1 E2E test authored in `e2e/kosztorys-presets.spec.ts` (run on the user's go)
- [ ] 3.2 `baseline.md` `# After` section with a verdict for flows 1, 2, 3, 5, 6
