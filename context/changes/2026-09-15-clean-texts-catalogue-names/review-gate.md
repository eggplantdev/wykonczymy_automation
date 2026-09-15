# Review-gate ledger — clean-texts-catalogue-names · 2026-09-15

Zakres: `staging...clean-texts-catalogue-names` (4 commity).
Krok 0.5 (przebieg przeglądarkowy) pominięty — nie zlecony w tej turze; checki ręczne
stoją otwarte w `context/foundation/manual-checks.md`.

## Findings

<!-- Format: [box] [severity, tylko checki bugowe] · disposition · `source` · `file:line` · co — dlaczego -->

- [x] 🟡 WARNING · naprawione · impl-review + code-review · `src/lib/kosztorys/clean-description.ts:192` · `cleanDescription` nie jest idempotentne dla wartości z „c.w.u. oraz z.w.u." — brak tych skrótów w `ABBREVIATIONS`, więc drugi przebieg robi „…c.w.u. Oraz z.w.u.". Łamie kontrakt nagłówka modułu i kryterium „drugie kliknięcie = 0 zmian". Trafia 1 z 4635 wierszy rozpisek dziś (item 4800) + wiersze katalogu 80/81.
      test: test-driven-debugging · unit — czerwony repro przez pętlę po `CATALOGUE_NAME_FIXES.values()`
