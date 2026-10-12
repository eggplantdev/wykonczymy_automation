# Builds measure/ai-draft-load.json for production #201 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). Assumptions go into the row's `assumptions`, unknowns into `missingData`.
# Sources: the design firm's „Kosztorys wykonawczy” (zakres PDF, „zakres poz. N” = its LP) and the 13-sheet
# projekt (A.00–A.09, „A.xx”). The zakres already carries quantities, so most rows read a printed figure;
# room areas and perimeters are the printed A/L of A.01. Rows outside the szablon take a katalog price
# (catalogue id in the comment) or 0 zł with „brak w katalogu — do wyceny” (procedure rule 9).
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

def pl(x): return f"{x:.2f}".replace(".", ",")

S_DRY = rows[60688]['section']   # „Ściany i sufity bez łazienek ” — trailing space is part of the name
S_BATH = rows[60737]['section']
NEW = "brak w katalogu — do wyceny"

H = 2.75          # zakres header „Wysokość lokalu 2,75”; A.01 przekroje 273–274,5
H_GK = 2.71       # rooms under the 4 cm suspended ceiling (A.02a)
H_BATH = 2.63     # łazienka: sufit podwieszany h=12 cm (A.02a)

# A.01 room schedule (A = m², L = perimeter in m).
rooms = dict(kuchnia=(3.7, 9.16), salon=(17.5, 16.98), korytarz=(8.8, 13.96), lazienka=(5.4, 9.489),
             pokoj=(10.7, 13.426), sypialnia=(12.5, 14.277))
A_floor = sum(a for a, _ in rooms.values())                     # 58,6
P_dry = sum(l for k, (_, l) in rooms.items() if k != 'lazienka')  # 67,81
A_bath, P_bath = rooms['lazienka']

# Floors (A.05, zakres poz. 43–46): tiles 598×598 in łazienka 4,1 + kuchnia 3,7 + hol 2,4 = 10,2.
tiles_bath_floor = 4.1        # 5,4 minus wanna 170 × 70
tiles_kitchen = 3.7
tiles_hall = 2.4
deska = rooms['salon'][0] + (rooms['korytarz'][0] - tiles_hall) + rooms['pokoj'][0] + rooms['sypialnia'][0]
self_level = 5.1 + 3.7 + 2.6  # A.02: wylewka samopoziomująca łazienka / kuchnia / hol

# Łazienka (A.07–A.09; zakres poz. 62–63): walls Stone 15,19 + Pattern 2,6 m²; widoki sum 17,7.
bath_walls = P_bath * H_BATH - 0.80 * 2.05          # minus the door opening (skrzydło 70)
tiles_bath_walls = 15.19 + 2.6
behind_tub = 0.6 * (1.7 + 0.7)                       # wall face hidden below the tub rim
bath_paint_walls = bath_walls - tiles_bath_walls - behind_tub
tiles_bath = tiles_bath_walls + tiles_bath_floor

# Walls and ceilings outside łazienka (zakres poz. 50–54). The zakres figures cover the whole flat;
# the łazienka ceiling is priced in its own sekcja.
ceil_all = 59.18
ceil_dry = ceil_all - A_bath
walls_paint = 152.6
walls_gladz = 98.73            # only the walls marked GŁADŹ on A.06
walls_no_gladz = walls_paint - walls_gladz
gk_ceiling = 44.9 - A_bath     # zakres poz. 2 is the whole flat; łazienka sufit is a kpl (katalog)
plain_ceiling = rooms['pokoj'][0]   # the pokój keeps the developer slab (A.02a)

# Spiek kamienny instead of Murso panels (mail): the „8 panel dekoracyjny imitujący skałę” segments on
# A.01 — salon 0,86 + 0,30 + 0,86 m, sypialnia headboard wall 1,80 m — full height under the GK ceiling.
spiek_len = 0.86 + 0.30 + 0.86 + 1.80
spiek = spiek_len * H_GK

# Elektryka, A.03 „Tabela zmian elektrycznych”.
light_rooms = 9 + 3 + 5       # sypialnia, pokój, salon
light_bath = 5
sockets = 1                   # kuchnia
bruzdy_el = 2 * (light_rooms + light_bath + sockets)

