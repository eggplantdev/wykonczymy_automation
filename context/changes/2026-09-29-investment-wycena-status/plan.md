# Status inwestycji „Wycena" (`quote`) Implementation Plan

## Overview

Piąty status inwestycji `quote` (etykieta „Wycena") zachowuje się identycznie jak `planowana`. Służy
wyłącznie wygodzie filtrowania listy `/inwestycje`. Przy okazji ~6 ręcznie utrzymywanych kopii listy
statusów zwija się do jednej stałej, żeby kolejny status wymuszał zmiany przez typecheck, a nie psuł się
po cichu.

## Current State Analysis

Pełna mapa: `research.md`. W skrócie:

- Warstwa serwerowa i SQL nie nazywa `planowana` nigdzie. Każda bramka porównuje ze stałą `completed`
  / `szablon` / `active`, więc `quote` automatycznie dziedziczy zachowanie planowanej: jest księgowalna,
  dostaje snapshoty, nie wygasa, jest ukryta pod „Aktywne”. **Zero zmian w logice serwera.**
- Lista statusów żyje w 6 niezależnych kopiach: `STATUS_OPTIONS` (`src/collections/investments.ts:15-23`),
  `InvestmentStatusT` (`src/types/reference-data.ts:15`), `z.enum`
  (`src/components/forms/investment-form/investment-schema.ts:14`), `<SelectItem>`
  (`src/components/forms/investment-form/investment-form.tsx:152-154`), `FILTERABLE_STATUSES` /
  `DEFAULT_STATUSES` (`src/hooks/use-status-filter.ts:7,10`) i mapy badge'a
  (`src/components/investments/investment-status-badge.tsx:5-17`). Tylko mapy badge'a są spięte z unią.
- `selectionFrom` (`src/hooks/use-status-filter.ts:29-33`) traktuje brak klucza w zapisanej mapie jako
  „odznaczone”, a `toggleStatus` (`:55-63`) przepisuje wtedy wszystkie klucze. Nowy status zostaje przez to
  na stałe ukryty u każdego, kto kiedykolwiek ruszał filtr.

## Desired End State

- Inwestycję można ustawić na „Wycena” w dialogu edycji i dodawania. Zapis przechodzi przez akcję,
  walidację kolekcji i enum w Postgresie.
- Badge „Wycena” (amber) w tabeli i na karcie inwestycji.
- Filtr statusów pokazuje kolejno: Planowana, Wycena, Aktywna, Zakończona. Wycena jest domyślnie widoczna.
  Przy zapisanym filtrze bez klucza `quote` Wycena przyjmuje zapisaną wartość Planowanej.
- Kolejny status to jedna pozycja w krotce i jeden wpis w każdej mapie `Record`. Typecheck wskazuje
  każde miejsce do uzupełnienia.

### Key Discoveries:

- Enum Postgresa ma jednego konsumenta. Indeksy częściowe filtrują po `= 'szablon'`, a `push: false`
  (`src/payload.config.ts:65-76`) oznacza, że nic nie migruje automatycznie.
- Wzór migracji: `src/migrations/20260718_0_add_planowana_investment_status.ts`. Ostatnia migracja to
  `20260929_2_drop_kosztorys_presets.ts`.
- Kolekcja jest w grafie CLI Payloada, więc wspólna stała musi leżeć w module bez `server-only`. Wzór:
  `src/lib/constants/investment-lock.ts`.
- `lessons.md` („An exhaustiveness assertion only protects while both sides are authored independently”)
  mówi, że krotka musi zostać **pisana ręcznie `as const`**. Wyprowadzenie jej z `Object.keys` poszerzyłoby
  typ do `string`, a `z.enum` i mapy `Record` przestałyby cokolwiek sprawdzać. Dla statusów inwestycji nie
  ma asercji dryfu, którą kolaps by zdeaktywował.
- `scripts/test-integration.sh:18-33` migruje kontener testowy 5435, gdy zmieni się odcisk migracji, więc spec
  DB zobaczy nową wartość bez ręcznych kroków.

## What We're NOT Doing

- Promocja leada zostaje `planowana` (`src/components/leads/promote-lead-dialog.tsx:85`).
- Brak zmian w logice serwera, SQL, snapshotach, blokadzie i księgowalności.
- Nie zmieniamy nazwy wartości `planowana`: to zamrożony dryf w glosariuszu i osobny temat.
- Brak nowego E2E. Ryzyko przejścia klient → akcja → DB pokrywa spec DB, a filtr pokrywa spec unit.
  `e2e/investment-planowana-status.spec.ts` zostaje bez zmian.
- Nie ukrywamy `szablon` w `/admin`, bo Payload nie umie ukryć pojedynczej opcji (znane z `szablony-crud`).

## Implementation Approach

Faza 1 wprowadza jedną stałą i nowy status od bazy do badge'a. Faza 2 przenosi filtr na tę stałą i
dodaje regułę dziedziczenia dla zapisanych map. Kolejność ma znaczenie: faza 2 czyta listy z fazy 1.

## Critical Implementation Details

- **Kolejność w enumie Postgresa.** Wartość dodaj przez `ADD VALUE IF NOT EXISTS 'quote' AFTER 'planowana'`.
  Nowej wartości **nie wolno użyć** w tej samej migracji (bez `UPDATE`, bez `DEFAULT`), bo Postgres odrzuca
  użycie wartości dodanej w tej samej transakcji.
- **Dziedziczenie filtra dotyczy tylko zapisanych map.** Pusta mapa nadal daje `DEFAULT_STATUSES`.
  Jawne all-false starego formatu (`{planowana:false, active:false, completed:false}`) musi dawać pusty
  wybór, bo Wycena dziedziczy `false` po Planowanej.

## Phase 1: Jedna lista statusów i status `quote`

### Overview

Wprowadza jedno źródło prawdy o statusach, podpina pod nie wszystkie kopie i dodaje `quote` od
migracji po badge.

### Changes Required:

#### 1. Stała statusów

**File**: `src/lib/constants/investment-status.ts` (nowy)

**Intent**: Jedno miejsce z listą statusów w kolejności cyklu życia, polskimi i angielskimi etykietami oraz
podzbiorem statusów wybieranych ręcznie. Moduł bez `server-only`, importowalny z kolekcji.

**Contract**: Ręcznie pisana krotka `INVESTMENT_STATUSES = ['planowana', 'quote', 'active', 'completed',
'szablon'] as const`. Pochodny typ `InvestmentStatusT`. `INVESTMENT_STATUS_LABELS: Record<InvestmentStatusT,
{ pl: string; en: string }>` (Wycena / Quote). `PICKABLE_INVESTMENT_STATUSES` to krotka bez `szablon`, w tej samej
kolejności: to lista dla formularza i filtra. `TEMPLATE_INVESTMENT_STATUS` i `LOCKED_INVESTMENT_STATUS` w
`investment-lock.ts` typuje się tym typem (`satisfies InvestmentStatusT`), żeby literówka była błędem.

#### 2. Konsumenci listy

**Files**:

- `src/types/reference-data.ts:15`: `InvestmentStatusT` re-eksportowany ze stałej, żeby importy się nie
  zmieniły.
- `src/collections/investments.ts:15-23`: `STATUS_OPTIONS` jako `INVESTMENT_STATUSES.map(...)` z etykietami ze
  stałej. Komentarz o `szablon` zostaje przy stałej.
- `src/components/forms/investment-form/investment-schema.ts:14`: `z.enum(INVESTMENT_STATUSES)`.
- `src/components/forms/investment-form/investment-form.tsx:152-154`: `<SelectItem>` generowane z
  `PICKABLE_INVESTMENT_STATUSES` i polskiej etykiety.
- `src/components/investments/investment-status-badge.tsx`: `STATUS_LABELS` wyprowadzone z
  `INVESTMENT_STATUS_LABELS` (`.pl`), eksport zostaje bo czytają go `status-filter.tsx`,
  `investment-info-fields.tsx` i `e2e/investment-planowana-status.spec.ts`. `STATUS_CLASSNAMES` zyskuje
  `quote: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'` i zostaje ręcznym `Record`.
  Kolory to warstwa UI, a `Record` wymusza wpis.

**Intent**: Każda kopia czyta ze stałej. Jedyne ręczne miejsca to mapy `Record<InvestmentStatusT, …>`,
które typecheck wymusza.

#### 3. Migracja

**File**: `src/migrations/20260929_3_add_quote_investment_status.ts` (nowy) plus wpis w `src/migrations/index.ts`

**Intent**: Dodaje wartość do enuma. Addytywna, więc prod trzeba zmigrować **przed** pushem
(`pnpm db:migrate:prod`, robi to człowiek).

**Contract**: `ALTER TYPE "enum_investments_status" ADD VALUE IF NOT EXISTS 'quote' AFTER 'planowana'`.
`down()` to udokumentowany no-op, jak w `20260718_0`. Przed migracją na współdzielonej bazie trzeba
sprawdzić `git status src/migrations` (AGENTS.md).

#### 4. Testy

**Files**:

- `src/__tests__/lib/constants/investment-lock.test.ts:8-13`: wiersz `['quote', true, false]` (księgowalna,
  niezablokowana).
- `src/__tests__/hooks/investments/stamp-completed-at.test.ts:52` i
  `src/__tests__/hooks/investments/guard-template-status.test.ts:25,34`: `quote` dopisane do `it.each`.
- `src/__tests__/collections/investments-status.db.test.ts` (nowy, `skipIf(!ENV_READY)`, wzór:
  `sheets-investment-lock.db.test.ts`): `createTestInvestment(payload, name, { status: 'quote' })`,
  potem odczyt statusu z bazy **SQL-em**, bo trwały stan, a nie wynik `create`, dowodzi, że opcje
  kolekcji i enum Postgresa się zgadzają.

**Intent**: Unit pilnuje, że `quote` zachowuje się jak planowana w predykatach nad `string`. Spec DB pilnuje
granicy kolekcja ↔ enum, której nie widzi żaden typ.

### Success Criteria:

#### Automated Verification:

- Migracja przechodzi lokalnie (5433): `pnpm exec payload migrate`
- Specy fazy przechodzą: `pnpm exec vitest run src/__tests__/lib/constants/investment-lock.test.ts src/__tests__/hooks/investments/stamp-completed-at.test.ts src/__tests__/hooks/investments/guard-template-status.test.ts`
- Spec DB przechodzi: `pnpm test:integration`
- Typy Payloada wygenerowane z `quote`: `pnpm generate:types`

#### Manual Verification:

- W dialogu „Edytuj” inwestycji lista statusów pokazuje kolejno Planowana, Wycena, Aktywna, Zakończona;
  zapis Wyceny się udaje i badge jest bursztynowy.
- Inwestycja w Wycenie pojawia się w pickerze wpłaty/wydatku dopiero po wyłączeniu „Aktywne”, jak planowana.

**Implementation Note**: Po przejściu weryfikacji automatycznej commit i dalej, bez pauzy na ręczne sprawdzenie.

---

## Phase 2: Filtr statusów na jednej liście i dziedziczenie zapisanego wyboru

### Overview

Filtr czyta listę ze stałej. Zapisana mapa bez klucza `quote` przyjmuje wartość Planowanej.

### Changes Required:

#### 1. Hook filtra

**File**: `src/hooks/use-status-filter.ts`

**Intent**: `FILTERABLE_STATUSES` staje się `PICKABLE_INVESTMENT_STATUSES`. `DEFAULT_STATUSES` to
`['planowana', 'quote', 'active']`. `selectionFrom` przy zapisanej, niepustej mapie odczytuje brakujący
klucz `quote` z `planowana`. `toggleStatus` bez zmian: pisze już pełną mapę, więc dziedziczenie
utrwala się przy pierwszym kliknięciu.

**Contract**: `selectionFrom(persisted)`:

- mapa bez żadnej odpowiedzi daje `DEFAULT_STATUSES`;
- w pozostałych przypadkach każdy status z `FILTERABLE_STATUSES` jest wybrany wtedy, gdy ma zapisane
  `true`; dla `quote` bez zapisanej wartości liczy się wartość `planowana`.

Mapa dziedziczenia ma jeden wpis (`quote → planowana`) i żyje przy hooku, bo to migracja danych
localStorage, a nie domena.

#### 2. Testy filtra

**File**: `src/__tests__/use-status-filter.test.ts`

**Intent**: Aktualizacja asercji defaultów (`:46`, `:63-67`) o `quote` i wiersz `quote` w fixture.
Trzy nowe przypadki regresji: stara mapa `{ planowana: true, active: true, completed: false }` daje
wybraną Wycenę; stara mapa z `planowana: false` daje ukrytą Wycenę; stare jawne all-false daje pusty
wybór.

#### 3. Dokumentacja

**Files**:

- `context/reference/kosztorys-editor-domain-notes.md:772-774`: „Planowana lub Aktywna” staje się
  „Planowana, Wycena lub Aktywna”.
- `context/foundation/lessons.md`, lekcja „Status inwestycji to etykieta, nie bramka” (`:1680`): dopisek, że
  od tej zmiany lista żyje w `src/lib/constants/investment-status.ts`, więc jej punkt (1) jest spłacony.
  Nowa reguła: zapisana w localStorage mapa flag to trwały schemat, a nowy klucz potrzebuje reguły dla
  starych map.

### Success Criteria:

#### Automated Verification:

- Spec filtra przechodzi: `pnpm exec vitest run src/__tests__/use-status-filter.test.ts`

#### Manual Verification:

- Na `/inwestycje` z czystym localStorage filtr pokazuje Planowana, Wycena i Aktywna jako zaznaczone.
- Z zapisanym filtrem „tylko Aktywna” (sprzed zmiany) Wycena jest odznaczona. Z zapisanym „Planowana +
  Aktywna” Wycena jest zaznaczona.

---

## Testing Strategy

### Unit Tests:

- Predykaty blokady i księgowalności dla `quote` (`investment-lock.test.ts`).
- Hooki kolekcji: `stamp-completed-at`, `guard-template-status`.
- `selectionFrom`: defaulty, dziedziczenie, all-false.

### Integration Tests:

- Zapis `quote` przez lokalne API Payloada i odczyt SQL-em z 5435.

### Manual Testing Steps:

1. Edytuj inwestycję, ustaw Wycenę, zapisz: badge amber w tabeli i na karcie.
2. Filtr statusów: kolejność, domyślna widoczność, zachowanie przy starym zapisie.
3. Picker wpłaty: Wycena ukryta pod „Aktywne”, widoczna po wyłączeniu.

## Migration Notes

Addytywna: `pnpm db:migrate:prod` **przed** pushem kodu (człowiek). Preview po merge'u:
`pnpm db:migrate:preview`. Rollback kodu jest bezpieczny, bo stary kod nie zna wartości, a żaden wiersz
jej nie ma, dopóki ktoś jej nie ustawi.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:integration`
- `pnpm build`

## References

- Research: `context/changes/2026-09-29-investment-wycena-status/research.md`
- Precedens: `context/archive/2026-07-16-investment-planowana-status/`, `src/migrations/20260718_0_add_planowana_investment_status.ts`
- Lekcje: `context/foundation/lessons.md` (status jako etykieta; asercja wyczerpania)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Jedna lista statusów i status `quote`

#### Automated

- [x] 1.1 Migracja przechodzi lokalnie (5433): `pnpm exec payload migrate`
- [x] 1.2 Specy fazy przechodzą: investment-lock, stamp-completed-at, guard-template-status
- [x] 1.3 Spec DB przechodzi: `pnpm test:integration`
- [x] 1.4 Typy Payloada wygenerowane z `quote`: `pnpm generate:types`

### Phase 2: Filtr statusów na jednej liście i dziedziczenie zapisanego wyboru

#### Automated

- [ ] 2.1 Spec filtra przechodzi: `pnpm exec vitest run src/__tests__/use-status-filter.test.ts`
