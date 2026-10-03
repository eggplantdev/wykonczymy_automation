# Turns the measured geometry into Przedmiar quantities for the rows the blind run estimated.
# Inputs: ../../measure/rooms2.json (rooms2.py), ../../measure/finishes.json (finishes.py).
# Output: ../../measure/measured.json  {pozycja: [Przedmiar, źródło]} — read by build-proposal.mjs.
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'measure')
rooms = json.load(open(os.path.join(OUT, 'rooms2.json')))
fin = json.load(open(os.path.join(OUT, 'finishes.json')))

# Heights read from drawing 3 (Hpom labels); rooms without a label take the common 2,625.
H = {'salon': 2.63, 'łaz. główna': 2.62, 'bawialnia': 2.628, 'kuchnia': 2.625, 'korytarz': 2.625,
     'druga łaz.': 2.615}
h = lambda r: H.get(r, 2.625)
def bands(name, default_room):
    # A band piece that fell just outside every room mask belongs to the room the band runs along.
    out = {}
    for r, l in fin[name].items():
        r = default_room if r == 'poza pokojami' else r
        out[r] = out.get(r, 0) + l
    return out

def full(name, room=None):
    return sum(l * h(r) for r, l in bands(name, room).items())

def split(name, room, at=1.2):
    b = bands(name, room)
    return sum(l * at for l in b.values()), sum(l * (h(r) - at) for r, l in b.items())

# Windows: width measured on drawing 11 (150 dpi ≈ 1 cm/px), hp/ho from the drawing labels.
# Sypialnia and gabinet carry no label in the drawing — 186 cm assumed (same as the other rooms).
WINDOWS = [  # room, finish band it interrupts, width m, hp m, ho m
    ('salon', 'flugger', 2.30, 0.15, 2.25),
    ('salon', 'flugger', 1.45, 0.615, 1.86),
    ('kuchnia', None, 1.30, 0.955, 1.52),  # wall behind cabinets, no finish band
    ('bawialnia', 'caselio', 2.22, 0.15, 2.25),
    ('bawialnia', 'caselio', 1.45, 0.615, 1.86),
    ('dzieci', 'harry', 1.45, 0.0, 2.40),
    ('sypialnia', 'limewash', 1.53, 0.615, 1.86),
    ('gabinet', 'flugger', 2.00, 0.615, 1.86),
]
def win_cut(band, lo=0.0, hi=9.0):
    return sum(w * max(0, min(hp + ho, hi) - max(hp, lo)) for _, b, w, hp, ho in WINDOWS if b == band)

flugger = full('farba Flugger półsatyna (szara)') - win_cut('flugger')
limewash = full('limewash') - win_cut('limewash')
harry_lo, harry_hi = split('0-120 farba + naklejka, >120 tapeta Harry (dzieci)', 'dzieci')
harry_lo -= win_cut('harry', 0, 1.2); harry_hi -= win_cut('harry', 1.2)
cas_lo, cas_hi = split('0-120 farba, >120 tapeta Caselio (bawialnia)', 'bawialnia')
cas_lo -= win_cut('caselio', 0, 1.2); cas_hi -= win_cut('caselio', 1.2)
pan_lo, pan_hi = split('0-120 panele tapicerowane, >120 tapeta Caselio', 'bawialnia')

# Door openings are gaps in the bands, so the strip above each door is lost: ~15 door sides in dry
# rooms × 0,9 m × (2,625 − 2,105).
over_doors = 15 * 0.9 * (2.625 - 2.105)
painted = flugger + limewash + harry_lo + cas_lo
wallpaper = harry_hi + cas_hi + pan_hi
walls_skim = painted + wallpaper + over_doors
ceilings = 114.74  # printed dry-room areas — read, not derived
paint_primer = ceilings + painted + over_doors

# Bathrooms (drawing 11 bands × room height)
b_caesar_lo, b_swan_hi = split('0-120 Caesar 120x120, >120 Swan 5x25', 'łaz. główna')
b_elysian = full('Mirage Elysian 120x120')
b_line = full('Mirage Elysian Line 120x278')
b_norr = full('płytki Mirage Norr Melk 120x120')
b_fossil_lo, b_fossil_hi = split('0-120 Fossil 5x25, >120 farba wodoodporna', 'druga łaz.')
b_lime = full('limewash + Aqua Ceramic (łazienka)')
b_bars = 0.56  # bath front, from the shopping list — the band marks only its length
bath_floors = 6.74 + 4.11
bath_ceilings = bath_floors
tiles_big = b_caesar_lo + b_elysian + b_norr
tiles_small = b_swan_hi + b_bars + b_fossil_lo
bath_paint = bath_ceilings + b_lime + b_fossil_hi

