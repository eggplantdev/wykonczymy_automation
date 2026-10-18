# Test Suite Speed (levers 1 + 2) Implementation Plan

## Overview

Cut the two largest fixed costs left in the pre-push DB legs:

- **Lever 1:** move the 22 isolated `db` specs into `db-shared`, which shares one module cache. Saves ~30–34 s per `test:integration` run.
- **Lever 2:** build the 5435 test DB by cloning a Postgres `TEMPLATE` instead of re-importing the 243 MB dump. Saves ~25 s per `test:parity` run and ~50 s on pushes that change migrations. It also gives every integration run a clean DB.

## Current State Analysis

- **How specs are sorted.** `vitest.config.ts:50` sends every `*.db.test.ts` whose source matches `/\bvi\.(mock|doMock|spyOn)\(/` to the isolated `db` project. Each of those files pays ~1.2 s of module import: 26.9 s in total for 22 files. All 135 `db-shared` files together pay 4.4 s.
- **What `setup/db.ts` does today.** It mocks only the session (`get-current-user-jwt` → stub, `beforeAll(resetAuthState)`). `setup/node.ts` mocks `next/server`'s `after` (queued, run with `flushAfter()`) and `@/lib/cache/revalidate`.
- **Mock defaults in this config.** `clearMocks` and `restoreMocks` are on (`vitest.config.ts`). In Vitest 4, `restoreMocks` restores `vi.spyOn` spies only, and only _before each test_. It never touches a `vi.fn`'s implementation.
- **What keeps the 22 files isolated** (research §1):
  - **A (4 files):** `vi.spyOn(payload, …)` inside a test — `account-credentials`, `transfers`, `db/worker-expense-drafts`, `worker-report-scan`.
  - **B (7 files):** a pass-through wrapper over one domain export that fails on a flag. The wrapped exports are `settleReport`, `serializeTemplate`, `applyCatalogueWrite`, `placeCatalogueItems`, `serializeKosztorys` (2 specs) and `seedInvestmentFromPreset`.
  - **C (11 files):** external services:
    - `translateTexts` / `translateToPolish`;
    - `getInvestmentSheet`, `getReadonlySheetsClient`, `readImportGrids`;
    - `extractReceipt(s)` and `fetchMediaBytes`;
    - `reclaimUnreferencedMedia`;
    - `syncBulkExpensesToSheet` and `notifyPendingPayouts`.

    `settle-payouts` also overrides `next/server`'s `after` so the task runs inline.

- **How the test DB is reset today.**
  - `db:reset:test` (`package.json:22`) runs `db:import:test` (drop schema, 7.6 s `psql` import, sequences, 4.5 s migrate) and then three seeds (14.7 s). `test:parity` runs it on every push; measured 27.3 s.
  - `scripts/test-integration.sh:8-22` also runs it when a migration fingerprint stamp (`dumps/.test-db-schema-stamp`) changes. Otherwise integration runs on whatever an earlier E2E run or manual check left in the DB. That is the likely cause of the one-off `db/notifications` failure (research §3).
- **Postgres version.** The test container runs Postgres 17.7, so `DROP DATABASE … WITH (FORCE)` and `CREATE DATABASE … TEMPLATE …` are available. Measured: template create 1.23 s, clone 1.41 s.

## Desired End State

- **`pnpm test:integration`:**
  - starts from a fresh clone of a seeded template;
  - runs all 157 DB specs in `db-shared`, leaving the `db` project empty;
  - finishes in roughly 35–40 s of vitest time instead of ~70 s.
- **`pnpm test:parity`:** spends ~2–3 s on the DB reset instead of 27 s, except when the template is rebuilt.
- **When the template is rebuilt:** only when a migration or one of the three seed scripts changes, when the template is more than 7 days old, when it is missing, or on `pnpm db:template:test`.
- **Leaks:** a `vi.spyOn`, a seam override or a mocked return value set in one file never reaches the next file. This is proven by green shuffled runs.

### Key Discoveries:

