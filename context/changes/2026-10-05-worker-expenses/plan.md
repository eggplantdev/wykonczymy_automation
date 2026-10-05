# Wydatki zgłaszane przez pracownika (EX-971) — plan implementacji

## Overview

Pracownik zgłasza wydatek jednym przyciskiem „Dodaj wydatek" (inwestycja + zdjęcie/zdjęcia paragonu +
notatka; kasa = jego domyślna). Manager widzi czekające zgłoszenia nad tabelą Transakcji; klik otwiera
zwykły dialog „Nowy wydatek" wypełniony danymi zgłoszenia. AI czyta paragon **na żądanie** — istniejącym
przyciskiem „Generuj". Zapis tworzy wydatek i oznacza zgłoszenie jako przyjęte w jednej transakcji.
Zgłoszenie można odrzucić. Filtr „Zgłoszenia pracowników" + badge „od pracownika" w tabeli.

## Current State Analysis

Strona pracownika jest w drzewie, niecommitowana (`research.md` → Summary):

- migracja `20261005_3_add_worker_expense_drafts.ts` — `worker_expense_drafts` + `worker_expense_draft_media`;
- `src/lib/db/worker-expense-drafts.ts` — insert / list / `listPendingExpenseDrafts` / `readExpenseDraft` /
  `decideExpenseDraft` (zmienia tylko `pending`, zwraca `false` przegranemu);
- `sendExpenseDraftAction` (EMPLOYEE, `requireAuth(ROLES)`), dialog pracownika, sekcja „Moje wydatki"
  na `/pracownicy/[id]`, otwarty upload mediów dla EMPLOYEE.

Brakuje całej strony managera i dwóch zabezpieczeń mediów (`research.md` §5).

## Desired End State

- Pracownik: przycisk, dialog, lista swoich zgłoszeń ze statusem czeka / przyjęty / odrzucony (jest).
- Manager na `/` (Transakcje): nad tabelą lista czekających zgłoszeń (pracownik, inwestycja, data,
  liczba zdjęć, notatka) z akcjami „Przyjmij" i „Odrzuć".
- „Przyjmij" otwiera „Nowy wydatek": typ = wydatek inwestycyjny, inwestycja i kasa ze zgłoszenia,
  jedna pozycja ze wszystkimi zdjęciami, notatka widoczna w opisie dialogu. Manager wpisuje kwotę
  ręcznie albo klika „Generuj". „Zapisz" tworzy wydatek, zgłoszenie znika z listy, u pracownika
  zmienia się na „przyjęty".
- Drugi manager zapisujący to samo zgłoszenie dostaje „To zgłoszenie zostało już rozpatrzone." —
  i nie powstaje drugi wydatek.
- Filtr „Zgłoszenia pracowników" zawęża tabelę do wydatków przyjętych ze zgłoszeń; takie wiersze
  zawsze noszą badge „od pracownika".

### Key Discoveries:

- `ExpenseForm` sieje pliki przez `useInvoiceIngest({ recoveredFiles, storedLineItems })` —
  pozycyjna `Map<number, File[]>` + wiersze (`expense-form.tsx:93-107`, `use-invoice-ingest.ts:29-41`).
  Prefill wchodzi tym samym wejściem — bez nowej ścieżki w custody plików.
- Draft store jest jednoslotowy i scope'owany `formId` (`expense-form.tsx:84-90`); dialog zgłoszenia
  musi mieć własny `formId`, inaczej nadpisze szkic zwykłego „Nowy wydatek".
- `createBulkTransferAction(data, invoiceMediaIds)` (`src/lib/actions/transfers.ts:84`) już tworzy
  pozycje w transakcji Payloada; precedens wycofania przez throw: `accept-worker-report.ts` (`AcceptRefusal`).
- Dialog otwierany programowo: `FormDialog trigger={null}` + `openDialog(id, false)` (`review-prompt-host.tsx`).
- `fetch(media.url)` → `File` w przeglądarce: precedens `src/hooks/use-file-archive.ts:99`.
- `referenceData` dla managera: `fetchReferenceData()` + `currentUserId/currentUserRole`
  (`src/components/nav/navigation.tsx:20-24`) — `cache()` deduplikuje wywołanie w renderze.
