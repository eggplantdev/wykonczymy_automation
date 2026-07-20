# Client kosztorys view = the real editor body, read-only — Implementation Plan

## Overview

The public client kosztorys view (`/k/[token]`) is a bespoke parallel render (`ClientKosztorysView` + `ClientKosztorysFooter`) that duplicates the owner editor and drifts from it. This change replaces it with the **actual** `KosztorysEditorBody`, mounted in a read-only `clientView` mode: the same grid, the same footer, the same components the owner sees — with the mutation chrome hidden and the auto-save/snapshot machinery killed by a single early return. One component tree, no duplicate to keep in sync.

## Current State Analysis

- **The client render is a full parallel implementation.** `ClientKosztorysView` (`client/client-kosztorys-view.tsx`) reuses only `buildV2Grid` + `toGridRows`, plus a bespoke header and `ClientKosztorysFooter` — a hand-reimplementation of the owner's `KosztorysPodsumowanie`. Every divergence between client and owner has to be maintained by hand.
- **The editor body is welded to a stateful hook.** `KosztorysEditorBody` (`kosztorys-editor-body.tsx:57`) seeds `useKosztorysEditor({ investmentId, tree })`, which wires a **debounced save** (persists edits via server action) and the body's own effects. The wrapper `KosztorysEditorV2` adds auto-snapshot + versions + undo/redo. These are the "disabled things inside" — they must not run on a public page.
- **The save side-effect is one guardable effect.** The debounced-save lives inside `useKosztorysEditor`; a single `clientView` early return at the top of that effect disables persistence. Auto-snapshot + versions live in the `KosztorysEditorV2` **wrapper**, which the client simply won't mount (it mounts the body directly) — so no work is needed there.
- **The grid already supports read-only + client columns.** `buildV2Grid` accepts `readOnly` (disables every cell, drops the `actions` column — `kosztorys-v2-columns.tsx:423-426`) and `clientVisible` (filters to `CLIENT_VISIBLE_COLUMNS` — `:455`, enforcing the omit-set `priceMode`/`priceCoeff`/`note`/`actions`). The hook currently passes neither (`use-kosztorys-editor.ts:264`).
- **`KosztorysPodsumowanie` is nearly client-ready.** It takes `priceView` and computes client figures. Owner-only bits: two `<Link>`s into `/inwestycje/...` (`:136-141`, `:166-171`) and the recon scream gated `reconVisible = priceView==='client'` (`:91`) — which, for a client whose view _is_ 'client', would wrongly fire; it must AND-in `clientView`.
- **The client page needs the editor's data.** `KosztorysEditorBody` needs `tree, materialsNet, materialyBreakdown, wplatyNet, zaliczkiByStage, investmentRobocizna, investmentRabat`. The admin page builds all of these (`inwestycje/[id]/kosztorys_v2/page.tsx`). The client page currently builds only the bespoke DTO (`getClientKosztorysByToken` → `toClientView`). It must instead resolve token→investmentId (the share lookup it already does) and build the same editor data the admin page does.
- **Leak posture (explicit owner decision, 2026-07-20):** the owner has accepted that the client payload may carry the full tree (subcontractor coeffs included). Stripping is **not** a goal of this change; `toClientView`'s field-by-field projection is no longer the mechanism. The client view is safe _enough_ by rendering `view:'client'` + `readOnly` + hidden chrome; the raw data in the payload is an accepted risk.

## Desired End State

`/k/[token]` mounts the real `KosztorysEditorBody` in `clientView` mode: same grid + same `KosztorysPodsumowanie` footer as the owner, read-only, with the toolbar and section-summary mutation chrome hidden, the recon scream suppressed, and internal links rendered as plain text. No saves or snapshots fire. `ClientKosztorysView` and `ClientKosztorysFooter` are deleted. The owner editor and owner preview are unchanged.

Verify: the client share renders pixel-consistent with the owner's grid+footer (minus recon scream, minus mutation chrome, links as plain text); editing is impossible; no network POST to any kosztorys save action fires from the client page; owner editor unchanged.

### Key Discoveries:

- Kill persistence with one early return in the debounced-save effect inside `useKosztorysEditor` — auto-snapshot/versions are in the wrapper the client won't mount.
- `buildV2Grid` already does read-only + client-column filtering; the hook just needs to forward `readOnly:true, clientVisible:true` and drop mutation callbacks when `clientView`.
- Recon gate must become `clientView ? false : priceView==='client'` (`kosztorys-podsumowanie.tsx:91`).
- Client page must build editor data (tree + financials + zaliczki + robocizna/rabat) from token→investmentId, mirroring the admin page's fetches.

