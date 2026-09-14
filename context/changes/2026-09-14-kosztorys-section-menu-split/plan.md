# Rozbicie menu ⋯ — akcje sekcji na pasek sekcji

## Overview

Jedno menu ⋯ na wierszu pozycji, niosące dziś dwie grupy („Praca" + „Sekcja"), rozpada się na dwa:
grupa „Sekcja" przenosi się do nowego ⋯ w slocie „Akcje" **paska sekcji**, na wierszu zostaje sama
„Praca". Odwraca `context/archive/2026-07-26-kosztorys-merged-row-menu/`, które samo odwracało
EX-580 p4 (`7af257b2`).

## Current State Analysis

- `grid/cells/section-header-cell.tsx` — `SectionHeaderSlotT = 'label' | 'blank'`. Slot `label`
  maluje cały pasek (nazwa + licznik + kwota + strzałka, przelewa się poza komórkę regułą
  `overflow: visible` z `globals.css`), slot `blank` to pusta komórka, która **też zwija sekcję**.
  `CHROME_COLUMN_IDS = {actions, layerGap}` wyklucza te dwie kolumny z bycia kolumną etykiety.
- `grid/menus/kosztorys-row-actions-menu.tsx` — obie grupy pod `DropdownMenuLabel` rozdzielone
  `DropdownMenuSeparator`; `section?: SectionActionsT` gatuje całą grupę „Sekcja";
  `pendingRemoval: 'item' | 'section' | null` steruje jednym `ConfirmDialog` dla obu celów.
- `grid/row-actions-column.tsx` — składa bundle `section` z czterech callbacków `editorOnly()` +
  `opts.getSectionItemCount`, i podpina `onAddFromCatalogue` pod bramkę sekcji (praca ląduje w
  sekcji tego wiersza). `useCataloguePicker()` czytany z kontekstu, nie z `opts` (EX-496).
- `kosztorys-editor-body.tsx:165` — buduje `sectionHeader` (`figures` / `collapsedSectionIds` /
  `onToggleCollapsed` / `onRename` / `labelColumnId`) i podaje go do `withSyntheticRows`.
  `figures` niesie już `itemCount` i `net` per sekcja.
- `use-kosztorys-editor.ts:496-505` — `onInsertSection` / `onReorderSection` / `onSetSectionColor` /
  `onRemoveSection` / `getSectionItemCount` żyją w `columnOpts`; na zewnątrz hook zwraca dziś tylko
  `onRenameSection` (linia 1241).
- `kosztorys-v2-columns.tsx:410-413` — kolumna „Akcje" powstaje **wyłącznie** poza trybem read-only.
  Widok klienta nie ma jej wcale, więc pasek nie potrzebuje osobnej bramki.
- `ui/datasheet-grid/cell-menu-trigger.tsx` — `CellMenuTrigger` ma parametr `className` z komentarzem
  wprost o tincie paska; prymityw gotowy, nic do dopisania.
- `CataloguePickerHost` opakowuje całe ciało edytora, więc `useCataloguePicker()` jest osiągalne z
  komórki paska tak samo jak z komórki wiersza.
- Spec `__tests__/components/kosztorys/editor/grid/cells/section-band-label-column.test.ts` pokrywa
  `sectionBandLabelColumnId` i `sectionHeaderSlot` — trzeci slot dopina się tam.

## Desired End State

W trybie edytora każdy pasek sekcji ma w kolumnie „Akcje" własne ⋯, przebarwione na kolor sekcji.
Kliknięcie tej jednej komórki otwiera menu sekcji (Wstaw powyżej/poniżej, Przesuń w górę/dół, kolor,
„Dodaj pracę z katalogu…", „Usuń sekcję") i **nie zwija** sekcji; każda inna komórka paska zwija jak
dotąd. Menu ⋯ wiersza niesie już tylko akcje pozycji, bez nagłówków grup i bez separatora. Zwinięta
sekcja zachowuje pełen dostęp do swoich komend.

### Key Discoveries

- `SectionDot` bierze barwę z `--section-rail` ustawianego na wierszu przez `rowClassName`, z
  fallbackiem `var(--color-muted-foreground)` — ⋯ paska bierze ten sam wzorzec i nie potrzebuje
  własnego fallbacku dla sekcji bez koloru.
