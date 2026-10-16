# Case 22 — lokal 1 (parter) in a two-lokal terraced new build, 66,56 m², stan deweloperski.
# Inputs: one rzut (1:100, room areas printed, wymiary w cm, no height) and the client's zakres prac.
# The zakres wall areas are the client's own floor × 2,5 multiplier („wymagają potwierdzenia”), so wall
# quantities are recomputed from the rzut; counts (drzwi, lampy, armatura) are taken from the zakres.
# One bathroom (L1-05) → it stays in the template sekcja „Łazienka".
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
MLECZKO = rows[50534]['description']
NAPRAWY = rows[50529]['description']

# ——— Geometry (rzut 1:100; areas as printed, lengths from the dimension chains)
H = 2.68                                      # Manual: stan deweloperski 2,68 m — rzut nie podaje wysokości
WIN = 1.78 * 1.50                             # okno pokoju, parapet 90 cm
DOOR = 0.80 * 2.05                            # drzwi wewnętrzne
TERRACE = 0.90 * 2.20                         # drzwi tarasowe w L1-03

A_01, A_02, A_03, A_04, A_06, A_05 = 2.72, 7.43, 26.15, 13.04, 11.32, 5.90
TOTAL = 66.56
PANELE = A_02 + A_03 + A_04 + A_06            # = sufity z gładzią

# L1-03: 490 × 470 + aneks 240 × 130; 225 cm open to the komunikacja (dashed line on the rzut)
PER_03 = 4.90 + 6.00 + 2.40 + 1.30 + 0.25 + 2.25 + 4.70
OPEN_03 = 2.25
KITCHEN_RUN = 1.80 + 2.40                     # zlew na prawej ścianie + płyta na dolnej — za szafkami
W_03 = (PER_03 - OPEN_03) * H - WIN - TERRACE - KITCHEN_RUN * H
# L1-04: L-shape 332 × 364 + 118 × 94 (458 total depth)
PER_04 = 3.32 + 4.58 + 1.18 + 0.94 + 2.14 + 3.64
W_04 = PER_04 * H - WIN - DOOR
# L1-06: L-shape 374 × 274 + 160 × 76 (350 total depth)
PER_06 = 2 * (3.74 + 3.50)
W_06 = PER_06 * H - WIN - DOOR
# L1-02 komunikacja: strip 355 × 130 open to L1-03 + corridor to the wiatrołap; 4 doors, wardrobe 161 —
# only short wall stretches remain, so its walls are an estimate (≈ 4,2 mb ścian + nadproża)
PER_02 = 12.9
W_02 = 14.0
LINE_02 = 9.0                                 # styk ściana–sufit bez strony otwartej na salon
# L1-01 wiatrołap 183 × 149 incl. wardrobe 152; client's 6,8 m² agrees with the rzut (≈ 2,1 mb ścian + nadproża)
PER_01 = 2 * (1.83 + 1.49)
W_01 = 6.8

WALLS_Q3 = W_03 + W_04 + W_06 + W_02
WALLS_CLIENT = 65.4 + 32.6 + 28.3 + 18.6
LINE_ALL = (PER_03 - OPEN_03) + PER_04 + PER_06 + LINE_02 + PER_01
PER_PANELE = PER_03 + PER_04 + PER_06 + PER_02
LISTWY = PER_PANELE * 0.75

# Łazienka L1-05: 202 × 300, wanna ≈ 170 × 75 along the bottom wall, WC podwieszane + umywalka on the
# left wall, kocioł CO/CW and pralka on the top wall (client: that wall without tiles, painted, meble)
PER_B = 2 * (2.02 + 3.00)
BATH_WALLS = PER_B * H - DOOR
KOCIOL_W = 2.02 * H
TILE_W = round(BATH_WALLS - KOCIOL_W, 2)      # zabudowa wanny ≈ the wall strip it hides, so they cancel
TUB = 1.70 * 0.75
TILE_F = round(A_05 - TUB, 2)                 # rounded so fugowanie equals the two tile rows the owner sees
GEB_FRONT = 1.00 * 1.20

A_H = f"wysokość {pl(H)} m (Manual: stan deweloperski — rzut jej nie podaje)"
M_H = "wysokość pomieszczeń — rzut jej nie podaje"
A_ZAKRES = "zakres prac klienta"
A_WALLS = f"ściany {pl(WALLS_Q3)} m² przeliczone z rzutu (klient: {pl(WALLS_CLIENT)} m²) — jak w gładzi na ścianach"
A_DEW = "stan deweloperski — rynek pierwotny (lokal odebrany od dewelopera)"

