# Filters: tick what you want to see — Plan Brief

> Full plan: `context/changes/2026-10-16-filters-tick-to-show/plan.md`

## What & Why

Every „Filtry" menu today starts with everything ticked, and you untick to hide. To see „tylko z
komentarzem" you have to untick „Bez komentarza". On top of that, a ticked option does not even
guarantee its pozycje are visible: the „Przedmiar i wykonana praca" options overlap. The owner ruled
on 2026-10-16 that this is misleading. This change flips every filter to „tick what you want to see".

## Starting Point

There are two grammars today:

- Toggle menus (kosztorys, szablon, work catalogue): an engaged id means hidden.
- Option lists (13 `FilterMultiSelect` consumers): `[]` means no filter but renders all ticked.

The „Problemy" menus already work as show-only.

## Desired End State

- On open, nothing is ticked and everything is shown.
- A tick narrows to what it names.
- Inside one group, ticks combine with OR. Between groups, they combine with AND.
- Chips read „Tylko: …".
- No single group can empty the grid.
- „Sekcje" behaves as it does today.
- Every filter result reachable today is still reachable. Unit tests prove it.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Scope | Every filter menu: kosztorys, szablon, catalogue, option lists, users, investment statuses | Owner: „change it everywhere" |
| „Przedmiar i wykonana praca" | Split into Przedmiar / Wykonana praca / Puste pozycje | Owner said yes. Needed for AND („z przedmiarem, bez wykonanej pracy") |
| Rate-source and rate-ceiling groups | Split per crew plane | OR inside one group would widen today's AND across planes |
| Catalogue „Udział w cenie" | Add „nie dotyczy (auto lub bez ceny j.m.)" per plane | Without it, „untick ponad 65%" (which keeps auto and unpriced) is lost |
| Saved picks | Dropped through a localStorage key rename | Old ids mean the opposite. One reset beats a silent inversion |
| „Zaznacz wszystkie" | Removed. Option lists get „Wyczyść" instead | Ticking everything equals ticking nothing |
| Options that match every row | Not listed | Ticking one changes nothing |
| „Przegląd AI" switch-on | Ticks „z przedmiarem lub AI przedmiarem" | Keeps the 2026-10-07 ruling with the inverted grammar |
| Global rabat | Strips leftover rabat picks | Under include semantics they would empty the grid |

## Scope

**In scope:**

- Kosztorys and szablon „Filtry": engine, registry groups, menu, chips, empty state, AI switch,
  storage.
- Work catalogue „Filtry".
- The `FilterMultiSelect` options mode and its consumers.
- The „Sekcje" adapter.
- Users „Pracownicy" and investment statuses: empty selection shows all.

**Out of scope:**

- „Problemy" menus.
- Users „Pozostało do wypłaty" (a money switch, not a filter).
- Hide-wording outside filter menus.
- Migrating saved picks.
- Server parsing of `__none__`.

## Architecture / Approach

The engaged-ids store and the `matches` predicates stay. What changes is the meaning of an engaged
filter: it includes rather than hides, and the engine evaluates it per group (OR within, AND across).
The registry is regrouped until every group is a partition: its options are mutually exclusive and
cover every row. That makes „untick S" today equal to „tick the rest of the group" tomorrow, and a
partition spec guards it for future additions. The option-list flip lives in one primitive, plus a
small fix in „Sekcje".

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Kosztorys engine + facets | Facet logic, partition groups, equivalence specs | A group that is not exhaustive silently loses a filter (the spec guards it) |
| 2. Kosztorys/szablon UI | Menu, chips, empty copy, AI switch, storage key | Missing a reader of the old „unticked" meaning |
| 3. Work catalogue | Same grammar plus the residual ceiling option | Label collisions in cmdk (the plane suffix stays) |
| 4. Option lists + Sekcje + users/statuses | Primitive flip, „Wyczyść", Sekcje unchanged | Sekcje regressing, since it relies on the old encoding |

**Prerequisites:** none.
**Estimated effort:** one session, four phases.

## Open Risks & Assumptions

- The partition specs need a fixture that covers every axis value, including ofertowy przedmiar > 0
  with aktualny = 0.
- The E2E spec `equipment-registry` is edited to the new flow but not run here.

## Success Criteria (Summary)

- Opening any filter shows nothing ticked. Ticking „Z komentarzem" shows only pozycje with a comment.
- Every combination available today has a tick equivalent, and unit tests prove it.
- „Sekcje" and „Problemy" behave exactly as before.
