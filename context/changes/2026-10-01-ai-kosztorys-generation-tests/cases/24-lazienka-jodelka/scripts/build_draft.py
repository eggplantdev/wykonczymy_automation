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
WODKAN = rows[50709]['section']
MLECZKO = rows[50534]['description']
NAPRAWY = rows[50529]['description']
WKUCIE = rows[50620]['description']

H = 2.80
DOOR = 0.80 * 2.05
ENTRY = 0.90 * 2.05
BALCONY = 0.90 * 2.20
WIN_SALON = 1.80 * 1.50
WIN = 1.50 * 1.50
OPEN = 1.00

A_SALON, A_POKOJ, A_SYP, A_HOL, A_BATH = 31.18, 10.78, 14.07, 6.39, 4.36
DRY = A_SALON + A_POKOJ + A_SYP + A_HOL
TOTAL = DRY + A_BATH

PER_SALON = 2 * (6.41 + 4.86)
KITCHEN_RUN = 3.60
W_SALON = (PER_SALON - OPEN) * H - BALCONY - WIN_SALON - KITCHEN_RUN * H
PER_POKOJ = 2 * (2.35 + 4.58)
W_POKOJ = PER_POKOJ * H - WIN - DOOR
PER_SYP = 2 * (3.955 + 3.557)
W_SYP = PER_SYP * H - WIN - DOOR
PER_HOL = 2 * (3.895 + 1.64)
WARDROBE = 1.20
W_HOL = (PER_HOL - OPEN - WARDROBE) * H - ENTRY - 3 * DOOR

WALLS = W_SALON + W_POKOJ + W_SYP + W_HOL
PER_DRY = PER_SALON + PER_POKOJ + PER_SYP + PER_HOL
LINE_ALL = PER_DRY - 2 * OPEN
LISTWY = PER_DRY * 0.75

PER_B = 2 * (1.97 + 2.405)
BATH_WALLS = PER_B * H - DOOR
RIBBED = round(1.06 * H, 2)
TILE_BIG = round(BATH_WALLS - RIBBED, 2)
TUB = 1.60 * 0.80
TILE_F = round(A_BATH - TUB, 2)
GEB_FRONT = 0.80 * 1.20

A_H = f"wysokość {pl(H)} m (z rzutu: „WYSOKOŚĆ 280 cm”)"
A_DEW = "stan deweloperski (zdjęcia: surowe posadzki, tynki deweloperskie, rury przed ścianą)"
A_PROJ = "projekt łazienki"
A_WALLS = f"ściany {pl(WALLS)} m² przeliczone z rzutu — jak w gładzi na ścianach"
M_KITCHEN_RUN = f"długość zabudowy kuchennej — rzut jej nie podaje (przyjęte {pl(KITCHEN_RUN)} mb bez gładzi za szafkami; każdy metr więcej to ok. −2,8 m², ≈ −320 zł na gładzi, mleczku, gruntowaniu, farbie podkładowej i malowaniu)"
M_SOCKETS = "klient jeszcze doprecyzuje: 1 czy 2 gniazdka i czy przesuwamy 2 kable oświetleniowe na suficie (jedno gniazdko mniej ≈ −270 zł, bez przesuwania kabli ≈ −400 zł, z bruzdami i naprawami)"
M_PENDANT = "czy deweloper wyprowadził kable pod 2 lampy wiszące w łazience (wtedy ≈ −400 zł z punktami, bruzdami i naprawami)"

# ——— Prace dodatkowe
add(50402, 1, f"1 kpl na całe mieszkanie {pl(TOTAL)} m² — cena z szablonu 1500 zł (Manual: małe mieszkanie w całości 1500 zł)",
    "piętro i winda — Manual: wyższe piętra bez windy ok. 2500 zł")
add(50405, 2, f"Manual: rynek pierwotny bez wyburzeń — 2 big bagi ({A_DEW})")

# ——— Wyburzenia, demontaże, zabezpieczenia
add(50454, TOTAL, f"Manual: zabezpieczenia m² po podłodze — całe mieszkanie {pl(TOTAL)} m² (rzut)")
add(50422, 12, "Manual: ok. 2 mb bruzd na punkt — 2 nowe gniazdka + 2 przesunięte kable oświetleniowe na suficie + 2 nowe punkty lamp wiszących w łazience = 6 pkt × 2 mb",
    f"{M_SOCKETS}; {M_PENDANT}")
