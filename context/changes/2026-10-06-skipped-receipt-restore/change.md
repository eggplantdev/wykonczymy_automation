---
change_id: skipped-receipt-restore
title: Pominięty paragon — „Przywróć” i filtr statusu na „Zgłoszenia wydatków”
status: preparing
created: 2026-10-06
updated: 2026-10-06
archived_at: null
branch: staging
worktree: null
---

## Notes

EX-1009, follow-up EX-1005 (`worker-expense-drafts-history`).

### Problem

Paragon, który menedżer wyrzucił z formularza przy przyjmowaniu reszty zgłoszenia, stoi na liście
jako osobny wiersz „odrzucony” pod przyjętym zgłoszeniem — bez „Przywróć”. Filtr „Status” na
„Zgłoszenia wydatków” czyta status całego zgłoszenia, więc „odrzucony” nie pokazuje pominiętych
paragonów, a „przyjęty” pokazuje wiersze z plakietką „odrzucony”.

### Decyzje (właściciel, 2026-10-06)

- Pominięty paragon musi dać się przywrócić.
- Filtr statusu musi łapać pominięte paragony.
- Jak dokładnie — do researchu.
