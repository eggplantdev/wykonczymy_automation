# Case 19 (dom: dwie łazienki, pralnia, WC) — measurement

Inputs:

- `inputs/client-inquiry.md`: the client's request with the contact details removed. It asks for a
  kosztorys of the bathrooms. In the bathroom with the bath, the client wants different tiles (120×60)
  and the bath tap moved to the middle. In every bathroom, the client wants the ceiling plaster
  removed and the room trued to right angles.
- Eight files (production media, not in git):
  - Four designer PDFs: toaleta z prysznicem, łazienka z wanną, pralnia and toaleta w piwnicy. Each
    has a plan and kłady with dimensions and the height printed.
  - Four phone photos: the two parter bathrooms (IMG_0424/0425/0426) and the basement WC (IMG_0427).
    There is no photo of the pralnia.
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #213**
(szablon #166).

## Result (netto, szablon #166 prices)

**143 rows, 74 197,28 zł.**

- 139 rows match the szablon. One of them is at qty 0: the wod-kan relocation in the shower
  bathroom, because nobody knows yet whether the points need to move.
- 4 rows are added. Each is the „Ściany i sufity” row „Tynkowanie/wyrównywanie … na listwach
  tynkarskich” (100 zł/m²), used for the new ceiling plaster, one in each room's sekcja.

The DRY fill reports:

- `139 matched + 4 new`;
- „Łazienka” → „Łazienka z prysznicem”, plus copies for the other three rooms;
- expected AI przedmiar **74 197,28 zł**, which is the same as the script's total.

| Sekcja                                | Amount        |
| ------------------------------------- | ------------- |
| Łazienka pralnia                      | 19 669,92     |
| Łazienka z wanną                      | 17 499,82     |
| Łazienka z prysznicem                 | 15 654,58     |
| WC piwnica                            | 12 110,68     |
| Wyburzenia, demontaże, zabezpieczenia | 5 634,58      |
| Prace dodatkowe                       | 3 000,00      |
| Podłogi                               | 427,70        |
| Montaż stolarki i ślusarski           | 200,00        |
| **Razem**                             | **74 197,28** |

## Reading before deriving

- **Four sekcje, never summed.** Each room has its own sekcja, and its name starts with
  „Łazienka”/„WC”, so the fill copies the szablon's bathroom block into each one.
- **The pralnia is a bathroom.** It has a brodzik 0,90 × 0,90 with a glass cabin and a surface
  mixer. So it gets the full bathroom treatment: waterproofing, tiles to the ceiling and fittings.
  Its name is „Łazienka pralnia”.
- **The parter photos show a raw state.** The walls are bare brick. New PEX pipes and the kanalizacja
  riser are already in, and underfloor heating loops sit on insulation with no screed yet. The old
  ceiling plaster is still on. From this:
  - every tiled wall gets tynk pod glazurę;
  - wod-kan rough-in is treated as done, except the bath tap move (1 pkt) and a qty-0 row in the
    shower bathroom;
  - the screed over the heating is left to the house's screed crew, and the notes give its zł impact.
- **The pralnia is an existing room.** Its drawing note says „brodzik obecnie ma 12 cm… niższy
  brodzik?”, so the draft assumes old tiles. That brings in skuwanie, szlifowanie, tynk and
  self-levelling screed, all flagged because there is no photo.
- **The basement WC photo:** the walls are stripped to brick up to about 1,5 m with old plaster above.
  The ceiling plaster is peeling, the floor is rough concrete, and the pipes and riser are old. The
  draft has new points (WC 2 + umywalka 3), tynk over the full wall height and self-levelling screed.
- **Ceilings in all four rooms:**
  - skuwanie tynku, 13,47 m² in Wyburzenia;
  - new tynk na listwach in each room's sekcja, as an added work;
  - 50559 gładź + malowanie.
- **Tiles:**
  - Parter walls: Gl 59,8 × 119,8 in the shower bathroom; 120×60 in the bath bathroom per the
    client, overriding the 30×60 drawn. Both are standard format.
  - Basement walls: Gl 7,8 × 23,7, which is small format (380 zł/m²).
  - Floors: 59,8 and 29,8, both standard.
  - Height: to the ceiling everywhere except the WC, which is tiled to 1,20 with paint above.
- **No electrical layer.** The light points come from the „punkty natynkowe” notes on the kłady.
  The sockets are the agent's estimate.

## Measured areas

**Łazienka z prysznicem**

- Room: 1,23 × 2,18 = 2,68 m², H 2,70, perimeter 6,82.
- Openings: door 0,81 × 2,046, window 0,85 × 1,35.
- Walls: 15,61 m².
- Glify: 4,40 mb.

**Łazienka z wanną**

- Room: 2,04 × 2,15 minus a corner notch 0,27 × 0,65 = 4,21 m², H 2,70, perimeter 8,38.
- Openings: door 0,80 × 2,05, window 0,80 × 1,20.
- Walls: 20,03 m², plus the bath front 1,60 × 0,48, giving 20,79 m² of wall tiles.
- Glify: 4,00 mb.

**Łazienka pralnia**

- Room: 2,025 × 2,29 = 4,64 m², H 2,161 (kład A: 0,91 + 1,251), perimeter 8,63.
- Openings: door 0,80 × 2,0, window 0,78 × 0,65, measured on kład A.
- Walls: 16,54 m².
- Glify: 2,86 mb, small format.

**WC piwnica**

- Room: L-shape 0,915 × 1,28 + 0,765 × 1,01 = 1,94 m², H 2,16, perimeter 6,41.
- Door: 0,765 × 2,046.
- Tiled walls to 1,20: 6,77 m². Painted walls above: 5,51 m².

**Ceilings, all rooms:** 13,47 m².
