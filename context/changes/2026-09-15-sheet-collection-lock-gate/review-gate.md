# Review-gate ledger — całe drzewo robocze · 2026-09-15

Zakres poszerzony na życzenie użytkownika: **wszystkie otwarte zmiany**, nie tylko EX-770.
Drzewo trzyma dwa niezależne strumienie:

- **A — EX-770** (ta sesja): `src/access/investment-lock.ts`, pięć kolekcji kosztorysu, dwa specy.
- **B — przebieg QA manual-checks** (sesja równoległa `wykonczymy-15`): `context/foundation/manual-checks.md`
  plus poprawki, które ten dokument opisuje — `lib/nav/` + `use-history-back.ts`, `layout.tsx` (`min-w-0`),
  `lib/fleet/inspection-draft.ts` + `add-inspection-dialog.tsx`, `lib/kosztorys/empty-grid-copy.ts` +
  `kosztorys-editor-body.tsx`, trzy dialogi edytora + dwa nowe komponenty not, `hooks/transfers/validate.ts`,
  `src/scripts/qa-gate-reset-preview.ts`.

Baza porównania: `01079b21` (staging). Pliki nieśledzone czytane wprost — `git diff` ich nie pokazuje.

`/10x-impl-review` odpada: żaden ze strumieni nie ma `plan.md`.

## Findings

<!-- tailwind-v4-audit -->

- [x] fixed · tailwind · `src/app/(frontend)/layout.tsx:71` · `min-w-0` na `main` jest no-opem —
      rodzic to `flex-col`, więc content-based minimum dotyczy tam wysokości, a `overflow-y-auto`
      i tak zeruje `min-*: auto`. Do zdjęcia; komentarz w linii 62 błędnie nazywa go bliźniakiem
      `min-h-0` (prawdziwa poprawka siedzi na kolumnie w linii 66).
- [x] dismissed · tailwind · `src/app/(frontend)/layout.tsx:66` · `min-w-0` na kolumnie powłoki —
      poprawne, idiomatyczne i na właściwym poziomie (to ta kolumna puchła i ciągnęła przyklejony pasek).
- [x] dropped · tailwind · `eslint.config.mjs` · brak wtyczki ESLint świadomej Tailwinda — luka
      całego repo, nie tego drzewa; ten sam finding odrzucono już przy bramce EX-748.
- [x] dismissed · tailwind · reszta zgłoszeń grup A/B/C dotyczy kodu **zastanego**, nietkniętego przez
      te zmiany (`ToastContainer` z-index, `style={{left: guideX}}` przy przeciąganiu, `h-[calc(...)]`
      z `lg:` sparowanym z `app-footer.tsx:25` — to nie jest dryf skali breakpointów). Dwa nowe
      komponenty not nie mają ani jednego `className`.

<!-- simplify: reuse / simplification / efficiency / altitude -->

- [x] fixed · simplify · `src/access/investment-lock.ts:36` · `updateUnlessInvestmentLocked` przepisywało
      ciało `unlessInvestmentLocked` zamiast je złożyć — literał `Where` z `LOCKED_INVESTMENT_STATUS`
      stał w dwóch miejscach. Teraz jedna linia: `unlessInvestmentLocked(createUnlessInvestmentLocked(base, owner), owner)`.
- [x] fixed · simplify · `src/access/investment-lock.ts:15` · `owner` i `path` to był jeden fakt podany
      dwa razy — dało się sparować `'item'` z `'investment.status'` i dostać bramkę pilnującą nie tego
      przeskoku, bez błędu typów. Ścieżka wyprowadzana z `owner` przez `LOCK_PATHS`; wszystkie trzy
      fabryki i pięć kolekcji mówią teraz jednym słownikiem.
- [x] fixed · simplify · `src/components/kosztorys/editor/kosztorys-editor-body.tsx:229` · ekstrakcja
      `emptyGridCopy` skasowała lokalną `engagedDiagnostics`, więc `engagedHiders` i
      `engagedConditionsOfKind` liczyły się po dwa razy na render (cztery przebiegi `ROW_CONDITIONS.filter`
      w ciele siatki), a warunek istnienia nakładki stał przepisany w JSX obok tego w module. Oba
      wyhojstowane; brama renderu i copy czytają tę samą listę.
