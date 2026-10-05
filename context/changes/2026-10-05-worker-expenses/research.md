---
date: 2026-10-05T13:58:39+0200
researcher: Claude
git_commit: 49d1916e0b129548635be1a56e227a53730a8d4c
branch: staging
repository: wykonczymy
topic: 'Wydatek zgłoszony przez pracownika — najprostsza droga: przycisk + uproszczony dialog po stronie pracownika, zgłoszenia w widoku Transakcji po stronie managera'
tags: [research, codebase, worker-expenses, transfers, expense-form, media]
status: complete
last_updated: 2026-10-05
last_updated_by: Claude
---

# Research: wydatek zgłoszony przez pracownika (EX-971)

**Date**: 2026-10-05T13:58:39+0200
**Researcher**: Claude
**Git Commit**: 49d1916e
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Prosta rzecz: pracownik ma jeden przycisk „Dodaj wydatek" i mega uproszczony dialog (inwestycja +
zdjęcie paragonu + notatka, kasa domyślna). Manager widzi zgłoszenia w widoku Transakcji (badge,
filtr), klik otwiera dialog „Nowy wydatek" wypełniony danymi + AI. Bez spike'a — najprostsza droga
w istniejącym kodzie. Część pracy już jest w drzewie (niecommitowana).

## Summary

Strona pracownika jest gotowa i zgodna z wzorcem EX-947. Strona managera sprowadza się do czterech
kawałków, z których każdy ma gotowy precedens w kodzie:

1. **Lista czekających zgłoszeń nad tabelą Transakcji** — osobna lista kart w `ManagerDashboard`, nie
   wiersze tabeli (tabela nie pomieści wiersza nie-transakcji bez fałszowania `TransferRowT`). Karty
   są też jedyną sensowną powierzchnią na telefonie — tabela transakcji nie ma wersji mobilnej.
2. **„Przyjmij" = istniejący `ExpenseForm` z `prefill`** — zdjęcia zgłoszenia pobrane w przeglądarce
   jako `File`, odczyt AI zrobiony w handlerze kliknięcia (bez `useEffect`), dialog otwierany
   programowo (`trigger={null}` + `openDialog`, precedens `ReviewPromptHost`). Zapis **reużywa
   istniejące rekordy media** zgłoszenia — bez ponownego wgrania.
3. **Akceptacja atomowa** — transakcja i oznaczenie zgłoszenia w jednej transakcji DB
   (`withPayloadTransaction` + `getDb(payload, req)`), dokładnie jak `acceptWorkerReport` (EX-947).
4. **Filtr „Zgłoszenia pracowników" + badge „od pracownika"** — id transakcji ze zgłoszeń
   rozwiązane surowym SQL przed `buildTransferFilters` (wzorzec `resolveAmountSearch`), flaga
   dostawiona do wierszy po `buildTransferRows`.

Do tego dwie luki, które są **warunkiem** reużycia zdjęć, nie dodatkiem: skan referencji mediów
nie widzi surowej tabeli `worker_expense_draft_media` (zdjęcie zgłoszenia może zostać skasowane
z Blob), a sprzątanie osieroconych plików jest tylko dla managementu.

Nie potrzeba: osobnej podstrony, strumienia badge'a w nawigacji, ponownego rozpatrywania zgłoszenia,
pozycji per-linia (cała maszyneria EX-947 poza kolumnami statusu).

## Detailed Findings

### Stan w drzewie (niecommitowany)

- Migracja `src/migrations/20261005_3_add_worker_expense_drafts.ts` — `worker_expense_drafts` +
  `worker_expense_draft_media`; kształt kolumn statusu, CHECK-i i częściowy indeks `pending` są
  kopią `worker_reports` z EX-947 (`src/migrations/20260930_2_add_worker_reports.ts:19-38`).
  Zastosowana lokalnie.
- `src/lib/db/worker-expense-drafts.ts` — insert (CTE: zgłoszenie powstaje tylko, gdy KAŻDE zdjęcie
  wgrał ten pracownik), listy, `decideExpenseDraft` (rusza tylko wiersz `pending` — ten sam guard co
  `claimPendingReport`, `src/lib/db/worker-reports.ts:330-345`). `readExpenseDraft`,
  `listPendingExpenseDrafts`, `decideExpenseDraft` nie mają jeszcze wywołań.