# ——— Prace dodatkowe
add(50402, 1, f"1 kpl na całe mieszkanie {pl(TOTAL)} m² — cena z szablonu 1500 zł (Manual: małe mieszkanie w całości 1500 zł); Marki — Manual: poza Warszawą wyższe ceny",
    "czy podnieść stawkę za dojazd poza Warszawę")
add(50405, 2, f"Manual: rynek pierwotny bez wyburzeń — 2 big bagi ({A_DEW})")

# ——— Wyburzenia, demontaże, zabezpieczenia
add(50454, TOTAL, f"Manual: zabezpieczenia m² po podłodze — całe mieszkanie {pl(TOTAL)} m² (rzut)")
add(50422, 2, "Manual: ok. 2 mb bruzd na punkt — 1 przesunięty punkt elektryczny w pokoju z aneksem (zakres prac klienta)")
add(50420, 2, "Manual: ok. 2 mb bruzd wod-kan na łazienkę")
add(50425, 4, "Manual: na rynku pierwotnym grzejniki demontujemy praktycznie zawsze — przyjęte 4: pokój z aneksem 2 (okno + drzwi tarasowe), pokój I 1, pokój II 1",
    "liczba grzejników dewelopera (rzut ich nie pokazuje) — czy dom nie ma ogrzewania podłogowego (wtedy −1,4 tys. zł: demontaż i montaż); czy w łazience jest grzejnik")

# ——— Podłogi
add(50486, PANELE, f"zakres prac klienta: panele laminowane w komunikacji {pl(A_02)}, pokoju z aneksem {pl(A_03)}, pokoju I {pl(A_04)} i pokoju II {pl(A_06)} = {pl(PANELE)} m² (powierzchnie z rzutu); panele także w aneksie kuchennym",
    "rzut opisuje pokój z aneksem „parkiet/gres” — czy w aneksie (ok. 2,40 × 1,30) nie ma być gres (≈ +0,7 tys. zł z fugowaniem, gruntowaniem i listwą łączeniową 2,4 mb); panele pływające czy klejone (klejone: gruntowanie, a winyl klejony wymaga wylewki samopoziomującej)")
add(50478, A_01, f"zakres prac klienta: płytki na podłodze w wiatrołapie {pl(A_01)} m², format standard", "format płytek w wiatrołapie")
add(50462, A_01, "fugowanie = płytki (Manual)")
add(50463, A_01, "Manual: gruntowanie pod glazurę — tylko wiatrołap; pod panele pływające bez gruntowania")
add(50470, LISTWY, f"Manual: obwód pomieszczeń z panelami (bez łazienki i wiatrołapu) {pl(PER_PANELE)} mb minus 25% na drzwi, zabudowy i ciąg kuchenny = {pl(LISTWY)} mb — „lepiej niedoszacować”",
    "klient liczy 57 mb cokołów w tych pomieszczeniach (63 mb z wiatrołapem); wysokość i rodzaj listew")
add(50458, LISTWY, "jak listwy")
add(50459, 3.0, f"wiatrołap z gresem: cokół z płytek na odcinkach ścian bez drzwi i szafy — ok. 3 mb (obwód {pl(PER_01)} mb, dwoje drzwi i szafa 152)",
    "klient wpisał 6 mb cokołów w wiatrołapie — czy cokół z płytek, czy listwa MDF jak w pokojach")
add(50471, 0.9, "Manual: listwa łączeniowa przy podłodze pływającej — przejście gres wiatrołapu / panele komunikacji w drzwiach wiatrołapu")

# ——— Ściany i sufity bez łazienek
add(50500, WALLS_Q3,
    f"ściany przeliczone z rzutu (obwód × {pl(H)} minus okna, drzwi i ściana kuchni za szafkami — Manual): pokój z aneksem {pl(W_03)} + pokój I {pl(W_04)} + pokój II {pl(W_06)} + komunikacja {pl(W_02)} (szacunkowo: same krótkie odcinki ścian między 4 drzwiami, szafą i otwarciem na salon) = {pl(WALLS_Q3)} m². Klient podał {pl(WALLS_CLIENT)} m² z przelicznika podłoga × 2,5 — różnica ok. {pl(WALLS_CLIENT - WALLS_Q3)} m² (≈ {round((WALLS_CLIENT - WALLS_Q3) * 110 / 100) * 100:.0f} zł na gładzi, gruntowaniu i malowaniu). Bez gładzi w niszach szaf 161 i 152. {A_H}",
    f"{M_H}; gładź Q3 (Q4 +18 zł/m²); czy ściany za szafkami kuchennymi też mają gładź (+{pl(KITCHEN_RUN * H)} m²)")
