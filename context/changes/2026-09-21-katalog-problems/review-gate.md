# Review-gate ledger — katalog-problems · 2026-09-21

Zakres: `5344d1bc..HEAD` (fazy 1–4 + domknięcie). Krok 0.5 (przebieg w przeglądarce) pominięty —
Playwright uruchamiany tylko na wyraźną prośbę.

Fan-out (read-only): `/10x-impl-review` (APPROVED — 0 critical · 1 warning · 5 observations),
`/code-review` (3 🟡 · 5 🔵), `feature-first-structure` + `module-cohesion-audit` +
`structure-scatter-audit`, `comment-noise-audit`. `/tailwind-v4-audit` odpadł — slice nie rusza
stylów.

## Findings

- [x] 🟡 WARNING · fixed · code-review · `catalogue-compare-dialog.tsx:82` · „Pokaż w rozpisce"
      wyłączało zawężenie, gdy problem był już zaangażowany — `toggleConditionExclusive` przełącza,
      a nie ustawia; przycisk zawęża teraz tylko, gdy warunek jest zgaszony.
      test: test-driven-debugging · dom — `catalogue-compare-dialog.test.tsx` trzyma oba przebiegi
      (zgaszony → zawęża, zaangażowany → zostaje zawężony).
- [x] 🟡 WARNING · fixed · code-review · `catalogue-compare-dialog.tsx:62` · raport gasł do `null`
      przy zamykaniu, więc każde zamknięcie migało czerwonym „Brak katalogu prac do porównania." —
      `useDeferredValue(open)` zamiast twardej bramki; raport przestaje znikać.
      test: no automated test · — zjawisko czysto animacyjne (klatka zamknięcia), tańszej warstwy
      niż przeglądarka nie ma; pokryte punktem 3 w EX-837.
- [x] 🟡 WARNING · fixed · impl-review · `catalogue-compare-dialog.tsx:62` · podpowiedzi „może chodzi
      o…" liczyły się synchronicznie na klatce otwarcia (0,4 s przy 42 pozycjach, 10,7 s przy 400) —
      ta sama zmiana na `useDeferredValue` maluje raport bez podpowiedzi i dolicza je w kolejnym
      przebiegu.
      test: no automated test · — próg wydajnościowy, nie stan; zmierzony ręcznie, bez progu do
      przypięcia w spec-u.
- [x] 🔵 OBSERVATION · fixed · code-review · `catalogue-compare-words.ts:1` · pusta rozpiska
      dostawała komunikat „Brak katalogu prac" — dwa powody, dwa zdania (`emptyReportReason`).
      test: TDD · dom — trzeci przypadek w `catalogue-compare-dialog.test.tsx`.
- [x] 🔵 OBSERVATION · fixed · code-review · `build-catalogue-comparison.ts:104` · separator `|`
      w kluczu pamięci podręcznej zlewał („a|b", „c") z („a", „b|c") — `\u0000`.
      test: no automated test · — kolizja wymaga opisu z `|`; strażnikiem jest sam separator, a
      `catalogue-key-collisions.test.ts` pilnuje właściwego klucza.
- [x] 🔵 OBSERVATION · skipped · code-review · `catalogue-compare-dialog.tsx:184` · `router.refresh()`
      po zapisie do katalogu odświeża całą trasę, nie sam cennik — poprawne i tanie w tym oknie;
      zbieżność ścieżek do cennika opisana w EX-838.
- [x] 🔵 OBSERVATION · dropped · code-review · `use-kosztorys-editor.ts:381` · memo porównania
      przelicza się przy każdej zmianie `rows`, także takiej, która nie rusza ceny ani opisu —
      mieści się w budżecie (≈5 ms na 1000 pozycjach), klucz per-wiersz kosztowałby więcej.
- [x] 🔵 OBSERVATION · dismissed · code-review · `build-catalogue-comparison.ts:120` · pusty opis
      pomijany zamiast liczony jako „brak w katalogu" — celowe: świeży wiersz to nienapisana praca,
      nie rozjazd.
- [x] 🔵 OBSERVATION · skipped · impl-review · `catalogue-item-from-kosztorys-dialog` · podgląd
      zapisu czyta pozycję z bazy, więc nie widzi niezapisanego opisu — zachowanie sprzed slice'a,
      zmiana dotyka innej powierzchni i innego kontraktu (formularz jest miejscem na poprawkę).
- [x] 🔵 OBSERVATION · dropped · impl-review · `plan.md` faza 3 · lista plików w planie nie wymienia
      dwóch faktycznie ruszonych — blok fazy jest zapisem historycznym, nie bieżącą prawdą.
- [x] 🔵 OBSERVATION · filed · impl-review · slice · należność E2E nie była jeszcze zgłoszona —
      filed EX-837 (`e2e-backlog`).
      test: e2e — scenariusze 1–5 spisane w issue.
- [x] filed · module-cohesion · `use-kosztorys-editor.ts` / `work-catalogue.ts` · dwie drogi do
      cennika (prop do edytora vs `listWorkCatalogueAction` w oknie wstawiania) — filed EX-838.
- [x] dismissed · feature-first-structure · `catalogue-compare-dialog.tsx:193` ·
      `ShowInRozpiskaButton` trzymany w pliku okna zamiast w `ui/` — jeden konsument, domenowe
      brzmienie; promocja dopiero przy drugim katalogu konsumentów.
- [x] fixed · comment-noise · `use-kosztorys-catalogue-problems.test.tsx` · cztery komentarze po
      polsku w nowej specyfikacji — przetłumaczone (AGENTS.md: komentarze zawsze po angielsku).
- [x] fixed · comment-noise · `types.ts:174` · uzasadnienie „brak cennika ≠ pusty cennik" powtórzone
      słowo w słowo z `RowConditionCtxT.catalogueRowIds` — przycięte do wskaźnika.
- [x] dropped · comment-noise · pozostałe bufory (5 skreśleń / 2 przycięcia z raportu) · niosą
      uzasadnienie „dlaczego", którego kod nie mówi — STRIP TEST ich nie przechodzi na skreślenie.

## Simplify pass

Ran /simplify — 2 applied, 0 proposed, 1 dropped; każde ustalenie wpięte w `## Findings`
(tag `comment-noise` / `module-cohesion`). Bez osobnego raportu — ledger jest raportem.

## Tests & suite

- `pnpm typecheck` — czysto.
- `pnpm lint` — 0 błędów, 83 ostrzeżenia (wszystkie zastane, w `src/migrations`).
- `pnpm test` — 310 plików / 3724 testy zielone (pierwszy przebieg zgłosił 2 migotliwe timeouty
  5 s w specyfikacjach formularzy, zielone w powtórce; nie dotykają tego slice'a).
- `pnpm build` — przechodzi.
- `pnpm test:e2e` — nieuruchamiane (≈1 h, tylko na wyraźną prośbę); należność w EX-837.

## Status

Fazy 1–4 zamknięte, wszystkie skrzynki odhaczone, zero otwartych. Archiwizacja **wstrzymana**:
osiem sprawdzeń ręcznych w `context/foundation/manual-checks.md` czeka na człowieka, więc slice
zostaje w **in review**.
