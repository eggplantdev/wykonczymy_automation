---
change_id: worker-reports-on-worker-page
title: Zgłoszenia wykonanych prac na stronie pracownika, z podglądem zgłoszenia
status: implementing
created: 2026-10-06
updated: 2026-10-06
archived_at: null
branch: feature/worker-reports-on-worker-page
worktree: ../wykonczymy-worktrees/worker-reports-on-worker-page
---

## Notes

— Zgłoszenia wykonanych prac na stronie pracownika, z podglądem zgłoszenia

### Problem

Pracownik nie ma na swojej stronie (`/pracownicy/[id]`) historii własnych zgłoszeń wykonanych prac.
Jedyny ślad to „Wysłane zgłoszenia” na stronie z linkiem do zgłaszania (`sent-reports.tsx`) — data
i liczba pozycji, bez statusu, bez szczegółów, bez otwarcia.

### Decyzje (właściciel, 2026-10-06)

- **Tabela „Zgłoszenia wykonanych prac” na stronie pracownika — wariant tabeli zgłoszeń wydatków**
  (`worker-expense-drafts-table.tsx`): serwer pobiera całą historię pracownika, tabela stronicuje
  i filtruje w stanie komponentu, nie w URL — ten sam powód co tam (kolizja z URL-owymi Transakcjami).
  Kolumny jak na `/zgloszenia-prac` bez „Pracownik”.
- **Pracownik musi móc otworzyć zgłoszenie.** Ścieżka menedżera (wiersz → edytor
  `/inwestycje/<id>/kosztorys_v2?zgloszenie=<id>`, weryfikacja) odpada: edytor jest tylko dla
  zarządu (`requireManagementPage`) i tylko na komputer, a strona pracownika musi działać na 390 px
  (EX-985). Stąd nowy **podgląd tylko do odczytu** (okno z wiersza tabeli).
- **Podgląd pokazuje przy każdej pozycji ilość zgłoszoną i ilość przyjętą** (albo „odrzucona”),
  także dla prac dodatkowych.
- **Tłumaczenia:** nagłówki w `components/tables/worker-reports.tsx` są wpisane po polsku — tabela
  na stronie pracownika mówi językiem jego konta (EX-996), więc dostają tłumaczenia.
- **Start dopiero po commicie bieżącego review strony pracownika**
  (`worker-expense-drafts-history`) — ta sama `pracownicy/[id]/page.tsx`.
- **`/zgloszenia-prac` przestaje przenosić do kosztorysu kliknięciem w wiersz.** Wejście do
  edytora ma być świadome: kolumna akcji „Otwórz w kosztorysie” (dzisiejszy `reportHref`) /
  „Podgląd” (ten sam podgląd tylko do odczytu co u pracownika, otwierany na miejscu — okno na
  liście, bez przejścia na inną stronę). Ta sama para akcji u menedżera na
  stronie pracownika; pracownik dostaje tylko „Podgląd”.
- **„Wysłane zgłoszenia” na stronie z linkiem zostają bez zmian** (`sent-reports.tsx` — sam tekst
  „data · liczba pozycji”, nieklikalny). Podgląd otwiera tylko zalogowany użytkownik, nie token linku.
- **Podgląd = okrojona tabela weryfikacji, nie nowy widok.** Okno weryfikacji w edytorze
  (`review-lines-table.tsx`, silnik `tables/data-table/`) na telefonie wygląda dobrze (właściciel);
  bez elementów decyzji menedżera (zaznaczanie, pole ilości, przypisywanie pozycji, katalog, sekcja
  docelowa, cena) zostaje sama tabela: nr, sekcja, opis, zgłoszono, przyjęto.
- **Na stronie pracownika także skany** wprowadzone za niego przez menedżera — nie tylko zgłoszenia
  z linku (inaczej niż `linkOnly` na stronie z linkiem). Tabela oznacza źródło: „z linku” / „skan”.
- **Podgląd skanu pokazuje pracownikowi zdjęcia papierowej rozpiski** (właściciel, po researchu).
- **Czekające zgłoszenie nazywa się wszędzie „Do sprawdzenia”** — na liście kierownika, na stronie
  pracownika i w podglądzie; jedna plakietka dla wszystkich (właściciel, przy planowaniu).
- **Kolumny „Źródło” i „Decyzja” (kiedy · kto) na obu listach** — także na `/zgloszenia-prac`, która
  dodatkowo ma „Pracownik” (właściciel, przy planowaniu).
- **Wiersz na `/zgloszenia-prac` nie jest klikalny** — tylko przyciski „Podgląd” / „Otwórz
  w kosztorysie”; tabela nie ma dziś kliknięcia wiersza poza przejściem pod adres.

### Domyślne (bez pytania właściciela)

- Język opisu w podglądzie: pracownik — jego język; menedżer — opis polski + opis pracownika, jak
  w oknie weryfikacji.
- Czekające zgłoszenie: w „przyjęto” napis „czeka”, nie pusta komórka.
- Filtry tabeli u pracownika: „Status”, „Inwestycja”, „Pokaż” — jak przy zgłoszeniach wydatków.
- Zgłoszenia na inwestycji zakończonej / w koszu widoczne zawsze; „Otwórz w kosztorysie” działa,
  przyjąć ani odrzucić się ich nie da (bramka edytora).

### Follow-up (poza tym change'em)

- **Edycja / usunięcie czekającego zgłoszenia prac przez pracownika** — jak Edytuj / Usuń przy
  czekającym zgłoszeniu wydatku. Dziś po wysłaniu zgłoszenia nie da się zmienić ani usunąć: jedyna
  akcja pracownika to `sendWorkerReportAction`, menedżer może tylko odrzucić
  (`rejectWorkerReportAction`).
