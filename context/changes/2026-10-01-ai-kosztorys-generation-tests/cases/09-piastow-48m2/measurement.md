# Case 9 (Piastów, 48 m²) — measurement

Inputs:

- `inputs/client-inquiry.md`, the client's mail: a partial remodel of a 48 m² flat on the 1st floor without a
  lift (2001, brick). Demolish a ścianka kuchnia–salon; a shower tray and cabin in place of the bath, the rest
  of the łazienka untouched; new floors and painting everywhere else; a new kitchen with induction; electrical
  changes; window and balcony-door replacement.
- One photo of the original rzut (production media, not in git): printed m² per room and **inner dimensions
  handwritten on it**. Five photos of the current state: łazienka, sypialnia, salon, kuchnia, and the salon
  looking into the kitchen zone.
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #199** (szablon #166).

## Result (netto, szablon #166 prices)

**58 rows, 38 500,59 zł**, of which 2 were added from the katalog prac: „Montaż blatu kuchennego laminowanego”
(3,8 mb at 200 zł) and „Montaż i skręcanie mebli” (1 kpl at 0 zł, an individual price).

| Sekcja                                 | Amount        |
| -------------------------------------- | ------------- |
| Ściany i sufity bez łazienek           | 10 232,49     |
| Instalacja elektryczna i oświetleniowa | 6 375,00      |
| Wyburzenia, demontaże, zabezpieczenia  | 5 491,65      |
| Podłogi                                | 5 477,45      |
| Łazienka                               | 3 560,00      |
| Prace dodatkowe                        | 3 000,00      |
| Kuchnia                                | 2 740,00      |
| Montaż stolarki i ślusarski            | 874,00        |
| Instalacja wodno-kanalizacyjna + c.o.  | 750,00        |
| **Razem**                              | **38 500,59** |

## Reading before deriving

- **Dimensions.** The handwritten inner dimensions are used, with the printed m² as a cross-check. They add up
  to 47,95 m² against the mail's 48 m² and the printed 49,4 m².
- **Height.** None is printed. The stairs give the storey: 2 × 9 risers × 15,6 cm = 2,81 m. Minus a slab and
  floor layers, that is ≈ 2,55–2,60 m clear, so the Manual's rynek-wtórny 2,60 m applies.
- **Kitchen zone.** The printed „Kuchnia 10,6” carries a hand-drawn dashed line, with „pokój” next to it. The
  photo from the salon shows the salon already open to the kitchen zone. The zone is split by a ścianka that ends
  in a pillar: a pink room on the north side, and the kitchen with the window on the south side. The ścianka
  „kuchnia–salon” in the mail is read as that one, 2,28 mb. It is not on the 2001 rzut, so it is taken as a
  soft material up to 12 cm. This is the biggest reading in the draft, and the notes ask about it.
- **Windows.** The mail's „okno i drzwi balkonowe” is the salon's 270 opening: two sashes plus a door, as in the
  photo. Together with the sypialnia window, that makes two openings. The kitchen window stays. The window firm
  installs the windows (no szablon or katalog position exists), so the draft prices only glify, parapety and
  the corners.
- **Floors.** The photos show laminate everywhere except the kitchen, which is tiled. The rzut prints „mozaika”
  under the rooms, which is probably still under the panels; that is in the notes.
- **Łazienka.** The mail limits the work to the shower. The tub is natynkowa, with tiles down to the tub rim.
  The strip below the rim and the floor outside the tray are re-tiled: ≈ 1,5 + 0,5 m².

## Measured areas

- **Rooms:**
  - sypialnia 3,77 × 2,78 = 10,48 m²;
  - łazienka 2,41 × 1,78 = 4,29 m²;
  - przedpokój 3,31 × 1,84 = 6,09 m²;
  - salon 3,86 × 4,39 − 0,34 × 0,35 − 0,45 × 0,75 = 16,49 m²;
  - kitchen zone: 2,28 × 2,53 − vent 0,59 × 0,25 = 5,62, plus 2,26 × 2,08 = 4,70, plus the ścianka strip
    2,28 × 0,12 = 0,27 m².
  - Outside the łazienka: **43,66 m²**. Whole flat: **47,95 m²**.
- **Walls outside the łazienka:**
  - room perimeters 53,92 mb, minus the open salon–kitchen side on both faces (2 × 3,86), gives 46,20 mb;
  - × 2,60 m, minus windows and doors 22,51 m², gives **97,62 m²**;
  - with ceilings, the painted area is **141,27 m²**.
- **Glify:** sypialnia 4,8 mb, plus the salon's window with balcony door 7,1 mb, gives 11,9 mb. Sills: 3,8 mb.
- **Skirting:** 53,92 mb − 30% = 38 mb new. The old skirting, in the rooms with panels, is 35 mb.
- **Electrical:** the mail names no points. The estimate is 12 sockets (kitchen 8, RTV 2, new 2) and 4 light
  points, with 2 mb of bruzdy per point (katalog). There are 35 pieces of osprzęt to mount after painting.
