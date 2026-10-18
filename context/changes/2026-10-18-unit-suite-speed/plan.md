# Unit Suite Speed Implementation Plan

## Overview

Cut the pre-push unit leg (`node` + `dom` vitest projects, 175 s wall / 725.8 user CPU-s) by running
mock-free specs in shared module graphs, prebundling the dom project's heaviest dependencies, and
moving the most-mocked dom modules to setup-level seams so most dom specs qualify for the shared
project. Then overlap `typecheck` (8–21 s) with the single-worker integration leg.

## Current State Analysis

- `vitest.config.ts` runs `node` (419 files) and `dom` (162 files) fully isolated: ~0.58 s import per
  node file, `date-fns` alone 66 % of dom import (`research.md` §5).
- Whole-project `--no-isolate` fails: node 18 files, dom 124 of 162 — RTL auto-cleanup registers once,
  per-file `vi.mock`s leak into later files, and the toast `vi.fn` cached by the first importer is not
  the one later specs assert.
- The research draft split (isolated + shared) gave 121 s; with the dom prebundle 103 s / 373 CPU-s.
  That draft isolated every spec with `vi.spyOn` or a `toastMessage` reference too.
- `db-shared` (test-suite-speed) proved the pattern: `setup/db.ts` registers pass-through seams on
  `globalThis.dbSeams`, resets them per file, restores spies `afterAll`.
- dom mocks (78 of 162 files call `vi.mock`, none `vi.doMock`): top modules are
  `use-kosztorys-editor-context` 18, `@/lib/actions/transfers` 13, `submit-with-uploads` 7,
  `@/lib/actions/kosztorys` 7, `scan-receipt-client` / `ingest-files` / `worker-expense-drafts` /
  `use-current-user` 6, `react-resize-detector` / `@/lib/actions/investments` 4,
  `kosztorys-actions-context` 3, plus ~40 single-use `'use server'` modules.
- Classification: 84 mock-free; 28 mock only top modules; 50 mock something else, 28 of which mock
  only extra `'use server'` modules. With action seams + top-module seams: ~140 shared, 22 isolated.

## Desired End State

- Projects `node`, `node-shared`, `dom`, `dom-shared`, `db`, `db-shared`. A spec lands in a shared
  project unless its source calls `vi.mock` / `vi.doMock` or touches `require.cache` /
  `_resolveFilename`; `vi.spyOn` no longer isolates it.
- The dom setup owns everything a shared jsdom window would otherwise leak between files.
- `'use server'` exports in component specs are registered `vi.fn`s that throw by default; a spec
  steers one with `vi.mocked(action).mockResolvedValue(...)` instead of `vi.mock`.
- The top dom modules are seams in `setup/dom.ts`; ~140 of 162 dom specs run shared.
- `pnpm test` passes, passes under `--sequence.shuffle` twice, and is measurably cheaper than the
  research baseline (175 s / 725.8 CPU-s); the pre-push typecheck no longer adds its own wall time.

### Key Discoveries:

- `setup/db.ts:8-33` — `passThrough` + `globalThis.dbSeams`: the seam registry to extract and reuse.
- `setup/db.ts:83-86` resets seams in `beforeAll`. dom specs steer seams and set `navigationState` /
  `authState` at **module top level**, which runs after the setup file but before `beforeAll` — a
  `beforeAll` reset would wipe that steering. Per-file resets go at the setup file's top level.
- Vitest 4 creates the environment once per worker and skips `mocker.reset()` between files under
  `isolate: false` (`vitest/dist/chunks/base.CJ0Y4ePK.js:80-91`): one jsdom window, one `document`,
  one `localStorage` serve every file in a worker.
- Shared-window leaks found: `navigationState` (22 specs assign it, 10 at top level, e.g.
  `investments.test.tsx:12`), `authState` (`mobile-nav-language.test.tsx:15`),
  `useOptimisticFormStore` (11 specs reset only `keepOpen` or `openFormId`),
  `window.location` (`pending-expense-drafts.test.tsx:248` leaves `?status=pending`),
  `navigator.clipboard` (`investor-actions:21`, `kosztorys-workers-menu:68`). localStorage users
  already clear it; `vi.stubGlobal` users already unstub.
- `optimistic-form-store.ts:3` imports `toastMessage` once — the toast mock must hand every importer
  the same instance: `toastMessage: (globalThis.domToast ??= vi.fn())`. No spec gives it an
  implementation; 5 call `mockClear`/`mockReset` on it.
