# Review-gate ledger — kosztorys-row-height-menu · 2026-09-14

Zakres: 9 plików (7 zmienionych + `row-height-menu-items.tsx`, `row-height-fit-context.tsx`).

Fan-out: `/10x-impl-review`, `/code-review`, placement (feature-first + scatter, diff-scoped),
`module-cohesion-audit`, `comment-noise-audit` (flag-only).
`tailwind-v4-audit` odpadł — diff nie rusza stylów ani klas.
Krok 0.5 (przebieg w przeglądarce) pominięty — agent nie steruje Playwrightem bez polecenia w turze;
wraca jako blokada „manual verification" w kroku 4.

## Findings

- [x] fixed · placement · `src/components/kosztorys/editor/grid/row-height-fit-context.tsx` · context host trafił do `grid/`, a obie istniejące instancje tego rodzaju (`catalogue-picker-host.tsx`, `kosztorys-actions-context.tsx`) mieszkają w `editor/actions/` — przeniesiony do `editor/actions/row-height-fit-context.tsx`, dwa importy zaktualizowane
- [x] dismissed · placement · `src/components/kosztorys/editor/grid/menus/row-height-menu-items.tsx` · audyt potwierdza: fragment menu mieszka obok menu, które go renderuje (jak `section-color-picker.tsx`)
- [x] dismissed · module-cohesion · caly slice · 0 findingów; trzy flagi skanera odrzucone (typ kontraktu `RowResizeApiT`, para provider+hook, LOC `kosztorys-editor-body.tsx`), trzy pliki wyraźnie bardziej spójne niż przed zmianą
- [x] dropped · module-cohesion · `src/components/kosztorys/editor/kosztorys-editor-body.tsx` · proponowana ekstrakcja `use-row-height-measurement.ts` dotyczy klastra, którego 8 z 9 członków jest starsze niż ta gałąź — nie jest findingiem tego slice'a

- [x] fixed · comment-noise · `kosztorys-editor-body.tsx:307` · przeterminowana resztka po diffie — „the drag's «dopasuj»" opisywało skasowany dwuklik; teraz wskazuje na „Dopasuj wysokość do treści"
- [x] fixed · comment-noise · `kosztorys-editor-body.tsx:383` · komentarz o `CataloguePickerHost` został osierocony przez wstawiony między nie `RowHeightFitProvider` — przeniesiony bezpośrednio nad swój podmiot
- [x] fixed · comment-noise · `kosztorys-row-actions-menu.tsx:91` · skasowany — „destructive ostatni" powtarzał kolejność JSX i `variant="destructive"`
- [x] fixed · comment-noise · `kosztorys-row-actions-menu.tsx:27` · przycięty — „The whole row, not its id" powtarzało sygnaturę propa
- [x] fixed · comment-noise · `row-height.ts:29` · przycięty — lead narratorował `Math.max(...)` z następnej linii; został powód z pasmem 52
- [x] fixed · comment-noise · `row-resize-handle.tsx:19` · przycięty — „What the handle says it does." powtarzało nazwę propa
- [x] fixed · comment-noise · `kosztorys-editor-body.tsx:291` · ten sam powód („pomiar wymaga szerokości kolumn") stał w dwóch plikach; zostaje w `row-height-fit-context.tsx`, w body tylko unikalna część o wirtualizacji kolumn
- [x] dismissed · comment-noise · `row-height-fit-context.tsx:15` + `row-height-menu-items.tsx:10` · duplikat argumentu o Radix mount-on-demand zostaje: jedna strona to powód istnienia kontekstu, druga powód istnienia komponentu
- [x] dismissed · comment-noise · `row-height.test.ts:87` · powtórzenie inwariantu w teście, który go pilnuje — uzasadnione

- [x] dismissed · code-review · cały diff · `/code-review high`: 0 findingów korektnościowych; zweryfikowane osobno: guard `moved !== 0`, tożsamość wartości kontekstu (EX-496), brak osieroconego `DropdownMenuSeparator`, brak sierot po `onFit`, wiersze syntetyczne nie docierają do komendy
- [x] fixed · code-review · `row-resize-handle.tsx:14` · resztka po dwukliku w komentarzu `minHeight` („and what a fit falls back to") — usunięta
- [x] dismissed · code-review · pasma sekcji · podłoga `SECTION_BAND_ROW_HEIGHT` w `fitRowHeight` nie ma dziś wywołania z UI — świadome wykluczenie zapisane w `plan.md`; stary dwuklik na paśmie i tak był no-opem
- [x] dismissed · code-review · nieusuwalny override przy włączonym „Dopasuj wysokość wierszy" · decyzja właściciela zapisana w `change.md` pkt 2–3

- [ ] deferred · impl-review (F1) · `context/foundation/manual-checks.md` · cztery punkty weryfikacji ręcznej z planu nie mają sekcji w rejestrze — przebieg w przeglądarce nieodbyty, to jedyna rzecz blokująca archiwizację
- [x] filed EX-776 · impl-review (F2) · `grid/ordinal-gutter-column.tsx:33` · pasmo sekcji i wiersz nagłówka dalej można wciągnąć w nieodwracalne nadpisanie, a podłoga `SECTION_BAND_ROW_HEIGHT` w `fitRowHeight()` nie ma dziś ścieżki z UI; plan wymagał zgłoszenia po fazie 3
- [x] fixed · impl-review (F3) · `actions/row-height-fit-context.tsx:13` · komentarz cytował `CataloguePickerHost` jako wzorzec KSZTAŁTU; kształt to `KosztorysActionsProvider` (bezstanowy provider + hook), `CataloguePickerHost` zostaje jako powód „kontekst, nie columnData"
- [x] fixed · impl-review (F4) · `plan.md` (faza 2) · ścieżka pliku poprawiona na `actions/` zgodnie z przeniesieniem
- [x] fixed · impl-review (F5) · `plan.md` („What We're NOT Doing") · zdanie „da się je zdjąć" przeczyło temu, co weszło — zastąpione przyjętą konsekwencją

## Simplify pass

Przebieg w wątku głównym, bez fan-outu czterech agentów — diff to 9 plików, a `/code-review high`
przejechał już ten sam zakres (reuse/simplification/efficiency/altitude) z zerem findingów.
Wynik: 0 nowych findingów; jedyna zmiana to zawinięcie przedłużonego komentarza w
`kosztorys-editor-body.tsx:303`. Wszystko inne zostało już naprawione w triage'u wyżej.

## Tests & suite

- `pnpm typecheck` — czysty (dwa przebiegi: po przeniesieniu pliku i po poprawkach komentarzy).
- `pnpm lint` — 0 errors (83 ostrzeżenia, wszystkie prekursywne, w `src/migrations/**`).
- `pnpm exec vitest run src/__tests__/lib/kosztorys/row-height.test.ts` — 16/16, w tym trzy nowe
  przypadki `fitRowHeight`.
- `pnpm exec vitest run src/__tests__/lib/kosztorys src/__tests__/components/kosztorys` — 1177
  passed / 43 skipped, 100 plików.
- Nowych testów krok 3 nie dopisuje: logika dopasowania to `fitRowHeight`, już pokryta jednostkowo,
  a reszta zmiany to przeniesienie triggera (menu zamiast dwukliku).
- **E2E**: dług spłacony przez **EX-757** (label `e2e-backlog`) — issue zaktualizowane o zmianę
  gestu, spec ma sterować menu, nie dwuklikiem.
- Pełna suita (`test:e2e`, `build`) — nieuruchomiona, czeka na zgodę właściciela.
