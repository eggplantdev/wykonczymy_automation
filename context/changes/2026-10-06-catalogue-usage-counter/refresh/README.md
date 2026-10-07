# Użycie prac szablonu i katalogu — jak powstają te dane

Przepis na powtórzenie analizy „które prace są używane” na świeżym dumpie. Jeden przebieg pisze dwa
raporty tym samym kodem: `../template-usage.html` (prace jednego szablonu) i
`../catalogue-usage.html` (cały katalog prac). Otwierać w przeglądarce — podgląd markdowna w
edytorze ignoruje szerokości kolumn, dlatego raporty nie są plikami `.md`.

## Uruchomienie

```bash
pnpm db:dump   # opcjonalnie: świeży dump prod → dumps/dump-latest.sql
bash context/changes/2026-10-06-catalogue-usage-counter/refresh/refresh.sh [dump.sql] > /tmp/catalogue-usage.md
open context/changes/2026-10-06-catalogue-usage-counter/template-usage.html
open context/changes/2026-10-06-catalogue-usage-counter/catalogue-usage.html
```

Inny szablon: `TEMPLATE='nazwa inwestycji-szablonu' bash …/refresh.sh`. Uruchamiać z katalogu
głównego repo — skrypty importują `@/lib/...`.

Trzy ostatnie linie na stderr mówią, czy wyniki są kompletne (nigdy nieużyte / tylko pod inną nazwą
/ używane):

```
stare arkusze: 54 przeczytanych, 18286 pozycji; nieprzeczytane: Topiel 6/49 solispharm, Patryk Pudlowski Dąbrowskiego
template-usage.html: 10 / 46 / 251, nieocenione pary: 0 (/var/folders/…/unreviewed-szablon.tsv)
catalogue-usage.html: 22 / 130 / 412, nieocenione pary: 0 (/var/folders/…/unreviewed-katalog.tsv)
```

`nieocenione pary: 0` to warunek zaufania do raportu. Każda liczba powyżej zera oznacza prace,
których „łącznie” może być zaniżone. `stare arkusze: 0 przeczytanych` znaczy, że skrypt nie znalazł
dumpów arkuszy (patrz krok 3) — wtedy raport liczy tylko aplikację i zawyża „nigdy nieużyte”
kilkukrotnie.

## Co robi każdy krok

1. **Dump → baza robocza.** `refresh.sh` wczytuje dump do osobnej bazy `dump_scratch` na kontenerze
   `wykonczymy` (kasuje ją i tworzy od nowa). Baza `wykonczymy-db` i Neon nie są dotykane.
2. **Eksporty TSV** do katalogu tymczasowego:
   - `items.tsv` — każda pozycja każdego kosztorysu poza szablonami i koszem: inwestycja, opis,
     j.m., Przedmiar, suma etapów;
   - `no-kosztorys.tsv` — inwestycje (poza szablonami i koszem), które w aplikacji nie mają ani
     jednej pozycji;
   - `tpl.tsv` — pozycje szablonu: sekcja, opis, j.m.;
   - `cat-works.tsv` — wpisy katalogu prac: kategoria, opis, j.m.;
   - `cat.tsv` — katalog prac dla `measure.ts` (pomiar w `change.md`).
3. **Stare arkusze Google** — `legacy.ts` czyta zrzuty arkuszy z
   `~/.local/share/wykonczymy-legacy-sheets/` (inny katalog: `LEGACY_SHEET_DUMP_DIR=…`; mapa
   zrzutów: `context/reference/legacy-sheet-dumps.md`) tym samym parserem, którym aplikacja
   importuje arkusz, i dopisuje ich pozycje do `legacy-items.tsv` w kształcie `items.tsv`.
   Czytany jest arkusz **każdej** żywej inwestycji, nie tylko tych bez kosztorysu w aplikacji:
   - 27 arkuszy to inwestycje, których kosztorysu w aplikacji nie ma wcale;
   - 27 to starsza kopia kosztorysu, który w aplikacji jest — i bywa pełniejsza niż ta kopia
     (2026-10-06: 515 użytych pozycji, których w aplikacji brak, pod 103 nazwami niewystępującymi
     nigdzie indziej).

   Zrzuty zawierają ceny i nazwiska klientów, więc leżą poza gitem. Dwa arkusze mają układ, którego
   parser nie rozpoznaje — są wypisane na stderr jako „nieprzeczytane” i nie wchodzą do liczenia.

4. **Tożsamość pracy** — `catalogueKey(opis, j.m.)`, ta sama funkcja, której używa aplikacja. Dwie
   pozycje o tym samym kluczu to ta sama praca bez żadnej oceny (klucz ignoruje wielkość liter,
   polskie znaki i znane literówki, więc „montaz kratki wentylacyjnej” ze starego arkusza liczy się
   wprost do wpisu „Montaż kratki wentylacyjnej”).
5. **„Użyta”** — w danej inwestycji praca ma Przedmiar > 0 **lub** etapy > 0. Liczy się liczba
   **inwestycji**: inwestycja liczy się raz, choćby praca stała i w aplikacji, i w starym arkuszu
   (`sources.ts` sprowadza oba źródła do jednego identyfikatora). Sama obecność w kosztorysie nic
   nie znaczy: każdy kosztorys dostaje cały szablon, więc obecność mierzy szablon, nie wybór.
