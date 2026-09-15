# Review-gate ledger — kosztorys-section-menu-split · 2026-09-14

Zakres: `e93977f3..HEAD` (fazy 1–3 + epilog). Krok 0.5 (przebieg przeglądarkowy)
pominięty — Playwright uruchamiam wyłącznie na wyraźną prośbę.

## Findings

- [x] dismissed · feature-first · `grid/menus/kosztorys-section-actions-menu.tsx` · nowy plik w istniejącym katalogu `grid/menus/`, `SectionBandActionsT` kolokowany przy komponencie — brak konkurencyjnego domu
- [x] dismissed · module-cohesion · `grid/cells/section-header-cell.tsx:18` · 6 eksportów w pliku komponentu — to kontrakt komórki + para `sectionBandLabelColumnId`/`sectionHeaderSlot`, rozbicie rozjechałoby konwencję slotów
- [x] dismissed · module-cohesion · `grid/menus/removal-confirm.ts:3` · 4-liniowy moduł jednego stałego — precedens `grid/stage-header-copy.ts`; alternatywa to zdublowane zdanie w dwóch menu
- [x] skipped · module-cohesion · `grid/kosztorys-v2-column-opts.ts:53` · cztery callbacki sekcji, których nie czyta żadna kolumna — świadomy koszt jednej bramki `editorOnly()`, udokumentowany komentarzem w pliku; rozdzielenie = druga bramka
- [x] dismissed · structure-scatter · `grid/menus/removal-confirm.ts` · „non-component w components/" zgodne z konwencją repo (~65 rodzeństwa)
- [x] fixed · comment-noise · `use-kosztorys-editor.ts:1234` · „Every section command rides the band now." — stała połówka podmieniona na nową stałą połówkę (trim-trap); zostawić tylko zdanie o reużyciu z `columnOpts`
- [x] fixed · comment-noise · `grid/menus/kosztorys-section-actions-menu.tsx:79` · „A sekcja command, not a pozycja one:" — kontrast tylko wobec skasowanego wpisu; zostaje ogon o końcu sekcji
- [x] fixed · comment-noise · `grid/cells/section-header-cell.tsx:13` · komentarz opisujący `SectionHeaderContextT` siedzi nad `SectionHeaderFigureT`; ten diff pogłębił mis-anchor, dokładając klauzulę o `actions` — przenieść, nie kasować
- [x] dropped · comment-noise · `section-header-cell.tsx:88` + `kosztorys-row-actions-menu.tsx:36` + spec:49 · to samo zdanie o zwiniętej sekcji w trzech miejscach — kopia z mechanizmem jest nośna, dwie pozostałe to skutek; nie warte churnu
- [x] dropped · comment-noise · `section-header-cell.tsx:39` · „«Akcje» is 64px of row menu" — na pasku to menu sekcji; wniosek (chrome, 64px) nadal prawdziwy
- [x] dismissed · comment-noise · `removal-confirm.ts:1`, `kosztorys-section-actions-menu.tsx:21`, `section-header-cell.tsx:26,57` · przechodzą strip test — niosą argument, nie parafrazę
- [x] fixed · comment-noise · `section-header-cell.tsx:117` · literówka „theDda" w komentarzu (pre-existing, sąsiednia linia)
- [x] dismissed · tailwind-v4 · cały diff · 0 naruszeń; `[&_svg]:text-(--section-rail,…)` to składnia v4.1 i dokładny precedens z `section-header-cell.tsx:67`
- [x] 🟡 WARNING · fixed · code-review · `grid/menus/kosztorys-section-actions-menu.tsx:59` · przy sortowaniu „zachowując sekcje" (`scope: 'section'`) paski nadal się renderują (`kosztorys-editor-body.tsx:229`), a Wstaw powyżej/poniżej i Przesuń w górę/dół milcząco nie robią nic (`use-kosztorys-editor.ts:950,981` zaczynają od `if (sort) return`). Przed zmianą menu wiersza pokazywało je jako wygaszone — regres z „widocznie niedostępne" na „wygląda na czynne, nic nie robi"
      test: TDD · unit — predykat widoczności paska vs predykat dostępności komend kolejności w `lib/kosztorys/`, asercja że widoczny pasek nigdy nie oferuje czynnej komendy kolejności
