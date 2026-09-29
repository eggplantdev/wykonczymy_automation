---
change_id: catalogue-filters-and-usage
title: Katalog prac — menu „Filtry" i „Problemy" oraz raport użycia
status: implemented
created: 2026-09-28
updated: 2026-09-29
archived_at: null
branch: catalogue-filters-and-usage
worktree: null
---

## Notes

Linear: **EX-863** (menu „Filtry" / „Problemy" na `/katalog-prac`) + **EX-873** (raport użycia). Jeden
change od 2026-09-29 — oba zmieniają tę samą tabelę katalogu, a „nieużywana" jest naturalnie jednym
z jej filtrów.

### EX-863 — ustalenia z analizy 2026-09-29

- Źródło stawki ma od EX-865 **trzy** wartości (kwota / mnożnik / auto), nie dwie — filtr per widok ma
  trzy wiersze.
- „Ujemna stawka" odpada: formularz katalogu odrzuca ujemną kwotę i ujemny mnożnik
  (`work-catalogue-item-schema.ts`), lokalnie 0 takich prac.
- „Bez kategorii" zostaje opcją filtra „Kategoria" (lokalnie 0 prac).
- Lokalnie (561 prac): 20 bez ceny j.m., 18 / 21 z kwotą 0 (z narzędziami / bez), 14 ponad 65 %
  (z narzędziami), 124 / 124 „auto", 10 różnych j.m.
- Osobny, mały rejestr warunków katalogu zamiast uogólniania `row-conditions/registry.ts` (typowany na
  wiersz rozpiski + kontekst etapów). Współdzielone: `FilterMultiSelect`, `DropdownCheckGroups`,
  `FilterTriggerButton`, `FilterChip`; `problemsMenuModel` / `filtersMenuModel` do sparametryzowania
  listą warunków.

### EX-873 — raport użycia

Raport użycia prac z katalogu, liczony na klik na stronie katalogu prac. Źródło: tylko kosztorysy w aplikacji (bez starych arkuszy). „Użyta" = pozycja ma Przedmiar > 0 **lub** ilość w etapach > 0 (decyzja właściciela 2026-09-28). Pomiar z natury z arkusza się NIE liczy. Sama obecność w rozpisce też nie — kosztorys zawiera cały cennik z zerami. Lokalnie: 642 użyte pozycje z 5929. Dopasowanie po kluczu katalogu (opis + j.m., ta sama funkcja co „Porównaj z katalogiem"), bez dopasowania rozmytego; osobna podpowiedź „występuje z inną j.m." (22 opisy lokalnie). Kolumna: liczba kosztorysów (inwestycji, nie pozycji); sortowanie rosnąco, żeby zera były na górze. Wykluczone inwestycje o statusie „szablon". Szablony (presety) poza zakresem v1. Pomiar 2026-09-28 na lokalnej kopii prod: 18 kosztorysów, 135/561 prac katalogu z ≥1 realnym użyciem, 68% użytych pozycji pasuje dokładnie.

### Analiza 2026-09-29 (lokalna kopia prod)

Ponowny pomiar: 24 kosztorysy, 1040 użytych pozycji z 7557, 164/561 prac katalogu z ≥1 użyciem, 69,2% dokładnych dopasowań. Klucze zapisane w katalogu zgadzają się z liczonymi dziś (0 rozjazdów), więc można dopasowywać po zapisanym kluczu; samo dopasowanie musi iść w Node (poprawki literówek są w kodzie), ale wystarczy wczytać tylko użyte pozycje (~1k wierszy).

Punkty otwarte (rozstrzygnięte niżej):

1. **Zero ≠ praca nieużywana.** 27% użytych pozycji (284) nie pasuje do niczego, bo kosztorysy niosą starą, ogólną nazwę, a katalog ma już warianty: „Fugowanie ścian i podłóg" (13×) vs „…płytka format standard" / „…mały format"; „Montaż umywalki" (11×) vs „…wiszącej" / „…nablatowej"; „Montaż zaworów" (11×). Propozycja: druga lista „używane, a brak w katalogu" (sortowana po liczbie kosztorysów), z podpowiedziami „może chodzi o…" z istniejącego mechanizmu — tylko jako wskazówka, nie do liczenia.
2. **„wyłączników" vs „włączników"** — „Montaż gniazdek i wyłączników" (9×) nie trafia w katalogowe „…włączników". Oba słowa są poprawne, więc to decyzja właściciela, nie automatyczna poprawka (zmiana listy poprawek zmienia też tożsamość prac w imporcie z arkusza).
3. **„Ostatnie użycie" nie ma wiarygodnej daty na pozycji** — data utworzenia pozycji jest wspólna dla całego kosztorysu (tworzone hurtowo z szablonu/importu; 8 zaimportowanych zakończonych inwestycji ma 2026-08-27), a data edycji skacze przy akcjach zbiorczych. Brać datę z inwestycji — wybrać którą.
4. Podpowiedź „inna j.m." — dziś 12 opisów (w tym literówka w j.m. „klp" vs „kpl").
5. Śmieciowe inwestycje o statusie aktywna („testowe inwestycje", „asDasdaSD", „kosztorys wzór. nic nie dodajemy") — łącznie 9 użytych pozycji, pomijalne.

### Decyzje 2026-09-29 (przed `/10x-plan`)

- **Zakres EX-863:** „Problemy" = bez ceny j.m.; stawka 0 z narzędziami; stawka 0 bez narzędzi.
  „Filtry" = źródło stawki (kwota / mnożnik / auto) per widok; ponad sufit / w granicy per widok —
  sufit per płaszczyzna (65 % z narzędziami, 55,25 % bez narzędzi), ten sam co czerwona komórka.
  „W granicy" wyklucza „auto" i prace bez ceny j.m. (plan, 2026-09-29).
  Osobno filtr „j.m." obok „Kategorii".
- **Połączenie:** „Policz użycia" zostaje przyciskiem na tabeli katalogu. Po kliknięciu kolumna
  „Kosztorysy" (liczba) i grupa „Użycie" w „Filtrach" (nieużywane / używane) — przed kliknięciem
  grupy nie ma. Nieużywana praca to filtr, nie problem.
- **(1)** Tak — druga lista „używane, a brak w katalogu", po liczbie kosztorysów, z podpowiedziami
  „może chodzi o…" (tylko wskazówka, nie liczy się do użycia).
- **(2)** Poza tym changem — decyzja właściciela; te prace i tak widać na liście z (1).
- **(3)** **Nie ma „ostatniego użycia"** — żadnej kolumny z datą, w żadnej wersji tego raportu.
- **(4)** Tak — znacznik „występuje z inną j.m." na wierszu katalogu.
- **(5)** Wykluczone: inwestycje w koszu (`trashedAt`) i o statusie „szablon". Wyceny się liczą.
  Śmieciowe aktywne inwestycje — bez specjalnego traktowania.
