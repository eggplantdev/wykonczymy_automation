---
date: 2026-07-16T00:00:00+02:00
researcher: ex-Plant
git_commit: b68457d655c2a4b96499670a48bfadbfa3588469
branch: dogfooding/kosztorys-editor-ux
repository: wykonczymy
topic: 'Make the kosztorys etap column header actionable (rename + guarded delete) — why is the wired header inert?'
tags: [research, codebase, kosztorys, react-datasheet-grid, stage-header, confirm-dialog, e2e]
status: complete
last_updated: 2026-07-16
last_updated_by: ex-Plant
---

# Research: kosztorys etap column header — rename + guarded delete

**Date**: 2026-07-16 (Europe/Warsaw)
**Researcher**: ex-Plant
**Git Commit**: b68457d655c2a4b96499670a48bfadbfa3588469
**Branch**: dogfooding/kosztorys-editor-ux
**Repository**: wykonczymy

## Research Question

The etap (stage) column header in the kosztorys v2 editor is inert live: rename (input `onBlur`)
and delete (✕ `onClick`) don't work, even though the handlers are wired in source. Root-cause it,
and gather the pieces needed to (1) restore working rename, (2) add a delete guarded by a
confirmation dialog, (3) author a browser regression guard.

## Summary

> **CORRECTION (owner, 2026-07-16):** An earlier draft of this doc blamed react-datasheet-grid
> swallowing header events. That was wrong. Every other header in this grid is an interactive Radix
> dropdown (`SortHeader`) and works fine — the grid does **not** block header interactivity. The etap
> header is simply the one column that was never built on that pattern. The dsg-`mousedown` theory is
> retained below only as a struck-through dead end.

**The real bug is layout + the wrong header primitive.** The etap columns render a bare `StageHeader`
(a transparent `<input>` + a tiny conditional ✕) instead of the `SortHeader` dropdown every other
column uses. Inside the dsg header cell that `StageHeader`:

- **lays out wrong** — the `flex-1` input fills the whole cell (so clicks land on dead input space,
  reading as static "Etap N" text), and the `shrink-0` ✕ button is **not constrained to the cell**:
  devtools shows its rect rendered over the _Przedmiar_ header two columns away, i.e. overflowing out
  of the Etap cell. So there is no visible, usable affordance in the Etap column — matching the
  owner's report of "no button, nothing."
- **isn't a dropdown** — unlike `SortHeader` (`src/components/kosztorys/sort-header.tsx`), whose
  trigger is `h-full w-full … truncate` and lays out correctly in these exact cells because it's the
  established header primitive.

