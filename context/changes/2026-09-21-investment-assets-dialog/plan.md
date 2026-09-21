# Galeria inwestycji bez miniatur — plan implementacji

## Overview

Sekcja „Zdjęcia i pliki" na stronie inwestycji przestaje renderować miniatury. Zostaje przycisk
otwierający istniejący podgląd (`InvoicePreviewDialog` — pager, druk, pobieranie, zip) oraz przycisk
„Dodaj pliki" otwierający ten sam dialog wyboru, którego używa faktura. Dodatkowo pliki można dorzucić
z dialogu „Edytuj inwestycję".

## Current State Analysis

Cała mechanika istnieje już po stronie faktur i jest sparametryzowana — brakuje wyłącznie odsłonięcia
rejestru („faktura" vs „plik") i drugiego kompletu akcji:

- `InvoicePreviewDialog` (`src/components/dialogs/invoice-preview-dialog.tsx:49`) ma pager, `Drukuj`,
  `Pobierz`, `Pobierz wszystkie` (zip), `Dodaj`, `Usuń`, `Usuń całą fakturę`, i **już** przyjmuje
  `labels: PreviewLabelsT`; `ASSET_PREVIEW_LABELS` istnieje w `src/components/media/preview-labels.ts`.
- `InvoicePreviewButton` (`invoice-preview-button.tsx:21`) trzyma stan `open` i podaje `closePreview`
  do `onAdd`/`onRemove` — dokładnie to, czego potrzeba, żeby podgląd ustąpił dialogowi wyboru plików.
  Ma jednak zaszyty label (`invoices[0]?.filename ?? 'Faktura'`) i nie przekazuje `labels` dalej.
- `InvoicePreviewTrigger` (`invoice-preview-trigger.tsx:14`) ma zaszyte `aria-label="Podgląd faktury: …"`.
- `InvoiceUploadDialog` (`invoice-upload-dialog.tsx`) ma zaszyty tytuł „Dodaj fakturę".
- `useInvoiceRemoval` (`src/hooks/use-invoice-removal.ts`) trzyma optymistyczny zbiór usuniętych id +
  `ConfirmDialog`, ale jest przyspawany do akcji transferów i do słowa „faktura".
- `MediaFileT = InvoiceFileT & { id: number; thumbnailUrl }` (`src/types/media.ts`), więc podgląd
  **już** przyjmuje pliki inwestycji bez żadnej zmiany typów.
- `InvestmentAssets` (`src/components/investments/investment-assets.tsx`) renderuje `MediaStrip`
  + inline `FileInput`; usuwanie siedzi na „×" miniatury i ma własny `ConfirmDialog`.
- Po stronie serwera są `addInvestmentAssetsAction` i `removeInvestmentAssetAction`
  (`src/lib/actions/investment-assets.ts`), ale **nie ma** odpowiednika
  `removeAllTransferInvoicesAction`.
- `updateInvestmentAction` celowo wycina `assets` — nadpisanie pustą listą skasowałoby galerię.

## Desired End State

Na stronie inwestycji:

- przy **zerze** plików widać wyłącznie „Dodaj pliki";
- przy N ≥ 1 widać „Zdjęcia i pliki (N)" — kliknięcie otwiera podgląd z pagerem, drukiem i
  pobieraniem; usuwanie („Usuń" / „Usuń wszystkie") żyje w stopce podglądu, za `ConfirmDialog`;
- „Dodaj pliki" otwiera `InvoiceUploadDialog` zatytułowany „Dodaj zdjęcia lub pliki"; wybór pliku
  JEST zapisem;
- ten sam przycisk dodawania jest w dialogu „Edytuj inwestycję" i działa natychmiastowo — „Anuluj"
  go nie cofa;
- nigdzie na stronie inwestycji nie renderuje się miniatura.

`MediaStrip` zostaje w repo — używa go read-only strip zgłoszenia (`lead-answers-dialog.tsx`).

### Key Discoveries

- `MediaFileT` rozszerza `InvoiceFileT`, więc podgląd i trigger nie wymagają zmian typów — tylko
  nazewnictwa (`src/types/media.ts:7`).
