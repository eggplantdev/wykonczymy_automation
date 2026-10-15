# Case 22 (Marki, 66 m², stan deweloperski) — measurement

Inputs:

- `inputs/client-inquiry.md`: the client's mail (contacts redacted). The flat was handed over by the developer. The wall areas in the zakres come from a floor × 2,5 multiplier and „wymagają potwierdzenia”. The client asks for ceilings to be counted separately. The bathroom wall with the gas boiler gets no tiles, only preparation and paint, because furniture goes there.
- 2 files (production media, not in git), both projekt:
  - the rzut parteru of lokal 1 in a two-lokal terraced house (1:100, room areas printed, no height);
  - the client's zakres prac, an xlsx exported to 2 PDF pages. The page break splits a few rows.
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #219** (szablon #166).

## Reading the plan

- **Market:** rynek pierwotny (the client says the lokal is „odebrany”). So:
  - H = 2,68 m (Manual);
  - szlifowanie mleczka, wkucie wod-kan (4 pkt), demontaż grzejników;
  - 2 big bagi, no skuwanie.
- **Rooms**, areas as printed:

  | Room                  | Area  | Notes                                                            |
  | --------------------- | ----- | ---------------------------------------------------------------- |
  | L1-01 wiatrołap       | 2,72  | 183 × 149 incl. wardrobe 152                                     |
  | L1-02 komunikacja     | 7,43  | 355 × 130 strip open to L1-03, plus a corridor with wardrobe 161 |
  | L1-03 pokój z aneksem | 26,15 | 490 × 470 + aneks 240 × 130; 225 open to L1-02                   |
  | L1-04                 | 13,04 | L 332 × 364 + 118 × 94                                           |
  | L1-06                 | 11,32 | L 374 × 274 + 160 × 76                                           |
  | L1-05 łazienka        | 5,90  | 202 × 300, no window                                             |
  - The hatched wall L1-03/L1-04 is „możliwa do przebudowy”, but no demolition is requested.
  - The cross-hatched stair belongs to lokal 2.

- **Walls**, recomputed as perimeter × H minus openings:
  - window 1,78 × 1,50, door 0,80 × 2,05, terrace door 0,90 × 2,20;
  - kitchen run 4,20 mb behind the cabinets (Manual).
  - Result: L1-03 36,49, L1-04 38,03, L1-06 34,50, komunikacja 14,0 (estimate: only short wall stretches between 4 doors, the wardrobe and the open side) = **123,02 m²**. The client's figure is 144,9.
  - The wiatrołap takes the client's 6,8 m², which matches the rzut. It gets no gładź, per the zakres.
- **Łazienka:**
  - walls 10,04 mb × 2,68 − door = 25,27;
  - boiler wall 2,02 × 2,68 = 5,41, painted;
  - tiled walls 19,85 (the wanna zabudowa ≈ the wall strip it hides);
  - floor tiles 5,90 − wanna 1,28 = 4,62;
  - total tiles 24,47 vs the client's 23.
  - A pralka symbol stands by the boiler wall.
- **Counts** from the zakres: 4 doors, 5 lamps + 1 in the łazienka, lustro z LED, wentylator, wanna z zabudową, parawan, natynkowy zestaw, WC podwieszane, szafka z umywalką, 1 przesunięty punkt.

## Result (netto, szablon #166 prices)

**66 rows, 54 363,06 zł** (pre-review 63 rows, 53 995,08 zł; the reviewer's changes are in `review.md`).

- 6 rows at qty 0: the kitchen (zlew, bateria, syfon, płyta, okap — not in the zakres) and a grzejnik in the łazienka (none on the rzut). Osprzęt is 1 (the moved point); the rest assumed the developer's.
- 3 rows added: szlifowanie mleczka, naprawy po bruzdowaniu and wentylator, szablon rows from other sections moved into Łazienka (Manual), at szablon prices.
- The bathroom door is the szablon's Łazienka row, not the stolarka one (3 doors there).

The DRY fill reports `63 matched + 3 new`, no new sections, Uwagi AI: yes, expected AI przedmiar **54 363,06 zł** — the same as the script.

| Sekcja                                 | Rows | Amount    |
| -------------------------------------- | ---- | --------- |
| Prace dodatkowe                        | 2    | 2 400,00  |
| Wyburzenia, demontaże, zabezpieczenia  | 4    | 2 274,00  |
| Podłogi                                | 8    | 7 437,33  |
| Ściany i sufity bez łazienek           | 10   | 21 581,84 |
| Kuchnia                                | 4    | 0,00      |
| Instalacja elektryczna i oświetleniowa | 4    | 669,00    |
| Montaż stolarki i ślusarski            | 1    | 1 140,00  |
| Instalacja wodno-kanalizacyjna + c.o.  | 1    | 1 000,00  |
| Łazienka                               | 32   | 17 860,89 |
