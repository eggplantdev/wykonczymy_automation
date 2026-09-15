# Review-gate ledger — kosztorys-row-height-menu · 2026-09-14

Zakres: 9 plików (7 zmienionych + `row-height-menu-items.tsx`, `row-height-fit-context.tsx`).

Fan-out: `/10x-impl-review`, `/code-review`, placement (feature-first + scatter, diff-scoped),
`module-cohesion-audit`, `comment-noise-audit` (flag-only).
`tailwind-v4-audit` odpadł — diff nie rusza stylów ani klas.
Krok 0.5 (przebieg w przeglądarce) pominięty — agent nie steruje Playwrightem bez polecenia w turze.

## Findings

- [x] dismissed · placement · `src/components/kosztorys/editor/grid/menus/row-height-menu-items.tsx` · audyt potwierdza: fragment menu mieszka obok menu, które go renderuje (jak `section-color-picker.tsx`)
- [x] dismissed · module-cohesion · caly slice · 0 findingów; trzy flagi skanera odrzucone (typ kontraktu `RowResizeApiT`, para provider+hook, LOC `kosztorys-editor-body.tsx`), trzy pliki wyraźnie bardziej spójne niż przed zmianą
- [x] dropped · module-cohesion · `src/components/kosztorys/editor/kosztorys-editor-body.tsx` · proponowana ekstrakcja `use-row-height-measurement.ts` dotyczy klastra, którego 8 z 9 członków jest starsze niż ta gałąź — nie jest findingiem tego slice'a

- [x] dismissed · comment-noise · `row-height-fit-context.tsx:15` + `row-height-menu-items.tsx:10` · duplikat argumentu o Radix mount-on-demand zostaje: jedna strona to powód istnienia kontekstu, druga powód istnienia komponentu
- [x] dismissed · comment-noise · `row-height.test.ts:87` · powtórzenie inwariantu w teście, który go pilnuje — uzasadnione

- [x] dismissed · code-review · cały diff · `/code-review high`: 0 findingów korektnościowych; zweryfikowane osobno: guard `moved !== 0`, tożsamość wartości kontekstu (EX-496), brak osieroconego `DropdownMenuSeparator`, brak sierot po `onFit`, wiersze syntetyczne nie docierają do komendy
- [x] dismissed · code-review · pasma sekcji · podłoga `SECTION_BAND_ROW_HEIGHT` w `fitRowHeight` nie ma dziś wywołania z UI — świadome wykluczenie zapisane w `plan.md`; stary dwuklik na paśmie i tak był no-opem
- [x] dismissed · code-review · nieusuwalny override przy włączonym „Dopasuj wysokość wierszy" · decyzja właściciela zapisana w `change.md` pkt 2–3

- [ ] deferred · impl-review (F1) · `context/foundation/manual-checks.md` · cztery punkty weryfikacji ręcznej z planu nie mają sekcji w rejestrze — przebieg w przeglądarce nieodbyty; weryfikacja ręczna nie blokuje „Done" od 2026-07-28, więc zmiana zamknięta z tym punktem otwartym
- [x] filed EX-776 · impl-review (F2) · `grid/ordinal-gutter-column.tsx:33` · pasmo sekcji i wiersz nagłówka dalej można wciągnąć w nieodwracalne nadpisanie, a podłoga `SECTION_BAND_ROW_HEIGHT` w `fitRowHeight()` nie ma dziś ścieżki z UI; plan wymagał zgłoszenia po fazie 3

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
