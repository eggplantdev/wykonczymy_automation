# Builds measure/ai-draft-load.json for production #199 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). Assumptions go into the row's `assumptions`, unknowns into `missingData`.
# Input: one photo of the original rzut (printed m² per room, inner dimensions handwritten on it) and five
# photos of the current state (łazienka, sypialnia, salon, kuchnia, salon → kuchnia). Measurement: measurement.md.
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

def pl(x): return f"{x:.2f}".replace(".", ",")

# Height: nothing printed for the rooms. The stairs give the storey (2 × 9 × 15,6 cm = 2,81 m), minus a slab
# and floor layers ≈ 2,55–2,60 m clear — so the Manual's rynek-wtórny 2,60 m.
H = 2.60

# Inner dimensions handwritten on the rzut (the printed m² in brackets).
syp = (3.77, 2.78)                                   # sypialnia (10,7)
laz = (2.41, 1.78)                                   # łazienka (4,3)
hol = (3.31, 1.84)                                   # przedpokój (6,4)
salon = (3.86, 4.39)                                 # pokój 17,4, minus two wall recesses 34 × 35 and 45 × 75
k_up = (2.28, 2.53)                                  # kitchen zone, north part (pink „pokój” on the photos), minus vent 59 × 25
k_down = (2.26, 2.08)                                # kitchen zone, south part with the window (kitchen now)
WALL_LEN = 2.28                                      # the ścianka between them, ending in the pillar on the photo
A_syp = syp[0] * syp[1]
A_laz = laz[0] * laz[1]
A_hol = hol[0] * hol[1]
A_salon = salon[0] * salon[1] - 0.34 * 0.35 - 0.45 * 0.75
A_kup = k_up[0] * k_up[1] - 0.59 * 0.25
A_kdown = k_down[0] * k_down[1]
A_strip = WALL_LEN * 0.12
A_dry = A_syp + A_hol + A_salon + A_kup + A_kdown + A_strip     # every floor/ceiling outside the łazienka
A_flat = A_dry + A_laz

def perim(r): return 2 * (r[0] + r[1])
k_zone = (2.28, k_up[1] + 0.12 + k_down[1])          # kitchen zone once the ścianka is gone
P_rooms = perim(syp) + perim(salon) + perim(hol) + perim(k_zone)
OPEN_SIDE = salon[0]                                 # salon ↔ kitchen zone is already open (photo 5) — no wall on either face
P_walls = P_rooms - 2 * OPEN_SIDE

openings = {
    'okno sypialnia 1,80 × 1,50': 1.80 * 1.50,
    'okno + drzwi balkonowe salon (270)': 1.80 * 1.50 + 0.90 * 2.20,
    'okno kuchnia 1,20 × 1,50': 1.20 * 1.50,
    'drzwi wejściowe (1 strona)': 0.90 * 2.05,
    'drzwi sypialnia (2 strony)': 2 * 0.80 * 2.05,
    'drzwi łazienka (1 strona)': 0.80 * 2.05,
    'drzwi przedpokój–salon (2 strony)': 2 * 0.80 * 2.05,
    'drzwi przedpokój–kuchnia (2 strony)': 2 * 0.80 * 2.05,
}
walls = P_walls * H - sum(openings.values())
paint = walls + A_dry

# Windows we finish around (the window firm replaces them): sypialnia 180, salon okno + drzwi balkonowe 270.
glify = (1.50 + 1.50 + 1.80) + (1.50 + 2.70 + 2.20 + 0.70)
sills = 1.80 + 1.80 + 2 * 0.10

pts_sockets = 12      # kitchen: 3 nadblatowe, lodówka, zmywarka, piekarnik, okap, indukcja; RTV 2; „nowe punkty” 2
pts_light = 4         # kitchen zone ceiling 2, LED pod szafkami 1, salon 1
bruzdy_el = 2 * (pts_sockets + pts_light)

floor_new = A_dry
panels_old = A_syp + A_hol + A_salon + A_kup         # the photos show laminate everywhere but the kitchen
skirting = round(P_rooms * 0.70)                     # katalog: obwód bez łazienki minus 20–30% (zabudowy, drzwi)
skirting_old = round((perim(syp) + perim(salon) + perim(hol) + 2 * k_up[1] + k_up[0]) * 0.75)
wylewka = A_kdown + A_strip

