---
date: 2026-09-29T09:25:12+02:00
researcher: Claude (Opus 5.5)
git_commit: f7a80572
branch: staging
repository: wykonczymy
topic: 'Konsekwencje dodania statusu inwestycji „Wycena”, zachowującego się identycznie jak „Planowana”'
tags: [research, investments, status, enum, migration, status-filter, localStorage]
status: complete
last_updated: 2026-09-29
last_updated_by: Claude (Opus 5.5)
---

# Research: status inwestycji „Wycena”

**Date**: 2026-09-29T09:25:12+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: f7a80572
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Jakie są konsekwencje dodania piątego statusu inwestycji `wycena`, który ma się zachowywać
**identycznie jak `planowana`**? Jedynym powodem tego statusu jest wygoda filtrowania. Pytania pomocnicze:
czy każdy nowy status wymaga migracji i które miejsca rozgałęziają się po statusie.

## Summary

- **Migracja jest konieczna i trywialna.** Payload zapisuje pole `select` jako natywny enum Postgresa
  `enum_investments_status`, a `push: false` (`src/payload.config.ts:65-76`) sprawia, że nic nie
  zmienia go automatycznie. Wystarczy jedna linia `ALTER TYPE … ADD VALUE`. Enum ma w bazie tylko jednego
  konsumenta: nie ma widoków, funkcji, triggerów ani CHECK-ów. Oba indeksy częściowe filtrują
  po `= 'szablon'`, więc nowa wartość ich nie dotyczy.
- **Warstwa serwerowa i SQL: zero cichych rozbieżności.** Nie znaleziono żadnego zapytania, które nazywa `planowana`. Każda bramka
  pyta o `completed` (blokada), `szablon` (wykluczenie) albo `active` (flaga „Aktywne”), więc
  wiersz `wycena` automatycznie ląduje tam, gdzie `planowana`. Dotyczy to księgowalności, snapshotów,
  retencji, dostępu, sync arkusza i hooków.
- **Cały koszt siedzi w UI i walidacji, a kompilator pomaga w 3 miejscach na ~8.** Najgroźniejsze ciche awarie:
  1. `FILTERABLE_STATUSES` bez `wycena`: wiersze `wycena` **znikają z `/inwestycje` bez żadnej możliwości
     pokazania** (`use-status-filter.ts:10`).
  2. `z.enum` w `investment-schema.ts:14`: **każda edycja** inwestycji `wycena` w aplikacji zostaje
     odrzucona.
  3. **Zapisany filtr w localStorage** (`selectionFrom`, `use-status-filter.ts:29-33`): u każdego, kto
     kiedykolwiek przełączył filtr, brak klucza `wycena` oznacza „odznaczone”. Pierwsze kliknięcie
     zapisuje wtedy `wycena: false` na stałe. Tego ryzyka nie opisuje żadna lekcja ani precedens.

## Detailed Findings

### Warstwa SQL i serwerowa: wszystko „jak planowana”