add(50420, 2, "Manual: ok. 2 mb bruzd wod-kan na łazienkę — schowanie przyłączy w ścianie")
add(50425, 1, "klient: przesunięcie grzejnika łazienkowego — demontaż grzejnika na czas prac; w pokojach na zdjęciach grzejników nie widać",
    "na zdjęciu łazienki grzejnika nie widać — czy jest już zawieszony (jeśli nie, −100 zł); czy w pokojach są grzejniki do zdjęcia na czas prac (100 zł demontaż + 250 zł montaż za sztukę)")

# ——— Podłogi
add(50489, DRY, f"klient: deska wielowarstwowa jodełka klasyczna w całym mieszkaniu oprócz łazienki — salon z aneksem {pl(A_SALON)} + pokój {pl(A_POKOJ)} + sypialnia {pl(A_SYP)} + hol {pl(A_HOL)} = {pl(DRY)} m² (powierzchnie z rzutu), także pod aneksem kuchennym; deska klejona",
    "czy posadzka dewelopera wymaga wyrównania pod klejenie (wylewka samopoziomująca 55 zł/m², ≈ +3,4 tys. zł); czy deska pod szafkami kuchennymi")
add(50463, DRY, f"Manual: gruntowanie pod podłogi klejone — {pl(DRY)} m², bez łazienki")
add(50470, LISTWY, f"Manual: obwód pomieszczeń bez łazienki {pl(PER_DRY)} mb minus 25% na drzwi, szafę w holu i ciąg kuchenny = {pl(LISTWY)} mb — „lepiej niedoszacować”",
    "wysokość i rodzaj listew; zabudowy meblowe poza kuchnią i szafą w holu")
add(50458, LISTWY, "jak listwy (Manual)")
add(50492, 0.8, "Manual: korek między parkietem a glazurą — próg drzwi łazienki 0,8 mb")

# ——— Ściany i sufity bez łazienek
add(50500, WALLS,
    f"ściany przeliczone z rzutu (obwód × {pl(H)} minus okna, drzwi, przejście hol–salon, szafa w holu i ściana za szafkami kuchennymi — Manual): salon z aneksem {pl(W_SALON)} + pokój {pl(W_POKOJ)} + sypialnia {pl(W_SYP)} + hol {pl(W_HOL)} = {pl(WALLS)} m²; Q3; {A_H}",
    f"gładź Q3 (Q4 +18 zł/m²); {M_KITCHEN_RUN}")
add(50498, DRY, f"klient: gładź na sufitach — salon, pokój, sypialnia, hol {pl(DRY)} m² (rzut), Q3", "gładź Q3 (Q4 +18 zł/m²)")
add(50534, WALLS + DRY,
    f"Manual: szlifowanie mleczka zawsze na tynkach deweloperskich — ściany {pl(WALLS)} + sufity {pl(DRY)}; {A_WALLS}; {A_H}", M_KITCHEN_RUN)
add(50505, WALLS + DRY, f"Manual: gruntowanie przed i po gładziach — wszędzie, gdzie gładź: ściany {pl(WALLS)} + sufity {pl(DRY)}; {A_WALLS}; {A_H}", M_KITCHEN_RUN)
add(50503, WALLS + DRY, f"Manual: farba podkładowa na świeże gładzie — ściany {pl(WALLS)} + sufity {pl(DRY)}; {A_WALLS}; {A_H}", M_KITCHEN_RUN)
add(50495, LINE_ALL, f"Manual: akrylowanie łączeń ścian z sufitem — obwody salonu, pokoju, sypialni i holu bez przejścia hol–salon ≈ {pl(LINE_ALL)} mb")
add(50514, WALLS, f"klient: malowanie w kolorze — ściany {pl(WALLS)} m²; {A_WALLS}; {A_H}", M_KITCHEN_RUN)
add(50509, DRY, f"klient: „ściany i sufity — gładź, malowanie kolor” — sufity w kolorze {pl(DRY)} m²",
    f"czy sufity też w kolorze, czy na biało (biało 23 zł/m², −{pl(4 * DRY)} zł)")
add(50529, 8, "Manual: naprawy po bruzdowaniu tyle samo co bruzd — 8 mb pod 2 gniazdka i 2 przesunięte kable na suficie (bruzdy w łazience liczone w sekcji Łazienka)", M_SOCKETS)

