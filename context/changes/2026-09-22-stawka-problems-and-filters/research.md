---
date: 2026-09-22
researcher: Claude (Opus 5)
git_commit: e99a4b39
branch: staging
repository: wykonczymy
topic: 'Sufit stawki wykonawcy — przeniesienie z „Problemów" do „Filtrów", bramka „tylko kwota stała", zbiorcze zaznaczanie w „Filtrach"'
tags: [research, kosztorys, row-conditions, subcontractor-price, toolbar, warsztat]
status: complete
last_updated: 2026-09-22
linear: EX-820
---

# Research: sufit stawki wykonawcy jako filtr, nie problem

## Summary

Zaprojektowana zmiana jest wykonalna, ale research znalazł **cztery rzeczy, które trzeba
poprawić w projekcie, zanim powstanie plan**, i jeden bug poboczny.

1. **Bramka „tylko kwota stała" nie może objąć całego `checkSubcontractorPrice`.** Piętro
   `refuse` (`price < 0`) musi zostać bezwarunkowe — ujemna stawka jest osiągalna przez „auto",
   bo `investmentCoeffsSchema` nie ma `.min(0)`.
2. **Etykieta z płaszczyzną wraca na pasek chipów, nie do wierszy menu.** Obcięcie ogona
   „w widoku …" w `problem-conditions.ts` jest świadomą decyzją z 2026-09-21 i jej powód dalej
   obowiązuje (nagłówek grupy nazywa widok). Powierzchnią, która gubi płaszczyznę, jest pasek
   chipów — czyta to samo, już obcięte pole.
3. **Identyfikatory nowej pary filtrów muszą być nowe.** Zaangażowane warunki żyją w
   localStorage bez wersji i nigdy nie są czyszczone; ponowne użycie starych id odwróciłoby
   znaczenie zapisanego ticka u każdego, kto go kiedyś ustawił.
4. **Filtr związany z planem jest oferowany tylko w widoku swojego planu.** To zmienia
   zachowanie względem dzisiejszych diagnostyk — przyjmujemy to świadomie (uzasadnienie
   w `change.md`), ale musi być zapisane, bo wygląda jak regresja.

~~Bug poboczny: `isWorkshop = templatePresetId != null` — pusty warsztat prezentuje się jak
zwykła inwestycja.~~ **Nieprawda (sprawdzone 2026-09-22 przy planie).** Nieosiągalne: `/szablony/[id]`
przy pustym warsztacie renderuje `OpenWorkshopPrompt` zamiast edytora, a `/inwestycje/[id]/kosztorys_v2`
404-uje na inwestycji szablonowej, bo `fetchReferenceData` wycina ją zapytaniem
(`lib/queries/reference-data.ts:71`).

## Detailed Findings

### 1. Rejestr warunków — co tracisz i co zyskujesz, przenosząc wpis

`RowConditionKindT = 'filter' | 'diagnostic' | 'client'`, a jedyna różnica mechaniczna siedzi
w `isHider = kind !== 'diagnostic'` (`row-conditions/queries.ts:30`): filtry i client **ukrywają**
trafienia (AND), diagnostyki **zostawiają tylko** trafienia (OR).

Przeniesienie `overpriced-*` z `diagnostic` do `filter` traci:

