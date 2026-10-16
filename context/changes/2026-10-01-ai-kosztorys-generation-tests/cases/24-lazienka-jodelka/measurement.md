# Case 24 (łazienka z projektu + deska jodełka, 66,78 m², stan deweloperski) — measurement

Inputs:

- `inputs/client-inquiry.md`: the client's mail (no contacts in it). The scope:
  - the whole bathroom, plus moving the bathroom radiator; the przyłącza are hidden in the wall, not moved;
  - deska wielowarstwowa jodełka klasyczna everywhere except the bathroom;
  - gładź on walls and ceilings, „malowanie kolor”;
  - 3 interior doors with ościeżnice regulowane;
  - listwy;
  - kitchen przyłącza hidden in the wall;
  - „prawdopodobnie” 2 ceiling light cables moved, plus lighting;
  - 1–2 new sockets.
- 10 files (production media, not in git), all projekt:
  - the flat's rzut, with room areas printed and the client's handwriting: „WYSOKOŚĆ 280 cm” and salon 641 × 486;
  - the bathroom projekt: rzut, kłady A–D and a render;
  - 3 photos of the raw flat (bathroom, salon, hol).
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #220** (szablon #166).

## Reading the plan

- **Market:** stan deweloperski. The photos show raw floors, developer plaster, wire ends on the ceilings and pipes in front of the walls. So:
  - szlifowanie mleczka everywhere;
  - wkucie wod-kan: 3 zespoły in the bathroom, 1 in the kitchen;
  - 2 big bagi, no demolition.
- **Height:** H = 2,80 m, handwritten on the rzut (it wins over the Manual's 2,68).
- **Rooms**, areas as printed:

  | Room            | Area  | Dimensions used                                                     |
  | --------------- | ----- | ------------------------------------------------------------------- |
  | Salon z aneksem | 31,18 | 6,41 × 4,86 (handwritten; = 31,15), kitchen run along one wall      |
  | Pokój           | 10,78 | 2,35 × 4,58                                                         |
  | Sypialnia       | 14,07 | 3,955 × 3,557                                                       |
  | Hol             | 6,39  | 3,895 × 1,64; open to the salon; entry + 3 interior doors; wardrobe |
  | Łazienka        | 4,36  | projekt 1,97 × 2,405 with a pion 390 × 630 in the corner            |

- **Walls**, recomputed as perimeter × H minus openings:
  - door 0,80 × 2,05, entry 0,90 × 2,05, balcony door 0,90 × 2,20;
  - salon window 1,80 × 1,50, room windows 1,50 × 1,50;
  - hol–salon opening 1,0 m; hol wardrobe 1,2 m;
  - kitchen run 3,60 mb behind the cabinets (Manual). The rzut gives no length for it, so this is flagged.
  - Result: salon 45,55, pokój 34,92, sypialnia 38,18, hol 18,07 = **136,72 m²**.
  - Ceilings = floor of the dry rooms, 62,42 m². Wall–ceiling joints 60,49 mb. Listwy 62,49 × 0,75 = 46,87 mb.
- **Łazienka** (projekt):
  - walls 8,75 mb × 2,80 − door = 22,86 m², tiled to the ceiling on every wall (kłady A–D);
  - ribbed strip behind the umywalka 1,06 × 2,80 = 2,97 m², counted as format standard;
  - the rest is 19,89 m² at 120 × 120. The tile grid on kłady B and C is spaced ≈ 1,2 m both ways, but the projekt prints no format, so this is flagged;
  - floor 4,36 − wanna 1,60 × 0,80 = 3,08 m², format standard. The flat's rzut hatches the bathroom floor in a jodełka, which is flagged;
  - fixtures:
    - wanna 1600 with zabudowa, parawan, natynkowa bateria wanno-prysznicowa;
    - WC podwieszane on a stelaż with a 800 × 1200 zabudowa;
    - umywalka nablatowa on a szafka, with a standing bateria;
    - pralka;
    - drabinka moved (kład C);
    - 2 pendant lamps beside a round LED mirror;
    - the wooden szafki are left to the stolarz;
  - wiercenie 16, szlif 45° 10,7 mb incl. the pion corner 2,80 × 2 (flagged).
- **Counts** from the inquiry:
  - 3 doors: 2 in stolarka + the bathroom door in Łazienka;
  - 2 sockets (upper bound);
  - 2 moved ceiling cables;
  - 5 lamps, assumed one per room plus 2 in the salon;
  - c.o. 2 pkt for the radiator.

## Result (netto, szablon #166 prices)

**67 rows, 60 661,97 zł** (pre-review 60 205,97; see `review.md`).

- 8 rows at qty 0, all deliberately out:
  - kitchen zlew, bateria, syfon, płyta, okap (not in the inquiry);
  - new wod-kan points in the bathroom (the client says nothing moves);
  - szafka podumywalkowa and szafka nad geberitem (stolarz).
- 3 rows added, all szablon rows moved to where they apply, at szablon prices:
  - szlifowanie mleczka → Łazienka;
  - naprawy po bruzdowaniu → Łazienka;
  - wkucie wod-kan → Instalacja wodno-kanalizacyjna + c.o., for the kitchen przyłącza.

| Sekcja                                 | Rows | Amount    |
| -------------------------------------- | ---- | --------- |
| Prace dodatkowe                        | 2    | 2 400,00  |
| Wyburzenia, demontaże, zabezpieczenia  | 4    | 2 229,50  |
| Podłogi                                | 5    | 10 373,47 |
| Ściany i sufity bez łazienek           | 9    | 23 936,08 |
| Kuchnia                                | 4    | 0,00      |
| Instalacja elektryczna i oświetleniowa | 5    | 1 038,00  |
| Montaż stolarki i ślusarski            | 1    | 760,00    |
| Instalacja wodno-kanalizacyjna + c.o.  | 2    | 750,00    |
| Łazienka                               | 35   | 19 174,92 |