- `useInvoiceUpload` nad `useMediaUpload` to wzorzec repo dla „preset domenowy nad ogólnym hakiem"
  (`src/hooks/use-invoice-upload.ts`) — usuwanie dostaje ten sam kształt.
- `InvoiceCell` (`src/components/transfers/invoice-cell.tsx:42`) pokazuje, jak podgląd ustępuje
  dialogowi wyboru: `onAdd={(closePreview) => { closePreview(); setUploadOpen(true) }}`.
- `setUploadField` (`src/lib/media/set-upload-field.ts`) sprowadza „usuń wszystkie" do jednej
  funkcji `() => []`.

## What We're NOT Doing

- Nie ruszamy strip'a w `lead-answers-dialog.tsx` — załączniki zgłoszenia zostają miniaturami,
  read-only.
- Nie robimy pełnych przenosin `lib/invoices` → `lib/media` (EX-826). Ten plan odsłania label/tytuł
  w trzech komponentach; masowy rename zostaje w issue.
- Nie dotykamy `updateInvestmentAction` ani `investmentSchema` — dodawanie z edycji idzie obok
  formularza, nie przez jego stan.
- Nie dodajemy podglądu/usuwania w dialogu edycji — tam jest wyłącznie dodawanie.
- Nie ruszamy ścieżki tworzenia inwestycji (`collectAssets` w `AddInvestmentDialog`) — tam wiersza
  jeszcze nie ma, więc zbieranie do stanu formularza zostaje jedyną możliwą drogą.

## Implementation Approach

Trzy fazy, każda zostawia drzewo działające: najpierw parametryzacja komponentów faktur (zero zmian
zachowania), potem przepięcie sekcji inwestycji, na końcu przycisk w dialogu edycji.

## Critical Implementation Details

**Wyścig upload ↔ usuwanie zostaje.** `setUploadField` to read-modify-write, więc usuwanie, które
wystartowało przed końcem uploadu, zapisze listę sprzed uploadu — gubiąc świeży plik i zostawiając
osierocony wiersz `media`. Dziś broni tego `removeDisabled={isRemoving || isUploading}` na miniaturce
(`investment-assets.tsx:59`) i pilnuje tego spec DOM. Po przeniesieniu usuwania do stopki podglądu
ta blokada musi przenieść się razem z nim — przyciski „Usuń"/„Usuń wszystkie" są nieaktywne w trakcie
uploadu.

## Phase 1: Odsłonięcie rejestru w komponentach faktur

### Overview

Trzy komponenty przestają mieć zaszyte słowo „faktura". Zachowanie faktur bez zmian.

### Changes Required

#### 1. Trigger podglądu

**File**: `src/components/dialogs/invoice-preview-trigger.tsx`

**Intent**: Pozwolić wołającemu nazwać to, co otwiera — dziś `aria-label` twierdzi „Podgląd faktury"
także dla zdjęcia z budowy.

**Contract**: nowy opcjonalny `ariaLabel?: string`; brak → dotychczasowe `Podgląd faktury: ${label}`.

#### 2. Przycisk podglądu

**File**: `src/components/dialogs/invoice-preview-button.tsx`

**Intent**: Przepuścić w dół label widoczny na przycisku oraz `labels` dialogu; dziś jedno i drugie
jest zaszyte na fakturę.

**Contract**: nowe opcjonalne `label?: string` (domyślnie `invoices[0]?.filename ?? 'Faktura'`),
`ariaLabel?: string`, `labels?: PreviewLabelsT` (przekazywane do `InvoicePreviewDialog`).

#### 3. Dialog wyboru plików

**File**: `src/components/dialogs/invoice-upload-dialog.tsx`

**Intent**: Ten sam dialog obsługuje zdjęcia inwestycji, więc tytuł staje się propem.

**Contract**: nowe opcjonalne `title?: string`, domyślnie `'Dodaj fakturę'`.

### Success Criteria

#### Automated Verification

- Specy dotykanych powierzchni przechodzą: `pnpm exec vitest run src/__tests__/components/transfers src/__tests__/components/dialogs`

#### Manual Verification

- Podgląd i dodawanie faktury w tabeli transferów działa jak przed zmianą (tytuły, aria, pager).

