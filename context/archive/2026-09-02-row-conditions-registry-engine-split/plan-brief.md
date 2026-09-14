# EX-765 — rozbicie `row-conditions.ts` — Plan Brief

> Full plan: `context/changes/2026-09-02-row-conditions-registry-engine-split/plan.md`
> Research: `context/changes/2026-09-02-row-conditions-registry-engine-split/research.md`

## What & Why

`src/lib/kosztorys/row-conditions.ts` (625 linii) trzyma naraz cztery rodzaje: kontrakt typów,
22-wpisowy rejestr warunków z prywatnymi predykatami i 11 mechanizmów czytających ten rejestr.
Rozdzielamy je na trzy pliki, **bez zmiany zachowania**. Finding był zgłaszany trzy razy (08-17,
08-18, 09-01) i za każdym razem odkładany jako „własne review" — to jest to review.

## Starting Point

Plik urodził się na 112 liniach już ze zrośniętym rejestrem i warstwą zapytań. Od 08-17 **żaden
commit nie dodał mechanizmu** — urósł wyłącznie wpisami rejestru (trzy skoki to ~50% objętości).
Konsumentów jest 13, wszystkie przez alias `@/`, wszystkie z importami nazwanymi. Siatka: 123 asercje
w specu modułu plus 5 speców zależnych.

## Desired End State

Trzy pliki w `src/lib/kosztorys/row-conditions/`: `types.ts` (~60), `registry.ts` (~395),
`queries.ts` (~180). Stary plik znika — konsumenci importują głęboko, tak jak konsumenci
`sheet-import/` i `work-catalogue/`. Spec rozcięty na dwa pliki lustrzane ze wspólnymi fiksturami.
Zero zmian w tym, co widzi użytkownik.

## Key Decisions Made

| Decyzja                                     | Wybór                                                       | Dlaczego                                                                                                                                                                                                                                                   | Źródło   |
| ------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Kształt modułu                              | Podkatalog + importy głębokie, **bez fasady**               | W `src/` nie ma ani jednego `X.ts` obok `X/`; oba podkatalogi w `lib/kosztorys/` są bez `index.ts`. Kształt naprawy w 4/4 findingach EX-515 to rodzeństwo bez barrela. Fasada kosztowałaby drugi krok „zdejmij fasadę" i fałszywe „unused export" w knipie | Research |
| Liczba plików                               | Trzy, nie dwa — osobne `types.ts`                           | Sam `RowConditionT` to 37 linii dokumentacji mechanizmu; `RowConditionCtxT` jest kontraktem hosta. Bez tego `registry.ts` znów łączy dwa rodzaje. Precedens: `work-catalogue/types.ts`                                                                     | Research |
| Nazwa drugiego pliku                        | `queries.ts`, nie `engine.ts`                               | Tak nazwała ją bramka review, która finding zgłosiła: „the registry (the data) and **its query layer**"                                                                                                                                                    | Plan     |
| Gdzie idą 2 stałe id i `clientConditionIds` | Do rejestru                                                 | Ich własne docblocki mówią, że siedzą przy wpisach, żeby listy nie rozjechały się przy dodaniu warunku; `clientConditionIds` raz już zniknął po cichu przy refaktorze hooka (`6a7c8f17`)                                                                   | Research |
| Podział rejestru po `kind`                  | Nie                                                         | Kolejność tablicy JEST kolejnością wyświetlania, a komentarze par krzyżują się między rodzajami                                                                                                                                                            | Research |
| Kolejność faz                               | Najpierw kod (spece tylko przepięte), potem rozcięcie speca | 123 asercje weryfikują przeniesiony kod, zanim ktokolwiek ruszy sam spec                                                                                                                                                                                   | Plan     |

## Scope

**In scope:** trzy nowe pliki + kasacja starego; 13 przepiętych linii importu; naprawa spiętrzonych
docblocków przy `liftsToSections`; rozcięcie speca na dwa pliki lustrzane + wspólne fikstury.

**Out of scope:** fasada; fabryka generująca id warunków (odrzucona 08-17, id są persystowane
w localStorage bez wersjonowania); jakakolwiek zmiana sygnatur; `stage-conditions.ts`; **naprawa
perfu liczników** — przekształca `countMatching` wraz ze specem, więc to osobna zmiana, która ma iść
**po** tym splicie.

## Architecture / Approach

Szew jest strukturalny, nie estetyczny: **zbiory zależności obu połówek są rozłączne**. Komplet
sześciu domenowych importów (`calc`, `constants`, `plane-price-keys`, `settlement-rows`, `stage-keys`,
`subcontractor-price-guard`) obsługuje wyłącznie rejestr; `queries.ts` importuje `./registry`
i `./types` — i nic więcej. Strzałka biegnie jednokierunkowo `types → registry → queries`, cykl jest
niemożliwy. Strzałka `editor/grid → lib` zostaje nienaruszona.

## Phases at a Glance

| Faza                  | Co dostarcza                                         | Główne ryzyko                                                                                                             |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1. Przeniesienie kodu | Trzy pliki, skasowany stary, 13 przepiętych importów | Musi być atomowa — stan pośredni nie przechodzi `tsc`. Pięć eksportów bez pokrycia po nazwie wybucha dopiero na typecheck |
| 2. Rozcięcie speca    | Dwa spece lustrzane + wspólne fikstury               | Zgubienie asercji po drodze — bramkowane bilansem 66 testów / 123 asercji                                                 |

**Prerequisites:** brak; drzewo na `staging`, zmiana jest samodzielna.
**Estimated effort:** jedna sesja, dwie fazy, ~13 plików dotkniętych mechanicznie.

## Open Risks & Assumptions

- Jedyne realne ryzyko semantyczne to utrata **referencyjnej stabilności** dwóch mrożonych zbiorów
  w `clientConditionIds` (karmią memo edytora). Pilnuje jej istniejąca asercja — pod warunkiem, że
  zbiory zostaną modułowymi `const`-ami, a nie zostaną odtworzone per wywołanie.
- Spec rejestru będzie importował `queries.ts` przez helper `matches()` (idzie przez `countMatching`).
  To zależność testowa, nie produkcyjna — świadoma, ale warto o niej wiedzieć przy czytaniu.
- Split i niezgłoszona naprawa perfu dotykają tego samego pliku. Równoległa praca będzie konfliktować.

## Success Criteria (Summary)

- Edytor zachowuje się identycznie: te same wiersze w „Filtry", te same liczniki w „Problemy", ten sam
  reveal kolumn, ten sam podgląd klienta z „ukryj puste wiersze".
- 66 testów / 123 asercje przechodzą po obu stronach przenosin; `pnpm typecheck` łapie każdy eksport
  zgubiony po drodze.
- W `src/` nie zostaje ani jedno odwołanie do starej ścieżki `@/lib/kosztorys/row-conditions`.