- `findReferencedMedia` (`delete-unreferenced-media.ts:80-102`) zna tylko kolekcje Payloada —
  zdjęcie zgłoszenia wygląda dla reclaimu na sierotę.
- `deleteOrphanedMediaAction` stoi za `protectedAction` (management) — nieudany submit pracownika
  zostawia pliki w Blob.

## What We're NOT Doing

- Reużycia rekordów media zgłoszenia w wydatku. Manager wgrywa zdjęcia jak przy każdym wydatku
  (pobrane z URL zgłoszenia jako `File`) — „Generuj" i tak podmienia pliki na kopie z nazwą z Opisu
  (`use-invoice-files.ts:107`), więc mapa „plik → stare media id" by się rozjeżdżała na głównej
  ścieżce. Koszt: kopia kilku zdjęć w Blob na zgłoszenie.
- Odczytu AI przy kliknięciu — tylko „Generuj" (decyzja właściciela).
- Osobnej podstrony, licznika w nawigacji, ponownego rozpatrzenia zgłoszenia, edycji/usuwania
  zgłoszenia przez pracownika.
- Wierszy zgłoszeń wewnątrz tabeli transakcji (nie są transakcjami — lista nad tabelą).
- Blokady usunięcia pracownika przez zgłoszenia (FK `CASCADE` sprząta szkice).

## Implementation Approach

Cztery fazy, każda commitowalna osobno. Faza 1 zamyka luki mediów i commituje gotową stronę
pracownika. Faza 2 to serwer akceptacji/odrzucenia. Faza 3 to UI managera (prefill + lista).
Faza 4 to filtr i badge.

## Critical Implementation Details

**Atomowość akceptacji.** `decideExpenseDraft` musi iść tym samym executorem co tworzenie pozycji
(`getDb(payload, req)` wewnątrz transakcji `createBulkTransferAction`), a jego `false` musi rzucić,
żeby wycofać już utworzone wydatki — zwrot `{ success: false }` bez throw zostawiłby wydatek bez
zgłoszenia. Dialog używa `awaitBeforeClose: true`, żeby ten błąd pokazał się w otwartym dialogu,
a nie po optymistycznym zamknięciu.

## Phase 1: Zdjęcia zgłoszeń bezpieczne + strona pracownika

### Overview

Reclaim mediów i blokada usuwania znają tabelę zdjęć zgłoszeń; nieudany submit pracownika sprząta
jego pliki. Commit strony pracownika, która już jest w drzewie.

### Changes Required:

#### 1. Skan referencji mediów

**File**: `src/lib/media/delete-unreferenced-media.ts`

**Intent**: `findReferencedMedia` traktuje media podpięte do zgłoszenia jako zajęte, więc reclaim
(orphan cleanup, sprzątanie) nigdy nie skasuje zdjęcia zgłoszenia.

**Contract**: dodatkowy surowy probe `SELECT media_id FROM worker_expense_draft_media WHERE media_id = ANY(…)`
złączony z wynikiem z `MEDIA_RELATIONS`. Funkcja SQL w `src/lib/db/worker-expense-drafts.ts`.

#### 2. Blokada usuwania mediów

**File**: `src/collections/media.ts` / hook `preventReferencedMediaDelete`

**Intent**: usunięcie media podpiętego do zgłoszenia jest odmówione z komunikatem jak dla innych relacji.

**Contract**: probe wariantu `count(db, id)` (`DeleteProbeT`) z etykietą „zgłoszenia wydatków".

#### 3. Orphan cleanup dla EMPLOYEE

**File**: `src/lib/actions/delete-orphaned-media.ts`

**Intent**: pracownik może posprzątać własne pliki po nieudanym wysłaniu; nie może dotknąć cudzych.