---

## Phase 2: Sekcja inwestycji bez miniatur

### Overview

`InvestmentAssets` przestaje renderować `MediaStrip` i inline `FileInput`; dostaje dwa przyciski,
a usuwanie przenosi się do stopki podglądu.

### Changes Required

#### 1. Akcja „usuń wszystkie"

**File**: `src/lib/actions/investment-assets.ts`

**Intent**: Stopka podglądu oferuje „Usuń wszystkie", a dziś istnieje tylko usuwanie pojedynczego
pliku.

**Contract**: `removeAllInvestmentAssetsAction(investmentId: number): Promise<ActionResultT>` —
`protectedAction` + `setUploadField(payload, assetsOf(investmentId), () => [])`, rewalidacja
`['investments']`, jak pozostałe dwie akcje.

#### 2. Hak usuwania, uogólniony

**File**: `src/hooks/use-media-removal.ts` (nowy) + `src/hooks/use-invoice-removal.ts`

**Intent**: Logika z `useInvoiceRemoval` (optymistyczny zbiór usuniętych id, staging pod
`ConfirmDialog`, zamknięcie podglądu po usunięciu ostatniego) jest identyczna dla zdjęć — różnią się
tylko akcje i teksty. Kopia byłaby drugim miejscem, w którym trzeba poprawiać ten sam błąd.

**Contract**: `useMediaRemoval({ files, removeOne, removeAll, labels })` zwraca
`{ visibleFiles, handleRemove, handleRemoveAll, removalConfirm }`; `labels` niesie trzy pytania
potwierdzenia (pojedynczy / ostatni / wszystkie) i komunikat błędu. `useInvoiceRemoval` zostaje jako
preset nad nim — dokładnie tak, jak `useInvoiceUpload` stoi nad `useMediaUpload` — i zachowuje
dotychczasową sygnaturę oraz nazwę pola `visibleInvoices`.

#### 3. Sekcja inwestycji

**File**: `src/components/investments/investment-assets.tsx`

**Intent**: Zastąpić miniatury i inline picker dwoma przyciskami; usuwanie oddać stopce podglądu.

