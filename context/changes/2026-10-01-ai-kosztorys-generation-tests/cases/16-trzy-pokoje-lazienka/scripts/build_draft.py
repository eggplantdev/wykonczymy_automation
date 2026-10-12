# Builds measure/ai-draft-load.json for production #206 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). Assumptions go into the row's `assumptions`, unknowns into `missingData`.
# Inputs: the scope the owner typed into Notatki (inputs/client-inquiry.md), a phone photo of the PODDASZE rzut
# (printed areas only: pom. 29 66,20 m² pow. podł., pom. 30 5,78 m², razem 71,98; schody 16 × 18/25) and one
# photo of the attic (knee walls, rafters with old wool, posts, two roof windows). No room dimensions are printed;
# the scale is calibrated on the printed areas (measurement.md). No layout of the new rooms exists anywhere.
import json, math, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

def pl(x): return f"{x:.2f}".replace(".", ",")

# Scale: pom. 29 (66,20 m²) gives 0,943 cm/px, pom. 30 (5,78 m²) 0,920 cm/px → mean 0,932 cm/px.
PX = 0.00932
W = 867 * PX                 # inner width across the ridge (between the sloped side walls)
L = 1017 * PX                # inner length along the ridge, gable wall (sąsiad) to the hipped end
A_PROJ = W * L               # whole attic in plan: rooms + stair opening + inner walls
FLOOR = 71.98                # printed „razem pow. podł.”

# Section (photo): knee wall ≈ 1,1 m, pitch ≈ 45°, flat ceiling at 2,60 m.
H_KNEE = 1.1
PITCH = math.radians(45)
H_CEIL = 2.60
b = (H_CEIL - H_KNEE) / math.tan(PITCH)         # horizontal depth of the slope band from each sloped wall
flat = (W - 2 * b) * (L - b)                    # the gable end has no slope
slope_proj = A_PROJ - flat
chimneys = 0.22 + 0.47                          # two stacks through the ceiling, off the rzut
CEIL = flat + slope_proj / math.cos(PITCH) - chimneys

# Łazienka: „ok 4m2” (Notatki), taken as 2,0 × 2,0 under the flat ceiling.
laz = (2.0, 2.0)
A_laz = laz[0] * laz[1]
tray = 0.8 * 0.8
laz_walls = 2 * (laz[0] + laz[1]) * H_CEIL - 0.8 * 2.05
laz_floor = A_laz - tray

# New GK walls — no layout exists: 3 pokoje + łazienka off a corridor along the ridge; the small existing
# pom. 30 (5,78 m², with a door) is read as the „mała garderoba”.
corridor_walls = 11.0        # 2 × ≈ 5,5 mb from the stair landing
dividers = 5.0               # 2 × ≈ 2,5 mb, from a knee wall up the slope to the corridor
laz_new = 4.0                # two łazienka walls not shared with another partition
GK_MB = corridor_walls + dividers + laz_new
h_divider = (b * (H_KNEE + H_CEIL) / 2 + (2.5 - b) * H_CEIL) / 2.5
DOORS = 4                    # 3 pokoje + łazienka
GK_WALLS = (corridor_walls + laz_new) * H_CEIL + dividers * h_divider - DOORS * 0.9 * 2.05

# Existing masonry walls inside the attic.
knee = (2 * L + W) * H_KNEE
gable = W * H_KNEE + (H_CEIL - H_KNEE) * (W - b)
p30 = 805 * PX                                  # pom. 30's three inner walls
walls30 = 2 * p30 * H_CEIL - 2 * 0.8 * 2.0
WALLS = 2 * GK_WALLS + knee + gable + walls30 - laz_walls
CEIL_DRY = CEIL - A_laz
PAINT = WALLS + CEIL_DRY

junction = (2 * L + W) + (2 * b / math.cos(PITCH) + (W - 2 * b)) + GK_MB + 2 * p30
breaks = 2 * (L - b) + (W - 2 * b) + 2 * math.hypot(b * math.sqrt(2), H_CEIL - H_KNEE)
gk_joints = 6 * 2.4

