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

_Przycięte przy archiwizacji (2026-09-23): wypadło 25 pozycji `fixed`. Trwałym zapisem naprawy jest jej commit; tu zostaje negatyw, którego git nie trzyma — to, czego świadomie **nie** zrobiono i dlaczego. Bilans sprzed przycięcia: 25 fixed, 7 dismissed, 5 filed, 5 dropped, 5 skipped · 0 otwartych._

<!-- Format: [box] · <severity, tylko korektnościowe> · disposition · `source` · `file:line` · co — dlaczego -->

- [x] filed EX-843 · code-review · `src/components/kosztorys/editor/hooks/use-workshop-mirror-flush.ts` ·
      zamknięcie karty/przeglądarki gubi ogon (brak `pagehide` + `sendBeacon`) — okno strat ≤ 15 s.
      test: no automated test — `pagehide` w jsdom nie odtwarza realnego teardownu; e2e nieproporcjonalne.
      **ZAMKNIĘTE 2026-09-23 (bramka review, zakres 22–23.09):** ryzyko zdjęte inaczej niż w issue —
      hook słucha `visibilitychange` i dopycha, póki strona jeszcze żyje, więc zwykła Server Action
      wychodzi. `pagehide` + `sendBeacon` NIE jest tu poprawką (beacon nie zawoła akcji); uzasadnienie
      stoi w kodzie przy listenerze.
- [x] filed EX-844 · feature-first-structure (P2) · `src/lib/actions/kosztorys-presets.ts:233,242` ·
      `listPresetsAction` / `listPresetSectionsAction` to **odczyty** w katalogu mutacji — miejsce to
      `src/lib/queries`. Rusza publiczne importy, więc nie w tym slice'u.
      **ZROBIONE 2026-09-23:** oba odczyty stoją w `src/lib/queries/presets.ts`.
- [x] filed EX-845 · feature-first-structure (P3) · `src/lib/db/workshop-investment.ts` ·
      `resolveWorkshopInvestment` mutuje (tworzy wiersz) z warstwy data-access, która ma być
      „statement + mapper".
- [x] filed EX-846 · module-cohesion (M2/S3) · `src/lib/db/investment-lock.ts`,
      `src/lib/actions/lock-investment.ts` · nazwy mówią „lock", a moduły robią bramkę/wiersz —
      `investment-gate.ts` / `lock-investment-row.ts`. Czysty rename, ale dotyka cudzych importów.
      **ZROBIONE 2026-09-23:** `src/lib/db/investment-gate.ts` +
      `src/lib/db/lock-investment-for-replace.ts` (nie `lib/actions/lock-investment-row.ts` — cel
      wylądował w warstwie `db`, bo to blokada wiersza, nie mutacja domenowa).
- [x] filed EX-847 · gate (Step 3) · `e2e/` · przełączenie szablonu w warsztacie (eksmisja + punkt
      powrotu) to ryzyko przeglądarkowe — etykieta `e2e-backlog` nadana.
      test: no automated test (jeszcze) · e2e — obowiązek przeniesiony na EX-847.
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
