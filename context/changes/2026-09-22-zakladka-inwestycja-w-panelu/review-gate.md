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

<!-- [box] · [severity, tylko korektnościowe] · dyspozycja · `źródło` · `plik:linia` · co — dlaczego -->

- [x] 🟡 WARNING · fixed · `code-review` + `impl-review` (F1) · `kosztorys-editor-body.tsx:391,536` · przycisk podglądu dostawał `disabled`, ale nie `hasRows`, a panel `hasRows` zawsze — na podglądzie z pustym kosztorysem czytały dwa różne klucze localStorage; gdy właściciel wcześniej rozwinął panel na świeżej inwestycji, „Podgląd dla inwestora" pokazywał pełnoekranową nakładkę samych zer z nieaktywnym przyciskiem. Zdjęcie bramki montowania objęło też `preview`, choć plan zostawiał podgląd bez zmian. **Naprawa:** dokument klienta zachowuje bramkę (`{(!preview || subtotals.length > 0) && …}`), a oba przełączniki podglądu dostają `hasRows`
      test: type-level guard · `hasRows` wymagany (F2) — tsc wskazuje każde miejsce wywołania, które by go pominęło; bramka `preview` to warunek renderu w 600-linijkowym komponencie bez harnessu, więc pokryta ręcznym sprawdzeniem, nie nowym specem
- [x] 🟡 WARNING · fixed · `impl-review` (F2) · `kosztorys-totals-panel.tsx:12`, `kosztorys-totals-panel-toggle.tsx:19` · `hasRows` miał domyślne `true` na trzech warstwach, więc pominięty prop nie wywalał `tsc`, tylko po cichu wiązał inny klucz — dokładnie tak powstał F1; prop jest teraz wymagany na obu kontrolkach (hook zachowuje domyślną wartość)
- [x] 🟡 WARNING · fixed · `feature-first` + `code-review` + `impl-review` (F3) · `summary-investment-tab.tsx` vs `inwestycje/[id]/page.tsx` · ta sama siedmiopolowa lista w dwóch katalogach — wyjęta do `components/investments/investment-info-fields.tsx` (`buildInvestmentInfoFields`, filtr w środku), oba ekrany ją wołają
- [x] 🟡 WARNING · fixed · `impl-review` (F4) · `summary-investment-tab.tsx` · nagłówek „Zdjęcia i pliki" nad przyciskiem „Dokumentacja" — dwie nazwy na jedną kontrolkę; nagłówek skasowany przy okazji przeniesienia „Edytuj inwestycję" do jednego rzędu z „Dokumentacją" (prośba właściciela w trakcie bramki)
- [x] fixed · `module-cohesion` · `hooks/use-summary-view.ts` · `SummaryViewT` i `VALID_VIEWS` to były te same sześć literałów zapisane dwa razy w jednym pliku — typ wywodzi się teraz z tablicy
- [x] fixed · `comment-noise` + `impl-review` (F5) · `src/lib/kosztorys/types.ts:178` · „so the toolbar can mount the card's gallery" przestało być prawdą wraz z tym slice'em
- [x] fixed · `impl-review` (F5) · `hooks/use-summary-view.ts:5-7` · „„Podwykonawcy" i „Marża" są owner-only" — od tego slice'a są trzy takie zakładki
- [x] fixed · `comment-noise` + `impl-review` (F5) · `kosztorys-editor-body.tsx:389` · „stays here where the owner's toolbar dropped it" — vanished-state; komentarz przepisany razem z naprawą F1
- [x] fixed · `comment-noise` · `allowed-summary-views.ts:16,11` · docblock powtarzał trzy `if`-y w tej samej kolejności; komentarz pola powtarzał jego własną nazwę
- [x] fixed · `comment-noise` · `kosztorys-editor-body.tsx:531` · ogon o `hasRows` narratował wnętrze `use-totals-panel-open.ts` w miejscu wywołania
- [x] fixed · `comment-noise` · `hooks/use-totals-panel-open.ts:14` · „Same split `useSummaryView` makes…" — „robimy tak też gdzie indziej", bez konsekwencji
- [x] fixed · `comment-noise` · `summary-investment-tab.tsx:18` · nagłówek uzasadniał istnienie funkcji, nie kod — zniknął wraz z wyjęciem listy pól
- [x] fixed · `comment-noise` · `summary-panel-content.tsx:136,139` · kontrakt `undefined`/`[]` opisany po raz trzeci — zwinięty do jednego odesłania do `KosztorysEditorDataT`
- [x] fixed · `impl-review` (F6) · `summary-panel-content.test.tsx:141` · jedyny polski komentarz w diffie — przetłumaczony (nazwy testów zostają polskie, tak jak w całym pliku)
- [x] fixed · `comment-noise` · `kosztorys-editor-toolbar.test.tsx:77` · „now carries" datowało komentarz względem stanu niewidocznego dla czytelnika
- [x] fixed · `comment-noise` · `summary-investment-tab.test.tsx:45` · komentarz uzasadniał feature, nie asercję — proza z `context/` w specu
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
