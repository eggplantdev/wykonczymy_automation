# Anomalie formuł w arkuszu klienta

Skan arkusza inwestycji 31 („11 listopada Gabinety", tab `kosztorys_robocizny`, 336 wierszy pozycji,
13 sekcji), stan na 2026-08-13. Cel: wyłapać wiersze, w których formuła odbiega od wzorca
obowiązującego w całej reszcie — bo to one psują import i rozjeżdżają kwoty.

Metoda: każda formuła znormalizowana (numer własnego wiersza → `#`, pozostałe liczby → `n`)
i pogrupowana. Wzorzec większościowy = norma, reszta = anomalia.

## Co jest w pełni jednorodne

Te kolumny nie mają ani jednego odstępstwa na 336 wierszach — można na nich polegać:

| Kolumna                | Formuła                                         | Wierszy  |
| ---------------------- | ----------------------------------------------- | -------- |
| `S` Wartość netto      | `=O#*Q#-(Q#*R#)*O#`                             | 336      |
| `AE` bilans            | `=S#-sum(U#:AD#)`                               | 336      |
| `U`–`AD` wartość etapu | `=D#*$Q#-(D#*$Q#*$R#)` (i analogicznie `E`…`M`) | 336 × 10 |
| `Q` Cena j.m.          | wpisana z ręki, nigdy formuła                   | 336      |

