# Frame Brief: Globalny rabat na kosztorysie (override rabatów per pozycja)

> Krok ramowania przed /10x-plan. Oddziela to, co jest FAKTYCZNIE do zbudowania,
> od tego, co początkowo zakładano.

## Reported Observation

Właściciel chce **jednego rabatu za całość wykonanych prac**, wpisywanego raz na
kosztorys, który **nadpisuje** wszystkie rabaty per pozycja. „Na pewno w większości
przypadków będziemy potrzebować po prostu dodać rabat za całość wykonanych prac"
(2026-07-15). Rabat per pozycja zostaje, ale przestaje być trybem domyślnym.
W arkuszu V1 taki „rabat za całość" **nie istnieje** — arkusz nie jest tu specyfikacją.

## Initial Framing (preserved)

- **User's stated cause or approach**: override, nie warstwa — globalny wyłącza
  rabaty per pozycja; dane per pozycja zostają w bazie (override ≠ kasowanie);
  docelowo „ten sam rabat co transferowy `RABAT`", ale podpięcie teraz nie powstaje.
- **User's proposed direction**: pole rabatu na kosztorysie; transferowy `RABAT`
  docelowo się wycofuje (hipoteza, nie ustalenie).
- **Pre-dispatch narrowing**: właściciel rozwiał całą sekcję „do rozstrzygnięcia
  w framingu" bezpośrednio w rozmowie (patrz Narrowing Signals), więc runda
  pickerów została zastąpiona ustaleniami wprost.

## Dimension Map

Otwarte decyzje, na których siadał kształt zmiany:

1. **Model rabatu** — pole na kosztorysie; jedno- czy dwutrybowy (kwota/procent).
2. **UX override** — co widzi użytkownik, gdy globalny wyłącza rabaty per pozycja.
3. **Rozkład na etapy/sekcje** — czy rabat schodzi proporcjonalnie, czy jest jedną
   kwotą pod sumą całości.
4. **Pułapka marży** — rabat kosztorysowy vs marża liczona z transferów. ← moje
   początkowe czytanie: „rozbieżność do rozwiązania". Właściciel je odrzucił.

## Hypothesis Investigation

| Hipoteza                                                             | Evidence                                                                                                                                                                                                      | Verdict                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Rabat per pozycja jest dwutrybowy — globalny mirroruje ten sam model | `DiscountTypeT='percent'\|'amount'` (`src/types/kosztorys.ts:8`); pola `discountType`/`discountValue` (`:31-32`); `applyDiscount` (`src/lib/kosztorys/calc.ts:17-21`)                                         | STRONG                                   |
| Total kosztorysu ma czysty punkt zaczepienia dla override            | `netForQtyForView` (`calc.ts:60-63`) → `sectionSubtotalsForView` (`v2-rows.ts:387-414`) → `totalNet`/`totalPlannedNet` (`use-kosztorys-editor.ts:177-181`)                                                    | STRONG                                   |
| Kolumny rabatowe da się schować, gdy globalny aktywny                | `buildV2Columns` filtruje przez `isHidden` (`src/lib/tables/kosztorys-v2-columns.tsx:765-775`); kolumny `discountValue`/`discountType`/`discountAmount(Gross)` (`:617-632`); picker `:779-787` też do zdjęcia | STRONG                                   |
| Pułapka: rabat kosztorysowy zawyża marżę (plany rozłączone)          | marża = `totalLaborCosts − totalPayouts − totalRabat − totalLoss − totalSettled` (`src/lib/db/calculate-margin.ts:13-14`), wyłącznie z `transactions`; **zero** przepływu kosztorys→robocizna                 | STRONG (ale poza zakresem — patrz niżej) |
| Istnieje jakieś zszycie kosztorys → robocizna/`LABOR_COST`           | Brak. `LABOR_COST` powstaje tylko ręcznie (`src/lib/actions/transfers.ts:44-52`); hooki kolekcji kosztorysu to tylko rewalidacja cache; grep `transfer\|LABOR\|marża` po `src/lib/kosztorys/` = 0 trafień     | NONE (DISCONNECTED)                      |

## Narrowing Signals

Decyzje właściciela wprost w rozmowie (2026-07-16), które zamknęły mapę:

- **Model rabatu → dwutrybowy.** „Dodajmy analogicznie, czyli to może być kwota,
  to może być procent."
