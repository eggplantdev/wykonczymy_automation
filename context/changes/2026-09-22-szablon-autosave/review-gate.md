# Review-gate ledger — szablon-autosave · 2026-09-22

Zakres: pliki tej zmiany (patrz niżej). W drzewie roboczym siedzi **równolegle** praca innego
agenta (`investment-assets*`, `media-upload-button.tsx`, `context/changes/2026-09-22-kosztorys-editor-assets/`,
`context/changes/2026-09-22-kategorie-assetow-i-kompresja/`) — poza zakresem przeglądu i **nietykalna**
dla `/simplify`.

Krok 0.5 (przebieg weryfikacyjny w przeglądarce) **pominięty świadomie**: sterowanie Playwrightem
i `pnpm test:e2e` wymagają wyraźnej prośby użytkownika w danej turze.

Fan-out: `10x-impl-review`, `code-review` (read-only, diff-scoped), `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit` (diff-scoped), `comment-noise-audit` (flag-only).
`tailwind-v4-audit` odpadł — diff nie wnosi ani jednej nowej klasy.

Linear: MCP osiągalny, projekt „Wykonczymy" (P-EX-5, zespół Ex-plant).

## Findings

<!-- Format: [box] · <severity, tylko korektnościowe> · disposition · `source` · `file:line` · co — dlaczego -->

- [x] 🔴 CRITICAL · fixed · code-review + impl-review · `src/lib/actions/kosztorys-presets.ts:216` ·
      **wyścig eksmisji**: podmiana drzewa biegnie we własnej transakcji, więc przy wskaźniku wciąż
      pokazującym **wychodzący** szablon istniał stan zatwierdzony (drzewo już nowe, wskaźnik stary),
      w którym dopchnięcie przechodzi każdą bramkę i wstemplowuje nową treść w stary szablon.
      Naprawa: wskaźnik idzie na `NULL` **przed** `reloadInvestmentFromPreset`.
      test: test-driven-debugging · integration — spec „opuszcza wskaźnik, zanim drzewo ruszy";
      zweryfikowany w obie strony (z naprawą 14/14, bez naprawy `expected 208 to be null`).
- [x] 🔴 CRITICAL · fixed · simplify · `src/lib/actions/mirror-workshop-preset.ts:56` ·
      **podwójne zajęcie okna**, wprowadzone przez samą naprawę wydajnościową E1: claim wyniesiony
      przed transakcję, a ten w środku został. Wyniesiony stempluje `mirrored_at`, więc wewnętrzny
      zawsze przegrywa → `mirrored === false` → **autozapis nigdy nie pisał** poza ścieżką `force`.
      `pnpm typecheck` tego nie widzi (defekt czasu wykonania). Naprawa: kasacja wewnętrznego claimu.
      test: test-driven-debugging · integration — spec „przepisuje zmianę w warsztacie do szablonu,
      który warsztat trzyma" już to pokrywał i był czerwony; po kasacji 33/33 zielone.
