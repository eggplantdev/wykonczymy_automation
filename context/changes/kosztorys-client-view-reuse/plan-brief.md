# Client kosztorys view = the real editor body, read-only — Plan Brief

> Full plan: `context/changes/kosztorys-client-view-reuse/plan.md`

## What & Why

The public client view (`/k/[token]`) is a bespoke parallel render (`ClientKosztorysView` + `ClientKosztorysFooter`) that duplicates the owner editor and drifts from it. This change mounts the **actual** `KosztorysEditorBody` in a read-only `clientView` mode — same grid, same footer, mutation chrome hidden, auto-save killed by one early return. One component tree, nothing to keep in sync.

## Starting Point

The grid already supports `readOnly` + `clientVisible` in `buildV2Grid`. The footer (`KosztorysPodsumowanie`) already computes client figures. The body is welded to `useKosztorysEditor`, whose debounced-save is a single guardable effect; auto-snapshot/versions live in the `KosztorysEditorV2` **wrapper** the client won't mount. The owner has accepted the data-leak risk, so payload-stripping (`toClientView`) is retired as the render mechanism.

## Desired End State

`/k/[token]` mounts `KosztorysEditorBody clientView`: owner's grid + footer, read-only, no toolbar/section-sidebar, recon scream suppressed, internal links as plain text, zero saves/snapshots. `ClientKosztorysView` + `ClientKosztorysFooter` deleted. Owner editor unchanged.

## Key Decisions Made

| Decision           | Choice                                                                        | Why                                                                                    | Source |
| ------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| Reuse mechanism    | Mount the real `KosztorysEditorBody`, not a parallel render                   | "Same components, everything but readonly" — the drift-proof reuse the owner asked for | Plan   |
| Kill persistence   | One `clientView` early return in the debounced-save effect                    | Auto-snapshot/versions are in the wrapper, not the body — nothing else to disable      | Plan   |
| Data-leak posture  | Accepted; stop stripping the payload                                          | Owner explicitly waved off the "client reads coeffs in DevTools" risk                  | Plan   |
| Differentiator     | Page-declared `clientView` boolean                                            | `/k/[token]` + preview know they're client-facing; no cookie read at render            | Plan   |
| Recon scream       | `reconVisible = clientView ? false : priceView==='client'`                    | A client's view is 'client', so the old gate would leak the owner-internal scream      | Plan   |
| Money-axis control | Slim header with `MoneyAxisToggle` replaces the hidden toolbar's axis control | Client still needs net/brutto switching without a toolbar                              | Plan   |
| section-pie        | Dropped from client render, component preserved                               | Separate slice                                                                         | Plan   |

## Scope

**In scope:** `clientView` mode in `useKosztorysEditor` (early-return save + read-only/client columns) and `KosztorysEditorBody` (hide chrome, slim axis header); `clientView` gate in `KosztorysPodsumowanie`; client page builds editor data from token→investment and mounts the body; delete the bespoke view + footer; drop section-pie from client.

**Out of scope:** payload stripping (`toClientView` retired); the owner editor; section-pie as a feature.

## Architecture / Approach

One `clientView` boolean threads from the client page → body → hook + footer. Hook: early-return save, forward `readOnly:true, clientVisible:true`, drop mutation callbacks. Body: hide toolbar + section sidebar, slim axis header. Footer: gate recon + links. Client page mirrors the admin page's data fetches, keyed by token.

## Phases at a Glance

| Phase                   | What it delivers                                                | Key risk                                                                    |
| ----------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1. clientView mode      | Read-only body + hook + gated footer, owner path additive       | Save early-return missed → persistence fires on public page                 |
| 2. Wire page + teardown | Client page mounts body from token data; bespoke render deleted | Client page must build full editor data; retiring `toClientView` may ripple |

**Prerequisites:** none.
**Estimated effort:** ~1–2 sessions, 2 phases, ~7 files.

## Open Risks & Assumptions

- The `clientView` early return on the save effect is the load-bearing guarantee — verified by asserting zero save POSTs from the client page.
- The client page must build the same data the admin page builds (tree + financials + zaliczki + robocizna/rabat); assumes those helpers are reusable outside the admin route (research confirms they are plain functions).

## Success Criteria (Summary)

- `/k/[token]` renders the owner's grid+footer read-only, no mutation chrome, recon scream absent, links plain — and no save/snapshot request fires.
- Bespoke `ClientKosztorysView`/`ClientKosztorysFooter` deleted with a clean build.
- Owner editor and preview unchanged.
