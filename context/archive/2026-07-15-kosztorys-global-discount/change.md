---
change_id: kosztorys-global-discount
title: Globalny rabat na kosztorysie, nadpisujący rabaty per pozycja
status: archived
created: 2026-07-15
updated: 2026-07-24
archived_at: 2026-07-24T13:46:37Z
branch: dogfooding/kosztorys-editor-ux
worktree: null
---

## Notes

Rabat na całość wykonanych prac, wpisywany raz na kosztorys. Właściciel (2026-07-15): _„na pewno
w większości przypadków będziemy potrzebować po prostu dodać rabat za całość wykonanych prac"_ —
rabat per pozycja zostaje, ale przestaje być trybem domyślnym.

### Ustalone (właściciel, 2026-07-15)

- **Override, nie warstwa.** Gdy globalny rabat jest ustawiony, rabaty per pozycja są **`disabled`**
  i przestają liczyć — globalny je nadpisuje. Nie nakładają się. (Przy rabacie kwotowym te dwa
  czytania dają dowolnie różne kwoty, stąd zapis wprost.)
- **To ten sam rabat co transfer `RABAT`.** Docelowo globalny rabat kosztorysu ma być **podpięty do
  transferu**, nie żyć obok niego. Na teraz łączenia nie ma i go nie budujemy.
- **Wyłączenie globalnego rabatu przywraca rabaty per pozycja.** Override ich nie zjada — dane
  zostają w bazie i wracają do liczenia. Skutek do obsłużenia: kwota kosztorysu zmienia się wtedy
  sama, bez edycji pozycji.

### Sonda po żywym arkuszu V1 (2026-07-15, read-only)

Sprawdzone na wzorcu (`kosztoryses.id=36`) i na realnym, podpiętym kosztorysie (`id=44` → inwestycja
66, Altowa 12). Dwa twarde ustalenia:

- **Rabat za całość NIE istnieje w V1.** `Podsumowanie` to `Robocizna + Materiały = Łącznie` (B6+B7),
  bez żadnego wiersza rabatu. Jedyny działający rabat w arkuszu to `R` — procent per wiersz. Czyli ta
  zmiana to **nowa robota bez parytetu**; arkusz nie jest tu specyfikacją.
- **Transferowy `Rabat` jest już wciągnięty do arkusza, ale nieużywany.** Lustro liczy
  `transfery (tylko do odczytu)!K3 = SUMIF(C:C; "Rabat"; E:E)` — i **żadna formuła tego nie czyta**.
  Czyli miejsce, w którym rabat ma się docelowo podpiąć, jest w V1 gotowe i puste. Argument, żeby
  kształtować globalny rabat pod zastąpienie transferem (patrz niżej), a nie obok niego.

Sondy: `probe-rabat.ts` / `probe-podsum.ts` / `probe-cells.ts` (scratchpad, nie w repo).

### Transferowy `RABAT` jest prawdopodobnie obejściem, nie modelem

Hipoteza właściciela (2026-07-15): _„ten rabat w transferach pojawił się dlatego, że nie było jak
tego transferu wpisać wcześniej, gdy mieliśmy dwa miejsca trzymania danych"_. **Historia ją
potwierdza:**

```
2026-06-11  2658623  feat(transfers): add RABAT type, labels, and field predicates
2026-06-19  580523d  feat(kosztorys): POC schemat — 5 tabel, kolekcje, migracja
```

`RABAT` powstał **8 dni przed** pierwszym schematem kosztorysu w bazie — gdy kosztorys był wyłącznie
arkuszem, więc rabatu na robociznę nie było gdzie zapisać poza transferami. Treść commita potwierdza
od drugiej strony: całe uzasadnienie to „RABAT mirrors LABOR*COST cash semantics: no source register,
requires an investment" — mechanika, zero powodu, dla którego rabat miałby \_być* transferem.

**Dowód z żywych danych (lokalna kopia proda, 2026-07-15).** 9 wierszy `type='RABAT'` w `transactions`
(1 z nich `cancelled` — test typu na inwestycji-wzorcu 90 tego samego dnia). Dwa fakty:

