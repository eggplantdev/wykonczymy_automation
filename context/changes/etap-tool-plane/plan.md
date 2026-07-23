# Etap Tool-Plane Assignment Implementation Plan

## Overview

Give each etap a plane attribute — z narzędziami (`w_tools`) or bez narzędzi (`own_tools`) — set from the etap header menu, and rebuild „Podsumowanie podwykonawców" as one view-independent settlement: each etap valued at its **own** plane's subcontractor price, per-plane split + razem, one shared wypłaty pool subtracted once.

## Current State Analysis

- An etap is only `{ id, ordinal, label }` (`src/collections/kosztorys-stages.ts:29-33`, `KosztorysStageT` at `src/lib/kosztorys/types.ts:90-94`). No plane concept exists.
- The price-view toggle only **reprices** — it never filters. `stageTotalsForView` / `sectionSubtotalsForView` (`src/lib/kosztorys/settlement.ts:150,179`) iterate all etapy at the active view's price, so „Z narzędziami" claims 100% of executed work at its price and „Bez narzędzi" claims the _same_ 100% at its price. Per etap the real relationship is OR (one crew executed it), not AND.
- `subcontractorDueNet` (`src/components/kosztorys/use-kosztorys-editor.ts:396` → `executedWorkNetPreRabat`) inherits the double-count: both subcontractor views show contradictory „Suma wykonanej pracy" totals, and „Pozostało do wypłaty" is wrong in both.
- The subcontractor settlement is **editor-only, client-side** — no server-side computation, and the share/client pages pin `view='client'` and never render the subcontractor panel.
- The wypłaty pool is investment-level per worker (`payoutsByWorker` / `payoutTransactions` from `src/lib/queries/reference-data`), with no plane attribution — and stays that way (owner: "shared pool — that is the whole point").

## Desired End State

- Each etap header shows its plane icon (`Wrench` / slashed-wrench, same as the view toggle) and a plane picker in the header dropdown.
- An etap with no explicitly chosen plane defaults to z narzędziami **with a `TriangleAlert` warning** on its header and in „Podsumowanie podwykonawców" — the number renders, the scream sits next to it (recon-mismatch pattern).
- „Podsumowanie podwykonawców" is identical in both Z/Bez views: rows Z narzędziami / Bez narzędzi / Suma wykonanej pracy (razem), then Zaliczki (wypłaty) razem, then Pozostało do wypłaty = razem − zaliczki. Honest on mixed investments.
- In a subcontractor view, the other plane's per-etap **value** cells and footers read „nie dotyczy"; qty cells stay editable everywhere.
- Klient view and all client-priced figures are untouched.

### Key Discoveries:

- One DB→type mapping site for stages: `buildKosztorysTree` (`src/lib/queries/kosztorys.ts:125-131`); client-share path reuses it.
- Snapshots reuse `KosztorysStageT` directly (`snapshot-format.ts:43`); additive fields are tolerated at `SNAPSHOT_SCHEMA_VERSION = 1` — but the raw `INSERT INTO kosztorys_stages (investment_id, ordinal, label)` in `src/lib/kosztorys/insert-kosztorys-tree.ts:43-45` **must carry the new column or every restore silently drops planes**.
- Presets deliberately store `stages: []` (`serialize-preset.ts:22-24`) — no preset impact. `seed-from-preset.ts:41` inserts one bare stage — fine with a nullable column.
- Pre-rabat value is **linear in qty**: pre-rabat for qty q at view v = `q × viewPrice(row, v)` (the `rowDiscountForView` identity, `calc.ts:97-99`). So a per-etap pre-rabat figure at the etap's own plane needs no share-splitting — just `stageQty × viewPrice(row, plane)`.
- Rabat is absorbed by company margin, never passed to subcontractors (`executedWorkNetPreRabat` doc, `settlement.ts:71-78`) — the combined figure stays pre-rabat, global discount irrelevant.
- Warning pattern: `ReconMismatchBadge` (`src/components/kosztorys/recon-mismatch-badge.tsx`) — `TriangleAlert` + `HintTooltip`, `text-destructive`, but with a hardcoded `aria-label="Niezgodność z transakcjami"` that E2E asserts on — the plane warning needs its own aria-label, so a sibling badge, same look.
- Stage action pattern to follow: `updateStageFieldAction` (`src/lib/actions/kosztorys.ts:408-422`).
- Migration pattern: `src/migrations/20260721_1_add_vat_plane_to_transactions.ts` (hand-written, `ADD COLUMN IF NOT EXISTS`, pg enum via `DO $$ … EXCEPTION WHEN duplicate_object` for select fields), registered in `src/migrations/index.ts`. Filename must sort after its dependencies (lessons.md).
- Kosztorys data is throwaway until dogfooding merges to `main` — **no data-preservation path owed**; existing stages simply restore/read as `plane = null`.

