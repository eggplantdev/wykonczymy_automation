# Review-gate ledger — clean-texts-catalogue-names · 2026-09-15

Zakres: `staging...clean-texts-catalogue-names` (4 commity).
Krok 0.5 (przebieg przeglądarkowy) pominięty — nie zlecony w tej turze; checki ręczne
stoją otwarte w `context/foundation/manual-checks.md`.

## Findings

<!-- Format: [box] [severity, tylko checki bugowe] · disposition · `source` · `file:line` · co — dlaczego -->

- [x] 🔵 OBSERVATION · odrzucone · impl-review · `src/lib/kosztorys/sheet-import/item-key.ts:34` · pochodna ma 253 wpisy, ale 252 różne cele (dwie stare pisownie „…ulozenie kuchni" zlewają się w jeden cel) — celowe scalenie, w katalogu istnieje tylko jedna z nich.
- [x] 🔵 OBSERVATION · odrzucone · impl-review · `src/scripts/fix-kosztorys-descriptions.ts:43` · skrypt hurtowy importuje `cleanDescription`, więc dziedziczy 915 podstawień i w trybie `CATALOGUE=1` **pisze** do katalogu. Skrypt grupuje i raportuje kolizje przed zapisem (pada głośno), a plan mówił o braku przebiegu hurtowego **w tej zmianie** — nie o nietykalności skryptu.
- [x] 🔵 OBSERVATION · odrzucone · impl-review · `src/lib/kosztorys/sheet-import/build-import-plan.ts:231` · „Zastąp" nadpisuje opisy z arkusza, więc poprawiony tekst nie jest trwały na inwestycji re-importowanej — zachowanie sprzed zmiany, tożsamość przeżywa (o to chodziło w fazie 2).

- [x] 🔵 OBSERVATION · odrzucone · code-review · `src/lib/kosztorys/sheet-import/item-key.ts:1` · tabela (107 KB literałów, ~47 ms inicjalizacji) ląduje w kliencie edytora przez picker. Realne, ale przy ~5 użytkownikach na desktopie granica `dynamic()` kosztuje więcej niż oszczędza.
- [x] 🔵 OBSERVATION · odrzucone · code-review · `src/lib/kosztorys/sheet-import/item-key.ts:47` · 9 grup kluczy zlewa się w jeden fold, a `keyItems` rozróżnia duplikaty pozycją w arkuszu. 0 nowych kolizji w sekcji na 4635 wierszach — mechanizm zapisany, bo tak pęknie następne poszerzenie tabeli.
- [x] 🔵 OBSERVATION · odrzucone · code-review · `src/__tests__/lib/kosztorys/catalogue-name-fixes.test.ts:10` · `size === 915` to świadoma pluskwa-pułapka; churn przy każdej legalnej edycji tabeli nie jest wart mniej niż sygnał, który daje.

## Simplify pass

`/simplify` przeprowadzony w głównym wątku zamiast czterema agentami — powierzchnia logiczna diffu to ~40 linii, reszta to dane. 1 finding (dedup znacznika), zaaplikowany; findingi z pozostałych trzech kątów (reuse / efficiency / altitude) zero.

## Tests & suite

`pnpm typecheck` · `pnpm lint` · `pnpm test` (3439 zielonych) · `pnpm build` · `pnpm test:integration`
(67 plików, 297 testów) — wszystkie zielone. E2E nieuruchamiane (nie zlecone).
