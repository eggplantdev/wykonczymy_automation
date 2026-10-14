# Builds measure/ai-draft-load.json for production #212 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). Assumptions go into the row's `assumptions`, unknowns into `missingData`.
# Inputs: the client's mail in Notatki (inputs/client-inquiry.md), the developer's rzut of flat J (Pu 61,52 m²;
# łaz. nr 5 5,83 m², W.C nr 6 1,53 m²) and two screenshots of the client's own layout program with printed
# dimensions (łazienka 1: 315, 155, 27, 87; the new small bathroom: 90, 169,5, 27, „?,33 m²”) plus two photos
# of the old bathroom. No heights are printed anywhere.
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

def pl(x): return f"{x:.2f}".replace(".", ",")

BIG = 'Łazienka duża'
SMALL = 'Łazienka mała'
UNKNOWN = 'Praca wybrana, ilość nieznana: '

H = 2.60                      # Manual: rynek wtórny, no height printed
DOOR = 0.80 * 2.05
A_H = f"wysokość {pl(H)} m — rysunki jej nie podają, Manual: rynek wtórny 2,60 m"

# — Łazienka duża (rzut nr 5: 5,83 m²; projekt „łazienka 1” 5,84 m², szerokość 315 → głębokość 1,85)
B_W, B_D = 3.15, 1.85
B_A = 5.83
B_P = 2 * (B_W + B_D)
TUB = (1.80, 0.75)            # projekt: wanna wzdłuż krótkiej ściany, ok. 1,78 × 0,77 w skali programu
TUB_RIM = 0.55
TILE_TOP = 2.10               # wysokość płytek w strefie kąpielowej — mail mówi tylko „w części kąpielowej”
OLD_TILE = 1.75               # zdjęcia: stare płytki do ok. 2/3 wysokości ściany
b_floor = B_A - TUB[0] * TUB[1]
b_zone_mb = B_D + 2 * TUB[1]                       # ściana za wanną + dwa jej boki
b_zone_tiles = b_zone_mb * (TILE_TOP - TUB_RIM)
b_tub_front = TUB[0] * TUB_RIM
b_wall_tiles = b_zone_tiles + b_tub_front
b_walls_all = B_P * H - DOOR
b_gladz_walls = b_walls_all - b_zone_mb * TILE_TOP
b_gladz = b_gladz_walls + B_A
b_old_tiles = (B_P - 0.80) * OLD_TILE
b_paint_strip = b_zone_mb * (TILE_TOP - OLD_TILE)
b_folia = B_A + b_zone_mb * TILE_TOP
b_tape = 15 * B_A / 4
A_BIG = f"łazienka duża {pl(B_W)} × {pl(B_D)} m = {pl(B_A)} m² (rzut nr 5, projekt 315 cm), {A_H}"
A_TUB = f"wanna ok. {pl(TUB[0])} × {pl(TUB[1])} m wzdłuż krótkiej ściany (projekt), rant {pl(TUB_RIM)} m"
A_ZONE = f"płytki w strefie kąpielowej od rantu wanny do {pl(TILE_TOP)} m na ścianie za wanną i dwóch jej bokach ({pl(b_zone_mb)} mb) — mail nie podaje wysokości"
M_ZONE = f"do jakiej wysokości płytki w części kąpielowej — do sufitu to +{pl(b_zone_mb * (H - TILE_TOP))} m² płytek zamiast gładzi"
M_OWN = "które prace rozbiórkowe klient robi sam („w większości sami”) — skucie płytek, demontaż wanny, WC, umywalki, starej zabudowy"

# — Łazienka mała (projekt: „?,33 m²” — 2,02 × 1,70 w skali linijki programu minus kanał 0,62 × 0,18 = 3,33)
S_W, S_D = 2.02, 1.695
S_A = 3.33
S_P = 2 * (S_W + S_D) + 2 * 0.18
TRAY = (1.00, 0.80)           # „brodzik 100x80” (mail)
s_walls = S_P * H - DOOR
s_floor = S_A - TRAY[0] * TRAY[1]
s_tape = 15 * S_A / 4
A_SMALL = f"łazienka mała {pl(S_W)} × {pl(S_D)} m z wnęką kanału = {pl(S_A)} m² (projekt: „?,33 m²”, 169,5 i 90 cm podane; pierwsza cyfra zasłonięta, odczytana ze skali), {A_H}"
M_AREA = "metraż małej łazienki — na zrzucie zasłonięta pierwsza cyfra „?,33 m²”"

