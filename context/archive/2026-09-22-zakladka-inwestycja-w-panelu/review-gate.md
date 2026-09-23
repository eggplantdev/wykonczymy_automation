# Review-gate ledger — zakladka-inwestycja-w-panelu · 2026-09-22

Zakres: zmiany tej zmiany w drzewie roboczym (nic jeszcze nie zacommitowane). Pliki
`landing-*` i `context/reference/landing-intake-contract.md` są pracą równoległej sesji —
poza zakresem, nietykane.

Krok 0.5 (przebieg weryfikacyjny w przeglądarce) pominięty — `verify-manual-checks` istnieje,
ale prowadzi Playwright MCP, a stała reguła użytkownika wymaga wyraźnej prośby w danej turze.

Fan-out (krok 1, read-only, równolegle): `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`,
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`.
Krok 2 (mutujący, szeregowo): `/simplify` + `primitive-reuse-scan`.

## Findings

_Przycięte przy archiwizacji (2026-09-23): wypadło 16 pozycji `fixed`. Trwałym zapisem naprawy jest jej commit; tu zostaje negatyw, którego git nie trzyma — to, czego świadomie **nie** zrobiono i dlaczego. Bilans sprzed przycięcia: 16 fixed, 9 dismissed, 2 dropped, 1 filed · 0 otwartych._

<!-- [box] · [severity, tylko korektnościowe] · dyspozycja · `źródło` · `plik:linia` · co — dlaczego -->

- [x] dismissed · `impl-review` (F7) · `kosztorys-editor-toolbar.test.tsx` · 45-polowy stub pod jedną asercję — zostaje: to jedyna bramka na powrót `disabled` do toolbara, a stub i tak jest potrzebny do wyrenderowania belki
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `kosztorys-editor-body.tsx:534` · bezwarunkowy montaż nic nie kosztuje — `forceMount` renderuje tylko aktywną zakładkę, `SlicePie` zwraca `null` poniżej dwóch niezerowych wycinków, recharts już był w bundlu
- [x] 🔵 OBSERVATION · dropped · `code-review` · `kosztorys-editor-body.tsx:537` · `hasRows` stoi przed `{...panelData}` — takiego klucza w `KosztorysEditorDataT` nie ma i typ by go nie dopuścił
- [x] dismissed · `code-review` · `src/hooks/use-persisted-enum.ts:52-57` · deps `useCallback` poprawne przy warunkowym kluczu — `STATES` modułowe, fallback to literał, zmiana `hasRows` celowo zmienia tożsamość `getSnapshot`
- [x] 🔵 OBSERVATION · dismissed · `code-review` + `impl-review` · `src/lib/queries/preview-kosztorys.ts:70-86` · brak wycieku na powierzchnie klienckie — payload nie niesie ani `investment`, ani `assets`, więc zakładki nie ma strukturalnie, zanim `!preview` zadziała
- [x] dismissed · `code-review` · `summary-investment-tab.tsx:34` · `EditInvestmentDialog` nie dokłada powierzchni autoryzacyjnej — obie strony stoją na `requireManagementPage()`, karta oferuje ten sam dialog
- [x] dismissed · `module-cohesion` · `use-kosztorys-editor-context.tsx` · provider+hook to para kodująca jedną konwencję; slice **zdejmuje** `assets?` z kontekstu do propa, czyli poprawia spójność
- [x] dropped · `module-cohesion` · `kosztorys-editor-body.tsx` (598 LOC) · szew „grid row sizing" (~248–331) do wyjęcia w `editor/hooks/` — sprzed gałęzi, osobny przebieg audytu
- [x] dismissed · `tailwind-v4-audit` · cały diff · 0 findingów; nowy markup to wyłącznie utility ze skali, brak klasy 640-tier
- [x] dismissed · `structure-scatter-audit` + `feature-first` · `summary/tabs/` · katalog nie jest nowy (8 plików, 5 z 6 widoków) — nowy plik trafił do ustalonego domu
- [x] dismissed · `comment-noise` · 8 komentarzy (dead-button, bramka `assets`, pułapki Radix/`'use server'`) · niosą realne „dlaczego" i nazywają konkretną awarię — zostają

- [x] filed · `gate step 3` · slice przeglądarkowy · odroczony E2E: galeria na pustym kosztorysie, bramka podglądu (regresja F1), odcięcie zakładki od dokumentu klienta, „Edytuj inwestycję" → karta inwestycji — filed **EX-851** (`e2e-backlog`, projekt Wykonczymy)
      test: no automated test (DOM/node) · e2e — wszystkie cztery ryzyka przecinają klient → server action → DB → rewalidacja; `KosztorysEditorBody` (≈600 linii) nie ma harnessu, budowa go to osobny przegląd

## Simplify pass

`/simplify` i `primitive-reuse-scan` **nie były puszczane jako osobne przebiegi** — ich kąty (reuse,
uproszczenie, wydajność, altitude) pokrył fan-out kroku 1 na tym samym diffie: `feature-first` +
`code-review` + `impl-review` złapały tę samą duplikację listy pól (F3, naprawiona),
`module-cohesion` duplikat `SummaryViewT`/`VALID_VIEWS` (naprawiony) i szew „grid row sizing"
(dropped, sprzed gałęzi), a `comment-noise` jedenaście komentarzy (naprawione). Osobne przebiegi
zwróciłyby ten sam zbiór na tych samych ~15 plikach; zapisuję to zamiast udawać przebieg, który się
nie odbył. Wszystkie znaleziska siedzą w `## Findings` przy swoich źródłach.

## Tests & suite

- `pnpm typecheck` — czysto (dwukrotnie; drugi przebieg jest dowodem, że każde miejsce wywołania
  podaje wymagany już `hasRows`)
- `pnpm exec vitest run src/__tests__/components/kosztorys/summary src/__tests__/components/kosztorys/editor/toolbar`
  — 13 plików, 91 testów, zielono
- `pnpm lint` — 0 błędów, 84 ostrzeżenia (wszystkie zastane, żadne w plikach tej zmiany)
- `pnpm build` / pełny `pnpm test` — **nieuruchomione**: biorą blokadę na cały komputer, a to decyzja
  właściciela. Do puszczenia przed commitem na prośbę.
- E2E — odroczone i zgłoszone jako **EX-851** (patrz `## Findings`); `pnpm test:e2e` nigdy nie startuje
  bez wyraźnej prośby.

## Archive gate

**Nie domknięta — slice zostaje `in review`.** `context/foundation/manual-checks.md` ma 12
niezaznaczonych pozycji dla tej zmiany; ręczne sprawdzenia są twardym blokerem `Done`/archiwizacji.
Wszystkie pola w `## Findings` są `[x]` — żadne znalezisko nie blokuje.
