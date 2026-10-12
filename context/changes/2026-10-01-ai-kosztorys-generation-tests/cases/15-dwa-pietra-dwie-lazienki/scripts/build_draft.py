# Builds measure/ai-draft-load.json for production #205 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). Assumptions go into the row's `assumptions`, unknowns into `missingData`.
# Inputs: the scope in Notatki (inputs/client-inquiry.md) and ONE file — a phone photo (upside down) of a
# developer's sales plan, two levels, furniture drawn in, room areas printed for most rooms but no
# dimensions and no height. Scale per level is taken from the printed areas (measurement.md); the unlabelled
# hol and WC areas and every perimeter are measured with it.
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

def pl(x): return f"{x:.2f}".replace(".", ",")

MISSING = "Praca wybrana, ilość nieznana: "
H = 2.68  # no height on the plan → Manual default for stan deweloperski

# Poziom dolny — printed: salon z aneksem 25,5, sypialnia 7,5. Scale 86,7 px/m (salon + sypialnia = 33,0 m²).
SALON = 25.5
SYP_DN = 7.5
salon_box = (4.65 + 2.25, 4.38)    # L-shape: living part 4,65 wide + aneks 2,25, depth 4,38
syp_dn = (2.30, 3.26)              # fitted to the printed 7,5
hol_dn = (2.40, 1.90)
hol_dn_extra = 1.27 * 0.40         # przejście hol → salon
wc_dn = (0.92, 2.19)
A_HOL_DN = hol_dn[0] * hol_dn[1] + hol_dn_extra
A_WC = wc_dn[0] * wc_dn[1]
# Poziom górny — printed: sypialnie 15,2 i 13,8, łazienka 4,2. Scale 78,4 px/m (the two bedrooms agree to 0,2%).
SYP_15 = 15.2
SYP_13 = 13.8
LAZ_UP = 4.2
syp_15 = (3.41, 4.46)
syp_13 = (3.09, 4.46)
hol_up = (2.23, 2.30)
laz_up = (1.90, 2.21)              # fitted to the printed 4,2
stairs = (2.36, 1.91)              # stair enclosure footprint
A_HOL_UP = hol_up[0] * hol_up[1]

def perim(r): return 2 * (r[0] + r[1])

A_VINYL = SALON + SYP_DN + A_HOL_DN + SYP_15 + SYP_13 + A_HOL_UP
A_BATH_FLOOR = LAZ_UP + A_WC
A_FLOOR = A_VINYL + A_BATH_FLOOR

P_dry = perim(salon_box) + perim(syp_dn) + perim(hol_dn) + perim(syp_15) + perim(syp_13) + perim(hol_up)
P_walls = P_dry - hol_up[0]        # the upper hol is open to the stairs on one side
stairwell = (stairs[0] + stairs[1]) * 2 * H   # stair enclosure walls, both levels
openings = 4 * 1.55 * 2.2 + 0.9 * 1.5         # 4 balcony/terrace doors + the small bedroom's window
door_faces = 11 * 0.9 * 2.05                  # interior door openings, counted per painted face
kitchen_back = 4.2 * 1.6                      # Manual: no finish behind kitchen cabinets
W_EXIST = P_walls * H + stairwell - openings - door_faces - kitchen_back
GK = 20.0                                     # Notatki: „Ścianki z gk ok 20m2”
GK_FACES = 2 * GK
W_PAINT = W_EXIST + GK_FACES
LISTWY = round(P_dry * 0.7, 1)                # katalog: perimeter without bathrooms minus 20–30% for built-ins
CORNERS = 30 * H                              # vertical inner corners of every dry room + stairwell

# Bathrooms: tiles to the ceiling, standard format (Notatki: „glazura standard od 30x30 do 60x120”).
door_bath = 0.80 * 2.05
laz_walls = perim(laz_up) * H - door_bath
wc_walls = perim(wc_dn) * H - door_bath
BATH_WALLS = laz_walls + wc_walls
BATH_TILES = BATH_WALLS + A_BATH_FLOOR

POINTS = 20                                   # Notatki: „punkty elektryczne + oświetleniowe ok 20 szt.”
PTS_EL, PTS_LIGHT = 10, 10
OSPRZET = 45
LAMPS = 12

