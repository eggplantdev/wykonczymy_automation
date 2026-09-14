---
change_id: drag-drop-guard
title: Blokada nawigacji przy chybionym dropie pliku + widoczna dropzone w trakcie przeciągania
status: planned
created: 2026-09-14
updated: 2026-09-14
archived_at: null
branch: null
worktree: null
---

## Notes

Przeciągnięcie pliku obok dropzone powoduje, że przeglądarka otwiera plik jako dokument
(domyślna akcja `drop` na dokumencie). Chcemy to zablokować — ale **tylko tam, gdzie
drag&drop faktycznie istnieje**, nie globalnie w layoucie.

Drugi wątek: dropzone ma być widoczna od momentu, gdy plik jest przeciągany nad oknem
(dziś podświetla się dopiero po najechaniu), ładniejszym kolorem niż dzisiejsze
`border-primary` (prawie czerń). Do sprototypowania: powiększenie inputu na czas
przeciągania.

Przed planem: research — gdzie w aplikacji jest drag&drop (wydatek to nie jedyne miejsce).

## Decyzje

- **2026-09-14 (właściciel):** kolor stanu drag&drop jest **wspólny** dla obu dropzone — neutralnej
  (`FileInput`) i AI (przycisk „Wygeneruj z paragonów"). Odrzucona propozycja „wspólna geometria,
  własny kolor"; `ring-neon-cyan` na przycisku skanu ustępuje wspólnemu kolorowi stanu dropu.
  Zamyka to Open Question 3 z `research.md`.
