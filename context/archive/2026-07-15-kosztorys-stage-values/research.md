---
date: 2026-07-15T14:37:57Z
researcher: Claude (Opus 4.8)
git_commit: c468ec6b9445b027d5d20c043d8c251540684799
branch: dogfooding/kosztorys-editor-ux
repository: wykonczymy
topic: 'Per-stage value columns (netto+brutto) + a netto/brutto picker shortcut'
tags: [research, codebase, kosztorys, datasheet-grid, columns, column-picker, stages, vat]
status: complete
last_updated: 2026-07-15
last_updated_by: Claude (Opus 4.8)
---

# Research: Per-stage value columns (netto+brutto) + a netto/brutto picker shortcut

**Date**: 2026-07-15T14:37:57Z
**Researcher**: Claude (Opus 4.8)
**Git Commit**: `c468ec6`
**Branch**: `dogfooding/kosztorys-editor-ux`
**Repository**: wykonczymy

## Research Question

Two pieces, shaped with the owner 2026-07-15 (see `change.md`):

1. Surface the sheet's `V–AE` block — a per-stage **value** column (netto + brutto) per stage, with a
   non-editable mirror header, placed at the end before `Pozostało`; stage **qty** columns move after
   `J.m.`; the picker's single `Etapy` entry splits into three groups.
2. A **netto/brutto shortcut** — one control hiding every netto or every brutto column at once,
   driving the existing column picker.

What does the column pipeline actually look like, what breaks, and what did prior changes already
settle?

## Summary

**The core work is small and the math already exists.** `stageValueForView` (`calc.ts:61`) is the
sheet's `V = D*$Q-(D*$Q*$R)` verbatim and already feeds `Pozostało` via `rowDoneNetForView`. Adding
value columns is a `computedColumn` call per stage per axis — the exact shape of commit `c468ec6`
(Rabat kwota netto/brutto), two days old, which touched only `calc.ts` + `constants.ts` +
`kosztorys-v2-columns.tsx`. No migration, no new row field, no schema, no serialization impact.

**Five findings change the plan materially:**

1. **My `change.md` was wrong about the dsg remount `key`** — it is superseded. Changing the column
   set at runtime is reactive and needs no `key`; adding one would be a regression. Corrected below.
2. **The `stage_` prefix is load-bearing in two branches** — naming the new columns `stage_value_*`
   would silently collapse them into the single `Etapy` picker group and (if ever put on the row)
   feed `NaN` into `setStageProgressAction`. The id namespace must not start with `stage_`.
3. **The shortcut's "hide all netto" would hide the only price INPUT.** `price` is the one
   netto/brutto pair whose netto side is editable — hiding it makes the grid read-only w.r.t. price.
   This is a genuine design hole in piece 2, not a detail.
4. **A brutto toggle was built and deliberately DELETED 2 days ago (EX-426, 2026-07-13)** — dogfooding
   found no rationale for hiding Brutto. Piece 2 partially re-litigates a decision the owner just
   made. Not a blocker, but `/10x-frame` must look at it.
5. **`toggleColumn` cannot batch** — N calls in one tick all fork from the same stale `hidden`, so
   the last write wins and only one column hides. The shortcut needs a new multi-set writer.

Plus two pre-existing bugs found in passing (out of scope, file to Linear): a **no-op sort on 7
computed columns**, and **orphan width entries** when a stage is deleted in another tab.

## Detailed Findings

### 1. The column pipeline

Chain: `useKosztorysEditor` builds `columnOpts` (`use-kosztorys-editor.ts:134-149`) →
`buildV2Columns(columnOpts)` (`:150`) + `buildV2ToggleItems(columnOpts)` (`:151`) →
`KosztorysEditorBody` (`kosztorys-editor-body.tsx:32-33`) → `<DynamicDataSheetGrid columns={columns}>`
(`:98`) and `<ColumnToggleMenu>` (`kosztorys-editor-toolbar.tsx:125`).

`assembleV2Columns` (`kosztorys-v2-columns.tsx:496-622`) is private — every column **before** hiding.
Two consumers, which is the whole point (`:493-495`): "the picker can enumerate what EXISTS while the
grid renders what's visible".

`buildV2Columns` (`:629-634`) — assemble → filter by visibility → `withResize` → prepend `actions`:

