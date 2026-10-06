---
change_id: worker-expense-drafts-history
title: Historia zgłoszeń wydatków — strona menedżera i tabela na stronie pracownika
status: implemented
created: 2026-10-06
updated: 2026-10-06
archived_at: null
branch: staging
worktree: null
---

## Notes

— strona menedżera „Zgłoszenia wydatków” (historia zgłoszeń wydatków pracowników) + ta sama tabela
TanStack na stronie pracownika; domyślne limity na stronie pracownika (transakcje 20, zgłoszenia 10)

### Problem

Zgłoszenie wydatku przyjęte przez menedżera staje się transakcją, ale jego ślad ginie: menedżer nie
ma gdzie przejrzeć historii zgłoszeń (przyjętych, odrzuconych), a sekcja „Moje zgłoszenia wydatków”
na stronie pracownika listuje wszystkie zgłoszenia bez filtrów ani stronicowania — rośnie bez końca.

### Decyzje (właściciel, 2026-10-06)

- **Odwraca decyzję z EX-971** („Strona managera to lista Transakcji, bez osobnej podstrony”,
  `context/archive/2026-10-05-worker-expenses/change.md`): historia zgłoszeń dostaje własną stronę.
- **Nowa strona menedżera „Zgłoszenia wydatków”** — wariant „Zgłoszeń wykonanych prac”
  (`/zgloszenia-prac`): ten sam silnik TanStack (`components/tables/data-table/`), paginacja po URL,
  czekające na górze, rozpatrzone niżej. Filtry: status, pracownik, inwestycja, data wysłania.
  Kolumny: pracownik, inwestycja, wysłano, zdjęcia, notatka, status, decyzja (kiedy · kto), wydatek
  (przyjęty → kwota prowadzi do transakcji). Akcje: czeka → „Zobacz” (istniejący dialog), odrzucony
  → „Przywróć” (istniejący przycisk).
- **Pozycja w menu** obok „Zgłoszeń wykonanych prac”, z licznikiem czekających — jak tam.
- **Transakcje menedżera:** czekające zgłoszenia zostają przypięte na górze; plakietka
  „od pracownika” zostaje. **Znikają** odrzucone zgłoszenia na liście transakcji i przełącznik
  „Zgłoszenia” (`?workerDrafts`). Brak filtra po konkretnym pracowniku w Transakcjach.
- **Strona pracownika:** sekcja „Moje zgłoszenia wydatków” zastąpiona tą samą tabelą — zakres
  narzucony przez serwer (tylko on), bez kolumny i filtra „Pracownik”; akcje Edytuj / Usuń na
  czekających. Filtr zgłoszeń w jego Transakcjach niepotrzebny.
- **Bez zmian widoczności kolumn na telefonie** — tabela ta sama wszędzie, na 390 px przewija się
  w poziomie (strona pracownika musi działać na telefonie, EX-985).
- **Domyślne limity na stronie pracownika:** transakcje — 20 ostatnich (dziś 100 — `DEFAULT_LIMIT`), zgłoszenia —
  10 ostatnich. Starsze przez stronicowanie.

### Decyzje po researchu (właściciel, 2026-10-06)

- **Tabela zgłoszeń na stronie pracownika nie trzyma stanu w URL.** Serwer pobiera całą historię
  pracownika (jak dziś), tabela stronicuje po 10 w przeglądarce. Powód: dwie tabele z paginacją po
  URL na jednej stronie zderzają się na `page` / `limit` / `sort` / `investment` / `from` / `to`
  (research §4), a historia jednego pracownika to setki wierszy, nie tysiące. Brak filtrów i sortu
  na tej stronie. Strona menedżera zostaje na parametrach URL, jak `/zgloszenia-prac`.
- **„Wydatek” przy przyjętym zgłoszeniu = link do transakcji, jak w podsumowaniu kosztorysu**
  (`deposits-table.tsx` → `investmentTransfersHref`): lista transakcji inwestycji z wyszukiwaniem po
  ID, `/inwestycje/<id>?id=<transferId>`. Inwestycja = ta z transakcji, nie ze zgłoszenia (menedżer
  mógł ją zmienić przy akceptacji); bez `types` — typ wybiera menedżer w dialogu, a zgadnięty typ
  odfiltrowałby właśnie ten wiersz. **Pracownik nie może otworzyć transakcji** — u niego kwota bez
  linku (jak `preview` w podsumowaniu). Zgłoszenie przyjęte jako kilka pozycji linkuje pierwszą
  (znane ograniczenie, EX-971 review-gate :26).
- **Kolumna „Decyzja” (kiedy · kto) — u obu**, menedżera i pracownika.
- **Przyjęte zgłoszenia widoczne zawsze** (także z inwestycją w koszu / zablokowaną); **odrzucone
  z pracownikiem / inwestycją / kasą w koszu ukryte** — „Przywróć” i tak by je odrzucił
  (`PARTIES_NOT_TRASHED`).
