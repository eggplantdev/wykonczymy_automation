---
change_id: empty-preset-create
title: Nowy pusty szablon kosztorysu zakładany z poziomu /szablony
status: implemented
created: 2026-09-22
updated: 2026-09-22
archived_at: null
branch: empty-preset-create
worktree: null
---

## Notes

Dziś szablon rodzi się wyłącznie z istniejącego kosztorysu („Zapisz jako szablon" w edytorze,
`savePresetAction`). Na `/szablony` brakuje założenia pustego szablonu — lista umie tylko otworzyć
w warsztacie, przemianować i usunąć.

Zakres uzgodniony w rozmowie:

- akcja zakładająca szablon z pustym payloadem (`insertPreset`, domyślne współczynniki + VAT),
- przycisk + dialog z nazwą na `/szablony`,
- po zapisie od razu otwarcie w warsztacie (`useOpenPreset`), bo pusty szablon bez wejścia do
  warsztatu jest bezużyteczny.

Decyzja właściciela: pusty szablon **pojawia się** w wyborze przy zakładaniu inwestycji — bez
filtrowania szablonów z zerem sekcji.
