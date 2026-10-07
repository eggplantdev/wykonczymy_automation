---
change_id: template-from-catalogue
title: Szablon jako lista prac z katalogu — ceny wyłącznie w katalogu prac
status: new
created: 2026-10-07
updated: 2026-10-07
archived_at: null
branch: null
worktree: null
---

## Notes

Ustalenia wstępne z rozmowy z ownerem 2026-10-07 — kształtowanie, nic nie zaimplementowane.
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
7. **Praca w kosztorysie pamięta swój wpis katalogu** (id). Unikalne id już identyfikuje
   tłumaczenia przy zgłaszaniu pracy.
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
   „Kosztorys 2026": 307 / 310 dopasowanych, 0 różnic cen. Co z niedopasowanymi przy przejściu?
2. **Istniejące kosztorysy:** czy przy przejściu ich prace dostają zapamiętany wpis katalogu
   (dopasowanie po opisie + j.m.), czy tylko kosztorysy zakładane od teraz?
3. **Zmiana / usunięcie wpisu katalogu, który jest w szablonie:** samo ostrzeżenie, czy usunięcie
   zablokowane?

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
wynegocjowana czy nowa stawka? Jeśli wynegocjowana — oferta Dębowskiej jest zaniżona o 150 zł,
a „kolory" trzeba wyrównać do katalogu.

### Osobno: jednorazowy skrypt tłumaczeń

Kierownik poprawia tłumaczenia RU/UK w „Kosztorys 2026 kolory" (2026-10-07: 61 prac, ~52 RU /
~53 UK zmian względem snapshotu 680; sekcje Kuchnia, stolarka, elektryka, wod-kan jeszcze
nieruszone). Po jego sygnale: skrypt przenosi poprawione tłumaczenia do katalogu, drugiego szablonu
i istniejących kosztorysów, dopasowując po opisie + j.m. Uwaga na 2 listwy, którym zmienił się opis —
nie dopasują się po kluczu.
