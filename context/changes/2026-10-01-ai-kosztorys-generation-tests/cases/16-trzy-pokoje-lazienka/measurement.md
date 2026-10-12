# Case 16 (trzy pokoje + łazienka, poddasze) — measurement

Inputs:

- `inputs/client-inquiry.md`, the scope the owner typed into Notatki:
  - 10 cm of wool + foil + GK on a cross-frame suspended ceiling, at about 300 zł/m²;
  - divide the attic into 3 rooms plus a small wardrobe;
  - a ~4 m² bathroom „kopia” with standard tiles (media already brought up);
  - gładzie, painting, all electrics at about 30 points;
  - floors, door frames and doors are done by an outside company.
- `4401-ee437c8fcbb3.jpg` (production media, not in git): a phone photo of the PODDASZE rzut. It prints areas
  only — pom. 29 66,20 m² pow. podłogi, pom. 30 5,78 m², razem 71,98 m², stairs 16 × 18/25 — and **no
  dimensions**.
- `344-5bfaa9af0ec6.jpg` (production media): one photo of the attic interior. It shows the knee wall, the rafters
  with old wool between them, a row of posts, two roof windows on one slope and a concrete floor.
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #206** (szablon #166).

## Result (netto, szablon #166 prices; the suspended ceiling at the Notatki's 300 zł/m²)

**46 rows (44 matched, 2 added, 0 at qty 0), 86 643,41 zł.**

| Sekcja                                 | Amount        |
| -------------------------------------- | ------------- |
| Ściany i sufity bez łazienek           | 64 351,31     |
| Łazienka                               | 12 690,60     |
| Instalacja elektryczna i oświetleniowa | 4 902,00      |
| Prace dodatkowe                        | 2 400,00      |
| Wyburzenia, demontaże, zabezpieczenia  | 2 299,50      |
| **Razem**                              | **86 643,41** |

The suspended ceiling alone is 27 249,00 zł (31 % of the total).

## Reading before deriving

- **Scale.** The rzut photo is rotated and slightly skewed. Its inner outline measures 867 × 1017 px. Pom. 30
  (5,78 m²) gives 0,920 cm/px and pom. 29 (66,20 m²) gives 0,943 cm/px. The mean, 0,932 cm/px, puts the attic
  at **8,08 × 9,48 m = 76,59 m²** in plan. Cross-check: the printed 71,98 m² plus the stair opening
  (1,79 × 2,47 ≈ 4,4) plus inner walls ≈ 77.
- **Roof shape.** The top side is a gable against the neighbour (semi-detached). The bottom end is hipped, and
  the slopes run down the two long sides. Posts stand in two rows about 2,47 m in from the side walls.
- **Section.** No section exists. From the photo, the knee wall is ≈ 1,10 m against a ~0,85 m beach chair and
  the pitch is ≈ 45°. The printed pow. użytkowa (15,02 m² lost under 1,9 m) is consistent with 45–50°. The
  flat ceiling height is unknown, so the Manual's rynek-wtórny 2,60 m applies.
- **Roof windows.** The photo shows 2 on one slope; the rzut marks only a „wyłaz dachowy”. Glify are counted for 2.
- **Layout.** Nothing shows where the 3 rooms go. The agent places a corridor along the ridge from the stair
  landing, two rooms on one side and one room plus the bathroom on the other. The existing pom. 30 (with its own
  door) is read as the „mała garderoba”.

## Measured areas

- **Suspended ceiling** (GK on a cross frame + 10 cm wool + foil):
  - slope band depth b = (2,60 − 1,10) / tan 45° = 1,50 m from each long wall;
  - flat part (8,08 − 2 × 1,50) × (9,48 − 1,50) = 40,53 m²;
  - slopes 36,06 m² in plan = 51,00 m² along the slope;
  - minus two chimneys 0,69 m²;
  - **90,83 m²**, the bathroom, garderoba and stair opening included. At 2,40 m or 50° it comes to 89–93 m².
- **GK partitions** (double board with wool, wysoki stopień):
  - 20 mb = corridor walls 11 + two room dividers 5 + bathroom 4;
  - corridor and bathroom walls at 2,60 m; dividers run up the slope, average 2,15 m;
  - minus 4 doorways 0,90 × 2,05;
  - **42,37 m²**.
- **Walls for gładź and paint:**
  - new GK both faces 84,74;
  - knee walls (2 × 9,48 + 8,08) × 1,10 = 29,74;
  - gable trapezoid 18,76;
  - pom. 30's three walls, both faces, 7,50 mb × 2,60 × 2 − two doors = 35,81;
  - minus bathroom tiles 19,16;
  - **149,89 m²**. Ceilings outside the bathroom 86,83 m². Grunt, farba podkładowa and malowanie on **236,73 m²**.
- **Bathroom** 2,0 × 2,0 × 2,60:
  - walls 8 mb × 2,60 − door 0,80 × 2,05 = 19,16 m², tiled to the ceiling;
  - floor 4,00 − brodzik 0,64 = 3,36 m².
- **Linear runs:**
  - akryl wall/ceiling 71,37 mb;
  - taśma in GK breaks 26,23 mb (two slope/flat lines and the hip corners) + 14,40 mb of new-wall joints;
  - glify 2 × 3,92 mb.
- **Electrics** (30 points from the Notatki): 20 gniazd/łączników + 10 punktów świetlnych. Bruzdy only for the
  ~10 points in masonry, at 2 mb each.
