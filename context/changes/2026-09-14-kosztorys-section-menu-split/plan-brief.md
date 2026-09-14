# Rozbicie menu ⋯ — Plan Brief

> Pełny plan: `context/changes/2026-09-14-kosztorys-section-menu-split/plan.md`

## What & Why

Grupa „Sekcja" wyprowadza się z menu ⋯ wiersza pozycji do własnego ⋯ na pasku sekcji. Powód
scalenia z 2026-07-26 („dwa ⋯ w jednej kolumnie, nie widać celu") jest nieaktualny — menu nosi
nagłówki grup, a triggery siedzą na różnych wierszach. Drugi, mocniejszy powód: zwinięta sekcja nie
ma dziś żadnego dostępu do własnych komend („rozwiń żeby działać").

## Starting Point

Pasek sekcji ma dwa sloty — `label` (nazwa, licznik, kwota, strzałka) i `blank`; obydwa zwijają
sekcję, a kolumna „Akcje" paska jest pusta. Menu wiersza niesie obie grupy rozdzielone separatorem.
Kolumna „Akcje" istnieje wyłącznie w trybie edytora, więc widok klienta nie wymaga osobnej bramki.

## Desired End State

Każdy pasek sekcji ma w kolumnie „Akcje" ⋯ przebarwione kolorem sekcji. Ta jedna komórka otwiera
menu i nie zwija; reszta paska zwija jak dotąd. Zwinięta sekcja zachowuje pełen dostęp do komend.
Menu wiersza niesie już tylko akcje pozycji.

## Key Decisions Made

| Decyzja                           | Wybór                                       | Dlaczego                                                                                         | Źródło    |
| --------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------- |
| Miejsce ⋯ sekcji                  | Slot „Akcje" paska                          | Jedna oś pionowa z ⋯ wierszy; komórka bez handlera zwijania zamiast `stopPropagation`            | change.md |
| Grupa „Sekcja" w wierszu          | Znika całkowicie                            | Split ma sens tylko jako rozdział, nie duplikat                                                  | change.md |
| Akcje sekcji przy sortowaniu      | Brak ścieżki awaryjnej                      | Sortowanie i tak usuwa paski; przyjęte świadomie                                                 | change.md |
| „Wybierz pozycję z katalogu prac" | → „Dodaj pracę z katalogu…", tylko na pasku | Akcja od zawsze celowała w sekcję i dopisuje na jej koniec                                       | change.md |
| Wygląd ⋯ na pasku                 | Tint kolorem sekcji                         | Od razu widać, że menu dotyczy sekcji, nie wiersza; `CellMenuTrigger` ma już do tego `className` | Plan      |
| E2E                               | Bez specu i bez issue                       | Decyzja właściciela; zostaje unit na slotach                                                     | Plan      |

## Scope

**W zakresie:** nowe menu sekcji, trzeci slot paska, dowiezienie handlerów z hooka, odchudzenie menu
wiersza, usunięcie osieroconego `getSectionItemCount`, aktualizacja `manual-checks.md`.

**Poza zakresem:** miejsce wstawiania prac z katalogu (nadal koniec sekcji), `lib/actions` i
`lib/kosztorys`, inline rename / kropka koloru / kwoty na pasku, `column-config.ts`, spec E2E.

## Architecture / Approach

Callbacki sekcji jadą na pasek tą samą drogą co `onRename`: hook → memo `sectionHeader` w ciele
edytora → `withSyntheticRows` → `columnData` komórki. Żadnego nowego kontekstu — value-identity churn
w `KosztorysEditorProvider` to regresja EX-496, cofnięta już raz.

## Phases at a Glance

| Faza                        | Co dowozi                                 | Główne ryzyko                                                           |
| --------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| 1. Menu sekcji na pasku     | ⋯ na pasku z sześcioma komendami          | Niestabilna referencja bundle'a w memo przerysuje cały grid             |
| 2. Odchudzenie menu wiersza | Wiersz tylko z akcjami pozycji            | Zbyt szerokie cięcie — `sortActive` i „Zapisz do katalogu" muszą zostać |
| 3. Dokumentacja             | Domknięte FAIL-e EX-580 + checki manualne | —                                                                       |

**Warunki wstępne:** brak. **Szacunek:** jedna sesja.

## Open Risks & Assumptions

- Przy włączonym sortowaniu kolor sekcji i „Usuń sekcję" przestają być osiągalne (dziś działają z
  wiersza) — przyjęte świadomie, ale to jedyna realna regresja zakresu uprawnień.
- Bez E2E ścieżka „zwinięta sekcja → menu paska" zostaje bez automatycznej ochrony; gate
  archiwizacji o to zapyta.

## Success Criteria (Summary)

- Zwinięta sekcja da się przesunąć, przemalować, usunąć i uzupełnić z katalogu bez rozwijania
- Kliknięcie w komórkę „Akcje" paska otwiera menu, a nie zwija sekcji
- Menu wiersza nie mówi już nic o sekcji
