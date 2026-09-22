---
change_id: investment-assets-dialog
title: Galeria inwestycji bez miniatur — podgląd i dodawanie plików przez dialog
status: archived
created: 2026-09-21
updated: 2026-09-21
archived_at: 2026-09-21
branch: null
worktree: null
---

## Notes

galeria inwestycji bez miniatur: przycisk otwierający podgląd (pobieranie/druk/usuwanie w dialogu),
„Dodaj pliki" przez ten sam dialog co faktura, oraz dodawanie plików z dialogu „Edytuj inwestycję"

Ustalenia z rozmowy (2026-09-21), wszystkie potwierdzone przez właściciela:

1. **Zero plików → żadnego przycisku podglądu**, zostaje samo „Dodaj pliki". Przy N ≥ 1 przycisk
   „Zdjęcia i pliki (N)" otwiera `InvoicePreviewDialog`. Miniatur nie ma wcale — w 99% przypadków
   nikt nie chce ich oglądać, chce pobrać.
2. **Usuwanie przenosi się do stopki dialogu** — „Usuń" (bieżący plik) i „Usuń wszystkie", tak jak
   przy fakturach, z tym samym `ConfirmDialog`. `MediaStrip` znika z sekcji inwestycji (zostaje
   u leada, read-only).
3. **Dodawanie z „Edytuj inwestycję" idzie natychmiastowo** przez `addInvestmentAssetsAction`, nie
   przez stan formularza — inwestycja już istnieje, więc to ta sama semantyka co faktura w tabeli
   transferów: wybór pliku JEST zapisem. Świadoma konsekwencja: „Anuluj" w formularzu nie cofa
   dodanych plików. Odrzucony wariant: zbieranie do stanu formularza i dopinanie przy „Zapisz" —
   wymagałby, żeby `updateInvestmentAction` dopisywał `assets` zamiast nadpisywać (dziś celowo je
   wycina, bo nadpisanie pustą listą skasowałoby galerię).

Cała mechanika istnieje już po stronie faktur (`InvoicePreviewDialog` z pagerem/drukiem/zipem,
`InvoiceUploadDialog`, `InvoicePreviewButton`/`Trigger`). Praca to odsłonięcie w nich labeli/tytułu
i przepięcie na `MediaFileT` — czyli przy okazji kawałek **EX-826** (przenosiny `lib/invoices` →
`lib/media`).