# — Nowa ścianka przy wejściu (ściana małej łazienki z drzwiami) i 2 mikro ścianki do wyburzenia
NEW_WALL_MB = S_D + 0.10
new_wall = NEW_WALL_MB * H - DOOR
MICRO = 2 * 1.10 * H
A_NEW_WALL = f"nowa ścianka wzdłuż boku łazienki {pl(NEW_WALL_MB)} mb × {pl(H)} m minus drzwi 0,80 × 2,05 — długość z projektu (169,5 cm + grubość ścian), materiał przyjęty GK z wełną; " + A_H
M_NEW_WALL = "GK czy bloczki (bloczki 10 cm 110 zł/m² + nadproże 150 zł) i gdzie dokładnie stanie ścianka przy wejściu; czy stare wejście do schowka trzeba zamurować"
A_MICRO = f"2 mikro ścianki z rzutu (ok. 6,5 cm, po ok. 1,10 m) × {pl(H)} m — wymiar odczytany z rzutu, materiał przyjęty miękki; " + A_H

# — Elektryka
K_POINTS = 5                  # płyta, piekarnik, zmywarka, okap, lodówka (mail)
S_EPOINTS = 3                 # projekt: „2 gniazdka 1 włącznik”; mail: gniazdko do grzejnika + przeniesienie włącznika
EL_BRUZDY = 2 * (K_POINTS + S_EPOINTS)

draft = []
def add(i, qty, assumptions=None, missing=None, section=None):
    r = dict(rows[i]); r['qty'] = round(qty, 2)
    if section: r['section'] = section
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

def add_new(section, description, unit, price, qty, assumptions=None, missing=None):
    r = dict(section=section, description=description, unit=unit, clientPrice=float(price), qty=round(qty, 2))
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

# — Prace dodatkowe
add(50402, 1, "1 kpl na cały zakres — Manual: małe mieszkanie w całości 1500 zł (łazienka wtórna 1000, remont wtórny 2000); cena z szablonu",
    "piętro i winda — wyższe piętra bez windy ok. 2500 zł (Manual)")
add(50407, 1, "kontener — Manual: rynek wtórny z wyburzeniami zawsze z kontenerem, przy rynku wtórnym od 1800 zł; gruz z 2 łazienek i 2 ścianek",
    "czy wywóz gruzu po stronie firmy (klient robi rozbiórkę sam i pyta o cennik wywozu) — kontener 1800 zł, 2 big bagi 900 zł; piętro i dojazd dla kontenera")

# — Wyburzenia, demontaże, zabezpieczenia
add(50454, 61.52, "cała podłoga mieszkania Pu 61,52 m² (rzut) — Manual: zabezpieczenia liczymy po podłodze mieszkania; mieszkanie puste do odbioru kluczy pod koniec października",
    "czy w trakcie prac ktoś już mieszka — zamieszkane 45 zł/m²")
add(50432, 0, "demontaże zostają po stronie klienta: „prace rozbiórkowe wykonamy w większości sami”",
    UNKNOWN + M_OWN + "; Manual: demontaże zwykle 800–1500 zł")
add(50437, 0, f"stare płytki łazienki dużej do ok. {pl(OLD_TILE)} m ({pl(b_old_tiles)} m² ścian + {pl(B_A)} m² podłogi) — klient skuwa sam",
    UNKNOWN + "czy skuwanie płytek robi klient, czy firma — " + M_OWN)
add(50442, 0, "klient pyta o cennik „usuwania drzwi z ościeżnicami”",
    UNKNOWN + "ile drzwi z ościeżnicami do usunięcia i czy ościeżnice są drewniane (metalowe 200 zł)")
add(50440, b_old_tiles + B_A, f"łazienka duża po skuciu: ściany ze starymi płytkami {pl(B_P - 0.80)} mb × {pl(OLD_TILE)} m = {pl(b_old_tiles)} m² + podłoga {pl(B_A)} m² — katalog: zawsze po skuwaniu płytek; wysokość starych płytek ze zdjęć",
    M_OWN)
