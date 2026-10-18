---
change_id: kosz-plikow
title: Kosz plików — odroczone kasowanie z Bloba zamiast natychmiastowego
status: in_review
created: 2026-09-22
updated: 2026-10-18
archived_at: null
branch: feat/kosz-plikow
worktree: .claude/worktrees/kosz-plikow
---

## Notes

Odroczone kasowanie plików z Bloba i kosz z przywracaniem (zamiast natychmiastowego
`deleteUnreferencedMedia`).

Dziś każde odpięcie pliku (`setUploadField`) kończy się `reclaimUnreferencedMedia`, czyli
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
- **„Usuń wszystkie" w galerii inwestycji schowane do czasu kosza (EX-862, 2026-10-15).**
  Rozstrzygnięcie właściciela: dopóki usunięcie jest bezpowrotne, jedno kliknięcie nie może wyczyścić
  całej galerii — zostaje usuwanie po jednym pliku. Wraca w fazie 1, razem z tym, że odpięcie
  przestaje kasować. Akcja `removeAllInvestmentAssetsAction` została w kodzie; schowany jest tylko
  przycisk. Faktury na transakcjach zachowują swoje „Usuń wszystkie" bez zmian.
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
  odzysk z panelu Payloada (przypięcie pliku w polu „Zdjęcia i pliki" na inwestycji). Potem:
  sekcja „Pliki" na stronie Kosz z przywracaniem (patrz decyzje z 2026-10-18).
- **Wszystkie pliki traktujemy po równo — jeden kosz, nie kosz per powierzchnia.** Rozstrzygnięcie
  właściciela: nie ma podziału „faktury tak, zdjęcia z budowy siak". Zapis odpięcia siedzi na szwie
  `setUploadField`, więc i tak obejmuje wszystkie pięć relacji (`transactions.invoice`,
  `investments.assets`, `leads.assets`, `vehicle-inspections.attachments`,
  `equipment-events.attachments`) — a skoro dane są jednorodne, to i okno łaski, zamiatanie
  i przywracanie są jedną regułą dla każdego pliku. Konsekwencja dla fazy 2: powierzchnia kosza
  musi być wspólna (jedna kontrolka/zapytanie parametryzowane relacją), a nie doklejana osobno do
  galerii inwestycji i osobno do komórki faktury. Od 2026-10-18 tą powierzchnią jest strona Kosz.
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

- **Tak samo natychmiastowe zostają dwie ścieżki, które powstały po tym planie:** pracownik kasujący
  własne zgłoszenie wydatku (`deleteExpenseDraftAction`) i „Usuń na zawsze" zgłoszenia z Kosza
  (`erase-lead.ts`). W obu znika cały dokument, więc to ta sama reguła co przy wydatku.

- **EX-833 zamknięty osobno (Done).** Liczenie referencji poszło do `after()` i jest zbiorcze
  (`reclaimUnreferencedMedia`). Ta zmiana i tak wyjmuje je ze ścieżki użytkownika całkiem.
- **Potwierdzenie przestaje straszyć.** `ConfirmDialog` mówi dziś „Plik zostanie usunięty
  bezpowrotnie." w liczbie pojedynczej i bez liczby plików. Przy koszu ma mówić prawdę
  („trafi do kosza na N dni") i nazywać liczbę.

## Decyzje z rozmowy (2026-10-18) — przywracanie

Od czasu planu powstała wspólna strona Kosz (`/kosz`, siedem rodzajów, 30 dni). Rozstrzygnięcia
właściciela:

- **Pliki przywraca się z sekcji „Pliki" na stronie Kosz** — nie przyciskiem „Kosz (N)" przy galerii,
  komórce faktury i plikach zgłoszenia. Jedno miejsce, ta sama strona co reszta kosza.
- **Pliki bez znanego źródła nie pokazują się w Koszu.** To pliki po inwestycji, pojeździe albo
  sprzęcie usuniętym na zawsze — nie mają dokąd wrócić, a ich utratę zapowiada już potwierdzenie
  („przypięcia zdjęć"). Po 7 dniach znikają same; kopia zostaje na FTP. To samo dotyczy pliku, którego
  rodzic zniknął już po odpięciu.
- **Plik w Koszu nie ma „Usuń na zawsze".** Znika sam po 7 dniach; ręczną furtką zostaje panel
  Payloada (decyzja wyżej). Dzięki temu reguła „wpisz nazwę przy Usuń na zawsze" nie potrzebuje
  wyjątku.
- **Plik odpięty od inwestycji, która sama leży w Koszu, jest widoczny, ale nie do przywrócenia** —
  wyszarzony z dopiskiem „najpierw przywróć inwestycję". Przywrócenie pliku nie przywraca inwestycji.