A_PLAN = "m² podłogi wydrukowane na rzucie (zdjęcie rzutu sprzedażowego); hol i WC bez podpisu — zmierzone w skali wziętej z podpisanych pokoi (measurement.md)"
A_H = "wysokość 2,68 m — rzut jej nie podaje, Manual: stan deweloperski"
A_DEV = "stan deweloperski: rzut sprzedażowy dewelopera, „gładzie są”, wylewka pod winyle, nowe geberity, ani słowa o wyburzeniach"

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
add(62110, 1, "1 kpl na cały remont; mieszkanie dwupoziomowe ok. 78 m², dwie łazienki — katalog: „duże mieszkania deweloperskie z wieloma zmianami ok 2000 zł”",
    "cena j.m. z szablonu 1500 zł, katalog dla tego zakresu mówi ok. 2000 zł — do podniesienia ręcznie; piętro i winda (balkon na dole, taras na górze → wyższe piętro)")
add(62113, 2, "Manual: „rynek pierwotny bez wyburzeń — 2 big bagi”; gruz to ścinki GK i płytek z dwóch łazienek. " + A_DEV,
    "czy są jakiekolwiek wyburzenia lub skuwanie — wtedy kontener")

# — Wyburzenia, demontaże, zabezpieczenia
add(62128, A_FLOOR, f"m² podłogi obu poziomów (katalog): dół {pl(SALON + SYP_DN + A_HOL_DN + A_WC)} + góra {pl(SYP_15 + SYP_13 + A_HOL_UP + LAZ_UP)}. " + A_PLAN,
    "czy mieszkanie będzie zamieszkane w trakcie (stawka 45 zł/m²)")
add(62132, 2 * POINTS, f"2 mb na punkt (katalog) × {POINTS} punktów z Notatek",
    "materiał ścian — w żelbecie 45 zł/mb (+800 zł)")
add(62130, 4, "ok. 2 mb na łazienkę (katalog) × 2 łazienki — podejścia pod baterie podtynkowe")

# — Podłogi
add(62191, A_VINYL, f"Notatki: „podłoga winylowa jodełka oba piętra” — wszystkie pomieszczenia poza łazienkami: salon z aneksem 25,5 + sypialnia 7,5 + hol dół {pl(A_HOL_DN)} + sypialnie 15,2 i 13,8 + hol góra {pl(A_HOL_UP)}. " + A_PLAN,
    "czy winyl idzie też na schody (stopnie nie są w tej ilości) i pod szafki kuchenne")
add(62167, A_VINYL, "Notatki: „wylewka samopoziom pod winyle” — m² jak winyl")
add(62163, A_VINYL + A_BATH_FLOOR, f"pod wylewkę {pl(A_VINYL)} + pod glazurę w łazienkach {pl(A_BATH_FLOOR)} (katalog)")
add(62171, LISTWY, f"Notatki: „listwy przypodłogowe”; obwód bez łazienek {pl(P_dry)} mb minus 30% na zabudowy (szafy w każdej sypialni, aneks, schowki w holu) — katalog: lepiej niedoszacować",
    "rodzaj listew (MDF/poliuretan czy metalowe — 120 zł/mb)")
add(62169, LISTWY, "Notatki: „akrylowanie listew” — tyle samo co listew (katalog)")

# — Ściany i sufity bez łazienek
add(62202, GK, "Notatki: „Ścianki z gk ok 20m2”; wełna i podwójna płyta jak w szablonie, niski stopień skomplikowania",
    "gdzie stają ścianki (rzut ich nie pokazuje) i czy któraś ma drzwi — wtedy wzmocnienie pod ościeżnicę 250 zł/kpl")
add(62206, 26, f"styki nowych ścianek z istniejącymi ścianami i sufitem: 20 m² / {pl(H)} = ok. 7,5 mb ścianki → 2 końce × {pl(H)} × 2 strony + góra 7,5 × 2 — szacunek agenta",
    "układ ścianek — od niego zależy długość styków")