A_ZAKRES = "ilość z kosztorysu wykonawczego projektanta (zakres)"
A_H = f"wysokość lokalu {pl(H)} m z zakresu, pod sufitem podwieszanym {pl(H_GK)} m (A.02a)"

draft = []
def add(i, qty, assumptions=None, missing=None):
    r = dict(rows[i]); r['qty'] = round(qty, 2)
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

def add_new(section, description, unit, price, qty, assumptions=None, missing=None):
    r = dict(section=section, description=description, unit=unit, clientPrice=float(price), qty=round(qty, 2))
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

# — Prace dodatkowe
add(60598, 1, "małe mieszkanie (59 m²) w całości, stan deweloperski — Manual: 1500 zł",
    "piętro i winda; dużo zmian projektowych — Manual dla dużych deweloperek z wieloma zmianami mówi ok. 2000 zł")
add(60601, 2, "rynek pierwotny bez wyburzeń — Manual: 2 big bagi")

# — Wyburzenia, demontaże, zabezpieczenia
add(60616, A_floor, f"m² podłogi (katalog): suma pomieszczeń z A.01 {pl(A_floor)} m²")
add(60620, bruzdy_el, f"2 mb na punkt (katalog): {light_rooms + light_bath} punktów świetlnych + {sockets} gniazdo z tabeli zmian A.03; limit 150 mb dla 50–100 m² niedotknięty",
    "część punktów sufitowych idzie w sufit podwieszany, bez bruzd — możliwe mniej")
add(60618, 2, "ok. 2 mb na łazienkę (katalog); przyłącza w ścianie międzylokalowej idą w przedściankę, nie w bruzdę")
add(60626, 2, "grzejniki 1 i 2 (łazienka, sypialnia) zamieniane na dekoracyjne — A.01, A.04")

# — Podłogi
add(60687, deska, f"deska warstwowa klejona Boen, układ rozrzucony → układanie z gruntowaniem, mijanka; ułożona powierzchnia: salon {pl(rooms['salon'][0])} + korytarz bez płytek {pl(rooms['korytarz'][0] - tiles_hall)} + pokój {pl(rooms['pokoj'][0])} + sypialnia {pl(rooms['sypialnia'][0])} (A.01, A.05) — zakres podaje 51,8 m² materiału, czyli ok. 10% zapasu",
    "czy układ rozrzucony liczyć jak mijankę (75 zł/m²) — deska klejona, nie panel")
add(60670, tiles_hall, "płytki 598×598 przy wejściu w korytarzu — zakres poz. 43 (łazienka 4,1 + kuchnia 3,7 + hol 2,4)")
add(60677, tiles_hall + tiles_kitchen + 1.7, "fugowanie = wszystkie płytki poza łazienką (Manual): hol 2,4 + kuchnia podłoga 3,7 + pas między szafkami 1,7")
add(60655, self_level, "A.02: wylewka samopoziomująca łazienka 5,1 + kuchnia 3,7 + hol 2,6 — zlicowanie płytek z deską (katalog)")
add(60651, tiles_kitchen + 2.6, "pod wylewkę i płytki w kuchni i holu (katalog); łazienka w „Dwukrotne gruntowanie”, deska ma gruntowanie w cenie")
add(60652, 3, "A.04 „naprawa wylewki”: sypialnia 1 + łazienka 2 mb — po przeniesieniu podejść grzejnikowych i wod-kan")
add(60664, 1.5, "mata elektryczna w łazience 1,5 m² — A.03, zakres poz. 31; wylewka samopoziomująca w łazience liczona osobno",
    "moc maty „do określenia” (zakres)")
add(60659, 47.2, "listwa Lagrus R10F 47,2 mb — zakres poz. 45 (obwód bez łazienki 67,8 mb minus ok. 30% na zabudowy, zgodne z regułą katalogu)")
add(60657, 47.2, "tyle co listew (katalog); zakres: listwa „z zakrylowaniem”")
add(60663, 6, "łączenie deski z płytkami 6 mb — zakres poz. 46; projekt łączy masą akrylową zamiast korka, cena j.m. korka z szablonu",
    "masa akrylowa zamiast korka — czy ta sama stawka")

