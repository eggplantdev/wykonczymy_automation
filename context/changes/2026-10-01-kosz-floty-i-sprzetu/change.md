---
change_id: kosz-floty-i-sprzetu
title: Kosz — trash a vehicle (Flota) and an equipment item (Sprzęt), warnings instead of a blocker
status: implementing
created: 2026-10-01
updated: 2026-10-01
archived_at: null
branch: staging
worktree: null
---

## Notes

Kosz: flota (EX-915) + sprzęt (EX-916), one change — same rulings, same low risk, nothing outside the
two modules points at a vehicle or an item. Umbrella: context/changes/2026-09-29-kosz-pozostalych-encji/research.md §4.
Reference implementations: context/archive/2026-09-30-kosz-kas, context/changes/2026-10-01-kosz-pracownikow.

## Decisions (owner, 2026-10-01)

Apply to both kinds.

- **No blocker — warnings only.** Any vehicle or item can go to the trash, whatever its status or
  history; the dialogs warn instead of refusing. Losing that history is not a big deal to the owner.
  Departs from the umbrella's „never-used only" (every vehicle has inspections), and supersedes the
  same-day „gate = status" ruling.
- **No freeze on a trashed row.** The only way to edit one from the app is a page left open from
  before the trash; that write is harmless, so there's no guard.
- **Unique keys stay** — a trashed vehicle keeps its `registration`, a trashed item its `serialNumber`.
- **Gone after 30 days or on „Usuń na zawsze" (typed name)** — either way the history (inspections /
  events) goes with it.
- **One change for both** — low risk, same behaviour.
