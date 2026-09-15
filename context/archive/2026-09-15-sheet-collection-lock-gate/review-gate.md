# Review-gate ledger — całe drzewo robocze · 2026-09-15

Zakres poszerzony na życzenie użytkownika: **wszystkie otwarte zmiany**, nie tylko EX-770.
Drzewo trzyma dwa niezależne strumienie:

- **A — EX-770** (ta sesja): `src/access/investment-lock.ts`, pięć kolekcji kosztorysu, dwa specy.
- **B — przebieg QA manual-checks** (sesja równoległa `wykonczymy-15`): `context/foundation/manual-checks.md`
  plus poprawki, które ten dokument opisuje — `lib/nav/` + `use-history-back.ts`, `layout.tsx` (`min-w-0`),
  `lib/fleet/inspection-draft.ts` + `add-inspection-dialog.tsx`, `lib/kosztorys/empty-grid-copy.ts` +
  `kosztorys-editor-body.tsx`, trzy dialogi edytora + dwa nowe komponenty not, `hooks/transfers/validate.ts`,
  `src/scripts/qa-gate-reset-preview.ts`.

Baza porównania: `01079b21` (staging). Pliki nieśledzone czytane wprost — `git diff` ich nie pokazuje.

`/10x-impl-review` odpada: żaden ze strumieni nie ma `plan.md`.

## Findings

_Przycięte przy archiwizacji (2026-09-15)._ Bilans przed przycięciem: **25 fixed, 17 dismissed,
5 dropped, 4 skipped · 0 otwartych**. Findingi `fixed` wycięto — ich trwałym zapisem jest commit,
a naprawiony kod daje się przeczytać. Zostaje negatywna przestrzeń, której git nie trzyma: co
uznano za nieszkodliwe, co odpuszczono i dlaczego, oraz co jest realne, ale świadomie nietknięte.

<!-- tailwind-v4-audit -->

- [x] dismissed · tailwind · `src/app/(frontend)/layout.tsx:66` · `min-w-0` na kolumnie powłoki —
      poprawne, idiomatyczne i na właściwym poziomie (to ta kolumna puchła i ciągnęła przyklejony pasek).
- [x] dropped · tailwind · `eslint.config.mjs` · brak wtyczki ESLint świadomej Tailwinda — luka
      całego repo, nie tego drzewa; ten sam finding odrzucono już przy bramce EX-748.
- [x] dismissed · tailwind · reszta zgłoszeń grup A/B/C dotyczy kodu **zastanego**, nietkniętego przez
      te zmiany (`ToastContainer` z-index, `style={{left: guideX}}` przy przeciąganiu, `h-[calc(...)]`
      z `lg:` sparowanym z `app-footer.tsx:25` — to nie jest dryf skali breakpointów). Dwa nowe
      komponenty not nie mają ani jednego `className`.

<!-- simplify: reuse / simplification / efficiency / altitude -->

- [x] skipped · simplify · `src/collections/{kosztorys-items,kosztorys-sections,kosztorys-stages,stage-progress}.ts` ·
      helper `investmentLockedWrites(base, owner)` zwijający trójkę `create`/`update`/`delete` — kusi,
      ale te cztery kolekcje mają **celowo** węższą bramkę `update` (tylko stan zapisany) niż `sheets`,
      a helper albo tę rozbieżność ukrywa, albo musi pomijać `update` i przestaje być helperem.
      Decyzja o poszerzeniu należy do właściciela, nie do findingu.
- [x] skipped · simplify · `src/lib/kosztorys/empty-grid-copy.ts:42` · zwracanie `null` przy „nic nie
      zaangażowane" i przeniesienie bramy istnienia nakładki do modułu — realne uproszczenie, ale
      zmienia to, co widzi klient, gdy żaden hider nie jest włączony. Zmiana zachowania, nie sprzątanie.
- [x] dropped · simplify · `src/lib/fleet/inspection-draft.ts` · sześć sąsiednich dialogów liczy swoje
      `formId` inline, ten jeden dostał moduł w `lib/` ze specem. Realne, ale to plik strumienia QA
      i stawka jest zerowa.
- [x] dropped · simplify · `sheet-missing-columns-block.tsx:24` · `filter(!required)` to ręczne
      dopełnienie `requiredFields()` z `sheet-column-picker-options.ts`. Jedna linia, jeden konsument.