6. **Szukanie kandydatów na „tę samą pracę pod inną nazwą”** — dla każdej pracy z listy (szablon
   albo katalog), wśród wszystkich prac użytych gdziekolwiek (aplikacja + stare arkusze):
   - ten sam opis, inna j.m. — zawsze;
   - podobna pisownia — Dice na bigramach ≥ 0,55;
   - przeformułowana nazwa — wspólne rdzenie słów (pierwsze 6 liter) ≥ 0,4.

   Najlepszych 8 na pracę. Progi są luźne celowo: przeoczona para to praca skasowana, choć używana;
   nadmiarowa para kosztuje jedną ocenę.

7. **Drugie, luźniejsze przeszukanie — tylko dla prac, które wyszłyby jako „nigdy nieużyte”.**
   Wystarcza jedno wspólne charakterystyczne słowo (rdzeń 5 liter stojący w najwyżej 3% użytych
   nazw), np. „Silikonowanie parapetu” ↔ „sylikonowanie parapetów”. Najlepszych 12 na pracę. To
   przeszukanie powstało po tym, jak pierwsze pominęło stare nazwy przeformułowane w całości.
   Które pary są proponowane, nie zależy od ocen już wystawionych — inaczej każda runda oceniania
   odsłaniałaby następną.
8. **Ocena par** — automat tylko proponuje. O tym, czy para to ta sama praca, decyduje wpis w
   `template-verdicts.tsv`: `ta-sama` albo `inna`. Para bez wpisu wychodzi w raporcie jako
   **NIESPRAWDZONE** i nie jest doliczana. Każda para z pliku ocen jest stosowana, także taka,
   której automat sam by nie zaproponował — tak dopisuje się pary znalezione ręcznie.
9. **Liczenie** — „łącznie” to suma zbiorów inwestycji po własnym kluczu pracy i po wszystkich jej
   parach `ta-sama`. Inwestycja, w której praca stoi pod dwiema nazwami, liczy się raz.

## Ocenianie nowych par

Po świeżym dumpie pojawiają się nowe nazwy, a więc nowe pary. Procedura:

1. Uruchom `refresh.sh`, weź ścieżki `unreviewed-szablon.tsv` i `unreviewed-katalog.tsv` z
   ostatnich linii stderr. Plik ocen jest wspólny — para oceniona dla szablonu jest oceniona także
   dla katalogu.
2. Każda linia to: opis z listy, j.m., opis kandydata, j.m., **puste pole**, liczba inwestycji.
   Wpisz w puste pole `ta-sama` albo `inna`.
3. Doklej ocenione linie do `template-verdicts.tsv` (szósta kolumna jest ignorowana).
4. Uruchom ponownie, aż będzie `nieocenione pary: 0`. Praca, która po ocenach spada do „nigdy
   nieużytych”, dostaje dopiero wtedy drugie przeszukanie (krok 7), więc nowe pary mogą się pojawić
   jeszcze raz — to się kończy po jednej–dwóch rundach.
5. Na koniec przeczytaj listę „Nigdy nieużyte” i dla każdej pracy poszukaj jej słów kluczowych w
   użytych nazwach inną drogą niż automat (grep po `items.tsv` i `legacy-items.tsv`). Parę, której
   automat nie zaproponował, dopisz ręcznie jako linię `ta-sama`.

Stan ocen z 2026-10-06: 3 251 par — 645 `ta-sama`, 2 606 `inna`. Zasady, którymi kierowała się
ocena:

- **Ta sama praca** — różni się pisownia, literówka, szyk, dopisek doprecyzowujący stawkę albo
  piętro, albo sama j.m. (szt / kpl, mb / kpl).
- **Inna praca** — inny materiał, inny format, inny zakres albo inna czynność, nawet przy niemal
  identycznej nazwie („montaż” vs „demontaż”, „ścianki z GK” vs „sufity z GK”).
- **Stara ogólna nazwa wobec wariantów na liście** („Fugowanie ścian i podłóg”, „Montaż
  umywalki”, „montaż grzejników”) — doliczana tylko do wariantu domyślnego. Przy pozostałych
  wariantach stoi w kolumnie „podobne, ale inna praca”, żeby nie liczyć tych samych inwestycji
  kilka razy.
- **Stary wiersz zbiorczy, który wprost wymienia pracę** („podłączenie pralki i suszarki”) — liczy
  się do każdej wymienionej pracy.
- **Kandydat jest osobnym wpisem tej samej listy** — `inna`, chyba że to naprawdę ta sama praca
  wpisana dwa razy („Czyste cięcie płytki” i „Szlifowanie krawędzi płytek czyste cięcie”). Wpisy
  różniące się zakresem („Montaż WC kompakt” i „…dla niepełnosprawnych”) albo samą j.m. przy
  świadomie rozdzielonych stawkach („Skucie posadzki mb” i „…m2”) zostają osobno.

