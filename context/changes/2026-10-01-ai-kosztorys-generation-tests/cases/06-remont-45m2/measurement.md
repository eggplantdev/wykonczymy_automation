# Case 6 (Remont 45 m²) — measurement

Inputs:

- `inputs/client-inquiry.md` — one sentence: a 45 m² flat for a kapitalny remont, project attached;
- `projekt-techniczny.pdf` (production media, not in git) — a 29-page **vector** interior design project at 1:50;
- `inputs/wiedza-firmowa.md` — the house rules.

Script: `scripts/build_draft.py`, which writes `measure/ai-draft-load.json` for **production #191**
(szablon #166). `scripts/measure/svgseg.py` loads the vector layer of a page that has been converted with `pdftocairo -svg`.

## Result (netto, szablon #166 prices)

**103 rows, 105 079,14 zł.**

| Sekcja                                 | Amount         |
| -------------------------------------- | -------------- |
| Ściany i sufity bez łazienek           | 40 811,28      |
| Łazienka                               | 16 283,10      |
| Instalacja elektryczna i oświetleniowa | 13 421,80      |
| Podłogi                                | 11 286,61      |
| Wyburzenia, demontaże, zabezpieczenia  | 10 993,35      |
| Prace dodatkowe                        | 3 000,00       |
| Instalacja wodno-kanalizacyjna + c.o.  | 2 500,00       |
| Kuchnia                                | 2 433,00       |
| Klimatyzacja                           | 2 410,00       |
| Montaż stolarki i ślusarski            | 1 940,00       |
| **Razem**                              | **105 079,14** |

Row counts:

- 82 rows carry `assumptions`;
- 25 rows carry `missingData`;
- 2 rows are unpriced: the large glued mirrors and the sprzątanie. Neither has a katalog entry.

## Sheets used

| Sheet             | Used for                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| A.04.1            | existing state                                                                                                       |
| A.04.2            | zmiany budowlane: the 11 numbered changes, room schedule (m², `H:265 cm`, finish column = MIK)                       |
| A.04.3            | floor finishes and their legend (klepka ~32 m², gres ~12 m², Geotiles ~3 m², listwa ~40 mb, „biała listwa” ~1,85 mb) |
| A.04.4            | ceilings: white ceiling „ok. 27,5 m²”, listwa sufitowa, „szyna sufitowa dwutorowa”                                   |
| A.04.5            | wall finishes by colour: white, two wallpapers, lamele, mirrors, panele tapicerowane, kitchen and łazienka tiles     |
| A.05.1–A.05.4     | electrical: sockets, switches, the lighting table, RTV/IT, LED lines                                                 |
| A.06.1            | CO: one new drabinka in the łazienka; the plate radiators stay                                                       |
| A.06.2            | klimatyzacja: 1 indoor unit, outdoor unit on balkon B1                                                               |
| A.07.1            | ceiling/lighting layout                                                                                              |
| A.08.1            | doors: Dz1, D1, D2                                                                                                   |
| A.09.1            | zabudowa in the hol                                                                                                  |
| A.09.2            | łazienka rozwinięcia                                                                                                 |
| A.09.3            | kitchen rozwinięcia                                                                                                  |
| A.10.1            | windows (glify)                                                                                                      |
| A.10.4, pp. 27–28 | schematy: Geberit stelaż, sink                                                                                       |

## Reading before deriving

- **Height.** Every room prints `H:265 cm`, so H = 2,65 everywhere. That overrides the 2,60 rynek-wtórny default.
- **Room areas** come from the A.04.2 schedule:

  | Room            | m²    |
  | --------------- | ----- |
  | Hol 0.01        | 5,36  |
  | Sypialnia 0.02  | 9,33  |
  | P. dzienny 0.03 | 14,09 |
  | Sypialnia 0.04  | 9,00  |
  | Kuchnia 0.05    | 4,78  |
  | Łazienka 0.06   | 2,53  |

  The total is 45,09 m² and the dry rooms take 42,56 m². The total matches the mail's „45 m²”.

- **Floor quantities = laid area.** The A.04.3 legend says „dodano ok. 10% zapasu”, so the legend
  quantities are purchase quantities and are not used as laid area:
  - floors come from the room m²;
  - the listwa is ~40 mb in the legend; 40 / 1,1 = 36,4 mb laid;
  - the „biała listwa” is 1,85 mb in the legend; 1,85 / 1,1 = 1,68 mb.

## Vector measuring

The PDF converts to SVG with the drawing paths under `matrix(2.83…)`. Their units are paper mm, so at
1:50 one unit ≈ 4,98 cm. The scale was checked against the printed room sides:

- P. dzienny 464 × 304 = 14,1 m² against the printed 14,09;
- Sypialnia 0.04 355 × 253 = 8,98 m² against the printed 9,00.

On A.04.5 every finish is a coloured stroke along the wall. The wavy wallpaper strokes are made of
thousands of tiny curve segments, so summing segment lengths was useless. Instead, each colour was
rasterised, dilated and split into connected components, and each bbox's long side was taken. The legend
swatches (≈ 1,04 m each) were excluded. Lengths:

| Finish                | mb     | Where                                                                               |
| --------------------- | ------ | ----------------------------------------------------------------------------------- |
| tapeta „leafy monkey” | 7,14   | hol 1,16; P. dzienny 1,02 + 0,97 + 2,52; sypialnia 0.04 bed wall 1,47               |
| tapeta „clouds”       | 3,91   | sypialnia 0.02: 2,19 + 1,72                                                         |
| lamele                | ≈ 5,46 | hol 0,50; 0.02 0,50; P. dzienny 0,59 + 0,69 + pillar ≈ 2,2 (3 sides); 0.04 2 × 0,49 |
| lustro                | 4,86   | hol 1,04 („95, h = pełna wysokość”), 0,68, 1,57, 0,59, 0.04 2 × 0,49                |
| panele tapicerowane   | 1,28   | the hol niche with the siedzisko (A.09.1)                                           |
| kitchen tiles         | 2,15   | L-shape; the height comes from A.09.3                                               |
| łazienka tiles        | 1,50   | the wanna walls; the heights come from A.09.2                                       |

Most of these strokes are annotated „h = pełna wysokość”, so every lamele, mirror and wallpaper area is
`length × 2,65`.

Two other measurements:

- **Listwa sufitowa (A.04.4)**: the solid line measures ≈ 44,6 mb on the outer edge and 42,4 mb on the
  inner edge. Taken as 45 mb. The legend's 54 mb is the purchase quantity.
- **„Szyna sufitowa dwutorowa”**: the purple line runs along the P. dzienny window (3,03) and the
  0.04 window (2,52), 5,55 mb in all. It is a curtain track (karnisz), not a szynoprzewód.

## Derived quantities

**Room perimeters** (`P_dry` = 60,71 mb):

- P. dzienny and 0.04 use both printed sides;
- for the hol (1,20), 0.02 (4,11) and the kuchnia (1,65, the rozwinięcie 2 width), the other side =
  m² ÷ the printed side.

**Gładź**:

- walls gross 160,87 m²;
- minus:
  - the kitchen cabinet walls: 1,43 + 1,65 + 0,93 mb full height (house rule);
  - lamele 14,47 m²;
  - panele tapicerowane 3,39 m²;
  - doors 9,4 m²;
- plus ceilings 42,56;
- **= 165,55 m²**.

Windows are not deducted. Gładź is kept under the wallpaper and the glued mirrors, which both need a
flat wall. Siatka, gruntowanie and podkład take the same m², as in case 4.

**Painting**: white walls 80,83 m² = gładź walls − wallpaper 29,28 − mirrors 12,88. Ceilings 42,56.
The legend paints every undescribed wall white.

**Akrylowanie**: 60,71 − 45 mb (where the listwa sufitowa covers the joint) = 15,71 mb.

**Łazienka (A.09.2)**:

- room 188 × 142, perimeter 6,6;
- wall tiles 6,71 m² = three walls above the wanna to 2,05 m (0,72 / 1,42 / 0,72), plus the
  obudowa 1,42 × 0,60;
- floor 2,53;
- painting 11,04 m² = walls without tiles − the hidden wall behind the obudowa − the door + the ceiling;
- house-rule rows:
  - folia = all tiles;
  - fugowanie = per format;
  - taśma = perimeter + 2 wet corners + the wanna joint;
  - silikon 20 mb;
  - otwory: WC 5, wanna natynkowa 2, umywalka 3, grzejnik 2, lustro 2.

**Kitchen (A.09.3)**: tiles 0,60 m high (worktop → wall cabinets) × (1,43 + 1,65) = 1,85 m².

**Zmiany budowlane (A.04.2)**:

- wyburzenia 5,46 m²:
  - (1) wall fragment 1,2;
  - (2') nadproże 0,52;
  - (4) wall with a 60/200 opening 1,36;
  - (4') wall with the internal window 1,98;
  - (5) widened niche ≈ 0,4;
- bloczki 5,61 m²:
  - (2) infill 80/220;
  - (3) 90 cm wall × 2,65;
  - (7) 153 → 80 narrowing.

**Electrical**:

- 20 sockets, 11 switches and 4 stair switches → 35 points;
- 19 lighting points (A.05.3 table);
- 3 RTV/IT points;
- bruzdy = 2,5 mb × 57 = 142,5 mb;
- LED: hol 0,59 + 4 × 1,41, kuchnia 3,51, łazienka 1,86 → 11,60 mb;
- 5 szynoprzewody: 5,89 mb.

## Assumptions that move the total most

1. **Floor finish.** A.04.3 shows klepka (cyklinowanie) and gres, while the A.04.2 schedule says
   MIKROCEMENT in every room. Pricing follows A.04.3. All-mikrocement (katalog „Posadzki z mikrocementu
   sama robocizna”, 500 zł/m²) would add ≈ **+14,9 tys. zł**.
2. **Room perimeters** for the hol, 0.02 and the kuchnia are derived, not printed. Each 1 mb of
   perimeter is ≈ ±380 zł across gładź, siatka, grunt, podkład and paint.
3. **Bruzdy elektryczne in soft walls**: 7,1 tys. zł. Each point is 125 zł, and żelbet would cost more.
   The wall material is unknown.
4. **Klimatyzacja done by us**: 2,41 tys. zł, with a 4 mb route. If the supplier installs it, the whole
   amount comes off.
5. **Ceiling**: all dry ceilings are taken, although A.04.4 prints „ok. 27,5 m²” of white ceiling.
   Taking 27,5 would be −2,2 tys. zł.
6. **Small-format tiles.** Equipe Magma and Artisan are taken as the ~6,5 × 20 brick. At the standard
   format rate they would be −1,8 tys. zł.
7. **Old finishes are not drawn.** The old łazienka is assumed tiled to 2,0 m, the old kitchen has a tile
   band and a tiled floor, and the hol has klepka. This totals ≈ 2,0 tys. zł.

## Out of the draft on purpose (Przedmiar 0)

- entrance door Dz1 montaż and demontaż — the door supplier;
- windows — the window firm;
- panele tapicerowane, zabudowy stolarskie, blaty — stolarz;
- the plate radiators — they stay (A.06.1).
