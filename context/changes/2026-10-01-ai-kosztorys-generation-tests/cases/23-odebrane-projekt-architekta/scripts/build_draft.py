# Builds measure/ai-draft-load.json for production #218 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). Assumptions go into the row's `assumptions`, unknowns into `missingData`.
# Inputs: the owner's mail (inputs/client-inquiry.md — flat received from the developer, gładź + 2× malowanie
# on walls and ceilings), the architect's technical drawings (7 sheets, 1:48, inwentaryzacja + projekt) and
# 15 wizualizacji. Both PDFs carry the „Do analizy AI” mark (set by the owner after the first draft).
# One bathroom → it stays in the template „Łazienka". Measurements: measurement.md.
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

def pl(x): return f"{x:.2f}".replace(".", ",")

draft = []
def add(i, qty, assumptions=None, missing=None, price=None, section=None):
    r = dict(rows[i]); r['qty'] = round(qty, 2)
    if section: r['section'] = section
    if price is not None: r['clientPrice'] = float(price)
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

def add_new(section, description, unit, price, qty, assumptions=None, missing=None):
    r = dict(section=section, description=description, unit=unit, clientPrice=float(price), qty=round(qty, 2))
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

BATH = 'Łazienka'
S = BATH
WALLS_SEC = rows[50534]['section']
MLECZKO = rows[50534]['description']

# ——— Geometry (inwentaryzacja, wymiary w cm, skala 1:48 sprawdzona na dwóch wymiarach)
H = 2.65                                     # rozwinięcia łazienki: 93 + 172 = 265
LIVING = 4.10 * 6.18 + 1.70 * 0.49 - 1.15 * 3.82   # salon + aneks + hol (otwarte L) minus część sypialni
BED = 2.92 * 3.78
BATH_F = 1.73 * 2.76 - 0.63 * 0.41           # łazienka minus wnęka pionu
DRY = LIVING + BED
FLOOR_ALL = DRY + BATH_F
PER_LIVING = 2.40 + 0.49 + 1.70 + 2.85 + 1.15 + 3.82 + 2.95 + 6.18
PER_BED = 2 * (2.92 + 3.78)
PER_DRY = PER_LIVING + PER_BED
WALLS_GROSS = PER_DRY * H
DOOR = 0.80 * 2.05                           # otwór zmniejszony pod ościeżnicę ukrytą
OPENINGS = 2.15 * 2.30 + 1.56 * 2.30 + 1.04 * 2.18 + DOOR + 2 * DOOR   # okno + drzwi balkonowe, okno sypialni, wejście, łazienka (od holu), sypialnia (obustronnie)
KITCHEN_RUN = 2.40 + 2.25 + 0.49 + 0.58
KITCHEN_WALL = KITCHEN_RUN * H               # bez gładzi za szafkami (Manual)
BED_RUN = 3.78 + 1.71                        # zabudowa za łóżkiem + szafa
BED_BUILTIN = BED_RUN * H
ORAC = 0.75 * H                              # panel ścienny Orac Decor (malowany)
WALLS_TYNK = WALLS_GROSS - OPENINGS - KITCHEN_WALL - BED_BUILTIN - ORAC
TAPETA = 2.95 * H                            # ściana TV
GZYMS = 2.95 + 2.92                          # gzyms sufitowy przy oknach: salon + sypialnia
GK_FRAMES = 2.0                              # podświetlana podkonstrukcja GK na 4 ramy 40 × 60 (szacunek)
RUN_FREE = PER_DRY - KITCHEN_RUN - BED_RUN   # styk ściana-sufit poza zabudowami
LISTWY = 20.0                                # obwód minus zabudowy minus drzwi, zaokrąglone w dół

