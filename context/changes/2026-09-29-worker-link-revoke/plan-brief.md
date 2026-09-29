# Worker link revocable when blocked or without etapy — Plan Brief

> Full plan: `context/changes/2026-09-29-worker-link-revoke/plan.md`

## What & Why

A worker's link can only be switched off from „Pracownicy" → „Link". When the worker's scope is
blocked, or the worker has no etapy left, that path disappears but the token stays live. Once the
block lifts, the old link shows prices again, and the owner had no way to cut it off (EX-888).

## Starting Point

The menu disables „Link" for any blocked worker and lists only workers who hold an etap. „No etapy"
already counts as a block reason („Brak przypisanych etapów"). The server already refuses to mint a
link while blocked and always allows revoking one.

## Desired End State

A blocked worker with a live link gets an enabled „Link". Its dialog shows the reason and only
„Wyłącz link". A worker with a link but no etapy is listed like any blocked worker. A blocked worker
without a link is unchanged.

## Key Decisions Made

| Decision                         | Choice                      | Why                                                         |
| -------------------------------- | --------------------------- | ----------------------------------------------------------- |
| Dialog when blocked + link       | Reason + „Wyłącz link" only | The only sensible action is the only one offered.           |
| Blocked, no link                 | „Link" disabled, as today   | No dialog that leads nowhere.                               |
| No etapy + link                  | Same as any blocked worker  | One pattern for all blocks, no new UI.                      |
| Who holds a link                 | Lazy read on menu open      | Fresh after a revoke; no prop threading through the editor. |
| Auto-revoke on last etap removed | Rejected                    | Changes behaviour; re-assigning would need a new link.      |

## Scope

**In scope:** holder read, menu rows/enabling, revoke-only panel mode, DOM spec, domain-notes bullet.

**Out of scope:** investor dialog, server actions, auto-revoke.

## Phases at a Glance

| Phase                       | What it delivers                                   | Key risk                                           |
| --------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| 1. Link holders in the menu | Holders listed; „Link" enabled for blocked holders | Holder set empty until the read lands              |
| 2. Revoke-only dialog       | Reason + „Wyłącz link" only                        | Touching the panel shared with the investor dialog |

**Estimated effort:** one session.

## Open Risks & Assumptions

- Until the read lands (a split second after opening), a blocked holder's „Link" shows disabled. The
  safe direction.
