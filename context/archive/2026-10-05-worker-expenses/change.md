---
change_id: worker-expenses
title: Pracownik wpisuje wydatki inwestycyjne opłacone z własnej kasy (EX-971)
status: archived
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05T16:20:13Z
branch: staging # shared working tree
worktree: null
---

## Notes

EX-971 — pracownik sam wpisuje wydatek inwestycyjny (zakup materiału na budowę) opłacony ze swojej
kasy, zamiast przekazywać paragon managerowi do przepisania. **Stoi na EX-985**
(`2026-10-05-worker-account`): formularz żyje na stronie pracownika, której jeszcze nie ma.

### Stan wyjściowy (2026-10-05, lokalna kopia bazy)

- Zaliczka pracownika to `REGISTER_TRANSFER` na jego kasę; wydatki z tej kasy już istnieją, tylko
  wpisuje je manager. Nikolajewicz (kasa 37): 4 zaliczki = 9 958 zł, 29 wydatków = 9 816,92 zł,
  5 inwestycji, 26 z fakturą — wszystkie wpisane przez managera.
- Wydatek nie ma pola „Pracownik" (`needsWorker` = tylko `PAYOUT` / `BONUS`); jedyne powiązanie
  z pracownikiem to właściciel kasy-źródła. `PAYOUT` nie przechodzi przez kasę pracownika.
- Zapis z roli `EMPLOYEE` jest dziś zamknięty — `protectedAction` wpuszcza tylko `MANAGEMENT_ROLES`.
  Wydatek pracownika to pierwsza ścieżka zapisu dla tej roli.
- `canMutateTransfer` daje edycję/anulowanie każdemu, kto wpisał transakcję (`createdBy === user`)
  — szkic pracownika musi tego nie dziedziczyć.

### Kierunek (właściciel, 2026-10-05)

- Wejście: zalogowane konto pracownika (strona z EX-985), nie link z tokenem.
- Osobny przycisk „Dodaj wydatek" — tylko wydatek inwestycyjny, kasa do wyboru tylko spośród jego kas.
- Wydatek trafia jako **szkic**; manager uzupełnia i akceptuje — flow jak zgłoszenia prac (EX-947).

### Decyzje (właściciel, 2026-10-05)

- Pracownik **nie wpisuje kwoty, typu, kasy ani opisu**. Wybiera tylko inwestycję, dodaje zdjęcie
  faktury/paragonu (**wymagane**, jedno lub więcej) i opcjonalną notatkę. Kwotę, opis, VAT i resztę
  uzupełnia manager przy akceptacji — ręcznie albo przez AI z paragonu.
- Kasa = **domyślna kasa** pracownika, wstawiana sama.
- Inwestycje do wyboru: tylko te z „Moje inwestycje” (aktywne, na których etapach jest).
- Po wysłaniu pracownik widzi swoje szkice ze statusem „czeka / przyjęty / odrzucony”.
- **Strona managera to lista Transakcji, bez osobnej podstrony.** Czekające zgłoszenia są
  przypięte na górze listy z badge'em; filtr „Zgłoszenia pracowników” pokazuje je razem z wydatkami
  już z nich przyjętymi (badge „od pracownika”). Kliknięcie zgłoszenia otwiera dialog nowego
  wydatku wypełniony danymi od pracownika (inwestycja, kasa, zdjęcia, notatka) i tym, co AI
  odczyta z paragonu — manager uzupełnia brakujące pola i zapisuje. Zgłoszenie można też odrzucić.
  Wariant „zgłoszenie od razu jest transakcją bez kwoty” odrzucony: kwota 0 jest zabroniona,
  a każdy wydatek trafia do arkusza właściciela, linku inwestora i protokołu.

### Decyzje techniczne

- Szkic w **osobnej tabeli** (`worker_expense_drafts` + strony zdjęć), jak zgłoszenia prac — nie
  status na transakcji. Status na transakcji wymagałby wyłączenia szkiców z każdego zapytania SQL
  o saldo / materiały / marżę; jedno pominięte i szkic rusza saldo. Akceptacja tworzy prawdziwy
  wydatek istniejącą ścieżką i przepina na niego zdjęcia.
- Wgrywanie zdjęć przez EMPLOYEE: dziś `media.create` i token Blob (`clientUploads.access`) są tylko
  dla managementu — trzeba je otworzyć dla pracownika.

### Luki do zamknięcia (szczegóły: `research.md` §5)

- Skan referencji mediów (`MEDIA_RELATIONS`) nie zna surowej tabeli szkiców — reclaim mógłby
  skasować zdjęcie szkicu.
- Sprzątanie osieroconych zdjęć (`deleteOrphanedMediaAction`) jest za `protectedAction` (management)
  — nieudany submit pracownika zostawi pliki w Blob.
- Pracownik bez domyślnej kasy: przycisk niedostępny z komunikatem.
