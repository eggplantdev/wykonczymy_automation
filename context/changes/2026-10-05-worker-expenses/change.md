---
change_id: worker-expenses
title: Pracownik wpisuje wydatki inwestycyjne opłacone z własnej kasy (EX-971)
status: new
created: 2026-10-05
updated: 2026-10-05
archived_at: null
branch: null
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

### Pytania otwarte

- Model szkicu: osobna tabela czy status na transakcji? Szkic nie może ruszyć salda kasy ani
  materiałów inwestycji przed akceptacją.
- Które inwestycje pracownik może wybrać — wszystkie aktywne czy te, do których jest przypisany?
- Brutto/netto: wybiera manager przy akceptacji?
- Zdjęcie paragonu z telefonu: wymagane czy zalecane?
- Co pracownik widzi po wysłaniu (czeka / zaakceptowany / odrzucony)?
