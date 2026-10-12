# Builds measure/ai-draft-load.json for production #203 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). Assumptions go into the row's `assumptions`, unknowns into `missingData`.
# Inputs: the scope the owner typed into Notatki (inputs/client-inquiry.md, a generic deweloperski list) and two
# phone photos of the developer's rzuty, parter and piętro, of a two-lokal building (Lokal 1 / Lokal 2, mirror
# images with identical printed areas). One lokal is priced. The rzuty print room areas, window/door sizes and
# no room dimensions: sides are read off the photos with the scale fixed by the printed areas (≈ 1,5 px/cm on
# the rotated crops), and every perimeter below is checked against its printed area (measurement.md).
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

def pl(x): return f"{x:.2f}".replace(".", ",")

H = 2.68   # nothing printed → Manual: stan deweloperski 2,68 m w świetle, both levels

# Printed areas, one lokal (rzut parter / rzut piętra).
P_wiatrolap, P_przedpokoj, P_aneks, P_salon, P_lazienka, P_schody = 2.51, 2.07, 5.71, 20.78, 3.97, 2.48
G_przedpokoj, G_gabinet, G_pokoj_duzy, G_pokoj_maly, G_lazienka, G_schody = 3.42, 8.69, 10.41, 6.39, 4.63, 1.75
A_parter = P_wiatrolap + P_przedpokoj + P_aneks + P_salon + P_lazienka + P_schody
A_pietro = G_przedpokoj + G_gabinet + G_pokoj_duzy + G_pokoj_maly + G_lazienka + G_schody
A_all = A_parter + A_pietro
A_baths = P_lazienka + G_lazienka
A_vinyl = P_wiatrolap + P_przedpokoj + P_aneks + P_salon + G_przedpokoj + G_gabinet + G_pokoj_duzy + G_pokoj_maly
# Ceilings outside the łazienki: the parter stair area sits under the stair void, the piętro one under the roof slab.
A_ceil = A_vinyl + G_schody

# Measured sides (m), each cross-checked against the printed area.
box_parter = (5.65, 6.93)          # party wall → outer wall, inner faces
stair_bump = 0.63                  # stair bay projecting beyond the outer wall
wiatrolap = (1.73, 1.63)
laz_P = (2.10, 1.89)               # 3,97 m²
pokoj_duzy = (2.50, 4.08)
gabinet = (2.89, 2.93)
pokoj_maly = (2.50, 2.52)
przedpokoj_G = (1.63, 2.04)
laz_G = (2.75, 1.68)               # 4,63 m²; wanna across the 1,68 m end
stairwell_G = 1.87 + 1.84 + 1.87   # three walls around the stair void on the piętro
stair_partition = 3.0              # stair side wall and the boxed corner beside it, both faces

def perim(r): return 2 * (r[0] + r[1])

# Wall length outside the łazienki, per level.
L_parter = (perim(box_parter) + 2 * stair_bump - (laz_P[0] + laz_P[1])     # łazienka's two outer walls are wet
            + 2 * wiatrolap[1] + wiatrolap[1] + 2 * wiatrolap[0]          # wiatrołap walls, inner ones from both sides
            + laz_P[0] + stair_partition)                                 # łazienka wall seen from the hall
L_pietro = (perim(pokoj_duzy) + perim(gabinet) + perim(pokoj_maly)
            + perim(przedpokoj_G) - przedpokoj_G[1] + stairwell_G)        # przedpokój is open to the stairs
L_dry = L_parter + L_pietro

# Openings, printed width × height: tarasowe 200/240, narożne 2 × 150/160, kuchnia 120/150, wejściowe 90/205,
# piętro balkonowe 100/220, okna 120/150 ×2, klatka 120/300; interior doors 80/200 (seen from both sides
# unless one side is a łazienka).
DOOR = 0.80 * 2.00
open_parter = 2.0 * 2.4 + 2 * 1.5 * 1.6 + 1.2 * 1.5 + 0.9 * 2.05 + 3 * DOOR
open_pietro = 1.0 * 2.2 + 2 * 1.2 * 1.5 + 1.2 * 3.0 + 7 * DOOR
walls_dry = L_dry * H - open_parter - open_pietro
kitchen_hidden = 4.5 * 1.8         # L-shaped kitchen run ≈ 4,5 mb, lower + upper cabinets ≈ 1,8 m of wall
walls_gladz = walls_dry - kitchen_hidden