dry = [r for r in rooms if r not in ('łaz. główna', 'druga łaz.')]
band_dry = sum(sum(v.values()) for k, v in fin.items() if k in (
    'farba Flugger półsatyna (szara)', 'limewash', '0-120 farba + naklejka, >120 tapeta Harry (dzieci)',
    '0-120 farba, >120 tapeta Caselio (bawialnia)', '0-120 panele tapicerowane, >120 tapeta Caselio',
    'panele akustyczne'))
wall_ceiling_joint = band_dry + 15 * 0.9
cut_line = sum(sum(fin[k].values()) for k in (
    '0-120 farba + naklejka, >120 tapeta Harry (dzieci)', '0-120 farba, >120 tapeta Caselio (bawialnia)',
    '0-120 panele tapicerowane, >120 tapeta Caselio'))
reveals = sum(2 * ho + w for _, _, w, _, ho in WINDOWS)

r1 = lambda x: round(x, 1)
measured = {
    41558: [66.4, 'listwy MD236 zmierzone na rys. 10 (warstwa pomarańczowa, minus otwory)'],
    41570: [66.4, 'listwy MD236 zmierzone na rys. 10 (warstwa pomarańczowa, minus otwory)'],
    41595: [r1(wall_ceiling_joint), f'pasy wykończeń z rys. 11 ({band_dry:.1f} mb) + nadproża drzwi'],
    41600: [r1(walls_skim), f'pasy wykończeń z rys. 11 × wysokość z rys. 3 − okna + nadproża; malowane {painted:.1f} + tapety {wallpaper:.1f} + nadproża {over_doors:.1f}; bez paneli tapicerowanych i akustycznych'],
    41603: [r1(paint_primer), f'sufity 114,7 + ściany malowane {painted + over_doors:.1f}'],
    41605: [r1(walls_skim + ceilings), f'gładzie: ściany {walls_skim:.1f} + sufity 114,7'],
    41612: [r1(limewash), 'limewash z rys. 11: korytarz, część salonu, sypialnia − okno sypialni'],
    41614: [r1(flugger + harry_lo + cas_lo + over_doors), f'Flugger NCS S 1002-Y20R {flugger:.1f} + dzieci 0–120 {harry_lo:.1f} + bawialnia 0–120 {cas_lo:.1f} + nadproża'],
    41615: [5.8, 'karnisze narysowane na rys. 10 (warstwa fioletowa)'],
    41617: [15.2, 'maskownice LK-01 zmierzone na rys. 10'],
    41630: [r1(cut_line), 'linia 120 cm: dzieci + bawialnia (pasy z rys. 11); styki pionowe kolorów nieliczone'],
    41635: [r1(reveals), 'glify: 8 okien × (2 × wysokość + szerokość)'],
    41637: [r1(wallpaper + 6.5), f'tapety > 120 cm z rys. 11: dzieci {harry_hi:.1f} + bawialnia {cas_hi + pan_hi:.1f}; + sypialnia MILO 6,5 z listy zakupowej'],
    41651: [r1(bath_floors + tiles_big + b_line + tiles_small + b_lime + b_fossil_hi + bath_ceilings), 'podłogi + ściany z rys. 11 + sufity łazienek'],
    41653: [r1(tiles_small), 'jak płytki małoformatowe'],
    41655: [r1(bath_floors + tiles_big + b_line), 'podłogi + ściany wielkoformatowe z rys. 11'],
    41659: [r1(bath_paint), f'sufity łazienek 10,85 + limewash Aqua Ceramic łaz. duża {b_lime:.1f} + farba wodoodporna nad Fossil {b_fossil_hi:.1f}'],
    41711: [r1(tiles_small), f'Swan 5×25 > 120 cm {b_swan_hi:.1f} + Bars na froncie wanny 0,56 + Fossil 0–120 {b_fossil_lo:.1f}'],
    41712: [r1(tiles_big), f'Caesar 0–120 {b_caesar_lo:.1f} + Elysian 120×120 {b_elysian:.1f} + Norr Melk {b_norr:.1f}'],
    41714: [r1(b_line), 'Elysian Line 120×278 — pas na rys. 11 × wysokość'],
    41789: [15.2, 'LED za maskownicami — jak maskownice'],
}
json.dump({str(k): v for k, v in measured.items()}, open(os.path.join(OUT, 'measured.json'), 'w'),
          ensure_ascii=False, indent=1)
for k, (q, n) in measured.items():
    print(k, q, '—', n)
print(f'dry perimeters Σ {sum(rooms[r]["per"] for r in dry):.1f} mb, finish bands Σ {band_dry:.1f} mb')