## What We're NOT Doing

- No plane attribution on wypłaty or workers — one shared pool, subtracted once (owner decision).
- No plane-filtering of the grid's other money readouts (Razem row, „Pozostało" columns, executed-total readout) — the grid stays a pricing workspace; the settlement panel is the honest money.
- No changes to klient view, client share pages, or any client-priced figure (`sectionSubtotalsForView`, progress counter, reconciliation).
- No changes to `stageTotalsForView` / „Suma transzy" (client-plane-only panel figure).
- No preset format changes.
- No E2E in this change's phases — browser-level risk goes to the review gate / `e2e-backlog` per AGENTS.md.

## Implementation Approach

Thread a nullable `plane` column (`'w_tools' | 'own_tools' | null`, `null` = defaulted-to-w_tools-unconfirmed) from DB to `KosztorysStageT`, add one plane-aware pre-rabat settlement function (TDD), then wire three UI surfaces: the etap header (picker + icon + warning), the grid's per-etap value cells („nie dotyczy"), and the rebuilt subcontractor summary. `null` is the warning state — explicitly picking a plane (even the default one) writes the value and clears the warning; no separate `confirmed` flag.

## Phase 1: Data Layer — Plane Column End to End

### Overview

Persist and thread `plane` so every stage consumer can read it; add the server action that writes it.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20260723_0_add_plane_to_kosztorys_stages.ts` (+ register in `src/migrations/index.ts`)

**Intent**: Add the nullable plane column to `kosztorys_stages`. Hand-written (never `migrate:create`), copying the `20260721_1_add_vat_plane_to_transactions.ts` shape: create pg enum `enum_kosztorys_stages_plane` (`w_tools`, `own_tools`) via the `duplicate_object`-guarded `DO $$` block, then `ADD COLUMN IF NOT EXISTS plane`. Nullable, no default — `null` means "defaulted, unconfirmed". `down` drops column then enum.

**Contract**: `kosztorys_stages.plane enum_kosztorys_stages_plane NULL`.

#### 2. Collection field

**File**: `src/collections/kosztorys-stages.ts`

**Intent**: Add a `plane` select field (options `w_tools` / `own_tools`, not required) with Polish labels (`Z narzędziami` / `Bez narzędzi`), so Payload's generated types and admin stay in sync with the column.

**Contract**: field name `plane`, type `select`, `required: false`.

#### 3. Type + mapping

**Files**: `src/lib/kosztorys/types.ts`, `src/lib/queries/kosztorys.ts`

**Intent**: Define `StagePlaneT = 'w_tools' | 'own_tools'` and extend `KosztorysStageT` with `plane: StagePlaneT | null`; map it in `buildKosztorysTree` (`d.plane ?? null`). The snapshot payload and client-share path pick it up automatically through the shared type.

**Contract**: `KosztorysStageT = { id; ordinal; label; plane: StagePlaneT | null }`. `StagePlaneT` is the subset of `PriceViewT` without `'client'` — keep them assignment-compatible (a plane IS a valid price view).

#### 4. Snapshot restore path

**File**: `src/lib/kosztorys/insert-kosztorys-tree.ts`

**Intent**: Carry `plane` through the raw stage `INSERT` so restore/apply-preset don't silently drop it. Old snapshots without the field insert `null` — which is exactly the defaulted-unconfirmed state, so no schema-version bump.

**Contract**: `INSERT INTO kosztorys_stages (investment_id, ordinal, label, plane) …`, `stage.plane ?? null`.

#### 5. Server action

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: `setStagePlaneAction(stageId, plane)` following the `updateStageFieldAction` pattern (Zod enum validation, `payload.update`, revalidate `['kosztorysStages']`).

**Contract**: `setStagePlaneAction(stageId: number, plane: StagePlaneT): Promise<ActionResultT>`. Writing `null` back is not needed — a plane, once confirmed, only switches.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly to local dev DB: `node --env-file=.env node_modules/.bin/payload migrate`
- Type checking passes: `pnpm exec tsc --noEmit` (after `pnpm generate:types`)
- Existing unit tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- Lint passes: `pnpm lint`

#### Manual Verification:

- After migration + dev-server **restart**, the kosztorys editor loads without query errors (lessons.md: verify the running app, restart pre-migration servers)
- Payload admin shows the plane select on a Kosztorys Stage

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Settlement Math (TDD)

### Overview

The plane-aware pre-rabat settlement figures — the one new money computation, test-first.

### Changes Required:

#### 1. Plane-aware subcontractor settlement

**File**: `src/lib/kosztorys/settlement.ts` (+ new spec in `src/__tests__/lib/kosztorys/`)

**Intent**: A pure function computing the view-independent subcontractor figures: each stage's executed qty valued pre-rabat at that stage's own plane (`null` → `w_tools` default), summed per plane and combined, plus the unconfirmed flag.

**Contract**:

```ts
export const DEFAULT_STAGE_PLANE: StagePlaneT = 'w_tools'
export function subcontractorDueByPlane(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
): { wTools: number; ownTools: number; combined: number; hasUnconfirmedPlane: boolean }
```

Per-stage pre-rabat value = `stageQty × viewPrice(row, stagePlane)` — the linearity identity means no qty-share splitting and no discount handling (rabat never reaches subcontractors). `hasUnconfirmedPlane` = any stage with `plane === null`. TDD cases: single-plane investment matches `executedWorkNetPreRabat` at that view; mixed planes sum each side at its own price; null plane counts as `w_tools` and raises the flag; per-item rabat and global discount both leave the figure unchanged; per-row price overrides respected per plane.

#### 2. Editor hook wiring

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: Replace the view-dependent `subcontractorDueNet` (`:396`) with `subcontractorDueByPlane(rows, stages)` — memo on `[rows, stages]`, no `view` dependency. Expose the whole result (split + flag) instead of one number; drop `executedWorkNetPreRabat` if it loses its last consumer.

**Contract**: hook returns `subcontractorDue: ReturnType<typeof subcontractorDueByPlane>` in place of `subcontractorDueNet: number`; prop chain (`kosztorys-editor-body.tsx` → `kosztorys-totals-panel.tsx`) renamed accordingly.

### Success Criteria:

#### Automated Verification:

- New settlement spec red→green: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- Type checking passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`

