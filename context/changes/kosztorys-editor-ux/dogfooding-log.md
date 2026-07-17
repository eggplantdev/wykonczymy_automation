# Kosztorys editor v2 — dogfooding log

Running notebook while driving editor v2 by hand (owner = Google Sheets user). **Not a plan, not a
spec.** Just: what we hit, what we tried, whether it works, what's still open. Tests deliberately
deferred until a flow proves worth keeping. Umbrella: EX-435. Started 2026-07-13.

Status key: 🟢 works · 🟡 in flight / needs a look · 🔴 broken · ⚪ idea, not built

---

## 1. Cold-start: fresh kosztorys is a dead blank grid 🟢

**Symptom.** Open a brand-new investment's kosztorys with no preset → empty grid, no obvious way to
add a row. (Grid renders rows only from `section.items`; zero sections = zero rows = nothing to
click.)

**Fix shipped.** New investments now auto-seed **1 section ("Nowa sekcja") + 1 blank item** when no
preset is chosen, so you always land on a typable row.

- `createInvestmentAction` (no-preset branch) → `seedBlankKosztorys()` (`src/lib/kosztorys/seed-blank.ts`)
- Non-fatal, mirrors the preset-seed path. Existing empty investments NOT backfilled (→ import slice).
- Linear **EX-463** — committed `4bbe53a`, In Progress (not merged).

---

## 2. "How do I add an item?" — add-position discoverability 🟡

**Symptom.** With a section present, adding a position is still not obvious. The only paths were:

- toolbar **`＋ pozycja`** — was hidden until a section filter was active
- **Sekcje** side panel — a 14px `+` per section

Neither reads as "add a row here" to a Sheets user.

**Two things in flight right now:**

### 2a. Toolbar `＋ pozycja` always visible 🟢 (kept — dogfooding confirmed)

Made the button always render; it targets the filtered section if one is active, else the last
section. **Decision locked:** the standalone button stays. Under sustained dogfooding it's the
affordance actually reached for — a visible "add a row" beats the hidden right-click/⋯ gesture.
Overrides EX-436's original design, which proposed removing it.

- `kosztorys-editor-toolbar.tsx` (`addItemSectionId`), wired in `kosztorys-editor-body.tsx`.

### 2b. Right-click → context menu (the real fix, EX-436) 🟡 built, untested-by-hand

Google-Sheets gesture: **right-click a grid row → Wstaw pozycję powyżej / poniżej / Usuń pozycję.**

**Flow (what happens on a right-click):**

1. datasheet-grid selects the cell under the cursor and fires `onActiveCellChange` → we stash the
   row index in `activeCellRef` (`kosztorys-editor-body.tsx`).
2. `onContextMenu` on the grid wrapper reads that ref → `viewRows[row]` = the anchor row, captures
   cursor `{x,y}`, opens `<KosztorysRowContextMenu>`. (If the click wasn't on a data row, we bail and
   let the native menu show.)
3. Menu action → `handleInsertItem(anchor, 'above'|'below')` in `use-kosztorys-editor.ts`:
   - insert point `atDisplayOrder` = anchor's `displayOrder` (above) or `+1` (below)
   - `insertItemAction(investmentId, sectionId, at)` → server shifts the section tail
     (`display_order += 1 WHERE display_order >= at`) then creates a blank item at `at`
   - optimistically splice the new row into the grid at the anchor (±1) and bump local
     `displayOrder` of shifted same-section rows (`applyInsertItem`)
   - **Usuń pozycję** reuses the existing `handleRemoveItem` (its ≥1-per-section + populated-row
     guards + toasts — no new delete path).
   - Insert is a **no-op while a column sort is active** (menu items disabled + tooltip); "above/
     below" has no meaning against a price-sorted list. Mirrors the ▲▼ column.