A_PLAN = "wymiary wewnętrzne dopisane ręcznie na rzucie (zdjęcie rzutu), m² z rzutu jako kontrola"
A_H = "wysokość 2,60 m — rzut jej nie podaje (Manual: rynek wtórny); schody dają kondygnację 2,81 m (18 × 15,6), czyli w świetle ok. 2,55–2,60"

draft = []
def add(i, qty, assumptions=None, missing=None):
    r = dict(rows[i]); r['qty'] = round(qty, 2)
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

def add_new(section, description, unit, price, qty, assumptions, missing=None):
    r = dict(section=section, description=description, unit=unit, clientPrice=float(price), qty=round(qty, 2),
             assumptions=assumptions)
    if missing: r['missingData'] = missing
    draft.append(r)

# — Prace dodatkowe
add(60296, 1, "małe mieszkanie w całości, 1. piętro bez windy, Piastów (mail)",
    "cena j.m. z szablonu 1500 zł; katalog: rynek wtórny ok. 2000 zł, poza Warszawą wyżej — do podniesienia ręcznie")
add(60300, 1, "rynek wtórny z wyburzeniem → kontener (Manual); 1. piętro → stawka 1500 zł (Manual: parter i pierwsze piętro). Gruz ze ścianki, wanna, stara kuchnia, panele, płytki z kuchni",
    "czy jest miejsce na kontener pod blokiem")

# — Wyburzenia, demontaże, zabezpieczenia
add(60314, A_flat, f"m² podłogi całego mieszkania ({pl(A_flat)} m², mail: 48 m²). " + A_PLAN,
    "czy mieszkanie będzie zamieszkane w trakcie (stawka 45 zł)")
add(60320, 1, "wanna z obudową, stara zabudowa kuchenna z blatem i zlewem, płyta gazowa, okap (mail, zdjęcia)",
    "cena: szablon 1000 zł, katalog 800–1500 zł — łazienka + cała kuchnia to raczej górna granica")
add(60344, WALL_LEN * H, f"„wyburzenie ścianki kuchnia–salon”: na zdjęciu z salonu salon jest już otwarty na kuchnię, a strefę kuchenną dzieli ścianka kończąca się słupkiem — {pl(WALL_LEN)} mb × {pl(H)} m. Na rzucie z 2001 r. jej nie ma (dorysowana ręcznie), więc zakładam materiał miękki do 12 cm",
    "którą ściankę klient ma na myśli i z czego jest — jeśli GK: 50 zł/m² (−0,4 tys. zł); jeśli to pełna ściana salon–kuchnia 3,86 mb: +4,1 m² (+0,5 tys. zł)")
add(60329, panels_old, f"panele na zdjęciach w sypialni, salonie, przedpokoju i różowej części kuchni: {pl(A_syp)} + {pl(A_salon)} + {pl(A_hol)} + {pl(A_kup)} m²",
    "co leży pod panelami — rzut podaje mozaikę; jeśli jest luźna, do skucia")
add(60325, skirting_old, "obwód pomieszczeń z panelami minus ok. 25% (drzwi, otwory)")
add(60337, A_kdown, f"płytki na podłodze w kuchni (zdjęcie kuchni): {pl(k_down[0])} × {pl(k_down[1])}; ściany kuchni są malowane, nie w płytkach",
    "czy płytki w kuchni zostają pod nową podłogę")
add(60330, sills, "parapety wewnętrzne pod wymienianymi oknami: sypialnia 1,80 + salon 1,80 + zakłady",
    "czy parapety wymienia firma okienna")
add(60318, bruzdy_el, f"2 mb na punkt (katalog): {pts_sockets} gniazd + {pts_light} punktów świetlnych")
add(60316, 2, "katalog: ok. 2 mb na łazienkę — przeróbki pod brodzik i baterię")

# — Podłogi
add(60381, floor_new, f"panele laminowane, układ prosty, wszędzie poza łazienką — „wymiana podłogi” w sypialni, salonie, kuchni i przedpokoju (mail); dziś laminat. Kuchnia też w panelach, bo po wyburzeniu ścianki to jedna strefa z salonem: {pl(floor_new)} m²",
    "rodzaj podłogi: panele laminowane czy winyl klejony (winyl + wylewka na całość ≈ +2,5 tys. zł); w kuchni płytki zamiast paneli ≈ +0,6 tys. zł")
