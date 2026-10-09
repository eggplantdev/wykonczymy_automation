# Builds measure/ai-draft-load.json for production #191 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). The agent may assume, and every assumption goes into the row's `assumptions`
# (owner, 2026-10-09); what the inputs left unknown goes into `missingData`. Several items are one per line.
# Every figure below is read off the projekt sheet named next to it; derivations are in measurement.md.
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

H = 2.65  # printed „H:265 cm” on every room (A.04.2) — wins over the 2,60 house default
def pl(x): return f"{x:.2f}".replace(".", ",")

# Printed room areas, A.04.2 zestawienie.
rooms = dict(hol=5.36, syp_02=9.33, dzienny=14.09, syp_04=9.00, kuchnia=4.78, lazienka=2.53)
dry = sum(v for k, v in rooms.items() if k != 'lazienka')
total_area = sum(rooms.values())

# Room sides: printed where the plan prints both (P. dzienny 464×304, 0.04 355×253, łazienka 188×142),
# else one printed side and the other = m² ÷ side.
perim = dict(hol=2 * (1.20 + 5.36 / 1.20), syp_02=2 * (4.11 + 9.33 / 4.11), dzienny=2 * (4.64 + 3.04),
             syp_04=2 * (3.55 + 2.53), kuchnia=2 * (1.65 + 4.78 / 1.65))
P_dry = sum(perim.values())
A_PERIM = ("obwody: P. dzienny 4,64 × 3,04 i sypialnia 0.04 3,55 × 2,53 z rzutu; hol (szer. 1,20), sypialnia 0.02 (4,11) "
           "i kuchnia (1,65, rozwinięcie 2) — drugi bok = m² ÷ bok")
A_H = "wysokość 2,65 m — wydrukowana na rzucie przy każdym pomieszczeniu"
A_DOORS = "odliczone tylko drzwi (wejściowe 0,8 × 2,0, łazienka 0,7 × 2,0, 2 × 0,8 × 2,0 obustronnie); okna nieodliczone"
M_FLOOR = "rzut A.04.3 daje klepkę + gres, a zestawienie pomieszczeń (A.04.2) mikrocement we wszystkich"

# A.04.5 finish legend, lengths measured off the vector layer (legend swatches excluded).
lamele = (0.50 + 0.50 + 0.59 + 0.69 + 2.20 + 0.49 + 0.49) * H
tapety = (7.14 + 3.91) * H
mirrors_mb = 1.04 + 0.68 + 1.57 + 0.59 + 0.49 + 0.49
mirrors = mirrors_mb * H
panele_tap = 1.28 * H
kitchen_cabinets = (1.43 + 1.65 + 0.93) * H
doors = 0.8 * 2.0 + 0.7 * 2.0 + 2 * 2 * 0.8 * 2.0
walls_gross = P_dry * H
gladz_walls = walls_gross - kitchen_cabinets - lamele - panele_tap - doors
gladz = gladz_walls + dry
paint_walls = gladz_walls - tapety - mirrors
A_LAMELE = "lamele na pełną wysokość („h = pełna wysokość” na A.04.5), słup w P. dziennym obłożony z 3 stron ok. 2,2 mb"
A_GLADZ = [A_H, A_PERIM, A_DOORS,
           "ściany kuchni za zabudową pominięte: 1,43 + 1,65 + 0,93 mb na pełną wysokość (Wiedza firmowa)",
           f"bez gładzi pod lamelami ({pl(lamele)} m²) i panelami tapicerowanymi ({pl(panele_tap)} m²); pod tapetą i lustrami gładź jest"]
A_PAINT = A_GLADZ[:3] + [f"bez ścian pod tapetą ({pl(tapety)} m²), lustrami ({pl(mirrors)} m²), lamelami i panelami",
                         "wszystkie ściany bez opisu na biało (legenda A.04.5)"]

# Łazienka, A.09.2: room 188 × 142, wanna 142 × 72 on a stelaż, tiles above the wanna and on its obudowa.
P_bath = 2 * (1.88 + 1.42)
bath_wall_tiles = (0.72 * 2.05) * 2 + 1.42 * 2.05 + 1.42 * 0.60
bath_floor = rooms['lazienka']
bath_tiles = bath_wall_tiles + bath_floor
bath_paint = P_bath * H - (bath_wall_tiles - 1.42 * 0.60) - (1.42 + 2 * 0.72) * 0.60 - 0.7 * 2.0 + bath_floor
A_BATH_TILES = ("płytki ścienne na 3 ścianach nad wanną do 2,05 m i na obudowie wanny 1,42 × 0,60 — legenda A.04.5: "
                "„powyżej wanny oraz na jej obudowie”, wysokości z rozwinięć A.09.2")
