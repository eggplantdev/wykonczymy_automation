import json, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

def pl(x): return f"{x:.2f}".replace(".", ",")
def zl(x): return f"{round(x):,}".replace(",", " ") + " zł"

draft = []
def add(i, qty, assumptions=None, missing=None, price=None, section=None):
    r = dict(rows[i]); r['qty'] = round(qty, 2)
    if section: r['section'] = section
    if price is not None: r['clientPrice'] = float(price)
    if missing: r['missingData'] = '; '.join(missing) if isinstance(missing, list) else missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

def add_new(section, description, unit, price, qty, assumptions=None, missing=None):
    r = dict(section=section, description=description, unit=unit, clientPrice=float(price), qty=round(qty, 2))
    if missing: r['missingData'] = '; '.join(missing) if isinstance(missing, list) else missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

BATH = 'Łazienka'
SC = rows[50500]['section']
WK = rows[50705]['section']
MLECZKO = rows[50534]['description']
NAPRAWY = rows[50529]['description']

# ——— Geometry (rysunki ogólne + karta lokalu; H from the drawing wins over the client's 2,7 m)
H = 2.73
DOOR = 0.80 * 2.05                            # drzwi ukryte 80
DOOR_PG = 0.70 * 2.05                         # otwór pod drzwi przesuwne natynkowe pom. gospodarczego
WIN_SYP = 1.365 * 1.50
WIN_GAB = 1.375 * 1.50
WIN_SAL = 1.375 * 1.50
WIN_KUCH = 0.96 * 1.43
BALKON = 1.365 * 2.40
TOTAL = 60.17                                 # Pu z karty lokalu

A_SYP, A_GAB, A_KOR, A_HOL, A_SAL, A_PG, A_B = 11.80, 10.60, 4.47, 5.54, 20.58, 3.10, 4.13
PER_SYP = 2 * (3.86 + 3.055)
SZAFA_SYP = 1.88                              # szafa na wymiar przy ścianie od łazienki
W_SYP = PER_SYP * H - WIN_SYP - DOOR - SZAFA_SYP * H
PER_GAB = 2 * (3.89 + 2.89)                   # po przesunięciu ściany ≈ 10,6 m², obwód bez zmian (kształt L)
ZAB_GAB = 1.90
W_GAB = PER_GAB * H - WIN_GAB - DOOR - ZAB_GAB * H
H_KOR = 2.735
PER_KOR = 2 * 3.68 + 1.215                    # krótki bok otwarty na hol
W_KOR = PER_KOR * H_KOR - 3 * DOOR - DOOR_PG  # łazienka, sypialnia, gabinet + pom. gospodarcze
W_HOL = 10.0                                  # szacunkowo: drzwi wejściowe, szafa, otwarcia na korytarz i salon
LINE_HOL = 7.0
PER_SAL = 2 * (3.465 + 5.855)
OPEN_SAL = 1.0                                # przejście z holu
KITCHEN_RUN = 3.12 + 0.95                     # ciąg szafek + słupek lodówki — bez gładzi i farby
W_SAL = (PER_SAL - OPEN_SAL) * H - WIN_SAL - WIN_KUCH - BALKON - KITCHEN_RUN * H
PER_PG = 2 * (1.84 + 1.75)
SZAFY_PG = 1.75
W_PG = PER_PG * H - DOOR_PG - SZAFY_PG * H

WALLS = W_SYP + W_GAB + W_KOR + W_HOL + W_SAL + W_PG
CEIL = A_SYP + A_GAB + A_KOR + A_HOL + A_SAL + A_PG
CEIL_COLOR = A_KOR + A_PG
BED_LOW = 3.5 * 1.1                           # ściana za łóżkiem pod listwą sztukaterii, beż
DOOR_LEAVES = 12.0                            # skrzydła 3 drzwi ukrytych obustronnie + drzwi przesuwne
WALLS_COLOR = W_KOR + W_PG + BED_LOW
WALLS_WHITE = WALLS - WALLS_COLOR
LINE_ALL = PER_SYP + PER_GAB + PER_KOR + LINE_HOL + (PER_SAL - OPEN_SAL) + PER_PG

DEMOL = 1.75 * H                              # ściana 10 cm między byłym WC a gabinetem
NEW_WALL = 1.75 * H - DOOR_PG                 # nowa ściana GK w linii drzwi gabinetu z otworem 70

FLOOR_TILE = 4.30 + A_PG                      # hol bez szafy + pom. gospodarcze, 90x90
WOOD = A_SAL + A_SYP + A_GAB + A_KOR
LISTWY = 39.0
JOINTS = 0.81 + 0.70 + 2.5                    # przejścia płytki / parkiet: łazienka, pom. gosp., hol–korytarz–salon

