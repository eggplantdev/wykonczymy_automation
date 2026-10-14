# Case 18 (two bathrooms + kitchen hook-ups, flat J, rynek wtórny) — measurement

Inputs:

- `inputs/client-inquiry.md`: the client's mail, as the owner typed it into Notatki. It asks for:
  - the old ~6 m² bathroom from 1997. The client does most of the demolition. We do the hydroizolacja, a
    podtynkowy WC in a GK zabudowa, a new wanna, and gres on the floor and in the bathing part. The rest of the
    room gets gładź, and the client paints it. The grzejnik, mounted the wrong way round, is replaced, and the
    pralka hook-ups are tidied;
  - a new smaller bathroom in today's schowek (wentylacja, drzwiczki rewizyjne, hot/cold pipes):
    - hydroizolacja and gres from floor to ceiling;
    - a podtynkowy WC;
    - a kabina with a natynkowa bateria, priced in two variants (brodzik / odpływ liniowy);
    - a hung szafka with umywalka;
    - an electric grzejnik with its own socket;
    - the light switch moved;
    - 2 micro-walls demolished, and a new wall with a door built at the flat entrance (brodzik 100×80
      behind the door);
  - a through-wall wod-kan hook-up to the new kitchen;
  - new circuits for the płyta, piekarnik, zmywarka, okap and lodówka, plus general sockets; the
    rozdzielnica is above the entrance;
  - 5–6 gres tiles 60×60 on the kitchen wall.
- `3547-…jpg` (production media, not in git): the developer's rzut of flat J. It prints Pu 61,52 m², łaz.
  nr 5 5,83 m² (315 wide), W.C nr 6 1,53 m² (169,5), korytarz 7,56 m² and the kitchen 9,45 m². It prints no
  heights.
- `6405-…jpg`: a screenshot of the client's layout program for „łazienka 1”. It shows 5,84 m², 315, 155, 27 and
  a pralka 87 wide, the wanna along the left short wall, the WC at a stub wall and „3 gniazdka”.
- `6408-…jpg`: a screenshot of the new small bathroom. It prints 90, 169,5, 27 and „?,33 m²” (the first digit
  is hidden), and „2 gniazdka 1 włącznik”. The kitchen run below it has „21 gniazdek 3 włączniki” for the
  whole kitchen/salon room.
- `3545-…jpg`, `3546-…jpg`: the old bathroom. It has green tiles to about 2/3 of the wall height and paint
  above. It also has a wanna in a tiled zabudowa, an umywalka on a szafka, a kompakt WC, a pralka, a
  grzejnik, rewizja doors, a kratka and a lamp.
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #212** (szablon #166).

## Result (netto, szablon #166 prices)

**86 rows (85 matched, 1 added, 8 at qty 0), 39 687,49 zł — the quantified rows only.**

| Sekcja                                 | Amount        |
| -------------------------------------- | ------------- |
| Łazienka mała                          | 15 064,06     |
| Łazienka duża                          | 12 619,50     |
| Prace dodatkowe                        | 3 300,00      |
| Wyburzenia, demontaże, zabezpieczenia  | 3 297,16      |
| Instalacja elektryczna i oświetleniowa | 2 345,00      |
| Ściany i sufity bez łazienek           | 1 704,57      |
| Instalacja wodno-kanalizacyjna + c.o.  | 750,00        |
| Kuchnia                                | 475,20        |
| Podłogi                                | 132,00        |
| **Razem**                              | **39 687,49** |

- The 1 added row is the katalog's gładź rynek wtórny (85 zł/m²), placed in „Łazienka duża”.
- The 8 rows at qty 0:
  - skuwanie, demontaże and demontaż ościeżnic (the client demolishes);
  - the big bathroom's new electrical points;
  - the small bathroom's wyrównanie and zabudowa rur;
  - variant B: the odpływ liniowy and the szyba.

## Reading before deriving

- **Height.** Nothing prints one, so the Manual's rynek-wtórny 2,60 m applies everywhere.
- **Łazienka duża.** 5,83 m² over the 315 cm width gives 1,85 m of depth. The program's ruler (≈402 px/m)
  confirms 3,13 × 1,84 m for the interior; the 27 cm strip left of the wanna is a pion zabudowa outside the
  5,83 m².
  - The wanna measures ≈ 1,78 × 0,77 m on the ruler, taken as 1,80 × 0,75 along the short wall. The bathing
    zone is the wall behind it plus its two sides, 3,35 mb.
  - The mail gives no tile height for the bathing part, so 2,10 m is taken. The tiles run from the rim
    (0,55) up, plus the zabudowa front.
  - The old tiles reach ≈ 1,75 m (2/3 of 2,60, from the photos). That gives szlifowanie po kleju on
    16,10 m² of walls plus the floor, and paint stripping on the 0,35 m band above them in the bathing zone.
  - Gładź covers everything else: walls 26,00 − door 1,64 − bathing zone 3,35 × 2,10 = 17,32 m², plus the
    ceiling 5,83.
- **Łazienka mała.** The program's top ruler marks metres every ≈ 339 px. On that scale the printed „90”
  spans exactly 305 px and „169,5” the room's depth, so the ruler and the labels agree.
  - The interior is 2,02 × 1,70 m with a 0,62 × 0,18 kanał notch, which gives 3,44 − 0,11 = 3,33 m². That
    matches the visible „,33”.
  - The dark 1,03 × 0,78 m block top-left is the 100×80 brodzik behind the door, as the mail describes.
  - The perimeter is 7,79 mb, which gives tiled walls of 7,79 × 2,60 − door 1,64 = 18,61 m².
- **The old W.C nr 6** (1,53 m² = 90 × 169,5) is the WC zone of the new bathroom. The rest is the niche with
  the 2 micro-walls (≈ 6,5 cm, ≈ 1,10 m each on the rzut).
- **New wall.** It runs along the bathroom's side, 169,5 + wall ≈ 1,80 mb × 2,60 minus a door, which gives
  3,03 m². GK with wool is assumed; bloczki is the doubt.
- **Kitchen.** The mail names 5 circuits. The general sockets have no count (the project's 21 sockets cover
  the whole room), so 50703 carries only the 5, and the rest is a doubt.
  - Indukcja is assumed, which means a rozdzielnia przebudowa of at least 18 modules (Manual).
  - Wod-kan: 3 sink points through the wall from the small bathroom.

## DRY fill

`CASE=18-szaserow-dwie-lazienki-kuchnia DRY=1 fill-case-prod.ts` (2026-10-14):

- the kosztorys is empty, so it is seeded from szablon #166;
- 85 rows matched and 1 is new;
- „Łazienka” is renamed to „Łazienka duża”, and „Łazienka mała” is created as a copy;
- **expected AI przedmiar 39 687,49 zł**, equal to the script's total.

Not run without `DRY=1`.
