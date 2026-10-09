# Case 2 (Oliwa) — measurement

Inputs: `inputs/rzut.png` (raster screenshot, 1920×887), `inputs/client-inquiry.md`, `inputs/rozpiska-180.tsv`.
Scripts: `scripts/geometry.py` (calibration + areas), `scripts/build_draft.py` (draft + total).

## 1. Input class

Raster furnishing plan (screenshot). No printed room m², no Hpom, no window/door heights. It does print
7 dimensions, so pixel measurement is allowed after calibration (procedure rule 3). Every quantity is
recorded in `measure/ai-draft-load.json` — assumptions and unknowns per row (see the reanalysis at the end).

## 2. Scale calibration

Tick centres were read on 8× zooms with a pixel ruler.

| Printed dimension            | Pixel span           | px/cm  |
| ---------------------------- | -------------------- | ------ |
| 670 cm (kitchen/salon depth) | y107 → y637 = 530 px | 0,7910 |
| 339 cm (salon width)         | x525 → x793 = 268 px | 0,7906 |

The two calibration dimensions agree within **0,06 %**, giving a scale of **1,2645 cm/px**. The other
five printed dimensions were then checked with that scale:

| Printed                      | Measured | Error  |
| ---------------------------- | -------- | ------ |
| 401 (sypialnia, incl. szafa) | 403      | +0,6 % |
| 296 (łazienka)               | 295      | −0,5 % |
| 157 (łazienka)               | 158      | +0,7 % |
| 102 (prysznic)               | 102      | −0,2 % |
| 86 (prysznic)                | 85       | −0,7 % |

All 7 dimensions fall within ±0,7 %. The method is valid.

**Independent check.** The measured floor without the bathroom is **36,59 m²**. The client wrote
„ułożenie paneli powierzchnia około 36 m2”, which agrees within 1,6 %.

## 3. Assumptions that drive the geometry

| Parameter                                          | Value                             | Status                                 |
| -------------------------------------------------- | --------------------------------- | -------------------------------------- |
| Ceiling height H                                   | 2,65 m                            | assumed, not given; ±566 zł per ±10 cm |
| Door height, „drzwi wysokie” (łazienka, sypialnia) | 2,40 m                            | assumed                                |
| Entrance door                                      | 1,05 × 2,05 m                     | width measured, height assumed         |
| Window height (both „okno”)                        | 1,50 m                            | assumed                                |
| Window widths                                      | sypialnia 1,64 m, salon 2,53 m    | measured                               |
| Door widths                                        | łazienka 0,89 m, sypialnia 0,96 m | measured                               |

## 4. Rooms (measured, inner wall faces)

| Room                                          | Area m²   | Perimeter m | Notes                                                                                |
| --------------------------------------------- | --------- | ----------- | ------------------------------------------------------------------------------------ |
| Hol + korytarz + kuchnia + salon (open space) | 25,83     | 25,97       | one open space, no wall between hol and kuchnia; includes szafa gosp. alcove 0,68 m² |
| Sypialnia                                     | 10,76     | 13,40       | 2,67 × 4,03; includes szafa na ubrania 1,12 m²                                       |
| **Floor without bathroom**                    | **36,59** | 39,37       |                                                                                      |
| Łazienka (rectangle 157 × 296)                | 4,66      | 9,05        | the L-shape keeps the perimeter                                                      |
| − pion block, top-left (0,61 × 0,38)          | −0,23     |             | hatched on the plan                                                                  |
| − geberit box (0,95 × 0,19)                   | −0,18     |             | floor not tiled                                                                      |
| **Łazienka floor tiles**                      | **4,25**  |             | ceiling 4,43                                                                         |

Open-space wall segments, clockwise from the hol's top-left corner:

| Segment                              | Length               | Note                                     |
| ------------------------------------ | -------------------- | ---------------------------------------- |
| Hol top wall                         | 1,82 m               | incl. entrance door 1,05                 |
| Stub wall between hol and lodówka    | 1,07 + 0,15 + 0,70 m |                                          |
| Kuchnia top wall                     | 2,48 m               | behind the zabudowa                      |
| East wall                            | 6,70 m               | kuchnia 2,50 of it behind the zabudowa   |
| Salon window wall                    | 3,36 m               |                                          |
| Partition salon/korytarz – sypialnia | 4,89 m               | incl. bedroom door 0,96                  |
| Stub end                             | 0,11 m               |                                          |
| Szafa gosp. alcove                   | 0,76 + 0,97 m        |                                          |
| Bathroom wall on the hol side        | 2,95 m               | incl. bathroom door 0,89 and alcove 0,70 |
| **Sum**                              | **25,97 m**          |                                          |

## 5. Wall and ceiling areas (without the bathroom)

|                                                                       | Gross (P × 2,65) | Openings                                                                   | Net          |
| --------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------- | ------------ |
| Open space                                                            | 68,82            | entrance 2,15 + łazienka 2,14 + sypialnia 2,30 + salon window 3,80 = 10,38 | **58,44**    |
| Sypialnia                                                             | 35,51            | door 2,30 + window 2,46 = 4,77                                             | **30,74**    |
| **Walls total**                                                       | 104,33           | 15,15                                                                      | **89,18 m²** |
| − walls behind the kitchen zabudowa, (2,48 + 2,50) × 2,65 full height |                  |                                                                            | −13,20       |
| **Gładź walls**                                                       |                  |                                                                            | **75,98 m²** |
| **Ceilings**                                                          |                  |                                                                            | **36,59 m²** |

