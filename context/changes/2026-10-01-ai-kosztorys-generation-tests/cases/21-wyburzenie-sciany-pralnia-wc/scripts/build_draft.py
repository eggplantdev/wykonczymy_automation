# Builds measure/ai-draft-load.json for production #217 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). Assumptions go into the row's `assumptions`, unknowns into `missingData`.
# Inputs: the owner's mail (inputs/client-inquiry.md), one projekt PDF (układ funkcjonalny, stan docelowy,
# wymiary w cm) and 29 wizualizacji. One bathroom (the former toilet) → it stays in the template „Łazienka".
# Measurements: measurement.md.
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
WALLS_SEC = rows[50534]['section']
MLECZKO = rows[50534]['description']

# ——— Geometry (projekt, wymiary w cm; the plan shows the target state only)
H = 2.68                                     # Manual: stan deweloperski 2,68 m
SALON = 4.16 * 5.83 + 0.75                   # salon z aneksem 416 × 583 + strip by the tall cabinets
HALL = 7.0                                   # hol 2,35 szer. × ok. 3,0 (estimate, chain 144/110)
BED = 3.51 * 3.05                            # sypialnia
ROOM3 = 3.51 * 2.70                          # pokój 3
PRAL = 1.91 * 2.28                           # pralnia
BATH_F = 2.79 * 1.25 + 2.37 * 0.52           # łazienka in L: 2,79 × 1,25 + 2,37 × 0,52
DRY = SALON + HALL + BED + ROOM3             # parkiet / gładź sufitów
FLOOR_ALL = DRY + PRAL + BATH_F
PER = {'salon': 2 * (4.16 + 5.83), 'hol': 2 * (2.35 + 3.0), 'sypialnia': 2 * (3.51 + 3.05), 'pokój 3': 2 * (3.51 + 2.70)}
PER_DRY = sum(PER.values())
WALLS_GROSS = PER_DRY * H
OPENINGS = 0.15 * WALLS_GROSS                # okna + drzwi
KITCHEN_WALL = 4.19 * H + 1.93 * H           # ciąg kuchenny + wysoka zabudowa: bez gładzi (Manual)
WARDROBES = 2.5 * H + 2.0 * H                # szafa w holu + zabudowa w sypialni
GK_LEN = 1.84 + 2.17 + 0.84 + 0.71           # nowe ściany pralni (kreskowane na rzucie)
PRAL_DOOR = 0.70 * 2.05
GK_WALL = GK_LEN * H - PRAL_DOOR
WALLS_TYNK = WALLS_GROSS - OPENINGS - KITCHEN_WALL - WARDROBES - GK_WALL   # gładź on tynk only
CEIL_Q4 = SALON + BED                         # sufity z LED w gzymsach — światło boczne
CEIL_Q3 = HALL + ROOM3
TAPETA_CEIL = 9.0                             # sufit sypialni bez zielonej ramy
TAPETA_MURAL = 3.51 * H                       # ściana z fototapetą w pokoju 3
TAPETA_NICHE = 4.0                            # wnęka z tapetą „marmur” w holu
TAPETA = TAPETA_CEIL + TAPETA_MURAL + TAPETA_NICHE
DEMO = 4.20 * H                               # ściana salon / pokój 3

# Łazienka
PER_B = 9.32
BATH_DOOR = 0.78 * 2.05
BATH_WALLS = PER_B * H - BATH_DOOR
TILE_W = (1.87 + 0.91) * H                    # płytki tylko w prysznicu: ściana wschodnia + południowa
STONE_W = 1.0                                 # marmurowa ściana za umywalką — kamieniarz
WOOD_W = 1.25 * H                             # ściana WC w drewnie — stolarz
PAINT_W = BATH_WALLS - TILE_W - STONE_W - WOOD_W
NICHE_W = 0.91 * H                            # przedścianka z półkami w prysznicu
GEB_FRONT = 1.25 * 1.20