- `figures.get(sectionId).itemCount` daje pasek licznika pozycji do `ConfirmDialog`, więc
  `opts.getSectionItemCount` traci ostatniego konsumenta wraz z fazą 2.
- Treść `ConfirmDialog` dla „Usuń sekcję" jest dziś w menu wiersza; po rozbiciu ta sama `description`
  jest potrzebna w obu menu — jedna stała, nie dwa literały.
- Punkt wyjścia dla nowego pliku: `git show 7af257b2 -- src/components/kosztorys/editor/grid/menus/kosztorys-section-actions-menu.tsx`
  (plik skasowany). Uwaga: `CellMenuTrigger` i obecna treść `ConfirmDialog` są nowsze niż tamten commit.

## What We're NOT Doing

- **Nie dodajemy awaryjnego wejścia do akcji sekcji przy włączonym sortowaniu.** Sortowanie kolumny
  usuwa paski z gridu, więc razem z nimi znika menu sekcji — świadomie przyjęte (decyzja 2 w
  `change.md`). Dziś przy sortowaniu kolor i „Usuń sekcję" jeszcze działają z wiersza; po zmianie
  trzeba najpierw wyczyścić sortowanie.
- **Nie zmieniamy miejsca wstawiania prac z katalogu** — nadal koniec sekcji, `appendCatalogueItems`
  bez zmian. Zero ruchu w `lib/actions` i `lib/kosztorys`.
- **Nie tykamy inline rename, kropki koloru ani kwot na pasku.**
- **Nie piszemy specu E2E i nie zakładamy issue `e2e-backlog`** (decyzja właściciela) — zostaje sam
  unit. Gate archiwizacji o to zapyta; odpowiedź jest tutaj.
- Nie ruszamy `column-config.ts` — pasek nadal niesie tożsamość sekcji, kolumna „Sekcja" zostaje
  domyślnie ukryta.

## Implementation Approach

Najpierw **dodać** menu na pasku (faza 1), dopiero potem **odjąć** grupę z wiersza (faza 2). Odwrotna
kolejność zostawiłaby commit, w którym akcji sekcji nie ma nigdzie. Faza 3 domyka dokumentację.

Callbacki sekcji dojeżdżają na pasek tą samą drogą co `onRename`: hook oddaje je na zewnątrz, ciało
edytora wkłada je do memo `sectionHeader`, `withSyntheticRows` wiezie je na `columnData`. Żadnego
nowego kontekstu — value-identity churn w `KosztorysEditorProvider` to regresja EX-496, odwrócona
raz już wcześniej.

## Critical Implementation Details

**Stabilność referencji.** `sectionHeader` jest memoizowane i ląduje na `columnData` każdej kolumny;
nowe callbacki muszą wejść do tablicy zależności tego `useMemo`, a same być stabilne (są — wszystkie
przechodzą przez `editorOnly()` na stabilnych handlerach hooka). Niestabilna referencja przerysuje
każdą komórkę gridu przy każdym renderze.

**Zwijanie.** Slot `actions` renderuje wyłącznie trigger menu — bez `onClick={toggle}`, bez
`stopPropagation`. Brak handlera jest całą mechaniką: komórka nigdy nie zwija, bo nie ma czym.

## Phase 1: Menu sekcji na pasku

### Overview

Nowy slot `actions` paska + nowe menu sekcji, zasilone callbackami dowiezionymi z hooka. Po tej fazie
akcje sekcji są w DWÓCH miejscach naraz — to stan przejściowy, domknięty fazą 2.

### Changes Required

#### 1. Menu sekcji

**File**: `src/components/kosztorys/editor/grid/menus/kosztorys-section-actions-menu.tsx` (nowy)

**Intent**: Menu ⋯ paska: cztery komendy porządkowe, `SectionColorPicker`, „Dodaj pracę z
katalogu…" i destrukcyjne „Usuń sekcję" z `ConfirmDialog`. Bez bramki `sortActive` — przy sortowaniu
paski nie istnieją, więc i to menu nie istnieje.

**Contract**: Eksportuje `KosztorysSectionActionsMenu` przyjmujące tożsamość sekcji (`sectionId`,
`name`, `itemCount`, `color`) i cztery handlery + `onSetColor` / `onRemove`. Trigger to
`CellMenuTrigger` z `className` tintującym ikonę na `--section-rail` (ten sam fallback co
`SectionDot`). „Dodaj pracę z katalogu…" woła `useCataloguePicker()(sectionId)`.