# Łazienki: tiled to the ceiling (assumption), less door 80/200 and window (parter 60/120, piętro 90/150).
walls_laz_P = perim(laz_P) * H - DOOR - 0.6 * 1.2
walls_laz_G = perim(laz_G) * H - DOOR - 0.9 * 1.5
tiles_walls = walls_laz_P + walls_laz_G
tiles_all = tiles_walls + A_baths

# Glify and outer corners for aluminium beads.
glify = (2.0 + 2 * 2.4) + 2 * (1.5 + 2 * 1.6) + (1.2 + 2 * 1.5) + (1.0 + 2 * 2.2) + 2 * (1.2 + 2 * 1.5) + (1.2 + 2 * 3.0)
corners_out = 4 * H
skirting_base = L_dry - (2 * stair_bump + stair_partition + stairwell_G)   # no skirting along the stair walls
skirting = round(skirting_base * 0.75)                                     # katalog: minus 20–30% on zabudowy

pts_new = 5            # Notatki: „około 5 dodatkowych punktów elektrycznych”
bruzdy_el = 2 * pts_new
sockets_dry = 34       # own estimate for a ~73 m² segment, the 5 new included
stair_switches = 2
lamps_dry = 10         # one per room, two in the salon, one over the stairs
doors = 6              # 80/200 on both rzuty: wiatrołap, łazienka (parter); 2 pokoje, gabinet, łazienka (piętro)

A_H = "wysokość 2,68 m — rzut jej nie podaje, Manual: stan deweloperski"
A_PLAN = ("wymiary pomieszczeń odczytane ze zdjęć rzutów w skali z podanych m² (rzuty podają tylko powierzchnie "
          "i wymiary otworów); wycena dla jednego lokalu — oba lokale na rzucie są lustrzane, o tych samych m²")
A_OPEN = "otwory odliczone wg rzutu (szer./wys.): okna, drzwi tarasowe 200/240, wejściowe 90/205, drzwi wewnętrzne 80/200"
M_LOKAL = "czy wycena dotyczy jednego lokalu (segmentu) — rzut pokazuje dwa lustrzane lokale; przy obu ilości ×2"
M_TYNKI = "jakie tynki daje deweloper — przy gipsowych maszynowych gładź może być lżejsza"

draft = []
def add(i, qty, assumptions=None, missing=None):
    r = dict(rows[i]); r['qty'] = round(qty, 2)
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

def add_new(section_of, description, unit, price, qty, assumptions=None, missing=None):
    r = dict(section=rows[section_of]['section'], description=description, unit=unit,
             clientPrice=float(price), qty=round(qty, 2))
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

# — Prace dodatkowe
add(61506, 1, "1 kpl na cały remont — segment dwupoziomowy ok. 73 m², stan deweloperski bez zmian układu",
    "cena j.m. z szablonu 1500 zł; katalog: duże mieszkania deweloperskie ok. 2000 zł, poza Warszawą wyżej — lokalizacja nieznana")
add(61509, 2, "2 big bagi — katalog: rynek pierwotny bez wyburzeń; docinki płytek, paneli, GK, opakowania")
add_new(61506, "Sprzątanie i przygotowanie pomieszczeń do odbioru", "kpl", 0, 1,
        "1 kpl — Notatki: „Uporządkowanie miejsca prowadzenia prac. Przygotowanie pomieszczeń do odbioru.”",
        "brak w szablonie i w katalogu — do wyceny (Cena j.m. pusta)")