add(50456, b_paint_strip, f"łazienka duża: pas farby nad starymi płytkami w strefie kąpielowej, {pl(b_zone_mb)} mb × ({pl(TILE_TOP)} − {pl(OLD_TILE)}) m — katalog: zrywamy tylko część ponad starymi płytkami",
    M_ZONE)
add(50450, MICRO, A_MICRO + "; mail: „2 mikro ścianki które trzeba będzie wyburzyć”",
    "długość i materiał mikro ścianek oraz czy wyburzenie robi klient")
add(50420, 4, "Manual: ok. 2 mb na łazienkę — łazienka duża (WC podtynkowy, pralka) i mała",
    "długość podejścia wod-kan do kuchni przez ścianę z małej łazienki (+80 zł/mb)")
add(50422, EL_BRUZDY, f"Manual: ok. 2 mb na punkt — {K_POINTS} punktów w kuchni + {S_EPOINTS} w małej łazience",
    "ile gniazd ogólnych w kuchni — każdy punkt +2 mb bruzdy")
add(50425, 1, "łazienka duża: demontaż „nieprawidłowo zamontowanego” grzejnika ściennego (mail)",
    "czy wymiana grzejnika możliwa w sezonie grzewczym — katalog: zawsze decyzja administracji")

# — Podłogi
add(50491, 2 * 1.10, "po 2 mikro ściankach, po ok. 1,10 m (rzut) — pod płytki małej łazienki", "długość mikro ścianek")

# — Ściany i sufity bez łazienek
add(50522, new_wall, A_NEW_WALL, M_NEW_WALL)
add(50521, 1, "drzwi do małej łazienki w nowej ściance GK — katalog: otwór w ściance GK wzmocniony profilami UA", M_NEW_WALL)
add(50536, 2 * H + NEW_WALL_MB, "styki nowej ścianki GK: 2 pionowe przy murze + sufit", M_NEW_WALL)
add(50539, 2 * (H + 1.10), "poprawki po wyburzeniu 2 mikro ścianek: pas na ścianie i suficie przy każdej", "długość mikro ścianek")
add(50500, new_wall, "gładź na nowej ściance GK od strony wejścia (strona łazienki pod płytki)",
    "malowanie strony korytarza — mail o nim nie mówi, nie liczone (22 zł/m²)")
add(50505, new_wall, "przed i po gładzi na nowej ściance od strony wejścia")
add(50529, 2 * K_POINTS, f"tynkowanie bruzd elektrycznych w kuchni ({K_POINTS} punktów × 2 mb); bruzdy w łazienkach idą pod płytki")

# — Łazienka duża
add(50546, 4, "WC podtynkowy w tym samym miejscu (zimna + kanalizacja) + pralka (zimna + kanalizacja) — mail: przyłącza pralki „poprowadzone w dziwny sposób”; wanna i umywalka zostają na swoich podejściach",
    "czy podejścia wanny i umywalki zostają, czy wymiana instalacji (+250 zł/pkt)", BIG)
add(50569, 1, "„zestaw podtynkowy wc” (mail)", None, BIG)
add(50583, 1, "„z zabudową z gk” (mail)", "czy zabudowa geberitu w płytkach (+ok. 1,2 m² płytek i 5 otworów) — mail daje płytki tylko w części kąpielowej", BIG)
add(50592, 1, "WC podwieszane na stelażu", None, BIG)
add(50590, 1, A_TUB + " — „wstawić nową wannę”, zabudowa z bloczków z rewizją", "rodzaj wanny (wolnostojąca 600 zł bez zabudowy)", BIG)
add(50563, 1, "bateria wannowa natynkowa — standard", "bateria podtynkowa: 900 zł + biały montaż 200 zł zamiast 250 zł", BIG)
add(50552, b_gladz + b_wall_tiles + b_floor, f"pod gładź {pl(b_gladz)} + płytki ścienne {pl(b_wall_tiles)} + podłoga {pl(b_floor)} m²", None, BIG)
add(50602, b_zone_tiles, f"ściany pod nowe płytki w strefie kąpielowej po skuciu starych — katalog: po skuwaniu zawsze wyrównanie. {A_ZONE}", M_ZONE, BIG)
add(50596, b_folia, f"podłoga {pl(B_A)} m² + ściany strefy kąpielowej {pl(b_zone_mb)} mb × {pl(TILE_TOP)} m — Manual: w łazience wszystkie ściany i podłoga, tu tylko strefa mokra, bo reszta ścian idzie pod gładź i farbę",
    "czy hydroizolacja na wszystkich ścianach (+" + pl(b_gladz_walls) + " m² × 30 zł)", BIG)