#### Manual Verification:

- On a mixed-plane test kosztorys, „Suma wykonanej pracy" is identical in the Z and Bez views and equals the hand-computed per-plane sum

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding.

---

## Phase 3: Etap Header UI — Picker, Icon, Warning

### Overview

Make the plane visible and settable at the etap header.

### Changes Required:

#### 1. Shared plane icons

**File**: `src/components/kosztorys/kosztorys-toolbar-options.tsx` (or a small extracted module if cleaner)

**Intent**: The `Wrench` / slashed-wrench markup currently inlined in `VIEWS` (`:22-33`) becomes reusable by the stage header — extract the two icons so header and view toggle can't drift.

**Contract**: two exported icon components/elements keyed by `StagePlaneT`; `VIEWS` reuses them.

#### 2. StageHeader plane section

**File**: `src/components/kosztorys/stage-header.tsx`

**Intent**: Header shows the effective plane's icon next to the label, plus `TriangleAlert` (destructive, tooltip explaining „Domyślnie: z narzędziami — wybierz rozliczenie etapu") when `plane === null`. The dropdown gains a radio-style „Rozliczenie" section (Z narzędziami / Bez narzędzi, plane icons) above the rename/delete items. Read-only mount (clientView) stays a bare label — no plane icon, no warning; the plane is internal subcontractor information.

**Contract**: new optional `onSetPlane?: (stageId: number, plane: StagePlaneT) => void` prop; no handlers = read-only as today.