**Files touched:** `kosztorys.ts` (`insertItemAction`), `v2-rows.ts` (`insertDisplayOrder`,
`applyInsertItem`), `use-kosztorys-editor.ts` (`handleInsertItem`), `kosztorys-row-context-menu.tsx`
(new), `kosztorys-editor-body.tsx` (wiring).

**To verify by hand:**

- [ ] Right-click a row → menu appears at cursor; closes on outside-click / Esc / scroll.
- [ ] Wstaw powyżej / poniżej lands the new row in the right spot; order survives a reload.
- [ ] Usuń respects the ≥1-item and populated-row guards.
- [ ] Menu items greyed out while a column sort is on.
- [ ] Right-click on the header / empty area → native browser menu, no crash.

**Resolved:** the toolbar button (2a) **stays** — dogfooding proved it's the primary add path, the
menu is the power gesture, not a replacement. No unit/E2E tests until this flow is locked (EX-436
design lists them as owed at the review gate — not now).

---

## 3. Context menu opened center-screen, not at the cursor 🟢

**Symptom.** Right-click a row on the left → menu popped up in the middle of the screen.

**Cause.** App shell `<main>` (`(frontend)/layout.tsx:58`) uses `transform-gpu`. A `transform`
ancestor becomes the containing block for `position: fixed`, so the menu's `{left,top}` were measured
from `<main>` (offset by sidebar + scroll), not the viewport.

**Fix.** Render the menu via `createPortal(…, document.body)` — body is outside the transform, so
`fixed` + cursor coords are viewport-relative again. (`kosztorys-row-context-menu.tsx`.)

**Latent same-bug:** the column-resize `guideX` line (`kosztorys-editor-body.tsx`, `fixed inset-y-0`)
has the identical containing-block issue — vertical so less visible. Not touched. → parking lot.

---

## 2c. Add is undiscoverable — nothing signals "right-click here" 🟡 accepted, deferred

Owner: "I don't even know what to right-click on." Right-click is a hidden accelerator, not a
discoverable affordance. Agreed direction: a **visible `+` in the actions column** (insert-below),
right-click stays as the power gesture. **Deferred for now** — kept the toolbar `＋ pozycja` as the
visible path while we test the rest.

---

## 4. Column-resize guide stripe misaligned → fixed via portal (kept) 🟢 confirmed by hand

**Symptom.** While dragging a column edge, the vertical guide stripe appeared offset from the column
being resized.

**Cause.** Same as §3 — the guide is `fixed` with `left: guideX` (cursor viewport X), and
`transform-gpu` on `<main>` makes that `left` relative to `<main>`, not the viewport → shifted by the
sidebar width.

**Decision history (reversed once):**

1. First removed the guide entirely, assuming it was non-essential (resize commits on pointer-up
   regardless).
2. **Reversed:** with it gone, the drag felt worse — the guide _was_ pulling its weight as live
   feedback. Owner: "now that it is lacking, I see that it was helpful." The bug was position, not
   the feature.

**Final fix.** Guide restored, now rendered via `createPortal(…, document.body)` — outside the
`transform-gpu` ancestor, so `fixed` + cursor X is viewport-relative and tracks the column edge.
Same portal fix as the context menu (§3).

- `guideX`/`onGuide` plumbing restored across `use-kosztorys-editor.ts`, `kosztorys-v2-columns.tsx`,
  `column-resize-handle.tsx`; body renders it through a portal.
- **Lesson:** don't delete a visual aid to dodge a positioning bug — fix the position. `transform`
  ancestors + `position: fixed` = portal to body.

---

## 5. Columns won't shrink below a floor (EX-424) 🟢

**Symptom.** A column can be widened freely but only shrunk down to some minimum, then it refuses.

**Cause.** On drag-release, `ResizableHeader` clamped the committed width to the column's **design**
`minWidth` (90–240px depending on column) — so nothing narrower could ever be stored.

