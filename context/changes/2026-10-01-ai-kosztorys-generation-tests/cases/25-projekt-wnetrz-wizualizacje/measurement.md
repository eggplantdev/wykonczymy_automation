# Case 25 (60 m², stan deweloperski, projekt wnętrz z wizualizacjami) — measurement

Inputs:

- `inputs/client-inquiry.md`: the client's mail (contacts, street and the designer's name redacted). The flat is handed over by the developer. The mail lists the zakres per room. The WC becomes a pom. gospodarcze with a pralka, and the wall between it and the gabinet moves. The doors come from a door firm that mounts them itself. AC goes in first, by another contractor. A stolarz does all the furniture.
- 41 production files (not in git), all projekt:
  - the developer's karta lokalu (Pu 60,17 m², room areas, wall materials);
  - the układ funkcjonalny (2 identical PDFs);
  - the rysunki ogólne PDF of 12.10, with a rzut per topic: wyburzenia/dobudowy, posadzki, elektryka (new points in blue), colours of walls and ceilings, and H;
  - 37 visualisations, used only to count elements.
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #215** (szablon #166).

## Reading the plan

- **Market:** rynek pierwotny. So:
  - H = 2,73 m from the drawing (korytarz 2,735, sypialnia/gabinet 2,74); the client says 2,7;
  - szlifowanie mleczka on the tynki, wkucie wod-kan (3 zespoły in the łazienka);
  - demontaż of all 5 grzejniki, and 3 go back.
  - The karta says sanitary-room walls are unplastered gips blocks („zatarte na ostro”). So there is no mleczko on the łazienka and pom. gosp. walls, only on their ceilings.
- **Rooms:**

  | Room               | Area  | Walls (net) | Notes                                                                          |
  | ------------------ | ----- | ----------- | ------------------------------------------------------------------------------ |
  | Sypialnia          | 11,80 | 28,94       | 386 × 305,5; window 136,5; built-in wardrobe 1,88 mb not painted               |
  | Gabinet            | 10,60 | 28,13       | 11,61 before the wall move; window 137,5; built-in 1,90 mb                     |
  | Korytarz           | 4,47  | 17,10       | 368 × 121,5, H 2,735; 4 doors; one short side open to the hol                  |
  | Hol                | 5,54  | 10,00       | karta 10,01 incl. korytarz; walls estimated (entrance, wardrobe, 2 open sides) |
  | Salon + aneks      | 20,58 | 30,33       | 346,5 × 585,5; kitchen run 3,12 + fridge column 0,95 behind cabinets           |
  | Pom. gosp. (ex-WC) | 3,10  | 13,39       | 184 × 175 after the wall move; one wall of szafy not painted                   |
  | Łazienka           | 4,13  | 20,25       | 254 × 174,5 (karta 4,13); no window                                            |
  - Gładź Q3: 127,89 m² of walls and 56,09 m² of ceilings.
  - Colours: korytarz granatowy, pom. gosp. beżowy (walls and ceilings), the beige band under the sztukateria in the sypialnia. Door leaves are painted with wall paint (≈ 12 m²). Everything else is white.

- **Wall move:** demolish the 10 cm wall (1,75 × 2,73 = 4,78 m²). A new GK wall goes in the gabinet door line, 3,34 m² net of the 70 cm opening for the natynkowe sliding door, with profile UA. Floor infill 1,75 mb and naprawy along the old wall line.
- **Łazienka:**
  - 60x120 tiles to the ceiling on the 3 shower walls: (1,53 + 0,835 + 0,835) × 2,73 = 8,74. Elsewhere to 120 cm, ≈ 5,01. Walls total 13,75.
  - Above the tiles, licowanie GK 6 m² and paint 6,50 m² + ceiling 4,13.
  - 90x90 floor: 4,13 minus the przedścianka and stelaż footprint = 3,80. Mata kompensacyjna and epoxy fuga.
  - Folia on all walls and the floor (Manual).
  - The wanna becomes an odpływ liniowy koperta (kanalizacja moved, schodek at 0).
  - Przedścianka 89 × 22 with a shelf; bateria podtynkowa with deszczownica.
  - Stelaż WC with zabudowa to 120.
  - Umywalka with a bateria podtynkowa in the wall to the pom. gosp.
  - The drabinka moves into the shower zone (c.o. 2 pkt). The pralka podejścia are removed.
  - Glass sliding door: katalog „Montaż kabiny prysznicowej” at 1200.
  - Electrics: lighting 6, sockets/switch 4, 4 lamps, LED in the niche 0,9 mb.