# Elektryka (rysunek elektryki — kolor niebieski = nowe)
SOCKETS = 3 + 1 + 3 + 6 + 10 + 5             # sypialnia, korytarz, pom. gosp., gabinet, kuchnia, salon
SWITCHES = 14
SCHODOWE = 7                                  # sypialnia obwód 10 ×3, korytarz 08 ×2, 09 ×2
LIGHTS = 4 + 6 + 3 + 1 + 1 + 2 + 5 + 4        # sypialnia, korytarz, hol, gabinet, pom. gosp., kuchnia, jadalnia, salon
AC_PTS = 3
KINKIETY = 5
LED_PTS = 3                                   # LED w szafach sypialni i holu, LED pod szafkami kuchni — taśmy montuje stolarz
LAMPY = LIGHTS - KINKIETY - LED_PTS
B_LIGHTS, B_EL = 6, 4
PTS = SOCKETS + SWITCHES + LIGHTS + AC_PTS + B_LIGHTS + B_EL
BRUZDY_EL = 150                               # Manual: 50–100 m² max 150 mb
BRUZDY_B = 2 * (B_LIGHTS + B_EL)
BRUZDY_WK = 2 + 3 + 2                         # łazienka, kuchnia, pralka w pom. gosp.

# Łazienka 254 × 174,5 (karta: 4,13 m²): płytki 60x120 do sufitu na 3 ścianach prysznica, reszta do 120
TILE_FULL = (1.53 + 0.835 + 0.835) * H
TILE_LOW = (1.645 + 1.53 + 0.75) * 1.2 + 0.30
TILE_W = round(TILE_FULL + TILE_LOW, 2)
PAINT_W = 6.50                                # ściany nad płytkami do 120
LICOW = 6.00
BATH_WALLS = TILE_W + PAINT_W
TILE_F = round(A_B - (0.89 + 0.60) * 0.22, 2) # bez przedścianki prysznica i zabudowy stelaża
PER_B = 2 * (2.54 + 1.745)

A_H = f"wysokość {pl(H)} m z rysunku (korytarz 2,735, sypialnia i gabinet 2,74; klient: 2,7)"
A_DEW = "stan deweloperski — rynek pierwotny (lokal odebrany od dewelopera)"
A_WALLS = f"ściany {pl(WALLS)} m² przeliczone z rysunku (obwód × wysokość {pl(H)} m z rysunku minus okna, drzwi, ciąg kuchenny i zabudowy na wymiar)"
A_ZAKRES = "zakres prac klienta"
A_PGN = "pom. gospodarcze (dawne WC) nie jest już WC — jego prace są w sekcjach ogólnych, nie w osobnej sekcji"

# ——— Prace dodatkowe
add(50402, 1, f"1 kpl na całe mieszkanie {pl(TOTAL)} m² — cena z szablonu 1500 zł (Manual: małe mieszkanie w całości 1500 zł)",
    "Manual: duże mieszkanie deweloperskie z wieloma zmianami ok. 2000 zł (+500 zł) — tu przesunięcie ściany, przebudowa łazienki i kuchni; piętro i winda")
add(50405, 3, f"Manual: rynek pierwotny bez wyburzeń 2 big bagi — tu +1 na wyburzenie ściany {pl(DEMOL)} m² i skucie posadzki pod odpływ liniowy; {A_DEW}",
    "przy większej ilości gruzu kontener 1800 zł zamiast 3 big bagów (+450 zł)")

# ——— Wyburzenia, demontaże, zabezpieczenia
add(50454, TOTAL, f"Manual: zabezpieczenia m² po podłodze — całe mieszkanie {pl(TOTAL)} m² (karta lokalu)")
add(50450, DEMOL, f"zakres prac klienta + rysunek: wyburzenie ściany 10 cm (bloczki gipsowe) między pom. gospodarczym a gabinetem, 1,75 × {pl(H)} = {pl(DEMOL)} m²",
    "materiał ściany — karta: bloczki gipsowe 8–10 cm; żelbet 300 zł/m² (+≈0,9 tys. zł)")
add(50422, BRUZDY_EL, f"Manual: ok. 2 mb na punkt — {PTS} nowych punktów (gniazdka, włączniki, oświetlenie, łazienka, zasilanie klimatyzacji) × 2 = {2 * PTS} mb, przy 50–100 m² max 150 mb; w tym bruzda pod kabel do okna w kuchni")
add(50420, BRUZDY_WK, "Manual: ok. 2 mb wod-kan na łazienkę + przesunięcie zlewu i zmywarki pod okno ok. 3 mb + podejście pralki w pom. gospodarczym ok. 2 mb")
add(50425, 5, "Manual: na rynku pierwotnym grzejniki demontujemy praktycznie zawsze — sypialnia, gabinet, salon, kuchnia (usuwany) i łazienka (przenoszony do strefy prysznica)",
    "liczba grzejników dewelopera — karta i rysunek pokazują je orientacyjnie")