- [x] fixed · simplify · `src/__tests__/helpers/transfer-fixtures.ts` (nowy) · spec anulowania klonował
      ~60 linii preambuły z `invoice-on-locked-investment.db.test.ts` (właściciel EMPLOYEE + rejestr
      `AUXILIARY` + wyszukanie istniejącego skanu). `createRegisterOwner` / `findExistingMediaId`,
      oba specy przepięte.
- [x] fixed · simplify · `sheets-investment-lock.db.test.ts:74`, `invoice-on-cancellation.db.test.ts:39`,
      `invoice-on-locked-investment.db.test.ts:39` · ręczne `DELETE FROM users …` z porządkiem
      rejestry-przed-użytkownikami zastąpione `purgeFixtureUsers(db)`, które właśnie to posprzątanie
      posiada (8 innych specy już go używa).
- [x] fixed · simplify · `sheets-investment-lock.db.test.ts:30` · trzy przypadki piszą do zablokowanej
      inwestycji bez arkusza, a fixture'y były dwa — przy cofniętej bramce trzeci wpadał w 1:1 unique
      index i zielenił się cudzą odmową. Teraz `lockedEmpty: { repoint, link, create }`, po jednym na
      przypadek. **Odwrotnie niż sugerował agent** (proponował skasować drugi): przy zielonej bramce
      żaden arkusz nie ląduje, ale fixture'y istnieją po to, żeby spec był uczciwy na CZERWONO.
- [x] fixed · simplify · `sheets-investment-lock.db.test.ts:77` · ~17 szeregowych round-tripów w
      `beforeAll` (dwóch użytkowników, sześć inwestycji, cztery arkusze, cztery zmiany statusu) zbite
      w cztery `Promise.all`; kolejność FK (kosztoryses przed investments) w czyszczeniu bez zmian.
- [x] skipped · simplify · `src/collections/{kosztorys-items,kosztorys-sections,kosztorys-stages,stage-progress}.ts` ·
      helper `investmentLockedWrites(base, owner)` zwijający trójkę `create`/`update`/`delete` — kusi,
      ale te cztery kolekcje mają **celowo** węższą bramkę `update` (tylko stan zapisany) niż `sheets`,
      a helper albo tę rozbieżność ukrywa, albo musi pomijać `update` i przestaje być helperem.
      Decyzja o poszerzeniu należy do właściciela, nie do findingu.
- [x] fixed · simplify · `src/access/investment-lock.ts:36` · asymetria między `kosztoryses` a czterema
      kolekcjami EX-748 była wyczytywalna tylko z porównania plików — następny, kto dołoży kolekcję
      szóstą, skopiuje tego sąsiada, na którego trafi. Rozbieżność zapisana przy fabryce.
- [x] skipped · simplify · `src/lib/kosztorys/empty-grid-copy.ts:42` · zwracanie `null` przy „nic nie
      zaangażowane" i przeniesienie bramy istnienia nakładki do modułu — realne uproszczenie, ale
      zmienia to, co widzi klient, gdy żaden hider nie jest włączony. Zmiana zachowania, nie sprzątanie.
- [x] dropped · simplify · `src/lib/fleet/inspection-draft.ts` · sześć sąsiednich dialogów liczy swoje
      `formId` inline, ten jeden dostał moduł w `lib/` ze specem. Realne, ale to plik strumienia QA
      i stawka jest zerowa.
- [x] dropped · simplify · `sheet-missing-columns-block.tsx:24` · `filter(!required)` to ręczne
      dopełnienie `requiredFields()` z `sheet-column-picker-options.ts`. Jedna linia, jeden konsument.
- [x] dismissed · simplify · `src/scripts/qa-gate-reset-preview.ts` · nagłówek mówi „THROWAWAY … do not
      commit", a plik leży w drzewie — ale to plik sesji równoległej i to ona decyduje, czy go zostawia;
      strażnik `assertPreviewDb()` już wszedł wyżej w tym rejestrze.
- [x] dismissed · simplify · `in-app-history.ts:28` (`navigation === undefined ||` zawężające typ),
      `sheet-{missing,pointed}-columns-block.tsx` (`pointed={[]}` / `missing={[]}` — różny `status`
      jest powodem podziału), bootstrap `getPayload`/`vi.mock('server-only')` powielony w ~30 specach
      (dług całego repo, własna zmiana) · sprawdzone, nic realnego.

## Simplify pass

