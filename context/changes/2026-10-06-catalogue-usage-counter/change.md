---
change_id: catalogue-usage-counter
title: Katalog prac — licznik użyć (przedmiar / etapy) i podział prac spoza katalogu
status: new
created: 2026-10-06
updated: 2026-10-06
archived_at: null
branch: null
worktree: null
---

## Notes

Katalog prac: licznik użyć (przedmiar/etapy) + podział „używane, a brak w katalogu” na powtarzające
się / jednorazowe, z ustaleniami z dumpu 2026-10-06.

Linear: **EX-1010**. Rozszerzenie raportu EX-873 („Policz użycia", `context/archive/2026-09-28-catalogue-filters-and-usage/`),
nie nowa funkcja obok.

### Pomiar — `dumps/dump-latest.sql` (2026-10-06 13:40), bez szablonów i kosza

- 61 kosztorysów (57 z ≥1 użytą pozycją; 2026-09-29: 24), 18 600 pozycji, 3 861 użytych (21%).
- 295 / 564 prac katalogu z ≥1 użyciem (2026-09-29: 164); 165 z nich ma etapy.
- 80 prac obecnych w kosztorysach, ani razu nieużytych; 189 nieobecnych nigdzie.

### Decyzja: „jest w kosztorysie" odpada

Każdy kosztorys dostaje cały cennik z szablonu, więc obecność to 54–56 / 61 dla większości prac —
mierzy szablon, nie wybór. Liczy się tylko „użyta" (Przedmiar > 0 lub etapy > 0, jak w EX-873).
Do rozważenia: rozbicie „użyta" na Przedmiar (oferta) i etapy (wykonanie), opcjonalnie Σ ilości.

### Dopasowanie do katalogu — import z arkusza vs aplikacja

|                             | użyte pozycje | dokładnie | ten sam opis, inna j.m. | jest podpowiedź | nic |
| --------------------------- | ------------- | --------- | ----------------------- | --------------- | --- |
| kosztorysy z arkusza (42)   | 2 977         | 64%       | 4%                      | 26%             | 6%  |
| kosztorysy z aplikacji (15) | 884           | 93%       | 1%                      | 4%              | 2%  |

Luka dotyczy historii z arkuszy i maleje (owner 2026-10-06: coraz mniej inwestycji bez kosztorysu
w aplikacji) — nie budować ciężkiej maszynerii pod stare opisy.

### „Używane, a brak w katalogu" — powtarzające się vs jednorazowe

585 niedopasowanych opisów; 73 powtarzają się w ≥2 kosztorysach i pokrywają 598 / 1 128 pozycji
(≥5: 26 opisów / 457; ≥10: 15 / 389). 512 to jednorazówki.

Ręczny przegląd 73 powtarzających się (z podpowiedziami katalogu) — trzy różne sprawy:

- **A — ta sama praca, inna pisownia / j.m.** (22 opisy, ~200 użyć): punkty elektryczne („:" vs
  „,"), „wyłączników" / „włączników", „2 piętra" / „2 piętro", „klp" / „kpl", „standard" /
  „standard wykończenia Q3"; inna j.m.: syfony kpl/szt, parapety szt/mb, LED kpl/mb,
  zabezpieczenia m²/kpl (j.m. może znaczyć inną stawkę — decyzja, nie automat).
- **B — stara ogólna nazwa, katalog ma warianty** (37, ~230): „Fugowanie ścian i podłóg",
  „Montaż umywalki" (wisząca / nablatowa), odpływ liniowy, glify, wyburzanie, sufit podwieszany.
  Nie da się zmapować automatycznie — wariant zależy od kosztorysu.
- **C — naprawdę brak** (14, ~65): „Montaż zaworów" (27 kosztorysów), „Montaż nadproży",
  „ponowne malowanie – zmiana koloru", haczyki; „szacunkowo" to śmieć.

Podział A/B jest ręczny (na oko z podpowiedzi), granica bywa dyskusyjna.

Owner 2026-10-06: osobna lista powtarzających się, uwzględnić wszystkie trzy grupy w funkcji.
Otwarte: gdzie lista żyje (strona katalogu po „Policz użycia" vs „Porównaj z katalogiem" w edytorze)
i jak A/B/C rozróżnić automatycznie (np. ten sam opis inna j.m. / wysoka zgodność podpowiedzi /
brak podpowiedzi).

### Wymaganie (owner 2026-10-06): prawdopodobne duplikaty obok siebie

Praca spoza katalogu rozpoznana jako prawdopodobnie ta sama co wpis katalogu (grupa A: inna pisownia
lub j.m.) ma być pokazana **bezpośrednio przy tym wpisie** — para obok siebie, nie na dwóch
osobnych listach, żeby porównanie było jednym spojrzeniem. Do sprawdzenia przy planie: czy istniejący
Problem „możliwe duplikaty" (EX-863, pary wewnątrz katalogu) pokazuje pary obok siebie — jeśli nie,
ta sama zasada.

### Odświeżenie pomiaru

```bash
pnpm db:dump   # opcjonalnie: świeży dump prod → dumps/dump-latest.sql
bash context/changes/2026-10-06-catalogue-usage-counter/refresh/refresh.sh [dump.sql] > /tmp/catalogue-usage.md
```

Wczytuje dump do osobnej bazy `dump_scratch` na kontenerze dev (baza `wykonczymy-db` nietknięta),
wypisuje markdown: liczniki, dopasowanie arkusz/aplikacja, rozkład powtórzeń i listę powtarzających
się z podpowiedziami katalogu. Kolumna A?/B?/C? to automatyczny pierwszy podział (ten sam opis inna
j.m. / podpowiedź ≥ 0,9 / słabsza podpowiedź / brak) — „Montaż zaworów" ląduje w B? przez słabe
podpowiedzi, więc grupy weryfikować ręcznie. ~5 s.

Ten sam skrypt pisze też `template-usage.html` (otwierać w przeglądarce): użycie każdej pracy
szablonu (`TEMPLATE=…`, domyślnie „Kosztorys 2026 kolory”), z pracami pod inną nazwą lub j.m.
doliczonymi do „łącznie”. Kandydatów na duplikaty szuka automat (podobna nazwa, ten sam opis w innej
j.m.) wśród prac użytych w aplikacji i w starych arkuszach Google, a o tym, czy to ta sama praca,
decyduje ręczna ocena w `refresh/template-verdicts.tsv`. Para bez oceny wychodzi w raporcie jako
NIESPRAWDZONE, więc po świeżym dumpie trzeba ocenić tylko nowe pary. Cały przepis — kroki, zasady
oceniania par, ograniczenia — w `refresh/README.md`.

Drugi raport z tego samego przebiegu, `catalogue-usage.html`, liczy to samo dla całego katalogu prac.

### Źródła użycia: aplikacja + stare arkusze Google

Pierwsza wersja obu raportów liczyła użycie tylko w kosztorysach aplikacji i dawała 200 „nigdy
nieużytych” wpisów katalogu, z czego 159 „nie stoi w żadnym kosztorysie”. Ten wynik był błędny jako
podstawa do kasowania (owner, 2026-10-06): wpisy katalogu spisano ze starych szablonów i arkuszy, a
potem przemianowano, więc ich użycie stoi pod starymi nazwami w arkuszach, których aplikacja nie
zna. Poprawki:

- drugim źródłem są zrzuty starych arkuszy Google (`refresh/legacy.ts`) — 54 przeczytane: 27
  inwestycji bez kosztorysu w aplikacji i 27 starszych kopii kosztorysów, które w aplikacji są, a
  mimo to niosą 515 użytych pozycji, których aplikacja nie ma;
- liczy się liczba inwestycji, każda raz, niezależnie od tego, w ilu kopiach kosztorysu praca stoi;
- prace wychodzące jako „nigdy nieużyte” dostają drugie, luźniejsze szukanie podobnych nazw (jedno
  wspólne charakterystyczne słowo);
- wszystkie pary ocenione ręcznie: 3 251 (645 „ta sama”, 2 606 „inna”).

### Szablon „Kosztorys 2026 kolory” — użycie prac (dump 2026-10-06)

307 prac: 10 nigdy nieużytych (także pod inną nazwą), 46 używanych tylko pod inną nazwą / j.m., 251
używanych (przed dołożeniem starych arkuszy: 34 / 37 / 236). Szablon stoi w ~17 kosztorysach
(Klimatyzacja w 11); praca dodana do szablonu niedawno nie ma historii w starych arkuszach, więc dla
niej „nieużyta” nadal znaczy „0 na ~17”.

Szablon ma wewnętrzne bliźniaki (ta sama praca dwa razy, często w różnych sekcjach), m.in. syfonu /
syfonów, gniazdek i włączników / „standard”, punkty oświetleniowe / „czujki, rolety”, LED / taśm LED,
listwy + taśmy LED mb / kpl, transformatora / transformatorów, naprawy po bruzdach ×2, gładź po
bruzdach ×2, narożniki / narożniki aluminiowe, ościeżnica z drzwiami / drzwi z ościeżnicą regulowaną.

### Katalog prac — użycie (dump 2026-10-06)

564 wpisy: 22 nigdy nieużyte (także pod inną nazwą), 130 używanych tylko pod inną nazwą / j.m., 412
używanych (przed dołożeniem starych arkuszy: 200 / 69 / 295). Z 22 nieużytych 9 nie stoi pod swoją
nazwą w żadnym kosztorysie ani arkuszu, 13 stoi zawsze z zerami; 9 z nich jest też w szablonie
„Kosztorys 2026 kolory” i tam również wychodzi jako nieużyte. Katalog ma wiele wewnętrznych
bliźniaków (ta sama praca dwa razy) — raport oznacza je „też w katalogu”.
