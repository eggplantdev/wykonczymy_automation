---
date: 2026-09-02T15:55:27+0200
researcher: ex-Plant
git_commit: dc40ca81d0f89e51a64ecdc12bfc9c22ca24e98a
branch: staging
repository: wykonczymy
topic: 'EX-765 — rozbicie src/lib/kosztorys/row-conditions.ts na rejestr i mechanizmy'
tags: [research, codebase, row-conditions, module-cohesion, kosztorys]
status: complete
last_updated: 2026-09-02
last_updated_by: ex-Plant
---

# Research: EX-765 — rozbicie `row-conditions.ts` na rejestr i mechanizmy

**Date**: 2026-09-02T15:55:27+0200
**Researcher**: ex-Plant
**Git Commit**: `dc40ca81`
**Branch**: staging
**Repository**: wykonczymy

## Research Question

EX-765 proponuje rozbić `src/lib/kosztorys/row-conditions.ts` (dziś **625 linii**, nie 599 z opisu
issue) na `row-conditions/registry.ts` + `row-conditions/engine.ts`, z `row-conditions.ts` jako
**fasadą**, żeby call-site'y i spec nie ruszyły się w tym samym kroku. Czy szew jest prawdziwy, gdzie
dokładnie biegnie i czy fasada to właściwy kształt dla tego repo?

## Summary

**Szew jest prawdziwy i wyjątkowo czysty** — obie połówki mają **rozłączne zbiory zależności**:
wszystkie sześć domenowych importów (`calc`, `constants`, `plane-price-keys`, `settlement-rows`,
`stage-keys`, `subcontractor-price-guard`) obsługuje wyłącznie rejestr, a warstwa zapytań nie
importuje z `lib/kosztorys` **nic poza typem**. Zależność jest jednokierunkowa (rejestr → mechanizmy),
cykl jest niemożliwy.

**Ale fasada z opisu issue jest sprzeczna z konwencją repo.** Nie ma w `src/` **ani jednego**
przypadku pliku `X.ts` obok katalogu `X/`, a dwa istniejące podkatalogi w `lib/kosztorys/`
(`sheet-import/` 16 plików, `work-catalogue/` 10 plików) **nie mają `index.ts` — konsumenci importują
głęboko**. Powtarzalny kształt naprawy w tym repo (EX-515, cztery findingi cohesion) to: _wyciąć
rodzeństwo `.ts`, nazwać resztę uczciwie, **nie zakładać barrela**, strzałki jednokierunkowo, każdy
nowy plik dostaje własny spec_. Rekomendacja poniżej rezygnuje z fasady na rzecz **podkatalogu z
głębokimi importami** — kosztem 13 przepisanych linii importu, w całości bramkowanych przez `tsc`.

Ryzyko regresji jest bliskie zera: 0 zmian zachowania, 123 asercje w istniejącym specu + 4 spece
zależne, a jedyne realne ryzyko semantyczne (referencyjna stabilność zbiorów w `clientConditionIds`)
jest już pilnowane testem.

## Detailed Findings

### 1. Anatomia pliku (625 linii, 4 rodzaje w jednym module)

| Region                                                    | Linie   | Rodzaj                            |
| --------------------------------------------------------- | ------- | --------------------------------- |
| `RowConditionCtxT`, `RowConditionKindT`, `RowConditionT`  | 9–65    | typy (37 linii samego kontraktu)  |
| `hasItemDiscount`, `priceColumnsFor`, `ALL_PRICE_COLUMNS` | 69–85   | prywatne helpery rejestru         |
| `MEASURE_DIVERGED_CONDITION_ID`, `DISCOUNT_CONDITION_IDS` | 89–94   | eksportowane id wpisów            |
| `settledAtPercentRate`, `percentRateProblemLabel`         | 96–128  | strażnik EX-708 (prywatny)        |
| `ROW_CONDITIONS`                                          | 137–431 | **~295 linii danych, 22 wpisy**   |
| `BY_ID`, dwa mrożone zbiory, `clientConditionIds`         | 433–452 | indeks + mapowanie klienckie      |
| `isHider` … `sectionIdsWhereAllMatch`                     | 472–625 | **11 eksportowanych mechanizmów** |