Ran /simplify — 8 applied, 2 skipped, 2 dropped, 3 dismissed; każdy finding wpięty w `## Findings`
(tag `simplify`). Cztery agenty (reuse / simplification / efficiency / altitude) na całym drzewie
względem `01079b21`.

## Tests & suite

_(na końcu)_

<!-- feature-first-structure / module-cohesion-audit / structure-scatter-audit -->

- [x] fixed · feature-first · `src/scripts/qa-gate-reset-preview.ts:1` · Skrypt resetuje hasło na
      **zdalnej** bazie preview, a w przeciwieństwie do sąsiada `seed-e2e-user.ts:16` (`assertLocalDb()`)
      nie ma żadnego strażnika — nieświeży `export DB_POSTGRES_URL` celuje resetem tam, gdzie akurat
      wskazuje zmienna. Do tego własny baner pliku mówi `THROWAWAY … do not commit`, a plik leży
      w śledzonym drzewie. Czeka na drugi raport (code-review strumienia QA bada dokładnie ten plik).
      test: brak — to bramka konfiguracyjna, nie zachowanie; strażnik jest samopotwierdzający.
- [x] fixed · feature-first · `src/components/kosztorys/editor/dialogs/missing-columns-note.tsx`,
      `pointed-columns-note.tsx` · Oba renderują `SheetReportBlock` jak sześciu rodzeństwa nazwanych
      `sheet-*-block.tsx`, ale łamią tę jedyną przewidywalną regułę nazw katalogu (gubią prefiks
      `sheet-`, kończą się na `-note`). Zmiana nazwy dwóch plików + dwa importy.
- [x] skipped · module-cohesion · `src/components/kosztorys/editor/kosztorys-editor-body.tsx:85` ·
      597 linii za jednym eksportem, 13 `useMemo` w trzech klastrach; czysty szew (klaster pomiaru
      wierszy → `editor/hooks/`) jest nazwany wprost w AGENTS.md. **Zastane, a te zmiany plik
      SKRACAJĄ** (wyciągnięcie `emptyGridCopy`, −11 linii netto). Refaktor wart własnego review.
- [x] dropped · structure-scatter · `src/components/kosztorys/editor/dialogs/` · 30 plików płasko,
      trzy rodzaje, zero podkatalogów — jedyne niepodzielone dziecko `editor/`. Zastane; te zmiany
      dokładają dwa pliki. Podział w miejscu (podkatalog `sheet/` wchłonąłby 11 plików) to osobna robota.
- [x] dismissed · feature-first · `src/lib/nav/` · Nowy tier uzasadniony — `nav` to oś istniejąca już
      po stronie komponentów (`src/components/nav/`), a jednoplikowe `src/lib/<obszar>/` ma precedens
      (`src/lib/cron/`). `use-history-back.ts` słusznie zostaje w `components/ui/` (jeden katalog
      konsumenta, zero domeny) — wyniesienie predykatu do `lib/` to dokładnie szew z AGENTS.md.
- [x] dismissed · structure-scatter · `src/__tests__/collections/sheets-investment-lock.db.test.ts` ·
      Mirror ustalony (trzy specy `*-delete-guard` już tam stoją), a marker `skipIf(!ENV_READY)` jest
      na miejscu, więc `scripts/test-integration.sh` faktycznie ten spec znajdzie.

<!-- comment-noise-audit (flag-only) -->

- [x] fixed · comment-noise · **Dominująca wada to duplikacja przez szew źródło↔spec, nie narracja.**
      Cztery uzasadnienia stoją dwa razy, niemal słowo w słowo: reguła-ról-jako-parametr (3×:
      `investment-lock.ts:21`, `investment-lock.test.ts:46`, `sheets-investment-lock.db.test.ts:154`),
      maskowanie `APIError`/`routeError` (`validate.ts:213` vs `validate-error-surfacing.test.ts:5`,
      plus zastana kopia w `validate.ts:79`), defekt `about:blank`/`length === 2`
      (`in-app-history.ts:11` vs jego spec `:14`), przeciek slotu draftu przeglądu
      (`inspection-draft.ts:1` vs jego spec `:4`). Każda kopia z osobna przechodzi strip test — dlatego
      się nazbierały. Jeden kanoniczny dom na uzasadnienie, reszta do wskaźnika.
- [x] fixed · comment-noise · Do skasowania (3): `kosztorys-client-view-dialog.tsx:87` (narracja
      o etykiecie, której już nie ma, plus powtórzenie literału `Zapisz` linijkę niżej),
      `validate-error-surfacing.test.ts:34`, `in-app-history.test.ts:33` (oba powtarzają nazwę testu
      lub asercję spod spodu).
