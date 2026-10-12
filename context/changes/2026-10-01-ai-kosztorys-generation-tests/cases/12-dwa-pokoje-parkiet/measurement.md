# Case 12 (dwa pokoje, parkiet) — what was read, what was not

Inputs:

- `inputs/client-inquiry.md`: the scope the owner typed into Notatki of production #202. It describes a
  partly renovated flat on the secondary market, outside Warsaw. Two rooms (about 20 m² and 8 m²) get a new
  floor, new wall finishes and a new GK partition with a door.
- **No files.** The investment has no drawings and no photos, so nothing could be measured.
- `inputs/manual-i-komentarze-do-prac.md`: the Manual and the katalog comments.

Script: `scripts/build_draft.py` writes `measure/ai-draft-load.json` for **production #202** (szablon #166).

## Result (netto, szablon #166 prices)

**26 rows: 17 with a quantity, 9 selected at qty 0. AI przedmiar 18 985,00 zł**, which covers only the 17
quantified rows.

| Sekcja                                 | Amount        |
| -------------------------------------- | ------------- |
| Podłogi                                | 8 870,00      |
| Wyburzenia, demontaże, zabezpieczenia  | 3 125,00      |
| Prace dodatkowe                        | 2 400,00      |
| Ściany i sufity bez łazienek           | 2 320,00      |
| Łazienka (one added ryczałt pozycja)   | 1 500,00      |
| Instalacja elektryczna i oświetleniowa | 390,00        |
| Montaż stolarki i ślusarski            | 380,00        |
| **Razem**                              | **18 985,00** |

## Read from the scope

These are the quantities used as written:

- zabezpieczenia 35 m²;
- subit 28 m², wylewka 28 m², parkiet 28 m²;
- cyklinowanie 33 m², the new parkiet plus the corridor;
- the GK partition 5 m²;
- plaster strips 10 mb, and obróbki around the entry door 5 mb;
- 3 new electrical points;
- the tile-repair section, priced as a lump sum: „Założony koszt pozycji: 1 500 zł”.

## Derived from a read number

Each of these has an `assumptions` entry on its row:

- floor priming 28 m² (the wylewka area);
- bruzdy and their repair: 6 mb, using the katalog's 2 mb per point;
- Q3 gładź on the new partition: 10 m², i.e. 5 m² × 2 faces;
- 1 door with a regulowana frame, and 1 frame reinforcement;
- 2 big bags and 1 transport kpl, both from the Manual.

## Not readable: selected at qty 0

- **Wall area of both rooms.** The scope gives no height and no room dimensions. This blocks four rows:
  zdzieranie farby, gładź rynek wtórny, gruntowanie and malowanie ścian. They come to ≈ 159 zł per m² of
  wall, so the wall area is the figure that moves the price most.
- **Ceilings.** The scope only says „ewentualnie sufitów”. If they are in, they are 28 m², equal to the
  floor.
- **Skirting length.** The skirting row and its akrylowanie both depend on it.
- **The partition's joints.** Their length to the existing walls and ceiling is not given.
- **Sockets and switches.** The number of existing ones to replace is not given.

Not quantified on purpose, because the house knowledge prices it differently:

- gładź po bruzdach: the katalog says to skip it when the walls get full gładź;
- door opaski: the katalog says they are needed only with a fixed frame.

No room size or typical-flat figure was assumed.