Wzrost (21 commitów, 2026-08-14 → 2026-09-02, `git log --follow --numstat`): plik urodził się na 112
liniach **już ze zrośniętym rejestrem i warstwą zapytań**. Warstwa zapytań praktycznie nie urosła —
**żaden commit po `650aecd2` (08-17) nie dodaje nowego mechanizmu**. Urósł wyłącznie rejestr: trzy
skoki (`b2a2aba7` +111, `acf21753` +93, `c09a275d`+`650aecd2` +108) to ~50% całości. To jest
argument za szwem: rosnąca połowa jest danymi, stała połowa jest kodem.

### 2. Szew — co po której stronie

**Rejestr** (`registry.ts`, ~390 linii):

- wszystkie 5 prywatnych helperów — każdy wołany **wyłącznie** z pola `matches`/`revealsColumns`/
  `problemLabel`, żaden poniżej linii 431 (`hasItemDiscount` → :181,:188; `priceColumnsFor` → 10
  miejsc; `ALL_PRICE_COLUMNS` → :281,:292,:312; `settledAtPercentRate` → :418,:429;
  `percentRateProblemLabel` → :417,:428);
- **komplet sześciu domenowych importów** (`row-conditions.ts:1-6`);
- `MEASURE_DIVERGED_CONDITION_ID` i `DISCOUNT_CONDITION_IDS` — to **id wpisów**, a ich docblocki
  wprost mówią, że są „kept beside the entries … so adding a third rabat condition cannot leave the
  two lists disagreeing" (`:91-94`). Odsunięcie ich od tablicy to dokładnie ten dryf, któremu mają
  zapobiegać;
- `clientConditionIds` + jego dwa mrożone zbiory (`:437-452`) — wygląda na mechanizm, ale jego własny
  docblock (`:446-448`) mówi, że mieszka przy rejestrze, bo to fakt domenowy „które warunki mogą
  dotrzeć do klienta". Nie dotyka `BY_ID`.

**Mechanizmy** (`engine.ts`, ~195 linii): `BY_ID` (indeks pochodny, czytany przez dokładnie 6 funkcji,
rejestr go nie używa), `isHider` (reguła mechanizmu, wiąże `applyRowConditions` z `engagedHiders`),
`liftsToSections` (druga predykatowa **polityka**, ta sama kategoria co `isHider`) oraz pozostałe 9
eksportów.

**Trzeci plik `types.ts` — tak.** `RowConditionT` to 37 linii dokumentacji całego mechanizmu (co
znaczą `kind`, `tone`, `revealsColumns`, `sectionLabel`, `problemLabel`); to plik, który się otwiera,
żeby zrozumieć system, a nie coś, co się przewija na górze pliku z danymi. `RowConditionCtxT` jest
kontraktem **hosta** (`use-kosztorys-editor.ts:407,513` składa ten obiekt). Precedens w folderze
istnieje: `work-catalogue/types.ts`. Bez niego `registry.ts` znów łączyłby dwa rodzaje i odtwarzał
zapach, który EX-765 usuwa — tylko na 390 zamiast 625 liniach.

**Odrzucone cięcia**: podział rejestru po `kind` (kolejność tablicy JEST kolejnością wyświetlania —
`:130-136`, `active-filters-model.ts:64`; komentarze par krzyżują się między rodzajami), osobny plik
na prozę (`listLabels` to jedyna funkcja tekstowa — 5 linii, byłaby sama), rozbicie mechanizmów na
„czytelników zbioru" vs „liczących wiersze" (obie połówki dzielą `BY_ID` i `isHider`, wymusiłoby to
czwarty plik na współdzielony indeks).

### 3. Mapa konsumentów — 13 plików, wszystkie przez alias `@/`

