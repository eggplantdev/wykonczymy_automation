---
change_id: worker-view-dogfooding
title: Worker view dogfooding — fixes found using the merged „Zgłoszenie prac" view
status: implemented
created: 2026-10-05
updated: 2026-10-05
archived_at: null
branch: staging
worktree: null
---

## Notes

Dogfooding jednego widoku pracownika po EX-966 — poprawki znalezione przy używaniu „Zgłoszenia prac" z „Podsumowaniem" i „Podglądu pracownika"

### Uwagi z dogfoodingu (właściciel, 2026-10-05)

1. **Adres linku.** Zamiast `/zgloszenie-prac/<pracownik>/<token>` adres ma kształt
   `/z/<inwestycja>/<pracownik>/<token>`. Stare linki `/zgloszenie-prac/…` przestają działać, bez
   przekierowania (decyzja właściciela) — po wdrożeniu właściciel wysyła pracownikom nowe linki.
   „Podgląd pracownika” bez zmian.
2. **Stała stopka z przełącznikiem trybu** — przyklejona do dołu ekranu na każdej szerokości (to
   jedyny przełącznik), czarno-biała, żeby było ją widać. Zastępuje przycisk „Podsumowanie" nad
   rozpiską i przełącznik „Wszystkie kolumny".
   - **„Zgłoszenie prac"**: widok kompaktowy z zieloną kolumną „Zgłaszam", „+ Nowa praca" /
     „Wyślij", wysłane zgłoszenia, „Tylko zgłaszane przeze mnie".
   - **„Podsumowanie"**: wszystkie kolumny, **bez** „Zgłaszam" i „Czeka" — tylko zgłoszone
     i zaakceptowane wartości, czyli to, co pokazywał dotychczasowy link pracownika (`/p`). Bez
     „Tylko zgłaszane przeze mnie"; pod tabelą rozliczenie („Wykonane", „Twoje rozliczenie") wprost,
     bez zwijanego panelu.
   - Szukajka jest w obu trybach.
   - Zmiana trybu zaczyna od góry strony i zeruje filtry; wpisane ilości przeżywają ją (z draftu).
   - „Podsumowanie" jest szersze niż telefon — obie strony (link i „Podgląd pracownika") mają
     `minimumScale: 1` (`REPORT_VIEWPORT`), inaczej przeglądarka oddala widok i stopka jedzie po
     arkuszu. Nagłówek i stopka są przyklejone do lewej krawędzi, gdy strona przewija się w bok.

   **Zrobione od razu (do obejrzenia, bez commita).** Do poprawy przy implementacji: spec
   `worker-report-form.test.tsx` i dwa manual checki EX-966 opisują stary panel „Podsumowanie".

3. **Rozliczenie pod tabelą wygląda jak stopka PDF-a pracownika**, nie jak siatka: tabele bez
   ramek, wyrównane do prawej, szare etykiety, nagłówek z kreską pod spodem, „Pozostało do wypłaty"
   pogrubione z czarną kreską nad; odstęp nad i pod. **Zrobione od razu (bez commita).** Do poprawy
   przy implementacji: `worker-summary.test.tsx` szuka komórek po DOM-ie siatki (`div.grid`,
   `div.contents`) — 8 testów czerwonych, trzeba przepisać pomocniki na `table`/`tr`.
4. **Bez tytułu „Zgłoszenie wykonanych prac" w nagłówku** — w trybie „Podsumowanie" mylił; tryb
   mówi przełącznik w stopce. Zostaje logo, inwestycja, pracownik i język (także na stronie
   komunikatu). Usunięte nieużywane klucze `title` i `allColumns` (pl/uk/ru). **Zrobione od razu
   (bez commita).**
5. **Liczniki przy przełącznikach** — „Wszystkie prace (+N)” liczy prace, które przełącznik
   odsłoni (jak „Pokaż wszystkie pozycje (+N)” u inwestora; przy zerze bez licznika), „Tylko
   zgłaszane przeze mnie (N)” liczy prace z wpisaną ilością w szkicu, na żywo. „Wyślij (N)” liczy
   wszystkie linie, które pójdą w zgłoszeniu (prace z rozpiski + nowe prace). **Zrobione od razu
   (bez commita).**
6. **Etykiety przełącznika w stopce: „Zgłaszam pracę” / „Inwestycja”** (uk „Заявляю роботу” /
   „Об'єкт”, ru „Заявляю работу” / „Объект”). Krótka druga etykieta, bo „Podsumowanie inwestycji”
   nie mieści się obok pierwszej na 390px. Tytuł karty strony („Zgłoszenie prac”) bez zmian.
   **Zrobione od razu (bez commita).**