# Electrics outside the bathroom (rzuty elektryki i oświetlenia)
L_CEIL, L_KINK, L_LED = 7, 5, 9
L_DEW = 5
L_NEW = L_CEIL + L_KINK + L_LED - L_DEW      # 16
SOCKETS, SWITCHES, SWITCH_SCH = 19, 13, 8
E_DEW = 12
E_NEW = SOCKETS + SWITCHES - E_DEW           # 20
B_LIGHT, B_EL = 5, 4
BRUZDY_DRY = 2 * (L_NEW + E_NEW)
BRUZDY_BATH = 2 * (B_LIGHT + B_EL)
BRUZDY_EL = BRUZDY_DRY + BRUZDY_BATH

# Łazienka
PER_B = 8.98
BATH_WALLS = PER_B * H - DOOR
GK_LED = (0.87 + 0.80) * H                   # ściana z widoku 1-1: GK pod podtynkowe profile LED
GEB = 1.10 * 1.20                            # obudowa geberitu na całą szerokość, wys. 120
UNTILED = 1.10 * 1.45 + 0.67 * H             # nad szafką WC + za słupkiem pralka/suszarka
SMALL = 1.68 * H                             # 5 × 30 na ścianie prysznica
HALF_WALL = 3.0                              # półścianka 114 × 11 × 120 — obie strony + czoło
TILE_STD = BATH_WALLS - UNTILED - SMALL + HALF_WALL   # 60 × 120 + szachownica 20 × 20 na obudowie WC
BATH_PAINT = UNTILED + BATH_F
BATH_MLECZKO = BATH_WALLS - GK_LED - GEB + BATH_F

A_INW = "wymiary z inwentaryzacji architekta (skala 1:48)"
A_DEW = "rynek pierwotny — mail: „mieszkanie odebrane, są media”"
A_H = f"wysokość {pl(H)} m z rozwinięć łazienki (93 + 172 cm), nie 2,68 z Manuala"
A_BUILTIN = "bez ścian za szafkami kuchni i za zabudową przy łóżku i szafą w sypialni (jak gładź)"
M_DEW_PTS = "ile punktów dewelopera da się wykorzystać — rzut elektryki nie odróżnia nowych od istniejących"

# ——— Prace dodatkowe
add(50402, 1, "Manual: małe mieszkanie w całości — 1500 zł", "piętro i winda")
add(50405, 2, f"Manual: rynek pierwotny bez wyburzeń — 2 big bagi ({A_DEW})")

# ——— Wyburzenia, demontaże, zabezpieczenia
add(50454, FLOOR_ALL, f"Manual: zabezpieczenia po podłodze — całe mieszkanie {pl(FLOOR_ALL)} m² ({A_INW})")
add(50420, 2, "Manual: ok. 2 mb bruzd wod-kan na łazienkę")
add(50422, BRUZDY_EL, f"Manual: 2 mb na punkt — {L_NEW} oświetleniowych + {E_NEW} elektrycznych + łazienka {B_LIGHT + B_EL} = {L_NEW + E_NEW + B_LIGHT + B_EL} pkt; pod limitem 100 mb dla mieszkania do 50 m²",
    M_DEW_PTS)
add(50425, 3, f"Manual: na rynku pierwotnym grzejniki demontujemy zawsze — salon, sypialnia, łazienka", "liczba grzejników dewelopera")

# ——— Podłogi
FLOOR_A = f"„panel laminowany / winylowy” na rzucie podłóg — przyjęty winyl klejony układ prosty w salonie, aneksie, holu i sypialni {pl(DRY)} m²"
M_FLOOR = "laminat pływający czy winyl klejony — laminat (ta sama stawka 60 zł/m²) nie wymaga wylewki ani gruntowania podłóg, dochodzi listwa łączeniowa w drzwiach łazienki 0,8 mb: ≈ −2,1 tys. zł"
add(50467, DRY, FLOOR_A, M_FLOOR)
add(50494, DRY, "Manual: winyl klejony → wylewka samopoziomująca (95% przypadków)", M_FLOOR)
add(50463, DRY, "Manual: gruntowanie pod wylewkę, bez łazienki", M_FLOOR)
add(50470, LISTWY, f"cokół lakierowany h = 10 cm (rzut podłóg): obwód bez łazienki {pl(PER_DRY)} mb minus zabudowy kuchni i sypialni minus drzwi, zaokrąglone w dół — Manual: lepiej niedoszacować",
    "czy cokół przychodzi lakierowany fabrycznie — inaczej malowanie listew 25 zł/mb")