# ——— Podłogi
add(50478, FLOOR_TILE, f"zakres prac klienta: płytki 90x90 w holu ok. 4,30 m² (bez szafy) i w pom. gospodarczym {pl(A_PG)} m² = {pl(FLOOR_TILE)} m² — 90x90 liczone jak format standard; {A_PGN}",
    f"czy 90x90 liczyć jak 120x120 (300 zł/m², +{zl(120 * FLOOR_TILE)})")
add(50464, FLOOR_TILE, "Manual: mata kompensacyjna pod płytki wielkoformatowe 90x90 — hol i pom. gospodarcze",
    f"czy mata jest potrzebna na wylewce dewelopera (bez niej −{zl(40 * FLOOR_TILE)})")
add(50462, FLOOR_TILE, "fugowanie = płytki (Manual)")
add(50463, FLOOR_TILE, "Manual: gruntowanie pod glazurę — hol i pom. gospodarcze; podłogi drewniane układa inna firma")
add_new(rows[50459]['section'], "Cokół docinany z płytek wkuwany w ścianę", "mb", 220, 6.4,
        f"rysunek: w pom. gospodarczym cokół z płytek 6 cm zlicowany ze ścianą — obwód {pl(PER_PG)} mb minus drzwi ≈ 6,4 mb; praca z katalogu (nie ma jej w szablonie), cena z katalogu",
        "czy w holu też cokół z płytek, czy listwa jak w pokojach")
add(50470, LISTWY, f"Manual: listwy tam, gdzie nie ma zabudowy — z rysunku 43 mb z zapasem, bez zapasu ≈ {pl(LISTWY)} mb (salon, sypialnia, gabinet, korytarz, hol) — „lepiej niedoszacować”",
    "rodzaj i wysokość listew; czy listwy montuje firma od parkietu")
add(50458, LISTWY, "jak listwy (Manual)")
add(50483, JOINTS, f"zakres prac klienta: płytki z podłogą drewnianą w licu, bez listew — równe cięcie płytek w przejściach: łazienka 0,81, pom. gospodarcze 0,70, hol / korytarz / salon ok. 2,5 = {pl(JOINTS)} mb",
    f"podłogi drewniane {pl(WOOD)} m² układa inna firma — czy korek między płytkami a parkietem (30 zł/mb) robimy my; czy poziomy wylewki pozwalają zlicować płytki z parkietem")
add(50491, 1.75, "uzupełnienie posadzki w pasie wyburzonej ściany 1,75 mb",
    "bruzdy w wylewce po wykonawcy klimatyzacji — długość nieznana (60 zł/mb), do dopisania po jego pracach")

# ——— Ściany i sufity bez łazienek
M_GLADZ = f"klient: szpachlowanie „jeżeli będzie taka potrzeba” — gładź Q3 na wszystkich ścianach i sufitach (bez niej −{zl(57 * WALLS + 59 * CEIL + 12 * (WALLS + CEIL))} z gruntowaniem przed i po gładziach); Q4 +18 zł/m²"
add(50500, WALLS,
    f"ściany z rysunku (obwód × {pl(H)} minus okna, drzwi, ciąg kuchenny {pl(KITCHEN_RUN)} mb i zabudowy na wymiar — rysunek: brak farby za zabudową meblową): sypialnia {pl(W_SYP)} (bez szafy {pl(SZAFA_SYP)} mb) + gabinet {pl(W_GAB)} (bez zabudowy {pl(ZAB_GAB)} mb) + korytarz {pl(W_KOR)} + hol {pl(W_HOL)} (szacunkowo) + salon z aneksem {pl(W_SAL)} + pom. gospodarcze {pl(W_PG)} (bez ściany szaf) = {pl(WALLS)} m²; {A_H}",
    M_GLADZ + "; ściany za szafkami kuchennymi i zabudowami bez gładzi (Manual)")
add(50498, CEIL, f"sufity wszystkich pomieszczeń poza łazienką: sypialnia {pl(A_SYP)} + gabinet {pl(A_GAB)} + korytarz {pl(A_KOR)} + hol {pl(A_HOL)} + salon z aneksem {pl(A_SAL)} + pom. gospodarcze {pl(A_PG)} = {pl(CEIL)} m², Q3",
    M_GLADZ)