**Fix.** Clamp a user-dragged width to a small hard floor `RESIZE_MIN_PX = 40` instead of the design
min (`column-resize-handle.tsx`). Below the design min but non-zero, so a column can't become an
unhittable 0-width sliver. The design `minWidth` still governs the grid's flex layout for unpinned
columns. Linear **EX-424** — committed `bdbeac4`, In Progress (owner-confirmed, not merged).

---

## 6. Delete "eats row 0" scare — cosmetic, not a data bug 🟢 investigated

**Symptom.** Deleting any row appeared to also drop the first row ("row 0"), which then reappeared a
moment later. Read as: delete is destroying a second row.

**Investigation (Playwright + temporary state logging on `handleRemoveItem` / `onChange`).** On
deleting a row, state went `[14,19] → [14]` — **only the clicked row leaves state; row 0 never
leaves.** `onChange` does not fire, server returns `{success: true}`. State is provably correct the
whole time; no value is ever lost.

**Verdict.** A transient **react-datasheet-grid virtualization repaint** — remaining rows re-position
(`top` shifts) as the value array shrinks, so row 0 briefly flickers. Cosmetic only. **No change to
the delete path.** If the flicker is worth killing later, the fix lives at the grid-render level (row
reconciliation / remount stability), not in `handleRemoveItem`. → parking lot.

---

## 7. Row actions consolidated into a ⋯ menu (replaces §2b right-click) 🟢 committed

**Decision.** Right-click was undiscoverable (§2c). Replaced it with a visible per-row **⋯ button**
(fills the whole actions cell) opening one menu: Wstaw powyżej/poniżej, Przesuń w górę/dół, Usuń.
Owner call: **replace** right-click (not keep both), and include **Move up/down now**.

**Key realisation:** Move up/down already existed as `handleReorderItem`/`swapItemOrderAction` (the
old ▲▼ arrows) — so this was a _consolidation_, not new plumbing. Three scattered affordances
(▲▼ + 🗑 + hidden right-click) → one ⋯ menu.

- New `KosztorysRowActionsMenu` (button-triggered, portaled to body — same containing-block fix);
  dropped `kosztorys-row-context-menu.tsx` + all `onContextMenu`/`activeCellRef` grid wiring.
- Whole cell is the click target (`size-full` button) — a small centred icon left dead space.
- Insert/move disabled while a column sort is active; delete disabled on a section's last item.
- Committed **956c853** (EX-436). Toolbar `＋ pozycja` stays as the primary visible add path.

---

## 8. Brutto toggle: REMOVED — always show Brutto (EX-426 canceled) ✅

**Symptom.** A plain "Brutto" button (highlight when on) — can't tell if it means "showing brutto"
or "click to show brutto", and no hint what it affects.

**Resolution (2026-07-13): removed the toggle, Brutto is always shown.** Chasing the label/tooltip
fix surfaced the real question — _why is there a toggle at all?_ The decision trail
(`context/archive/2026-07-10-kosztorys-vat/`) shows research **recommended always-on, no toggle**
(to avoid the DSG remount-key cost); it flipped to toggleable only as an unexplained "Owner
decision" (`plan-brief.md:33`), with no user-facing rationale for hiding Brutto ever recorded. So
the toggle was pure cost. Dropped it: the additive Brutto column + `Suma brutto` are now
unconditional. Removed `bruttoVisible` state + button + prop threading across the five editor files;
`gross` column unconditional in `buildV2Columns`. `tsc` clean.

Side benefit: `bruttoVisible` left the grid remount `key`, killing one of EX-422's two flicker
triggers (view-switch remount remains — EX-422 scoped down to that).

**Superseded work.** The `SimpleTooltip` + `delayDuration` (500 ms) addition shipped in `4bbe53a`
stays (general-purpose, still used by the price-view legend). The Pokaż/Ukryj brutto button and its
tooltip are gone.

