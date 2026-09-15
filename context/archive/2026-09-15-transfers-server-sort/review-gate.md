# Review-gate ledger — transfers-server-sort (EX-777) · 2026-09-15

Zakres: `1374e663..HEAD` (4 commity, 27 plików źródłowych).
Step 0.5 (verification pass) pominięty — projekt nie ma skilla `verify-manual-checks`,
a przeglądarki nie uruchamiam bez wyraźnej prośby.

Fan-out (5 agentów, read-only): `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`,
`comment-noise-audit` (flag-only), trzy audyty struktury (`feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`).
`tailwind-v4-audit` — czysto, zero findingów.

## Findings

> **Przycięte przy archiwizacji (2026-09-15).** Wypadło **12 findingów z dyspozycją `fixed`** —
> trwałym zapisem naprawionego findingu jest commit, który go naprawił (`2b2f0d0b`), a nie linijka
> w rejestrze; po zamknięciu slice'a „naprawione" to po prostu kod, czytelny w źródle. Zostaje
> negatywna przestrzeń, której git nie trzyma: co uznano za nieszkodliwe, co świadomie odpuszczono
> i dlaczego. Tally sprzed przycięcia (27): **12 fixed, 8 dismissed, 3 skipped, 3 dropped,
> 1 filed (EX-782) · 0 open.**

<!-- Format: [box] [severity, tylko checki szukające bugów] · disposition · `source` · `file:line` · co — dlaczego -->

