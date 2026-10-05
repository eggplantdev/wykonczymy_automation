# Worker view dogfooding — Plan Brief

> Full plan: `context/changes/2026-10-05-worker-view-dogfooding/plan.md`

## What & Why

Dogfooding the single worker view after EX-966 produced seven owner remarks. The visual ones are
already in the tree, uncommitted: footer mode switch, PDF-style rozliczenie, no title, counters,
labels and equal buttons. What remains:

- the new link shape the owner asked for;
- getting the specs green again;
- making the docs and manual checks match the page.

## Starting Point

- The worker link is `/zgloszenie-prac/<pracownik>/<token>`, built by one helper with two callers.
- 10 DOM tests are red because they describe the removed „Podsumowanie” panel and the old grid
  markup.

## Desired End State

- „Link do zgłoszeń” gives `/z/<inwestycja>/<pracownik>/<token>`. It works without a session,
  including „Wyślij”.
- The old `/zgloszenie-prac/…` returns 404.
- Specs pin the mode switch, qty surviving it, and the counters.
- The domain notes and the manual-checks registry describe the footer modes and the new URL.

## Key Decisions Made

| Decision                 | Choice                                 | Why                                                                              |
| ------------------------ | -------------------------------------- | -------------------------------------------------------------------------------- |
| Link shape               | `/z/<inwestycja>/<pracownik>/<token>`  | Owner can tell links apart by investment and worker; `/z` is short and free      |
| Old links                | Stop working, no redirect              | Owner's call; same precedent as the `/p` removal in EX-966                       |
| „Podgląd pracownika” URL | Unchanged                              | Only the worker's link is handed out                                             |
| Name segments            | Decoration, `-` when the slug is empty | The token alone resolves; matches the existing worker segment                    |
| Tests                    | DOM (jsdom)                            | The risk is client behaviour (modes, counters, draft); no server/DB path changed |

## Scope

**In scope:**

- the route move;
- the proxy prefix;
- the link builder and its callers;
- the spec fixes, plus new specs for modes, qty survival and counters;
- domain notes, manual checks, and change.md note 1.

**Out of scope:**

- a redirect;
- the investor link;
- uk/ru wording of „przeze mnie”;
- running E2E (the one spec path is edited only).

## Architecture / Approach

- The page moves to `(share)/z/[investment]/[name]/[token]` and ignores both name segments.
- `proxy.ts` whitelists `/z/`.
- `workerReportShareUrl(origin, investmentName, workerName, token)` slugs both names with a renamed,
  generic `nameSlug`.
- The callers read `investmentName` from the editor context, which already holds it.

## Phases at a Glance

| Phase                     | What it delivers                                   | Key risk                                             |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| 1. The `/z/` worker link  | New URL, old one 404s, proxy and send still public | A missed proxy prefix bounces the send POST to login |
| 2. DOM specs              | 10 red → green, plus mode, qty and counter specs   | Asserting hook state instead of the rendered UI      |
| 3. Docs and manual checks | Domain notes, registry sections, change.md note 1  | `manual-checks.md` holds other agents' hunks         |

**Prerequisites:** none. The uncommitted dogfooding UI is the base.
**Estimated effort:** one session.

## Open Risks & Assumptions

- After deploy, every worker's existing link is dead until the owner resends it. This is accepted by
  the owner.
- The uk/ru wording for „przeze mnie” is still open. „Лише заявлені” / „Только заявленные” stay
  until the owner says otherwise.

## Success Criteria (Summary)

- A worker opens `/z/…` on a phone, switches „Zgłaszam pracę” / „Inwestycja”, keeps the typed qtys,
  and sends.
- The old link gives the „link nieaktywny” page.
- The worker-view specs are green and pin the new behaviour.
