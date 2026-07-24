# Plan Brief: Globalny rabat na kosztorysie

**Change**: `kosztorys-global-discount` · **Status**: planned · **Confidence**: HIGH (frame HIGH, zero
open domain questions)

## What we're building

Jeden, dwutrybowy (kwota/procent) **rabat globalny** na kosztorysie, wpisywany raz. Gdy ustawiony:
**nadpisuje** rabaty per pozycja (chowa i wyłącza ich kolumny, ich wkład przestaje liczyć — dane
zostają w bazie), i jest odjęty **raz** od wartości netto wykonanych prac. Baza rabatu = **wartość
netto wykonanych prac** (klient płaci za prace, nie za przedmiar — przedmiar to podgląd), tak samo dla
kwoty i procentu. **Nic się nie rozkłada** na sekcje/etapy. Wynik — „do zapłaty" — pokazany w dwóch
miejscach z **jednego źródła**: blok Suma w panelu Sekcje + nowy stały pasek pod siatką.

## Key decisions locked

- **Baza rabatu = wartość netto wykonanych prac** (nie przedmiar), jednakowo dla obu trybów. Nie
  rozbijać na percent vs amount — właściciel liczy jedną wiążącą kwotę = do zapłaty.
- **Override = tłumienie per wiersz, nie kasowanie.** Zdenormalizowana flaga `globalDiscountActive` na
  wierszu → `applyDiscount` zwraca wartość sprzed rabatu, gdy aktywna. Wyłączenie przywraca per pozycja.
- **Jedno źródło totali (twarde).** Kwota rabatu i „do zapłaty" liczone raz w hooku edytora obok
  `totalNet`; oba paski czytają te same liczby, nie przeliczają.
- **Marża poza zakresem** — plan kosztorysu i księga są dziś rozłączone (zweryfikowane, brak
  writer/reader). Rabat kosztorysowy nie rusza marży w tej zmianie.
- Rabat wpisywany **netto**; brutto = VAT po rabacie; „do zapłaty" idzie za istniejącym przełącznikiem
  netto/brutto.

## Shape it rides

Rabat globalny to **czwarte ustawienie per-inwestycja** — jedzie tą samą szyną co `vatRate`:
kolekcja → migracja (ręczna) → `getKosztorysTree` → denormalizacja na wiersze → akcja inwestycyjna →
optymistyczny patch. Chowanie kolumn = czwarty warunek w istniejącym filtrze widoczności. Zaprojektowane
tak, by dało się je później **zastąpić/zasilić** transferem `RABAT` (decyzja P5), nie migrować.

## Phases

1. **Model, ścieżka odczytu, snapshot** — pola na `investments`, ręczna migracja, `KosztorysTreeT`,
   odczyt w `getKosztorysTree`, snapshot addytywnie (bez bumpu wersji) + serialize/restore.
2. **Override + total (TDD)** — flaga `globalDiscountActive` na wierszu; `applyDiscount` short-circuit;
   `globalDiscountAmount` + `doZaplatyNet`; testy jednostkowe.
3. **Akcja + wiring hooka + chowanie kolumn** — `updateInvestmentGlobalDiscountAction` + zod;
   stan/patch/handler/ekspozycja w hooku; czwarty warunek widoczności.
4. **UI** — kontrolka rabatu w pasku ustawień; blok Suma w Sekcjach → „do zapłaty"; nowy stały pasek
   totali pod siatką — oba z jednego źródła.

## Out of scope

Marża, transfer `RABAT`, zszycie kosztorys↔apka (P5), rozkład na sekcje/etapy, eksport/oferta PDF,
ścieżka zachowania danych (kosztorys throwaway do dogfoodingu).

## Refs

Plan: `plan.md` · Frame: `frame.md` · Domena/archeologia: `change.md` · Precedens VAT:
`investments.ts`, `queries/kosztorys.ts`, `actions/kosztorys.ts`, `use-kosztorys-editor.ts`