- [x] 🟡 WARNING · naprawione · impl-review + code-review · `src/__tests__/lib/kosztorys/clean-description.test.ts:31` · strażnik idempotencji sprawdza 4 ręcznie wybrane stringi, żaden nie jest tym psującym się; niezmiennik dotyczy wszystkich 915 wartości → iterować po `values()`.
- [x] 🔵 OBSERVATION · naprawione · impl-review · `src/__tests__/lib/kosztorys/catalogue-name-fixes.test.ts:30` · test łańcuchów liczy `keys.has(fold(value))`, a kod szuka `FOLDED_TYPO_FIXES(fold(value))` — dziś zgodne (0 łańcuchów w obu), ale strażnik stoi obok pilnowanej rzeczy.
- [x] 🔵 OBSERVATION · naprawione · impl-review + code-review · `src/__tests__/lib/db/work-catalogue-key-collisions.test.ts:27` · spec pilnuje unikalności świeżo liczonych kluczy, a realny tryb awarii to rozjazd świeżego klucza ze **składowanym** `match_key` (`ON CONFLICT DO NOTHING` → duplikat zamiast update). 0 z 843 dziś; asercja per wiersz nic nie kosztuje.
- [x] przeniesienie · naprawione · structure · `src/__tests__/lib/db/work-catalogue-key-collisions.test.ts` · spec leży pod lustrem `src/lib/db/`, a jego system pod testem to `catalogueKey` (`src/lib/kosztorys/work-catalogue/catalogue-key.ts`) — AGENTS.md zabrania. Docelowo `src/__tests__/lib/kosztorys/work-catalogue/catalogue-key-collisions.test.ts`; discovery niezależne od ścieżki.
- [x] komentarz · naprawione · comment-noise · `src/lib/kosztorys/clean-description.ts:188` · pierwsze zdanie powtarza nazwę symbolu i dubluje nagłówek modułu — przyciąć do samego „dlaczego wygrywają nad unshout/sentenceCase".
- [x] komentarz · naprawione · comment-noise · `src/lib/kosztorys/sheet-import/item-key.ts:31` · liczba `253` nie jest nigdzie asertowana i zgnije — albo przypiąć testem, albo usunąć z komentarza.
- [x] komentarz · naprawione · comment-noise · `src/__tests__/lib/kosztorys/catalogue-name-fixes.test.ts:6` · „915 linii" jest faktycznie błędne (915 wpisów / 1975 linii).
- [x] komentarz · naprawione · comment-noise · `src/__tests__/lib/db/work-catalogue-key-collisions.test.ts:30` · komentarz powtarza kod pod spodem.
- [x] 🔵 OBSERVATION · naprawione · impl-review · `src/lib/kosztorys/clean-description.ts:193` · `if (named) return named` (truthiness) vs `?? spelled` w `item-key.ts:47` — pusta wartość rozjechałaby oba. 0 pustych dziś.
- [x] 🔵 OBSERVATION · naprawione · impl-review · `context/changes/2026-09-15-clean-texts-catalogue-names/plan.md:387` · SHA-e w Progress (`ae010767`, `ca689508`, `86a2ce62`) są sprzed amendów; gałąź niesie `d3fea016`, `f01637df`, `dfa69f81`.
- [x] 🔵 OBSERVATION · odrzucone · impl-review · `src/lib/kosztorys/sheet-import/item-key.ts:34` · pochodna ma 253 wpisy, ale 252 różne cele (dwie stare pisownie „…ulozenie kuchni" zlewają się w jeden cel) — celowe scalenie, w katalogu istnieje tylko jedna z nich.
- [x] 🔵 OBSERVATION · odrzucone · impl-review · `src/scripts/fix-kosztorys-descriptions.ts:43` · skrypt hurtowy importuje `cleanDescription`, więc dziedziczy 915 podstawień i w trybie `CATALOGUE=1` **pisze** do katalogu. Skrypt grupuje i raportuje kolizje przed zapisem (pada głośno), a plan mówił o braku przebiegu hurtowego **w tej zmianie** — nie o nietykalności skryptu.
- [x] 🔵 OBSERVATION · odrzucone · impl-review · `src/lib/kosztorys/sheet-import/build-import-plan.ts:231` · „Zastąp" nadpisuje opisy z arkusza, więc poprawiony tekst nie jest trwały na inwestycji re-importowanej — zachowanie sprzed zmiany, tożsamość przeżywa (o to chodziło w fazie 2).

- [x] 🟡 WARNING · naprawione · code-review · `src/lib/kosztorys/clean-description.ts:192` · lookup nie zdejmował „[stary arkusz]", więc 553 z 843 wierszy katalogu po wstawieniu z pickera nigdy nie trafiłyby w tabelę zbudowaną właśnie dla nich. Teraz znacznik schodzi na czas lookupu i wraca na wynik.
      test: TDD · unit — `cleanDescription('motnaz tv [stary arkusz]')`, zwalidowany na czerwono
- [x] 🟡 WARNING · naprawione · code-review · `src/__tests__/lib/db/work-catalogue-key-collisions.test.ts:25` · spec przechodził jałowo na pustym katalogu — dołożona podłoga `> 500` wierszy.
      test: TDD · integration
- [x] dedup · naprawione · simplify · `src/scripts/fix-kosztorys-descriptions.ts:88` · skrypt powtarzał taniec zdejmij-popraw-doklej, który `cleanDescription` teraz robi sam; `catalogueKey` i tak zdejmuje znacznik wewnętrznie.
- [x] 🔵 OBSERVATION · odrzucone · code-review · `src/lib/kosztorys/sheet-import/item-key.ts:1` · tabela (107 KB literałów, ~47 ms inicjalizacji) ląduje w kliencie edytora przez picker. Realne, ale przy ~5 użytkownikach na desktopie granica `dynamic()` kosztuje więcej niż oszczędza.
- [x] 🔵 OBSERVATION · odrzucone · code-review · `src/lib/kosztorys/sheet-import/item-key.ts:47` · 9 grup kluczy zlewa się w jeden fold, a `keyItems` rozróżnia duplikaty pozycją w arkuszu. 0 nowych kolizji w sekcji na 4635 wierszach — mechanizm zapisany, bo tak pęknie następne poszerzenie tabeli.
- [x] 🔵 OBSERVATION · odrzucone · code-review · `src/__tests__/lib/kosztorys/catalogue-name-fixes.test.ts:10` · `size === 915` to świadoma pluskwa-pułapka; churn przy każdej legalnej edycji tabeli nie jest wart mniej niż sygnał, który daje.

## Simplify pass

`/simplify` przeprowadzony w głównym wątku zamiast czterema agentami — powierzchnia logiczna diffu to ~40 linii, reszta to dane. 1 finding (dedup znacznika), zaaplikowany; findingi z pozostałych trzech kątów (reuse / efficiency / altitude) zero.

## Tests & suite