## What We're NOT Doing

- **Not** stripping the client payload — the owner accepted the data-leak risk; `toClientView`'s projection is being retired as the render source, not preserved.
- **Not** mounting `KosztorysEditorV2` (the wrapper) on the client — the client mounts `KosztorysEditorBody` directly, so auto-snapshot/versions/undo never come along.
- **Not** touching the owner editor's behavior, its toolbar, or its save path (guarded additively).
- **Not** reworking `section-pie` as a feature — it is a **separate slice**; this change only stops the client view from rendering it. The component is preserved.

## Implementation Approach

Thread one `clientView` boolean from the client page into `KosztorysEditorBody` and its hook. In the hook it (a) early-returns the debounced-save effect and (b) forwards `readOnly:true, clientVisible:true` + omits mutation callbacks to `buildV2Grid`. In the body it hides the toolbar + section-summary sidebar and swaps in a slim header carrying the net/brutto toggle. In `KosztorysPodsumowanie` it gates the recon scream and the two links. The client page resolves token→investment and builds the editor data the admin page builds, then mounts the body.

## Critical Implementation Details

- **Persistence must be dead, verifiably.** The `clientView` early return goes at the very top of the debounced-save effect in `useKosztorysEditor` (before any timer is armed). Manual check asserts zero save-action POSTs from the client page — this is the load-bearing guarantee that a public page can't mutate.
- **Recon gate AND-in.** `reconVisible` at `kosztorys-podsumowanie.tsx:91` must be `false` whenever `clientView`, independent of `priceView`. Missing this shows the owner-internal reconciliation scream to the public.
- **Money-axis control.** The toolbar (hidden for client) is where the owner sets the money axis. The client body gets a slim header with the existing `MoneyAxisToggle` (net/brutto; `'none'`→`'both'`), so the client can still switch axes without a toolbar.

## Phase 1: Read-only `clientView` mode in the hook + body + footer

### Overview

Give `useKosztorysEditor` and `KosztorysEditorBody` a `clientView` mode that kills persistence, makes the grid read-only + client-filtered, hides mutation chrome, and gates the footer — all additive, owner path unchanged.

### Changes Required:

#### 1. Editor hook

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: Accept `clientView`; disable persistence and make the grid read-only + client-scoped without changing the owner path.

**Contract**: Add `clientView?: boolean` to the hook's options. Early-return the debounced-save effect when `clientView` is true (top of the effect, before arming). In the `buildV2Grid` columnOpts (`:244-264`) set `readOnly: true, clientVisible: true` and omit the mutation callbacks (`onRemoveItem`, `onReorderItem`, `onInsertItem`, `onRenameSection`, `onRemoveStage`, `onRenameStage`, `onCommitColumn`, `onGuide`, `getRemovePlan`) when `clientView`. No behavior change when false.

#### 2. Editor body

**File**: `src/components/kosztorys/kosztorys-editor-body.tsx`

**Intent**: Accept `clientView`; hide all mutation chrome and forward the flag to the hook and footer; provide a slim axis header in place of the toolbar.

**Contract**: Add `clientView?: boolean` to `PropsT`. Pass it into `useKosztorysEditor`. When `clientView`: do not render `KosztorysEditorToolbar` (`:158`) or the `KosztorysSectionSummary` sidebar (`:180-192`); render a slim header containing `MoneyAxisToggle` instead. Pass `clientView` into `KosztorysTotalsPanel` (`:195-210`). Reconciliation may be a benign zero value when `clientView` (the scream is gated off regardless).

#### 3. Totals panel + summary

**Files**: `src/components/kosztorys/kosztorys-totals-panel.tsx`, `src/components/kosztorys/kosztorys-podsumowanie.tsx`

**Intent**: Thread `clientView` to the summary and gate the two owner-only affordances.

**Contract**: `KosztorysTotalsPanel` accepts `clientView?: boolean` and forwards it to `KosztorysPodsumowanie` (`:109-120`). `KosztorysPodsumowanie` adds `clientView?: boolean` (default false), makes `reconciliation` optional, sets `reconVisible = clientView ? false : priceView==='client'` (`:91`), and renders the materiały (`:136-141`) and wpłaty (`:166-171`) labels as plain text when `clientView`. Owner path unchanged at default.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit tests pass: `pnpm test`

#### Manual Verification:

- Owner editor is unchanged: toolbar, section sidebar, saves, recon scream, and links all behave as before.

