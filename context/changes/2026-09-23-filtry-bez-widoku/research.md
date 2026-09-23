---
date: 2026-09-23T09:04:41+02:00
researcher: Claude Opus 5
git_commit: 545a3282e5584c1d172d4ee5c1a54801731a203a
branch: staging
repository: wykonczymy
topic: '„Filtry" bez zależności od widoku cen, listowanie tylko przy liczniku > 0, nagłówki kategorii, oraz zdjęcie przełącznika widoku w warsztacie szablonu'
tags: [research, codebase, kosztorys, row-conditions, filters, price-view, workshop]
status: complete
last_updated: 2026-09-23
last_updated_by: Claude Opus 5
---

# Research: „Filtry" bez widoku, tylko niepuste, z nagłówkami — i warsztat bez przełącznika

**Date**: 2026-09-23T09:04:41+02:00
**Researcher**: Claude Opus 5
**Git Commit**: `545a3282e5584c1d172d4ee5c1a54801731a203a`
**Branch**: `staging`
**Repository**: `wykonczymy`

## Research Question

Cztery sprzężone pytania z `change.md`:

1. Co naprawdę trzyma bramka widoku w `offeredFilterConditions` i co się stanie, gdy zniknie?
2. Czy „nie listuj filtra z licznikiem 0" ma precedens i czy nie odwraca wcześniejszego rozstrzygnięcia?
3. Jak zrobić nagłówki kategorii, skoro filtry — inaczej niż diagnostyki — nie mają pola kategorii?
4. Czy przełącznik „Widok cen" w warsztacie szablonu naprawdę nic nie robi?

## Summary

**Punkt 1 jest tańszy, niż zakładał `change.md`, punkt 4 — droższy.**

- **Zdjęcie bramki widoku nie kosztuje nic po stronie liczenia.** Liczniki już dziś chodzą po
  wszystkich 30 warunkach niezależnie od widoku; widok jest świadomie poza zależnościami memo.
  Bramka nie chroniła też przed niczym: zaangażowany filtr obcej płaszczyzny przeżywa zmianę widoku
  i przeładowanie strony (localStorage, brak czyszczenia), więc stan „filtr z drugiej płaszczyzny tnie
  siatkę" jest osiągalny dziś — bramka jedynie utrudniała wejście w niego o jedno kliknięcie.
