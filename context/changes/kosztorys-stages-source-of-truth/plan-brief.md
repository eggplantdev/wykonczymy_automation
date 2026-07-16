# „Pomiar z natury" z sumy etapów; kotwica w Przedmiarze — Plan Brief

> Pełny plan: `context/changes/kosztorys-stages-source-of-truth/plan.md`
> Change: `context/changes/kosztorys-stages-source-of-truth/change.md`
> Rozstrzygnięcie: [EX-494](https://linear.app/ex-plant/issue/EX-494) · otwarte: [EX-495](https://linear.app/ex-plant/issue/EX-495)

## What & Why

Arkusz właściciela ma **dwa wejścia**: Przedmiar i etapy. Nasz edytor ma **trzy** — „Pomiar z natury"
jest u nas polem wpisywanym, a w arkuszu to formuła `=SUM(D:M)`, zweryfikowana na 435 z 435 wierszy.
Z tej jednej rozbieżności wynika reszta: wartość wiersza rozgałęzia się na pomiar-albo-etapy, „Pozostało"
nie ma sensownej kotwicy, licznik grozi degeneracją do 100%.

Rolę planu — tego, wobec czego mierzymy postęp — pełni **Przedmiar**, nie pomiar.

## Starting Point

`rowValueForView` (`v2-rows.ts:346`) schodzi na etapy **tylko** gdy pomiar = 0; inaczej zwraca
`pomiar × cena − rabat`. Pozostałość po EX-489, który zobaczył wąski objaw (wiersz bez pomiaru wyceniany
na 0 przy naliczanych etapach → licznik 150%) i wyprowadził z szerokiego uzasadnienia wąską regułę.
Warstwy, które wtedy ustawił — `calc.ts` cenowa i ślepa na etapy, `v2-rows.ts` rozliczeniowa — zostają
i są tu pomocne.

Osobno: `rowPlannedNetForView` (`calc.ts:72`) **pomija rabat**, choć arkusz go stosuje (`S = N×Q − N×Q×R`).

## Desired End State

```
Przedmiar  (wpisywany)  → „Wartość netto przedmiar"  = Przedmiar × cena − rabat   [oferta]
etapy      (wpisywane)  → „Pomiar z natury"          = Σ etapów        (read-only)
                        → „Wartość netto"            = Σ etapów × cena − rabat     [wykonanie]
                        → „Pozostało do rozliczenia" = oferta − wykonanie   („—" bez Przedmiaru)
                        → licznik „Wykonano"         = wykonanie / oferta
                        → „% wykonania"              = Σ etapów / Przedmiar
                        → czerwień                   = Σ etapów > Przedmiar
```

Obie kwoty istnieją **równolegle**, jak `S456` i `T456` w stopce arkusza. „Pozostało" może być ujemne,
licznik może przekroczyć 100%.

## Key Decisions Made

| Decyzja                          | Wybór                                         | Dlaczego                                                                                                                | Źródło                                                 |
| -------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| „Pomiar z natury"                | **suma etapów, read-only**                    | W arkuszu to formuła, nie pole. Pomiar i etapy nie konkurują — to jedna liczba                                          | Właściciel 2026-07-16                                  |
| Kotwica „Pozostało" i licznika   | **Przedmiar**                                 | Kotwica w wykonaniu daje `x − x` = 0 — to skamielina `AF` z arkusza, martwa kolumna. Przedmiar ją ożywia                | Właściciel 2026-07-16                                  |
| „% wykonania" i „%" etapu        | **Przedmiar**                                 | Ta sama degeneracja o kolumnę dalej: mianownik `Σ etapów` daje 100% na każdym wierszu                                   | Właściciel 2026-07-16                                  |
| „Wartość netto przedmiar"        | **obejmuje rabat**, z tooltipem               | Parytet z `S` w arkuszu                                                                                                 | Właściciel 2026-07-16 — **„może się jeszcze zmienić"** |
| Czerwień wiersza                 | **`Σ etapów > Przedmiar`**                    | Dzisiejszy próg po zmianie porównuje liczbę z samą sobą — sygnał umarłby po cichu                                       | Właściciel 2026-07-16                                  |
| Blokada kasowania wiersza        | **tylko etapy**                               | Stara liczba w bazie zamurowałaby wiersze z zerowymi etapami — nieusuwalne na zawsze, bez powodu                        | Właściciel 2026-07-16                                  |
| Kolumna w bazie                  | **kasowana migracją w tej zmianie**           | Dane kosztorysu są throwaway do wejścia dogfoodingu na `main` — nie ma czego backfillować                               | Właściciel 2026-07-16                                  |
| Kopie zapasowe / szablony        | **przestają ją nieść; stare wpisy kasujemy**  | Etapy i tak są w kopii; odtworzona liczba kłóciłaby się z nimi                                                          | Właściciel 2026-07-16                                  |
| Kolejność pracy                  | **czerwony test, potem zmiana**               | Suita zostanie zielona po zmianie — falsyfikowalność wymuszona kolejnością, nie dyscypliną                              | Właściciel 2026-07-16                                  |
| Test przeglądarkowy              | **do backlogu** (`e2e-backlog`)               | Siatka nie ma dziś żadnego; pierwszy to harness + fixture'y + logowanie — większa robota niż sama zmiana                | Właściciel 2026-07-16                                  |
| „Pozostało" bez Przedmiaru       | **„—"**, sortowanie na końcu                  | Brak oferty = pytanie bezprzedmiotowe. Zero udawałoby wiersz domknięty                                                  | Właściciel 2026-07-16                                  |
| „Pozostało" jako kwota z minusem | zostaje na razie                              | Alternatywa: sam procent. Nie blokuje, zmiana lokalna                                                                   | **ON HOLD → EX-495**                                   |
| Kształt `calc.ts`                | prymityw `netForQtyForView`, ilość parametrem | Wszystkie figury to ta sama operacja z inną ilością; decyzja „która ilość jest prawdą" należy do warstwy znającej etapy | Plan                                                   |

## Scope

**In scope:** „Pomiar z natury" → read-only z sumy etapów · „Wartość netto"/„Brutto" wiersza · podsumy
sekcji (druga figura) · wartości i procenty etapów · „Rabat wart." · „Pozostało" (kotwica + „—" +
sortowanie) · licznik „Wykonano", „% wykonania" i „%" sekcji · rabat w „Wartość netto przedmiar" +
tooltip · próg czerwieni · **blokada kasowania** · **migracja kasująca kolumnę** · **kopie zapasowe
i szablony** · **skrypty seedujące** · docstringi + notatka domenowa `:227`.

**Out of scope:** globalny rabat (`kosztorys-global-discount`) · roadmap 12(b) „suma etapu" · test
przeglądarkowy (backlog) · unifikacja fixture'ów testowych · walidacja ujemnych ilości · błąd `Z8`
w arkuszu (nie nasz plik).

## Architecture / Approach

Wyciągnąć z `calc.ts` jeden prymityw `netForQtyForView(row, qty, view)` = `applyDiscount(qty × cena)`
i przestawić wszystkie figury tak, żeby **ilość przychodziła z zewnątrz** zamiast być czytana z wiersza.
`calc.ts` przestaje mieć zdanie o tym, która ilość jest prawdą — decyzja przenosi się do `v2-rows.ts`,
jedynej warstwy znającej etapy. To zacieśnia granicę z EX-489, a nie rozmywa.

Prymityw zamyka rozbieżność rabatu **mimochodem**: `rowPlannedNetForView` przestaje mieć własną
arytmetykę, więc nie ma jak pominąć rabatu.

Zapis odcinamy **strukturalnie, nie dyscypliną**: `diffRow` iteruje wyłącznie po `ITEM_FIELDS`, więc
usunięcie pola z tej listy i z `ItemPatchT` sprawia, że żadna edycja nie ma jak trafić do zapisu.

Rozdzielenie kotwic jest sednem: „Wartość netto" czyta `Σ etapów`, wszystko mierzące postęp czyta
`Przedmiar`. Dwie figury, dwa źródła, jeden prymityw.

## Phases at a Glance

**Kroimy po figurze, nie po warstwie** — to jedyna różnica kształtu wobec wersji z `848f61f` i jest
celowa: podział na warstwy wymuszał kilka faz czerwonej kompilacji. Każda faza tu zaczyna się od testu,
który dziś pada, i kończy zielono, typecheck włącznie.

| Faza                     | Co dowozi                                                                         | Kluczowe ryzyko                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1. Pomiar = Σ etapów     | Prymityw · kolumna read-only · zapis odcięty · **blokada kasowania na etapach**   | Bez poprawki blokady faza tworzy wiersze **nieusuwalne na zawsze** — ślepy zaułek                                     |
| 2. Kotwica w Przedmiarze | „Pozostało" (+ „—" + sortowanie) · licznik · „% wykonania" · „%" etapu · czerwień | Blok testowy `:329-357` broniący licznika przed 150% staje się **tautologią** — trzeba go przepisać, nie dopisać obok |
| 3. Rabat w przedmiarze   | Figura ofertowa przez prymityw · tooltip                                          | Decyzja ma **znak zapytania** — osobna faza, żeby cofnięcie było jednym commitem                                      |
| 4. Sprzątanie            | Migracja · kopie i szablony · seedy · martwy kod · notatka domenowa               | Seed nie zapisuje etapów → zaseedowany dataset pokazałby zerowy pomiar **po cichu**; migrację pisać ręcznie           |