- `vitest.config.ts:50`: the sorting regex. `:66` and `:94` carry stale boot-time comments (they claim a 9–10 s cold boot; measured 0.2–0.45 s).
- `src/__tests__/setup/db.ts`: the home of every global DB seam. `resetAuthState` is the per-file reset pattern to mirror.
- `src/__tests__/lib/actions/settle-payouts.db.test.ts:13-21`: its own `next/server` mock clashes with the global `after` stub in `setup/node.ts`.
- Several mock-free `db-shared` specs import seam modules directly: 10 import `serialize-kosztorys`, 3 import `worker-reports` and 1 imports `seed-from-preset`. Every seam must therefore be transparent by default.
- Pre-push runs the integration leg, then parity, then `db:dump` (`.husky/pre-push:76,82,85`). The dump changes on every push, so a template keyed on the dump would never be reused.

## What We're NOT Doing

- E2E levers 3, 4, 7, 8 and 9: warm server, build skip, parallel group, combo wait, E2E reset from the template.
- Moving `db:dump` off the critical path (lever 5), and the failing backup Action.
- Running typecheck alongside integration (lever 6).
- Unit suite (node + dom) work. Its research is still pending.
- Changing `db:import:test`. It stays the raw dump import that manual verification uses.
- Trimming individual `db-shared` tests.

## Implementation Approach

The template comes first. Every later verification run then starts from the same clean DB, so any failure while moving specs is caused by the move, not by leftover data.

The spec moves use a single mechanism:

- **Global seams.** `setup/db.ts` replaces each seam export with `vi.fn(realExport)`. The wrapper is transparent until a spec overrides it with `vi.mocked(x).mockRejectedValueOnce(…)` / `.mockImplementation(…)`.
- **Per-file reset.** An explicit list of seams is reset (`mockReset()`, which in Vitest 4 restores the wrapped real implementation) in `beforeAll`, before every file.
- **Spies.** A file's leftover `vi.spyOn` is restored in `afterAll`.

## Critical Implementation Details

- **Reset the seams by explicit list, never `vi.resetAllMocks()`.** Some shared stubs configure a `vi.fn` with `mockResolvedValue` when the module is created. A global reset would wipe that for every later file in `db-shared`.
- **Hook order is what makes the per-file reset safe.** Setup-file hooks register before the spec's own hooks, so a spec's `beforeAll` / `beforeEach` override always lands after the reset.
- **Why `afterAll` and not only `restoreMocks`.** `restoreMocks` runs only before each test. A spy created in a file's last test would otherwise still be live during the next file's `beforeAll`, which creates fixtures through `payload.create`.
- **Connections during the template copy.** `CREATE DATABASE … TEMPLATE x` fails while any session is connected to `x`. Terminate the source's backends first, run both statements from the `postgres` maintenance DB, and drop the target `WITH (FORCE)`.

## Phase 0: Baseline

### Overview

Measure before touching anything, on the commit the implementation starts from, so each later phase is compared against numbers taken the same way on the same machine.

### Changes Required:

#### 1. Baseline record

**File**: `context/changes/2026-10-18-test-suite-speed/baseline.md` (new)

**Intent**: Freeze the "before" numbers and the exact commands that produced them, so the after-measurement can repeat them exactly.

**Contract**:

- Record the commit sha, the date, and whether anything else ran on the machine at the time.
- Take 2 runs of each command below and record their median:
  - `pnpm test:integration`, with wall-clock time (`/usr/bin/time -p`) plus vitest's `Duration` / `import` / `tests` lines;
  - the per-project split: one `--project db` run and one `--project db-shared` run through `scripts/test-integration.sh`'s vitest invocation;
  - `pnpm test:parity`, with wall-clock time and the `db:reset:test` share measured separately (`time pnpm db:reset:test`).
- Add a results table with a "before" column, then one column per phase as each phase lands, ending with "after".

### Success Criteria:

#### Automated Verification:

- `baseline.md` exists with median before-numbers for integration (total + per project), parity and `db:reset:test`.

#### Manual Verification:

- None.

**Implementation Note**: When the baseline is recorded, commit and continue.

---

## Phase 1: Test DB from a template clone

### Overview

`db:reset:test` keeps its name and callers. It now makes sure a fresh template exists, then clones `wykonczymy-test` from it. Integration starts from a clone too.

### Changes Required:

#### 1. Template script

**File**: `scripts/test-db-template.sh` (new)

**Intent**: Own the template lifecycle in one place so `package.json` scripts stay one-liners.

- `ensure` rebuilds the template only when it's stale.
- `clone` gives the test DB a fresh copy.
- `--force` rebuilds unconditionally.

**Contract**:

- **Fingerprint.** `git hash-object` over `src/migrations/*.ts`, the three seed scripts (`perf-seed-kosztorys.ts`, `seed-deposit-planes.ts`, `seed-materials-net.ts`) and `scripts/reset-sequences.sql`.
- **Where the fingerprint lives.** It is stored with the build date as `COMMENT ON DATABASE "wykonczymy-test-template"`.
- **When the template counts as stale:**
  - it doesn't exist;
  - its fingerprint differs;
  - it is more than 7 days old;
  - `--force` was passed.
- **Rebuild:**
  1. If `dumps/dump-latest.sql` is missing, run `pnpm db:dump` (the guard moves here from `test-integration.sh`).
  2. Run `db:import:test` and the three seeds against `wykonczymy-test`.
  3. Terminate the backends connected to `wykonczymy-test`.
  4. Drop the old template and create it again `TEMPLATE "wykonczymy-test"`.
  5. Write the comment.
- **Clone:** `DROP DATABASE "wykonczymy-test" WITH (FORCE); CREATE DATABASE "wykonczymy-test" TEMPLATE "wykonczymy-test-template"`, run via `docker exec … psql -d postgres`.
- **Logging:** print one line saying whether the template was reused or rebuilt, and why.

#### 2. package.json scripts

**File**: `package.json`

**Intent**: Route the existing reset through the template and add a forced rebuild.

**Contract**:

- `db:reset:test` → `bash scripts/test-db-template.sh ensure && bash scripts/test-db-template.sh clone`. `db:template:test` (new) → `bash scripts/test-db-template.sh ensure --force`.
- `test:parity` is unchanged (it already calls `db:reset:test`).
- `db:import:test` is unchanged.

#### 3. Integration entry

**File**: `scripts/test-integration.sh`

**Intent**: Start every integration run from a clean clone, which replaces the stamp logic.

**Contract**:

- Remove the `STAMP` / `FINGERPRINT` / `SENTINEL_MISSING` block and run `pnpm db:reset:test` unconditionally.
- Forward `"$@"` to the vitest invocation so a shuffled run can pass `--sequence.shuffle.files --sequence.seed=N`.
- The misnamed-spec guard and `--no-file-parallelism` stay.

#### 4. Docs

**Files**: `src/__tests__/AGENTS.md` (golden-master bullet), `AGENTS.md` (Databases → E2E line)

**Intent**: The docs currently say parity "re-imports and re-seeds". Change that to say both DB legs clone the test DB from a template. Add one line saying when the template is rebuilt and that `pnpm db:template:test` forces a rebuild.

**Contract**: Two sentences in total. Leave `db:import:test` mentions that are about manual verification as they are.

### Success Criteria:

#### Automated Verification:

- Cold: `pnpm db:template:test` builds the template, and `psql -d postgres -c '\l+'` shows `wykonczymy-test-template` carrying the fingerprint comment.
- Warm: a second `pnpm db:reset:test` reports "reused" and takes under 5 s.
- Changing the stored comment to an old fingerprint makes the next `db:reset:test` rebuild.
- `pnpm test:parity` passes on a cloned DB.
- `pnpm test:integration` passes, and its log shows the clone step instead of the stamp message.

#### Manual Verification:

- None. The phase is test-infrastructure only, with no app-visible change.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Group A — `vi.spyOn` specs into `db-shared`

### Overview

`vi.spyOn` no longer forces a spec into the isolated project. A file's leftover spies are restored after the file.

### Changes Required:

#### 1. Sorting regex and stale comments

**File**: `vitest.config.ts`

**Intent**: Drop `spyOn` from the mock regex. Rewrite the two boot-time comments (`:66` `hookTimeout`, `:94` `db-shared`) to what's true today, or delete them if nothing non-obvious is left to say.