add(50498, PANELE, f"klient: „proszę uwzględnić osobno sufity” — sufity pokoi i komunikacji {pl(PANELE)} m² (rzut), Q3",
    "czy sufity w gładzi — w zakresie klienta sufity nie są rozpisane")
add(50534, WALLS_Q3 + PANELE + W_01 + A_01,
    f"Manual: szlifowanie mleczka zawsze na tynkach deweloperskich — ściany {pl(WALLS_Q3)} + sufity {pl(PANELE)} + wiatrołap ściany {pl(W_01)} i sufit {pl(A_01)}; {A_WALLS}; {A_H}")
add(50505, WALLS_Q3 + PANELE, f"Manual: gruntowanie przed i po gładziach — wszędzie, gdzie gładź: ściany {pl(WALLS_Q3)} + sufity {pl(PANELE)}; {A_WALLS}; {A_H}")
add(50503, WALLS_Q3 + PANELE + W_01 + A_01,
    f"Manual: farba podkładowa na świeże gładzie (ściany {pl(WALLS_Q3)} + sufity {pl(PANELE)}) oraz na malowane tynki bez gładzi — wiatrołap ściany {pl(W_01)} + sufit {pl(A_01)}; {A_WALLS}; {A_H}")
add(50507, W_01 + A_01, f"wiatrołap bez gładzi (zakres prac klienta: tylko gruntowanie i malowanie, ściany {pl(W_01)} m² zgodne z rzutem) + sufit {pl(A_01)}",
    "czy wiatrołap też w gładzi (≈ +0,5 tys. zł z gruntowaniem)")
add(50495, LINE_ALL, f"Manual: akrylowanie łączeń ścian z sufitem — pokoje, komunikacja (bez strony otwartej na salon) i wiatrołap ≈ {pl(LINE_ALL)} mb")
add(50508, PANELE + A_01, f"sufity biało: pokoje i komunikacja {pl(PANELE)} + wiatrołap {pl(A_01)}")
add(50513, WALLS_Q3 + W_01, f"ściany na biało: {pl(WALLS_Q3)} z gładzią + wiatrołap {pl(W_01)} — zakres klienta nie podaje koloru; {A_WALLS}; {A_H}",
    f"białe czy w kolorze (malowanie ścian w kolorze 26 zł/m², ≈ +{pl(4 * (WALLS_Q3 + W_01))} zł)")

add(50529, 2, "Manual: naprawy po bruzdowaniu tyle samo co bruzd — 2 mb bruzdy pod przesunięty punkt elektryczny (pod gładź na całej ścianie i tak trzeba zatynkować bruzdę)")

# ——— Kuchnia — nothing in the client's zakres; the rzut shows a zlew and a płyta in the aneks
M_KITCHEN = "zakres prac klienta nie obejmuje kuchni — czy podłączenie zlewu, baterii, płyty i okapu jest po naszej stronie (ok. 1,1 tys. zł), czy robi to firma meblowa"
add(50637, 0, "zlew w aneksie (rzut) — nie w zakresie klienta", M_KITCHEN)
add(50633, 0, "jak zlew", M_KITCHEN)
add(50636, 0, "jak zlew", M_KITCHEN)
add(50639, 0, "płyta w aneksie (rzut) — nie w zakresie klienta", M_KITCHEN)
add(50683, 0, "okap nad płytą — nie w zakresie klienta", M_KITCHEN)

# ——— Montaż stolarki
add(50655, 3, "zakres prac klienta: drzwi z ościeżnicą — wiatrołap 1 + komunikacja 3 (łazienka, pokój I, pokój II; rzut); drzwi łazienki w sekcji Łazienka, tu 3: wiatrołap, pokój I, pokój II",
    "ościeżnice regulowane czy stałe (stałe 450 zł/szt, +210 zł za 3 szt.)")