```ts
const base = assembleV2Columns(opts)
  .filter((c) => !opts.isHidden?.(toggleKey(c.id ?? '')))
  .map((c) => withResize(c, opts))
return opts.onRemoveItem || opts.onReorderItem ? [actionColumn(opts), ...base] : base
```

Current order (`:620-621`) — the comment is inaccurate, `identity` leads with `sectionName`, not
`description`:

```ts
// Column order mirrors the source sheet: opis → etapy (ilość) → przedmiar/pomiar/j.m. → cena.
return [...identity, ...stageCols, ...pricing, ...computed]
```

Full id set: `actions`, `sectionName`, `description`, `stage_<id>` (×N), `plannedQty`, `measuredQty`,
`unit`, `priceMode`, `priceCoeff`, `price`, `priceGross`, `discountValue`, `discountType`,
`discountAmount`, `discountAmountGross`, `plannedNet`, `plannedGross`, `net`, `gross`, `remaining`,
`remainingGross`.

### 2. The dsg remount `key` — my change.md claim is SUPERSEDED

`change.md` "Open for research/frame" said: _"dsg trap: the column set changes → must go through the
grid remount `key` (the S-02 view-toggle bug class)"_. **False as of `ee497cb` / `lessons.md:119-135`.**

- The codebase is on the reactive export today: `kosztorys-editor-body.tsx:7` —
  `import { DynamicDataSheetGrid } from 'react-datasheet-grid'`. The render (`:94-102`) has **no `key`**
  (grepped: zero hits).
- Current rule (`lessons.md:133`): "Column definitions are then reactive end-to-end… **Never add a
  `key` to force a column change through**; that is the frozen export's symptom, and a remount
  destroys DOM/virtualization/scroll/selection."
- Mechanism: dsg 4.11.6 swaps public names vs internal filenames — `exports.DataSheetGrid =
StaticDataSheetGrid` (frozen), `exports.DynamicDataSheetGrid = DataSheetGrid` (reactive).
  `useColumns` memoizes on `[gutterColumn, stickyRightColumn, columns]`; `buildV2Columns` returns a
  fresh array each render → memo miss → live.
- The history is a loop worth not repeating: `4dc6d32` ("fix migotania") switched **to** the frozen
  export chasing an unrelated ResizeObserver flicker → the freeze caused the "all 3 price views show
  the client price" bug → that got a whole-grid remount `key` → **and that remount WAS EX-422's
  flicker**. `ee497cb` deleted the key entirely.

**Consequence for this change:** adding/removing/reordering columns and splitting picker groups is
free — no key, no remount. `context/changes/kosztorys-stages/plan.md` carries the same stale claim
(Key Discoveries + Phase 4 §3) — it predates the fix.

**Live caveat that DOES touch us** (dogfooding-log §10): `stagesKey` was not merely unnecessary — it
was masking a real bug. `StageHeader` renders an **uncontrolled** `<input defaultValue={stage.label}>`
and **dsg keys header cells by column index** (`Grid.js:98`). Deleting a stage slides later stages one
index left onto a DOM node holding the previous label; the next blur fires
`onRename(nextStage.id, previousStageLabel)` — renames the **wrong** stage. Fixed by `key={stage.id}`
on the input (`fcca569`, `stage-header.tsx:25`). **This is index-keyed header identity — any change
that alters the stage column count/positions must respect it.** Mechanism read from source, never
reproduced by hand; owner verification still owed.

Also still 🔴 open on EX-422: intermittent column resize ("sometimes it works, sometimes not"), not
synthetically reproducible.

### 3. The `stage_` prefix collision — the sharpest trap

`stageKey` (`v2-rows.ts:11-13`) = `` `stage_${stageId}` ``. That string is **both** the row field and
the column id (`kosztorys-v2-columns.tsx:564-565`). Two places branch on the prefix:

**(a) `toggleKey` — picker grouping** (`kosztorys-v2-columns.tsx:625-627`):

```ts
function toggleKey(columnId: string): string {
  return columnId.startsWith('stage_') ? STAGES_COLUMN_GROUP : columnId
}
```

A `stage_value_7` id **matches** and would collapse into the single `Etapy` entry — the value columns
could never be hidden separately, and `COLUMN_LABELS[id]` (`:643`) would never see them. The
three-group split therefore requires an id namespace that does **not** start with `stage_` (or a
`toggleKey` rewritten to test the most specific prefixes first — ordering-dependent and fragile).

