# Review-gate ledger — kosztorys-editor-text-size · 2026-10-14

Scope: `f5ab44a87...kosztorys-editor-text-size` (94e3445e2, 73ccf4c8b, b2536d928). Step 0.5 skipped —
browser verification is not driven unasked; the slice's checks are in the registry.

Fan-out: `/10x-impl-review`, `/code-review`, `/tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (flag-only).

## Findings

- [x] 🟡 WARNING · fixed · impl-review + code-review · `kosztorys-editor-body.tsx` / `use-wrap-column-widths.ts` · the fit fell back to a hard-coded 14px font while no cell was rendered (empty kosztorys, first frame) and never re-measured — a hidden `grid-cell-text` probe inside the size wrapper now gives the hook a font before the first row exists
      test: no automated test · unit — the probe is static markup; the hook spec pins reading the font off `.grid-cell-text`, the manual check covers the fit on a size change
- [x] 🔵 OBSERVATION · fixed · code-review · `stage-header.tsx:107` · the etap rename input (a `typing-surface`) followed the picked size while editing — one rule `[data-grid-text-size] .dsg-row-header { --grid-cell-text: initial }` in `globals.css` keeps every header input on its own size
      test: no automated test · unit — CSS cascade, jsdom has no layout; manual check box added
- [x] 🔵 OBSERVATION · fixed · tailwind-v4-audit · `globals.css` `typing-surface` · from `sm` up its line-height was `--text-sm--line-height`, which shrinks with a smaller font — now a fixed `calc(var(--spacing) * 5)`, the same 20px line the cells hold
      test: no automated test · unit — layout, manual check covers the editing input at „Bardzo mała”
- [x] 🔵 OBSERVATION · fixed · impl-review · `use-wrap-column-widths.test.tsx` · no spec that re-picking the same size keeps the result identity (a new object resets the row-height cache) — added
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `kosztorys-view-menu.test.tsx` · the second spec's pick leaked into the first through localStorage — `beforeEach` clears it
- [x] 🔵 OBSERVATION · dismissed · impl-review · `plan.md` · the plan named the attribute `data-text-size` and put the class on the wrapper — the rename to `data-grid-text-size` is harmless and the probe replaced the wrapper class
- [x] 🔵 OBSERVATION · dismissed · code-review · `kosztorys-view-menu.tsx` · the `footer` is now always truthy, so the menu always renders its footer — intended: the size matters in the workbench and „Oferta” too
- [x] 🔵 OBSERVATION · dismissed · code-review · `globals.css` · a future `typing-surface` field inside the wrapper would inherit the size — none exists outside the header, which the `.dsg-row-header` rule now covers
- [x] 🔵 OBSERVATION · dismissed · code-review · portal content (`CellSelectMenu` list) does not follow the size — the trigger in the cell does; the list is a popover with its own size
- [x] 🔵 OBSERVATION · skipped · impl-review · `plan.md` Progress 1.1 / 2.1 / 2.2 · the spec rows stay unticked — the specs have not been run in this session (tests blocked unless asked); they tick when the suite runs
- [x] fixed · comment-noise-audit · `globals.css` · the `grid-cell-text` comment claimed `SimpleSelect` reads the var — false; trimmed to what the var does
- [x] fixed · comment-noise-audit · `editable-cell-input.tsx` · „phone size” described the wrong case — now „drops to the grid's size”
- [x] fixed · comment-noise-audit · `use-wrap-column-widths.test.tsx` · helper comment restated the helper — removed
- [x] dismissed · comment-noise-audit · `use-grid-text-size.ts:11` · flagged as noise — kept, it explains why the key is not shared with the tables
- [x] dropped · tailwind-v4-audit · `src/lib/utils.ts` `cn` · register `grid-cell-text` with tailwind-merge — no caller passes a `text-*` override beside it
- [x] dropped · tailwind-v4-audit · class order nit in `editable-cell-input.tsx` — churn only
- [x] dropped · code-review · `use-wrap-column-widths.ts` `EMPTY` 14px placeholder — replaced by the first real read in the same frame
- [x] dropped · module-cohesion-audit · moving the preview rule into `useGridTextSize` — one caller, the body owns preview
- [x] dropped · structure-scatter-audit · moving `TextSizeMenuSection` out of `tables/data-table/` to a neutral home — the scatter audit itself rates the placement fine at two consumers
- [x] fixed · simplify (reuse) · `dropdown-menu.tsx` `DropdownMenuRadioItem` · inline `preventDefault` to keep the menu open — the radio item now defaults to `keepMenuOpen()`, like the checkbox item
- [x] fixed · simplify (reuse) · `column-toggle.tsx` / `table-text-size.ts` · the table size list was spelled twice — one `TABLE_TEXT_SIZES` `as const`, the type derived from it
- [x] fixed · simplify (simplification) · `use-wrap-column-widths.ts` · `textSize: string` → `GridTextSizeT`
- [x] fixed · simplify (altitude) · `stage-header.tsx` · per-input `[--grid-cell-text:initial]` replaced by the one `.dsg-row-header` CSS rule (see the code-review finding above)
- [x] fixed · simplify (altitude) · `kosztorys-editor-body.tsx:382` · `preview || report` → `preview` — `report` only ever arrives with `preview`
- [x] dismissed · simplify (reuse) · `section-header-cell.tsx:155,162` · the band's count and net could take the grid size — the band stays at its size by the owner's scope
- [x] dropped · simplify (efficiency) · `use-wrap-column-widths.ts` · the font is re-read on every fit frame — one `getComputedStyle` on one span, negligible
- [x] dismissed · simplify (simplification) · `use-wrap-column-widths.ts` · the `prev.font` fallback is unreachable once the probe exists — the hook specs render without a probe and pin that path
- [x] skipped · simplify (altitude) · `use-wrap-column-widths.ts` · a `ResizeObserver` on the probe instead of the `textSize` cue + `fonts.ready` — would also re-fit on the app-wide „Rozmiar” switch (a pre-existing gap: the old composed font ignored it), but it changes the re-measure mechanism; not auto-applied
- [x] dropped · simplify (altitude) · pass the probe by ref instead of a selector — churn for no behaviour change
- [x] dropped · simplify (altitude) · move the text-size hook to `kosztorys-editor-v2` — the body is the one reader

## Simplify pass

Ran /simplify (4 agents: reuse / simplification / efficiency / altitude) — 6 applied, 0 proposed, 6
dismissed/dropped/skipped; each finding folded into ## Findings (tagged simplify). No separate
/simplify report file — this ledger is the record.

## Tests & suite
