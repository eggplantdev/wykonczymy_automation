# Kosztorys Client Share View — Plan Brief

> Full plan: `context/changes/kosztorys-client-share/plan.md`
> Design: `context/changes/kosztorys-client-share/design.md`

## What & Why

Give the owner a **live, read-only, token-gated URL** to hand a client. The client reopens it over
the life of the job and sees current per-etap progress — not a frozen offer. The subcontractor cost
view (z narzędziami / bez narzędzi) must **never** leak.

## Starting Point

The kosztorys v2 editor already renders via `DynamicDataSheetGrid` over a single shared column
config (`buildV2Grid` / `column-config.ts`), and every money figure is computed live through
`calc.ts` functions parameterized by a `view` argument. `getKosztorysTree` is auth-gated and
uncached. There's no `middleware.ts` — auth is per-layout, so a new route group is public by
construction.

## Desired End State

Owner clicks „Udostępnij klientowi" on the kosztorys page → gets a `/k/<token>` link (copy / rotate
/ revoke) and a „Podgląd dla klienta" preview. The client opens it with no login and sees the offer

- live per-etap progress + footer + section pie, on client-safe columns only. Subcontractor prices
  are absent from the payload entirely.

## Key Decisions Made

| Decision           | Choice                                                        | Why                                                            | Source |
| ------------------ | ------------------------------------------------------------- | -------------------------------------------------------------- | ------ |
| No-leak mechanism  | Pin `view: 'client'` + DTO with no subcontractor fields       | Prices are never _computed_, not filtered — stronger than RBAC | Design |
| Reuse vs duplicate | Reuse `buildV2Grid` + `column-config`                         | Editor is churning; a second render would drift                | Design |
| Read-only lock     | Add `readOnly` opt → `disabled` cells                         | Omitting callbacks leaves cells edit-capable                   | Plan   |
| Public tree read   | Extract auth-free core from `getKosztorysTree`                | One projection, no drift                                       | Plan   |
| Share UI           | Action on the kosztorys_v2 page                               | Lives where the owner works; preview co-located                | Plan   |
| Branch             | Off `kosztorys-bridge`, worktree `../wykonczymy-client-share` | Design doc already there                                       | User   |

## Scope

**In scope:** `shareToken` column + actions; auth-free token-scoped cached read; `ClientKosztorysViewT`
projection; `readOnly` grid opt + `clientVisible` column filter; `(share)` route `/k/[token]`;
owner share/preview UI.

**Out of scope:** Google Sheet export, PDF export, email-the-link (fast-follow), per-kosztorys
field configuration, any data backfill (kosztorys data is throwaway pre-dogfooding).

## Architecture / Approach

Back-to-front: (1) safe data spine — token + auth-free read + projection with `view: 'client'`
pinned and a subcontractor-free DTO; (2) lockable reuse — `readOnly` opt + `clientVisible` filter on
the shared grid; (3) public `(share)` route with a bare `noindex` layout (template:
`(legal)/layout.tsx`); (4) owner share action + authenticated preview mounting the same projection.
Safety is verified on the payload, never the DOM.

## Phases at a Glance

| Phase                        | Delivers                                                      | Key risk                                                                         |
| ---------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1. Token + read + projection | `shareToken`, `getClientKosztorysView`, `toClientView` DTO    | Projection must strip every subcontractor field — the load-bearing invariant     |
| 2. Read-only render          | `readOnly` opt, `clientVisible` filter, `ClientKosztorysView` | Threading `readOnly` through the shared builder without touching editor behavior |
| 3. Public route              | `(share)` `/k/[token]`, bare layout, 404 handling             | Layout must not import auth; token 404 correctness                               |
| 4. Share action + preview    | generate/rotate/revoke + „Podgląd dla klienta"                | Rotate must invalidate the old link                                              |

**Prerequisites:** worktree on `kosztorys-bridge` (done); local docker DB for the migration.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- A live public URL that leaks the subcontractor cost view defeats the purpose — mitigated by the
  Phase 1 payload test + the DTO type boundary.
- Editor is under active development; the single-source design absorbs that churn, but a new column
  added editor-side defaults to _hidden_ from the client only if `clientVisible` is opt-in (verify
  the flag defaults closed).
- Browser-level E2E is owed — author at the review gate or file to the `e2e-backlog`.
- The EX-535 reconciliation scream (red „Niezgodność z transakcjami" on „Suma prac"/„Rabat") is
  owner-internal and must be absent from the client view. The EX-541 `priceView === 'client'` gate
  does **not** cover this — the client view pins `view: 'client'`, so the client payload must carry
  no reconciliation at all (see Phase 2 #3).

## Success Criteria (Summary)

- Anonymous `/k/<token>` renders the live client view; `/k/bogus` and a revoked token → 404.
- The client payload contains no subcontractor price or coefficient.
- Owner can generate, copy, rotate, and revoke the link, and preview it identically in-app.
