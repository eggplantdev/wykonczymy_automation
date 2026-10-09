# Builds measure/ai-draft-load.json for #180 (the owner's priced kosztorys) — section/description copied
# byte-for-byte from the rozpiska TSV by id, every assumption on its row (2026-10-09 rule).
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-180.tsv'), encoding='utf-8', newline='') as f:
    for line in f.read().split('\n'):
        if not line: continue
        i, sec, desc, unit, price = line.split('\t')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

S = (530/670 + 268/339) / 2            # px per cm, see geometry.py
m = lambda px: px / S / 100
pl = lambda x, n=2: f"{x:.{n}f}".replace('.', ',')
H = 2.68                                 # Wiedza firmowa: stan deweloperski, rzut prints no height
DOOR_H_HIGH = 2.40
DOOR_H_ENTRY = 2.05
WIN_H = 1.50

# perimeters / areas from geometry.py
P_open, A_open = 25.97, 25.83
P_bed, A_bed = 13.40, 10.76
A_floor = round(A_open + A_bed, 2)
d_entry, d_bath, d_bed = m(83), m(70), m(76)
w_bed, w_sal = m(130), m(200)
open_openings = d_entry*DOOR_H_ENTRY + d_bath*DOOR_H_HIGH + d_bed*DOOR_H_HIGH + w_sal*WIN_H
bed_openings = d_bed*DOOR_H_HIGH + w_bed*WIN_H
walls_net = P_open*H - open_openings + P_bed*H - bed_openings
kitchen_walls = (m(196) + m(198)) * H
gladz_walls = walls_net - kitchen_walls
ceil = A_floor
acryl = P_open + P_bed + 12*H
corners_out = 4*H + (w_bed + 2*WIN_H) + (w_sal + 2*WIN_H)
kit = m(196)+m(198); alcove = m(60)+m(77)+m(55); closet = m(50)+m(80); wardrobe = m(49)+m(143)
listwy = (P_open - kit - alcove - closet - d_entry - d_bath - d_bed) + (P_bed - wardrobe - d_bed)
bath_floor = m(125)*m(233) - m(48)*m(30) - m(75)*m(15)   # minus pion block, minus geberit box
bath_ceiling = m(125)*m(233) - m(48)*m(30)
bath_P = m(716)
bath_walls = bath_P*H - d_bath*DOOR_H_HIGH
points_sockets, points_light_ceiling, points_led = 6, 3, 4
pts = points_sockets + points_light_ceiling + points_led

A_H = f"wysokość {pl(H)} m — rzut jej nie podaje; stan deweloperski wg Wiedzy firmowej"
A_OPENINGS = "okna wys. 1,50 m, drzwi „wysokie” 2,40 m, wejściowe 2,05 m — odjęte od ścian"
A_WARDROBES = "ściany wewnątrz szaf wnękowych liczone (≈ 17 m²)"
A_POINTS = "13 punktów elektrycznych: 6 przesuniętych gniazd, 3 sufitowe pod lampy wiszące, 4 zasilania LED"
M_H = "wysokość pomieszczeń"
M_POINTS = "ile punktów elektrycznych — klient nie podał liczby"
M_WALL = "czy ściany są z materiału miękkiego czy żelbetowe"