- **Pierwszy rabat = 2026-06-11 14:32, ten sam dzień co commit `2658623`** (inwestycja 84, 332,70 zł,
  opis „rabat"). Typ nie powstał „na przyszłość" — powstał, żeby zapisać ten jeden rabat.
- **`RABAT` jest dziś ZATYCZKĄ NA BILANS, nie rabatem handlowym.** Sześć wpisów z wieczora
  2026-06-18 (ręcznie, 21:53→23:32, bez opisu) — pięć trafia w saldo co do grosza:

  | inwestycja | bilans przed rabatem | rabat                                          |
  | ---------- | -------------------- | ---------------------------------------------- |
  | 72         | −14,21               | 14,21                                          |
  | 68         | −30,86               | 30,86                                          |
  | 71         | −79,11               | 79,11                                          |
  | 14         | −226,19              | 226,19                                         |
  | 21         | −882,18              | 882,18                                         |
  | 74         | −1 013,30            | 1 289,89 (odstaje — pewnie późniejsze wydatki) |

  Kwota jest **wyliczona z salda**, żeby wyszło zero. Nikt nie daje klientowi rabatu 14,21 zł.

**Co z tego wynika NA PEWNO.** „Rabat za całość wykonanych prac" (ta zmiana) i `RABAT` (dziś) to
**nie to samo pojęcie mimo tej samej nazwy**: dziś rabat jest **zatyczką** — liczoną _z_ bilansu na
końcu, żeby wyszło zero; ta zmiana chce **wejścia** — decyzji z góry, która _zmienia_ total, i z
której bilans dopiero wynika. Kierunek strzałki jest odwrotny. To trzyma niezależnie od tego, czemu
`RABAT` powstał.

**Czego NIE wiemy — i nie zgadywać.** Hipoteza „nie było jak tego wpisać" jest **częściowo obalona
przez dane**: `CORRECTION` istnieje od `2026-03-25` (44e69ec) i ma **45 użyć od 2026-04-17** — czyli
w czerwcu bilans dało się domknąć korektą. Czego korekta **nie** umie, to ruszyć marży; `RABAT`
rusza obie figury, a `LOSS` (tylko marża) ma pierwsze użycie **tego samego wieczora 2026-06-18**.
Czyli tamten wieczór wygląda raczej na **świadomy podział trzech skutków**, których korekta nie
odróżniała, niż na brak narzędzia.

**Świadek istnieje — spytać, nie zgadywać.** Wszystkie 9 wpisów `RABAT` założył ten sam człowiek:
rola `OWNER`, `users.id = 16`. Właściciel tego repo **nie jest** autorem tych wpisów („to nie byłem
ja", 2026-07-15), więc pytanie „czemu rabat, a nie korekta" ma adresata poza tą rozmową.

**Wątek zamknięty jako nierozstrzygalny — nie kopać dalej.** Czytanie właściciela: _„nie zgadzały im
się kwoty, więc wpisali to jako rabaty"_ (2026-07-15). Dane mu nie przeczą. Ale **nie ma zapytania,
które by to rozstrzygnęło**: przy tej hipotezie i przy hipotezie „świadomy podział marża/bilans" te
same 9 wierszy wygląda identycznie. Baza zna użycie, git zna mechanikę, intencji nie zna żadne.
Rozstrzyga tylko `OWNER` 16 — a **nie musi rozstrzygać**, bo wniosek projektowy (zatyczka vs wejście,
niżej) trzyma przy obu wersjach. Archeologia, nie przesłanka.

**Kierunek (hipoteza, nie ustalenie):** rabat wraca do kosztorysu (pole), a transferowy `RABAT`
docelowo się **wycofuje** — nie odwrotnie. Opcja „edytor nie ma pola, tylko czyta/zakłada transfer
`RABAT`" utrwalałaby obejście, **jeśli** to obejście — a to jest właśnie to, czego nie wiemy.
Rozstrzyga odpowiedź `OWNER`a + decyzja P5.

**Czego to NIE przesądza:** `RABAT` nie jest tylko zapisem — wchodzi do
`marża = robocizna − wypłaty − rabat − strata` (`investment-financials.ts`) i podnosi bilans. Jego
wycofanie to nie usunięcie pola, tylko **przełożenie źródła tej liczby z transferów na kosztorys** —
czyli ta sama decyzja co **P5** (kierunek zależności księga ↔ kosztorys, `domain-notes:343`). Frame
musi powiedzieć, czy v1 tej zmiany zostawia oba współistniejące (i jak nie liczyć dwa razy), czy od
razu przecina.

### Dlaczego to jest świadomie tymczasowe (i czym to grozi)

Kosztorys i księga finansowa to dziś **dwie rozłączne płaszczyzny** — właściciel: _„tego łączenia
pomiędzy apką a kosztorysem jeszcze nie ma (…) to jest tylko połączenie tymczasowe w wersji pierwszej
edytora"_. Ta zmiana świadomie stawia **duplikat pojęcia, które już istnieje** (`RABAT`,
`transfers.ts:22` → `investment-financials.ts`: obniża marżę, podnosi bilans).

**Trap do nazwania w framingu, nie do przemilczenia:** `marża` liczy się **wyłącznie z transferów**
(`robocizna − wypłaty − rabat − strata`); kosztorys w nią nie wchodzi. Rabat wpisany w kosztorysie
obniża więc tylko wartość kosztorysu — **marża go nie zobaczy**. Właściciel założył, że „wydamy go
albo tu, albo tam, to nie ma znaczenia"; dziś ma, i to jest różnica między dwoma miejscami na tę samą
kwotę a dwoma różnymi skutkami, z których jeden cicho zostawia marżę zawyżoną.

Rozbieżność **już istnieje** przy rabacie per pozycja — ta zmiana jej nie tworzy. Ale globalny rabat
robi ją dużo łatwiejszą do trafienia, bo „rabat za całość prac" to dokładnie ta kwota, którą ktoś
inaczej wpisałby jako transfer `RABAT`. Framing musi zdecydować, czy v1 tę rozbieżność **pokazuje**
(ostrzeżenie / jawny opis, że to figura kosztorysowa), czy milczy.

**Rodzina decyzji: P5** (`context/reference/kosztorys-editor-domain-notes.md:343`) — _czy suma
rozpiski ma automatycznie ustawiać `LABOR_COST`, czy rozpiska = plan a transfer = zafakturowano._
Otwarte. Docelowe podpięcie rabatu pod transfer czeka na tę samą decyzję, więc kształtować globalny
rabat tak, żeby dało się go później **zastąpić** transferem (albo z niego generować) — nie tak, żeby
trzeba go było migrować.

### Sekwencja — po `kosztorys-stages-source-of-truth`

Nie łączyć z tamtą zmianą. Globalny rabat siada na definicji „totals", a `kosztorys-stages-source-of-truth`
tę definicję właśnie przestawia (wartość z sumy etapów, nie z pomiaru). Zbudowany na starej definicji
będzie do przepisania; zbudowany razem — przy złej kwocie nie da się powiedzieć, który z dwóch ruchów
ją zepsuł. Precedens i wniosek: `context/changes/kosztorys-stage-values/frame.md:114` („Sequence,
don't bundle" — bundling uczynił tam argument o szerokości siatki niefalsyfikowalnym).

### Do rozstrzygnięcia w framingu

- Gdzie rabat siedzi w modelu: pole na `kosztoryses`, i czy dwutrybowy (`percent`/`amount`) jak
  per-pozycja (`domain-notes:270`) — czy „rabat za całość" jest z natury kwotowy.
- Co widzi użytkownik, gdy globalny rabat wyłącza rabaty per pozycja: kolumny `Rabat` /
  `Rabat wart.` znikają, szarzeją, czy pokazują nadpisaną wartość? Dane per pozycja **zostają
  w bazie** (override ≠ kasowanie) — więc co po wyłączeniu globalnego rabatu wraca.
- Czy globalny rabat rozkłada się na etapy/sekcje (żeby `Netto` sekcji i wartości etapów nadal się
  domykały — patrz mechanizm udziału w `kosztorys-stages-source-of-truth`), czy jest jedną pozycją
  odjętą pod sumą całości.
