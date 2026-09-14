# Review-gate ledger — ex748-manual-verification-fixes · 2026-09-14

Zakres: `git diff staging...HEAD` (6 commitów). Brak folderu `context/changes/` dla EX-748 → ledger w `.review-gate/`.
Fan-out: `/code-review`, `comment-noise-audit`, `feature-first-structure` + `module-cohesion-audit` + `structure-scatter-audit` + `tailwind-v4-audit` (jeden agent). `/10x-impl-review` odpadł — brak `plan.md`.
Step 0.5 (browser QA) pominięty: ta gałąź JEST zapisem przebiegu manual-checks.

## Findings

- [x] 🟡 WARNING · fixed · simplify(altitude) · `src/lib/queries/notification-recipients.ts:21` · ten sam bug, naprawiony u źródła: `RECIPIENT_LISTS` weszło do KLUCZA cache zamiast zasypywania dziury spreadem przy każdym odczycie. Poszerzenie listy zmienia klucz → stary wpis nieosiągalny → callback leci od nowa, a `readRecipientLists` znów jest jedyną definicją kształtu. Zniknęły: `emptyLists`, `Partial<RecipientListsT>`, wrapper, dwa komentarze. (Zatwierdzone przez właściciela — odwraca `dfda28eb` + `640bf5e4`.)
      test: TDD · unit — niepotrzebny nowy: `__tests__/lib/email/recipients.test.ts` („reads an absent list as empty") pilnuje już JEDYNEGO źródła kształtu; 41-linijkowy spec pod spread skasowany, bo `next/cache` jest w testach stubem-identycznością, więc zachowania klucza i tak nie widać w tej warstwie
- [x] 🟡 WARNING · fixed · code-review · `src/components/work-catalogue/work-catalogue-data-table.tsx:49` · `useTransition` obejmował STAN KONTROLEK, więc `active` ptaszka commitował się dopiero po przerysowaniu ~950 wierszy; drugie kliknięcie (updater `!previous`) gasiło filtr i pokazywało pełen cennik. Naprawione: kontrolki pilne, `useDeferredValue(rows)` opóźnia samą tabelę.
      test: no automated test · — czysto renderowo-priorytetowe; `renderHook`/timing nie da sygnału, którego nie da oko (repo nie ma harnessu do priorytetów Reacta)
- [x] 🟡 WARNING · fixed · code-review · `work-catalogue-data-table.tsx:81,115` · `busy` przyciemniał CAŁY blok razem z toolbarem (wbrew intencji), a spinner montowany warunkowo przesuwał przyciski przy każdym znaku. Wrapper usunięty, spinner zawsze zamontowany (`invisible`).
      test: no automated test · — czysta warstwa wizualna
- [x] 🟡 WARNING · fixed · code-review · `src/lib/actions/work-catalogue.ts:107` · `clearLegacyMarkerAction` szła bez żadnego testu; nic nie pilnowało, że `match_key` zostaje nietknięty. Dopisane 3 przypadki do `__tests__/lib/actions/work-catalogue-legacy-marker.test.ts` (asercja na wierszu z Postgresa, nie na `ActionResultT`).
      test: TDD · integration — zdjęcie dopisku, drugie kliknięcie, nieistniejące id
- [x] 🔵 fixed · simplify(efficiency) · `src/lib/kosztorys/work-catalogue/legacy-marker.ts:19` · `hasLegacyMarker` alokował string, żeby zwrócić boolean — ~1900 śmieciowych stringów na przebieg filtra. Teraz moduł-owy regex + `test`.
- [x] 🔵 fixed · simplify · `src/lib/actions/work-catalogue.ts:126` · `hasLegacyMarker` + `stripLegacyMarker` pytały o to samo dwa razy → jeden `strip` i porównanie.
- [x] 🔵 fixed · simplify · `src/scripts/fix-kosztorys-descriptions.ts:96` · cofnięty mój własny „dedup" — linia wyżej ma już `stripped`, wołanie helpera liczyło regex drugi raz.
- [x] 🔵 fixed · simplify(reuse) · `work-catalogue-data-table.tsx:111` · ręczny `Loader2` zastąpiony `GradientSpinner` (repo-wy standalone spinner, ma `role="status"`).
- [x] 🔵 fixed · simplify(reuse) · `src/lib/email/recipients.ts:22` · trzeci egzemplarz `Object.fromEntries(RECIPIENT_LISTS.map(…)) as …` — wyciągnięty `byRecipientList<T>()`, castu nie ma już w żadnym z trzech miejsc (dotknięte 2 pliki spoza diffu — dedup nigdy nie jest „poza zakresem").
- [x] 🔵 fixed · simplify · `src/hooks/use-search-filter.ts:42` · `isFiltering` dodane do hooka o 12 konsumentach dla jednego — cofnięte, `busy` liczy się lokalnie z `rows !== deferredRows`.
- [x] 🔵 fixed · simplify · `work-catalogue-data-table.tsx:47` · `useMemo` na czystym `.filter` przy włączonym React Compilerze → zwykły `const`; jeden przebieg predykatu zamiast dwóch (lista + licznik).
- [x] 🔵 dismissed · code-review · `src/lib/queries/notification-recipients.ts` · `EMPTY_LISTS` rozdawał WSPÓŁDZIELONE instancje tablic — zniknęło razem z całym spreadem.
- [x] 🔵 fixed · code-review · `src/lib/actions/work-catalogue.ts:33` · `MISSING_ITEM_ERROR` deklarowany 80 linii pod użyciem → przeniesiony do rodzeństwa na górze.
- [x] 🔵 fixed · code-review · `src/components/filters/filter-trigger-button.tsx:6` · typ propsów dopisywany po jednym (`title`, potem `onClick`, bez eventu) → `Pick<ComponentProps<typeof Button>, …>`.
- [x] fixed · structure-audit · `work-catalogue-data-table.tsx:115` · `Loader2` poza `Button` renderował się 24px zamiast 16px — zniknęło razem z `GradientSpinner` (`size-4`).
- [x] fixed · comment-noise · `use-search-filter.ts:42`, `notification-recipients.ts:7` · dwa komentarze-restatementy skasowane.
- [x] fixed · comment-noise · `notification-recipients.ts:30`, `data-table.tsx:42,46,56`, `notification-recipients.test.ts:4` · przycięte: narracja o wewnętrznych Next (`cb.toString()`/`fixedKey` — gnije przy upgradzie), definicja `useTransition`, duplikat docblocka źródła, ogon „before this existed".
- [x] fixed · comment-noise · `data-table.tsx`, `actions/work-catalogue.ts` · polonizmy w angielskich komentarzach (`szukajka`, `ptaszek`, `prace`, `opis`, `klucz`) → `search box`, `clear-marker button`, `catalogue items`, `description`, `key`. Nazwy własne z UI („Kategoria", „[stary arkusz]", katalog, kosztorys) zostają.
- [x] 🔵 skipped · simplify(altitude) · `work-catalogue-data-table.tsx` + `ui/data-table/data-table.tsx` · właściwym miejscem sygnału „tabela nadrabia" jest `DataTable` (`isStale` w `DataTableToolbarContextT`) — a jeszcze głębiej: ta tabela ma wyłączoną wirtualizację, którą `DataTable` już wspiera; z nią cała maszyneria opóźnień znika. Refactor wart osobnego review (wysokość kontenera, sticky header/footer, 8 tabel).
- [x] 🔵 skipped · simplify(altitude) · `src/lib/actions/work-catalogue.ts:113` · „zdejmij dopisek ze wszystkich widocznych" zamiast ~750 kliknięć — decyzja produktowa właściciela (czy przegląd wymaga oceny sztuka po sztuce), nie techniczna.
- [x] 🔵 dismissed · simplify(altitude) · `src/lib/actions/work-catalogue.ts:113` · „użyj `updateCatalogueItemAction` zamiast osobnej akcji" — gorsze: wymusiłoby przesłanie całego wiersza i zapytanie o kolizję klucza, który z definicji nie może się zmienić.
- [x] 🔵 dismissed · code-review · `src/lib/actions/work-catalogue.ts:113` · brak zod na `id` — `disableErrors: true` zamienia śmieciowe id w polskie zdanie, a `deleteCatalogueItemAction` ustala ten sam precedens.
- [x] 🔵 fixed · code-review · `notification-recipients.test.ts` · spec nie mógł oblać się na regresję, o którą mu chodziło (`next/cache` stubowany na identyczność) — skasowany razem z mechanizmem, który opisywał.
- [x] 🔵 dropped · code-review · `src/components/dialogs/invoice-preview-dialog.tsx:117` · `aria-describedby={undefined}` w dwóch dialogach — trzecie wystąpienie będzie sygnałem do defaultu w `DialogContent`, nie to.
- [x] 🔵 dropped · simplify(efficiency) · `src/lib/actions/work-catalogue.ts:115` · dwa round-tripy zamiast jednego `UPDATE` — dominującym kosztem kliknięcia jest i tak `updateTag` przerysowujący trasę; mikro-optymalizacja tymczasowej akcji.
- [x] 🔵 dropped · simplify · `work-catalogue-data-table.tsx:58` · opóźnienie na opóźnieniu (termin w hooku + wiersze w komponencie) kosztuje jeden przebieg w tle na literę. Naprawa to ta sama robota, co pominięty refactor `DataTable` wyżej — nie warto przenosić opóźnienia z hooka o 12 konsumentach.
- [x] dropped · comment-noise · `filter-trigger-button.tsx:6` · `Omit` zamiast `Pick` (koniec dopisywania propsów) — kosmetyka.

- [x] dropped · gate(E2E) · `work-catalogue-data-table.tsx` · filtr „Stary arkusz" + ptaszek są jawnie TYMCZASOWE (znikają razem z dopiskiem po przeglądzie katalogu) — spec Playwrighta skasowałby się razem z nimi. Ryzyko przykryte integracyjnym specem akcji.

## Simplify pass

Ran /simplify (2 agenty zamiast 4 — diff przeszedł już trzy przeglądy) — 9 applied, 0 proposed, 2 dismissed, 3 dropped, 2 skipped; każdy finding złożony do `## Findings` (tag `simplify`).
`primitive-reuse-scan` wchłonięty do agenta „reuse" — zwrócił `GradientSpinner` i `byRecipientList`.

## Tests & suite

- typecheck: zielony
- lint: 4 errory, wszystkie w plikach spoza tej gałęzi (strony `(legal)`, plik z sortowaniami) — pre-existing
- `pnpm test`: 3297 passed / 64 plików skipped, 0 failed. Pierwszy przebieg oblał `lib/google/auth.test.ts` (767 ms, timeout pod obciążeniem zimnych importów) — w izolacji i w powtórce zielony, nic wspólnego z tym diffem. **Flake do obserwacji, nie regresja.**
- `pnpm test:integration` (kontener db-test 5435): 62 pliki / 265 testów zielonych, w tym `work-catalogue-legacy-marker.test.ts` — 6 testów, czyli 3 nowe pod `clearLegacyMarkerAction`
- e2e: nie odpalane (nikt nie prosił; ~1h)

---

# Review-gate ledger — poprawa tekstów katalogu prac + UI katalogu · 2026-09-14

Zakres: `src/scripts/fix-work-catalogue-texts.ts` (nowy), `src/scripts/data/work-catalogue-fixes.tsv` (nowy),
`src/components/ui/data-table/data-table.tsx` (+`belowToolbar`), `src/components/work-catalogue/work-catalogue-data-table.tsx`
(licznik + `ordinals` alfabetycznie), `src/components/tables/work-catalogue.tsx` (`compareDescriptions` + `sortingFn`).

Fan-out: `/code-review`, `comment-noise-audit` (flag-only), `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `tailwind-v4-audit`. `/10x-impl-review` odpadł — brak `plan.md`.
Step 0.5 pominięty — brak skilla weryfikacji przeglądarkowej.

## Findings

- [x] fixed · comment-noise · `tables/work-catalogue.tsx:50` · komentarz nad `lpColumn` twierdził, że Lp. jest przypięte do kolejności `ORDER BY category NULLS LAST, description` — to nieprawda od zmiany `ordinals`; przepisany na „alfabetycznie po całym katalogu".
- [x] fixed · comment-noise · `work-catalogue-data-table.tsx:70` · wycięta anegdota („Akrylowanie" z numerem 614) i powtórzone z drugiej strony sprzężenie z `compareDescriptions` — zostaje w miejscu `export`.
- [x] fixed · comment-noise · `ui/data-table/data-table.tsx:62` · otwierające „Line between the toolbar and the table" restytuowało nazwę propa i miejsce renderu — wycięte, uzasadnienie „własny wiersz, nie kolejny element toolbara" zostaje.
- [x] fixed · comment-noise · `fix-work-catalogue-texts.ts:30` · komentarz nad `QA_LEFTOVER` skasowany (nazwa + log mówią to samo).
- [x] fixed · comment-noise · `fix-work-catalogue-texts.ts:2` · „(klucz / kategoria / j.m. / opis)" restytuowało destrukturyzację w `readFixes`.
- [x] fixed · comment-noise · `fix-work-catalogue-texts.ts:11,14` · polonizmy w angielskim komentarzu (`stawki`, `produkcja`) → `rates`, `production`.
- [x] 🔴 fixed · code-review · `fix-work-catalogue-texts.ts:90` · skrypt bezwarunkowo nadpisywał opis z TSV, więc **dopisywał „[stary arkusz]" z powrotem** każdej pracy, z której właściciel już go zdjął (`catalogueKey` jest ślepy na dopisek, więc wiersz nadal trafiał w swój fix). 750 z 938 linii ma dopisek. Teraz `claim` zachowuje stan dopiska z bazy.
      test: brak testu automatycznego · sprawdzone ręcznie na lokalu — zdjąłem dopisek z #195, dry-run: `0 do poprawy`; z wyłączonym strażnikiem ten sam przebieg pokazuje `+ … [stary arkusz]` (walidacja instrumentu). Skrypt jednorazowy, spec byłby dłuższy od niego.
- [x] 🔴 fixed · code-review · `fix-work-catalogue-texts.ts:150` · kasowanie + parkowanie `tmp:<id>` + przepisanie szły poza transakcją i bez `.catch` — awaria w połowie zostawiała wiersze na `tmp:<id>` na stałe (klucz bez `|`, więc nie pasuje do niczego w aplikacji). Całość w `withPayloadTransaction`, `main()` z `.catch`.
- [x] 🟡 fixed · code-review · `fix-work-catalogue-texts.ts:112` · kolizje sprawdzane były tylko fix-vs-fix; poprawka wchodząca na klucz wiersza z „NIE RUSZAM" wywaliłaby UNIQUE w połowie zapisu. Dry-run przerywa teraz z listą kolidujących.
- [x] 🔵 fixed · code-review · `fix-work-catalogue-texts.ts:104` · drugi przebieg dopasowania szedł w kolejności pliku, więc przy ponownym uruchomieniu fix z dopiskiem mógł przejąć wiersz ocalały — sortowany tak samo jak `resolveCollisions` (bez dopiska pierwszy).
- [x] fixed · feature-first / module-cohesion / scatter (3×) · `compareDescriptions` → `src/lib/kosztorys/work-catalogue/compare-descriptions.ts` · komparator bez Reacta siedział w module kolumn `'use client'`, a druga katalogowa ścieżka sięgała po niego przez granicę katalogów.
- [x] fixed · feature-first / scatter (2×) · `sheet-report-words.ts` → `src/lib/utils/counted-nouns.ts` · `/katalog-prac` był pierwszym konsumentem spoza `kosztorys/editor/dialogs/`; moduł to czysta polska gramatyka nad `polish-plural.ts`. 8 importów przepiętych, bez shima.
- [x] fixed · scatter(N+1) · `AGENTS.md` · dopisana reguła dla `src/scripts/data/` (dane wejściowe skryptu obok skryptu; fixture'y do `src/__tests__/fixtures/`) — nowy katalog bez zapisanej reguły to rzut monetą dla następnego pliku.
- [x] dismissed · feature-first / scatter · `category-options.ts:7` i `row-view.ts:57` · propozycja zwinięcia ich `localeCompare(…, 'pl')` na `compareDescriptions` — inny temat (nazwy kategorii / klucz wiersza, nie opis pracy) i dedup jednolinijkowca, gdzie nazwa argumentu byłaby kłamstwem.
- [x] dropped · scatter · `src/scripts/data/` vs `fixtures/` · nazwa katalogu — kosmetyka, katalog ma jeden commit.
- [x] dismissed · tailwind-v4 · `work-catalogue-data-table.tsx:100` · audyt czysty w trzech grupach; brak prefiksów responsywnych, więc nadpisana skala (`sm`=768) nie wchodzi w grę.
- [x] dismissed · module-cohesion · `ui/data-table/data-table.tsx` · `belowToolbar` nie dokłada powodu do zmiany — plik i tak zmienia się przy zmianie układu/API `DataTable`.
- [x] fixed · simplify(reuse/efficiency) · `fix-work-catalogue-texts.ts:209` · dwie pętle po ~930 `UPDATE` zwinięte do dwóch statementów (`'tmp:' || id` + `FROM (VALUES …)`, kształt `setItemDescriptions`). Nagłówek zaprasza do przebiegu na Neonie, gdzie ~1876 round-tripów trzymałoby transakcję zapisu przez minutę.
- [x] 🟡 fixed · simplify(reuse) · `lib/kosztorys/work-catalogue/suspects.ts:12` · `normalize` powielał `foldText`, gubiąc jego jedyny powód istnienia — `ł` nie jest `l`+diakryt, więc NFD go zostawiał, a `[^a-z0-9]` zamieniał na spację: „Układanie rur" → `uk adanie rur`, czyli reguły śmieci i wykrywanie duplikatów po prostu nie trafiały w słowa z `ł`. Teraz `foldText(...)`.
      test: brak testu automatycznego · mechanizm jest TYMCZASOWY (znika z przeglądem katalogu), a poprawka to podmiana na istniejący, przetestowany helper.
- [x] fixed · simplify(altitude) · `lib/utils/counted-nouns.ts` → `lib/kosztorys/counted-nouns.ts` · wszystkich 8 konsumentów to kosztorys, a słownictwo (praca/sekcja/stawka/kolumna) jest domenowe — `lib/utils/` to szuflada obok `cn`.
- [x] fixed · simplify(altitude) · `tables/work-catalogue.tsx:97` · „Kategoria" wciąż sortowała się domyślnym `alphanumeric`, więc „Łazienka" i „Ściany" lądowały za „Z" — i kolumna kłóciła się z własnym menu filtra, które sortuje `'pl'`. Ten sam `sortingFn`.
- [x] fixed · simplify · `work-catalogue-data-table.tsx:97` · licznik zszedł z trzech ruchomych części (`narrowed` + `cn` z dwiema gałęziami + zagnieżdżony ternary) do jednego `<span>`; sufiks „z 938" niesie ten sam sygnał, co pogrubienie.
- [x] fixed · simplify · `fix-work-catalogue-texts.ts:93` · `claim` zwraca `undefined` zamiast `[] | [x]`; zniknęła tablica równoległa `exact` indeksowana z drugiego przebiegu.
- [x] fixed · simplify · `fix-work-catalogue-texts.ts:65` · rzutowanie na krotkę w `resolveCollisions` zastąpione `sorted[0]!` / `sorted.slice(1)` — plik i tak używa `!`.
- [x] fixed · simplify · `fix-work-catalogue-texts.ts:39` · `readFixes` brał cztery `!` bez sprawdzenia arności; linia bez taba niosła `undefined` aż do parametru UPDATE-a.
- [x] fixed · simplify · `fix-work-catalogue-texts.ts:13` · dopisane w nagłówku, że surowy SQL omija hooki Payloada, więc `collection:work-catalogue-items` nie jest unieważniany po `--apply`.
- [x] dismissed · simplify(reuse) · `pagination-footer.tsx:31` · jedyny licznik „N wyników" w repo jest przywiązany do paginacji (`PaginationMetaT` + `baseUrl`) — nie ta sama rzecz.
- [x] dropped · simplify · `tables/work-catalogue.tsx` · wstawienie `descriptionColumn` wprost do `WORK_CATALOGUE_PICKER_COLUMNS` — wymiana jednego na drugie.

## Simplify pass

Ran /simplify + `primitive-reuse-scan` w jednym agencie (diff przeszedł już trzy przeglądy) — 9 applied, 0 proposed, 1 dismissed, 1 dropped; każdy finding złożony do `## Findings` (tag `simplify`).

## Tests & suite

- typecheck: zielony
- lint: 4 errory, wszystkie pre-existing i poza tą gałęzią (strony `(legal)`, `test.js`); jedyny warning w dotkniętych plikach to znany `react-hooks/incompatible-library` na `useReactTable`
- prettier --check: czysto
- `pnpm test`: 3297 passed / 64 pliki skipped, 0 failed
- `pnpm test:integration` (kontener db-test 5435): 62 pliki / 265 testów zielonych
- e2e: nie odpalane (nikt nie prosił; ~1h)
- **weryfikacja skryptu end-to-end na lokalu**: `work_catalogue_items` przeładowane z migawki proda (939 wierszy), `--apply` → poprawiono 497, skasowano 11 → 928 wierszy / 928 unikalnych kluczy / 10 kategorii / 0 wierszy na `tmp:`; drugi przebieg `0 do poprawy` (idempotentny). Cały przebieg ~3,5 s przez nowy zapis zbiorczy.
