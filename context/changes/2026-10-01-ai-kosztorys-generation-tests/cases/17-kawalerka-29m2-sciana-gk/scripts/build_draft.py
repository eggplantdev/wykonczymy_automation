# Builds measure/ai-draft-load.json for production #209 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). Assumptions go into the row's `assumptions`, unknowns into `missingData`.
# Inputs: the scope the client wrote into Notatki (inputs/client-inquiry.md) and the developer's three sheets for
# lokal 75 (karta branżowa with dimensions and the electrical/water symbols, its legend, karta informacyjna with the
# printed areas). Dimensions are printed „w świetle ścian nie uwzględniając 1,5 cm tynku”; areas are printed after
# tynk. No height on any sheet. The client's own plan with the new walls in colour was not among the files.
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

def pl(x): return f"{x:.2f}".replace(".", ",")

H = 2.70                         # Notatki: „przyjmujemy 2,7m”
A_HOL, A_POKOJ, A_LAZ = 3.63, 20.56, 4.90
A_FLAT = A_HOL + A_POKOJ + A_LAZ  # 29,09 printed

# — Łazienka: main part 187,5 × 212, shower recess 123,5 × 80 below it, beside it the 64 × 80 shaft step.
# Right wall (from the hol): WC on a stelaż, pralka, umywalka — the client swaps pralka and umywalka.
laz_perim = 2.92 + 1.235 + 0.80 + 0.64 + 2.12 + 1.875
laz_door = 0.80 * 2.00
laz_walls = laz_perim * H - laz_door
tray = 1.20 * 0.80
laz_floor_tiles = A_LAZ - tray
recess_tiles = (0.80 + 1.235 + 0.80) * H          # three walls of the wnęka, to the ceiling
step_tiles = 0.64 * H                              # shaft step face beside the pralka, 45° corner to the shower
sink_tiles = 0.80 * H                              # strip at the umywalka, to the ceiling
BAND = 1.80                                        # right wall „do ok. połowy/ 3/4 ściany”
band_len = 2.12 - 0.80
band_tiles = band_len * BAND
stelaz_extra = 0.40                                # top and side of the geberit box
laz_wall_tiles = recess_tiles + step_tiles + sink_tiles + band_tiles + stelaz_extra
laz_painted = 2.12 * H + (1.875 * H - laz_door) + band_len * (H - BAND)
laz_tiles_all = laz_wall_tiles + laz_floor_tiles
corner_45 = 2 * H + (2 * 0.60 + 2 * 1.20)          # pion step corner × 2 + stelaż top and side edges × 2
akryl_laz = (0.80 + 1.235 + 0.80 + 0.64 + 0.80) + BAND  # tiles meeting the ceiling + band against the top wall
clean_cut = H + 2 * (H - BAND) + band_len          # exposed tile edges against painted walls (asked, not counted)

# — Hol + pokój z aneksem (one open space). Walls with gładź, in mb of the plan:
w_left = 4.245            # window wall
w_pion = 0.615 * 2        # pion box in the kitchen corner, two faces
w_divider_end = 0.10      # end of the kitchen/wardrobe divider
w_entrance = 1.225        # entrance wall below the wardrobe zone
w_bath_top = 1.975        # bathroom wall on the hol side
w_bath_left = 3.02        # bathroom wall on the pokój side
w_bottom = 4.37           # balkon-door wall
dry_perim = w_left + w_pion + w_divider_end + w_entrance + w_bath_top + w_bath_left + w_bottom
openings = 1.05 * 2.23 + 2.00 * 2.53 + 0.90 * 2.00 + 0.80 * 2.00
walls_existing = dry_perim * H - openings
KITCHEN_WALL = 3.565      # „ściana w kuchni 356cm bez gładzi i malowania”
WARDROBE_WALL = 2.065     # „ściana z szafą 2m bez gładzi”

