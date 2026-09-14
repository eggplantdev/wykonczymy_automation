---
date: 2026-09-14T00:00:00+02:00
researcher: Claude Opus 5
git_commit: b4a3582b
branch: staging
repository: wykonczymy
topic: 'Gdzie w aplikacji istnieje drag&drop plików i gdzie zamontować guard blokujący domyślną nawigację przeglądarki'
tags: [research, codebase, file-input, drag-and-drop, upload]
status: complete
last_updated: 2026-09-14
last_updated_by: Claude Opus 5
---

# Research: drag&drop plików — inwentarz powierzchni i miejsce na guard

**Date**: 2026-09-14
**Researcher**: Claude Opus 5
**Git Commit**: b4a3582b
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Chybiony drop pliku otwiera go w przeglądarce jako dokument. Guard ma być zamontowany **tylko tam,
gdzie drag&drop istnieje** — więc gdzie on właściwie istnieje? Wydatek nie jest jedynym miejscem.
Dodatkowo: dropzone ma być widoczna od początku przeciągania i do sprototypowania jest jej
powiększenie.

## Summary

Drag&drop plików ma w aplikacji **dwie niezależne implementacje** i łącznie **6 miejsc montowania**:

1. `FileInput` (`src/components/ui/file-input.tsx`) — współdzielony primitive, 5 miejsc renderu.
2. Przycisk „Wygeneruj z paragonów" (`line-items-field.tsx`) — własny, osobny zestaw handlerów,
   drop uruchamia skan AI zamiast zwykłego uploadu.

**Wszystkie 6 leży wewnątrz `Dialog`a.** To rozstrzyga wątpliwość z rozmowy: guard montowany razem
z dropzone żyje dokładnie tak długo, jak dialog — a gdy dialog jest zamknięty, nie ma żadnej
dropzone, w którą użytkownik mógłby celować. Nie tracimy więc pokrycia, którego globalny guard
w layoucie by bronił.

**Guard jest bezpieczny.** W całym `src/` **nie ma ani jednego** natywnego HTML5 drag&drop poza
plikami: brak `draggable`, brak `onDragStart`, brak dnd-kit / react-dnd / sortable. Każde inne
„przeciąganie" w aplikacji jest oparte o pointer events (framer-motion `Reorder`, zaznaczanie
i fill-handle w react-datasheet-grid, uchwyty resize kolumn/wierszy, swipe toastów). Warunek
`dataTransfer.types.includes('Files')` jest więc zabezpieczeniem na przyszłość, nie na dziś.

**Panel Payloada (`/admin/**`) ma własną dropzone, której nie kontrolujemy\*\* — guard nie może tam
trafić. Skoro montujemy go per-dropzone, a nie w layoucie, wychodzi to samo z siebie.

## Detailed Findings

### 1. `FileInput` — współdzielony primitive (5 miejsc renderu)

`src/components/ui/file-input.tsx:43-111` — `handleDragOver` :43, `handleDragLeave` :49,
`handleDrop` :62. Wszystkie robią `preventDefault()` + `stopPropagation()`, więc **trafiony** drop
już dziś nie nawiguje. Guard dotyczy wyłącznie dropu, który **minął** ten element.

