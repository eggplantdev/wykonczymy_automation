# Builds measure/ai-draft-load.json for production #198 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). Assumptions go into the row's `assumptions`, unknowns into `missingData`.
# Source: two interior-designer drawing sets, parter (28.05.2025) and piętro (17.06.2025), PDFs with PRINTED
# dimensions "do surowych ścian" — no scale derivation needed. Page refs: P = parter, G = piętro (PIETRO PDF).
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

def pl(x): return f"{x:.2f}".replace(".", ",")

H_P = 2.80   # parter: elevations print 2800 (P)
H_G = 2.75   # piętro: sections print 2750 (G p.10-13)

# Printed areas.
P_floor = 41.08        # Zimba Light Grey 1198 x 598, whole parter (P)
P_wc_floor = 2.11      # parter WC, suspended GK ceiling, same area
P_gab_ceil = 4.02
G_wood = 44.23         # Kahrs Dab Saffron (G p.6)
G_bath_floor = 9.14    # left bathroom, Zimba Black (G p.6)
G_wet_floor = 6.35     # wet room (WC + shower), 6,61 ceiling (G p.4)
G_wet_ceil = 6.61
spiek = 8.75           # Laminam Travertino Beige, kitchen niche (P)
mirror_wall = 4.26     # parter graphite mirror wall (P)
tapeta = 7.46          # Enchanted River, bath window wall (G p.13)

floors_all = P_floor + P_wc_floor + G_wood + G_bath_floor + G_wet_floor

# Wet-room walls tiled to the suspended ceiling (G p.20: tiles run the full height in 1200 modules).
wet_walls = 2 * (2.47 + 2.675) * 2.65 - 0.90 * 2.10
bath_walls = 14.0       # left bathroom: basin wall + part of the tub niche; the rest is wallpaper/mirror/paint
G_tile_walls = wet_walls + bath_walls
wc_perim = 2 * (0.93 + 2.27)
P_wc_walls = wc_perim * H_P - 0.90 * 2.10   # Lounge Stone Brown 1198 x 1198 to the ceiling (P)

# Ceilings.
ceil_cream = P_floor + P_gab_ceil + 11.38 + 10.34          # RAL 9001: parter + piętro salon/gabinet
ceil_dark = 28.17 + 11.5                                   # RAL 9005 existing, piętro (G p.4)
ceil_gk = P_wc_floor + G_wet_ceil

# Painted walls, estimated: perimeter x height minus glazing, doors, tile, spiek, mirror, furniture walls.
walls_P = 60.0
walls_G = 95.0
walls = walls_P + walls_G

# Electrics: counts from the two legends (P p.09, G p.09).
sockets_P, sockets_G = 14 + 3 + 1, 16 + 2 + 4
sw_stair = (7 + 1) + (2 + 9)
sw_plain = (1 + 1) + (3 + 3)
pts_dev = sockets_P + sockets_G + sw_stair + sw_plain
lamps_P, lamps_G = 13 + 1 + 2 + 2 + 1, 18 + 2 + 1 + 1 + 4 + 2 + 1 + 1 + 1 + 1
lamps = lamps_P + lamps_G
lamps_hard = 8       # pendants / floor-style fittings (Amarela, Baton, Mono, Vertic, Agnes, Delta)
bruzdy_el = min(2 * (pts_dev + lamps), 200)
nwk = 14             # wod-kan points: piętro 9 + parter WC 2 + kitchen 3
bruzdy_wk = 21
led_mb = 50          # stair treads 12 + 11, kitchen LED apart, WC/wet room/bath/wardrobe niches, TV shelves
curtain_mb = 22.9    # maskownica h150: piętro window walls ~12,9 + parter glazing ~10

A_FLOOR = f"parter {pl(P_floor + P_wc_floor)} + piętro {pl(G_wood + G_bath_floor + G_wet_floor)} m² (powierzchnie podane na rysunkach)"

draft = []
def add(i, qty, assumptions=None, missing=None):
    r = dict(rows[i]); r['qty'] = round(qty, 2)
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

# — Prace dodatkowe
add(59994, 1, "dom dwupoziomowy, materiały na oba poziomy", "cena j.m. z szablonu 1500 zł; przy tym zakresie wykończeń ok. 2000–2500 zł")
add(59998, 1, "ściana do wyburzenia 8 m² + otwór do zamurowania + drobne demontaże ≈ 4 big bagi → kontener (Manual); dom, więc stawka „parter”", "ile realnie gruzu")