#### 2. Wspólna treść potwierdzenia usunięcia sekcji

**File**: `src/components/kosztorys/editor/grid/menus/` (stała obok obu menu)

**Intent**: Jedna stała z `description` „Usunięte zostaną też wpisane ilości etapów…", czytana przez
menu wiersza i menu sekcji — ten sam komunikat w dwóch plikach rozjedzie się przy pierwszej korekcie.

**Contract**: Eksportowana stała stringowa; `kosztorys-row-actions-menu.tsx` przestaje trzymać
literał.

#### 3. Trzeci slot paska

**File**: `src/components/kosztorys/editor/grid/cells/section-header-cell.tsx`

**Intent**: `SectionHeaderSlotT` zyskuje `'actions'`; `sectionHeaderSlot` zwraca go dla kolumny
`actions`. Komórka tego slotu renderuje menu sekcji (gdy handlery są) i nie ma handlera zwijania.
`SectionHeaderContextT` przyjmuje opcjonalny bundle akcji sekcji — jeden obiekt, nie pięć pól, bo
wszystkie przychodzą z tej samej bramki `editorOnly()`.

**Contract**: `sectionHeaderSlot(columnId, labelColumnId)` → `'actions' | 'label' | 'blank'`;
`'actions'` rozstrzygane przed `label`. `CHROME_COLUMN_IDS` bez zmian — `actions` nadal nie może być
kolumną etykiety.

#### 4. Dowiezienie handlerów sekcji na pasek

**Files**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`,
`src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: Hook oddaje na zewnątrz cztery handlery sekcji obok istniejącego `onRenameSection`; ciało
edytora wkłada je do memo `sectionHeader`.

**Contract**: Zwracany kształt hooka rośnie o bundle akcji sekcji (`undefined` w read-only, tak jak
`onRenameSection`); tablica zależności `useMemo` dla `sectionHeader` rośnie o ten bundle.

### Success Criteria

#### Automated Verification

- Spec slotów przechodzi, z nowymi przypadkami dla `'actions'`: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/cells/section-band-label-column.test.ts`

#### Manual Verification

- ⋯ jest widoczne na każdym pasku sekcji w trybie edytora i przebarwione na kolor sekcji; na sekcji bez koloru bierze barwę neutralną, nie znika
- Kliknięcie w komórkę „Akcje" paska otwiera menu i NIE zwija sekcji; kliknięcie w dowolne inne miejsce paska nadal zwija/rozwija
- Zwinięta sekcja: wszystkie sześć komend z menu paska działa bez rozwijania
- „Dodaj pracę z katalogu…" otwiera okno z tą sekcją wybraną w „Dodaj do:"
- „Usuń sekcję" pokazuje nazwę i liczbę pozycji tej sekcji i usuwa właściwą sekcję
- Widok klienta (read-only): pasek bez ⋯, bez zmian względem dziś

---

## Phase 2: Odchudzenie menu wiersza

### Overview

Grupa „Sekcja" i „Wybierz pozycję z katalogu prac" znikają z menu wiersza; razem z nimi znikają
nagłówki grup, separator i osierocony `getSectionItemCount`.

### Changes Required

#### 1. Menu wiersza

**File**: `src/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.tsx`

**Intent**: Zostają wyłącznie akcje pozycji. Prop `section` i `onAddFromCatalogue` wypadają, a z nimi
oba `DropdownMenuLabel` i `DropdownMenuSeparator` — przy jednej grupie etykieta nie ma czego
rozróżniać. `ConfirmDialog` traci gałąź sekcji.

**Contract**: `PropsT` bez `section`; `item` bez `onAddFromCatalogue`; stan potwierdzenia schodzi z
`'item' | 'section' | null` do boolean. `sortActive` i „Zapisz pozycję do katalogu prac" bez zmian.

#### 2. Kolumna akcji wiersza

**File**: `src/components/kosztorys/editor/grid/row-actions-column.tsx`

**Intent**: Znika składanie bundle'a `section` i `useCataloguePicker()` — komórka wiersza nie ma już
po co go czytać.

**Contract**: `RowActionsCell` przekazuje wyłącznie `item` + `sortActive`.

#### 3. Martwa opcja kolumn

**Files**: `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts`,
`src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: `getSectionItemCount` traci ostatniego konsumenta (pasek czyta `itemCount` z `figures`) —
usunąć z typu opts i z `columnOpts`. Cztery handlery sekcji zostają w opts tylko wtedy, gdy ma je
jeszcze kto czytać; jeśli nie — również wypadają.