add(60353, wylewka, f"kuchnia po skuciu płytek {pl(A_kdown)} m² + pas po ściance {pl(A_strip)} m² — zrównanie z resztą pod panele")
add(60349, wylewka, "pod wylewkę samopoziomującą")
add(60350, WALL_LEN, "pas posadzki po wyburzonej ściance")
add(60357, skirting, f"katalog: obwód bez łazienki ({pl(P_rooms)} mb) minus 30% na zabudowę kuchenną, drzwi i otwory — lepiej niedoszacować",
    "listwy MDF czy inne")
add(60355, skirting, "katalog: tyle samo co listew")
add(60360, 0.80, "przejście panele/płytki w drzwiach łazienki")

# — Ściany i sufity bez łazienek
add(60419, paint, f"„przygotowanie ścian” (mail): grunt i drobne poprawki, bez pełnej gładzi — ściany {pl(walls)} m² + sufity {pl(A_dry)} m². Ściany: obwody {pl(P_rooms)} mb minus otwarty bok salon–kuchnia 2 × {pl(OPEN_SIDE)} mb, × {pl(H)} m, minus okna i drzwi {pl(sum(openings.values()))} m². " + A_H,
    "czy ściany wymagają pełnej gładzi (rynek wtórny 85 zł/m² na ok. 141 m²: +12,0 tys. zł)")
add(60426, paint, "2× malowanie ścian i sufitów na biało: sypialnia (mail: ściany i sufit), salon, kuchnia, przedpokój — sufity też, bo malowanie po demontażu ścianki i zmianach elektrycznych",
    "kolor ścian — w kolorze 26 zł/m² zamiast 22 (+0,6 tys. zł); czy sufity w salonie, kuchni i przedpokoju też malujemy")
add(60424, walls, "wszystkie ściany są dziś w kolorze (szare, różowa, miętowa — zdjęcia) → warstwa przykrywająca przed białym",
    "jeśli nowy kolor jest ciemny, pozycja może wypaść")
add(60420, P_walls, "łączenia ścian z sufitem — obwód ścian bez otwartego boku salon–kuchnia")
add(60404, glify + 5.0, f"glify po wymianie okien: sypialnia {pl(1.50 + 1.50 + 1.80)} mb + salon okno z drzwiami balkonowymi {pl(1.50 + 2.70 + 2.20 + 0.70)} mb; poprawka po ściance ok. 5 mb (sufit + ściana)",
    "wymiana okien: czy firma okienna zostawia glify do obróbki (zwykle tak)")
add(60408, glify, "narożniki aluminiowe na glifach po wymianie okien")
add(60401, bruzdy_el + 2, "tynkowanie bruzd elektrycznych i wod-kan")
add(60402, bruzdy_el, "gładź po bruzdach elektrycznych — pełnej gładzi nie ma")

# — Łazienka
add(60496, 1, "„montaż kabiny z brodzikiem” w miejscu wanny (mail, zdjęcie łazienki)",
    "wymiar brodzika i kabiny; brodzik na nóżkach czy niski — przy niskim może dojść schodek (+1000 zł)")
add(60489, 1, "bateria natynkowa jak obecna przy wannie — mail nie mówi o podtynkowej",
    "bateria natynkowa czy podtynkowa (+650 zł + biały montaż)")
add(60435, 3, "„przeróbki hydrauliczne”: podniesienie zimnej i ciepłej pod baterię prysznicową + przesunięcie odpływu pod brodzik (katalog: liczymy końcowe punkty)")
add(60452, 1.5, "pas ściany pod starą wanną, dziś bez płytek — ok. 2,45 mb × 0,6 m — wyrównanie pod płytki")
add(60448, 2.5, "pas ściany + podłoga pod wanną, gdzie nie przykryje jej brodzik")
add(60457, 2.5, "„uszczelnienia” (mail): folia tylko na odsłoniętych powierzchniach w strefie prysznica — reszta łazienki bez remontu")
add(60459, 5, "styk brodzika ze ścianami i narożniki")
add(60473, 1.5, "uzupełnienie płytek ściennych pod linią starej wanny (ok. 2,45 mb × 0,6 m)",
    "czy klient ma zapas obecnych płytek (białe, fala) — jeśli nie, uzupełnienie nie będzie pasować")