| #   | Miejsce renderu                                                                     | Kontekst                                                       | Trasy                                                     |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | `dialogs/invoice-upload-dialog.tsx:30` (`multiple`, `className="h-28 flex-col"`)    | Dialog otwierany z `transfers/invoice-cell.tsx:62`             | `/`, `/inwestycje/[id]`, `/kasa/[id]`, `/pracownicy/[id]` |
| 2   | `forms/form-fields/line-item-invoice-field.tsx:60` (per-pozycja, tylko gdy 0 stron) | Wewnątrz `ExpenseDialog`                                       | każda trasa `(frontend)` — trigger w `nav/top-nav.tsx:27` |
| 3   | `forms/edit-transfer-form/edit-transfer-form.tsx:215` („Dodaj faktury")             | `EditTransferDialog` (`dialogs/edit-transfer-dialog.tsx:52`)   | jak wiersz 1                                              |
| 4   | `forms/inspection-form/inspection-form.tsx:233` („Załączniki", `multiple`)          | `AddInspectionDialog` (`dialogs/add-inspection-dialog.tsx:50`) | `/flota`, `/flota/[id]`                                   |
| 5   | `forms/expense-form/expense-form.tsx` (import `FileInput`)                          | `ExpenseDialog`                                                | każda trasa `(frontend)`                                  |

Podświetlenie dziś: `file-input.tsx:115` → `isDragOver && 'border-primary bg-muted/50'`.
`--color-primary` to `oklch(0.205 0 0)` (`styles/globals.css:66`) — prawie czerń, wizualnie nie do
odróżnienia od `border-input`. Stąd wrażenie, że „nic się nie podświetla".

### 2. Druga dropzone — przycisk „Wygeneruj z paragonów"

`src/components/forms/form-fields/line-items-field.tsx`:

- `dropZoneProps` :235-248 — własne `onDragOver` / `onDragLeave` / `onDrop`, **bez**
  `stopPropagation`.
- `handleDropReceipts` :220-231 — filtruje `isReceiptFile`, przy pustym wyniku **cicho wychodzi**
  (świadomie: niedopasowany drop nie może ponowić generowania na istniejących wierszach).
- Renderowana na `Button variant="ai"` :406 — czyli celem jest **mały przycisk w rzędzie kontrolek**,
  nie płaskie pole. To najgorszy cel do trafienia w całej aplikacji i najsilniejszy argument za
  powiększaniem/uwydatnianiem dropzone w trakcie przeciągania.
- Podświetlenie: `ring-neon-cyan ring-2` :246 — inny język wizualny niż `FileInput`, **celowo**:
  `neon-cyan` (`globals.css:124`) jest akcentem AI (`variant="ai"`, `GradientSpinner`,
  `WandSparkles`). Wspólny hook musi więc zwracać **stan**, a nie narzucać kolor.

Ponieważ ta dropzone nie robi `stopPropagation`, window-owy listener i tak zobaczy jej drop —
guard musi być idempotentny (samo `preventDefault`, żadnej logiki na pliku).

### 3. Ukryte `<input type="file">` poza `FileInput`

- `line-items-field.tsx:386` — `scanInputRef`, klikany przez przycisk skanu.
- `line-item-invoice-field.tsx:88` — `addInputRef`, „Dodaj stronę" w modalu podglądu faktury.

Oba to ścieżka kliknięcia, nie dropu — guard ich nie dotyczy.

### 4. Hooki ingestu (kontekst, nie cel zmiany)

- `forms/hooks/use-file-pick-ingest.ts:28` — HEIC decode, kompresja, odrzut oversize; wystawia
  `fileInputProps` z samym `onChange`. **Nie ma własnego drop handlera** — drop dociera do niego
  przez syntetyczny `onChange` z `FileInput`. Konsumenci: `inspection-form.tsx:63`,
  `edit-transfer-form.tsx:58`.
- `forms/expense-form/use-invoice-files.ts:11` — mapa `rowId → File[]` dla formularza zbiorczego;
  `registerFilesAt` jest tym, co woła ścieżka dropu/skanu.
- `hooks/use-invoice-upload.ts:15` — ingest + natychmiastowy upload; jedyny konsument
  `transfers/invoice-cell.tsx:20`, karmiony z `InvoiceUploadDialog`.

### 5. Czego guard NIE może dotknąć

- **Panel Payloada** — `src/app/(payload)/admin/[[...segments]]/page.tsx` renderuje `RootPage`
  Payloada z jego własną dropzone. Kolekcje z uploadem: `collections/media.ts:33` oraz pola typu
  `upload` w `transfers.ts:234`, `vehicle-inspections.ts:112`, `equipment-events.ts:104`.
  `admin/importMap.js:1` rejestruje `VercelBlobClientUploadHandler`.
- **Interakcje pointer-based** — framer-motion `Reorder` w `ui/column-order-dialog.tsx:77-99`,
  `ui/datasheet-grid/column-resize-handle.tsx:35-78`, `row-resize-handle.tsx:27-86`,
  zaznaczanie/fill-handle rdsg. Żadna z nich nie używa zdarzeń `drag*`, więc kolizji nie ma.

### 6. Brak konkurencyjnych listenerów globalnych

W `src/` istnieją tylko: `use-undo-keyboard.ts:31` (`keydown`), `use-wrap-column-widths.ts:71`
i `use-element-height.ts:36` (`resize`). **Żadnego `drag`/`drop`/`paste` na `window`/`document`.**

Uwaga na przyszłość: react-datasheet-grid trzyma własne listenery na `document`, w tym **`paste`**
(`dist/.../DataSheetGrid.js:631`). Gdyby kiedyś dojść do wklejania plików ze schowka, obowiązuje
lekcja o kolejności rejestracji i `stopImmediatePropagation` (`context/foundation/lessons.md:965-978`).
Dziś **nie ma żadnej obsługi `onPaste` / `clipboardData`** w `src/`.

## Code References

- `src/components/ui/file-input.tsx:43-115` — dropzone + podświetlenie do wymiany
- `src/components/forms/form-fields/line-items-field.tsx:220-248,406` — druga dropzone (skan AI)
- `src/styles/globals.css:66` — `--color-primary` ≈ czerń, źródło wrażenia „nie podświetla się"
- `src/styles/globals.css:53,124` — `--color-wk-accent` (#a3785f, marka), `--color-neon-cyan` (akcent AI)
- `src/components/dialogs/invoice-upload-dialog.tsx:30` — jedyna dziś „duża" dropzone (`h-28`)
- `src/app/(payload)/admin/[[...segments]]/page.tsx` — obca dropzone, poza zasięgiem

## Architecture Insights

- Repo ma **jeden** primitive dropzone i **jeden** odstępca. Odstępca jest uzasadniony (drop
  uruchamia inną akcję, nie upload), ale jego handlery są duplikatem `FileInput`. Wspólny hook
  `useWindowFileDrag` (guard + stan „plik nad oknem") to naturalne miejsce na dedup.
- Reguła z AGENTS.md o domu hooka: konsumenci to `components/ui/file-input.tsx` oraz
  `components/forms/form-fields/line-items-field.tsx` — **dwa różne katalogi, oba poza `forms/`
  w jednym przypadku**, więc hook nie kwalifikuje się do `forms/hooks/`. Dom to `src/hooks/`
  (powierzchnia nie-formularzowa) — do potwierdzenia w planie.
- Kolor podświetlenia **nie może** być zaszyty w hooku: `FileInput` jest neutralny, przycisk skanu
  jest „AI/neon". Hook zwraca `isFileDragActive`, styl zostaje po stronie konsumenta.

## Historical Context (from prior changes)

- `context/foundation/manual-checks.md:3303` — istnieje check, że drugi drop w trakcie ingestu jest
  no-opem (`use-file-pick-ingest.ts:78`, `file-input.tsx:68`). Zmiana nie może tego zepsuć.
- `context/foundation/manual-checks.md:2528` — Playwrightowe `dragTo` (HTML5) **nie odpala**
  sortowalnej listy kolumn; potwierdza pointer-based naturę tamtego DnD.
- `context/foundation/lessons.md:114-121`, `context/foundation/prd.md:321` — drag-to-reorder pozycji
  kosztorysu to przyszła funkcja (wymaga migracji `display_order`), dziś nieistniejąca.

## Open Questions

1. **Powiększenie dropzone w trakcie przeciągania** — realna zmiana rozmiaru przesunie layout
   sąsiadów (szczególnie przycisk skanu, który stoi w rzędzie kontrolek). Alternatywa bez
   przesunięcia: `scale` + `ring`/`outline` (rysowane poza flow). Do rozstrzygnięcia w planie.
2. Czy guard ma też gasić stan po `dragend` (przeciągnięcie porzucone klawiszem Esc) — `dragleave`
   z `relatedTarget === null` nie łapie wszystkich przypadków w Safari.
3. Czy dwie dropzone mają dzielić jeden język wizualny stanu „uzbrojona", skoro kolory akcentu są
   różne (neutralny vs neon). Propozycja: wspólna geometria (dashed + ring), własny kolor.
