# Sufit stawki wykonawcy schodzi z alarmu — plan wdrożenia

## Overview

Sufit 65% przestaje być alarmem, a zaczyna być sposobem czytania rozpiski. Strażnik sądzi wyłącznie
**kwotę stałą** — pozycja „auto" niesie odpowiedź mnożnika, a mnożnik dostaje własne czerwone pole
i własny komunikat, teraz także przy zerze. Oba wpisy „ze zbyt wysoką stawką" wychodzą z „Problemów"
(zostaje tam sama **ujemna** stawka, pod nazwą, która ją nazywa) i wracają jako para filtrów
„z kwotą stałą powyżej sufitu" / „bez kwoty stałej powyżej sufitu". Przy okazji: pasek chipów
odzyskuje płaszczyznę, „Filtry" dostają zbiorcze zaznacz/odznacz, a martwe pole `tone` znika.

## Current State Analysis

- `checkSubcontractorPrice` (`src/lib/kosztorys/subcontractor-price-guard.ts:80-93`) ma dwa piętra:
  `refuse` dla ceny ujemnej i `warn` powyżej `clientPrice × 0,65`. Oba sądzą `subcontractorPrice`,
  czyli **liczbę po podstawieniu mnożnika** — nie pytając, czy ktoś ją wpisał.
- Cztery powierzchnie czytają ten werdykt jednym głosem: komórka
  (`grid/cells/subcontractor-columns.tsx:115`), polityka edycji (`subcontractor-price-edit.ts:37`),
  wstawianie z katalogu (`work-catalogue/place-catalogue-items.ts:71`) i dwa wpisy rejestru
  (`row-conditions/registry.ts:351,362`).
- `isCoeffOverCeiling` / `coeffCeilingWarning` (`:54-64`) obsługują **tylko** górę skali; pole
  mnożnika (`toolbar/kosztorys-global-settings.tsx:45,51`) czerwienieje i toastuje wyłącznie powyżej
  0,65. Twardy cap zdjęto 2026-09-21, `min={0}` w polu został.
- Rejestr: `isHider = kind !== 'diagnostic'` (`row-conditions/queries.ts:30`) — filtry **ukrywają**
  trafienia (AND), diagnostyki **zostawiają tylko** trafienia (OR). Filtr związany z planem jest
  oferowany wyłącznie w widoku tego planu (`offeredFilterConditions`), diagnostyka zawsze.
- Wzorzec pary per plan stoi obok: `manual-rate-*` / `formula-rate-*` (`registry.ts:155-190`) —
  `sectionLabel: null`, `plane`, `revealsColumns: priceColumnsFor(plane)`.
- `problem-conditions.ts:31-33` obcina ogon „w widoku …" — celowo (nagłówek grupy nazywa widok),
  ale pasek chipów (`toolbar/active-filters-model.ts:69-80`) czyta to samo, już obcięte pole.
- `FilterMultiSelect` **ma już** zbiorczy przełącznik (`toggleAll` `:165-169`, `actionRows`
  `:195-214`, ikona `CheckCheck`), ale renderuje go wyłącznie w gałęziach `options.length > 0`;
  menu kosztorysu podaje same `toggles`, więc wiersz nigdy się nie pojawia.
- `useEngagedConditions` (`editor/hooks/use-engaged-conditions.ts`) wystawia `toggle`,
  `toggleExclusive`, `clear` — nie ma operacji na liście id.
- `RowConditionT.tone` (`row-conditions/types.ts:60`) jest pisane 9× i nieczytane nigdzie.

## Desired End State