**Parked note (still open):** column placement — Brutto renders far-right (after Netto, before
Pozostało), owner had to scroll to find it. Pin next to Netto or as a sticky end-column? Now that
it's always visible this matters more, not less. Still a normal in-flow column for now.

---

## 9. Grid outer top + left frame removed 🟢 confirmed

**Want.** Drop the editor grid's outermost top and left border lines.

**Two wrong turns, then the fix.**

1. Zeroed `border-top`/`left` on header + gutter cells → no visible change.
2. Zeroed them on **every** `.dsg-cell` → killed _all_ interior lines (rows went borderless).
   Learning: dsg draws every grid line as a per-cell top/left **border**; the mirror bottom/right
   box-shadows are **covered by the cells' opaque backgrounds**, so they only show on the outer
   right/bottom edge — they do NOT back up the interior lines.
3. **Fix that stuck:** shift the whole grid up-and-left by 1px (`margin-top/left: -1px` on
   `.dsg-container`) so the outer top/left border falls outside the wrapper's `overflow-hidden`
   clip. Interior lines + right/bottom frame untouched. (`globals.css`, committed `f275541`.) No
   dedicated Linear issue — loose dogfooding fix under the EX-435 umbrella.

---

## 10. Grid flicker on the price-view toggle — the wrong import all along (EX-422) 🟡 in review

**Symptom.** Toggling Klient / Z narzędziami / Bez narzędzi flickered the whole grid.

**Cause chain (four workarounds for one bug).** `4dc6d32` ("fix migotania") switched the import from
`DynamicDataSheetGrid` to `DataSheetGrid` — but dsg 4.11.6 **aliases the public names**
(`dist/index.js:6-7`): the plain `DataSheetGrid` export IS `StaticDataSheetGrid`, which snapshots
`columns` via `useState` at mount. That froze the columns, which caused the "all 3 views show the
client price" bug, which got a remount `key` as a workaround — **and that remount was the flicker.**
All four `key` segments (`view`, `sorted/natural`, `widthsKey`, `stagesKey`) existed only to paper
over the wrong import.

**Fix shipped `ee497cb`.** Import `DynamicDataSheetGrid`, drop the whole `key`. The original
ResizeObserver width-oscillation that `4dc6d32` was really chasing already has its own fix — the
`grid-cols-1` definite-width container (`kosztorys-editor-body.tsx:85`). Toggle flicker confirmed
gone by hand.

**`widthsKey` proved unnecessary** — measured under Playwright (grow, shrink, other column, slow
drags, release outside the grid, 3px nudge, three rapid drags): every one commits, persists, applies
live, no remount. The width path is reactive end-to-end (`useSyncExternalStore` → fresh `columns` →
dsg rehashes on `basis/minWidth/maxWidth` → `Grid.js:79-81` re-measures the col virtualizer).

**Stuck resize guide — pre-existing, fixed.** The guide only cleared in `onPointerUp`; on
`pointercancel` no `pointerup` ever arrives, so it hung at the last cursor X and the commit was lost.
Added `abortDrag` on `onPointerCancel` + `onLostPointerCapture` (`column-resize-handle.tsx`).
Synthetic `pointercancel` does NOT trigger a real `lostpointercapture` — hence both handlers, not one.

**Still open 🔴 — resize is intermittent.** Owner: "sometimes it works, sometimes not", still true
after the pointercancel fix. Not reproducible with any synthetic input. Ruled out: `remountKey` (only
bumps on restore), stale `widths` closure. Remaining suspects: real trackpad gesture cancellation;
the debounced save (500ms) / `router.refresh()` (700ms) landing mid-drag. **Next move: instrument the
live app to capture the event sequence on a real failure — not more synthetic drags.** EX-422 parked
In Progress + `[in review]`; owner owns the manual loop.