add(50458, LISTWY, "jak listwy")

# ——— Ściany i sufity bez łazienek
add(50500, WALLS_TYNK,
    f"mail: gładź na ścianach. Obwód {pl(PER_DRY)} mb × {pl(H)} minus okna i drzwi {pl(OPENINGS)} minus ściany za szafkami kuchni {pl(KITCHEN_WALL)} (Manual) minus zabudowa za łóżkiem i szafa w sypialni {pl(BED_BUILTIN)} minus panel ścienny {pl(ORAC)} = {pl(WALLS_TYNK)} m²; gładź także pod tapetą. {A_H}",
    f"czy ściany w Q4 (+18 zł/m²); gładź za zabudowami kuchni i sypialni ({pl(KITCHEN_WALL + BED_BUILTIN)} m²) razem z mleczkiem, gruntem, farbą podkładową i malowaniem ≈ +{pl((KITCHEN_WALL + BED_BUILTIN) * (57 + 7 + 12 + 12 + 26))} zł")
add(50498, DRY, f"mail: gładź na sufitach — {pl(DRY)} m², Q3",
    f"sufity z LED w gzymsach dają światło boczne — Q4 to +21 zł/m² (≈ +{pl(21 * DRY)} zł)")
add(50534, WALLS_TYNK + DRY, f"Manual: szlifowanie mleczka zawsze na tynkach deweloperskich — ściany {pl(WALLS_TYNK)} + sufity {pl(DRY)}; {A_BUILTIN}")
add(50505, WALLS_TYNK + DRY, f"Manual: gruntowanie wszędzie, gdzie gładź; {A_BUILTIN}")
add(50503, WALLS_TYNK + DRY, f"Manual: farba podkładowa na świeże gładzie; {A_BUILTIN}")
add(50495, RUN_FREE, f"Manual: akrylowanie — priorytet łączenie ścian z sufitem: obwód {pl(PER_DRY)} mb minus zabudowy {pl(KITCHEN_RUN + BED_RUN)} mb")
add(50508, DRY, "mail: 2 × malowanie sufitów — biało (wizualizacje); stawka obejmuje 2 warstwy")
WALL_PAINT = WALLS_TYNK - TAPETA + ORAC + GK_FRAMES
add(50514, WALL_PAINT,
    f"mail: 2 × malowanie ścian — w kolorze (wizualizacje), stawka obejmuje 2 warstwy: gładź {pl(WALLS_TYNK)} minus tapeta {pl(TAPETA)} plus panel ścienny {pl(ORAC)} plus podkonstrukcja GK {pl(GK_FRAMES)}; {A_BUILTIN}",
    "kolory ścian — jeśli wszystko biało, ściany i sufity biało 22 zł/m² (≈ −0,2 tys. zł)")
add(50530, RUN_FREE - GZYMS, f"odcinanie koloru ścian od białego sufitu: {pl(RUN_FREE)} mb minus odcinki z gzymsem {pl(GZYMS)}")
add(50517, GZYMS, f"gzyms sufitowy poliuretanowy z LED przy oknach (rzut sufitów): salon 2,95 + sypialnia 2,92 mb")
add(50510, GZYMS, "malowanie gzymsów")
add(50515, GZYMS, "karnisze w gzymsach przy oknach", "czy karnisze montujemy my")
add(50537, TAPETA, f"tapeta na ścianie TV od strony salonu 2,95 × {pl(H)}", "kto kładzie tapetę")
add_new(WALLS_SEC, "Montaż paneli ściennych, lamele, dekory itp", "m²", 150, ORAC,
        f"panel ścienny Orac Decor 0,75 × {pl(H)} przy ścianie TV, malowany; LED za panelem (katalog: 150 zł/m²)", "czy panel montuje stolarz")
