# Worker PDF — „Tylko pozycje z wykonaną pracą" — Plan Brief

> Full plan: `context/changes/2026-10-22-worker-pdf-own-work-filter/plan.md`
> Research: `context/changes/2026-10-22-worker-pdf-own-work-filter/research.md`

## What & Why

The owner asked that a worker's PDF cover only his own work. Today it prints every pozycja with a
Przedmiar (Kyryl Elektryk on Gryka-Deszczyński: ~146 printed, 12 his).

## Starting Point

The worker projection keeps all items; the PDF hides only rows empty on both axes and totals over
all rows. The full scope is a deliberate design (the empty etap column is the to-do list), so the
narrowing has to be a choice, not a new default for every surface.

## Desired End State

„Drukuj kosztorys pracownika (PDF)" opens a dialog with „Tylko pozycje z wykonaną pracą" (ticked).
Ticked → only his pozycje, totals add up exactly what's printed. Unticked → today's PDF. The fill-in
form and the link don't change.

## Key Decisions Made

| Decision               | Choice                              | Why                                                               | Source   |
| ---------------------- | ----------------------------------- | ----------------------------------------------------------------- | -------- |
| Meaning of „his work"  | qty done > 0 in his etapy           | User's ruling; no item→trade link exists                          | Research |
| Where the choice lives | Dialog at print time, not persisted | Settings are one firm-wide row; per-print needs no migration      | Research |
| Default                | Ticked                              | User's ruling                                                     | Research |
| Worker with no work    | Prints empty, no guard              | User: they'll see it and untick                                   | Research |
| Totals                 | Over printed rows                   | Otherwise „Wartość przedmiaru"/„Pozostało" totals exceed the page | Research |
| Kartka                 | Separate item, no dialog            | Different document/moment, own disable rule                       | Research |

## Scope

**In scope:** builder flag + totals over printed rows; print dialog; domain-note sentence.

**Out of scope:** persisted setting, link/report/form filtering, empty guard, shared-etap attribution.

## Phases at a Glance

| Phase      | What it delivers                            | Key risk                                                              |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------- |
| 1. Builder | `ownWorkOnly` filter, totals = printed rows | Totals-over-printed changes today's numbers — existing specs guard it |
| 2. Dialog  | Menu → dialog → print with the flag         | Popup block if `window.open` leaves the click                         |

**Prerequisites:** none. **Estimated effort:** one short session.

## Open Risks & Assumptions

- On a shared etap, a co-member's work makes the row "his" (data can't tell them apart).

## Success Criteria (Summary)

- Kyryl's PDF with the box ticked lists only his ~12 pozycje and its totals match them.
- Unticked, the PDF is byte-for-byte today's layout.
