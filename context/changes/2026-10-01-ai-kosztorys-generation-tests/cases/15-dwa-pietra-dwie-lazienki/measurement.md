# Case 15 (dwa piętra, dwie łazienki) — measurement

Inputs:

- `inputs/client-inquiry.md`: the scope the owner typed into Notatki. It lists about 20 m² of GK walls, about
  20 electrical and lighting points, herringbone vinyl on both levels with self-levelling screed, painting
  only („gładzie są”), skirting with acrylic, acrylic in the corners, two bathrooms with two showers on linear
  drains, tiled shelves, concealed mixers, Geberit frames, standard tiles 30×30–60×120, white fit-out, a tiled
  flush button, an RTV wall with a glued panel and LED, hidden doors and sztukateria. Stretched ceilings are
  „raczej do wyceny u sprzedawcy”.
- One file (production media, not in git): a phone photo, upside down, of a developer's sales plan „2/2”.
  It shows both levels with furniture drawn in and **areas printed for most rooms, but no dimensions and no
  height**.
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #205** (szablon #166).

## Result (netto, szablon #166 prices)

**59 rows, 85 789,86 zł.** 58 rows match the szablon, 2 of them at qty 0 (sztukateria: montaż and
malowanie, length unknown). 1 row is added from the katalog: #756 „Montaż paneli ściennych, lamele, dekory
itp”, for the RTV wall.

| Sekcja                                 | Amount        |
| -------------------------------------- | ------------- |
| Łazienka                               | 34 431,86     |
| Ściany i sufity bez łazienek           | 19 741,15     |
| Podłogi                                | 15 121,60     |
| Instalacja elektryczna i oświetleniowa | 5 815,00      |
| Montaż stolarki i ślusarski            | 5 000,00      |
| Wyburzenia, demontaże, zabezpieczenia  | 3 280,25      |
| Prace dodatkowe                        | 2 400,00      |
| **Razem**                              | **85 789,86** |

## Reading before deriving

- **Stan.** The plan is a developer's sales sheet. The scope says „gładzie są”, asks for screed under the
  vinyl and new Geberit frames, and mentions no demolition. So the flat is taken as **stan deweloperski**:
  no demolition, no full gładź on the existing walls, 2 big bags (Manual), and the Manual height of 2,68 m.
- **Printed areas.** Lower level: salon z aneksem 25,5 and sypialnia 7,5, plus a balkon (7,1) outside.
  Upper level: sypialnie 15,2 and 13,8 and łazienka 4,2, plus a taras (7,3) outside. The two hols and the WC
  carry no figure.
- **Scale, upper level.** The two bedrooms measure 267 × 350 px and 242 × 350 px. Against their printed
  areas that gives 6 148 and 6 138 px²/m², which agree to 0,2%. So the upper level is 78,4 px/m.
- **Scale, lower level.** The photo is taken at an angle, so the lower level has its own scale. Salon plus
  sypialnia is 33,0 m² printed against 248 315 px², which gives 86,7 px/m. The sypialnia alone would give
  82,7, so the lower-level unlabelled areas carry about ±10%.
- **Dolne „WC”.** The plan draws a WC (toilet and washbasin) of about 0,92 × 2,19 m. The scope wants two
  bathrooms with two showers, so the draft treats the WC as the second bathroom with a shower, and the notes
  say this needs confirming.
- **Ceilings.** Stretched ceilings go to the seller, so no ceiling work is priced. That includes the
  bathrooms and the wall-ceiling acrylic. The notes give the zł impact.

## Measured areas

- **Lower level:**
  - hol 2,40 × 1,90 plus the passage to the salon 1,27 × 0,40 = 5,07 m²;
  - WC 0,92 × 2,19 = 2,01 m²;
  - salon L-shape 6,90 × 4,38 (bounding box, used for the perimeter only);
  - sypialnia 2,30 × 3,26, fitted to the printed 7,5.
- **Upper level:**
  - hol 2,23 × 2,30 = 5,13 m²;
  - sypialnie 3,41 × 4,46 and 3,09 × 4,46;
  - łazienka 1,90 × 2,21, fitted to the printed 4,2;
  - stair enclosure 2,36 × 1,91.
- **Floor:** 78,41 m². Of that, vinyl covers 72,20 m² (every room but the bathrooms) and the bathrooms
  6,21 m².
- **Walls to paint:** 235,15 m², made up of:
  - the perimeter without bathrooms, 82,18 mb, minus the upper hol's open side to the stairs (2,23), × 2,68;
  - plus the stair enclosure on both levels, 22,89 m²;
  - minus 4 balcony/terrace doors and the small bedroom's window (14,99), 11 door faces (20,29), and the
    wall behind the kitchen cabinets (6,72);
  - that gives 195,15 m² of existing walls, plus 40 m² for the two faces of the new GK walls.
- **Skirting:** 82,18 mb × 0,7 = 57,5 mb.
- **Bathroom walls,** tiled to the ceiling: 20,39 m² upstairs and 15,03 m² downstairs (perimeter × 2,68
  minus the door), so 35,42 m². With the floors, 41,63 m² of tiles.
- **Electrical:** the scope's 20 points, split 10 sockets/switches and 10 light points. Fittings (45) and
  lamps (12) are the agent's estimate per room; the plan has no electrical layer.