Brak trafień w `e2e/`, `scripts/`, `src/scripts/`. Brak importów relatywnych, dynamicznych,
`import *` i re-eksportów przez barrel.

**Produkcja (7):**

- `src/components/kosztorys/editor/use-kosztorys-editor.ts:60-68` — najcięższy: `ROW_CONDITIONS`,
  `applyRowConditions`, `columnsRevealedBy`, `countMatching`, `liftsToSections`,
  `sectionIdsWhereAllMatch`, `MEASURE_DIVERGED_CONDITION_ID` (`:408,439,447,511,542`)
- `src/components/kosztorys/editor/kosztorys-editor-body.tsx:33` — `engagedConditionsOfKind`,
  `engagedHiders`, `listLabels` (`:187,223,234`)
- `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts:8` — `clientConditionIds`,
  `engagedPlane`, `isFoldSuppressed` (`:35,48,70`)
- `src/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.tsx:7-11` —
  `ROW_CONDITIONS`, `DISCOUNT_CONDITION_IDS`, `liftsToSections` (`:71-77,95`)
- `src/components/kosztorys/editor/toolbar/active-filters-model.ts:2` — `ROW_CONDITIONS` (`:56-58`)
- `src/lib/kosztorys/row-view.ts:3` — `applyRowConditions` (`:112-117`)
- `src/lib/kosztorys/problem-conditions.ts:1` — `ROW_CONDITIONS` (`:19`)

**Spece (6):** `lib/kosztorys/row-conditions.test.ts:2-15`, `client-document-subtotals.test.ts:2`,
`kosztorys-empty-sections.test.ts:2`, `measure-discrepancy.test.ts:2`, `stage-conditions.test.ts:2`,
`components/kosztorys/editor/toolbar/active-filters-model.test.ts:4`.

**Trzy typy (`RowConditionT`, `RowConditionCtxT`, `RowConditionKindT`) nie są importowane nigdzie
poza modułem** — ale są nośne (predykat typu `liftsToSections`, zwrotki `engagedConditionsOfKind` /
`engagedHiders`), więc zostają eksportowane. Nie są martwym kodem.

**Bez pokrycia specem po nazwie**: `listLabels`, `engagedHiders`, `liftsToSections`,
`MEASURE_DIVERGED_CONDITION_ID`, `DISCOUNT_CONDITION_IDS` — pominięcie któregoś w przenosinach
wybuchnie dopiero na `tsc`/buildzie, nie w vitest.

### 4. Spec — 666 linii, 66 testów, 123 asercje

