# Review-gate ledger — kosztorys-editor-assets · 2026-09-22

Zakres: `staging...HEAD` (3 commity: `495816eb`, `b1be6168`, `51da2030`) plus zmiany bramki
w drzewie roboczym. Krok 0.5 (przebieg weryfikacyjny w przeglądarce) pominięty — projekt nie ma
skilla `verify-manual-checks`, a ręczne sprawdzenia żyją w `context/foundation/manual-checks.md`.

Fan-out (krok 1, read-only, równolegle): `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`,
`feature-first-structure`, `comment-noise-audit`, `primitive-reuse-scan`.
Krok 2 (`/simplify`, mutujący): 4 agenci — reuse / simplification / efficiency / altitude.

## Findings

_Przycięte przy archiwizacji (2026-09-23): wypadło 8 pozycji `fixed`. Trwałym zapisem naprawy jest jej commit; tu zostaje negatyw, którego git nie trzyma — to, czego świadomie **nie** zrobiono i dlaczego. Bilans sprzed przycięcia: 8 fixed, 5 dismissed, 4 filed, 1 dropped · 0 otwartych._

- [x] · filed EX-862 · `code-review` · `src/components/investments/investment-assets-control.tsx:72` ·
      „Usuń wszystkie" stoi teraz w rzędzie narzędzi siatki edytora — jedyna nieodwracalna akcja
      wśród odwracalnych, a Blob nie ma undelete; żyje też na inwestycji „Zakończona", gdzie każdy
      inny zapis jest zdjęty. **Decyzja produktowa właściciela, nie moja** — świadomie nie
      zastosowane automatycznie (reguła: finding zmieniający to, co użytkownik MOŻE zrobić, jest
      zgłaszany, nie wdrażany). Skrzynka zostaje otwarta do rozstrzygnięcia.
      test: no automated test — to pytanie o zakres afordancji, nie o poprawność.
      2026-09-22: kontrolka przeniosła się z rzędu narzędzi siatki do zakładki „Inwestycja"
      (`zakladka-inwestycja-w-panelu`), więc nie sąsiaduje już z akcjami odwracalnymi — ale jest
      dalej osiągalna z edytora i dalej na inwestycji „Zakończona". Pytanie stoi.
      2026-09-23: zgłoszone jako **EX-862** przy archiwizacji — rozstrzygnięcie należy do
      właściciela, a `kosz-plikow` może je unieważnić, zdejmując nieodwracalność u źródła.

- [x] filed EX-850 · `code-review` · `src/lib/actions/investment-assets.ts` ·
      podwójny render trasy edytora po mutacji assetu: `updateTag('collection:investments')`
      renderuje trasę wywołującą, a klient dokłada `router.refresh()` — siedem zapytań, w tym
      niecache'owany `getKosztorysTree`, płacone dwa razy za jedno zdjęcie. Nie naprawione tutaj:
      dotyka też tego, co widzi karta inwestycji, a hooki mediów dzielą się z fakturami transferów.

- [x] filed EX-849 · `simplify/efficiency` · `src/lib/queries/investment-assets.ts:42` ·
      wpis cache assetów tagowany kolekcyjnie, więc każdy zapis ustawień kosztorysu eksmituje
      galerie WSZYSTKICH 65 inwestycji, a od tego slice'a kosztuje trasę edytora dodatkowy
      round-trip. **Stan preegzystujący** — plik nie jest w diffie, slice dołożył tylko drugiego
      czytelnika. Nie naprawione tutaj: zawężenie tagu wymaga zmiany kontraktu `protectedAction`,
      współdzielonego przez wszystkie akcje.

- [x] filed EX-848 · `slice-review-gate/step-3` · E2E, którego slice jest winien ·
      druga powierzchnia zapisująca `investments.assets`; ryzyko przecina klient → server action →
      `setUploadField` → Blob → rewalidacja → render trasy, czego warstwa DOM nie widzi. Odroczone
      **i zgłoszone** (label `e2e-backlog`), nie zdjęte notką w commicie.

- [x] dropped · `simplify/reuse` + `primitive-reuse-scan` + `simplify/altitude` (zbieżnie) ·
      `src/components/transfers/invoice-cell.tsx:18-70` · strukturalny bliźniak
      `InvestmentAssetsControl` (ten sam szkielet, verbatim identyczny `openUpload` z komentarzem).
      Duplikacja **poprzedza slice po obu stronach** — diff tylko przeniósł jedną z dwóch kopii.
      Zwinięcie ich w jedno to przegląd-wart refaktor cudzego kodu; zgłoszenie go byłoby produkcją
      backlogu, nie znalezieniem długu tej zmiany.