- None of the top-module factories uses `importOriginal`. Editor/actions context factories return a
  fixed object built from spec-level variables → `vi.mocked(hook).mockImplementation(() => ({…}))`.
  `submit-with-uploads` differs per file → per-file `mockImplementation`. `scan-receipt-client` is an
  identical `vi.fn()` everywhere (`expense-form-prefill` steers it).
- `use-current-user` cannot be a global stub: `transfer-data-table-language.test.tsx`,
  `transfer-card-columns.test.tsx` and `hooks/use-nav-links.test.tsx` render the real
  `CurrentUserProvider`. It becomes a pass-through seam the 6 specs steer to
  `stubs/use-current-user`.
- Server-action factories default to `vi.fn()` (resolves `undefined`) or
  `vi.fn(async () => ({ success: true }))`; the kosztorys hook specs list 10–15 actions as `vi.fn()`
  only so nothing throws. A throw-by-default seam surfaces each such reliance as a failing call —
  fix by adding the explicit resolved value in that spec.
- Vitest 3+ `mockReset()` restores the implementation passed to `vi.fn(impl)` — the db seams already
  rely on this.

## What We're NOT Doing

- `db:dump` / lever 5 and every E2E lever — explicitly out of scope.
- Seaming node-project mocks (`payload` 22, `get-db` 15, `get-current-user-jwt` 14…): node specs only
  gain the split + spyOn relaxation.
- The 22 dom specs whose extra mocks are one-off components/hooks (`column-order-dialog`,
  `use-nav-links`, `use-file-archive`, `push-client`, …) stay in the isolated `dom` project.
- No `--pool=threads` (no gain, `research.md` §5) and no `date-fns` subpath rewrite (overlaps the
  prebundle).
- No change to what any spec asserts.

## Implementation Approach

Phase 1 lands the split with the current mock-free set plus spyOn/toast specs and hardens the dom
setup for a shared window — the measurable bulk (~54 s). Phase 2 adds the prebundle (~18 s). Phases 3
and 4 grow `dom-shared` by deleting per-file `vi.mock`s: the partition reads the source, so a spec
whose last `vi.mock` is gone moves to `dom-shared` by itself. Phase 5 is the pre-push overlap.

## Critical Implementation Details

- **Reset at top level, not `beforeAll`.** Seam `mockReset`, `navigationState`, `resetAuthState()`,
  the optimistic store and `window.history.replaceState(null, '', '/')` run at `setup/dom.ts` top
  level so they precede the spec's own top-level steering. Moving `setup/db.ts`'s reset to top level
  in the extraction is safe (setup still runs before the spec module).
- **Action stubs keep throwing by default.** The plugin keeps its error message; it only wraps it in a
  `vi.fn` registered on `globalThis` so the setup can `mockReset` every stub per file. The transformed
  module imports `vi` from `vitest`.

## Phase 1: Shared node + dom projects

### Overview

Run every spec that never calls `vi.mock` / `vi.doMock` in an `isolate: false` project, and make the
dom setup safe for a shared jsdom window.

### Changes Required:

#### 1. Partition and projects

**File**: `vitest.config.ts`

**Intent**: Generalize the `db` partition to node and dom; add `node-shared` and `dom-shared`
(`isolate: false`). Isolate on `vi.(mock|doMock)(` or `require.cache` / `_resolveFilename`; drop
`vi.spyOn` and toast references as isolation reasons.

**Contract**: six projects named `node`, `node-shared`, `dom`, `dom-shared`, `db`, `db-shared`. A
project with an empty `include` must not fail the run (the isolated `db` project already collects
zero files).

#### 2. Dom setup for a shared window

**File**: `src/__tests__/setup/dom.ts`

**Intent**: Make every file start from the same window state.

**Contract**:

- `@/lib/utils/toast` factory returns `{ toastMessage: (globalThis.domToast ??= vi.fn()) }`.
- Top level, per file: reset `navigationState` to its defaults, `resetAuthState()`, reset
  `useOptimisticFormStore` to its full initial state, `window.history.replaceState(null, '', '/')`.
