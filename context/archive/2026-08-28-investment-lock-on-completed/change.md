---
change_id: investment-lock-on-completed
title: Zakończona inwestycja jest zablokowana — read-only dla wszystkich ról
linear: EX-748
status: archived
created: 2026-08-28
updated: 2026-09-03
archived_at: 2026-09-03T11:29:49Z
branch: staging
worktree: null
---

## Notes

Status `completed` czyni inwestycję, jej transakcje i kosztorys tylko do odczytu dla **wszystkich**
ról, ADMIN/OWNER włącznie — blokada jest totalna, nie ma roli, która edytuje mimo blokady.

Przejście na `completed` wymaga confirmation dialogu: „inwestycja zostanie zablokowana, tylko do
odczytu" — **bez** wzmianki o możliwości odblokowania.

Jedyne wyjście to jawna zmiana statusu z powrotem na „Aktywna", dostępna wyłącznie dla OWNER/ADMIN,
również za confirmation dialogiem. Nie ma osobnej akcji „Odblokuj" — odblokowanie JEST zmianą statusu.
Powód, dla którego drzwi zostają: nieodwracalna blokada zamienia jedno błędne kliknięcie na
400-pozycyjnym kosztorysie w trwałe zamrożenie, którego jedyną naprawą jest ręczny SQL na produkcyjnym
Neonie.

### Ustalenia z rekonesansu (2026-08-28)

- `status: 'completed'` nie egzekwuje dziś **niczego** — jedyny efekt to `opacity-50`
  (`investment-data-table.tsx:53`) i pozycja w filtrze statusów.
- **Payload `access.update` nie jest punktem kontrolnym**: akcje jadą Local API (`overrideAccess`
  domyślnie `true`), a kosztorys w ~12 miejscach pisze surowym SQL-em (`getDb` + `sql`), co omija też
  hooki kolekcji. Chokepoint musi żyć w warstwie akcji — w kształcie istniejącego `ownerOnlyAction`
  (`lib/actions/owner-only-action.ts`).
- Część akcji kosztorysu dostaje `itemId`/`sectionId`/`stageId`, nie `investmentId`, więc guard
  potrzebuje resolvera; te akcje już robią taki lookup (`kosztorys.ts:526-535`, `704-713`).
- Powierzchnia zapisu: `lib/actions/kosztorys.ts` (~30 akcji), `kosztorys-import.ts`,
  `kosztorys-snapshots.ts` (restore), `kosztorys-share.ts`, `kosztorys-client-view.ts`,
  `sheets-sync.ts`, `lib/actions/transfers.ts` (7), `lib/actions/investments.ts`
  (`updateInvestmentAction`, `linkSheetAction`, `setupSheetAction`).
- **`preview` w edytorze nie nadaje się na „zablokowane"** — to dokument klienta: obcina kolumny,
  filtry, prognozy, toolbar i podmienia layout (`use-kosztorys-editor.ts:469`,
  `kosztorys-editor-body.tsx`). Do reużycia nadaje się `opts.readOnly` w
  `kosztorys-v2-columns.tsx:580` (wyłącza każdą komórkę, zdejmuje kolumnę akcji). Potrzebna osobna
  flaga `locked`, `readOnly: preview || locked`, bez podmiany layoutu.
- `InvestmentRefT` już niesie `status`, więc zakończone inwestycje da się odfiltrować z comboboxa
  wydatku/wpłaty bez nowego zapytania — plus twardy `return { success: false }` w akcji.

### Rozstrzygnięcia (2026-09-03, właściciel)

1. **Blokada od pierwszego dnia, na wszystkich 69 zakończonych.** Bez migracji, bez drugiego
   znacznika, bez okresu przejściowego. Uzasadnienie właściciela: inwestycja jest zakończona dopiero
   po rozliczeniu, wypłat włącznie — więc 84 transakcje zaksięgowane po zakończeniu nie są ścieżką do
   ochrony, tylko dowodem przedwczesnego zamykania. Prośby o odblokowanie w pierwszych tygodniach są
   listą takich inwestycji, nie kosztem wdrożenia.