# — Ściany i sufity bez łazienek
add(60693, gk_ceiling, f"sufit podwieszany h=4 cm: zakres poz. 2 podaje 44,9 m² dla całego mieszkania, minus łazienka {pl(A_bath)} m² liczona w sekcji Łazienka jako komplet (A.02a: salon/korytarz/kuchnia 28,4 + sypialnia 12,1; pokój bez sufitu)")
add(60688, 3.2, "„GK — wyrównanie zabudów” 3,2 m² — zakres poz. 4 (doklejona płyta GK do ściany, legenda A.01)")
add_new(S_DRY, "Przedścianka z GK płyta pojedyncza + folia paroizolacyjna", "m²", 150, 10.2,
        "przedścianka 10,2 m² — zakres poz. 10: „brak możliwości wykonania podtynku w ścianach międzylokalowych”; A.01: ściana kuchni to ściana międzylokalowa (3,7 mb × 2,75 ≈ 10,2) — cena z katalogu (Przedścianka z GK płyta pojedyncza)",
        "na której ścianie dokładnie — rysunki nie kreślą przedścianki o tym metrażu")
add_new(S_DRY, "Zabudowa ścian z GK na stelażu + przedścianki", "m²", 250, 1.2,
        "obudowa kominka elektrycznego 1,2 m² — zakres poz. 12; cena z katalogu (Zabudowa ścian z GK na stelażu + przedścianki)")
add_new(S_DRY, "Montaż kratek wentylacyjnych", "szt", 100, 1,
        "„wykonanie wentylacji kominka elektrycznego” — zakres poz. 13; cena z katalogu (Montaż kratek wentylacyjnych)",
        "czy kominek parowy (Optimyst) wymaga czegoś więcej niż kratki w obudowie")
add_new(S_DRY, "Montaż kominka elektrycznego (wkład kasetowy)", "szt", 0, 1,
        "Dimplex Cassette — zakres poz. 59–60",
        f"{NEW}; najbliżej „Murowanie kominka - cena do ustalenia”; gniazdo zasilające kominka nie jest w tabeli zmian A.03")
add_new(S_DRY, "Wykonanie wnęk na głośniki w suficie GK", "szt", 0, 3,
        "3 wnęki — zakres poz. 3; „system nagłośnieniowy” (A.01, punkt 5)",
        f"{NEW}; okablowanie głośników nie jest w zakresie")
add_new(S_DRY, "Wykonanie wnęk w zabudowie GK", "szt", 0, 3,
        "„wnęki w zabudowie” 1 + 2 szt — zakres poz. 8–9",
        f"{NEW}; najbliżej „Wykuwanie wnęki pod półeczkę w ścianie + obróbka z gk” 500 zł; gdzie są wnęki — rysunki ich nie oznaczają (wizualizacja łazienki pokazuje podświetlone półki przy wannie)")
add_new(S_DRY, "Układanie glazury na ścianie wielki format 120x270", "m²", 550, spiek,
        f"spiek kamienny zamiast panelu Murso (mail) na polach „8 panel dekoracyjny imitujący skałę” z A.01: salon 0,86 + 0,30 + 0,86 m i ściana za łóżkiem w sypialni 1,80 m = {pl(spiek_len)} mb × {pl(H_GK)} m (do sufitu) — cena z katalogu (Układanie glazury na ścianie wielki format 120x270)",
        "format i wysokość spieku — zakres liczył 3 panele Murso; jeśli spiek nie idzie do sufitu, metraż spada")
add_new(S_DRY, "Montaż paneli ściennych, lamele, dekory itp", "m²", 150, 5.5,
        "zielona ściana z mchu 5,5 m² — zakres poz. 57 (green up decor); cena z katalogu (Montaż paneli ściennych, lamele, dekory itp)",
        "czy ścianę z mchu montuje dostawca — wtedy pozycja wypada (−825 zł)")
add_new(S_DRY, "Klejenie lustra na ścianie", "m²", 0, 1.56,
        "lustro 1,56 m² — zakres poz. 58; A.01 kreśli lustra przy biurku w pokoju",
        f"{NEW}; najbliżej „Montaż lustra” 120 zł/szt; czy lustro montuje stolarz w zabudowie")