---

## Phase 2: Mount the body on the client page; tear out the bespoke render

### Overview

Build the editor data from token→investment and mount `KosztorysEditorBody clientView` on the public page; delete the bespoke client view + footer; stop rendering section-pie for the client.

### Changes Required:

#### 1. Client data path

**File**: `src/lib/queries/client-kosztorys.ts`

**Intent**: Resolve the token to an investment and build the editor's data set (mirroring the admin page), instead of the bespoke DTO.

**Contract**: Keep the token→`kosztorys-shares`→investmentId lookup (uncached, `overrideAccess`). Replace the `toClientView` projection with a builder that returns the props `KosztorysEditorBody` needs — `tree` (`getKosztorysTree`), `investmentName`, `materialsNet`, `materialyBreakdown` (`buildMaterialyBreakdown`), `wplatyNet`, `zaliczkiByStage` (`fetchZaliczkiByStage`), `investmentRobocizna`, `investmentRabat` — reusing the same helpers the admin page uses (`reference-data.ts`, `sum-transfers.ts`, `map-category-costs.ts`). Retire `toClientView`/`ClientKosztorysViewT`/`ClientKosztorysRowT` if no other caller remains (gate on typecheck).

#### 2. Client page

**File**: `src/app/(share)/k/[token]/page.tsx`

**Intent**: Mount the real editor body read-only.

**Contract**: Load the editor data from the token (change #1); `notFound()` on a missing/revoked token as today. Render `<KosztorysEditorBody clientView ... />` with the resolved props. The owner preview route (`podglad-klienta`) uses the same `clientView` mount.

#### 3. Delete the bespoke render

**Files**: `src/components/kosztorys/client/client-kosztorys-view.tsx`, `src/components/kosztorys/client/client-kosztorys-footer.tsx`, section-pie usage in the client tree

**Intent**: Remove the parallel implementation now that the body covers the client path.

**Contract**: Delete `ClientKosztorysView` and `ClientKosztorysFooter`; remove their imports. Remove the section-pie from the client composition (do **not** delete the section-pie component — separate slice). Gate all deletions on `pnpm typecheck`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit tests pass: `pnpm test`
- Production build succeeds: `pnpm build`

#### Manual Verification:

- `/k/[token]` renders the owner's grid + `KosztorysPodsumowanie` footer, read-only, with no toolbar/section-sidebar, recon scream absent, materiały/wpłaty as plain text.
- Every grid cell is non-editable; no kosztorys save/snapshot network request fires from the client page (DevTools → Network).
- The client view no longer shows the section pie.
- Owner preview (`podglad-klienta`) matches the public client view; the live owner editor is unchanged.

---

## Testing Strategy

### Unit Tests:

- `KosztorysPodsumowanie`: `clientView` suppresses the recon scream and renders plain-text labels; owner default still shows them. (Author in the review gate's test step, post-`/simplify`.)
- Existing summary-economics / editor specs still pass with the new optional `reconciliation` + `clientView` defaults.

### Manual Testing Steps:

1. Open `/k/[token]`; confirm grid+footer match the owner, read-only, no mutation chrome.
2. Attempt to edit a cell — must be impossible; confirm no save POST in Network.
3. Force a robocizna/rabat mismatch as owner; confirm the scream shows in the editor but not on the client share.
4. Confirm the owner editor is unchanged.

## Migration Notes

None — kosztorys share data is throwaway until dogfooding; no backfill or compat shim.

## References

- Change notes: `context/changes/kosztorys-client-view-reuse/change.md`
- Editor body + hook: `src/components/kosztorys/kosztorys-editor-body.tsx`, `src/components/kosztorys/use-kosztorys-editor.ts`
- Grid read-only/client filtering: `src/components/kosztorys/kosztorys-v2-columns.tsx:423-426,:455`
- Shared footer: `src/components/kosztorys/kosztorys-podsumowanie.tsx:91,:136-141,:166-171`
- Admin data path to mirror: `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Read-only clientView mode in the hook + body + footer

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — 4af855c0
- [x] 1.2 Linting passes: `pnpm lint` — 4af855c0
- [x] 1.3 Unit tests pass: `pnpm test` — 4af855c0

### Phase 2: Mount the body on the client page; tear out the bespoke render

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck` — d270ff22
- [x] 2.2 Linting passes: `pnpm lint` — d270ff22
- [x] 2.3 Unit tests pass: `pnpm test` — d270ff22
- [x] 2.4 Production build succeeds: `pnpm build` — d270ff22