# ——— Instalacja elektryczna
add(50703, 1, "zakres prac klienta: przesunięcie punktu elektrycznego w pokoju z aneksem")
add(50685, 5, "zakres prac klienta: oświetlenie po 1 w wiatrołapie, komunikacji, pokoju z aneksem, pokoju I i pokoju II — proste lampy",
    "rodzaj lamp (lampy ze składaniem 150 zł/szt)")
add(50675, 1, "Manual: montaż gniazdek i włączników = liczba punktów — 1 przesunięty punkt w pokoju z aneksem; reszta: zakładam osprzęt dewelopera (zakres klienta go nie wymienia)",
    "czy deweloper zamontował gniazdka i włączniki — jeśli nie, ok. 30 szt × 39 zł ≈ 1,2 tys. zł")

# ——— Wod-kan + c.o.
add(50705, 4, "ponowny montaż 4 zdjętych grzejników", "liczba grzejników dewelopera (rzut ich nie pokazuje) — przy ogrzewaniu podłogowym pozycja wypada (−1 000 zł, z demontażem −1,4 tys. zł)")

# ——— Łazienka (L1-05)
S = BATH
add(50546, 4, f"Manual: stan deweloperski ok. 4 pkt — WC, umywalka, wanna, pralka (rzut). {A_DEW}", "czy podejścia dewelopera są w miejscach z rzutu", section=S)
add(50620, 4, "Manual: w deweloperce rury idą przed ścianą — wkucie punktów jak wyżej", section=S)
add(50569, 1, "zakres prac klienta: sedes podwieszany — stelaż WC", "czy stelaż jest już zamontowany przez dewelopera (wtedy −900 zł ze stelażem i zabudową)", section=S)
add(50583, 1, "zabudowa stelaża z GK", "czy stelaż jest już zamontowany przez dewelopera (wtedy −900 zł ze stelażem i zabudową)", section=S)
add(50592, 1, A_ZAKRES + ": sedes podwieszany", section=S)
add(50552, BATH_WALLS + 2 * A_05, f"Manual: gruntowanie w łazience w sekcji Łazienka — ściany {pl(BATH_WALLS)} + podłoga i sufit {pl(A_05)} × 2; {A_H}", section=S)
add_new(S, MLECZKO, "m²", 7, BATH_WALLS - GEB_FRONT + A_05,
        f"Manual: mleczko na tynkach deweloperskich, poza przedściankami — ściany {pl(BATH_WALLS)} minus zabudowa stelaża {pl(GEB_FRONT)} + sufit {pl(A_05)}; pozycja z sekcji ścian, wstawiona do łazienki (Manual); {A_H}")
add(50596, BATH_WALLS + A_05, f"Manual: folia w płynie na wszystkich ścianach i podłodze — ściany {pl(BATH_WALLS)} + podłoga {pl(A_05)}; {A_H}",
    f"klient wpisał hydroizolację 10 m²; bez ściany z kotłem byłoby {pl(BATH_WALLS + A_05 - KOCIOL_W)} m² (−{pl(30 * KOCIOL_W)} zł)", section=S)
add(50619, 20, f"Manual: ok. 15 mb na łazienkę 4 m², lekko niedoszacowane — łazienka {pl(A_05)} m²", section=S)
add(50613, TILE_W,
    f"płytki na ścianach do sufitu poza ścianą z kotłem (klient: bez płytek, zabudowa meblowa): obwód {pl(PER_B)} mb × {pl(H)} minus drzwi i ściana z kotłem {pl(KOCIOL_W)} = {pl(TILE_W)} m² (zabudowa wanny ≈ pas ściany, który zasłania); format standard. Łącznie z podłogą {pl(TILE_W + TILE_F)} m², klient: 23 m²; {A_H}",
    "format płytek; czy płytki do sufitu", section=S)
add(50607, TILE_F, f"podłoga {pl(A_05)} minus wanna {pl(TUB)} = {pl(TILE_F)} m², format standard", "format płytek", section=S)
add(50556, TILE_W + TILE_F, f"fugowanie = wszystkie płytki (Manual): {pl(TILE_W)} + {pl(TILE_F)}", section=S)
add(50600, 5.5, "Manual: narożnik zewnętrzny = wysokość × 2, nie zawyżaj — zabudowa stelaża (pion 1,2 × 2 + krawędź górna 1,0 × 2) + narożnik zabudowy wanny 0,55 × 2 = 5,5 mb",
    "klient wpisał ok. 15 mb (+760 zł) — gdzie ma być szlif 45°", section=S)