POINTS = 30                  # „elektryka ok 30 punktów”
P_SOCK = 20
P_LIGHT = POINTS - P_SOCK
P_MASONRY = 10
ROOF_WIN = 2
win_glif = 2 * (0.78 + 1.18)

A_SCALE = "skala z wydrukowanych powierzchni (pom. 29 66,20 m², pom. 30 5,78 m²) — rzut poddasza nie podaje wymiarów"
A_SECTION = f"ścianka kolankowa ok. {pl(H_KNEE)} m i kąt dachu ok. 45° ze zdjęcia; sufit płaski na {pl(H_CEIL)} m — przekroju brak, Manual: rynek wtórny 2,60 m"
A_LAYOUT = f"układ ścian zgadywany — brak rzutu z podziałem: korytarz wzdłuż kalenicy {pl(corridor_walls)} mb, 2 przegrody między pokojami {pl(dividers)} mb, łazienka {pl(laz_new)} mb; pom. 30 (5,78 m²) = mała garderoba"

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
add(62412, 1, "1 kpl na całą zabudowę poddasza; cena j.m. z szablonu 1500 zł",
    f"poddasze domu bez windy i ok. 2,5 t płyt GK (sufit {pl(CEIL)} m² + ściany podwójną płytą) — katalog: wyższe piętra bez windy ok. 2500 zł; "
    "szablon ma też „Dodatek za wniesienie dużej ilości materiałów 1 zł/kg” (≈ +2,7 tys. zł) — nie dodany; lokalizacja i piętro nieznane")
add(62415, 2, "Manual: bez wyburzeń 2 big bagi total — tu tylko ścinki GK, wełny, folii i opakowania")

# — Wyburzenia, demontaże, zabezpieczenia
add(62430, FLOOR, f"m² podłogi poddasza {pl(FLOOR)} (wydrukowane „razem pow. podł.”); stawka podstawowa — na poddaszu nikt nie mieszka",
    "dom pod spodem jest zamieszkany: czy zabezpieczamy też klatkę schodową i dojście (stawka zamieszkana 45 zł/m²); poddasze trzeba opróżnić z rzeczy przed startem")
add(62434, 2 * P_MASONRY, f"katalog: 2 mb na punkt — tylko punkty w ścianach murowanych (kolankowe, pom. 30), ok. {P_MASONRY} z {POINTS}; w ścianach GK i suficie przewody idą w stelażu",
    "ile punktów wypada na ścianach murowanych")

# — Ściany i sufity bez łazienek
add_new(62507, "Sufit podwieszany na stelażu krzyżowym z płytami GK + dołożenie wełny 10 cm + folia paroizolacyjna (skosy i sufit poziomy)",
        "m²", 300, CEIL,
        f"Notatki: „Dodanie 10cm wełny+folia + płyty gk - koszt ok 300 zł/m2 sufitu podwieszanego stelaż krzyżowy” — cena j.m. z Notatek. "
        f"Powierzchnia: rzut {pl(W)} × {pl(L)} = {pl(A_PROJ)} m², z tego sufit płaski {pl(flat)} m² i skosy {pl(slope_proj)} m² w rzucie = {pl(slope_proj / math.cos(PITCH))} m² po spadku, minus kominy; "
        f"łącznie z łazienką, garderobą i nad klatką schodową. {A_SCALE}; {A_SECTION}",
        "wysokość sufitu płaskiego (jętki) i kąt dachu — przy 2,40 m lub 50° wychodzi 89–93 m², każde 10 m² = 3 000 zł; czy szczyt od sąsiada też w GK; "
        "katalog rozbija to na sufit podwieszany 160 + wełna 10 cm 60 + folia 25 = 245 zł/m² — przyjęte 300 zł z Notatek")
add_new(62507, "glify z gk na oknach dachowych", "mb", 70, ROOF_WIN * win_glif,
        f"katalog prac (glify z gk na oknach dachowych, 70 zł/mb): {ROOF_WIN} okna dachowe widoczne na zdjęciu, ok. 78 × 118 → {pl(win_glif)} mb na okno",
        "liczba i wymiar okien dachowych — zdjęcie pokazuje jedną połać, rzut ma tylko wyłaz dachowy")