add_new(WALLS_SEC, "Zabudowa ścian z GK na stelażu + przedścianki", "m²", 250, GK_FRAMES,
        "sypialnia: „podświetlana podkonstrukcja z g-k na ramy z obrazami” — 4 ramy 40 × 60, ok. 2 m² (katalog: 250 zł/m²)",
        "wymiary podkonstrukcji — rysunek podaje tylko ramy")
add(50542, 0, "Komentarz: narożniki dotyczą tynkowania — na rynku pierwotnym bez nich; ściany są deweloperskie, a krawędzie podkonstrukcji GK w sypialni są w cenie zabudowy GK")
add(50529, BRUZDY_DRY, f"Manual: naprawy po bruzdach tyle samo co bruzdowania — {pl(BRUZDY_DRY)} mb poza łazienką", M_DEW_PTS)

# ——— Kuchnia
add(50637, 1, "zlew w ciągu kuchennym (rzut)", "czy zlew zostaje przy podejściu dewelopera — przeniesienie 250 zł/pkt")
add(50633, 1, "bateria zlewozmywakowa")
add(50636, 1, "syfon zlewu")
add(50641, 1, "zmywarka (rzut kuchni)")
add(50639, 1, "płyta indukcyjna; przyjęte gniazdo 400 V dewelopera w miejscu płyty (rzut elektryki: „gniazdo trójfazowe KUCHNIA 400 V”)",
    "czy gniazdo 400 V dewelopera jest przy płycie — inaczej doprowadzenie przewodu 3-fazowego z gniazdem +500 zł")
add(50640, 1, "piekarnik w zabudowie")
add(50634, 3.5, "LED pod szafkami górnymi ok. 3,5 mb")
add(50643, 0, "między szafkami płyta kamienna / spiek (wizualizacje) — kamieniarz", "czy między szafkami jednak płytki — 220 zł/m²")

# ——— Montaż stolarki i ślusarski
add(50656, 2, "drzwi ukryte do łazienki i sypialni (wizualizacje: „dostosować otwory drzwiowe do ościeżnicy ukrytej”)",
    "zwykłe drzwi z ościeżnicą regulowaną to 380 zł/szt (−1,2 tys. zł)")
add(50664, 2, "dopasowanie otworów pod ościeżnicę ukrytą — zmniejszenie", "czy otwory trzeba poszerzyć — wtedy 350 zł/szt (+300 zł)")

# ——— Instalacja elektryczna i oświetleniowa
add(50701, L_NEW, f"rzut oświetlenia: {L_CEIL} punktów sufitowych + {L_KINK} kinkietów + ok. {L_LED} zasilań LED = {L_CEIL + L_KINK + L_LED}, minus ok. {L_DEW} punktów dewelopera", M_DEW_PTS)
add(50703, E_NEW, f"rzut elektryki: {SOCKETS} gniazd + {SWITCHES} łączników = {SOCKETS + SWITCHES}, minus ok. {E_DEW} punktów dewelopera", M_DEW_PTS)
add(50675, SOCKETS + SWITCHES - SWITCH_SCH, f"Manual: montaż gniazdek = liczba punktów — {SOCKETS} gniazd + {SWITCHES - SWITCH_SCH} zwykłych łączników")
add(50693, SWITCH_SCH, "łączniki schodowe/krzyżowe: 2 w holu, 2 przy drzwiach sypialni, 4 przy łóżku")
add(50674, 1, "gniazdo TV + internet przy ścianie TV")
add(50677, 1, "kanał TV na ścianie z tapetą", "z czego jest ściana TV — przy żelbecie inna stawka")
add(50691, 1, "uchwyt TV")
add(50685, L_CEIL, "lampy sufitowe: hol 1, kuchnia 2, jadalnia 1, salon 1, balkon 1, sypialnia 1")
add(50679, L_KINK, "kinkiety: 3 przy sofie, 2 przy łóżku")
add(50689, 15, f"taśmy LED: ściana TV {pl(H)} + gzymsy {pl(GZYMS)} + ramy w sypialni ok. 6,4 mb", "dokładne długości LED")
add(50690, 4, "zasilacze LED: gzym salonu, gzym sypialni, ściana TV, ramy")
add(50683, 1, "okap nad indukcją", "czy okap jest w zabudowie i kto go montuje")
add(50695, 1, "Manual: przy indukcji minimum przebudowa rozdzielni", "czy rozdzielnia dewelopera ma miejsce na nowe obwody")

