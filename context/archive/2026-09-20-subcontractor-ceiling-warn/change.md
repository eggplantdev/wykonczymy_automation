---
change_id: subcontractor-ceiling-warn
title: Sufit ceny podwykonawcy ostrzega, zamiast odmawiać zapisu
status: archived
created: 2026-09-20
updated: 2026-09-22
archived_at: 2026-09-22T04:53:56Z
branch: null
worktree: null
---

## Notes

Spisane przy archiwizacji (2026-09-22) z nagłówka `review-gate.md` — slice pracował bez folderu
zmiany, więc tożsamość zmiany istniała dotąd wyłącznie w ledgerze.

**Zmiana:** sufit 65 % ceny podwykonawcy przestaje odmawiać, a zaczyna ostrzegać. Ekipa czasem
naprawdę kosztuje więcej niż 65 % ceny inwestora, a kosztorys, który nie umie tego zapisać, kłamie
(decyzja właściciela, 2026-09-20). Czerwona komórka i toast zostają — zmienia się to, że zapis
wchodzi.

**Kształt:** `checkSubcontractorPrice` zwraca dwustopniowy `CellVerdictT = { severity: 'refuse' | 'warn' }`.
`refuse` (wyłącznie cena ujemna) cofa zapis i rolluje back; `warn` (powyżej sufitu) zapisuje po cichu
przy każdym uderzeniu w klawisz i ogłasza się raz, na settle.

Commity: `078930d3` (slice), `0476ac25` (obniżenie sufitu 80 % → 65 %).

**Czego ten slice nie domknął** (stan z ledgera, nadal aktualny):

- Step 0.5 — przebieg weryfikacyjny w przeglądarce nie był uruchomiony (stała reguła: nie sterować
  przeglądarką bez proszenia). Weryfikacja manualna pozostaje należna.
- Pełny pakiet (`lint` / `build` / `test:e2e`) nie był uruchomiony.
- Dwa findingi wyniesione do Lineara zamiast naprawy: **EX-819** (wartość poza zakresem ma trzy
  odpowiedzi, dwie milczące) i **EX-820** („Problemy" nazywa zaakceptowaną cenę ponad sufitem błędną).