- `src/lib/actions/worker-expense-drafts.ts` — `sendExpenseDraftAction`: `requireAuth(ROLES)` +
  `runAuthorizedHandler` (EMPLOYEE nie przejdzie `protectedAction`). EX-947 autoryzuje tokenem
  (`tokenAction`), tu jest zalogowane konto — inna bramka, ten sam rdzeń.
- Dostęp: `media.access.create` i `clientUploads.access` otwarte dla każdego zalogowanego
  (`src/collections/media.ts`, `src/payload.config.ts`, `src/access/index.ts`). `update`/`delete`
  zostają ADMIN/OWNER. `media.access.read: () => true` — pracownik widzi swoje miniatury.
- UI pracownika: `src/components/worker-expenses/*` + `src/app/(frontend)/pracownicy/[id]/page.tsx`.

### 1. Czekające zgłoszenia w widoku Transakcji

- Ścieżka danych: `src/app/(frontend)/(dashboard)/page.tsx:12` → `ManagerDashboard`
  (`src/components/dashboard/manager-dashboard.tsx:35-59`, async server component) →
  `TransfersSection` → `TransferTableServer` (`src/components/transfers/transfer-table-server.tsx:35-41`)
  → `findTransfersRaw` = Payload `find` w `unstable_cache` (`src/lib/queries/transfers.ts:22-56`).
- Tabela przyjmuje tylko `TransferRowT` (`src/types/transfers.ts:10-48`), więc zgłoszenia idą jako
  **osobna lista między `UserRegisterStats` a `TransfersSection`**, zasilana `listPendingExpenseDrafts`.
- Brak wersji mobilnej tabeli — `src/components/tables/data-table/data-table.tsx:203` to tylko
  `overflow-x-auto`. Lista kart nad tabelą jest więc też powierzchnią telefonu.
- Odczyt zgłoszeń zostaje niecache'owany (jak w EX-947) — odrzucenie nie potrzebuje żadnego tagu,
  wystarczy `router.refresh()`.

### 2. „Przyjmij" — wypełniony dialog „Nowy wydatek"

- **Zdjęcia**: magazyn Blob jest publiczny (`client-upload.ts:38-43`), `media.url` to
  `/api/media/file/<filename>` z tego samego originu. W przeglądarce: `fetch(url)` → `blob()` →
  `new File([blob], filename, { type: mimeType })`. Serwerowego odczytu AI po id nie ma —
  `scanReceipt` przyjmuje tylko `File[]` (`src/lib/ai/scan-receipt.ts:15`).
- **AI bez `useEffect`**: handler kliknięcia pobiera pliki, woła `scanReceiptClient`
  (`src/lib/utils/scan-receipt-client.ts:11`) z pigułką `usePendingStore`, buduje wartości formularza
  i dopiero wtedy otwiera dialog. Mapowanie wyniku na pola wiersza wyciągnąć z `applyReceiptToRow`
  (`src/components/forms/expense-form/apply-receipt-to-row.ts:16`) do czystej funkcji, żeby prefill
  i przycisk „Generuj" dzieliły jedno mapowanie. Nieudany odczyt = dialog z pustymi polami (AI to
  pomoc, nie bramka; limit odczytu to 8 stron i 4 MB, zgłoszenie dopuszcza 20 zdjęć).
- **Wszystkie zdjęcia zgłoszenia = jedna pozycja z wieloma stronami** (`registerFilesAt`
  `'single-row'`, `src/components/forms/expense-form/use-invoice-files.ts:56-81`). Odczyt AI wysyła
  strony wiersza jako jeden dokument (`use-receipt-generation.ts:77`), `transfer_id` to jeden FK.
- **Prefill w `ExpenseForm`**: `DialogContent` odmontowuje się po zamknięciu, więc każde otwarcie
  to świeży mount i inicjalizatory `useState` działają jako seed.
  - wartości: `initialValues = prefill?.values ?? (storedValues ? … : blankValues)`
    (`expense-form.tsx:153-163`); wartości budowane raz w handlerze (`makeLineItem` mintuje id —
    literał w renderze to pętla z `expense-form.tsx:138-141`);
  - pliki: `useInvoiceIngest` dostaje `prefillFiles` obok `recoveredFiles`
    (`use-invoice-ingest.ts:42`: `useInvoiceFiles(recoveredFilesById ?? prefillFiles)`); pliki
    zgłoszenia przeszły już ingest przy wysyłce, więc nie trzeba ich przetwarzać drugi raz;
  - store szkicu (`useExpenseFormStore`) ma **jeden slot** — przy `prefill` ani nie czytać, ani nie
    zapisywać, bo nadpisałoby to zwykły szkic „Nowego wydatku". Prefill zawsze da się odbudować z DB.
