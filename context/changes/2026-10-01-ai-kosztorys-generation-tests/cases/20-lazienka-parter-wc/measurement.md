# Case 20 (łazienka parter + WC parter) — measurement

Inputs:

- `inputs/client-inquiry.md`: the owner's mail with the client's answers. Each bathroom goes in its own
  sekcja. The umywalki are plain wall-hung, not tiled. The Viega linear drain is in place but not
  poured, so the contractor sets its height. There is no biały montaż. Laminam on the szafki above
  the WC (glued onto płyta meblowa) is wanted if possible, otherwise the stolarz does it.
- 18 files (production media, not in git):
  - Designer vector set, 1:25: łazienka rzut + widoki 1–4, WC rzut + widoki 1i2 and 3i4.
  - Two łazienka renders and two WC renders.
  - Six phone photos of the stan deweloperski (łaz1–3, wc1–3).
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #214**
(szablon #166).

## Result (netto, szablon #166 prices)

**68 rows, 57 573,24 zł.**

- 52 rows have qty > 0, and 16 are at qty 0. The qty-0 rows carry the deliberate exclusions:
  - biały montaż (client);
  - stelaże already mounted, and the WC zabudowa and ceiling frame already built by another crew;
  - doors;
  - szafki and the stone blat (stolarz);
  - the shower niche (render only).
- 3 rows are added:
  - „Szlifowanie mleczka z tynków deweloperskich” (7 zł/m², a szablon row from „Ściany i sufity”),
    placed in each bathroom sekcja per the Manual;
  - Laminam on the szafki fronts above the WC, at 0 zł because it is not in the katalog.

The DRY fill reports:

- `65 matched + 3 new`;
- „Łazienka” → „Łazienka parter”, plus a copy „WC parter”;
- expected AI przedmiar **57 573,24 zł**, which is the same as the script's total.

| Sekcja                                | Amount        |
| ------------------------------------- | ------------- |
| Łazienka parter                       | 38 516,73     |
| WC parter                             | 15 854,01     |
| Prace dodatkowe                       | 2 400,00      |
| Wyburzenia, demontaże, zabezpieczenia | 802,50        |
| **Razem**                             | **57 573,24** |

## Reading before deriving

- **Two sekcje, never summed.** Both names start with „Łazienka”/„WC”, so the fill copies the szablon's
  bathroom block for each.
- **What the photos say is already done:**
  - Łazienka: walls are plastered and the floor is screeded. The WC and bidet stelaże stand, the riser
    is chased in, water outlets exist, and the cables are pulled with temporary bulbs.
  - WC: the stelaż is already boxed in green GK by another crew, including the niche for the szafki,
    and the suspended-ceiling frame is up.
  - So geberit, bidet and WC zabudowa/ceiling are qty 0, and wod-kan is only the extensions to the
    podtynkowe heights: łazienka 4 pkt, WC 1 pkt (the WC photo shows the outlets low, for a standard
    basin, while the drawing has the tap on the wall at h = 105).
- **No biały montaż** (client). The podtynkowe bodies are kept: one shower with a rain head, two
  umywalkowe in the łazienka and one wall tap in the WC. They go in before the tiles; only their
  finishing sets are biały montaż.
- **Linear drain:** the Viega body is on the floor, unpoured → „odpływ jednospadkowy” (setting level
  and fall).
- **Tiles, łazienka** (widoki):
  - Height: tiles run to the suspended ceiling at 3,24 (structure 3,70, ceiling band 0,46).
  - Wielki format: Laminam Bruno behind the WC/bidet, Laminam on widok 1, Stromboli 162 × 324 on the
    door wall, the shower side wall and the window wall.
  - Bands 60 × 120 → standard.
  - No tiles behind the two mirror strips (0,60 × 3,24 each).
  - The umywalki are plain wall-hung, so the umywalka wall has no cladding.
  - Floor: Stromboli 120 × 120 → „duży format 120x120”.
- **Tiles, WC:** Laminam Nero/Bruno 1620 × 3240 on every wall to 2,70 → wielki format. The zabudowa
  face is tiled only up to 1,20; the three szafki fronts above it are the client's optional Laminam
  item. The WC floor tile is not specified, so the light floor in the renders is read as the same
  120 × 120.
- **Mata kompensacyjna** under all wielki-format wall area (katalog; case 07 precedent).
- **Mleczko:** the Manual says developer plaster is always ground before further work, and
  bathroom work goes to the bathroom sekcja. It covers the tiled wall area minus GK faces; ceilings
  are suspended, so none there.
- **Electrical:** the cables are already pulled, so only new feeds are counted:
  - Łazienka: LED in the ledge, the vertical LED joint, and the mirror feeds — 3 punkty.
  - WC: the LED cove over the szafki and the double socket at the blat.
  - Bruzdy: 2,5 mb per point (katalog).
  - Fixtures: łazienka ~6 downlights from the renders; WC a track with a spot.
- **Shared sekcje:**
  - Transport: 1 kpl (szablon 1500 zł; the katalog says ~700 zł for a rynek pierwotny bathroom).
  - Gruz: 2 big bagi total (rynek pierwotny, no demolition).
  - Zabezpieczenia: 10 m², mostly the window plus the entry path. Per the katalog, a deweloperka
    bathroom protects little beyond the windows.

## Measured areas

**Łazienka parter** (rzut scale 1,858 px/cm)

- Room:
  - Footprint: 2,40 × 2,93 + 1,47 × 1,17 (shower extension) = 8,75 m².
  - Floor tiles: 8,39 m², net of the 0,20 × 1,80 ledge.
  - Perimeter 13,60, H 3,24.
- Walls:
  - Gross: 44,06 m².
  - Openings: door 0,98 × 2,57 = 2,52; full-height window 0,85 × 3,24 = 2,75; mirrors 2 × 0,60 × 3,24
    = 3,89.
  - Tiled: 34,90 m², of which wielki format 22,36 and standard 12,54.
- Ledge over the WC + bidet: 1,80 × 1,17 high × 0,20 deep, with LED.
- Glify, wielki format: ledge 2,97 mb + window reveals 7,33 mb = 10,30 mb.
- Szlif 45°: outside corner 3,24 × 2 + ledge edges 2,97 = 9,45 mb. The window reveal corners are not
  counted.
- Otwory: 23 (WC 5, bidet 4, shower 3, rain head 1, 2 × umywalka 3, grzejnik 2, puszki 2).

**WC parter**

- Room: 2,45 wide (2,02 + 0,43 zabudowa) × 1,43, plus the umywalka niche 0,98 × 0,40. Height 2,70.
- Floor: 2,02 × 1,43 + 0,98 × 0,40 = 3,28 m². Ceiling incl. zabudowa: 3,90 m².
- Tiled walls, 16,34 m² in all:
  - door wall 1,83 × 2,70 − door 0,92 × 2,50 = 2,64;
  - niche back 2,65;
  - niche side 1,08;
  - wall behind the blat 2,81;
  - zabudowa face 1,43 × 1,20 = 1,72;
  - opposite wall 5,45.
- Szafki fronts: 1,43 × 1,48 = 2,12 m².
- Akryl: 7,70 mb.
- Szlif 45°: the niche corner, 2,70 × 2.
- Otwory: 10.