| Co                                                | Gdzie                                                     |
| ------------------------------------------------- | --------------------------------------------------------- |
| przełączanie widoku po zaangażowanej diagnostyce  | `queries.ts:107` `engagedPlane` — liczy tylko diagnostyki |
| zatrzask wiersza („Odśwież — ukryj poprawione")   | latch działa na diagnostykach                             |
| liczenie w „Problemach" i wpis w `PROBLEM_GROUPS` | `problem-conditions.ts:21-58`                             |

…i zyskuje:

| Co                             | Gdzie                                              |
| ------------------------------ | -------------------------------------------------- |
| tłumienie przy zwijaniu sekcji | `queries.ts:135` `isFoldSuppressed` — tylko filtry |
| podnoszenie do poziomu sekcji  | `queries.ts:157-160`                               |
| bramkę widoku                  | `queries.ts:199-211` `offeredFilterConditions`     |

**Nowy filtr musi przyjść z dopełnieniem.** `registry.test.ts:216-242` trzyma ręcznie
utrzymywaną listę par i pilnuje, żeby każdy filtr miał swoją drugą połowę. Stąd para
„powyżej sufitu" / „w granicach sufitu", a nie jeden wpis.

**Pułapka localStorage.** `use-engaged-conditions.ts:39-41` — stan zaangażowanych warunków to
rzadki `Record<string, boolean>` pod kluczem `kosztorys-filters:<investmentId>`, bez klucza
wersji, a nieznane id **nigdy nie są usuwane** (świadomie: id wraca po przełączeniu widoku).
Jeśli nowa para odziedziczy id `overpriced-w-tools` / `overpriced-own-tools`, zapisany tick
„pokaż tylko te zepsute" stanie się „ukryj te zepsute" — dokładne odwrócenie. **Nowa para
dostaje nowe id, stare zostają porzucone.**

**Martwe pole potwierdzone.** `RowConditionT.tone` (`types.ts:60`) jest zapisywane 13× w
`registry.ts` (`:235,249,266,286,300,313,325,347,359,379,390,410,422`) i **nie czytane nigdzie**.
`tone="destructive"` w `kosztorys-problems-menu.tsx:59` to niezwiązany prop UI.

### 2. Strażnik ceny wykonawcy

`src/lib/kosztorys/subcontractor-price-guard.ts` ma dwa piętra:

```ts
if (price < 0) return { severity: 'refuse', … }   // musi zostać bezwarunkowe
if (!isOverCeiling(price, row)) return null
return { severity: 'warn', … }                     // tu wchodzi bramka „kwota stała"
```

**Dlaczego `refuse` nie może być zbramkowane.** „Auto" liczy `clientPrice × effectiveCoeff`.
`investmentCoeffsSchema` (`src/lib/actions/kosztorys.ts:77-78`) **nie ma `.min(0)`** — jedyną
obroną jest `min={0}` na `DecimalField`, czyli warstwa UI. Ujemny mnożnik zapisany inną drogą
daje ujemną stawkę na każdym wierszu „auto"; gdyby bramka objęła całą funkcję, nikt by tego
nie odmówił.

**Precedens na pomijanie „auto" już istnieje** i jest dokładnie tym gestem, który zmiana
uogólnia: `work-catalogue/place-catalogue-items.ts:63-73` pomija plany ustawione na „auto",
zanim zawoła strażnika, a `components/tables/work-catalogue.tsx:25-26` zwraca `null` dla
stawki „auto" w kolumnie udziału.

**Luka `coeff === 0`.** Dzisiejsze wpisy `no-*-price` łapią też wiersze, gdzie stawka wynosi 0
przez zerowy mnożnik. Po zbramkowaniu na „kwota stała" ten przypadek nie byłby raportowany
**nigdzie** — pole mnożnika ostrzega tylko powyżej 0.65 (`isCoeffOverCeiling`). Propozycja:
ostrzegać przy mnożniku równym 0 tym samym mechanizmem co powyżej sufitu.

**Jeden test do poprawienia:** `subcontractor-price-guard.test.ts:68-71` — jedyna asercja,
która pada po bramce.

**Pomiar z lokalnego dumpa (docker 5433, 4239 pozycji / 13 rozpisek):** 3124 kwota stała vs
1123 „auto" na planie `w_tools`; 466 wierszy (483 trafienia planowe) powyżej sufitu na kwocie
stałej, z czego tylko 52 mają przedmiar albo wykonaną pracę. **Żadna inwestycja nie ma
mnożnika powyżej 0.65 ani równego 0** — dzisiejsze wartości domyślne siedzą dokładnie na
suficie. 118/483 (24%) trafień jest zgodnych z katalogiem co do grosza; pozostałe 365 i tak
wpadają w „Inne liczby niż w katalogu prac" (268) albo „Brak w katalogu prac" (97).

### 3. Historia decyzji — co wolno cofnąć, a czego nie

**Obcięcie ogona „w widoku …" ma jeden dzień** (`7af9945b`, 2026-09-21) i powód dalej
obowiązuje: `PROBLEM_GROUPS` renderuje nagłówek grupy, który **już nazywa widok**, więc pełna
etykieta powtarzała słowo dwa razy w jednym wierszu menu.

Powierzchnia, która realnie gubi płaszczyznę, to **pasek chipów** —
`toolbar/active-filters-model.ts:69-80` buduje chip z `problem.label`, czyli z pola **już
obciętego**:

```ts
label: `Tylko: ${problem.noun.toLowerCase()} ${problem.label}`,
```

Chip renderuje się wyłącznie wtedy, gdy coś jest zaangażowane
(`kosztorys-active-filters-bar.tsx`: `if (chips.length === 0) return null`) — czyli dokładnie
wtedy, kiedy płaszczyzna jest potrzebna. **To jest tańsza i niecofająca poprawka**: chip
czyta etykietę nieobciętą, menu zostaje bez zmian.

**Prawdziwa, nieadresowana zmiana zachowania:** `offeredFilterConditions`
(`row-conditions/queries.ts:199-211`) oferuje filtr związany z planem **tylko** gdy
`condition.plane === view`. Diagnostyki takiej bramki nie mają. Orzeczenie właściciela z
2026-08-17 brzmiało „Liczniki obu planów zostają niezależne od widoku — menu odpowiada «gdzie
jest zepsute»", ale dotyczyło **defektów**; przeniesienie tych wierszy do „Filtrów" jest właśnie
orzeczeniem, że to nie są defekty, a istniejąca para „kwota stała" / „auto" zachowuje się tak
samo. Przyjęte świadomie.

**Kopie, które zaczną kłamać:**

- `dialogs/sheet-rates-block.tsx:145` — „Znajdziesz je w kosztorysie przez «Problemy → bez ceny
  wykonawcy»".
- `context/reference/kosztorys-editor-domain-notes.md:629-630` — twierdzi, że globalny mnożnik
  wciąż odmawia twardo; nieprawda od 2026-09-21.
- `…:914-940` — opisuje wiersze sufitu jako problemy niezależne od widoku.

### 4. Warsztat szablonów

Warsztat to **jedna** inwestycja o statusie `szablon` (`TEMPLATE_INVESTMENT_STATUS`,
`constants/investment-lock.ts:22`), rozpoznawana po statusie, nie po id
(`db/workshop-investment.ts:11-23`). Lokalnie id 151: 311 pozycji, **0 etapów, 0 wierszy
postępu**, 0 przedmiaru, 5 bez ceny j.m. Wszystkie 10 wierszy powyżej sufitu zgadza się
z katalogiem co do grosza.

**Jedyny sygnał „to warsztat"** to `templatePresetId` przekazywany z
`app/(frontend)/szablony/[id]/page.tsx`. Wyprowadzenie jest jedno
(`kosztorys-editor-body.tsx:112`) i publikowane na kontekście, bo kiedyś było odpowiadane
w 14 miejscach (`use-kosztorys-editor-context.tsx:22-28`).

**W samym hooku edytora `isWorkshop` jest konsumowane dokładnie raz** —
`use-kosztorys-editor.ts:509`, `workshopVisible: isWorkshop` w `columnOpts`. Nic w potoku
warunków / liczników / problemów go nie widzi.

Dzisiejsze zwężenia warsztatu: lista kolumn (`WORKSHOP_VISIBLE_COLUMNS`, jeden punkt wejścia
`grid/column-selection.ts:48-57`), `KosztorysViewMenu`, wpisy „Etap — …",
`KosztorysInvestorMenu`, arkusz Google, zakładka „Inwestycja" w podsumowaniu, galeria, zakres
snapshotów. **Nie zwężone:** „Problemy", „Filtry", „Sekcje", pasek chipów, wyszukiwarka,
sortowanie, przełącznik widoku cen.

Na szablonie `qtyDone` jest **strukturalnym** zerem (`settlement-rows.ts:14-23` redukuje po
`stages`, a preset niesie `stages: []` — `serialize-preset.ts:15-35`), więc
`no-client-price-with-work` nigdy nie osiąga `count > 0` i już dziś jest w menu niewidoczne
(`problems-menu-model.ts:40-54` odrzuca wpisy z zerem, o ile nie są zaangażowane).
**Właściciel odwrócił zlanie tej pary** — rozdział to narzędzie do debugowania importowanych
kosztorysów.

**Pułapka współdzielonego stanu:** `use-engaged-conditions.ts:13,20-28` kluczuje po
`investmentId`, a warsztat to jedna inwestycja dla **wszystkich** szablonów — tick ustawiony
przy szablonie A jest wciąż włączony po otwarciu szablonu B.

**Dryf kodu/testów wart osobnej poprawki:** `kosztorys-v2-columns.tsx:101` oraz
`workshop-columns.test.ts:64,73,82-83` twierdzą, że warsztat „ukrywa przełącznik widoku" i
„jest przypięty do planu klienta". Nie jest — `kosztorys-editor-toolbar.tsx:43-49` renderuje
`ToolbarToggle` bezwarunkowo, a `use-kosztorys-view-state.ts:45` przypina `view` do `'client'`
tylko pod `preview`.

**E2E dla `/szablony`: zero specyfikacji** — pominięcie świadome
(`context/archive/2026-09-14-szablony-crud/review-gate.md:12`), reguły szablonu przypięte na
warstwie DB.

### 5. Zbiorcze zaznacz / odznacz w „Filtrach"

Wzorzec do ponownego użycia stoi w `src/components/ui/column-toggle-menu.tsx:113-117` —
`forceMount` trzyma wiersz widoczny pod każdym wyszukaniem:

```tsx
<CommandItem forceMount onSelect={() => onToggleAll(!allVisible)}>
  <CheckCheck />
  {allVisible ? 'Ukryj wszystkie' : 'Pokaż wszystkie'}
</CommandItem>
```

Odznaczenie wszystkich filtrów wygasza siatkę — tak samo jak „Ukryj wszystkie" w kolumnach,
a „Zresetuj filtry" stoi w tym samym menu jako droga powrotna.

## Code References

- `src/lib/kosztorys/subcontractor-price-guard.ts` — dwa piętra strażnika, `MAX_CLIENT_SHARE`
- `src/lib/actions/kosztorys.ts:77-78` — `investmentCoeffsSchema` bez `.min(0)`
- `src/lib/kosztorys/work-catalogue/place-catalogue-items.ts:63-73` — precedens pomijania „auto"
- `src/lib/kosztorys/row-conditions/registry.ts:342,354` — `overpriced-*`
- `src/lib/kosztorys/row-conditions/registry.ts:223-253` — para „bez ceny j.m." i jej uzasadnienie
- `src/lib/kosztorys/row-conditions/queries.ts:30,107,135,157,199` — `isHider`, `engagedPlane`,
  `isFoldSuppressed`, `liftsToSections`, `offeredFilterConditions`
- `src/lib/kosztorys/problem-conditions.ts:31-33` — obcięcie ogona „w widoku …"
- `src/components/kosztorys/editor/toolbar/active-filters-model.ts:69-80` — chip czyta obciętą etykietę
- `src/components/kosztorys/editor/hooks/use-engaged-conditions.ts:13,20-28,39-41` — localStorage
- `src/components/ui/column-toggle-menu.tsx:113-117` — wzorzec zbiorczego przełącznika
- `src/components/kosztorys/editor/kosztorys-editor-body.tsx:112` — `isWorkshop`
- `src/components/kosztorys/editor/grid/column-selection.ts:48-57` — jedyny punkt wejścia allowlisty
- `src/lib/kosztorys/settlement-rows.ts:14-23` — `rowTotalQtyDone` po `stages`
- `src/components/kosztorys/editor/dialogs/sheet-rates-block.tsx:145` — kopia do poprawienia
- `src/__tests__/lib/kosztorys/subcontractor-price-guard.test.ts:68-71` — jedyna padająca asercja
- `src/__tests__/lib/kosztorys/row-conditions/registry.test.ts:216-242` — reguła par

## Architecture Insights

- **Rodzaj warunku (`kind`) to nie etykieta, to kontrakt.** Jedna flaga `isHider` przeciąga za
  sobą pięć zachowań w trzech miejscach. Przeniesienie wpisu między rodzajami jest zmianą
  semantyki, nie kosmetyką menu.
- **Tam, gdzie liczba powstaje, zostaje czerwień; tam, gdzie się ją czyta, zostaje filtr.**
  To jest oś całej zmiany: komórka i toast mówią „ta liczba jest za wysoka", a menu przestaje
  udawać, że to defekt do naprawienia.
- **Stan zaangażowanych warunków jest trwały i nieopatrzony wersją** — każda zmiana id warunku
  jest migracją danych użytkownika, tyle że bez migracji. Nowe id jest tańsze niż wersjonowanie.
- **Warsztat jest zwężony wyłącznie przez listę kolumn.** Jeśli kiedyś ma być zwężony inaczej,
  precedensy są dwa i oba stoją obok rejestru: `clientConditionIds(hideEmptyRows)`
  (`registry.ts:435-447`) i `offeredFilterConditions` (`queries.ts:199-211`) — nie w hooku edytora.

## Historical Context

- `7af9945b` (2026-09-21) — obcięcie ogona „w widoku …" w `problem-conditions.ts`, bo nagłówek
  grupy już nazywa widok.
- 2026-09-21 — globalny mnożnik przestał odmawiać twardo powyżej sufitu (ostrzega).
  `kosztorys-editor-domain-notes.md:629-630` tego nie odnotowało.
- 2026-08-17 — orzeczenie „Liczniki obu planów zostają niezależne od widoku"; dotyczy defektów.
- EX-766 — `0` jako jawna kwota stała nigdy nie jest zlewane z `null` („auto").
- `context/changes/2026-09-22-szablon-autosave/change.md:29-42` — warsztat nie **buduje** reszty
  siatki; picker kolumn znika jako konsekwencja, nie jako mechanizm.
- `context/archive/2026-09-14-szablony-crud/review-gate.md:12` — świadome odpuszczenie E2E dla
  szablonów.

## Open Questions

1. **Luka `coeff === 0`** — czy ostrzegać przy mnożniku 0 tym samym kanałem co powyżej sufitu?
   Dziś nie ma takiej inwestycji, więc to zabezpieczenie na przyszłość, nie naprawa.
2. ~~**`isWorkshop = templatePresetId != null`**~~ — **zamknięte 2026-09-22: nie ma bugu.**
   Edytor warsztatu montuje się tylko tam, gdzie `templatePresetId` jest zawsze podany; druga trasa
   404-uje. Defekt bez możliwego użytkownika — skreślony, nie zgłoszony.
3. **Dryf komentarza/testów wokół przełącznika widoku na warsztacie**
   (`kosztorys-v2-columns.tsx:101`, `workshop-columns.test.ts:64,73,82-83`) — twierdzą coś,
   czego kod nie robi. Poprawka niezależna od tej zmiany.
