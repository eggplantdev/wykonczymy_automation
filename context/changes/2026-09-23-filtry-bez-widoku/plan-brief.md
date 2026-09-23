# Plan brief — „Filtry" bez widoku

**Change:** `filtry-bez-widoku` · **Linear:** EX-856 · **Plan:** `plan.md` · **Risercz:** `research.md`

## Co się zmienia

Menu „Filtry" w kosztorysie przestaje ukrywać połowę zawężeń zależnie od wybranego widoku cen,
przestaje pokazywać wiersze, które nic nie dotyczą, i dzieli je na sześć nazwanych osi. Warsztat
szablonu — gdzie obie płaszczyzny cen i tak są na ekranie naraz — traci przełącznik „Widok cen" i
dostaje płaszczyznę przypiętą do „Inwestor".

## Dlaczego

Bramka widoku nie jest zabezpieczeniem — zaangażowane zawężenia żyją w localStorage i tak czy owak
ją omijają. Była **ergonomią**: wpisano ją (EX-714, 2026-08-18) razem z rozbiciem pary stawkowej na
płaszczyzny, żeby lista nie urosła „z 4 wierszy do 12". Właściciel (2026-09-23) ocenia ten kompromis
jako nietrafiony: „i tak mi się nie podoba, nie ma sensu". Skracanie listy przenosi się więc na
kryterium, które mówi prawdę o rozpisce — licznik — a czytelność bierze nagłówek grupy zamiast
ukrywania.

W warsztacie przełącznik od początku nie zmieniał żadnej kolumny (lista kolumn jest tam zamknięta),
a mimo to ruszał listę filtrów i klucz sortowania „Ceny j.m." — sortował po stawce wykonawcy,
pokazując cenę klienta. Przypięcie zamyka i to.

## Key Decisions

| Decyzja                    | Wybór                                                                                                        | Źródło                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Grupowanie wierszy         | Sześć osi: Przedmiar · Wykonana praca · Rabat · Źródło stawki wykonawcy · Sufit stawki wykonawcy · Komentarz | Właściciel, 2026-09-23 („grupowanie tak jak jest łatwiej")                                                                    |
| Płaszczyzna w etykiecie    | Ogon „… w widoku …" **zostaje**                                                                              | Risercz: bazowe etykiety obu par stawkowych są identyczne dla obu płaszczyzn                                                  |
| Para przy zerze            | Znika pojedynczo; druga połowa nie jest chroniona                                                            | Właściciel, 2026-09-23 („przy zerze para domykająca może zniknąć… to nic nie zmienia")                                        |
| Wyjątek od progu           | Zaangażowane zawężenie zostaje na liście przy zerze                                                          | Plan (to jedyny jego wyłącznik)                                                                                               |
| Technologia menu           | Rozszerzyć obecny `FilterMultiSelect` o opcjonalny nagłówek per wiersz                                       | Właściciel, picker                                                                                                            |
| Zakres „zaznacz wszystkie" | Tylko wylistowane wiersze                                                                                    | Rozstrzygnięcie w rozmowie: wiersz niewylistowany i tak nic nie ukrywa, a zamiatanie go otwierałoby kolumny cenowe bez powodu |
| Sortowanie w warsztacie    | Naprawiamy przy okazji, jako udokumentowany skutek uboczny                                                   | Właściciel, picker                                                                                                            |
| Bramka rabatu              | Bez zmian                                                                                                    | Plan (osobna reguła, osobne uzasadnienie)                                                                                     |
| Fazy                       | Trzy: model+bramka → menu → warsztat                                                                         | Właściciel, picker                                                                                                            |

## Fazy

1. **Oś kategorii i model menu** — `filter-groups.ts`, pole `filterGroup` na warunku, otagowanie 16
   filtrów, zdjęcie bramki płaszczyzny z `offeredFilterConditions`, czysty `filters-menu-model.ts`
   z progiem licznika. Testy: bramki (dziś zero pokrycia), kompletność kategorii, model.
2. **Nagłówki w menu** — opcjonalny `groupLabel` w `FilterMultiSelect`, przepięcie „Filtrów" na
   model, zawężenie wiersza zbiorczego i przepisanie jego uzasadnienia. Cztery istniejące testy menu
   do poprawienia (jeden asercjuje wprost to, co zmiana odwraca).
3. **Warsztat bez przełącznika** — `isWorkshop` do stanu widoku, przypięcie bazowej płaszczyzny pod
   zamkiem ujawnienia, `{!isWorkshop && …}` na kontrolce, poprawa nieaktualnego komentarza,
   rozszerzenie testu paska (dziś zero pokrycia).

## Ryzyka

- **Zamek ujawnienia.** Warunek `preview` musi zostać pierwszy w wyrażeniu widoku — to jego druga
  połowa (pierwsza to allowlist kolumn). Przypięcie wchodzi pod niego, nie obok.
- **Strandowana przeglądarka.** `pickView` jest jedynym zapisującym klucz widoku, więc samo ukrycie
  przycisku zostawiłoby warsztat na płaszczyźnie wykonawcy bez wyjścia. Dlatego przypięcie i zdjęcie
  kontrolki idą w jednej fazie.
- **Kolejność chipów.** `active-filters-model.test.ts` opiera się na tym, że kolejność rejestru jest
  kolejnością menu. Model układa wiersze przez `FILTER_GROUPS`, więc plan wymaga testu pinującego
  zgodność obu.

## Poza zakresem

Bramka rabatu, przepięcie „Filtrów" na `DropdownCheckGroups`, skracanie etykiet w rejestrze,
czyszczenie zaangażowanych filtrów przy zmianie widoku, E2E.