# — Wyburzenia, demontaże, zabezpieczenia
add(61524, A_all, f"m² podłogi obu poziomów z klatką schodową (katalog): parter {pl(A_parter)} + piętro {pl(A_pietro)} — Notatki: zabezpieczenie stolarki, schodów i ciągów komunikacyjnych. " + A_PLAN,
    M_LOKAL)
add(61526, 4, "ok. 2 mb na łazienkę (katalog) × 2 łazienki — przeróbki podejść pod stelaże i umywalki",
    "materiał ścian przy podejściach — przy żelbecie 150 zł/mb zamiast 80")
add(61528, bruzdy_el, f"2 mb na punkt (katalog) × {pts_new} nowych punktów z Notatek",
    "materiał ścian — przy żelbecie 45 zł/mb zamiast 25")

# — Podłogi
add(61559, A_vinyl + A_baths, f"pod wylewkę samopoziomującą ({pl(A_vinyl)} m²) i pod płytki w łazienkach ({pl(A_baths)} m²) — Notatki: „Gruntowanie podłoży”")
add(61563, A_vinyl, f"Notatki: wylewka samopoziomująca pod panele winylowe klejone; katalog: pod klejony winyl w 95% przypadków — wszystkie podłogi poza łazienkami i schodami, parter {pl(P_wiatrolap + P_przedpokoj + P_aneks + P_salon)} + piętro {pl(G_przedpokoj + G_gabinet + G_pokoj_duzy + G_pokoj_maly)} m²",
    "stan wylewek dewelopera — jeśli równe, pozycja może się zmniejszyć do pojedynczych pomieszczeń")
add(61588, A_vinyl, "Notatki: „paneli winylowych klejonych w prostym układzie mijankowym” — wszędzie poza łazienkami, także wiatrołap, przedpokój i aneks, które rzut dewelopera opisuje jako „terakota” (Notatki mówią o płytkach tylko w łazienkach)",
    "wiatrołap, przedpokój i aneks: winyl jak w Notatkach czy terakota jak na rzucie dewelopera (gres zamiast winylu na ok. 10,3 m² ≈ +1,0 tys. zł)")
add(61567, skirting, f"obwód bez łazienek i ścian klatki schodowej {pl(skirting_base)} mb minus 25% na zabudowy (katalog: lepiej niedoszacować)",
    "listwy malowane czy gotowe białe (malowanie listew 25 zł/mb nie liczone)")
add(61565, skirting, "tyle samo co listew (katalog)")

# — Ściany i sufity bez łazienek
add(61622, walls_gladz, f"Notatki: gładź na ścianach — ściany bez łazienek: {pl(L_parter)} mb parteru + {pl(L_pietro)} mb piętra × {pl(H)} m minus otwory = {pl(walls_dry)} m², minus ściana za szafkami kuchennymi {pl(kitchen_hidden)} m² (Manual). " + A_H + ". " + A_OPEN,
    M_TYNKI)
add(61620, A_ceil, f"Notatki: gładź na sufitach — sufity bez łazienek: parter {pl(P_wiatrolap + P_przedpokoj + P_aneks + P_salon)} + piętro {pl(G_przedpokoj + G_gabinet + G_pokoj_duzy + G_pokoj_maly + G_schody)} m² (powierzchnie z rzutu; pod schodami parteru brak sufitu)",
    M_TYNKI)
add(61619, 8, "ściany nad biegiem schodów, poza zasięgiem z podłogi — szacunek agenta ok. 8 m²", "wysokość klatki schodowej — rzut jej nie pokazuje")
add(61627, walls_gladz + A_ceil, "Notatki: gruntowanie przed gładzią i ponowne po szlifowaniu — wszystkie ściany i sufity z gładzią")
add(61618, glify + corners_out, f"glify okien i drzwi tarasowych/balkonowych {pl(glify)} mb (wymiary z rzutu) + 4 narożniki zewnętrzne przy klatce schodowej × {pl(H)} m",
    "czy deweloper osadził narożniki na glifach")
