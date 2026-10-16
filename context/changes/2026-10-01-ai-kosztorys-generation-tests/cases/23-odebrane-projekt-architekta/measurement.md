# Case 23 (odebrane od dewelopera, projekt architekta) — measurement

Inputs:

- `inputs/client-inquiry.md`: the owner's mail. The flat is received from the developer and the media
  are connected (rynek pierwotny). An architect supports the build. The client asks for the main
  construction work, with gładź and 2× malowanie on walls and ceilings.
- 2 PDFs (production media, not in git): rysunki techniczne (7 sheets, 1:48 — inwentaryzacja, rzuty
  projektowe, podłogi, sufity, elektryka, oświetlenie, rozwinięcia łazienki) and wizualizacje
  (15 pages). Both were uploaded without the „Do analizy AI” mark and downloaded by hand for the
  first draft; the owner marked both after the draft (`kind: projekt` in `case.json`).
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #218**
(szablon #166).

## Reading the drawings

- **Scale:** 1:48, checked against two printed dimensions. Overall width 595 cm (240 + 170 + 12 + 173).
- **Height:** H = 2,65 m from the bathroom rozwinięcia (93 + 172), used instead of the Manual's 2,68.
- **Living L (salon + aneks + hol):** [0,410] × [49,667] ∪ [240,410] × [0,49] minus the bedroom part
  [295,410] × [285,667] = 21,78 m², perimeter 21,54 mb.
- **Sypialnia** 2,92 × 3,78 = 11,04 m², perimeter 13,40 mb. **Łazienka** 1,73 × 2,76 − 0,63 × 0,41
  (pion niche) = 4,52 m², perimeter 8,98 mb. Dry floor 32,82 m², all 37,33 m².
- **Openings:** window + balcony door 2,15 × 2,30, bedroom window 1,56 × 2,30, entrance 1,04 × 2,18,
  doors 0,80 × 2,05 (reduced for hidden frames; bathroom from the hall side only, bedroom both sides)
  = 15,72 m².
- **No gładź behind built-ins:** kitchen L 5,72 mb, bedroom bed wall + wardrobe 5,49 mb (× H).
- **Floors:** „panel laminowany / winylowy” outside the bathroom → winyl klejony + wylewka (Manual
  95% rule); bathroom 20 × 20.
- **Ceilings:** polyurethane gzyms with LED along the window walls (salon 2,95, sypialnia 2,92) and in
  the bathroom (1,73). No sufit podwieszany.
- **Walls:** tapeta on the TV wall (2,95 × H), Orac Decor panel 0,75 × H, backlit GK frame structure
  in the bedroom (4 frames 40 × 60, ≈ 2 m² estimated).
- **Electrics:** 7 ceiling points, 5 kinkiety, ≈ 9 LED supplies; 19 sockets, 13 switches (8
  schodowe/krzyżowe), TV + NET. Developer points assumed reused: ≈ 5 lighting, ≈ 12 electrical.
- **Bathroom:** WC podwieszane with a full-width obudowa (110 × 120), półścianka 114 × 11 × 120 with a
  shelf niche and a szyba stała, odpływ punktowo-liniowy with four-way slopes (koperta), podtynkowe
  baterie (prysznic, umywalka on a blat), pralka + suszarka column, 5 × 30 on the shower wall and
  60 × 120 elsewhere, checker 20 × 20 on the WC obudowa, GK glued on the widok 1-1 wall for flush LED
  profiles. Untiled: above the WC cabinet and behind the pralka column (3,38 m²) + the dark ceiling.
- **Radiators:** salon radiator moves to the perpendicular wall (new decorative, 2 pkt c.o.); bedroom
  re-mounted; bathroom drabinka.

## Result (netto, szablon #166 prices)

**105 rows, 69 100,39 zł** (after review, was 69 113,14 — see `review.md`). 3 rows at qty 0 (kitchen backsplash — kamieniarz; narożniki aluminiowe — rynek pierwotny; szafka nad WC — stolarz). 9 rows not matching a
szablon (section, opis) pair: 3 from the katalog (panel ścienny 150 zł/m², GK zabudowa 250 zł/m²,
wymurowanie ścianki w strefie prysznicowej 1200 zł) and 6 szablon rows placed in the Łazienka sekcja
(mleczko, farba podkładowa, gzyms, malowanie gzymsu, cokół z płytek, naprawy po bruzdach).

| Sekcja                                 | Rows | Amount    |
| -------------------------------------- | ---- | --------- |
| Prace dodatkowe                        | 2    | 2 400,00  |
| Wyburzenia, demontaże, zabezpieczenia  | 4    | 3 643,25  |
| Podłogi                                | 5    | 5 322,50  |
| Ściany i sufity bez łazienek           | 17   | 14 036,43 |
| Kuchnia                                | 8    | 1 445,00  |
| Montaż stolarki i ślusarski            | 2    | 2 400,00  |
| Instalacja elektryczna i oświetleniowa | 13   | 11 276,00 |
| Instalacja wodno-kanalizacyjna + c.o.  | 4    | 1 500,00  |
| Łazienka                               | 50   | 27 077,21 |

The DRY fill reports `96 matched + 9 new`, no new sections, kosztorys empty → seeded from szablon #166,
expected AI przedmiar **69 100,39 zł** — same as the script.