**Prerequisites:** brak. **Estimated effort:** ~1 sesja, 4 fazy, każda zielona na wyjściu.
**Prod:** migrację stosuje człowiek (`pnpm db:migrate:prod`) przed wypchnięciem kodu — bramka
deploy-time, nie bramka fazy.

## Open Risks & Assumptions

- **Zielone testy na starej regule** — największe ryzyko całej zmiany, i większe, niż zakładała
  poprzednia wersja planu. Regułę widzi dziś **6 asercji**, wszystkie w jednym pliku. Blok, który
  istnieje _specjalnie_ po to, żeby pilnować licznika przed regresją 150% z EX-489, po zmianie liczy
  `1/1` dla każdego wejścia. Cały `kosztorys-calc.test.ts` jest odporny **typem**.
- **Decyzja o rabacie w przedmiarze ma znak zapytania** od właściciela. Stąd osobna faza i osobny,
  jawny test — żeby cofnięcie było jednolinijkowe, a nie archeologią.
- **Kwoty zmienią się bez edycji** — każdy wiersz z pomiarem ≠ sumie etapów i każdy kosztorys
  z niezerowym rabatem pokaże po deployu inne liczby, a „% wykonania" przestanie kłamać 100%. To cel;
  właściciel ma wiedzieć, kiedy to wejdzie.
