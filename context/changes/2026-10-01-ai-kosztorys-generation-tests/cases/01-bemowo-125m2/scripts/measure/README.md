# Measurement scripts (case 1)

They measure geometry from the vector projekt PDF. Needs poppler (`pdftocairo`) and Python with
numpy, scipy and opencv. The PDF is the client's and stays out of git, and so do the SVG pages made
from it.

```bash
mkdir -p /tmp/measure/pages && cd /tmp/measure
PDF="<path>/1_Projekt_mieszkania_dokumentacja_techniczna.pdf"
mkdir -p svg
for p in 10 11 12; do pdftocairo -svg -f $p -l $p "$PDF" svg/p$p.svg; done

S=<repo>/context/changes/2026-10-01-ai-kosztorys-generation-tests/cases/01-bemowo-125m2/scripts/measure
python3 $S/svgpaths.py svg/p10.svg   # drawing 10: listwy / cokół / karnisz lengths by legend colour
python3 $S/rooms2.py                 # drawing 11A: room areas + perimeters → rooms2.json, pages/rooms2.png
python3 $S/finishes.py               # drawing 11: finish bands per room → finishes.json
cp rooms2.json finishes.json $S/../../measure/
python3 $S/przedmiar.py              # → measure/measured.json
node $S/../build-proposal.mjs        # v1 + v2 tables and the comparison table
```

| Script         | Reads                                                | Writes                                   |
| -------------- | ---------------------------------------------------- | ---------------------------------------- |
| `rasterize.py` | — (library: SVG path parser + rasteriser at 200 dpi) | —                                        |
| `svgpaths.py`  | `svg/p10.svg`                                        | stdout: bounding boxes per legend colour |
| `rooms2.py`    | `svg/p12.svg`                                        | `rooms2.json` (cm), `pages/rooms2.png`   |
| `finishes.py`  | `svg/p11.svg`, `rooms2.json`                         | `finishes.json` (mb per finish per room) |
| `przedmiar.py` | `measure/rooms2.json`, `measure/finishes.json`       | `measure/measured.json`                  |

Constants that are specific to this projekt and must be re-derived for another one: the scale
(`0.25` cm per drawing unit), the legend colours, the stroke widths per layer, the room seed points
in `rooms2.py`, the windows list and heights in `przedmiar.py`.
