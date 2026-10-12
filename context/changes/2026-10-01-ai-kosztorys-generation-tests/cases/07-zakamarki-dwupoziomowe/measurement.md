# Case 7 (Zakamarki, dwupoziomowe) — measurement

Inputs:

- `inputs/client-inquiry.md`, the architect's mail. It covers the scope: antresola, GK under the stairs, Kabric
  structural paint at about 130 m² for 100 zł/m², hidden doors, a suspended ceiling with track lighting, and
  large-format tiles in the shower.
- `zakamarki-rys-tech-robocze.pdf` (production media, not in git): 9 pages of working drawings. The plans are
  raster, the text is vector, and **no room dimensions are printed**.
- `wizualizacje-komplet.pdf` plus 4 images: the visualisations.
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #207** (szablon #166).

## Result (netto, szablon #166 prices)

**97 rows, 117 186,83 zł.**

| Sekcja                                 | Amount         |
| -------------------------------------- | -------------- |
| Ściany i sufity bez łazienek           | 44 695,94      |
| Łazienka                               | 27 732,16      |
| Instalacja elektryczna i oświetleniowa | 13 901,00      |
| Wyburzenia, demontaże, zabezpieczenia  | 9 563,13       |
| Podłogi                                | 6 873,00       |
| Prace dodatkowe                        | 3 300,00       |
| Instalacja wodno-kanalizacyjna + c.o.  | 4 290,00       |
| Montaż stolarki i ślusarski            | 4 000,00       |
| Kuchnia                                | 2 831,60       |
| **Razem**                              | **117 186,83** |

## Sheets used

| Page   | Used for                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------- |
| rys. 1 | parter rzut generalny: room layout                                                                             |
| rys. 2 | antresola/piętro rzut generalny                                                                                |
| rys. 3 | parter zmiany budowlane: wod-kan points, radiators, GK on the stelaż, the antresola outline                    |
| rys. 4 | piętro zmiany budowlane: „sufit podwieszany h=15cm”, „ściana do usunięcia”, „nowa ściana projektowana”, pralka |
| rys. 5 | parter elektryka (red = new, yellow = remove or move)                                                          |
| rys. 6 | piętro elektryka, plus the kitchen supply legend                                                               |
| rys. 7 | klatka schodowa: **the only printed dimensions** (161, 339, 288, 336, 27, 312, 266)                            |
| rys. 8 | klatka schodowa views                                                                                          |
| rys. 9 | łazienka rozwinięcia                                                                                           |

## Reading before deriving

- **Scale.** The plans are rendered at 110 dpi. Treads on rys. 4 repeat every 23,0 px, and a tread is 27 cm.
  The antresola measures 291 px against its printed 339, and 138 px against its printed 161. That gives
  1,165 cm/px, and the parter plan (rys. 1/3) uses the same scale: the stair treads sit on the same pixel rows.
- **Height.** Parter: 2,66 m, from przekrój A-A „266”. The łazienka rozwinięcie agrees (≈ 2,7 m). Piętro: no
  height is printed, so the Manual's rynek-wtórny default of 2,60 m applies.
- **Structural paint.** The 130 m² is the client's own figure. It is cross-checked, not derived: the walls
  outside the łazienka and the pokój dziecka come to 125–150 m² gross, before openings.
- **Floor.** The mail says the antresola floor is „jak reszta górnego piętra”. That reads as the rest staying,
  so only the antresola gets panels. This is the biggest open question; the notes give its zł impact.

## Measured areas

- **Parter (inner faces):**
  - łazienka 2,63 × 1,79 = 4,71 m²;
  - pokój dziecka 4,30 × 3,05 = 13,12 m²;
  - sypialnia 4,30 × 3,40 = 14,62 m²;
  - hol 3,03 × 4,66 − shaft 0,82 × 0,77 = 13,49 m².
  - Total: **45,93 m²**.
- **Piętro:**
  - 5,01 × 7,98 gross;
  - minus stair opening 1,32 × 3,39;
  - minus antresola rectangle 1,61 × 3,39;
  - minus chimney 0,55 × 0,79;
  - plus antresola 1,61 × 3,39 − shaft = 4,83.
  - Total: **34,44 m²**.
- **Ceilings outside the łazienka:**
  - existing ceilings 48,36 m²: both bedrooms, the hol slab beside the stairs, and the piętro outside the
    suspended part;
  - GK ceilings 32,70 m²: the salon's suspended ceiling 21,76, the antresola underside 4,83, its front face
    ≈ 2,0, and the stair soffit 1,32 × 3,12.
- **Łazienka walls:**
  - 8,84 mb × 2,66 − door = 21,87 m², tiled to the ceiling (rys. 9);
  - of which wielki format 9,28 m²: the shower's back wall 1,79 plus two 0,85 returns.
- **Electrical:** counted symbol by symbol off rys. 5–6:
  - parter ≈ 8 sockets/switches and 10 light points;
  - piętro ≈ 18 and 8.
  - Track lighting is the outline on rys. 6 (≈ 12 mb) plus the sypialnia L on rys. 5 (≈ 5,2 mb).