# ——— Kuchnia
M_RAD_EL = "czy grzejnik łazienkowy jest na c.o. — jeśli elektryczny: bez przebudowy c.o. (−500 zł) i montaż grzejnika elektrycznego 200 zł zamiast 250 zł, ewentualnie punkt elektryczny 120 zł (razem ≈ −0,5 tys. zł)"
M_KITCHEN = "zakres klienta w kuchni to tylko schowanie przyłączy — czy podłączenie zlewu, baterii, płyty i okapu jest po naszej stronie (ok. 1,1 tys. zł), czy robi to firma meblowa"
add(50637, 0, "zlew w aneksie (rzut) — nie w zakresie klienta", M_KITCHEN)
add(50633, 0, "jak zlew", M_KITCHEN)
add(50636, 0, "jak zlew", M_KITCHEN)
add(50639, 0, "płyta w aneksie (rzut) — nie w zakresie klienta", M_KITCHEN)
add(50683, 0, "okap nad płytą — nie w zakresie klienta", M_KITCHEN)

# ——— Montaż stolarki
add(50655, 2, "klient: obsadzenie 3 drzwi wewnętrznych z ościeżnicami regulowanymi — na rzucie z holu: pokój, sypialnia, łazienka; drzwi łazienki w sekcji Łazienka, tu 2: pokój i sypialnia",
    "czy 3 drzwi to łazienka, pokój i sypialnia")

# ——— Instalacja elektryczna
add(50701, 2, "klient: „prawdopodobnie przesunięcie 2× kabla oświetleniowego na suficie” — 2 punkty oświetleniowe",
    "klient jeszcze doprecyzuje, czy i które kable przesuwamy (oba: −200 zł, z bruzdami i naprawami ok. −400 zł)")
add(50703, 2, "klient: dorobienie 1–2 gniazdek — przyjęte 2 (górna granica)", "1 czy 2 gniazdka (jedno mniej: ok. −270 zł z montażem, bruzdą i naprawą); gdzie")
add(50675, 2, "Manual: montaż gniazdek i włączników = liczba punktów — 2 nowe gniazdka; reszta: zakładam osprzęt dewelopera",
    f"czy osprzęt dewelopera jest zamontowany — na zdjęciach widać puszki z kablami; jeśli nie, ok. 25–30 szt × 39 zł ≈ +1,0–1,2 tys. zł; {M_SOCKETS}")
add(50685, 5, "klient: montaż oświetlenia — przyjęte 5 prostych lamp: salon 2 (stół i wypoczynek), pokój 1, sypialnia 1, hol 1",
    "liczba i rodzaj lamp — klient ich nie podał (lampy ze składaniem 150 zł/szt)")

# ——— Wod-kan + c.o.
add(50709, 2, "klient: przesunięcie grzejnika łazienkowego — 2 punkty c.o. (zasilanie, powrót) pod drabinkę w nowym miejscu (kład C)",
    M_RAD_EL)
add_new(WODKAN, WKUCIE, "pkt", 250, 1,
        "klient: podtynkowe schowanie przyłączy w kuchni (zdjęcie: rury przed ścianą) — 1 zespół punktów pod zlew, bez przenoszenia; pozycja z sekcji Łazienka (Manual: wkucie w deweloperce), wstawiona do instalacji wod-kan, bo dotyczy kuchni",
        "ile zespołów przyłączy jest w kuchni (zlew, zmywarka) — każdy kolejny +250 zł")

# ——— Łazienka
S = BATH
add(50546, 0, f"klient: przyłącza w łazience bez przenoszenia, tylko schowanie w ścianie; podejścia dewelopera na zdjęciu zgadzają się z projektem (WC przy pionie, umywalka, wanna, pralka). {A_DEW}",
    "Manual: w deweloperce zwykle ok. 4 pkt — jeśli podejścia trzeba przedłużyć pod projekt (bateria natynkowa 600 od narożnika, umywalka nablatowa), ok. +1 000 zł", section=S)