add(50619, b_tape, f"katalog: ok. 15 mb na łazienkę 4 m² → {pl(B_A)} m²", None, BIG)
add(50607, b_floor, f"gres na podłodze {pl(B_A)} m² minus wanna {pl(TUB[0] * TUB[1])} m². {A_TUB}", "format płytek (standard 30×30–120×60)", BIG)
add(50613, b_wall_tiles, f"{A_ZONE}: {pl(b_zone_tiles)} m² + front zabudowy wanny {pl(TUB[0])} × {pl(TUB_RIM)} = {pl(b_tub_front)} m². {A_BIG}", M_ZONE, BIG)
add(50556, b_floor + b_wall_tiles, "fugowanie = wszystkie płytki (Manual)", None, BIG)
add(50598, 20, "Manual: 20–30 mb na łazienkę — dolna granica, bo płytki tylko w strefie kąpielowej", None, BIG)
add(50617, 2, "bateria natynkowa wannowa 2 (katalog); WC, grzejnik i pralka poza płytkami", "jeśli zabudowa WC w płytkach: +5 otworów", BIG)
add(50547, B_P, f"styk gładzi ze ścianą i sufitem — obwód łazienki {pl(B_P)} mb", None, BIG)
add_new(BIG, rows[50502]['description'], 'm²', rows[50502]['clientPrice'], b_gladz,
        f"„w reszcie łazienki trzeba będzie zrobić gładzie” (mail): ściany {pl(b_walls_all)} m² (obwód {pl(B_P)} mb × {pl(H)} m minus drzwi) minus strefa kąpielowa {pl(b_zone_mb)} mb × {pl(TILE_TOP)} m = {pl(b_gladz_walls)} m² + sufit {pl(B_A)} m²; stawka rynek wtórny, bo po skuciu płytek potrzebny podkład z tynku; malowanie robi klient (mail), nie liczone; " + A_H,
        "czy gładź także na suficie (" + pl(B_A) + " m²)")
add(50572, 1, "wymiana grzejnika ściennego (mail) — grzejnik na c.o. z zaworami", "czy wymiana grzejnika możliwa w sezonie grzewczym; czy trzeba przerobić podejścia c.o. (250 zł/pkt)", BIG)
add(50594, 1, "pralka zostaje w tym samym miejscu (mail)", None, BIG)
add(50593, 3, "pralka 1 + umywalka 2 — katalog: zawory czerpalne do pralki i pod umywalkę z baterią stojącą; bateria umywalki przyjęta stojąca", "bateria umywalkowa podtynkowa: 550 zł + biały montaż 100 zł", BIG)
add(50587, 1, "umywalka zostaje w tym samym miejscu (mail) — na szafce, jak na zdjęciu", None, BIG)
add(50561, 1, None, None, BIG)
add(50585, 1, "syfon umywalki", None, BIG)
add(50627, 0, "projekt łazienki 1: „3 gniazdka”", UNKNOWN + "ile z 3 gniazdek z projektu to nowe punkty, a ile istniejące", BIG)
add(50570, 3, "osprzęt na 3 gniazdka z projektu („3 gniazdka”) — zakładany na nowo po gładzi", None, BIG)
add(50576, 1, "istniejąca lampa (zdjęcie) — ponowny montaż po gładzi", None, BIG)
add(50575, 1, "istniejąca kratka (zdjęcie) — ponowny montaż", None, BIG)
add(50584, 1, "rewizja w płytkach strefy kąpielowej — na zdjęciu w obecnej zabudowie są drzwiczki rewizyjne", "czy rewizja do pionu zostaje w strefie płytek", BIG)

