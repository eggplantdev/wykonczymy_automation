# Hurtowa aktualizacja rozpiski z katalogu prac — Plan Brief

> Pełny plan: `context/changes/2026-09-21-catalogue-compare-bulk-update/plan.md`
> Research: `context/changes/2026-09-21-catalogue-compare-bulk-update/research.md`

## What & Why

Okno „Porównaj z katalogiem prac" pokazuje, gdzie rozpiska rozjeżdża się z cennikiem, ale pisać umie
tylko **do cennika**. Właściciel potrzebuje kierunku odwrotnego: zaznaczyć różnice i jednym
kliknięciem wciągnąć liczby z katalogu do rozpiski. Przy okazji raport przestaje kłamać w dwóch
miejscach — pokazuje dwie identyczne kwoty z niezerową różnicą, i zamienia katalogowe „auto" w
wyliczoną złotówkę, której w katalogu nie ma.

## Starting Point

`buildCatalogueComparison` klasyfikuje pozycje na zgodne / rozjechane / brakujące i karmi jednocześnie
liczniki „Problemy" i okno raportu. Kwoty porównuje progiem `MONEY_TOLERANCE = 0.005`, równym połowie
grosza — więc różnica dokładnie pół grosza przechodzi lub nie zależnie od resztki bitowej. Katalogowe
„auto" (`null` na płaszczyźnie, 125 z 568 wpisów) jest przeliczane na kwotę przed porównaniem.
Różnice renderują się płaską listą na komponentach współdzielonych z trzema oknami arkusza. „Może
chodzi o" to jeden najbliższy opis, wyłącznie do czytania.

## Desired End State

Właściciel zaznacza pojedyncze liczby albo całe prace (albo wszystko), klika „Aktualizuj kosztorys
(N)", a liczby wjeżdżają do rozpiski — okno zostaje otwarte, zaktualizowane wiersze znikają, licznik
maleje, w „Wersjach" leży automatyczna kopia sprzed zapisu. Kolumny mówią „auto" tam, gdzie kwoty
nie ma, i rozjazdem jest także sama różnica rodzaju. Prace spoza katalogu dostają do trzech
kandydatów z ceną i j.m.; kliknięcie przepisuje pracy opis i j.m., po czym praca trafia do bloku
różnic, gdzie osobno bierze się jej ceny.

## Key Decisions Made

| Decyzja                 | Wybór                                                                    | Dlaczego                                                                                                                                                          | Źródło   |
| ----------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Zakres                  | Trzy kawałki w jednej zmianie                                            | Właściciel nadpisał rekomendację rozbicia — chce to zobaczyć i przetestować w całości                                                                             | Plan     |
| Próg porównania         | `roundToCents` po obu stronach                                           | Raport ma porównywać to, co wyświetla; wzorzec już w repo (`reconciliation.ts:36-40`)                                                                             | Research |
| Katalogowe „auto"       | Słowo „auto" w kolumnie, nie kwota                                       | Właściciel: „jeśli aktualizuję cenami, które są auto w katalogu, to potrzebuję tu mieć auto"                                                                      | Plan     |
| Rodzaj jako rozjazd     | Zamrożona kwota ↔ „auto" to różnica, w obie strony; `auto ↔ auto` milczy | Rozjazd bywa różnicą rodzaju, nie tylko kwoty; auto↔auto to ta sama cena w trzech kapeluszach                                                                     | Plan     |
| Kolumna „Różnica"       | Kwotowa, ale wyszarzona przy „auto"                                      | Przy 40 pracach naraz musi być widać, ile pieniędzy się rusza                                                                                                     | Plan     |
| Ziarnistość zaznaczania | Checkbox na każdej liczbie **i** na pracy                                | Właściciel nadpisał rekomendację „tylko per praca"                                                                                                                | Plan     |
| Tabela                  | Własna, nie wspólny `ComparisonTable`                                    | Kolumna checkboxów złamałaby wyrównanie w trzech oknach arkusza, które z tym nie mają nic wspólnego                                                               | Plan     |
| Po zapisie              | Okno zostaje, wiersze znikają                                            | Raport to memo z `rows` w zależnościach, więc przelicza się w tym samym renderze                                                                                  | Research |
| Potwierdzenie           | Licznik na przycisku + automatyczna wersja, bez okna                     | Przy pracy partiami okno potwierdzenia staje się odruchem, który niczego nie chroni                                                                               | Plan     |
| Sufit 65 %              | Przed zapisem, przy wierszu, liczony z wiersza scalonego                 | Hurtowe zaznaczanie znaczy, że nikt nie obejrzy każdej pracy osobno                                                                                               | Plan     |
| Drut                    | `{ itemId, fields }` — same id i nazwy pól                               | Reguła z `insertCatalogueItemsAction`, ale też poprawność: serwer **odtwarza klucz**, więc nieaktualne okno kończy się komunikatem, nie ceną z niewłaściwej pracy | Research |
| Podpowiedzi             | Do trzech kandydatów + „inny…"                                           | Co czwarta podpowiedź ma rywala w promieniu 0,05; punktacja i tak liczy wszystkie, więc top-3 jest darmowe                                                        | Research |
| Przyjęcie nazwy         | Zapis od razu, per praca                                                 | „To ta sama praca" i „chcę te ceny" to dwie decyzje; efekt pierwszej widać, zanim zapada druga                                                                    | Plan     |