add(61611, bruzdy_el, "Notatki: „Uzupełnienie bruzd po wykonaniu instalacji” — tyle, ile bruzd; gładź po bruzdach nie, bo gładź idzie na całe ściany (katalog)")
add(61636, walls_dry + A_ceil, f"Notatki: dwukrotne malowanie ścian i sufitów — ściany {pl(walls_dry)} m² (z pasem za kuchnią) + sufity {pl(A_ceil)} m², zakładam na biało",
    "kolor ścian — w kolorze 26 zł/m² zamiast 22 zł/m²")
add(61630, L_dry + 2 * doors * 5.0, f"Notatki: akrylowanie połączeń ścian i sufitów ({pl(L_dry)} mb) i ościeżnic ze ścianami ({doors} drzwi × 2 strony × ok. 5 mb)")

# — Łazienka (parter: WC + umywalka; piętro: wanna, WC, umywalka, pralka — rzut)
add(61645, 10, "przeróbki podejść pod rzut: stelaże WC 2 × 2 pkt + umywalki 2 × 3 pkt; wanna i pralka zakładam na istniejących podejściach dewelopera",
    "stan podejść dewelopera — czy wanna i pralka mają podejścia w miejscu z rzutu (+250 zł za punkt)")
add(61646, 3, "katalog: w deweloperce rury idą przed ścianą — wkucie zespołów: 2 umywalki + wanna",
    "czy rury dewelopera są przed ścianami czy już w bruzdach (wtedy pozycja wypada)")
add(61648, 2, "Notatki: zabudowy stelaży podtynkowych — WC w obu łazienkach (rzut)")
add(61649, 2, "zabudowa GK obu stelaży")
add(61666, 2 * H, f"Notatki: zabudowy instalacyjne z GK — pion w narożniku każdej łazienki (kółko na rzucie) × {pl(H)} m",
    "czy piony w łazienkach są do zabudowy (na rzucie tylko symbol)")
add(61653, 1, "wanna w łazience na piętrze (rzut) — obudowa z bloczków z rewizją, płytki na froncie")
add(61658, tiles_walls + 2 * A_baths, f"ściany {pl(tiles_walls)} + podłogi i sufity {pl(A_baths)} m² obu łazienek — Notatki: przygotowanie ścian i podłóg pod płytki")
add(61667, tiles_all, f"katalog: w łazience na wszystkich ścianach i podłodze — ściany {pl(tiles_walls)} + podłogi {pl(A_baths)} m²")
add(61669, 32, "ok. 15 mb na łazienkę 4 m² (katalog): parter 3,97 m² → 15 mb, piętro 4,63 m² → 17 mb")
add(61683, tiles_walls, f"płytki do sufitu na wszystkich ścianach (założenie): parter {pl(perim(laz_P))} mb, piętro {pl(perim(laz_G))} mb × {pl(H)} m minus drzwi i okna; front wanny w płytkach w miejsce ściany za wanną. " + A_H,
    "wysokość płytek — przy płytkach do 2,0 m ok. 11,5 m² ścian przechodzi na malowanie (≈ −1,6 tys. zł); format płytek")
add(61676, A_baths, f"podłogi łazienek z rzutu: {pl(P_lazienka)} + {pl(G_lazienka)} m², format standard zakładam", "format płytek podłogowych")
add(61690, tiles_all, "fugowanie = wszystkie płytki (Manual)")
add(61691, 45, "Manual: 20–30 mb na łazienkę — piętro z wanną 25, parter bez prysznica 20")
add(61692, 25, "katalog: parter WC 5 + umywalka 3 + puszki 2 + kratka 1; piętro WC 5 + umywalka 3 + bateria wannowa natynkowa 2 + puszki przy lustrze 2 + pralka 1 + kratka 1")
add(61670, 5, "narożniki zewnętrzne zabudów stelaży i obudowy wanny — szacunek, katalog: przy wątpliwościach nie zawyżaj",
    "czy narożniki szlifowane 45° czy profile")
