---
change_id: kosztorys-summary-charts
title: Two pie charts in the kosztorys Podsumowanie — section split and cost split
status: implemented
created: 2026-07-19
updated: 2026-07-21
archived_at: null
branch: konradantonik/ex-529-pie-udzialu-per-sekcja-offer-view-viz
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-ex529
---

## Notes

The owner's sheet carries a pie chart in its footer, next to the summary block. We want that in
the editor's Podsumowanie panel, plus a second chart the sheet does not have.

**Chart 1 — section split (sheet parity).** Each section as a slice of the whole kosztorys.
Reference: `context/reference/kosztorys-sheet/offer-view-footer.png` — „Łazienka 1 38,0%",
„Ściany i suf… 31,3%", „Podłogi 15,1%", „Prace doda… 7,0%", „Wyburzenia 3,0%",
„Montaż stol… 2,2%".

**Chart 2 — cost split.** Suma prac wykonanych / Materiały budowlane / Materiały wykończeniowe /
inne wydatki. Same figures the Podsumowanie table already lists, so the chart and the table must
agree by construction rather than by a second derivation.

The _chart_ is ours, but the figures are the sheet's — its footer carries them as named rows,
sourced from the read-only mirror tab:

```
r458  Q=„Pozostałe koszty"          T=='wydatki inwestycyjne (tylko do odczytu)'!I3
r459  Q=„Materiały wykończeniowe"   T=='wydatki inwestycyjne (tylko do odczytu)'!K3
r460  Q=„Materiały budowlane"       T=='wydatki inwestycyjne (tylko do odczytu)'!J3
r463  Q=„R netto - suma prac wykonannych"   T==SUM(V457:AE457)
```

So the four slices map 1:1 onto rows the owner already reads. Note the robocizna slice (r463) is
the **executed** Σ of the per-etap wartości — chart 2's base is executed work, unlike chart 1's
offer. Two charts, two bases, side by side: that needs to be legible in the labels, not left for
the viewer to infer.

### Chart 1 divides the OFFER — settled against the sheet, 2026-07-19

Read from the canonical sheet, not inferred. The footer's „wartość netto" row is

```
r456: S ==SUM(S4;S22;S397;S69;S89;S132;S193;S408;S419;S443;S42;S377;S255;S316)
      S = 33 967 zł    T = 0 zł
```

