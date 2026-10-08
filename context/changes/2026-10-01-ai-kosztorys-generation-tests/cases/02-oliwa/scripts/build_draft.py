# Builds measure/ai-draft.json from the rozpiska TSV (section/description copied byte-for-byte by id).
import csv, json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-180.tsv'), encoding='utf-8', newline='') as f:
    for line in f.read().split('\n'):
        if not line: continue
        i, sec, desc, unit, price = line.split('\t')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

S = (530/670 + 268/339) / 2            # px per cm, see geometry.py
m = lambda px: px / S / 100
H = 2.65                                 # ASSUMED ceiling height
DOOR_H_HIGH = 2.40                       # ASSUMED "drzwi wysokie"
DOOR_H_ENTRY = 2.05                      # ASSUMED entrance door
WIN_H = 1.50                             # ASSUMED window height

# perimeters / areas from geometry.py
P_open, A_open = 25.97, 25.83
P_bed, A_bed = 13.40, 10.76
A_floor = round(A_open + A_bed, 2)
d_entry, d_bath, d_bed = m(83), m(70), m(76)
w_bed, w_sal = m(130), m(200)
open_openings = d_entry*DOOR_H_ENTRY + d_bath*DOOR_H_HIGH + d_bed*DOOR_H_HIGH + w_sal*WIN_H
bed_openings = d_bed*DOOR_H_HIGH + w_bed*WIN_H
walls_open = P_open*H - open_openings
walls_bed = P_bed*H - bed_openings
walls_net = walls_open + walls_bed
kitchen_walls = (m(196) + m(198)) * H
gladz_walls = walls_net - kitchen_walls
ceil = A_floor
acryl = P_open + P_bed + 12*H
corners_out = 4*H + (w_bed + 2*WIN_H) + (w_sal + 2*WIN_H)
# skirting: perimeter minus kitchen run, built-in wardrobes, door openings
kit = m(196)+m(198); alcove = m(60)+m(77)+m(55); closet = m(50)+m(80); wardrobe = m(49)+m(143)
listwy = (P_open - kit - alcove - closet - d_entry - d_bath - d_bed) + (P_bed - wardrobe - d_bed)
# bathroom
bath_floor = m(125)*m(233) - m(48)*m(30) - m(75)*m(15)   # minus pion block, minus geberit box
bath_ceiling = m(125)*m(233) - m(48)*m(30)
bath_P = m(716)
bath_walls = bath_P*H - d_bath*DOOR_H_HIGH
points_sockets, points_light_ceiling, points_led = 6, 3, 4
pts = points_sockets + points_light_ceiling + points_led