- **Otwarcie z karty, nie z przycisku-triggera**: `FormDialog trigger={null}` +
  `useOptimisticFormStore.getState().openDialog(id, false)` — precedens
  `review-prompt-host.tsx:10` / `review-prompt-store.ts:19`. `formId` per zgłoszenie
  (`expense-draft-<id>`, lekcja `context/foundation/lessons.md` „formId szkicu formularza nazywa typ").
  Notatka pracownika jako `description` dialogu — w nagłówku, poza `invoiceNote`, które AI nadpisuje.
- **Zapis czeka na wynik** (`awaitBeforeClose: true`, `use-form-submit.ts:14-18`): formularz bez
  szkicu, odczyt AI już zapłacony, a „zgłoszenie już rozpatrzone" od drugiego managera musi trafić do
  otwartego dialogu.

### 3. Reużycie zdjęć i akceptacja atomowa

- `transactions.invoice` to `upload`, `relationTo: 'media'`, `hasMany` bez filtra `createdBy`
  (`src/collections/transfers.ts:235-241`); `createBulkTransferAction` wkłada `invoiceMediaIds[i]` do
  wiersza i bez sprawdzeń (`src/lib/actions/transfers.ts:124,141`). Istniejące id działają wprost.
  `createdBy` transakcji = manager, więc pracownik nie dostaje praw edycji (`canMutateTransfer`).
- Pominięcie wgrania: `resolveUploadIdRows` ma wstrzykiwany `upload` (`src/lib/media/upload-ids.ts:38-41`).
  Opcjonalny parametr w `submitWithUploadRows` → `(file) => mediaIdByFile.get(file) ?? upload(file)`.
  Strona usunięta przez managera po prostu nie jest dołączana, dodana — wgrywa się normalnie.
- Atomowość: wzorzec `acceptWorkerReport` (`src/lib/actions/accept-worker-report.ts:78-117`) —
  `withPayloadTransaction(payload, async (req) => { const tx = await getDb(payload, req) … })`
  (`src/lib/db/get-db.ts:12-19`). Mieszanie `payload.create({ collection: 'transactions', req })` z
  surowym SQL w tej samej transakcji robi już `src/lib/actions/book-overpayment-bonus.ts:45-80`.
  W środku: `decideExpenseDraft(tx, { status: 'accepted', transferId: ids[0], … })`; `false` →
  `throw` (rollback utworzonych wierszy; synchronizacja arkusza jest po commicie w `after()`, więc nic
  nie wycieka). Dwóch managerów naraz: drugi czeka na blokadę wiersza, trafia 0 wierszy, rollback.
- Najprostsza forma: opcjonalny trzeci parametr `expenseDraftId` w `createBulkTransferAction`
  (wewnątrz istniejącej transakcji, `transfers.ts:118-152`). Alternatywa z agenta — wyciągnięcie ciała
  do `src/lib/transfers/book-bulk-expenses.ts` i osobna `acceptExpenseDraftAction` — czystsza, ale
  to refaktor ścieżki, która dziś działa. Wybór do planu.
- Odrzucenie: `protectedAction` + `decideExpenseDraft(rejected)`, kształt `rejectWorkerReportAction`
  (`accept-worker-report.ts:50-69`).
- Rewalidacja: `payload.create` odpala `recalcAfterChange` → `revalidateTag(CACHE_TAGS.transfers)`
  (`src/hooks/transfers/recalculate-balances.ts:36,57`), lista transakcji odświeża się sama.

### 4. Filtr „Zgłoszenia pracowników" + badge „od pracownika"

- `where` nie wyrazi joinu do surowej tabeli: Payload nie zna `worker_expense_drafts`, a
  `where-to-sql` (`src/lib/db/where-to-sql.ts:66-67`) rzuca na nieznanym polu. Rozwiązanie id przed
  zbudowaniem `where` — wzorzec `resolveAmountSearch` (`src/lib/queries/transfers.ts:74-93`):
  `where.id = ids.length ? { in: ids } : NO_RESULTS`. `id` jest zmapowane w `where-to-sql` (:10), więc
  kafel sumy działa dalej.
- Dwie kolizje do obsłużenia (przecięcie zamiast nadpisania): `transfer-filters.ts:150` pomija `?id=`,
  gdy `where.id` już jest; `resolveAmountSearch` (`transfers.ts:93`) nadpisuje `id` wynikami
  wyszukiwania kwoty.
- UI filtra: przełącznik w stylu „Anulowane" — `useToggleSearchParam`
  (`src/hooks/use-toggle-search-param.ts`), `FilterMultiSelect toggles` w
  `src/components/transfers/transfer-filters.tsx:107-123,274`; klucz dopisać do `ENTITY_FILTER_KEYS`
  (:39-55), żeby „Wyczyść filtry" go zerował.
- Badge: `fromWorkerDraft?: boolean` na `TransferRowT`, jedno zapytanie
  `transfer_id = ANY(pageIds)` po `buildTransferRows` (`transfer-table-server.tsx:62`), render w
  komórce „Opis" lub „Typ" (`src/components/tables/transfers.tsx:92-112`) z `BADGE_BASE`
  (`src/components/ui/badge.tsx:5-12`). Opcjonalne pole nie rusza druku ani formularza edycji.

### 5. Luki mediów (warunek reużycia zdjęć)

- **Skan referencji** — `MEDIA_RELATIONS` (`src/lib/media/relating-collections.ts:19-25`) zna tylko
  kolekcje Payloada; `findReferencedMedia` (`src/lib/media/delete-unreferenced-media.ts:80-102`) uzna
  zdjęcie trzymane wyłącznie przez `worker_expense_draft_media` za nieużywane i skasuje je z Blob,
  a `ON DELETE CASCADE` cicho zdejmie stronę ze zgłoszenia. Ścieżki: `delete-orphaned-media.ts:19`,
  `set-upload-field.ts:46`, `hooks/transfers/delete-invoice-media.ts:15` (usunięcie transakcji),
  `leads/erase-lead.ts:63`, `api/webhooks/landing/route.ts:132`. Strażnik
  `src/hooks/media/prevent-referenced-delete.ts:14-22` też tego nie widzi.
  Poprawka: surowa sonda `SELECT media_id FROM worker_expense_draft_media WHERE media_id = ANY(…)`
  dołożona do `referenced` w `findReferencedMedia` + sonda `{ count, label }` w strażniku — format
  surowych sond już istnieje (`src/lib/db/delete-blocker.ts:26-28`, użycie
  `src/lib/workers/delete-blocker.ts:37-44`). Sonda dla **każdego** statusu, inaczej usunięcie
  przyjętej transakcji zdejmie zdjęcie z historii zgłoszenia.
- **Sprzątanie po nieudanej wysyłce** — `submitWithUploads` → `discardOrphanedUploads` →
  `deleteOrphanedMediaAction` (`src/lib/actions/delete-orphaned-media.ts:15-23`) jest za
  `protectedAction`; dla EMPLOYEE zwraca `Brak uprawnień` bez wyjątku, więc pliki zostają w Blob po
  cichu. Nie wolno go po prostu otworzyć (ufa id od klienta). Minimalnie: wariant dla pracownika,
  który filtruje do `created_by_id = sesja` i dopiero wtedy woła `reclaimUnreferencedMedia` — bezpieczny
  dopiero **po** poprawce sondy (inaczej wysyłka, która się zapisała, a klient widział błąd, straci
  zdjęcia).
- Drobne: `DRAFT_SELECT` zwraca pełny `m.url`, nie rozmiar miniatury.

## Code References

- `src/components/dashboard/manager-dashboard.tsx:35-59` — miejsce na listę zgłoszeń i rozwiązanie id filtra
- `src/components/transfers/transfer-table-server.tsx:35-75` — wiersze tabeli, miejsce na flagę badge'a
- `src/lib/queries/transfer-filters.ts:46-163` — `buildTransferFilters`, kolizja `?id=` na :150
- `src/lib/queries/transfers.ts:74-93` — `resolveAmountSearch`, wzorzec id-przed-where
- `src/components/transfers/transfer-filters.tsx:39-55,95-123,274` — przełączniki filtra
- `src/components/tables/transfers.tsx:92-112` — komórki „Typ"/„Opis"
- `src/components/forms/expense-form/expense-form.tsx:79,138-171` — `FORM_ID`, seed wartości, persist szkicu
- `src/components/forms/expense-form/use-invoice-ingest.ts:42` — seed mapy plików
- `src/components/forms/expense-form/apply-receipt-to-row.ts:16` — mapowanie wyniku AI
- `src/components/forms/hooks/use-form-submit.ts:14-18` — `awaitBeforeClose`
- `src/lib/media/submit-with-uploads.ts:25-41`, `src/lib/media/upload-ids.ts:38-41` — wgrywanie, wstrzykiwany `upload`
- `src/lib/actions/transfers.ts:84-164` — `createBulkTransferAction`
- `src/lib/actions/accept-worker-report.ts:50-117` — wzorzec przyjęcia/odrzucenia
- `src/lib/db/get-db.ts:12-19` — surowy SQL w transakcji Payloada
- `src/lib/media/delete-unreferenced-media.ts:80-102`, `src/hooks/media/prevent-referenced-delete.ts:14-22` — skan referencji
- `src/lib/actions/delete-orphaned-media.ts:15-23` — sprzątanie osieroconych plików

## Architecture Insights

- **Osobna tabela zamiast statusu na transakcji** to ta sama decyzja co EX-947: każdy odczyt salda /
  materiałów / marży czyta `transactions`, a zgłoszenie nie może ruszyć żadnego z nich przed
  akceptacją. Status na transakcji wymagałby filtra w każdym zapytaniu — jeden pominięty i zgłoszenie
  rusza saldo. Do tego kwota 0 jest zabroniona (`getAmountError`), a każdy wydatek trafia do arkusza
  właściciela, linku inwestora i protokołu.
- **Surowa tabela trzymająca id mediów musi się zarejestrować w skanie referencji** — to nowy
  przypadek: EX-947 nie miało mediów, a `MEDIA_RELATIONS` zna tylko kolekcje. Każda kolejna surowa
  tabela z `media_id` ma ten sam obowiązek.
- **Odczyt AI w handlerze, nie po montażu** — pozwala wypełnić formularz bez `useEffect`; koszt:
  dialog otwiera się po kilku sekundach odczytu, z pigułką postępu.

## Historical Context (from prior changes)

- `context/archive/2026-09-30-worker-work-reports/` — EX-947: surowe tabele, `pending/accepted/rejected`,
  przyjęcie w transakcji, kolejka w nawigacji (`QUEUE_STREAMS`). Kopiujemy kolumny statusu i akcje;
  podstrony, strumienia w nawigacji i ponownego rozpatrywania nie.
- `context/archive/2026-10-05-worker-account/` — EX-985: konto pracownika i jego `/pracownicy/[id]`,
  na którym żyje przycisk.
- `context/foundation/lessons.md` — „formId szkicu formularza nazywa typ" (okno przypięte do encji
  dostaje własny klucz); „Soft delete … fails closed into Blob deletion" (skan referencji mediów jest
  jedynym strażnikiem przed skasowaniem pliku z Blob, który nie ma undelete).

## Related Research

- `context/archive/2026-09-30-worker-work-reports/research.md` (jeśli zachowany) — wzorzec zgłoszeń prac.

## Open Questions

1. Dialog otwiera się **po** odczycie AI (kilka sekund z pigułką) — czy od razu z pustymi polami
   i przyciskiem „Generuj"? Rekomendacja: po odczycie (właściciel chciał dialog już wypełniony).
2. Wszystkie zdjęcia zgłoszenia jako **jedna pozycja** z wieloma stronami — zgodne z tym, że
   pracownik zgłasza jeden wydatek; manager może dodać pozycje ręcznie.
3. Akceptacja: parametr `expenseDraftId` w `createBulkTransferAction` (mniejszy diff) czy wyciągnięcie
   ciała do modułu i osobna akcja (czystsze granice). Do rozstrzygnięcia w planie.
