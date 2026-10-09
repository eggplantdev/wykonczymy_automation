# Builds measure/ai-draft-load.json for production #190 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). The agent may assume, and every assumption goes into the row's `assumptions`
# (owner, 2026-10-09); what the inputs left unknown goes into `missingData`. Several items are one per line.
# build() takes the assumptions that move many rows as parameters, so the sensitivities in the notes
# are re-runs of the same draft, not hand arithmetic.
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec.strip(), description=desc.strip(), unit=unit.strip(), clientPrice=float(price))

NEW = "brak w katalogu — do wyceny"
S_AC_OPT = "Klimatyzacja — sypialnia (opcja)"   # own sekcja: the brief asks for this unit as an option
def pl(x, n=2): return f"{x:,.{n}f}".replace(",", " ").replace(".", ",")

DEFAULTS = dict(H=2.68, gladz_share=0.20, tv_price=180.0, demolition_id=50450, wall_colour_id=50514)

def build(H=2.68, gladz_share=0.20, tv_price=180.0, demolition_id=50450, wall_colour_id=50514):
    A_H = f"wysokość {pl(H)} m (stan deweloperski, Wiedza firmowa) — rzut i układ nie podają wysokości pomieszczeń"

    # Printed m² (developer rzut). Sides read off the rzut at ~56 px/m; see measurement.md.
    kuchnia, salon, hol, lazienka0, pokoj0 = 10.90, 20.04, 13.45, 4.42, 13.39
    # Łazienka grows into the pokój: the old 1,85 mb wall goes (green), the new L-shaped wall (blue) stands
    # ~0,5 m further, with a 0,5 m return by the pokój door.
    BATH_EXT = 0.5
    bath_w, bath_l = 1.61, 2.74 + BATH_EXT
    A_bath = bath_w * bath_l
    P_bath = 2 * (bath_w + bath_l)
    A_pokoj = pokoj0 - 1.85 * BATH_EXT
    A_BATH = (f"łazienka powiększona o ok. {pl(BATH_EXT, 1)} m kosztem pokoju (niebieska ściana na rzucie, bez wymiaru) "
              f"→ {pl(bath_w)} × {pl(bath_l)} = {pl(A_bath)} m², obwód {pl(P_bath)} mb")
    M_BATH = "dokładne położenie nowej ściany łazienki — rzut zaznacza ją kreską bez wymiaru (projekt wykonawczy za ok. 2 tyg.)"

    # Demolition (green on the rzut): kuchnia/salon wall 4,85 + its foot by the hol 0,80, ścianka przy kuchni 0,61,
    # łazienka/pokój wall 1,85.
    demo_runs = [4.85, 0.80, 0.61, 1.85]
    demo_mb = sum(demo_runs)
    demo_m2 = demo_mb * H
    A_DEMO = ["ściany do wyburzenia z rzutu (zielone): kuchnia/salon 4,85 + jej stopka przy holu 0,80 + ścianka przy kuchni 0,61 "
              f"+ łazienka/pokój 1,85 = {pl(demo_mb)} mb × wysokość", A_H]

    # Open space after demolition: the salon + kuchnia walls that remain, minus the hol passage.
    P_open, P_hol, P_pokoj = 20.9, 18.15, 14.7
    A_PERIM = ("obwody z rzutu: salon z kuchnią po wyburzeniu 20,9 mb (bez przejścia do holu), hol 18,15 mb (pas 6,45 × 2,00 "
               "+ odnoga 1,45 × 0,6), pokój 14,7 mb (3,31 × 4,04; wcięcie łazienki obwodu nie zmienia)")
    A_floor_dry = kuchnia + salon + hol + A_pokoj + 0.65   # + footprints of the demolished walls
    A_ceil = A_floor_dry

    # New walls (blue): the L of the łazienka 1,85 + 0,5 return, and the boczna ścianka in the hol ~0,95 mb.
    bath_wall_mb, side_wall_mb = 1.85 + BATH_EXT, 0.95
    gk_m2 = (bath_wall_mb + side_wall_mb) * H
    A_GK = [f"nowa ściana łazienki w kształcie L {pl(bath_wall_mb)} mb (1,85 + powrót {pl(BATH_EXT, 1)} przy drzwiach pokoju) "
            f"i boczna ścianka w holu ok. {pl(side_wall_mb)} mb (rzut, bez wymiaru) × wysokość",
            "GK z wełną, niski stopień skomplikowania — rodzaj ściany nie jest opisany", A_H]

    # Openings (architect's layout: hp 58 / ho 168 for windows, ho 226 for the balcony door; widths from the rzut).
    windows = [(1.10, 1.68), (1.60, 1.68)]
    balcony = (2.00, 2.26)
    openings = sum(w * h for w, h in windows) + balcony[0] * balcony[1]
    A_OPEN = ("okna kuchnia 1,10 × 1,68 i pokój 1,60 × 1,68, drzwi balkonowe 2,00 × 2,26 (szerokości z rzutu, wysokości z układu "
              f"architekta) — odliczone, razem {pl(openings)} m²; drzwi wewnętrzne nieodliczone")

    side_faces = 2 * side_wall_mb * H
    tv_wall = 4.2 * H * 2 / 3
    A_TV = f"ściana TV w salonie ok. 4,2 mb, gres na ok. 2/3 jej powierzchni (brief) → {pl(tv_wall)} m²"
    walls = (P_open + P_hol + P_pokoj) * H - openings + side_faces - tv_wall
    szafa_wall = 4.95 * H
    kitchen_units = 3.5 * H
    A_SZAFA = "ściana pod szafę w holu 4,95 mb na pełną wysokość — bez gładzi i malowania (szafa na wymiar zasłania)"
    A_KITCHEN = "zabudowa kuchni ok. 3,5 mb wzdłuż ściany z szachtem — ściana za nią bez gładzi (Wiedza firmowa)"
    painted_walls = walls - szafa_wall
    gk_faces = bath_wall_mb * H + side_faces          # the łazienka wall's other face is tiled
    plastered = walls - szafa_wall - kitchen_units - bath_wall_mb * H
    gladz = gk_faces + gladz_share * plastered
    A_GLADZ = [f"gładź na nowych ścianach GK ({pl(gk_faces)} m²) + miejscowo na {round(gladz_share * 100)} % pozostałych ścian, "
               "w tym miejsca po bruzdach (brief: „miejscowe gładzenie jeżeli konieczne”)", A_SZAFA, A_KITCHEN, A_H, A_PERIM, A_OPEN]
    M_TYNK = "stan tynków dewelopera — ile ścian naprawdę wymaga gładzi"

    # Electrical points named in the brief (management-side counts in measurement.md).
    el_points = 3 + 4 + 12 + 4 + 1 + 4       # hol, salon, kuchnia, sypialnia, AC, new switches
    el_lights = 17
    bath_lights, bath_points = 5, 3
    bruzdy_el = (el_points + el_lights + bath_lights + bath_points) * 2.5
    A_EL = ("punkty z briefu: hol 3 (gniazdo w 1. module szafy, pralka, suszarka), salon 4 (TV 2, strefa biurowa 2), "
            "kuchnia 12 (wyspa 2 + indukcja, strefa robocza 3, spiżarka 2, piekarnik, zmywarka, lodówka, okap), "
            "sypialnia 4 (TV 2, przy łóżku 2), klimatyzacja 1, nowe włączniki 4")
    A_LIGHTS = ("oświetlenie: hol 3 oprawy + LED w szafie, salon 2 szyny + kinkiet + LED w maskownicy, "
                "kuchnia nad wyspą + sufit + LED pod szafkami, sypialnia 2 lampy przy łóżku + sufit + LED za wezgłowiem, "
                "w maskownicy i za komodą = 17 punktów")
    M_DEV_EL = "co z elektryki zrobił deweloper (rozmieszczenie punktów, czy osprzęt jest zamontowany)"

    # Łazienka tiles: gres to the ceiling on all walls, floor everywhere (wanna wolnostojąca).
    door_bath = 0.80 * 2.05
    blat_top = 1.2 * 0.5
    wall_tiles = P_bath * H - door_bath + blat_top
    floor_tiles = A_bath
    all_tiles = wall_tiles + floor_tiles
    A_TILES = ("gres na wszystkich ścianach łazienki do sufitu i na całej podłodze (wanna wolnostojąca), drzwi 0,80 × 2,05 odliczone, "
               "plus wierzch blatu 1,2 × 0,5")
    floor_heat = A_bath - 1.7 * 0.8

    winyl = A_floor_dry - side_wall_mb * 0.1
    listwy = P_open + P_hol + P_pokoj + 2 * side_wall_mb - 3.5 - 4.95 - 2.0 - 0.9 - 5 * 0.8
    A_LISTWY = ("obwody bez zabudowy kuchni 3,5, szafy w holu 4,95, drzwi balkonowych 2,0, wejściowych 0,9 "
                "i 5 przejść drzwiowych × 0,8")

    def r(i, qty, assumptions=(), missing=()):
        return (i, qty, list(assumptions), list(missing))

    pick = [
        # Prace dodatkowe
        r(50402, 1, ["ryczałt dla małego mieszkania (Wiedza firmowa), 4. piętro z windą (brief)"]),
        r(50405, 4, [f"gruz z ok. {pl(demo_m2 * 0.12, 1)} m³ wyburzeń (ściany ok. 12 cm) → 3 big bagi + 1 na odpady z wykończenia"]),
        # Klimatyzacja — salon
        r(50410, 1, ["jednostka w salonie, agregat na balkonie (brief)"], ["model jednostki — cena indywidualna"]),
        r(50411, 1),
        r(50415, 1, ["jedno przebicie na balkon"], ["z czego jest ściana zewnętrzna — przy żelbecie przebicie 600 zł"]),
        r(50417, 4, ["jednostka na ścianie przy drzwiach balkonowych — ok. 4 mb rur do agregatu"], ["miejsce jednostki w salonie"]),
        r(50408, 3, ["rury w bruździe ok. 3 mb, skropliny grawitacyjnie na balkon (bez syfonu)"]),
        r(50414, 3, ["= bruzdy pod rury"]),
        r(50419, 3, ["= bruzdy pod rury"]),
        r(50418, 1, ["agregat na wspornikach na balkonie"]),
        # Wyburzenia, demontaże, zabezpieczenia
        r(50454, 62.2, ["zabezpieczenia = m² podłogi całego mieszkania (Wiedza firmowa): suma metraży z rzutu 62,20 m²"]),
        r(demolition_id, demo_m2, A_DEMO + ["ściany działowe do 12 cm z materiału miękkiego"],
          ["grubość i materiał wyburzanych ścian — przy żelbecie 300 zł/m²"]),
        r(50425, 1, ["grzejnik łazienkowy do demontażu i ponownego montażu (brief)"]),
        r(50420, 4, ["≈ 2 mb na łazienkę (Wiedza firmowa) + ok. 2 mb do pralki w szafie w holu (brief)"]),
        r(50422, bruzdy_el, [f"≈ 2,5 mb bruzdy na punkt (Wiedza firmowa) × {el_points + el_lights + bath_lights + bath_points} punktów",
                             A_EL, A_LIGHTS], [M_DEV_EL]),
        # Podłogi
        r(50491, demo_mb, ["= długości wyburzonych ścian"]),
        r(50463, winyl, ["= powierzchnia winylu"]),
        r(50465, winyl, [f"winyl jodełka klejony w salonie, kuchni, holu i sypialni (brief) — metraże z rzutu + ok. 0,65 m² po "
                         f"wyburzonych ścianach, pokój bez {pl(1.85 * BATH_EXT)} m² przeniesionych do łazienki",
                         "klejony, nie pływający — jodełka w briefie bez sposobu montażu"],
          ["winyl klejony czy pływający (pływający 90 zł/m²)"]),
        r(50483, 0.8, ["styk winyl / gres w drzwiach łazienki bez listwy — drzwi ukryte"]),
        # Ściany i sufity bez łazienek
        r(50522, gk_m2, A_GK, [M_BATH]),
        r(50536, 15.0, ["taśmy na stykach nowych ścian GK z murem i sufitem: ściana łazienki od strony pokoju ok. 7,7 mb, "
                        "boczna ścianka obustronnie ok. 7,3 mb"]),
        r(50542, 4 * H + 2.68, ["nowe narożniki: wolny koniec bocznej ścianki 2, koniec ściany po wyburzeniu 2, załamanie L ściany łazienki 1"
                                " — glify okien wykonał deweloper", A_H]),
        r(50524, 2.0, ["lustro na nowej ścianie w sypialni ok. 1,0 × 2,0 m — wzmocnienie stelaża GK (brief: przygotowanie pod lustro)"],
          ["wymiar i waga lustra"]),
        r(50539, demo_mb + 3 * H, ["poprawka po wyburzeniach: pas na suficie = długość ścian " + pl(demo_mb) +
                                   " mb + 3 styki ze ścianami pozostającymi × wysokość", A_H]),
        r(50540, 4.04 * H / 3, ["uskok ok. 1 cm na ok. 1/3 jednej ściany sypialni (brief) — ściana 4,04 mb"],
          ["która ściana sypialni i jaka powierzchnia uskoku"]),
        r(50529, bruzdy_el, ["= bruzdy elektryczne"]),
        r(50534, painted_walls + A_ceil, ["ściany i sufity do malowania — tynk dewelopera bez pełnej gładzi", A_SZAFA, A_H, A_PERIM, A_OPEN]),
        r(50500, gladz, A_GLADZ, [M_TYNK]),
        r(50505, gladz, ["jak gładź"]),
        r(50506, painted_walls - gladz + A_ceil, ["ściany i sufity bez gładzi — gruntowanie przed malowaniem", A_SZAFA]),
        r(50503, painted_walls + A_ceil, ["ściany i sufity do malowania", A_SZAFA, A_TV]),
        r(wall_colour_id, painted_walls, ["ściany w kolorze wg projektu (brief: „malowanie wg projektu”)", A_SZAFA, A_TV, A_H, A_PERIM, A_OPEN],
          ["kolory ścian z projektu wykonawczego"]),
        r(50508, A_ceil, ["sufity na biało = metraże pomieszczeń bez łazienki", A_BATH]),
        r(50495, P_open + P_hol + P_pokoj + 2 * side_wall_mb, ["styk ściana/sufit = obwody pomieszczeń + boczna ścianka", A_PERIM]),
        r(50515, 4.16 + 3.31, ["karnisze za maskownicą w salonie 4,16 mb i w sypialni 3,31 mb — na całą ścianę okienną"]),
        r(50517, 4.16 + 3.31, ["maskownica/listwa przed zasłonami z LED w salonie i w sypialni (brief) = długość karniszy"],
          ["maskownica z listwy sztukateryjnej czy z GK"]),
        # Łazienka
        r(50546, 13, ["punkt = zimna + ciepła + kanalizacja (Wiedza firmowa): umywalka 3, prysznic 3, wanna 3, WC 2, pralka w holu 2",
                      "wszystkie punkty łazienki przenoszone — zmienia się układ i ściana"]),
        r(50620, 1, ["przejście instalacji do pralki w szafie w holu przez ścianę łazienki (brief: ok. 2 m)"]),
        r(50569, 1),
        r(50583, 1),
        r(50592, 1),
        r(50580, 1, ["walk-in z odpływem liniowym (brief), spadek jednokierunkowy"]),
        r(50586, 1, ["szyba bezramowa (brief)"]),
        r(50623, 1, ["przedścianka pod prysznicem z 2 półkami — wnęka z półkami i LED na wizualizacji"], ["liczba półek w projekcie"]),
        r(50552, all_tiles - blat_top + A_bath, ["dwukrotne gruntowanie = podłoga + sufit + ściany (Wiedza firmowa)", A_BATH, A_TILES], [M_BATH]),
        r(50613, wall_tiles, ["gres średni format (brief)", A_BATH, A_TILES, A_H], [M_BATH]),
        r(50607, floor_tiles, ["gres średni format (brief)", A_BATH], [M_BATH]),
        r(50596, all_tiles, ["folia w płynie = suma płytek (Wiedza firmowa)", A_BATH, A_TILES], [M_BATH]),
        r(50556, all_tiles, ["fugowanie = suma płytek (Wiedza firmowa)", A_BATH, A_TILES], [M_BATH]),
        r(50619, P_bath + 2 * 2.0, ["obwód podłogi łazienki + 2 narożniki strefy prysznica po 2,0 m (Wiedza firmowa)", A_BATH]),
        r(50598, 25, ["20–30 mb na łazienkę (Wiedza firmowa)"]),
        r(50615, 2 * 2.4 + 1.2, ["2 półki we wnęce prysznica ok. 0,9 × 0,3 (dno, góra, boki = 2,4 mb każda) + front blatu 1,2 mb"]),
        r(50600, 5.1, ["krawędzie 45°: front blatu 1,2, góra zabudowy WC 1,2, krawędź przedścianki prysznica 2,7"],
          ["narożniki zewnętrzne i zabudowy w projekcie wykonawczym"]),
        r(50617, 20, ["otwory wg Wiedzy firmowej: WC 5, umywalka podtynkowa 3, prysznic podtynkowy 3, wanna — bateria podtynkowa 2 + "
                      "odpływ 1, grzejnik 2, przy lustrze 2 gniazdka + zasilanie lustra 1, termostat ogrzewania 1"]),
        r(50472, floor_heat, [f"mata pod płytkami na podłodze bez miejsca pod wanną 1,7 × 0,8 → {pl(floor_heat)} m²", A_BATH]),
        r(50599, 1, ["sufit podwieszany z oświetleniem w łazience (brief)"]),
        r(50559, A_bath, ["ściany w płytkach do sufitu — maluje się tylko sufit", A_BATH]),
        r(50547, P_bath, ["styk płytki/sufit = obwód łazienki", A_BATH]),
        r(50562, 2, ["baterie podtynkowe do prysznica i do wanny (brief: wszystkie baterie podtynkowe)"]),
        r(50550, 2, ["jak baterie podtynkowe prysznica i wanny"]),
        r(50564, 1),
        r(50549, 1),
        r(50589, 1, ["wanna wolnostojąca (owalna na układzie architekta)"]),
        r(50587, 1, ["umywalka nablatowa na blacie (wizualizacja)"]),
        r(50585, 1),
        r(50572, 1, ["ponowny montaż zdemontowanego grzejnika (brief)"]),
        r(50626, bath_lights, ["sufit 2 oprawy, LED we wnęce, LED pod blatem, lustro z LED"]),
        r(50627, bath_points, ["2 gniazdka przy lustrze (brief) + termostat ogrzewania podłogowego"]),
        r(50570, 2, ["2 gniazdka przy lustrze (brief)"]),
        r(50573, 1.8 + 1.2, ["LED we wnęce 2 × 0,9 + pod blatem 1,2 mb"]),
        r(50574, 1),
        r(50576, 2, ["2 oprawy w suficie (wizualizacja)"]),
        r(50578, 1),
        r(50560, 3, ["3 akcesoria"], ["ile akcesoriów"]),
        r(50594, 1, ["pralka w szafie w holu (brief)"]),
        r(50595, 1, ["suszarka w szafie w holu (brief)"]),
        # Kuchnia
        r(50632, 1, ["lodówka w zabudowie"], ["lista AGD z projektu kuchni"]),
        r(50633, 1), r(50636, 1),
        r(50637, 1, ["zlew zostaje w miejscu przyłączy dewelopera — otwór w blacie robi stolarz"], ["położenie zlewu w projekcie kuchni"]),
        r(50639, 1, ["indukcja w wyspie (brief)"]),
        r(50640, 1), r(50641, 1),
        r(50634, 3.0, ["LED pod szafkami wiszącymi ok. 3,0 mb"], ["długość szafek wiszących"]),
        # Montaż stolarki
        r(50656, 2, ["drzwi ukryte do sypialni i łazienki (brief), kolor kaszmir"], ["czy drzwi salon/hol zostają, czy przejście bez drzwi"]),
        # Instalacja elektryczna
        r(50703, el_points, [A_EL], [M_DEV_EL]),
        r(50701, el_lights, [A_LIGHTS], [M_DEV_EL]),
        r(50675, el_points, ["osprzęt tylko do nowych punktów"], [M_DEV_EL]),
        r(50685, 8, ["hol 3, kuchnia nad wyspą 1 i sufit 1, sypialnia przy łóżku 2 i sufit 1"]),
        r(50679, 1, ["kinkiet w salonie (brief)"]),
        r(50688, 8.0, ["2 rzędy szynoprzewodów natynkowych w salonie po ok. 4,0 mb (wizualizacja)"]),
        r(50689, 4.16 + 3.31 + 1.8 + 1.8 + 4.95, ["taśmy LED: maskownice salon 4,16 i sypialnia 3,31, za wezgłowiem 1,8, za komodą 1,8, "
                                                 "w szafie w holu 4,95 mb"], ["długości LED z projektu wykonawczego"]),
        r(50690, 6, ["po jednym na obwód LED: maskownica salon, maskownica sypialnia, wezgłowie, komoda, szafa, kuchnia"]),
        r(50691, 2, ["TV 75\" w salonie i 65\" w sypialni (brief)"]),
        r(50674, 2, ["gniazdo TV/internet przy obu telewizorach"]),
        r(50677, 1, ["ukryte kable TV w salonie (brief), ściana działowa"], ["z czego jest ściana TV — przy żelbecie 1 000 zł"]),
        r(50683, 1),
        r(50673, 1, ["termostat ogrzewania podłogowego w łazience"]),
        r(50697, 3, ["nowe obwody: ogrzewanie podłogowe, klimatyzacja, suszarka"], [M_DEV_EL]),
        # Wod-kan + c.o.
        r(50709, 2, ["grzejnik łazienkowy w nowym miejscu: zasilanie + powrót"], ["czy grzejnik wraca w to samo miejsce"]),
    ]

    S_EXTRA, S_FLOOR, S_WALLS = rows[50402]['section'], rows[50463]['section'], rows[50500]['section']
    S_BATH = rows[50546]['section']
    added = [
        (S_EXTRA, "Sprzątanie pomieszczeń po remoncie, rozklejanie zabezpieczeń", "kpl", 0, 1, [], [NEW]),
        (S_FLOOR, "Montaż listew przypodłogowych podtynkowych (ściana „wisząca”) — osadzenie profilu przed wykończeniem ścian", "mb", 0,
         listwy, [A_LISTWY, A_PERIM],
         [NEW + f" — najbliżej: Montaż listew przypodłogowych metalowych 200 zł/mb (≈ {pl(listwy * 200, 0)} zł)", "system listew z projektu"]),
        (S_WALLS, "Układanie glazury na ścianie format standard od 30x30 do 120x60", "m²", tv_price, tv_wall,
         [A_TV, "cena z katalogu (Łazienka) — płytki standardowego formatu"], ["format gresu na ścianie TV — płyty wielkoformatowe 550 zł/m²"]),
        (S_FLOOR, rows[50462]['description'], rows[50462]['unit'], rows[50462]['clientPrice'], tv_wall, ["= gres na ścianie TV", A_TV], []),
        (S_BATH, "Montaż blatu do umywalki minimalna metraż 1mb.", "mb", 250, 1.2,
         ["blat pod umywalkę ok. 1,2 mb z płyty wykończonej gresem (brief) — cena z katalogu", "gres na blacie liczony w glazurze ścian i glifach"],
         ["długość blatu"]),
    ]
    # Optional sypialnia unit: its own sekcja keeps the option out of the main total in the editor.
    A_OPT = "opcja z briefu: druga jednostka w sypialni, rury do agregatu na balkonie przez hol ok. 8 mb"
    for i, q, a in [(50410, 1, [A_OPT]), (50411, 1, [A_OPT]), (50415, 1, [A_OPT]), (50417, 8, [A_OPT]),
                    (50408, 8, [A_OPT, "rury w bruździe w ścianach z materiału miękkiego"]),
                    (50414, 8, ["= bruzdy pod rury"]), (50419, 8, ["= bruzdy pod rury"])]:
        p = rows[i]
        m = ["model jednostki — cena indywidualna"] if i == 50410 else ["trasa rur z sypialni do agregatu"] if i == 50417 else []
        added.append((S_AC_OPT, p['description'], p['unit'], p['clientPrice'], q, a, m))
    added.append((S_AC_OPT, "Wykonanie punktu elektrycznego", "szt", 120, 1, [A_OPT, "zasilanie jednostki — cena z katalogu (Klimatyzacja)"], []))

    out, by_sec = [], {}
    def add(section, description, unit, price, qty, assumptions, missing):
        qty = round(qty + 1e-9, 2)
        if qty <= 0: return
        row = dict(section=section, description=description, qty=qty, unit=unit, clientPrice=float(price))
        if missing: row['missingData'] = '\n'.join(missing)
        if assumptions: row['assumptions'] = '\n'.join(assumptions)
        out.append(row)
        by_sec[section] = by_sec.get(section, 0) + qty * price

    for i, q, a, m in pick:
        p = rows[i]
        add(p['section'], p['description'], p['unit'], p['clientPrice'], q, a, m)
    for s, d, u, p, q, a, m in added: add(s, d, u, p, q, a, m)
    keys = [(o['section'], o['description']) for o in out]
    assert len(keys) == len(set(keys)), "duplicate section+description — the loader would merge them"
    geo = dict(demo_m2=demo_m2, gk_m2=gk_m2, walls=walls, painted_walls=painted_walls, gladz=gladz, plastered=plastered,
               ceilings=A_ceil, winyl=winyl, wall_tiles=wall_tiles, all_tiles=all_tiles, A_bath=A_bath, listwy=listwy,
               bruzdy_el=bruzdy_el, tv_wall=tv_wall, openings=openings)
    return out, by_sec, geo