add(50534, WALLS + CEIL - W_PG,
    f"Manual: szlifowanie mleczka zawsze na tynkach deweloperskich — ściany {pl(WALLS - W_PG)} + sufity {pl(CEIL)}; bez ścian pom. gospodarczego (karta: w pomieszczeniach sanitarnych bloczki nieotynkowane); {A_WALLS}",
    f"karta: ściany działowe w pomieszczeniach suchych wykończone masą szpachlową — na nich mleczka może nie być (do −{zl(7 * (W_SYP + W_GAB + W_KOR))})")
add(50505, WALLS + CEIL, f"Manual: gruntowanie przed i po gładziach — ściany {pl(WALLS)} + sufity {pl(CEIL)}; {A_WALLS}", M_GLADZ)
add(50503, WALLS + CEIL, f"Manual: farba podkładowa na świeże gładzie — ściany {pl(WALLS)} + sufity {pl(CEIL)}; {A_WALLS}")
add(50495, LINE_ALL, f"Manual: akrylowanie łączeń ścian z sufitem — obwody pokoi, korytarza, holu (bez stron otwartych) i pom. gospodarczego ≈ {pl(LINE_ALL)} mb")
add(50508, CEIL - CEIL_COLOR, f"sufity białe: sypialnia, gabinet, hol, salon z aneksem = {pl(CEIL - CEIL_COLOR)} m²")
add(50509, CEIL_COLOR, f"rysunek: sufit w kolorze — korytarz granatowy {pl(A_KOR)} + pom. gospodarcze beżowe {pl(A_PG)} = {pl(CEIL_COLOR)} m²")
add(50513, WALLS_WHITE, f"rysunek: ściany RAL 9010 (białe) — sypialnia, gabinet, hol, salon z aneksem {pl(WALLS_WHITE)} m²; {A_WALLS}",
    "wizualizacje: farba hydrofobowa przy oknach — jaki produkt i czy w tej cenie")
add(50514, WALLS_COLOR + DOOR_LEAVES,
    f"rysunek: ściany w kolorze — korytarz granatowy {pl(W_KOR)}, pom. gospodarcze beżowe {pl(W_PG)} (farba hydrofobowa), sypialnia beż pod listwą sztukaterii za łóżkiem {pl(BED_LOW)} + skrzydła drzwi malowane farbą ścienną (rysunek, uwaga 3) ≈ {pl(DOOR_LEAVES)} m² = {pl(WALLS_COLOR + DOOR_LEAVES)} m²; {A_H}",
    f"czy malowanie skrzydeł drzwi ukrytych i przesuwnych jest po naszej stronie (bez nich −{zl(26 * DOOR_LEAVES)})")
add(50530, 10, "odcinanie kolorów: granatowy korytarz od białego holu i pokoi, beż w sypialni i pom. gospodarczym — ok. 10 mb")
add(50516, 3.5, "wizualizacja sypialni: jedna pozioma listwa sztukaterii na ok. 1,1 m przez ścianę za łóżkiem ≈ 3,5 mb",
    "przebieg i profil sztukaterii — rysunki ścian będą w projekcie szczegółowym")
add(50510, 3.5, "malowanie sztukaterii jak listwa")
add(50515, 2.95 + 2.79 + 1.77, "rysunek: karnisze — sypialnia 2,95 + salon 2,79 + firanka 1,77 = 7,51 mb",
    "czy montaż karniszy po naszej stronie")
M_WALL = f"z czego ściana — jeśli murowana z bloczków 10 cm (110 zł/m²) + nadproże 150 zł zamiast GK, profili UA i taśmy na łączeniach GK: −{zl(180 * NEW_WALL + 250 + 35 * 4 * NEW_WALL - 110 * NEW_WALL - 150)}"
M_WALL_OPEN = f"do sprawdzenia na rysunku: otwór 70 pod drzwi przesuwne leży w ścianie od korytarza (70 + nowy filarek 20 w miejscu dawnych drzwi 90 do WC), a nowa ściana od gabinetu może być bez otworu — wtedy 1,75 × {pl(H)} = {pl(1.75 * H)} m² GK zamiast {pl(NEW_WALL)} m² (+{zl((180 + 4 * 35) * (1.75 * H - NEW_WALL))} ze szpachlowaniem łączeń)"
add(50523, NEW_WALL, f"zakres prac klienta + rysunek: nowa ściana w linii drzwi gabinetu 1,75 × {pl(H)} minus otwór 70 pod drzwi przesuwne = {pl(NEW_WALL)} m²; GK z wełną, wysoki stopień (Manual: mały metraż, otwór na drzwi)",
    [M_WALL, M_WALL_OPEN])