- **Read-only „Pomiar z natury" nie będzie miało automatycznej ochrony** — E2E idzie do backlogu.
  Ktoś może odblokować kolumnę i nikt się nie dowie.
- **Zakładam**, że `sectionDoneNetForView` / `kosztorysDoneNetForView` stają się martwe po fazie 2.
  Gate na `pnpm typecheck`, nie na grepie. (Bliźniacza tabela wersji Payloada — sprawdzone, nie istnieje.)

## Success Criteria (Summary)

- „Pomiar z natury" nie przyjmuje wpisu i zmienia się sam po edycji etapu
- Wiersz z etapami przekraczającymi Przedmiar: „Pozostało" ujemne, komórka czerwona, licznik > 100%
  (nieucięty) — a „Wartość netto przedmiar" stoi w miejscu
- Wiersz bez Przedmiaru: „Pozostało" = „—", brak czerwieni, sortowanie spycha go na koniec
- Wiersz z Przedmiarem i zerowymi etapami **da się skasować**; z wpisanym etapem — blokada
- „Wartość netto przedmiar" przy rabacie 10% jest o 10% niższa niż `Przedmiar × cena`, a tooltip mówi dlaczego
- Suma kolumn wartości etapów = „Wartość netto" wiersza co do grosza, przy rabacie kwotowym
  i procentowym, na wszystkich trzech widokach ceny
- `grep -rn "measuredQty\|measured_qty" src/` nic nie zwraca
