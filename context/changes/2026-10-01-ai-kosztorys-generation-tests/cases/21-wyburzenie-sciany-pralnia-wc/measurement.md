# Case 21 (wyburzenie ściany, pralnia, łazienka z toalety) — measurement

Inputs:

- `inputs/client-inquiry.md`: the owner's mail. The pralnia (not in the renders) gets only floor tiles
  and lighting. The wall between the salon and pokój 3 is demolished, a radiator moves, and the toilet
  changes size and function.
- 30 files (production media, not in git): one projekt PDF (układ funkcjonalny — target state only,
  dimensions in cm, no heights) and 29 renders.
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #217**
(szablon #166).

## Reading the plan

- **Market:** stan deweloperski assumed — the plan labels a radiator „grzejnik deweloperski lub nowy”.
  So H = 2,68 m (Manual), szlifowanie mleczka, wkucie wod-kan, demontaż grzejników, no skuwanie.
- **Salon z aneksem:** 416 × 583 cm (chains 90+95+47+80+69+35 and 225+107+90+101+60) plus a strip by the
  tall cabinets ≈ 25 m². Kitchen run 419 cm with a stone backsplash.
- **Demolished wall:** not drawn (target state). Placed on the line crossing the salon at the pier
  between the left windows, ≈ 4,20 mb.
- **Pralnia:** 1,91 × 2,28 m, new hatched walls ≈ 5,56 mb (GK z wełną), door ≈ 70 cm.
- **Łazienka:** L-shaped, 2,79 × 1,25 + 2,37 × 0,52 = 4,72 m², perimeter ≈ 9,32 mb. Walk-in shower
  91 × 103 with a linear drain on the south wall. Tiles only in the shower (east 1,87 + south 0,91 mb).
- **Sypialnia** 3,51 × 3,05, **pokój 3** 3,51 × 2,70, **hol** ≈ 7 m² (only its width, ≈ 2,35 m, is
  dimensioned).

## Result (netto, szablon #166 prices)

**107 rows, 93 194,94 zł.** 2 rows at qty 0 (stone backsplash — kamieniarz; the optional bathroom
przedścianka). 3 rows added: lamele (katalog 150 zł/m²), szlifowanie mleczka in the Łazienka sekcja,
and the GK przedścianka at qty 0.

The loader keeps szablon prices on matched rows, so the Manual figures for transport (2000 zł vs 1500) and the AC unit (2200 zł vs 0) live in the comments, not the price. The DRY fill reports
`104 matched + 3 new`, no new sections, expected AI przedmiar **93 194,94 zł** — same as the script.

| Sekcja                                 | Amount    |
| -------------------------------------- | --------- |
| Prace dodatkowe                        | 3 300,00  |
| Klimatyzacja                           | 2 550,00  |
| Wyburzenia, demontaże, zabezpieczenia  | 4 230,10  |
| Podłogi                                | 10 043,56 |
| Ściany i sufity bez łazienek           | 32 800,32 |
| Kuchnia                                | 1 508,00  |
| Montaż stolarki i ślusarski            | 4 000,00  |
| Instalacja elektryczna i oświetleniowa | 10 020,00 |
| Instalacja wodno-kanalizacyjna + c.o.  | 1 800,00  |
| Łazienka                               | 22 942,96 |