- [x] 🔴 CRITICAL · fixed · suite · `src/lib/kosztorys/work-catalogue/catalogue-key.ts` ·
      spoza slice'u (commit `21199377`, „usunięcie dopisku «stary arkusz»"), złapane przez bramkę
      całego drzewa. Commit twierdzi, że `match_key` był „od zawsze liczony bez dopisku, więc
      tożsamość żadnego wiersza się nie zmienia" — cztery wiersze katalogu wciąż **mają dopisek w
      opisie**, więc po zdjęciu obcinania `catalogueKey` liczy dla nich klucz inny niż ich własna
      kolumna. Picker porównuje świeży klucz ze składowanym, czyli wstawka trafia w
      `ON CONFLICT DO NOTHING` i po cichu duplikuje pracę. Naprawa: migracja danych
      `src/migrations/20260922_1_catalogue_legacy_marker_cleanup.ts` zdejmuje dopisek z opisu —
      era dopisku jest zamknięta, więc nieaktualne są dane, nie kod. `match_key` nietknięty.
      test: test-driven-debugging · integration — `catalogue-key-collisions.test.ts` („still agrees
      with the key stored on every row") był czerwony na 4 wierszach, po migracji 326/326 zielone.
- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/editor/grid/column-selection.ts:76` ·
      lista kolumn warsztatu działała jako **sufit, ale nie podłoga**: pod nią wciąż grały trzy
      preferencje czytania (ptaszek pickera, oś kwot, warstwa), wszystkie trzymane w `localStorage`
      **per przeglądarka**, a warsztat ukrywa każdy sterownik, który je zmienia. „Sekcja" jest w
      `DEFAULT_HIDDEN_COLUMNS`, więc znikała z listy właściciela przy pierwszej wizycie, bez niczego
      na ekranie, co by ją przywróciło. Naprawa: allowlista jest całą odpowiedzią.
      test: test-driven-debugging · unit — dwa specy: „is a ceiling no reading preference can lift"
      i „is a floor no reading preference can lower".
- [x] 🟡 WARNING · fixed · code-review · `src/lib/db/presets.ts:46,65,198` · `updated_at` nie było
      stemplowane przy założeniu, upsercie ani zmianie nazwy — a biblioteka szablonów sortuje
      dokładnie po tej kolumnie, więc świeżo założony szablon lądował na dole listy.
      test: test-driven-debugging · integration — „stamps the modification date on creation and on a
      rename"; istniejący spec kolejności przestawiony na jawny `updated_at = NULL`.
- [x] 🟡 WARNING · fixed · impl-review · `src/components/kosztorys/editor/hooks/use-workshop-mirror-flush.ts` ·
      dopchnięcie przy odmontowaniu leciało bezwarunkowo, więc samo **wejście i wyjście** z szablonu
      przestawiało jego datę modyfikacji — czyli figurę, po której sortuje biblioteka. Naprawa: ten
      sam test licznika co w ticku.
      test: TDD · dom — „nie dopycha przy wyjściu, gdy nic nie tknięto".
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/actions/mirror-workshop-preset.ts` ·
      unieważnienie tagu `presets` leciało również, gdy transakcja **odstąpiła** — a przy dławiku 10 s
      odstąpienie jest przypadkiem typowym, więc cache biblioteki wygasał na mutacjach, które nic w
      niej nie zmieniły. Naprawa: callback transakcji zwraca `boolean`, unieważnienie tylko po zapisie.
      test: no automated test — to efekt uboczny na cache bez obserwowalnego stanu; sam zwracany
      `boolean` pokrywa spec DB mirrora.
- [x] filed EX-843 · code-review · `src/components/kosztorys/editor/hooks/use-workshop-mirror-flush.ts` ·
      zamknięcie karty/przeglądarki gubi ogon (brak `pagehide` + `sendBeacon`) — okno strat ≤ 15 s.
      test: no automated test — `pagehide` w jsdom nie odtwarza realnego teardownu; e2e nieproporcjonalne.
- [x] filed EX-844 · feature-first-structure (P2) · `src/lib/actions/kosztorys-presets.ts:233,242` ·
      `listPresetsAction` / `listPresetSectionsAction` to **odczyty** w katalogu mutacji — miejsce to
      `src/lib/queries`. Rusza publiczne importy, więc nie w tym slice'u.
- [x] filed EX-845 · feature-first-structure (P3) · `src/lib/db/workshop-investment.ts` ·
      `resolveWorkshopInvestment` mutuje (tworzy wiersz) z warstwy data-access, która ma być
      „statement + mapper".
- [x] filed EX-846 · module-cohesion (M2/S3) · `src/lib/db/investment-lock.ts`,
      `src/lib/actions/lock-investment.ts` · nazwy mówią „lock", a moduły robią bramkę/wiersz —
      `investment-gate.ts` / `lock-investment-row.ts`. Czysty rename, ale dotyka cudzych importów.
- [x] filed EX-847 · gate (Step 3) · `e2e/` · przełączenie szablonu w warsztacie (eksmisja + punkt
      powrotu) to ryzyko przeglądarkowe — etykieta `e2e-backlog` nadana.
      test: no automated test (jeszcze) · e2e — obowiązek przeniesiony na EX-847.
- [x] fixed · impl-review · `src/lib/kosztorys/column-config.ts:WORKSHOP_VISIBLE_COLUMNS` ·
      **F6** — w warsztacie wylądowało 6 z 7 kolumn, które właściciel wymienił; brakowało „Źródło
      ceny wykonawcy". Właściciel potwierdził (2026-09-22): dołożyć. Kolumna jest **per plan
      wykonawcy**, więc wchodzą dwa id (`priceMode__w_tools`, `priceMode__own_tools`) budowane
      z `TOOL_PLANES`. Sama allowlista nie wystarczyła: `assembleV2Columns` składało tę kolumnę
      wyłącznie poza planem klienta, a warsztat stoi właśnie na planie klienta (pokazuje cenę
      ofertową i chowa przełącznik widoku) — stąd wyjątek `withMode`. Stawka wykonawcy **nie**
      wchodzi: startuje schowana, a warsztat nie ma pickera, żeby ją przywrócić; „kwota stała"
      zamraża to, co liczy współczynnik, więc wybór działa bez niej.
      Komentarz przy `CLIENT_VIEW_GROUPS` poprawiony — brak `priceMode` w allowliście podglądu
      przestał być „defence in depth" i jest teraz jedyną barierą.
      Przy okazji, ta sama decyzja właściciela: **`priceGross` wypada** z listy warsztatu. To kolumna
      liczona (netto × VAT wiersza), a preset zatrzymuje `settings`, ale ignoruje je przy wczytaniu —
      więc brutto byłoby poprawne na tym ekranie i błędne wszędzie, gdzie szablon zostanie użyty.
      Lista warsztatu ma teraz 7 kolumn: Sekcja, Opis prac, Jednostka miary, Cena j.m. netto,
      Źródło ceny wykonawcy ×2 plany, Komentarz.
      test: TDD · unit — trzy specy w `workshop-columns.test.ts`: kolumna jest dla obu planów,
      stawki nie ma, i wyjątek nie wycieka na zwykły widok klienta.
- [x] 🔴 CRITICAL · fixed · user · `src/lib/kosztorys/column-config.ts:WORKSHOP_VISIBLE_COLUMNS` ·
      **F7** — z warsztatu wypadła kolumna „Akcje". Allowlista jest listą tego, co szablon **niesie**,
      a „Akcje" nie niesie niczego — więc nie została dopisana. Tylko że siatka stoi na `lockRows`,
      więc to menu jest jedyną drogą do „Usuń pozycję" / „Wstaw powyżej|poniżej" / „Przesuń" /
      „Zapisz pozycję do katalogu prac", a w tej samej kolumnie siedzi „…" belki sekcji
      (`sectionHeaderSlot` → slot `actions`), czyli także zmiana nazwy, kolejności, koloru i kasowanie
      sekcji. W efekcie w warsztacie dało się tylko dopisywać i edytować — nic nie dało się usunąć
      ani przestawić. `actions` dopisane na początek listy; komentarz przy stałej mówi teraz, że
      wisi tam jako afordancja, nie jako dana.
      test: test-driven debugging · unit — nowy spec w `workshop-columns.test.ts` („keeps the
      row-actions column…"), czerwony przed poprawką.
- [x] fixed · comment-noise · reszta zgłoszeń audytu — zastosowana w kroku 2. Klastry duplikacji
      zwinięte na `src/lib/constants/preset-mirror.ts`: po co dławik (`PRESET_MIRROR_THROTTLE_SECONDS`)
      i po co domknięcie ogona (`PRESET_MIRROR_IDLE_FLUSH_MS`) stoją teraz raz, przy stałych;
      `mirror-workshop-preset.ts` i `use-workshop-mirror-flush.ts` wskazują na nie zamiast powtarzać.
- [x] fixed · feature-first-structure (P1) · `src/components/presets/use-open-preset.ts` →
      `src/hooks/use-open-preset.ts` · czyta z dwóch katalogów bez wspólnego rodzica (`presets/`,
      `kosztorys/editor/dialogs/`) — reguła liczy **katalogi**, nie pliki. 4 importy przestawione.
- [x] fixed · module-cohesion · `src/lib/kosztorys/column-config.ts` · `WARSZTAT_VISIBLE_COLUMNS` →
      `WORKSHOP_VISIBLE_COLUMNS` — polski rdzeń zespawany z angielskim afiksem jest zakazany wprost
      (AGENTS.md, reguła 3).
- [x] fixed · comment-noise · 18 plików · ~50 komentarzy napisanych po polsku → angielski. AGENTS.md
      mówi wprost: komentarze zawsze po angielsku, nawet obok polskich stringów UI. Jedna z nich była
      **regresją** — linia przed tą zmianą była po angielsku.
- [x] dismissed · impl-review · `use-workshop-mirror-flush.ts` · „dryf od planu: `setInterval` zamiast
      debounce" — zachowaniowo równoważne dla deklarowanego celu (domknięcie ogona, okno ≤ 15 s), a
      komentarz w kodzie mówi wprost, że interwał jest wyborem. Zmiana byłaby churnem.
- [x] dismissed · code-review · `src/lib/actions/kosztorys-presets.ts` · „odwrócona kolejność blokad →
      deadlock" — obie ścieżki biorą te same wiersze w tej samej kolejności; `replaceTreeWithSnapshot`
      trzyma własną transakcję REPEATABLE READ z 3 podejściami i `isConcurrentWrite`.
- [x] dismissed · code-review · `src/lib/actions/mirror-workshop-preset.ts` · „mirror na ścieżce
      krytycznej zapisu" — dławik 10 s + `deferRefresh` zdejmują koszt, który EX-597 usunął; mierzone
      autozapisy edytora nie drgnęły.
- [x] dismissed · impl-review · „ciche porażki dopchnięcia" — decyzja właściciela (fire-and-forget),
      a marker `// TODO(EX-449) SENTRY-REQUIRED:` już siedzi w catch-allu.
- [x] dismissed · module-cohesion (M1) · `src/components/kosztorys/editor/dialogs/` · dwa dialogi w
      jednym pliku — udokumentowane w `plan.md:418-423` jako świadome (wspólny stan otwarcia).
- [x] dismissed · code-review (F2) · `claimPresetMirror` przed blokadą wiersza — claim **jest**
      atomowym `UPDATE … RETURNING`, więc kolejność nie tworzy okna.
- [x] dismissed · impl-review (F7, F8) · informacyjne, bez zaleceń.
- [x] dropped · impl-review · `src/lib/actions/kosztorys-presets.ts:190` · `reloadFromPresetAction`
      nie odmawia po stronie serwera na wierszu warsztatu, więc podmieniłoby drzewo bez eksmisji
      i bez zerwania wskaźnika — czyli 🔴 wyścig eksmisji wprost. **Mechanizm prawdziwy, brak
      osiągalnego użytkownika** (właściciel: „zostawmy", 2026-09-22): `/szablony/[id]` czyta szablon
      z trasy, nie ze wskaźnika, więc edytor tam zawsze wie, że jest w warsztacie i bierze
      `useOpenPreset`; przy niezgodnym wskaźniku ta strona renderuje `OpenWorkshopPrompt` zamiast
      edytora; a wiersz warsztatu jest wycięty z `fetchReferenceData` (`status <> 'szablon'`), na
      której `kosztorys_v2/page.tsx` sprawdza istnienie — więc trasa inwestycji daje 404. Zostaje
      spreparowane wywołanie akcji przez zalogowanego pracownika.
      Bramka istnieje, tylko jest zapisana raz, jako „warsztat nie jest inwestycją" w jednym
      zapytaniu, zamiast być powielona w każdej akcji — i tam trafiła celowo, bo filtrowanie
      per-powierzchnia wyciekało wcześniej do filtrów transferów i do listy inwestycji.
      Ryzyko rezydualne: przestaje być szczelne, jeśli ktoś zdejmie ten filtr albo doda nową trasę
      do wiersza warsztatu.
      test: no automated test — nie ma zachowania obserwowalnego przez użytkownika do przypięcia.
- [x] dropped · module-cohesion (S1) · `src/lib/constants/preset-mirror.ts` · „katalog stałych nie ma
      reguły w AGENTS.md" — prawda, ale to jedna pozycja; reguły się nie pisze pod jeden plik.
- [x] dropped · structure-scatter (F10) · cienki wrapper wokół akcji — kosmetyka, nie warta churnu.
- [x] fixed · simplify (efficiency E1) · `src/lib/actions/mirror-workshop-preset.ts:36` · claim
      wyniesiony przed transakcję — odmowa (przypadek typowy przy dławiku) kosztowała `BEGIN` +
      `SELECT … FOR UPDATE` + odczyt warsztatu, a `FOR UPDATE` ustawiał wklejkę 50 komórek w kolejkę
      na jednym wierszu. `claimPresetMirror` jest atomowy sam z siebie.
- [x] fixed · simplify (altitude) · `src/components/kosztorys/editor/use-kosztorys-editor-context.tsx` ·
      „czy to warsztat" było odpowiadane w **14 miejscach** (8× `templatePresetId == null`, 6× własne
      wywołanie `editorNoun`). `isWorkshop` i `noun` publikowane raz z kontekstu, 10 plików przestawione.
- [x] fixed · simplify (simplification) · `src/components/kosztorys/editor/grid/column-selection.ts` ·
      „lista zamknięta" (podgląd / warsztat) rozpisana jako dwa niezależne boole w trzech bramkach —
      trzecia (`orderAssembled`) została po prostu zapomniana i zapisana kolejność kolumn wciąż
      przestawiała warsztat. Jedna funkcja `closedColumnList`, trzy wywołania.
- [x] fixed · simplify (simplification) · `src/lib/actions/investment-action.ts:51` · dwie gałęzie
      celu (id wprost / przez rodzica wiersza) spinały się w jedną bramkę `gate` — sprawdzenie
      blokady, wywołanie handlera i mirror były wypisane po dwa razy.
- [x] fixed · simplify (reuse) · `src/lib/kosztorys/snapshot-format.ts` · `emptySnapshotPayload()` —
      cztery puste tablice + wersja schematu były wypisane dwa razy (`createEmptyPresetAction`,
      `clearKosztorysAction`), czyli dwie szanse na podanie czytelnikowi niepełnego payloadu.
- [x] fixed · simplify (reuse) · `src/lib/db/investment-lock.ts` · ręczna koercja `template_preset_id`
      → `numOrNull` z `@/lib/db/row-coerce`, w obu mapperach.
- [x] fixed · simplify (efficiency) · `src/lib/actions/kosztorys-presets.ts` · `getDb(payload)`
      wywoływane trzy razy w `openPresetInWorkshopAction` — wyniesione raz.
- [x] fixed · simplify (simplification) · `src/components/kosztorys/editor/dialogs/reload-from-preset-dialog.tsx` ·
      siedem ternarnych rozsianych po JSX → tabela `COPY`; wariant „szablon" dało się dotąd porównać
      z „kosztorysem" tylko czytając plik dwa razy.
- [x] fixed · simplify (simplification) · `src/components/presets/presets-data-table.tsx` ·
      `INITIAL_SORTING` po „Utworzono" po cichu zastępowało kolejność z `listPresets`
      (ostatnia edycja, NULLS LAST) — szablon ruszany dziś rano lądował pod takim sprzed miesiąca.
- [x] fixed · simplify (simplification) · `src/components/presets/create-empty-preset-dialog.tsx` ·
      warunek zapisu wyliczany dwa razy (przycisk / Enter) → jedno `canSave`.
- [x] fixed · simplify (simplification) · `src/components/kosztorys/editor/hooks/use-workshop-mirror-flush.ts:23` ·
      `useRef<number | null>(null)` → `useRef(0)`; wariant `null` nie miał znaczenia, bo efekt i tak
      zasiewa licznik na wejściu.
- [x] skipped · simplify (reuse) · `src/lib/actions/mirror-workshop-preset.ts` · opcjonalne
      `investmentId`, żeby `flushWorkshopPresetAction` nie czytało `getWorkshop` dwa razy — poprawna
      wersja musi czytać warsztat **bez** blokady, żeby poznać id, wziąć blokadę i przeczytać
      wskaźnik pod nią jeszcze raz. To dwa odczyty w tej samej ścieżce i przebudowa kolejności
      blokad; nic nie oszczędza.
- [x] skipped · simplify (efficiency) · `src/lib/actions/investment-action.ts` · `after()` z
      `next/server` zamiast `await` na mirrorze — zmienia zachowanie (mirror wypada poza okno akcji,
      a z nim gwarancje kolejności wobec `revalidate`), więc nie pod auto-naprawę.
- [x] skipped · simplify (efficiency) · `use-workshop-mirror-flush.ts` · zdjęcie `force` z ticku —
      tick wpadłby wtedy pod dławik i ogon znów by ginął, czyli dokładnie dziura, dla której ten
      hook istnieje.
- [x] skipped · simplify (efficiency) · `kosztorys_presets` · znacznik „brudny" w bazie zamiast
      `force` — nowa kolumna plus zapis przy **każdej** mutacji, żeby oszczędzić jeden claim raz na
      15 s. Więcej zapisów, nie mniej.
- [x] skipped · simplify (reuse/altitude) · `use-auto-snapshot.ts` + `use-workshop-mirror-flush.ts` ·
      wspólny `useRevisionInterval` — dwa wywołania pięciolinijkowego `setInterval` o różnej
      semantyce odmontowania (snapshot nie dopycha na wyjściu); parametry byłyby całym ciałem.
      Sam agent altitude dał temu niską pewność.
- [x] dropped · simplify (efficiency E2) · `src/lib/db/` · zlanie `FOR UPDATE` i odczytu wskaźnika w
      jedną instrukcję — E1 zdejmuje round-tripy na ~90% wywołań, E2 oszczędza jeden na reszcie i
      kosztuje nowy statement dublujący `getWorkshop`.
- [x] dropped · simplify (reuse) · `create-empty-preset-dialog.tsx` + `preset-row-actions.tsx` ·
      wspólny `PresetNameDialog` — parametry byłyby całym kodem.

## Simplify pass

Ran `/simplify` — 12 applied, 0 proposed, 4 skipped, 2 dropped; każde zgłoszenie wpięte wyżej w
`## Findings` (tag `simplify`). Bez osobnego raportu `mktemp` — zakres wywołania kazał składać
wszystko w tym pliku.

Jedna naprawa (E1) **wprowadziła regresję** i została złapana przez własne specy DB slice'a —
opisana wyżej jako 🔴 CRITICAL.

## Tests & suite

Bramka całego drzewa, po krokach 1–3:

- `pnpm typecheck` — zielony
- `pnpm lint` — 0 errors, 84 warnings (wszystkie zastane)
- `pnpm test` — **3809 passed / 329 skipped, 0 failed** (321 plików; ostateczny przebieg po
  domknięciu kolumn warsztatu). Po drodze dwa rodzaje czerwieni, oba zamknięte:
  - **Prawdziwa, naprawiona:** 7 testów w dwóch specach DOM — ich atrapa kontekstu edytora nie znała
    nowych `isWorkshop` / `noun`. Atrapy wyliczają je teraz tak samo jak `KosztorysEditorBody`, więc
    spec dalej steruje wszystkim z jednego wejścia (`templatePresetId`).
  - **Flaki pod obciążeniem, nie regresja:** `search-filter-input.test.tsx`,
    `deposit-payment-method.test.tsx`, `inspection-form.test.tsx`. Dwa przebiegi pakietu wskazały
    **różne** pliki, każdy z nich **przechodzi uruchomiony osobno** (12/12 i 5/5), a trzeci przebieg
    całego pakietu jest czysty. Żaden z tych plików ani ich źródeł nie jest tknięty przez ten slice
    (`git status` na obu drzewach: czysto) — wspólny mianownik to debounce/timery walczące o CPU z
    równoległymi workerami Vitesta. Do osobnej decyzji: czy te trzy specy ustabilizować
    (fake timers), czy zostawić.
- `pnpm test:integration` — 326 passed / 0 failed (70 plików, DB 5435). Ten przebieg złapał 🔴 spoza
  slice'u (dopisek „stary arkusz", wyżej).
- `pnpm build` — zielony (powtórzony po domknięciu kolumn warsztatu)
- `pnpm test:e2e` — nieuruchamiane (≈1 h; tylko na wyraźną prośbę). Ryzyko przeglądarkowe slice'u
  wypisane na EX-847.

**Nota wdrożeniowa.** Dwie migracje, obie **przyrostowe / czysto danowe**, więc kolejność jest
„prod przed pushem" — migruje **człowiek** (`pnpm db:migrate:prod`):

1. `20260922_0_preset_autosave` — dwie kolumny na `kosztorys_presets` (`mirrored_at`, `updated_at`).
2. `20260922_1_catalogue_legacy_marker_cleanup` — zdjęcie dopisku z 4 wierszy `work_catalogue_items`.

## Stan slice'u

**W przeglądzie, nie zarchiwizowany.** Ręczna weryfikacja w przeglądarce (`manual-checks.md`) nie
jest odhaczona, a dwa boxy wyżej czekają na decyzję właściciela.