- [x] dismissed · simplify · `src/scripts/qa-gate-reset-preview.ts` · nagłówek mówi „THROWAWAY … do not
      commit", a plik leży w drzewie — ale to plik sesji równoległej i to ona decyduje, czy go zostawia;
      strażnik `assertPreviewDb()` już wszedł wyżej w tym rejestrze.
- [x] dismissed · simplify · `in-app-history.ts:28` (`navigation === undefined ||` zawężające typ),
      `sheet-{missing,pointed}-columns-block.tsx` (`pointed={[]}` / `missing={[]}` — różny `status`
      jest powodem podziału), bootstrap `getPayload`/`vi.mock('server-only')` powielony w ~30 specach
      (dług całego repo, własna zmiana) · sprawdzone, nic realnego.

<!-- primitive-reuse-scan (Step 2 — dopasowanie nowego kodu do katalogu prymitywów) -->

- [x] dismissed · reuse-scan · `src/components/kosztorys/editor/dialogs/sheet-missing-columns-block.tsx:24` ·
      Inline `missingFields.filter((c) => !c.required)` obok istniejącego `isOptionalField`
      (`src/lib/kosztorys/sheet-import/columns.ts:76`) — nie reimplementacja: `required` jest USTAWIANE
      jako `!isOptionalField(field)` (`resolve-columns.ts:121`), więc odczyt gotowej flagi to ta sama
      odpowiedź krótszą drogą.
- [x] dropped · reuse-scan · `sheet-missing-columns-block.tsx:24` · `requiredFields`
      (`sheet-column-picker-options.ts:11`) liczy dopełnienie, ale zwraca gołe `ColumnFieldT[]`, a blok
      potrzebuje pełnych `MissingFieldT[]` do liczby i etykiet — nit rozmieszczenia, nie duplikat.
- [x] dismissed · reuse-scan · `sheet-missing-columns-block.tsx:26` · Sklejanie `„etykieta", „etykieta"`
      obok `listLabels` (`row-conditions/queries.ts:59`) — inny typ wejścia (`RowConditionT`) i inny
      spójnik („i"/„ani" zamiast przecinków).
- [x] dropped · reuse-scan · `sheet-missing-columns-block.tsx` / `sheet-pointed-columns-block.tsx` /
      `sheet-import-dialog.tsx:225` · Trzy instancje kształtu „`SheetReportBlock` + `SheetColumnPicker`".
      Parametryzacja wzięłaby tyle propsów, ile usuwa kodu, a kopia w oknie importu wozi dodatkowo
      `ReportTable` na innym typie (`ImportReportT['missingColumns']`). Ekstrakcja, która miała sens,
      już wcześniej wylądowała: `SheetPointedColumnsBlock` dzielą teraz oba okna.
- [x] dismissed · reuse-scan · `src/lib/fleet/inspection-draft.ts:8` · `formId` per pojazd — repo nie
      eksportuje takiego prymitywu; inline'owy szablon (`recipient-list-card.tsx:41`) to konwencja,
      nie prymityw, a ten wariant ma własny spec.
- [x] dismissed · reuse-scan · `src/lib/nav/in-app-history.ts:22`, `src/components/ui/use-history-back.ts:9` ·
      Brak wcześniejszego prymitywu: nic innego w `src` nie woła `router.back()` ani nie czyta
      `window.history.length`. `useHistoryBack` już istniał i został tylko przepięty.
- [x] dismissed · reuse-scan · `src/lib/kosztorys/empty-grid-copy.ts:22` · Już deleguje do `EmptyState`
      i `listLabels` — zwraca treść, prymityw ją renderuje.
- [x] dismissed · reuse-scan · `src/access/investment-lock.ts:44` · `updateUnlessInvestmentLocked`
      składa dwa istniejące eksporty z tego samego pliku i korzysta z `resolveId` oraz
      `isInvestmentLocked` / `isRelatedInvestmentLocked` (`src/lib/db/investment-lock.ts:24,55`).

## Simplify pass

Ran /simplify — 8 applied, 2 skipped, 2 dropped, 3 dismissed; każdy finding wpięty w `## Findings`
(tag `simplify`). Cztery agenty (reuse / simplification / efficiency / altitude) na całym drzewie
względem `01079b21`.

Ran primitive-reuse-scan — 0 potwierdzonych trafień, 8 odrzuconych po weryfikacji przy źródle
(tag `reuse-scan`). Homes z `.reuse-scan.json`.