# — Łazienka mała
add(50546, 8, "WC: zimna + kanalizacja 2, umywalka: zimna + ciepła + kanalizacja 3, prysznic: zimna + ciepła + odpływ 3 — katalog: każdy punkt osobno; w schowku są rury z ciepłą i zimną wodą (mail), kanalizacja z dawnego W.C (rzut)",
    "gdzie jest pion kanalizacji w schowku", SMALL)
add(50569, 1, "„wc zestaw podtynkowy” (mail)", None, SMALL)
add(50583, 1, None, None, SMALL)
add(50592, 1, None, None, SMALL)
add(50567, 1, "wariant A z mailem: brodzik 100 × 80 z kabiną", "wariant B — odpływ liniowy z szybą (pozycje przy 0)", SMALL)
add(50563, 1, "„zestaw natynkowy” (mail)", None, SMALL)
add(50580, 0, "wariant B z maila: odpływ liniowy zamiast brodzika", "Wariant B (klient prosi o oba): odpływ liniowy 1600 zł + szyba 550 zł zamiast brodzika z kabiną 1500 zł, + 0,80 m² gresu na podłodze; czy da się zejść ze spadkiem bez schodka (schodek 1000 zł)", SMALL)
add(50586, 0, "wariant B: szyba stała do odpływu liniowego", "Wariant B (klient prosi o oba): szyba stała 550 zł razem z odpływem liniowym", SMALL)
add(50552, s_walls + 2 * S_A, f"ściany {pl(s_walls)} + podłoga i sufit po {pl(S_A)} m²", None, SMALL)
add(50602, 0, "ściany obecnego schowka pod płytki", UNKNOWN + "w jakim stanie są ściany schowka (tynk, stare płytki) — wyrównanie 80 zł/m² na do " + pl(s_walls) + " m²", SMALL)
add(50628, 0, "rury z ciepłą i zimną wodą w schowku (mail)", UNKNOWN + "czy rury/piony w schowku trzeba zabudować GK (np. 1 pion × 2,60 mb)", SMALL)
add(50584, 1, "schowek ma drzwiczki rewizyjne do rur (mail) — przy płytkach do sufitu dostęp przez rewizję z glazury", "co jest za drzwiczkami rewizyjnymi (liczniki, zawory) i gdzie ma zostać rewizja", SMALL)
add(50596, s_walls + S_A, "folia w płynie na wszystkich ścianach i podłodze (katalog)", None, SMALL)
add(50619, s_tape, f"katalog: ok. 15 mb na łazienkę 4 m² → {pl(S_A)} m²", None, SMALL)
add(50613, s_walls, f"„gres od dołu do samej góry” (mail): obwód {pl(S_P)} mb × {pl(H)} m minus drzwi 0,80 × 2,05. {A_SMALL}", M_AREA + " — każdy 1 m² więcej to więcej płytek, folii i fugi", SMALL)
add(50607, s_floor, f"podłoga {pl(S_A)} m² minus brodzik {pl(TRAY[0])} × {pl(TRAY[1])} (wariant A)", "wariant B (odpływ liniowy): +0,80 m² gresu", SMALL)
add(50556, s_walls + s_floor, "fugowanie = wszystkie płytki (Manual)", None, SMALL)
add(50598, 20, "Manual: 20–30 mb na łazienkę — dolna granica dla 3,33 m²", None, SMALL)
add(50617, 15, "WC 5 + bateria natynkowa 2 + umywalka 3 + 3 puszki + kratka 1 = 14 → Manual: minimum 15 przy płytkach na wszystkich ścianach", None, SMALL)
add(50600, 2, "krawędzie zabudowy geberitu ok. 0,9 m × 2 (katalog)", "narożniki kanału przy WC (projekt: wnęka 0,62 × 0,18 m) — jeśli w płytkach do sufitu, +2 × 2,60 × 2 = 10,4 mb (katalog: nie zawyżaj, do weryfikacji)", SMALL)
add(50547, S_P, f"styk płytek z sufitem — obwód {pl(S_P)} mb", None, SMALL)
add(50559, S_A, "sufit — jedyna powierzchnia bez płytek", "czy malowanie sufitu robi klient (gładź na suficie zostaje)", SMALL)
add(50587, 1, "„powiesić szafkę z umywalką” (mail)", None, SMALL)
add(50630, 1, "klient wprost prosi o powieszenie szafki z umywalką — gotowa szafka łazienkowa (Manual: zwykle montuje stolarz)", "czy szafkę montuje stolarz", SMALL)
add(50561, 1, None, None, SMALL)
add(50585, 1, "syfon umywalki (brodzik ma syfon w komplecie)", None, SMALL)
add(50593, 2, "katalog: zawory pod umywalkę z baterią stojącą — bateria przyjęta stojąca", "bateria umywalkowa podtynkowa: 550 zł + biały montaż 100 zł", SMALL)
add(50571, 1, "„grzejnik elektryczny naścienny z gniazdkiem do niego” (mail)", None, SMALL)
add(50627, S_EPOINTS, "projekt: „2 gniazdka 1 włącznik” — gniazdko pod grzejnik, gniazdko przy umywalce, przeniesiony włącznik (mail)", None, SMALL)
add(50570, S_EPOINTS, "osprzęt na 2 gniazdka i włącznik", None, SMALL)
add(50576, 1, "oprawa w miejscu obecnego światła schowka", "czy nowy punkt świetlny (100 zł)", SMALL)
add(50575, 1, "schowek ma wentylację (mail)", None, SMALL)
add(50581, 1, "„wstawić drzwi do łazienki” w nowej ściance (mail)", M_NEW_WALL, SMALL)

