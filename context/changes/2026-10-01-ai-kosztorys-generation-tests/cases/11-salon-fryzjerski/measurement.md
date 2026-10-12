# Case 11 (salon fryzjerski) — what was read, what was not

Inputs:

- `inputs/client-inquiry.md`: the scope the owner typed into Notatki — seven numbered groups (demontaże,
  podłoga, tynki, elektryka, stolarka, malowanie, prace końcowe). It is the only input.
- **No files**: the investment has nothing in „Pliki” — no rzut, no photos, no drawings.
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments, used to decide what each
  described job entails.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #200** (szablon #166).

## Result (netto, szablon #166 prices)

**21 rows: 6 quantified, 15 selected with qty 0. AI przedmiar 3 080,00 zł** — the quantified rows only.

| Row                                            | Qty   | Source                               | Amount       |
| ---------------------------------------------- | ----- | ------------------------------------ | ------------ |
| Zakup, transport i wniesienie towaru           | 1 kpl | one per job, szablon price           | 1 500,00     |
| Tynki za zabudową w kuchni (new)               | 1 kpl | Notatki lump sum 600 zł              | 600,00       |
| Uporządkowanie okablowania (new)               | 1 kpl | Notatki lump sum 500 zł              | 500,00       |
| Montaż drzwi, ościeżnic regulowanych           | 1 szt | Notatki „1 szt.”                     | 380,00       |
| Demontaż drewnianych ościeżnic                 | 1     | follows from the one door            | 100,00       |
| Sprzątanie lokalu po zakończeniu remontu (new) | 1 kpl | Notatki; no szablon or katalog price | 0,00         |
| **Razem**                                      |       |                                      | **3 080,00** |

## Read

- Counts: one interior door to replace (so one ościeżnica to remove).
- Two lump sums: 600 zł for the kitchen wall behind the furniture, 500 zł for tidying the wiring. Neither
  has a szablon or katalog praca, so both became new pozycje priced from Notatki.
- Finishes: new floor in glazura over the whole lokal, poliuretan skirting, a refresh repaint of the whole
  lokal with local patching (not full gładź).

## Not read — nothing in the input gives it

- Floor area, wall/ceiling area, room height, perimeter, number of stair treads, area of tiles to remove.
- Whether the existing floor is tiled throughout, whether walls carry tiles too, the tile format, and the
  substrate's state after removal.
- The floor, access and whether the salon trades during the works.

Every pozycja depending on one of these is at qty 0 with „Praca wybrana, ilość nieznana:” and the
measurement it waits on; the notes group them into one question per measurement.

## Selection reasoning (from the Manual and the katalog comments)

- Skucie płytek → szlifowanie po kleju (katalog: always with skuwanie), gruntowanie podłóg (under wylewka
  and glazura), gruz (big bag or kontener, Manual).
- „Wyrównanie i naprawa podłoża” → wylewka samopoziomująca do 5 mm; wylewka betonowa is a question.
- Glazura on the floor → gres format standard + fugowanie (katalog: same m² as tiles).
- „układania glazury na schodach” sits among the demontaże, so it is read as both removal (inside the
  skuwanie area question) and new tiles on the treads (katalog #661, 220 zł/szt.); which one is a question.
- Listwy → demontaż, montaż poliuretan, akrylowanie (Notatki) and malowanie (poliuretan is normally painted).
- Malowanie całego lokalu → gruntowanie + drobne poprawki and malowanie ścian i sufitów na biało;
  zabezpieczenia by floor m² (katalog).