Wiersze podsumowań sekcji też trzymają jeden kształt: `S = SUM(zakres własnych pozycji)`,
`T = S<własny wiersz>`. Wiersz `377` („wartość netto") sumuje wszystkie 13 sekcji — żadnej nie gubi.

## Anomalie

### 1. Przedmiar liczony z etapu — 7 wierszy, sekcja Klimatyzacja

`N` (Przedmiar) jest formułą `=M#`, czyli czyta **kolumnę 10. etapu** („Kamil Kaminski + wylewka").
Przedmiar przestaje być ofertą wpisaną z ręki i staje się pochodną wykonania.

| Wiersz | Pozycja                                                   | Cena j.m. | Pomiar | Wartość netto |
| ------ | --------------------------------------------------------- | --------- | ------ | ------------- |
| r23    | wykonanie punktu elektrycznego                            | 120 zł    | —      | 0 zł          |
| r24    | doprowadzenie zasilania do jednostki żelbet               | 60 zł     | —      | 0 zł          |
| r25    | doprowadzenie zasilania do jednostki materiał miękki      | 30 zł     | —      | 0 zł          |
| r26    | Naprawy ścian i sufitów po kuciu, bruzdowaniu, tynkowaniu | 50 zł     | —      | 0 zł          |
| r27    | Wykonanie gładzi po bruzdach                              | 40 zł     | —      | 0 zł          |
| r30    | bruzdowanie pod rury żelbet                               | 150 zł    | 6      | 900 zł        |
| r31    | bruzdowanie pod rury materiał miękki                      | 60 zł     | 3      | 180 zł        |

**Skutek dla importu:** `M` jest puste, więc Przedmiar czyta się jako 0 i te pozycje trafiają do nas
bez oferty. Dwie ostatnie mają przy tym Pomiar i wartość, czyli praca wykonana bez przedmiaru — to
jeden z powodów, dla których kolumna „Pozostało" pokazywała dodatnią kwotę do zrobienia
(zob. `settlement-rows.ts`, wiersz bez Przedmiaru = oferta zerowa, czyta się na minus). Od EX-885
taki wiersz jest na czerwono i nie pomniejsza sumy w stopce — suma to „ile oferty zostało".

### 2. Pomiar z natury jako kopia Przedmiaru — 241 z 336 wierszy

`O = =N#`. To nie jest pomiar, tylko powtórzenie oferty. Pozostałe 95 wierszy ma Pomiar wpisany
z ręki albo pusty.

W arkuszu kanonicznym `O` to `=SUM(D:M)` — suma etapów. Tutaj jest odwrotnie: Pomiar nie mówi nic
o wykonaniu, a mimo to `S` (a przez to „wartość netto" 508 196 zł) liczy się właśnie z niego.
Dlatego arkusz sam u siebie ma dwie różne liczby: 508 196 zł z Pomiaru i 466 819 zł z osi etapów.

**Skutek dla importu — nieaktualny od 2026-08-20.** Import brał wtedy Pomiar wyłącznie wpisany
z ręki, więc te 241 wierszy nie dostawało liczby odniesienia i kolumna „Rozjazd" była na nich
strukturalnie ślepa. Na 26 z nich (16 677 zł) arkusz liczył pracę jako wykonaną, choć etapy były
puste albo niepełne — to jest ta sama 16 677,70 zł, o którą rozjeżdżał się dogfooding.
**Zamknięte:** reguła (`sheet-import/parse-labor-tab.ts`, `readMeasuredQty`) pomija dziś tylko
komórkę, której formuła sięga do kolumn etapów, więc `=N#` wnosi swoją liczbę i te wiersze są
widoczne w „Rozjazdzie" i w problemie „z pomiarem do rozpisania na etapy".

### 3. Ręczna arytmetyka w komórkach ilościowych — 2 wiersze

| Wiersz | Kolumna           | Formuła         | Wynik |
| ------ | ----------------- | --------------- | ----- |
| r102   | `N` Przedmiar     | `=219,25+21,75` | 241   |
| r107   | `I` 6. etap ilość | `=600-70-60`    | 470   |

Nieszkodliwe — import czyta wartość, nie formułę. Warto wiedzieć, że takie komórki istnieją, bo
reguła „formuła = nie ufamy tej liczbie" (którą stosujemy do Pomiaru) na `N` i na etapach dałaby
tu fałszywy alarm.

### 4. Rabat przepisany z wiersza wyżej — 2 wiersze

`R373 = =R372`, `R374 = =R373` — łańcuszek kopiujący. Dziś `R372` jest puste, więc rabat wychodzi 0
i nic się nie psuje, ale wpisanie rabatu w r372 po cichu zmieni dwie kolejne pozycje.

## Wnioski dla importera

1. **Formuła w `N` nie jest sygnałem ostrzegawczym, ale `=M#` już tak** — Przedmiar czytający kolumnę
   etapu daje ofertę zerową i wywraca „Pozostało". **Zrobione (2026-08-13):** raportowane w oknie
   „Porównaj z arkuszem".
2. **`O = =N#` to inny przypadek niż `O = =SUM(D:M)`** — i od 2026-08-20 traktowany inaczej.
   Odrzucenie sumy etapów jest słuszne: porównanie sumy etapów z sumą etapów zawsze da zero.
   `=N#` nie ma tej właściwości. **Rozstrzygnięte (2026-08-13):** oba odrzucone tą samą regułą,
   `=N#` dodatkowo raportowane licznikiem. **Odwrócone (właściciel, 2026-08-20):** komórka, którą
   właściciel wypełnił, jest pomiarem niezależnie od tego, co wyprodukowało liczbę, a szukamy
   dokładnie rozjazdu między sumą etapów a pomiarem z natury. Import pomija więc wyłącznie formułę
   sięgającą do kolumn etapów; `=N#` wnosi swoją wartość. Skala: ~750 pozycji w ~20 inwestycjach,
   z czego 480 ma etapy całkiem puste. Argument „to zadanie kolumny »Pozostało«" upadł — „Pozostało"
   kotwiczy się w Przedmiarze i nie mówi nic o tym, co arkusz uznał za zrobione.
   Licznik z 2026-08-14 (sama liczba, bez listy wierszy) zostaje bez zmian — to raport o kształcie
   formuł, nie o rozjeździe.
3. **Wzorzec `S` i `AE` jest w tym arkuszu nienaruszony** — jeśli kiedyś przestanie być, ten skan to
   wychwyci; warto go powtórzyć na każdym nowym arkuszu klienta przed importem.

## Jak powtórzyć skan

Skan opisany niżej jest jednorazowy i ręczny; jego trzy klasy są **zaimplementowane** w
`src/lib/kosztorys/sheet-import/formula-health.ts` i widoczne w oknie „Porównaj z arkuszem" bez
schodzenia do terminala. Poniższe zostaje do szukania wzorców, których skan jeszcze nie zna.

```bash
SHEET_ID=<id arkusza> TABS="kosztorys_robocizny" MAX_ROWS=500 \
  node --env-file=./.env scripts/inspect-sheet.mjs > /tmp/sheet.txt
```

Inspektor zrzuca formuły obok wartości. Grupowanie: znormalizuj formułę (numer własnego wiersza na
`#`, resztę liczb na `n`) i policz wystąpienia — wzorzec większościowy to norma, każdy inny kubełek
wymaga obejrzenia.
