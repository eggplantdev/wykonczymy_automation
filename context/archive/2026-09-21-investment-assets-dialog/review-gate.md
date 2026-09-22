# Review-gate ledger — investment-assets-dialog · 2026-09-21

Diff pod przeglądem: `1a4f40df..HEAD` (fazy p1–p3, 15 plików w `src/`).
Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (flag-only).
Step 0.5 pominięty — repo nie ma skilla weryfikacji przeglądarkowej.

## Findings

- [x] 🔴 CRITICAL · filed EX-832 · code-review · `src/lib/actions/investment-assets.ts` · `setUploadField` to nieserializowany read-modify-write, a slice dokłada drugiego pisarza tego samego pola (`InvestmentAssetsField` w dialogu edycji obok sekcji na stronie) — upload trwający po zamknięciu dialogu ginie przy równoległym usunięciu; to samo źródło co bezwarunkowy `removeAll`. Bramka kliencka nie przeskoczy dwóch komponentów, więc naprawa jest serwerowa i zasługuje na własny review
      test: test-driven-debugging · integration (DB) — przeplot `add`/`remove` bez awaitowania pierwszego, asercja że dołożone id przeżywa; dyspozycja zapisana w EX-832
- [x] 🔴 CRITICAL · fixed · code-review · `src/components/investments/investment-assets.tsx:52` · slice zgubił `isRemoving`; przywrócona dwustronna bramka `isBusy = isUploading || isRemoving` na `onAdd` / `onRemove` / `onRemoveAll` / „Dodaj pliki". `useMediaRemoval` oddaje `isRemoving` osobno od `removalConfirm.pending`, bo Radix zamyka alert na klik — to powierzchnia, nie dialog, musi wstrzymać drugie usunięcie
      test: test-driven-debugging · unit (dom) — `investment-assets.test.tsx` „offers no removal while an upload is in flight" (brak „Usuń" i „Dodaj kolejne")
- [x] 🟡 WARNING · fixed · impl-review F1 · `src/components/investments/investment-assets.tsx:69` · `onAdd` w stopce podglądu bramkowane tą samą flagą
      test: test-driven-debugging · unit (dom) — rozszerzony spec „w trakcie uploadu"
- [x] 🟡 WARNING · fixed · impl-review F3 · `plan.md` · komenda weryfikacji fazy 1 celowała w nieistniejący `src/__tests__/components/dialogs`, więc ścieżka faktur po przejściu na `useMediaRemoval` nie miała testu; dopisany spec + sprostowana linia Progress 1.1
      test: TDD · unit (dom) — `src/__tests__/components/transfers/invoice-cell.test.tsx` (domyślne etykiety faktury, wording confirmu, wywołanie akcji)
- [x] 🟡 WARNING · fixed · impl-review F4 · `src/hooks/use-media-removal.ts:11` · `description` wróciło do `MediaRemovalLabelsT` i do obu presetów — Blob nie ma undelete, więc „bezpowrotnie" musi paść pod pytaniem
      test: unit (dom) — asercja `/bezpowrotnie/` w obu specach
- [x] fixed · impl-review F6 · `src/components/media/media-strip.tsx` · `onRemove` / `removeDisabled` skasowane (nikt ich nie podaje po wycięciu strip-a z inwestycji) wraz z fałszywym komentarzem w `lead-answers-dialog.tsx`; `emptyText` ZOSTAJE — jedyny konsument dalej je podaje. Kasacja bramkowana `pnpm typecheck`
- [x] fixed · impl-review F9 · `context/foundation/manual-checks.md` · manual check rozbity na „przy 2+ plikach" i „przy jednym pliku", bo bramka `visibleFiles.length > 1` czytałaby się jako porażka
- [x] fixed · impl-review F10 · `plan.md` · addendum o `src/types/media.ts` i `components/media/preview-labels.ts` — dwa moduły spoza „Changes Required", wymuszone kierunkiem importu
- [x] dismissed · impl-review F10 · `invoice-preview-dialog.tsx:21` · `PreviewLabelsT` urósł o cztery **wymagane** pola — to celowe: wymuszenie własnego wordingu jest całą poprawką, opcjonalne pola z domyślką faktury cicho przywróciłyby błąd
- [x] skipped · impl-review F8 · `investment-assets.tsx:77` · usuwanie jest ukrywane, nie wyszarzane (dialog renderuje przyciski warunkowo od handlerów) — plan mówi „nieaktywne", efekt jest ten sam, a dorabianie `disabled` do stopki poszerza kontrakt dialogu na czystą afordancję
- [x] dropped · impl-review F5 / code-review · `investment-form.tsx` · drugie zgłoszenie wykluczających się propów — nieosiągalne, patrz niżej
- [x] 🟡 WARNING · fixed · code-review · `src/hooks/use-media-removal.ts:43` · `isLast` było zamrożone w chwili staged. Przeniesienie liczenia do `run()` NIE wystarczy (`run` to domknięcie z tego samego renderu) — doszedł `removedIdsRef`, z którego `run` czyta stan na moment rozwiązania
      test: unit (dom) — pokryte pośrednio; przeplot dwóch usunięć zostaje przy EX-832 (ta sama klasa wyścigu, tam ma sens jako integracja)
