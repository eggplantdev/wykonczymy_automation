# Drag&drop plików — guard na chybiony drop + widoczne dropzone — Plan Brief

> Full plan: `context/changes/2026-09-14-drag-drop-guard/plan.md`
> Research: `context/changes/2026-09-14-drag-drop-guard/research.md`

## What & Why

Plik upuszczony obok dropzone, ale wewnątrz okna, uruchamia domyślną akcję dokumentu — przeglądarka
otwiera obrazek zamiast formularza i to, co użytkownik wpisał w dialogu, przepada. Blokujemy to
listenerem na `window`, ale montowanym przez samą dropzone. Ten sam listener daje drugą rzecz za
darmo: wiedzę, że plik jest nad oknem — więc podświetlamy wszystkie możliwe cele, zanim użytkownik
w któryś trafi.

## Starting Point

Dwie niezależne implementacje drag&dropu plików: współdzielony `FileInput` (5 miejsc renderu) oraz
przycisk „Wygeneruj z paragonów" z ręcznie powtórzonymi handlerami. Obie anulują domyślną akcję
tylko **wewnątrz** własnego elementu — chybiony drop jest niczyj. Podświetlenie `FileInput` używa
`border-primary`, czyli prawie czerni, nieodróżnialnej od zwykłej ramki. Wszystkie 6 miejsc siedzi
w dialogach; w całym `src/` nie ma innego HTML5 drag&dropu ani żadnego globalnego listenera `drag*`.

## Desired End State

Chybiony drop nic nie robi — żadnej nawigacji, dialog stoi otwarty. Od chwili, gdy plik znajdzie się
nad oknem, każda widoczna dropzone świeci słabo, a ta pod kursorem mocno, obie w `neon-cyan`.
Rozmiary i layout w trakcie przeciągania się nie zmieniają.

## Key Decisions Made

| Decyzja                 | Wybór                           | Dlaczego                                                                                                                       | Źródło     |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Zasięg guarda           | Per-dropzone, nie w layoucie    | Wszystkie dropzone są w dialogach, więc guard żyje dokładnie tam, gdzie jest w co celować; omija to też obcą dropzone Payloada | Właściciel |
| Kolor stanu             | Wspólny `neon-cyan`             | Jeden język dla obu dropzone; maksymalny kontrast wobec `border-input`                                                         | Właściciel |
| Wiele dropzone'ów naraz | Wszystkie słabo, aktywna mocno  | Pokazanie wszystkich celów JEST rozwiązywanym problemem                                                                        | Właściciel |
| Powiększanie            | Nie robimy                      | Zmiana rozmiaru przesuwa treść spod kursora w trakcie przeciągania                                                             | Właściciel |
| Wygaszanie stanu        | Licznik `dragenter`/`dragleave` | `dragover` odpala się co ~350 ms, więc watchdog czasowy dawałby fałszywe wygaszenia przy nieruchomym kursorze                  | Plan       |
| Dom hooka               | `src/hooks/`                    | Dwóch konsumentów w różnych katalogach, jeden poza `forms/`                                                                    | Plan       |
| E2E                     | Odłożone do backlogu            | Ryzyko browser-level, ale zero logiki serwerowej; przebieg suity to ~1 h                                                       | Plan       |

## Scope

**W zakresie:** hook `useWindowFileDrag` w `src/hooks/`; `FileInput` na nowym stanie i kolorze;
naprawa migotania `isDragOver` nad własnymi dziećmi; przejście przycisku skanu na ten sam hook;
wspólne klasy stanu dropu.

**Poza zakresem:** guard w layoucie lub providerze; cokolwiek w `(payload)`; powiększanie dropzone;
wklejanie ze schowka; zmiany w ingestach, `accept`, HEIC i obsłudze oversize; pełnoekranowa nakładka.

## Architecture / Approach

Jeden hook robi obie rzeczy, bo obie wiszą na tych samych listenerach: `dragover` z `preventDefault`
(guard) plus licznik `dragenter`/`dragleave` zerowany przez `drop` i `dragend` (stan). Hook zwraca
`boolean`, nigdy klasy — kolor i kształt zostają u konsumenta. Każdy listener wychodzi natychmiast,
gdy `dataTransfer.types` nie zawiera `Files`; dziś to warunek pusty, ale to on pozwoli kiedyś dodać
drag&drop wierszy bez rozbrajania guarda. Przy N zamontowanych dropzone'ach na `window` wisi N
kompletów listenerów — dlatego guard nie robi nic poza `preventDefault`.

## Phases at a Glance

| Faza                  | Co dostarcza                                                                           | Główne ryzyko                                                                |
| --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Hook + `FileInput` | Chybiony drop zablokowany wszędzie, gdzie widać `FileInput`; dwa stopnie podświetlenia | Regresja ścieżki trafionej — drop na pole musi nadal dodawać plik            |
| 2. Druga dropzone     | Przycisk skanu na wspólnym hooku, jeden język wizualny                                 | Zmiana `dropZoneProps` może naruszyć ciche wyjście przy niedopasowanym pliku |

**Prerequisites:** brak — żadnej migracji, żadnej zmiany danych, żadnego wariantu środowiskowego.
**Estimated effort:** jedna sesja.

## Open Risks & Assumptions

- Stan „uzbrojona" na N+1 polach w formularzu wydatku może okazać się wizualnie zbyt gęsty; siła
  słabego stanu jest do skalibrowania dopiero na żywym renderze.
- `neon-cyan` znaczy dziś w aplikacji „AI"; użyty na zwykłej dropzone faktury lekko rozmywa to
  znaczenie. Decyzja właściciela, świadoma.
- Weryfikacja opiera się na checkach manualnych — automatyczna bramka sprawdzi tylko, że drzewo się
  kompiluje.

## Success Criteria (Summary)

- Upuszczenie pliku obok dropzone nie otwiera go w przeglądarce i nie gubi otwartego formularza.
- Użytkownik widzi, gdzie może upuścić plik, **zanim** tam trafi.
- Wszystkie dotychczasowe ścieżki trafione — dodanie faktury, załącznika, generowanie z paragonów —
  działają bez zmian, łącznie z dropzone Payloada.