Wpisanie 80 zł przy cenie 100 zł czerwieni komórkę i mówi dlaczego — jak dziś. Ale w „Problemach"
tej pozycji już nie ma: żeby ją znaleźć, otwiera się „Filtry" i odznacza „Pozycje bez kwoty stałej
powyżej sufitu", albo zostawia zaznaczone obie połowy i nie zawęża niczego. Ustawienie mnożnika na
0,9 nie wrzuca 1123 pozycji „auto" do żadnej listy — czerwieni jedno pole w pasku. Ustawienie go na
0 robi dokładnie to samo, czego dziś nie robi nic. W „Problemach" zostaje jeden wpis o stawce:
„Pozycje z ujemną stawką wykonawcy". Pasek chipów pod paskiem narzędzi mówi, w którym widoku
zawężenie działa. W „Filtrach" pierwszy wiersz zaznacza albo odznacza wszystkie prace naraz.

### Key Discoveries

- Zbiorczy przełącznik **nie jest nowym komponentem** — `FilterMultiSelect` już go ma, tylko nie dla
  grupy `toggles`.
- Nowa para filtrów to **cztery** wpisy (2 plany × 2 połowy): `matches` nie zna widoku, więc warunek
  o stawce musi nazwać płaszczyznę. Tak samo jak `manual-rate-*`.
- Dopełnienie musi być **ścisłą negacją** — `registry.test.ts:216-242` sprawdza to na liście par —
  więc „bez kwoty stałej powyżej sufitu" obejmuje też wiersze „auto". Nazwy wybrano tak, żeby żadna
  połowa nie twierdziła, że zmierzyła „auto" (decyzja właściciela, 2026-09-22).
- Identyfikatory muszą być **nowe**: zaangażowane warunki żyją w localStorage bez wersji i nigdy nie
  są czyszczone, więc przejęcie `overpriced-*` odwróciłoby znaczenie zapisanego ticka.
- `place-catalogue-items.ts:63-70` filtruje plany „auto" **przed** wołaniem strażnika; po wejściu
  bramki do strażnika ten filtr jest powtórzeniem tej samej reguły w drugim miejscu.