- [x] fixed · comment-noise · Do przycięcia (8), z tego moje trzy: `sheets.ts:31` — zdanie otwierające
      opisuje stan SPRZED tej zmiany („zamek objął cztery kolekcje, ale nie tę"), czyli przestaje być
      prawdą w tym samym diffie; druga połowa (`not_equals` / LEFT JOIN) jest nośna i zostaje.
      `investment-lock.test.ts:46` i `sheets-investment-lock.db.test.ts:154` — kopie komentarza
      z fabryki. Pozostałe: `validate.ts:213`, `in-app-history.ts:12`, `inspection-draft.ts:5`,
      `empty-grid-copy.ts:15`, `missing-columns-note.tsx:13`, `sheet-import-dialog.tsx:235`.
- [x] dismissed · comment-noise · 13 komentarzy zgłoszonych jako „keep" — m.in. `layout.tsx:61`
      (`min-w-0` + reguła przeglądarki + objaw), `in-app-history.ts:1` (dlaczego typ jest ręczny),
      `in-app-history.test.ts:48` (dlaczego świadomie błędna heurystyka zostaje dla starych przeglądarek),
      `pointed-columns-note.tsx:11` (dlaczego `status="ok"` obok siostrzanego `warn`). Zostają bez zmian.
- [x] dropped · comment-noise · Polskie terminy domenowe wplecione w angielskie zdania komentarzy
      (`zakończona inwestycja` w `sheets.ts:32` i w specu). Nazwa statusu, nie tłumaczenie identyfikatora —
      reguła rejestru to dopuszcza; przepisywanie na „completed investment" nic nie kupuje.

<!-- code-review: strumień EX-770 -->

- [x] 🟡 WARNING · fixed · code-review · `src/collections/sheets.ts:39` · **Bramka `update` patrzy
      wyłącznie na AKTUALNĄ inwestycję wiersza, nigdy na przychodzące `data.investment`** — więc arkusz
      wciąż da się z `/admin` wepchnąć **do** zakończonej inwestycji. MANAGER otwiera „Nowy kosztorys"
      (albo arkusz aktywnej inwestycji), ustawia `investment = #5` o statusie `completed`; Payload
      dopasowuje dokument do `investment.status != completed` po stanie SPRZED zapisu (NULL przechodzi
      przez `IS NULL`, `active` przez `<>`), zapis wchodzi — i arkusz jest uwięziony: `/admin` już go
      nie ruszy (źródło zablokowane), a `unlinkSheetFromInvestmentAction` / `deleteSheetAction` odbijają
      przez `lockedSheetError`. Odkręcenie = SQL na bazie. Ten sam diff zamyka ten kierunek dla `create`
      (`createUnlessInvestmentLocked` czyta `data.investment`), więc slice jest wewnętrznie niespójny,
      a `change.md` deklaruje właśnie zamknięcie przepinania.
      test: test-driven-debugging · integration — czerwony repro na trwałym stanie (`investment_id`
      wiersza po odmowie), nie na zwróconej wartości.
- [x] 🟡 WARNING · fixed · code-review · `src/access/investment-lock.ts:26` · `unlessInvestmentLocked`
      jest synchroniczna i **nie czeka** na `base`, a parametr ma typ `Access`, który dopuszcza
      `Promise<AccessResult>`. Asynchroniczna reguła ról **zdejmuje zamek zamiast się z nim złożyć**:
      `allowed` jest Promisem, `allowed !== true` przechodzi, fabryka zwraca ten Promise, Payload
      rozwiązuje go do `true` — i `Where` nigdy nie powstaje. TypeScript to przyjmuje. Pułapka, którą
      wprowadziło sparametryzowanie; bliźniacza `createUnlessInvestmentLocked` robi `await base(args)`.
      test: TDD · unit — asynchroniczna reguła bazowa musi dawać `Where`, nie `true`.
- [x] fixed · code-review · `src/__tests__/collections/sheets-investment-lock.db.test.ts:78` ·
      `beforeAll` samo-leczy dwa rodzaje fikstur z unikalnym indeksem (arkusze, użytkownicy), ale **nie
      inwestycje** — run przerwany przed `afterAll` zostawia dwa wiersze we współdzielonej bazie 5435,
      jeden na trwałe `completed`, widoczny dla zapytań sąsiednich speców. Kolejny przebieg i tak
      przechodzi, więc wyciek narasta po cichu.
- [x] fixed · code-review · `sheets-investment-lock.db.test.ts:155,167` · Dwa ostatnie `it` dzielą
      jedną fiksturę, którą ostatni **konsumuje** — plik jest zależny od kolejności, a nic tego nie mówi.
- [x] fixed · code-review · `sheets-investment-lock.db.test.ts:155` · Przypadek „MANAGER nie kasuje"
      asertuje samo `rejects.toThrow()`, czyli wartość zwróconą, a nie stan trwały — jako jedyny
      z pięciu. Przechodzi dziś przypadkiem.
- [x] fixed · code-review · `src/collections/sheets.ts:38` · Nowa bramka `create` nie ma pokrycia na
      bazie: spec DB ćwiczy tylko update i delete, a spec jednostkowy testuje fabrykę, nie jej wpięcie.
- [x] dismissed · code-review · `await base(args)` w `createUnlessInvestmentLocked` · bez zmiany
      zachowania — `AccessResult` to `boolean | Where`, a `Where` nie ma `then`, więc `await` jest
      tożsamością plus jeden mikrotask. Wszystkie pięć wpięć podaje reguły synchroniczne.
- [x] dismissed · code-review · kolejność `beforeDelete` przed odczytem dokumentu pod `Where` · realna
      (`deleteByID.js:43` vs `:67`), ale `kosztoryses` nie deklaruje `beforeDelete`, a kaskady idą pod
      Payloadem (`ON DELETE SET NULL`). Nic się na tej kolejności nie opiera.
- [x] dismissed · code-review · NULL + `not_equals` · przeliczone ze źródła po raz drugi i trzyma:
      `parseParams.js:225-227` daje `or(isNull(col), ne(col, val))`, a złączenie relacji jest LEFT JOINem
      w każdej ścieżce — find, `deleteOne`, paginacja, licznik listy w panelu, `entityDocExists`
      (bramkuje przycisk „Save") i `deleteMany`. Żadna operacja nie odstaje. Asymetria warta komentarza,
      który już w pliku stoi: `not_in` tak NIE działa.

<!-- code-review: strumień QA -->

- [x] 🟡 WARNING · **dismissed — finding obalony** · code-review · `src/hooks/transfers/validate.ts:87` · Strażnik CANCELLATION
      czyta `d.cancelledTransaction` zamiast `resolved('cancelledTransaction')`, więc **częściowy zapis
      na istniejącym wierszu CANCELLATION jest odrzucany za pole, które ten wiersz od zawsze ma** —
      a diff ubiera tę fałszywą odmowę w pewne siebie publiczne zdanie. Ścieżka: `transfers.tsx:127`
      renderuje `InvoiceCell` dla każdego wiersza bez bramki na typ, więc podpięcie skanu faktury do
      anulowania woła `setTransferInvoices` z `data: { invoice: [...] }`, `type` rozwiązuje się
      z `originalDoc` na `CANCELLATION`, `d.cancelledTransaction` jest `undefined` → 400 „Cancelled
      transaction reference is required." Linia jest zastana (diff zmienił jej klasę błędu), ale to
      jedyny throw w tym hooku, który diff dotknął, a który potrafi trafić w **legalny** zapis —
      `isInvoiceOnlyPatch` tuż wyżej istnieje dokładnie po to, żeby go przepuścić.
      test: test-driven-debugging · integration — napisany i zielony:
      `src/__tests__/hooks/transfers/invoice-on-cancellation.db.test.ts`.
      **Przesłanka obalona przez ten właśnie test:** na aktualizacji przez Local API Payload scala
      zapisany dokument do `data` PRZED `beforeValidate`, więc `d.cancelledTransaction` jest obecne
      i `setTransferInvoices` nigdy nie dostawało 400. Zmiana na `resolved('cancelledTransaction')`
      zostaje mimo to — REST PATCH wysyła wyłącznie zmieniane klucze, a każde inne pole w tym hooku
      czyta się już przez `resolved`. Spec pilnuje obu kierunków plus kontrolę pozytywną (CREATE bez
      referencji nadal odmawia).
- [x] 🟡 WARNING · fixed · code-review · `src/scripts/qa-gate-reset-preview.ts:6` · Udokumentowana
      linia RUN nie ma `source .env`, więc `$DB_POSTGRES_URL_PREVIEW` rozwija się do pustego stringa,
      a `--env-file` **nie nadpisuje** zmiennej już ustawionej (zweryfikowane eksperymentem). Efekt:
      `connectionString: ''` i `pg` spada na domyślne libpq (`PGHOST`/localhost:5432) — inna baza niż
      zamierzona. Każde rodzeństwo w `package.json` prefiksuje `source .env &&` właśnie dlatego.
- [x] 🟡 WARNING · fixed · code-review · `src/scripts/qa-gate-reset-preview.ts:10-40` · Nic nie
      sprawdza, że połączenie prowadzi do bazy preview, więc jedna zmienna środowiskowa celuje resetem
      hasła w produkcję: `DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD" node … qa-gate-reset-preview.ts`
      przechodzi bez odmowy. Repo ma na to własny wzorzec — `scripts/blob-restore.mjs` odrzuca każdy
      cel inny niż preview bez `--allow-prod`, a sąsiad `seed-e2e-user.ts:16` ma `assertLocalDb()`.
      Skrypt drukuje też nowe hasło na stdout. (Reguła env jest dotrzymana: zero surowego `process.env`.)
- [x] fixed · code-review · `src/lib/kosztorys/empty-grid-copy.ts:38-44` · Ścieżka
      `hiders: [], diagnostics: []` daje `title: "Brak pozycji "` — spacja na końcu, bez rzeczownika —
      plus „Filtr zrobił swoje" przy zerze filtrów. Dziś nieosiągalna (bramka renderu w
      `kosztorys-editor-body.tsx:508` zgadza się z modułem gałąź w gałąź), ale moduł stoi już samodzielnie
      i sam się nie broni. Spec „mówi coś, gdy filtr nie ma etykiety" asertuje wyłącznie
      `description === undefined`, czyli że nic nie mówi, i nigdy nie sprawdza tytułu.
- [x] fixed · code-review · `src/__tests__/lib/nav/in-app-history.test.ts` · Dwie żywe gałęzie bez
      pokrycia: `navigation` obecne, ale `currentEntry` puste lub `index < 0` (odpada na `historyLength`),
      oraz `catch` przy `new URL(...)`.
- [x] skipped · code-review · `src/lib/nav/in-app-history.ts:22-24` · „Poprzedni wpis jest tego samego
      pochodzenia" to nie to samo co „poprzedni KROK historii": `navigation.entries()` pomija wpisy
      cross-origin i zagęszcza indeksy, więc `entries()[index-1]` bywa stroną aplikacji oddaloną o dwa
      realne kroki. Scenariusz: inwestycja → obca strona w tej samej karcie → powrót do aplikacji przez
      pasek adresu → „Wróć" ląduje na obcej stronie, czyli dokładnie naprawiany defekt. Wąskie
      w praktyce (linki zewnętrzne z edytora otwierają nową kartę). Do odnotowania w kodzie, nie
      do przepisywania logiki w tym przebiegu. **Odnotowane w docblocku modułu.**
- [x] fixed · code-review · `src/components/ui/use-history-back.ts:13-14` · W Firefoksie i Safari
      poniżej 18.4 `window.navigation` nie istnieje, więc naprawiony błąd świeżej karty **tam nadal
      występuje**. Kod to przyznaje, ale rejestr QA tego nie mówi — box nie może zostać odhaczony na
      tych przeglądarkach. Do dopisania w `manual-checks.md`.
- [x] dismissed · code-review · `src/app/(frontend)/layout.tsx:66/71` · `min-w-0` jest zachowawczo
      zamknięte; jedyny skutek uboczny to kosmetyka (`w-full` rodzeństwo szerokiej treści mierzy teraz
      viewport, więc kończy się w połowie przy przewinięciu w prawo). Nic nie opierało się na starej
      podłodze min-content — zero `min-w-[…]`/`w-[1…px]` pod `components/tables` i `editor`.
- [x] dismissed · code-review · zamiana `Error` → `APIError` w `validate.ts` · nic nie połyka:
      `APIError` domyślnie ustawia `isPublic` na `status !== 500`, więc 400 przechodzi `isErrorPublic`
      i `routeError` nie przepisuje komunikatu, a że `APIError extends Error`, `toActionFailure` dalej
      podaje `err.message` bez zmian. Żaden warunek reguły się nie zmienił — tylko klasa błędu.