GK_L = 1.60
gk_wall = GK_L * H
walls_gladz = walls_existing + 2 * gk_wall
ceil_dry = A_HOL + A_POKOJ
paint_dry = walls_gladz + ceil_dry
mleczko = walls_existing + ceil_dry
gk_tape = 2 * H + 2 * GK_L + 2 * H                  # junction to the existing wall both sides, ceiling both sides, one board joint per side
gk_corners = 2 * H                                  # the free end of the new wall

kitchen_floor = 3.565 * 0.615
panels = A_HOL + A_POKOJ - kitchen_floor
skirting = dry_perim - (2.00 + 0.90 + 0.80) + 2 * GK_L + 0.10

# — Elektryka (Notatki, pokój): light a,b moved; g,h new; switches a,b,c,s moved (2 boxes on the plan);
# two double sockets on the GK wall; two new switches for g,h.
L_POINTS = 3
SW_MOVED, SOCKETS, SW_NEW = 2, 4, 2
E_POINTS = SW_MOVED + SOCKETS + SW_NEW
LAZ_E = 1                                           # pralka socket follows the pralka
bruzdy_el = 2 * (L_POINTS + E_POINTS + LAZ_E)

A_H = f"wysokość {pl(H)} m z Notatek („przyjmujemy 2,7m”) — żaden rysunek jej nie podaje; Manual dla deweloperki: 2,68 m"
A_PLAN = "wymiary z karty branżowej lokalu 75 — w świetle ścian bez 1,5 cm tynku, więc m² ścian są lekko zawyżone (ok. 1–2%)"
M_COLOR_PLAN = "rzut klienta z nową ścianą GK (pomarańczowa) i ścianą ażurową (brązowa) nie był w plikach — miejsca obu ścian nieznane"
M_OSPRZET = "„Instalacja oświetlenia, gniazdek i włączników po mojej stronie” odczytane jako osprzęt i lampy klienta; jeśli to cała elektryka, punkty w pokoju wypadają (≈ −2,4 tys. zł z bruzdami i ich tynkowaniem)"
M_DRAINS = "Notatki mówią tylko o przesunięciu ciepłej i zimnej wody — jeśli odpływy umywalki i pralki zostają, −2 pkt (−500 zł)"
M_STRUCT = "czy prawa ściana łazienki (obudowa pionów) to ściana działowa — przy żelbecie wkucie 500 zł za zespół (+750 zł)"

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
add(50402, 1, "1 kpl — katalog: małe mieszkanie w całości 1500 zł; parter, wnoszenie przez ogródek, dojazd autem pod ogródek, parking (Notatki)")
add(50405, 2, "Manual: rynek pierwotny bez wyburzeń — 2 big bagi total; ścinki płytek, GK, paneli i opakowania")

# — Wyburzenia, demontaże, zabezpieczenia
add(50454, A_FLAT, f"m² podłogi całego lokalu {pl(A_FLAT)} (katalog) — stawka podstawowa, lokal niezamieszkany")
add(50425, 2, "grzejnik łazienkowy (lewa ściana łazienki) i grzejnik w pokoju przy drzwiach balkonowych — symbole z legendy; katalog: na rynku pierwotnym prawie zawsze demontaż do prac")
add(50420, 2, "katalog: ok. 2 mb na łazienkę — przesunięcie podejść przy zamianie pralki z umywalką")
add(50422, bruzdy_el, f"katalog: 2 mb na punkt × {L_POINTS + E_POINTS + LAZ_E} punktów (3 świetlne, {E_POINTS} gniazd/łączników w pokoju, gniazdo pralki w łazience)",
    "gniazda na nowej ścianie GK idą w stelażu — bruzda tylko do ściany, więc ilość może spaść o ok. 4 mb (≈ −200 zł z tynkowaniem)")

# — Podłogi
add(50486, panels, f"Notatki: panele laminowane 10 mm w holu i pokoju z aneksem — {pl(A_HOL)} + {pl(A_POKOJ)} m² minus pas pod szafkami kuchennymi {pl(kitchen_floor)} m² (356,5 × 61,5)",
    f"czy panele idą pod zabudowę szafy w holu ({pl(2.065 * 0.615)} m², ≈ 76 zł); ściana ażurowa kotwiona do podłogi — stawiana na panelach czy przed nimi. {M_COLOR_PLAN}")
