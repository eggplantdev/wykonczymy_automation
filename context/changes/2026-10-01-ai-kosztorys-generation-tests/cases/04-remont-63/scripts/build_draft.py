# Builds measure/ai-draft-load.json for production #185 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). The agent may assume, and every assumption goes into the row's `assumptions`
# (owner, 2026-10-09); what the inputs left unknown goes into `missingData`. Several items are one per line.
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

H = 2.60
def pl(x): return f"{x:.1f}".replace(".", ",")
A_H = "wysokość 2,60 m (rynek wtórny, Wiedza firmowa) — rzut jej nie podaje"
A_BRUTTO = "ściany brutto — okna i drzwi nieodliczone"
M_OPENINGS = "wysokości okien i drzwi (rzut podaje tylko szerokości okien)"

# printed m² on the rzut; a missing side = m² ÷ the printed one
dry_rooms = dict(salon=14.5, pokoj_harmonijka=9.5, kuchnia=4.5, przedpokoj=8.0, pom_098=0.98, pokoj_11_8=11.8, pokoj_9_1=9.1)
kitchen_w = 4.5 / 3.12
P_wc = 2 * (0.93 + 1.4 / 0.93)

# The mail moves the łazienka/pokój wall without saying where.
BATH_EXT = 2.0
A_BATH = 3.0 + BATH_EXT
A_BATH_EXT = f"łazienka powiększona o {pl(BATH_EXT)} m² kosztem pokoju 11,8 → {pl(A_BATH)} m² (1,70 × 2,95)"
M_BATH = "gdzie stanie nowa ściana łazienka/pokój"
P_bath = 2 * (1.70 + 2.95)
bath_walls = P_bath * H - 0.8 * 2.0 - 0.6 * 0.9
wc_walls = P_wc * H - 0.7 * 2.0
wall_tiles = bath_walls + wc_walls
floor_tiles_bath = A_BATH + 1.4
all_tiles_bath = wall_tiles + floor_tiles_bath
A_TILES = ("płytki do sufitu w łazience i WC (stara łazienka ma je do sufitu na zdjęciu)\n"
           "drzwi 0,8 × 2,0 w łazience i 0,7 × 2,0 w WC, okno łazienki 0,6 × 0,9 (zdjęcie) — odliczone")

# The przedpokój prints no sides; the kuchnia's long walls are behind units (photo, Wiedza firmowa).
P_hall = 12.0
A_HALL = "obwód przedpokoju 12 mb — korytarz ok. 1,4 m szerokości, bez ściany do kuchni (do wyburzenia); rzut podaje tylko 8,0 m²"
gladz_perimeters = dict(salon=2 * (3.97 + 3.65), pokoj_harmonijka=2 * (2.25 + 9.5 / 2.25),
                        pokoj_11_8=2 * (3.97 + 2.97), pokoj_9_1=2 * (2.31 + 9.1 / 2.31), pom_098=2 * (1.41 + 0.98 / 1.41))
P_gladz = sum(gladz_perimeters.values()) + P_hall
walls_gross = P_gladz * H
ceilings = sum(dry_rooms.values()) - BATH_EXT
gladz = walls_gross + ceilings
A_GLADZ = [A_H, A_BRUTTO, A_HALL, f"sufity bez {pl(BATH_EXT)} m² przeniesionych do łazienki", "ściany kuchni pominięte — za zabudową (Wiedza firmowa)"]

# Old wall tiles: łazienka to the ceiling (photo); WC and kuchnia stop part-way.
skuwanie_bath = 2 * (1.70 + 1.79) * H
skuwanie_wc = P_wc * 1.50 - 0.7 * 1.50
skuwanie_kitchen = (2 * 3.12 + kitchen_w) * 1.60 - 0.6
skuwanie_walls = skuwanie_bath + skuwanie_wc + skuwanie_kitchen
skuwanie_floors = 3.0 + 1.4 + dry_rooms['kuchnia']
A_SKUWANIE = [A_H + " — stara łazienka, płytki do sufitu (zdjęcie)",
              "płytki w WC do 1,50 m (zdjęcie), drzwi 0,7 m odliczone",
              "płytki w kuchni do 1,60 m na obu długich ścianach i pod oknem (zdjęcie), okno 0,6 m² odliczone"]

walls_removed = (1.79 + kitchen_w) * H

# GK walls: the salon/pokój opening (photo) and the new łazienka wall.
gk_salon = 2.0 * 2.20
gk_bath = 3.0 * H
A_GK = ["ściana salon/pokój zamyka otwór po harmonijce 2,0 × 2,20 m (zdjęcie, bez wymiaru)",
        f"ściana łazienka/pokój w kształcie L ok. 3,0 mb × 2,60"]