A_PLAN = "wymiary z rzutu (układ funkcjonalny, stan docelowy)"
A_DEW = "zakładam stan deweloperski — na rzucie „grzejnik deweloperski lub nowy”"
M_MARKET = "czy mieszkanie jest w stanie deweloperskim (rynek pierwotny) — przy rynku wtórnym dochodzą skuwanie, demontaże i gładź rynek wtórny"
A_H = f"wysokość {pl(H)} m (Manual: stan deweloperski)"
M_H = "wysokość pomieszczeń — rzut jej nie podaje"
M_HALL = "wymiary holu — rzut podaje tylko szerokość (ok. 2,35 m)"
M_TOILET = "rzut pokazuje tylko stan docelowy toalety — czy jej powiększenie wymaga wyburzenia lub przestawienia ścianek"

# ——— Prace dodatkowe
add(50402, 1, "1 kpl na cały remont — cena z szablonu 1500 zł; Manual: duże mieszkanie deweloperskie z wieloma zmianami (wyburzenie, nowa pralnia, przebudowa toalety) ok. 2000 zł",
    "czy podnieść do 2000 zł (Manual, +500 zł); piętro i winda — wyższe piętro bez windy ok. 2500 zł")
add(50407, 1, f"Manual: przy wyburzeniach kontener od 1800 zł — gruz ze ściany salon / pokój 3 ({pl(DEMO)} m²), bruzd i kucia w łazience",
    "piętro i dostęp dla kontenera; na parterze lub 1. piętrze bez wyburzeń wystarczyłby kontener 1500 zł")

# ——— Klimatyzacja (salon)
A_AC = "jednostka klimatyzacji w salonie (wizualizacje)"
add(50410, 1, f"{A_AC}; cena w szablonie 0 zł — Manual: przy nieznanym modelu 2200 zł", "model jednostki — do wpisania cena (Manual: 2200 zł, gdy model nieznany)")
add(50411, 1, A_AC)
add(50417, 5, "Manual: rury minimum 5 mb", "miejsce agregatu i trasa rur")
add(50408, 5, "bruzda pod rury klimatyzacji jak długość rur — miękki materiał", "z czego są ściany na trasie — przy żelbecie 200 zł/mb")
add(50415, 1, "przebicie przez ścianę zewnętrzną do agregatu", "czy ściana zewnętrzna jest z żelbetu — wtedy przebicie 600 zł")
add(50418, 1, "Manual: wsporniki zawsze")
add(50413, 1, "skropliny ukryte w ścianie — salon w wysokim standardzie", "czy skropliny mogą iść grawitacyjnie na zewnątrz (bez syfonu −300 zł) albo natynkowo (150 zł)")
add(50419, 5, "jak bruzdy klimatyzacji")

# ——— Wyburzenia, demontaże, zabezpieczenia
add(50454, FLOOR_ALL, f"Manual: zabezpieczenia m² po podłodze — całe mieszkanie {pl(FLOOR_ALL)} m² ({A_PLAN}; hol szacunkowo {pl(HALL)} m²)", M_HALL)
add(50450, DEMO, f"Notatki: „ściana pomiędzy salonem a pokojem 3 jest do wyburzenia” — rzut pokazuje już stan docelowy; zakładam ścianę na linii filara między oknami salonu, ok. 4,20 mb × {pl(H)}",
    f"grubość i materiał ściany (przy żelbecie 300–450 zł/m²) oraz czy jest nośna; {M_TOILET} — każdy m² wyburzenia +110 zł")
add(50422, 36, "Manual: ok. 2 mb na punkt — 18 nowych punktów (10 elektrycznych + 8 oświetleniowych)", "ile punktów dewelopera zostaje na miejscu")
add(50420, 2, "Manual: ok. 2 mb bruzd wod-kan na łazienkę")
add(50425, 4, f"Manual: na rynku pierwotnym grzejniki demontujemy praktycznie zawsze — salon 2, sypialnia 1, pokój 3 1 (w tym grzejnik do przeniesienia). {A_DEW}",
    "liczba grzejników dewelopera")