**(b) `diffRow` — the save path** (`v2-rows.ts:91-98`):

```ts
for (const k of Object.keys(next)) {
  if (!k.startsWith('stage_')) continue
  const nextVal = next[k as `stage_${number}`]
  if (prev[k as `stage_${number}`] !== nextVal) {
    stageChanges.push({ stageId: Number(k.slice('stage_'.length)), qty: Number(nextVal) || 0 })
  }
}
```

It iterates **every key on the row object**, classified by prefix alone — the stage half has no
`ITEM_FIELDS`-style allowlist (contrast `:33-48`). Facts:

- **Computed-only value columns: zero risk.** `Object.keys(next)` never sees them.
- **If a `stage_value_<id>` field were ever put on the row**, `Number('value_7')` → **`NaN`** →
  `setStageProgressAction(row.id, NaN, qty)` (`use-kosztorys-editor.ts:503-511`), a save against a
  nonexistent stage keyed `progress:<row>:NaN`.

So: **compute at render, never store on the row.** `computedColumn` receives the full row
(`:183-197`, `component: ({ rowData }) => fmt(compute(rowData))`), and `remaining` already proves the
pattern by calling `rowDoneNetForView(r, stages, view)` internally (`:604-606`). The per-stage value is
`stageValueForView(r, r[stageKey(st.id)] ?? 0, view)` — no new data anywhere.

### 4. The netto/brutto classification axis

Six pairs exist. **Every brutto column is computed. Every netto column is computed too — except one.**

| netto id                  | brutto id             | netto kind   |
| ------------------------- | --------------------- | ------------ |
| `price` (Cena j.m. netto) | `priceGross`          | **INPUT** ⚠️ |
| `discountAmount`          | `discountAmountGross` | computed     |
| `plannedNet`              | `plannedGross`        | computed     |
| `net`                     | `gross`               | computed     |
| `remaining`               | `remainingGross`      | computed     |

(the 5 pairs above + no lone netto and no lone brutto anywhere)

**`price` is the hole in piece 2.** Hiding it in the **client** view removes the only way to enter
`clientPrice` — from which every other figure in the grid derives (`viewPrice` → `rowNetForView`,
`calc.ts:41-49`). In a **subcontractor** view it removes the only editor for
`wToolsOverrideValue`/`ownToolsOverrideValue` under `type === 'amount'` (`:357-385`). So a naive
"hide all netto" makes the grid read-only w.r.t. price. Note also `priceCoeff` and `priceMode` are
price inputs classified as _neither_ axis, so they'd survive the hide — an incoherent half-state.

**No mechanical id convention exists** to derive the axis: `price`/`priceGross`, `net`/`gross`,
`plannedNet`/`plannedGross` follow three different naming shapes. An explicit map is required.

### 5. Summaries — and the POC TODO is partly obsolete

- **Per-section rows: netto only.** `kosztorys-section-summary.tsx:131` renders `fmt(s.net)`;
  `SectionSubtotalT` (`types/kosztorys.ts:120-126`) has **no gross field**;
  `sectionSubtotalsForView` sums net only (`calc.ts:112`). `share` is net-over-net — VAT-invariant
  under a single rate, so it needs no mode.
- **Footer: BOTH, unconditionally.** `kosztorys-section-summary.tsx:223-232` renders `Suma netto` and
  `Suma brutto` = `grandNet * (1 + vatRate)`, computed at render in the component, not in `calc.ts`.
- **The toolbar counter does not exist.** `kosztorys-editor-toolbar.tsx` renders no total at all. The
  only `totalNet` consumers are `use-kosztorys-editor.ts:167,539` and `kosztorys-editor-body.tsx:39,109`.
- **The picker does NOT affect the summaries.** Fully separate paths: `isHidden` is consumed only in
  `buildV2Columns:631` and `buildV2ToggleItems:643`; `sectionSubtotalsForView(rows, view)` deps are
  `[rows, view]` and it iterates the **full** raw `rows`, not `viewRows` (`use-kosztorys-editor.ts:164-166`).