A_SMALL = "Equipe Magma / Artisan to cegiełka ok. 6,5 × 20 — przyjęto stawkę za mały format"

# Kitchen, A.09.3: tiles from worktop to wall cabinets (0,60 m) on rozwinięcie 3 (1,43) and 2 (1,65).
kitchen_tiles = 0.60 * (1.43 + 1.65)

# Old finishes — the project draws only the new state.
skuw_bath_walls = P_bath * 2.0 - 0.7 * 2.0
skuw_kitchen_walls = kitchen_tiles
skuw_floors = bath_floor + rooms['kuchnia']
skuw_walls = skuw_bath_walls + skuw_kitchen_walls
A_SKUW = ["stara łazienka w płytkach do 2,0 m na wszystkich ścianach, drzwi odliczone",
          "stara kuchnia: pas płytek nad blatem jak w nowym projekcie, płytki na podłodze"]
M_OLD = "zastany stan — projekt nie pokazuje starych wykończeń (płytki, podłoga w holu i kuchni)"

# Zmiany budowlane, A.04.2 (numbers in brackets = the legend items).
demolition = 1.20 + 0.52 + 1.36 + 1.98 + 0.40
infill = 0.80 * 2.20 + 0.90 * H + 0.73 * 2.00
A_DEMO = ["(1) fragment ściany 0,59 × 2,03 ≈ 1,2 m², (2') nadproże 0,80 × 0,65, (4) ściana z otworem 60/200 ≈ 1,36 m², "
          "(4') ściana 1,36 mb z oknem wewnętrznym 130 × 125 ≈ 1,98 m², (5) poszerzenie wnęki do 60 cm ≈ 0,4 m²",
          "ściany działowe miękkie do 12 cm (rzut: 10–12 cm)"]
M_WALLS = "materiał ścian działowych"
A_INFILL = ["(2) zamurowanie otworu 80/220, (3) nowa ściana 90 cm na pełną wysokość, (7) zawężenie otworu 153 → 80 (0,73 × 2,0)"]

# Elektryka, A.05.2–A.05.4: tabela obwodów + symbole na rzutach.
el_sockets, el_switches, el_stair, el_lights, el_data = 20, 11, 4, 19, 3
el_points = el_sockets + el_switches + el_stair
bruzdy_el = (el_points + el_lights + el_data) * 2.5
led = 0.59 + 4 * 1.41 + 3.51 + 1.86

windows_glify = 18.2
openings_edges = 3 * (2 * 2.03 + 0.6)
entrance = 0.8 + 2 * 2.0

def r(i, qty, assumptions=(), missing=()):
    return (i, qty, list(assumptions), list(missing))

