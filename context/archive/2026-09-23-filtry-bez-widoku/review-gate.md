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

_Przycięte przy archiwizacji (2026-09-23): wypadło 34 pozycji `fixed`. Trwałym zapisem naprawy jest jej commit; tu zostaje negatyw, którego git nie trzyma — to, czego świadomie **nie** zrobiono i dlaczego. Bilans sprzed przycięcia: 34 fixed, 9 dismissed, 2 skipped, 2 filed, 1 dropped · 0 otwartych._

<!-- ONE checkbox per finding; format:
     [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — why
     Duplikaty z kilku agentów scalone w jedną linię, ze wszystkimi źródłami. -->

### 🟡 WARNING

- [x] 🟡 WARNING · **skipped (decyzja właściciela)** · `code-review` · `src/lib/kosztorys/row-conditions/registry.ts:222,242` · filtr „bez kwoty stałej powyżej sufitu" łapie też każdą pozycję na „auto" (377/377 zamiast 236 na zestawie QA) — **celowe**, `registry.ts:200-206` mówi to wprost („The complement is therefore stated by negation"). Zachowanie zmieniające to, co użytkownik MOŻE zrobić, więc nie stosujemy auto-fixa; pytanie zostaje otwarte dla właściciela w `manual-checks.md`.
      test: brak automatu · — pin zachowania dopiero po rozstrzygnięciu właściciela; dziś zapinałby wariant, który może się zmienić.

### 🔵 OBSERVATION

- [x] 🔵 OBSERVATION · **filed EX-858** · `code-review` · `src/lib/actions/work-catalogue.ts:128,360` · `listWorkCatalogueAction` / `catalogueSavePreviewAction` to odczyty na żądanie, zostały w katalogu mutacji, podczas gdy bliźniacza para presetów przeniosła się do `lib/queries` — `catalogueSavePreviewAction` dzieli prywatny `catalogueSaveState` z mutacją, więc rozdzielenie zasługuje na własne review.
- [x] 🔵 OBSERVATION · **dismissed** · `code-review` · `src/components/kosztorys/editor/hooks/use-workshop-mirror-flush.ts:34` · rewizja stemplowana przed dojściem zapisu; komentarz sam deklaruje best-effort, a ścieżka `visibilitychange` jest dodatkowym, nie jedynym momentem — nota, nie defekt.
      test: brak automatu · — zapisanie tego kontraktu wymagałoby pinu na teardown przeglądarki, czyli E2E za cenę niewspółmierną do skutku (opóźnione `updated_at`).
- [x] 🔵 OBSERVATION · **dropped** · `impl-review` · `context/changes/2026-09-22-szablon-autosave/plan.md` (Progress 3.3) · proza planu opisuje kształt sprzed EX-843 — trwałym zapisem jest adnotacja na `review-gate.md` tego slice'a, a spec `use-workshop-mirror-flush.test.tsx:23-24` faktycznie steruje `visibilitychange`, więc luka pokrycia nie istnieje.
- [x] 🔵 OBSERVATION · **skipped** · `impl-review` · `src/lib/kosztorys/work-catalogue/create-section-with-catalogue-items.ts` · gałąź fallbacku re-derywuje `appendCatalogueItems` wbrew klauzuli „rather than" z kontraktu — obronne: helper bierze `sectionId`, a fallback ma tylko nazwę; ujednolicenie to zmiana sygnatury helpera, czyli refaktor na własne review.

### comment-noise

- [x] **dismissed** · `comment-noise` · `e2e/**` · zero findingów: prawie każdy „dodany" komentarz to przeniesiony tekst z `helpers.ts` (EX-816), zweryfikowane diffem zbiorów komentarzy.

### struktura plików

- [x] **dismissed** · `module-cohesion` · `src/components/kosztorys/editor/use-kosztorys-editor.ts` (1333 l.) · god-module po rozmiarze — AGENTS.md wyznacza go punktem kompozycji, EX-515 świadomie odroczył podział, a zakres go **zmniejszył** (1336 → 1333), rozprowadzając cztery nowe klastry do liści w `editor/hooks/`.
- [x] **dismissed** · `feature-first-structure` · lustrzane ścieżki speców, `.tsx` dla `renderHook`, domy hooków, kierunek importów w `ui/`, trio `*-model.ts`, `preset-pickers.ts`, `filter-groups.ts` · każde trafia w udokumentowaną regułę projektu; szczegóły w raporcie agenta.

### reuse / dedup

- [x] **dismissed** · `reuse` · `src/components/filters/filter-multi-select.tsx:239-249` · reduktor `toggleRuns` vs jednolinijkowe wykrywanie serii w `dropdown-check-groups.tsx` — cmdk potrzebuje realnych `CommandGroup`, więc zostaje struktura pośrednia; sam predykat to jedno porównanie, wygrana nie pokrywa churnu.
- [x] **dismissed** · `reuse` · `filters-menu-model.ts:4-14` + `problems-menu-model.ts:3-11` + `ui/dropdown-check-groups.tsx:12-19` · trzy deklaracje `{id,label,groupLabel,active}` — `active` niesie **przeciwne** znaczenie domenowe (odhaczony filtr = NIE zaangażowany, odhaczony problem = wciśnięty), a aliasowanie uzależniłoby moduły React-free od kontraktu komponentu `'use client'`.
- [x] **dismissed** · `reuse` · `filters-menu-model.ts:52-53` + `problems-menu-model.ts:41-47` · próg `isWorthOffering` — parametry (`id`, `counts`, `engagedIds`) są dłuższe niż ciało; helper nie kupuje nic poza nazwą.
- [x] **dismissed** · `reuse` · `src/lib/kosztorys/subcontractor-price-guard.ts:60` · `|| coeff <= 0` nieosiągalne z `coeffWarning` — predykat jest **celowo** jednym źródłem reguły flagowania, wspólnym z czerwonym polem mnożnika; wklejenie `coeff > MAX_CLIENT_SHARE` rozwidliłoby te dwa odczyty.

### pokrycie testami

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