- **UX override → wszystkie kolumny rabatowe chowają się i wyłączają** automatycznie
  po włączeniu globalnego. „Kolumna rabat wtedy się automatycznie chowa i wyłącza…
  wszystkie kolumny rabatowe."
- **Rozkład → żaden.** „Nic się nie rozkłada; to jest po prostu globalny rabat,
  odejmujemy to od totalu i tyle." Nie schodzi na sekcje ani etapy.
- **Pułapka marży → nie jest pułapką dla TEJ zmiany.** Ruling: „wszystkie prace
  z kosztorysu to jest właśnie robocizna" → rabat obniża robociznę, więc siłą rzeczy
  marżę. Że marża na karcie inwestycji nie drgnie od razu wynika **tylko** z tego, że
  kosztorys v2 nie jest dziś podpięty do apki: „to połączenie tymczasowe… tego
  łączenia jeszcze nie ma". Zszycie kosztorys↔apka to osobna, przyszła robota.

## Cross-System Convention

Rabat per pozycja jest już dwutrybowy i ma jeden punkt aplikacji rabatu
(`applyDiscount`), przez który przechodzi każda wartość netto. Globalny override
naturalnie siada na tym samym wzorcu: wyzeruj wkład per-row w `applyDiscount`, gdy
globalny aktywny, i odejmij globalny raz na poziomie `totalNet`/`totalPlannedNet`.
Chowanie kolumn ma już trzy istniejące mechanizmy widoczności — dochodzi czwarty
warunek, nie nowy system.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: dodać na kosztorysie jeden, dwutrybowy
> (kwota/procent) rabat globalny, który — gdy ustawiony — nadpisuje rabaty per
> pozycja (wyłącza i chowa ich kolumny) i jest odejmowany raz od totalu netto,
> bez rozkładu na sekcje/etapy. Marża pozostaje poza zakresem, bo kosztorys v2 jest
> dziś rozłączony z apką.

Ramowanie właściciela obroniło się w całości — **nie ma przeramowania**. Jedyny
punkt, który wyglądał na otwarty problem (rabat kosztorysowy zawyża marżę),
właściciel rozstrzygnął jako **poza zakresem**: to nie defekt tej zmiany, tylko
skutek tego, że plan kosztorysu i plan finansów są dziś celowo rozłączone. Kod to
potwierdza (DISCONNECTED, dowody wyżej). Gdy osobno powstanie zszycie
kosztorys→robocizna, rabat zejdzie marży sam — bez zmian w tym, co tu budujemy.

## Confidence

**HIGH** — każda decyzja pokryta wprost przez właściciela + potwierdzona dowodem
w kodzie (file:line). Rozłączność plan-kosztorys/plan-finansów zweryfikowana
niezależnym przeszukaniem (brak writer/reader). Zero otwartych pytań domenowych.

## What Changes for /10x-plan

Plan buduje **tylko** rabat globalny w kosztorysie (pole na `kosztoryses` + logika
override + chowanie kolumn + jednorazowe odjęcie od totalu). **Nie** rusza marży,
transferu `RABAT`, ani zszycia kosztorys↔apka — to osobna, zaparkowana robota
(rodzina decyzji P5, `context/reference/kosztorys-editor-domain-notes.md:343`).
Kształtować pole tak, by dało się je później **zastąpić/zasilić** transferem, nie
migrować. Sekwencja: po `kosztorys-stages-source-of-truth` (już shipped) — total
liczy się dziś z sumy etapów, na tej definicji siada rabat.

## References

- Źródło: `src/types/kosztorys.ts:8,31-32`, `src/lib/kosztorys/calc.ts:17-21,60-63`,
  `src/lib/kosztorys/v2-rows.ts:387-414`, `src/components/kosztorys/use-kosztorys-editor.ts:177-181`,
  `src/lib/tables/kosztorys-v2-columns.tsx:617-632,765-787`
- Rozłączność planów: `src/lib/db/calculate-margin.ts:13-14`, `src/lib/actions/transfers.ts:44-52`
- Kontekst decyzji: `context/changes/kosztorys-global-discount/change.md`,
  `context/reference/kosztorys-editor-domain-notes.md:270,343`
- Investigation: 2 równoległe Explore (kosztorys total + rabat mechanika; kosztorys→robocizna wiring)
