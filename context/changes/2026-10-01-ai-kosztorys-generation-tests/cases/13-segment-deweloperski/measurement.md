# Case 13 (segment deweloperski) — measurement

Inputs:

- `inputs/client-inquiry.md`, the scope the owner typed into Notatki. It is a generic deweloperski list:
  gładzie, glued vinyl in a mijanka on a samopoziom, two łazienki fully finished, about 5 new electrical points,
  interior doors with adjustable frames, and painting. It gives no quantities other than the 5 points.
- Two phone photos of the developer's rzuty, kind projekt (production media, not in git):
  - `image1-2-38ad81c2f471.jpeg` — parter;
  - `image02-ce965365adba.jpeg` — piętro.

  Each shows a two-lokal building (Lokal 1 / Lokal 2, mirror images with identical printed areas). The rzuty
  print room areas and window/door sizes (szer./wys.) and **no room dimensions**. Rotated crops of Lokal 1 are
  in `~/.local/share/wykonczymy-ai-cases/13-segment-deweloperski/render/`.

- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #203** (szablon #166).

## Result (netto, szablon #166 prices)

**54 rows (53 szablon rows + 1 new), 76 268,74 zł.**

| Sekcja                                 | Amount        |
| -------------------------------------- | ------------- |
| Łazienka                               | 29 127,76     |
| Ściany i sufity bez łazienek           | 25 902,23     |
| Podłogi                                | 10 877,50     |
| Instalacja elektryczna i oświetleniowa | 3 291,00      |
| Prace dodatkowe                        | 2 400,00      |
| Wyburzenia, demontaże, zabezpieczenia  | 2 390,25      |
| Montaż stolarki i ślusarski            | 2 280,00      |
| **Razem**                              | **76 268,74** |

The new row is „Sprzątanie i przygotowanie pomieszczeń do odbioru” (kpl, Cena j.m. 0). The Notatki name it, and
neither the szablon nor the katalog has a position for it.

## Sheets used

| Photo  | Used for                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------- |
| parter | room areas, window/door sizes, łazienka fittings (WC, umywalka), stair bay, wiatrołap          |
| piętro | room areas, window/door sizes, łazienka fittings (wanna, WC, umywalka, „P” pralka), stair void |

## Reading before deriving

- **One lokal.** Both lokale carry the same printed areas. The draft prices one; the notes put ×2 first among
  the questions.
- **Scale.** The photos are oblique and of uneven resolution, so each crop's scale was fixed from printed areas
  rather than a dimension: ≈ 150 px/m on the parter crop, ≈ 147 px/m on the piętro crop. Every side below is
  cross-checked against its printed m².
- **Height.** Nothing is printed, so the Manual's stan deweloperski default of 2,68 m applies to both levels.
- **Openings.** On the rzut the outer figure is the height and the inner one the width:
  - tarasowe 200/240, narożne 2 × 150/160, kuchnia 120/150, wejściowe 90/205;
  - piętro: balkonowe 100/220, 2 × 120/150, klatka 120/300;
  - interior doors 80/200; the łazienka windows are 60/120 (parter) and 90/150 (piętro).
- **Floors.** The developer's rzut labels wiatrołap, przedpokój and aneks „terakota”. The Notatki put ceramics
  only in the łazienki and vinyl elsewhere, so vinyl wins. The notes give the gres alternative's zł impact.
- **Łazienki.** Tiled to the ceiling on every wall. The wanna's tiled front stands in for the wall behind it.
  The łazienka ceilings are the only painted surfaces there.

## Measured areas

- **Floors:**
  - parter 37,52 m², of which vinyl 31,07 (wiatrołap 2,51, przedpokój 2,07, aneks 5,71, salon 20,78),
    łazienka 3,97 and schody 2,48;
  - piętro 35,29 m², of which vinyl 28,91 (przedpokój 3,42, gabinet 8,69, pokoje 10,41 + 6,39), łazienka 4,63
    and schody 1,75.
  - Vinyl total 59,98 m²; łazienki 8,60 m².
- **Sides:**
  - parter box 5,65 × 6,93 plus a 0,63 stair bay, wiatrołap 1,73 × 1,63, łazienka 2,10 × 1,89;
  - piętro pokój 2,50 × 4,08, gabinet 2,89 × 2,93, pokój 2,50 × 2,52, przedpokój 1,63 × 2,04,
    łazienka 2,75 × 1,68, stair void 1,87 + 1,84 + 1,87.
- **Walls outside the łazienki:**
  - 35,88 mb (parter) + 45,72 mb (piętro) = 81,60 mb × 2,68;
  - minus openings 38,65 m² = **180,04 m²**;
  - gładź skips the wall behind the kitchen cabinets (4,5 mb × 1,8 = 8,10 m²) → **171,94 m²**.
- **Ceilings outside the łazienki:** 61,73 m², which is the vinyl area plus the piętro stair area. The parter
  stair area sits under the stair void.
- **Łazienka walls:** parter 7,98 mb, piętro 8,86 mb, each × 2,68 minus the door and window. That gives 19,07 +
  20,79 = **39,86 m²**.
- **Skirting:** 71,76 mb, which is the dry wall length without the stair walls, minus 25% for zabudowy → 54 mb.
- **Glify:** 41,40 mb from the printed window sizes, plus 4 outer corners by the stairs × 2,68.
- **Electrical:** no electrical rzut. The 5 new points come from the Notatki, and 34 sockets/switches and
  10 lamps are the agent's estimate per room.