**Lesson (bought expensively).** Three times this session a detailed theory got built before
reproducing anything — and one screenshot from the owner did more diagnostic work than four files of
library source. Reproduce first, explain second. Also: a repro that shows _zero_ events is a broken
repro, not evidence (a Radix overlay was eating `pointerdown` — that nearly "confirmed" a false
theory).

**Correction (later the same day) — `stagesKey` was NOT unnecessary. 🔴 It was hiding a bug.**
`StageHeader` renders an **uncontrolled** `<input defaultValue={stage.label}>`, and dsg keys header
cells by **column index** (`Grid.js:98`, the virtualizer's `col.key` — no stable identity). Deleting
a stage slides every later stage one index left onto a DOM node that keeps the previous stage's
text; the next blur then fires `onRename(nextStage.id, previousStageLabel)` — it renames the wrong
stage. `stagesKey`'s whole-grid remount reinitialized every header input, which masked it. Fixed
with `key={stage.id}` on the input — correct regardless of the remount question.
**Mechanism read from source; not yet reproduced by hand** — owner verification owed (name 2+ stages
distinctly, delete the first, check the labels). Test disposition on EX-422.

**Doc contradiction resolved.** EX-422's description and this section read as contradicting each
other; they don't. Both are right about **different exports** — `StaticDataSheetGrid` genuinely
freezes, `DynamicDataSheetGrid` genuinely doesn't (`useColumns` = `useMemo` on the `columns` array
identity). The retraction was written ~11:58, `ee497cb` landed 12:09 and applied that issue's own
Proposed fix — so the description is **stale, not wrong**. Full trail in EX-422's resolution comment.

**Docs corrected.** `lessons.md:119` was true about the freeze but blamed the library generally —
that generalisation _is_ what caused the misdiagnosis; rewritten around the real mechanism, the
**export-aliasing trap**. Stale "dsg freezes columns" reasons stripped from `use-kosztorys-editor.ts`,
`kosztorys-v2-columns.tsx`, `stage-header.tsx`. `rowsRef`/`stagesRef` + `widthsKey`/`stagesKey` kept
as the rollback path — their stated reason is gone, but that's EX-422's step 4, not a freebie.

**Owed:** no automated test covers any of this. Two dispositions on EX-422 — unit/RTL: (a) a `view`
change updates the rendered price column WITHOUT a remount (mount counter on a cell); (b) deleting a
stage leaves each remaining header showing its own label (pins the regression above).

---

## 11. Column order now mirrors the source sheet 🟢 committed

**Want.** Owner: "przestawmy ustawienie kolumn tak, żeby odpowiadało temu co jest w arkuszu."

**Order shipped** (`85ceecc`, `kosztorys-v2-columns.tsx`):

```
Akcje | Sekcja | Opis prac | etapy (ilość) | Przedmiar | Pomiar | J.m.
| [Źródło ceny] | Cena | Rabat | Rabat wart. | Netto | Brutto | Pozostało
```

Two moves: **etapy jump from before-`computed` to right after Opis prac**, and **J.m. moves behind
Pomiar** (sheet: B opis → C–H etapy → I Przedmiar → J Pomiar → K j.m.). Mechanically this is a split
of `left` into `identity` + `pricing` so the stage columns can land between them.

**Owner decisions:**

- **Etapy right after Opis prac — 1:1 with the sheet.** Overrode the agent's recommendation to leave
  them at the end (argument: 6 stages push Przedmiar/Pomiar off-screen, and those are the
  most-typed fields). Sheet parity won; revisit if horizontal scrolling actually bites.
- **Sekcja stays first** — it IS the sheet's column A (carries the section name on header rows,
  `kosztorys-editor-domain-notes.md:47`). The agent wrongly claimed it doesn't exist in the sheet.
- **Źródło ceny wykonawcy** renders only in subcontractor views (`view !== 'client'`) — that's why
  it's invisible in the Klient view, not a bug.

**Column widths survive the reorder** — `useColumnWidths` keys by `col.id`, not position, and no id
changed. (Had it been a position-indexed array this refactor would have been a silent bug: Przedmiar's
width landing on the first stage.)

