---
date: 2026-09-21T11:25:58+02:00
researcher: Konrad Antonik
git_commit: b092c0028e2f29e26beca8bb6af0c0ac0006919a
branch: staging
repository: wykonczymy
topic: "Rozjazdy z katalogiem prac jako problemy w edytorze kosztorysu (wariant „na żywo")"
tags: [research, codebase, kosztorys, row-conditions, work-catalogue, perf]
status: complete
last_updated: 2026-09-21
last_updated_by: Konrad Antonik
---

# Research: rozjazdy z katalogiem prac jako problemy w edytorze

**Date**: 2026-09-21T11:25:58+02:00
**Researcher**: Konrad Antonik
**Git Commit**: b092c0028e2f29e26beca8bb6af0c0ac0006919a
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Wpiąć dwie kategorie z okna „Porównaj z katalogiem prac" — „Inne liczby niż w katalogu" i „Brak
w katalogu" — w listę Problemów edytora, tak żeby dało się je pokazać i odfiltrować w rozpisce.
Wariant **„na żywo"**: cennik dociągany razem z rozpiską, porównanie liczone w przeglądarce, żeby
licznik był prawdziwy przy wejściu na stronę i topniał w miarę poprawiania cen.

## Summary

Nie ma blokera architektonicznego. Silnik porównania (`build-catalogue-comparison.ts`) jest czysty
i client-safe, `KosztorysV2RowT` jest strukturalnym nadzbiorem `CatalogueComparisonItemT`, a rejestr
warunków wierszy ma gotowy precedens w `divergent-client-price` (ta sama grupa-po-`catalogueKey`,
ten sam `tone: 'worklist'`, to samo `revealsColumns`). Robota to: szósty fetch na stronie edytora,
nowe pole w `RowConditionCtxT`, dwa wpisy `kind: 'diagnostic'` w rejestrze i zaczep filtra w oknie.

Dwie rzeczy zmierzone, nie założone, i one kształtują plan:

1. **Klasyfikacja jest tania, podpowiedź jest droga.** `foldDescription` ×1000 = 10.8 ms, a
   największy realny kosztorys ma 379 pozycji / 198 różnych par (opis, j.m.) — z cache
   `Map<opis|j.m. → klucz>` to po rozgrzaniu ~0 ms. Za to wyszukiwanie „może chodzi o…"
   (dice po bigramach, 843 wpisy katalogu) kosztuje **401 ms przy 42 sondach, 10.7 s przy 400**.
   Podpowiedź **musi zostać leniwa** (liczona przy otwarciu okna), inaczej każde naciśnięcie
   klawisza zamraża edytor.
2. **Katalog na drucie waży niedużo.** 843 wiersze: pełne obiekty 233 663 B (33 887 B gz), minimalne
   4-polowe obiekty 123 502 B, krotki 62 059 B (16 463 B gz). Minimalny obiekt wystarczy — nie ma
   powodu wymyślać formatu krotkowego.

Największe ryzyko nie jest wydajnościowe, tylko semantyczne: **okno i licznik porównywałyby dwa różne
zbiory danych** (okno — drzewo zapisane na serwerze, licznik — wiersze w pamięci, w tym niezapisane),
a **liczą w dwóch różnych jednostkach** („63 prace — 156 różnic" vs „Pozycje…" w Problemach).

## Detailed Findings

### Rejestr warunków — co musi tknąć nowy wpis

- `src/lib/kosztorys/row-conditions/registry.ts` — 22 wpisy (12 filter / 1 client / 9 diagnostic).
  Wzorzec do skopiowania to `divergent-client-price`: `kind: 'diagnostic'`, `tone: 'worklist'`,
  `problemLabel` jako zdanie, `revealsColumns: ALL_PRICE_COLUMNS`, `matches` czytające zbiór id
  z ctx.
- `sectionLabel: null` dla diagnostyki jest **wymuszone testem** (`registry.test.ts:176-181`) — nie
  da się przemycić etykiety sekcji.
- `src/lib/kosztorys/problem-conditions.ts` wyprowadza `ROW_PROBLEMS` z `kind === 'diagnostic'`
  automatycznie; `problems-menu-model` i `active-filters-model` też podłapią nowy wpis bez zmian.
