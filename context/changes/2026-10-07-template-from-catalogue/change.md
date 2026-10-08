---
change_id: template-from-catalogue
title: Szablon jako lista prac z katalogu — ceny wyłącznie w katalogu prac
status: implemented
created: 2026-10-07
updated: 2026-10-08
archived_at: null
branch: ex-1017-template-from-catalogue
worktree: .claude/worktrees/ex-1017
---

## Notes

Ustalenia wstępne z rozmowy z ownerem 2026-10-07 — kształtowanie, nic nie zaimplementowane.
**Decyzja ownera (2026-10-07): ceny i treść prac w szablonach są 1:1 z katalogu prac** — model
poniżej (pkt 2–4) jest potwierdzony, nie wstępny.
Dane z `prod-snap` (dump prod 2026-10-07 08:36 UTC).

Linear: **EX-1017**.

### Problem

Szablon (inwestycja ze statusem `szablon`) trzyma własną, pełną kopię prac: opisy, ceny, mnożniki,
tłumaczenia. Katalog prac i szablony aktualizują się niezależnie, a aplikacja nie ma żadnej drogi,
żeby je masowo zsynchronizować. „Porównaj z katalogiem prac" działa per kosztorys i tylko na ceny;
„Zapisz pozycję do katalogu prac" — jedna praca naraz.

