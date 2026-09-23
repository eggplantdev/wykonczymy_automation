---
change_id: przywrocenie-wlasnego-mnoznika-stawki-wykonawcy
title: Przywrócenie „własnego mnożnika" jako trzeciego źródła stawki wykonawcy — w rozpiskie i w katalogu prac
status: implementing
created: 2026-09-23
updated: 2026-09-23
archived_at: null
branch: przywrocenie-wlasnego-mnoznika-stawki-wykonawcy
worktree: null
---

## Notes

Linear: **EX-865** · plan: `plan.md` (brief: `plan-brief.md`)

Właściciel chce z powrotem trzeciej opcji źródła stawki wykonawcy — **własnego mnożnika na
pojedynczej pracy** — razem z kolumną, która go pokazuje, oraz tego samego w katalogu prac.

Rozstrzygnięcie właściciela (2026-09-23), które unieważnia powód poprzedniego cięcia:

- **Mnożnik ma być per pojedyncza praca.** „single row price needs its own."
- **Per sekcja NIE jest potrzebny.** „we do not need per section."

To odpowiada wprost na argument, na którym oparto cięcie w
`context/archive/2026-09-01-kosztorys-dwie-opcje-zrodla-ceny-wykonawcy/change.md` — tam kolumnę
zdjęto, bo „mnożnik jest jeden na całą inwestycję (nie ma mnożnika per sekcja), więc kolumna
pokazywałaby jedną powtórzoną stałą". Przy mnożniku własnym dla wiersza kolumna znów niesie treść.

### Gdzie to wycięto (archeologia, 2026-09-23)

Gałąź `kosztorys-contractor-price-columns-in-client-view`, trzy commity:

| commit     | co zniknęło                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `87e8b592` | siatka: `subcontractorCoeffColumn` + `SubcontractorCoeffCell`, pozycja `{ value: 'coeff', label: 'własny mnożnik' }` w `SUB_MODE_OPTIONS`, `PLANE_PRICE_BASE_KEYS` z trzech na dwie, `COLUMN_LABELS.priceCoeff` („Mnożnik"), `HEADER_TIPS.priceCoeff`, sortowanie i `row-conditions` |
| `f847ae70` | import z arkusza: `derive-override.ts` traci gałąź mnożnikową — obcy iloraz zamraża się jako kwota stała                                                                                                                                                                             |
| `866d3459` | typy / SQL / walidacja: `SubcontractorOverrideTypeT` z `'coeff' \| 'amount'` na `'amount'`, `calc.ts` traci `clientPrice * value`, `modeChange` traci odtwarzanie mnożnika, enum zod w akcji zawężony                                                                                |

### To NIE jest revert — schemat poszedł dalej

`562ddbe1` (EX-766, 2026-09-02, migracja `20260902_0_collapse_kosztorys_tool_overrides.ts`)
**skasował kolumny typu**:

```sql
ALTER TABLE "kosztorys_items"
  DROP COLUMN "w_tools_override_type",
  DROP COLUMN "own_tools_override_type";
```

Dziś jedna nullowalna liczba na plan niesie całość: `wToolsOverrideValue` / `ownToolsOverrideValue`,
NULL = „auto", liczba = kwota stała (`OVERRIDE_FIELDS` w `src/lib/kosztorys/constants.ts`). Nie ma
gdzie zapisać „ta liczba jest mnożnikiem, nie ceną" — trzecie źródło wymaga **nowej migracji**
(kolumna typu z powrotem albo drugie nullowalne pole `*_coeff` na plan). Do rozstrzygnięcia w planie.

### Katalog prac — tam tego nigdy nie było

`2026-08-31-katalog-prac-auto-rates` od razu wszedł jako dwa stany: `w_tools_rate` / `own_tools_rate`
nullowalne, NULL = auto (`src/collections/work-catalogue-items.ts`), formularz to checkbox „auto"
per plan (`src/components/forms/work-catalogue-item/work-catalogue-item-form.tsx:146`). Trzecia
opcja jest tam **nowa**, nie przywracana — i potrzebuje własnej migracji na `work_catalogue_items`.

### Powierzchnia do rozpisania

- migracja (rozpiska + katalog prac), kolekcje Payloada
- siatka: kolumna „Mnożnik" i komórka, trzecia pozycja w „Źródło ceny wykonawcy", picker kolumn,
  podpowiedź nagłówka, sortowanie, `row-conditions`, `plane-price-keys`
- wycena (`calc.ts`), polityka edycji komórki i `modeChange` (`subcontractor-price-edit.ts`)
- walidacja akcji (`src/lib/actions/kosztorys.ts`), SQL należności (`kosztorys-subcontractor-due.ts`)
- import z arkusza (`derive-override.ts`), snapshoty/presety (`snapshot-format.ts`)
- katalog prac: formularz, lista `/katalog-prac`, `toCatalogueCandidate`, `append-catalogue-items`,
  `catalogue-rate.ts`, dialog „Zapisz do katalogu…", raport „Porównaj z katalogiem"
- sufit ceny wykonawcy (`subcontractor-price-guard.ts`) — jak liczy się pułap przy mnożniku