How the areas were counted:

- Gładź excludes the kitchen walls, per the owner's instruction. Malowanie takes the full net walls
  (89,18) plus the ceilings, which gives 125,77 m².
- Gruntowanie follows the gładź area: 75,98 + 36,59 = 112,57 m².
- Window reveals (glify, ≈2,5 m²) were not added.
- Walls behind the built-in wardrobes (szafa gosp., szafa na ubrania, the zabudowa by the entrance) are
  counted: about 17,2 m². This is a question in the notes.

## 6. Lengths

**Akrylowanie** (owner: ceiling–wall joints plus wall–wall joints) = **71,2 mb**:

- ceiling–wall joints = 25,97 + 13,40 = 39,37 mb;
- wall–wall inside corners: open space 8 + sypialnia 4 = 12 × 2,65 = 31,80 mb.

**Narożniki aluminiowe**, outside corners = **20,8 mb**:

- 4 wall ends (the two stubs) × 2,65 = 10,60;
- window reveal edges: sypialnia (1,64 + 2 × 1,5) + salon (2,53 + 2 × 1,5) = 10,17.

**Listwy przypodłogowe** = **24,0 mb**. The perimeter 39,37 minus the following:

| Deduction                                                       | mb   |
| --------------------------------------------------------------- | ---- |
| Kitchen zabudowa                                                | 4,98 |
| Szafa gosp. alcove                                              | 2,43 |
| Zabudowa by the entrance                                        | 1,64 |
| Szafa na ubrania                                                | 2,43 |
| Door openings: entrance 1,05, łazienka 0,89, sypialnia 0,96 × 2 | 3,86 |

**Maskownica GK**: drawn as a double line about 20 cm from both window walls.

| Room      | mb       |
| --------- | -------- |
| Sypialnia | 2,67     |
| Salon     | 3,36     |
| **Total** | **6,03** |

## 7. Bathroom (tiles 120×60, full height assumed)

| Item           | Quantity | How                                           |
| -------------- | -------- | --------------------------------------------- |
| Wall tiles     | 21,87 m² | 9,05 × 2,65 − door 0,89 × 2,40                |
| Floor tiles    | 4,25 m²  |                                               |
| Folia w płynie | 8,0 m²   | floor 4,25 + shower walls (0,86 + 1,02) × 2,0 |
| Taśma          | 10,2 mb  | wall–floor joint 8,16 + shower corner 2,0     |
| Silikon        | 21,4 mb  | 8,16 + 5 inside corners × 2,65                |
| Grunt          | 30,5 m²  | walls + floor + ceiling                       |
| Fuga           | 26,1 m²  | wall + floor tiles                            |

## 8. Electrical points (assumed: the client gives no counts) and bruzdy (owner rule 2,5 mb/pkt)

| Points                                                                                      | Count  |
| ------------------------------------------------------------------------------------------- | ------ |
| Moved gniazdka („niewielkie przesunięcia”)                                                  | 6      |
| Ceiling points for lampy wiszące (dining table, sypialnia, salon)                           | 3      |
| LED feeds: maskownica salon, maskownica sypialnia, under the kitchen cabinets, shower shelf | 4      |
| **Total**                                                                                   | **13** |

Bruzdy = 13 × 2,5 = 32,5 mb:

- ceiling, żelbet: 3 × 2,5 = 7,5 mb;
- walls, soft material: 10 × 2,5 = 25,0 mb.

Tynkowanie bruzd = 32,5 mb.

## 9. Total

**Wartość netto (Σ qty × clientPrice) = 39 205,15 zł.** The draft has 51 positions: 50 priced, plus
1 new unpriced position (maskownica GK, 6,03 mb, „brak w katalogu — do wyceny”). The total
understates the job by that position: 663 zł at 110 zł/mb (the 53061 sztukateria cover) up to
2 111 zł at 350 zł/mb (the 53089 GK zabudowa).

## Reanalysis under „the agent may assume, and writes every assumption” (2026-10-09)

`scripts/build_draft.py` now writes the `load-ai-draft` shape directly (`measure/ai-draft.json`, the
intermediate with `source`, is gone). Each row carries its assumptions and unknowns; a row read off the
rzut or the client's text carries neither. One quantity input changed: **H = 2,68 m**, not 2,65. The rzut
prints no height, and the inquiry describes the developer's kaloryfer and tynki, so this is stan deweloperski,
which Wiedza firmowa sets at 2,68. Walls are now 90,36 m² net, gładź walls 77,01 m², and łazienka wall tiles
22,14 m².

**51 rows, 39 375,48 zł** (+170,33 zł from the height): 31 with an assumption, 18 with an unknown,
1 unpriced (the maskownica GK). It loads into **#180 itself**, next to the owner's Przedmiar: the matched
pozycje get AI przedmiar and the maskownica is added with Przedmiar 0.
Not loaded yet: production lacks the AI-comment migration until the human-run migrate.
