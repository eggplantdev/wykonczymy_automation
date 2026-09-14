# Drukowanie przefiltrowanej listy transakcji — plan wdrożenia

## Overview

Wraca przycisk „Drukuj" w toolbarze tabeli transakcji, skasowany 2026-08-12 przez EX-672. Wraca
**sam wydruk wierszy** — bez nagłówka z figurami finansowymi, który był całym powodem usunięcia
(liczył własny „Bilans" jako sumę widocznych kafelków v1 przez globalny store, czyli był drugim,
niezależnym czytnikiem figur). Wiersze nie są figurami, więc problem drugiego czytnika nie wraca,
nie trzeba deklarować płaszczyzny v1/v2 i nie wraca dług w `pnpm test:parity`.

## Current State Analysis

Przycisku nie ma. Skasowane moduły (`src/lib/export/*`, `print-button.tsx`, `csv-button.tsx`,
`transfer-export-toolbar.tsx`, `stores/header-fields-store.ts`) nie istnieją, a `git revert` nie
wejdzie — siedem modułów, na których wisiał patch, zmieniło nazwy, a trzy zachowania zmieniły się po
usunięciu (`research.md` § „Why a revert cannot land").

Co przetrwało i jest gotowe do użycia **bez zmian**:

- `src/lib/actions/fetch-transfers-for-invoices.ts:12-31` — `fetchFilteredTransfers(where)`,
  `'use server'`, `requireAuth(MANAGEMENT_ROLES)`, nieostronicowane, i **wciąż** ANDuje
  `cancelled != true` oraz `type != 'CANCELLATION'`. To dokładnie decyzja właściciela z 2026-09-14.
  Nazwa pliku wymienia tylko jednego z dwóch konsumentów — zostawiamy, nie forkujemy.
- `src/components/transfers/transfer-data-table.tsx:65-74` — toolbar render-prop, dawny dom przycisku.
  `config.query.where` jest w zasięgu (używa go już `InvoiceDownloadButton`).
- `src/components/dialogs/invoice-preview-dialog.tsx:55-102` — sprawdzony mechanizm drukowania:
  `window.open('', '_blank')` → zbuduj dokument → `print()`.
- `src/lib/utils/escape-html.ts` — używany przez mailer leadów.
- `formatPLN` (`format-currency.ts:8`), `formatPLDate`/`formatPLDateTime` (`format-date.ts`,
  przypięte do `Europe/Warsaw`).

### Key Discoveries

- **`table.getVisibleLeafColumns()` załatwia widoczność _i_ kolejność naraz.** Zweryfikowane
  w `@tanstack/table-core@8.21.3`: `getAllLeafColumns` (`core/table.ts:499-506`) przepuszcza listę
  przez `_getOrderColumnsFn()`, a `getVisibleLeafColumns`
  (`features/ColumnVisibility.ts:250`) to ta sama lista przefiltrowana po `getIsVisible()`. Toolbar
  dostaje `table` w kontekście (`data-table.tsx:154`), więc **nie trzeba osobno czytać `ranks`** —
  research zakładał, że trzeba.
- **Stan sortowania też schodzi z `table`** — `table.getState().sorting`.
- **Rejestr `TRANSFER_EXPORT_COLUMNS` się nie odtwarza.** Zamiast niego `meta.printValue` na
  istniejących definicjach kolumn (`src/components/tables/transfers.tsx`). Etykieta, kolejność,
  widoczność i tekst schodzą wtedy z jednej definicji. Skasowany rejestr zdążył się już rozjechać
  z ekranem: nie znał `vatPlane` w ogóle, a `paymentMethod` mapował bez obsługi `null`, który od
  `9ce604a5` jest częsty.
- **Brak `printValue` JEST mechanizmem wykluczenia.** `invoice`, `invoiceNote` i `actions` to na
  ekranie interaktywne widżety, nie treść — nie dostają `printValue` i przez to nigdy nie trafiają
  na papier. Żadnej listy wykluczeń.
- **Gałąź `COLUMN_TO_VALUE` w starym `sortTransferRows` była martwa.** Sortowała `invoice` po
  liczbie stron, ale `invoice`, `invoiceNote` i `actions` mają `enableSorting: false`, więc ten id
  nigdy nie wejdzie do `SortingState`. Nie przywracamy jej.
- **`columnLabel` dostaje drugiego konsumenta.** Łańcuch `meta.label ?? header-string ?? id` żyje
  dziś inline w `column-toggle.tsx:37-39`; wydruk potrzebuje tego samego.
- **Trzy żywe hosty, nie cztery.** `/raporty` to `EmptyState` „W budowie" (EX-598).
  `manager-dashboard.tsx:33` świadomie rezygnuje z przycisku faktur i wydruku też nie dostaje.

## Desired End State

W toolbarze tabeli transakcji na `/inwestycje/[id]`, `/kasa/[id]` i `/pracownicy/[id]` stoi przycisk
„Drukuj". Kliknięcie dociąga **cały przefiltrowany zbiór** (wszystkie strony), odtwarza na nim
sortowanie z ekranu, bierze kolumny widoczne **w kolejności ustawionej przez użytkownika**, i otwiera
nowe okno z czystą tabelą + dialogiem druku. Anulowane i wiersze `CANCELLATION` nie wychodzą.
Strony aplikacji zachowują się pod Ctrl+P dokładnie jak dziś — wydruk ma własne okno i własny
arkusz stylów, nic nie wraca do `globals.css`.

## What We're NOT Doing

- **Żadnego nagłówka z figurami finansowymi.** Ani statycznego, ani dynamicznego, ani „Bilansu".
- **Żadnego CSV** — drugi skasowany bliźniak zostaje skasowany.
- **Żadnego PDF-a** (jsPDF z marca 2026 nigdy nie został zainstalowany) ani żadnej nowej zależności.
- **Żadnej trzeciej nogi w `pnpm test:parity`** — wydruk nie jest powierzchnią figur.
- **Żadnego globalnego `@media print`** w `src/styles/globals.css`.
- **Bez `/raporty` i bez `manager-dashboard`.**
- **Bez zmian w `fetch-transfers-for-invoices.ts`** — łącznie z nazwą pliku.
- **Bez `.cancelled { text-decoration: line-through }`** — martwy styl po starszej generacji; fetch
  nie może zwrócić anulowanego wiersza.
- Bez ruszania dwóch findingów, które EX-672 zostawił otwarte w `transfer-table-config.ts`
  (`showTotalAmount` bez call site, `totalFilteredAmount`/`listsCancelled` w cudzym worku).

## Implementation Approach

Trzy fazy, od czystej logiki do wpięcia. Faza 1 to dane tekstowe i sortowanie — wszystko testowalne
bez przeglądarki. Faza 2 buduje dokument i przycisk. Faza 3 wpina flagę w trzy strony; jest mała,
ale niesie pułapkę opcjonalnego pola i dlatego ma własny moment weryfikacji ręcznej.

## Critical Implementation Details

**Pułapka opcjonalnego pola, w drugą stronę.** `research.md` cytuje `lessons.md`: _„An optional
config field hides its own death"_ — `headerFields` było opcjonalne, więc skasowanie producenta nie
zapaliło `tsc`. Dodanie jest równie ciche: `print?: boolean` na `TransferTableConfigT` jest
opcjonalne, więc strona, która go nie ustawi, nie zgłosi błędu — przycisk po prostu nigdy się nie
pojawi. Każdy z trzech hostów trzeba sprawdzić ręcznie w przeglądarce; typecheck tego nie złapie.

**Okno druku buduje się na `about:blank`, nie z `blob:`/`data:`.** Docblock w
`invoice-preview-dialog.tsx:55-59` jest nośny. Dla samego tekstu ryzyko nie materializuje się (nie ma
zasobów zewnętrznych), ale trzymamy ten sam kształt — okno z `blob:` dostaje opaque origin i
ewentualna przyszła ścieżka względna przestaje się rozwiązywać.

**Kolejność w oknie druku musi być pobrana raz.** `print()` jest synchroniczne i blokuje;
`printWindow.close()` po nim. Bez zewnętrznych zasobów nie ma na co czekać — nie odtwarzamy licznika
`pending` z podglądu faktury, on istnieje wyłącznie dla `load` obrazków i iframe'ów.

**`description` ma na ekranie `whitespace-pre-line`.** Arkusz wydruku musi dać tej komórce
`white-space: pre-line`, inaczej wieloliniowy opis sklei się w jedną linię.

---

## Phase 1: Tekst kolumny i sortowanie

### Overview

Czysta, testowalna warstwa: jak każda kolumna wygląda jako tekst, skąd bierze się jej etykieta i jak
odtworzyć sortowanie na dociągniętym zbiorze. Nic z tego nie dotyka DOM-u ani drukarki.

### Changes Required

#### 1. Deklaracja `printValue` w meta kolumny

**File**: `src/components/tables/column-meta.ts`

**Intent**: Dać definicji kolumny miejsce na jej papierową postać, żeby etykieta, kolejność,
widoczność i tekst schodziły z jednego źródła.

**Contract**: Nowe opcjonalne pole w `interface ColumnMeta<TData, TValue>`:
`printValue?: (row: TData) => string`. Komentarz musi powiedzieć to, czego kod nie powie — że **brak
tego pola oznacza „ta kolumna nie drukuje się"**, i że to jest sposób, w jaki interaktywne widżety
(faktura, notatka, akcje) wypadają z dokumentu.

#### 2. Wypełnienie `printValue` na kolumnach transakcji

**File**: `src/components/tables/transfers.tsx`

**Intent**: Dopisać `meta.printValue` do każdej kolumny niosącej treść. Trzy kolumny świadomie go nie
dostają.

**Contract**: Po jednym `printValue` na kolumnie, obok istniejącego `cell`. Odwzorowuje to, co
komórka pokazuje na ekranie, sprowadzone do jednej linii tekstu:

- `id` → `#${r.id}`
- `date` → `formatPLDate`
- `amount` → brutto przez `formatPLN`; gdy `billsNetAmount(type) && netAmount !== null`, dopisz
  ` (netto …)` — to jest ta druga linia komórki, która niesie realne znaczenie
- `vatPlane` → `DEPOSIT_PLANE_LABELS[value]`, `—` przy `null`
- `investment`, `expenseCategory`, `otherCategory`, `sourceRegister`, `targetRegister`, `worker`,
  `createdBy` → gołe `*Name` (na ekranie to linki; na papierze sam tekst)
- `type` → ta sama logika co komórka: `settled` → `SETTLED_TYPE.label`; `CANCELLATION` z
  `originalType` → `Anulowanie (…)`; inaczej `TRANSFER_TYPE_LABELS[type] ?? type`
- `description` → surowy tekst (zachowuje `\n`, arkusz to renderuje)
- `paymentMethod` → `PAYMENT_METHOD_LABELS[method]`, `—` przy `null`
- `createdAt` → `formatPLDateTime`
- **`invoice`, `invoiceNote`, `actions` — bez `printValue`, celowo.**

#### 3. Wspólne wyprowadzenie etykiety kolumny

**File**: `src/lib/table/column-label.ts` (nowy), `src/components/filters/column-toggle.tsx`

**Intent**: Łańcuch `meta.label ?? header-string ?? id` dostaje drugiego konsumenta (wydruk), więc
przenosi się z inline'u do własnego modułu. `ColumnToggle` przechodzi na niego.

**Contract**: `columnLabel<TData>(col: Column<TData, unknown>): string`. `column-toggle.tsx:37-39`
woła ją zamiast powtarzać wyrażenie.

#### 4. Odtworzenie sortowania

**File**: `src/lib/transfers/sort-transfer-rows.ts` (nowy)

**Intent**: Dociągnięty zbiór przychodzi posortowany `-date`; ekran może być posortowany inaczej.
Przywracamy komparator ze skasowanego `lib/export/sort-rows.ts`, bez jego martwej gałęzi.

**Contract**: `sortTransferRows(rows: TransferRowT[], sorting: SortingState): TransferRowT[]` —
czysta, nie mutuje wejścia. Zachowuje `COLUMN_TO_ACCESSOR` (kolumny, których id różni się od klucza:
`investment`, `expenseCategory`, `otherCategory`, `sourceRegister`, `targetRegister`, `createdBy`),
porównanie `localeCompare(…, 'pl')` dla stringów, numeryczne dla liczb, `null` na początku, i
obsługę wielu kluczy sortowania. **Nie** przywraca `COLUMN_TO_VALUE` — jedyny jej wpis (`invoice`
po liczbie stron) był nieosiągalny, bo ta kolumna ma `enableSorting: false`.

### Success Criteria

#### Automated Verification:

- Spec mapy tekstowej przechodzi: `pnpm exec vitest run src/__tests__/components/tables/transfers-print-value.test.ts` — pokrywa dwuliniowe `amount` (z netto i bez), `type` dla `settled` i dla `CANCELLATION` z `originalType`, `—` dla `paymentMethod: null` i `vatPlane: null`, oraz to, że `invoice`/`invoiceNote`/`actions` nie mają `printValue`
- Spec sortowania przechodzi: `pnpm exec vitest run src/__tests__/lib/transfers/sort-transfer-rows.test.ts` — pusty `SortingState` zwraca wejście nietknięte, sortowanie po kolumnie z aliasem (`investment` → `investmentName`), `desc`, wiele kluczy, `null` na początku, wejście niezmutowane

#### Manual Verification:

- Brak — faza nie zmienia niczego, co widać na ekranie

---

## Phase 2: Dokument i przycisk

### Overview

Budowa dokumentu HTML z wierszy i kolumn, oraz przycisk, który łączy dociągnięcie, sortowanie,
kolumny i okno druku.

### Changes Required

#### 1. Builder dokumentu

**File**: `src/lib/transfers/build-transfers-print-html.ts` (nowy)

**Intent**: Zamienić wiersze i wybrane kolumny w kompletny dokument HTML. Czysta funkcja stringowa —
bez Reacta, bez DOM-u, więc testowalna wprost.

**Contract**:
`buildTransfersPrintHtml(rows: TransferRowT[], columns: PrintColumnT[], title: string): string`,
gdzie `PrintColumnT = { id: string; label: string; getValue: (row: TransferRowT) => string }`.
Zwraca `<!DOCTYPE html>` + `<html lang="pl">` z `<meta charset>`, `<title>` i wbudowanym `<style>`.
Każda wartość tekstowa — łącznie z `title` i etykietami — przechodzi przez `escapeHtml`
(`@/lib/utils/escape-html`); `description` bywa wolnym tekstem użytkownika.

Arkusz: `@page { margin: 10mm }`, `body` systemowy sans 11px, `table { width:100%;
border-collapse:collapse }`, `th` wyrównane do lewej z podwójną dolną krawędzią, `td` z cienką
krawędzią. Dodatkowo `td` niosące opis dostaje `white-space: pre-line` (na ekranie komórka ma
`whitespace-pre-line`). **Bez** reguły `.cancelled` — anulowany wiersz nie może tu dotrzeć.

#### 2. Przycisk w toolbarze

**File**: `src/components/transfers/print-transfers-button.tsx` (nowy)

**Intent**: Spiąć całość: dociągnij przefiltrowany zbiór, odtwórz sortowanie, weź kolumny widoczne
w kolejności użytkownika, zbuduj dokument, otwórz okno, wydrukuj.

**Contract**: `'use client'`. Propsy: `where: Where`, `table: Table<TransferRowT>`, `title: string`.
Kształt i obsługa stanu jak w `InvoiceDownloadButton` (`invoice-download-button.tsx`) — `useTransition`
wokół akcji serwerowej, `toast.error` z `{ position: 'bottom-center', theme: 'dark' }` przy porażce,
`Button variant="outline" size="sm"` z `Printer` z `lucide-react` i `Loader2 className="animate-spin"`
w trakcie, etykieta „Drukuj".

Sekwencja po kliknięciu:

1. `fetchFilteredTransfers(where)` — nieostronicowane, wyklucza anulowane (bez zmian w akcji)
2. `sortTransferRows(rows, table.getState().sorting)`
3. kolumny: `table.getVisibleLeafColumns()` → odfiltruj te bez `columnDef.meta?.printValue` →
   zmapuj na `PrintColumnT` z `columnLabel(col)`. Kolejność **jest już** kolejnością użytkownika
4. pusty zbiór wierszy → `toast` informacyjny i wyjście; nie otwieramy pustego okna
5. `buildTransfersPrintHtml(...)` → `window.open('', '_blank')`; przy `null` (blokada popupów)
   `toast.error` i wyjście → zapis dokumentu do okna → `print()` → `close()`

### Success Criteria

#### Automated Verification:

- Spec buildera przechodzi: `pnpm exec vitest run src/__tests__/lib/transfers/build-transfers-print-html.test.ts` — kolumny wychodzą w podanej kolejności, `<th>` niosą etykiety, znaki `<`/`>`/`&` w opisie są escapowane, pusta lista wierszy daje samą głowę tabeli, dokument zaczyna się od `<!DOCTYPE html>`

#### Manual Verification:

- Klik „Drukuj" otwiera nowe okno z dialogiem druku i zamyka je po zamknięciu dialogu
- Wydruk zawiera wszystkie strony przefiltrowanego zbioru, nie tylko bieżącą
- Kolumny na papierze odpowiadają widocznym na ekranie, w tej samej kolejności po przestawieniu ich w „Kolejność kolumn"
- Sortowanie po kliknięciu nagłówka odwzorowuje się na wydruku
- Anulowanych wierszy i wierszy „Anulowanie (…)" nie ma na wydruku, nawet przy włączonym filtrze anulowanych
- Kolumny „Faktura", „Notatka" i „Akcje" nie pojawiają się na papierze mimo widoczności na ekranie
- Wieloliniowy opis zachowuje łamanie linii
- Ctrl+P na samej stronie aplikacji zachowuje się jak przed zmianą

---

## Phase 3: Wpięcie w strony

### Overview

Flaga w konfiguracji tabeli, render w toolbarze, trzy strony ją ustawiają. Plus zgłoszenie E2E do
backlogu.

### Changes Required

#### 1. Własna flaga w konfiguracji

**File**: `src/components/transfers/transfer-table-config.ts`

**Intent**: Wydruk dostaje **własne** opt-in, nigdy nie jeździ na `invoiceDownload`. `lessons.md`:
_„Parking two features' buttons in one component makes one feature's data the other's visibility gate."_

**Contract**: `print?: boolean` na `TransferTableConfigT`. Komentarz nazywa to, czego typ nie powie:
że dociągnięcie jest nieostronicowane po `where` tabeli — ta sama uwaga, którą nosi `invoiceDownload`
— oraz że opcjonalność tego pola jest cicha (strona, która go nie ustawi, nie zapali `tsc`).

#### 2. Render w toolbarze

**File**: `src/components/transfers/transfer-data-table.tsx`

**Intent**: Postawić przycisk obok `InvoiceDownloadButton`.

**Contract**: `print` wychodzi z destrukturyzacji `config`; w render-propie `toolbar`
`{print && <PrintTransfersButton where={config.query.where} table={table} title={…} />}`.
Tytuł dokumentu — „Transakcje" (trafia do `<title>` okna i w nagłówek/stopkę drukarki).

#### 3. Trzy strony ustawiają flagę

**File**: `src/app/(frontend)/inwestycje/[id]/page.tsx`, `src/app/(frontend)/kasa/[id]/page.tsx`,
`src/app/(frontend)/pracownicy/[id]/page.tsx`

**Intent**: Włączyć wydruk dokładnie tam, gdzie żył przed EX-672 (minus martwe `/raporty`).

**Contract**: `print: true` obok istniejącego `invoiceDownload: true` w konfiguracji
`TransfersSection` — odpowiednio przy `:122`, `:73`, `:69`. `manager-dashboard.tsx` **nie** dostaje flagi.

#### 4. Zgłoszenie E2E do backlogu

**File**: — (Linear)

**Intent**: Spec browserowy jest owinięty wokół przechwycenia popupa i asercji jego DOM-u przed
`print()` — nietrywialny, świadomie odłożony. Zerowe pokrycie E2E jest dokładnie tym, co pozwoliło
EX-672 skasować używaną funkcję, więc dług musi być widoczny na tablicy, nie w zarchiwizowanym planie.

**Contract**: Issue w projekcie „Wykonczymy" (zespół Ex-plant) z labelką `e2e-backlog`, opisujące:
przechwycenie `page.waitForEvent('popup')`, asercję nagłówków i liczby wierszy w oknie druku,
weryfikację że anulowany wiersz nie wyszedł, oraz że „Faktura"/„Notatka"/„Akcje" nie wyszły.
Dyspozycja testu zapisana **w issue**, żeby strażnik regresji jechał razem z przyszłą naprawą.
Id issue wraca do `review-gate.md` bramki przeglądu. Jeśli MCP Lineara jest nieosiągalne — wpis
w `roadmap.md` zamiast tego, i powiedzieć o tym wprost.

### Success Criteria

#### Automated Verification:

- Brak sprawdzenia zakresu tej fazy. Trzy strony ustawiające flagę boolowską nie mają deterministycznego
  testu, który nie byłby asercją na literał w pliku; całość weryfikacji tej fazy jest ręczna i bramkuje ją
  pułapka opcjonalnego pola opisana w „Critical Implementation Details"

#### Manual Verification:

- Przycisk „Drukuj" widoczny w toolbarze na `/inwestycje/[id]`
- Przycisk „Drukuj" widoczny w toolbarze na `/kasa/[id]`
- Przycisk „Drukuj" widoczny w toolbarze na `/pracownicy/[id]`
- Przycisku **nie ma** na dashboardzie menedżera
- Wydruk zawęża się do zakresu strony (inwestycji / kasy / pracownika), a nie do całego systemu
- Issue E2E założone i jego id zapisane w bramce przeglądu

---

## Testing Strategy

### Unit Tests

- `sortTransferRows` — pusty stan sortowania, alias kolumny → klucz wiersza, `desc`, wiele kluczy,
  `null`, brak mutacji wejścia
- `printValue` na kolumnach transakcji — dwuliniowa kwota, `settled`, `CANCELLATION` z `originalType`,
  `null` w `paymentMethod`/`vatPlane`, i brak `printValue` na trzech kolumnach widżetowych
- `buildTransfersPrintHtml` — kolejność kolumn, etykiety, escapowanie, pusty zbiór

### Integration Tests

Brak. Zmiana nie przekracza żadnej granicy serwer→DB, której nie przekracza już dziś
`fetchFilteredTransfers` (nietknięte).

### E2E

Odłożone do backlogu `e2e-backlog` (Faza 3, zmiana 4) — nie „skierowane do `/10x-e2e`", tylko
zgłoszone jako issue z id.

### Manual Testing Steps

1. `/inwestycje/[id]` z tabelą transakcji: zawęź filtr, przejdź na drugą stronę, kliknij „Drukuj" —
   podgląd ma wszystkie wiersze filtru, nie tylko bieżącą stronę
2. Wyłącz kilka kolumn i przestaw kolejność w „Kolejność kolumn", wydrukuj — papier odwzorowuje ekran
3. Posortuj po „Kwota" malejąco, wydrukuj — kolejność wierszy na papierze zgodna
4. Włącz filtr anulowanych, wydrukuj — anulowanych i „Anulowanie (…)" brak
5. Włącz kolumnę „Faktura" i „Notatka", wydrukuj — obu brak na papierze
6. Transakcja z wieloliniowym opisem — łamanie linii zachowane
7. Ctrl+P na samej stronie aplikacji — wygląd jak przed zmianą
8. Powtórz krok 1 na `/kasa/[id]` i `/pracownicy/[id]`; sprawdź brak przycisku na dashboardzie

## Performance Considerations

`fetchFilteredTransfers` ciągnie do `limit: 50000` i jest już w produkcji pod przyciskiem faktur, więc
profil nie jest nowy. Na trzech hostach `where` jest zawsze zakotwiczony (inwestycja / kasa /
pracownik), więc nieanchorowany przypadek, przed którym ostrzega komentarz przy `invoiceDownload`,
tu nie występuje — i to jest jeden z powodów, dla których dashboard nie dostaje flagi.

## Migration Notes

Brak. Zero zmian w schemacie, zero migracji, zero nowych zależności.

## Whole-tree Gate

- Typecheck przechodzi: `pnpm typecheck`
- Lint przechodzi: `pnpm lint`
- Pełny zestaw testów jednostkowych przechodzi: `pnpm test`
- Build przechodzi: `pnpm build`

## References

- Research: `context/changes/2026-09-14-transfer-print-return/research.md`
- Decyzje właściciela: `context/changes/2026-09-14-transfer-print-return/change.md`
- Wzorzec przycisku w toolbarze: `src/components/transfers/invoice-download-button.tsx`
- Mechanizm druku: `src/components/dialogs/invoice-preview-dialog.tsx:55-102`
- Skasowany oryginał (do porównania, nie do przywrócenia): `git show 12d45c44^:src/lib/export/`

## Progress

> Konwencja: `- [ ]` w toku, `- [x]` zrobione. Dopisz ` — <commit sha>`, gdy krok wejdzie. Nie zmieniaj tytułów kroków.

### Phase 1: Tekst kolumny i sortowanie

#### Automated

- [x] 1.1 Spec mapy tekstowej przechodzi — 8ef79935
- [x] 1.2 Spec sortowania przechodzi — 8ef79935

### Phase 2: Dokument i przycisk

#### Automated

- [x] 2.1 Spec buildera przechodzi — 952bf1f4

### Phase 3: Wpięcie w strony

#### Automated

- [x] 3.1 Brak sprawdzenia zakresu tej fazy — weryfikacja wyłącznie ręczna
