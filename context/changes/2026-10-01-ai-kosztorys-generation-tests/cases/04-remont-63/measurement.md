# Case 4 (Remont 63 m²) — measurement

Inputs:

- `inputs/client-inquiry.md`: a line-by-line scope list and the electrical counts;
- the rzut, a raster scan with printed m² per room and a few side lengths (`rzut.jpg` on production);
- 8 photos of the furnished flat.

Script: `scripts/build_draft.py`, which writes `measure/ai-draft-load.json`. Loaded into **production #185**
(szablon #166).

## First case under „agent nie zakłada” (2026-10-08)

The first draft followed rule 2 as it stood then: read what is printed and label the rest „assumed”.
It came to 65 rows and 103 138 zł. The assumptions behind it were:

- H 2,70;
- the łazienka grown to 5,0 m²;
- tiles to the ceiling;
- five 150×150 windows;
- the przedpokój shape;
- the length of the kuchnia wall;
- doors and listwy filling in the missing „Montaż […]”.

Mid-case the owner changed the rule, so the draft was rebuilt to **36 rows, 37 203,14 zł**. Every
quantity left in it is now one of three kinds:

- **read** from the rzut, the mail or the photos: room m², futryny (6 door swings), electrical counts,
  the armatura named in the mail, the pralka on the photo;
- **derived by a house rule**, with the rule named in Komentarz:
  - bruzdy 2,5 mb per point;
  - wod-kan punkt = 3 / 2;
  - bruzdy wod-kan 2 mb per łazienka;
  - zabezpieczenia = floor m²;
  - transport ryczałt;
  - silikon 20–30 mb;
  - taśma ≈ 15 mb per łazienka;
  - otwory per fixture;
  - fugowanie = tile m²;
- **counted from the mail** as one kpl or one szt.

Everything that needs a wall height, the new łazienka wall's position, the tile heights, window sizes or
the missing „Montaż […]” is left out. The notes list it as 13 questions above the mail. That is most of
the job by value: gładź, malowanie ścian, GK, glazura, skuwanie and wyburzenia. The 66 % drop
(103 → 37 tys.) is roughly the share of an offer that rests on H and on the layout.

## Result (netto, szablon #166 prices)

| Sekcja                                 | Amount        |
| -------------------------------------- | ------------- |
| Łazienka                               | 8 951,10      |
| Instalacja elektryczna i oświetleniowa | 8 715,00      |
| Wyburzenia, demontaże, zabezpieczenia  | 8 607,50      |
| Ściany i sufity bez łazienek           | 4 407,54      |
| Prace dodatkowe                        | 3 000,00      |
| Podłogi                                | 2 772,00      |
| Instalacja wodno-kanalizacyjna + c.o.  | 750,00        |
| **Razem**                              | **37 203,14** |

One position has no price: sprzątanie, a new row, because the katalog has no such entry.
DB check: Σ AI przedmiar × Cena j.m. on #185 = 37 203,14, 36 rows ≠ 0, Przedmiar empty.

## Reanalysis with the house height (2026-10-08, 17:12 → 17:17)

The owner set **H = 2,60 for the rynek wtórny** (2,68 for deweloperka) as a house rule. Rebuilt to **45 rows,
70 775,16 zł**. What H unlocked, read from the 2× crops of the scan:

| Quantity                         | Value     | From                                                                                                 |
| -------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| Perimeters for gładź             | 58,78 mb  | salon 3,97 × 3,65; pokój 2,25 × (9,5 ÷ 2,25); 3,97 × 2,97; 2,31 × (9,1 ÷ 2,31); 1,41 × (0,98 ÷ 1,41) |
| Walls brutto                     | 152,83 m² | × 2,60; openings not deducted, because only window widths are printed                                |
| Gładź / siatka / grunt / podkład | 211,21 m² | walls + ceilings 58,38                                                                               |
| Wyburzenia                       | 8,40 m²   | (1,79 łazienka–sypialnia + 1,44 kuchnia width) × 2,60                                                |
| Skuwanie                         | 27,05 m²  | old łazienka 1,70 × 1,79, tiled to the ceiling on the photo: 18,15 walls + floors 3,0 + 1,4 + 4,5    |

Left out, because the layout is missing:

- the przedpokój walls (no printed sides);
- the WC and kuchnia wall tiles (height unread);
- the whole łazienka/WC tiling block and both GK walls (the new wall position and tile height are not given).

Corrected readings: łazienka 1,70 × 1,79 (was read as 1,40 × 2,14), kuchnia 4,5 m² (was 4,6).

| Sekcja                                 | Amount        |
| -------------------------------------- | ------------- |
| Ściany i sufity bez łazienek           | 34 966,26     |
| Wyburzenia, demontaże, zabezpieczenia  | 11 642,80     |
| Łazienka                               | 8 951,10      |
| Instalacja elektryczna i oświetleniowa | 8 715,00      |
| Prace dodatkowe                        | 3 000,00      |
| Podłogi                                | 2 750,00      |
| Instalacja wodno-kanalizacyjna + c.o.  | 750,00        |
| **Razem**                              | **70 775,16** |

DB check: Σ AI przedmiar × Cena j.m. on #185 = 70 775,16, 45 rows ≠ 0.
