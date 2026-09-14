---
change_id: drag-drop-guard
title: Blokada nawigacji przy chybionym dropie pliku + widoczna dropzone w trakcie przeciągania
status: archived
created: 2026-09-14
updated: 2026-09-14
archived_at: 2026-09-14T16:23:04Z
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
  Zamyka to otwarte pytanie z researchu o dwa języki wizualne stanu „uzbrojona”.
- **2026-09-14 (właściciel):** guard montowany **per-dropzone**, nie w layoucie ani w providerze.
  Wszystkie dropzone siedzą w dialogach, więc przy zamkniętym dialogu nie ma w co celować — guard
  w layoucie nie dawałby nic więcej, a omijanie obcej dropzone Payloada (`/admin/**`) wychodzi
  wtedy samo z siebie.
- **2026-09-14 (właściciel):** w trakcie przeciągania podświetlają się **wszystkie** dostępne cele
  (słabo), a ten pod kursorem mocno. Pokazanie użytkownikowi, gdzie wolno upuścić plik, JEST
  rozwiązywanym problemem, więc nie zawężamy tego do jednej dropzone.
- **2026-09-14 (właściciel):** **bez powiększania** dropzone na czas przeciągania — ani realną
  wysokością, ani `scale`. Zmiana rozmiaru przesuwa treść spod kursora w trakcie przeciągania.
- **2026-09-14 (właściciel):** E2E dla tej zmiany **anulowane** (EX-774 → Canceled). Ryzyko jest
  czysto browser-level, zero logiki serwerowej, a przebieg suity to ~1 h — weryfikację przejmują
  w całości checki manualne sekcji `drag-drop-guard`.