**The fix: rebuild the etap header on the `SortHeader` dropdown pattern.** A trigger that fills the
header cell (etap name / „Etap N" + a caret), opening a Radix `DropdownMenu` with the etap actions:

- **Zmień nazwę** (rename) — moves rename into the menu/a small dialog, dropping the fragile in-cell
  uncontrolled input entirely.
- **Usuń etap** (destructive) — a `text-destructive` item → `ConfirmDialog` (`pendingRemove` pattern),
  backed by the existing `removeStageAction` guard + auto-snapshot.

This fixes the layout for free (proven primitive), gives a discoverable affordance, and is consistent
with the rest of the grid — exactly the "header cells are already wired to dropdowns" model the owner
pointed at.

**The delete confirmation reuses `ConfirmDialog`** (`src/components/ui/confirm-dialog.tsx`, Radix
`AlertDialog`), the `pendingRemove` pattern already used for section delete in
`kosztorys-section-summary.tsx`. It portals to `document.body`, outside the grid.

**No server or migration change.** `removeStageAction` already guards against deleting an etap with
recorded postęp and takes a forced pre-delete auto-snapshot. `updateStageFieldAction` already backs
rename. This slice is purely client (a new dropdown header component + confirm UX + an E2E guard).

## Detailed Findings

### 1. Root cause — dsg's document `mousedown` + `preventDefault` (the crux)

- The grid is `DynamicDataSheetGrid` (reactive columns export), rendered at
  `src/components/kosztorys/kosztorys-editor-body.tsx:72` with `className="kosztorys-grid"` (:73).
  Its closures rebuild each render, so `onRenameStage`/`onRemoveStage` are always fresh — **wiring is
  not the problem.**
- react-datasheet-grid v4.11.6 renders a column's `title` as a plain node inside
  `<div className="dsg-cell-header-container">` at `node_modules/react-datasheet-grid/dist/components/Grid.js:104`.
  Header title nodes get **none** of the per-cell interactivity (`active`/`editing`/`focus`,
  `Component` lifecycle) that body cells receive at `Grid.js:120-142`.
- The library installs a document-level `mousedown` listener at
  `node_modules/react-datasheet-grid/dist/components/DataSheetGrid.js:789`
  (`useDocumentEventListener('mousedown', onMouseDown)`; the hook is a bare
  `document.addEventListener`, `hooks/useDocumentEventListener.js:6-11`). Its handler
  (`DataSheetGrid.js:632-771`) runs for any click inside the grid inner element (`clickInside`, :638
  — the header row IS inside `innerRef`) and at **:768-769 calls `event.preventDefault()`**.
- **Why rename dies:** `preventDefault()` on `mousedown` suppresses native focus. `StageHeader`'s
  uncontrolled input relies on native click-to-focus and commits on `onBlur`
  (`src/components/kosztorys/stage-header.tsx:24-33`). No focus → no blur → no rename.
- **Why body cells survive:** the `SectionNameCell` rename (`kosztorys-v2-columns.tsx:369-395`) is a
  BODY cell; dsg's active/editing state machine early-returns before `preventDefault` when you click
  an already-active cell (`DataSheetGrid.js:653-660` — the "select on first click, focus on second"
  model). The header has no active/editing lifecycle, so it never gets that escape hatch.
- **Why delete is different:** `preventDefault` on `mousedown` does not block `click`; the header
  `Cell` is keyed by a stable `id: stageKey(st.id)` (`kosztorys-v2-columns.tsx:701-702`, consumed at
  `Grid.js:66,99`), so nothing remounts between mousedown and mouseup. The ✕ `onClick`
  (`stage-header.tsx:35-42`) should fire. Verify live before assuming it's broken.

### 2. The fix seam

Primary (minimal, fixes both): in `src/components/kosztorys/stage-header.tsx`, add
`onMouseDown={(e) => e.stopPropagation()}` to the input (24-33) and the ✕ button (34-43) — not only
the wrapping `div`, because a Radix Tooltip `asChild` trigger wraps the row (`stage-header.tsx:47`,
`src/components/ui/tooltip.tsx:74`) and could re-order handlers. React's root-level listener fires
during bubbling before the event reaches `document`, so `stopPropagation()` prevents dsg's document
`mousedown` handler from running at all.

Fallback (if stopPropagation proves insufficient or fights the tooltip): move the rename/delete
affordance out of the grid header into a control rendered outside dsg's `innerRef` (e.g. a header
popover or a stage-management row in the summary panel), where `clickInside` is false and dsg never
`preventDefault`s. Heavier — prefer the primary.

### 3. Confirmation-dialog pattern to mirror

`ConfirmDialog` — `src/components/ui/confirm-dialog.tsx` (the app's controlled replacement for
`window.confirm`, wrapping Radix `AlertDialog`; no `AlertDialogTrigger`). API: `open` (required),
`title` (required), `description` (optional), `confirmLabel` (default `'Potwierdź'`), `cancelLabel`
(default `'Anuluj'`), `pending`/`pendingLabel` (disables buttons + swaps confirm label mid-flight),
`onConfirm`, `onCancel` (fires on Cancel/Escape/overlay). No `destructive` variant — confirm button
uses default `buttonVariants()`; a red confirm would need a small extension.

The `pendingRemove` reference implementation for sections
(`src/components/kosztorys/kosztorys-section-summary.tsx`):

- State: `const [pendingRemove, setPendingRemove] = useState<SectionSubtotalT | null>(null)` (:53) —
  holds the whole object so the dialog can render its name/count.
- Trigger: the trash button calls a `confirmRemove(s)` helper (:195-202), which pre-checks
  `isSectionPopulated` → toasts and skips the dialog, else `setPendingRemove(s)` (:66-73).
- Dialog (:232-242): `<ConfirmDialog open={pendingRemove != null} title=… description=…
confirmLabel="Usuń" onConfirm={() => { onRemoveSection(pendingRemove.sectionId); setPendingRemove(null) }}
onCancel={() => setPendingRemove(null)} />`.

**Placement for stages:** there is no "stage summary" component; the ✕ lives in the grid header
(rendered per-stage inside dsg). Rendering one `ConfirmDialog` per header node is awkward, so lift a
single `pendingRemoveStage` state to the editor level and render **one** `ConfirmDialog` in
`kosztorys-editor-body.tsx` (outside the grid, like sections). Then `onRemoveStage` passed into
`buildV2Columns` changes from "delete now" to "request delete" (`setPendingRemoveStage({ stageId,
ordinal, label })`), and the existing `handleRemoveStage` runs on confirm. The pending object must
carry `ordinal`/`label` so the dialog can say „Usunąć Etap N?".

### 4. Stage add / rename / remove wiring (all confirmed)