add(50620, 3, "Manual: w deweloperce rury idą przed ścianą — wkucie zespołów: wanna, umywalka, pralka (WC chowa się w zabudowie stelaża)", section=S)
add(50569, 1, A_PROJ + ": WC podwieszane — stelaż; " + "zdjęcie łazienki: stelaża nie ma, są tylko podejścia i odpływ kanalizacji przy pionie", section=S)
add(50583, 1, A_PROJ + ": zabudowa stelaża z GK 800 × 1200 (kład B); " + "zdjęcie łazienki: stelaża nie ma, są tylko podejścia i odpływ kanalizacji przy pionie", section=S)
add(50592, 1, A_PROJ + ": WC podwieszane", section=S)
add(50552, BATH_WALLS + 2 * A_BATH, f"Manual: ściany {pl(BATH_WALLS)} + podłoga i sufit {pl(A_BATH)} × 2; {A_H}", section=S)
add_new(S, MLECZKO, "m²", 7, BATH_WALLS - GEB_FRONT + A_BATH,
        f"Manual: mleczko na tynkach deweloperskich, poza przedściankami — ściany {pl(BATH_WALLS)} minus zabudowa stelaża {pl(GEB_FRONT)} + sufit {pl(A_BATH)}; pozycja z sekcji ścian, wstawiona do łazienki (Manual); {A_H}")
add(50596, BATH_WALLS + A_BATH, f"Manual: folia w płynie na wszystkich ścianach i podłodze — ściany {pl(BATH_WALLS)} + podłoga {pl(A_BATH)}; {A_H}", section=S)
add(50619, 16, f"Manual: ok. 15 mb na łazienkę 4 m² — łazienka {pl(A_BATH)} m²", section=S)
add(50612, TILE_BIG,
    f"projekt: płytki do sufitu na wszystkich ścianach (kłady A–D), w podziale ok. 120 × 120 — obwód {pl(PER_B)} mb × {pl(H)} minus drzwi minus pas ryflowany za umywalką {pl(RIBBED)} = {pl(TILE_BIG)} m²; ściany łącznie z pasem ryflowanym {pl(BATH_WALLS)} m² (zabudowa wanny ≈ pas ściany, który zasłania); {A_H}",
    "format płytek ściennych — podział na kładach wygląda na 120 × 120, projekt nie podaje formatu; przy 60 × 120 standard 180 zł/m² (≈ −2,4 tys. zł)", section=S)
add(50613, RIBBED, f"projekt: pas płytek ryflowanych za umywalką 1,06 m × {pl(H)} = {pl(RIBBED)} m² (kład A, wizualizacja), format standard",
    "format i rodzaj płytek ryflowanych (mały format lub lamele: inna stawka)", section=S)
add(50607, TILE_F, f"podłoga {pl(A_BATH)} (rzut) minus wanna 1,60 × 0,80 = {pl(TILE_F)} m², format standard",
    "format płytek podłogowych — projekt go nie podaje; na rzucie mieszkania podłoga łazienki zakreskowana w jodełkę: płytki w jodełkę lub 120 × 120 to wyższa stawka", section=S)
add(50556, TILE_BIG + RIBBED + TILE_F, f"fugowanie = wszystkie płytki (Manual): {pl(TILE_BIG)} + {pl(RIBBED)} + {pl(TILE_F)}; {A_H}", section=S)
SZLIF = (1.2 + 0.8) * 2 + 0.55 * 2 + H * 2
add(50600, SZLIF, f"Manual: narożnik zewnętrzny (np. pion) = jego wysokość × 2 — zabudowa stelaża (krawędź pionowa 1,2 + górna 0,8) × 2 = 4,00 + narożnik zabudowy wanny przy szafce 0,55 × 2 = 1,10 + narożnik zabudowy pionu w rogu łazienki (rzut projektu: 390 × 630, zdjęcie: pion od podłogi do sufitu) {pl(H)} × 2 = {pl(H * 2)} → {pl(SZLIF)} mb",
    "do weryfikacji z projektantem — kłady nie pokazują wszystkich krawędzi; czy narożnik pionu idzie na 45°, czy z listwą/profilem (wtedy −5,6 mb, −448 zł)", section=S)
add(50598, 20, "Manual: 20–30 mb na łazienkę — wanna, narożniki, styk z podłogą", section=S)
add(50617, 16, "Manual: WC 5 + bateria wannowa natynkowa 2 + umywalka (2 zawory + odpływ) 3 + grzejnik 2 + lustro z LED 2 + pralka 1 + kratka 1 = 16; płytki na wszystkich ścianach (minimum 15)", section=S)
add(50547, PER_B, f"Manual: akryl na styku płytek z sufitem — obwód {pl(PER_B)} mb", section=S)
add(50559, A_BATH, f"Manual: malowanie tylko bez glazury — ściany całe w płytkach, więc sam sufit {pl(A_BATH)} m² z gładzią",
    f"Komentarz do farby podkładowej: „na świeże gładzie… wpisujemy… do sekcji łazienka” — czy sufit łazienki z gładzią potrzebuje osobnej farby podkładowej ({pl(A_BATH)} m² × 12 zł ≈ +52 zł), czy mieści się w tej pozycji i w dwukrotnym gruntowaniu", section=S)
