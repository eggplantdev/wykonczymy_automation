# Case 10 (projekt 3601) — measurement

Inputs:

- `inputs/client-inquiry.md`, the client's mail (contacts redacted). Its only change to the design: the Murso
  panels become spiek kamienny; everything else follows the projekt.
- `3601_zakres-prac.pdf` (production media, not in git): the design firm's „Kosztorys wykonawczy”, 3 pages. It
  lists every work item with a **quantity already measured** (LP numbers are cited as „zakres poz. N”).
- `3601_projekt.pdf` (production media, not in git): 13 vector sheets A.00–A.09 (inwentaryzacja, rzut
  projektowany, sufity, elektryka, wod-kan, posadzki, ściany, łazienka rozwinięcia), with dimensions.
- 12 visualisations (production media).
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #201** (szablon #166).

## Result (netto, szablon #166 prices)

**104 rows, 90 961,72 zł.** 12 rows are outside the szablon: 7 with a katalog price, 5 at 0 zł.

| Sekcja                                 | Amount        |
| -------------------------------------- | ------------- |
| Ściany i sufity bez łazienek           | 38 906,46     |
| Łazienka                               | 25 936,56     |
| Podłogi                                | 8 262,70      |
| Instalacja elektryczna i oświetleniowa | 6 187,00      |
| Wyburzenia, demontaże, zabezpieczenia  | 2 975,00      |
| Kuchnia                                | 2 804,00      |
| Prace dodatkowe                        | 2 400,00      |
| Instalacja wodno-kanalizacyjna + c.o.  | 2 150,00      |
| Montaż stolarki i ślusarski            | 1 340,00      |
| **Razem**                              | **90 961,72** |

## Sheets used

| Page          | Used for                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| zakres p. 1–3 | quantities for almost every row: GK, doors, LED, paint, gładź, tiles, deska, listwy, fixtures             |
| A.01          | room schedule (A, L), legend 1–8 (radiators, stelaż to the ceiling, panel „imitujący skałę”, mech), notes |
| A.02 / A.02a  | wylewka samopoziomująca per room; suspended ceilings and their heights (4 cm, łazienka 12 cm)             |
| A.03          | „Tabela zmian elektrycznych”: 17 + 5 light points, 1 socket, LED, transformers, mata                      |
| A.04          | wod-kan 11 pkt, radiator moves, „naprawa wylewki”                                                         |
| A.05          | floor finishes (tiles 598×598 vs deska)                                                                   |
| A.06 / A.06a  | which walls get GŁADŹ; kitchen backsplash                                                                 |
| A.07–A.09     | łazienka rozwinięcia: tile fields, wanna with a półka, przedścianka umywalki                              |
| wizualizacje  | lit niche by the tub, moss wall, kitchen to the ceiling, AC units (not in the zakres)                     |

## Reading before deriving

- **The zakres is the measurement.** Unlike cases 5–7, the design firm already counted the quantities, so most
  rows take a printed figure. The script derives only what the zakres does not split by sekcja: the łazienka's
  share of ceilings, primers and paint.
- **Whole-flat figures split off the łazienka.** Sufit podwieszany 44,9, gładź na sufit 59,18 and malowanie
  sufitów 59,18 are whole-flat; the łazienka 5,4 m² is subtracted, because its ceiling is priced in the
  Łazienka sekcja (sufit z LED as a komplet; „Malowanie sufitów i ścian bez glazury + gładź na suficie”).
- **Spiek.** The zakres priced 3 Murso panels. The mail swaps them for spiek, so the area is measured from
  the A.01 legend fields „8” at full height under the GK ceiling: (0,86 + 0,30 + 0,86 + 1,80) × 2,71.
- **No chasing on the kitchen wall.** A.01 marks it „ŚCIANA MIĘDZYLOKALOWA – brak możliwości wkucia
  przyłączy”, which is why the zakres has a 10,2 m² przedścianka and the wod-kan bruzdy stay at 2 mb.

## Measured areas

- **Floor:** 58,6 m² from the A.01 schedule (the zakres header says 59,18):
  - kuchnia 3,7, salon 17,5, korytarz 8,8, łazienka 5,4, pokój 10,7, sypialnia 12,5.
- **Deska (laid):** salon 17,5 + korytarz without tiles 6,4 + pokój 10,7 + sypialnia 12,5 = **47,1 m²**; the
  zakres orders 51,8 m² (≈ 10% waste).
- **Perimeter outside the łazienka:** 67,81 mb (sum of A.01 L) → akrylowanie łączeń.
- **Ceilings outside the łazienka:** 53,78 m² (59,18 − 5,4); GK part 39,5 (44,9 − 5,4); pokój keeps the
  developer slab (10,7).
- **Walls outside the łazienka:** painted 152,6 m², of which gładź 98,73 (zakres); 53,87 m² get grunt and
  poprawki only.
- **Łazienka:**
  - walls 9,489 mb × 2,63 − door 0,80 × 2,05 = **23,32 m²**;
  - tiles 15,19 + 2,6 = 17,79 m² on walls (widoki 17,7), 4,1 m² floor;
  - painted walls 23,32 − 17,79 − tub face 1,44 = 4,09 m².
- **Electrical:** A.03 table — light points sypialnia 9, pokój 3, salon 5, łazienka 5; 1 kitchen socket;
  bruzdy 2 mb × 23 = 46 mb.