## Tests & suite

- `pnpm typecheck` — zielony.
- `pnpm lint` — 0 błędów, 83 ostrzeżenia (wszystkie zastane: nieużywane argumenty w `src/migrations/**`).
- `pnpm test` — 3391 przeszło, 295 pominiętych (specy DB bez `ENV_READY`), 0 nieudanych.
- `pnpm test:integration` (kontener 5435) — 65 plików, 292 testy, komplet zielony; tu biegną nowe
  specy `sheets-investment-lock.db.test.ts` i oba `invoice-on-*.db.test.ts`.
- `pnpm build` — zielony.
- `pnpm test:e2e` — **nieuruchamiany.** Slice nie dokłada powierzchni przeglądarkowej: EX-770 zamyka
  regułę `access` w `/admin` (pokryte specem DB na trwałym stanie), a naprawa „Wróć" ma spec
  jednostkowy na predykacie. Reszta drzewa to treść komunikatów i fixture'y specy.

<!-- feature-first-structure / module-cohesion-audit / structure-scatter-audit -->

- [x] skipped · module-cohesion · `src/components/kosztorys/editor/kosztorys-editor-body.tsx:85` ·
      597 linii za jednym eksportem, 13 `useMemo` w trzech klastrach; czysty szew (klaster pomiaru
      wierszy → `editor/hooks/`) jest nazwany wprost w AGENTS.md. **Zastane, a te zmiany plik
      SKRACAJĄ** (wyciągnięcie `emptyGridCopy`, −11 linii netto). Refaktor wart własnego review.
- [x] dropped · structure-scatter · `src/components/kosztorys/editor/dialogs/` · 30 plików płasko,
      trzy rodzaje, zero podkatalogów — jedyne niepodzielone dziecko `editor/`. Zastane; te zmiany
      dokładają dwa pliki. Podział w miejscu (podkatalog `sheet/` wchłonąłby 11 plików) to osobna robota.
- [x] dismissed · feature-first · `src/lib/nav/` · Nowy tier uzasadniony — `nav` to oś istniejąca już
      po stronie komponentów (`src/components/nav/`), a jednoplikowe `src/lib/<obszar>/` ma precedens
      (`src/lib/cron/`). `use-history-back.ts` słusznie zostaje w `components/ui/` (jeden katalog
      konsumenta, zero domeny) — wyniesienie predykatu do `lib/` to dokładnie szew z AGENTS.md.
- [x] dismissed · structure-scatter · `src/__tests__/collections/sheets-investment-lock.db.test.ts` ·
      Mirror ustalony (trzy specy `*-delete-guard` już tam stoją), a marker `skipIf(!ENV_READY)` jest
      na miejscu, więc `scripts/test-integration.sh` faktycznie ten spec znajdzie.

<!-- comment-noise-audit (flag-only) -->

- [x] dismissed · comment-noise · 13 komentarzy zgłoszonych jako „keep" — m.in. `layout.tsx:61`
      (`min-w-0` + reguła przeglądarki + objaw), `in-app-history.ts:1` (dlaczego typ jest ręczny),
      `in-app-history.test.ts:48` (dlaczego świadomie błędna heurystyka zostaje dla starych przeglądarek),
      `pointed-columns-note.tsx:11` (dlaczego `status="ok"` obok siostrzanego `warn`). Zostają bez zmian.
- [x] dropped · comment-noise · Polskie terminy domenowe wplecione w angielskie zdania komentarzy
      (`zakończona inwestycja` w `sheets.ts:32` i w specu). Nazwa statusu, nie tłumaczenie identyfikatora —
      reguła rejestru to dopuszcza; przepisywanie na „completed investment" nic nie kupuje.

<!-- code-review: strumień EX-770 -->

- [x] dismissed · code-review · `await base(args)` w `createUnlessInvestmentLocked` · bez zmiany
      zachowania — `AccessResult` to `boolean | Where`, a `Where` nie ma `then`, więc `await` jest
      tożsamością plus jeden mikrotask. Wszystkie pięć wpięć podaje reguły synchroniczne.
- [x] dismissed · code-review · kolejność `beforeDelete` przed odczytem dokumentu pod `Where` · realna
      (`deleteByID.js:43` vs `:67`), ale `kosztoryses` nie deklaruje `beforeDelete`, a kaskady idą pod
      Payloadem (`ON DELETE SET NULL`). Nic się na tej kolejności nie opiera.