add(50470, skirting, f"obwód holu i pokoju bez kuchni, szafy i otworów drzwiowych {pl(dry_perim - 3.70)} mb + nowa ściana GK obustronnie {pl(2 * GK_L + 0.10)} mb — zabudowy już odjęte, więc bez dalszych 20–30% (katalog)",
    "listwy MDF malowane czy gotowe białe (malowanie listew 25 zł/mb nie liczone)")
add(50458, skirting, "tyle samo co listew (katalog)")
add(50471, 0.80, "przejście panele/płytki w drzwiach łazienki 80 cm — Manual: listwa łączeniowa przy podłodze pływającej")

# — Ściany i sufity bez łazienek
add(50522, gk_wall, f"Notatki: ściana GK 1,6 × 2,7 × 0,1 m = {pl(gk_wall)} m², z wełną, bez drzwi; niski stopień",
    f"katalog: 150–250 zł/m² zależnie od trudności i liczby ścianek — przy jednej małej ściance stawka może być wyższa (do ≈ +430 zł). {M_COLOR_PLAN}")
add(50536, gk_tape, f"taśma na styku nowej ściany GK ze ścianą i sufitem obustronnie (2 × {pl(H)} + 2 × {pl(GK_L)} mb) + styk płyt po {pl(H)} mb z każdej strony")
add(50542, gk_corners, f"wolny koniec nowej ściany GK — 2 narożniki × {pl(H)} m; katalog: w deweloperce tylko przy ściankach GK")
add_new(50542, "Montaż gotowej ściany ażurowej klienta — kotwienie do podłogi i sufitu", "kpl", 0, 1,
        "Notatki: „Postawienie ściany ażurowej (my zakupujemy gotową ścianę, trzeba pewnie wwiercić w podłogę i sufit kotwy)”",
        f"brak w szablonie i w katalogu — do wyceny (Cena j.m. pusta); najbliższa praca z katalogu: „Montaż paneli ściennych, lamele, dekory itp” 150 zł/m². Wymiar i produkt ściany nieznane; czy stawiana na panelach. {M_COLOR_PLAN}")
add(50500, walls_gladz, f"ściany holu i pokoju {pl(dry_perim)} mb × {pl(H)} m minus okno 105 × 223, drzwi balkonowe 200 × 253, wejściowe 90 × 200, łazienkowe 80 × 200 = {pl(walls_existing)} m² + nowa ściana GK obustronnie {pl(2 * gk_wall)} m². "
    f"Bez ściany kuchennej {pl(KITCHEN_WALL)} m i ściany za szafą w holu {pl(WARDROBE_WALL)} m (Notatki). {A_H}; {A_PLAN}",
    "boki zabudowy szafy w holu liczone jako ściana tylko poniżej szafy — jeśli szafa ma własne boki, bez zmian")
add(50498, ceil_dry, f"sufity holu {pl(A_HOL)} i pokoju z aneksem {pl(A_POKOJ)} m² (powierzchnie z karty), także nad kuchnią i szafą")
add(50534, mleczko, f"katalog: zawsze na tynkach deweloperskich przed dalszymi pracami — istniejące ściany {pl(walls_existing)} + sufity {pl(ceil_dry)} m², bez nowej ściany GK")
add(50505, paint_dry, "przed i po gładziach — wszędzie, gdzie gładź (katalog)")
add(50503, paint_dry, "farba podkładowa na świeże gładzie (katalog)")
add(50513, paint_dry, "ściany i sufity na biało — Notatki nie mówią o kolorach", "kolory ścian (malowanie w kolorze 26 zł/m²)")
add(50495, dry_perim, f"katalog: przede wszystkim przy sufitach — styk ścian z sufitem w holu i pokoju bez kuchni i szafy {pl(dry_perim)} mb (styk nowej ściany GK z sufitem jest w taśmie)")
add(50529, bruzdy_el, "tynkowanie bruzd — jak bruzdowanie (katalog); gładź po bruzdach nie, bo gładź idzie na całe ściany")