# ——— Podłogi
add(50489, DRY, f"jodełka we wszystkich pokojach i holu (wizualizacje): salon z aneksem {pl(SALON)} + hol {pl(HALL)} + sypialnia {pl(BED)} + pokój 3 {pl(ROOM3)} = {pl(DRY)} m²",
    "parkiet czy panele winylowe — winyl klejony 95 zł/m² wymaga wylewki samopoziomującej 55 zł/m² (≈ +2,1 tys. zł); czy parkiet jest fabrycznie wykończony (inaczej cyklinowanie 150 zł/m²)")
add(50463, DRY + PRAL, f"pod parkiet i płytki pralni: {pl(DRY)} + {pl(PRAL)}")
add(50491, 4.2, "po wyburzeniu ściany salon / pokój 3 — pas posadzki pod dawną ścianą, jak długość ściany")
add(50478, PRAL, f"Notatki: w pralni „tylko płytki na podłogę i oświetlenie” — pralnia {pl(1.91)} × {pl(2.28)} = {pl(PRAL)} m², format standard",
    "format płytek pralni (wizualizacji pralni brak); pralka i suszarka stoją w pralni — czy ich podłączenie i podejścia wod-kan są po naszej stronie (2 × 100 zł + 2 × 250 zł); czy malujemy ściany pralni")
add(50462, PRAL, "fugowanie = płytki pralni (Manual)")
LISTWY = PER_DRY * 0.75
add(50470, LISTWY, f"Manual: obwód mieszkania bez łazienki {pl(PER_DRY)} mb minus 25% na zabudowy i drzwi = {pl(LISTWY)} mb", "wysokość i rodzaj listew")
add(50458, LISTWY, "jak listwy")

# ——— Ściany i sufity bez łazienek
add(50522, GK_WALL, f"nowe ściany pralni (kreskowane na rzucie, ok. 13 cm): {pl(GK_LEN)} mb × {pl(H)} minus drzwi {pl(PRAL_DOOR)} = {pl(GK_WALL)} m²; niski stopień", M_H)
add(50521, 1, "Manual: otwór drzwiowy w ścianie GK pralni wzmocniony profilami UA")
GK_TAPE = 2 * GK_LEN + 4 * H + 4 * H
add(50536, GK_TAPE, f"taśmy na nowych ścianach pralni: styk z sufitem obustronnie 2 × {pl(GK_LEN)} + styki z murem 4 × {pl(H)} + styki płyt 4 × {pl(H)}")
add(50539, 4.2 + 2 * H, f"po wyburzeniu ściany salon / pokój 3: pas na suficie 4,20 mb + dwa styki ze ścianami 2 × {pl(H)}")
add(50542, 4 * H, "narożniki zewnętrzne: 2 przy pralni, 2 w holu", "liczba narożników zewnętrznych")
add(50500, WALLS_TYNK, f"ściany na tynku deweloperskim: obwód pokoi i holu {pl(PER_DRY)} mb × {pl(H)} minus okna i drzwi 15% minus ściana kuchni za szafkami {pl(KITCHEN_WALL)} (Manual) minus szafy {pl(WARDROBES)} minus GK pralni = {pl(WALLS_TYNK)} m²; gładź także pod tapetą. {A_H}",
    f"{M_H}; {M_HALL}; czy na ścianach Q4 (+18 zł/m²)")
add(50498, CEIL_Q3, f"sufity holu {pl(HALL)} i pokoju 3 {pl(ROOM3)} — Q3", M_HALL)
add(50499, CEIL_Q4, f"sufity salonu {pl(SALON)} i sypialni {pl(BED)} — Q4, bo LED w gzymsach daje światło boczne (wizualizacje)")
add(50534, WALLS_TYNK + DRY, f"Manual: szlifowanie mleczka zawsze na tynkach deweloperskich — ściany {pl(WALLS_TYNK)} + sufity {pl(DRY)}", M_MARKET)
add(50505, WALLS_TYNK + DRY, "Manual: gruntowanie wszędzie, gdzie gładź")
add(50503, WALLS_TYNK + DRY, "Manual: farba podkładowa na świeże gładzie")
add(50495, PER_DRY, f"Manual: akrylowanie — priorytet łączenia ze sufitem, obwód pokoi i holu {pl(PER_DRY)} mb")
CEIL_WHITE = DRY - TAPETA_CEIL
add(50508, CEIL_WHITE, f"sufity biało {pl(DRY)} minus tapeta na suficie sypialni {pl(TAPETA_CEIL)}")
WALL_PAINT = WALLS_TYNK + GK_WALL - TAPETA_MURAL - TAPETA_NICHE
add(50514, WALL_PAINT, f"ściany w kolorze (wizualizacje): gładź {pl(WALLS_TYNK)} + zewnętrzna strona GK pralni {pl(GK_WALL)} minus tapety ścienne {pl(TAPETA_MURAL + TAPETA_NICHE)}",
    "czy wnętrze pralni malujemy — Notatki mówią tylko o płytkach i oświetleniu")
