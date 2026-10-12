# Case 14 (Łazienka + gładź 60 m²) — measurement

Inputs:

- `inputs/client-inquiry.md`, the client's mail. It asks for a bathroom finish to the attached projekt, plus one
  coat of gładź and sanding on about 60 m² of walls (the rest will be built over or wallpapered). The flat is
  new from a developer. Electrics and furniture are done separately.
- 7 PDFs (production media, not in git): „Układ płytek” 1/2, „Kłady ścian i mebli” 1/2, „Rzut sufitu”, „Rzut
  punktów hydraulicznych hol i łazienka”, „Rzut punktów elektrycznych”. All are raster with no text layer, so
  every figure was read visually.
- 4 visualisations of the bathroom (JPG).
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #204** (szablon #166).

## Result (netto, szablon #166 prices)

**36 rows, 29 266,88 zł.** All rows match the szablon; none is added.

| Sekcja                                | Amount        |
| ------------------------------------- | ------------- |
| Łazienka                              | 20 872,48     |
| Ściany i sufity bez łazienek          | 4 140,00      |
| Prace dodatkowe                       | 2 400,00      |
| Wyburzenia, demontaże, zabezpieczenia | 1 660,00      |
| Podłogi                               | 194,40        |
| **Razem**                             | **29 266,88** |

## Sheets used

| Sheet                   | Used for                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------ |
| Układ płytek 1/2        | room outline and dimensions, tile layout, koperta cuts at the linear drain, Dabstory |
| Kłady ścian i mebli 1/2 | wall elevations: height 272, tile formats, mixer heights, stelaż H112, MDF zabudowa  |
| Rzut sufitu             | suspended ceiling h=10 over the shower with the LED maskownica, vent position        |
| Rzut punktów hydraulic. | wod-kan points; the pralka in the hol stays „bez zmian”                              |
| Rzut punktów elektrycz. | heating mat outline; the flat's outline for the zabezpieczenia area                  |

## Reading before deriving

- **Scale.** The bathroom sheets are 1:20 on A3. At 110 dpi, 1 px = 0,4618 cm, checked against the printed 63.
  The electrical plan is 1:40 (0,9236 cm/px). Every bathroom dimension used is printed; the scale only
  cross-checks them.
- **Faces.** Dimensions are from plastered walls. Tile plus adhesive (≈ 1,5 cm) is not deducted.
- **Gładź.** The 60 m² is the client's figure, used as given. The client wants one coat; the szablon has only the
  2-coat Q3 item, so its price stands and the doubt goes into the notes.
- **Wall behind the WC.** The 95,4 back wall is covered by the MDF stelaż zabudowa and a cabinet above it
  (furniture), so it is neither tiled nor painted.

## Measured areas

- **Floor:** 1,456 × 2,555 − cut-out 0,503 × 0,426 − stub 0,43 × 0,103 = **3,46 m²**.
  - Tiles: 3,46 − stelaż box 0,954 × 0,20 = **3,27 m²**.
  - Heating mat: 3,46 − shower 1,456 × 0,766 − stelaż box = **2,16 m²**.
- **Walls (to the ceiling, 2,72; 2,60 under the suspended ceiling over the shower):**
  - Navona 60×120: right wall in the shower 0,766 × 2,60; stub faces 0,43 × 2,60 and 0,43 × 2,72; right wall in
    the niche 1,26 × 2,72; cut-out top 0,502 × 2,72 and exposed side 0,226 × 2,72; left wall 0,803 × 2,60 plus
    1,552 × 2,72 less the door 0,80 × 2,05. Total **14,36 m²**.
  - Tarima 30×90, shower end wall: 1,426 × 2,60 = **3,71 m²**.
  - Glif: the stub end, 2,72 mb (0,28 m²).
- **Tiled total** (folia, fuga): 18,06 + 0,28 + 3,27 = **21,61 m²**.
- **45° edges:** two stub corners and the cut-out corner, two edges each: 2 × (2,60 + 2,72) + 2 × 2,72 = **16,08 mb**.
- **Flat floor (zabezpieczenia):** outline on the electrical plan ≈ 68 m² gross, ≈ **60 m²** net.
