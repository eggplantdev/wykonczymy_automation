# Nowy pusty szablon kosztorysu — Plan Brief

> Full plan: `context/changes/2026-09-22-empty-preset-create/plan.md`

## What & Why

Szablon kosztorysu rodzi się dziś wyłącznie jako kopia istniejącego kosztorysu („Zapisz jako
szablon" w edytorze). Nie da się założyć szablonu od zera — a to naturalny punkt wejścia, kiedy
nowego szablonu nie ma z czego skopiować.

## Starting Point

`/szablony` to lista, która umie otworzyć szablon w warsztacie, przemianować go i usunąć — bez
żadnego przycisku akcji nad tabelą. Warstwa danych jest gotowa: `insertPreset` przyjmuje dowolny
payload i sam rozstrzyga kolizję nazw, a warsztat na `/szablony/<id>` renderuje pełny edytor ze
stanem pustym.

## Desired End State

Na liście szablonów jest „Nowy szablon". Podanie nazwy zakłada szablon z pustym drzewem, wczytuje go
do warsztatu i przenosi do edytora, gdzie użytkownik od razu dodaje pierwszą sekcję. Zajęta nazwa →
komunikat, dialog zostaje otwarty.

## Key Decisions Made

| Decyzja                               | Wybór                                       | Dlaczego                                                                                         |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Widoczność przy zakładaniu inwestycji | Pusty szablon **widoczny**, bez filtrowania | Decyzja właściciela; efekt równy „bez szablonu", więc nie ma czego chronić                       |
| Co po zapisie                         | Natychmiastowe otwarcie w warsztacie        | Pusty szablon bez wejścia do warsztatu jest bezużyteczny                                         |
| Uprawnienia                           | `protectedAction`, jak `savePresetAction`   | Zakładanie to pisanie do biblioteki, nie jej niszczenie — owner-only zostaje na usuń/przemianuj  |
| `settings` w pustym payloadzie        | `DEFAULT_COEFFS` + `DEFAULT_VAT`            | Pole inertne (ignorowane przy wczytaniu), ale wymagane przez typ — bierzemy jedyne źródło prawdy |
| Wersja formatu payloadu               | Bez zmiany                                  | Puste tablice mieszczą się w dzisiejszym kształcie                                               |

## Scope

**In scope:** akcja `createEmptyPresetAction`, dialog z nazwą, toolbar na `/szablony`, spec DB-backed
akcji, spec DOM dialogu.

**Out of scope:** filtrowanie pustych szablonów w wyborze przy zakładaniu inwestycji, zmiany
uprawnień, szablon startowy / szkielet sekcji, zmiana formatu payloadu, uruchamianie suite'u E2E.

## Architecture / Approach

Dialog (`FormDialogShell` + `Input`, wzorzec z „Zmień nazwę szablonu") → `createEmptyPresetAction`
(`insertPreset` z pustym drzewem, tag `presets`) → zwrócone id → `useOpenPreset().open(id)`, czyli
istniejąca ścieżka „Otwórz szablon" do współdzielonego warsztatu. Przycisk wisi w `DataTableToolbar`
w slocie `actions` — parytet z „Nowa praca" w katalogu prac.

## Phases at a Glance

| Faza                 | Co dowozi                                  | Główne ryzyko                                                           |
| -------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| 1. Akcja             | Szablon z pustym drzewem + id do nawigacji | `replaceTreeWithSnapshot` na pustym drzewie przy wczytaniu do warsztatu |
| 2. Przycisk i dialog | Wejście z listy, od razu w warsztacie      | Kolejność: zamknięcie dialogu przed nawigacją                           |

**Prerequisites:** lokalna baza (docker 5433) dla spec-a DB-backed.
**Estimated effort:** jedna sesja.

## Open Risks & Assumptions

- Zakładam, że `restoreKosztorys` znosi drzewo bez sekcji — spec fazy 1 to sprawdza wprost, zamiast
  przyjmować na wiarę.
- „Otwórz" wyrzuca z warsztatu to, co ktoś inny miał otwarte. To zastane zachowanie współdzielonego
  warsztatu, nie nowość tej zmiany.
- Slice jest przeglądarkowy, więc na bramce review oddaje E2E: spec w `e2e/kosztorys-presets.spec.ts`
  albo issue z etykietą `e2e-backlog`.

## Success Criteria (Summary)

- Z listy szablonów da się założyć pusty szablon i od razu zacząć go budować.
- Zajęta nazwa nic nie zakłada i mówi dlaczego.
- Świeżo założony szablon pokazuje na liście `0 sekcji / 0 pozycji` i po zbudowaniu zapisuje się
  z warsztatu normalnie.