add(50521, 1, "Manual: otwór drzwiowy w ściance GK wzmacniamy profilami UA — otwór pod drzwi przesuwne pom. gospodarczego; drzwi przesuwne natynkowe montuje firma od drzwi (zakres prac klienta)", M_WALL)
add(50536, 2 * 2 * NEW_WALL, f"Manual: 2 mb taśmy na m² ściany GK — nowa ściana obustronnie 2 × {pl(NEW_WALL)} m²", [M_WALL, M_WALL_OPEN])
add(50529, BRUZDY_EL - BRUZDY_B + (BRUZDY_WK - 2) + 9,
    f"Manual: naprawy tyle samo co bruzd + miejsca po wyburzonej ścianie — bruzdy elektryczne poza łazienką {BRUZDY_EL - BRUZDY_B} mb + wod-kan kuchnia i pralka {BRUZDY_WK - 2} mb + styk po wyburzeniu ok. 9 mb (2 × {pl(H)} + 2 × 1,75)")

# ——— Klimatyzacja — the units go in by another contractor before us
add(50414, 0, "klimatyzację montuje inny wykonawca, który wchodzi pierwszy i robi bruzdy w ścianach i wylewce",
    "Praca wybrana, ilość nieznana: zaklejenie bruzd po wykonawcy klimatyzacji — długości tras nieznane; szacunkowo ok. 20 mb ≈ 1,0 tys. zł")

# ——— Kuchnia
M_KITCHEN = "zabudowę montuje firma stolarska — czy podłączenia zlewu, baterii, zmywarki i płyty są po naszej stronie (≈ 1,0 tys. zł)"
add(50643, 1.8 * 0.6, "zakres prac klienta: płytki 30x60 między blatem a szafkami — ok. 1,8 mb × 0,6 m (rysunek kuchni)",
    "długość i wysokość pasa płytek — rysunek ściany kuchni będzie w projekcie szczegółowym")
add_new(rows[50643]['section'], rows[50462]['description'], "m²", 30, 1.8 * 0.6,
        "Komentarz: fugowanie dodajemy w sekcji, w której są fugowane płytki — płytki między blatem a szafkami 1,08 m²; pozycja z sekcji Podłogi, wstawiona do kuchni",
        "długość i wysokość pasa płytek — rysunek ściany kuchni będzie w projekcie szczegółowym")
add(50637, 1, "zlew przeniesiony pod okno (zakres prac klienta)", M_KITCHEN)
add(50633, 1, "bateria zlewozmywakowa", M_KITCHEN)
add(50636, 1, "syfon zlewu", M_KITCHEN)
add(50641, 1, "zmywarka przeniesiona pod okno (zakres prac klienta)", M_KITCHEN)
add(50639, 1, "płyta indukcyjna (rysunek: zasilanie płyty 3/N/PE)", M_KITCHEN)
add(50683, 0, "okap w zabudowie — montuje firma stolarska (zakres prac klienta)", "czy okap z podłączeniem do wentylacji po naszej stronie (+350 zł)")

# ——— Montaż stolarki
M_DOORS = "zakres współpracy z firmą od drzwi — co dokładnie robią oni, a co my"
add(50660, 2, "zakres prac klienta: drzwi ukryte 80 — sypialnia, gabinet (drzwi łazienki w sekcji Łazienka); ościeża i skrzydła montuje firma od drzwi, po naszej stronie przygotowanie i obróbka otworu", M_DOORS)
add(50664, 0, "przygotowanie otworów pod drzwi ukryte — wymiary poda firma od drzwi",
    "Praca wybrana, ilość nieznana: czy otwory dewelopera trzeba dopasować do drzwi ukrytych (200 zł/szt, przy 3 szt. 600 zł)")

# ——— Instalacja elektryczna
add(50703, SOCKETS + SWITCHES,
    f"rysunek elektryki (niebieskie = nowe), poza łazienką: gniazdka {SOCKETS} (sypialnia 3, korytarz 1, pom. gospodarcze 3, gabinet 6, kuchnia 10, salon 5 z TV) + włączniki {SWITCHES} = {SOCKETS + SWITCHES} pkt")
add(50675, SOCKETS + SWITCHES - SCHODOWE, f"Manual: montaż = liczba punktów — {SOCKETS + SWITCHES} minus {SCHODOWE} schodowych/krzyżowych liczonych osobno",
    "czy deweloper zamontował osprzęt na swoich punktach — montaż liczony tylko na nowych (39 zł/szt za każdy punkt dewelopera)")
add(50693, SCHODOWE, f"Manual: schodowe i krzyżowe osobno (legenda) — sypialnia 3, korytarz 4 = {SCHODOWE}")
add(50701, LIGHTS + AC_PTS,
    f"Manual: każdy wyprowadzony przewód bez puszki — oświetlenie poza łazienką {LIGHTS} (sypialnia 4, korytarz 6, hol 3, gabinet 1, pom. gospodarcze 1, kuchnia 2, jadalnia 5, salon 4; z LED w szafach i pod szafkami) + zasilanie 3 jednostek wewnętrznych klimatyzacji {AC_PTS} = {LIGHTS + AC_PTS}",
    f"czy zasilanie jednostek klimatyzacji robi wykonawca klimatyzacji (−{zl(100 * AC_PTS)})")
