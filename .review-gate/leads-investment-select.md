# Review-gate ledger — leads + select inwestycji · 2026-09-21

Zakres: `b731a010..HEAD` — 8 commitów, 27 plików, +993/−132. `b731a010` to tip `origin/staging`
i zarazem punkt zamknięcia trzech poprzednich bramek (`lead-delivery` 2026-09-18, `katalog-problems`
i `investment-assets-dialog` 2026-09-21). Nie było tu bramki po mergu do `main` — te trzy to całość
historii.

Ledger leży w fallbacku `.review-gate/`, bo praca nad leadami nie ma folderu zmiany
(`context/changes/`). Nie jest gitignorowany.

## Co odpadło z fan-outu

- `/10x-impl-review` — brak `plan.md` (praca bez folderu zmiany).
- Step 0.5 (przebieg weryfikacyjny w przeglądarce) — stała reguła: nie sterować Playwrightem MCP
  bez wyraźnej prośby w tej turze.

Uruchomione: `/code-review`, `/tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (flag-only, diff-scoped).

## Blokada w trakcie bramki: drzewo ruszyło pod przeglądem

Równoległa sesja rozrosła się z 3 do 10 brudnych plików w czasie fan-outu i objęła całą powierzchnię
leadów/mediów: `lead-assets-dialog.tsx`, `promote-lead-dialog.tsx`, `lead-asset-labels.ts`,
`media-strip.tsx`, `preview-labels.ts`, `form-combobox.tsx`, `types/media.ts`, `queries/leads.ts`,
`zgloszenia/page.tsx` + dwa specy. To jedyne uzasadnione wstrzymanie oparte na pliku, jakie bramka
dopuszcza: pas mutujący nie dotyka plików żywej sesji.

Konsekwencja policzona, nie założona: **trzy findings correctness z `lead-assets-dialog.tsx` okazały
się nieaktualne** — równoległa sesja już je naprawiła (guard `cancelled`, toast na `!result.success`,
reset `attachedIds` przy zmianie celu). Zweryfikowane na pliku z dysku, nie na cytacie agenta.

## Findings

- [x] 🔴 CRITICAL · fixed · code-review · `src/lib/queries/leads.ts:185` · `getLeadsPage` cache'owany
      tylko tagiem `leads`, a wiersz niesie `investmentName` / `investmentAssetIds` z drugiej
      kolekcji — bez `revalidate` tag nigdy nie wygasa, więc usunięcie zdjęcia na stronie inwestycji
      zostawiało zgłoszenie w przekonaniu, że plik wciąż tam jest, i chowało go przed przeniesieniem.
      Dodany `CACHE_TAGS.investments`.
      test: no automated test · — jedyna obserwowalna ścieżka to rewalidacja cross-kolekcyjna;
      unit nie zobaczy tagu, a e2e kosztuje godzinę. Ryzyko pokryte typem: tag jest teraz w liście.
- [x] 🔴 CRITICAL · fixed · code-review · `src/styles/globals.css:245-312` · `gradient-border-comet`
      i `neon-glow-duo-breathe` obie deklarowały skrót `animation`, więc nie dawały się złożyć —
      `animations={['comet','breathe']}` na „Podsumowanie" gubiło jedną z dwóch. Każda utility wnosi
      teraz tylko swój slot `--ai-anim-*`, obie deklarują identyczne dwuslotowe
      `animation: var(--ai-anim-border, none), var(--ai-anim-glow, none)` — niezależne od kolejności
      i odporne na `!important`, bo przypisanie custom property to inna właściwość.
      test: no automated test · — efekt czysto wizualny, jsdom nie ma silnika layoutu ani kaskady.
- [x] 🟡 WARNING · fixed · code-review · `src/styles/globals.css` + `src/components/ui/button.tsx` ·
      blok `@media (prefers-reduced-motion: reduce)` celował w `.gradient-border-comet`, a `!` wstawia
      do atrybutu `class` dosłowny token `gradient-border-comet!` (Tailwind emituje selektor
      `.gradient-border-comet\!`) — reguła nie pasowała do niczego. Zweryfikowane na zbudowanym CSS.
      Blok skasowany, bramką jest wariant `motion-safe:` na call-site.
      test: no automated test · — jak wyżej.
- [x] 🟡 WARNING · dismissed · code-review · `src/components/leads/lead-assets-dialog.tsx` · brak
      guardu odmontowania przy async `investmentAssetIdsAction` — **nieaktualne**: na dysku jest
      `let cancelled` + cleanup w efekcie.
- [x] 🟡 WARNING · dismissed · code-review · `src/components/leads/lead-assets-dialog.tsx` · cicha
      porażka akcji przenoszenia — **nieaktualne**: jest `toastMessage(result.error ?? …, 'error')`.
- [x] 🟡 WARNING · dismissed · code-review · `src/components/leads/lead-assets-dialog.tsx` ·
      `attachedIds` przeżywa zmianę celu — **nieaktualne**: efekt ustawia `null` na każdą zmianę
      `target`, a `carried`/`waiting` czytają `null` jako „nie wiem".
- [x] 🔵 OBSERVATION · dismissed · tailwind-v4-audit · `lead-asset-labels.ts` ·
      `LEAD_ASSET_STRIP_SIZES` niedopasowane do siatki — cytat agenta (`31vw, 110px, 75px`) był już
      nieaktualny w chwili raportu; na dysku stoi `(max-width: 767.98px) 45vw, 150px` przy
      `grid-cols-2 sm:grid-cols-3`, co się zgadza. Zmieniła to równoległa sesja.
- [x] dismissed · tailwind-v4-audit · `src/styles/globals.css` · rzekome martwe
      `gradient-border-spin` / `gradient-border-sweep` — **mój własny nieaktualny przesąd**, wniesiony
      z podsumowania. `git log -S` i grep: ani jeden z tych stringów nie istnieje nigdzie w repo.
      Diff dodaje 1 `@property`, 2 `@keyframes`, 2 `@utility`.
- [x] fixed · feature-first-structure + module-cohesion + structure-scatter ·
      `src/lib/actions/investment-assets.ts:37-49` · `investmentAssetIdsAction` to czysty odczyt
      w warstwie mutacji; wg AGENTS.md należy do `src/lib/queries`. Trzy audyty zbiegły się na tym
      jako jedynym naruszeniu zapisanego miejsca w całym diffie. Najpierw odroczone (call-site
      trzymała równoległa sesja) i zgłoszone jako EX-841; na prośbę użytkownika domknięte w tej
      samej sesji, EX-841 zamknięty jako Done.
      Wylądowało w osobnym `src/lib/queries/investment-asset-ids.ts` (`'use server'`), a nie jako
      eksport z `queries/investment-assets.ts`: `'use server'` obowiązuje cały moduł, a tamten
      importują komponenty serwerowe, które muszą zostać zwykłym wywołaniem — nie RPC i nie
      zaślepką `stubServerActions`. Nazwa `getInvestmentAssetIds`, bo sufiks `Action` w warstwie
      odczytu byłby kłamstwem.
- [x] fixed · comment-noise · `src/components/investments/investment-assets.tsx` · polski komentarz
      przy `visibleFiles.length === 0` — AGENTS.md wymaga angielskich komentarzy w kodzie, a ten
      dublował angielski 12 linii wyżej. Skasowany, angielski został w całości.
- [x] fixed · comment-noise · `src/components/ui/button.tsx` · komentarz twierdził nieprawdę
      („`breathe` rusza tylko `box-shadow`, więc nie potrzebuje `!`") i nie tłumaczył, czemu `comet`
      ma `!`. Przepisany na powód, którego kod nie powie: escaping `!`, bramka `motion-safe:`
      i to, że stan spoczynkowy wariantu `ai` JEST zamierzonym stanem bez ruchu.
- [x] dropped · comment-noise · `src/__tests__/lib/actions/promote-lead.db.test.ts:164` · „Both ids,
      including the one the investment already holds." — na granicy restatementu, ale niesie stan
      fixture'a ustawiony wyżej. Nie warte churnu.
- [x] fixed · comment-noise · `src/__tests__/components/investments/investment-assets.test.tsx:59`
      i `src/components/leads/lead-assets-dialog.tsx:39` · polskie komentarze w kodzie łamią regułę
      AGENTS.md. Najpierw odłożone (jeden poza diffem, drugi w pliku równoległej sesji), na prośbę
      użytkownika przetłumaczone na angielski — oba niosą powód, więc tłumaczenie, nie kasowanie.
      Trzeci (`„Na dotyku nie ma hovera…"`) zniknął sam: równoległa sesja skasowała cały blok
      `<Description>`, przy którym stał.