windows = [0.81, 0.81, 1.51, 1.51, 1.71, 1.71]
window_glify = sum(2 * 1.50 + w for w in windows)
corners = window_glify + (2 * 2.0 + 0.8) + 2 * H

el_sockets, el_switches, el_stair, el_lights = 26, 9, 2, 12
el_points = el_sockets + el_switches + el_stair
bruzdy_el = (el_points + el_lights) * 2.5

hall_kitchen = dry_rooms['przedpokoj'] + dry_rooms['kuchnia']

def r(i, qty, assumptions=(), missing=()):
    return (i, qty, list(assumptions), list(missing))

pick = [
    r(50454, 63, ["zabezpieczenia = m² podłogi całego mieszkania (katalog), 63 m² z maila"]),
    r(50432, 1, ["1 kpl za armaturę łazienki i WC oraz zabudowę kuchni — wg ilości pracy"]),
    r(50450, walls_removed, [A_H, "ściana kuchnia/przedpokój = szerokość kuchni 1,44 (4,5 m² ÷ 3,12)", "brutto, z otworem drzwi"],
      ["mail wymienia ścianę kuchnia/przedpokój dwa razy — policzona raz"]),
    r(50437, skuwanie_walls + skuwanie_floors, A_SKUWANIE),
    r(50440, skuwanie_walls, ["= ściany po skuciu płytek z klejem"] + A_SKUWANIE[1:]),
    r(50443, 6),
    r(50425, 1, ["stara drabinka w łazience do demontażu — mail montuje nowy grzejnik"]),
    r(50444, 8.0),
    r(50447, 1),
    r(50453, 2, ["2 otwory pod nowe nadproża — mail ich nie liczy, poza otworem przy WC"], ["gdzie i ile nadproży"]),
    r(50422, bruzdy_el, ["≈ 2,5 mb bruzdy na punkt (katalog)"]),
    r(50529, bruzdy_el, ["= bruzdy elektryczne"]),
    r(50539, 20.0, ["drzwi wejściowe 5,0 mb (obwód 0,9 × 2,05), otwór przy WC 4,8 mb, styki po dwóch wyburzonych ścianach ok. 10 mb"]),
    r(50420, 4, ["≈ 2 mb na łazienkę (Wiedza firmowa) × łazienka + WC"]),
    r(50406, 1),
    r(50402, 1, ["ryczałt dla małego mieszkania (katalog)"], ["piętro i winda"]),
    r(50491, 1.79 + kitchen_w, ["= długości wyburzonych ścian"]),
    r(50494, hall_kitchen, ["wylewka samopoziomująca pod nowe płytki — podłoże nierówne po zerwaniu parkietu i skuciu płytek"],
      ["stan podłoża po zerwaniu parkietu"]),
    r(50478, hall_kitchen),
    r(50462, hall_kitchen, ["fugowanie = m² płytek (katalog)"]),
    r(50463, hall_kitchen),
    r(50471, 3.6, ["4 przejścia płytki/parkiet z przedpokoju (salon, 3 pokoje) × 0,9 m"]),
    r(50522, gk_salon + gk_bath, A_GK, [M_BATH]),
    r(50536, 30, ["≈ 30 mb taśm: obie strony ściany salon/pokój + strona pokoju ściany łazienkowej (strona łazienki pod płytki)"]),
    r(50545, 3.0, ["zabudowa rury w przedpokoju ok. 3,0 mb (zdjęcie, bez wymiaru)"], ["długość rury przy suficie"]),
    r(50542, corners, [f"6 okien o szerokościach z rzutu, wysokość 1,50 m — glify {pl(window_glify)} mb",
                       "otwór przy WC 0,8 × 2,0 i dwa narożniki po wyburzeniu ściany kuchni"], [M_OPENINGS]),
    r(50502, gladz, A_GLADZ, [M_OPENINGS]),
    r(50496, gladz, ["jak gładź"] + A_GLADZ),
    r(50505, gladz, ["jak gładź"] + A_GLADZ),
    r(50503, gladz, ["jak gładź"] + A_GLADZ),
    r(50514, walls_gross, [A_H, A_BRUTTO, A_HALL], [M_OPENINGS]),
    r(50495, P_gladz, ["styk ściana/sufit = obwody pomieszczeń jak przy gładzi", A_HALL]),
    r(50508, ceilings, [f"sufity bez {pl(BATH_EXT)} m² przeniesionych do łazienki"]),
    # Łazienka + WC
    r(50557, wall_tiles - gk_bath, ["GK na wyrównanie na ścianach pod płytki, poza nową ścianą GK", A_BATH_EXT, A_TILES], [M_BATH]),
    r(50552, all_tiles_bath + floor_tiles_bath, ["dwukrotne gruntowanie = podłoga + sufit + ściany (katalog)", A_BATH_EXT, A_TILES], [M_BATH]),
    r(50613, wall_tiles, [A_BATH_EXT, A_H, A_TILES], [M_BATH]),
    r(50607, floor_tiles_bath, [A_BATH_EXT, "podłoga pod brodzikiem też w płytkach"], [M_BATH]),
    r(50596, all_tiles_bath, ["folia w płynie = suma płytek (Wiedza firmowa)", A_BATH_EXT, A_TILES], [M_BATH]),
    r(50556, all_tiles_bath, ["fugowanie = suma płytek (Wiedza firmowa)", A_BATH_EXT, A_TILES], [M_BATH]),
    r(50619, P_bath + 2 * 2.0 + P_wc, ["obwody podłóg łazienki i WC + 2 narożniki strefy prysznica po 2,0 m (Wiedza firmowa)", A_BATH_EXT]),
    r(50598, 25 + 20, ["20–30 mb na łazienkę (Wiedza firmowa): łazienka 25, WC 20"]),
    r(50615, 3.0, ["glif okna łazienki ok. 3,0 mb — okno 0,6 × 0,9 (zdjęcie)"]),
    r(50600, 3.0, ["krawędzie 45° tylko na glifie okna łazienki"], ["narożniki zewnętrzne i zabudowy w projekcie"]),
    r(50559, A_BATH + 1.4, ["ściany w płytkach do sufitu — maluje się tylko sufity", A_BATH_EXT]),
    r(50546, 3 + 3 + 2 + 2 + 3, ["punkt = zimna + ciepła + kanalizacja (katalog): umywalka 3, prysznic 3, pralka 2, geberit 2, umywalka w WC 3",
                                 "umywalka w WC zostaje (zdjęcie) — „zestaw natynkowy” z maila to jej bateria"]),
    r(50617, (2 + 3 + 2 + 1 + 2) + (5 + 3), ["otwory wg Wiedzy firmowej: prysznic natynkowy 2, umywalka 3, grzejnik 2, pralka 1, lustro 2; WC: geberit 5, umywalka 3",
                                             "umywalka w WC zostaje (zdjęcie)"]),
    r(50569, 1),
    r(50583, 1),
    r(50592, 1),
    r(50567, 1),
    r(50563, 1),
    r(50588, 2, ["umywalka w WC zostaje (zdjęcie)"]),
    r(50561, 2, ["umywalka w WC zostaje (zdjęcie)"]),
    r(50585, 2, ["syfony obu umywalek; brodzik ma syfon w komplecie"]),
    r(50572, 1),
    r(50594, 1),
    r(50577, 2, ["lustro w łazience i w WC (zdjęcia)"]),
    r(50560, 4, ["2 akcesoria na pomieszczenie — łazienka i WC"], ["ile akcesoriów"]),
    r(50705, 1),
    r(50709, 2, ["nowy grzejnik: zasilanie + powrót"]),
    r(50655, 6, ["„Montaż […]” to drzwi — 6, tyle ile futryn do usunięcia, ościeżnice regulowane"],
      ["mail urwany na „Montaż […]” — czy także listwy przypodłogowe i drzwi do pomieszczenia przy WC"]),
    r(50703, el_points),
    r(50701, el_lights),
    r(50675, el_sockets + el_switches),
    r(50693, el_stair),
    r(50694, 1, ["6 bezpieczników + różnicowy + główny mieści się w 12 modułach"]),
]
S_EXTRA = rows[50406]['section']
added = [
    (S_EXTRA, "Sprzątanie pomieszczeń po remoncie, rozklejanie zabezpieczeń", "kpl", 0, 1, [],
     ["brak w katalogu — do wyceny"]),
]

out, by_sec = [], {}
def add(section, description, unit, price, qty, assumptions, missing):
    qty = round(qty + 1e-9, 2)
    row = dict(section=section, description=description, qty=qty, unit=unit, clientPrice=float(price))
    if missing: row['missingData'] = '\n'.join(missing)
    if assumptions: row['assumptions'] = '\n'.join(assumptions)
    out.append(row)
    by_sec[section.strip()] = by_sec.get(section.strip(), 0) + qty * price

for i, q, a, m in pick:
    p = rows[i]
    add(p['section'], p['description'], p['unit'], p['clientPrice'], q, a, m)
for s, d, u, p, q, a, m in added: add(s, d, u, p, q, a, m)

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"rows {len(out)}  razem {sum(by_sec.values()):,.2f}  with assumptions {sum('assumptions' in r for r in out)}  "
      f"gładź {gladz:.2f}  walls {walls_gross:.2f}  wall_tiles {wall_tiles:.2f}  skuwanie {skuwanie_walls:.2f}")
for s, v in sorted(by_sec.items(), key=lambda kv: -kv[1]): print(f"  {s}: {v:,.2f}")