- [x] fixed · code-review · `kosztorys-section-actions-menu.tsx:30` + `use-kosztorys-editor.ts:949` · oba komentarze twierdzą nieprawdę o sortowaniu — odpadają razem z powyższą poprawką
- [x] dropped · 🔵 OBSERVATION · code-review · `section-header-cell.tsx:93` · sekcja bez nazwy dałaby `Usunąć sekcję „" (12 poz.)?` — `DEFAULT_SECTION_NAME` czyni to nieosiągalnym, a poprzednio było „undefined"
- [x] dismissed · 🔵 OBSERVATION · code-review · zasięg pod sortowaniem globalnym · „Usuń sekcję" i kolor stają się nieosiągalne — świadoma decyzja 2 w `change.md`; „Dodaj pracę z katalogu…" zostaje w menu paska narzędzi
- [x] dismissed · code-review · EX-422 / EX-496 / usunięcie `sectionItemCounts` / widok klienta / rozstrzyganie slotu — sprawdzone, czysto

## Simplify pass

4 agenty (reuse / simplification / efficiency / altitude) → 8 ustaleń po deduplikacji:
3 fixed, 2 dropped, 1 skipped, 2 dismissed · 0 otwartych. Raport: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.azy42wIWy0.md`

- [x] fixed · `lib/kosztorys/order-commands.ts` (d. `section-band-commands.ts`) · predykat kolejności czytany był w 1 z 5 miejsc; trzy handlery i kolumna akcji idą teraz przez `orderCommandsEnabled(sort)`, plik i spec przemianowane, bo reguła dotyczy pozycji i sekcji
- [x] fixed · `lib/kosztorys/move-edges.ts:36,45` · `canMove*` przyjmują `MoveEdgesT | undefined` — cztery powtórzone ternary u wywołujących zniknęły
- [x] fixed · `lib/kosztorys/move-edges.ts:21` · martwy strażnik pustego bloku usunięty
- [x] dropped · `move-edges.ts:18` · ręczny przebieg zamiast `groupBySection` — alokacja pomijalna, semantyka rozjechałaby się na dwa miejsca
- [x] dropped · `kosztorys-editor-body.tsx:196` · odwrócenie polaryzacji predykatu — para jest celowo czytana jednopolarnie przez spec
- [x] skipped · `section-header-cell.tsx:32` · wchłonięcie `sortActive`/`moveEdges` do `SectionBandActionsT` — pakiet to callbacki jednej bramki, nie stan widoku
- [x] dismissed · `move-edges.ts` vs `row-ops.ts` · celowa duplikacja predykatu (O(n) per komórka vs prekalkulacja), przypięta specem
- [x] dismissed · `globals.css` + `cell-menu-trigger.tsx` · głębokość reguły barwy ⋯ właściwa — istniejący mechanizm `--section-rail`, zmiana usuwa wyjątek z prymitywu

## Tests & suite

- [x] `move-edges.test.ts` (4) + `order-commands.test.ts` (4) — instrument zwalidowany na obu (celowo zepsuty predykat wywala właściwe asercje)
- [x] typecheck czysty · lint 0 błędów (83 pre-existing warningów w migracjach) · pełny zestaw: 253 pliki / 3357 testów zielonych
- [x] E2E: zaciągnięte do **EX-472** („E2E: kosztorys ⋯-menu add/insert/delete + order integrity") — istniejący backlogowy spec tego samego menu; dopisano do niego oba triggery, wygaszenia na krawędzi bloku i pod sortowaniem oraz to, że wyszukiwarka nie zawęża krawędzi. Nowe issue byłoby drugim specem na ten sam ekran

## Uwagi właściciela z pokazu (2026-09-14)

Zgłoszone na żywo po wdrożeniu, poza zakresem pierwotnego planu — trzymane tutaj, bo zamykają ten sam wycinek.

- [x] fixed · `kosztorys-row-actions-menu.tsx` + `kosztorys-section-actions-menu.tsx` · nagłówki „Praca" / „Sekcja" przywrócone — właściciel chce je z powrotem
- [x] fixed · `kosztorys-section-actions-menu.tsx:70-95` · komendy paska nazywają teraz sekcję wprost („Wstaw sekcję powyżej", …, „Dodaj pracę z katalogu do sekcji…")
- [x] fixed · `lib/kosztorys/move-edges.ts` (nowy) · ▲/▼ na krawędzi bloku było cichym no-opem (`sectionNeighbor` / `neighborSectionId` zwracają `undefined`, handler wychodzi). Menu pracy i menu sekcji czytają teraz krawędzie i wygaszają właściwy kierunek; `move-edges.test.ts` przypina zgodność predykatu z ruchem
- [x] fixed · `styles/globals.css` + `cell-menu-trigger.tsx` · barwa ⋯ paska zeszła z utility na regułę w `globals.css` obok pozostałych reguł `--section-rail`; arkusz dsg jest bezwarstwowy, więc `@layer utilities` przegrywa z nim niezależnie od specyficzności — utility zostawiało ikonę na odziedziczonym `text-foreground` (czarnym). Wymaga potwierdzenia okiem: box w `manual-checks.md`
