---
change_id: premia
title: Premia — wyrównanie nadpłaty pracownika, niewidoczne dla inwestora
status: implemented
created: 2026-10-02
updated: 2026-10-02
archived_at: null
branch: premia
worktree: null
linear: EX-979
---

## Goal

Pracownik dostał więcej, niż wynosi jego wykonana praca („Pozostało do wypłaty" < 0 na zakładce
Podwykonawcy). Nadwyżkę wyrównujemy jako premię — niewidoczną dla inwestora.

## Decisions (owner, 2026-10-02)

- Inwestor nie widzi arkusza właściciela (zakładka „transfery").
- Premia nie zawsze jest związana z inwestycją.
- Premię przyznaje tylko OWNER / ADMIN (odwrócone tego samego dnia; pierwotnie także MANAGER).
- Premia bez inwestycji zostaje jak dziś: wypłata bez inwestycji (kasa, poza „Pozostało do wypłaty").
  Nowy typ „Premia" służy wyłącznie do wyrównania na parze inwestycja × pracownik — bez kasy,
  pracownik i inwestycja wymagane.
- Pracownik widzi premię jako osobną linię „Premia" na swoim podsumowaniu (link + PDF).
- Premię księguje się na dwa sposoby: z ogólnego okna transakcji ORAZ jednym kliknięciem
  „Wyrównaj nadpłatę premią" przy nadpłaconej parze (kwota podstawiona).
- Jedno kliknięcie żyje tylko w oknie „Rozlicz wypłaty" (przy nadpłaconym wierszu). Zakładka
  Podwykonawcy nie ma własnego przycisku premii — otwiera to samo okno dla inwestycji, żeby od razu
  rozliczyć też pozostałe wypłaty. To samo zachowanie wszędzie.

Research: `research.md`.