- `afterEach(() => { cleanup(); document.body.innerHTML = '' })`.
- `afterAll(() => vi.restoreAllMocks())` (spies from a file's last test).

#### 3. Node setup

**File**: `src/__tests__/setup/node.ts`

**Intent**: `afterAll(() => vi.restoreAllMocks())` so spyOn specs can share.

#### 4. Project lists

**Files**: `package.json` (`test`, `test:watch`, `test:coverage`), `.husky/pre-push:72`

**Intent**: Select the four unit projects. Touch nothing else in pre-push.

#### 5. Harness doc

**File**: `src/__tests__/AGENTS.md`

**Intent**: The "DB spec that never calls `vi.mock` runs in `db-shared`" bullet now holds for node
and dom too; document the dom per-file resets (state a spec may set at top level) and that toast is a
single shared instance.

### Success Criteria:

#### Automated Verification:

- `ALLOW_TESTS=1 pnpm exec vitest list --project node-shared --project dom-shared` collects ≥ 357 node
  and ≥ 84 dom files
- `ALLOW_TESTS=1 pnpm test` passes
- `ALLOW_TESTS=1 bash scripts/with-test-lock.sh pnpm vitest run --project node-shared --project dom-shared --sequence.shuffle` passes

#### Manual Verification:

- None — test harness only, no app behaviour change.

---

## Phase 2: Dom prebundle

### Overview

Prebundle `date-fns` and `react-day-picker` for both dom projects.

### Changes Required:

#### 1. Optimizer

**File**: `vitest.config.ts`

**Intent**: `deps: { optimizer: { client: { enabled: true, include: ['react-day-picker', 'date-fns'] } } }`
on `dom` and `dom-shared` (shared constant).

### Success Criteria:

#### Automated Verification:

- `ALLOW_TESTS=1 bash scripts/with-test-lock.sh pnpm vitest run --project dom --project dom-shared` passes

#### Manual Verification:

- None — test harness only.

---

## Phase 3: Server-action seams

### Overview

Turn the plugin's throwing stubs into registered `vi.fn`s so a component spec steers an action
without `vi.mock`, then convert the specs whose remaining mocks are only `'use server'` modules.

### Changes Required:

#### 1. Plugin

**File**: `vitest.config.ts` (`stubServerActions`)

**Intent**: Emit each export as a `vi.fn` with the current throwing implementation, pushed onto a
`globalThis` registry; module evaluation is once per worker in shared projects, so the registry only
serves the reset.

**Contract**: export names and the error text unchanged; a spec writes
`vi.mocked(createTransferAction).mockResolvedValue(...)`.

#### 2. Reset

**File**: `src/__tests__/setup/dom.ts`

**Intent**: `mockReset` every registered action stub at top level, per file.

#### 3. Spec conversion

**Files**: dom specs whose `vi.mock`s are all `@/lib/actions/*` / `@/lib/queries/*` server modules
(transfers, kosztorys, worker-expense-drafts, investments, template-trash, lead-assets, … — ~28 plus
those that also mock Phase-4 modules, which convert their action mocks now).

**Intent**: Replace each action `vi.mock` with `vi.mocked(...)` steering where the spec configures
it, or an explicit `mockResolvedValue(undefined)` / `({ success: true })` where the old factory's
default was load-bearing. Hoisted `vi.fn`s the spec asserts become the imported action itself.

### Success Criteria:

#### Automated Verification:

- Every converted spec passes: `ALLOW_TESTS=1 pnpm exec vitest run <file>`
- `ALLOW_TESTS=1 bash scripts/with-test-lock.sh pnpm vitest run --project dom --project dom-shared` passes
- `vitest list --project dom-shared` collects ≥ 112 files

#### Manual Verification:

- None — test harness only.

---

## Phase 4: Top-module seams

### Overview

Seam the remaining top mocked modules in the dom setup and convert the specs.

### Changes Required:

#### 1. Shared seam helper

**File**: `src/__tests__/setup/seams.ts` (new), `src/__tests__/setup/db.ts`

**Intent**: Extract `passThrough` + the `globalThis` registry from `setup/db.ts` into one helper both
setups use (one registry key per setup); db and dom reset their seams at top level.

#### 2. Dom seams

**File**: `src/__tests__/setup/dom.ts`

**Intent**: Pass-through seams for `use-kosztorys-editor-context` (`useKosztorysEditorContext`),
`kosztorys-actions-context`, `submit-with-uploads`, `scan-receipt-client`, `use-current-user`
(`useCurrentUser`). `react-resize-detector` and `ingest-files` become setup-wide stubs **only if no
mock-free dom spec imports them**; otherwise they are seams too.

**Contract**: a spec steers with `vi.mocked(useKosztorysEditorContext).mockImplementation(...)`;
`use-current-user` specs steer to `stubs/use-current-user`'s `useCurrentUser`.

#### 3. Spec conversion

**Files**: the 18 editor-context, 3 actions-context, 7 submit-with-uploads, 6 scan-receipt-client,
6 ingest-files, 6 use-current-user, 4 react-resize-detector specs.

**Intent**: Delete the `vi.mock` and move its factory into a top-level or `beforeEach`
`mockImplementation`. A spec keeping any other `vi.mock` stays isolated — fine.

#### 4. Harness doc

**File**: `src/__tests__/AGENTS.md`

**Intent**: List the dom seams and the server-action steering next to the existing setup-mock bullet;
"`vi.mock` the action explicitly" becomes "steer it with `vi.mocked`".

### Success Criteria:

#### Automated Verification:

- Every converted spec passes: `ALLOW_TESTS=1 pnpm exec vitest run <file>`
- `vitest list --project dom-shared` collects ≥ 135 files
- `ALLOW_TESTS=1 pnpm test:integration` passes (db setup now uses the extracted helper)

#### Manual Verification:

- None — test harness only.

---

## Phase 5: Typecheck alongside integration

### Overview

Hide `tsc`'s wall time behind the single-worker integration leg.

### Changes Required:

#### 1. Pre-push

**File**: `.husky/pre-push`

**Intent**: Drop the leading `typecheck` leg; when the integration leg starts, run
`pnpm run typecheck` in the background with output to a `mktemp` file; after integration, `wait` on
it, print the output, and fail via the same `✗ pre-push FAILED at:` message if it failed. Leave the
`db:dump` block untouched.

**Contract**: a type error still fails the push, before parity runs; a failed integration leg still
exits immediately (the background `tsc` dies with the hook or is waited on — no orphan).

### Success Criteria:

#### Automated Verification:

- `bash -n .husky/pre-push`
- Hook logic exercised with a stub: a deliberate type error in a scratch copy run makes the
  typecheck branch report `FAILED` (no real push)

#### Manual Verification:

- Next real push prints the typecheck output after the integration leg and the total hook time drops
  by roughly the typecheck duration.

---

## Testing Strategy

### Unit Tests:

- No new specs: the existing suite is the regression guard for every conversion. A conversion that
  changes what a spec asserts is wrong.

### Integration Tests:

- `pnpm test:integration` after Phase 4 (shared seam helper).

### Manual Testing Steps:

1. Push once after Phase 5 and read the hook output order.

## Performance Considerations

Compare against the research baseline (`research.md` §5: 175 s wall, 725.8 user CPU-s), not a fresh
"before". Machine load stays 6–50 from other agents — report user CPU-s alongside wall.

## Whole-tree Gate

- Type checking passes: `ALLOW_TESTS=1 pnpm run typecheck`
- Lint passes on touched files: `ALLOW_TESTS=1 pnpm exec eslint <touched files>`
- Full unit suite passes: `ALLOW_TESTS=1 pnpm test`
- Shuffled shared projects pass twice: `ALLOW_TESTS=1 bash scripts/with-test-lock.sh pnpm vitest run --project node-shared --project dom-shared --sequence.shuffle` (×2)
- After-measurement recorded in `$CHANGE_DIR/baseline.md`: two `pnpm test` runs, wall + user CPU-s +
  load average, against 175 s / 725.8 CPU-s

## References

- Research: `context/changes/2026-10-18-test-suite-speed/research.md` §5, §6, levers 6/10/11
- Seam pattern: `src/__tests__/setup/db.ts:8-90`
- Prior plan: `context/changes/2026-10-18-test-suite-speed/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared node + dom projects

#### Automated

- [x] 1.1 Shared projects collect ≥ 357 node and ≥ 84 dom files — a0b78ca6b
- [x] 1.2 `pnpm test` passes — a0b78ca6b
- [x] 1.3 Shuffled shared projects pass — a0b78ca6b

### Phase 2: Dom prebundle

#### Automated

- [x] 2.1 dom + dom-shared pass with the optimizer — 37146326b

### Phase 3: Server-action seams

#### Automated

- [x] 3.1 Converted specs pass individually — 81c340c1a
- [x] 3.2 dom + dom-shared pass — 81c340c1a
- [x] 3.3 dom-shared collects ≥ 112 files — 81c340c1a

### Phase 4: Top-module seams

#### Automated

- [x] 4.1 Converted specs pass individually — 87d34b94f
- [x] 4.2 dom-shared collects ≥ 135 files — 87d34b94f
- [x] 4.3 `pnpm test:integration` passes — 87d34b94f

### Phase 5: Typecheck alongside integration

#### Automated

- [x] 5.1 `bash -n .husky/pre-push`
- [x] 5.2 Typecheck failure path reports FAILED