- **Bug `isWorkshop = templatePresetId != null` nie istnieje** — patrz „What We're NOT Doing".
- `subcontractor-price-guard.test.ts:68-71` asercją utrwala dzisiejsze zachowanie („ostrzega, gdy sam
  globalny mnożnik przekracza sufit") — ten test **odwraca się**, to nie jest regresja.

## What We're NOT Doing

- **Nie naprawiamy `isWorkshop = templatePresetId != null`** — po sprawdzeniu osiągalności okazało
  się, że nie ma czego naprawiać. Warsztat jest osiągalny wyłącznie przez `/szablony/[id]`, które
  przy pustym warsztacie renderuje `OpenWorkshopPrompt` zamiast edytora
  (`szablony/[id]/page.tsx:23-29`), a `/inwestycje/[id]/kosztorys_v2` 404-uje na inwestycji
  szablonowej, bo `fetchReferenceData` wycina ją zapytaniem (`lib/queries/reference-data.ts:71`).
  Defekt bez możliwego użytkownika — skreślony, nie zgłoszony. Moja wcześniejsza notatka w
  `research.md` była błędna.
- Nie ruszamy `problem-conditions.ts:31-33` — obcięcie ogona „w widoku …" zostaje.
- Nie nazywamy zawężenia na przycisku „Problemy" — robi to chip.
- Nie dotykamy `isOverCeiling` u dwóch pozostałych czytelników (`tables/work-catalogue.tsx:110`,
  `dialogs/catalogue-diff-table.tsx:222`) — sądzą stawkę katalogową, która **jest** kwotą stałą.
- Nie zmieniamy `min={0}` w polu mnożnika ani `investmentCoeffsSchema` — ujemny mnożnik zostaje
  osiągalny od strony akcji i dlatego piętro `refuse` zostaje bezwarunkowe.
- Nie zlewamy pary „bez ceny j.m." nigdzie, także na warsztacie (odwrócenie właściciela 2026-09-22).
- Nie piszemy E2E (patrz Testing Strategy).

## Implementation Approach

Najpierw strażnik — bo cztery powierzchnie czytają go jednym głosem i każda z nich ma zmienić zdanie
w tym samym momencie. Potem rejestr, który jest już tylko konsekwencją. Dopiero na końcu dwie rzeczy
niezależne od sufitu: chip i zbiorczy przełącznik. Każda faza kończy się zielonym specem swojej
warstwy; kopie i dokumentacja idą na koniec, bo dopiero wtedy wiadomo, co dokładnie zaczęło kłamać.

## Critical Implementation Details

**Bramka siada w strażniku, nie w rejestrze.** Czerwona komórka, komunikat blokady edycji, ostrzeżenie
przy wstawianiu z katalogu i wpis w menu muszą mówić jedno — a mówią jedno tylko dlatego, że czytają
jedną funkcję. Powtórzenie warunku w `matches` to dokładnie ten rozjazd, przed którym broni się
dzisiejszy komentarz przy `overpriced-w-tools`.

**Piętro `refuse` zostaje bezwarunkowe.** `investmentCoeffsSchema` (`lib/actions/kosztorys.ts:77-78`)
nie ma `.min(0)`, więc ujemny mnożnik jest osiągalny akcją; wtedy „auto" produkuje ujemną stawkę,
której trzeba odmówić — bramka na kwotę stałą obejmuje **wyłącznie** piętro sufitu.

**Zero to nie to samo co brak.** `overrideValueFor(row, view) === 0` znaczy „ktoś wpisał zero",
`=== null` znaczy „auto" (EX-766). Wpisy „bez ceny wykonawcy" przechodzą z `subcontractorPrice(...)
=== 0` na `overrideValueFor(...) === 0`, żeby wiersz „auto" przy mnożniku 0 nie był łapany tysiąc
razy zamiast raz w pasku.

## Phase 1: Strażnik — sufit sądzi kwotę stałą, mnożnik dostaje własne zero

### Overview

Jedna zmiana w `checkSubcontractorPrice` i jedna w parze funkcji od mnożnika. Cztery powierzchnie
zmieniają zdanie same, bo czytają tę funkcję.

### Changes Required

#### 1. `src/lib/kosztorys/subcontractor-price-guard.ts`

- `checkSubcontractorPrice`: po piętrze `price < 0` dołożyć `if (overrideValueFor(row, view) ===
null) return null` — z komentarzem, że autorem liczby „auto" jest mnożnik i on ma własne pole.
- `isCoeffOverCeiling` → `isCoeffFlagged(coeff)`: `coeff > MAX_CLIENT_SHARE || coeff === 0`.
- `coeffCeilingWarning` → `coeffWarning(coeff)`: komunikat sufitu jak dziś, plus zdanie dla zera
  („Mnożnik 0 daje wykonawcy 0 zł na każdej pozycji ze źródłem «auto»." — treść do dopracowania
  w implementacji, ma nazwać skutek, nie regułę).

#### 2. `src/components/kosztorys/editor/toolbar/kosztorys-global-settings.tsx`

- Nowe nazwy w imporcie i w dwóch miejscach użycia.
- `COEFF_DESCRIPTION`: dopisać linię o zerze, sourcowaną tak jak linia o suficie.

#### 3. `src/lib/kosztorys/work-catalogue/place-catalogue-items.ts`

- Skasować `.filter((plane) => overrideValueFor(item, plane) !== null)` — strażnik pyta o to sam.
  Komentarz skrócić do tego, co zostaje prawdą (zerowe globale nie mają znaczenia, bo kwota stała
  nie czyta współczynnika).

#### 4. Spec strażnika (`src/__tests__/lib/kosztorys/subcontractor-price-guard.test.ts`)

- Odwrócić `:68-71` — mnożnik ponad sufitem **milczy** na wierszu „auto".
- Dołożyć: kwota stała ponad sufitem dalej ostrzega; kwota stała **równa** sufitowi milczy; ujemna
  stawka z „auto" (ujemny mnożnik) dalej `refuse`.
- Nowy `describe` dla `coeffWarning` / `isCoeffFlagged`: 0,65 milczy, 0,9 ostrzega, 0 ostrzega innym
  zdaniem, 0,5 milczy.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/lib/kosztorys/subcontractor-price-guard.test.ts`
- `pnpm typecheck`

#### Manual Verification

- Mnożnik 0,9 przy pozycji „auto": pole mnożnika czerwone, komórka stawki **nie**.
- Kwota stała 80 zł przy cenie 100 zł: komórka czerwona, komunikat jak dziś.

## Phase 2: Rejestr — sufit z „Problemów" do „Filtrów"

### Overview

Dwie diagnostyki znikają, dwie wchodzą pod własną nazwą, cztery filtry dochodzą. Martwe `tone` ginie
przy okazji, bo dotykam każdej z tych linii.

### Changes Required

#### 1. `src/lib/kosztorys/row-conditions/registry.ts`

- Skasować `overpriced-w-tools` i `overpriced-own-tools`.
- Dołożyć `negative-rate-w-tools` / `negative-rate-own-tools` (`kind: 'diagnostic'`,
  `problemGroup: 'subcontractor-rate-<plane>'`, `sectionLabel: null`, `revealsColumns:
priceColumnsFor(plane)`), label `'z ujemną stawką wykonawcy' + planeViewSuffix(plane)`,
  `matches: (row) => subcontractorPrice(row, plane) < 0`.
- Dołożyć cztery filtry, wzorowane na `manual-rate-*`:
  - `fixed-rate-over-ceiling-<plane>` — `'z kwotą stałą powyżej sufitu' + planeViewSuffix(plane)`,
    `matches`: override `!== null` **i** `isOverCeiling(override, row)`.
  - `fixed-rate-within-ceiling-<plane>` — `'bez kwoty stałej powyżej sufitu' + …`, ścisła negacja
    tego samego wyrażenia. Komentarz nazywa wprost, że druga połowa obejmuje „auto" i dlaczego
    etykieta jest przez zaprzeczenie.
- Wpisy `no-w-tools-price` / `no-own-tools-price`: `matches` na `overrideValueFor(row, plane) === 0
&& row.clientPrice > 0`; zaktualizować komentarz nad nimi (dziś tłumaczy `subcontractorPrice`).
- Skasować wszystkie 9 wystąpień `tone:`.

#### 2. `src/lib/kosztorys/row-conditions/types.ts`

- Skasować pole `tone`.

#### 3. Specy

- `registry.test.ts`: dopisać obie nowe pary do listy dopełnień (`:230-237`) wraz z podmiotami, które
  je rozstrzygają (wiersz z kwotą ponad sufitem, wiersz „auto", wiersz z kwotą pod sufitem);
  przepisać asercje `:153-180` z `overpriced-*` na nowe id.
- `queries.test.ts:137-218`: podmienić `overpriced-*` w fixture'ach `columnsRevealedBy` /
  `engagedPlane` na `negative-rate-*`.
- `problems-menu-model.test.ts:19,35,65,68,81`: to samo w fixture'ach licznika.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions/registry.test.ts src/__tests__/lib/kosztorys/row-conditions/queries.test.ts`
- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/menus/problems-menu-model.test.ts`
- `pnpm typecheck` (czyste po kasacji `tone`)

#### Manual Verification

- „Problemy" na rozpisce z wierszami ponad sufitem: wpisu o zbyt wysokiej stawce nie ma.
- „Filtry" w widoku „z narzędziami": dwie nowe pozycje z licznikami, odznaczenie jednej chowa
  dokładnie tę połowę; w widoku klienta ich nie ma.

## Phase 3: Pasek chipów odzyskuje płaszczyznę

### Overview

Chip czyta etykietę obciętą pod nagłówek menu, którego pod paskiem nie ma. Dołożyć drugie pole.

### Changes Required

#### 1. `src/lib/kosztorys/problem-conditions.ts`

- W `ROW_PROBLEMS` i `STAGE_PROBLEMS` dołożyć `fullLabel` (nieobcięte `condition.label`).
  Komentarz przy `label` już tłumaczy podział — rozszerzyć go o to, gdzie idzie druga wersja.

#### 2. `src/components/kosztorys/editor/toolbar/active-filters-model.ts:69-80`

- `label` i `removeLabel` na `problem.fullLabel`.

#### 3. Spec

- `active-filters-model` (lub nowy, jeśli nie istnieje): chip zaangażowanej diagnostyki związanej
  z planem niesie „w widoku …", wiersz menu dalej nie.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/`

#### Manual Verification

- Wybranie „Pozycje z ujemną stawką wykonawcy" w widoku „bez narzędzi": chip mówi, w którym widoku.

## Phase 4: „Filtry" — zaznacz / odznacz wszystkie

### Overview

Wiersz zbiorczy dla grupy `toggles` w `FilterMultiSelect` plus operacja na liście id w magazynie
zaangażowanych warunków. Grupa `options` zostaje nietknięta — to dwie różne kolekcje.

### Changes Required

#### 1. `src/components/filters/filter-multi-select.tsx`

- Nowy opcjonalny prop `togglesBulk?: { allActive: boolean; onToggleAll: (next: boolean) => void }`.
- Renderować go jako pierwszy `CommandItem` w grupie `toggles` (`forceMount`, ikona `CheckCheck`,
  te same etykiety „Zaznacz wszystkie" / „Odznacz wszystkie" co `actionRows`), oddzielony
  `CommandSeparator`.

#### 2. `src/components/kosztorys/editor/hooks/use-engaged-conditions.ts`

- `setMany(ids: Iterable<string>, engaged: boolean)`: jedna aktualizacja magazynu, żeby odznaczenie
  dwunastu filtrów było jednym zapisem do localStorage, nie dwunastoma.

#### 3. `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts`

- Wystawić `setConditions` (= `setMany`) w zwracanym kształcie, obok `toggleCondition`.

#### 4. `.../menus/use-kosztorys-filter-menu.ts` i `kosztorys-filters-menu.tsx`

- Hook zwraca `togglesBulk` zbudowane z `filters` (oferowanych **w tym widoku**) i `setConditions`;
  `allActive` = żaden z oferowanych nie jest zaangażowany. Menu przekazuje prop dalej.

#### 5. Spec (dom)

- Odznaczenie wszystkich gasi siatkę i zapala licznik na triggerze; „Zresetuj filtry" wraca.
- Wiersz zbiorczy nie rusza filtrów nieoferowanych w bieżącym widoku.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run --project dom src/__tests__/components/kosztorys/editor/toolbar/`
- `pnpm typecheck`

#### Manual Verification

- „Filtry" → „Odznacz wszystkie": siatka pusta, trigger z licznikiem; „Zresetuj filtry" przywraca.

## Phase 5: Kopie i dokumentacja, które zaczną kłamać

### Overview

Pięć miejsc opisuje stan sprzed tej zmiany albo sprzed 2026-09-21. Żadne nie zmienia zachowania.

### Changes Required

- `src/components/kosztorys/sheet-rates-block.tsx:145` — odsyła do „Problemy → bez ceny wykonawcy";
  sprawdzić, czy po bramce na kwotę stałą zdanie dalej prowadzi tam, gdzie obiecuje.
- `context/reference/kosztorys-editor-domain-notes.md:629` — twierdzi, że mnożnik odmawia twardo
  (nieprawda od 2026-09-21).
- `context/reference/kosztorys-editor-domain-notes.md:914-940` — opisuje wiersze sufitu jako problemy
  niezależne od widoku.
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:101` — „the workbench … hides the
  view switch" i „its view is pinned to 'client'". Nie ukrywa i nie przypina: `ToolbarToggle`
  renderuje się bezwarunkowo (`toolbar/kosztorys-editor-toolbar.tsx:43-49`), a `view` jest przypięty
  do `'client'` tylko pod `preview` (`use-kosztorys-view-state.ts:45`). Ukryty jest
  `KosztorysViewMenu` — i to jest prawdziwy powód, dla którego przełącznik osi netto/brutto tam nie
  występuje.
- `src/__tests__/components/kosztorys/editor/grid/workshop-columns.test.ts:73-74,82-83` — ten sam
  fałsz w komentarzach. **Asercje zostają** — sprawdzają składanie kolumn i są prawdziwe; kłamią
  tylko uzasadnienia.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/workshop-columns.test.ts`

#### Manual Verification

- Brak — zmiany są w komentarzach i prozie.

## Testing Strategy

### Unit (node)

- Strażnik: bramka na kwotę stałą w obie strony, oba piętra, mnożnik 0 i 0,9.
- Rejestr: obie nowe pary jako ścisłe dopełnienia; `negative-rate-*` łapie ujemną stawkę z obu
  źródeł; `no-*-price` już nie łapie wiersza „auto" przy zerowym mnożniku.

### Component (dom)

- Zbiorcze odznaczenie w „Filtrach" (gaszenie siatki, licznik, powrót przez „Zresetuj filtry").
- Chip zaangażowanej diagnostyki niesie płaszczyznę.

### E2E

Nie w tej zmianie. Całe ryzyko jest w warstwie czystej (strażnik, rejestr) i w DOM (menu, chip) — nic
tu nie przecina granicy klient → akcja → baza → unieważnienie cache. Stan zaangażowanych warunków
żyje w localStorage, nie na serwerze.

### Manual

Zebrane raz, na końcu, do rejestru `context/foundation/manual-checks.md`.

## Performance Considerations

Netto **bez zmian w liczbie przebiegów**: cztery nowe wpisy filtrów wchodzą do
`rowConditionCounts` (`use-kosztorys-editor.ts:413-433`, jeden `countMatching` na wpis), ale dwa
wpisy diagnostyczne wychodzą i dwa wchodzą pod nową nazwą — bilans +4 przebiegi po ~4 tys. wierszy
w najgorszym realnym przypadku, każdy na porównaniu dwóch liczb. Bramka na kwotę stałą **skraca**
ścieżkę strażnika dla ~1100 wierszy „auto" (wyjście przed arytmetyką sufitu).

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## References

- Change: `context/changes/2026-09-22-stawka-problems-and-filters/change.md`
- Research: `context/changes/2026-09-22-stawka-problems-and-filters/research.md`
- Wzorzec pary filtrów per plan: `src/lib/kosztorys/row-conditions/registry.ts:155-190`
- Wzorzec wiersza zbiorczego: `src/components/ui/column-toggle-menu.tsx:113-117`
- Lista dopełnień: `src/__tests__/lib/kosztorys/row-conditions/registry.test.ts:216-242`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Strażnik — sufit sądzi kwotę stałą, mnożnik dostaje własne zero

#### Automated

- [x] 1.1 Spec strażnika przechodzi z odwróconą asercją o mnożniku
- [x] 1.2 Nowy `describe` dla `coeffWarning` / `isCoeffFlagged` przechodzi
- [x] 1.3 `pnpm typecheck` czysty po zmianie nazw

### Phase 2: Rejestr — sufit z „Problemów" do „Filtrów"

#### Automated

- [x] 2.1 `registry.test.ts` przechodzi z dwiema nowymi parami w liście dopełnień
- [x] 2.2 `queries.test.ts` i `problems-menu-model.test.ts` przechodzą na nowych id
- [x] 2.3 `pnpm typecheck` czysty po kasacji `tone`

### Phase 3: Pasek chipów odzyskuje płaszczyznę

#### Automated

- [x] 3.1 Spec chipa: zaangażowana diagnostyka z planem niesie „w widoku …"

### Phase 4: „Filtry" — zaznacz / odznacz wszystkie

#### Automated

- [x] 4.1 Spec dom: zbiorcze odznaczenie zapala licznik i zostawia reset (siatka — sprawdzenie ręczne)
- [x] 4.2 Spec dom: wiersz zbiorczy nie rusza filtrów spoza bieżącego widoku

### Phase 5: Kopie i dokumentacja, które zaczną kłamać

#### Automated

- [x] 5.1 `workshop-columns.test.ts` przechodzi po poprawce komentarzy
