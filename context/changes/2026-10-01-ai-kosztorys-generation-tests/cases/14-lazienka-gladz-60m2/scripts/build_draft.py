# Builds measure/ai-draft-load.json for production #204 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). Assumptions go into the row's `assumptions`, unknowns into `missingData`.
# Sheets: „Układ płytek” 1/2, „Kłady ścian i mebli” 1/2, „Rzut sufitu”, „Rzut punktów hydraulicznych”,
# „Rzut punktów elektrycznych” (production media, not in git). Dimensions are printed, from plastered walls;
# the bathroom plans are 1:20, the electrical plan 1:40 (measurement.md).
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

def pl(x): return f"{x:.2f}".replace(".", ",")

# Room 145,6 × 255,5, corner cut-out 50,3 × 42,6 (bottom right); a 43 × 10,3 stub between the shower and the
# washbasin niche. The WC back wall (95,4) sits behind the joiner's MDF stelaż box (18 + 2 deep).
ROOM = (1.456, 2.555)
CUTOUT = (0.503, 0.426)
STUB = (0.43, 0.103)
WC_BOX = 0.954 * 0.20
H = 2.72          # „Kłady ścian”: 272 from the gres
H_SHOWER = 2.60   # suspended ceiling h=10 over the shower (Rzut sufitu)
SHOWER = (1.456, 0.766)

A_floor = ROOM[0] * ROOM[1] - CUTOUT[0] * CUTOUT[1] - STUB[0] * STUB[1]
A_floor_tiles = A_floor - WC_BOX
A_ceiling = A_floor
A_mat = A_floor - SHOWER[0] * SHOWER[1] - WC_BOX

# Walls, Navona Bone Cross 60×120 unless noted; the shower end wall is Tarima Black 30×90.
navona = [
    0.766 * H_SHOWER,          # right wall in the shower
    STUB[0] * H_SHOWER,        # stub, shower face
    STUB[0] * H,               # stub, niche face
    1.26 * H,                  # right wall in the niche
    0.502 * H,                 # cut-out, top face
    0.226 * H,                 # cut-out side left exposed by the stelaż box
    0.803 * H_SHOWER,          # left wall, shower part
    1.552 * H - 0.80 * 2.05,   # left wall to the stelaż box, less the door 80 × 205
]
A_navona = sum(navona)
A_tarima = 1.426 * H_SHOWER
A_walls = A_navona + A_tarima
GLIF = H                       # stub end, 10,3 wide
A_glif = STUB[1] * GLIF
A_tiled = A_walls + A_glif + A_floor_tiles
MITRE = 2 * (H_SHOWER + H) + 2 * H   # both stub corners + the cut-out corner, two edges each
CEIL_PERIM = 2 * (ROOM[0] + ROOM[1])

GLADZ = 60.0       # client's figure, mail
FLAT = 60.0        # net floor area off the electrical plan (≈ 68 m² gross outline at 1:40)

A_DIM = "wymiary z „Układu płytek” i „Kładów ścian” (od ścian otynkowanych), wysokość 272 od gresu, nad prysznicem sufit podwieszany h=10"
A_WALLS = "nowe ściany deweloperskie przyjęte jako równe — bez wyrównania pod glazurę"

draft = []
def add(i, qty, assumptions=None, missing=None, price=None):
    r = dict(rows[i]); r['qty'] = round(qty, 2)
    if price is not None: r['clientPrice'] = float(price)
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

# — Prace dodatkowe
add(61808, 1, "rynek pierwotny: łazienka + gładź 60 m²",
    "cena j.m. z szablonu 1500 zł; katalog: łazienka rynek pierwotny ok. 700 zł, małe mieszkanie 1500 zł — piętro i winda nieznane")
add(61811, 2, "katalog: 2 big bagi na łazienkę, rynek pierwotny bez wyburzeń")

# — Wyburzenia, demontaże, zabezpieczenia
add(61826, FLAT, f"podłoga mieszkania ok. {pl(FLAT)} m² z rzutu punktów elektrycznych (1:40, obrys ok. 68 m² brutto) — gładź i szlifowanie pylą w całym mieszkaniu",
    "czy podłogi są już położone; czy mieszkanie będzie puste w trakcie")
add(61828, 2, "katalog: ok. 2 mb na łazienkę")

# — Podłogi
add(61874, A_mat, f"mata elektryczna z rzutu punktów elektrycznych: podłoga poza prysznicem i zabudową stelaża = {pl(A_mat)} m²",
    "czy matę kładziemy my; podłączenie i sterownik robi elektryk (elektryka poza wyceną)")

# — Ściany i sufity bez łazienek
add(61924, GLADZ, "60 m² ścian wprost z maila (pozostałe ściany zabudowane lub oklejone); szlifowanie w cenie gładzi",
    "klient chce gładź 1 raz — szablon ma tylko gładź 2-warstwową (57 zł/m²); cena j.m. za jedną warstwę do ustalenia")