Those addresses are the **section header rows** (each section header's own `S` is the SUM of its
items' `S`). The pie's slices are exactly that set, and its base is that sum. The column is `S` —
the offer, `N × Q − rabat`, Przedmiar-priced — not `T`, the executed value.

The proof is in the same row: `T = 0 zł` across the whole sheet while the pie renders non-zero
slices. A pie fed from the executed column would be blank here. So: **slices = per-section Σ S,
base = Σ of the section headers' S.**

**Confirmed against the filled test sheet** (`1qN68vcevWgq0fXckdh4cuyBJ4iGZNlivVuHDvLuzWy4`), which
is emphatically NOT an offer — it carries real executed work, so both figures are live and distinct:

```
r395  „wartość netto"                    S ==SUM(S4;S22;S336;…;S255)   = 143 239 zł
r402  „R netto - suma prac wykonannych"  S ==SUM(U396:AD396)           = 129 036 zł
```

Same section-header sum feeds the pie; the executed total sits in its own row 14 203 zł below it.
This is the stronger evidence: in the canonical sheet the executed column is all zeros, so the pie
had no alternative to pick. Here it does have one, and still divides wartość netto.

Caveat, per the AGENTS.md warning that this fixture has broken formulas: its `O` („Pomiar z
natury") is `=N`, whereas the canonical sheet's is `=SUM(D:M)`. That's why its wartość netto is
przedmiar-priced and diverges from the etap sum. The canonical sheet remains the authority; the
filled one corroborates the _choice of column_, not the formula behind it.

Consequence for us: `sectionSubtotalsForView` carries a per-section `share`, but it is
`client.executed / grandClientNet` (`src/lib/kosztorys/settlement.ts:195-197`) — the executed
split. **Do not reuse it for this chart.** The figure we need is the per-section Σ of
`rowPlannedNetForView` (already the offer figure, rabat included by construction — `calc.ts:88`),
which `sectionSubtotalsForView` also accumulates as `plannedNet` (`settlement.ts:182`). That field
is the right source; `share` is not.

Keep the chart client-priced and view-invariant for the same reason `share` and `completionRatio`
already are (`settlement.ts:160-163`): a chart of the cost _structure_ must not move when the
widok cen toggles.

### Open question — EX-537

The sheet evidence above is settled, but the _intent_ is not: does the owner want the pie to keep
dividing the offer once a build is underway, or to show progress? And are two charts on two
different bases (sections = offer, costs = executed) legible side by side, or misleading?

Blocks planning. **EX-537** — https://linear.app/ex-plant/issue/EX-537

**Resolved 2026-07-21 (owner).** The section chart carries a live **Przedmiar ↔ Wykonane**
toggle (default Przedmiar), so the owner is not forced to pick offer-vs-progress once — they flip
it. Both bases are already computed per section (`plannedNet` / `net`), so the toggle only chooses
which split feeds the pie. The two-different-bases legibility worry is answered by labelling the
active base in the legend. See "Design — settled 2026-07-21" below.

### Charting stack

The repo had recharts + a shadcn `ui/chart.tsx` wrapper; both were removed in `d00e3380`
("remove unused recharts charting") as dead code — `report-charts.tsx` was fully commented out.
So this is a re-add, not a first install. `git show d00e3380` recovers the previous wrapper as a
starting point; prefer the current shadcn chart component over restoring the old file wholesale.

### Placement

Podsumowanie lives in a collapsible bottom panel (`kosztorys-totals-panel.tsx`) whose height is
already tight — two pie charts need a layout decision, not just a mount point. The sheet puts its
chart beside the summary block, not below it.

---

## Design — settled 2026-07-21 (EX-529)

Owner-confirmed shape. Everything below is decided; open questions above are resolved.

### Scope of THIS slice vs the next

- **This slice (EX-529):** the two footer pies with a **fixed** palette. No per-section colour is
  stored — slices take colour by index from `--color-chart-*`.
- **Next slice (separate):** per-section colour **storage** (a migration adds a `color` to the
  section row) plus a **colour picker** in the section panel. Deferred deliberately so this slice
  ships without a schema change. Do not build colour storage here.

### Charting stack — recharts (owner call, aesthetics)

Re-add **recharts `^2.15.4`** and restore the shadcn `ui/chart.tsx` wrapper from `d5087146`
(`git show d5087146:src/components/ui/chart.tsx`), fixing its stale import `@/lib/cn` →
`@/lib/utils/cn`. Hand-edit `package.json` then `pnpm install --force` (the lightningcss/arm64
gotcha — AGENTS.md → Dependencies), then `rm -rf .next` if the CSS build complains.

Both charts are **`next/dynamic`**-loaded (`ssr: false`) so recharts never enters the editor's
main chunk — it loads only when the footer panel opens. This is the mitigation that makes a heavy
charting lib acceptable here.

The hand-rolled `src/components/kosztorys/client/section-pie.tsx` (conic-gradient) is **deleted** —
superseded, never mounted.

### Chart 1 — Sekcje, with a Przedmiar ↔ Wykonane toggle

- Base **A** (sheet-faithful) is the default: slices divide **wartość netto przedmiar** — the
  per-section Σ `plannedNet` (`settlement.ts`), NOT `share` (which is executed).
- A toggle flips the base to **Wykonane** (the executed split — the existing `share` figure).
  Default **Przedmiar**. Both figures are already carried by `sectionSubtotalsForView`, so this is
  a source-selection, not a new calculation.
- The legend labels the active base so the two pies are never confused (e.g.
  „Udział sekcji — przedmiar" / „— wykonane").
- Toggle state is local client state on the chart; the pie is already a client component (recharts).

### Chart 2 — Koszty (executed, no toggle)

Slices: **Robocizna** (executed — `doZaplatyNet` / suma prac wykonanych) + the per-category
**materiały** rows already arriving as `materialyBreakdown` on `KosztorysTotalsPanel`. Same figures
the Podsumowanie table lists, so chart and table agree by construction. No toggle — this pie is
always executed, matching the sheet's r463 base.

### Placement & branch

- Mount both in the „Podsumowanie" footer (`KosztorysTotalsPanel` / `KosztorysPodsumowanie`),
  beside the summary block per the sheet. Panel height is tight — lay the two pies out so the
  collapsed panel still shows the „Do zapłaty" headline.
- **Stacked on `ex-532` (`kosztorys-client-view-reuse`), not `main`** — every surface this slice
  needs (`plannedNet`, `materialyBreakdown`, the footer panel, `summary-economics.ts`) is unmerged
  there. The PR targets `ex-532` or rebases once it lands.
