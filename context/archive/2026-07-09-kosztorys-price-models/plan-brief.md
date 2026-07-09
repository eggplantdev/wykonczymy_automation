# Kosztorys — finish the price-view surface (S-03 residual) — Plan Brief

> Full plan: `context/changes/kosztorys-price-models/plan.md`
> Research: `context/changes/kosztorys-price-models/research.md`

## What & Why

S-03's original scope (three price models + view toggle + coefficient/override derivation) was
**already shipped by S-01**, which folded S-03 and S-11 into itself. This change is the residual
polish: make the selected price view survive reloads, align the client-view label with FR-003, and
add the pricing-model explainer that the code flagged as a wanted UX follow-up.

## Starting Point

The three-view toggle works today (`use-kosztorys-editor.ts:67`, `kosztorys-editor-toolbar.tsx`),
but `view` is plain `useState('client')` — it resets on every reload. A localStorage persistence
pattern already exists for column widths (`use-column-widths.ts`) to mirror.

## Desired End State

Switch to "Z narzędziami", reload → still on "Z narzędziami"; each investment remembers its own view.
The client-price button reads "Klient". An (i) icon beside the toggle explains the three views and
the per-item price mode.

## Key Decisions Made

| Decision            | Choice                          | Why                                                         | Source   |
| ------------------- | ------------------------------- | ----------------------------------------------------------- | -------- |
| Build vs close-out  | Redefine to residual polish     | Original S-03 already shipped in S-01 (verified in code)    | Research |
| View persistence    | Per-kosztorys localStorage      | Remembers per investment; mirrors column-widths; no DB work | Plan     |
| Client-view label   | "Robocizna" → "Klient"          | Matches FR-003 vocabulary (klient / z narz. / bez narz.)    | Plan     |
| Explainer placement | InfoTooltip on the view buttons | Zero permanent grid vertical space; reuses house component  | Plan     |
| Label cleanup       | Dropped (no real issue)         | The reported "Bez narzędzia" typo doesn't exist             | Plan     |

## Scope

**In scope:** persist price view per-kosztorys; relabel client view to "Klient"; pricing-model
InfoTooltip; roadmap reconciliation (mark S-03/S-11 absorbed) at archive.

**Out of scope:** any schema/server/calc change; per-user/cross-device sync; hide margin from
MANAGER (S-14); netto/brutto (S-12); browser E2E (S-08); relabelling the subcontractor/panel labels.

## Architecture / Approach

New `use-price-view.ts` hook = `use-column-widths.ts` shape (`useSyncExternalStore`, module-level
listeners, SSR-stable snapshot) but keyed `kosztorys-view:${investmentId}`, with the stored value
validated against `PriceViewT`. Swapped in for the `useState` at `use-kosztorys-editor.ts:67`. Two
one-line-ish toolbar edits for the label + tooltip. UI-only.

## Phases at a Glance

| Phase                  | What it delivers                       | Key risk                                                   |
| ---------------------- | -------------------------------------- | ---------------------------------------------------------- |
| 1. Persist price view  | View survives reload, per investment   | `useSyncExternalStore` snapshot stability with a keyed get |
| 2. Relabel + explainer | "Klient" label + pricing-model tooltip | Layout shift from the added icon (low)                     |

**Prerequisites:** none (S-01 shipped; branch off `main` into a worktree at implement time).
**Estimated effort:** ~1 short session, 2 phases.

## Open Risks & Assumptions

- `useSyncExternalStore` with a per-investment `getSnapshot` must keep stable identity or it warns/
  loops — handled in Critical Implementation Details.
- Assumes per-browser (not cross-device) persistence is acceptable — confirmed with owner.

## Success Criteria (Summary)

- Selected price view persists across reloads, independently per investment.
- Client view reads "Klient"; tooltip explains the three views + price mode.
- `pnpm typecheck` / `vitest run` / `pnpm build` all green; no grid layout regression.