add(50530, PER_DRY, "kolorowe ściany przy białym suficie + zielona rama tapety na suficie sypialni — obwód pokoi i holu")
add(50537, TAPETA, f"tapeta na suficie sypialni {pl(TAPETA_CEIL)} (bez zielonej ramy), fototapeta na ścianie pokoju 3 {pl(TAPETA_MURAL)}, wnęka „marmur” w holu {pl(TAPETA_NICHE)} (wizualizacje)",
    "czy tapety kładziemy my i ile ich jest — wymiary z wizualizacji szacunkowe")
add(50517, 20, f"gzymsy sufitowe w salonie z LED (wizualizacje) — obwód salonu ok. {pl(PER['salon'])} mb, z rozetą w cenie", "czy gzymsy są też w sypialni")
add(50516, 35, "ramki sztukateryjne na ścianach salonu ok. 20 mb + listwy ścienne w sypialni ok. 15 mb (wizualizacje)", "dokładny układ ramek")
add(50510, 55, "jak sztukateria ścienna i sufitowa")
add(50515, 8.3, "karnisze przy oknach salonu i aneksu (zasłony na rzucie) — szerokość strefy okien ok. 5,83 mb + sypialnia ok. 2,5 mb", "czy karnisze są ukryte w gzymsie i kto je montuje")
add_new(WALLS_SEC, "Montaż paneli ściennych, lamele, dekory itp", "m²", 150, 2.0 * H,
        f"ściana z lamelami w pokoju 3 (wizualizacje), ok. 2,0 × {pl(H)}; cena z katalogu (Montaż paneli ściennych, lamele, dekory itp)",
        "szerokość ściany z lamelami i czy montuje je stolarz")

# ——— Kuchnia
add(50643, 0, "przestrzeń między szafkami w kamieniu (wizualizacje) — kamieniarz")
add(50633, 1, "bateria kuchenna")
add(50637, 1, "zlew w ciągu 419 cm (rzut)")
add(50636, 1, "syfon zlewu")
add(50641, 1, "zmywarka „Z” na rzucie")
add(50639, 1, "płyta indukcyjna (rzut)")
add(50640, 1, "piekarnik w wysokiej zabudowie", "czy w wysokiej zabudowie jest piekarnik")
add(50634, 4.2, "LED pod szafkami górnymi na długości ciągu 4,19 mb (wizualizacje)")

# ——— Montaż stolarki
add(50656, 4, "drzwi ukryte bez opasek (wizualizacje holu): łazienka, pralnia, pokój 3, sypialnia",
    "czy drzwi są ukryte z wykończeniem — zwykłe drzwi z regulowaną ościeżnicą 380 zł/szt (−2,5 tys. zł)")