| Miejsce                                              | Warunek                                     | Efekt dla `wycena`                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/constants/investment-lock.ts:16-19`         | `isLockedStatus = s === 'completed'`        | nie jest zablokowana                                                                                                       |
| `src/lib/constants/investment-lock.ts:34-35`         | `isBookableInvestment = !isLockedStatus(…)` | księgowalna (bierze `string`, bez nacisku typu)                                                                            |
| `src/lib/queries/reference-data.ts:73`               | `i.status <> 'szablon'`                     | trafia do danych referencyjnych                                                                                            |
| `src/lib/queries/reference-data.ts:111`              | `active: row.status === 'active'`           | `active: false`, więc ukryta pod przełącznikiem „Aktywne” w comboboxach, dashboardzie i licznikach, tak samo jak planowana |
| `src/lib/db/snapshots.ts:82`                         | `status NOT IN ('completed','szablon')`     | dostaje nocne snapshoty                                                                                                    |
| `src/lib/db/snapshots.ts:233`                        | retencja tylko dla `completed`              | historia nie wygasa                                                                                                        |
| `src/lib/db/investment-gate.ts:33,47,86`             | lock / `isTemplate`                         | zapis dozwolony                                                                                                            |
| `src/access/investment-lock.ts:28`                   | `not_equals: 'completed'`                   | dostęp dozwolony                                                                                                           |
| `src/hooks/investments/guard-status-unlock.ts:22-24` | tylko wyjście z `completed`                 | jak planowana                                                                                                              |
| `src/hooks/investments/stamp-completed-at.ts:15-18`  | tylko `completed`                           | jak planowana                                                                                                              |
| `src/hooks/investments/guard-template-status.ts:7`   | tylko `szablon`                             | przejście wycena ↔ planowana dozwolone                                                                                     |
| `src/app/(frontend)/inwestycje/page.tsx:16`          | licznik „N aktywnych” = `=== 'active'`      | nie liczona (jak planowana)                                                                                                |

Brak logiki statusu w `src/lib/google/*`, `src/lib/leads/*`, pozostałych cronach, `scripts/` i tagach
cache. Pozostałe zapytania w `lib/db` łączą `investments` bez filtra po statusie.

### Warstwa TS/UI: co trzeba zmienić

Oznaczenia: **T** = typecheck wymusi zmianę, **C** = cicha awaria, **U** = lista UI do uzupełnienia.

| Miejsce                                                                                           | Klasa             | Co się dzieje bez zmiany                                                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/reference-data.ts:15` `InvestmentStatusT`                                              | C, **krok 1**     | unia pisana ręcznie, niezwiązana z `payload-types.ts`; `reference-data.ts:110` rzutuje `as InvestmentStatusT`. Dopiero jej rozszerzenie odpala błędy T poniżej |
| `src/collections/investments.ts:15-23` `STATUS_OPTIONS`                                           | C/U               | Payload waliduje `select`, więc zapis `wycena` przez lokalne API odrzucony                                                                                     |
| `src/components/forms/investment-form/investment-schema.ts:14` `z.enum`                           | C                 | `create/updateInvestmentAction` (`src/lib/actions/investments.ts:42,161`) i `promote-lead.ts:32` odrzucają `wycena`                                            |
| `src/components/forms/investment-form/investment-form.tsx:151-156` `<SelectItem>`                 | C/U               | status nieosiągalny z UI; przy edycji select pokazuje pusto                                                                                                    |
| `src/components/investments/investment-status-badge.tsx:5-17` `STATUS_LABELS`/`STATUS_CLASSNAMES` | T/U               | etykieta i kolor (planowana = `bg-sky-*`)                                                                                                                      |
| `src/components/forms/…/edit-investment-dialog.tsx:36`                                            | T                 | spięcie typu z formularzem                                                                                                                                     |
| `src/hooks/use-status-filter.ts:10` `FILTERABLE_STATUSES`                                         | **C, krytyczne**  | wiersze `wycena` zawsze odfiltrowane; tablica wyznacza też kolejność w menu `StatusFilter`                                                                     |
| `src/hooks/use-status-filter.ts:7` `DEFAULT_STATUSES`                                             | C                 | „jak planowana” oznacza widoczność domyślną, więc dopisać                                                                                                      |
| `src/hooks/use-status-filter.ts:29-33` `selectionFrom`                                            | **C, nieopisane** | zapisana mapa bez klucza `wycena` daje „odznaczone”; `toggleStatus` (`:55-63`) przepisuje wtedy wszystkie klucze i utrwala `wycena: false`                     |

Już działa jak planowana: `investment-data-table.tsx:51` (przygaszenie tylko dla `completed`),
`isActiveRef`/`activeOrSelected` (`src/lib/utils/is-active-ref.ts`), `expense-form.tsx:305`,
`deposit-form.tsx:210`, `use-investment-from-url.ts:23`, `transfers.tsx:202`, `kosztorys_v2/page.tsx:109`,
`status-filter.tsx` (czyta `FILTERABLE_STATUSES` i `STATUS_LABELS`, więc dostosuje się sam).

Decyzja produktowa, nie techniczna: `src/components/leads/promote-lead-dialog.tsx:85` promuje lead
jako `planowana`, co przypina test `promote-lead-dialog.test.tsx:94-100`.

### Migracja

- Wzór: `src/migrations/20260718_0_add_planowana_investment_status.ts`, czyli
  `ALTER TYPE "enum_investments_status" ADD VALUE IF NOT EXISTS '<value>'` i `down()` jako udokumentowany no-op
  (Postgres nie ma `DROP VALUE`). Wpis w `src/migrations/index.ts`. Ostatnia migracja to `20260929_2`.
- Jest addytywna, więc na prod idzie **przed** pushem (`pnpm db:migrate:prod`, wykonuje człowiek).
- Nową wartość można **użyć** dopiero w kolejnej transakcji. Żaden `UPDATE … SET status = 'wycena'`
  ani `DEFAULT` nie może stać w tej samej migracji (`lessons.md:1683`, pkt 3).
- `BEFORE 'planowana'` zmienia tylko porządek enuma w Postgresie, a nic w kodzie nie sortuje
  `ORDER BY status` (sort w tabeli jest alfabetyczny, `tables/investments.tsx:295-300`). Użycie
  jest nieobowiązkowe, ale tanie i zgodne z cyklem życia.

### Testy

| Spec                                                                  | Zmiana                                                                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/__tests__/lib/constants/investment-lock.test.ts:8-13`            | dopisać wiersz; spec jest z założenia strażnikiem nowych statusów (predykat nad `string`)                                                               |
| `src/__tests__/use-status-filter.test.ts:7-11,46,63-67`               | fixture `wycena`; asercje defaultów się **wywalą** po dopisaniu do `DEFAULT_STATUSES`; **nowy przypadek regresji na zapisaną mapę bez klucza `wycena`** |
| `src/__tests__/hooks/investments/stamp-completed-at.test.ts:52`       | dopisać do `it.each`                                                                                                                                    |
| `src/__tests__/hooks/investments/guard-template-status.test.ts:25,34` | dopisać do `it.each`                                                                                                                                    |
| `src/__tests__/lib/db/investment-gate.test.ts:32-40`                  | dopisać przypadek                                                                                                                                       |
| `src/__tests__/lib/kosztorys/capture-daily-snapshots.test.ts:94-106`  | opcjonalnie; `NOT IN` pokrywa automatycznie                                                                                                             |
| `e2e/investment-planowana-status.spec.ts`                             | bez zmian; rozszerzanie E2E nieopłacalne, warstwa unit wystarcza                                                                                        |

`context/foundation/test-plan.md` nie ma ryzyka „status jako filtr/etykieta”. Najbliższe są #12 (retencja
nie kasuje historii otwartej inwestycji) i #13 (guard szablonu).

### Dokumenty, które staną się nieaktualne

- `context/reference/kosztorys-editor-domain-notes.md:756-758`: „żyją, dopóki inwestycja jest Planowana lub
  Aktywna”.
- `context/domain/02-glossary.md:247-254` i `context/domain/01-domain-distillation.md:225`: tabela
  zamrożonych polskich wartości enumów (dotyczy tylko wariantu z polską wartością `wycena`).

## Architecture Insights

- **Status to etykieta, nie bramka** (`lessons.md:1680-1684`). Wszystkie realne decyzje (blokada,
  wykluczenie szablonu, flaga „Aktywne”) porównują ze **stałą jednej wartości** w
  `investment-lock.ts` / `reference-data.ts`. Dzięki temu dodatkowy status „pasywny” nic nie psuje
  po stronie serwera. Ceną jest brak nacisku typów: predykaty biorą `string`.
- **Źródło prawdy o liście statusów jest rozproszone w ~6 ręcznie utrzymywanych kopiach**:
  `STATUS_OPTIONS`, `InvestmentStatusT`, `z.enum`, `<SelectItem>`, `FILTERABLE_STATUSES` i mapy badge'a.
  Tylko mapy `Record<InvestmentStatusT,…>` są spięte z unią. Kolaps do jednej stałej (np. tablica
  `INVESTMENT_STATUSES as const` → typ, `z.enum`, opcje kolekcji, `<SelectItem>` z mapy etykiet)
  zamieniłby 3 ciche miejsca w typowane. Czy robić to w tym zmianie, zdecyduje plan. Uwaga:
  `collections/` jest w grafie CLI Payloada, więc wspólna stała musi leżeć w module bez `server-only`
  (jak `investment-lock.ts`).
- **Mapa flag w localStorage to schemat trwałych danych.** Dodanie klucza do `FILTERABLE_STATUSES` to
  migracja danych po stronie klienta. Naturalna reguła: brak klucza dla danego statusu oznacza jego
  wartość domyślną (`DEFAULT_STATUSES.includes(s)`), a nie `false`. Działa to też dla każdego przyszłego
  statusu. Jawne all-false nadal pozostaje respektowane.

## Historical Context (from prior changes)

- `context/archive/2026-07-16-investment-planowana-status/` (EX-506, commit `0da073ec`): pełny precedens.
  Plan, research i plan-review usunięto w `732d7a88` (do odzyskania z `735cc241`). Decyzje: `active`
  = tylko `active` (prospekt ukryty w pickerach, owner: „najpierw promuj do Aktywnej”), planowana
  księgowalna (miękkie ukrycie, nie odmowa), domyślny filtr Aktywne + Planowane, planowana liczy się
  jako żywa dla snapshotów.
- Późniejsze commity z logiką planowanej: `814aef35`/`535ce420` (multiselect + localStorage), `fc1ce7de`
  (promocja leada → planowana), `0a9745fc` (snapshoty i retencja).
- `context/archive/2026-09-14-szablony-crud/review-gate.md:17,24`: czwarty status. Payload nie potrafi
  ukryć pojedynczej opcji w `/admin`, a mapy UI muszą pokrywać każdą wartość.
- `context/foundation/lessons.md:1680-1684`: lekcja o dodawaniu wartości do `InvestmentStatusT`. Nie obejmuje
  pułapki z localStorage; ten research ją dodaje.

## Related Research

- `context/archive/2026-07-16-investment-planowana-status/review-gate.md`
- `context/archive/2026-09-14-szablony-crud/review-gate.md`

## Decisions (owner, 2026-09-29)

1. Wartość w bazie: **`quote`**, etykieta UI „Wycena". Nie dopisujemy jej do tabeli zamrożonych polskich
   wartości w glosariuszu.
2. Promocja leada **zostaje `planowana`**.
3. Kolejność cyklu życia: ~~Planowana → Wycena → Aktywna → Zakończona~~ — **zmienione po implementacji**
   na **Wycena → Planowana → Aktywna → Zakończona**, a nowa inwestycja dostaje domyślnie Wycenę. Zob.
   Amendment w `plan.md`.
4. Kolaps list statusów do jednej stałej: **tak, w tej zmianie**.

## Open Questions (resolved — see Decisions)

1. **Wartość w bazie: `wycena` czy `quote`?** AGENTS.md (reguły nazewnictwa 1–2) dopuszcza polski
   identyfikator tylko dla nazw własnych z arkusza. Glosariusz traktuje `'planowana'` jako **zamrożony dryf**,
   nie jako precedens. Reguła wskazuje `quote` z etykietą „Wycena”; spójność z sąsiadką `planowana`
   wskazuje `wycena`.
2. **Promocja leada**: czy nowy lead ma startować jako Wycena zamiast Planowana?
3. **Kolejność w cyklu życia**: Wycena → Planowana → Aktywna → Zakończona?
4. **Kolaps list statusów do jednej stałej**: w tej zmianie czy osobno?