add(62226, GK_FACES, "gładź Q3 na nowych ściankach GK, obie strony (20 m² × 2) — istniejące ściany mają gładź („gładzie są”)")
add(62231, GK_FACES, "przed i po gładziach — tylko nowe ścianki GK")
add(62235, GK_FACES, "farba podkładowa na świeżą gładź na ściankach GK")
add(62233, W_EXIST, f"istniejące ściany z gładzią: grunt + drobne poprawki przed malowaniem; obwód bez łazienek {pl(P_walls)} mb × {pl(H)} + klatka schodowa {pl(stairwell)} m² minus okna i drzwi balkonowe {pl(openings)}, otwory drzwiowe {pl(door_faces)}, ściana za szafkami aneksu {pl(kitchen_back)}. " + A_H)
add(62240, W_PAINT, f"Notatki: „malowanie bo gładzie są” — ściany istniejące {pl(W_EXIST)} + nowe ścianki GK {pl(GK_FACES)} m²; na biało; sufity nie, bo „sufity napinany raczej do wyceny u sprzedawcy”",
    "kolor ścian (malowanie w kolorze 26 zł/m²); czy sufity jednak malujemy")
add(62234, CORNERS, f"Notatki: „akryle w narożnikach” — pionowe narożniki wewnętrzne, ok. 30 × {pl(H)}; styku ściana-sufit nie liczę, bo przykryje go profil sufitu napinanego",
    "czy akryl także na styku ścian z sufitem (obwód ok. 80 mb, +1,1 tys. zł) — zależy od sufitów")
add(62215, 2 * POINTS + 4, "tynkowanie bruzd elektrycznych (40 mb) i wod-kan (4 mb)")
add(62216, 2 * POINTS, "gładź po bruzdach elektrycznych — pełnej gładzi nie robimy, więc po bruzdach tak (katalog)")
add(62243, 0, "Notatki: „sztukateria” — wybrana listwa ścienna",
    MISSING + "mb sztukaterii i gdzie (ściany czy sufit — sufitowa 110 zł/mb); przy suficie napinanym raczej ścienna")
add(62245, 0, "malowanie sztukaterii — tyle samo mb co montaż",
    MISSING + "jak montaż sztukaterii — mb")
add_new(62200, "Montaż paneli ściennych, lamele, dekory itp", "m²", 150, 3.1,
        "katalog prac (#756, 150 zł/m²) — szablon nie ma tej pracy; Notatki: „ścianka RTV z naklejoną płytą z ledem” — przyjęta jedna płyta ok. 1,2 × 2,6 m",
        "wymiar i rodzaj płyty (klient prosi o inspiracje); czy ścianka RTV to jedna z nowych ścianek GK")

# — Łazienka (2: góra 4,2 m² z rzutu, dół „WC” zmierzone — Notatki: „dwie łazienki dwa prysznice”)
add(62249, 16, "na łazienkę: prysznic 3 (zimna, ciepła, odpływ) + umywalka podtynkowa 3 + WC 2 — × 2 łazienki (katalog)",
    "dolna łazienka to na rzucie WC bez prysznica — punkty prysznica tam są nowe")
add(62252, 2, "Notatki: „geberity itp.” — po jednym w łazience")
add(62253, 2, "zabudowa GK każdego stelaża")
add(62255, 2, "Notatki: „dwa prysznice z odpływami liniowymi” — odpływ jednospadkowy",
    "koperta zamiast jednospadkowego (+300 zł/szt.); czy da się zrobić odpływ nisko w posadzce (inaczej schodek +1000 zł)")
add(62324, 2, "prysznice bez brodzika, z odpływem liniowym → szyba stała", "rodzaj kabiny/ścianki")
add(62267, 2, "Notatki: „półeczki z glazury, baterie podtynkowe” — przedścianka z półką pod baterię podtynkową w każdym prysznicu",
    "czy półki to przedścianka, czy wnęka w ścianie")
add(62289, 3, "obłożenie półek płytkami, ok. 1,5 mb na prysznic")
add(62262, BATH_WALLS + 2 * A_BATH_FLOOR, f"ściany {pl(BATH_WALLS)} + podłogi i sufity {pl(A_BATH_FLOOR)} m² (katalog)")
add(62271, BATH_TILES, "folia w płynie na wszystkich ścianach i podłodze (katalog)")
add(62273, 25, "ok. 15 mb na 4 m² (katalog): łazienka górna 15 + dolna ok. 10")
add(62287, BATH_WALLS, f"glazura do sufitu na wszystkich ścianach: góra {pl(perim(laz_up))} mb × {pl(H)} − drzwi = {pl(laz_walls)}, dół {pl(perim(wc_dn))} mb × {pl(H)} − drzwi = {pl(wc_walls)}; format standard z Notatek",
    "wysokość płytek — do sufitu czy niżej (poniżej sufitu ściana malowana z gładzią)")