2. **Ślad audytowy odblokowania — WYCOFANY, warunkowo.** Skoro wyjście z `completed` jest zawężone
   do OWNER/ADMIN (patrz #6), krąg podejrzanych to właściciel i admin — ślad nie odpowiadałby na
   żadne pytanie, którego właściciel nie zna. Decyzja wraca w chwili, w której wyjście z `completed`
   dostanie jakakolwiek inna rola; wtedy kształt do skopiowania to `src/collections/amount-edits.ts`
   (append-only, `create/update/delete: () => false`, `read: isAdminOrOwner`).
3. **Faktury pozostają otwarte na zablokowanej inwestycji.** Jedyny wyjątek od blokady totalnej.
   Podpięcie i odpięcie skanu nie rusza żadnej figury, a faktury systemowo przychodzą po zamknięciu
   roboty — blokowanie ich zmuszałoby do odblokowania inwestycji dla samego PDF-a, po czym nikt jej
   nie zablokuje z powrotem. Podtrzymuje decyzję z 2026-08-10 spisaną w `transfers.ts:~318`
   (`setTransferInvoices` świadomie poza `fetchAndAuthorize`).
4. **Granica odczytu:** `previewKosztorysImport` / `compareWithSheet` zostają (czytają),
   `applyMaterialSync` blokowany (pisze do arkusza właściciela), `savePresetAction` zostaje (zapisuje
   szablon globalny, nie inwestycję — zakończona inwestycja jest dobrym źródłem szablonu).
5. **Link kliencki i ustawienia widoku klienta zostają dostępne** — unieważnienie linku jest
   operacją bezpieczeństwa, której blokować nie wolno.
6. **Rekord inwestycji jest POZA blokadą — bramka ma dwie płaszczyzny, nie trzy.** Celem jest
   odcięcie ruchu na kasie, nie zamrożenie kartoteki. Osiem pól z formularza inwestycji
   (`name`, `address`, `phone`, `email`, `contactPerson`, `notes`, `review`, `status`) nie ma wpływu
   na żadną figurę, więc `updateInvestmentAction` zostaje nietknięta: bez diffu pól, bez reguły
   „tylko status", bez listy dozwolonych przejść. Status jest z powrotem zwykłym polem formularza
   i OWNER/ADMIN ustawia go dowolnie.
   Podział biegnie dokładnie po granicy kolumn `investments`: siedem pól finansowych
   (`wToolsCoeff`, `ownToolsCoeff`, `vatRate`, `settlementMode`, `materialsNetRate`,
   `globalDiscountType`, `globalDiscountValue`) pisze wyłącznie pięć akcji kosztorysu z panelu
   ustawień edytora, więc wpadają pod bramkę kosztorysową — VAT i rabat globalny przeliczają cały
   kosztorys.
   **Jedyny wyjątek — jedna reguła, na której trzyma się cała reszta: wyjście ze statusu `completed`
   wymaga OWNER/ADMIN.** Bez niej blokada jest pozorna: `updateInvestmentAction` idzie przez
   `MANAGEMENT_ROLES`, więc MANAGER przestawiłby „Zakończona" → „Aktywna", zaksięgował co chce
   i przestawił z powrotem. **Wejście** w `completed` zostaje otwarte dla managera — zamykanie
   rozliczonej roboty to jego praca.
   Reguła stoi w **hooku `beforeChange` kolekcji `investments`**, nie w akcji: `/admin` ma
   `update: isAdminOrOwnerOrManager` na inwestycjach, więc manager przestawiłby status panelem.
   Hook widzi `originalDoc.status` i `data.status`, więc łapie akcję, Local API i REST naraz; akcja
   dokłada wyłącznie czytelny polski komunikat.
7. **Anulowanie transakcji blokowane.** `CANCELLATION` na zablokowanej inwestycji wymaga
   odblokowania — pomyłka wykryta po zamknięciu przechodzi tą samą drogą co każda inna zmiana.
8. **Kasowanie inwestycji — bramki NIE dodajemy (wycofane).** Inwestycja z jakąkolwiek transakcją
   jest już dziś nieusuwalna (`preventDeleteWithTransactions`, `collections/investments.ts:20`).
   Zostaje wyłącznie zakończona inwestycja bez ani jednej transakcji — tam nie ma czego chronić,
   więc bramka nie miałaby co blokować.
9. **Confirmation dialog jest jeden, niezależny od roli.** Bez wariantu treści dla OWNER/ADMIN —
   prostota bije precyzję komunikatu.