# — Łazienka
add(50546, 5, "zamiana pralki z umywalką: umywalka ciepła + zimna + odpływ 3 pkt, pralka zimna + odpływ 2 pkt",
    M_DRAINS)
add(50620, 3, "katalog: w deweloperce rury idą przed ścianą — karta dewelopera: instalacja „zakończona korkami, nie schowana w ścianach”; zespoły umywalki, pralki i baterii prysznicowej (WC chowa zabudowa stelaża)",
    M_STRUCT)
add(50569, 1, "Notatki: montaż toalety — stelaż (geberit) przy prawej ścianie")
add(50583, 1, "zabudowa GK stelaża WC — Notatki: płytkowanie stelaża toalety")
add(50592, 1, "WC podwieszane na stelażu")
add(50567, 1, "Notatki: brodzik 120 × 80 i drzwi prysznicowe we wnęce 123,5 × 80 — drzwi liczone jako kabina")
add(50563, 1, "Notatki: armatura natynkowa — bateria prysznicowa")
add(50587, 1, "Notatki: umywalka z szafką (zintegrowane) — umywalka na szafce")
add(50630, 1, "Notatki wprost: „Montaż toalety, umywalki i szafki (zintegrowane)” — gotowy zestaw klienta, nie zabudowa stolarza",
    "katalog: szafkę zwykle montuje stolarz i jej nie dodajemy — tu klient prosi o nią wprost; jeśli zestaw przychodzi złożony, pozycja wypada (−250 zł)")
add(50561, 1, "bateria umywalkowa natynkowa (Notatki: armatura natynkowa)")
add(50593, 3, "katalog: tylko pod pralkę i pod umywalkę z baterią stojącą — umywalka 2 + pralka 1")
add(50585, 1, "syfon umywalki (brodzik ma syfon w komplecie)")
add(50594, 1, "pralka „P” w łazience — po zamianie przy wnęce prysznica")
add(50627, LAZ_E, "Notatki: przesunięcie gniazdka elektrycznego od pralki")
add(50572, 1, "grzejnik łazienkowy z karty — ponowny montaż po płytkach i malowaniu")
add(50575, 1, "pion wentylacyjny łazienki przy WC (karta)")
add(50552, laz_walls + 2 * A_LAZ, f"ściany {pl(laz_walls)} + podłoga i sufit {pl(A_LAZ)} m² — łazienka 187,5 × 212 + wnęka 123,5 × 80, obwód {pl(laz_perim)} mb × {pl(H)} m minus drzwi 80 × 200. {A_H}")
add(50596, laz_wall_tiles + A_LAZ, f"folia pod płytkami: ściany w płytkach {pl(laz_wall_tiles)} + cała podłoga {pl(A_LAZ)} m² (Notatki: hydroizolacja folią w płynie)",
    f"katalog: folia na wszystkich ścianach łazienki — ściany malowane farbą wodoodporną ({pl(laz_painted)} m²) pominięte, z nimi ≈ +311 zł")
add(50619, 15, "katalog: ok. 15 mb na łazienkę 4 m²")
add(50613, laz_wall_tiles, f"płytki 60 × 60 (Notatki): wnęka prysznicowa do sufitu {pl(recess_tiles)} + czoło uskoku pionu przy pralce {pl(step_tiles)} + pas przy umywalce do sufitu {pl(sink_tiles)} "
    f"+ reszta prawej ściany do {pl(BAND)} m {pl(band_tiles)} + zabudowa stelaża {pl(stelaz_extra)} m². Lewa ściana i ściana od holu malowane (Notatki). {A_H}",
    f"wysokość pasa płytek na prawej ścianie („do ok. połowy/ 3/4”) — przyjęto {pl(BAND)} m, przy 3/4 (2,03 m) ≈ +40 zł; czy szerokość pasa przy umywalce to 80 cm; "
    f"czy pas płytek ma być zlicowany z malowaną ścianą (licowanie GK ≈ +143 zł) albo krawędzie szlifowane na czysto (ok. {pl(clean_cut)} mb, ≈ +290 zł)")