**Contract**: `/\bvi\.(mock|doMock)\(/`. The `db` project stays, empty once phase 4 lands, as the escape hatch for a spec that truly needs a per-file module mock.

#### 2. Per-file spy restore

**File**: `src/__tests__/setup/db.ts`

**Intent**: Restore every spy at the end of each file so the next file's `beforeAll` sees the real `payload`.

**Contract**: `afterAll(() => vi.restoreAllMocks())`. In Vitest 4 this restores spies only and leaves `vi.fn` seams alone.

#### 3. Harness rule

**File**: `src/__tests__/AGENTS.md`

**Intent**: Update the `db-shared` bullet. `vi.spyOn` is now allowed in a DB spec; only `vi.mock` / `vi.doMock` moves a spec into the isolated project.

**Contract**: One edited bullet.

### Success Criteria:

#### Automated Verification:

- The 4 group-A specs run under the `db-shared` project. Check with `vitest list --project db-shared`, or from the project label in the run output.
- `pnpm test:integration` passes twice in a row.
- `bash scripts/with-test-lock.sh bash scripts/test-integration.sh --sequence.shuffle.files --sequence.seed=<random>` passes.
- Integration vitest duration is recorded in `## Progress`.

#### Manual Verification:

- None (test harness only).

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Group B — domain pass-through seams

### Overview

The six wrapped domain exports become global seams. The seven specs drop their own `vi.mock` and steer the seam through `vi.mocked`.

### Changes Required:

#### 1. Seam registration and reset

**File**: `src/__tests__/setup/db.ts`

**Intent**:

- Register one `vi.mock` per module, using `importOriginal`, that spreads the real module and replaces the named export with `vi.fn(actual.export)`.
- Extend the per-file `beforeAll` to `mockReset()` exactly these seams.

**Contract**: Seams:

- `@/lib/db/worker-reports` → `settleReport`
- `@/lib/kosztorys/templates/serialize-template` → `serializeTemplate`
- `@/lib/kosztorys/work-catalogue/write-catalogue-entry` → `applyCatalogueWrite`
- `@/lib/kosztorys/work-catalogue/place-catalogue-items` → `placeCatalogueItems`
- `@/lib/kosztorys/serialize-kosztorys` → `serializeKosztorys`
- `@/lib/kosztorys/seed-from-preset` → `seedInvestmentFromPreset`

The reset list grows in phase 4. If it outgrows `setup/db.ts`, move the list and its reset function into `src/__tests__/stubs/db-seams.ts` next to the existing stubs.

#### 2. Spec rewrites

**Files**:

- `src/__tests__/lib/actions/accept-worker-report.db.test.ts`
- `src/__tests__/lib/actions/kosztorys-presets.db.test.ts`
- `src/__tests__/lib/actions/kosztorys-add-item.db.test.ts`
- `src/__tests__/lib/actions/catalogue-to-kosztorys.db.test.ts`
- `src/__tests__/lib/actions/kosztorys-restore-lost-write.db.test.ts`
- `src/__tests__/lib/kosztorys/replace-tree-lost-write.db.test.ts`
- `src/__tests__/lib/actions/create-investment-preset.db.test.ts`

**Intent**: Replace each `vi.hoisted` flag + `vi.mock` with an override on the imported seam:

- **`failNext` / `shouldThrow`:** use `mockRejectedValueOnce`.
- **`brokenId`:** use a `mockImplementation` that branches on the argument and otherwise calls `vi.importActual`'s real export.
- **`onSnapshotRead` hook:** use a `mockImplementationOnce` that awaits the real `serializeKosztorys` with every argument forwarded, then runs the hook.

Each test keeps what it asserts.

**Contract**: No `vi.mock` / `vi.doMock` left in these 7 files. Keep the one-sentence "forwards every argument / `req`" reason next to the `serializeKosztorys` override; it is load-bearing.

### Success Criteria:

#### Automated Verification:

- `grep -lE '\bvi\.(mock|doMock)\(' src/__tests__/**/*.db.test.ts` no longer lists the 7 group-B files.
- The 7 specs plus the 14 mock-free specs that import a seam module directly pass in `db-shared`.
- `pnpm test:integration` passes twice; one shuffled run passes.
- Integration duration is recorded in `## Progress`.