## Scope

**W zakresie:** próg porównania w groszach · „auto" jako rodzaj różnicy w modelu i w renderze ·
akcja hurtowego zapisu z automatyczną wersją · własna tabela zaznaczania z trójstanem i sufitem
65 % · top-3 kandydatów z możliwością przyjęcia opisu i j.m.

**Poza zakresem:** wspólne komponenty `sheet-report-parts.tsx` (trzy okna arkusza nietknięte) ·
`investments.updated_at` (token remountu edytora) · transakcja wokół migawki i zapisu (migawka idzie
przez cache'owaną warstwę odczytu, więc byłaby fałszywym komfortem) · okno potwierdzenia ·
wyciszanie `auto ↔ auto` · `match_key` po stronie rozpiski · rozłączenie pozycji od bliźniaka w
arkuszu po zmianie opisu (skutek uboczny do zakomunikowania, nie do naprawy tutaj).

## Architecture / Approach

Trzy warstwy, każda w swoim domu. **Model** (`build-catalogue-comparison.ts` + `types.ts`) uczy się
rodzaju liczby i porównuje w groszach — to on karmi zarówno liczniki „Problemy", jak i okno, więc nie
mogą się rozjechać. **Zapis** (`lib/db/kosztorys-catalogue-apply.ts` + akcja w
`lib/actions/work-catalogue.ts`) bierze z drutu wyłącznie id pozycji i nazwy pól, odtwarza klucz
serwerowo, robi migawkę i zapisuje trzema paczkowymi `UPDATE`-ami — trzy statementy niezależnie od
tego, czy zaznaczono jedną pozycję czy tysiąc. **Widok** (nowa tabela + nazwany handler w
`use-kosztorys-editor.ts`) łata siatkę przez `patchRows`, nigdy przez `router.refresh()` ani remount:
`rows` są zasiewane raz przy montażu, więc refresh niczego nie przesieje, a remount skasowałby
sortowanie i filtry.

## Phases at a Glance

| Faza                     | Co dowozi                                       | Główne ryzyko                                                                                                           |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1. Próg w groszach       | Raport porównuje to, co wyświetla               | Znika 13 z 3794 wierszy — trzeba potwierdzić, że to te właściwe, a nie wyłączone porównanie                             |
| 2. „auto" jako rodzaj    | Kolumny mówią „auto"; rozjazd rodzaju zgłaszany | Licznik „Problemy" **urośnie** o wiersze „zamrożona ↔ auto o tej samej kwocie" — zamierzone, ale wygląda jak regresja   |
| 3. Zapis serwerowy       | Akcja + paczkowy `UPDATE` + migawka             | Beztypowy `NULL` w pierwszym wierszu paczki wywraca całe `UPDATE` — stąd jawne rzutowania i spec DB na mieszanej paczce |
| 4. Tabela zaznaczania    | Checkboxy, trójstan, licznik, sufit 65 %        | Łatanie siatki: pominięcie `prevById` sprawi, że następny autosave cofnie zapis                                         |
| 5. Przyjęcie podpowiedzi | Top-3 kandydatów, zapis opisu i j.m.            | Opis i j.m. muszą trafić w istniejący `match_key` **dokładnie** — inaczej praca nadal jest „brak w katalogu"            |

**Prerekwizyty:** lokalna baza z katalogiem prac (568 wpisów) i inwestycją 151 — obie już są w dumpie.
**Szacowana wielkość:** ~2–3 sesje; fazy 1–2 to jedno posiedzenie, 3–4 drugie, 5 trzecie.

## Open Risks & Assumptions

- Licznik „Problemy" po fazie 2 rośnie. Nie zmierzyłem, o ile — liczba wierszy „zamrożona ↔ auto o
  **tej samej** kwocie" nie była częścią pomiaru, bo dziś te wiersze milczą. Do sprawdzenia przy
  odbiorze fazy 2.
- Wyszukiwarka „inny…" nad całym katalogiem (568 wpisów) to nowa powierzchnia w oknie, które już dziś
  ma najdroższe obliczenie w edytorze. Jeśli okaże się ciężka, pierwszym wyjściem jest odroczenie
  jej z fazy 5, a nie optymalizacja podpowiedzi.
- Zmiana opisu w fazie 5 rozłącza pozycję od bliźniaka w arkuszu przy następnym „Porównaj z
  arkuszem". To trzeba powiedzieć właścicielowi, zanim zacznie masowo przyjmować kandydatów.
- Zmiana jest browser-level, więc jest winna spec E2E — rozstrzyga się przy bramce przeglądu.

## Success Criteria (Summary)

- Raport na inwestycji 151 nie pokazuje już dwóch identycznych kwot z niezerową różnicą, a tam, gdzie
  katalog nie podaje stawki, pokazuje słowo „auto".
- Zaznaczenie wszystkich różnic i jedno kliknięcie zostawia blok „Inne liczby niż w katalogu" pusty,
  bez zamykania okna i bez utraty sortowania w rozpisce — a „Wersje" pozwalają to cofnąć.
- Praca, której w katalogu nie ma pod tą nazwą, daje się jednym kliknięciem przypiąć do właściwego
  wpisu i przechodzi do bloku różnic.
