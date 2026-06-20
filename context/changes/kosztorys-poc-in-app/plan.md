# Kosztorys robocizny w aplikacji (POC) — Implementation Plan

> ## ⚠️ KOD POC — DO PRZEROBIENIA. Co tu jest WARTOŚCIOWE, a co do wyrzucenia
>
> **Dla przyszłych agentów:** to plan POC budowanego na szybko. Pełny opis w `change.md`
> (banner na górze). W skrócie:
>
> **WARTOŚCIOWE — bierz to dalej:**
>
> - **Lekcje** (`context/foundation/lessons.md`) — twarde gotchas z tej pracy (remount dsg,
>   brak natywnego resize, migotanie flex, lightningcss arm64). Realne, sprawdzone.
> - **To, że działa** — POC dowiódł, że appka może zastąpić arkusz w tej części. Dowód
>   koncepcji, nie produkcyjny kod.
> - **Decyzje** — wszystkie rozstrzygnięcia właściciela (sekcja „Decyzje" + „Pytania"
>   w `change.md`). To jest źródło prawdy o zamyśle.
>
> **DO PRZEROBIENIA OD ZERA:**
>
> - **Cały quality gate** — testy, code review, `simplify`, audyty jakości/architektury.
>   Świadomie pominięte w POC; przy MVP implementowane od nowa. Nie zakładaj, że brak
>   testów = stabilne; nie traktuj istniejącego kodu jako wzorca.

## Status (2026-06-20)