| Op     | Client trigger                                       | Handler (`use-kosztorys-editor.ts`)             | Server action (`lib/actions/kosztorys.ts`) | Guards                                                                 | Revalidate                         |
| ------ | ---------------------------------------------------- | ----------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------- |
| Add    | Toolbar "+" → „Etap" (`kosztorys-add-menu.tsx:49`)   | `handleAddStage` (400-409)                      | `addStageAction` (370-392)                 | auth                                                                   | `kosztorysStages`                  |
| Rename | `StageHeader` input `onBlur` (`stage-header.tsx:29`) | `handleRenameStage` (439-457), debounced `save` | `updateStageFieldAction` (396-410)         | auth + `stageLabelSchema`                                              | `kosztorysStages`                  |
| Remove | `StageHeader` ✕ `onClick` (`stage-header.tsx:38`)    | `handleRemoveStage` (411-434)                   | `removeStageAction` (414-440)              | auth + `stageIdSchema` + recorded-postęp guard + `captureAutoSnapshot` | `kosztorysStages`, `stageProgress` |

- `handleRemoveStage` is **server-first, then local** (not optimistic): awaits the action, toasts on
  failure (surfacing the server guard „Najpierw wyczyść ilości wpisane w tym etapie"), then filters
  `setStages`, `dropWidth`, and `patchRows`-deletes the stage key. Mirroring the confirm UX touches
  only the trigger/dialog layer — `handleRemoveStage` itself needs no change.
- `handleRenameStage` trims label, maps `'' → null`, no-op guards against the current label, updates
  optimistically, and routes through the debounced `save(...)` with a revert.
- **`stages` flow:** `getKosztorysTree` (`src/lib/queries/kosztorys.ts:28-44,110`) → page
  (`.../kosztorys_v2/page.tsx:26`) → `KosztorysEditorV2` → `useKosztorysEditor({ investmentId, tree })`
  → `const [stages, setStages] = useState(tree.stages)` (hook :108) → `columnOpts.stages` (:159) →
  `buildV2Columns` (:178) → `stageCols` (`kosztorys-v2-columns.tsx:700-713`).
- **Bug isolation confirmed:** ADD works via a non-header toolbar control, so the fault is isolated
  to the header-embedded rename/delete — consistent with the dsg-header root cause.
- **Only rename/remove entry point is the grid header.** No separate "manage etapy" panel exists.

### 5. Vestigial `stagesKey` (secondary cleanup, not the root cause)

`stagesKey = stages.map(s => s.id).join(',')` is computed (`use-kosztorys-editor.ts:181`) and exported
(:646) but is **no longer applied as a `key`** on `DynamicDataSheetGrid` — the remount was removed at
commit `ee497cb` ("fix(kosztorys): use the reactive grid export, drop the remount key"). The
`stage-header.tsx:19-20` comment records this: the input is now keyed on `stage.id` to survive a
column-index shift without the whole-grid remount. `stagesKey` looks dead/vestigial — flag for the
plan to confirm and drop, but it is **not** the cause of the inert header (that is the mousedown
`preventDefault`). Do not conflate the two.

### 6. E2E harness map (for the regression guard)

- Config: `playwright.config.ts` — `testDir: './e2e'`, port **3100**, fresh `pnpm build && pnpm start`,
  `webServer.env.DB_POSTGRES_URL = DB_POSTGRES_URL_TEST` (5435 db-test), single worker, `timeout
120_000`, `expect.timeout 20_000`, `globalSetup: './e2e/global-setup.ts'`.
- Auth: seeded **OWNER** user (`E2E_EMAIL='e2e@wykonczymy.test'`,
  `E2E_PASSWORD='e2e-test-password-123'`, `src/scripts/e2e-user-credentials.ts`); global-setup
  captures `e2e/.auth/user.json`. Authed specs opt in with
  `test.use({ storageState: 'e2e/.auth/user.json' })` (see `e2e/transfer-create.spec.ts:4`) — no
  `login()` call. OWNER ∈ `MANAGEMENT_ROLES`, which the kosztorys_v2 page requires.
- Navigation: `/inwestycje/${id}/kosztorys_v2` (`src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`).
  Investment **108 = Plac Hellera 3** is stable in the dump.
- **Fixture gap:** in `dumps/dump-latest.sql`, `kosztorys_stages`/`kosztorys_sections`/`kosztorys_items`
  are **empty**. An empty kosztorys renders the "Zacznij kosztorys" empty-state dialog (Radix,
  `pointer-events:none` on the page behind it) — so the spec must first start the kosztorys (add a
  section) to reach the grid, then add an etap via the "+" → „Etap" menuitem
  (`kosztorys-add-menu.tsx:49`). A freshly-added etap has no progress, so delete won't hit the server
  guard. The spec is self-seeding on id 108.
- Selectors (no `data-testid` anywhere in kosztorys components — the main gap): grid container
  `.kosztorys-grid`; stage rename input `getByPlaceholder('Etap 1')`; current delete button
  `getByRole('button', { name: 'Usuń etap' })` (accessible name from `title`); add menu is the "+"
  trigger then `getByRole('menuitem', { name: 'Etap' })`. dsg renders header cells as generic divs
  (no `columnheader` role). The plan should decide whether to add a couple of minimal `data-testid`s
  to the stage header / grid, or lean on placeholder/title selectors (existing convention avoids
  testids).

## Code References

- `node_modules/react-datasheet-grid/dist/components/DataSheetGrid.js:768-769,789` — document `mousedown` + `preventDefault` (root cause)
- `node_modules/react-datasheet-grid/dist/components/DataSheetGrid.js:653-660` — active-cell early-return that body cells use to escape `preventDefault`
- `node_modules/react-datasheet-grid/dist/components/Grid.js:104,120-142` — header `title` rendered as inert node vs body-cell lifecycle
- `src/components/kosztorys/stage-header.tsx:24-43,47` — the inert input + ✕ button + Tooltip wrapper (fix seam)
- `src/components/kosztorys/kosztorys-editor-body.tsx:72-73` — `DynamicDataSheetGrid` render, `.kosztorys-grid`
- `src/components/kosztorys/use-kosztorys-editor.ts:157-161,178,400-457,181,646` — `columnOpts`, stage handlers, vestigial `stagesKey`
- `src/lib/tables/kosztorys-v2-columns.tsx:700-713` — `StageHeader` plugged into column `title`
- `src/lib/actions/kosztorys.ts:370-440` — `addStageAction` / `updateStageFieldAction` / `removeStageAction`
- `src/components/ui/confirm-dialog.tsx` — the confirm primitive to reuse
- `src/components/kosztorys/kosztorys-section-summary.tsx:53,66-73,195-202,232-242` — `pendingRemove` reference pattern
- `playwright.config.ts`, `e2e/helpers.ts:32`, `e2e/transfer-create.spec.ts:4` — E2E harness

## Architecture Insights

- **Third-party grids own the event layer.** react-datasheet-grid claims `document` `mousedown` and
  `preventDefault`s to run its own selection/focus model. Any interactive control you inject into a
  header `title` (which the library treats as decoration) fights that model. The clean boundary is to
  either (a) stop the event at the React tree before it escapes to `document`, or (b) keep interactive
  affordances outside the grid's inner element. This is the same "who owns focus/pointer events" trap
  that shows up with any datasheet/canvas grid (ag-Grid, Handsontable) that manages its own DOM.
- **Consistency lever:** `ConfirmDialog` + the `pendingRemove` shape is already the editor's one
  destructive-action idiom (sections). Reusing it for stages keeps a single confirm pattern rather
  than inventing an inline two-step.
- **Server safety already exists.** `removeStageAction`'s recorded-postęp guard + `captureAutoSnapshot`
  mean the confirm dialog is purely UX belt-and-suspenders, not the only safeguard — the destructive
  path is already recoverable via the snapshot and non-lossy for etapy with real work.

## Historical Context (from prior changes)

- Commit `ee497cb` ("fix(kosztorys): use the reactive grid export, drop the remount key") switched to
  `DynamicDataSheetGrid` and removed the `stagesKey` grid remount. That remount previously masked
  header-identity issues by rebuilding everything on any stage add/remove; its removal is why the
  input is now keyed on `stage.id`. It did not itself cause the mousedown-focus inertness (that is
  intrinsic to how dsg handles header clicks), but it is the reason `stagesKey` is now vestigial.
- The section-append slice (`context/changes/kosztorys-section-append/`, in review) is the sibling
  work in this editor; its `review-gate.md` records the current review discipline for this area.

## Related Research

- `context/changes/kosztorys-section-append/change.md` — sibling editor slice (append sections from a preset)
- Domain authority for kosztorys figures: `context/reference/kosztorys-editor-domain-notes.md` (not
  needed here — this slice is pure editor interactivity, no figure semantics change)

## Open Questions

1. **Is the ✕ delete actually broken, or only the rename?** The sub-agent could not drive a trusted
   click against live stages. First implementation step should reproduce in the browser (against a
   started kosztorys with an added etap) to confirm whether delete already fires. Either way the fix +
   confirm dialog is the target; this only affects how the "before" state is described.
2. **Testid vs role/placeholder selectors** for the E2E — decide in the plan. Adding one or two
   `data-testid`s to the stage header would make the spec robust against label/placeholder changes,
   at the cost of breaking the "no testids" convention.
3. **Confirm-button styling** — `ConfirmDialog` has no `destructive` variant. Ship as-is (default
   button) to match section-delete, or extend it with a red confirm? Section-delete set the
   precedent (no red), so default is the consistent choice unless the owner wants emphasis.
4. **Discoverability of the ✕** — the owner reported "no button"; the ✕ is a tiny `h-3 w-3`
   muted-foreground icon. Consider whether the slice should also make it more visible (hover-reveal or
   stronger affordance), or keep scope to interactivity + confirm only.
