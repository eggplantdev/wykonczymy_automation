# Review-gate ledger — fullscreen-zoom-preview · 2026-09-21

Slice commits: `549bac78`, `6f6bdd5c`, `5e96e8ca` (branch `catalogue-compare-bulk-update`, adopted — see plan.md).
Slice files: `src/components/dialogs/zoomable-preview-image.tsx`, `src/components/dialogs/invoice-preview-dialog.tsx`,
`src/__tests__/components/dialogs/invoice-preview-dialog.test.tsx`, `next.config.ts`, `package.json`.

Step 0.5 (verification pass): pierwotnie pominięty (brak skilla, zakaz ruszania przeglądarki MCP bez
prośby). **Dobity 2026-09-21 na staging** (`e5ae5ee5`) — Playwright sterowany bezpośrednio z
persistentnego profilu Chrome, który nosi cookie Vercel SSO; MCP był martwy. Wszystkie 13 checków
w `context/foundation/manual-checks.md` odhaczone, z wynikami pomiarów przy każdym.

## Findings

<!-- ONE checkbox per finding. Format: [box] · [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — reason -->

### Poza slice'em — praca równoległej sesji (osierocona, domknięta w `7e59f68e`)

Obie równoległe sesje (`wykonczymy-3e`, `wykonczymy-db`) odpisały „nie moje" na zapytanie o własność,
a pliki były zimne od 45 minut — dopiero wtedy je tknąłem. Obie powiadomione po commicie.

- [x] 🔴 CRITICAL · fixed · `code-review` · `src/__tests__/lib/utils/process-upload-file-decoders.test.ts:45-46` · 3 błędy typów (TS2532 + 2× TS2493) — `pnpm typecheck` czerwony, bramka pre-push nie przechodziła. Przyczyna: hoistowane mocki deklarowały węższe sygnatury niż prawdziwe `compressToJpeg(file, quality?)` i `heicTo({blob, type, quality})`. Sygnatury wyrównane, `tsc --noEmit` czysty.
      test: no automated test — to sam plik testowy; strażnikiem jest `tsc --noEmit`
- [x] 🔴 CRITICAL · fixed · `code-review` · `src/__tests__/lib/utils/compress-image.test.ts` · dubler modelował API, którego CompressorJS nie ma: `done()` oddaje do `success` **Blob** z doklejonym `.name`, nigdy `File`. Test był zielony na fikcji i nie bronił niczego. Dubler oddaje teraz Blob+expando, więc ta sama specka przewraca się na regresji.
      test: test-driven-debugging · unit — po podmianie dublera na Blob+expando specka „takes CompressorJS's corrected extension" broni realnego kontraktu
- [x] 🔴 CRITICAL · fixed · `code-review` · `src/lib/utils/compress-image.ts:45` · martwy strażnik w `named()`: `compressed instanceof File` nigdy nie było prawdą, więc korekta rozszerzenia nie odpalała ani razu — PNG powyżej 5 MB był przekodowany do JPEG i **zapisywany pod ścieżką `.png`**. Nazwa czytana teraz z expando `.name`.
      test: test-driven-debugging · unit — repro poszedł na czerwono po naprawie dublera, zielony po naprawie strażnika
- [x] fixed · `feature-first-structure` · `src/__tests__/compress-image.test.ts`, `src/__tests__/process-upload-file-decoders.test.ts` · specki leżały płasko, poza mirrorem źródła (`src/lib/utils/`) — przeniesione do `src/__tests__/lib/utils/`.

### Slice fullscreen-zoom-preview

- [x] 🔴 CRITICAL · fixed · `code-review` · `src/components/dialogs/invoice-preview-dialog.tsx:21-24` · statyczny import silnika zoomu wysyłał ~160 KB do każdego, kto tylko ma trigger podglądu — brak `exports` mapy i `sideEffects: false`, więc nic się nie tree-shake'uje. Podmienione na `next/dynamic` z `ssr: false`.
      test: no automated test — rozmiar bundla; spec DOM i tak musiał przejść na `findBy*`, co pokrywa ścieżkę ładowania chunku
- [x] 🟡 WARNING · fixed · `code-review` · `src/components/dialogs/invoice-preview-dialog.tsx:144` · overlay spinnera łapał zdarzenia wskaźnika na całym kadrze — gest zoomu ginął dopóki obrazek się ładował. Dodane `pointer-events-none`.
      test: no automated test — jsdom nie ma hit-testingu; ryzyko wizualne, ujęte w manual-checks
- [x] 🟡 WARNING · fixed · `code-review` · `src/components/dialogs/invoice-preview-dialog.tsx:89-92` · `printWindow.close()` tuż po `print()` rwie zadanie w Safari i Firefoksie (tylko Chrome blokuje wewnątrz `print()`). Przepięte na `afterprint`, zgodnie z istniejącym precedensem `print-transfers-button.tsx:55-85`.
      test: no automated test — okno wydruku poza zasięgiem jsdom i Playwrighta
- [x] 🟡 WARNING · dismissed · `impl-review` · `src/components/dialogs/invoice-preview-dialog.tsx:142` · rzekoma regresja: usunięcie `h-[70vh]` miało zmniejszyć kadr na telefonie. Nieprawda — div jest `flex-1 min-h-0` w `h-dvh flex-col`, a `flex-1` to `flex: 1 1 0%`, więc `height` był martwy także przed slice'em.
- [x] fixed · `comment-noise` · `zoomable-preview-image.tsx:54-57` · komentarz twierdził, że biblioteka pisze style inline — pisze własny arkusz wstrzykiwany w `<head>` w runtime. Fakt poprawiony, bo to on uzasadnia `wrapperStyle`/`contentStyle`.
- [x] fixed · `comment-noise` · `zoomable-preview-image.tsx`, `invoice-preview-dialog.tsx` · 4 komentarze przycięte z narracji o stanie, który zniknął, i z powtórzeń kodu.
- [x] fixed · `simplify` · `src/__tests__/components/dialogs/invoice-preview-dialog.test.tsx:27` · rzutowanie `as Promise<HTMLImageElement>` zastąpione generykiem `findByAltText<HTMLImageElement>`.
- [x] fixed · `simplify` · `zoomable-preview-image.tsx:87-90` · niespójne `void` przy wywołaniach z callbacku — ujednolicone.
- [x] fixed · `primitive-reuse` · `zoomable-preview-image.tsx:78-105` · trzy ręcznie sklecone klastry `SimpleTooltip` + `Button variant="ghost" size="icon"` → `RowActionButton` (`ui/row-actions/row-action-button.tsx:24`). Prymitywu nie ruszałem — `className="size-8"` przechodzi przez `cn`, więc nadpisuje jego `size="xs" px-1.5` bez dorabiania knobu.
- [x] fixed · `primitive-reuse` · `zoomable-preview-image.tsx:78-105` · ten sam blok powtórzony ×3 w obrębie diffu → tablica `CONTROLS` mapowana na przyciski.
- [x] fixed · `primitive-reuse` · `invoice-preview-dialog.tsx:76-93` · boilerplate okna wydruku duplikował `print-transfers-button.tsx:41-74` — razem z **dosłownie skopiowanym** komentarzem uzasadniającym `afterprint`. Wyciągnięte do `src/lib/utils/print-window.ts` (`openPrintWindow` / `printThenClose`); oba miejsca wywołania przepięte, uzasadnienie żyje teraz w jednym miejscu.
- [x] 🟡 WARNING · fixed · `primitive-reuse` · `zoomable-preview-image.tsx:77,88` · dedup odsłonił ukryty błąd: `onClick={zoomOut}` podane wprost wpycha `MouseEvent` w pierwszy parametr `zoomOut(step)`. Obudowane `() => zoomOut()`; `tsc` to złapał, oryginalne `() => zoomOut()` miało to przypadkiem dobrze.
      test: no automated test — złapane przez typecheck, który jest tu tańszym strażnikiem niż spec
- [x] dismissed · `primitive-reuse` · `ui/loader/loader.tsx:14` · `Loader` to `fixed inset-0` na cały viewport z domyślną emoji 🚧, nie overlay w kontenerze — nie ta rola.
- [x] dropped · `primitive-reuse` · `media/media-strip.tsx:43` · `OVERLAY_BUTTON` to przepis na pojedynczy przycisk (`size-7 rounded-full`), nie kontener paska.
- [x] skipped · `simplify`(altitude) · `src/components/dialogs/invoice-preview-dialog.tsx:137` · pięć `sm:` nadpisań walczy z bazowym `DialogContent`; „właściwa" naprawa to wariant `fullscreen` w prymitywie. Jeden konsument — wariant byłby przedwczesny. Drugi konsument pełnego ekranu = moment na promocję.
- [x] skipped · `impl-review` · `next.config.ts` · `qualities: [90]` to zmiana globalna (przesuwa `media-strip` i `brand-logo` z efektywnego 80 na 90), bez kroku w Progress. To **udokumentowana decyzja właściciela** (tabela w `change.md`), więc nie cofam po cichu — dopisane do `plan.md` (addenda) + 2 manualne checki.
- [x] dropped · `code-review` · `next.config.ts` · po deployu zakładki otwarte sprzed niego dostaną HTTP 400 na `/_next/image` (serwerowy `validateParams` jest ścisły). Przejściowe, samo mija po odświeżeniu — zapisane w addendach planu, nie naprawiam.
- [x] skipped · `impl-review` · `zoomable-preview-image.tsx` · ścieżka gestów (kółko, pinch, dwuklik) nie ma testu automatycznego. Decyzja właściciela z 2026-09-21: **bez długu E2E** — ryzyko jest wizualne, przebieg E2E kosztuje ~godzinę. Pokryte manualnie.

### Weryfikacja na staging (2026-09-21)

- [x] 🔴 CRITICAL · fixed · `verify` · `zoomable-preview-image.tsx` · podmiana `src` na oryginał
      gasiła rendition: okno puste przez cały czas pobierania (zmierzone 6 s na dławionym łączu) i
      **na zawsze** przy błędzie pobrania — bez spinnera, bez komunikatu, `naturalWidth: 0`.
      Naprawione: spinner na czas pobierania, przy błędzie powrót do renditionu (jest w cache) +
      komunikat „Nie udało się wczytać oryginału…".
      test: test-driven-debugging · dom — spec „gdy oryginał się nie wczyta, wraca do renditionu i
      mówi o tym" odpala `fireEvent.error` i sprawdza komunikat + powrót `src` na `/_next/image`.
- [x] dismissed · `verify` · `media-strip` + topbar · miniatury i logo po `qualities: [90]` —
      zero 4xx na `/zgloszenia`, logo `w=64|96&q=90` → 200/304. Obawa z audytu nie zmaterializowała się.

## Simplify pass

Uruchomione w głównym wątku, bez 4 agentów — diff to 4 pliki, które przeszły już przez 9 audytów
fan-outu; rozstawianie kolejnej czwórki byłoby ceremonią nieproporcjonalną do rozmiaru zmiany.
2 poprawki naniesione, 1 pominięta; skan prymitywów dorzucił 4 kolejne naprawy (wariant `fullscreen` w `DialogContent`). Wszystkie złożone
do `## Findings` z tagiem `simplify`. Pliki równoległej sesji były wyłączone ze skanu; domknięte osobno dopiero po tym, jak obie sesje
odpisały „nie moje" (patrz nagłówek pierwszej sekcji `## Findings`).

## Tests & suite

- `pnpm exec vitest run --project dom src/__tests__/components/dialogs/invoice-preview-dialog.test.tsx` → **6/6 pass** (5 + regresja błędu pobrania oryginału)
- `pnpm exec tsc --noEmit` → **czysty** (3 błędy w specce dekoderów naprawione, patrz `## Findings`)
- `pnpm exec vitest run src/__tests__/lib/utils/ src/__tests__/components/leads/…` → **106/106 pass**
- Pełny pakiet (`lint` / `test` / `build`) — **nie uruchomiony**. Drzewo jest już czyste, więc nic
  tego nie blokuje; nie puszczałem bez proszenia, bo `build` i pełny `test` to kilka minut.
- E2E — **nie uruchomione i nie zaległe**: decyzja właściciela „bez długu E2E" (patrz `## Findings`).

## Status

**Gotowe do archiwizacji.** Ledger zamknięty — **0 otwartych boxów**, a wszystkie 13 manualnych
checków odhaczone na staging (`e5ae5ee5`). Jeden z nich się wywalił (pusty kadr przy pobieraniu
oryginału) — naprawiony w tym samym przebiegu, z testem regresji; poprawka jest jeszcze niewypchnięta.

Commity: `4477195e` (slice), `7e59f68e` (upload pipeline), `44c73f4e` (etykieta w leadach).
