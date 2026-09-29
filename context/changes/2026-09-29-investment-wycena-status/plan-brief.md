# Status inwestycji „Wycena" — Plan Brief

> Full plan: `context/changes/2026-09-29-investment-wycena-status/plan.md`
> Research: `context/changes/2026-09-29-investment-wycena-status/research.md`

## What & Why

Dodajemy status „Wycena” (w bazie `quote`), który zachowuje się dokładnie jak „Planowana”. Jest potrzebny
tylko po to, żeby oddzielić wyceny od planowanych na liście inwestycji. Przy okazji lista statusów przestaje
żyć w sześciu ręcznych kopiach, bo to przez nie nowy status psuje się po cichu.

## Starting Point

Serwer i SQL nie nazywają „Planowanej” nigdzie. Wszystkie bramki pytają o Zakończoną, Szablon albo
Aktywną, więc nowy status dziedziczy zachowanie za darmo. Koszt siedzi w UI: formularz, walidacja, filtr i
badge mają własne kopie listy, a zapisany w localStorage filtr ukryłby nowy status na stałe.

## Desired End State

Wycenę da się ustawić w dialogu, ma bursztynowy badge i jest domyślnie widoczna w filtrze. Kolejność
wszędzie: Planowana, Wycena, Aktywna, Zakończona. Kto miał zapisany filtr, widzi Wyceny tak, jak widział
Planowane. Kolejny status to jedna pozycja w stałej, a resztę wskazuje typecheck.

## Key Decisions Made

| Decyzja                          | Wybór                                     | Dlaczego                                                      | Źródło   |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------------------- | -------- |
| Wartość w bazie                  | `quote`, etykieta „Wycena”                | reguła nazewnictwa AGENTS.md: polski tylko dla nazw z arkusza | Research |
| Promocja leada                   | zostaje Planowana                         | właściciel                                                    | Research |
| Kolejność                        | Planowana → Wycena → Aktywna → Zakończona | właściciel; enum `AFTER 'planowana'`                          | Research |
| Jedna stała statusów             | tak, w tej zmianie                        | zamienia 3 ciche miejsca w błędy typu                         | Research |
| Zapisany filtr bez klucza Wyceny | dziedziczy po Planowanej                  | kto ukrył Planowane, nie zobaczy nagle Wycen                  | Plan     |
| Kolor badge'a                    | amber                                     | sky, emerald, muted i violet są zajęte                        | Plan     |
| E2E                              | brak nowego                               | granicę kolekcja ↔ enum pokrywa spec DB, filtr pokrywa unit   | Plan     |

## Scope

**In scope:** stała statusów, migracja enuma, formularz, walidacja, opcje kolekcji, badge, filtr z
dziedziczeniem, testy unit i DB, dwa dokumenty.

**Out of scope:** logika serwera i SQL, promocja leada, zmiana nazwy `planowana`, ukrywanie szablonu w
`/admin`, E2E.

## Architecture / Approach

`src/lib/constants/investment-status.ts` trzyma ręczną krotkę `as const` (kolejność cyklu życia), etykiety
pl/en i podzbiór wybieralny bez szablonu. Z niej pochodzą: typ `InvestmentStatusT`, `z.enum`, opcje
kolekcji Payloada, `<SelectItem>`, lista filtra i etykiety badge'a. Kolory zostają ręcznym
`Record<InvestmentStatusT, …>`, który typecheck wymusza.

## Phases at a Glance

| Faza                     | Co dostarcza                            | Główne ryzyko                                                   |
| ------------------------ | --------------------------------------- | --------------------------------------------------------------- |
| 1. Jedna lista + `quote` | status od enuma po badge, spec DB       | krotka wyprowadzona zamiast pisana poszerzyłaby typ do `string` |
| 2. Filtr + dziedziczenie | filtr na stałej, reguła dla starych map | złamanie „jawne nic = pusto” dla starych map                    |

**Prerequisites:** lokalny Postgres 5433 i kontener testowy 5435.
**Estimated effort:** 1 sesja, 2 fazy.

## Open Risks & Assumptions

- Prod: migracja przed pushem, wykonuje człowiek (`pnpm db:migrate:prod`).
- `payload migrate` czyta drzewo robocze, więc przed migracją współdzielonej bazy trzeba sprawdzić `git status src/migrations`.

## Success Criteria (Summary)

- Wycena zapisuje się i wyświetla wszędzie tam, gdzie Planowana, w ustalonej kolejności.
- Nikt po wdrożeniu nie traci Wycen z listy przez stary zapis filtra.