r = lambda x, n=2: round(x + 1e-9, n)
# (id, qty, assumptions, missingData)
pick = [
 (52946, 1, ["1 kpl transportu i wniesienia — standard"], []),
 (52949, 1, ["≈ 1 big bag gruzu z 2 nadproży, bruzd i łazienki — szacunek"], []),
 (52966, r(2.5*(points_sockets+points_led)), [A_POINTS, "2,5 mb bruzdy na punkt (zasada właściciela) × 10 punktów ściennych", "ściany z materiału miękkiego"], [M_POINTS, M_WALL]),
 (52967, r(2.5*points_light_ceiling), ["3 punkty sufitowe × 2,5 mb (zasada właściciela)", "strop żelbetowy"], [M_POINTS]),
 (52969, 1, [], []),
 (52997, 2, [], []),
 (52998, r(A_floor + bath_floor, 1), [], []),
 (53007, A_floor, ["panele także pod zabudową kuchenną i szafami"], []),
 (53011, A_floor, ["układ prosty"], []),
 (53014, r(listwy, 1), ["bez listew pod zabudową kuchni i szafami"], []),
 (53015, r(d_bath), [], []),
 (53039, r(acryl, 1), [A_H], [M_H]),
 (53042, ceil, [], []),
 (53044, r(gladz_walls, 2), [A_H, A_OPENINGS, A_WARDROBES, "ściany za zabudową kuchenną wyłączone na pełną wysokość, z pasem między szafkami"], [M_H, "wysokość okien", "czy pas między szafkami kuchennymi jest malowany"]),
 (53049, r(gladz_walls + ceil, 2), [A_H, A_WARDROBES], [M_H]),
 (53057, r(walls_net + ceil, 2), [A_H, A_OPENINGS, A_WARDROBES, "malowanie na biało; ściany za zabudową kuchenną liczone"], [M_H]),
 (53073, r(2.5*pts, 1), [A_POINTS], [M_POINTS]),
 (53086, r(corners_out, 1), [A_H, "glify okien wys. 1,50 m"], [M_H, "wysokość okien"]),
 # bathroom
 (53090, 1, ["nowy punkt wod-kan pod baterię bidetową przy WC"], []),
 (53092, 1, [], []),
 (53093, 1, [], []),
 (53094, 1, [], []),
 (53096, r(bath_walls + bath_floor + bath_ceiling, 1), [A_H, "płytki na pełną wysokość ścian"], [M_H]),
 (53100, r(bath_walls + bath_floor, 1), [A_H, "płytki na pełną wysokość ścian"], [M_H]),
 (53103, r(bath_ceiling), [], []),
 (53106, 1, [], []),
 (53108, 1, [], []),
 (53113, 1, [], []),
 (53124, 1, ["odpływ jednospadkowy — pod płytki 120×60"], ["gdzie jest obecny odpływ — od tego zależy przeróbka kanalizacji"]),
 (53127, 1, [], []),
 (53129, 1, ["syfon umywalki"], []),
 (53130, 1, [], []),
 (53131, 1, ["umywalka nablatowa — na rysunku stoi na blacie"], []),
 (53136, 1, [], []),
 (53138, 1, [], []),
 (53140, r(bath_floor + (m(67.5)+m(80.5))*2.0, 1), ["ściany prysznica izolowane do 2,0 m"], []),
 (53142, r(bath_P - d_bath + 5*H, 1), [A_H], [M_H]),
 (53151, r(bath_floor), [], []),
 (53157, r(bath_walls), [A_H, "płytki na pełną wysokość ścian"], [M_H, "czy płytki do sufitu, czy do 2,0 m i malowanie powyżej"]),
 (53159, 1.0, ["≈ 1 mb obłożenia półki prysznicowej — szacunek"], []),
 (53161, 6, ["6 otworów: prysznic 3, umywalka 2, bidetka 1"], []),
 (53163, r(bath_P - d_bath + 2.0, 1), ["narożnik prysznica 2,0 m"], []),
 (53166, 1, ["półka prysznicowa z LED = przedścianka z 1 półką"], []),
 # electrical
 (53219, points_sockets, [A_POINTS], [M_POINTS]),
 (53225, 1, [], []),
 (53234, 1, ["1 zasilacz LED półki"], []),
 (53242, points_light_ceiling, ["3 punkty sufitowe w stropie żelbetowym"], [M_POINTS]),
 (53245, points_light_ceiling + points_led, [A_POINTS], [M_POINTS]),
 (53247, points_sockets, ["6 przesuniętych gniazd — klient pisze „niewielkie przesunięcia”"], [M_POINTS]),
 (53249, 1, [], []),
]

def row(section, description, qty, unit, price, assumptions, missing):
    out = dict(section=section, description=description, qty=qty, unit=unit, clientPrice=price)
    if missing: out['missingData'] = '\n'.join(missing)
    if assumptions: out['assumptions'] = '\n'.join(assumptions)
    return out

out = [row(rows[i]['section'], rows[i]['description'], q, rows[i]['unit'], rows[i]['clientPrice'], a, mi)
       for i, q, a, mi in pick]
out.append(row("Ściany i sufity bez łazienek ", "Wykonanie maskownicy karnisza z płyt GK (stelaż, płyta, taśmowanie, narożnik, przygotowanie do malowania)",
               r(m(211)+m(266)), "mb", 0, [],
               ["brak w katalogu — do wyceny; najbliżej „Zabudowy rur z GK” 350 zł/mb i „Montaż listew sztukateryjnych sufitowych (osłona karnisza)” 110 zł/mb",
                "czy za maskownicami montujemy karnisze"]))
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
    f.write('\n')
total = sum(o['qty'] * o['clientPrice'] for o in out)
print(f"{len(out)} rows, {total:,.2f} zł, {sum('assumptions' in o for o in out)} with assumptions, "
      f"{sum('missingData' in o for o in out)} with missingData")
print(f"walls_net {walls_net:.2f}  gladz {gladz_walls:.2f}  bath_walls {bath_walls:.2f}  acryl {acryl:.2f}  corners {corners_out:.2f}")