Fazy 1–3 = rdzeń POC — **ZROBIONE i zweryfikowane w przeglądarce**. Faza 3
dostarczona jako **edytor v2 (`react-datasheet-grid`)**, nie v1/TanStack z opisu —
po bake-offie v1 usunięta, przewagi sportowane (change.md). Kryteria fazy 3
spełnia v2. **Fazy 4–6 = NIEZROBIONE — jedyne braki planu.** Część gated na decyzje
właściciela (change.md §„Pytania do właściciela"):

- **Faza 4 — Panel plan-vs-actual** — NIEZROBIONA, **bez blokera** (actuals już
  queryowalne: `deriveFinancials` + `calculateMargin`). Można ruszyć od razu.
- **Faza 5 — Pokoje (kalkulator metrażu)** — ❌ **ANULOWANA** (właściciel, 2026-06-20):
  pokoje wypadły z zakresu, nie powstaną w apce. Q4 rozstrzygnięte: out.
- **Faza 6 — Eksport** — NIEZROBIONA, gated na Q3. **Zakres rozszerzony 2026-06-20:**
  PDF (umowa) **i** arkusz Excel/Sheets (po wykonaniu, z żywymi formułami z SQL-a) —
  oba wymagane; dane wrażliwe fizycznie wycięte z pliku. Otwarte tylko: które kolumny w PDF.

Parkowane poza fazami planu (change.md): dodawanie/usuwanie wierszy (Q7, `lockRows`),
subtotale per sekcja (Q1). Rozstrzygnięte: ceny podwykonawcy (Q2 ✅), forward-scope
wydatków (Q5 ✅ kierunkowo — wszystkie 7 typów przypiętych do inwestycji wchodzą z
widocznością warunkową; **defaulty istnieją (zaliczki/strata domyślnie ukryte dla klienta),
ale wszystko nadal edytowalne przed eksportem** — default = stan wyjściowy, nie blokada;
korekta zawarta w wydatkach inwestycyjnych; mapa typów w change.md §Forward scope).
**Nowy wymóg z Q5:** widoczność sekcji/typów jako **multi-select** (dziś tylko „jedna albo
wszystkie"), analogicznie do przełącznika kolumn.

Szczegółowa lista kryteriów: §Progress (na dole).

> **Trym 2026-06-20:** wycięto martwe body oryginalnego planu v1 (Overview, Current State,
> Desired End State, What We're NOT Doing, Decyzje domknięte, opisy Faz 1–6, Testing/Perf/
> Migration/References) — opisywało nieaktualny plan TanStack v1 sprzed bake-offu i sprzed
> decyzji właściciela. Źródło prawdy o zamyśle: `change.md`. Trwałe repo-pointery (gdzie
> w kodzie siedzą actuals/protectedAction/migracje/druk) przeniesione do
> `context/foundation/prd.md` → „Key code locations". Pełna historia body: `git log`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

> **Podsumowanie stanu → góra dokumentu (§Status).** Fazy 1–3 zrobione, 4–6 nie.
> Poniżej rozbicie per kryterium.

### Phase 1: Schemat danych

#### Automated

- [x] 1.1 Migracja aplikuje się czysto: `pnpm payload migrate` — 580523d
- [x] 1.2 Typy generują się: `pnpm generate:types` — 580523d
- [x] 1.3 Typecheck przechodzi: `pnpm typecheck` — 580523d
- [x] 1.4 Build przechodzi: `pnpm build` — 580523d

#### Manual

- [x] 1.5 Admin Payload pokazuje 5 kolekcji i pozwala dodać rekord — 580523d
- [x] 1.6 FK CASCADE kasuje powiązane wiersze przy usunięciu inwestycji — 580523d
- [x] 1.7 `down()` migracji czysto cofa — 580523d

### Phase 2: Ścieżka odczytu + trasa + warstwa liczona

#### Automated

- [x] 2.1 Testy warstwy liczonej przechodzą — f692ab7
- [x] 2.2 Typecheck przechodzi — f692ab7
- [x] 2.3 Build przechodzi — f692ab7

#### Manual

- [x] 2.4 EMPLOYEE odmowa; ADMIN/OWNER/MANAGER widzą siatkę — 9e401e0
- [x] 2.5 Rekord z admina widoczny w siatce z poprawnymi sumami/brutto/pozostało — f692ab7
- [x] 2.6 Liczba kolumn etapów = liczba wierszy `kosztorys_stages` — f692ab7

### Phase 3: Edytowalna siatka + optymistyczny autosave

> Dostarczone jako **v2 (`react-datasheet-grid`)** — 26c2712 → 9e401e0; przewagi
> sportowane + revert-on-error 475e61d, perf ~1000 PASS 3b4c5a7. v1 usunięta d0aa5c5.

#### Automated

- [x] 3.1 Testy akcji (blokada etapu, upsert postępu, reorder) przechodzą — 9e401e0
- [x] 3.2 Typecheck przechodzi — 3b4c5a7
- [x] 3.3 Build przechodzi — 3b4c5a7

#### Manual

- [x] 3.4 Edycja komórki zapisuje bez przycisku; trwała po odświeżeniu; sumy przeliczone — 9e401e0
- [x] 3.5 Add/remove **pozycji** (toolbar + gutter kosz) i **sekcji** (panel); **etap: dodawanie** (button „+ etap", browser ✅ 2026-06-20). Kasowanie etapu → MVP (change.md #7/#9)
- [~] 3.6 Blokada kasowania etapu z postępem — logika gotowa w `removeStageAction`; UI kasowania → MVP (splata się z undo/cascade, #9)
- [x] 3.7 Reorder strzałkami ▲▼ trwały — ZROBIONE (`handleReorderItem` + `swapItemOrderAction`)
- [x] 3.8 Edycja jednego pola przy 1000+ wierszach zapisuje tylko to pole (`[PERF]`) — 3b4c5a7

### Phase 4: Panel plan-vs-actual

#### Automated

- [ ] 4.1 Test `buildPlanVsActual` przechodzi
- [ ] 4.2 Typecheck + build przechodzą

#### Manual

- [ ] 4.3 Plan zgodny z sumami siatki; actuals zgodne z panelem finansowym detalu
- [ ] 4.4 Marża planowana i rzeczywista liczone wg definicji

### Phase 5: Pokoje (kalkulator metrażu) — ❌ ANULOWANA (właściciel, 2026-06-20)

Pokoje wypadły z zakresu — kryteria nieaktualne, faza nie będzie realizowana.

- [~] 5.1 ~~Test formuł pokoi~~ — anulowane
- [~] 5.2 ~~Typecheck + build~~ — anulowane
- [~] 5.3 ~~Obwód/ściany/malowanie~~ — anulowane
- [~] 5.4 ~~Metraż do przepisania~~ — anulowane

### Phase 6: Eksport — PDF + arkusz (zakres rozszerzony 2026-06-20)

#### Automated

- [ ] 6.1 Test budowy HTML (ukryte/kosztowe kolumny) przechodzi
- [ ] 6.2 Typecheck + build przechodzą

#### Manual

- [ ] 6.3 Krok eksportu domyślnie ukrywa wiersze zerowe; toggle działa
- [ ] 6.4 PDF tylko ceny klienta; bez cen podwykonawcy/marży/postępu
- [ ] 6.5 Przełącznik przedmiar/pomiar zmienia drukowaną ilość