r = lambda x, n=2: round(x + 1e-9, n)
pick = [
 (52946, 1, "assumed — standard house overhead: transport/wniesienie materiałów"),
 (52949, 1, "assumed — gruz z 2 nadproży, bruzd, łazienki ≈ 1 big bag"),
 (52966, r(2.5*(points_sockets+points_led)), f"assumed — owner rule 2,5 mb/pkt × {points_sockets+points_led} pkt ściennych (6 gniazd + 4 zasilania LED)"),
 (52967, r(2.5*points_light_ceiling), "assumed — owner rule 2,5 mb/pkt × 3 pkt sufitowe (lampy wiszące) w stropie żelbetowym"),
 (52969, 1, "read — client: demontaż kaloryfera w salonie"),
 (52997, 2, "read — client: usunięcie nadproży pod drzwi wysokie ×2 (łazienka, sypialnia)"),
 (52998, r(A_floor + bath_floor, 1), "measured — powierzchnia podłóg mieszkania (36,59 + łazienka 4,25)"),
 (53007, A_floor, "measured — podłoga pod panele (hol+kuchnia+salon 25,83 + sypialnia 10,76); client ~36 m²"),
 (53011, A_floor, "measured — owner: winyl klejony, niski stopień → układ prosty; 36,59 m² ≈ client ~36"),
 (53014, r(listwy, 1), "measured — obwody minus zabudowa kuchni, szafy wnękowe, otwory drzwiowe"),
 (53015, r(d_bath), "measured — próg łazienka/hol, szer. otworu"),
 (53039, r(acryl, 1), "measured — styki sufit-ściana 39,37 mb + 12 narożników wewn. × 2,65"),
 (53042, ceil, "measured — sufity bez łazienki (hol+kuchnia+salon+sypialnia)"),
 (53044, r(gladz_walls, 2), "measured — ściany netto 89,18 minus ściany za zabudową kuchenną 13,20 (H=2,65 assumed)"),
 (53049, r(gladz_walls + ceil, 2), "measured — = gładź ścian + sufitów"),
 (53057, r(walls_net + ceil, 2), "measured — ściany netto 89,18 + sufity 36,59; kolor biały assumed"),
 (53073, r(2.5*pts, 1), "assumed — = długość bruzd (13 pkt × 2,5 mb)"),
 (53086, r(corners_out, 1), "measured — 4 narożniki zewn. × 2,65 + krawędzie glifów 2 okien (wys. 1,5 assumed)"),
 # bathroom
 (53090, 1, "assumed — nowy punkt wod-kan pod baterię bidetową przy WC"),
 (53092, 1, "read — client: bidetowa bateria do WC (podtynkowa)"),
 (53093, 1, "read — client: baterie podtynkowe; plan: bateria ścienna przy umywalce"),
 (53094, 1, "read — client: walk-in, baterie podtynkowe; plan: deszczownica + słuchawka"),
 (53096, r(bath_walls + bath_floor + bath_ceiling, 1), "measured — ściany 21,87 + podłoga 4,25 + sufit 4,43"),
 (53100, r(bath_walls + bath_floor, 1), "measured — = płytki ścian + podłogi"),
 (53103, r(bath_ceiling), "measured — sufit łazienki 157×296 minus blok pionu"),
 (53106, 1, "read — client: bateria podtynkowa w prysznicu walk-in (podejście)"),
 (53108, 1, "read — client: bateria podtynkowa umywalkowa (podejście)"),
 (53113, 1, "read — plan: obudowany geberit"),
 (53124, 1, "read — client: odpływ liniowy; jednospadkowy assumed (płytki 120×60)"),
 (53127, 1, "read — plan: obudowany geberit (zabudowa GK)"),
 (53129, 1, "assumed — syfon umywalki"),
 (53130, 1, "read — plan: szyba walk-in"),
 (53131, 1, "read — plan: umywalka na blacie"),
 (53136, 1, "read — plan: WC podwieszane na gebericie"),
 (53138, 1, "read — plan: zabudowa na pralkę"),
 (53140, r(bath_floor + (m(67.5)+m(80.5))*2.0, 1), "measured — podłoga 4,25 + 2 ściany prysznica (0,86+1,02) × 2,0 m"),
 (53142, r(bath_P - d_bath + 5*H, 1), "measured — styk ściana-podłoga 8,16 + 5 narożników wewn. × 2,65"),
 (53151, r(bath_floor), "measured — podłoga łazienki minus pion i geberit; płytki 120×60 = format standard"),
 (53157, r(bath_walls), "measured — obwód 9,05 × 2,65 (pełna wysokość assumed) minus drzwi"),
 (53159, 1.0, "assumed — obłożenie półki prysznicowej ~1 mb"),
 (53161, 6, "assumed — otwory: prysznic 3, umywalka 2, bidetka 1"),
 (53163, r(bath_P - d_bath + 2.0, 1), "measured — styk ściana-podłoga 8,16 + narożnik prysznica 2,0"),
 (53166, 1, "read — client: półka prysznicowa z LED → przedścianka z 1 półką"),
 # electrical
 (53219, points_sockets, "assumed — osprzęt do 6 przesuniętych gniazd"),
 (53225, 1, "read — client: półka prysznicowa z LED"),
 (53234, 1, "assumed — zasilacz LED półki"),
 (53242, points_light_ceiling, "assumed — 3 pkt sufitowe w stropie żelbetowym"),
 (53245, points_light_ceiling + points_led, "assumed — client: elektryka pod lampy wiszące (3) i pod LED (4: salon, sypialnia, kuchnia, półka)"),
 (53247, points_sockets, "assumed — client: niewielkie przesunięcia gniazdek, przyjęto 6"),
 (53249, 1, "read — client: montaż nowego kaloryfera w salonie"),
]
out = []
total = 0
for i, q, src in pick:
    p = rows[i]
    out.append(dict(id=i, section=p['section'], description=p['description'], unit=p['unit'], qty=q, clientPrice=p['clientPrice'], source=src))
    total += q * p['clientPrice']
out.append(dict(id=None, section="Ściany i sufity bez łazienek ", description="Wykonanie maskownicy karnisza z płyt GK (stelaż, płyta, taśmowanie, narożnik, przygotowanie do malowania) — brak w katalogu, do wyceny",
                unit="mb", qty=r(m(211)+m(266)), source="measured — narysowana linia maskownicy przy oknach: sypialnia 2,67 + salon 3,36"))
os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(f"positions {len(out)}  total {total:.2f}")
for k, v in dict(walls_open=walls_open, walls_bed=walls_bed, open_openings=open_openings, bed_openings=bed_openings, walls_net=walls_net,
                 kitchen_walls=kitchen_walls, gladz_walls=gladz_walls, ceil=ceil, acryl=acryl, corners_out=corners_out, listwy=listwy,
                 bath_floor=bath_floor, bath_ceiling=bath_ceiling, bath_P=bath_P, bath_walls=bath_walls).items():
    print(f"{k}: {v:.2f}")
for o in out:
    print(o['id'], o['qty'], o['unit'], o.get('clientPrice'), round(o['qty']*o.get('clientPrice', 0), 2))
