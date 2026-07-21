# Wariant kosztu podwykonawcy per etap — Plan Brief

> Full plan: `context/changes/kosztorys-per-etap-cost-variant/plan.md`
> Design: `context/reference/kosztorys-editor-domain-notes.md` → „Wariant z/bez narzędzi"

## What & Why

Cena podwykonawcy „z narzędziami" / „bez narzędzi" to nie dwie równoległe ceny jednej pracy — praca
jest wykonana **albo** z **albo** bez (OR, nie AND), i wariant zmienia się **per etap** (kilka ekip).
Dziś silnik wycenia całość po jednym globalnym widoku i jest ślepy na etap, więc „suma wykonanej pracy"
nigdy nie odda realnego miksu — stąd rozjazd 78k (całość z) vs ~56k (arkusz, realnie bez). Dokładamy oś
etapu do wyboru wariantu i liczymy koszt jako Σ po komórkach.

## Starting Point

Silnik: `PriceViewT` (klient / z / bez) globalny; `settlement.ts:100` wycenia całą wykonaną ilość raz
po jednym widoku, ignorując wariant per etap. Schemat: poziom 1 kaskady (`default_cost_variant` na
sekcji) już istnieje; `stage_progress` trzyma tylko ilość. Blok „Podsumowanie podwykonawców" (EX-554,
implemented) liczy „pozostało do wypłaty" w każdym widoku podwykonawcy — to źródło rozjazdu.

## Desired End State

Cztery widoki w kolejności (Klient / Z / Bez / **Mieszany**) — Mieszany na końcu (najrzadziej używany);
edytor startuje na Kliencie. Koszt liczony
jako Σ komórek po rozwiązanym wariancie kaskady. W mieszanym: komórki kolorowane wariantem, klik
nagłówka sekcji na etapie / klik komórki przypisuje ekipę; „pozostało do wypłaty" (należne − realne
PAYOUT) **tylko** w mieszanym. Z/bez = widełki-hipoteza bez rozliczenia.

## Key Decisions Made

| Decyzja            | Wybór                                                                  | Dlaczego                                                                     | Źródło |
| ------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| Grain wariantu     | Per etap                                                               | Kilka ekip, „etapy 1–2 z, 3–4 bez" — potwierdzony realny case                | Design |
| Poziom zapisu      | Kaskada 3-poziomowa (sekcja → sekcja×etap → praca×etap)                | Ekipa idzie za sekcją, zmienia się między etapami; rzadki override per praca | Design |
| Zakres slice'u     | Jeden slice, silnik + edycja razem                                     | Właściciel chce od razu klikać ekipy                                         | Plan   |
| Kaskada w fazie 1  | Wszystkie 3 poziomy od razu                                            | Kompletny model, per-praca gotowe choćby rzadkie                             | Plan   |
| Kolejność widoków  | „Mieszany" na końcu (najrzadziej używany; edytor startuje na Kliencie) | Rzeczywistość + jedyny z pełnym rozliczeniem; z/bez jako widełki             | Plan   |
| Bramka rozliczenia | „Pozostało do wypłaty" tylko w mieszanym                               | Należne w z/bez to hipoteza — zestawianie z realnymi PAYOUT dało bug 78k     | Design |

## Scope

**In scope:** kolumna wariantu na komórce postępu (poziom 3) + tabela/kolekcja sekcja×etap (poziom 2);
resolver kaskady + silnik Σ po komórkach; `PriceViewT += 'mixed'`; widok mieszany na końcu; bramka
rozliczenia; klikalna edycja ekip (kolory, poziom 2/3, optymistyka); seed Białostocka + testy.

**Out of scope:** usunięcie z/bez (zostają jako widełki); rozliczenie per pracownik z etapów; panel
plan-vs-actual / marża planowana; migracja/backfill danych; oś netto/brutto w widokach podwykonawcy;
zmiana znaczenia istniejącego `item.cost_variant` poza wpięciem jako fallback.

## Architecture / Approach

Kaskada = „inheritance z override" (jak VAT/współczynniki) + oś etapu. Komórka (praca×etap) rozwiązuje
się `poziom3 ?? poziom2 ?? poziom1`. Silnik mieszany żyje w warstwie rozliczeniowej (`settlement.ts`,
zna etapy), nie w `calc.ts` (ślepym na etapy). Poziom 2 keyed po sekcji → osobna mapa na
`KosztorysTreeT`; poziom 3 → kolumna na `stage_progress`, przewleczona na wiersz. Bramka = jeden warunek
`priceView === 'mixed'` (wzorzec już użyty dla recon „scream").

## Phases at a Glance

| Faza                       | Dostarcza                                                                     | Kluczowe ryzyko                                                                        |
| -------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1. Schemat                 | Kolumna wariantu na postępie + tabela/kolekcja sekcja×etap, migracja          | Dopis do `payload_locked_documents_rels` (lock-check rzuca bez niego)                  |
| 2. Silnik mieszany         | Resolver kaskady + Σ po komórkach + `'mixed'` w unii + przewleczenie danych   | Drobne z sumowania per etap; poziom 2 keyed po sekcji nie mieści się w płaskim wierszu |
| 3. Widok + bramka + edycja | 4. widok (na końcu), „pozostało" tylko w mieszanym, klikalne przypisanie ekip | Kolizja z UX siatki (kolory komórek, klik nagłówek vs komórka), optymistyka            |
| 4. Seed + testy            | Seed Białostocka (bez narzędzi) + testy silnika/bramki                        | Parytet ≈ 56 431                                                                       |

**Prerequisites:** docker Postgres 5433 up; branch EX-554 (nadbudowa `podsumowanie-podwykonawcow`).
**Estimated effort:** ~3–4 sesje (schemat + silnik szybkie; edycja UI i bramka to gros pracy).

## Open Risks & Assumptions

- Import wariantu dla NIE-jednorodnych inwestycji (arkusz nie ma per-etap znacznika) — poza tym change;
  Białostocka jednorodna, seed ustawia default sekcji. Reguła importu dla miksów = przyszła robota.
- Los istniejącego `item.cost_variant` (per-praca, bez etapu) — rekomendacja: zostaje jako default nowej
  komórki, per-cell poziom 3 go zastępuje. Rozstrzygnąć w implementacji, nie rozszerzać zakresu.
- Mieszany nie ma jednej ceny j.m. — kolumny NIE chowamy: „Cena j.m." → marker „miks/stawka",
  „Pozostało do rozliczenia" → „nie dotyczy" + powód (decyzja właściciela); wiersz pokazuje kwotę.
- **OTWARTE (właściciel 2026-07-21):** nie udowodniono, że realny miks z/bez per etap był potrzebny —
  arkusz Michał Malarz ma etykiety ekip per etap, ale liczy jednorodnie per tab (jedna stawka na tab),
  a etykieta ekipy nie niesie wariantu. Nie wiemy, jak liczono wypłatę przy miksie. Decyzja: budujemy
  elastyczny model per etap mimo to — degeneruje poprawnie do „całość z/bez" w przypadku jednorodnym.

## Success Criteria (Summary)

- Widok mieszany „suma wykonanej pracy" oddaje realny miks; INV 42 ≈ 56 431 (jednorodna == bez).
- „Pozostało do wypłaty" widoczne tylko w mieszanym; z/bez pokazują widełki bez rozliczenia.
- Klik nagłówka sekcji na etapie / klik komórki przypisuje wariant, kolory i kwoty przeliczają się
  optymistycznie.
