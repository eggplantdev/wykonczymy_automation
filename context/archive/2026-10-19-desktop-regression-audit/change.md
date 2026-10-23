---
change_id: desktop-regression-audit
title: Desktop audit (1280 px) combined with a regression click-through after the October refactor
status: archived
created: 2026-10-19
updated: 2026-10-23
archived_at: 2026-10-23T10:18:31Z
branch: staging
worktree: null
---

## Notes

Audyt desktopowy (1280 px, rzut oka na 1024 px) połączony z przeklikaniem całej aplikacji pod kątem regresji po dużym refaktorze z 17–19.10 (app-audit-refactor i in.). Matryca trasa × rola (ADMIN/OWNER/MANAGER/EMPLOYEE) jako checklista w plan.md, kolejność wg diffu z ostatnich dni; jeden ledger z kategoriami regresja / układ / wątpliwe; etapy po rolach z commitem i raportem wizualnym (Artifact ze zrzutami) po każdym. Główny checkout, istniejący dev serwer, lokalna baza 5435. Worktree desktop-1280-qa zostaje nieruszony.

Cel zmieniony na wdrożony staging (preview DB, konta QA) zamiast :3010/5435 — decyzja użytkownika 2026-10-19.

Raport wizualny: https://claude.ai/artifact/PW6JHXrRSbo3c96fmrjKa5

## Decisions (owner, 2026-10-19)

- Kierownik w edytorze kosztorysu widzi kwoty sekcji i tabele podsumowania; ukryta jest tylko „Marża”.
- Szablon nie pokazuje „Filtry” jak kosztorys — oferuje tylko filtry „Cena j.m.”, i to wtedy, gdy
  dzielą prace.
- Kierownik nie przełącza statusu „Aktywny/Nieaktywny” na kontach właściciela, admina, innego kierownika
  ani na własnym — na tych wierszach status jest zwykłym znaczkiem.