# — Kuchnia
add(50643, 6 * 0.6 * 0.6, "„kilka płytek 60x60 pewnie z 5 albo 6” (mail) — przyjęto 6 × 0,36 m²", "5 czy 6 płytek i gdzie na ścianie", None)

# — Instalacja elektryczna i oświetleniowa
add(50703, K_POINTS, "nowe obwody z mailu: płyta, piekarnik, zmywarka, okap, lodówka — po 1 punkcie",
    "ile gniazd ogólnych nad blatem „pod sprzęty” (projekt: 21 gniazdek i 3 włączniki w całym pokoju z kuchnią) — każde +130 zł + osprzęt 39 zł; czy płyta na 3 fazy (+370 zł)")
add(50675, K_POINTS, "osprzęt / puszka przyłączeniowa na 5 nowych punktów kuchni")
add(50695, 1, "nowe obwody kuchni i łazienki małej w rozdzielnicy nad wejściem — Manual: przy indukcji minimum przebudowa do 18 modułów; płyta przyjęta indukcyjna",
    "rodzaj płyty i stan rozdzielnicy — przy płycie gazowej wystarczy dołożenie bezpieczników (200 zł/szt.)")

# — Instalacja wodno-kanalizacyjna + c.o.
add(50710, 3, "zlew: zimna + ciepła + kanalizacja, przez ścianę z małej łazienki (mail); zmywarka na tym samym podejściu",
    "gdzie stanie zlew i czy ściana między łazienką a kuchnią jest nośna (przebicie w żelbecie drożej)")

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in sorted(by.items(), key=lambda kv: -kv[1]): print(f"{s:42} {v:12.2f}")
known = {(x['section'], x['description']) for x in rows.values()}
def template_key(r): return ('Łazienka' if r['section'] in (BIG, SMALL) else r['section'], r['description'])
added = [r for r in draft if template_key(r) not in known]
zero = [r for r in draft if r['qty'] == 0]
print(f"{len(draft)} rows ({len(added)} added, {len(zero)} at qty 0, {len(draft) - len(zero)} quantified), total {total:.2f}")
print(f"big: P {B_P:.2f} floor {b_floor:.2f} zone_tiles {b_zone_tiles:.2f} wall_tiles {b_wall_tiles:.2f} gladz_walls {b_gladz_walls:.2f} gladz {b_gladz:.2f} "
      f"old_tiles {b_old_tiles:.2f} folia {b_folia:.2f} tape {b_tape:.2f}; small: P {S_P:.2f} walls {s_walls:.2f} floor {s_floor:.2f} tape {s_tape:.2f}; "
      f"new_wall {new_wall:.2f} micro {MICRO:.2f}")