- Nowe pole w `RowConditionCtxT` (`row-conditions/types.ts`): **wymagane** psuje sześć literałów ctx
  w testach, **opcjonalne** cicho wyłącza diagnostykę tam, gdzie go nie podano. Wybór świadomy, nie
  przez przypadek.
- Zaangażowane id problemów siedzą w `localStorage` pod `kosztorys-filters:<investmentId>`
  i **nieznane id nigdy nie są czyszczone** — wpis, który kiedyś zniknie, zostawi śmiecia w kluczu.
- Żaden E2E nie dotyka menu Problemów.

### Płaszczyzna katalogu — czysto, ale trzy decyzje do podjęcia

- `buildCatalogueComparison` i `catalogueKey`/`foldDescription` nie mają zależności serwerowych;
  `CATALOGUE_NAME_FIXES` już jedzie w bundlu klienta.
- `KosztorysV2RowT` ma wszystkie pola `CatalogueComparisonItemT` — konwersja jest tożsamością.
- **Współczynniki** (`wToolsCoeff` / `ownToolsCoeff`) trzeba brać z ustawień kosztorysu w pamięci,
  nie z serwerowego snapshotu — właściciel zmienia je w trakcie sesji i licznik ma to widzieć.
- `matchKey` zostaje na drucie (jest kolumną UNIQUE, nie liczymy go po stronie klienta dla katalogu).
- `refreshComparison` po zapisie wpisu do cennika można zastąpić refetchem samego katalogu na
  istniejącym zaczepie `onSaved` (`catalogue-compare-dialog.tsx:150`).

### Przepływ danych i wydajność

- Prop wchodzi przez `KosztorysEditorDataT` (`src/lib/kosztorys/types.ts:134-173`); fetch dokłada się
  do wachlarza pięciu na `kosztorys_v2/page.tsx`, plus `szablony/[id]`.
- **Dwie powierzchnie podglądowe** (`(share)/k/[token]`, `(share)/podglad-inwestora/[id]`) nie powinny
  wozić katalogu w ogóle — `preview` i tak zeruje każdy licznik.
- React Compiler **cicho odpuszcza** w `use-kosztorys-editor.ts` (historia EX-496), więc nowe memo
  trzeba napisać ręcznie i pilnować zależności. Budżet: ~2 ms z ~5 ms, które te memo zjadają na 1000
  pozycji przy każdym zatwierdzonym klawiszu (`use-kosztorys-editor.ts:361,368`).
- Nie ma żadnego strażnika regresji wydajności dla tych memo.

### Rozjazdy nazewnicze i liczbowe (największe ryzyko)

- **Rzeczownik.** Okno mówi „prace" (`counted-nouns.ts:6`, komentarz wprost: „5 prac" nigdy nie ma
  zostać „5 pozycji" ekran dalej), a lista Problemów mówi „Pozycje". Ta sama liczba, dwa słowa — to
  blizna EX-761 w lustrzanym odbiciu.