# — Wyburzenia, demontaże, zabezpieczenia
add(60012, floors_all, f"zabezpieczenie podłóg obu poziomów: {A_FLOOR}", "czy dom jest zamieszkany w trakcie (stawka 45 zł)")
add(60042, 2.28 * H_G + 0.6 * H_P, f"„ściana do wyburzenia”: piętro ok. 2,28 m × {pl(H_G)} (G p.3) + parter 0,6 m × {pl(H_P)} (P p.3), grubość ok. 10 cm → materiał miękki do 12 cm",
    "długość piętrowej ściany odczytana z wymiaru 2280 — do sprawdzenia; materiał (GK czy murowana)")
add(60014, bruzdy_wk, f"{nwk} punktów wod-kan × ok. 1,5 mb; „wyprowadzenia prowadzić podtynkowo” (G p.5)", "materiał ścian — żelbet: 150 zł/mb zamiast 80")
add(60016, bruzdy_el, f"2 mb na punkt (Manual): {pts_dev} gniazd/łączników + {lamps} opraw = {2 * (pts_dev + lamps)} mb, limit 200 mb dla domu > 100 m²", "materiał ścian — żelbet: 45 zł/mb zamiast 25")
add(60250, 6, "drzwi ukryte i zlicowane: otwory do dopasowania pod S.O. 800 × 2500 (P p.3, G p.3), parter 2 + piętro 4", "czy otwory trzeba poszerzyć (350 zł/szt.)")

# — Podłogi
add(60047, floors_all, "gruntowanie wszystkich nowych podłóg (płytki i deski)")
add(60051, floors_all, "„podłogi na tym samym poziomie, H wylewek pod grubość materiałów” (G p.6) — wylewka samopoziomująca pod płytki wielkoformatowe i deski",
    "stan istniejących wylewek — po obejrzeniu; jeśli równe, pozycja wypada (−5,7 tys. zł)")
add(60066, P_floor, "parter: gres Zimba Light Grey 1198 × 598, cała podłoga (P)")
add(60164, G_bath_floor + G_wet_floor, f"piętro: Zimba Black 1198 × 598, łazienka {pl(G_bath_floor)} + mokra {pl(G_wet_floor)} m² (G p.6)")
add(60083, G_wood, "Kahrs Life Authentic Dąb Saffron 1980 × 193 × 10, prostopadle do okien (G p.6) — wzięta pozycja parkietu (układ mijanka)",
    "technologia: klejenie czy pływająca; deska warstwowa 10 mm może być bliżej paneli (60–75 zł/m²)")
add(60054, 57, "czarna listwa aluminiowa PALUBO LPK20 (P, G p.6): parter ok. 20 mb + piętro ok. 37 mb (obwód minus zabudowy stolarskie ok. 30%), montaż po zabudowach",
    "obwód z rysunków — liczony szacunkiem")
add(60059, 3, "dylatacja płytki–deska cofnięta w kierunku łazienki, korek/silikon (G p.6): 3 przejścia po ok. 0,9–1,0 m")
add(60073, P_floor, "fugowanie podłogi parteru: Mapei 111, 2 mm (P)")

# — Ściany i sufity bez łazienek
add(60084, 8.5, "wykładzina lustrzana parteru 4,26 m²: 3 moduły 696 mm na 1, 2 i 3 warstwach płyty GK 12,5 mm (P p.3) = 6 warstw × ok. 1,42 m²")
add(60089, G_wet_ceil, f"sufit podwieszany GK (−100 mm) w pomieszczeniu mokrym piętra, 4 oprawy podtynkowe (G p.4)")
add(60094, 0.9 * 2.5, "„otwór drzwiowy do zamurowania” 0,9 × 2,5 m, piętro (G p.3)", "grubość i materiał ściany")
add(60099, bruzdy_el + bruzdy_wk, "tynkowanie bruzd elektrycznych i wod-kan")
add(60100, bruzdy_el + bruzdy_wk, "gładź po bruzdach")
add(60113, 6 * (0.9 + 2 * 2.5), "drzwi ukryte/zlicowane ze ścianą (6 szt.): obwód 5,9 mb × 6")
add(60116, ceil_cream + ceil_dark, "gruntowanie sufitów istniejących, malowanych")
add(60117, walls, f"gruntowanie z drobnymi poprawkami ścian malowanych: parter ok. {pl(walls_P)} + piętro ok. {pl(walls_G)} m²",
    "stan ścian: założone istniejące i gładkie; jeśli surowe/deweloperskie, brakuje gładzi premium 75 zł/m² ≈ +11,6 tys. zł")
add(60118, 80, "akrylowanie sufit–ściana: obwód parteru ok. 27 mb + piętra ok. 53 mb")
add(60120, ceil_cream, f"sufity istniejące RAL 9001: parter {pl(P_floor + P_gab_ceil)} + piętro {pl(11.38 + 10.34)} m² (P, G p.4)")
add(60121, ceil_dark, "sufity istniejące piętra RAL 9005 (czarny): 28,17 + 11,5 m² (G p.4)", "krycie czarnego na istniejącym: ewentualnie dodatkowa warstwa")
add(60125, walls, f"ściany w kolorze RAL 9001/8025/7022 (parter ok. {pl(walls_P)}, piętro ok. {pl(walls_G)} m²): obwód × wysokość minus przeszklenia, drzwi, płytki, spiek, lustra, ściany zabudów",
    "powierzchnia szacunkowa — rysunki nie podają ścian; ±20 m² ≈ ±520 zł")