**Contract**: Usunięcie gatowane na `pnpm typecheck`, nie na grepie.

### Success Criteria

#### Automated Verification

- Specy kolumn gridu przechodzą: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/`

(Poza tym ta faza nie ma własnego automatu — to odejmowanie UI; sieć bezpieczeństwa to typecheck z
bramki całego drzewa i checki manualne poniżej.)

#### Manual Verification

- Menu ⋯ wiersza nie zawiera już grupy „Sekcja" ani „Wybierz pozycję z katalogu prac"; nie ma w nim
  nagłówków „Praca"/„Sekcja" ani separatora
- „Zapisz pozycję do katalogu prac" i wszystkie akcje pozycji działają jak dotąd
- Przy włączonym sortowaniu kolumny: menu wiersza ma wygaszone Wstaw/Przesuń, a paski (więc i menu
  sekcji) nie są renderowane — akcje sekcji wracają po „Wyczyść sortowanie"

---

## Phase 3: Dokumentacja

### Overview

Rejestr checków manualnych i notatki domenowe mówią dziś o stanie sprzed tej zmiany.

### Changes Required

#### 1. Rejestr checków

**File**: `context/foundation/manual-checks.md`

**Intent**: Dwa otwarte FAIL-e EX-580 (linie 581 i 589) opisują projekt porzucony w 2026-07-26 i
przywrócony tutaj — domknąć je odsyłaczem do tej zmiany i wnieść checki manualne faz 1-2 pod własną
sekcją.

**Contract**: Sekcja EX-580 zostaje, oba wpisy dostają rozstrzygnięcie zamiast „Wymaga człowieka".

#### 2. Zapis decyzji

**File**: `context/changes/2026-09-14-kosztorys-section-menu-split/change.md`

**Intent**: `status: planned`, `updated` na dziś.

### Success Criteria

#### Automated Verification

Brak — faza czysto prozatorska.

#### Manual Verification

- `manual-checks.md` nie zawiera już otwartego FAIL-a mówiącego, że pasek nie ma menu

---

## Testing Strategy

### Unit Tests

- `sectionHeaderSlot` zwraca `'actions'` dla kolumny `actions` i nadal `'label'`/`'blank'` dla reszty
- Kolumna `actions` nadal nigdy nie zostaje kolumną etykiety (`sectionBandLabelColumnId`) — istniejący
  przypadek chroni przed tym, żeby trzeci slot nie przeciekł do rozstrzygania etykiety

### Manual Testing Steps

1. Edytor, sekcja z kolorem: kliknij ⋯ na pasku → menu; kliknij obok → zwija
2. Zwiń sekcję → ⋯ na pasku → „Przesuń w górę" → sekcja zmienia miejsce, pozostaje zwinięta
3. ⋯ na pasku → „Dodaj pracę z katalogu…" → „Dodaj do:" wskazuje tę sekcję
4. ⋯ wiersza → brak grupy „Sekcja"
5. Włącz sortowanie kolumny → paski znikają; wyczyść → wracają razem z menu

## Whole-tree Gate

- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy jednostkowe: `pnpm test`

## References

- Decyzje i tło: `context/changes/2026-09-14-kosztorys-section-menu-split/change.md`
- Poprzedni obrót: `context/archive/2026-07-26-kosztorys-merged-row-menu/change.md`
- Skasowane menu sekcji do odtworzenia: `git show 7af257b2 -- src/components/kosztorys/editor/grid/menus/kosztorys-section-actions-menu.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Menu sekcji na pasku

#### Automated

- [x] 1.1 Spec slotów z przypadkami dla `'actions'` — 38e493d1

### Phase 2: Odchudzenie menu wiersza

#### Automated

- [x] 2.1 Specy kolumn gridu przechodzą

### Phase 3: Dokumentacja

#### Automated

- [ ] 3.1 (brak — faza prozatorska)
