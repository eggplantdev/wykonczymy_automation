# Eksport kosztorysu do CSV (płaski + grupowany) — design

- **Data:** 2026-06-20
- **Change:** `kosztorys-poc-in-app` (pytanie do właściciela #3 — eksport)
- **Status:** zatwierdzony (właściciel, 2026-06-20)

## Cel

Eksport bieżącego, widocznego stanu edytora kosztorysu do **CSV** — dwie wersje
(płaska i grupowana) do porównania w bake-offie. CSV dobrze ląduje w Google Sheets
(BOM UTF-8). Bez druku HTML, bez osobnej strony, bez migracji/auth/Drive — czysto
lokalne.

**Dlaczego nie PDF/druk HTML:** kosztorys ma kilkanaście stron → druk przeglądarki
byłby nieczytelny. Odrzucone świadomie.

**Dlaczego CSV, nie zapis przez Google Sheets API:** dobry CSV wczytany do Sheets
załatwia „zapis w Sheets". Adapter pisania przez API (service account) niesie
ograniczenie Drive (SA nie tworzy nowych arkuszy na koncie prywatnym — patrz
[[project_kosztorys_sa_no_drive_storage]]) i zostaje jako ewentualne v2 na tym samym
rdzeniu. Pomijamy w v1.

## Model: WYSIWYG snapshot bieżącego stanu

Eksport bierze **dokładnie to, co widać** w edytorze w chwili kliknięcia:

- `viewRows` — wiersze już przefiltrowane (szukajka / filtr sekcji) i posortowane,
- widoczne kolumny — zestaw kolumn minus `hidden` (Twój toggle „Kolumny"),
- aktywny widok ceny (`PriceViewT`: Robocizna / Z narzędziami / Bez narzędzi).

Filtry to te same kontrolki, które już są w edytorze — nie budujemy osobnego
ekranu „przygotuj eksport". Ustawiasz widok pod klienta, klikasz CSV. Nic się nie
zapisuje (świeży snapshot za każdym razem).

## Architektura

Jeden wspólny rdzeń (snapshot + rejestr kolumn), na nim dwa buildery i kontrolka UI.

### 1. `src/lib/export/csv-cell.ts` — wspólny `escapeCsv` (refactor)

`escapeCsv` żyje dziś prywatnie w `src/lib/export/csv.ts` (eksport transferów).
Wyciągamy do `src/lib/export/csv-cell.ts` i reużywamy w obu ścieżkach (transfery +
kosztorys). `csv.ts` importuje go zamiast trzymać lokalnie — zero zmiany zachowania.

### 2. `src/lib/export/kosztorys-columns.ts` — rejestr kolumn

```ts
type KosztorysExportColumnT = {
  label: string
  getValue: (row: KosztorysV2RowT, view: PriceViewT) => string
}
export const KOSZTORYS_EXPORT_COLUMNS: Record<string, KosztorysExportColumnT>
export function kosztorysExportColumnIds(stages: KosztorysStageT[]): string[]
```

- Kolumny statyczne: `section` (nazwa sekcji), `description`, `unit`, `measuredQty`,
  `price` (wg widoku), `discount`, `net` (wg widoku), `vat`, `gross`. Reuse
  `formatPLN` i helpery z `calc.ts` (`viewPrice`, `rowNetForView`, VAT z
  `vatRate ?? sectionVatRate`).
- Kolumny dynamiczne etapów: `stage_<id>` → ilość wykonana w etapie (z wiersza v2).
- `kosztorysExportColumnIds(stages)` daje pełną listę id w kolejności prezentacji —
  z niej UI odfiltrowuje `hidden`, dając „widoczne kolumny".

### 3. `src/lib/export/kosztorys-csv.ts` — dwa buildery

```ts
export function buildKosztorysCsvFlat(
  rows: KosztorysV2RowT[],
  visibleColumnIds: string[],
  view: PriceViewT,
): string

export function buildKosztorysCsvGrouped(
  rows: KosztorysV2RowT[],
  visibleColumnIds: string[],
  view: PriceViewT,
  subtotals: SectionSubtotalT[],
): string
```

- **Płaski:** nagłówek + jeden wiersz na pozycję; „Sekcja" jako kolumna. Mirror
  `buildTransferCsv` (escape, `join(',')`, `join('\n')`).
- **Grupowany:** per sekcja → wiersz-nagłówek z nazwą sekcji, pod nim pozycje, pod
  nimi wiersz „Subtotal <sekcja>" (netto z `subtotals`); na końcu pusty wiersz +
  „Suma netto / VAT / brutto". Reuse `sectionSubtotalsForView` (już istnieje).
  Wiersze nie-pozycyjne wyrównane do tych samych kolumn (puste komórki gdzie trzeba).

### 4. Kontrolka w pasku edytora — `kosztorys-csv-button.tsx`

- Dropdown/dwa przyciski: „CSV płaski" / „CSV grupowany" (obok „Sekcje"/„Kolumny").
- Bierze bieżący snapshot z edytora: `viewRows`, widoczne id kolumn, `view`,
  `subtotals` (dla grupowanego — edytor już je liczy).
- `new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })` →
  `triggerDownload` (reuse `@/lib/export/download`). Nazwa: `kosztorys-<inwestycja>-<data>.csv`
  (wariant w nazwie: `…-plaski` / `…-grupowany`, żeby porównać dwa pliki).

## Integracja z edytorem (`kosztorys-editor-v2.tsx`)

Edytor już trzyma `viewRows`, `view`, `hidden`, `subtotals`, `investmentName`.
Dorzucamy tylko: listę widocznych id kolumn (z `kosztorysExportColumnIds(tree.stages)`
minus `hidden`) i osadzamy `kosztorys-csv-button` w pasku górnym. Zero zmian w
logice siatki/autosave.

## Bake-off

Dwie wersje współistnieją (dwa wyjścia jednej kontrolki). Właściciel generuje oba,
otwiera w Google Sheets, ocenia czytelność/użyteczność. Zwycięzca zostaje, drugi
builder się usuwa — wzorzec jak przy bake-offie edytora v1/v2.

## Jakość (POC — bez testów)

Faza POC: **bez testów jednostkowych** — POC może pójść do piachu, testy dochodzą
na etapie MVP (patrz [[feedback_no_tests_in_poc_phase]]). Bramka jakości:
`pnpm typecheck` + `pnpm exec next build` + weryfikacja w przeglądarce (oba pliki
otwarte w Sheets wyglądają poprawnie, escaping przecinków/cudzysłowów OK, liczby
czytelne).

## Poza zakresem (YAGNI / v2)

- Zapis przez Google Sheets API (SA + ograniczenie Drive) — ten sam rdzeń snapshotu.
- Eksport PDF / druk HTML — odrzucony (nieczytelny przy wielu stronach).
- Osobny ekran „przygotuj eksport" z trwałymi flagami `hiddenInExport` — niepotrzebny;
  filtrowanie to bieżące kontrolki edytora, snapshot świeży.