if __name__ == '__main__':
    out, by_sec, geo = build(**DEFAULTS)
    os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
    with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    total = sum(by_sec.values())
    main = total - by_sec.get(S_AC_OPT, 0)
    print(f"rows {len(out)}  razem {total:,.2f}  bez opcji {main:,.2f}  assumptions {sum('assumptions' in r for r in out)}  "
          f"missingData {sum('missingData' in r for r in out)}  bez ceny {sum(r['clientPrice'] == 0 for r in out)}")
    for s, v in sorted(by_sec.items(), key=lambda kv: -kv[1]): print(f"  {s}: {v:,.2f}")
    print("geometry", {k: round(v, 2) for k, v in geo.items()})
    print("unpriced", [(r['section'], r['description'][:50], r['qty']) for r in out if r['clientPrice'] == 0])
    variants = dict(H_plus_10cm=dict(H=2.78), gladz_full=dict(gladz_share=1.0), gladz_none=dict(gladz_share=0.0),
                    tv_large_format=dict(tv_price=550.0), demolition_concrete=dict(demolition_id=50451),
                    walls_white=dict(wall_colour_id=50513))
    for name, v in variants.items():
        t = sum(build(**{**DEFAULTS, **v})[1].values())
        print(f"  sensitivity {name}: {t - total:+,.2f}")