add(62505, GK_WALLS, f"ścianki GK z wełną, podwójna płyta: {pl(GK_MB)} mb; przy korytarzu i łazience pełne {pl(H_CEIL)} m, przegrody pod skosem średnio {pl(h_divider)} m; minus {DOORS} otwory 0,90 × 2,05. "
    f"Wysoki stopień — każda ścianka dochodzi do skosu. {A_LAYOUT}",
    "układ pokoi — bez rzutu z podziałem to szacunek, każde 5 mb ścianki ≈ 1,9 tys. zł, z gładzią i malowaniem obustronnie ≈ 4,1 tys. zł; jeśli garderoba nie jest w pom. 30, dochodzi jej ścianka; niski stopień 150 zł/m²")
add(62503, DOORS, f"{DOORS} nowe otwory w GK: 3 pokoje + łazienka (garderoba w pom. 30 ma otwór); drzwi i ościeżnice montuje firma zewnętrzna (Notatki)")
add(62508, breaks + gk_joints, f"taśma w załamaniach GK: skos/sufit płaski {pl(2 * (L - b) + (W - 2 * b))} mb + 2 narożniki koperty {pl(breaks - 2 * (L - b) - (W - 2 * b))} mb; styki nowych ścianek z murem ok. 6 × 2,4 m")
add(62524, ROOF_WIN * win_glif + 5, "narożniki glifów okien dachowych + wolne końce ścianek przy korytarzu ok. 5 mb")
add(62528, WALLS, f"gładź Q3 na ścianach: nowe GK obustronnie {pl(2 * GK_WALLS)} + kolankowe {pl(knee)} + szczyt {pl(gable)} + ściany pom. 30 obustronnie {pl(walls30)} minus płytki w łazience {pl(laz_walls)} m². {A_SECTION}",
    f"czy ściany murowane (kolankowe, szczyt, pom. 30 — {pl(knee + gable + walls30)} m²) są otynkowane — na zdjęciu krawędź otworu to surowa cegła; jeśli nie: gładź rynek wtórny z podkładem z tynku 85 zł/m² (≈ +2,4 tys. zł) albo tynkowanie na listwach 100 zł/m² (≈ +8,4 tys. zł)")
add(62526, CEIL_DRY, f"gładź Q3 na całym nowym suficie GK bez łazienki ({pl(CEIL)} − {pl(A_laz)} m²)")
add(62533, PAINT, "przed i po gładziach — ściany + sufity")
add(62537, PAINT, "farba podkładowa na świeże gładzie")
add(62542, PAINT, "ściany i sufity na biało — Notatki nie mówią o kolorach", "kolory ścian (malowanie w kolorze 26 zł/m²)")
add(62536, junction, f"styki ścian z sufitem: kolankowe {pl(2 * L + W)} + szczyt {pl(2 * b / math.cos(PITCH) + W - 2 * b)} + nowe ścianki {pl(GK_MB)} + pom. 30 obustronnie {pl(2 * p30)} mb")
add(62517, 2 * P_MASONRY, "tynkowanie bruzd w murze — jak bruzdowanie; gładź po bruzdach pominięta, bo gładź idzie na całe ściany (katalog)")

# — Łazienka
add(62554, 1, "„zrób kopię jakiejś łazienki w całość … ok 4m2 z płytką standardową” (Notatki) — WC podwieszane na stelażu")
add(62555, 1)
add(62632, 1)
add(62612, 1, "brodzik z kabiną 80 × 80 — najprostszy standard dla 4 m²; media wyprowadzone (Notatki), więc bez przeróbek wod-kan",
    "brodzik czy odpływ liniowy z szybą (1600 + 550 zł zamiast 1500 zł)")