- [x] dismissed · `primitive-reuse-scan` ·
      `src/__tests__/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.test.tsx:33-81` ·
      45-polowy stub `as unknown as` kontra wąski `vi.mock` modułu kontekstu u sąsiadów
      (`kosztorys-active-filters-bar.test.tsx`, `menus/kosztorys-actions-menu.test.tsx`). Liczba pól
      wynika z PRZEDMIOTU, nie ze stylu stubowania: sąsiedzi renderują JEDNO menu, ten spec renderuje
      całe drzewo toolbara, którego każda kontrolka czyta ten sam kontekst — `vi.mock` musiałby
      dostarczyć tyle samo pól. Prawdziwy `KosztorysEditorProvider` jest przy tym wierniejszy niż
      podmiana modułu. Bez zmian.

- [x] dismissed · `simplify/altitude` · `src/lib/kosztorys/types.ts:178-181` ·
      podejrzenie, że `assets?: MediaFileT[]` przeciąża opcjonalność („powierzchnia bez galerii"
      kontra „inwestycja bez plików"). Nie bije: oba odczyty renderują się inaczej i oba są
      przypięte specem toolbara (`undefined` → nic się nie montuje, `[]` → pusty stan z przyciskiem),
      a pole tuż wyżej — `workCatalogue?` — niesie identyczną semantykę bez dwuznaczności.

- [x] dismissed · `simplify/efficiency` ·
      `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:60-76` · assety podnoszą podłogę
      TTFB z `max(6 zapytań)` na `max(7)`. `Promise.all` jest poprawne (żadnej sekwencyjności),
      a zapytanie to join dwóch tabel po `parent_id` — powinno przegrać wyścig z `getKosztorysTree`.
      Streamowanie przez `use()` + `<Suspense>` dopiero gdy log `[PERF]` pokaże inaczej.

- [x] dismissed · `simplify/altitude` + `simplify/reuse` ·
      `src/components/investments/investment-assets-control.tsx` · ekstrakcja na właściwej wysokości:
      kontrolka jest domenowa (akcje serwerowe inwestycji, `ASSET_REMOVAL_LABELS`), więc `ui/` byłby
      błędem, a import z toolbara kosztorysu to feature→feature po danych INWESTYCJI, nie inwersja
      warstw. Nic pod `ui/` nie sięga w górę w efekcie tej zmiany.

- [x] dismissed · `tailwind-v4-audit` · brak wzorców pre-v4 w diffie (żadnych `var(--x)` w `[...]`,
      żadnego inline `style`, breakpointy zgodne z nadpisaną skalą 768/1024/1280).

## Simplify pass

`Ran /simplify — 4 applied, 0 proposed, 4 dismissed, 1 filed (EX-849), 1 dropped;`
każdy finding wpięty wyżej w `## Findings` ze znacznikiem źródła `simplify/<angle>`.
Osobnego raportu nie ma — bramka trzyma jedną listę (tak nakazuje skill).

Angle **reuse** wrócił czysty: nic w slice'ie nie przepisuje istniejącego helpera, a
`UploadButton` wypełnia prawdziwą lukę (repo nie ma generycznego loading-buttona —
`AuthSubmitButton` jest submit-only, `ConfirmDialog`/`DialogActions` trzymają własny `pending`).

## Tests & suite

- Bramka całego drzewa przed wejściem w gate: `typecheck` ✓, `lint` ✓ (0 błędów, 84 preegzystujące
  ostrzeżenia w `src/migrations/*.ts`), `test` ✓ (3812 zielonych), `build` ✓.
- Po poprawkach bramki: `typecheck` ✓; DOM-owe specy dotknięte zmianami — 3 pliki / 12 testów ✓
  (`upload-button`, `investment-assets-control`, `kosztorys-editor-toolbar`).
- Pełny przebieg suite po `/simplify` — **nie uruchomiony**, czeka na decyzję użytkownika.
- E2E — **nie uruchomione** (~1h); obowiązek zgłoszony jako EX-848.

## Stan bramki archiwizacji

**Slice jest `in review`, NIE `done`.** `context/foundation/manual-checks.md` niesie dla tej zmiany
**10 nieodhaczonych** sprawdzeń ręcznych, a ręczne sprawdzenia są twardym blokerem `Done`.
Nie archiwizować.
