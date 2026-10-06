# One worker view — Plan Brief

> Full plan: `context/changes/2026-10-05-worker-single-view/plan.md`

## What & Why

A worker gets two links today. `/p` is his rozpiska with his balance. „Zgłoszenie prac" is the report
form. With „Wszystkie kolumny" on, they show the same grid. The owner decided on one view: the report
link gains the Podsumowanie panel, and `/p` goes away (EX-966, before EX-949).

## Starting Point

Both screens render through `KosztorysEditorBody`. The report page already loads the worker's
summary; it is gated off by `worker && !report`. „Podgląd pracownika" renders `/p`'s component.

## Desired End State

The report link has „Podsumowanie" and works at 390px. Podgląd shows that same view read-only. The
„Pracownicy" menu has one link per worker. `/p` 404s, and no code knows `kosztorys-worker-shares`.

## Key Decisions Made

| Decision         | Choice                                                                             | Why                                                        | Source           |
| ---------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------- |
| One view         | „Zgłoszenie prac" absorbs `/p`                                                     | Same grid already; one link to send                        | change.md        |
| Panel            | Reuse `TotalsPanelOverlay` + toggle as-is, anchored to the viewport in report mode | It works; only page-scroll anchoring differs               | Plan             |
| Toggle placement | Report control bar, kept reachable                                                 | The header has no actions slot; the bar holds the controls | Plan             |
| Podgląd          | Session-keyed report view; no send, in-memory draft                                | Owner sees what the worker sees without acting as him      | change.md + Plan |
| `/p`             | Removed, no redirect                                                               | Owner: sent links don't matter                             | change.md        |
| Table DROP       | Parked in a Linear issue, after deploy                                             | lessons.md: no DROP in the change that stops reading it    | Plan             |
| Translations     | Not now; summary stays Polish                                                      | Shape first                                                | change.md        |

## Scope

**In scope:**

- The panel and toggle in report mode.
- The Podgląd preview mode.
- Removing `/p`, the `rozpiska` link kind, the collection and the second menu item.
- Test ports and doc updates.

**Out of scope:**

- Translating the summary.
- The worker PDF (EX-949).
- A `/p` redirect.
- The DROP migration.
- „Opcje".

## Phases at a Glance

| Phase                          | Delivers                                     | Key risk                                                       |
| ------------------------------ | -------------------------------------------- | -------------------------------------------------------------- |
| 1. Podsumowanie in report view | Panel + toggle on the worker link, at 390px  | Page-scroll anchoring covering the footer or hiding the toggle |
| 2. Podgląd → report view       | Read-only report view behind session         | Preview leaking into the worker's draft on a shared device     |
| 3. Remove `/p`                 | One link kind, collection gone, tests ported | Losing the privacy specs that guard the shared builder         |

**Prerequisites:** none. **Estimated effort:** ~1–2 sessions.

## Open Risks & Assumptions

- The summary panel and its label are Polish on a page that may be in uk/ru until the translation
  pass.
- The `kosztorys_worker_shares` table lingers, unread, until the parked DROP ships.

## Success Criteria (Summary)

- The worker sees his balance from the same link he reports through, on a phone.
- The owner's Podgląd matches the worker's screen exactly, and can't send.
- One link per worker in the menu.