add(62605, 1, "bateria natynkowa — standard", "bateria podtynkowa: +650 zł i biały montaż")
add(62627, 1, "umywalka na szafce")
add(62636, 1)
add(62603, 1)
add(62630, 1, "syfon umywalki (brodzik ma syfon w komplecie)")
add(62616, 1, "grzejnik drabinka na c.o.", "czy c.o. jest wyprowadzone na poddasze, czy grzejnik elektryczny (200 zł)")
add(62564, laz_walls + 2 * A_laz, f"ściany {pl(laz_walls)} + podłoga + sufit {pl(A_laz)} m² — łazienka {pl(laz[0])} × {pl(laz[1])}, wysokość {pl(H_CEIL)} m (sufit płaski)",
    "położenie łazienki — pod skosem mniej płytek na ścianach")
add(62573, laz_walls + A_laz, "folia w płynie na wszystkich ścianach i podłodze (katalog)")
add(62575, 15, "ok. 15 mb na łazienkę 4 m² (katalog)")
add(62589, laz_walls, f"płytka standardowa do sufitu na wszystkich ścianach: obwód 8 mb × {pl(H_CEIL)} minus drzwi 0,80 × 2,05", "płytki do sufitu czy do 2,0–2,2 m")
add(62582, laz_floor, f"podłoga {pl(A_laz)} m² minus brodzik 0,80 × 0,80")
add(62596, laz_walls + laz_floor, "fugowanie = wszystkie płytki (Manual)")
add(62597, 25, "Manual: 20–30 mb na łazienkę")
add(62598, 15, "WC 5 + umywalka 3 + bateria natynkowa 2 + grzejnik 2 + puszki przy lustrze 2 + kratka 1 (katalog)")
add(62600, 2 * (laz[0] + laz[1]), "styk płytek z sufitem — obwód łazienki")
add(62601, A_laz, "sufit łazienki — jedyna powierzchnia bez płytek; sam sufit GK z wełną jest w pozycji sufitu podwieszanego")
add(62621, 1)
add(62620, 2, "plafon + oprawa nad lustrem")
add(62602, 3, "wieszak, uchwyt na papier, haczyk")
add(62619, 1, "kratka na kanał wentylacyjny — przy pom. 30 rzut ma kanały „w”", "czy łazienka sięga kanału, czy potrzebny wentylator (120 zł)")
add(62614, 2, "gniazdo przy lustrze + łącznik — punkty są w puli 30 punktów elektryki")

# — Elektryka
add(62672, P_SOCK, f"Notatki: „cała elektryka. elektryka ok 30 punktów” — podział agenta: {P_SOCK} gniazd/łączników (3 pokoje po ok. 4, korytarz 2, garderoba 1, łazienka 2, zapas) i {P_LIGHT} punktów świetlnych",
    "podział 30 punktów na gniazda i światło — każdy punkt przesunięty z gniazd do światła to −30 zł")
add(62670, P_LIGHT, "3 pokoje, korytarz 2, garderoba, łazienka 2, zapas — z puli 30 punktów")
add(62679, P_SOCK - 2, "osprzęt na wszystkie gniazda i łączniki poza łazienką (te są w sekcji Łazienka)")
add(62705, 3, "nowe obwody poddasza: gniazda, oświetlenie, łazienka — dołożenie 3 bezpieczników do istniejącej rozdzielni",
    "czy w rozdzielni jest miejsce — osobna podrozdzielnia na poddaszu to 1200 zł (do 12 modułów)")

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in sorted(by.items(), key=lambda kv: -kv[1]): print(f"{s:42} {v:12.2f}")
added = [r for r in draft if r['description'] not in {x['description'] for x in rows.values()}]
print(f"{len(draft)} rows ({len(added)} added), total {total:.2f}; W {W:.2f} L {L:.2f} A_proj {A_PROJ:.2f} b {b:.2f} flat {flat:.2f} "
      f"slope_proj {slope_proj:.2f} CEIL {CEIL:.2f}; GK_WALLS {GK_WALLS:.2f} (h_div {h_divider:.2f}); knee {knee:.2f} gable {gable:.2f} walls30 {walls30:.2f} "
      f"WALLS {WALLS:.2f} CEIL_DRY {CEIL_DRY:.2f} PAINT {PAINT:.2f}; laz_walls {laz_walls:.2f}; junction {junction:.2f} breaks {breaks:.2f}")