**Sheet columns we don't have** (raised, not resolved): `O komentarz`, `P–U etapy (wartość)` — we
carry one `Netto` instead. **Ours the sheet lacks:** `Akcje`, `Brutto`, `Źródło ceny`, and our Rabat
is split in two (typ + wartość) vs the sheet's single `M rabat %`. Notes:
`context/changes/kosztorys-column-order-sheet-parity/change.md`.

**Note on §8's parked question:** Brutto is still far-right. The reorder didn't address it — the
sheet has no per-row Brutto to copy, so there's no parity answer to lean on. Still open.

---

## 12. Global mnożniki + VAT moved out of the Sekcje panel into a second toolbar row 🟢 confirmed by hand

**Symptom.** The investment-wide settings — default client-price multipliers + the VAT rate — lived
_inside_ the "Sekcje" drawer, above the section list. They are not per-section, and the drawer is
toggleable, so the values were invisible by default.

**This closed a standing roadmap decision.** Open Roadmap Question #8 ("Settings-home UX") had been
parked since 2026-07-10 with two candidate homes — detail-inwestycji or a future "Podsumowanie"
panel — and one explicit constraint: **not the side panel**. Owner picked a **third** option: a
second row in the editor toolbar. Reasoning that killed the alternatives: the whole point of moving
them is that they be _seen_; detail-inwestycji is a click away and a popover just re-hides them
somewhere new. A rejected middle option — show only the multiplier relevant to the active price
view — was clever but loses the at-a-glance comparison of both.

**Shipped** (EX-478): `kosztorys-global-settings.tsx` (the row) + `coeff-field.tsx` (`CoeffField`
extracted, now shared with the per-section overrides). The global block was **deleted** from the
panel, not duplicated — two homes for one field is a future bug. The panel keeps `globalCoeffs` only
to render the inherited value as each section field's placeholder, and `vatRate` read-only for
`Suma brutto`. Per-section overrides stay put: they're attached to a section row.

Same pass, separate concern: a **`＋ sekcja`** toolbar button — adding a section no longer requires
opening the panel.

**Owner-confirmed by hand.** Toolbar was already crowded (title + view toggle + search + three ＋
buttons + menu + Sekcje); the second row is what made room without a popover.

---

## 13. Wartość przedmiaru netto/brutto — the sheet column nobody filled in 🟡 built, unverified by hand

**Want.** Owner: "względem reference arkusza brakuje nam wartości przedmiaru" — netto + brutto.

**What the sheet actually says.** `S = "wartość przedmiaru"` exists, between `R rabat` and
`T wartość netto` — and **it is a header with zero formulas and zero values across all 464 rows.**
The roadmap's own column map, stamped "Verified against the live sheet 2026-07-15 (formulas, not
screenshots)", jumped `R → T` and missed the column entirely. Both corrected.

**Why it was never wired (best read).** The sheet's `O` (pomiar) is `=N` (przedmiar), so pomiar
defaults to przedmiar and `S` would render identical to `T` until someone overrides pomiar by hand
— it looks like a duplicate column. **Our przedmiar/pomiar are two independent inputs** (S-01
decision), so the distinction is real from the first row: `Wartość przedmiaru` = offer value,
`Netto` = as-measured value.

**So this is new work, not parity** — same class as open roadmap question #12(b) (per-etap total).
There was no sheet behaviour to copy, so the formula was a decision, not a reading.

**Decision: rabat does NOT apply (owner).** `Wartość przedmiaru netto = Przedmiar × Cena`.

The agent shipped the opposite first (rabat applied, mirroring `rowNetForView`) on the argument
that the two columns should then differ by quantity alone — a clean comparison. **Owner overrode
it on domain grounds:** przedmiar is the **pre-negotiation valuation**; rabat is a settlement-time
concession and has no business touching the offer figure. So the gap `Netto − Wartość przedmiaru`
deliberately carries **both** the qty revision and the rabat — that's the honest picture of what
happened to the position, not a defect.

