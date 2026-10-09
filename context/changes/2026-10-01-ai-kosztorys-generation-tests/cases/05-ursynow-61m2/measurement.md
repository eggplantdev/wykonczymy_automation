# Case 5 (Ursynów 61 m², stan deweloperski) — measurement

## Inputs

- `inputs/client-inquiry.md`: a short mail. All the scope is in the brief.
- The brief PDF, 12 pages (`brief-do-wstepnej-wyceny.pdf` on production):
  - pages 1–7: scope by room;
  - page 8: the developer's rzut. It prints m² per room, a few side lengths, green walls to demolish and blue new walls;
  - page 9: the architect's layout. It prints window and door heights (hp / ho);
  - pages 10–12: AI-generated visualisations, used only to count elements.
- `inputs/rozpiska-szablon-166.txt` and `inputs/wiedza-firmowa.md`. The katalog prac came from the 2026-10 dump (`work_catalogue_items`).

## Output

`scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #190** (szablon #166). It
prints the section totals and re-runs the draft for each sensitivity in the notes.

## Geometry

Scale: the rzut raster is about 56 px/m, checked against the printed sides 6,45 and 2,74 and against
room m² ÷ side.

| Room                   | Floor m²             | Perimeter mb | How                                                                                                 |
| ---------------------- | -------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| Salon + kuchnia (open) | 30,94 + 0,65         | 20,9         | Printed 20,04 + 10,90, plus the demolished wall footprints. The perimeter excludes the hol passage. |
| Hol                    | 13,45                | 18,15        | A 6,45 × 2,00 band plus a 1,45 × 0,6 leg                                                            |
| Pokój (sypialnia)      | 13,39 − 0,93 = 12,46 | 14,7         | 3,31 × 4,04. The łazienka notch at a corner leaves the perimeter unchanged.                         |
| Łazienka               | 1,61 × 3,24 = 5,22   | 9,70         | Printed 274 side; 4,42 / 2,74 = 1,61; plus a ~0,5 m extension                                       |

- **H = 2,68.** Nothing prints a clear height, so the Wiedza firmowa rule for stan deweloperski applies.
- **Łazienka extension.** The blue line runs 30–34 px below the green wall, i.e. 0,5–0,6 m. The architect's
  layout gives about 1,64 × 3,15, i.e. 0,4 m. The draft takes 0,5 m.
- **Openings** come from the architect's layout:
  - windows: hp 58 / ho 168 cm;
  - balcony door: ho 226 cm;
  - widths from the rzut: kuchnia 1,10, pokój 1,60, balcony door 2,00.

  They total 9,06 m² and are deducted from the walls. Interior doors are not deducted.

- **Demolition (green):**
  - kuchnia/salon 4,85;
  - its foot by the hol 0,80;
  - ścianka przy kuchni 0,61 (printed 61);
  - łazienka/pokój 1,85.

  That is 8,11 mb × H = 21,73 m², assumed miękki ≤ 12 cm.

- **New walls (blue)**, both GK:
  - the L of the łazienka, 1,85 + 0,5 return;
  - the boczna ścianka in the hol, ~0,95.

  That is 3,30 mb × H = 8,84 m².

- **Walls to paint:** perimeters × H − openings + both faces of the boczna ścianka − 7,5 m² gres on the TV
  wall − the hol szafa wall 4,95 × H. That gives 119,3 m².
- **Gładź:**
  - all non-tiled GK faces (11,4 m²);
  - plus 20 % of the remaining plaster. This excludes the szafa wall, ~3,5 mb behind kitchen units and the
    łazienka wall's tiled face.

  Total 32,1 m². The brief asks for gładź only „miejscowo, jeżeli konieczne”. The rest is szlifowanie mleczka +
  grunt + farba podkładowa.

- **Łazienka tiles:**
  - walls: P × H − door 0,80 × 2,05 + blat top 0,6 = 24,96;
  - floor: 5,22, tiled under the freestanding wanna;
  - total: 30,17.

  Folia and fugowanie equal the total. Taśma is P + 2 × 2,0. The 20 otwory are counted per fixture, by the Wiedza
  firmowa rule.

## Counts from the brief

- **Electrical**, as new points: 28 sockets/switches and 17 light points, plus 5 + 3 in the łazienka. Bruzdy follow
  the 2,5 mb/point rule, 132,5 mb. The developer's existing points are unknown. This is the largest unknown by count.
- **LED:**
  - maskownice 4,16 (salon) + 3,31 (sypialnia), taken as the full window-wall widths;
  - headboard 1,8;
  - komoda 1,8;
  - hol szafa 4,95;
  - kitchen under-cabinet 3,0 (in Kuchnia);
  - łazienka 3,0.
- **Szynoprzewody:** 2 × 4,0 mb in the salon, from the visualisation.
- **AC:** the salon unit sits in the rozpiska „Klimatyzacja” section. The optional bedroom unit goes in a new sekcja
  **„Klimatyzacja — sypialnia (opcja)”** so its total stays separate. **The coordinator must create this sekcja before
  loading.**

## Result (netto, szablon #166 prices)

| Sekcja                                 | Amount        |
| -------------------------------------- | ------------- |
| Łazienka                               | 28 270,30     |
| Ściany i sufity bez łazienek           | 21 362,01     |
| Instalacja elektryczna i oświetleniowa | 12 773,20     |
| Wyburzenia, demontaże, zabezpieczenia  | 7 677,80      |
| Podłogi                                | 7 167,05      |
| Prace dodatkowe                        | 3 300,00      |
| Klimatyzacja                           | 2 040,00      |
| Montaż stolarki i ślusarski            | 2 000,00      |
| Kuchnia                                | 1 650,00      |
| Instalacja wodno-kanalizacyjna + c.o.  | 500,00        |
| **Mieszkanie**                         | **86 740,36** |
| Klimatyzacja — sypialnia (opcja)       | 3 390,00      |
| **Razem**                              | **90 130,36** |

- 113 rows: 98 with assumptions and 37 with missingData.
- 4 rows are at 0 zł:
  - listwy podtynkowe, 40,3 mb, new;
  - sprzątanie, new;
  - two AC units at the rozpiska's „cena indywidualna” 0 zł.
- Rows added from the katalog: gres on the TV wall (180 zł/m²) with fugowanie, the blat do umywalki (250 zł/mb),
  and the AC punkt elektryczny (120 zł).

## Sensitivities (re-runs of `build()`)

| Change                        | Δ zł      |
| ----------------------------- | --------- |
| Full gładź Q3 on all walls    | +5 057,51 |
| Demolished walls are żelbet   | +4 128,70 |
| TV wall in large-format slabs | +2 775,00 |
| H + 10 cm                     | +805,53   |
| No gładź outside GK           | −1 264,53 |
| Walls white instead of colour | −477,28   |

Electrical by hand: each socket point with bruzda and repair costs about 294 zł, and each light point about 225 zł.