**Contract**: bez `MediaStrip` i bez `FileInput`. Przy `visibleFiles.length > 0` renderuje
`InvoicePreviewButton` z `label={'Zdjęcia i pliki (N)'}`, `labels={ASSET_PREVIEW_LABELS}`,
`variant="field"`, `onAdd`/`onRemove`/`onRemoveAll`; zawsze renderuje przycisk „Dodaj pliki"
otwierający `InvoiceUploadDialog` z tytułem „Dodaj zdjęcia lub pliki". Usuwanie i „Dodaj" w stopce
podglądu są nieaktywne w trakcie uploadu (patrz „Critical Implementation Details").

#### 4. Spec DOM

**File**: `src/__tests__/components/investments/investment-assets.test.tsx`

**Intent**: Spec asercjonuje dziś miniatury i „×", których nie będzie. Przepisać na nowe zachowanie
obserwowalne, zachowując gwarancję wyścigu upload ↔ usuwanie.

**Contract**: przy pustej liście nie ma przycisku podglądu, jest „Dodaj pliki"; przy N ≥ 1 przycisk
niesie licznik i otwiera podgląd; usuwanie pyta przez `ConfirmDialog` i woła akcję; trwający upload
blokuje usuwanie.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/components/investments/investment-assets.test.tsx`
- Specy akcji przechodzą: `pnpm exec vitest run src/__tests__/lib/actions/investment-assets.db.test.ts`

#### Manual Verification

- Inwestycja bez plików pokazuje sam przycisk „Dodaj pliki".
- Po dodaniu pliku licznik na przycisku rośnie bez przeładowania strony.
- Podgląd otwiera plik, „Pobierz" zapisuje go pod właściwą nazwą, „Drukuj" otwiera podgląd wydruku.
- Przy 2+ plikach „Pobierz wszystkie" daje zip o nazwie zaczynającej się od `pliki-`, nie `faktury-`.
- „Usuń" pyta o potwierdzenie i po potwierdzeniu plik znika z podglądu.

---

## Phase 3: Dodawanie plików z dialogu „Edytuj inwestycję"

### Overview

Ten sam przycisk i ten sam dialog wyboru, wstawione w formularz edycji, z natychmiastowym zapisem.

### Changes Required

#### 1. Pole dodawania plików

**File**: `src/components/forms/investment-form/investment-assets-field.tsx` (nowy)

**Intent**: Wydzielić przycisk + `InvoiceUploadDialog` + `useMediaUpload` w jeden mały komponent
klienta, żeby formularz nie musiał znać mechaniki uploadu. Inwestycja już istnieje, więc wybór pliku
jest zapisem — „Anuluj" w formularzu go nie cofa (decyzja z `change.md`).

**Contract**: `InvestmentAssetsField({ investmentId }: { investmentId: number })` — upload przez
`addInvestmentAssetsAction`, `successMessage: 'Pliki dodane'`, wskaźnik trwającego uploadu.

#### 2. Wpięcie w formularz

**File**: `src/components/forms/investment-form/investment-form.tsx`,
`src/components/dialogs/edit-investment-dialog.tsx`

**Intent**: Formularz edycji dostaje pole; formularz tworzenia zostaje przy `collectAssets`, bo tam
wiersza jeszcze nie ma.

**Contract**: `InvestmentForm` przyjmuje nowy opcjonalny `assetsInvestmentId?: number` i renderuje
`InvestmentAssetsField` w `FieldGroup`, gdy jest podany; `collectAssets` i `assetsInvestmentId`
wykluczają się wzajemnie. `EditInvestmentDialog` podaje `assetsInvestmentId={investment.id}`.

### Success Criteria

#### Automated Verification

- Spec DOM na nowe pole: `pnpm exec vitest run src/__tests__/components/forms/investment-form`

#### Manual Verification

- „Edytuj inwestycję" → „Dodaj zdjęcia lub pliki" → wybór pliku dodaje go natychmiast (toast).
- Zamknięcie formularza przez „Anuluj" nie usuwa dodanego pliku, a licznik na stronie inwestycji go
  uwzględnia po odświeżeniu.
- Formularz „Nowa inwestycja" dalej zbiera pliki po staremu i zapisuje je razem z inwestycją.

---

## Testing Strategy

### Unit / DOM

- `investment-assets.test.tsx` — pusty stan, licznik, otwarcie podglądu, potwierdzenie usunięcia,
  blokada usuwania w trakcie uploadu.
- nowy spec pola w formularzu edycji — przycisk otwiera dialog, wybór pliku woła akcję dodania.

### Integration

- `investment-assets.db.test.ts` rozszerzony o „usuń wszystkie" (czyści relację i nie zostawia
  osieroconych `media`).

### E2E

Żadnego nowego spec'a Playwright — ryzyko jest po stronie renderu i stanu klienta, a ścieżka
client → akcja → DB → rewalidacja jest już pokryta dla dodawania plików inwestycji. Decyzję
potwierdza bramka review.

## Whole-tree Gate

Uruchamiane **raz**, po ostatniej fazie:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## References

- Ustalenia i odrzucone warianty: `context/changes/2026-09-21-investment-assets-dialog/change.md`
- Wzorzec „podgląd ustępuje uploadowi": `src/components/transfers/invoice-cell.tsx:42`
- Wzorzec „preset domenowy nad ogólnym hakiem": `src/hooks/use-invoice-upload.ts`
- Powiązane issue: **EX-826** (pełne przenosiny `lib/invoices` → `lib/media`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Odsłonięcie rejestru w komponentach faktur

#### Automated

- [x] 1.1 Specy transferów i dialogów przechodzą — bdf65931

### Phase 2: Sekcja inwestycji bez miniatur

#### Automated

- [x] 2.1 Spec DOM `investment-assets.test.tsx` przechodzi — 5827528f
- [x] 2.2 Spec akcji `investment-assets.db.test.ts` przechodzi — 5827528f

### Phase 3: Dodawanie plików z dialogu „Edytuj inwestycję"

#### Automated

- [ ] 3.1 Spec DOM pola dodawania plików przechodzi