# ——— Instalacja elektryczna
add(50701, 8, "nowe punkty oświetleniowe: szynoprzewody salon i hol, lampa nad stołem, kinkiety salon i sypialnia, LED w gzymsach, pralnia", "ile punktów dewelopera można wykorzystać")
add(50703, 10, "nowe / przesunięte gniazda i włączniki: ściana TV, klimatyzacja, kuchnia po zmianie układu, sypialnia przy łóżku, pralnia (pralka, suszarka)", "ile punktów dewelopera zostaje na miejscu")
add(50675, 40, "osprzęt w całym mieszkaniu poza łazienką — ok. 40 gniazdek i włączników", "liczba gniazdek i włączników")
add(50688, 7, "szynoprzewody natynkowe: salon ok. 4 mb + hol ok. 3 mb (wizualizacje)")
add(50680, 2, "żyrandole w salonie i sypialni (wizualizacje)")
add(50685, 3, "lampa nad stołem, lampa w pokoju 3, oprawa w pralni (Notatki: „oświetlenie do montażu”)")
add(50679, 4, "kinkiety: 2 przy łóżku, 2 w salonie (wizualizacje)")
add(50689, 33, f"taśmy LED w gzymsach salonu ok. 20 mb i sypialni ok. 13 mb (wizualizacje)", "czy LED w sypialni jest w gzymsie, czy w listwie ściennej")
add(50690, 2, "zasilacze LED: salon i sypialnia")
add(50683, 1, "okap")
add(50674, 1, "ściana TV w salonie")
add(50691, 1, "uchwyt TV")
add(50695, 1, "Manual: przy indukcji rozdzielnia min. 18 modułów", "czy rozdzielnia dewelopera wystarczy")

# ——— Wod-kan + c.o.
add(50709, 2, "Notatki: „grzejnik do przeniesienia” — zasilanie i powrót", "nowe miejsce grzejnika (rzut pokazuje tylko stan docelowy)")
add(50711, 1, "rozkucie i zatynkowanie podejść przenoszonego grzejnika")
add(50705, 4, "ponowny montaż zdjętych grzejników (w tym przeniesionego)", "czy zostają grzejniki dewelopera, czy nowe")

# ——— Łazienka (dawna toaleta)
S = BATH
add(50546, 4, f"Manual: stan deweloperski ok. 4 pkt, nie pełne liczenie — toaleta staje się łazienką z prysznicem (Notatki: „Toaleta też musi zmienić swój rozmiar i funkcje”). {A_DEW}",
    f"{M_TOILET}; przy pełnym liczeniu (prysznic, umywalka, WC) ok. 8 pkt (+1000 zł)", section=S)
add(50620, 4, "Manual: w deweloperce rury idą przed ścianą — wkucie punktów jak wyżej", section=S)
add(50631, 1, "nowy odpływ prysznica w miejscu, gdzie go nie było", "czy pion i kanalizacja pozwalają na odpływ liniowy bez przebudowy (−800 zł)", section=S)
add(50580, 1, "odpływ liniowy wzdłuż ściany południowej (rzut) — jednospadkowy", section=S)
add(50569, 1, "stelaż WC podwieszanego", section=S)
add(50583, 1, "zabudowa stelaża — okładzina z drewna na ścianie WC po stronie stolarza", section=S)
add(50624, 1, "wnęka z ok. 3 półkami z LED w prysznicu (wizualizacje)", "liczba półek we wnęce: 1 półka 1200, 2 półki 1500 zł", section=S)
add_new(S, "Zabudowa ścian z GK na stelażu + przedścianki", "m²", 250, 0,
        "przedścianka 10 cm wzdłuż ściany południowej „do potwierdzenia po inwentaryzacji” (rzut) — nie liczę",
        f"czy przedścianka będzie potrzebna — 2,37 × {pl(H)} ≈ +1,6 tys. zł")
add(50599, 1, "ciemny sufit z wpuszczoną szczeliną LED (wizualizacje) — mała łazienka, 1 kpl (Manual)", section=S)
add(50552, TILE_W + 2 * BATH_F, f"ściany pod płytki {pl(TILE_W)} + podłoga i sufit {pl(BATH_F)} × 2", section=S)
add_new(S, MLECZKO, "m²", 7, BATH_WALLS - GEB_FRONT - NICHE_W,
        f"Manual: mleczko na tynkach deweloperskich, poza przedściankami i sufitem podwieszanym — ściany {pl(BATH_WALLS)} minus zabudowa geberitu {pl(GEB_FRONT)} minus wnęka {pl(NICHE_W)}",
        M_MARKET)
