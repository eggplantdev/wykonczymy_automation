# Rozjazdy z katalogiem prac jako problemy — skrót planu

> Pełny plan: `context/changes/2026-09-21-katalog-problems/plan.md`
> Research: `context/changes/2026-09-21-katalog-problems/research.md`

## Co i po co

Dwie kategorie z okna „Porównaj z katalogiem prac" — „Inne liczby niż w katalogu" i „Brak
w katalogu" — trafiają do listy „Problemy" edytora, więc widać je bez otwierania czegokolwiek,
a z okna da się jednym kliknięciem zawęzić rozpiskę do każdej z nich. Dziś rozjazd z cennikiem jest
widoczny tylko dla kogoś, kto sam z siebie otworzy okno.

## Punkt wyjścia

Porównanie liczy czysta funkcja `buildCatalogueComparison`, wołana z akcji serwerowej na kliknięcie.
Lista „Problemy" wyprowadza się automatycznie z wpisów `kind: 'diagnostic'` w rejestrze warunków
wiersza, a fakty grupowe (jak „ta sama praca wyceniona różnie") wstrzykuje się przez
`RowConditionCtxT`. Obie maszyny istnieją — brakuje połączenia.

## Stan docelowy

Menu „Problemy" pokazuje dwa nowe wiersze z prawdziwymi liczbami przy wejściu na kosztorys. Wybór
wiersza zawęża rozpiskę i — przy rozjeździe liczb — odsłania kolumny cenowe. Poprawienie ceny
zmniejsza licznik natychmiast, bez zapisu i bez przeładowania. Okno pokazuje te same liczby, bo czyta
to samo porównanie.

## Podjęte decyzje

| Decyzja                          | Wybór                               | Dlaczego                                                                            | Źródło          |
| -------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- | --------------- |
| Liczenie                         | W przeglądarce, przy każdej zmianie | Licznik ma być prawdziwy przy wejściu i topnieć w trakcie poprawiania               | Rozmowa         |
| Liczba wpisów                    | Dwa osobne                          | Różnią się tym, co mają pokazać: ceny vs nic                                        | Plan            |
| Rzeczownik                       | Zdanie z „pracami" (`problemLabel`) | Zgodność z oknem bez ruszania `counted-nouns.ts`                                    | Research → Plan |
| Powierzchnie                     | Kosztorysy inwestycji + szablony    | Stary szablon to właśnie miejsce, gdzie ceny się starzeją; podglądy zerują liczniki | Plan            |
| Podpowiedź „może chodzi o…"      | Leniwa, przy otwarciu okna          | 401 ms przy 42 sondach, 10.7 s przy 400 — nie może biec przy klawiszu               | Research        |
| Raportowanie 3× jednej różnicy   | Naprawiamy w tej zmianie            | Licznik i okno staną obok siebie, więc zawyżka stanie się widoczna                  | Plan            |
| Źródło dla okna                  | To samo porównanie z pamięci        | Dwie liczby nie mogą się rozjechać, bo są jedną liczbą                              | Plan            |
| Świeżość po dopisaniu do cennika | `router.refresh()`                  | Tag cennika już unieważniany, `rows` to ziarno zamrożone przy montowaniu            | Plan            |

## Zakres

**W zakresie:** silnik porównania (podpowiedź na bok, błąd 3× naprawiony), katalog jako prop na dwóch
edytowalnych powierzchniach, dwa wpisy diagnostyczne + memo, okno na jednym źródle z dwoma przyciskami
zawężenia, kasacja serwerowej akcji porównania.

**Poza zakresem:** podglądy (klient, inwestor), zmiana globalnego rzeczownika, trzeci zbiorczy problem,
to co okno zapisuje do cennika, E2E.

## Podejście

Sprowadzić porównanie do kształtu, w którym działa reszta problemów: synchroniczny predykat na
wierszu, karmiony faktem grupowym z `RowConditionCtxT`. Koszt dzieli się wzdłuż jednej linii —
klasyfikacja jest O(pozycje) i należy do memo, podpowiedź jest O(pozycje × katalog) i należy do okna.

## Fazy

| Faza                 | Co dowozi                                                      | Główne ryzyko                                           |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| 1. Silnik            | Podpowiedź wydzielona, cache klucza, koniec z raportowaniem 3× | Zmiana liczb, które właściciel już widział w oknie      |
| 2. Katalog na drucie | Cennik jako prop edytora na dwóch powierzchniach               | Przypadkowe dowiezienie go na podglądy                  |
| 3. Problemy          | Memo + dwa wpisy w rejestrze, licznik żyje                     | Budżet ~2 ms; kompilator tu cicho odpuszcza             |
| 4. Okno              | Jedno źródło, przyciski „Pokaż w rozpisce", kasacja akcji      | Utrata zachowania okna przy kasowaniu działającego kodu |

**Warunki wstępne:** brak — wszystko na miejscu.
**Szacunek:** ~2 sesje, cztery fazy, każda zostawia drzewo działające.

## Otwarte ryzyka i założenia

- Reguła „zaangażowany problem zostaje na liście przy zerze" nigdy nie była oglądana pod licznikiem,
  który topnieje na żywo — zachowanie jest zdefiniowane, ale nieprzetestowane wzrokiem.
- Menu jest wyborem wyłącznym, więc obu kategorii nie da się zobaczyć naraz. Świadome.
- Zmiana nie należy do żadnego slice'a w roadmapie; ryzyko dopisujemy do `test-plan.md` w fazie 1.

## Kryteria sukcesu

- Licznik jest prawdziwy przy wejściu na kosztorys i zgadza się co do jedności z oknem, także przy
  niezapisanych zmianach.
- Poprawienie ceny albo dopisanie pracy do cennika zmniejsza licznik natychmiast.
- „Pokaż w rozpisce" z okna zawęża rozpiskę do właściwego zbioru.