add(50679, KINKIETY, "rysunek: kinkiety — sypialnia 2 (przy łóżku), hol 1, salon 1, kuchnia 1")
add(50685, LAMPY, f"pozostałe oprawy: {LIGHTS} punktów minus {KINKIETY} kinkietów i {LED_PTS} LED (taśmy montuje stolarz) = {LAMPY}",
    "rodzaj lamp (lampy ze składaniem 150 zł/szt)")
add(50699, 10, "zakres prac klienta: dodatkowy kabel zasilający od rozdzielni do okna w kuchni (jednostka zewnętrzna klimatyzacji na balkonie) — ok. 10 mb",
    "trasa i długość kabla do okna w kuchni")
M_ROZDZ = "czy rozdzielnia dewelopera ma miejsce na nowe obwody — jeśli tak, tylko dołożenie 1 bezpiecznika dla klimatyzacji 200 zł zamiast przebudowy 1500 zł (−1 300 zł)"
add(50695, 1, "Manual: przy indukcji rozdzielnia minimum 18 modułów — nowe obwody: klimatyzacja, przeniesiona kuchnia z płytą 3/N/PE, pralka w pom. gospodarczym, łazienka", M_ROZDZ)
add(50697, 0, "bezpiecznik dla klimatyzacji jest w przebudowie rozdzielni do 18 modułów", M_ROZDZ)
add(50669, 1, "rysunek: zasilanie płyty 3/N/PE w nowym układzie kuchni",
    "czy przewód dewelopera do płyty jest już w tym miejscu (−300 zł)")
add(50702, 1, "zakres prac klienta: przeniesienie złączy pod TV na inną ścianę — punkt internet / TV")
add(50674, 1, "gniazdo TV i internet przy nowym miejscu TV")

# ——— Wod-kan + c.o.
add(50710, 4, "zakres prac klienta: przesunięcie podejść zlewu i zmywarki pod okno — ciepła, zimna, kanalizacja, zmywarka = 4 pkt")
add(50711, 1, "zakres prac klienta: usunięcie grzejnika w kuchni — rozkucie i zatynkowanie podejść")
add(50706, 2, f"zakres prac klienta: likwidacja podejść WC w pom. gospodarczym (woda, kanalizacja); podejścia umywalki przechodzą do umywalki w łazience; {A_PGN}")
add_new(WK, rows[50546]['description'], "pkt", 250, 2,
        f"zakres prac klienta: nowe podejście pralki / pralko-suszarki w pom. gospodarczym (woda, kanalizacja); pozycja z sekcji Łazienka, wstawiona do instalacji wod-kan, bo pom. gospodarcze nie jest łazienką; {A_PGN}")
add_new(WK, rows[50594]['description'], "szt", 100, 1, f"podłączenie pralki w pom. gospodarczym; pozycja z sekcji Łazienka; {A_PGN}")
add_new(WK, rows[50593]['description'], "szt", 60, 1,
        f"Manual: zawór czerpalny pod pralkę; przedścianka GK zasłaniająca rury pralki niewliczona (Manual: poza łazienką na wstępnej wycenie nie liczymy); pozycja z sekcji Łazienka; {A_PGN}")
add(50705, 3, "ponowny montaż grzejników w sypialni, gabinecie i salonie",
    "klient: możliwa wymiana grzejnika w salonie na pionowy o większej mocy — grzejnik dekoracyjny 450 zł zamiast 250 zł, w innym miejscu + przebudowa c.o. 2 pkt (≈ +0,7 tys. zł)")

# ——— Łazienka (jedyna łazienka; dawne WC staje się pom. gospodarczym)
S = BATH
add(50546, 6, f"zakres prac klienta: podejścia prysznica przeniesione wyżej i rozdzielone na słuchawkę i deszczownicę (2) + umywalka z baterią podtynkową w ścianie do pom. gospodarczego (3) + woda do stelaża WC (1) = 6 pkt; {A_DEW}",
    "czy podejścia dewelopera dają się wykorzystać — klient: przy wannie są tylko 2 przyłącza", section=S)
add(50620, 3, "Manual: w deweloperce rury idą przed ścianą — wkucie zespołów: prysznic, umywalka, WC", section=S)
add_new(S, rows[50706]['description'], "pkt", 120, 2,
        "zakres prac klienta: usunięcie / zaklejenie podłączenia pralki w łazience (woda, kanalizacja); pozycja z instalacji wod-kan, wstawiona do łazienki")