Oceny wystawił agent, czytając pary jedna po drugiej — nie owner. Przed skasowaniem pracy z sekcji
„Nigdy nieużyte” przeczytaj jej kolumnę „podobne, ale inna praca”: tam widać wszystko, co zostało
odrzucone, razem z liczbą inwestycji. Błędną ocenę poprawia się w TSV i uruchamia skrypt ponownie.

Oceny graniczne, rozstrzygnięte na „ta sama” (każda warta 1–2 inwestycji) — do przejrzenia w
pierwszej kolejności, jeśli wynik ma być ostrzejszy:

- „Usuwanie grzyba do 2m2” ← „Usuwanie grzyba do 5m2”;
- „Taras wentylowany - deska kompozytowa” ← „układanie tarasu wraz z legarami…”;
- „Przemalowanie stopni i podstopni” ← „malowanie schodów + barierki”;
- „Sufit podwieszany z LED wg. projektu” ← „sufit podwieszany + led prosty”;
- „Sufit podwieszany armstrong niski stopień…” ← „Sufit podwieszany kasetonowy … GYPTONE”;
- „Układanie glazury mały format 6,5 x 20” ← mały format 15x15 / dekor 4,5 x 18,5;
- „Położenie gresu … format mały 20x20” ← gres 5x15;
- „Demontaż zabudowy kuchennej” ← „demontaż szafek kuchennych” w wierszu zbiorczym;
- „Montaż GK na stelażach” ← „GK na stelażu pod glazurę”.

Odwrotnie — odrzucone, choć blisko: „Fugowanie” ← „fugowanie premium”, „Silikonowanie” ←
„sylikonowanie premium”, „Ogrzewanie podłogowe elektryczne…” ← „ogrzewanie podłogi”, „Demontaż
kuchni bez zniszczenia” ← „demontaż kuchni z wyniesieniem”.

## Czytanie raportu

- **Nigdy nieużyte** — 0 inwestycji także pod inną nazwą. Kandydaci do usunięcia.
- **Ta nazwa nieużywana, ale praca używana pod inną nazwą** — praca jest potrzebna; do decyzji
  zostaje nazwa (poprawić na tę używaną albo zostawić).
- **Używane** — od najrzadziej.
- **w tym stare ark.** — ile z „łącznie” widać wyłącznie w starym arkuszu Google (w aplikacji tej
  pracy w tej inwestycji nie ma albo ma zera). Wysoka wartość przy niskim „tą nazwą” oznacza pracę
  używaną dawniej, a nie w kosztorysach prowadzonych w aplikacji.
- **też w szablonie** / **też w katalogu** — kandydat jest drugą pozycją tej samej listy, czyli
  praca wpisana dwa razy. Usuwa się jedną z nich, nie obie.
- **jest w = 0** (raport katalogu) — wpisu nie ma pod tą nazwą w żadnym kosztorysie ani arkuszu.
  **To nie znaczy, że praca jest nieużywana.** Wpisy katalogu były spisywane ze starych szablonów i
  arkuszy, a potem przemianowane, więc ich użycie stoi pod starą nazwą: pierwsza wersja tego
  raportu szukała tylko w kosztorysach aplikacji i pokazywała 200 „nigdy nieużytych”, z czego 159
  z „jest w = 0”. Po dołożeniu starych arkuszy i ocenieniu par zostały 22, z czego 9 z „jest w = 0”.

Checkbox w wierszu zapamiętuje zaznaczenie w przeglądarce, „Kopiuj zaznaczone” kopiuje listę
(nazwa, j.m., sekcja).

## Ograniczenia

- **Mała próba dla prac nowych.** Szablon „Kosztorys 2026 kolory” stoi w ok. 17 kosztorysach (dump
  2026-10-06). Praca dodana do szablonu niedawno wygląda tak samo jak praca martwa — stare arkusze
  jej nie znają, bo wtedy nie istniała.
- **Kandydatów szuka się po nazwie.** Praca nazwana zupełnie inaczej (bez żadnego wspólnego słowa)
  nie zostanie zaproponowana jako para i nie pojawi się nawet jako NIESPRAWDZONE. Krok 5 procedury
  oceniania jest na to jedynym zabezpieczeniem.
- **Dwa wpisy tej samej listy, z których żaden nie był użyty, nie są ze sobą zestawiane** — pula
  kandydatów to tylko prace użyte. Bliźniaki wśród „nigdy nieużytych” (np. gres i glazura na
  podłodze wielki format 120x270) widać dopiero, czytając tę sekcję.
- **Dwa arkusze nieprzeczytane** („Topiel 6/49 solispharm”, „Patryk Pudlowski Dąbrowskiego”) —
  ich prace nie są liczone.
- **Oceny są przypisane do pary nazw.** Dla innego szablonu działają tylko tam, gdzie powtarza się
  dokładnie ta sama nazwa i j.m.; reszta wyjdzie jako NIESPRAWDZONE.
- **Raport katalogu nie zna katalogu jako źródła podpowiedzi.** Liczy użycie w kosztorysach; nie
  mówi, czy wpis jest potrzebny jako pozycja cennika, której jeszcze nikt nie wycenił.
