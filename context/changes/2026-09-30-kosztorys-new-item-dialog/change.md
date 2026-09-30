---
change_id: kosztorys-new-item-dialog
title: Add a praca through a form dialog instead of a blank row
status: implemented
created: 2026-09-30
updated: 2026-09-30
archived_at: null
branch: kosztorys-new-item-dialog
worktree: ../wykonczymy-worktrees/kosztorys-new-item-dialog
---

## Notes

Linear: EX-951. (EX-951 names `worker-report/extra-work-dialog.tsx` as a reuse candidate; that file does not exist and the EX-947 extra-work rows carry no price or stawki — not a reuse base, see research.md.)

Replace the blank „Nowa praca" row with a form dialog (opis, j.m., cena j.m., stawki źródła) opened from:

- „Wstaw powyżej" / „Wstaw poniżej" in the praca menu — lands above/below that praca
- „Dodaj pracę" on the sekcja band and in the sekcja menu — lands at the end of the sekcja
- toolbar „Dodaj → Praca → [sekcja]" — end of that sekcja; with no sekcje, a sekcja is minted first, then the dialog opens

Decisions (owner, 2026-09-30):

- Optional „Dodaj pracę do katalogu prac" checkbox saves the katalog entry in the same transaction.
- Kategoria is shown only while that checkbox is on, prefilled with the sekcja's name.
- A stawka on „auto" = no override on the praca (investment współczynnik), same as today.
- „Nie zamykaj po zapisaniu" stays; each next praca lands under the one just saved.
- Katalog collision on opis + j.m.: confirm before overwriting (old vs new stawki, as „Zapisz pozycję do katalogu prac" does); declining saves the praca to the kosztorys only.
- No Przedmiar in the dialog.
- The blank-row path is removed everywhere.
