# Kosztorys AI vs kosztorys właściciela — case 1 (Bemowo, 125,6 m²)

2026-10-05. Pierwsza prawda do porównania. Właściciel wycenił tę samą klientkę we własnej inwestycji
**#175** (status „wycena”, uwagi: „Wycena bez wizyty” — czyli z tych samych dokumentów, co agent).
Kosztorys agenta to **#168** (v2: Przedmiar z pomiaru rysunków + 6 prac spoza szablonu). Oba wyszły
z szablonu „Kosztorys 2026” (#165), z tymi samymi cenami.

**Zastrzeżenia:**

- Snapshot z backupu produkcji 2026-10-05 16:34 UTC. Ostatnia edycja #175 była o 16:26 UTC, więc
  kosztorys właściciela mógł być jeszcze w toku. Dane zamrożone w `owner/items-165-168-175.tsv`.
- Kosztorys właściciela to też wycena bez wizji lokalnej, nie Pomiar z natury. To wzorzec
  „jak wycenia właściciel”, nie „ile faktycznie zrobiono”.
- Wartości to Przedmiar × Cena j.m., **bez rabatu** — eksport go nie zawiera. #168 nie ma rabatu
  (sprawdzone na lokalnej bazie 2026-10-06); #175 nie dało się sprawdzić, bo lokalna baza go nie ma.
- Pozycje dopasowano po sekcji + opisie (`scripts/compare-owner.py`). Pary „ta sama praca, inna
  pozycja” są dobrane ręcznie poniżej.

## Wynik

|                         |             AI (#168) |                                         Właściciel (#175) |
| ----------------------- | --------------------: | --------------------------------------------------------: |
| Wartość netto przedmiar |            203 764 zł |                                                212 667 zł |
| Różnica                 | **−8 903 zł (−4,2%)** |                                                           |
| Pozycje z Przedmiarem   |                   127 |                                                       141 |
| Pozycje z Komentarzem   |                   122 |                                                         2 |
| Sekcje                  | 11 (jedna „Łazienka”) | 10 (bez „Klimatyzacji”, „Łazienka” + „Łazienka prysznic”) |

**Suma w ±10% to przypadek, nie trafność.** Pod spodem:

- 70 pozycji wspólnych: różnica netto +3,6 tys. zł, ale **bezwzględna 35,8 tys. zł**;
- 57 pozycji tylko u AI (62,3 tys. zł) i 41 tylko u właściciela (67,6 tys. zł) — prawie się znoszą;
- z 50 pozycji, które niosą 80% wartości u właściciela, AI ma dokładnie tę samą pozycję w 32 (64%).
  Licząc pary „ta sama praca, inna pozycja” (niżej) — w 44 (88%). Kryterium z `change.md` (≥ 90%)
  jeszcze niespełnione.

Pomiar v2 też nie poprawił sumy: v1 był +4,8 tys. zł nad właścicielem, v2 jest −8,9 tys. zł. Za to
**na poziomie pozycji v2 przybliżył się do właściciela w 16 z 19 porównywalnych pozycji** (sekcja
niżej). Suma to zły wskaźnik — oceniać trzeba pozycje.

| Sekcja                                 |     AI | Właściciel |      Δ |
| -------------------------------------- | -----: | ---------: | -----: |
| Ściany i sufity bez łazienek           | 73 184 |     80 721 | +7 537 |
| Łazienka (u właściciela: dwie sekcje)  | 51 638 |     60 406 | +8 768 |
| Instalacja elektryczna i oświetleniowa | 36 715 |     28 095 | −8 620 |
| Wyburzenia, demontaże, zabezpieczenia  | 13 304 |     15 820 | +2 516 |
| Podłogi                                |  8 268 |     11 504 | +3 236 |
| Instalacja wodno-kanalizacyjna + c.o.  |  7 250 |      9 550 | +2 300 |
| Prace dodatkowe                        |  6 200 |      4 000 | −2 200 |
| Kuchnia                                |  6 004 |      2 570 | −3 434 |
| Montaż stolarki i ślusarski            |  1 200 |          0 | −1 200 |

## Co się zgadza — i to jest najważniejszy wynik

**Powierzchnie, których bałem się najbardziej, wyszły najlepiej.** Klasa „liczone, nie czytane”
trafiła lepiej niż klasa „czytane z dokumentów”.

| Praca                                                         |       AI v2 | Właściciel | Uwagi                                                  |
| ------------------------------------------------------------- | ----------: | ---------: | ------------------------------------------------------ |
| Warstwa wykończeniowa ścian razem (kolor + limewash + tapeta) |    256,5 m² |     253 m² | −1,4%; podział: 124/82/51 vs 113/90/50                 |
| Ściany pod wykończenie (gładź + tynk na listwach)             |      250 m² |     243 m² | właściciel 60 m² przeniósł z gładzi na tynk            |
| Sufity (gładź / malowanie)                                    |      115 m² |     112 m² |                                                        |
| Tapetowanie                                                   |     50,6 m² |      50 m² | v1 miał 72 (z listy zakupowej)                         |
| Montaż karniszy                                               |      5,8 mb |     5,8 mb | v1 miał 19,2                                           |
| Listwy sufitowe (maskownice)                                  |     15,2 mb |    15,8 mb |                                                        |
| Listwy przypodłogowe                                          |     66,4 mb |      68 mb | v1 miał 80                                             |
| Listwy sztukateryjne na ścianach                              |       26 mb |      26 mb |                                                        |
| Gres 120×120 w kuchni                                         |      8,7 m² |     8,6 m² | inna sekcja, ta sama ilość                             |
| Mozaika na podłodze                                           |      6,1 m² |     5,5 m² | inna pozycja                                           |
| Glazura na podłodze 120×120 (łazienki)                        |     10,8 m² |    10,7 m² |                                                        |
| Skucie tynku z glifu okna                                     |      5,2 mb |     5,2 mb | właściciel: własna pozycja za 60 zł, AI: katalog 70 zł |
| Zabezpieczenia                                                |    125,6 m² |   125,6 m² |                                                        |
| Lampy razem (proste + trudne + kinkiety)                      |      38 szt |     38 szt | AI rozbił na 3 pozycje, właściciel 1                   |
| LED w suficie łazienki / profile                              |      6,5 mb |     6,5 mb |                                                        |
| Armatura (WC, geberit, bidet, baterie, wanna, odpływ liniowy) | identycznie |            |                                                        |

**Pomiar z rysunków (v2) się obronił.** Z 19 przemierzonych pozycji, które właściciel też wycenił, 16 przesunęło się
w stronę właściciela: tapeta 72 → 50,6 (wł. 50), karnisze 19,2 → 5,8 (wł. 5,8), limewash 135 → 81,7
(wł. 90), 120×120 29,5 → 24,2 (wł. 21,8), 120×270 6,7 → 3,9 (wł. 2,6), gładź 290 → 250 (wł. 243
razem z tynkiem), malowanie w kolorze 90 → 124 (wł. 113). Odeszły od właściciela tylko: akrylowanie
styków (121 vs 180), malowanie w łazienkach (29,5 vs 14,7) i fuga mały format (to wybór pozycji, niżej).

Wniosek z `measurement.md` („geometria to mały błąd, legenda i zakres to duży”) potwierdzony:
**geometria zgadza się z właścicielem co do kilku procent**. Właściciel też mierzy z rysunków —
ma ilości typu 6,54 / 13,28 / 2,63 m².

## Gdzie się rozjechało — pięć klas

### A. Wybór pozycji (ta sama praca, inna pozycja rozpiski) — największa klasa

Tu suma się nie zmienia albo zmienia się mało; psuje się dopasowanie i ocena.

| Praca            | AI                                                                     | Właściciel                                                                        |   Δ zł |
| ---------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -----: |
| Limewash         | „Farba strukturalna efekt beton” 81,7 m²                               | ta sama pozycja z przepisanym opisem „limewash z lakierem” 90 m²                  |   +830 |
| Gruntowanie      | **obie** pozycje: przed/po gładziach 365 m² + podkładowa 321 m²        | jedna: przed/po gładziach 354 m² (+ jednokrotne 60 m²)                            | −3 500 |
| Rozdzielnia      | dołożenie bezpiecznika × 14 = 2 800                                    | przebudowa rozdzielni, 1 kpl = 2 100                                              |   −700 |
| LED              | taśmy, profile, transformatory × 10, lutowanie, LED w kuchni (≈ 4 000) | „listwy LED + taśmy” 15 kpl, LED w łazienkach, sufit podwieszany z LED (≈ 5 200)  | +1 200 |
| Otwory drzwiowe  | przesunięcie otworu × 2 (3 000) + wybicie otworu (850)                 | wykucie nadproża × 4 (1 800) + zaślepienie otworu (500) + wycinanie ścian 10,8 mb |   −470 |
| Wyburzenia       | ściany do 12 cm, 15 m²                                                 | ściany 12–20 cm, 13 m²                                                            |    +40 |
| Transport i gruz | dwie pozycje transportu + kontener + 2 big bagi (6 200)                | jedna pozycja transportu (cena podniesiona 1 500 → 2 500) + kontener (4 000)      | −2 200 |
| Fugi             | fuga wg formatu płytki: mały 6,7 / standard 38,9 m²                    | mały 26,2 / standard 18,4 m²                                                      |   +360 |
| Grzejniki        | w „Instalacji wod-kan + c.o.” (4 szt z zaworami)                       | w sekcjach łazienek (1 + 1)                                                       |   −500 |

**Dwie z tych par to nakładki, które `change.md` już wypisał jako „Rozpiska quirks”** (gruntowanie
41603 vs 41605, grzejniki w dwóch sekcjach) — i agent mimo to wziął obie pozycje gruntowania.
Wypisanie pułapki w notatkach nie wystarczy; procedura musi ją rozstrzygać.

### B. Zakres i technologia — wiedza fachowa, której agent nie ma

Tu jest większość pozycji, których druga strona nie ma wcale:

| Co                                                            | Właściciel                                                                       | AI                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Szlifowanie mleczka z tynków deweloperskich**               | 295 m² (2 065 zł) — pozycja **z szablonu**                                       | brak                                                     |
| Tynkowanie / wyrównanie ścian na listwach tynkarskich         | 60 m² (6 000 zł)                                                                 | brak (te m² poszły w gładź)                              |
| Nowe ściany                                                   | bloczek komórkowy 7,5 cm 29,8 m² + 6 nadproży (5 370 zł)                         | ściany G-K z wełną 23 m² + bloczek 10 cm 2 m² (3 670 zł) |
| Detale płytek: glify 120×120, półki z glazury, szlif 45°      | glify 19,5 mb, **7 półek**, 45° 44 mb, glif z zaokrągleniem 2,6 mb (≈ 11 200 zł) | glify 10 mb, 45° 15 mb (4 700 zł)                        |
| Hydroizolacja                                                 | folia 48 m², taśma 50 mb, silikon 65 mb                                          | 22 m², 27 mb, 30 mb                                      |
| Malowanie sztukaterii (limewash + zwykła)                     | 26 + 15,8 mb (2 710 zł)                                                          | brak (jest sam montaż)                                   |
| Kaseta pod drzwi przesuwne + obudowa G-K                      | 1 500 zł                                                                         | 0 — AI uznał to za „firmę zewnętrzną”                    |
| Sufit podwieszany z LED w łazience z prysznicem               | 1 800 zł                                                                         | brak                                                     |
| Licowanie ścian płytami G-K w łazienkach                      | 7,7 m²                                                                           | brak                                                     |
| Wylewka samopoziomująca, cokół z płytki, czyste cięcie płytki | 14,4 m², 4 mb, 7 mb                                                              | brak / listwa / „równe cięcia” 6 mb                      |
| Montaż AGD, zlewu, piekarnika, indukcji, okapu                | **nic**                                                                          | 1 900 zł                                                 |
| Montaż osprzętu (gniazdka, włączniki) osobno od punktów       | **nic**                                                                          | 127 szt × 39 = 4 953 zł                                  |
| Drzwi ukryte, dopasowanie otworów                             | **nic**                                                                          | 1 200 zł                                                 |
| Klimatyzacja                                                  | sekcja usunięta                                                                  | sekcja zostawiona z zerami                               |

Detale płytek (półki, glify, krawędzie 45°) są na **widokach ścian (strony 14–21)** — a te są
wklejonymi obrazami, których v2 nie umiał zmierzyć. Właściciel je przeczytał. To jest konkretna
dziura w narzędziu, nie w procedurze.

### C. Policzalne z dokumentów — właściciel liczy systematycznie więcej

Tabela niezawodności w `change.md` mówiła „liczby czytane z dokumentów: bez zmian”. **Nieprawda
względem właściciela:**

| Pozycja                     |                               AI |                Właściciel |
| --------------------------- | -------------------------------: | ------------------------: |
| Punkty elektryczne          |                               83 |                        98 |
| Punkty oświetleniowe        |                               46 |                        51 |
| Punkty wod-kan w łazienkach |                               14 |                        20 |
| Punkty c.o.                 |                                8 |                        16 |
| Bruzdy pod kable            | 180 mb (140 miękkie + 40 żelbet) | 200 mb (wszystko miękkie) |
| Grzejniki dekoracyjne       |                                4 |                         5 |

Liczba z dokumentu to nie to samo, co liczba punktów do wyceny. c.o. 8 → 16 wygląda na „dwa punkty na
grzejnik” (zasilanie + powrót) — **hipoteza do potwierdzenia u właściciela**, nie reguła.

### D. Struktura

- **Jedna sekcja na łazienkę.** Właściciel rozdzielił „Łazienka” i „Łazienka prysznic”. Agent wpisał
  obie łazienki do jednej sekcji i rozróżniał je tylko Komentarzem.
- Właściciel usunął sekcję „Klimatyzacja” (poza zakresem), agent ją zostawił.
- Właściciel dopisuje prace na końcu sekcji i **przepisuje opisy pozycji szablonu** (limewash,
  wykucie nadproża) — dopasowanie po opisie przestaje działać.

### E. Ceny

- Ceny szablonu zgadzają się 1:1 we wspólnych pozycjach. Właściciel zmienił trzy: transport
  1 500 → 2 500, big bag 600 → 450, malowanie łazienki z prysznicem 100 → 120.
- Z 22 prac, które dopisał spoza szablonu, **4 to dokładnie pozycje z katalogu prac** (półka
  z glazury, czyste cięcie płytki, przebicie przez ścianę nośną, wycinanie ścian — tę ostatnią
  dodał do katalogu w trakcie tej wyceny). Resztę napisał sam, czasem jako wariant pozycji, która
  w katalogu jest z inną ceną (cokół z płytki: katalog 100 / 220 zł, właściciel 150 zł; skucie glifu:
  katalog 70, właściciel 60). **Katalog nie jest dla właściciela wiążący.**
- **Właściciel robi dokładnie to, co reguła 9 agenta:** przebicie przez ścianę nośną ma Przedmiar 1,
  cenę 0 zł i komentarz „cena do ustalenia”. Limewash ma komentarz „?”. To drugie potwierdzenie, że
  pozycja bez ceny musi się w aplikacji wyróżniać.
- Ceny, które agent w v2 wymyślił i potem wyzerował: luksfery 1 500 zł — **właściciel dał 1 500 zł**;
  siedzisko G-K 2 × 1 500 — właściciel 1 × 2 100; klejone lustra 3 × 300 — właściciel jedno lustro
  zwykłe (120) i jedno z LED (150). Jeden trafiony strzał na trzy nie podważa reguły „agent nie
  wymyśla cen”.

## Pytania agenta vs decyzje właściciela

Agent wpisał do uwag 15 pytań. Właściciel na większość odpowiedział sobie sam — konwencją:

| Pytanie agenta                                | Co przyjął właściciel                                  |
| --------------------------------------------- | ------------------------------------------------------ |
| 2. Karnisz za każdą maskownicą?               | nie — 5,8 mb, tyle co narysowane (jak AI)              |
| 5. Ściany miękkie czy żelbet?                 | miękkie — wszystkie bruzdy po stawce „materiał miękki” |
| 6. Wymiary wyburzanej ściany                  | 13 m² + 10,8 mb wycinania                              |
| 11. Rozdzielnia: bezpieczniki czy przebudowa? | przebudowa, 1 kpl                                      |
| 13. Cokół w holu: listwa czy płytka?          | cokół z płytki, 4 mb                                   |
| 14. Trzecie lustro?                           | dwa: zwykłe + z LED                                    |
| 15. Które okno pod podkucie?                  | 5,2 mb — dokładnie tyle co AI                          |

Każda taka odpowiedź to kandydat na **regułę domu** — czyli to, co pętla poprawy z `change.md`
nazywa „owner's convention”.

## Co z tego wynika na przyszłość

1. **Agent jest dobry w mierzeniu, słaby w fachu.** Geometria trafia co do kilku procent. Pieniądze
   uciekają w wybór pozycji i w prace, o których istnieniu agent nie wie (mleczko, tynk na listwach,
   półki, hydroizolacja całej łazienki). To się poprawia regułami domu, nie lepszym pomiarem.
2. **Reguły domu do potwierdzenia z właścicielem (15 minut):**
   - stan deweloperski → szlifowanie mleczka na wszystkich ścianach do wykończenia;
   - jedno gruntowanie (przed/po gładziach), nigdy obie pozycje naraz;
   - rozdzielnia zawsze jako przebudowa (kpl), nie per bezpiecznik;
   - montaż osprzętu elektrycznego: wliczony w punkt czy osobno? (−5 tys. zł różnicy);
   - montaż AGD i drzwi: robimy czy nie?
   - nowe ścianki działowe: bloczek 7,5 cm domyślnie, G-K tylko gdy projekt mówi G-K?
   - hydroizolacja: cała podłoga łazienki + ściany mokre; taśma i silikon na łazienkę;
   - jedna sekcja na łazienkę; sekcja bez zakresu usuwana;
   - punkty c.o.: ile na grzejnik?
   - kaseta pod drzwi przesuwne + obudowa G-K: nasza robota, nie firma zewnętrzna?
   - sztukateria: montaż zawsze z malowaniem?
   - ściany bez opisu materiału: domyślnie miękkie (bruzdy po stawce „materiał miękki”)?
3. **Widoki ścian (raster) trzeba czytać.** Detale płytek to ≈ 6,5 tys. zł różnicy i siedzą tylko
   tam. Następny krok narzędziowy: odczyt wklejonych obrazów stron 14–21 (wizja modelu: liczba półek,
   glifów, krawędzi 45°), nie pomiar wektorów.
4. **Korpus pozycji dopisanych przez właściciela.** Wszystkie pozycje spoza szablonu z kosztorysów
   na produkcji (opis, j.m., cena) to źródło cen między katalogiem a „do wyceny” — luksfery są już
   w #175 za 1 500 zł. Część z nich warto przenieść do katalogu prac.
5. **Ocena musi znać pochodzenie pozycji.** Właściciel przepisuje opisy, więc dopasowanie po
   opisie gubi pary. Kosztorys zaszyty z szablonu nie pamięta, z której pozycji szablonu pochodzi
   pozycja — z nim scoring byłby deterministyczny. Do tego czasu pary wybiera się ręcznie (jak w tabeli A).
6. **Następny eksperyment: właściciel startuje od szkicu AI.** Zamiast dwóch niezależnych wycen —
   kopia #168, właściciel ją poprawia, mierzymy liczbę zmian i czas. To odpowiada na właściwe pytanie
   („ile pracy oszczędza”), a nie „jak blisko trafił”.
7. **#175 to dev case 1 w datasecie.** Snapshot jest w `owner/`, więc dalsze edycje właściciela
   nie zmienią oceny wstecz. Holdout potrzebuje 2–3 kolejnych par.

## Jak powtórzyć porównanie dla kolejnej pary

Dane z produkcji bez dotykania Neona i bez nadpisywania lokalnej bazy deweloperskiej:

1. **Świeży zrzut.** Godzinny backup może być nieaktualny (pierwszy pobrany zrzut, z 11:11 UTC,
   miał w #175 tylko 4 pozycje). Ręczne uruchomienie `gh workflow run db-backup.yml`
   (workflow_dispatch) wrzuca zrzut do **`/db_backups/test/`** na FTP, nie do `/db_backups/`.
   Pobranie: jak w skillu `restore-prod-backup-local`, z tym katalogiem.
2. **Osobna baza w kontenerze.** `createdb ai_compare_scratch` w kontenerze `wykonczymy`, import
   zrzutu tam, nie do `wykonczymy-db`. Po eksporcie `dropdb`.
3. **Znalezienie kosztorysu właściciela.** Inwestycje z tą samą klientką / adresem, utworzone po
   kosztorysie agenta; sprawdzić `investments.notes` (tu: „Wycena bez wizyty”) i datę ostatniej
   edycji pozycji — kosztorys świeżo edytowany może być w toku.
4. **Eksport pozycji** zapytaniem z nagłówka `scripts/compare-owner.py` (id szablonu, AI,
   właściciela) do `owner/items-<ids>.tsv`; bez danych klienta.
5. **`python3 scripts/compare-owner.py`** — sumy, kategorie wspólne / tylko AI / tylko właściciel,
   Δ zł per pozycja, `[NEW]` = pozycja spoza szablonu. Pary „ta sama praca, inna pozycja” i klasy
   rozjazdów A–E dobiera się ręcznie.

## Pliki

- `owner/items-165-168-175.tsv` — pozycje szablonu, AI i właściciela (snapshot 2026-10-05 16:34 UTC)
- `scripts/compare-owner.py` — dopasowanie po sekcji + opisie; `python3 scripts/compare-owner.py`
