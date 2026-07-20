---
change_id: kosztorys-summary-charts
title: Two pie charts in the kosztorys Podsumowanie — section split and cost split
status: new
created: 2026-07-19
updated: 2026-07-19
archived_at: null
branch: null
worktree: null
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

### Charting stack

The repo had recharts + a shadcn `ui/chart.tsx` wrapper; both were removed in `d00e3380`
("remove unused recharts charting") as dead code — `report-charts.tsx` was fully commented out.
So this is a re-add, not a first install. `git show d00e3380` recovers the previous wrapper as a
starting point; prefer the current shadcn chart component over restoring the old file wholesale.

### Placement

Podsumowanie lives in a collapsible bottom panel (`kosztorys-totals-panel.tsx`) whose height is
already tight — two pie charts need a layout decision, not just a mount point. The sheet puts its
chart beside the summary block, not below it.