add(50598, 20, "Manual: 20–30 mb na łazienkę — wanna, narożniki, styk z podłogą", "klient nie podał ilości", section=S)
add(50617, 13, "Manual: WC 5 + bateria wannowa natynkowa 2 + umywalka (2 zawory + odpływ) 3 + lustro z LED 2 + wentylator 1 = 13; nie wszystkie ściany w płytkach, więc bez minimum 15 (klient: ok. 14)", section=S)
add(50547, PER_B + 2 * H, f"Komentarz: akryl na styku płytek z sufitem lub ścianą — styk ścian z sufitem, obwód {pl(PER_B)} mb + 2 pionowe styki płytek z malowaną ścianą z kotłem 2 × {pl(H)} mb = {pl(PER_B + 2 * H)} mb; {A_H}", section=S)
add(50559, KOCIOL_W + A_05, f"Manual: malowanie tylko ścian bez płytek — ściana z kotłem {pl(KOCIOL_W)} (klient: przygotowana i pomalowana pod zabudowę meblową) + sufit {pl(A_05)} = {pl(KOCIOL_W + A_05)} m² (klient: 11,38); {A_H}",
    "czy dodać farbę podkładową na świeżą gładź w łazience (Komentarz: wpisujemy, w sekcji Łazienka; 11,31 m² × 12 zł ≈ +136 zł), czy jest już w tej pozycji i w dwukrotnym gruntowaniu", section=S)
add(50590, 1, A_ZAKRES + ": wanna z zabudową i rewizją (rzut: ok. 170 × 75)", section=S)
add(50582, 1, A_ZAKRES + ": parawan", section=S)
add(50563, 1, A_ZAKRES + ": zestaw prysznicowy — bateria wannowa natynkowa", "bateria podtynkowa: 900 zł + biały montaż 200 zł zamiast 250 zł", section=S)
add(50587, 1, A_ZAKRES + ": szafka z umywalką — umywalka na szafce", section=S)
add(50630, 1, "klient wprost prosi o montaż szafki z umywalką (Manual: zwykle stolarz)", "czy szafkę montuje stolarz", section=S)
add(50561, 1, "bateria umywalkowa stojąca", section=S)
add(50585, 1, "syfon umywalki", section=S)
add(50594, 1, "pralka przy ścianie z kotłem (symbol na rzucie)", "czy pralka stoi w łazience i czy jej podłączenie jest po naszej stronie (−160 zł z zaworem)", section=S)
add(50593, 3, "Manual: zawory czerpalne tylko pod pralkę i pod umywalkę z baterią stojącą — umywalka 2 + pralka 1",
    "czy pralka stoi w łazience i czy jej podłączenie jest po naszej stronie (zawór −60 zł)", section=S)
add_new(S, rows[50692]['description'], "kpl", 120, 1,
        "zakres prac klienta: wentylator — łazienka bez okna; pozycja z instalacji elektrycznej, wstawiona do łazienki (Manual)")
add_new(S, NAPRAWY, "mb", 25, 2,
        "Manual: naprawy po bruzdowaniu tyle samo co bruzd — 2 mb bruzdy wod-kan w łazience; pozycja z sekcji ścian, wstawiona do łazienki (Manual)")
add(50581, 1, A_ZAKRES + ": drzwi z ościeżnicą do łazienki (rzut) — w sekcji Łazienka, nie w stolarce",
    "ościeżnica regulowana czy stała (jak w stolarce)", section=S)
add(50576, 1, A_ZAKRES + ": oświetlenie sufit", section=S)
add(50578, 1, A_ZAKRES + ": lustro z oświetleniem", section=S)
add(50572, 0, "rzut nie pokazuje grzejnika w łazience, zakres klienta go nie wymienia", "czy w łazience jest grzejnik / drabinka (demontaż 100 + montaż 250 zł + 2 otwory 120 zł)", section=S)

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
print(f"W_03 {pl(W_03)} W_04 {pl(W_04)} W_06 {pl(W_06)} WALLS_Q3 {pl(WALLS_Q3)} LINE_ALL {pl(LINE_ALL)} LISTWY {pl(LISTWY)} TILE_W {pl(TILE_W)} TILE_F {pl(TILE_F)} BATH_WALLS {pl(BATH_WALLS)}")