- **Pom. gosp.:**
  - It has no WC, so its rows go in the general sekcje.
  - Likwidacja of the WC podejścia (2 pkt). The umywalka podejścia go to the bathroom umywalka.
  - A new pralka podejście (2 pkt), podłączenie and zawór.
  - 90x90 tiles with a 6 cm cokół wkuwany: katalog row at 220, ≈ 6,4 mb.
  - The przedścianka over the pralka pipes is not counted (Manual).
- **Kitchen:**
  - The zlew and zmywarka move under the window (4 pkt).
  - The kitchen grzejnik goes, with its podejścia rozkute.
  - Backsplash 30x60 ≈ 1,08 m², with its fugowanie in the Kuchnia sekcja (review).
  - Hookups for the zlew, bateria, syfon, zmywarka and indukcja, plus the 3/N/PE supply. The okap is at 0 (stolarz).
- **Electrics (blue = new):**
  - Outside the łazienka: 28 sockets and 14 switches (7 schodowe/krzyżowe), and 26 lighting points (5 kinkiety, 3 LED points for the stolarz's strips, 18 lamps).
  - 3 AC supply points.
  - TV/LAN moved.
  - Kabel to the kitchen window 10 mb. Rozdzielnia rebuilt to 18 modułów (Manual: indukcja), so the single bezpiecznik row is at 0 (review).
  - 81 points in total. Bruzdy are capped at 150 mb; 22 mb of naprawy are in the łazienka (20 el + 2 wod-kan), 144 in the walls sekcja.
- **Floors:**
  - Wood 47,45 m² is laid by another firm.
  - Our share is listwy 39 mb (the drawing's 43 mb less the zapas) with akryl, and równe cięcia at the tile/wood joints (4,01 mb).
- **Not ours:**
  - AC: the contractor's bruzdy are filled at qty 0, length unknown;
  - door mounting, with 3 obróbki of hidden doors (2 in Stolarka, the bathroom one in Łazienka after review; dopasowanie otworów at qty 0);
  - furniture and szafki (szafka nad WC at qty 0 after review);
  - sprzątanie.

## Result (netto, szablon #166 prices)

**109 rows, 90 050,29 zł** after review (pre-review 104 rows, 88 617,89 zł; see `review.md`).

- 6 rows at qty 0:
  - zaklejenie bruzd after the AC contractor (selected, qty unknown);
  - dopasowanie otworów for the hidden doors (selected, qty unknown);
  - schodek pod prysznicem;
  - okap;
  - szafka nad WC (stolarz);
  - dołożenie 1 bezpiecznika (inside the rozdzielnia rebuild).
- 11 rows added:
  - 2 katalog rows at katalog prices: the cokół wkuwany and the montaż kabiny prysznicowej;
  - 9 szablon rows moved between sekcje at szablon prices. Into Łazienka: mleczko, naprawy, likwidacja podejść pralki, przebudowa c.o., obróbka drzwi ukrytych. Into wod-kan: podejście pralki, podłączenie pralki, zawór. Into Kuchnia: fugowanie.

| Sekcja                                 | Rows | Amount    |
| -------------------------------------- | ---- | --------- |
| Prace dodatkowe                        | 2    | 2 850,00  |
| Wyburzenia, demontaże, zabezpieczenia  | 5    | 6 840,05  |
| Podłogi                                | 9    | 6 217,00  |
| Ściany i sufity bez łazienek           | 18   | 27 800,85 |
| Klimatyzacja                           | 1    | 0,00      |
| Kuchnia                                | 7    | 1 250,00  |
| Instalacja elektryczna i oświetleniowa | 13   | 15 165,00 |
| Montaż stolarki i ślusarski            | 2    | 1 600,00  |
| Instalacja wodno-kanalizacyjna + c.o.  | 7    | 2 950,00  |
| Łazienka                               | 45   | 25 377,39 |