`src/__tests__/lib/kosztorys/row-conditions.test.ts`, 10 bloków `describe` na **dwóch osiach**: trzy
bloki o zachowaniu rejestru (`:63` „the conditions, each on its boundary" — 17 testów, `:304`, `:327`)
i siedem per-eksport (`:410,486,498,524,544,614,637`).

Fikstury są **lokalne** (`STAGES :17`, `CTX :21`, `priceCells :26`, fabryka `row() :33-58`, skrót
`matches() :60`) — nic z `src/__tests__/stubs/`.

**Kluczowe sprzężenie dla cięcia:** `matches()` — helper używany przez 40 z 66 testów — dobija się do
**predykatów rejestru przez funkcję mechanizmu** `countMatching`. Spec nie da się rozciąć tym samym
szwem bez przepisania helpera; spec rejestru będzie importował silnik (co jest w porządku — to helper
testowy, nie zależność produkcyjna).

`row-conditions.test.ts:536` pilnuje **referencyjnej stabilności** zbiorów `clientConditionIds` —
jedyne realne ryzyko semantyczne przenosin jest już zabramkowane.

### 5. Konwencja repo — fasada jest tu obca

- **Zero precedensów `X.ts` obok `X/`** w całym `src/`.
- `sheet-import/` (16 plików) i `work-catalogue/` (10, z własnym `types.ts`) — **bez `index.ts`,
  importy głębokie**.
- Jedyne barrele w repo: `migrations`, `access`, `fonts`, `lib/env`, `components/forms/form-fields` —
  wszystkie wąskie, jednostronne. `lib/kosztorys/` ma **78 płaskich plików i żadnego `index.ts`**.
- Lint/tsconfig nie blokują niczego: jedyny `no-restricted-imports` jest ograniczony do `src/hooks/**`
  (`eslint.config.mjs:62-77`), brak `import/no-cycle`, `moduleResolution: "bundler"`.
  `.dependency-cruiser.cjs:8-14` ma `no-circular` na `warn` — bez wpływu, cyklu nie ma.
- `knip.json` nie zna barreli — fasada, którą część konsumentów omija, zaczyna produkować fałszywe
  „unused export".
- Globalna reguła `feature-first-structure` (SKILL.md:127-135) zakazuje barrela w korzeniu feature'a
  z powodu RSC; tutaj argument nie działa (obie połówki są frameworkowo czyste), więc fasada byłaby
  _dozwolona_ — po prostu bez precedensu i bez zysku, skoro alternatywą jest 13 mechanicznych linii.

### 6. Ograniczenia, których refaktor nie może naruszyć

1. **Id warunków zostają literałami.** `context/archive/2026-08-17-filtry-problemy/review-gate.md:61`
   odrzuca fabrykę generującą id per plan: „the ids are the one thing in this feature that is grepped
   from four places". Wzmocnione trwałością: mapa zaangażowanych id leży w localStorage
   **bez wersjonowania** (`2026-08-14-kosztorys-filter-conditions/review-gate.md:26`), więc zmiana id
   po cichu przeinterpretowuje zapisany klucz.
2. **`revealsColumns` / `sectionLabel` zostają polami wpisu**, nie tablicą obok gridu (`:56-60`) — to
   dokładnie ten dryf, któremu służy `column-config.ts`.
3. **Strzałka grid → lib.** `MEASURE_DIVERGED_CONDITION_ID` czyta `editor/grid/kosztorys-v2-columns.tsx`
   (AGENTS.md:276 — „a factory imports a primitive, never the reverse").
4. **Cała rzecz zostaje w `src/lib/kosztorys/`.** AGENTS.md:240-247: „Logic that is genuinely
   React-free belongs one layer further out in `src/lib/kosztorys/`, where it is testable without a
   hook renderer".
5. **Mirroring speców w pełni** (AGENTS.md:325-345): N plików źródłowych ⇒ N speców pod
   `src/__tests__/lib/kosztorys/row-conditions/`. Istniejący `row-conditions.test.ts` nie może zostać
   osierocony — mieszka w nim strażnik z `6a7c8f17` (niżej).
6. **Nazewnictwo**: kod po angielsku, słownictwo arkusza w UI/prozie (AGENTS.md:16-52).

### 7. Incydent, na który powołuje się komentarz w linii 446

Komentarz „it has been silently dropped by exactly that kind of refactor once already" wskazuje na
commit **`6a7c8f17`** (2026-08-17), _„guard the client-empty wiring the hook split dropped"_:

> `hideEmptyRows` was tested only at the storage boundary — nothing asserted the consequence …
> The merge with kosztorys-editor-hook-split proved the gap: **the split deleted the mapping and every
> one of 2336 tests stayed green.**

Mapowanie `hideEmptyRows → 'client-empty'` mieszkało w hooku `use-kosztorys-view-state.ts`; split
EX-521 skasował je przy przenosinach, a pełny pakiet testów pozostał zielony, bo pokrycie było
o piętro obok (przy localStorage). Gdyby to weszło: właściciel z zaznaczonym „ukryj puste wiersze"
miałby ustawienie po cichu nieaziałające na dokumencie klienta.

**To jest precedens kształtu naprawy dla EX-765**: fakt domenowy wyprowadza się z hooka do nazwanej
funkcji **przy rejestrze, który jest właścicielem id**, i przypina specem. Część dzisiejszych 625
linii to świadoma akrecja, nie bałagan.

### 8. Lekcje, które trzeba zastosować

- **`lessons.md:1224` — „A review finding names a mechanism; it does not measure one".** Finding
  zasługuje na plan dopiero, gdy ktoś podłoży pod niego liczby. Tu są: 13 plików konsumentów,
  0 zmian zachowania, rozłączne zbiory zależności, 123 asercje jako siatka, ~20 minut przepisania
  importów. To wystarcza — i jest przeciwieństwem trzech findingów EX-521, które umarły na liczbach
  („six members that only move together" → 47 referencji zostających w miejscu).
- **`lessons.md:1302` — „A deferral rationale ages into a dependency".** Opis EX-765 mówi „warte
  własnego review" — ta sama gramatyka, która sparaliżowała EX-521 na cztery tygodnie. Zweryfikowane:
  tutaj klauzula jest prawdziwa, ale opisuje 20-minutowy, w pełni bramkowany refaktor, a nie blokadę.
- **`lessons.md:389` / `:999`** — logika warta strzeżenia mieszka **poza** hookiem, jako czysta
  funkcja z testem. Split nie może niczego wciągnąć w hooki.

## Code References

- `src/lib/kosztorys/row-conditions.ts:1-7` — sześć domenowych importów; wszystkie należą do rejestru
- `src/lib/kosztorys/row-conditions.ts:9-65` — kontrakt (`RowConditionCtxT` / `KindT` / `RowConditionT`)
- `src/lib/kosztorys/row-conditions.ts:89-94` — dwa eksportowane id wpisów, z uzasadnieniem sąsiedztwa
- `src/lib/kosztorys/row-conditions.ts:137-431` — `ROW_CONDITIONS`, 22 wpisy, kolejność = kolejność wyświetlania
- `src/lib/kosztorys/row-conditions.ts:433` — `BY_ID`, prywatny indeks mechanizmów
- `src/lib/kosztorys/row-conditions.ts:441-452` — `clientConditionIds` + docblock o incydencie
- `src/lib/kosztorys/row-conditions.ts:472` — `isHider`, reguła mechanizmu
- `src/lib/kosztorys/row-conditions.ts:593-608` — **dwa spiętrzone docblocki, pierwszy opisuje
  `sectionIdsWhereAllMatch`, nie `liftsToSections`** — istniejąca usterka do naprawienia przy okazji
- `src/__tests__/lib/kosztorys/row-conditions.test.ts:60` — `matches()`, helper 40 testów, idzie przez `countMatching`
- `src/__tests__/lib/kosztorys/row-conditions.test.ts:536` — strażnik referencyjnej stabilności
- `src/lib/kosztorys/stage-conditions.ts:3-19` — bliźniak etapowy, ta sama zrośnięta forma na 62 liniach
- `src/lib/kosztorys/problem-conditions.ts:4-18` — precedens „widok pochodny rejestru we własnym pliku"

## Architecture Insights

- **Rozłączne zbiory zależności to najmocniejszy dowód szwu.** Rejestr potrzebuje sześciu modułów
  domenowych, mechanizmy nie potrzebują żadnego (poza typem). Gdy dwie połowy pliku nie dzielą
  importów, cięcie nie jest estetyczne, tylko strukturalne.
- **Kolejność tablicy jest zachowaniem, nie formatowaniem** — `active-filters-model.ts:64` i menu
  „Filtry" czytają ją jako kolejność wyświetlania. Rejestr zostaje **jedną** tablicą.
- **Powtarzalny kształt naprawy cohesion w tym repo** (4/4 findingi EX-515): wyciąć rodzeństwo `.ts`
  → nazwać resztę uczciwie → **żadnego barrela** → strzałki jednokierunkowo → spec per plik.
- `stage-conditions.ts` (62 linie, ta sama forma: typ + rejestr + `BY_ID` + dwie funkcje) jest
  precedensem **przeciw** dzieleniu — i pokazuje, że próg to nie kształt, tylko rozmiar danych.

## Historical Context (from prior changes)

- `context/archive/2026-09-01-kosztorys-dwie-opcje-zrodla-ceny-wykonawcy/review-gate.md:32` — miejsce
  zgłoszenia EX-765 (bliźniak: EX-764, `kosztorys-v2-columns.tsx` 771 linii)
- `context/archive/2026-08-18-kosztorys-filters-visible-and-extended/review-gate.md:33` — ten sam
  finding, `skipped`
- `context/archive/2026-08-17-filtry-problemy/review-gate.md:29,61` — batch 7 propozycji splitu
  (niezgłoszony: darmowy limit issue w Linear) + odrzucenie fabryki id
- `context/archive/2026-08-14-kosztorys-filter-conditions/review-gate.md:26,53` — nieversjonowana
  persystencja id; świadome zostawienie `listLabels` w tym pliku
- `context/archive/2026-07-11-kosztorys-editor-ux/review-gate-staging-merge.md:62-72` — pełny zapis
  EX-515: co i jak rozbito (commity `5141253`, `0fc65ab`, `c8b1558`) i dlaczego czwarty punkt odroczono
- `context/changes/2026-09-02-subcontractor-override-value-collapse/review-gate.md:43` — ostatnia
  wzmianka: „both only shrank here; a split is its own review"

## Open Questions

1. **Kształt: podkatalog + importy głębokie (rekomendacja) czy fasada z opisu issue?**
   Rekomendowany układ, zgodny z `work-catalogue/` i z 4/4 naprawami EX-515:

   ```
   src/lib/kosztorys/row-conditions/types.ts      ~60   trzy typy (z :9-65)
   src/lib/kosztorys/row-conditions/registry.ts   ~390  6 importów domenowych, 2 stałe id,
                                                        5 prywatnych helperów, ROW_CONDITIONS,
                                                        clientConditionIds + 2 mrożone zbiory
   src/lib/kosztorys/row-conditions/engine.ts     ~195  BY_ID, isHider, liftsToSections i 9 funkcji
   ```

   Koszt vs fasada: 13 przepisanych linii importu (6 plików rozpada się na dwa importy, 7 to
   jednolinijkowce), w 100% bramkowane przez `pnpm typecheck`. Zysk: zero nowych wzorców w repo, brak
   fałszywych „unused export" w knipie, brak drugiego kroku „zdejmij fasadę".

2. **Jak rozciąć spec (666 linii) przy regule pełnego mirroringu?** Bloki dzielą się czysto
   (`:63,:304,:327` → rejestr; `:410+` → silnik), ale fikstury (`STAGES`, `CTX`, `row()`,
   `priceCells()`) są wspólne, a helper `matches()` chodzi przez `countMatching`. Do rozstrzygnięcia
   w planie: wspólny moduł fikstur obok obu speców czy duplikacja. **Strażnik z `6a7c8f17`
   (`:524-543`) musi wylądować przy `clientConditionIds`, czyli w specu rejestru.**

3. **Kolejność względem niezgłoszonego findingu perf.**
   `context/archive/2026-08-17-filtry-problemy/review-gate.md:22-28` opisuje, że `conditionCounts`
   robi **jeden pełny przebieg na warunek przy każdym naciśnięciu klawisza** (przy 1000+ pozycjach —
   tysiące wywołań predykatu na edycję), a naprawa odwraca pętlę i **przekształca publiczną funkcję
   `countMatching` wraz z jej specem** — czyli dotyka dokładnie `engine.ts`. Split powinien iść
   **pierwszy** (daje tamtej zmianie mały plik do pracy), ale obie równolegle będą konfliktować. Ten
   finding nadal nie ma issue w Linear — warto założyć przy okazji.

4. **Czy przy okazji naprawić `stage-conditions.ts`?** To ta sama zrośnięta forma na 62 liniach —
   dziś świadomie zostawiona. Zakres EX-765 jej nie obejmuje; jeśli split ustala wzorzec, warto zapisać
   w `lessons.md` próg („rejestr wychodzi z pliku, gdy dane przekroczą ~300 linii"), a nie ruszać
   bliźniaka.