add(61929, GLADZ, "grunt przed i po gładzi na tych samych 60 m²")

# — Łazienka
add(61947, 8, "prysznic 3 (zimna, ciepła, odpływ liniowy), umywalka 3 (bateria podtynkowa h=107, odpływ h=58), WC 2 — rzut punktów hydraulicznych; pralka w holu bez zmian")
add(61948, 2, "bateria prysznicowa podtynkowa i bateria umywalkowa podtynkowa wpuszczone w ściany",
    "które ściany są działowe, a które nośne")
add(61950, 1, "stelaż WC H112 („Kłady ścian”)")
add(61952, 1, "odpływ liniowy z kopertą — cięcia po przekątnej na „Układzie płytek”")
add(61960, A_walls + A_glif + A_floor + A_ceiling,
    f"ściany w płytkach {pl(A_walls)} + glif {pl(A_glif)} + podłoga {pl(A_floor)} + sufit {pl(A_ceiling)} m²; {A_DIM}")
add(61963, 1, "sufit podwieszany h=10 nad prysznicem z maskownicą LED Creativa LK-03 („Rzut sufitu”) — taśma LED i zasilanie po stronie elektryka")
add(61969, A_tiled, f"wszystkie ściany w płytkach i podłoga (katalog): {pl(A_walls)} + {pl(A_glif)} + {pl(A_floor_tiles)} m²")
add(61971, 14, "katalog: ok. 15 mb na łazienkę 4 m², łazienka ma 3,5 m²")
add(61972, MITRE, f"narożniki zewnętrzne ścianki przy prysznicu (2) i wnęki przy stelażu (1), po dwie krawędzie = {pl(MITRE)} mb",
    "czy projekt chce narożniki na 45° czy listwy")
add(61978, A_floor_tiles, f"Navona Bone Cross 60×120 na podłodze {pl(A_floor)} m² bez zabudowy stelaża 0,19 m²; {A_DIM}")
add(61985, A_walls, f"Navona 60×120 {pl(A_navona)} m² + Tarima Black 30×90 na ścianie prysznica {pl(A_tarima)} m², od podłogi do sufitu; ściana za stelażem WC (95,4) pod zabudową MDF i szafką — bez płytek; {A_WALLS}",
    "czy ściana nad szafką nad stelażem jest w płytkach")
add(61987, GLIF, "czoło ścianki 10,3 cm przy prysznicu, na całą wysokość")
add(61989, A_tiled, "fuga epoksydowa na wszystkich płytkach (projekt: fuga epoksydowa)")
add(61993, 25, "katalog: 20–30 mb na łazienkę")
add(61994, 20, "WC 5, prysznic 5 (bateria 3-pokrętłowa, deszczownica, słuchawka), umywalka 3, grzejnik 2, gniazda 3, lustro 1, kratka 1")
add(61996, CEIL_PERIM, f"styk płytek z sufitem po obwodzie łazienki = {pl(CEIL_PERIM)} mb")
add(61997, A_ceiling, f"sufit {pl(A_ceiling)} m² z gładzią (także część podwieszana); ściany bez płytek są tylko za zabudową")
add(61998, 1, "półka Dabstory w prysznicu („Układ płytek”)")
add(62000, 1, "bateria prysznicowa podtynkowa h=120, deszczownica h=240")
add(62007, 1, "deszczownica + słuchawka")
add(62002, 1, "bateria umywalkowa podtynkowa w ścianie h=107")
add(62006, 1)
add(62022, 1, "drzwi szklane prysznica 99,6 × 200 przy ściance — najbliższa pozycja w szablonie",
    "rysunek pokazuje drzwi otwierane na zawiasach, nie szybę stałą — cena j.m. do sprawdzenia")
add(62012, 1, "grzejnik dekoracyjny pionowy na ścianie z drzwiami",
    "czy przesuwamy punkty c.o. pod nowy grzejnik")
add(62015, 1, "okrągły wylot wentylacji u góry ściany we wnęce",
    "kratka czy wentylator")
add(62018, 1, "okrągłe lustro z LED; podłączenie po stronie elektryka")
add(62023, 1, "umywalka nablatowa na wiszącej szafce od stolarza")
add(62026, 1, "syfon umywalki nablatowej")
add(62028, 1)

out = os.path.join(BASE, 'measure/ai-draft-load.json')
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)

by_sec = {}
for r in draft:
    by_sec[r['section']] = by_sec.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in sorted(by_sec.items(), key=lambda kv: -kv[1]):
    print(f"{s.strip():45} {v:10.2f}")
total = sum(r['qty'] * r['clientPrice'] for r in draft)
print(f"rows {len(draft)}, total {total:.2f}")
print(f"walls {A_walls:.2f} (navona {A_navona:.2f}, tarima {A_tarima:.2f}), floor {A_floor:.2f}, floor tiles {A_floor_tiles:.2f}, mat {A_mat:.2f}, tiled {A_tiled:.2f}, mitre {MITRE:.2f}")
