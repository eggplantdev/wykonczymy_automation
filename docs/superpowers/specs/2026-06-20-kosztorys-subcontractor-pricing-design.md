# Kosztorys — ceny podwykonawcy przez współczynniki narzutu (design)

> Slice POC. Rozwiązuje pytanie #2 z `context/changes/kosztorys-poc-in-app/change.md`
> („źródło cen podwykonawcy"). **Zastępuje** wcześniejszą notatkę w #2 o „snapshot,
> nie współczynnik" oraz rewiduje wariant A z #P4 (3 niezależne kolumny ceny snapshot).

## Problem

Widoki „Z narzędziami" / „Bez narzędzi" pokazują dziś 0 — pola cen podwykonawcy nigdy
nie zostały wypełnione (seed ustawia 0). Ręczne wpisanie 224 cen na kosztorys jest
nierealne. W arkuszu źródłowym te ceny były **wyprowadzane z ceny klienta przez
współczynnik** (`z narzędziami = klient × 0,65`, `bez narzędzi = klient × inny coeff`),
z pojedynczymi ręcznymi nadpisaniami (np. wiersz r07 = płaskie 700 zł przy kliencie 60).

## Model danych

Dwie ceny podwykonawcy (`w_tools`, `own_tools`) liczone niezależnie od ceny klienta przez
**współczynnik narzutu**, który dziedziczy w dół trzema poziomami, plus dwustanowy override
per pozycja.

### Dziedziczenie współczynnika (wzorzec `effectiveVat`)

```
Globalny default (na inwestycję)        ← „Domyślnie", ustawiany na starcie kosztorysu
   ↓ sekcja może nadpisać (nullable → dziedziczy globalny)
   ↓ pozycja: override dwustanowy (patrz niżej)
```

Każdy poziom ma **dwa** współczynniki: `wToolsCoeff`, `ownToolsCoeff`.

### Override per pozycja — dwustanowy (wzorzec rabatu `discountType`/`discountValue`)

Per pozycja, per widok (`w_tools`, `own_tools`):

```
overrideType ∈ {coeff, amount} | null
  null   → dziedzicz efektywny współczynnik (sekcja ?? globalny) → cena = klient × coeff
  coeff  → cena = klient × overrideValue            (podąża za ceną klienta)
  amount → cena = overrideValue                     (płaska kwota, zamrożona)
```

`null` = stan domyślny (wyprowadzony). `coeff` = override względny (śledzi klienta).
`amount` = override absolutny (np. płaskie 700 — niewyrażalne czystym współczynnikiem).

**Cena podwykonawcy nie jest przechowywana w stanie `null` ani `coeff`** — liczona w locie,
więc zmiana ceny klienta lub współczynnika automatycznie przelicza nienadpisane pozycje.
Przechowywana jest tylko w stanie `amount` (płaska wartość) oraz sam współczynnik override
w stanie `coeff`. Zero dryfu, brak ręcznej synchronizacji między widokami.

## Kalkulacja

```ts
effectiveCoeff(item, section, investment, view): number =
  section[`${view}Coeff`] ?? investment[`${view}Coeff`]

subcontractorPrice(item, section, investment, view): number =
  switch (item[`${view}OverrideType`]) {
    null     → item.clientPrice × effectiveCoeff(item, section, investment, view)
    'coeff'  → item.clientPrice × item[`${view}OverrideValue`]
    'amount' → item[`${view}OverrideValue`]
  }

viewPrice(item, …, view):
  client                → item.clientPrice
  w_tools | own_tools   → subcontractorPrice(item, …, view)
```

Czyste funkcje w `src/lib/kosztorys/calc.ts`, obok istniejących `effectiveVat`/`viewPrice`.

## UI

### Ustawianie współczynników — panel podsumowania sekcji (`KosztorysSectionSummary`)

- Wiersz „Domyślnie" (globalny, na inwestycję) u góry: dwa pola % (`wToolsCoeff`,
  `ownToolsCoeff`).
- Każda sekcja: dwa pola % — puste = dziedziczy globalny; placeholder pokazuje
  odziedziczoną wartość.

### Siatka, widoki podwykonawcy

- Komórka w stanie `null` (wyprowadzona) → cena pokazana **na szaro/kursywą** (sygnał
  „auto, nie ustalone ręcznie").
- Komórka z override (`coeff`/`amount`) → normalna czcionka.
- Wpis ręczny = override; **wyczyszczenie komórki = `null` = powrót do wyprowadzonej**.
- Wybór trybu override (`coeff` vs `amount`) — selektor per wiersz wzorowany na komórce
  typu rabatu (`DiscountTypeCell`, „—/%/zł"). Dokładna afordancja w siatce (osobna kolumna
  typu vs inline) — do dopięcia w planie implementacji.

## Schemat i migracja

- **`investments`**: dodać `wToolsCoeff`, `ownToolsCoeff` (number, z sensownym defaultem,
  np. 0,65 / 0,55).
- **`kosztorys_sections`**: dodać `wToolsCoeff`, `ownToolsCoeff` (nullable → dziedziczy
  inwestycję).
- **`kosztorys_items`**: zastąpić `subcontractorWToolsPrice`/`subcontractorOwnToolsPrice`
  czterema polami override: `wToolsOverrideType`/`wToolsOverrideValue`,
  `ownToolsOverrideType`/`ownToolsOverrideValue` (typ ∈ {coeff, amount} | null, value number).
- **Migracja hand-written** (zgodnie z AGENTS.md — `migrate:create` emituje phantom drift).
- **Seed**: ustawiać override `null` (pozycje startują jako wyprowadzone), nie 0.

## Granica zakresu (czego TU nie ma)

- Bez bulk-apply „zastosuj % do przefiltrowanych" — dziedziczenie globalny→sekcja zastępuje
  potrzebę masowego nadpisywania.
- Bez per-room (#4), bez eksportu (#3), bez historii zmian współczynnika (#9).
- Bez ukrywania cen podwykonawcy przed MANAGEREM (#P10 — osobny follow-on).

## Otwarte (do planu implementacji)

- Afordancja wyboru trybu override w siatce (osobna kolumna typu vs inline w komórce ceny).
- Domyślne wartości globalnych współczynników na `investments` (0,65 / 0,55 jako start?).
- Czy `investments` to właściwy dom globalnego defaultu, czy osobny rekord ustawień
  kosztorysu (przyjęto: pola na `investments`, najmniej ruchu).
