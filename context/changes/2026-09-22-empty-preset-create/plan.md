# Nowy pusty szablon kosztorysu z poziomu /szablony — Implementation Plan

## Overview

`/szablony` umie dziś tylko otworzyć, przemianować i usunąć szablon. Szablon rodzi się wyłącznie
jako kopia istniejącego kosztorysu („Zapisz jako szablon" w edytorze). Ten change dokłada drugą,
brakującą drogę narodzin: pusty szablon zakładany z listy, otwierany od razu w warsztacie, gdzie
użytkownik buduje go od zera.

## Current State Analysis

- `savePresetAction` (`src/lib/actions/kosztorys-presets.ts:46`) jest jedynym miejscem, które wstawia
  wiersz do `kosztorys_presets`, i zawsze przez `serializeKosztorysAsPreset(investmentId)` — czyli
  wymaga istniejącej inwestycji z drzewem.
- `insertPreset` (`src/lib/db/presets.ts:35`) przyjmuje dowolny `SnapshotPayloadT` i rozstrzyga
  kolizję nazw przez `ON CONFLICT (name) DO NOTHING` → `null`. Nie wymaga żadnego drzewa.
- `PresetsDataTable` (`src/components/presets/presets-data-table.tsx`) renderuje `DataTable` bez
  `toolbar` i bez `aboveToolbar` — na stronie nie ma dziś żadnego przycisku akcji.
- `useOpenPreset` (`src/components/presets/use-open-preset.ts`) wykonuje `openPresetInWorkshopAction`
  i nawiguje na `/szablony/<id>`; otwarcie szablonu jest WRITE-em do współdzielonego warsztatu.
- `/szablony/[id]` (`src/app/(frontend)/szablony/[id]/page.tsx`) renderuje pełny `KosztorysEditorV2`,
  a `kosztorys-editor-body.tsx:447` ma stan pusty — edytor bez sekcji jest obsłużony.
- `settings` w payloadzie szablonu jest **ignorowane przy wczytaniu**
  (`replace-tree-with-snapshot.ts` nie bierze ustawień z drzewa poza importem z arkusza), więc dla
  pustego szablonu to pole jest inertne i wystarczy, żeby spełniało typ.

## Desired End State

Na `/szablony` jest przycisk „Nowy szablon". Kliknięcie otwiera dialog z jednym polem na nazwę;
zatwierdzenie zakłada szablon z pustym drzewem, wczytuje go do warsztatu i przenosi na
`/szablony/<id>`, gdzie stoi pusty edytor gotowy na „Dodaj sekcję". Nazwa zajęta → czytelny błąd,
dialog zostaje otwarty.

Weryfikacja: nowy szablon widać na liście z licznikiem `0 sekcji / 0 pozycji`, a po wejściu do
warsztatu i dodaniu sekcji „Zapisz" w warsztacie nadpisuje go normalnie.

### Key Discoveries:

- `insertPreset` zwraca `null` przy zajętej nazwie — komunikat „Szablon o tej nazwie już istnieje"
  jest już sformułowany w `savePresetAction` (`kosztorys-presets.ts:74`); ten sam tekst, jedno
  źródło brzmienia.
- `getPresetRows` (`src/lib/queries/presets.ts:48`) składa liczniki z `getPresetSections`, które dla
  pustego payloadu nie zwraca żadnego wiersza → `sectionCount: 0, itemCount: 0` wychodzi samo, bez
  zmian w zapytaniu.
- Wzorzec „przycisk + dialog nad tabelą" istnieje: `AddCatalogueItemDialog` wpięty przez
  `DataTableToolbar actions={…}` (`work-catalogue-data-table.tsx:137`).
- Wzorzec „dialog z jednym polem na nazwę" istnieje w tym samym katalogu: `FormDialogShell` + `Input`
  w `PresetRowActions` (zmiana nazwy szablonu).
- `DEFAULT_COEFFS` i `DEFAULT_VAT` (`src/lib/kosztorys/constants.ts:48,53`) to jedyne źródło wartości
  domyślnych — pusty payload bierze je stamtąd zamiast wpisywać liczby.

## What We're NOT Doing

- Nie filtrujemy szablonów z zerem sekcji w wyborze przy zakładaniu inwestycji — decyzja właściciela:
  pusty szablon ma się tam pojawiać (efekt równy „bez szablonu").
- Nie zmieniamy uprawnień: zakładanie idzie przez `protectedAction`, tak jak `savePresetAction`.
  Owner-only zostaje tylko na usuwaniu i przemianowywaniu.
- Nie dotykamy `serializeKosztorysAsPreset`, ścieżki „Zapisz jako szablon" ani warsztatu.
- Nie dokładamy szablonu startowego / szkieletu sekcji — „pusty" znaczy pusty.
- Nie zmieniamy `SNAPSHOT_SCHEMA_VERSION` (payload trzyma dzisiejszy kształt, tylko z pustymi
  tablicami).

## Implementation Approach

Dwie fazy: serwerowa akcja z pustym payloadem, potem UI listy. Faza 1 jest w pełni testowalna
DB-backed spec-em, faza 2 to złożenie dwóch istniejących wzorców (`DataTableToolbar actions` +
`FormDialogShell`).

## Critical Implementation Details

**Kolejność w dialogu po sukcesie.** Zamknięcie dialogu musi poprzedzać `open(id)` z `useOpenPreset`
— nawigacja rozmontowuje stronę razem z dialogiem, a `startTransition` trzymający otwarty dialog
zostawia na ekranie modal na tle nowej strony. Sam `open()` jest WRITE-em do **współdzielonego**
warsztatu: wyrzuca z niego to, co ktoś inny miał otwarte, dokładnie jak każde inne „Otwórz".

---

## Phase 1: Akcja zakładająca pusty szablon

### Overview

Serwerowa ścieżka: nowy wiersz w `kosztorys_presets` z drzewem pustym, zwracający id do nawigacji.

### Changes Required:

#### 1. Akcja

**File**: `src/lib/actions/kosztorys-presets.ts`

**Intent**: Dodać `createEmptyPresetAction(name)` — zakłada szablon bez źródłowego kosztorysu, jedyna
ścieżka narodzin szablonu poza `savePresetAction`. Wraz z nią prywatny builder pustego payloadu,
biorący współczynniki i VAT z `DEFAULT_COEFFS` / `DEFAULT_VAT` (pole inertne — `settings` szablonu
nie jest stosowane przy wczytaniu, a typ go wymaga).

**Contract**: `createEmptyPresetAction(name: string): Promise<ActionResultT<{ id: number }>>`.
`protectedAction('createEmptyPresetAction', …, ['presets'])`, walidacja nazwy przez
`savePresetSchema.shape.name` (ten sam trim + komunikat „Podaj nazwę szablonu"). Payload:
`{ schemaVersion: SNAPSHOT_SCHEMA_VERSION, sections: [], items: [], stages: [], progress: [], settings }`.
`insertPreset` → `null` zwraca `{ success: false, error: 'Szablon o tej nazwie już istnieje' }`,
brzmienie wzięte ze stałej współdzielonej z `savePresetAction` zamiast drugiego literału.

### Success Criteria:

#### Automated Verification:

- Nowy blok w `src/__tests__/lib/actions/kosztorys-presets.test.ts` przechodzi:
  `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-presets.test.ts`
  - zakłada szablon i sprawdza **stan w bazie**: wiersz istnieje, `payload.sections` i `payload.items`
    są puste, `schema_version` = bieżąca;
  - druga próba na tej samej nazwie zwraca błąd i **nie** dokłada wiersza;
  - `openPresetInWorkshopAction` na pustym szablonie kończy się sukcesem, a drzewo warsztatu po
    wczytaniu ma 0 sekcji (to jest realne ryzyko tej zmiany: `replaceTreeWithSnapshot` na pustym
    drzewie).

#### Manual Verification:

- Brak — faza bez UI.

---

## Phase 2: Przycisk i dialog na /szablony

### Overview

Wejście z listy: przycisk w toolbarze, dialog z nazwą, po zapisie od razu warsztat.

### Changes Required:

#### 1. Dialog

**File**: `src/components/presets/create-empty-preset-dialog.tsx` (nowy)

**Intent**: Przycisk „Nowy szablon" otwierający dialog z jednym polem na nazwę; po udanym zapisie
zamyka się i otwiera świeży szablon w warsztacie, bo pusty szablon bez wejścia do warsztatu nie ma
żadnej wartości.

**Contract**: `CreateEmptyPresetDialog()` — bez propsów. Buduje na `FormDialogShell` + `Input`, tak
jak dialog zmiany nazwy w `PresetRowActions` (`confirmDisabled` na pustej nazwie, Enter zatwierdza,
`pending` / `pendingLabel`). Wywołuje `createEmptyPresetAction`, przy błędzie `toastMessage(…, 'error')`
i dialog zostaje otwarty; przy sukcesie zamyka dialog, po czym `useOpenPreset().open(data.id)`.
Trigger: `<Button variant="outline" size="sm">` z ikoną `Plus` — parytet z „Nowa praca" w katalogu.

#### 2. Wpięcie w listę

**File**: `src/components/presets/presets-data-table.tsx`

**Intent**: Tabela szablonów nie ma dziś toolbara — dokładamy go wyłącznie po to, żeby powiesić
akcję w miejscu, w którym siedzi ona na każdej innej liście.

**Contract**: `toolbar={() => <DataTableToolbar actions={<CreateEmptyPresetDialog />} />}` — bez
`search`, `filters` i `columns`; slot `actions` sam ustawia się po prawej.

### Success Criteria:

#### Automated Verification:

- Nowy spec `src/__tests__/components/presets/create-empty-preset-dialog.test.tsx` przechodzi:
  `pnpm exec vitest run --project dom src/__tests__/components/presets/create-empty-preset-dialog.test.tsx`
  - pole nazwy puste → przycisk zatwierdzenia zablokowany;
  - błąd akcji (zajęta nazwa) → dialog **nadal otwarty** i komunikat widoczny.
    (`'use server'` jest w jsdom stubowane i rzuca — akcję trzeba `vi.mock`-ować jawnie.)

#### Manual Verification:

- „Nowy szablon" na `/szablony` zakłada szablon i ląduje w pustym edytorze pod jego nazwą.
- Nazwa zajęta → komunikat, dialog zostaje otwarty, nic się nie zakłada.
- Po dodaniu sekcji w warsztacie „Zapisz" nadpisuje ten szablon, a lista pokazuje niezerowe liczniki.
- Pusty szablon jest widoczny na liście szablonów przy zakładaniu nowej inwestycji i zakłada
  inwestycję z pustym kosztorysem (zachowanie oczekiwane).

---

## Testing Strategy

### Unit / integration:

- DB-backed spec akcji dochodzi do **stanu utrwalonego**, nie do wyniku akcji — `insertPreset` może
  zwrócić id, a wczytanie pustego drzewa dopiero pokazuje, czy `replaceTreeWithSnapshot` to znosi.

### DOM:

- Jeden spec na dialog: zablokowany zapis przy pustej nazwie i dialog przeżywający błąd. Reszta
  (nawigacja po sukcesie) to przejście klient → akcja → DB → nawigacja, czyli warstwa E2E.

### E2E:

Ryzyko przeglądarkowe (założenie → wczytanie do warsztatu → nawigacja) należy do
`e2e/kosztorys-presets.spec.ts`. Zgodnie z regułą repo slice oddaje E2E na bramce review: albo spec
dopisany do tego pliku, albo issue z etykietą `e2e-backlog`. **Nie uruchamiamy suite'u E2E w trakcie
implementacji.**

## Migration Notes

Brak — żadnej zmiany schematu ani formatu payloadu.

## Whole-tree Gate

Raz, po ostatniej fazie:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

## References

- Identity: `context/changes/2026-09-22-empty-preset-create/change.md`
- Wzorzec przycisku nad tabelą: `src/components/work-catalogue/work-catalogue-data-table.tsx:137`
- Wzorzec dialogu z nazwą: `src/components/presets/preset-row-actions.tsx`
- Wcześniejsze zmiany wokół szablonów: `context/archive/2026-09-14-szablony-crud/`,
  `context/archive/2026-08-12-ex-560-reload-from-preset/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Akcja zakładająca pusty szablon

#### Automated

- [x] 1.1 Spec akcji przechodzi (pusty payload w bazie, kolizja nazwy, wczytanie do warsztatu) — 11636bc8

### Phase 2: Przycisk i dialog na /szablony

#### Automated

- [x] 2.1 Spec DOM dialogu przechodzi (pusta nazwa blokuje zapis, błąd nie zamyka dialogu) — a54d5f07