add(60128, curtain_mb, "maskownice karniszy h150 mm, malowane RAL 9005, cięcie 45° (P, G p.4): piętro 4 ściany z oknami ok. 12,9 mb + parter przeszklenie ok. 10 mb", "długości odczytane z rzutów")
add(60129, curtain_mb, "malowanie maskownic")
add(60130, curtain_mb, "karnisze elektryczne, wypust 230 V pod karnisz (G p.8)", "czy karnisze montujemy my czy dostawca")
add(60131, tapeta, "tapeta „Enchanted River” 7,46 m² na ścianie okiennej łazienki (G p.13), rolka 272 × 275 cm")

# — Łazienka
add(60133, 11, "wod-kan: piętro 9 (wanna wolnostojąca 1, umywalki 3, WC 1, bidet 1, prysznic 1, pralka 1) + parter WC 2")
add(60134, 6, "wkucia w ścianę działową: umywalki i baterie podtynkowe (G p.5)")
add(60136, 2, "stelaż WC: parter i piętro")
add(60137, 2, "zabudowa stelaża GK: parter (płyta meblowa, 180 mm) i piętro (płytki, 150 mm)")
add(60139, 1, "odpływ liniowy 1000 mm, spadek jednostronny, wykończony płytką (G p.5, p.6)")
add(60155, 56, f"hydroizolacja: mokra: ściany {pl(wet_walls)} + podłoga {pl(G_wet_floor)}; łazienka: podłoga {pl(G_bath_floor)} + ściany do 1,2 m")
add(60158, 40, "narożniki zewnętrzne płytek ze szlifem 45° (G p.6: „wszystkie narożniki wykończone płytkami ze szlifem 45”), wnęki wkute w ścianę (3 szt.)",
    "liczba narożników z rzutów — szacunek; wnęk wkutych w ścianie nie ma w szablonie jako osobnej pozycji")
add(60162, P_wc_floor, "parter WC: podłoga w płytce 1198 × 1198 (P)")
add(60170, P_wc_walls, f"parter WC: Tubądzin Lounge Stone Brown 1198 × 1198 do sufitu, ściany {pl(P_wc_walls)} m²")
add(60171, G_tile_walls, f"piętro, płytka 1198 × 598: pomieszczenie mokre {pl(wet_walls)} m² (do sufitu, G p.20) + łazienka ok. {pl(bath_walls)} m²",
    "ściany łazienki z wanną: rysunki nie podają powierzchni płytki — założone 14 m²; każdy m² = 180 zł")
add(60172, spiek, "spiek Laminam Travertino Beige 8,75 m² klejony w niszy kuchennej (P)", "format płyt i stawka — spiek wielkoformatowy może wyjść powyżej 550 zł/m²")
add(60175, G_tile_walls + G_bath_floor + G_wet_floor, "piętro: fuga epoksydowa Mapei Kerapoxy 120 Nero, 2 mm (G p.6, p.12) — wszystkie płytki")
add(60178, P_wc_walls + P_wc_floor + spiek, "parter: fugowanie WC i spieku")
add(60179, 75, "silikon 20–30 mb na łazienkę (Manual) × 3 łazienki (parter WC, piętro 2) = 25 mb × 3")
add(60183, ceil_gk, "sufity z gładzią i malowaniem: parter WC 2,11 + piętro mokre 6,61 m²")
add(60149, 1, "parter WC: sufit podwieszany GK, −100 mm, szczelina LED po obwodzie, RAL 9005 (P)")
add(60184, 8, "akcesoria: szczotka, uchwyt papieru, haczyki, wieszaki — 3 łazienki")
add(60185, 3, "baterie umywalkowe stojące na blacie: 2 w łazience + 1 w mokrym (G p.5)")
add(60188, 1, "parter: umywalka wisząca z baterią wbudowaną (P)")
add(60186, 1, "bateria prysznicowa podtynkowa z deszczownicą — pomieszczenie mokre (G p.20)")
add(60193, 1, "biały montaż baterii prysznicowej ze słuchawką i deszczownicą")
add(60189, 1, "bateria wolnostojąca podłogowa przy wannie (G p.5)")
add(60211, 1, "wanna wolnostojąca z syfonem (G p.2)", "model wanny: oś odpływu po dostarczeniu")
add(60214, 2, "WC podwieszane: parter i piętro (stelaże)")
add(60190, 1, "bidet w pomieszczeniu mokrym (G p.5: „wyprowadzenie wod-kan dla bidetka”)", "bidet misa czy tylko słuchawka")
add(60208, 1, "szyba walk-in w profilu podtynkowym, wpuszczonym w płytki (G p.6); drugie źródło: szyba 2750 × 1100 grafit (G p.13)")
add(60209, 3, "umywalki nablatowe: 2 w łazience + 1 w mokrym (G p.2, p.5)")
add(60210, 1, "parter WC: umywalka wisząca")
add(60212, 4, "syfony umywalek (wanna ma syfon w pozycji wanny)")
add(60203, 7, "lustra grafitowe klejone: parter 3 moduły (P), piętro 4 (sypialnia, łazienka 1,27 m², ściana przy schodach) — dostawa i cięcie szklarza", "podział tafli do ustalenia ze szklarzem")
add(60204, 1, "lustro okrągłe wiszące z LED w pomieszczeniu mokrym (G p.20)")
add(60201, 3, "kratki wentylacyjne: łazienka i mokre piętra, parter WC")