- **Prawdziwym motywem bramki była długość listy** (EX-714, 2026-08-18: „lista idzie z 4 wierszy do
  12, jeśli nic nie zrobimy"). Przy 16 filtrach punkt 1 otwiera dokładnie ten problem z powrotem,
  a **punkt 2 jest jego przeciwwagą** — dlatego oba muszą pójść w jednej zmianie.
- **Punkt 2 to nowy grunt, nie rewizja.** Reguła „liczniki obu planów niezależne od widoku"
  (2026-08-17) dotyczy **usterek**; o filtrach z zerem nigdy nic nie rozstrzygnięto.
- **Punkt 3 ma tańszy wariant, niż zakładaliśmy.** Grupowanie po **osi** (przedmiar / wykonana praca /
  rabat / źródło stawki / sufit stawki / komentarz) jest **już dziś ciągłe w rejestrze** — zero
  przestawiania, zero skracania etykiet, zero ryzyka dla chipów i pustego stanu. Grupowanie po
  **płaszczyźnie** (kopia podziału z „Problemów") wymaga sortowania, skrócenia ogonów etykiet i
  falsyfikuje istniejącą asercję o wspólnej kolejności menu i chipów.
- **Punkt 4: przełącznik NIE jest bezczynny.** Kolumny warsztatu faktycznie się nie ruszają, ale
  przełącznik zmienia **klucz sortowania** widocznej kolumny „Cena j.m." (sortuje po stawce wykonawcy,
  pokazując cenę klienta) oraz listę „Filtry". Co ważniejsze: **jest jedynym zapisującym** wybór
  widoku dla warsztatu, więc samo ukrycie przycisku **zamraża na zawsze** każdą przeglądarkę, która
  wcześniej stanęła na płaszczyźnie wykonawcy. Zdjęcie przycisku musi iść w parze z przypięciem
  bazowego widoku warsztatu do „Inwestor" — przy zachowaniu ulotnej nakładki z „Problemów".

## Detailed Findings

### 1. Bramka widoku — co trzyma i co kosztuje jej zdjęcie

`offeredFilterConditions` ma dwie bramki ponad `kind === 'filter'`
(`src/lib/kosztorys/row-conditions/queries.ts:199-211`):

- **bramka płaszczyzny** — `condition.plane == null || condition.plane === view`,
- **bramka rabatu** — `!(perItemDiscountInert && DISCOUNT_CONDITION_IDS.has(id))`,

a **zaangażowany warunek omija obie**. Punkt 1 usuwa wyłącznie pierwszą; druga (rabat globalny czyni
filtry rabatowe bezprzedmiotowymi) nie ma z widokiem nic wspólnego i musi przeżyć bez zmian.

Bramka dotyczy **8 z 16** filtrów — dwie czwórki po `plane`:
`manual-rate-*`, `formula-rate-*` (źródło stawki) i `fixed-rate-over-ceiling-*`,
`fixed-rate-within-ceiling-*` (sufit stawki), po dwa na każdą płaszczyznę.

**Co NIE puchnie po zdjęciu bramki:**

- **Liczniki.** `rowConditionCounts` (`src/components/kosztorys/editor/use-kosztorys-editor.ts:416-435`)
  iteruje wszystkie 30 warunków, a `view` jest **celowo poza** zależnościami memo. Koszt: zero.
- **Menu „Sekcje".** `foldableSectionIds` bierze z rejestru tylko warunki z `liftsToSections`, a
  wszystkie 8 filtrów płaszczyznowych ma `sectionLabel: null` — zdjęcie bramki nie może dołożyć tam
  ani jednego wiersza.
- **Kolumny.** `columnsRevealedBy` czyta wyłącznie warunki **zaangażowane**; samo wylistowanie filtra
  nie odsłania żadnej kolumny.

**Czego bramka nigdy nie pilnowała:** `engagedConditionIds` żyje w localStorage pod kluczem
`kosztorys-filters:<investmentId>` (`hooks/use-engaged-conditions.ts`), nie jest czyszczone przy
zmianie widoku i przeżywa przeładowanie. Filtr `w_tools` zaangażowany w widoku „Inwestor" już dziś
ukrywa pozycje i wymusza swoje kolumny cenowe.

**Jedyne realne następstwo: zbiorczy przełącznik.** `togglesBulk.onToggleAll`
(`toolbar/menus/use-kosztorys-filter-menu.ts:39-46`) zamiata `filters.map(id)` — **zakres zamiatania
JEST listą oferowaną**, z komentarzem mówiącym, że to celowe („filtry drugiej płaszczyzny nie są na
ekranie"). Po punkcie 1 komentarz przestaje być prawdą, a „Zaznacz wszystkie" zaczyna dotykać obu
płaszczyzn. Po punkcie 2 zakres zawęża się z kolei do tego, co ma licznik — uzasadnienie trzeba
napisać od nowa, nie poprawić.

### 2. Licznik 0 — precedens i to, czego nigdy nie rozstrzygnięto

„Problemy" mają tę regułę od dawna, w jednej linii
(`toolbar/menus/problems-menu-model.ts`): `.filter((p) => p.count > 0 || engagedIds.has(p.id))` —
łącznie z wyjątkiem dla zaangażowanego, który `change.md` niezależnie wskazał jako konieczny.

Przeszukanie `context/**` i całej historii gita (łącznie z planami wyciętymi przy archiwizacji)
daje dwa ustalenia:

- Reguła **„liczniki obu planów zostają niezależne od widoku"** (2026-08-17) mówi o **usterkach** —
  EX-820 dodatkowo ją zawęził do tej strony menu.
- O **filtrach z licznikiem 0 nie rozstrzygnięto nigdy nic.** Punkt 2 to nowy grunt, nie odwrócenie.

Reguła sąsiednia, z którą trzeba go zestawić: **„filtry chodzą parami dopełniającymi"** — bez pary
odptaszkowanie jednej strony nie ma czym się odwrócić. Konsekwencja, której `change.md` jeszcze nie
nazywa: przy zerze **znika połowa pary**, więc menu może pokazać „z przedmiarem", a nie pokazać
„bez przedmiaru". To jest poprawne (jeśli nie ma ani jednej pozycji bez przedmiaru, to nie ma czego
chować), ale trzeba to rozstrzygnąć świadomie — alternatywą jest chowanie/pokazywanie **całej pary**.

### 3. Nagłówki kategorii — dwie drogi, jedna wyraźnie tańsza

Filtry **nie mają dziś pola kategorii**. `problemGroup` jest opisane w
`row-conditions/types.ts` jako „tylko diagnostyki — filtr nigdy nie trafia do tamtego menu", a
`PROBLEM_GROUPS` (`src/lib/kosztorys/problem-groups.ts`) ma pięć pozycji: „Ceny dla klienta",
„Stawki wykonawców — z narzędziami", „Stawki wykonawców — bez narzędzi", „Przedmiar i etapy",
„Katalog prac".

Kolejność 16 filtrów w rejestrze (`row-conditions/registry.ts:99-248`) jest taka:

| #   | oś             | warunki                                                                                                                 |
| --- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | przedmiar      | `no-planned-qty`, `has-planned-qty`                                                                                     |
| 2   | wykonana praca | `no-measured-qty`, `has-measured-qty`                                                                                   |
| 3   | rabat          | `has-discount`, `no-discount`                                                                                           |
| 4   | źródło stawki  | `manual-rate-w-tools`, `formula-rate-w-tools`, `manual-rate-own-tools`, `formula-rate-own-tools`                        |
| 5   | sufit stawki   | `fixed-rate-over-ceiling-w-tools`, `…-within-ceiling-w-tools`, `…-over-ceiling-own-tools`, `…-within-ceiling-own-tools` |
| 6   | komentarz      | `has-note`, `no-note`                                                                                                   |

**Wariant A — grupowanie po płaszczyźnie** (kopia podziału z „Problemów"): grupy 4 i 5 rozpadają się
na „z narzędziami" i „bez narzędzi", które w kolejności rejestru **nie są ciągłe** (w, w, own, own
dwa razy). Wymaga: sortowania listy po grupie (wzorem `PROBLEM_CONDITIONS`), skrócenia ogona etykiety
(„… w widoku z narzędziami" powtarzałby nagłówek) i — w konsekwencji — falsyfikuje komentarz
asercji w `active-filters-model.test.ts` („kolejność, której używa menu „Filtry""), bo chipy czytają
rejestr wprost. Trzy z pięciu nazw kategorii duplikowałyby się z „Problemami" co do słowa.

**Wariant B — grupowanie po osi** (przedmiar / wykonana praca / rabat / źródło stawki / sufit stawki /
komentarz): **już dziś ciągłe w rejestrze**. Zero przestawiania, zero sortowania, kolejność menu i
chipów nadal ta sama, a ogon „… w widoku z narzędziami" **zostaje** (nagłówek nie nazywa
płaszczyzny, więc etykieta musi) — czyli żadnego dotykania reguły skracania z 2026-09-21 i żadnego
ryzyka dla chipów ani pustego stanu.

Uwaga do skracania, gdyby jednak padło na A: reguła z commita `7af9945b` jest **warunkowa** i wprost
wymienia „menu Filtry, pusty stan" jako miejsca bez nagłówka, gdzie ogon zostaje. `active-filters-model.ts`
(chipy) i `engagedHiders`/`listLabels` (pusty stan) czytają `condition.label` **wprost**, z założeniem,
że jest nieskrócona — więc skracanie musi wylądować w modelu menu, **nigdy w rejestrze**.

**Technologia menu to osobna decyzja.** „Filtry"/„Sekcje" stoją na `FilterMultiSelect` (Popover +
cmdk, role `option`), a `toggles` jest **płaską** tablicą renderowaną w **jednej** `CommandGroup`
(`src/components/filters/filter-multi-select.tsx:304-329`) — nie ma dziś wsparcia dla grup per
wiersz. „Problemy" stoją na Radix `DropdownMenu` + `DropdownCheckGroups` (role `menuitemcheckbox`),
gdzie nagłówek powstaje tam, gdzie zmienia się `groupLabel` — czyli lista musi już przyjść posortowana.
Albo rozszerzamy `FilterMultiSelect` o `groupLabel`, albo przepinamy menu na `DropdownCheckGroups`;
to drugie zmienia role DOM i rozwala wszystkie asercje istniejącego spec-a.

### 4. Warsztat szablonu — przełącznik nie jest bezczynny

**Co jest niezmienne względem widoku:** `WORKSHOP_VISIBLE_COLUMNS` jest listą zamkniętą działającą
naraz jako sufit i podłoga — `selectV2Columns` wraca z niej **przed** bramką przedmiaru, osią i
warstwą. Kolumny, etykiety, picker, oś i warstwa w warsztacie faktycznie nie zależą od widoku.
Panel podsumowania ma własny, globalny klucz i jest tu bez znaczenia.

**Co się jednak rusza:**

1. **Klucz sortowania.** `src/lib/kosztorys/sort-value.ts:86-87` — `case 'price': return viewPrice(row, view)`.
   Goła kolumna „Cena j.m." jest w `WORKSHOP_VISIBLE_COLUMNS` i jest sortowalna, a `reconcileSort` jej
   nie czyści. Na płaszczyźnie wykonawcy warsztat **sortuje po stawce wykonawcy, wyświetlając cenę
   klienta**. To dzisiejsza usterka, niezależna od tej zmiany — i przypięcie warsztatu do „Inwestor"
   ją przy okazji zamyka.
2. **Lista „Filtry"** — dokładnie to, co punkt 1 usuwa.

**Pułapka, która przesądza o kształcie punktu 4:** `pickView` (`hooks/use-kosztorys-view-state.ts:73`)
jest **jedynym** zapisującym klucz `kosztorys-view:<mirrorId>` (`hooks/use-price-view.ts:12-13`) i
jest osiągalny wyłącznie z tego przycisku. Samo `{!isWorkshop && …}` na przycisku **zostawia na
zawsze** na płaszczyźnie wykonawcy każdą przeglądarkę, która kiedykolwiek go tam przestawiła — bez
żadnej kontrolki, żeby wrócić. Właściciel testował warsztat, więc to nie jest przypadek teoretyczny.

Kształt, który to zamyka, bez zabijania nakładki z „Problemów": widok efektywny liczy się dziś jako
`preview ? 'client' : (problemPlane ?? persistedView)` (`use-kosztorys-view-state.ts:49`) — przypięciu
podlega **`persistedView`**, nie całe wyrażenie. „Problemy" **są** renderowane w warsztacie i cztery
diagnostyki niosą tam płaszczyznę, więc wybór usterki nadal przełoży widok na jej płaszczyznę; to
ulotna nakładka (wycofywana odznaczeniem usterki, X-em na chipie albo „Zresetuj filtry") i ma zostać,
bo to ona prowadzi czytelnika do wady.

**Precedens usunięcia:** `{!isWorkshop && <KosztorysViewMenu />}`
(`toolbar/kosztorys-editor-toolbar.tsx:105`) — dokładnie ten wzór. Sam przełącznik stoi wyżej,
bezwarunkowo (`:43-48`, `aria-label="Widok cen"`).

**Komentarz do poprawienia w tej samej zmianie:** 2026-09-23 (`e0158cb8`) wylądował w
`kosztorys-v2-columns.tsx:97-104` komentarz „przełącznik płaszczyzny działa tam jak wszędzie, tylko
szablon otwiera się na 'client'". Po tej zmianie staje się nieprawdą — a to już drugie podejście do
tego samego komentarza (EX-820 zapisał poprzednią wersję jako dryf).

### 5. Powierzchnia testowa

- **`kosztorys-filters-menu.test.tsx`** — jedyny spec dotykający `offeredFilterConditions` (pośrednio).
  **Wszystkie cztery testy padają:** dwa dlatego, że podają `conditionCounts: new Map()` (czyli każdy
  niezaangażowany filtr ma 0), jeden dlatego, że wprost sprawdza nieobecność filtrów drugiej
  płaszczyzny, wszystkie — gdyby zmienić role DOM menu.
- **`queries.test.ts`** nigdy nie importuje `offeredFilterConditions` — to tam należą nowe testy
  jednostkowe bramek.
- **`registry.test.ts`** trzyma niezmienniki filtrów — tam należy „każdy filtr nazywa kategorię",
  jeśli dodamy pole kategorii.
- **`kosztorys-editor-toolbar.test.tsx`** trzeba **rozszerzyć** o punkt 4, który **nie ma dziś żadnego
  pokrycia**. Wzór jeden do jednego: `kosztorys-actions-menu.test.tsx` → „w warsztacie nie oferuje
  inwestora".
- **`active-filters-model.test.ts`** asercjuje kolejność rejestru jako „kolejność, której używa menu
  „Filtry"" — wariant A z §3 falsyfikuje ten komentarz, wariant B go zachowuje.
- **Żaden spec E2E nie dotyka niczego z tego.**

Kształt rekomendowany: czysty `filters-menu-model.ts` + spec, lustrzanie do `problems-menu-model.ts` —
grupowanie, próg licznika i wyjątek dla zaangażowanego dają się wtedy przetestować bez renderowania.

## Code References

- `src/lib/kosztorys/row-conditions/queries.ts:185-211` — `offeredFilterConditions`, obie bramki i ich uzasadnienie w komentarzu
- `src/lib/kosztorys/row-conditions/registry.ts:99-248` — 16 filtrów w kolejności; osie ciągłe, płaszczyzny nie
- `src/lib/kosztorys/row-conditions/types.ts` — `problemGroup` jest „tylko dla diagnostyk"; filtry nie mają pola kategorii
- `src/lib/kosztorys/problem-groups.ts` — pięć kategorii „Problemów", trzy kolidowałyby nazwą
- `src/components/kosztorys/editor/toolbar/menus/use-kosztorys-filter-menu.ts:24-46` — jedyny konsument; zakres zamiatania = lista oferowana
- `src/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.tsx` — płaska lista, jeden nagłówek, brak progu licznika
- `src/components/kosztorys/editor/toolbar/menus/problems-menu-model.ts` — wzór progu `count > 0 || engaged` i `groupLabel` per wiersz
- `src/components/filters/filter-multi-select.tsx:304-329` — `toggles` renderowane w jednej `CommandGroup`, bez grupowania
- `src/components/ui/dropdown-check-groups.tsx` — nagłówek tam, gdzie zmienia się `groupLabel`; wymaga posortowanej listy
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:416-435` — liczniki po wszystkich 30 warunkach, `view` poza zależnościami
- `src/components/kosztorys/editor/hooks/use-engaged-conditions.ts` — localStorage `kosztorys-filters:<id>`, bez czyszczenia przy zmianie widoku
- `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts:45-49,73` — `view = preview ? 'client' : (problemPlane ?? persistedView)`; `pickView` jedynym zapisującym
- `src/components/kosztorys/editor/hooks/use-price-view.ts:12-13` — klucz `kosztorys-view:<investmentId>`
- `src/lib/kosztorys/sort-value.ts:86-87` — `case 'price'` czyta `viewPrice(row, view)`
- `src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx:43-48,105` — przełącznik bezwarunkowo; precedens `{!isWorkshop && …}`
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:97-104` — komentarz z 2026-09-23, do poprawienia w tej samej zmianie

## Architecture Insights

- **Dwie technologie menu w jednym pasku narzędzi** to dług, który ta zmiana wystawia na wierzch:
  „Filtry"/„Sekcje" na cmdk (role `option`), „Problemy" na Radix (role `menuitemcheckbox`). Prośba
  „jak pozostałe dropdowny" da się spełnić w obu — ale tylko jedna droga nie rusza istniejących
  asercji DOM.
- **Bramka jako ergonomia, nie jako niezmiennik.** Bramka widoku nigdy nie chroniła spójności stanu
  (localStorage ją omija); pilnowała długości listy. Kasując ją, trzeba przejąć jej prawdziwe zadanie —
  i to robi próg licznika.
- **Lista jako raport.** „Problemy" dawno przyjęły, że lista opisuje to, co w rozpisce **jest**.
  Punkt 2 rozciąga tę zasadę na filtry; wyjątek dla zaangażowanego jest w obu miejscach tą samą
  regułą — nie zabieramy wyłącznika, dopóki zawężenie trzyma siatkę obciętą.
- **Kolumny warsztatu są niezmienne, ale pochodne widoku — nie.** „Lista kolumn jest zamknięta" nie
  znaczy „widok nic nie robi": sortowanie czyta `view` poza zestawem kolumn. Zamknięty zestaw kolumn
  to argument za przypięciem płaszczyzny, nie dowód, że przypinać nie trzeba.

## Historical Context (from prior changes)

- `context/changes/2026-09-22-stawka-problems-and-filters/change.md` (EX-820) — nowa para filtrów jest
  **celowo** związana z widokiem (:68-72); menu ucina ogon „w widoku …", chip go zachowuje (:57-63);
  dryf komentarza o warsztacie zapisany jako dryf (:93-95). Punkt 1 odwraca pierwsze z tych trzech
  rozstrzygnięć — świadomie, decyzją właściciela z 2026-09-23.
- **EX-714, commit `acf21753` (2026-08-18)** — bramka widoku powstała po to, żeby lista nie urosła
  z 4 wierszy do 12: „w najgorszym razie 10 wierszy w widoku ekipy, 8 w «Inwestor»". To jest
  uzasadnienie, które punkt 2 musi przejąć.
- **Commit `7af9945b` (2026-09-21)** — reguła skracania ogona etykiety jest warunkowa i wprost
  wyłącza „menu Filtry, pusty stan".
- **Rozstrzygnięcie z 2026-08-17** — „liczniki obu planów zostają niezależne od widoku"; dotyczy
  **usterek**, nie filtrów.
- `context/changes/2026-09-22-szablon-autosave/review-gate.md` — stąd wypadła rozmowa o tym, co
  właściwie robi przełącznik widoku w warsztacie.

## Related Research

Brak wcześniejszego `research.md` dla tego menu — EX-714 i EX-820 są udokumentowane wyłącznie
w `change.md` i historii gita.

## Open Questions

Trzy rzeczy, których kod nie rozstrzygnie — są dla właściciela:

1. **Nazwy kategorii.** Wariant B (osie: przedmiar / wykonana praca / rabat / źródło stawki /
   sufit stawki / komentarz) jest ciągły w rejestrze i nic nie psuje — **to jest rekomendacja**.
   Wariant A (płaszczyzny, jak w „Problemach") powiela trzy nazwy co do słowa i pociąga sortowanie,
   skracanie etykiet oraz rozjazd z kolejnością chipów.
2. **Para przy zerze.** Czy filtr znika pojedynczo (może zostać „z przedmiarem" bez „bez przedmiaru"),
   czy para chowa się w całości? Pojedynczo jest tańsze i bardziej zgodne z „Problemami"; para jest
   zgodniejsza z zasadą „filtry chodzą parami dopełniającymi".
3. **Sortowanie w warsztacie.** Przypięcie płaszczyzny do „Inwestor" zamyka przy okazji dzisiejszą
   usterkę — sortowanie „Cena j.m." po stawce wykonawcy przy wyświetlanej cenie klienta. Warto
   potwierdzić, że to pożądany efekt uboczny, a nie osobna zmiana.
