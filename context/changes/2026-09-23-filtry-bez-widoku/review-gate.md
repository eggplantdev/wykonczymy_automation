# Review-gate ledger — cały zakres 22–23.09 · 2026-09-23

**Zakres (na życzenie użytkownika, szerszy niż jedna zmiana):** `51c52214..HEAD` + drzewo robocze —
wszystko od pierwszego wczorajszego hotfiksa (`fd06892e` „przywróć kolumnę «Akcje» w siatce
szablonu", 22.09 17:14) do teraz. 12 commitów, 135 plików źródłowych, ~5,2 tys. linii. Obejmuje
pracę innych agentów — bramka naprawia **wszystkie** znaleziska, nie tylko te z własnego diffa.

Zmiany w drzewie roboczym: `2026-09-23-filtry-bez-widoku` (EX-856) i `2026-09-23-kosztorys-bulk-actions`.

**Fan-out (7 agentów, read-only):** `/code-review`, `/10x-impl-review`, `tailwind-v4-audit`,
`feature-first-structure` + `module-cohesion-audit` + `structure-scatter-audit` (jeden agent),
`comment-noise-audit`, reuse/dedup/dead-code, test-coverage.
Krok 0.5 (przebieg w przeglądarce) **pominięty** — stała zasada: bez pytania nie uruchamiamy
Playwrighta ani E2E. Wyniki wczorajszego ręcznego przebiegu QA czytamy z `context/foundation/manual-checks.md`.

## Findings

<!-- ONE checkbox per finding; format:
     [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — why
     Duplikaty z kilku agentów scalone w jedną linię, ze wszystkimi źródłami. -->

### 🟡 WARNING

- [x] 🟡 WARNING · **skipped (decyzja właściciela)** · `code-review` · `src/lib/kosztorys/row-conditions/registry.ts:222,242` · filtr „bez kwoty stałej powyżej sufitu" łapie też każdą pozycję na „auto" (377/377 zamiast 236 na zestawie QA) — **celowe**, `registry.ts:200-206` mówi to wprost („The complement is therefore stated by negation"). Zachowanie zmieniające to, co użytkownik MOŻE zrobić, więc nie stosujemy auto-fixa; pytanie zostaje otwarte dla właściciela w `manual-checks.md`.
      test: brak automatu · — pin zachowania dopiero po rozstrzygnięciu właściciela; dziś zapinałby wariant, który może się zmienić.
- [x] 🟡 WARNING · **fixed** · `code-review` (pochodna) · `src/lib/kosztorys/subcontractor-price-guard.ts:79-86` · docstring `isFixedRateOverCeiling` twierdził precyzję, której predykat nie ma — dopisany akapit o dopełnieniu obejmującym „auto" i odsyłacz do rejestru. To był realny defekt w tej parze, nie zachowanie.
      test: brak automatu · — zmiana wyłącznie w komentarzu.
- [x] 🟡 WARNING · **fixed** · `impl-review` · `src/__tests__/components/kosztorys/editor/toolbar/menus/filters-menu-model.test.ts` · plan dwukrotnie wymagał pinu kolejności rejestru, nie wszedł → dodany przypadek `comes out in registry order too`.
      test: TDD · unit — spec porównuje teraz kolejność modelu z kolejnością filtrów w `ROW_CONDITIONS`.
- [x] 🟡 WARNING · **fixed** · `impl-review` · `context/changes/2026-09-22-stawka-problems-and-filters/change.md:68-72,93-95` · dwa rozstrzygnięcia EX-820 odwrócone przez to drzewo bez adnotacji → dopisane dwie noty o odwróceniu.
- [x] 🟡 WARNING · **fixed** · `impl-review` · `context/foundation/manual-checks.md` (sekcja EX-820) · odhaczony check „te same dwie pozycje **nie** pojawiają się w widoku klienta" zaprzeczony przez usunięcie bramki płaszczyzn → `[~]` + „nieaktualne od EX-856".
- [x] 🟡 WARNING · **fixed** · `impl-review` · `context/changes/2026-09-22-szablon-autosave/review-gate.md:71,74` · EX-843 i EX-844 zapisane jako odroczone, a zaimplementowane w tym drzewie → linie zaadnotowane; oba issue w Linearze już `Done`.
- [x] 🟡 WARNING · **fixed** · `impl-review` · `context/changes/2026-09-23-filtry-bez-widoku/plan.md` `## Progress` + `change.md:4` · wszystkie boksy `[ ]` przy trzech wdrożonych fazach → sześć boksów odhaczonych, `status: implemented`.

### 🔵 OBSERVATION

- [x] 🔵 OBSERVATION · **filed EX-858** · `code-review` · `src/lib/actions/work-catalogue.ts:128,360` · `listWorkCatalogueAction` / `catalogueSavePreviewAction` to odczyty na żądanie, zostały w katalogu mutacji, podczas gdy bliźniacza para presetów przeniosła się do `lib/queries` — `catalogueSavePreviewAction` dzieli prywatny `catalogueSaveState` z mutacją, więc rozdzielenie zasługuje na własne review.
- [x] 🔵 OBSERVATION · **fixed (skasowany)** · `code-review` + `structure` + `impl-review` + `test-coverage` · `src/scripts/tmp-reset-verify-owner-password.ts` · samozwańczy throwaway bez ochrony docelowej bazy, nieśledzony ale i niezignorowany (`git add -A` wciągnąłby go do repo).
- [x] 🔵 OBSERVATION · **dismissed** · `code-review` · `src/components/kosztorys/editor/hooks/use-workshop-mirror-flush.ts:34` · rewizja stemplowana przed dojściem zapisu; komentarz sam deklaruje best-effort, a ścieżka `visibilitychange` jest dodatkowym, nie jedynym momentem — nota, nie defekt.
      test: brak automatu · — zapisanie tego kontraktu wymagałoby pinu na teardown przeglądarki, czyli E2E za cenę niewspółmierną do skutku (opóźnione `updated_at`).
- [x] 🔵 OBSERVATION · **fixed** · `code-review` · `src/lib/actions/kosztorys.ts` (`addSectionAction`) · zerowierszowy `shiftDisplayOrderFrom` nic nie blokuje → dopisany komentarz o rezydualnym wyścigu, bliźniaczy do tego w `create-section-with-catalogue-items.ts`; skutek nieszkodliwy, bo `kosztorys-tree.ts:59` sortuje `display_order, id`.
      test: brak automatu · — wyścig dwóch równoległych transakcji, rozstrzygnięty deterministycznie przez sort; spec musiałby symulować współbieżność bez obserwowalnego skutku.
- [x] 🔵 OBSERVATION · **fixed** · `impl-review` · `src/components/filters/filter-multi-select.tsx` · usunięcie `togglesHeading` i separatora pod wierszem zbiorczym nie było w kontrakcie planu → odnotowane jako decyzja (kod jest słuszny: `transfer-filters.tsx:275` nie podaje nagłówka), plan był nieaktualny.
- [x] 🔵 OBSERVATION · **fixed** · `impl-review` · `src/components/kosztorys/editor/toolbar/menus/use-kosztorys-filter-menu.ts` · plan zapowiadał 3 klucze, weszły 4 (`filters` czyta `kosztorys-sections-menu.tsx:20`) → po deduplikacji drugiego przebiegu `offeredFilterConditions` hook zwraca 3 klucze zgodnie z kontraktem.
- [x] 🔵 OBSERVATION · **fixed (tranzytywnie)** · `impl-review` · `src/__tests__/lib/kosztorys/row-conditions/registry.test.ts` · ciągłość filtrów w rejestrze po grupach nie była asercjowana nigdzie → zamknięte przez parę w `filters-menu-model.test.ts`: kolejność modelu == kolejność rejestru **oraz** kolejność modelu == kolejność `FILTER_GROUPS` ⇒ rejestr jest ciągły po grupach.
- [x] 🔵 OBSERVATION · **fixed** · `impl-review` · `context/foundation/manual-checks.md` · brak sekcji EX-856 → dopisane 8 nieodhaczonych checków dla przypięcia płaszczyzny w warsztacie i pogrupowanego menu „Filtry".
- [x] 🔵 OBSERVATION · **dropped** · `impl-review` · `context/changes/2026-09-22-szablon-autosave/plan.md` (Progress 3.3) · proza planu opisuje kształt sprzed EX-843 — trwałym zapisem jest adnotacja na `review-gate.md` tego slice'a, a spec `use-workshop-mirror-flush.test.tsx:23-24` faktycznie steruje `visibilitychange`, więc luka pokrycia nie istnieje.
- [x] 🔵 OBSERVATION · **skipped** · `impl-review` · `src/lib/kosztorys/work-catalogue/create-section-with-catalogue-items.ts` · gałąź fallbacku re-derywuje `appendCatalogueItems` wbrew klauzuli „rather than" z kontraktu — obronne: helper bierze `sectionId`, a fallback ma tylko nazwę; ujednolicenie to zmiana sygnatury helpera, czyli refaktor na własne review.
- [x] 🔵 OBSERVATION · **fixed** · `impl-review` · `context/changes/e2e-harness/review-gate.md:17-19` · linia EX-816 opisywała podział jako odłożony, a `545a3282` go zrobił (sześć plików, nie dwa) → linia zaktualizowana, **EX-816 przestawiony na Done**.
- [x] 🔵 OBSERVATION · **fixed** · `impl-review` · `context/changes/2026-09-22-szablon-autosave/review-gate.md` (linia EX-846) · ścieżka `src/lib/actions/lock-investment-row.ts` nie istnieje po `9eb17728` → poprawiona na `src/lib/db/lock-investment-for-replace.ts`.
- [x] 🔵 OBSERVATION · **fixed** · `impl-review` · commit `f1480d80` · rejestr findingów leżał w zignorowanym `.review-gate/`, wbrew regule „cała proza pod `context/`" → zarchiwizowany do `context/archive/2026-09-22-staging-review-gates/`.

### comment-noise

- [x] **fixed** · `comment-noise` · `src/lib/kosztorys/row-conditions/queries.ts:192` · „went from four rows to twelve" — rejestr ma 16 filtrów.
- [x] **fixed** · `comment-noise` · `src/lib/kosztorys/row-conditions/queries.ts:213` · „Frozen module-level instances" — nic nie jest `Object.freeze`’owane; zostało samo uzasadnienie stabilności referencyjnej.
- [x] **fixed** · `comment-noise` · `src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.test.tsx:67` · narracja o stanie, którego już nie ma; kanoniczny zapis jest w JSDoc `offeredFilterConditions`.
- [x] **fixed** · `comment-noise` · `…/kosztorys-filters-menu.test.tsx:106` · „Twelve rows" → szesnaście.
- [x] **fixed** · `comment-noise` · `src/__tests__/lib/kosztorys/empty-grid-copy.test.ts:18` · „twelve hiders" → szesnaście.
- [x] **fixed** · `comment-noise` · `src/lib/kosztorys/empty-grid-copy.ts:16` · „a dozen bare noun phrases … 380 characters" — liczba mierzona przy dwunastu, zaniżała własny argument.
- [x] **fixed** · `comment-noise` · `src/components/kosztorys/editor/hooks/use-engaged-conditions.ts:70` · „twelve toggles … twelve serialisations" — liczba jest sednem zdania.
- [x] **fixed** · `comment-noise` · `src/components/kosztorys/editor/toolbar/menus/filters-menu-model.ts:30` · zdanie o „starej bramce widoku" — stan, którego nie ma; żywe uzasadnienie stoi dwa zdania wyżej.
- [x] **fixed** · `comment-noise` · `src/__tests__/lib/kosztorys/row-conditions/queries.test.ts:296` · czwarta kopia tego samego rozstrzygnięcia właściciela → przycięta do jednego zdania o skutku.
- [x] **fixed** · `comment-noise` · `src/lib/kosztorys/row-ops.ts:79` · nagłówek powtarzający nazwę `catalogueSlicePlacement` i jej unię.
- [x] **fixed** · `comment-noise` · `src/lib/kosztorys/work-catalogue/place-catalogue-items.ts:21` · „, not a conversion" — odrzucona alternatywa nienazywająca żadnej pułapki.
- [x] **fixed** · `comment-noise` · `src/collections/investments.ts:17` · „/admin and generate:types know" — panel Payloada jest w tej apce nieużywany, więc nie jest powodem deklaracji.
- [x] **dismissed** · `comment-noise` · `e2e/**` · zero findingów: prawie każdy „dodany" komentarz to przeniesiony tekst z `helpers.ts` (EX-816), zweryfikowane diffem zbiorów komentarzy.

### struktura plików

- [x] **fixed** · `structure-scatter` · `e2e/share-link.ts` → `e2e/drivers/share-link.ts` · driver domenowy zostawiony w korzeniu przez ten sam zakres, który stworzył `e2e/drivers/` jako dom dla tego gatunku; dwa importy zaktualizowane.
- [x] **dismissed** · `module-cohesion` · `src/components/kosztorys/editor/use-kosztorys-editor.ts` (1333 l.) · god-module po rozmiarze — AGENTS.md wyznacza go punktem kompozycji, EX-515 świadomie odroczył podział, a zakres go **zmniejszył** (1336 → 1333), rozprowadzając cztery nowe klastry do liści w `editor/hooks/`.
- [x] **dismissed** · `feature-first-structure` · lustrzane ścieżki speców, `.tsx` dla `renderHook`, domy hooków, kierunek importów w `ui/`, trio `*-model.ts`, `preset-pickers.ts`, `filter-groups.ts` · każde trafia w udokumentowaną regułę projektu; szczegóły w raporcie agenta.

### reuse / dedup

- [x] **fixed** · `reuse` · `e2e/seeds.ts:45-105` · pięć identycznych wrapperów seedujących → jeden `seedAndRefresh`; dziesięć speców nadal wpisuje tę parę ręcznie — zamiana ich to osobna, mechaniczna przeróbka do zaoferowania, nie zmiatanie przy okazji.
- [x] **fixed** · `reuse` · `src/lib/kosztorys/row-conditions/registry.ts` (8 wpisów) · `plane:` na filtrach to martwa dana po usunięciu bramki płaszczyzn — jedyni czytelnicy `.plane` są bramkowani na `kind === 'diagnostic'`.
- [x] **fixed** · `reuse` · `src/components/kosztorys/editor/toolbar/menus/use-kosztorys-filter-menu.ts:34,41` · `offeredFilterConditions` przebiegał rejestr dwa razy na render → model oddaje ofertę razem z przełącznikami.
- [x] **fixed** · `reuse` · `src/lib/kosztorys/subcontractor-price-guard.ts:120-133` · `checkSubcontractorPrice` re-implementował dwa predykaty z tego samego pliku → woła `isSubcontractorPriceNegative` i `isFixedRateOverCeiling`.
- [x] **dismissed** · `reuse` · `src/components/filters/filter-multi-select.tsx:239-249` · reduktor `toggleRuns` vs jednolinijkowe wykrywanie serii w `dropdown-check-groups.tsx` — cmdk potrzebuje realnych `CommandGroup`, więc zostaje struktura pośrednia; sam predykat to jedno porównanie, wygrana nie pokrywa churnu.
- [x] **dismissed** · `reuse` · `filters-menu-model.ts:4-14` + `problems-menu-model.ts:3-11` + `ui/dropdown-check-groups.tsx:12-19` · trzy deklaracje `{id,label,groupLabel,active}` — `active` niesie **przeciwne** znaczenie domenowe (odhaczony filtr = NIE zaangażowany, odhaczony problem = wciśnięty), a aliasowanie uzależniłoby moduły React-free od kontraktu komponentu `'use client'`.
- [x] **dismissed** · `reuse` · `filters-menu-model.ts:52-53` + `problems-menu-model.ts:41-47` · próg `isWorthOffering` — parametry (`id`, `counts`, `engagedIds`) są dłuższe niż ciało; helper nie kupuje nic poza nazwą.
- [x] **dismissed** · `reuse` · `src/lib/kosztorys/subcontractor-price-guard.ts:60` · `|| coeff <= 0` nieosiągalne z `coeffWarning` — predykat jest **celowo** jednym źródłem reguły flagowania, wspólnym z czerwonym polem mnożnika; wklejenie `coeff > MAX_CLIENT_SHARE` rozwidliłoby te dwa odczyty.

### pokrycie testami

- [x] **fixed** · `test-coverage` · `src/lib/kosztorys/row-content-lines.ts:7` + `src/styles/globals.css:406-408` · kontrakt trzech edycji (nowa kolumna zawijana ⇒ ręczna para selektorów `::after`) nie miał strażnika → nowy blok w `row-content-lines.test.ts` czyta `globals.css` jako tekst i wymaga selektora dla każdego członka `WRAPPING_COLUMN_IDS`. Kotwiczy ryzyko #9 z `test-plan.md`.
      test: TDD · unit — czysty odczyt pliku, bez renderu i bez przeglądarki.
- [x] **fixed** · `test-coverage` · `src/components/kosztorys/editor/hooks/use-engaged-conditions.ts:87` · gałąź no-op `setMany` (`return changed ? next : prev`) nieasercjowana → `use-engaged-conditions.test.tsx`, 4 testy.
      test: TDD · dom (`renderHook`) — ryzykiem jest tożsamość stanu przy drugim wywołaniu, czego spec node'owy nie zobaczy.
- [x] **filed EX-859** · `test-coverage` · `e2e/work-catalogue.spec.ts:191` + `src/components/kosztorys/editor/use-kosztorys-editor.ts:992` · gałąź „nowa sekcja" w „Dodaj pracę z katalogu" i `placement === 'reseed'` / `recoverStaleTree()` nie są ćwiczone na żadnej warstwie; repaint siatki to pytanie wyłącznie dla przeglądarki. Etykieta `e2e-backlog`.
      test: e2e — dyspozycja zapisana w issue, żeby strażnik wędrował razem z poprawką.

### tailwind v4

- [x] **dismissed** · `tailwind-v4-audit` · cały zakres · zero findingów: `w-(--radix-popover-trigger-width)` to poprawny skrót v4, brak nowych breakpointów, brak wartości arbitralnych, brak `next/image`, `globals.css` zyskał tylko `.kosztorys-clipped-sectionName`.

## Simplify pass

Fan-out `/simplify` zastąpiony agentem reuse/dedup/dead-code w Kroku 1 (te same cztery kąty:
reuse, uproszczenie, wydajność, wysokość) — **8 findingów: 4 zastosowane, 4 odrzucone**, wszystkie
wpięte wyżej w `## Findings` ze źródłem `reuse`. Osobnej listy nie ma z założenia: jedna lista, bez
lustrzanych kopii.

## Tests & suite

Uruchamiane wyłącznie celowanymi plikami — stała zasada „żadnych bramek całego drzewa na granicy fazy":

| Spec                                            | Wynik |
| ----------------------------------------------- | ----- |
| `row-conditions/queries.test.ts`                | 40 ✓  |
| `row-conditions/registry.test.ts`               | 34 ✓  |
| `menus/filters-menu-model.test.ts`              | 12 ✓  |
| `menus/kosztorys-filters-menu.test.tsx`         | 7 ✓   |
| `filters/filter-multi-select.test.tsx`          | 3 ✓   |
| `toolbar/kosztorys-editor-toolbar.test.tsx`     | 3 ✓   |
| `toolbar/active-filters-model.test.ts`          | 15 ✓  |
| `toolbar/kosztorys-active-filters-bar.test.tsx` | 8 ✓   |
| `lib/kosztorys/row-content-lines.test.ts`       | 9 ✓   |
| `editor/hooks/use-engaged-conditions.test.tsx`  | 4 ✓   |

**Pełny pakiet (`typecheck` / `lint` / `test` / `build`) — nie uruchomiony.** Stała zasada
użytkownika: bramki całego drzewa tylko na wyraźne polecenie, raz, na realnym końcu pracy.
`test:e2e` nie uruchamiany bez pytania (≈1 h).

## Stan bramki

**42 findingi · 0 otwartych boksów.** 27 naprawionych, 11 odrzuconych/dismissed, 2 zgłoszone do
Lineara (EX-858, EX-859), 2 świadomie pominięte z zapisanym powodem.

Jedna rzecz **czeka na decyzję właściciela**, nie na kod: dopełnienie filtra sufitu („bez kwoty
stałej powyżej sufitu") łapie też pozycje na „auto". To zachowanie zmieniające to, co użytkownik
może zrobić, więc bramka je **pokazuje, a nie poprawia** — otwarty check stoi w
`context/foundation/manual-checks.md`.
