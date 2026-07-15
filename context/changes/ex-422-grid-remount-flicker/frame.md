# Frame Brief: Kosztorys grid remounts on every price-view toggle (EX-422)

> Framing step before /10x-plan. This document captures what is _actually_
> at issue, separated from what was initially assumed.

## Reported Observation

Clicking the price-view toggle (Klient / Z narzędziami / Bez narzędzi) makes the entire
kosztorys grid flicker. User confirmed 2026-07-15 that `client → w_tools` and
`client → own_tools` both still flicker.

## Initial Framing (preserved)

- **Stated cause** (agent-originated, NOT the user's): `view` sits in the `DataSheetGrid`
  remount `key` (`kosztorys-editor-body.tsx:89`). The justifying comment ("dsg freezes
  `columns` at mount") is **false** — dsg's `useColumns` memoizes on `[gutterColumn,
stickyRightColumn, columns]` array identity, and `buildV2Columns` returns a fresh array
  each render, so the memo misses and columns already update without a remount. The `key`
  is cargo cult.
- **Proposed direction**: hoist the four inline `component:` arrows to module-level
  components, then drop `view` from the `key`.
- **Pre-dispatch narrowing**: none — the framing under test was the agent's own, not the
  user's. This was the trigger for running /10x-frame at all.

## Dimension Map

1. **The `key` is unnecessary; dsg is reactive** — the library picks up columns on its own. ← initial framing
2. **React Compiler memoizes `buildV2Columns`** — stable array identity → dsg's `[columns]`
   memo _hits_ → effectively frozen, reconciling the source with the empirical lesson.
3. **Something below `useColumns` snapshots columns at mount** — a reactive `useColumns`
   could still render stale cells.
4. **The app is not using the component we think it is** — the freeze is real but lives in
   a different export.

## Hypothesis Investigation

| Hypothesis                                                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                         | Verdict            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| **4. Wrong export — the public `DataSheetGrid` IS `StaticDataSheetGrid`** | `dist/index.js:6-7`: `exports.DynamicDataSheetGrid = DataSheetGrid_1.DataSheetGrid; exports.DataSheetGrid = StaticDataSheetGrid_1.StaticDataSheetGrid;` — public names are **swapped** vs internal filenames. `dist/components/StaticDataSheetGrid.js:23-24`: `const [staticProps] = useState({ columns, ... })` — literal mount snapshot, never updated. App imports `{ DataSheetGrid }` (`kosztorys-editor-body.tsx:5`) → gets the frozen one. | **STRONG**         |
| 1. `key` unnecessary; dsg reactive (initial framing)                      | True _of `components/DataSheetGrid.js`_ (0 hits for `useState({`; `useColumns.js:121` deps include `columns`) — but that file is exported as `DynamicDataSheetGrid`, which the app does **not** import. The framing read the right source and the wrong export.                                                                                                                                                                                  | **NONE** (refuted) |
| 2. React Compiler memoizes `buildV2Columns`                               | Compiler IS on (`next.config.ts:5`). But running `babel-plugin-react-compiler@1.0.0` over the hook produced **no `useMemoCache`/`_c[]`** — two independent hard bailouts: `Refs` "Cannot access refs during render" (`use-kosztorys-editor.ts:116`, `:122`) and `Todo` computed key (`:324`). The hook is uncompiled; columns genuinely are fresh each render.                                                                                   | **NONE** (refuted) |
| 3. Freeze below `useColumns` in the reactive component                    | Traced full path: `Grid.js:35` and `Cell.js:9` are **not** memoized; `Grid.js:118-142` reads `columns[col.index].component` fresh each render; `useColumnWidths.js:98` deps `[width, columnsHash]` is a value-hash; `Grid.js:80-82` re-measures the virtualizer on width change. No freeze mechanism.                                                                                                                                            | **NONE**           |

## Narrowing Signals

- **`lessons.md:119-124` is correct.** It was nearly dismissed as ported hearsay
  (`4e6b4cf docs(lessons): port full kosztorys-editor lessons from POC branch`, 2026-07-10,
  postdating the `key` at `6b44f8f`, 2026-07-08). The provenance is genuinely weak, but the
  _claim_ is true. Weak provenance is not evidence of falsehood.
- **The decisive git history — the circle:**
  - `9e401e0` switched `DataSheetGrid` → `DynamicDataSheetGrid` (reactive).
  - `4dc6d32` **"fix migotania"** switched back `DynamicDataSheetGrid` → `DataSheetGrid` (frozen).

  So: swapping to the frozen export to fix a flicker **froze the columns** → which produced
  "all 3 views showed the client price" → which is why the remount `key` was added → **and
  that remount is EX-422's flicker.** The workaround for the fix for the flicker is the flicker.

- **`StaticDataSheetGrid` never appears in any commit** (`git log -S --all` → zero). It has
  always been reached through the aliased `DataSheetGrid` name — which is exactly why the
  trap survived three separate investigations.
- **The original flicker `4dc6d32` was fixing has since been fixed properly.** Per
  `lessons.md:98-102`, that was a ResizeObserver width-oscillation loop, cured by giving the
  container a definite width. That fix is in place today (`kosztorys-editor-body.tsx:82`,
  `grid-cols-1` = `repeat(1, minmax(0,1fr))`), independent of which export is used.

## Cross-System Convention

A library exporting a memoized/frozen variant under the _plainest_ name, with the reactive
variant behind a longer one, inverts the usual convention (plain name = the general case).
react-datasheet-grid's docs present `DataSheetGrid` as the default and `DynamicDataSheetGrid`
as the opt-in for columns that change at runtime — so the app's usage is a genuine misuse,
not a library bug. Verifying a library claim by reading `components/<Name>.js` is unsafe
whenever `index.js` re-exports under different names; the entry point is the only source of truth.

## Reframed Problem Statement

> **The actual problem to plan around is**: the editor imports `DataSheetGrid`, which is
> really `StaticDataSheetGrid` — it snapshots `columns` at mount via `useState`. Every
> column-shaping dimension (`view`, `stages`, widths, sort) is therefore forced through a
> whole-grid remount `key`, and that remount is the flicker. The fix is to use the reactive
> export (`DynamicDataSheetGrid`) and delete the `key`, not to delete the `key` alone.

Deleting the `key` while still on the frozen export would resurrect the exact 2026-06-20 bug:
all three price views rendering the client price. The `key` is load-bearing **given the
current import** — it is only cargo cult once the import is corrected. This also explains
why the codebase's mount-frozen-closure workarounds (`rowsRef`, `stagesRef`,
`use-kosztorys-editor.ts:110-122`) exist: they are real consequences of a real freeze, and
they may become removable once the import is fixed — but that is a separate question, not a
freebie.

## Confidence

**HIGH** on the mechanism — proven from `dist/index.js:6-7` + `StaticDataSheetGrid.js:23-24`,
independently corroborated by the `9e401e0` → `4dc6d32` export swap and the symptom it produced.

**MEDIUM** on the fix being drop-in. `4dc6d32` swapped away from `DynamicDataSheetGrid` for a
reason ("fix migotania"). The evidence says that reason was the ResizeObserver width-oscillation
loop, now independently fixed by the definite-width container. But that reasoning is inferred
from `lessons.md:98-102`, not observed — switching back could resurface a _different_ flicker.

**Verification required before planning is finalized:** in the browser, swap the import to
`DynamicDataSheetGrid`, remove `view` from the `key`, and confirm (a) all three views render
distinct prices, (b) no ResizeObserver oscillation returns (sample
`getBoundingClientRect().width` across rAF for ~2s; >1 distinct value = the old bug is back).

## What Changes for /10x-plan

The plan is **"correct the import, then remove the workarounds it forced"** — not "remove a
needless `key`". Order matters: switch the export and prove columns react _before_ touching the
`key`, so each step is independently falsifiable. The inline-`component:`-arrow cleanup
(`kosztorys-v2-columns.tsx:166, 218, 258, 344`) is real but **orthogonal** — it is a per-render
cell remount, not the flicker, and should not ride along in the same phase.

Doc corrections owed: `lessons.md:119-124` is right about the freeze but blames the library
generally — it should name the **export-aliasing trap** as the mechanism, which is the actually
transferable lesson. The comments at `kosztorys-editor-body.tsx:84-88`, `use-kosztorys-editor.ts:86`,
`:94`, and `kosztorys-v2-columns.tsx:351` are correct as written and must **not** be deleted while
the frozen import stands.

**Also correct EX-422 itself** — its description currently asserts the frozen-columns claim is
false. That is wrong and must be retracted before anyone acts on it.

## References

- `node_modules/react-datasheet-grid/dist/index.js:6-7` — the export aliasing (the crux)
- `node_modules/react-datasheet-grid/dist/components/StaticDataSheetGrid.js:23-24` — the mount snapshot
- `node_modules/react-datasheet-grid/dist/hooks/useColumns.js:121` — reactive, but on the unused export
- `src/components/kosztorys/kosztorys-editor-body.tsx:5` (import), `:82` (definite width), `:89` (the `key`)
- `src/components/kosztorys/use-kosztorys-editor.ts:110-122` (ref workarounds), `:130` (`buildV2Columns`)
- `context/foundation/lessons.md:98-102` (ResizeObserver flicker), `:119-124` (the freeze — correct)
- Commits: `9e401e0` (→ Dynamic), `4dc6d32` ("fix migotania", → frozen), `6b44f8f` (`key`), `4e6b4cf` (lesson ported)
- Linear: EX-422 (parent EX-435)