pick = [
    # Wyburzenia, demontaże, zabezpieczenia
    r(50454, total_area, ["zabezpieczenia = m² podłogi całego mieszkania (katalog), suma m² z rzutu"]),
    r(50432, 1, ["1 kpl: armatura starej łazienki, zabudowa kuchni, stary grzejnik — rynek wtórny, kapitalny remont"], [M_OLD]),
    r(50442, 5, ["5 starych ościeżnic — skreślone na rzucie zmian budowlanych (A.04.2)"], ["ościeżnice drewniane czy metalowe"]),
    r(50450, demolition, A_DEMO, [M_WALLS]),
    r(50453, 2, ["(2') i (4') — usunięcie nadproża „jeśli możliwe” (A.04.2)"], ["czy nadproża (2') i (4') da się usunąć — projekt pisze „jeśli możliwe”"]),
    r(50447, 1),
    r(50437, skuw_walls + skuw_floors, A_SKUW, [M_OLD]),
    r(50440, skuw_walls, ["= ściany po skuciu płytek"] + A_SKUW, [M_OLD]),
    r(50444, rooms['hol'], ["w holu leży klejona klepka jak w pokojach — zrywana pod nowy gres"], [M_OLD]),
    r(50425, 1, ["stary grzejnik w łazience zastąpiony drabinką (A.06.1)"]),
    r(50422, bruzdy_el, ["≈ 2,5 mb bruzdy na punkt elektryczny, świetlny i RTV/IT (katalog)"], [M_WALLS]),
    r(50420, 4, ["≈ 2 mb na łazienkę (Wiedza firmowa) + 2 mb w kuchni pod nowe podejścia"]),
    # Ściany i sufity bez łazienek
    r(50525, infill, [A_H] + A_INFILL),
    r(50529, bruzdy_el, ["= bruzdy elektryczne"]),
    r(50539, openings_edges + entrance + 4.0,
      ["obróbka po wyburzeniach (1), (4), (4'): 3 × (2 × 2,03 + 0,6) mb", "obróbka po wymianie drzwi wejściowych 4,8 mb",
       "styki zamurowań (2), (3), (7) ok. 4 mb"]),
    r(50542, windows_glify + openings_edges,
      [f"glify okienne {pl(windows_glify)} mb z zestawienia okien (A.10.1)", "narożniki nowych przejść po wyburzeniach (1), (4), (4')"]),
    r(50502, gladz, A_GLADZ + [f"sufity = suche pomieszczenia {pl(dry)} m²"]),
    r(50496, gladz, ["jak gładź"] + A_GLADZ),
    r(50505, gladz, ["jak gładź"] + A_GLADZ),
    r(50503, gladz, ["jak gładź"] + A_GLADZ),
    r(50513, paint_walls, A_PAINT),
    r(50508, dry, ["wszystkie sufity suchych pomieszczeń"],
      ["legenda A.04.4 podaje białego sufitu „ok. 27,5 m²”, a suche pomieszczenia mają 42,56 m²"]),
    r(50495, P_dry - 45.0, ["styk ściana/sufit tam, gdzie nie ma listwy sufitowej: obwody − 45 mb listwy", A_PERIM]),
    r(50517, 45.0, ["listwa sufitowa SL NMC zmierzona na A.04.4: ok. 45 mb — legenda 54 mb to ilość zakupowa z zapasem"]),
    r(50515, 3.03 + 2.52, ["„szyna sufitowa dwutorowa” na A.04.4 = karnisz zasłonowy: okno P. dziennego 3,03 + sypialni 0.04 2,52"]),
    r(50537, tapety, [A_H, "tapeta na pełną wysokość: „leafy monkey” 7,14 mb (hol, P. dzienny, sypialnia 0.04) + „clouds” 3,91 mb (sypialnia 0.02), A.04.5"]),
    r(50545, H, ["(11) zabudowa G-K we wnęce 40 × 59 na pełną wysokość"]),
    # Podłogi
    r(50460, rooms['syp_02'] + rooms['dzienny'] + rooms['syp_04'],
      ["istniejąca klepka do wycyklinowania i uzupełnienia ubytków w 0.02, 0.03, 0.04 (A.04.3)"], [M_FLOOR]),
    r(50494, rooms['hol'] + rooms['kuchnia'] + bath_floor,
      ["wylewka samopoziomująca pod gres 80 × 80 i płytki łazienki — podłoże po zerwaniu starej podłogi"], [M_OLD, M_FLOOR]),
    r(50478, rooms['hol'] + rooms['kuchnia'], ["gres 79,8 × 79,8 w holu i kuchni (A.04.3) — stawka formatu do 60 × 120"], [M_FLOOR]),
    r(50462, rooms['hol'] + rooms['kuchnia'], ["fugowanie = m² płytek (katalog)"], [M_FLOOR]),
    r(50463, rooms['hol'] + rooms['kuchnia'], [], [M_FLOOR]),
    r(50491, 0.59 + 0.60 + 1.36 + 0.80, ["pod wyburzonymi ścianami (1), (4), (4'), (2'): 3,35 mb"]),
    r(50470, 40 / 1.1, ["legenda A.04.3: ~40 mb z 10% zapasu → 36,4 mb ułożone"]),
    r(50458, 40 / 1.1, ["jak listwy przypodłogowe"]),
    r(50468, 40 / 1.1, ["listwy XPS malowane na kolor ściany"]),
    r(50471, 1.85 / 1.1, ["„biała listwa” z legendy A.04.3: ~1,85 mb z 10% zapasu"]),
    # Łazienka
    r(50552, bath_floor * 2 + P_bath * H - 0.7 * 2.0, ["dwukrotne gruntowanie = podłoga + sufit + ściany (katalog)", A_H]),
    r(50611, bath_wall_tiles, [A_BATH_TILES, A_SMALL]),
    r(50607, bath_floor, ["Geotiles 45 × 45 na całej podłodze łazienki (A.04.3)"]),
    r(50554, bath_wall_tiles, ["fugowanie = m² płytek (Wiedza firmowa)", A_SMALL, A_BATH_TILES]),
    r(50556, bath_floor, ["fugowanie = m² płytek (Wiedza firmowa)"]),
    r(50596, bath_tiles, ["folia w płynie = suma płytek (Wiedza firmowa)", A_BATH_TILES]),
    r(50619, P_bath + 2 * 2.05 + (1.42 + 2 * 0.72),
      ["obwód podłogi 6,6 + 2 narożniki nad wanną po 2,05 + styk wanna/ściana 2,86 (Wiedza firmowa)"]),
    r(50598, 20, ["20–30 mb na łazienkę (Wiedza firmowa) — dolna granica, łazienka ma 2,53 m²"]),
    r(50617, 5 + 2 + 3 + 2 + 2, ["otwory wg Wiedzy firmowej: WC 5, wanna z baterią natynkową 2, umywalka 3, grzejnik 2, lustro 2"]),
    r(50600, 1.42 + 3 * 0.62, ["krawędzie 45°: obudowa wanny 1,42 + 3 półki w zabudowie 3 × 0,62 — do weryfikacji"]),
    r(50559, bath_paint, [A_H, "maluje się ściany bez płytek + sufit; ściana pod wanną schowana za obudową, drzwi 0,7 × 2,0 odliczone", A_BATH_TILES]),
    r(50546, 3 + 3 + 2, ["punkt = zimna + ciepła + kanalizacja (katalog): umywalka 3, wanna 3, WC 2"]),
    r(50569, 1),
    r(50583, 1),
    r(50592, 1),
    r(50629, 1, ["(9) półka nad stelażem z frontem IKEA SAVEDAL = szafka nad geberitem"]),
    r(50590, 1, ["wanna 142 × 72 na stelażu z nóżkami w zabudowie z rewizją — stawka jak zabudowa z bloczków"]),
    r(50563, 1),
    r(50582, 1, ["parawan nawannowy — wanna z deszczownicą (A.09.2)"]),
    r(50587, 1),
    r(50630, 1),
    r(50561, 1),
    r(50585, 2, ["syfon umywalki + wanny"]),
    r(50577, 1),
    r(50584, 1, ["(8) otwór rewizyjny zakryty lustrem — rewizja z glazury jako najbliższa pozycja"]),
    r(50624, 1, ["zabudowa G-K z 3 półkami podświetlonymi LED (A.09.2) wyceniona jak przedścianka z 3 półkami"]),
    r(50575, 1, ["kratka wentylacyjna w łazience bez okna"], ["czy łazienka ma mieć wentylator"]),
    r(50594, 1, ["pralkosuszarka w kuchni (A.09.3)"]),
    # Kuchnia
    r(50644, kitchen_tiles, ["pas płytek 0,60 m od blatu do szafek wiszących na rozwinięciu 3 (1,43) i 2 (1,65), A.09.3", A_SMALL]),
    r(50632, 3, ["lodówka, piekarnik (słupek „LODÓWKA/PIEKARNIK”, A.09.3) i mikrofalówka w zabudowie"], ["czy jest okap"]),
    r(50639, 1, [], ["czy płyta indukcyjna wymaga przyłącza trójfazowego"]),
    r(50641, 1),
    r(50637, 1),
    r(50636, 1),
    r(50633, 1),
    # Instalacja wodno-kanalizacyjna + c.o.
    r(50710, 3 + 2 + 2, ["punkt = zimna + ciepła + kanalizacja (katalog): zlew 3, zmywarka 2, pralkosuszarka 2"]),
    r(50705, 1),
    r(50709, 2, ["nowa drabinka: zasilanie + powrót"]),
    # Klimatyzacja
    r(50411, 1),
    r(50417, 4, ["trasa ok. 4 mb: jednostka na ścianie P. dziennego → balkon B1 (A.06.2)"], ["trasa rur klimatyzacji"]),
    r(50408, 4, ["jak rury — skropliny i rury w bruździe („ukryć rurę skroplin”, A.06.2)"], ["trasa rur klimatyzacji"]),
    r(50415, 1, ["przebicie na balkon B1 do jednostki zewnętrznej"]),
    r(50413, 1, ["syfon podtynkowy — skropliny ukryte (A.06.2)"]),
    r(50414, 4, ["jak bruzdy klimatyzacji"]),
    r(50419, 4, ["jak bruzdy klimatyzacji"]),
    # Instalacja elektryczna i oświetleniowa
    r(50703, el_points, [f"gniazda {el_sockets} + łączniki {el_switches} + schodowe {el_stair} z rzutów A.05.2 i A.05.4"]),
    r(50701, el_lights, ["19 punktów z tabeli oświetlenia A.05.3"]),
    r(50675, el_sockets + el_switches),
    r(50693, el_stair, ["2 pary łączników schodowych (linie 1 i 4–5, A.05.3)"]),
    r(50674, el_data, ["1 RTV + 2 IT (A.05.4)"]),
    r(50677, 1, ["wyżłobienie 6 × 10 cm pod kable TV (A.05.4) = kanał TV w ścianie działowej"], [M_WALLS]),
    r(50688, 1.08 + 1.21 + 1.21 + 1.19 + 1.20, ["5 szynoprzewodów zmierzonych na A.05.3"]),
    r(50685, 6, ["5 lamp wiszących + 1 plafon (A.05.3)"]),
    r(50680, 2, ["2 żyrandole — montaż ze składaniem"]),
    r(50679, 2),
    r(50689, led, ["taśmy LED: hol 0,59 + 4 × 1,41, kuchnia 3,51, łazienka 1,86 (rozwinięcie A.09.2)"],
      ["łazienkowy LED: 1,86 mb na A.09.2 vs 1,35 mb na A.05.3"]),
    r(50690, 4, ["1 zasilacz na każdą z 4 linii LED (1L, 2L, 3L, 13L)"]),
    r(50694, 1, ["rozdzielnia do 12 modułów"], ["czy płyta indukcyjna wymaga przyłącza trójfazowego"]),
    # Montaż stolarki i ślusarski
    r(50655, 3, ["D1 70/200 + 2 × D2 80/200 (A.08.1), ościeżnice regulowane"]),
    r(50663, 3),
    r(50664, 1, ["(7) drzwi dwuskrzydłowe 153 → jednoskrzydłowe 80/200"]),
    # Prace dodatkowe
    r(50406, 1, ["1 kontener na gruz z wyburzeń i skuwania"]),
    r(50402, 1, ["ryczałt dla małego mieszkania (Wiedza firmowa: 1500 zł)"], ["piętro i winda"]),
]