add(60466, 0.5, "podłoga po wannie poza obrysem brodzika")
add(60480, 2.0, "fugowanie = wszystkie nowe płytki (Manual)")
add(60481, 6, "brodzik i kabina — reszta łazienki zostaje (Manual 20–30 mb dotyczy całej łazienki)")
add(60482, 2, "bateria natynkowa (katalog: 2 przy natynkowej)")

# — Kuchnia
add(60530, 3, "płyta indukcyjna, piekarnik, zmywarka w nowej zabudowie (zdjęcie: piekarnik i zmywarka w zabudowie)",
    "czy lodówka jest w zabudowie (+250 zł)")
add(60537, 1, "„instalacja pod płytę indukcyjną” (mail) — dziś płyta gazowa",
    "zakorkowanie gazu — gazownik z uprawnieniami, poza szablonem")
add(60538, 1)
add(60539, 1)
add(60536, 1, "nowy blat → wycięcie otworu pod zlew")
add(60531, 1)
add(60534, 1)
add_new('Kuchnia', 'Montaż blatu kuchennego laminowanego', 'mb', 200, 3.8,
        "katalog prac: „nowa zabudowa, blat” (mail); układ L jak dziś — ściana 2,26 + bok do okna ok. 1,5 mb",
        "blat laminowany czy kamienny (katalog 350 zł/mb); czy blat montuje firma meblowa")
add_new('Kuchnia', 'Montaż i skręcanie mebli', 'kpl', 0, 1,
        "katalog prac: „nowa zabudowa” (mail) — katalog nie ma stawki, cena indywidualna",
        "kto składa zabudowę kuchenną — firma meblowa czy my; cena do ustalenia")

# — Instalacja elektryczna i oświetleniowa
add(60556, pts_sockets, "kuchnia: 3 nadblatowe, lodówka, zmywarka, piekarnik, okap, płyta; RTV 2; „nowe punkty” ok. 2 (mail)",
    "liczba i miejsca nowych punktów — mail ich nie wymienia")
add(60554, pts_light, "nowy układ kuchni po wyburzeniu ścianki: 2 w strefie kuchennej, LED pod szafkami 1, salon 1")
add(60563, 35, "„montaż gniazdek i włączników” w pracach końcowych (mail): cały osprzęt po malowaniu, ok. 23 istniejące + 12 nowych",
    "czy osprzęt jest nowy, czy zakładamy stary")
add(60567, 1, "RTV (mail)")
add(60587, 1, "„sprawdzenie instalacji” + indukcja (katalog: przy indukcji minimum 18 modułów); budynek z 2001",
    "stan rozdzielni — jeśli wystarczy dołożyć bezpiecznik: 200 zł (−1,3 tys. zł)")
add(60562, 1, "przewód pod płytę indukcyjną z gniazdem — zakładam, że w mieszkaniu jest 3 fazy",
    "czy mieszkanie ma 3 fazy — jeśli nie, wniosek do operatora i przewód do rozdzielni: 1500 zł (+1,0 tys. zł); pomiary instalacji poza szablonem")
add(60574, 5, "lampy zdjęte do malowania wracają: sypialnia, salon, przedpokój, kuchnia, różowa część",
    "czy klient ma nowe lampy")
add(60581, 1, "okap w nowej zabudowie (dziś okap pod szafką)")

# — Wod-kan + c.o.
add(60596, 3, "„przyłącza” w kuchni (mail): zimna, ciepła, odpływ pod zlew i zmywarkę w nowej zabudowie",
    "czy zlew zostaje w tym samym miejscu — jeśli tak, przyłącza mogą być niepotrzebne (−750 zł)")

# — Montaż stolarki
add(60546, sills, "nowe parapety pod wymienionymi oknami",
    "czy parapety montuje firma okienna")
add(60550, sills)

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in sorted(by.items(), key=lambda kv: -kv[1]): print(f"{s:42} {v:12.2f}")
print(f"{len(draft)} rows, total {total:.2f}; flat {A_flat:.2f} (dry {A_dry:.2f}, łazienka {A_laz:.2f}), salon {A_salon:.2f}, "
      f"kuchnia {A_kup:.2f}+{A_kdown:.2f}, P_rooms {P_rooms:.2f}, P_walls {P_walls:.2f}, openings {sum(openings.values()):.2f}, "
      f"walls {walls:.2f}, paint {paint:.2f}, glify {glify:.2f}, sills {sills:.2f}, skirting {skirting}/{skirting_old}")
