# Review-gate ledger — kosztorys-editor-assets · 2026-09-22

Zakres: `staging...HEAD` (3 commity: `495816eb`, `b1be6168`, `51da2030`) plus zmiany bramki
w drzewie roboczym. Krok 0.5 (przebieg weryfikacyjny w przeglądarce) pominięty — projekt nie ma
skilla `verify-manual-checks`, a ręczne sprawdzenia żyją w `context/foundation/manual-checks.md`.

Fan-out (krok 1, read-only, równolegle): `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`,
`feature-first-structure`, `comment-noise-audit`, `primitive-reuse-scan`.
Krok 2 (`/simplify`, mutujący): 4 agenci — reuse / simplification / efficiency / altitude.

## Findings

- [ ] · surfaced · `code-review` · `src/components/investments/investment-assets-control.tsx:72` ·
      „Usuń wszystkie" stoi teraz w rzędzie narzędzi siatki edytora — jedyna nieodwracalna akcja
      wśród odwracalnych, a Blob nie ma undelete; żyje też na inwestycji „Zakończona", gdzie każdy
      inny zapis jest zdjęty. **Decyzja produktowa właściciela, nie moja** — świadomie nie
      zastosowane automatycznie (reguła: finding zmieniający to, co użytkownik MOŻE zrobić, jest
      zgłaszany, nie wdrażany). Skrzynka zostaje otwarta do rozstrzygnięcia.
      test: no automated test — to pytanie o zakres afordancji, nie o poprawność.

- [x] 🔴 CRITICAL · fixed · `code-review` · `src/components/ui/upload-button.tsx:8-12` ·
      przycisk brał jedną flagę `isUploading` i nią sterował ZARAZEM etykietą i blokadą, a galeria
      wpychała tam `isBusy` (`isUploading || isRemoving`) — więc usunięcie OSTATNIEGO pliku
      pokazywało pusty stan z napisem „Przesyłanie..." dla operacji usuwania. `markRemoved` i
      `setPending(false)` lądują w osobnych mikrotaskach (`use-media-removal.ts`), więc render
      z `visibleFiles === []` i `pending === true` naprawdę istnieje. Rozdzielone: `isUploading`
      niesie etykietę, nowy `disabled` niesie blokadę, `disabled={isUploading || disabled}` składa.
      test: test-driven-debugging · unit — `src/__tests__/components/ui/upload-button.test.tsx`,
      2 przypadki; instrument zwalidowany na czerwono przed zazielenieniem. Guard stoi na kontrakcie
      prymitywu, nie na klatce pośredniej w galerii: `act()` zbiera wszystkie mikrotaski i tę klatkę
      skleja, więc na poziomie galerii nie jest deterministycznie obserwowalna — tańsza warstwa daje
      prawdziwy sygnał, droższa nie dałaby żadnego.

- [x] 🟡 WARNING · fixed · `impl-review` · `context/foundation/manual-checks.md` ·
      wpis EX-802 twierdził naraz „zweryfikowane" i „oczekuje": zdanie przepisano pod DZISIEJSZE
      (odwrócone) zachowanie, zostawiając stary `[x]`. Przekreślone na miejscu, a roszczenie
      przeniesione — nieodhaczone — do sekcji tej zmiany.
      test: no automated test — defekt zapisu w rejestrze, nie w kodzie.

- [x] fixed · `simplify/altitude` + `simplify/simplification` (zbieżnie) ·
      `src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx:29-31` ·
      toolbar dostał kanał propsów na dane, które kontekst już wozi — a `investmentId` docierał
      DWIEMA drogami naraz (props + `useKosztorysEditorContext()` linijkę niżej). Łamało to
      zapisany kontrakt `use-kosztorys-editor-context.tsx:8-9` („KosztorysEditorBody relays none of
      it") i dawało następnej kontrolce toolbara dwa konkurencyjne precedensy. `assets` jedzie teraz
      kanałem, którym jedzie `workCatalogue`: dopisane do literału `editor={{…}}`
      (`kosztorys-editor-body.tsx`) i czytane z kontekstu. Toolbar wrócił do zera propsów.
      **Nie koliduje z EX-496**: ta reguła zakazuje przenoszenia STANU/LOGIKI hooka do providera
      z powodu churnu tożsamości wartości; ten literał i tak jest odtwarzany przy każdym renderze
      body (`...editor` + skalary), więc dodanie pola nie tworzy nowej tożsamości ani subskrybenta.
      Zweryfikowane w kodzie przed zastosowaniem, nie przyjęte na słowo agenta.

- [x] fixed · `simplify/simplification` · `src/components/investments/investment-assets.tsx` ·
      po ekstrakcji został 16-linijkowy pass-through z jednym konsumentem: dodawał wyłącznie
      `<section>` + `<h2>` i przekazywał oba propsy słowo w słowo, więc karta renderowała przez trzy
      komponenty tam, gdzie pracę robią dwa. Chrome wstawione do `InvestmentAssetsSection`, plik
      skasowany, spec przecelowany na `InvestmentAssetsControl` i przemianowany na
      `investment-assets-control.test.tsx` (reguła lustra ścieżki źródła).

- [x] fixed · `primitive-reuse-scan` · `src/components/investments/investment-assets-control.tsx:21-45` ·
      usuwanie było wpięte inline, podczas gdy konwencja repo to domenowy hook-preset
      (`src/hooks/use-invoice-removal.ts:18`) — a górna połowa TEGO slice'a już ją trzymała
      (`use-investment-assets-upload.ts`). Wyciągnięte do `src/hooks/use-investment-assets-removal.ts`
      na wzór `useInvoiceRemoval`; kontrolka straciła etykiety i dwa importy akcji.

- [x] fixed · `simplify/simplification` · `src/components/investments/investment-assets-control.tsx:57,61` ·
      `hasFiles` był aliasem jednorazowego użycia obok wpisanego inline bliźniaczego predykatu
      (`visibleFiles.length > 1`), a wrapper `flex w-fit items-center gap-2` owijał na pustej gałęzi
      jedno, już `w-fit`, dziecko — cztery martwe klasy i `w-fit` powiedziane dwa razy. Predykat
      wpisany inline, wrapper zeszedł do gałęzi, która czegokolwiek układa.

- [x] fixed · `comment-noise-audit` · 6 miejsc (control, toolbar, `kosztorys_v2/page.tsx`,
      spec inwestycji) · komentarze nieprzechodzące STRIP TESTU — restytucja nazwy symbolu albo
      narracja frameworka. Skasowane/przycięte; komentarze niosące prawdziwe uzasadnienie
      (wyścig `setUploadField`, `openUpload`, brak undelete w Blob) zostawione nietknięte.

- [x] fixed · `feature-first-structure` · `src/components/media/media-upload-button.tsx`
      → `src/components/ui/upload-button.tsx` · domenowo obojętny prymityw (etykieta + spinner +
      `disabled`) siedział w katalogu funkcjonalnym. `git mv` + przemianowanie na `UploadButton`,
      dwa call-site'y przepięte. Nie importuje niczego od strony feature'ów, więc `ui/` jest
      właściwym domem.

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