**Contract**: akcja przyjmuje każdą rolę (`requireAuth(ROLES)` + `runAuthorizedHandler`); dla roli
spoza managementu zawęża ids do `media.created_by_id = session.user.id` przed `reclaimUnreferencedMedia`.
Ścieżka managementu bez zmian.

#### 4. Strona pracownika

**Files**: migracja, `src/lib/db|actions|queries/worker-expense-drafts.ts`, `src/components/worker-expenses/*`,
`src/app/(frontend)/pracownicy/[id]/page.tsx`, zmiany access w `media.ts` / `payload.config.ts` / `access/index.ts`.

**Intent**: commit gotowej pracy po przejrzeniu diffu; bez zmian zachowania.

### Success Criteria:

#### Automated Verification:

- Spec DB: `findReferencedMedia` zwraca media podpięte do zgłoszenia; reclaim go nie kasuje
- Spec DB: `insertWorkerExpenseDraft` odmawia, gdy choć jedno media nie jest wgrane przez pracownika
- Spec: orphan cleanup wywołany jako EMPLOYEE kasuje tylko jego własne niepodpięte media
- `src/__tests__/collections/media-access.test.ts` przechodzi
- Migracja stosuje się na lokalnej bazie: `pnpm payload migrate` (po `git status src/migrations`)

#### Manual Verification:

- Pracownik na swojej stronie → „Dodaj wydatek" → inwestycja + 2 zdjęcia + notatka → wysłane;
  na liście „Moje wydatki" pozycja „czeka", zdjęć: 2
- Pracownik bez domyślnej kasy: zamiast przycisku komunikat „Nie masz domyślnej kasy…"

---

## Phase 2: Przyjęcie i odrzucenie — serwer

### Overview

Zapis wydatku ze zgłoszenia i oznaczenie zgłoszenia jako przyjęte dzieją się razem albo wcale;
odrzucenie to osobna akcja.

### Changes Required:

#### 1. Przyjęcie w `createBulkTransferAction`

**File**: `src/lib/actions/transfers.ts`

**Intent**: opcjonalny identyfikator zgłoszenia; gdy jest, w tej samej transakcji po utworzeniu pozycji
zgłoszenie przechodzi na `accepted` z `transfer_id` = pierwsza utworzona pozycja i `decided_by` = manager.
Przegrany wyścig wycofuje cały zapis.

**Contract**: `createBulkTransferAction(data, invoiceMediaIds?, opts?: { expenseDraftId?: number })`;
`decideExpenseDraft(db, { status: 'accepted', … })` → `false` ⇒ throw (wzór `AcceptRefusal`) ⇒
`{ success: false, error: 'To zgłoszenie zostało już rozpatrzone.' }`. Bez `expenseDraftId` — zachowanie
bez zmian.

#### 2. Odrzucenie

**File**: `src/lib/actions/worker-expense-drafts.ts`

**Intent**: manager odrzuca czekające zgłoszenie.

**Contract**: `rejectExpenseDraftAction(draftId: number)` — `protectedAction`,
`decideExpenseDraft(rejected, transferId: null)`; `false` ⇒ ten sam komunikat „już rozpatrzone".

### Success Criteria:

#### Automated Verification:

- Spec DB: przyjęcie tworzy wydatek i ustawia zgłoszenie `accepted` z `transfer_id` tego wydatku
- Spec DB: drugie przyjęcie tego samego zgłoszenia zwraca błąd i **nie** zostawia drugiego wydatku w bazie
- Spec DB: odrzucenie ustawia `rejected`; odrzucenie przyjętego zwraca błąd i nic nie zmienia

#### Manual Verification:

- (pokryte w fazie 3)

---

## Phase 3: Dialog managera

### Overview

Lista czekających zgłoszeń nad tabelą Transakcji; „Przyjmij" otwiera wypełniony „Nowy wydatek",
„Odrzuć" odrzuca.

### Changes Required:

#### 1. Prefill w `ExpenseForm`

**File**: `src/components/forms/expense-form/expense-form.tsx`

**Intent**: formularz przyjmuje gotowe wartości i pliki zamiast szkicu ze store'a, pod własnym `formId`,
i przekazuje identyfikator zgłoszenia do akcji.

