---
change_id: kosz-plikow
title: Kosz plików — odroczone kasowanie z Bloba zamiast natychmiastowego
status: planned
created: 2026-09-22
updated: 2026-09-22
archived_at: null
branch: null
worktree: null
---

## Notes

Odroczone kasowanie plików z Bloba i kosz z przywracaniem (zamiast natychmiastowego
`deleteUnreferencedMedia`); zamyka też EX-833.

Dziś każde odpięcie pliku (`setUploadField`) kończy się `deleteUnreferencedMedia`, czyli
skasowaniem wiersza `media` i bajtów w Blobie, jeśli nikt inny ich nie trzyma. Blob nie ma
undelete. Jedyna siatka bezpieczeństwa to nocny mirror na FTP (`blob-backup.yml`, 03:30 UTC,
**nigdy nie kasuje**) — czyli bajty przeżywają, ale odzysk jest ręczny (runbook + człowiek),
a plik wgrany i skasowany tego samego dnia ginie naprawdę.

## Decyzje z rozmowy (2026-09-22)

- **„Zakończona" inwestycja nie dostaje bramki na usuwanie assetów.** Rozstrzygnięcie właściciela:
  zamrożenie statusu jest istotne w finansach, nie w dodanych zdjęciach. Zamyka otwarty box bramki
  `kosztorys-editor-assets` — razem z zarzutem o drugie drzwi z edytora (ta sama kontrolka, to samo
  potwierdzenie, te same role; „Usuń wszystkie" zatwierdzone przez właściciela 2026-09-21
  w `investment-assets-dialog`).
- **Kształt: kosz „2a" — odpięcie zostaje prawdziwe, dochodzi zapis prowenancji.** Wiersz w
  `*_rels` znika tak jak dziś; osobny zapis trzyma „media N zeszło z `<kolekcja>/<id>/<pole>` o T".
  Przywracanie czyta ten zapis i przypina z powrotem przez `setUploadField`.
- **Odrzucone: kosz „2b" (flaga na media, plik zostaje przypięty).** Kuszące, bo prowenancja jest
  za darmo, a Payload 3.73 ma wbudowany `trash`. Ale galeria inwestycji czyta **surowym SQL-em**
  (`src/lib/queries/investment-assets.ts`), więc filtr Payloada jej nie dotyczy i trzeba go dopisać
  ręcznie — jedno pominięte miejsce pokazuje „skasowane" zdjęcie klientowi na linku share.
  Ryzyko asymetryczne: w 2a ta awaria nie ma jak zajść, bo odpięty plik nie ma się gdzie pokazać.
- **Zapisujemy od razu „skąd", nie tylko „kiedy".** To ta sama klasa migracji, a różnica decyduje,
  czy przywracanie może być kiedykolwiek przyciskiem zamiast ścieżki przez panel.
- **Dwie fazy, pierwsza samodzielnie użyteczna.** Faza 1: odroczone kasowanie + zamiatanie nocne +
  odzysk z panelu Payloada (przypięcie pliku w polu „Zdjęcia i pliki" na inwestycji). Faza 2:
  zapytanie o kosz, akcja przywracania, „Kosz (N)" w kontrolce galerii.
- **Wszystkie pliki traktujemy po równo — jeden kosz, nie kosz per powierzchnia.** Rozstrzygnięcie
  właściciela: nie ma podziału „faktury tak, zdjęcia z budowy siak". Zapis odpięcia siedzi na szwie
  `setUploadField`, więc i tak obejmuje wszystkie pięć relacji (`transactions.invoice`,
  `investments.assets`, `leads.assets`, `vehicle-inspections.attachments`,
  `equipment-events.attachments`) — a skoro dane są jednorodne, to i okno łaski, zamiatanie
  i przywracanie są jedną regułą dla każdego pliku. Konsekwencja dla fazy 2: powierzchnia kosza
  musi być wspólna (jedna kontrolka/zapytanie parametryzowane relacją), a nie doklejana osobno do
  galerii inwestycji i osobno do komórki faktury.
- **Plik leży w koszu 7 dni.** Rozstrzygnięcie właściciela. Podłogą jest pełna doba, bo kopia na FTP
  powstaje raz dziennie o 03:30, a sprzątanie leci o 03:00 — przy krótszym terminie plik ginie pół
  godziny przed swoją jedyną kopią. Powyżej doby liczba jest funkcją tego, ile nieudanych nocy kopii
  ma przeżyć plik: mirror jest all-or-nothing (przerwany przebieg nie wysyła nic), więc 7 dni znaczy
  „siedem porażek z rzędu". Czytelnie dla właściciela: skasowane w poniedziałek wraca do następnego
  poniedziałku.

- **Panel Payloada nie dostaje blokady na pliki leżące w koszu.** Rozstrzygnięcie właściciela: „jak ktoś
  wywali zdjęcia ręcznie w adminie, to już trudno". Czyli `preventReferencedMediaDelete` zostaje bez
  zmian — odmawia tylko na pliku, który ktoś realnie trzyma, a plik w koszu z definicji nie ma
  referencji i przechodzi. Kosz jest siatką na pomyłkę w aplikacji, nie ochroną przed adminem, który
  wszedł do panelu i kasuje świadomie. Ubocznie zostaje ręczna furtka do natychmiastowego zwolnienia
  miejsca.

- **Skasowanie wydatku kasuje jego fakturę od razu — bez kosza.** Rozstrzygnięcie właściciela: samego
  skasowania wydatku i tak nie da się cofnąć, więc trzymanie jego faktury przez 7 dni niczego nie
  ratuje — nie ma dokąd jej przywrócić. `deleteInvoiceMediaAfterDelete`
  (`src/hooks/transfers/delete-invoice-media.ts`) zostaje bez zmian, a jego sześć przypadków testowych
  przeżywa. To nie jest wyłom w „wszystkie pliki po równo": reguła dotyczy odpinania pliku od żywego
  dokumentu, a tu znika cały dokument.

- **Sprzątanie po nieudanym zapisie formularza zostaje natychmiastowe.** `deleteOrphanedMediaAction`
  i rollback webhooka landingu dotyczą plików, które nigdy nie były do niczego przypięte — nie mają
  prowenancji do zapisania i nie ma dokąd ich przywracać.

- **EX-833 zamyka się przy okazji.** Pętla licząca referencje (do 6N zapytań) wypada ze ścieżki
  użytkownika do nocnego crona — `/api/cron/cleanup` jest wprost opisany jako miejsce na kolejne
  zamiatania.
- **Potwierdzenie przestaje straszyć.** `ConfirmDialog` mówi dziś „Plik zostanie usunięty
  bezpowrotnie." w liczbie pojedynczej i bez liczby plików. Przy koszu ma mówić prawdę
  („trafi do kosza na N dni") i nazywać liczbę.