- **Jednostka liczenia.** Okno pokazuje **dwie** liczby („63 prace — 156 różnic"), bo jedna praca
  potrafi różnić się na trzech liczbach (`catalogue-compare-dialog.tsx:58,72-74`). Problem w menu ma
  **jedną** liczbę i musi to być liczba **prac**, nie różnic.
- **Zbiór wejściowy.** Okno porównuje drzewo zapisane na serwerze; licznik porównywałby wiersze
  w pamięci, razem z niezapisanymi. Przy otwartym oknie obie liczby będą chwilami różne.
- **Zaparkowany błąd, który licznik uwidoczni.** Zweryfikowane w kodzie
  (`build-catalogue-comparison.ts:88-106`): gdy obie stawki są „auto", są wyprowadzane jako
  `cena × współczynnik` po obu stronach, więc **jedna** różnica ceny j.m. raportuje się jako **trzy**
  różnice i zawyża `figureCount` oraz `maxDelta`. Licznik prac tego nie dziedziczy (liczy prace),
  ale gdy okno i menu staną obok siebie, rozjazd będzie widoczny.
- **„Zaangażowany problem zostaje na liście przy zerze"** — ta reguła zderza się z licznikiem, który
  ma na żywo topnieć do zera w trakcie poprawiania cen. Zachowanie jest zdefiniowane, ale nigdy nie
  było oglądane pod topniejącym licznikiem.

## Code References

- `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts:68-126` — silnik porównania;
  `:88-106` potrójne raportowanie przy obu stawkach „auto"
- `src/lib/kosztorys/row-conditions/registry.ts` — `divergent-client-price` jako wzorzec
- `src/lib/kosztorys/row-conditions/types.ts` — `RowConditionCtxT`; `tone` nie ma dziś konsumenta
- `src/lib/kosztorys/problem-conditions.ts` — wyprowadzenie `ROW_PROBLEMS` z diagnostyki
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:361,368,375-380,478-483,508-513,542-545`
  — feeder-memo i cztery miejsca budowy ctx
- `src/components/kosztorys/editor/dialogs/catalogue-compare-dialog.tsx:57-58,72-77,150` — dwie
  liczby w nagłówku foldu, zaczep `onSaved`
- `src/components/kosztorys/editor/actions/catalogue-compare-action.tsx` — fetch-on-click (Radix nie
  wystrzeli `onOpenChange` przy programowym otwarciu)
- `src/lib/kosztorys/counted-nouns.ts:6` — `itemNoun` = „praca/prace/prac"
- `src/lib/kosztorys/types.ts:134-173` — `KosztorysEditorDataT`, punkt wejścia propa
- `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx` — wachlarz fetchy

## Architecture Insights

- **Problemy są synchronicznymi predykatami na wierszu; porównanie z katalogiem było akcją
  serwerową na żądanie.** Wariant „na żywo" to właśnie sprowadzenie drugiego do pierwszego —
  fakt grupowy wstrzykiwany „piętro wyżej" przez `RowConditionCtxT`, dokładnie jak
  `divergentPriceRowIds`.
- **Podział kosztu przebiega wzdłuż jednej linii: klasyfikacja jest O(pozycje), podpowiedź jest
  O(pozycje × katalog).** Pierwsza należy do memo, druga do okna. Jeśli plan tego nie rozdzieli,
  zabije edytor.
- Najtańsza warstwa wygrywa: cały silnik jest już React-free w `src/lib/kosztorys/`, więc testuje się
  go bez renderowania czegokolwiek.

## Historical Context (from prior changes)

- EX-496 — przeniesienie stanu do `KosztorysEditorProvider` jako regresja wydajności, cofnięte;
  stąd zakaz dokładania czegokolwiek do providera i ostrożność z memo.
- EX-761 — blizna od rozjazdu rzeczowników w licznikach edytora; `counted-nouns.ts` powstało po to.
- EX-489 — pomiar IS suma etapów; źródło wzorca „fakt grupowy w ctx".
- `context/changes/2026-09-20-subcontractor-ceiling-warn/` — ostatnia zmiana w `registry.ts`
  (commit `078930d3`), już scommitowana; kolizji w drzewie roboczym nie ma.

## Related Research

Brak wcześniejszego `research.md` dotykającego warstwy katalogu prac.

## Open Questions

1. **Jeden problem czy dwa?** „Inne liczby niż w katalogu" i „Brak w katalogu" to dwa różne
   zachowania (pierwszy ma co ujawnić kolumnami, drugi nie) — menu jest jednak wyborem wyłącznym,
   więc dwa wpisy znaczą, że nie da się zobaczyć obu naraz.
2. **Który rzeczownik wygrywa** — Problemy przechodzą na „prace", czy okno na „pozycje"? Zmiana
   `counted-nouns.ts` promienieje na wszystkie raporty edytora.
3. **Czy naprawiamy potrójne raportowanie teraz**, czy zostawiamy zaparkowane (osobny finding,
   dotyka tylko okna).
4. **Czy szablony (`szablony/[id]`) też dostają licznik**, czy tylko kosztorysy inwestycji.
5. Ta zmiana nie należy do żadnego slice'a w `roadmap.md`, a `test-plan.md` nie nazywa pokrywającego
   ryzyka — `/10x-test-plan` jest należne przed testami.