- [x] dropped · code-review · `src/components/leads/lead-assets-dialog.tsx` · `selectedIds` przeżywa
      zmianę inwestycji docelowej. Nieszkodliwe: `chosenIds` filtruje przez `waiting`, więc plik już
      obecny w nowym celu wypada z zaznaczenia sam. Zaskoczenie, nie defekt.

## Simplify pass

Nie uruchomiony jako szeroki pas mutujący — bramka zakazuje puszczania `/simplify` po plikach,
które trzyma równoległa sesja, a dziesięć brudnych plików to dokładnie powierzchnia leadów, czyli
większość diffu. Czysty podzbiór (`globals.css`, `button.tsx`, `investment-assets.tsx`,
`investment-assets.ts`, `types/leads.ts`, `leads-data-table.tsx`, `e2e/share-link.ts`,
`promote-lead.db.test.ts`) przeszedłem ręcznie w tej samej optyce — wszystkie komentarze poza
wymienionymi wyżej przechodzą STRIP TEST, żadnej duplikacji do scalenia.

0 applied, 0 proposed, 0 dismissed; findings z ręcznego przebiegu są w `## Findings` (tag
`comment-noise`).

## Tests & suite

- `pnpm typecheck` — czysty.
- `pnpm vitest run` (node + dom) — **3737 passed, 12 failed, 312 skipped** w 383 plikach.
  Wszystkie 12 porażek to `Test timed out in 5000ms`, nie asercje. Przebieg pokazał 1115 s samego
  `import` przy 221 s ścianie — maszyna dzielona z równoległą sesją. Sprawdzone: dwa z sześciu
  padających plików (`work-catalogue-item-form.test.tsx`,
  `kosztorys-global-settings.test.tsx`) puszczone osobno przechodzą — **8 passed w 4,08 s**.
  To flake od kontencji, nie regresja.
- `pnpm test:e2e` — nie uruchamiane (stała reguła: nigdy bez wyraźnej prośby, ~1 h).

## Domknięcie po bramce (na prośbę użytkownika)

Dwie rzeczy odłożone z powodu brudnego drzewa zostały dociągnięte w tej samej sesji, bo użytkownik
o to poprosił wprost:

- przeniesienie odczytu do `src/lib/queries` (EX-841 → Done),
- oba polskie komentarze przetłumaczone na angielski.

Weryfikacja po tych zmianach: `tsc --noEmit` czysty; `lead-assets-dialog.test.tsx` +
`investment-assets.test.tsx` — 12 passed w 2,27 s.