add(50607, laz_floor_tiles, f"podłoga {pl(A_LAZ)} m² minus brodzik 120 × 80 — płytki 60 × 60 (Notatki)")
add(50556, laz_tiles_all, "fugowanie = wszystkie płytki (Manual)")
add(50598, 20, "Manual: 20–30 mb na łazienkę — dolna granica, płytki nie na wszystkich ścianach")
add(50617, 16, "katalog: WC 5 + bateria natynkowa 2 + umywalka 3 + pralka (woda, odpływ, gniazdo) 3 + grzejnik 2 + kratka 1")
add(50600, corner_45, f"Notatki: 45° przy toalecie i między prysznicem a pralką — narożnik uskoku pionu {pl(H)} m × 2 + krawędzie zabudowy stelaża (góra 0,60 i bok 1,20 m) × 2",
    "wymiar zabudowy stelaża — przyjęty 60 × 120 cm")
add(50547, akryl_laz, f"styk płytek do sufitu z sufitem (wnęka, uskok, pas przy umywalce) + narożnik pasa płytek przy ścianie od holu {pl(BAND)} m")
add(50559, laz_painted + A_LAZ, f"Notatki: lewa ściana {pl(2.12 * H)}, ściana od holu bez drzwi {pl(1.875 * H - laz_door)}, prawa ściana nad płytkami {pl(band_len * (H - BAND))} m² (farba wodoodporna) + sufit z gładzią {pl(A_LAZ)} m²")

# — Instalacja elektryczna i oświetleniowa
add(50701, L_POINTS, "Notatki: przeniesienie punktu świetlnego a,b + nowe punkty g, h (na środku i w rogu „nowego pokoju”)",
    f"{M_OSPRZET}. {M_COLOR_PLAN}")
add(50703, E_POINTS, f"Notatki: przeniesienie łączników a,b,c,s (na karcie 2 łączniki) {SW_MOVED} + dwa gniazda podwójne na nowej ścianie GK {SOCKETS} (każde gniazdko to punkt, katalog) + nowe łączniki g, h {SW_NEW}",
    f"gniazdo podwójne w jednej ramce w jednej puszce to 1 punkt — wtedy −2 pkt (−260 zł); łączniki krzyżowe g, h potrzebują łączników schodowych na końcach — może dojść 1–2 pkt (+130 zł za punkt). {M_OSPRZET}")

# — Instalacja wodno-kanalizacyjna + c.o.
add(50705, 1, "grzejnik w pokoju przy drzwiach balkonowych — ponowny montaż po malowaniu")

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in sorted(by.items(), key=lambda kv: -kv[1]): print(f"{s:42} {v:12.2f}")
added = [r for r in draft if r['description'] not in {x['description'] for x in rows.values()}]
print(f"{len(draft)} rows ({len(added)} added), total {total:.2f}")
print(f"laz: perim {laz_perim:.3f} walls {laz_walls:.2f} wall_tiles {laz_wall_tiles:.2f} floor_tiles {laz_floor_tiles:.2f} painted {laz_painted:.2f} "
      f"45° {corner_45:.2f} akryl {akryl_laz:.2f} clean_cut {clean_cut:.2f}")
print(f"dry: perim {dry_perim:.3f} openings {openings:.2f} walls_existing {walls_existing:.2f} walls_gladz {walls_gladz:.2f} ceil {ceil_dry:.2f} "
      f"paint {paint_dry:.2f} mleczko {mleczko:.2f} panels {panels:.2f} skirting {skirting:.2f} gk_tape {gk_tape:.2f} bruzdy_el {bruzdy_el}")