- [x] dismissed · code-review · NULL + `not_equals` · przeliczone ze źródła po raz drugi i trzyma:
      `parseParams.js:225-227` daje `or(isNull(col), ne(col, val))`, a złączenie relacji jest LEFT JOINem
      w każdej ścieżce — find, `deleteOne`, paginacja, licznik listy w panelu, `entityDocExists`
      (bramkuje przycisk „Save") i `deleteMany`. Żadna operacja nie odstaje. Asymetria warta komentarza,
      który już w pliku stoi: `not_in` tak NIE działa.

<!-- code-review: strumień QA -->

- [x] 🟡 WARNING · **dismissed — finding obalony** · code-review · `src/hooks/transfers/validate.ts:87` · Strażnik CANCELLATION
      czyta `d.cancelledTransaction` zamiast `resolved('cancelledTransaction')`, więc **częściowy zapis
      na istniejącym wierszu CANCELLATION jest odrzucany za pole, które ten wiersz od zawsze ma** —
      a diff ubiera tę fałszywą odmowę w pewne siebie publiczne zdanie. Ścieżka: `transfers.tsx:127`
      renderuje `InvoiceCell` dla każdego wiersza bez bramki na typ, więc podpięcie skanu faktury do
      anulowania woła `setTransferInvoices` z `data: { invoice: [...] }`, `type` rozwiązuje się
      z `originalDoc` na `CANCELLATION`, `d.cancelledTransaction` jest `undefined` → 400 „Cancelled
      transaction reference is required." Linia jest zastana (diff zmienił jej klasę błędu), ale to
      jedyny throw w tym hooku, który diff dotknął, a który potrafi trafić w **legalny** zapis —
      `isInvoiceOnlyPatch` tuż wyżej istnieje dokładnie po to, żeby go przepuścić.
      test: test-driven-debugging · integration — napisany i zielony:
      `src/__tests__/hooks/transfers/invoice-on-cancellation.db.test.ts`.
      **Przesłanka obalona przez ten właśnie test:** na aktualizacji przez Local API Payload scala
      zapisany dokument do `data` PRZED `beforeValidate`, więc `d.cancelledTransaction` jest obecne
      i `setTransferInvoices` nigdy nie dostawało 400. Zmiana na `resolved('cancelledTransaction')`
      zostaje mimo to — REST PATCH wysyła wyłącznie zmieniane klucze, a każde inne pole w tym hooku
      czyta się już przez `resolved`. Spec pilnuje obu kierunków plus kontrolę pozytywną (CREATE bez
      referencji nadal odmawia).
- [x] skipped · code-review · `src/lib/nav/in-app-history.ts:22-24` · „Poprzedni wpis jest tego samego
      pochodzenia" to nie to samo co „poprzedni KROK historii": `navigation.entries()` pomija wpisy
      cross-origin i zagęszcza indeksy, więc `entries()[index-1]` bywa stroną aplikacji oddaloną o dwa
      realne kroki. Scenariusz: inwestycja → obca strona w tej samej karcie → powrót do aplikacji przez
      pasek adresu → „Wróć" ląduje na obcej stronie, czyli dokładnie naprawiany defekt. Wąskie
      w praktyce (linki zewnętrzne z edytora otwierają nową kartę). Do odnotowania w kodzie, nie
      do przepisywania logiki w tym przebiegu. **Odnotowane w docblocku modułu.**
- [x] dismissed · code-review · `src/app/(frontend)/layout.tsx:66/71` · `min-w-0` jest zachowawczo
      zamknięte; jedyny skutek uboczny to kosmetyka (`w-full` rodzeństwo szerokiej treści mierzy teraz
      viewport, więc kończy się w połowie przy przewinięciu w prawo). Nic nie opierało się na starej
      podłodze min-content — zero `min-w-[…]`/`w-[1…px]` pod `components/tables` i `editor`.
- [x] dismissed · code-review · zamiana `Error` → `APIError` w `validate.ts` · nic nie połyka:
      `APIError` domyślnie ustawia `isPublic` na `status !== 500`, więc 400 przechodzi `isErrorPublic`
      i `routeError` nie przepisuje komunikatu, a że `APIError extends Error`, `toActionFailure` dalej
      podaje `err.message` bez zmian. Żaden warunek reguły się nie zmienił — tylko klasa błędu.
