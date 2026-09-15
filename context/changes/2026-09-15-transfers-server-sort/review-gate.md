# Review-gate ledger — transfers-server-sort (EX-777) · 2026-09-15

Zakres: `1374e663..HEAD` (4 commity, 27 plików źródłowych).
Step 0.5 (verification pass) pominięty — projekt nie ma skilla `verify-manual-checks`,
a przeglądarki nie uruchamiam bez wyraźnej prośby.

Fan-out (5 agentów, read-only): `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`,
`comment-noise-audit` (flag-only), trzy audyty struktury (`feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`).
`tailwind-v4-audit` — czysto, zero findingów.

## Findings

<!-- Format: [box] [severity, tylko checki szukające bugów] · disposition · `source` · `file:line` · co — dlaczego -->

- [x] 🟡 WARNING · fixed · `code-review` + `impl-review` · `src/lib/actions/fetch-transfers-for-invoices.ts:17,22,36` · Ścieżka wydruku omijała whitelistę — `?sort=investment` dawał ekran po `-id`, a wydruk po `-createdAt` (Payload połyka nierozwiązywalną ścieżkę). Fix: `validTransferSort` w `src/lib/queries/transfer-sort.ts` jako jedna bramka, wołana przez hosty stron, akcję wydruku i stan tabeli (`transfer-data-table.tsx:49`). Zwraca `undefined` zamiast domyślnej wartości, żeby ten sam helper obsłużył trzech konsumentów.
      test: unit — strażnik regresji w `src/__tests__/lib/queries/transfer-sort.test.ts` (`describe('validTransferSort')`). **Nie TDD**: fix wylądował pierwszy, więc bramka `/10x-tdd` odmówiła fazy z istniejącą implementacją; spec dopisany po fixie i tak jest zapisany.
- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/queries/transfer-filters.ts:143-146` · `.filter(Boolean)` przepuszczał `Infinity`, więc `?worker=1e999` docierał do surowego SQL jako `worker_id IN (infinity)` i 500-ił stronę. Fix: `.filter((id) => Number.isInteger(id) && id !== 0)` — zamyka też `investment`/`createdBy`/`sourceRegister`/`expenseCategory`/`otherCategory`.
      test: unit — `src/__tests__/build-transfer-filters.test.ts`, `it.each(['1e999','-1e999','1.5','NaN','Infinity'])` + przypadek mieszany `'3,1e999,7'`. Oba padają na starym `.filter(Boolean)`. Post-fix, nie TDD (jw.).
- [x] 🟡 WARNING · dropped · `impl-review` · `context/foundation/manual-checks.md:5308` · Commit `0835823c` dokleił dosłowną kopię poprzedzającej notki — artefakt ręcznie budowanego patcha. Równoległa sesja usunęła tę linię we własnych, niezacommitowanych zmianach (`git show HEAD:… | grep -c` → 2, drzewo robocze → 1). Nie dotykam cudzego brudnego pliku; poprawka wyjdzie z ich commitem.
- [x] 🟡 WARNING · skipped · `impl-review` · `src/__tests__/lib/queries/transfer-sort-spans-dataset.db.test.ts` · Spec przechodzi także na kodzie sprzed zmiany — jego podmiot (`findTransfersRaw`) już wcześniej przyjmował `sort`. Zostaje jako strażnik podłogi datasetu, ale nie liczy się jako pokrycie ryzyka slice'a. Fix-now zrobiony: strażnik `firstPage.length > 0` (`:34`), żeby pusty wynik dawał czytelny assert zamiast TypeError.
      test: no automated test · e2e — właściwa warstwa zgłoszona jako **EX-781** (`e2e-backlog`); obowiązek E2E ze Step 3 tym samym domknięty.
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `src/components/ui/data-table/data-table.tsx:136` · Shift-click multi-sort to afordancja, której sterowany kontrakt nie honoruje — drugi klucz ginie w round-tripie przez jeden parametr URL. Fix: `enableMultiSort: !isManualSorting`.
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `src/lib/queries/transfers.ts:25` · Literał `'-id'` (zasilający klucz `unstable_cache`) → `DEFAULT_TRANSFER_SORT`.
- [x] 🔵 OBSERVATION · fixed · `impl-review` + `comment-noise` · `src/lib/transfers/sortable-columns.ts:4` · Komentarz mówił „siedem", wymieniał pięć, `enableSorting: false` niosło dziewięć. Rationale zostaje, liczebnik wypada.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/components/ui/data-table/data-table.tsx:129-133` · Updater rozwiązywany względem `sorting` z czasu renderu — nieosiągalne: TanStack woła updater synchronicznie w handlerze, a pozostałych 7 hostów `DataTable` nie jest sterowanych.
- [x] 🔵 OBSERVATION · skipped · `impl-review` · `src/components/ui/data-table/data-table.tsx:94` · Sam `sorting` bez `onSortingChange` jest po cichu ignorowany. Kontrakt zamierzony i udokumentowany, jedyny konsument przekazuje oba propy; domknięcie (unia rozłączna) dotyka publicznego typu używanego przez 8 tabel — własny refactor.
- [x] 🔵 OBSERVATION · skipped · `code-review` · `src/lib/transfers/sortable-columns.ts:8` · Nic nie przypina whitelisty do realnego pola Payloada. Domknięcie wymaga typu wywiedzionego z `payload-types.ts` (plik gitignorowany) — nieproporcjonalne do ryzyka.
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/components/transfers/transfer-data-table.tsx:49` · Nieprawidłowy `?sort=` zostawał w URL-u i malował strzałkę nagłówka, bo stan tabeli czytał surowy parametr. Zamknięte tym samym fixem co WARNING #1 — stan tabeli idzie przez `validTransferSort`. (Pierwotnie triage'owane jako „dropped"; wspólna bramka zamknęła to za darmo.)
- [x] 🔵 OBSERVATION · dropped · `code-review` · `src/components/transfers/transfer-data-table.tsx:72` · `isPending` z `useTransition` wyrzucany, więc wolny klik w nagłówek czyta się jak zignorowany. Osobna robota nad feedbackiem ładowania tabeli.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/lib/queries/transfer-filters.ts:143` · `?worker=abc` był ignorowany, teraz daje `NO_RESULTS` — identyczna reguła jak dla pozostałych filtrów encji, czyli usunięcie niespójności.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/lib/queries/export-transfers.ts:12` · Domyślny sort eksportu `-date` → `-id` przestawia też kolejność w ZIP-ie faktur. Zamierzone — jeden domyślny porządek dla ekranu i wszystkiego, co się z niego bierze.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/lib/transfers/sort-transfer-rows.ts` (skasowany) · Semantyka NULL-ów i kolacji polskiej przeszła z JS-owej na bazodanową. Nieuniknione przy przeniesieniu sortu na serwer; `-createdAt` dokładany przez Payload trzyma paginację stabilną.
- [x] fixed · `structure-scatter-audit` + `simplify` · `src/lib/table/sort-param.ts:13` · Zdejmowanie prefiksu `-` było zaimplementowane dwa razy. Fix: eksport `sortParamColumnId(param)`, oba miejsca go wołają.
- [x] fixed · `simplify` (altitude) · `src/components/tables/transfers.tsx:250-259` · Dziesięć ręcznych `enableSorting: false` to objaw; źródłem jest whitelista. Fix: sortowalność wyprowadzona przez `isServerSortableColumn(column.id)`. Sprawdzone jako behavior-preserving — 8 kolumn bez flagi przed zmianą to dokładnie whitelista (`id, date, amount, vatPlane, type, description, paymentMethod, createdAt`).
- [x] fixed · `simplify` (altitude) · `src/__tests__/components/tables/transfers-sortable-columns.test.ts` · Po wyprowadzeniu asercja „każda sortowalna kolumna jest na whitelicie" jest tautologiczna. Zostaje odwrotna, nietautologiczna: wpis whitelisty musi być kolumną, którą tabela renderuje.
- [x] fixed · `comment-noise` · `src/components/transfers/transfer-data-table.tsx:46` · Komentarz powtarzał `searchParams.get('sort')` i domykał się ogonem o stanie, którego już nie ma. Przepisany pod nową bramkę.
- [x] fixed · `comment-noise` · `src/components/transfers/print-transfers-button.tsx:51-53` · Ogon „and nothing here re-sorts what comes back" — narracja o nieobecnym kodzie. Wycięty, dwa zdania rationale zostają. (impl-review podał `:209`, plik ma 93 linie — chodziło o ten sam komentarz.)
- [x] fixed · `comment-noise` · `src/lib/queries/transfer-sort.ts`, `src/lib/table/sort-param.ts:4` i `:18`, `src/lib/queries/fetch-transfer-rows.ts:20` · Cztery komentarze przycięte — rationale zostaje, restatement wypada.
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