add(50590, 1, A_PROJ + ": wanna 1600 z zabudową i rewizją (kład D)", section=S)
add(50582, 1, A_PROJ + ": parawan nawannowy (kład A)", section=S)
add(50563, 1, A_PROJ + ": bateria wanno-prysznicowa natynkowa z drążkiem (kład A, kład D: 600 od narożnika)", section=S)
add(50587, 1, A_PROJ + ": umywalka nablatowa na szafce (kład A)", section=S)
add(50561, 1, A_PROJ + ": bateria umywalkowa stojąca na blacie (wizualizacja)", section=S)
add(50585, 1, "syfon umywalki", section=S)
add(50593, 3, "Manual: zawory czerpalne pod pralkę i pod umywalkę z baterią stojącą — umywalka 2 + pralka 1", section=S)
add(50594, 1, A_PROJ + ": pralka obok zabudowy WC (kład B)", section=S)
add(50572, 1, "klient: przesunięcie grzejnika łazienkowego — montaż drabinki z zaworami w nowym miejscu (kład C)", M_RAD_EL, section=S)
add(50575, 1, "kratka wentylacyjna łazienki (pion wentylacyjny w narożniku)", "czy kratka jest już zamontowana przez dewelopera", section=S)
add(50626, 2, A_PROJ + ": 2 lampy wiszące po bokach lustra (kład A: 530 od osi) — 2 nowe punkty oświetleniowe na suficie",
    "czy deweloper wyprowadził kable w tych miejscach (wtedy −200 zł, z bruzdami i naprawami ok. −400 zł)", section=S)
add(50576, 2, A_PROJ + ": 2 lampy wiszące (kład A)", section=S)
add(50578, 1, A_PROJ + ": okrągłe lustro 800 z podświetleniem LED (kład A, wizualizacja)", section=S)
add(50581, 1, "klient: jedne z 3 drzwi wewnętrznych — drzwi łazienki z ościeżnicą regulowaną, w sekcji Łazienka, nie w stolarce", section=S)
add_new(S, NAPRAWY, "mb", 25, 6,
        "Manual: naprawy po bruzdowaniu tyle samo co bruzd — 2 mb bruzdy wod-kan + 4 mb pod 2 lampy wiszące; pozycja z sekcji ścian, wstawiona do łazienki (Manual)", M_PENDANT)
add(50630, 0, A_PROJ + ": szafka pod umywalką (kład A)", "Manual: szafkę podumywalkową zwykle montuje stolarz — czy jest po naszej stronie (+250 zł)", section=S)
add(50629, 0, A_PROJ + ": szafka z półkami nad zabudową WC (kład B, drewno)", "zabudowa meblowa — zwykle stolarz; czy montaż jest po naszej stronie (+250 zł)", section=S)

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by, cnt = {}, {}
for r in draft:
    by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
    cnt[r['section']] = cnt.get(r['section'], 0) + 1
for s, v in by.items(): print(f"{s:45s} {cnt[s]:3d} {pl(v):>12s}")
szablon = {(x['section'], x['description']) for x in rows.values()}
added = sum(1 for r in draft if (r['section'], r['description']) not in szablon)
print(f"rows {len(draft)}, total {pl(total)}, added {added}, zero {sum(1 for r in draft if r['qty'] == 0)}")
print(f"W_SALON {pl(W_SALON)} W_POKOJ {pl(W_POKOJ)} W_SYP {pl(W_SYP)} W_HOL {pl(W_HOL)} WALLS {pl(WALLS)} LINE_ALL {pl(LINE_ALL)} LISTWY {pl(LISTWY)} PER_DRY {pl(PER_DRY)}")
print(f"BATH_WALLS {pl(BATH_WALLS)} TILE_BIG {pl(TILE_BIG)} RIBBED {pl(RIBBED)} TILE_F {pl(TILE_F)} TOTAL {pl(TOTAL)}")