add(50631, 1, "zakres prac klienta: odpływ liniowy w miejscu wanny dewelopera — skucie posadzki, obniżenie rur, spadek", section=S)
add(50579, 1, "zakres prac klienta: odpływ liniowy z rusztem do wypełnienia płytką, płytki w kopertę", section=S)
add(50551, 0, "klient: wkucie czy podest ze styroduru — do decyzji po rozkuciu posadzki (Manual: wychodzi dopiero po rozkuciu)",
    "jeśli odpływu nie da się obniżyć — schodek / podest pod prysznicem +1 000 zł", section=S)
add(50622, 1, "rysunek: przedścianka GK pod prysznicem 89 × 22 z półką (Manual: półka pod baterię jest w przedściance)", section=S)
add(50562, 1, "zakres prac klienta: bateria prysznicowa podtynkowa w przedściance — deszczownica ścienna i słuchawka", section=S)
add(50550, 1, "Manual: biały montaż = liczba baterii podtynkowych prysznica", section=S)
add_new(S, "Montaż kabiny prysznicowej", "kpl", 1200, 1,
        "wizualizacje: drzwi szklane przesuwne na progu z płytek — praca z katalogu (nie ma jej w szablonie), cena z katalogu",
        "rodzaj zamknięcia prysznica — sama szyba stała 550 zł (−650 zł)")
add(50569, 1, "zakres prac klienta: stelaż podtynkowy WC pod płytą GK", section=S)
add(50583, 1, "rysunek: zabudowa stelaża GK 22 cm do wysokości 120, razem z zabudową rury kanalizacyjnej", section=S)
add(50592, 1, A_ZAKRES + ": montaż miski WC", section=S)
add(50564, 1, "zakres prac klienta: bateria umywalkowa wkuta w ścianę między łazienką a pom. gospodarczym", section=S)
add(50549, 1, "Manual: biały montaż = liczba baterii podtynkowych umywalki", section=S)
add(50587, 1, "wizualizacje: umywalka na szafce (szafkę montuje stolarz — Manual)", section=S)
add(50585, 1, "syfon umywalki", section=S)
add(50572, 1, "zakres prac klienta: grzejnik (drabinka) przeniesiony do strefy prysznica — ponowny montaż", section=S)
add_new(S, rows[50709]['description'], "pkt", 250, 2,
        "zakres prac klienta: zmiana miejsca grzejnika — zasilanie i powrót; pozycja z instalacji wod-kan + c.o., wstawiona do łazienki")
add(50552, BATH_WALLS + 2 * A_B, f"Manual: ściany {pl(BATH_WALLS)} + podłoga i sufit {pl(A_B)} × 2; {A_H}", section=S)
add_new(S, MLECZKO, "m²", 7, A_B,
        f"Manual: mleczko na tynkach deweloperskich — tylko sufit {pl(A_B)} (karta: ściany w łazience nieotynkowane, zatarte pod płytki); pozycja z sekcji ścian, wstawiona do łazienki (Manual)")
add(50596, BATH_WALLS + A_B, f"Manual: folia w płynie na wszystkich ścianach i podłodze — ściany {pl(BATH_WALLS)} + podłoga {pl(A_B)}; {A_H}",
    f"czy folia także na ścianach nad płytkami, licowanych GK (bez nich −{zl(30 * PAINT_W)})", section=S)
add(50619, 15, f"Manual: ok. 15 mb na łazienkę 4 m² — łazienka {pl(A_B)} m²", section=S)
add(50613, TILE_W,
    f"zakres prac klienta + wizualizacje: płytki 60x120 do sufitu na 3 ścianach prysznica (1,53 + 0,835 + 0,835) × {pl(H)} = {pl(TILE_FULL)} m² + na pozostałych ścianach do 120 cm ≈ {pl(TILE_LOW)} m² = {pl(TILE_W)} m²; format standard; {A_H}",
    "dokładny układ płytek na ścianach — rysunki ścian będą w projekcie szczegółowym", section=S)
add(50607, TILE_F, f"zakres prac klienta: podłoga 90x90 — {pl(A_B)} m² minus przedścianka i zabudowa stelaża = {pl(TILE_F)} m²; 90x90 liczone jak format standard",
    f"czy 90x90 liczyć jak 120x120 (300 zł/m², +{zl(120 * TILE_F)})", section=S)
add(50597, TILE_F, "Manual: mata kompensacyjna pod płytki wielkoformatowe 90x90",
    f"czy mata jest potrzebna (bez niej −{zl(45 * TILE_F)})", section=S)
add(50553, TILE_W + TILE_F, f"klient: fuga „potencjalnie epoksydowa” — fugowanie = wszystkie płytki (Manual): {pl(TILE_W)} + {pl(TILE_F)}",
    f"fuga epoksydowa czy cementowa (cementowa 30 zł/m², −{zl(50 * (TILE_W + TILE_F))})", section=S)