# ——— Instalacja wodno-kanalizacyjna + c.o.
add(50708, 1, "grzejnik w salonie przenoszony na ścianę prostopadłą, nowy pionowy dekoracyjny (projekt)", "model grzejnika")
add(50709, 2, "przebudowa c.o. pod przeniesiony grzejnik — zasilanie i powrót")
add(50711, 1, "rozkucie i zatynkowanie podejść przeniesionego grzejnika")
add(50705, 1, "grzejnik w sypialni — ponowny montaż po pracach")

# ——— Łazienka
add_new(S, MLECZKO, "m²", 7, BATH_MLECZKO,
        f"Manual: mleczko na tynkach deweloperskich, nie pod GK — ściany {pl(BATH_WALLS)} minus GK {pl(GK_LED)} minus obudowa WC {pl(GEB)} plus sufit {pl(BATH_F)}")
add(50546, 4, "Manual: stan deweloperski ok. 4 pkt; pełne liczenie (WC, umywalka, prysznic, pralka) ok. 10 pkt",
    "czy podejścia dewelopera pasują do projektu — każdy dodatkowy punkt 250 zł")
add(50620, 4, "Manual: wkucie jak punkty wod-kan")
add(50569, 1, "WC podwieszane (projekt łazienki)")
add(50583, 1, "obudowa geberitu na całą szerokość 110 cm, wys. 120 cm = wysokość płytek")
add(50629, 0, "szafka nad WC wysoka, w zabudowie (wizualizacje) — stolarz", "czy szafkę nad WC składamy i montujemy my — wtedy 250 zł")
add(50579, 1, "odpływ punktowo-liniowy ze spadkiem w cztery strony (rysunek łazienki) — koperta")
add(50631, 1, "obniżenie kanalizacji pod odpływ prysznica", "czy odpływ dewelopera pasuje bez przebudowy — wtedy −800 zł")
add_new(S, "Wymurowanie ścianki w strefie prysznicowej", "szt", 1200, 1,
        "półścianka 114 × 11 × 120 cm z wnęką na półkę (rysunek łazienki); Manual: liczymy w stanie deweloperskim, gdy ścianka jest w projekcie (katalog: 1200 zł)")
add(50615, 2, "wnęka w półściance — płytki w glifach ok. 2 mb")
add(50586, 1, "szyba stała na półściance")
add(50557, GK_LED, f"GK klejone pod podtynkowe profile LED na ścianie z widoku 1-1: (0,87 + 0,80) × {pl(H)}")
add(50552, BATH_WALLS + HALF_WALL + 2 * BATH_F, f"Manual: ściany {pl(BATH_WALLS)} + półścianka {pl(HALF_WALL)} + podłoga i sufit po {pl(BATH_F)}")
add(50596, BATH_WALLS + HALF_WALL + BATH_F, "Manual: folia na wszystkich ścianach i podłodze")
add(50619, 16, "Manual: ok. 15 mb na 4 m² łazienki")
add(50606, BATH_F, f"podłoga 20 × 20 (rysunek łazienki) — {pl(BATH_F)} m²")
add(50611, SMALL, f"płytki 5 × 30 na ścianie prysznica 1,68 × {pl(H)}", "jeśli to format standardowy — 180 zł/m² (≈ −0,9 tys. zł)")
add(50613, TILE_STD,
    f"60 × 120 i szachownica 20 × 20 na obudowie WC (do 120 cm): ściany {pl(BATH_WALLS)} minus bez płytek {pl(UNTILED)} minus 5 × 30 {pl(SMALL)} plus półścianka {pl(HALF_WALL)}",
    "duży format 60 × 120 bez dopłaty za wielkoformat — szablon liczy go jako standard")