add_new(S_DRY, "Malowanie gruntem magnetycznym", "m²", 0, 2.2,
        "grunt magnetyczny 2,2 m² — zakres poz. 52",
        f"{NEW}; najbliżej „Malowanie ścian w kolorze” 26 zł/m²")
add(60732, 2.62, "belka maskująca — sztukateria Creativa LK-03, 12 cm, 2,62 mb (zakres poz. 14)")
add(60734, 7.3, "karnisze 7,3 mb — zakres poz. 15")
add(60718, walls_paint + plain_ceiling, f"tynki deweloperskie: ściany {pl(walls_paint)} m² + sufit w pokoju {pl(plain_ceiling)} m² (jedyny bez sufitu podwieszanego)")
add(60712, ceil_dry, f"„gładź na suficie w standardzie” (A.09) — zakres poz. 53: {pl(ceil_all)} m² minus łazienka {pl(A_bath)} m²",
    "Q3 czy Q4 — przy profilach LED w suficie Q4 (+21 zł/m²: +1,1 tys. zł)")
add(60714, walls_gladz, "gładź tylko na ścianach oznaczonych GŁADŹ na A.06 — zakres poz. 54",
    "Q3 czy Q4 (+18 zł/m²: +1,8 tys. zł)")
add(60719, walls_gladz + ceil_dry, "przed i po gładziach — pod wszystkie gładzie")
add(60723, walls_gladz + ceil_dry, "farba podkładowa na świeże gładzie")
add(60721, walls_no_gladz, f"ściany malowane bez gładzi: {pl(walls_paint)} − {pl(walls_gladz)} m²")
add(60724, ceil_dry, f"sufity na biało (Flugger Dekso 1, biały) — zakres poz. 50: {pl(ceil_all)} m² minus łazienka")
add(60729, walls_paint, "ściany w kolorze NCS S1505-Y60R — zakres poz. 51, 152,6 m²",
    "czy 152,6 m² obejmuje pola pod spiek i ścianę z mchu — wtedy o ok. 16 m² mniej")
add(60722, P_dry, f"łączenia ścian i sufitów — obwód pomieszczeń bez łazienki z A.01 ({pl(P_dry)} mb)")
add(60710, 15, "krawędzie przedścianek, obudowy kominka i uskoku sufitu podwieszanego przy pokoju — szacunek agenta")
add(60703, bruzdy_el + 2, "tynkowanie bruzd elektrycznych i wod-kan")
add(60704, 16, f"gładź po bruzdach tylko na ścianach bez pełnej gładzi (katalog) — ok. 35% ścian ({pl(walls_no_gladz)} z {pl(walls_paint)} m²), więc ok. 35% z {pl(bruzdy_el)} mb")

# — Łazienka
add(60737, 11, "A.04: zmiana lokalizacji łazienka 11 pkt (zakres poz. 40 „hydraulika 11”); zgodne z liczeniem po punktach końcowych: wanna 3, umywalka 3, WC 2, bidetta 2, pralka + suszarka ok. 2")
add(60740, 1, "stelaż WC Villeroy & Boch ViConnect — zakres poz. 65")
add(60741, 1, "przedłużenie stelaża WC do sufitu, powyżej zabudowa meblowa (A.01, punkt 2) — zakres poz. 5")
add_new(S_BATH, "Przedścianka z GK płyta pojedyncza + folia paroizolacyjna", "m²", 150, 0.96,
        "przedścianka GK/OSB z umywalką 0,96 m² — zakres poz. 6–7; cena z katalogu (Przedścianka z GK płyta pojedyncza)",
        "przedścianka ze wzmocnieniem OSB pod umywalkę — czy stawka z m² wystarczy")
add(60745, 1, "wanna 170 × 70 z obudową ze ścianki murowanej na wys. wanny (A.01, punkt 4; A.09)")
add_new(S_BATH, "Wykonanie przedścianki przy wannie - stworzenie półki pod baterię wannową", "kpl", 1200, 1,
        "półka przy wannie 1,4 mb pod 4-otworową baterię wannową — zakres poz. 11, A.01 punkt 4; cena z katalogu")