add(61694, perim(laz_P) + perim(laz_G), "styk płytek z sufitem — obwody obu łazienek (katalog)")
add(61695, A_baths, "sufity łazienek — jedyne powierzchnie bez płytek przy płytkach do sufitu (Notatki: malowanie powierzchni nieobjętych płytkami)")
add(61726, 2, "Notatki: montaż WC — oba WC podwieszane na stelażach")
add(61722, 2, "umywalki w obu łazienkach (rzut) — zakładam wiszące", "umywalki wiszące czy na szafce (szafka + 250 zł, umywalka nablatowa 130 zł)")
add(61697, 2, "baterie umywalkowe natynkowe — standard")
add(61699, 1, "bateria wannowa natynkowa — standard", "bateria podtynkowa: 900 zł + biały montaż 200 zł zamiast 250 zł")
add(61718, 1, "Notatki: montaż kabin i ścianek prysznicowych — na rzucie jest tylko wanna, więc parawan nawannowy",
    "czy w łazience na parterze ma być prysznic — rzut pokazuje tylko WC i umywalkę (brodzik z kabiną, 2 punkty wod-kan i bateria ≈ +2,3 tys. zł)")
add(61724, 2, "syfony umywalek (wanna ma syfon w pozycji wanny)")
add(61715, 2, "Notatki: montaż luster — po jednym w łazience")
add(61696, 6, "Notatki: montaż akcesoriów — po 3 w łazience (wieszak, uchwyt na papier, haczyk)")
add(61713, 2, "kratki wentylacyjne w obu łazienkach — standard wykończenia", "kratka czy wentylator (120 zł)")
add(61727, 1, "pralka „P” w łazience na piętrze (rzut)")
add(61708, 4, "osprzęt w łazienkach: gniazdo przy lustrze w obu + gniazdo pralki i łącznik na piętrze")
add(61714, 2, "Notatki: podstawowe oświetlenie — po jednej lampie w łazience")

# — Montaż stolarki
add(61753, doors, "Notatki: drzwi wewnętrzne z ościeżnicami regulowanymi — 6 otworów 80/200 na rzutach: wiatrołap, łazienka (parter), dwa pokoje, gabinet, łazienka (piętro)",
    "liczba drzwi — czy wiatrołap dostaje drzwi")

# — Elektryka
add(61766, pts_new, "Notatki: „około 5 dodatkowych punktów elektrycznych” — z wierceniem, puszką i kablem", "rozmieszczenie 5 punktów — jest w Notatkach tylko liczba")
add(61792, pts_new, "Notatki: osadzenie puszek — przy każdym nowym punkcie")
add(61773, sockets_dry, f"Notatki: montaż gniazd i łączników — cały osprzęt poza łazienkami, szacunek agenta: salon 8, aneks 6, wiatrołap i przedpokój 3, gabinet 4, pokoje 5 + 4, przedpokój piętra 2, z {pts_new} nowymi",
    "liczba puszek dewelopera — rzut elektryczny nie był dołączony")
add(61774, stair_switches, "łącznik schodowy na dole i na górze schodów — dom dwupoziomowy")
add(61784, lamps_dry, "Notatki: podstawowe oświetlenie — po jednej lampie: wiatrołap, przedpokój, aneks, schody, przedpokój piętra, gabinet, 2 pokoje + 2 w salonie",
    "zakres oświetlenia „zgodnie z ustalonym zakresem” — modele lamp")

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in sorted(by.items(), key=lambda kv: -kv[1]): print(f"{s:42} {v:12.2f}")
print(f"{len(draft)} rows, total {total:.2f}; floor {A_all:.2f} (parter {A_parter:.2f}, piętro {A_pietro:.2f}), vinyl {A_vinyl:.2f}, "
      f"ceil {A_ceil:.2f}, L_parter {L_parter:.2f}, L_pietro {L_pietro:.2f}, walls_dry {walls_dry:.2f}, walls_gladz {walls_gladz:.2f}, "
      f"tiles_walls {tiles_walls:.2f} (P {walls_laz_P:.2f}, G {walls_laz_G:.2f}), glify {glify:.2f}, skirting {skirting} ({skirting_base:.2f})")