add(50556, TILE_STD + BATH_F, "fuga = płytki standard + podłoga")
add(50554, SMALL, "fuga = płytki 5 × 30")
add(50600, 8, "Komentarz: szlif 45° na krawędziach zabudów — półścianka ok. 4,7 + wnęka ok. 2 + krawędź nad stelażem WC 1,10 = ok. 8 mb")
add(50598, 25, "Manual: 20–30 mb")
add(50617, 18, "WC 5, prysznic 3, umywalka 3, grzejnik 2, puszki 4, kratka 1 (Manual: min. 15)")
add(50547, PER_B, "akryl po obwodzie sufitu")
add(50559, BATH_PAINT, f"ciemny sufit bez sufitu podwieszanego {pl(BATH_F)} + ściany bez płytek {pl(UNTILED)} (nad szafką WC, za słupkiem pralka/suszarka)")
add_new(S, rows[50503]['description'], "m²", 12, BATH_PAINT, "Manual: farba podkładowa w łazience — na malowane ściany i sufit")
add_new(S, rows[50517]['description'], "mb", 110, 1.73, "gzyms sufitowy z LED w łazience 1,73 mb")
add_new(S, rows[50510]['description'], "mb", 40, 1.73, "malowanie gzymsu w łazience")
add(50459, 0.67, "cokół z płytki 120 × 60 za słupkiem pralka/suszarka", section=S)
add(50529, BRUZDY_BATH + 2, f"Manual: naprawy po bruzdach w łazience — {BRUZDY_BATH} mb elektrycznych + 2 mb wod-kan", section=S)
add(50562, 1, "bateria prysznicowa podtynkowa (projekt)")
add(50550, 1, "biały montaż prysznica")
add(50564, 1, "bateria umywalkowa podtynkowa (projekt)")
add(50549, 1, "biały montaż umywalki")
add(50587, 1, "umywalka nablatowa", "blat i szafka podumywalkowa — stolarz")
add(50585, 1, "syfon umywalki")
add(50592, 1, "WC podwieszane")
add(50572, 1, "grzejnik drabinkowy")
add(50577, 1, "lustro")
add(50576, 2, "2 lampy sufitowe")
add(50573, 11.7, "profile LED pionowe ok. 9,1 mb + gzyms 1,73 + półka 0,84")
add(50574, 2, "2 zasilacze LED")
add(50626, B_LIGHT, "2 lampy + 3 zasilania LED")
add(50627, B_EL, "gniazda: przy lustrze, pralka, suszarka, łącznik")
add(50570, B_EL, "osprzęt jak punkty elektryczne")
add(50575, 1, "kratka wentylacyjna", "czy jest wentylator — rysunek go nie pokazuje")
add(50593, 1, "Manual: zawór czerpalny tylko pod pralkę")
add(50594, 1, "pralka w słupku z suszarką")
add(50595, 1, "suszarka w słupku nad pralką")
add(50560, 3, "uchwyt na ręcznik, papier, haczyk", "lista akcesoriów")

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in by.items(): print(f"{s:45s} {pl(v):>12s}  ({sum(1 for r in draft if r['section'] == s)})")
szablon = {(x['section'], x['description']) for x in rows.values()}
added = sum(1 for r in draft if (r['section'], r['description']) not in szablon)
print(f"rows {len(draft)}, total {pl(total)}, added {added}, zero {sum(1 for r in draft if r['qty'] == 0)}")
print(f"DRY {pl(DRY)} FLOOR_ALL {pl(FLOOR_ALL)} PER_DRY {pl(PER_DRY)} OPENINGS {pl(OPENINGS)} WALLS_TYNK {pl(WALLS_TYNK)} WALL_PAINT {pl(WALL_PAINT)}")
print(f"BATH_F {pl(BATH_F)} BATH_WALLS {pl(BATH_WALLS)} TILE_STD {pl(TILE_STD)} BATH_MLECZKO {pl(BATH_MLECZKO)} BRUZDY_EL {BRUZDY_EL}")
