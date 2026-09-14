---
change_id: row-conditions-registry-engine-split
title: Rozbicie row-conditions.ts na rejestr (dane) i mechanizmy (zapytania)
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02
branch: row-conditions-registry-engine-split
worktree: null
---

## Notes

EX-765, zgłoszone przez bramkę review gałęzi `kosztorys-contractor-price-columns-in-client-view`
(`context/archive/2026-09-01-kosztorys-dwie-opcje-zrodla-ceny-wykonawcy/review-gate.md:32`). Ten sam
finding był wcześniej dwa razy pominięty (08-17, 08-18) jako „własne review".

Refaktor **bez zmiany zachowania**: rozdzielić 22-wpisowy rejestr `ROW_CONDITIONS` od warstwy zapytań
(`applyRowConditions`, `columnsRevealedBy`, `engagedPlane`, `isFoldSuppressed`, `countMatching`,
`sectionIdsWhereAllMatch`, …). Research: `research.md`.