add(50596, BATH_WALLS + BATH_F, f"Manual: folia w płynie na wszystkich ścianach i podłodze — ściany {pl(BATH_WALLS)} + podłoga {pl(BATH_F)}", section=S)
add(50619, 14, f"Manual: ok. 15 mb na 4 m², można lekko niedoszacować — łazienka {pl(BATH_F)} m²", section=S)
add(50611, TILE_W, f"płytki tylko w prysznicu: ściana wschodnia 1,87 + południowa 0,91 × {pl(H)} = {pl(TILE_W)} m²; wąskie białe płytki pionowo → mały format. {A_PLAN}",
    "format płytek ściennych — przy standardowym formacie 180 zł/m² (≈ −1,5 tys. zł)", section=S)
add(50609, BATH_F, f"podłoga: czarno-białe ośmiokąty ok. 10 cm z kostką (wizualizacje) → mozaika; łazienka w L 2,79 × 1,25 + 2,37 × 0,52 = {pl(BATH_F)} m²",
    "format płytki podłogowej — jako 20 × 20 200 zł/m² (≈ −0,9 tys. zł)", section=S)
add(50554, TILE_W + BATH_F, f"fugowanie = płytki (Manual): {pl(TILE_W)} + {pl(BATH_F)}, fuga cementowa — mały format", "fuga cementowa czy epoksydowa (120 zł/m²)", section=S)
add(50598, 20, "Manual: 20–30 mb — mała łazienka, płytki tylko w prysznicu", section=S)
add(50617, 4, "bateria prysznicowa podtynkowa z deszczownicą 3 + zasilanie LED wnęki 1 (Manual); umywalka na kamieniu, WC na ścianie w drewnie — bez otworów w płytkach", section=S)
add(50600, 2, "Manual: nie zawyżaj — krawędzie wnęki w prysznicu", section=S)
add(50547, PER_B, f"styk ścian z sufitem — obwód {pl(PER_B)} mb", section=S)
add(50559, PAINT_W + BATH_F, f"Manual: malowanie tylko ścian bez płytek — ściany {pl(BATH_WALLS)} minus płytki {pl(TILE_W)}, kamień {pl(STONE_W)} i drewno przy WC {pl(WOOD_W)} = {pl(PAINT_W)} + sufit {pl(BATH_F)}", section=S)
add(50562, 1, "bateria prysznicowa podtynkowa z deszczownicą (wizualizacje)", section=S)
add(50550, 1, "biały montaż strefy prysznica", section=S)
add(50564, 1, "bateria umywalkowa ścienna na marmurze (wizualizacje); kamień po stronie kamieniarza", section=S)
add(50549, 1, "biały montaż umywalki", section=S)
add(50587, 1, "umywalka nablatowa na kamiennym blacie", "kto robi i montuje blat kamienny", section=S)
add(50585, 1, "syfon umywalki", section=S)
add(50592, 1, "WC podwieszane", section=S)
add(50572, 1, "złota drabinka (wizualizacje)", section=S)
add(50586, 1, "szyba stała prysznica walk-in 91 × 103 (rzut)", section=S)
add(50577, 1, "lustro w ramie sztukateryjnej (wizualizacje)", section=S)
add(50576, 1, "kinkiet przy lustrze", section=S)
add(50573, 1.8, "LED pod 3 półkami wnęki ok. 3 × 0,6 mb", section=S)
add(50574, 1, "zasilacz LED wnęki", section=S)
add(50626, 3, "kinkiet, LED wnęki, LED w suficie", section=S)
add(50627, 1, "gniazdo przy umywalce", section=S)
add(50570, 3, "gniazdo + 2 włączniki", section=S)
add(50575, 1, "kratka wentylacyjna", section=S)
add(50560, 3, "uchwyt na ręcznik, papier, haczyk", "lista akcesoriów", section=S)

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in by.items(): print(f"{s:45s} {pl(v):>12s}")
szablon = {(x['section'], x['description']) for x in rows.values()}
added = sum(1 for r in draft if (r['section'], r['description']) not in szablon)
print(f"rows {len(draft)}, total {pl(total)}, added {added}, zero {sum(1 for r in draft if r['qty'] == 0)}")
print(f"DRY {pl(DRY)} FLOOR_ALL {pl(FLOOR_ALL)} WALLS_TYNK {pl(WALLS_TYNK)} BATH_F {pl(BATH_F)} GK_WALL {pl(GK_WALL)}")