**Contract**: nowe propsy `formId?: string` (domyślnie `'expense'`), `prefill?: { values: FormValuesT;
files: Map<number, File[]>; expenseDraftId: number }`. Przy `prefill`: wartości startowe = `prefill.values`
(szkic store'a ignorowany i nie zapisywany), pliki siane przez `useInvoiceIngest` jako `recoveredFiles`

- `storedLineItems: prefill.values.lineItems`; `submit` z `awaitBeforeClose: true`; akcja dostaje
  `{ expenseDraftId }`. Bez `prefill` — zachowanie bez zmian.

#### 2. Lista czekających zgłoszeń

**Files**: `src/components/worker-expenses/pending-expense-drafts.tsx` (nowy, client),
`src/lib/queries/worker-expense-drafts.ts`, `src/components/dashboard/manager-dashboard.tsx`

**Intent**: `ManagerDashboard` pobiera czekające zgłoszenia (bez cache) i `referenceData`, renderuje
listę nad `TransfersSection`; pusta lista nie renderuje nic.

**Contract**: `fetchPendingExpenseDrafts()` (management, `listPendingExpenseDrafts`). Karta: pracownik,
inwestycja, data wysłania, liczba zdjęć, notatka, „Przyjmij", „Odrzuć" (z potwierdzeniem, istniejący
komponent potwierdzenia).

#### 3. „Przyjmij"

**File**: `pending-expense-drafts.tsx`

**Intent**: w handlerze kliknięcia (bez `useEffect`) pobiera zdjęcia zgłoszenia jako `File`
(spinner na przycisku), buduje prefill — typ `INVESTMENT_EXPENSE`, inwestycja i kasa ze zgłoszenia,
jedna pozycja ze wszystkimi zdjęciami i domyślną kategorią — i otwiera dialog. Błąd pobrania ⇒ toast,
dialog się nie otwiera.

**Contract**: `FormDialog trigger={null} showKeepOpen={false}` z `formId` `expense-draft-<id>`,
`description` = notatka pracownika; `openDialog(formId, false)`. Po sukcesie `router.refresh()`
(z `useFormSubmit`) — lista i tabela odświeżają się.

### Success Criteria:

#### Automated Verification:

- Spec DOM: `ExpenseForm` z `prefill` pokazuje inwestycję, kasę i miniatury zdjęć oraz nie czyta
  ani nie nadpisuje szkicu `'expense'` w store
- Spec DOM: `ExpenseForm` bez `prefill` nadal odtwarza szkic `'expense'` (regresja)

#### Manual Verification:

- Transakcje → nad tabelą czekające zgłoszenie → „Przyjmij" → dialog z inwestycją, kasą pracownika,
  zdjęciami i notatką; kwota pusta
- „Generuj" wypełnia kwotę i opis z paragonu; „Zapisz" → zgłoszenie znika z listy, wydatek jest
  w tabeli, u pracownika status „przyjęty"
- Dwie karty przeglądarki, to samo zgłoszenie: druga „Zapisz" → „To zgłoszenie zostało już
  rozpatrzone.", w tabeli jeden wydatek
- „Odrzuć" → potwierdzenie → zgłoszenie znika; u pracownika „odrzucony"
- Zwykły „Nowy wydatek" z paska nadal odtwarza swój niedokończony szkic

---

## Phase 4: Filtr i badge

### Overview

Wydatki przyjęte ze zgłoszeń da się wyfiltrować i są oznaczone w tabeli.

### Changes Required:

#### 1. Badge

**Files**: `src/types/transfers.ts`, `src/lib/db/worker-expense-drafts.ts`,
`src/components/transfers/transfer-table-server.tsx`, kolumna Typ/Opis w `src/components/tables/transfers.tsx`

**Intent**: wiersz wydatku przyjętego ze zgłoszenia nosi badge „od pracownika".

**Contract**: `TransferRowT.fromWorkerDraft?: boolean`, ustawiany po `buildTransferRows` jednym
zapytaniem `transfer_id = ANY(ids strony)`; badge na `BADGE_BASE`.

#### 2. Filtr

**Files**: `src/types/filters.ts`, `src/components/transfers/transfer-filters.tsx`,
`src/components/dashboard/manager-dashboard.tsx`

**Intent**: przełącznik „Zgłoszenia pracowników" (`?workerDrafts=1`) zawęża tabelę do wydatków
przyjętych ze zgłoszeń; czyści go „Wyczyść filtry".

**Contract**: flaga w configu filtrów (wzór `showPaymentMethodFilter`), włączona tylko w `ManagerDashboard`;
klucz w `ENTITY_FILTER_KEYS`. `ManagerDashboard` dokłada `and: [{ id: ids.length ? { in: ids } : NO_RESULTS }]`
do `buildTransferFilters(...)` — `and`, bo `id` może już być zajęte przez wyszukiwanie po kwocie / id.

### Success Criteria:

#### Automated Verification:

- Spec unit: zawężenie `workerDrafts` łączy się z istniejącym filtrem `id` (część wspólna), a pusta
  lista daje zero wyników
- Spec DB: zapytanie o `transfer_id` zgłoszeń zwraca tylko przyjęte

#### Manual Verification:

- Transakcje → „Zgłoszenia pracowników" → tylko wydatki przyjęte ze zgłoszeń, każdy z badge'em
  „od pracownika"; „Wyczyść filtry" wyłącza przełącznik
- Filtr + wyszukiwanie po kwocie → część wspólna

---

## Testing Strategy

Ryzyka: (1) zdjęcie zgłoszenia skasowane jako sierota, (2) wydatek bez oznaczonego zgłoszenia albo
podwójny wydatek przy wyścigu, (3) prefill nadpisujący szkic zwykłego formularza, (4) filtr gubiący
istniejące zawężenie. Każde pokryte najtańszą warstwą: DB-integracja dla 1–2 (stan w bazie, nie
wynik akcji), DOM dla 3, unit dla 4. E2E — do backlogu (`e2e-backlog`) przy review gate.

## Migration Notes

Migracja addytywna — na prod **przed** pushem kodu, przez człowieka (`pnpm db:migrate:prod`).

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (tylko na wyraźne polecenie)

## References

- Research: `context/changes/2026-10-05-worker-expenses/research.md`
- Precedens akceptacji: `src/lib/actions/accept-worker-report.ts`
- Precedens dialogu programowego: `review-prompt-host.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Zdjęcia zgłoszeń bezpieczne + strona pracownika

#### Automated

- [x] 1.1 Spec DB: findReferencedMedia widzi zdjęcia zgłoszeń, reclaim ich nie kasuje — de6b71b9
- [x] 1.2 Spec DB: insertWorkerExpenseDraft odmawia cudzych mediów — de6b71b9
- [x] 1.3 Spec: orphan cleanup jako EMPLOYEE kasuje tylko własne media — de6b71b9
- [x] 1.4 media-access.test.ts przechodzi — 79800e11
- [x] 1.5 Migracja stosuje się lokalnie — 79800e11

### Phase 2: Przyjęcie i odrzucenie — serwer

#### Automated

- [x] 2.1 Spec DB: przyjęcie tworzy wydatek i oznacza zgłoszenie — f219720d
- [x] 2.2 Spec DB: drugie przyjęcie nie zostawia drugiego wydatku — f219720d
- [x] 2.3 Spec DB: odrzucenie i odrzucenie przyjętego — f219720d

### Phase 3: Dialog managera

#### Automated

- [x] 3.1 Spec DOM: prefill pokazuje dane i nie dotyka szkicu 'expense' — 4899fda5
- [x] 3.2 Spec DOM: bez prefill szkic 'expense' odtwarzany — 4899fda5

### Phase 4: Filtr i badge

#### Automated

- [x] 4.1 Spec unit: workerDrafts ∩ istniejący filtr id, pusta lista = zero wyników — 6d210dba
- [x] 4.2 Spec DB: transfer_id tylko przyjętych zgłoszeń — 6d210dba
