---
change_id: transfer-print-return
title: Drukowanie przefiltrowanej listy transakcji (chudy powrót)
status: implemented
created: 2026-09-14
updated: 2026-09-14
branch: transfer-print-return
worktree: null
---

## Notes

Właściciel zgłosił, że drukowanie transakcji z karty inwestycji **było używane**. Zostało usunięte
2026-08-12 przez EX-672 razem z eksportem CSV, na decyzję właściciela, że obie funkcje są niepotrzebne.

**Zakres jest wąski i przesądzony: wraca sam wydruk wierszy — bez nagłówka z figurami finansowymi.**
Ten nagłówek był całym problemem, przez który funkcję wycięto (liczył własny „Bilans" jako sumę
zaznaczonych kafelków v1 przez globalny store). Bez niego nie ma drugiego czytnika figur, nie ma
konieczności deklarowania płaszczyzny v1/v2 i nie wraca dług w `pnpm test:parity`.

Decyzje podjęte 2026-09-14 (właściciel):

- **Zakres wydruku** — cały przefiltrowany zbiór, wszystkie strony. Jak w oryginale.
- **Anulowane i rekordy `CANCELLATION`** — nieobecne na wydruku. Jak w oryginale (`7a41e71a`).
- **Sortowanie** — odtwarzane na dociągniętym zbiorze. Jak w oryginale.
- **Widoczność kolumn** — honorowana. Jak w oryginale.
- **Kolejność kolumn** — honorowana. **Jedyna rzecz ponad oryginał** — `ranks` doszło 2026-08-26,
  wydruk musi je czytać, inaczej rozjedzie się z ekranem.

**E2E odwołane (właściciel, 2026-09-14, w trakcie implementacji).** Faza 3, zmiana 4 planu zakładała
issue w backlogu `e2e-backlog` na spec browserowy. Właściciel odwołał to wprost („żadnego e2e"), więc
issue nie powstało i żaden spec Playwrighta nie jest tej zmianie należny. Weryfikacja wydruku jest
w całości ręczna — `context/foundation/manual-checks.md`, sekcja `transfer-print-return`.

To nie jest revert — siedem modułów, na których wisiał patch, nie istnieje już pod tymi nazwami, a
trzy zachowania zmieniły się po usunięciu. Szczegóły w `research.md` § „Why a revert cannot land".