#### Manual Verification:

- None (test harness only).

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Group C — external-service seams

### Overview

The external-service modules join the same seam list. The 11 specs steer them through `vi.mocked`, and `settle-payouts` uses the global `after` queue. The isolated `db` project ends up empty.

### Changes Required:

#### 1. Seam registration and reset

**File**: `src/__tests__/setup/db.ts` (or `stubs/db-seams.ts` if moved in phase 3)

**Intent**: Add the external exports as transparent `vi.fn(actual.export)` seams and include them in the per-file reset.

**Contract**: Seams:

- `@/lib/ai/translate` → `translateTexts`, `translateToPolish`
- `@/lib/google/sheet-lookup` → `getInvestmentSheet`
- `@/lib/google/readonly-sheets-client` → `getReadonlySheetsClient`
- `@/lib/kosztorys/sheet-import/read-sheet` → `readImportGrids`
- `@/lib/ai/openrouter` → `extractReceipt`, `extractReceipts`
- `@/lib/media/blob-public-url` → `fetchMediaBytes`
- `@/lib/media/delete-unreferenced-media` → `reclaimUnreferencedMedia`
- `@/lib/actions/sheets-sync` → `syncBulkExpensesToSheet`
- `@/lib/push/notify-pending-payouts` → `notifyPendingPayouts`

Wrapping a module with `importOriginal` loads the real module once. No mock-free DB spec imports any of these today, so pass-through keeps the 135 existing specs unchanged.

#### 2. Spec rewrites

**Files**:

- `src/__tests__/lib/actions/translate-at-creation.db.test.ts`
- `src/__tests__/lib/actions/kosztorys-translations.db.test.ts`
- `src/__tests__/lib/actions/work-catalogue-translations.db.test.ts`
- `src/__tests__/lib/actions/worker-report.db.test.ts`
- `src/__tests__/lib/actions/worker-report-translation.db.test.ts`
- `src/__tests__/lib/actions/kosztorys-compare-with-sheet.db.test.ts`
- `src/__tests__/lib/actions/kosztorys-import.db.test.ts`
- `src/__tests__/lib/actions/read-expense-draft-receipts.db.test.ts`
- `src/__tests__/lib/actions/delete-orphaned-media.db.test.ts`
- `src/__tests__/lib/actions/worker-expense-drafts-worker.db.test.ts`
- `src/__tests__/lib/actions/settle-payouts.db.test.ts`

**Intent**:

- **Hoisted `vi.fn` mocks:** replace them with imports of the seam plus `vi.mocked(...)` setup in `beforeAll` / `beforeEach`.
- **Spec-set default results:** a full stub the spec configured (e.g. `getReadonlySheetsClient` resolving `{}`, the `readImportGrids` fixture driven by `sheetState`) becomes a `mockImplementation` set in the spec's own `beforeEach`. The per-file reset clears it before the next file.
- **`settle-payouts`:**
  - drop its `next/server` mock and assert the scheduled sheet sync and notification after `flushAfter()`;
  - stub `syncBulkExpensesToSheet` / `notifyPendingPayouts` in its `beforeEach`, so flushing never reaches the real service;
  - its `vi.spyOn(payload, 'create')` stays (allowed since phase 2).

**Contract**: No `vi.mock` / `vi.doMock` in any `*.db.test.ts`. The `db` project collects 0 files.

#### 3. Harness docs

**File**: `src/__tests__/AGENTS.md`

**Intent**: Extend the "mocked for every spec by a setup file" bullet. DB specs get transparent seams for the listed modules, overridden through `vi.mocked` and reset per file. A new DB spec that needs a module mock adds a seam rather than a per-file `vi.mock`. A per-file `vi.mock` still works, but it costs ~1.2 s and the spec runs isolated.

**Contract**: Point at the seam list in `setup/db.ts` / `stubs/db-seams.ts` rather than copying it into the doc.

### Success Criteria:

#### Automated Verification:

- `grep -lE '\bvi\.(mock|doMock)\(' $(git ls-files 'src/__tests__/**/*.db.test.ts')` prints nothing.
- The `db` project reports no test files in the integration run.
- The 11 group-C specs pass.
- `pnpm test:integration` passes twice; one shuffled run passes.
- Integration duration is recorded in `## Progress`; target ≤ 40 s of vitest duration.

