---
change_id: kosztorys-przedmiar-aktualny
title: Second quantity column „Przedmiar aktualny” beside „Przedmiar ofertowy”
status: implementing
created: 2026-10-07
updated: 2026-10-07
archived_at: null
branch: kosztorys-przedmiar-aktualny
worktree: null
---

## Notes

Second quantity column „Przedmiar aktualny” beside „Przedmiar ofertowy” (renamed Przedmiar);
progress anchors to aktualny.

Problem: Przedmiar is the offer, but after the offer the scope keeps moving — extra works, works
dropped, quantities changed in talks with the client. Progress and „what is left” must be measured
against that moving scope, while the offer stays what the client received.

Decisions (owner, 2026-10-07):

- „Przedmiar” is renamed **„Przedmiar ofertowy”**. The new column is **„Aktualizacja przedmiaru”** (owner renamed it 2026-10-07; this doc says „aktualny” for short).
- „Przedmiar aktualny” carries **every** scope change — additions, removals and quantity changes;
  the scope can shrink as well as grow.
- It **starts as a copy** of Przedmiar ofertowy and is editable. An empty Przedmiar aktualny is not
  a state — every row has one.
- **% wykonania** and **Pozostało** anchor to Przedmiar aktualny.
- „Wartość netto przedmiar” gets a pair: an ofertowy value and an aktualny value.
- The offer stays the offer — the investor document („Generuj ofertę”, podgląd, share link) keeps
  Przedmiar ofertowy.

Decisions after research (owner, 2026-10-07):

- **Copy timing:** aktualny follows ofertowy until someone edits aktualny by hand; from then on it
  is independent. This includes the AI review statuses that write Przedmiar ofertowy.
- **Investor document** (podgląd, share link, „Generuj ofertę”): before the first etap entry it is
  the pure offer — no Przedmiar aktualny. After the first etap entry it shows **both** przedmiary,
  and Pozostało / % wykonania are computed from aktualny.
- **Worker surfaces** (link, PDF, „Drukuj do wypełnienia”, report page, report review): Przedmiar
  aktualny only.
- **Extra work accepted from a worker report:** ofertowy 0, aktualny = the reported quantity.
- **Prognoza marży stays on ofertowy** — „otherwise it is not a forecast, it is the current
  calculation”.
- **Sheet import:** the sheet has one przedmiar, so it is copied into both.
- Existing kosztorysy: aktualny = ofertowy, by following it (no backfill — see Storage below).
- New work without sheet parity — the owner's sheet has no updated-scope column (lessons.md:325).

- **Re-import over an app-edited kosztorys:** the sheet refreshes ofertowy; an aktualny edited by
  hand survives (sheet 100, app aktualny 120 → stays 120). An aktualny nobody edited follows
  ofertowy as usual.
- Section-share pie: ofertowy (like the forecast). Filters „bez przedmiaru” / „z przedmiarem”:
  aktualny. (Agent defaults, owner did not object.)
- **Folds in `2026-10-06-offer-hides-remaining`:** the investor document hides Pozostało until the
  first etap entry — the same trigger that adds Przedmiar aktualny to it.

Naming and visibility (owner, 2026-10-07):

- Value twin: **„Wartość netto aktualizacji przedmiaru”** (beside „Wartość netto przedmiar”).
- Editor: „Aktualizacja przedmiaru” and its value visible by default, right after the ofertowy pair;
  the „Razem” footer carries both value totals.
- Investor document: after the first etap entry „Aktualizacja przedmiaru” is ticked by default; its
  value is an available tick, unticked by default (like „Pozostało” today).
- Worker surfaces: the column is labelled **„Aktualizacja przedmiaru”** there too — one name
  everywhere (uk/ru get a translation of that name, not of „Przedmiar”).
- Storage: only a hand edit is stored; an unedited row shows (and computes from) ofertowy. This is
  what makes „follows until edited”, the re-import rule and the AI statuses work without extra code.
- Editor cell (owner, 2026-10-07): a value that follows ofertowy renders **grey**, a hand edit
  **black**. **Delete** clears the hand edit and the cell follows ofertowy again — it is never
  empty. A typed **0** means the item dropped out of scope.
