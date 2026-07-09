# Kosztorys — finish the price-view surface (S-03 residual) Implementation Plan

## Overview

S-03's original scope — three price models + the "one dataset, three views" toggle + the
coefficient/override derivation — was already shipped by S-01 (see `research.md`). This change is
the **residual polish** on top of that shipped surface: (1) persist the selected price view
per-kosztorys so it survives reloads, (2) relabel the client-price view to "Klient" to match
FR-003 vocabulary, and (3) add the pricing-model explainer that `kosztorys-v2-columns.tsx:24-25`
flagged as a wanted UX follow-up, as an info tooltip on the view toggle. Additive, UI-only — no
schema, no server, no calc changes.

## Current State Analysis

- **The three-view toggle works.** `view` state (`use-kosztorys-editor.ts:67`), toolbar buttons
  (`kosztorys-editor-toolbar.tsx:8-52`), `view` in the dsg remount key
  (`kosztorys-editor-v2.tsx:73`), price column + totals recompute under the active view.
- **View is not persisted.** `const [view, setView] = useState<PriceViewT>('client')`
  (`use-kosztorys-editor.ts:67`) resets to "client" on every mount/reload.
- **A localStorage persistence pattern already exists** in `use-column-widths.ts`:
  `useSyncExternalStore` + a module-level `listeners` set + an SSR-stable `SERVER_SNAPSHOT`, giving
  zero hydration mismatch and no render loop. It uses a **single fixed key** — this slice needs the
  same shape but with a **per-investment key**.
- **`useKosztorysEditor` already receives `investmentId`** (`use-kosztorys-editor.ts:62`), so the
  per-kosztorys key needs no new prop threading.
- **Client-view label is "Robocizna"** (`kosztorys-editor-toolbar.tsx:9`); FR-003 names the model
  "klient". The other two labels ("Z narzędziami" / "Bez narzędzi") are correct and stay.
- **`InfoTooltip` exists and is the house pattern** — used in `financial-stats.tsx` as
  `<InfoTooltip content={…} label={…} className="…" />`; `content` supports `\n`.

### Key Discoveries:

- The earlier-reported "Bez narzędzia" typo does **not** exist — `kosztorys-editor-toolbar.tsx:11`
  reads "Bez narzędzi". The panel's lowercase labels ("z narzędziami") vs the buttons' capitalized
  labels are intentional button-vs-list styling, not an inconsistency. **No label cleanup beyond the
  client-view rename.**
- The grid remount `key` already starts with `view` — because the initial `view` will now come from
  localStorage, the grid simply mounts on the persisted view; the key expression needs no change.

## Desired End State

A Manager+ user opens an investment's Kosztorys tab, switches to "Z narzędziami", reloads — and the
grid is still on "Z narzędziami". A different investment independently remembers its own view. The
client-price view button reads "Klient". An (i) icon beside the view toggle opens a short popover
explaining the three views and the price mode (auto / × mnożnik / kwota).

**Verify**: `pnpm typecheck` + `pnpm exec vitest run` green; `pnpm build` compiles; manual: switch
view → reload → view persists per investment; tooltip renders; "Klient" label shows.

## What We're NOT Doing

- **No schema / migration / server-action / calc changes** — pure client UI.
- **No per-user or cross-device sync** — per-browser localStorage only (per-kosztorys key).
- **Hide subcontractor cost/margin from MANAGER** → stays S-14 (POC P10).
- **netto / brutto** → stays S-12 (VAT).
- **Browser E2E of the toggle** → stays S-08.
- **No relabelling** of the two subcontractor views or the panel coefficient labels.

## Critical Implementation Details

**Per-investment `useSyncExternalStore` snapshot stability.** Unlike `use-column-widths.ts` (one
module-level key, one argument-free `readJson`), the view hook's `getSnapshot` closes over
`investmentId`. `useSyncExternalStore` requires a `getSnapshot` that returns a stable value for the
same store state — wrap `getSnapshot` (and `getServerSnapshot` returning the constant `'client'`)
so they don't change identity every render (e.g. `useCallback` keyed on `investmentId`). A write
under one investment's key notifies all subscribers; a hook bound to a different key re-reads its
own unchanged key and no-ops. Validate the stored string against the `PriceViewT` union and fall
back to `'client'` on an unknown/corrupt value.

## Phase 1: Persist the selected price view per-kosztorys

### Overview

New localStorage-backed hook mirroring `use-column-widths.ts`, keyed per investment, wired in place
of the plain `useState` for `view`.

### Changes Required:

#### 1. Price-view persistence hook

**File**: `src/components/kosztorys/use-price-view.ts` (new)

**Intent**: Persist the active `PriceViewT` per investment in localStorage, SSR-safe, so the editor
opens on the last-used view for that kosztorys.

**Contract**: `usePriceView(investmentId: number): [PriceViewT, (view: PriceViewT) => void]`.
localStorage key `kosztorys-view:${investmentId}`. Follow the `use-column-widths.ts` shape:
module-level `listeners` set + `subscribe`; `useSyncExternalStore(subscribe, getSnapshot, () =>
'client')`; `getSnapshot` reads the per-investment key with a try/catch, validates the value is one
of `'client' | 'w_tools' | 'own_tools'` (else `'client'`); the setter writes the key and notifies
listeners. Keep `getSnapshot`/`getServerSnapshot` identity stable across renders (see Critical
Implementation Details).