**The parked POC TODO** (`context/archive/kosztorys-poc-in-app/2026-06-20-kosztorys-add-remove-struktura-slice1-design.md:104-114`)
demands a mode switch making summary amounts netto **or** brutto (a replacement), naming the Sekcje
panel + a top-bar counter. Reality has drifted: the footer already shows both side-by-side, and the
counter was never built. So the TODO is **partly obsolete** — what survives of it is only "per-section
rows are netto-only".

### 6. EX-426 — a brutto toggle was built, then deliberately deleted (2026-07-13)

`context/changes/kosztorys-editor-ux/design.md:107-111`:

> ## 4. EX-426 · Brutto toggle — REMOVED (superseded 2026-07-13)
>
> Dropped instead of relabeled. Dogfooding found no rationale for ever hiding Brutto (the only
> recorded reasoning — the DSG remount-key cost — argued _against_ a toggle). The additive Brutto
> column + `Suma brutto` line are now **always shown**; `bruttoVisible` state, the toolbar button, and
> … [prop threading removed across five editor files]

Scope differs — that toggle covered the single `gross` column + the `Suma brutto` line, not an
all-netto/all-brutto axis — and its removal made brutto **unconditional**, the opposite direction from
a hide-everything shortcut. But the recorded finding ("no rationale for ever hiding Brutto") is 2 days
old and sits directly across from piece 2's premise. **This belongs in `/10x-frame`.**

Related still-open: **Brutto column placement** (far-right; owner had to scroll) — EX-470, `review-gate.md:50`,
`dogfooding-log.md:209,335-336,423-424`. "The sheet has no per-row Brutto to copy, so there's no
parity answer to lean on."

### 7. S-03 explicitly excluded what this change now builds

`context/changes/kosztorys-stages/plan.md`, "What We're NOT Doing":

> **VAT / brutto on stage values (S-12) — stage values are netto, under the active view; no brutto column.**

This change reverses that call. Deliberate (owner, 2026-07-15) — but S-03 is `in review`, so its plan
should not be left contradicting shipped behaviour.

S-03 facts that still hold: label = `label ?? Etap ${ordinal}`; delete-guard is **server-side**
(`removeStageAction` raw SQL over `stage_progress` → `'Najpierw wyczyść ilości wpisane w tym etapie'`);
the header ✕ is only a trigger. Phase 4 manual rows 4.5–4.10 are **still unchecked**, incl. 4.5 "Add
stage → new column (remount-key)" — itself now stale wording.

### 8. `toggleColumn` cannot batch — last write wins

`use-hidden-columns.ts:47-51`, the only exported mutator:

```ts
function toggleColumn(id: string) {
  const next = { ...hidden }
  if (next[id]) delete next[id]
  else next[id] = true
  writeHidden(next)
}
```

Each call closes over `hidden` from the **current render's** `useMemo` (`:53`). N calls in one tick all
fork from the same stale base → **the last write wins → only one column hides.** The shortcut needs a
new multi-set writer; `writeHidden` already takes a whole map, so `setHidden(patch)` is a one-write path.