add(60777, 1.4, "obłożenie półki przy wannie płytkami — 1,4 mb (zakres poz. 11)")
add(60753, 1, "sufit podwieszany h=12 cm z LED w łazience 5,4 m² (A.02a) — mały sufit jako komplet (katalog)")
add(60750, bath_walls + 2 * A_bath, f"ściany {pl(bath_walls)} + podłoga + sufit {pl(A_bath)} m² (katalog) — obwód {pl(P_bath)} mb (A.01) × {pl(H_BATH)} m pod sufitem podwieszanym, minus drzwi")
add(60759, bath_walls + A_bath, "folia w płynie na wszystkich ścianach i podłodze (katalog)")
add(60761, 20, "ok. 15 mb na 4 m² (katalog), łazienka 5,4 m²")
add(60775, tiles_bath_walls, "płytki ścienne 598×598: Cadence Stone 15,19 + Pattern 2,6 m² — zakres poz. 62–63 (widoki A.08–A.09: 17,7 m²)")
add(60768, tiles_bath_floor, "podłoga 598×598 — zakres poz. 43 (łazienka 4,1 m² = 5,4 minus wanna)")
add(60782, tiles_bath, "fugowanie = wszystkie płytki (Manual)")
add(60762, 2.55, "„płytki 2,55 mb” — zakres poz. 64, narożniki zewnętrzne z widoków")
add(60783, 25, "Manual: 20–30 mb na łazienkę")
add(60784, 20, "WC 5 + bateria wannowa 4-otworowa 4 + zestaw prysznicowy podtynkowy 3 + bateria umywalkowa podtynkowa 3 + bidetta 2 + grzejnik 2 + wentylator 1 (katalog)")
add(60786, P_bath, "styk płytek z sufitem — obwód łazienki", "płytki nie na każdej ścianie idą do sufitu (widoki A.08–A.09)")
add(60787, A_bath + bath_paint_walls, f"sufit {pl(A_bath)} m² + ściany bez płytek {pl(bath_paint_walls)} m² (ściany {pl(bath_walls)} minus płytki {pl(tiles_bath_walls)} minus pas za wanną {pl(behind_tub)})")
add(60790, 2, "zestaw wannowy podtynkowy (bateria 4-otworowa) + zestaw prysznicowy z deszczownicą podtynkowy — zakres poz. 75–76")
add(60797, 2, "jak baterie podtynkowe")
add(60792, 1, "bateria umywalkowa podtynkowa Deante Silia — zakres poz. 72")
add(60796, 1)
add(60794, 1, "bateria bidetowa podtynkowa ze słuchawką — zakres poz. 68")
add(60795, 1)
add(60813, 1, "umywalka Collaro 55 × 44 wisząca lub meblowa — na wizualizacji na szafce")
add(60822, 1, "szafka pod umywalką (wizualizacje łazienki)", "czy szafkę montuje stolarz")
add(60816, 1, "syfon umywalkowy Deante — zakres poz. 71")
add(60818, 1, "WC podwieszane Collaro — zakres poz. 66")
add(60810, 1, "parawan Radaway Modo SL — zakres poz. 74")
add(60819, 1, "pralka i suszarka slim w zabudowie meblowej (A.01, punkt 3)")
add(60820, 1)
add(60817, 5, "zestawy zaworów: kuchnia 2 + łazienka 3 kpl — zakres poz. 35–36")
add(60748, light_bath, "oświetlenie łazienka 5 — tabela zmian A.03")
add(60803, 9.6, "taśma LED wodoodporna w profilu 9,6 mb — A.03 (zakres poz. 28 podaje 9,2 mb)")
add(60804, 2, "transformator LED łazienka 2 — A.03")
add(60788, 3, "wieszak na ręcznik, uchwyt na papier, haczyk — szacunek agenta")

# — Kuchnia
add(60831, tiles_kitchen, "płytki 598×598 na podłodze kuchni — zakres poz. 43")
add(60827, 1.7, "pas między szafkami Cadence Pattern 598×598 1,7 m² — zakres poz. 55, A.06a")
add(60825, 3.2, "wzmocnienie OSB pod szafki wiszące na przedściance kuchni: ok. 3,5 mb × 0,9 m — szacunek agenta (szafki do sufitu na wizualizacji)",
    "czy szafki wiszą na przedściance GK, czy stoją w zabudowie do sufitu")