#### Manual Verification:

- None (test harness only).

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- None new. The change is to the harness; the 157 DB specs are its tests.

### Integration Tests:

- **Every lever-1 phase:** two consecutive `test:integration` runs, plus one with `--sequence.shuffle.files` and a random seed recorded in Progress. Shuffling is what exposes a seam override or spy leaking into a later file.
- **Phase 1:** a forced rebuild, a warm reuse and a fingerprint-mismatch rebuild, then parity and integration on a clone.

### Manual Testing Steps:

1. None. Nothing user-facing changes.

## Performance Considerations

- **Expected after phase 4:** integration ~70 s → ~35–40 s of vitest time plus a ~1.5 s clone.
- **Parity:** 31.8 s → ~6 s when the template is reused.
- **When the template must be rebuilt:** a migration change, a seed change or a template older than 7 days. Those pushes pay one rebuild (~28 s) instead of the two full resets they pay today.

## Migration Notes

- **Template DB:** the first `db:reset:test` after landing builds `wykonczymy-test-template` in the existing `db-test` container. No volume or compose change.
- **Old stamp file:** `dumps/.test-db-schema-stamp` becomes unused. It is gitignored, so delete it locally.
- **Rollback:** revert the commits. `db:import:test` still exists as the full-reset path.

## Whole-tree Gate

Run once, after phase 4:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:integration` and `pnpm test:parity`, which phases 1–4 already exercise. `pnpm test` (node + dom) is not needed: no node/dom spec or setup changes.
- After-measurement: repeat Phase 0's commands exactly (2 runs each, median), fill the "after" column in `baseline.md`, and state the saving against the baseline per command.

## References

- Research: `context/changes/2026-10-18-test-suite-speed/research.md` (§1, §2, ranked levers 1–2)
- Session-mock precedent: `src/__tests__/setup/db.ts`, `src/__tests__/stubs/get-current-user-jwt.ts`
- Integration entry: `scripts/test-integration.sh`
- Reset scripts: `package.json:22,36,39`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 0: Baseline

#### Automated

- [x] 0.1 `baseline.md` records median before-numbers (integration total + per project, parity, `db:reset:test`)

### Phase 1: Test DB from a template clone

#### Automated

- [ ] 1.1 Forced rebuild creates the template with its fingerprint comment
- [ ] 1.2 Warm `db:reset:test` reuses the template in under 5 s
- [ ] 1.3 A stale fingerprint triggers a rebuild
- [ ] 1.4 `pnpm test:parity` passes on a cloned DB
- [ ] 1.5 `pnpm test:integration` passes and logs the clone step

### Phase 2: Group A — `vi.spyOn` specs into `db-shared`

#### Automated

- [ ] 2.1 The 4 group-A specs run in `db-shared`
- [ ] 2.2 `pnpm test:integration` passes twice
- [ ] 2.3 A shuffled integration run passes
- [ ] 2.4 Integration duration recorded

### Phase 3: Group B — domain pass-through seams

#### Automated

- [ ] 3.1 No `vi.mock` / `vi.doMock` left in the 7 group-B specs
- [ ] 3.2 Group-B specs and the direct importers of seam modules pass in `db-shared`
- [ ] 3.3 `pnpm test:integration` passes twice; a shuffled run passes
- [ ] 3.4 Integration duration recorded

### Phase 4: Group C — external-service seams

#### Automated

- [ ] 4.1 No `vi.mock` / `vi.doMock` in any `*.db.test.ts`
- [ ] 4.2 The `db` project collects 0 files
- [ ] 4.3 The 11 group-C specs pass
- [ ] 4.4 `pnpm test:integration` passes twice; a shuffled run passes
- [ ] 4.5 Integration duration recorded (target ≤ 40 s)

### Whole-tree Gate

#### Automated

- [ ] G.1 `pnpm typecheck` and `pnpm lint` pass
- [ ] G.2 After-measurement repeats Phase 0's commands; `baseline.md` "after" column filled with the saving per command