add(62280, A_BATH_FLOOR, f"podłogi łazienek: góra 4,2 (rzut) + dół {pl(A_WC)} (zmierzone)")
add(62294, BATH_TILES, "fugowanie = wszystkie płytki (Manual)", "fuga epoksydowa czy cementowa")
add(62295, 40, "Manual: 20–30 mb na łazienkę — dolna granica, bo łazienki są małe")
add(62296, 28, "na łazienkę: WC 5 + prysznic 3 + umywalka podtynkowa 3 + puszki przy lustrze 2 + kratka 1 (katalog)",
    "grzejnik w łazience (+2 otwory/szt.)")
add(62298, perim(laz_up) + perim(wc_dn), "styk płytek z sufitem — obwody obu łazienek")
add(62274, 6, "narożniki przedścianek, ok. 3 mb na łazienkę — zaniżone (katalog: przy wątpliwościach nie zawyżaj)")
add(62297, 2, "Notatki: „wycenić spłuczke z glazury” — przycisk z glazury przy każdym WC",
    "jedna czy dwie (Notatki w liczbie pojedynczej: −650 zł)")
add(62302, 2, "Notatki: „baterie podtynkowe” — prysznic")
add(62309, 2)
add(62304, 2, "Notatki: „baterie umywalkowe podtynkowe”")
add(62308, 2)
add(62325, 2, "umywalka na szafce/blacie", "umywalka wisząca czy na szafce")
add(62334, 2, "szafka podumywalkowa w każdej łazience")
add(62328, 2)
add(62330, 2, "WC podwieszane na geberitach")
add(62319, 2)
add(62300, 6, "Notatki: „biały montaż” — 3 akcesoria na łazienkę")

# — Montaż stolarki
add(62358, 5, "Notatki: „drzwi ukryte” — z rzutu 5 otworów: dół sypialnia + łazienka (WC), góra 2 sypialnie + łazienka",
    "liczba drzwi — czy także schowki pod schodami i w holu")

# — Elektryka
add(62370, PTS_EL, f"Notatki: „punkty elektryczne + oświetleniowe ok 20 szt.” — przyjęty podział pół na pół: {PTS_EL} gniazd/łączników",
    "podział 20 punktów na gniazda i oświetlenie (różnica 30 zł/pkt)")
add(62368, PTS_LIGHT, f"jw.: {PTS_LIGHT} punktów oświetleniowych, w tym zasilanie LED ścianki RTV")
add(62377, OSPRZET, "Notatki: „biały montaż, gniazdka, włączniki” — cały osprzęt w mieszkaniu: pokoje po 5–6, aneks 8, salon 8, hole i łazienki po 3 — szacunek agenta",
    "liczba gniazd i łączników w mieszkaniu")
add(62378, 2, "łącznik schodowy na dole i na górze schodów")
add(62388, LAMPS, "Notatki: „lampy etc.” — salon 3, aneks 1, 3 sypialnie, 2 hole, schody 1, 2 łazienki — szacunek agenta",
    "liczba lamp")
add(62393, 5, "LED za płytą na ścianie RTV — obwód płyty ok. 1,2 × 2,6, dwa boki ok. 5 mb")
add(62394, 1, "zasilacz LED ścianki RTV")

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in sorted(by.items(), key=lambda kv: -kv[1]): print(f"{s:42} {v:12.2f}")
zero = [r for r in draft if r['qty'] == 0]
added = [r for r in draft if (r['section'], r['description']) not in {(v['section'], v['description']) for v in rows.values()}]
print(f"{len(draft)} rows ({len(added)} added, {len(zero)} at qty 0), total {total:.2f}")
print(f"floor {A_FLOOR:.2f} (vinyl {A_VINYL:.2f}, baths {A_BATH_FLOOR:.2f}; hol dół {A_HOL_DN:.2f}, hol góra {A_HOL_UP:.2f}, WC {A_WC:.2f}), "
      f"P_dry {P_dry:.2f}, listwy {LISTWY}, W_exist {W_EXIST:.2f} (stairwell {stairwell:.2f}, openings {openings:.2f}, doors {door_faces:.2f}), "
      f"W_paint {W_PAINT:.2f}, bath walls {BATH_WALLS:.2f} (góra {laz_walls:.2f}, dół {wc_walls:.2f}), corners {CORNERS:.2f}")