#### 2. Wire into the editor hook

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: Replace the ephemeral view state with the persisted hook.

**Contract**: Swap `const [view, setView] = useState<PriceViewT>('client')` (line 67) for
`const [view, setView] = usePriceView(investmentId)`. No other change — `setView` keeps the same
`(view: PriceViewT) => void` signature the toolbar already consumes; the remount `key` (which leads
with `view`) is unaffected.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`
- Unit suite still green: `pnpm exec vitest run`
- Build compiles: `pnpm build`

#### Manual Verification:

- Switch to "Z narzędziami", reload → grid still on "Z narzędziami".
- Investment A on one view, investment B on another → each remembers independently.
- Private-mode / disabled localStorage → no crash; view just doesn't persist (defaults to client).

**Implementation Note**: After automated verification passes, pause for manual confirmation before
Phase 2.

---

## Phase 2: Relabel client view + pricing-model explainer

### Overview

Rename the client-price view button to "Klient" and add an InfoTooltip beside the view toggle
explaining the three views and the price mode.

### Changes Required:

#### 1. Relabel the client view

**File**: `src/components/kosztorys/kosztorys-editor-toolbar.tsx`

**Intent**: Match FR-003's "klient" vocabulary.

**Contract**: In `VIEWS` (line 9), change the `client` label from `'Robocizna'` to `'Klient'`. The
other two entries unchanged.

#### 2. Pricing-model explainer tooltip

**File**: `src/components/kosztorys/kosztorys-editor-toolbar.tsx`

**Intent**: Give the non-obvious pricing model an in-app explanation without costing grid vertical
space (the follow-up flagged at `kosztorys-v2-columns.tsx:24-25`).

**Contract**: Render an `InfoTooltip` (from `@/components/ui/info-tooltip`) immediately after the
view-button group (around line 53). `content` = a short `\n`-separated legend: the three views
(Klient = cena dla klienta; Z narzędziami / Bez narzędzi = ceny podwykonawcy, liczone ze
współczynnika narzutu) and the per-item price mode (auto = ze współczynnika, × mnożnik ceny
klienta, kwota zł). `label` = an aria description (e.g. "Co oznaczają widoki cen"). Polish UI copy;
keep it to a few lines.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`
- Build compiles: `pnpm build`

#### Manual Verification:

- Client view button reads "Klient"; the two subcontractor labels unchanged.
- The (i) icon renders beside the toggle and its popover explains the three views + price mode.
- No layout shift / grid height regression from the added icon.

**Implementation Note**: Final human sign-off closes the slice → run the slice-review gate, then the
roadmap reconciliation below.

---

## Testing Strategy

### Unit Tests:

- None warranted. The change is a localStorage-backed UI-state hook + label/tooltip copy; the pure
  calc/rows core (already unit-tested) is untouched. A hook test would assert localStorage plumbing
  (implementation), not observable behavior — skipped per the test-plan's cost×signal principle.

### Manual Testing Steps:

1. Switch view → reload → view persists; repeat per investment (independent keys).
2. Disable localStorage (private window) → no crash, defaults to Klient.
3. Confirm "Klient" label + tooltip copy; no grid layout regression.

## Migration Notes

None — no schema or data changes. Additive UI only.

**Roadmap reconciliation (at archive):** update `context/foundation/roadmap.md` to mark **S-03 and
S-11 absorbed/done** (the never-run S-01 archive step, S-01 `change.md:48`), and note this change as
the residual polish that closed S-03. Handled by `/10x-archive` / the slice-review gate, not a code
phase.

## References

- Research: `context/changes/kosztorys-price-models/research.md`
- Persistence pattern to mirror: `src/components/kosztorys/use-column-widths.ts`
- Editor state hook: `src/components/kosztorys/use-kosztorys-editor.ts:62-67`
- Toolbar / view labels: `src/components/kosztorys/kosztorys-editor-toolbar.tsx:8-53`
- Tooltip pattern: `src/components/investments/financial-stats.tsx` (`InfoTooltip` usage)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Persist the selected price view per-kosztorys

#### Automated

- [x] 1.1 Type checking passes (`pnpm typecheck`)
- [x] 1.2 Lint passes (`pnpm lint`)
- [x] 1.3 Unit suite still green (`pnpm exec vitest run`)
- [x] 1.4 Build compiles (`pnpm build`)

#### Manual

- [x] 1.5 Switch view → reload → view persists
- [x] 1.6 Two investments remember views independently
- [x] 1.7 Disabled localStorage → no crash, defaults to client

### Phase 2: Relabel client view + pricing-model explainer

#### Automated

- [ ] 2.1 Type checking passes (`pnpm typecheck`)
- [ ] 2.2 Lint passes (`pnpm lint`)
- [ ] 2.3 Build compiles (`pnpm build`)

#### Manual

- [ ] 2.4 Client view reads "Klient"; subcontractor labels unchanged
- [ ] 2.5 Tooltip renders and explains the three views + price mode
- [ ] 2.6 No grid layout regression from the added icon
