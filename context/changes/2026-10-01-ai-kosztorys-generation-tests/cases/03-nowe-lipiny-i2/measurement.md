# Case 3 (I2 Nowe Lipiny) — measurement

Inputs:

- `inputs/rzut.png`: the developer plan, a raster scan with printed m² and the main dimensions;
- `inputs/photos/`: visualisations and inspiration photos;
- `inputs/client-inquiry.md`;
- `inputs/rozpiska-183.tsv`;
- the developer standard (docx), summarised below.

Script: `scripts/build_draft.py`, which writes `measure/ai-draft-load.json` and prints the totals and intermediate figures.
Loaded into local investment **#183**:

- two sekcje were added first with `scripts/prepare-case-local.ts`: „Poddasze (osobna wycena)” and „Rekuperacja (osobna wycena)”;
- the draft was loaded with `src/scripts/load-ai-draft.ts`;
- `investment-notes-appendix.txt` was appended to the investment notes.

On production #183 the kosztorys came from szablon #166, where big bag costs 450 zł, not 600 zł.
That makes the house 120 044,76 and the total 163 759,56; the appendix carries these production
figures. The §5 figures below are local.

## 1. Input class

This is a **new build handed over in stan deweloperski**. It differs from cases 1–2:

- nothing gets demolished;
- the scope is pure finishing, plus two blocks the client wants priced **separately** (poddasze, rekuperacja).

The plan is a scan with **printed room m²** (Pu1 52,19 + Pu2 49,02 = 101,21; strych 32,38) and a few
printed dimensions. Procedure rule 1 applies: printed numbers win, so floor and ceiling areas are read, not
measured. The plan does not give perimeters, so they are derived from area ÷ printed side length.

The visualisations are inspiration (the client says so). They are used **only to count elements**:

- wnęki LED, lustra LED, wpusty;
- oprawy przy schodach;
- tapeta in the WC;
- taśma LED pod skosami.

They are never used for dimensions.

**Developer standard (docx):**

- ceramic brick walls, tynki cem-wap or gipsowe (not decided — the biggest open question, ≈ 18 300 zł of gładź);
- water underfloor heating on parter + piętro;
- gas boiler;
- the house is prepared for rekuperacja;
- media brought up to the strych;
- 3-phase 7 kW supply.

## 2. Geometry

| Parameter                | Value                                                   | Status                                                   |
| ------------------------ | ------------------------------------------------------- | -------------------------------------------------------- |
| Clear height H           | 2,75 m                                                  | assumed from rzędne ±0,00 / +3,15 / +6,20; ±860 zł/10 cm |
| Interior door            | 0,90 × 2,05                                             | assumed                                                  |
| Entrance door            | 1,00 × 2,10                                             | assumed                                                  |
| Windows                  | O1 180×150, OB-1P 270×230, 2× O2 150×160, 2× OB4 90×230 | widths read, heights assumed                             |
| Kitchen run (no gładź)   | 4,0 mb incl. tall units                                 | assumed — no kitchen layout on the plan                  |
| Stair shaft walls        | 15 m²                                                   | assumed                                                  |
| Poddasze floor           | ≈ 59 m² (obrys 5,70 × 11,37 − stair box)                | assumed — see §4                                         |
| Poddasze skosy / szczyty | ≈ 72 / 32 m² (pitch 35°)                                | assumed — no section drawing                             |

## 3. Rooms

| Room                 | Area m² (read) | Perimeter m | How the perimeter was derived                     |
| -------------------- | -------------- | ----------- | ------------------------------------------------- |
| Salon z kuchnią      | 46,70          | 31,0        | assumed — L-shape ~5,70 × 8,9 with the stair edge |
| Sień                 | 3,64           | 7,66        | 2,08 × 1,75 (printed)                             |
| WC                   | 1,85           | 5,66        | 1,03 × 1,80 (printed)                             |
| Pokój                | 18,98          | 17,70       | printed side 3,65 → 5,20                          |
| Garderoba            | 9,88           | 12,96       | printed side 4,02 → 2,46                          |
| Pom. hobby           | 10,29          | 13,16       | printed side 4,02 → 2,56                          |
| Hall                 | 4,33           | 8,34        | printed side 2,20 → 1,97                          |
| Łazienka             | 5,54           | 9,62        | 1,85 × 2,96 (printed)                             |
| **Without łazienki** | **93,82**      | **90,81**   |                                                   |
| **Floors total**     | **101,21**     |             | = Pu1 + Pu2 exactly                               |

Derived quantities, all printed by the script:

- net walls without łazienki: 211,33 m² (gross 249,7 − openings 38,4);
- gładź walls 223,1 m²: net + klatka 15 − kitchen 11,0 + WC under tapeta 7,8;
- łazienka walls 24,6 m², in mikrocement;
- akryl 156,8 mb;
- narożniki/glify 49,0 mb;
- listwy 64,8 mb.

## 4. Where the inputs ran out

- **Strych.** The printed 32,38 m² does not match its own outline (5,70 × ~11,4 ≈ 65 m²). Most likely it is the
  height-weighted usable area (h < 2,20 counted at 50 %), so the finishing area was taken from the outline.
  The dashed „h=180 cm” lines cannot be resolved into a knee-wall height without a section drawing. The whole
  poddasze block is therefore an order of magnitude, flagged in the notes, and its own sekcja keeps it out of
  the house total.
- **Rekuperacja.** The katalog has a single entry, „Montaż wentylacji” 120 zł/mb. The duct length (100 mb) is
  a rule-of-thumb estimate: 10 anemostaty × ~8 mb + czerpnia/wyrzutnia. What the developer actually prepared
  decides the real number.
- **Mikrocement.** Floors are in the katalog („Posadzki z mikrocementu sama robocizna” 500 zł/m²). Walls are
  not, so the łazienka walls are a 0 zł row.
- **Stairs.** Nothing in the katalog covers cladding concrete steps with wood, or a balustrada.

## 5. Result (netto, rozpiska prices)

| Block                       | Amount         | Unpriced rows |
| --------------------------- | -------------- | ------------- |
| Dom (parter + piętro)       | 120 344,76     | 3             |
| Poddasze (osobna wycena)    | 27 634,80      | 3             |
| Rekuperacja (osobna wycena) | 16 080,00      | 1             |
| **Razem**                   | **164 059,56** | 7             |

Drivers of the house total:

- Podłogi 53 521, almost all of it mikrocement (50 605);
- ściany i sufity 35 187;
- łazienki 13 970.

The client's own comparison (winyl + gres in the wet rooms) is **−43 646 zł**. That makes it the largest
figure in the offer and the first thing the owner should discuss with the client.

DB check: per-sekcja sums of AI przedmiar × Cena j.m. on #183 equal the script's totals to the grosz.
The loader matched 60 rows and added 34; no row was skipped for a missing sekcja.