- [x] 🟡 WARNING · dropped · `impl-review` · `context/foundation/manual-checks.md:5308` · Commit `0835823c` dokleił dosłowną kopię poprzedzającej notki — artefakt ręcznie budowanego patcha. Równoległa sesja usunęła tę linię we własnych, niezacommitowanych zmianach (`git show HEAD:… | grep -c` → 2, drzewo robocze → 1). Nie dotykam cudzego brudnego pliku; poprawka wyjdzie z ich commitem.
- [x] 🟡 WARNING · skipped · `impl-review` · `src/__tests__/lib/queries/transfer-sort-spans-dataset.db.test.ts` · Spec przechodzi także na kodzie sprzed zmiany — jego podmiot (`findTransfersRaw`) już wcześniej przyjmował `sort`. Zostaje jako strażnik podłogi datasetu, ale nie liczy się jako pokrycie ryzyka slice'a. Fix-now zrobiony: strażnik `firstPage.length > 0` (`:34`), żeby pusty wynik dawał czytelny assert zamiast TypeError.
      test: no automated test · e2e — właściwa warstwa zgłoszona jako **EX-781** (`e2e-backlog`); obowiązek E2E ze Step 3 tym samym domknięty.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/components/ui/data-table/data-table.tsx:129-133` · Updater rozwiązywany względem `sorting` z czasu renderu — nieosiągalne: TanStack woła updater synchronicznie w handlerze, a pozostałych 7 hostów `DataTable` nie jest sterowanych.
- [x] 🔵 OBSERVATION · skipped · `impl-review` · `src/components/ui/data-table/data-table.tsx:94` · Sam `sorting` bez `onSortingChange` jest po cichu ignorowany. Kontrakt zamierzony i udokumentowany, jedyny konsument przekazuje oba propy; domknięcie (unia rozłączna) dotyka publicznego typu używanego przez 8 tabel — własny refactor.
- [x] 🔵 OBSERVATION · skipped · `code-review` · `src/lib/transfers/sortable-columns.ts:8` · Nic nie przypina whitelisty do realnego pola Payloada. Domknięcie wymaga typu wywiedzionego z `payload-types.ts` (plik gitignorowany) — nieproporcjonalne do ryzyka.
- [x] 🔵 OBSERVATION · dropped · `code-review` · `src/components/transfers/transfer-data-table.tsx:72` · `isPending` z `useTransition` wyrzucany, więc wolny klik w nagłówek czyta się jak zignorowany. Osobna robota nad feedbackiem ładowania tabeli.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/lib/queries/transfer-filters.ts:143` · `?worker=abc` był ignorowany, teraz daje `NO_RESULTS` — identyczna reguła jak dla pozostałych filtrów encji, czyli usunięcie niespójności.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/lib/queries/export-transfers.ts:12` · Domyślny sort eksportu `-date` → `-id` przestawia też kolejność w ZIP-ie faktur. Zamierzone — jeden domyślny porządek dla ekranu i wszystkiego, co się z niego bierze.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/lib/transfers/sort-transfer-rows.ts` (skasowany) · Semantyka NULL-ów i kolacji polskiej przeszła z JS-owej na bazodanową. Nieuniknione przy przeniesieniu sortu na serwer; `-createdAt` dokładany przez Payload trzyma paginację stabilną.
- [x] filed **EX-782** · `simplify` (efficiency) · `src/lib/transfers/sortable-columns.ts:9` · Pięć z ośmiu kolumn sortowalnych (`date`, `amount`, `vatPlane`, `type`, `paymentMethod`) nie ma indeksu btree, więc `?sort=-amount` wymusza Seq Scan + Sort przy każdym kliknięciu strony. Nie fix-now: wymaga ręcznie pisanej migracji (`AGENTS.md` § Migrations — `migrate:create` emituje phantom drift) i `pnpm db:migrate:prod` uruchomionego przez człowieka. `https://linear.app/ex-plant/issue/EX-782`, projekt Wykonczymy, Low, Refs: EX-777.
- [x] dismissed · `simplify` (reuse) · `src/lib/utils/build-filter-config.ts` · `workers` i `users` mapują tę samą listę pracowników — to dwa niezależnie nazwane filtry nad jednym źródłem, nie duplikacja mechanizmu.
- [x] dismissed · `simplify` (altitude) · `src/components/ui/data-table/data-table.tsx:94` · Opt-in `manualSorting` to uogólnienie współdzielonego prymitywu, nie gałąź „dla transakcji"; pozostałe 8 tabel nietknięte.
- [x] dismissed · `simplify` (simplification) · `src/lib/transfers/sortable-columns.ts` vs `src/lib/table/sort-param.ts` · Podział domenowe/generyczne jest poprawny; generyczna fabryka whitelisty przy jednym konsumencie to przedwczesna generalizacja.
- [x] dismissed · `simplify` (efficiency) · `src/lib/queries/fetch-transfer-rows.ts:42` · Przewleczenie `sort` nie rozsekwencjonowało `Promise.all`.
- [x] dropped · `structure-scatter-audit` · `src/lib/transfers/sortable-columns.ts:8` · `lib/transfers/` to konkurencyjny dom wobec `src/lib/constants/transfers.ts` — ryzyko (N+1). Trzy domy są zasadne, graf zależności jednokierunkowy; najtańsze domknięcie to reguła w `AGENTS.md`, czyli churn docs przy jednym pliku.

## Simplify pass

Ran /simplify — 11 applied, 1 filed (EX-782), 5 dismissed, 1 dropped; każdy finding złożony do `## Findings` (tag `simplify`).
Raport: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.bI0hLKVkwN.md`

## Tests & suite

- `pnpm typecheck` — czysto.
- `pnpm exec vitest run` na 5 plikach dotkniętych przez fixy — **79 passed**.
- `pnpm exec vitest run src/__tests__/lib/queries/transfer-sort.test.ts src/__tests__/build-transfer-filters.test.ts` — **59 passed** (44 + 15).
- Strażniki regresji zweryfikowane jako nietautologiczne: `1e999` i `1.5` padają na `.filter(Boolean)` sprzed fixu.
- Obowiązek E2E: domknięty przez **EX-781** (`e2e-backlog`), nie autorowany w tym gate.
- Pełny pakiet (`pnpm test`) — do decyzji użytkownika.

## Archive gate

**Nie archiwizować.** Sekcja tego slice'a w `context/foundation/manual-checks.md` ma 13 nieodhaczonych
pozycji, więc EX-777 stoi na `in review` (etykieta `in review`, status `In Progress` — zespół Ex-plant
nie ma stanu `In Review`), nie `done`. Wszystkie boxy w `## Findings` zamknięte — żaden finding nie
blokuje.