# — Kuchnia
add(60228, 5, "AGD w zabudowie: lodówka, zmywarka, płyta indukcyjna 80 cm, piekarnik, mikrofala (P)")
add(60229, 1, "bateria zlewozmywakowa (P)")
add(60230, 4.8, "LED blatu roboczego 3,78 mb + uchwyt korytkowy (P, obwód nr 12)")
add(60232, 1, "syfon zlewu")
add(60233, 1, "zlew w blacie spiekowym (blat dostarcza stolarz/blaciarz)")
add(60235, 1, "indukcja 400 V (P)")
add(60236, 1)
add(60237, 1)

# — Montaż stolarki
add(60242, 6, "drzwi ukryte, zlicowane ze ścianą, lakier RAL 8025 (parter 2) / RAL 7022 (piętro 4), S.O. 800 × 2500 (P p.3, G p.3)",
    "liczba drzwi: policzona z rzutów; przegroda stalowo-szklana z drzwiami podwójnymi — robi firma zewnętrzna")

# — Elektryka
add(60252, lamps + 2, f"oprawy z wykazów: parter {lamps_P} + piętro {lamps_G} (P p.08, G p.07) + 2 czujki ruchu")
add(60254, pts_dev, f"gniazda i łączniki z legend: parter {sockets_P} gniazd + {sw_plain // 2 + 1} łączniki zwykłe, piętro {sockets_G} gniazd, schodowe {sw_stair} (P, G p.09)",
    "czy wszystkie punkty są nowe — założone przebudowa całej instalacji")
add(60261, pts_dev - sw_stair, "montaż osprzętu bez schodowych (czarny, ramki zintegrowane)")
add(60262, sw_stair, "łączniki schodowe: parter 8 + piętro 11")
add(60265, 4, "TV/RTV + internet, parter i piętro (po 2)")
add(60271, lamps_hard, "oprawy z montażem: Amarela ×2, Baton ×2, Mono, Vertic ×2, Agnes, Delta ×2 (mniejszy zestaw)")
add(60272, lamps - lamps_hard, "oprawy proste (spoty, kinkiety, BAR LED, UNO)")
add(60277, led_mb, f"taśmy LED: oświetlenie stopni (parter + piętro), blat poza kuchnią, WC, nisze (G p.8: obwody 3, 5, 7, 10, 12, 13, 15, 17) — szacunek ok. {led_mb} mb",
    "długość z rysunków (pomarańczowe zasięgi) — szacunek ±15 mb")
add(60278, 8, "zasilacze LED: 8 obwodów (parter 3, 5, 12; piętro 7, 10, 13, 15, 17)")
add(60279, 1, "okap — gniazdo H 2100–2200 (P)")
add(60281, 2, "TV 50” na uchwycie ściennym (G p.10) + salon parteru")
add(60258, 1, "płyta indukcyjna 400 V (P p.09)")
add(60286, 1, "rozdzielnia do 24 modułów — liczba obwodów z legend (parter i piętro razem > 20)", "stan istniejącej rozdzielni, przebudowa czy nowa")

# — Wod-kan + c.o.
add(60294, 3, "kuchnia parteru: zlew, zmywarka, lodówka z kostkarką (P p.09)")

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in sorted(by.items(), key=lambda kv: -kv[1]): print(f"{s:42} {v:12.2f}")
print(f"{len(draft)} rows, total {total:.2f}; floors {floors_all:.2f}, wet_walls {wet_walls:.2f}, wc_walls {P_wc_walls:.2f}, G_tile_walls {G_tile_walls:.2f}, pts_dev {pts_dev}, lamps {lamps}, bruzdy_el {bruzdy_el}")