add(60832, 1, "lodówka w zabudowie (wizualizacja kuchni)", "AGD i jego zakres montażu — projekt kuchni jest koncepcyjny")
add(60839, 1, "płyta indukcyjna (A.01)")
add(60840, 1, "piekarnik w zabudowie (A.01)")
add(60841, 1, "zmywarka ZM 60 (A.01)")
add(60837, 1)
add(60833, 1)
add(60836, 1)

# — Montaż stolarki
add(60845, 3, "3 drzwi bezprzylgowe Porta Art Deco z ościeżnicą regulowaną Elegance (D1 łazienka 70, D2/D3 80) — zakres poz. 19, 21, 22")
add(60854, 1, "„zmiana otworu” 1 szt — zakres poz. 18; zakładam zmniejszenie otworu łazienki pod skrzydło 70",
    "który otwór i w którą stronę — poszerzenie 350 zł (+150 zł), z nowym nadprożem więcej")

# — Elektryka
add(60856, light_rooms, "oświetlenie z tabeli zmian A.03: sypialnia 9 + pokój 3 + salon 5")
add(60858, sockets, "nowe gniazdo w kuchni — A.03")
add(60865, sockets, "osprzęt nowego gniazda",
    "czy wymieniamy osprzęt w całym mieszkaniu — ok. 35 szt. × 39 zł ≈ +1,4 tys. zł")
add(60876, 11, "„oświetlenie — montaż” 5 + 6 szt (zakres poz. 32–33); lampy dostarcza klient (A.03)",
    "żyrandole kryształowe (salon, pokój) mogą wymagać składania — 150 zł/szt.")
add(60881, 26.3, "taśma LED w profilu białym 26,3 mb — zakres poz. 29 (pionowe szczeliny przy panelach i sufit, wizualizacje)",
    "profile podtynkowe w GK — „Montaż profili LED podtynkowych w suficie” 160 zł/mb (+2,6 tys. zł)")
add(60882, 6, "„elektryka — LED 8 szt” (zakres poz. 30) minus 2 transformatory w łazience", "co oznacza 8 szt. LED w zakresie")
add(60868, 1, "sterownik maty grzewczej w łazience", "zakres: mata „zasilana bezpośrednio z tablicy” — czy jest termostat")
add(60891, 1, "osobny bezpiecznik dla maty grzewczej (zakres poz. 31: zasilanie bezpośrednio z tablicy)")
add(60886, 1, "wentylator łazienkowy — widok A1 łazienki")
add(60883, 1, "okap, wentylacja poprowadzona w meblu (A.01 „UWAGA”)")

# — Wod-kan + c.o.
add(60896, 2, "Terma Hanger 1200/360 w łazience + Terma Rolo Room 1800/590 w sypialni — zakres poz. 38–39")
add(60897, 4, "A.04: zmiana lokalizacji grzejnika sypialnia 1 + łazienka 1 — po 2 punkty (zasilanie, powrót)")
add(60893, 1, "„grzejnik 1 szt” bez opisu — zakres poz. 37; zakładam ponowny montaż jednego grzejnika płytowego po malowaniu",
    "co oznacza poz. 37 zakresu")

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in sorted(by.items(), key=lambda kv: -kv[1]): print(f"{s:42} {v:12.2f}")
added = [r for r in draft if not any(r['section'] == x['section'] and r['description'] == x['description'] for x in rows.values())]
print(f"{len(draft)} rows ({len(added)} added, {sum(1 for r in added if r['clientPrice'] == 0)} at 0 zł), total {total:.2f}; "
      f"floor {A_floor:.2f}, P_dry {P_dry:.2f}, deska {deska:.2f}, gk_ceiling {gk_ceiling:.2f}, ceil_dry {ceil_dry:.2f}, "
      f"bath_walls {bath_walls:.2f}, bath_paint_walls {bath_paint_walls:.2f}, spiek {spiek:.2f}")