**Lesson:** "which formula makes the two columns compare cleanly" is a UI-symmetry argument; the
owner picks on what the number _means_ in the business. Symmetry lost, and should have — the
agent's rationale never asked what przedmiar represents.

**Shipped.** `rowPlannedNetForView` in `calc.ts` (sibling of `rowNetForView`) + two computed
columns at the head of the `computed` group — which lands them right before `Netto`, matching the
sheet's `S` slot. No migration, no new data: `plannedQty`, `viewPrice`, `vatRate` were all already
on the row. `tsc` clean, existing 13 calc tests green.

**Stale docs corrected in the same pass:** `kosztorys-v2-columns.tsx` stated in two places that
przedmiar "nie wchodzi do żadnego obliczenia" — true until this change, false after it.

**To verify by hand:**

- [ ] Set przedmiar ≠ pomiar on a rabat-free row → columns diverge by exactly Δqty × cena.
- [ ] Brutto column = netto × (1 + VAT) at the investment's rate.
- [ ] Switch price view (Klient / z narzędziami / bez narzędzi) → both columns re-price.
- [ ] **Rabat % and rabat zł leave Wartość przedmiaru untouched** and move only Netto.
- [ ] Column picker hides/shows both; widths persist.

**Tested** (owner asked for it once the formula was locked by a decision — the earlier defer was
about not chasing a moving target, and it stopped moving). 5 cases in `kosztorys-calc.test.ts`:
przedmiar-not-pomiar, per-view pricing, rabat-%-doesn't-touch-it, rabat-zł-doesn't-touch-it, brutto.

Two things the tests had to get right:

- The fixture's `plannedQty === measuredQty`, so every case **drives them apart** — otherwise a
  formula reading the wrong qty passes anyway.
- **Verified by mutation, not by going green:** flipping the formula back to `applyDiscount(...)`
  failed exactly the two rabat cases and nothing else. A test that can't fail pins nothing — and
  the asymmetry with `rowNetForView` is precisely what a future reader would "tidy up".

---

## Parking lot (⚪ noticed, not touched)

- Grid virtualization repaint flicker on delete (§6) — cosmetic; fix at DSG render level if it grates.

- Visible per-row `+` insert affordance (§2c) — superseded by the ⋯ menu (§7); the visible add is now
  the ⋯ menu + toolbar `＋ pozycja`.

- Brutto column placement (§8, §11) — pin next to Netto or as a sticky end-column vs. leave in-flow.
  The sheet-parity pass didn't settle it: the sheet has no per-row Brutto.

- Intermittent column resize (§10) — live 🔴. Owner testing by hand; next step is
  instrumentation on a real failure, not synthetic drags.

- Stage-header label regression from `ee497cb` (§10 correction) — fix applied (`key={stage.id}`),
  but **mechanism-only, never reproduced**. Owed: name 2+ stages distinctly, delete the first, check
  each remaining header shows its own label and a blur doesn't rename the wrong stage.

- Horizontal reach after the reorder (§11) — with 6 stages, Przedmiar/Pomiar/Cena sit far right.
  Sheet parity was the explicit call; if scrolling grates, sticky Opis prac is the lever.

- Kwota ↔ procent toggle + procent wykonania, per item and per stage — filed **EX-479**, parked
  before any code. Pure presentation: `rowDoneNetForView / rowNetForView`, both already exist.
  I first filed it as a data-model change, reading "z pomiaru z natury" as a quantity base — the
  owner corrected it. Price is constant within a row, so the value ratio already IS the pomiar
  ratio; only a zł (flat) discount breaks that equivalence. Lesson: an owner's phrasing describes
  what they want to see, not the formula to compute it — don't escalate a slice off one word.