Skutek widoczny w danych: 2026-10-03 „Kosztorys 2026 kolory" został nadpisany z kosztorysu Andrzeja
Wądołowskiego (snapshot „Przed nadpisaniem: …") i przejął jego cenę „Wynoszenie gruzu, mebli… big
bag" — **450 zł zamiast 600 zł** z katalogu. Każda inwestycja założona z „kolory" od tego dnia
dostaje 450.

### Ustalony model

1. **Katalog prac trzyma treść pracy:** opis, j.m., ceny, mnożniki, tłumaczenia.
2. **Szablon = lista wpisów katalogu w sekcjach**, w kolejności. Bez własnej treści i cen. Różne
   szablony = różne zestawy prac. W katalogu mogą być prace spoza każdego szablonu.
3. **Ceny są wyłącznie w katalogu.** Inna cena tej samej pracy = osobna praca z **innym opisem**.
   Unikalność opis + j.m. w katalogu zostaje — nie da się dodać drugiej pracy o tym samym opisie.
4. **Edycja w obu miejscach, od razu sync:** pozycja szablonu pokazuje ceny i treść, można je tam
   edytować, a zmiana trafia od razu do katalogu (i do wszystkich szablonów z tą pracą).
5. **Zmiana lub usunięcie wpisu katalogu, który jest w szablonach → ostrzeżenie.**
6. **Kosztorys jest niezależny:** kopia w chwili założenia. Zmiany w katalogu nigdy same do niego
   nie płyną.
7. **Praca w kosztorysie pamięta swój wpis katalogu** (id). Przed EX-1017 żadna go nie pamiętała —
   wszystko dopasowywało się po opisie + j.m. Link nie dotyczy tłumaczeń w zgłoszeniu pracy:
   zgłoszenie wskazuje pozycję kosztorysu i czyta tłumaczenia z jej własnej kopii (research:
   wcześniejsze „id już identyfikuje tłumaczenia przy zgłaszaniu" było nieprawdą) — i tak zostaje.
8. **3× „Nowa praca" w obu szablonach — do usunięcia.**
9. **Przedmiar i etapy:** szablon ich nie trzyma i nie trzymał — `serialize-preset.ts` zeruje
   Przedmiar i pomija etapy (na prodzie oba szablony: 0 / 310 z Przedmiarem, 0 wykonanych).

### „Aktualizuj pozycję w katalogu prac" (z kosztorysu)

Jedyna droga zmiany ceny z poziomu kosztorysu. Dziś istnieje jako „Zapisz pozycję do katalogu prac"
(`save-item-to-catalogue-dialog.tsx`) — dopasowuje po opisie + j.m. i przy zajętym kluczu przechodzi
w „Nadpisz…" z porównaniem cen „W katalogu" / „Po zapisie". Zmiany:

- rozpoznanie po zapamiętanym wpisie katalogu, nie po opisie:
  - opis bez zmian → **„Aktualizuj pozycję w katalogu prac"** (cena, tłumaczenia);
  - opis zmieniony → to inna praca → **„Zapisz jako nową pracę"**. Bez przemianowania wpisu
    katalogu z poziomu kosztorysu — zmiana opisu w jednym kosztorysie zmieniłaby pracę we
    wszystkich szablonach;
- okno mówi, które szablony zmieni („Zmieni cenę w szablonach: Kosztorys 2026 kolory");
- żaden istniejący kosztorys się nie zmienia.

Cena wynegocjowana z jednym klientem zostaje w jego kosztorysie — do katalogu trafia tylko świadomym
„Aktualizuj" przy tej jednej pracy.

### „Zapisz jako nowy szablon…" / „Nadpisz istniejący"

- Zapisuje **tylko sekcje i prace w tej kolejności**. Nowy opis okna (wchodzi razem ze zmianą
  modelu — dziś byłby nieprawdą, bo szablon kopiuje ceny):

  > Szablon zapamiętuje tylko sekcje i prace w tej kolejności. Ceny, mnożniki i tłumaczenia bierze
  > z katalogu prac. Żeby zmienić cenę, użyj „Aktualizuj pozycję w katalogu prac” przy danej pracy.

- **Prace spoza katalogu są pomijane** z komunikatem „N prac nie jest w katalogu — najpierw zapisz je
  do katalogu". Nie dodajemy ich do katalogu automatycznie (wciągnęłoby to ceny klienta do cennika).
- Bez komunikatu o pracach z inną ceną niż w katalogu — opis okna już mówi, że szablon cen nie
  zapisuje (owner).

### Otwarte decyzje (owner)

1. **Przejście obecnych szablonów.** W „kolory" 6 / 310 prac nie ma dokładnego odpowiednika
   w katalogu: 3× „Nowa praca" (do usunięcia), 2 listwy ze zmienionym opisem (poprawki kierownika
   2026-10-07), „Zabezpieczenia mebli, podłóg…" w m² (w katalogu i w „Kosztorys 2026": kpl).
   „Kosztorys 2026": 307 / 310 dopasowanych, 0 różnic cen. 3× „Nowa praca" — usunąć (owner
   potwierdził 2026-10-07). Otwarte zostają 2 listwy i „Zabezpieczenia…" w m².
2. **Istniejące kosztorysy:** czy przy przejściu ich prace dostają zapamiętany wpis katalogu
   (dopasowanie po opisie + j.m.), czy tylko kosztorysy zakładane od teraz?
   **Rozstrzygnięte (owner 2026-10-08): dostają** — jednorazowo, po opisie + j.m.
3. **Zmiana / usunięcie wpisu katalogu, który jest w szablonie:** samo ostrzeżenie, czy usunięcie
   zablokowane?
   **Rozstrzygnięte (owner 2026-10-08): ostrzeżenie z listą szablonów**, a usunięcie z katalogu
   usuwa tę pracę także ze wszystkich szablonów (również tych w koszu). Kosztorysy zachowują kopię.
4. **„Komentarz" w szablonie** — **rozstrzygnięte (owner 2026-10-08): usunięty** z szablonu;
   „Komentarz do pracy" go zastępuje.
5. **Zła cena wpisana w szablonie** — **rozstrzygnięte (owner 2026-10-08): poprawka ręczna**, bez
   historii katalogu.

### Do sprawdzenia z kierownikiem — big bag 450 / 600

Inwestycje z szablonu z ceną 450 (wszystkie: 0 wykonanych na tej pracy):

| Inwestycja         | Status  | Przedmiar |
| ------------------ | ------- | --------- |
| Andrzej Wądołowski | oferta  | 1         |
| Renata Dębowska    | oferta  | 1         |
| Iwona Sumikowska   | oferta  | 0         |
| Agnieszka Ratyńska | oferta  | 0         |
| Glogera 6/5        | aktywna | 0         |
| Konrad Testy       | aktywna | 0         |

Pozostałe inwestycje z ery szablonów (od 2026-09-22) mają 600. Pytanie: 450 u Wądołowskiego to cena
wynegocjowana czy nowa stawka? Jeśli wynegocjowana — oferta Dębowskiej jest zaniżona o 150 zł.

Po decyzji 1:1 „kolory" bierze cenę z katalogu bez względu na odpowiedź. Odpowiedź rozstrzyga tylko,
czy w katalogu zostaje 600, czy przez „Aktualizuj" wchodzi tam 450.

**Rozstrzygnięte (owner 2026-10-08): 450 zł** — wpisane w katalog i szablon.

### Synchronizacja szablonu z katalogiem przed przejściem na model (2026-10-08)

Kierownik edytuje „Kosztorys 2026 kolory" na bieżąco, więc przed przejściem na nowy model jego
zmiany muszą trafić do katalogu. Drugi szablon („Kosztorys 2026") jest nieużywany — pomijamy go
(owner 2026-10-08).

Porównanie trójstronne — szablon sprzed poprawek kierownika, szablon teraz, katalog teraz — odróżnia
jego zmiany od starego rozjazdu. Skrypty w `sync/`:

```bash
bash context/changes/2026-10-07-template-from-catalogue/sync/export.sh \
  dumps/dump-2026-10-07_07-19.sql dumps/<najnowsza kopia>.sql <katalog roboczy>
node --import tsx context/changes/2026-10-07-template-from-catalogue/sync/diff.ts \
  <katalog roboczy> context/changes/2026-10-07-template-from-catalogue/template-vs-catalogue.html
```

Kopia bazowa `dump-2026-10-07_07-19.sql`: ostatnia zmiana w szablonie 2026-10-06, czyli przed
pierwszym autozapisem z poprawek kierownika (#680, 2026-10-07 05:56 UTC). `export.sh` wczytuje oba
dumpy do roboczych baz `tpl_base` / `tpl_now` na kontenerze `wykonczymy`; `wykonczymy-db` i Neon nie
są dotykane. `diff.ts` zapisuje też `plan.json` — wartości do wpisania w katalog, wejście dla kroku
synchronizacji. Puszczać od nowa na każdej świeżej kopii; ostatnie uruchomienie tuż przed przejściem
na nowy model jest tym, które się liczy.

Wynik na kopii z 2026-10-08 07:33 UTC (`dump-2026-10-08_09-33.sql`; szablon 310 → 305 prac,
ostatnia zmiana 06:46 UTC):

- **Zmiany kierownika → do katalogu: 63 prace**, prawie same tłumaczenia UK/RU. Ceny zmienił w dwóch:
  „Demontaż paneli klejonych" 45 → 40 zł (z narzędziami 25 → 20 zł) i „Przesunięcie otworu
  drzwiowego z montażem nadproża + murowanie" 1500 → 1200 zł (obie 2026-10-08 rano). Wpisane do
  katalogu tego dnia (owner).
- **Tłumaczenia, których katalog nie ma: 239 prac.** Katalog ma tłumaczenia tylko przy 3 pracach,
  więc szablon jest dziś jedynym źródłem tłumaczeń.
- **Konflikt: 1 praca.** „Montaż grzejnika z zaworami" stoi w dwóch sekcjach (Łazienka, wod-kan.)
  z dwoma różnymi tłumaczeniami („з краном" / „з кранами"). Katalog przyjmie jedno.
- **Zmieniony opis: 11 prac.** 9 to ujednolicenie nazw w „Wyburzenia, demontaże" („Usunięcie /
  Usuwanie" → „Demontaż", „Skucie" → „Skuwanie", „zwietrzałych" wypadło) i 2 listwy („przygotowanych
  do malowania" → „przygotowanie do malowania"). To ta sama praca pod nową nazwą, nie nowa praca —
  zasada „inna treść = inna praca" tu nie pasuje, katalog powinien dostać zmianę nazwy. Tylko
  „Demontaże: wszelkie… armatura etc." kierownik już dodał do katalogu jako nowy wpis (stary został).
- **Usunięte z szablonu: 5 prac** (m.in. „Demontaż armatury łazienkowej…", „Skuwanie tynku ze ścian
  i sufitów", „Montaż płyty OSB na ścianie").
- **Kierownik edytuje też katalog:** 4 nowe wpisy od 2026-10-07 (np. „Frezowanie/szlifowanie
  posadzki betonowej grubsze warstwy", nowa wersja „Demontaż armatury łazienkowej…"). Poza
  „Demontaże…" żadnego z nich nie ma w szablonie.
- **Spoza katalogu: 4 prace** — 3× „Nowa praca" (do usunięcia) i „Zabezpieczenia mebli…" w m²
  (w katalogu: kpl).
- **Stary rozjazd sprzed edycji kierownika: 3 prace** — big bag (szablon 450, katalog 600) oraz dwa
  kontenery, gdzie szablon liczy stawkę z narzędziami automatycznie, a katalog miał stałą 700 /
  900 zł. Szablon wygrywa wszędzie, także w starym rozjeździe (owner, 2026-10-08) — katalog
  przechodzi na wartości szablonu.

**Tłumaczenia → katalog:** `src/scripts/sync-template-translations.ts` (próba bez `--apply`). Tekst
z szablonu wygrywa — uzupełnia puste i nadpisuje inne tłumaczenie w katalogu (owner 2026-10-08:
„w szablonie są te aktualne"). Pomija konflikt grzejnika i prace o zmienionym opisie. Na kopii
z 2026-10-08: 576 tłumaczeń w 288 wpisach katalogu, 0 nadpisań. **Zastosowane na prodzie
2026-10-08** (ten sam wynik; staging nie ma tego szablonu). Ponowne uruchomienie przed przejściem na
model dociągnie późniejsze poprawki kierownika.

**Porządki — decyzje ownera 2026-10-08, zastosowane na prodzie tego dnia**
(`sync/cleanup-2026-10-08.ts`; przed zapisem ręczny snapshot szablonu „Przed porządkami katalogu
prac (EX-1017)"):

- 10 zmian nazw kierownika weszło do katalogu jako zmiana nazwy istniejącego wpisu, bez nowych
  wpisów. Przy okazji poprawione popsute tłumaczenia tych prac (zdublowany koniec, literówka, „старой"
  po usunięciu „zwietrzałych", łacińskie „cm") — w katalogu i w szablonie.
- „Zabezpieczenia mebli…": szablon ma rację, w katalogu kpl → m².
- Big bag: **450 zł** (owner, 2026-10-08 — po chwilowym 600 w szablonie). Katalog 600 → 450,
  szablon z powrotem na 450. Kosztorysy założone przed 2026-10-03 mają 600 i zostają bez zmian.
- Grzejnik: „з кранами / с кранами" (zawory w liczbie mnogiej), w katalogu i w obu pozycjach szablonu.
- 3× „Nowa praca" usunięte z szablonu.
- „Demontaże: wszelkie…": w katalogu zostają oba wpisy (stary 2000 zł i nowy z „armatura" 1000 zł).

- Kontenery: stawka z narzędziami w katalogu ze stałej 700 / 900 zł na auto, tak jak w szablonie.

Stan produ po porządkach (2026-10-08): wszystkie 302 prace szablonu mają wpis w katalogu i zgadzają
się z nim w każdym polu — cena, obie stawki **razem z trybem** (auto / mnożnik / kwota), tłumaczenia.

### Przejście na prodzie — runbook (wykonuje człowiek)

Kolejność ma znaczenie: kolumna jest addytywna, więc migracja idzie **przed** pushem.

1. Świeża kopia produ, ponowne porównanie szablonu z katalogiem (`sync/export.sh` + `sync/diff.ts`,
   wyżej). Rozjazd od ostatnich porządków rozstrzygnąć tak jak dotąd — szablon wygrywa.
2. `pnpm db:migrate:prod` — dodaje `kosztorys_items.catalogue_item_id` (stary kod jej nie czyta).
3. Push brancha / merge, deploy.
4. Link istniejących pozycji, najpierw na sucho:
   `DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD" node --env-file=.env --import tsx src/scripts/link-kosztorys-items-to-catalogue.ts`
   Każdy wypisany wiersz szablonu różniący się od katalogu poprawić (szablon wygrywa), aż lista
   będzie pusta; potem to samo z `--apply`.
5. Drugie uruchomienie na sucho musi pokazać 0 do podpięcia.
6. Skrypt pisze surowym SQL z pominięciem cache — dowolna edycja w katalogu prac odświeża szablony
   i kosztorysy.
7. Sprawdzenie: edytor „Kosztorys 2026 kolory" pokazuje te same liczby co przed przejściem (5 prac,
   w tym kontener ze stawką auto i big bag 450).

### Widok szablonu: kolumna „Komentarz do pracy"

Prośba ownera 2026-10-08: widok szablonu ma pokazywać kolumnę „Komentarz do pracy" (EX-1006).
Już pokazuje — stoi na zamkniętej liście kolumn szablonu (`WORKSHOP_VISIBLE_COLUMNS`) od
2026-10-07; owner potwierdził tego samego dnia. Nic do zrobienia.

### Osobno: jednorazowy skrypt tłumaczeń

Kierownik poprawia tłumaczenia RU/UK w „Kosztorys 2026 kolory" (2026-10-07: 61 prac, ~52 RU /
~53 UK zmian względem snapshotu 680; sekcje Kuchnia, stolarka, elektryka, wod-kan jeszcze
nieruszone). Po jego sygnale: skrypt przenosi poprawione tłumaczenia do katalogu, drugiego szablonu
i istniejących kosztorysów, dopasowując po opisie + j.m. Uwaga na 2 listwy, którym zmienił się opis —
nie dopasują się po kluczu.
