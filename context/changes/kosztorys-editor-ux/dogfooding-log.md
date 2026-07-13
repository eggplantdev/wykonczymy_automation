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
- Linear **EX-463**.

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
columns. Linear **EX-424**.

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

## 8. Brutto toggle: ambiguous state + no explanation (EX-426) 🟢 In Progress

**Symptom.** A plain "Brutto" button (highlight when on) — can't tell if it means "showing brutto"
or "click to show brutto", and no hint what it affects.

**Correction to the issue's premise.** EX-426 called it a "Brutto/Netto mode switch." It isn't — it
**show/hides an additive Brutto column** (`net × (1 + VAT)`); netto is always visible. Confirmed
against the umbrella (EX-435 lists it "option A: keep additive Brutto column"). So no mode label.

**Fix.**

- Label states the action + state: **Pokaż brutto** (outline) ↔ **Ukryj brutto** (filled,
  `aria-pressed`). Same width both ways → no layout shift (helps EX-421).
- Real hover tooltip via `SimpleTooltip` (Radix, portaled) instead of native `title`; the
  `asChild` trigger doesn't intercept the button's `onClick`, so no `stopPropagation` needed.
- Added an optional `delayDuration` to `SimpleTooltip` (default 0 = unchanged for all other
  callers); Brutto uses **500 ms** hover-delay.

**Note:** the Brutto column renders far-right (after Netto, before Pozostało) — owner had to scroll
to find it. Open question parked: pin Brutto next to Netto or as a sticky end-column? For now it's a
normal in-flow column.

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
   clip. Interior lines + right/bottom frame untouched. (`globals.css`.)

---

## Parking lot (⚪ noticed, not touched)

- Grid virtualization repaint flicker on delete (§6) — cosmetic; fix at DSG render level if it grates.

- Visible per-row `+` insert affordance (§2c) — superseded by the ⋯ menu (§7); the visible add is now
  the ⋯ menu + toolbar `＋ pozycja`.

- Brutto column placement (§8) — pin next to Netto or as a sticky end-column vs. leave in-flow.