S_WALLS, S_EXTRA = rows[50502]['section'], rows[50406]['section']
added = [
    (S_WALLS, "Montaż paneli ściennych, lamele, dekory itp", "m²", 150, lamele,
     [A_LAMELE, "lamele: hol 0,50, sypialnia 0.02 0,50, P. dzienny 0,59 + 0,69 + słup ok. 2,2, sypialnia 0.04 2 × 0,49 (A.04.5)"], []),
    (S_WALLS, "Klejenie dużego lustra na ścianę", "szt", 0, 6,
     ["6 luster na pełną wysokość (A.04.5): hol 0,95, 0,68, 1,57, 0,59, sypialnia 0.04 2 × 0,49"],
     ["brak w katalogu — do wyceny; najbliżej „Montaż lustra - zwykłe wiszące” 120 zł"]),
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
    if q <= 0: continue
    p = rows[i]
    add(p['section'], p['description'], p['unit'], p['clientPrice'], q, a, m)
for s, d, u, p, q, a, m in added: add(s, d, u, p, q, a, m)

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"rows {len(out)}  razem {sum(by_sec.values()):,.2f}  with assumptions {sum('assumptions' in r for r in out)}  "
      f"with missingData {sum('missingData' in r for r in out)}  unpriced {sum(r['clientPrice'] == 0 for r in out)}")
print(f"P_dry {P_dry:.2f}  walls {walls_gross:.2f}  gładź {gladz:.2f}  paint walls {paint_walls:.2f}  lamele {lamele:.2f}  "
      f"tapety {tapety:.2f}  mirrors {mirrors:.2f}  bath tiles {bath_wall_tiles:.2f}/{bath_floor}  bath paint {bath_paint:.2f}  "
      f"skuwanie {skuw_walls + skuw_floors:.2f}  bruzdy el {bruzdy_el}")
for s, v in sorted(by_sec.items(), key=lambda kv: -kv[1]): print(f"  {s}: {v:,.2f}")