- [x] 🟡 WARNING · fixed · code-review · `src/hooks/use-media-removal.ts:66` · toast sukcesu wrócił jako **opcjonalny** `labels.success` — inwestycje go mają, faktury świadomie nie (nie dokładamy nowego toastu na powierzchni, która go nigdy nie miała). `router.refresh()` niepotrzebny: `protectedAction` → `updateTag` z `expire: 0` sam re-renderuje trasę wywołującą
      test: unit (dom) — pokryte asercją na wywołanie akcji; sam toast idzie przez `toastMessage`, nie przez DOM tej powierzchni
- [x] 🟡 WARNING · skipped · code-review · `src/lib/actions/investment-assets.ts:37` · `removeAllInvestmentAssetsAction` pisze `() => []` ignorując `currentIds` — ten sam korzeń co 🔴 #1, naprawa razem z serializacją; dyspozycja w EX-832
- [x] 🔵 OBSERVATION · dropped · code-review · `investment-form.tsx:33` · `collectAssets` i `assetsInvestmentId` udokumentowane jako wykluczające się, ale typ na to pozwala — nieosiągalne (jedyny consumer podaje jeden), unia dyskryminowana to czysta kosmetyka typów
- [x] fixed · code-review · `src/components/investments/investment-assets.tsx:21` · „ostatni plik" czytało się jako „ostatnio dodany" → „To jedyny plik tej inwestycji."
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/queries/investment-assets.ts:37` · `thumbnailUrl` nieczytany na tej powierzchni po wycięciu `MediaStrip` — pole jest częścią wspólnego `MediaFileT`, wycinanie go z zapytania nic nie oszczędza
- [x] fixed · code-review · `investment-assets.test.tsx`, `investment-assets-field.test.tsx` · `beforeEach` z `clearAllMocks` + resetem `isUploading`; przy okazji martwy mock `next/navigation` w specu pola
- [x] fixed · scatter · `src/types/media.ts` · `PreviewLabelsT` awansował obok `MediaFileT` — `components/media/` nie sięga już w górę do `components/dialogs/`
- [x] fixed · cohesion/scatter · `src/components/media/preview-labels.ts` · `INVOICE_PREVIEW_LABELS` dołączył do bliźniaka; dialog faktury bierze go jako domyślkę
- [x] dropped · scatter · `src/hooks/use-invoice-removal.ts:10`, `src/components/investments/investment-assets.tsx:19` · presety usuwania w dwóch idiomach — oba jednokonsumenckie, kolokacja jest zgodna z regułą licznika konsumentów; przenoszenie ich teraz łamałoby ją w drugą stronę
- [x] filed EX-826 · scatter · `src/components/dialogs/invoice-*.tsx` · cała czwórka podglądu/uploadu jest już generyczna, ale nosi nazwę `invoice-` i leży w `dialogs/` zamiast `media/` — rename+move po ~15 import sites, refaktor na własny review
- [x] filed EX-826 · scatter · `src/lib/invoices/{ingest-files,ingest-picked-files,blocked-files-message}` · generyczny ingest bajtów pod nazwą faktur; `use-media-upload` ciągnie go do zdjęć inwestycji — przenieść do `src/lib/media/`, ~10 import sites
- [x] dismissed · feature-first · `src/hooks/use-media-removal.ts`, `forms/investment-form/investment-assets-field.tsx` · oba nowe pliki wylądowały w domach, które reguła przewiduje (licznik katalogów-konsumentów); zero nowych/konkurencyjnych domów
- [x] dismissed · module-cohesion · `invoice-preview-trigger.tsx:5` · `InvoicePreviewTriggerPropsT` jest eksportowany, bo `invoice-preview-button.tsx` robi z niego `Pick` — kolokowany typ kontraktu, nie off-topic export
- [x] dismissed · tailwind-v4 · diff · 0 findings; `h-[70vh]` w `invoice-preview-dialog.tsx` jest pre-existing i zgodne z idiomem repo, jedyna klasa responsywna w diffie (`sm:max-w-sm`) trafia w nadpisaną skalę
- [x] fixed · comment-noise · `invoice-preview-{dialog,button,trigger}.tsx`, `invoice-upload-dialog.tsx` · refren „defaults to the faktura wording; photos share it" powtórzony 5× — zostało jedno zdanie w `preview-labels.ts`
- [x] fixed · comment-noise · `lib/actions/investment-assets.ts`, `use-invoice-removal.ts`, `edit-investment-dialog.tsx`, oba specy · komentarze restytuujące kod / listy konsumentów — skasowane
- [x] fixed · comment-noise · `use-media-removal.ts`, `investment-assets.tsx`, `invoice-preview-dialog.tsx`, `investment-form.tsx` · przycięte do samego „dlaczego" (wyścig read-modify-write, klamrowanie pagera, optymistyczny zbiór)
- [x] dropped · comment-noise · `invoice-preview-trigger.tsx:10`, `investment-form.tsx:29,31` · pre-existing narracja stylu/propów poza diffem tego slice'a — nie wchodzę tam przy okazji
- [x] dismissed · comment-noise · `invoice-preview-dialog.tsx`, `invoice-preview-button.tsx` · zewnętrzne zachowania (opaque origin przy druku, `blob:` w `next/image`, natywny podgląd PDF, kompresja w ingeście) — nieweryfikowalne z kodu, zostają
- [x] dropped · tailwind-v4 · repo · brak pluginu ESLint świadomego Tailwinda i brak `eslint.config.*` w korzeniu — ~198 wartości `[...]` bez kontroli CI; poza slice'em i poza diffem

- [x] fixed · simplify/altitude · `src/hooks/use-media-removal.ts:26,71` · `staged` trzymało gotowe domknięcie `run`, zbudowane w chwili kliku — źródło całej klasy nieświeżych odczytów. Teraz trzyma **intencję** (`{ title, fileId?, closePreview }`), a `runStaged` czyta aktualne propy. `removedIdsRef` ZOSTAJE (wbrew osi simplification): przeplot dwóch usunięć jest osiągalny na powierzchni faktur, która nie bramkuje `isRemoving` — to nie jest patch pod patch, tylko jedyne źródło prawdy po rozwiązaniu akcji
- [x] fixed · simplify/efficiency · `src/hooks/use-media-removal.ts:86` · `files.filter(...).length === 0` → `files.every(...)`; budowanie zbioru po usunięciu wszystkiego przez jeden `markRemoved` zamiast `map`+`filter`+`new Set`
- [x] fixed · reuse · `src/hooks/use-investment-assets-upload.ts` · wiązanie `useMediaUpload` + `'Pliki dodane'` + tytuł dialogu były przepisane w dwóch katalogach — jeden wrapper (bliźniak `use-invoice-upload.ts`), tytuł jako `INVESTMENT_ASSETS_UPLOAD_TITLE`
- [x] fixed · reuse/simplify · `src/components/media/media-strip.tsx:23` · `emptyText` dublowało `labels.empty` i było **nieosiągalne** — jedyny konsument bramkuje `assets.length > 0`; prop i cała gałąź skasowane (to koryguje wcześniejsze „emptyText zostaje" z F6)
- [x] fixed · simplify · `src/hooks/use-invoice-removal.ts:19` · przepisywanie pól po jednym (`isRemoving` i tak bez konsumenta) → `{ visibleFiles, ...removal }`
- [x] fixed · simplify · `src/components/investments/investment-assets.tsx:54` · ciało funkcji w ternarnym w JSX → wyniesione `openUpload`, bramka przez referencję jak dwie linijki niżej
- [x] filed EX-834 · reuse · `src/lib/actions/investment-assets.ts` · trzy akcje to kopia bliźniaków z `transfers.ts` (~45 linii, razem ze skopiowanym komentarzem) — trzy helpery w `lib/media/`; dotyka gorących akcji faktur, więc własny review
- [x] filed EX-833 · efficiency · `src/lib/media/delete-unreferenced-media.ts` · do 6N sekwencyjnych zapytań; „Usuń wszystkie" w galerii to pierwszy konsument z dużym N
- [x] filed EX-835 · altitude · `src/components/ui/confirm-dialog.tsx` · `pending`/`pendingLabel` nigdy się nie renderują (Radix zamyka alert na klik) — naprawa zmienia zachowanie wspólnego prymitywu w całej aplikacji
- [x] skipped · altitude · `invoice-preview-dialog.tsx:34`, `invoice-preview-button.tsx:15` · `labels` z domyślką faktury osłabia kontrakt „wszystkie pola wymagane"; wymuszenie jawnego przekazania to 5 obcych call site'ów dla niuansu, który znika razem z rename'em w EX-826
- [x] skipped · altitude/reuse · `investment-assets.tsx` vs `investment-assets-field.tsx` · wspólny `MediaUploadButton` (stan + hak + przycisk + dialog) — po wyniesieniu haka zostaje różniący się chrome (spinner w nagłówku vs w przycisku, `section` vs `Field`); ekstrakcja komponentu to osobny refaktor
- [x] dropped · altitude · `invoice-preview-button.tsx` · `label`/`ariaLabel`/`labels` jako trzy osobne furtki zamiast jednego słownika — to ten sam wątek co EX-826, nie warto opisywać drugi raz
- [x] dismissed · reuse · oba specy DOM · zduplikowany mock `use-media-upload` — `vi.mock` jest hoistowany per plik, wspólny helper i tak nie przechodzi
- [x] dismissed · simplify · `media-strip.tsx` · inline'owanie `labels`/`sizes` przy jednym konsumencie — `sizes` MUSI zostać propem kalkulowanym przez wołającego (reguła `next/image`), a `labels` trzyma wording z dala od faktur

- [x] 🔴 CRITICAL · fixed · suite · `src/lib/media/set-upload-field.ts:46` · `appendUploadIds` odsiewało duplikaty tylko względem listy JUŻ zapisanej, więc ten sam `mediaId` dwa razy w jednej paczce wchodził dwukrotnie — regresja z `1a4f40df` (`setUploadField` zastąpiło bliźniacze `setTransferInvoices`, gubiąc dedup wewnątrz paczki). Teraz `new Set([...current, ...mediaIds])`; dotyczy tak samo faktur jak galerii inwestycji
      test: brak nowego — istniejący `transfer-actions.test.ts > the same id twice in one batch attaches one page` złapał regresję i zostaje strażnikiem
- [x] 🟡 WARNING · fixed · suite · `src/__tests__/hooks/prevent-delete.test.ts:12` · spec stubował `payload.find`, a strażnik woła `payload.count` od `1a4f40df` — `TypeError` zamiast asercji, czyli test nie pilnował już niczego
      test: unit — poprawiony stub jest samym strażnikiem
- [x] 🟡 WARNING · fixed · suite · `src/__tests__/hooks/media/prevent-referenced-delete.test.ts:12` · ten sam martwy stub `find` → `count`; w tym również `it.each(MEDIA_RELATIONS)`, czyli sprawdzenie, że każda relacja jest naprawdę sondowana
      test: unit — poprawiony stub jest samym strażnikiem
- [x] dropped · suite · `src/__tests__/components/forms/inspection-form/inspection-form.test.tsx:102` · jedna noga „nie rusza terminu" padła w pierwszym pełnym przebiegu i przeszła w izolacji oraz w dwóch kolejnych pełnych — flake timingowy, niezwiązany ze slice'em; bez powtarzalności nie ma czego zgłaszać

## Simplify pass

`/simplify` — 4 osie (reuse, simplification, efficiency, altitude), 6 zastosowanych, 3 zgłoszone do
Lineara (EX-833/834/835), 2 pominięte, 3 odrzucone; wszystko wpięte w `## Findings` powyżej z tagiem
`simplify`. Bez osobnego raportu — ledger jest raportem.

## Tests & suite

- `pnpm typecheck` — zielony
- `pnpm lint` — 0 błędów (83 ostrzeżenia, wszystkie zastane, w `src/migrations/*`)
- `pnpm vitest run` (node + dom) — **308 plików / 3711 testów zielonych**, 71 plików / 308 testów pominiętych. Pierwszy przebieg padł na 4 plikach; trzy to realne findingi wyżej, czwarty to flake
- `pnpm test:e2e` — **nie uruchamiane** (zasada: nigdy bez wyraźnej prośby)
- E2E: slice nie zaciąga nowego długu Playwrightowego. Ryzyko jest w całości przeglądarkowe, ale mieści się w warstwie DOM i jest tam pokryte (`investment-assets.test.tsx`, `invoice-cell.test.tsx`, `investment-assets-field.test.tsx` — 11 testów): pusty stan, bramka `isBusy`, treść potwierdzenia, wording faktury vs pliku. Jedyna oś, która naprawdę przecina klient → server action → DB → rewalidację, to wyścig upload/usuwanie, a ten jest zgłoszony jako **EX-832** z dyspozycją testu integracyjnego — czyli obowiązek E2E jest zamknięty przez tamto issue, nie przez notkę w commicie