#### 3. Optimistic plane change

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: `onSetPlane` handler patching the `stages` state optimistically, firing `setStagePlaneAction` from the event handler (never inside a state updater — lessons.md), reverting + toasting on failure, following the stage-rename handler's shape.

**Contract**: handler threaded to `StageHeader` via the same `editorOnly()` path as `onRenameStage`/`onRemoveStage`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Unit tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Picking a plane updates the header icon instantly and survives a reload (persisted)
- A fresh etap shows the default wrench + `TriangleAlert`; picking z narzędziami explicitly clears the warning
- Client share page shows plain etap labels — no plane icons or warnings
- Selecting a plane does not disturb grid state (sort, filter, unsaved edits)

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 4: Grid „Nie dotyczy" for Other-Plane Etapy

### Overview

Stop the grid's per-etap value columns from showing repriced lies in subcontractor views.

### Changes Required:

#### 1. Per-etap value cells + footers

**File**: `src/components/kosztorys/kosztorys-v2-columns.tsx`

**Intent**: In a subcontractor view (`view !== 'client'`), a stage whose effective plane (`plane ?? 'w_tools'`) differs from the active view renders „nie dotyczy" (muted) in its value net/gross/percent cells and their footer totals, instead of a repriced number. Qty columns stay editable everywhere; klient view unchanged. Respect the dsg stable-`component` rule — the „nie dotyczy" branch rides on `columnData`, not a fresh closure (lessons.md).

**Contract**: value-column builders (`:306-336`) and the totals-row wrapping gain the effective-plane check; a single `stageAppliesToView(stage, view)` helper (settlement or stage-keys module) owns the rule so Phase 2's math and the grid can't disagree.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Unit tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- Lint passes: `pnpm lint`

#### Manual Verification:

- In Bez narzędzi view, a z-narzędziami etap's value cells and footer read „nie dotyczy"; its qty cells still accept input
- A null-plane etap shows values in Z narzędziami view (it defaults there) and „nie dotyczy" in Bez narzędzi
- Klient view shows every etap's values as before
- No cell-remount symptoms while typing in qty cells (characters don't drop)

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 5: Subcontractor Summary Rebuild

### Overview

The view-independent „Podsumowanie podwykonawców" with the split and the warning.

### Changes Required:

#### 1. Summary block figures

**Files**: `src/lib/kosztorys/subcontractor-summary.ts`, `src/components/kosztorys/subcontractor-summary.tsx`

**Intent**: The headline table becomes: Z narzędziami / Bez narzędzi / **Suma wykonanej pracy** (razem, bold) / Zaliczki (wypłaty) razem / Pozostało do wypłaty (= razem − zaliczki). `computeSubcontractorSummary` takes the combined figure as its `dueNet`; the split rows are display rows fed from `subcontractorDueByPlane`'s parts. When `hasUnconfirmedPlane`, a warning badge sits next to „Suma wykonanej pracy".

**Contract**: `SubcontractorSummary` props change from `dueNet: number` to the `subcontractorDueByPlane` result; worker totals + wypłaty list unchanged.

#### 2. Plane-warning badge

**File**: `src/components/kosztorys/plane-unconfirmed-badge.tsx` (new, sibling of `recon-mismatch-badge.tsx`)

**Intent**: Same `TriangleAlert` + `HintTooltip` + `text-destructive` construction as `ReconMismatchBadge`, but its own aria-label (the recon badge's `Niezgodność z transakcjami` is asserted by E2E and means something else). Tooltip explains that some etapy have no confirmed rozliczenie and are counted as z narzędziami.

**Contract**: `PlaneUnconfirmedBadge({ content }: { content: string })`, mounted in the summary headline and available for future surfaces.

#### 3. Prop chain

**Files**: `src/components/kosztorys/kosztorys-editor-body.tsx`, `src/components/kosztorys/kosztorys-totals-panel.tsx`

**Intent**: Thread the new settlement object through in place of `subcontractorDueNet` (started in Phase 2); the panel renders the identical block in both subcontractor views (already the case — one `SubcontractorSummary` mount behind `!isClientPlane`).

**Contract**: prop rename only; no behavioral branch per subcontractor view.

### Success Criteria:

#### Automated Verification:

- Full unit suite passes: `pnpm exec vitest run`
- Type checking passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Build passes: `pnpm build`

#### Manual Verification:

- Mixed-plane investment: Z and Bez views show the identical summary; split rows + razem reconcile with the grid's per-etap values
- „Pozostało do wypłaty" = razem − zaliczki, negative renders destructive as before
- Warning badge appears while any etap is unconfirmed and disappears once every plane is explicitly picked
- Single-plane investment (all z narzędziami, confirmed): summary matches the pre-change figure in the Z view

**Implementation Note**: Final phase — after automated verification, aggregate all `#### Manual Verification:` bullets into `context/foundation/manual-checks.md` per the registry convention.

---

## Testing Strategy

### Unit Tests:

- `subcontractorDueByPlane` (Phase 2, TDD): single-plane parity with `executedWorkNetPreRabat`, mixed-plane sums, null-plane default + flag, rabat/global-discount invariance, per-row price overrides
- `stageAppliesToView` helper (Phase 4) — shared rule, trivially covered by the settlement spec
- Existing settlement/rows specs must stay green (client figures untouched)

### Integration Tests:

- None new — no server-side settlement exists; snapshot round-trip of `plane` is covered by extending the existing serialize/insert tests if present, else by the Phase 1 manual restore check

### Manual Testing Steps:

1. Migrate, restart dev server, open a seeded kosztorys (`INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts`)
2. Assign planes to half the etapy, leave the rest unconfirmed; verify header icons + warnings
3. Enter qty across etapy of both planes; verify „nie dotyczy" placement per view and the identical combined summary in both subcontractor views
4. Save a version, restore it, confirm planes survive the round-trip
5. Open the client share preview — no plane traces

E2E: this is a browser-level slice — its E2E is owed at the review gate (author or file to `e2e-backlog` per AGENTS.md).

## Performance Considerations

`subcontractorDueByPlane` is O(rows × stages) like the existing per-view passes, memoized on `[rows, stages]` — one pass fewer than today on view switches (no longer view-dependent). No new render-path work in the grid beyond a per-cell plane comparison.

## Migration Notes

Kosztorys data is throwaway (AGENTS.md) — existing stages read `plane = null` (defaulted + warned), which is the intended cold-start state. No backfill. Prod migration applies via `pnpm db:migrate:prod` by a human before the code ships — deploy-time gate, not a phase gate.

## References

- Change identity + shaping decisions: `context/changes/etap-tool-plane/change.md`
- Settlement math: `src/lib/kosztorys/settlement.ts`, `src/lib/kosztorys/calc.ts`
- Migration pattern: `src/migrations/20260721_1_add_vat_plane_to_transactions.ts`
- Warning pattern: `src/components/kosztorys/recon-mismatch-badge.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Layer — Plane Column End to End

#### Automated

- [ ] 1.1 Migration applies cleanly to local dev DB: `node --env-file=.env node_modules/.bin/payload migrate`
- [ ] 1.2 Type checking passes: `pnpm exec tsc --noEmit` (after `pnpm generate:types`)
- [ ] 1.3 Existing unit tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- [ ] 1.4 Lint passes: `pnpm lint`

### Phase 2: Settlement Math (TDD)

#### Automated

- [ ] 2.1 New settlement spec red→green: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- [ ] 2.2 Type checking passes: `pnpm exec tsc --noEmit`
- [ ] 2.3 Lint passes: `pnpm lint`

### Phase 3: Etap Header UI — Picker, Icon, Warning

#### Automated

- [ ] 3.1 Type checking passes: `pnpm exec tsc --noEmit`
- [ ] 3.2 Unit tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- [ ] 3.3 Lint passes: `pnpm lint`

### Phase 4: Grid „Nie dotyczy" for Other-Plane Etapy

#### Automated

- [ ] 4.1 Type checking passes: `pnpm exec tsc --noEmit`
- [ ] 4.2 Unit tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- [ ] 4.3 Lint passes: `pnpm lint`

### Phase 5: Subcontractor Summary Rebuild

#### Automated

- [ ] 5.1 Full unit suite passes: `pnpm exec vitest run`
- [ ] 5.2 Type checking passes: `pnpm exec tsc --noEmit`
- [ ] 5.3 Lint passes: `pnpm lint`
- [ ] 5.4 Build passes: `pnpm build`