add(50615, 1.8, "rysunek: półka przedścianki 0,89 + półka nad stelażem 0,60 + próg ok. 0,3 ≈ 1,8 mb", section=S)
add(50600, 5.5, "Manual: narożniki zewnętrzne × 2, nie zawyżaj — krawędzie przedścianki i zabudowy stelaża + połączenie płytek w otworze drzwi (rysunek, detal A) ≈ 5,5 mb",
    "gdzie dokładnie szlif 45° — do sprawdzenia na rysunkach ścian", section=S)
add(50598, 20, "Manual: 20–30 mb na łazienkę — narożniki prysznica, próg, styk z podłogą", section=S)
add(50617, 18, "Manual: WC 5 + bateria prysznicowa podtynkowa 3 + umywalka podtynkowa 3 + grzejnik 2 + puszki 4 + kratka 1 = 18 (min. 15)", section=S)
add(50547, PER_B, f"Manual: akryl na styku płytek z sufitem i ścian z sufitem — obwód łazienki {pl(PER_B)} mb", section=S)
add(50558, LICOW, "Manual: płytki do 120 cm, wyżej malowana ściana bez uskoku — licowanie GK nad płytkami ≈ 6 m²", section=S)
add(50559, PAINT_W + A_B, f"Manual: malowanie tylko ścian bez płytek — ściany nad płytkami ≈ {pl(PAINT_W)} (błękitne) + sufit {pl(A_B)} (beżowy) = {pl(PAINT_W + A_B)} m²; {A_H}",
    f"Komentarz: farba podkładowa na świeże gładzie „wpisujemy”, w łazience w sekcji łazienka — nie wpisana, bo łazienka ma już dwukrotne gruntowanie i gładź w tej pozycji; jeśli osobno: {pl(PAINT_W + A_B)} m² × 12 zł ≈ +{zl(12 * (PAINT_W + A_B))}", section=S)
add_new(S, NAPRAWY, "mb", 25, BRUZDY_B + 2,
        f"Manual: naprawy tyle samo co bruzd — bruzdy elektryczne w łazience {BRUZDY_B} mb ({B_LIGHTS + B_EL} pkt × 2) + wod-kan 2 mb; pozycja z sekcji ścian, wstawiona do łazienki (Manual)")
add(50626, B_LIGHTS, "rysunek: punkty oświetleniowe w łazience — sufit 2, nad lustrem 2, LED w szafce nad WC 1, LED we wnęce prysznica 1 = 6",
    "czy oprawy sufitowe są natynkowe — wpuszczane wymagają sufitu podwieszanego (≈ +1,8 tys. zł)", section=S)
add(50627, B_EL, "zakres prac klienta (1–2 kontakty) + rysunek: gniazdka 3 + włącznik 1 = 4", section=S)
add(50570, B_EL, "Manual: montaż = liczba punktów", section=S)
add(50576, 4, "rysunek: oprawy sufitowe 2 + nad lustrem 2", section=S)
add(50573, 0.9, "wizualizacje: taśma LED we wnęce prysznica ok. 0,9 mb (LED w szafce nad WC montuje stolarz)", section=S)
add(50574, 1, "zasilacz taśmy LED we wnęce", section=S)
add(50577, 1, "wizualizacje: lustro nad umywalką", section=S)
add(50575, 1, "łazienka bez okna — kratka wentylacyjna dewelopera, ponowny montaż po płytkach i malowaniu (wiercenie liczy na nią 1 otwór)", section=S)
add(50629, 0, "wizualizacje: szafka nad WC z LED w zabudowie — montuje firma stolarska", section=S)
add_new(S, rows[50660]['description'], "szt", 800, 1,
        "zakres prac klienta: drzwi ukryte 80 do łazienki — ościeża i skrzydło montuje firma od drzwi, po naszej stronie przygotowanie i obróbka otworu; pozycja z sekcji stolarki, wstawiona do łazienki",
        M_DOORS)

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
print(f"W_SYP {pl(W_SYP)} W_GAB {pl(W_GAB)} W_KOR {pl(W_KOR)} W_SAL {pl(W_SAL)} W_PG {pl(W_PG)} WALLS {pl(WALLS)} CEIL {pl(CEIL)} LINE_ALL {pl(LINE_ALL)} TILE_W {pl(TILE_W)} TILE_F {pl(TILE_F)} BATH_WALLS {pl(BATH_WALLS)} PTS {PTS}")
seen = set()
for r in draft:
    k = (r['section'], r['description'])
    if k in seen: print("DUPLICATE", k)
    seen.add(k)
