# Case 17 (kawalerka 29 m², stan deweloperski, ściana GK) — measurement

Inputs:

- `inputs/client-inquiry.md`, the client's mail in Notatki:
  - stan deweloperski with tynki, parter with access through the ogródek, height „przyjmujemy 2,7m”;
  - „Instalacja oświetlenia, gniazdek i włączników po mojej stronie”;
  - łazienka: WC on a stelaż, umywalka with an integrated szafka, brodzik 120 × 80 with drzwi in the wnęka, armatura
    natynkowa, swap pralka ↔ umywalka, folia w płynie, 60 × 60 tiles, 45° at the WC and between the prysznic and
    the pralka, painted walls;
  - hol and pokój: gładź + malowanie (not the 2 m wall behind the wardrobe, not the 356 cm kitchen wall), panele
    laminowane 10 mm with listwy;
  - a new GK wall 1,6 × 2,7 × 0,1 and a ready-made ażurowa wall the client buys;
  - electrics in the pokój: light a,b moved, switches a,b,c,s moved, two double sockets on the new wall, lights
    g, h and krzyżowe switches g, h added.
- Three developer sheets for lokal 75 (production media, not in git): the karta branżowa (dimensions, electrical
  and water symbols), its legend, and the karta informacyjna (hol 3,63, pokój z aneksem 20,56, łazienka 4,90 m²).
  The client's own plan with the new walls in orange and brown was **not** among the files.
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #209** (szablon #166).

## Result (netto, szablon #166 prices)

**52 rows (51 matched, 1 added at 0 zł, 0 at qty 0), 32 757,67 zł.** The DRY fill reports the same total.

| Sekcja                                 | Amount        |
| -------------------------------------- | ------------- |
| Łazienka                               | 15 354,22     |
| Ściany i sufity bez łazienek           | 9 364,84      |
| Prace dodatkowe                        | 2 400,00      |
| Podłogi                                | 2 361,36      |
| Wyburzenia, demontaże, zabezpieczenia  | 1 687,25      |
| Instalacja elektryczna i oświetleniowa | 1 340,00      |
| Instalacja wodno-kanalizacyjna + c.o.  | 250,00        |
| **Razem**                              | **32 757,67** |

The added row is the ażurowa wall: nothing in the szablon or the katalog fits, so it carries no price.

## Reading before deriving

- **Dimensions.** The karta branżowa prints them „w świetle ścian nie uwzględniając 1,5 cm tynku”; the areas are
  printed after tynk. Wall m² from the dimensions are therefore 1–2 % high.
- **Height.** No sheet prints one. The client's 2,70 m is used over the Manual's 2,68 m.
- **Łazienka.** Main part 187,5 × 212, then the wnęka 123,5 × 80 below it, beside the 64 × 80 shaft step.
  Perimeter 9,59 mb. The right wall carries the WC (geberit), the pralka „P” and the umywalka. A grzejnik
  łazienkowy hangs on the left wall and the bathroom ventilation pion sits at the WC.
- **Hol.** 206,5 wide from the yellow divider to the entrance wall, 61,5 (wardrobe zone) + 122,5 deep. The
  wardrobe's back wall is the „ściana z szafą 2m”.
- **Pokój.** 437 × 424,5, plus the kitchen strip 356,5 × 61,5 with the pion box 61,5 × 61,5 in the corner.
  Window 105 × 223 (hp 20), balkon door 200 × 253. A grzejnik symbol stands at the bottom wall beside the balkon door.
- **Developer notes.** Water and drains are „zakończona korkami, nie schowana w ścianach”, and GK podejścia are
  „do wykonania przez Nabywcę”. So wkucie zespołów applies.
- **New walls.** Their position is unknown, so they move no other figure. One exception is the GK wall: it adds
  its two faces to gładź and paint, and its free end gets aluminium corners.

## Measured areas

- **Łazienka:**
  - walls 9,59 × 2,70 − door 0,80 × 2,00 = 24,29 m²;
  - wall tiles 14,32 m²:
    - wnęka to the ceiling 7,65;
    - shaft step face 1,73;
    - strip at the umywalka 0,80 × 2,70 = 2,16;
    - rest of the right wall 1,32 × 1,80 = 2,38;
    - stelaż box 0,40;
  - painted 10,37 m²: left wall 5,72, wall to the hol 3,46, right wall above the band 1,19;
  - floor tiles 4,90 − brodzik 0,96 = 3,94; fugowanie 18,26; folia 19,22 (tiled walls + floor);
  - 45° 9,00 mb: the step corner 2,70 × 2, plus the stelaż top 0,60 × 2 and side 1,20 × 2;
  - akryl 6,08 mb; otwory 16.
- **Hol + pokój walls:**
  - 16,165 mb: window wall 4,245, pion box 1,23, divider end 0,10, entrance wall 1,225, bathroom walls
    1,975 + 3,02, balkon wall 4,37;
  - 16,165 × 2,70 − openings 10,80 = 32,84 m²;
  - plus the GK wall both faces 8,64 = **41,48 m²** of gładź;
  - ceilings 24,19 m²;
  - grunt, farba podkładowa and malowanie on 65,67 m²;
  - mleczko 57,03 m² (developer tynk only).
- **Floors:** panele 24,19 − kitchen strip 2,19 = 22,00 m². Listwy 15,76 mb: the perimeter without kitchen,
  wardrobe and door openings, plus the GK wall.
- **GK wall:** 4,32 m²; taśma 14,00 mb (junctions on both sides plus one board joint per face); narożniki 5,40 mb.
- **Electrics:**
  - 3 punkty świetlne;
  - 8 gniazd/łączników: 2 moved switch boxes, 2 double sockets as 4, 2 new switches;
  - the pralka socket in the łazienka;
  - bruzdy 2 mb × 12 = 24 mb, the same again for tynkowanie bruzd.