State shape (`:5-6, 55-64`): **sparse** `Record<string, boolean>`, `true` = hidden, visible = absent —
so **a new column ships visible with no migration**. `useSyncExternalStore` (`:52`) + module-level
listener Set; `SERVER_SNAPSHOT = '{}'` (`:19`) so server and first client render agree (no hydration
flash). Persisted to `localStorage` under `'table-columns:kosztorys'` (`:18`) — **global, not
per-investment** (`:15-16`: "A preferred column set is a property of the person reading, not of the
kosztorys being read"). Contrast `usePriceView`, which **is** per-investment
(`use-kosztorys-editor.ts:98`).

### 9. Widths, sorting, headers

- **Widths** (`use-column-widths.ts`): sparse `Record<string, number>`, keyed by **column id**,
  `localStorage: 'kosztorys-v2-col-widths'`, also global. New ids need no migration — absent key ⇒
  flex path (`kosztorys-v2-columns.tsx:434-438`). `dropWidth` (`:52-60`) exists precisely because
  Postgres reissues stage ids; it is called only from `handleRemoveStage` (`use-kosztorys-editor.ts:346`)
  **after** a successful server delete. **Two more column ids per stage = two more orphan entries on
  removal unless `dropWidth` is called for each.**
- **Headers**: `title(field, label, opts)` (`:154-180`) returns a `<SortHeader>` whenever `onSetSort`
  exists; tips go **onto** the sort trigger, not around it (`:156-158`) — a second wrapping trigger
  fights the dropdown for the click. Stage columns bypass `title()` and use `<StageHeader>` (`:566-575`),
  so they are **not sortable** and carry the rename/delete affordances.
- **Sorting**: `sortValue` lives in `use-kosztorys-editor.ts:68-86` (not `v2-rows.ts`) and special-cases
  only `price`, `net`, `remaining`. `sortRows` (`v2-rows.ts:123-137`) is decorate-sort-undecorate
  precisely because `getValue` can be an O(stages) reduce (`:120-122`).

### 10. Not affected at all

`serialize-kosztorys.ts`, `restore-kosztorys.ts`, `snapshot-format.ts`, `apply-preset.ts` all operate
on **DB entities only** — `KosztorysStageT` / `StageProgressT`, no grid ids, no `stage_<id>` row keys.
A presentation-only computed column adds nothing to persist. Snapshots and presets are untouched.

## Pre-existing bugs found in passing (out of scope — file to Linear)

1. **No-op sort on 7 computed columns.** `priceGross`, `discountAmount`, `discountAmountGross`,
   `plannedNet`, `plannedGross`, `gross`, `remainingGross` all render a live `SortHeader` (they go
   through `title(...)`) but fall to `sortValue`'s `default` branch, where `row['priceGross']` etc.
   **do not exist on the row** → `undefined` → `(v ?? '')` → `''` for every row → `localeCompare('','')`
   → sort UI active, nothing happens. Only `price`/`net`/`remaining` are wired
   (`use-kosztorys-editor.ts:68-86`). **Directly relevant:** any new computed column given a
   `title(...)` header inherits this bug for free.
2. **Orphan width entries across tabs.** `dropWidth` fires only in the tab that performed the delete
   (`use-kosztorys-editor.ts:346`); a stage deleted in another tab/session leaves this tab's entry,
   which then pins a reissued stage id to the dead stage's width — the exact ghost `constants.ts:50-52`
   warns about, one layer down.

## Code References

- `src/lib/kosztorys/calc.ts:61` — `stageValueForView`, the sheet's `V` verbatim; already exists
- `src/lib/kosztorys/calc.ts:70-76` — `rowRemainingForView` = sheet's `AF`
- `src/lib/tables/kosztorys-v2-columns.tsx:496-622` — `assembleV2Columns`, the column order
- `src/lib/tables/kosztorys-v2-columns.tsx:183-197` — `computedColumn`, the helper this change uses
- `src/lib/tables/kosztorys-v2-columns.tsx:625-627` — `toggleKey`, the `stage_` prefix collision
- `src/lib/tables/kosztorys-v2-columns.tsx:563-578` — the current single stage column
- `src/lib/kosztorys/v2-rows.ts:11-13` — `stageKey`
- `src/lib/kosztorys/v2-rows.ts:91-98` — `diffRow`'s prefix loop, the `NaN` hazard
- `src/lib/kosztorys/v2-rows.ts:313-322` — `rowDoneNetForView`
- `src/components/kosztorys/use-hidden-columns.ts:47-51` — `toggleColumn`, the batching hole
- `src/components/kosztorys/use-column-widths.ts:52-60` — `dropWidth` + its ghost-id rationale
- `src/components/kosztorys/stage-header.tsx:25` — `key={stage.id}`, the index-identity fix
- `src/components/kosztorys/kosztorys-editor-body.tsx:7` — `DynamicDataSheetGrid` (reactive)
- `src/components/kosztorys/kosztorys-section-summary.tsx:131,223-232` — netto-only rows, both-in-footer
- `src/lib/kosztorys/constants.ts:27-57` — `COLUMN_LABELS`, `STAGES_COLUMN_GROUP`, `NON_HIDEABLE_COLUMNS`
- `src/components/kosztorys/use-kosztorys-editor.ts:68-86` — `sortValue` (3 fields wired)
- `src/components/kosztorys/use-kosztorys-editor.ts:326-355` — `handleAddStage` / `handleRemoveStage`

## Architecture Insights

- **Compute, never store.** The editor persists only inputs; every money figure is derived live
  (`calc.ts` header comment). Brutto is consistently derived **inline** as `netto × (1 + r.vatRate)`
  (`vatRate` is denormalized onto every row), not as a `calc.ts` function — `c468ec6` and the summary
  footer both do it this way.
- **One string, two roles.** `stageKey(id)` is simultaneously a row field and a column id. That
  coupling is what makes the prefix branches dangerous — the new columns break the coupling (column id
  with no row field), which is the safe direction but means the id namespace must be chosen
  deliberately.
- **Assemble/filter split** (`assembleV2Columns` vs `buildV2Columns`) is the reason the picker can't
  drift from the grid — one list, no second registry.
- **Sparse maps everywhere** (hidden, widths) so new columns need no migration and defaults are
  "absent".
- **The precedent to copy is `c468ec6`** (Rabat kwota netto/brutto): `calc.ts` derivation + two
  `COLUMN_LABELS` + two `computedColumn` + two `HEADER_TIPS`. Nothing else.

## Historical Context (from prior changes)

- `context/foundation/lessons.md:119-135` — the dsg alias trap; **supersedes** the remount-key rule.
  Also `:98-103` (definite-width container), `:137-142` (never fire an action inside a `setState`
  updater), `:144-149` (patch denormalized fields optimistically; `router.refresh()` won't re-seed rows).
- `context/changes/ex-422-grid-remount-flicker/frame.md` — the full alias/remount saga; `ee497cb` fix.
- `context/changes/kosztorys-editor-ux/design.md:107-111` — **EX-426 brutto toggle REMOVED** (2026-07-13).
- `context/changes/kosztorys-editor-ux/dogfooding-log.md` §10 (stagesKey masked a rename bug), §11
  (widths survive reorder; EX-479 parked), §13 (Wartość przedmiaru — same class, built unverified,
  owes a `kosztorys-calc.test.ts` case), §8/§11 (Brutto placement, EX-470).
- `context/changes/kosztorys-stages/plan.md` — S-03; explicitly excluded brutto on stage values;
  carries the now-stale remount-key claim; manual rows 4.5–4.10 unchecked.
- `context/archive/kosztorys-poc-in-app/2026-06-20-kosztorys-add-remove-struktura-slice1-design.md:104-114`
  — the parked summaries netto/brutto TODO (now partly obsolete).
- `eb7e0db` — introduced the column picker + `STAGES_COLUMN_GROUP` single-group decision.
- `c468ec6` — the Rabat kwota netto/brutto pair; the template for this change.

## Related Research

- `context/reference/kosztorys-editor-domain-notes.md` — sheet column map (verified against the live
  sheet 2026-07-15 by this change's shaping; `V–AE` + `AF` confirmed).
- `context/foundation/roadmap.md:544-546` — open question 12(b), per-etap total.

## Open Questions

1. **The `price` hole in the shortcut.** "Hide all netto" hides the only price input, leaving
   `priceCoeff`/`priceMode` (also price inputs, classified as neither) visible. Does the shortcut skip
   input columns? Only act on computed ones? Or is the netto axis defined as "computed netto readouts"
   rather than "every column labelled netto"? → `/10x-frame`.
2. **EX-426 was decided 2 days ago** ("no rationale for ever hiding Brutto") and the shortcut's premise
   partly re-opens it. Is the shortcut's real value the 10 new brutto **stage** columns — i.e. a problem
   this very change creates? If so, is it self-justifying or circular? → `/10x-frame`.
3. **Column id namespace.** The new ids must not start with `stage_`. What namespace, and does
   `toggleKey` become an explicit map instead of a prefix test?
4. **Sortability.** Give the value columns a `title(...)` header (inherits the no-op-sort bug) or a
   plain non-sortable label? The owner asked only for a **non-editable** header, which does not
   settle sortability.
5. **`dropWidth` per stage must now drop 3 keys**, not 1.
6. **What does the shortcut do to `Suma netto` / `Suma brutto` in the footer?** They are unconditional
   today and independent of the picker by design. Does the shortcut reach them (making it more than a
   picker shortcut) or not (leaving a visible brutto total with every brutto column hidden)?
7. **Does the shortcut persist?** The picker map is global; `usePriceView` is per-investment. Which
   does the shortcut follow — or is it derived state over the map rather than state of its own?
