# Builds measure/ai-draft-load.json for production #213 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). Assumptions go into the row's `assumptions`, unknowns into `missingData`.
# Inputs: the scope in Notatki (inputs/client-inquiry.md), four designer PDFs (plan + kłady with dimensions,
# heights printed) and four phone photos of the parter rooms and the basement WC. Four rooms, each its own
# sekcja (fill-case-prod renames „Łazienka” to the first and copies the template for the rest):
#   „Łazienka z prysznicem” (parter), „Łazienka z wanną” (parter), „Łazienka pralnia” (piwnica, has a shower,
#   so bathroom-type), „WC piwnica”. Rows of the four sekcje are matched against the szablon's „Łazienka”.
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
TEMPLATE_BATH = 'Łazienka'

# — Room 1: łazienka z prysznicem, parter (projekt „toaleta prysznic”, zdjęcie IMG_0426)
P1 = 'Łazienka z prysznicem'
r1 = (1.23, 2.18); H1 = 2.70
A1 = r1[0] * r1[1]
PER1 = 2 * (r1[0] + r1[1])
door1 = 0.81 * 2.046
win1 = (0.85, 1.35)
W1 = PER1 * H1 - door1 - win1[0] * win1[1]
GLIF1 = 2 * win1[0] + 2 * win1[1]
# — Room 2: łazienka z wanną, parter (projekt „wanna biała”, zdjęcia IMG_0424/0425)
P2 = 'Łazienka z wanną'
r2 = (2.04, 2.15); H2 = 2.70
notch2 = 0.268 * 0.65            # corner notch on the plan — leaves the perimeter unchanged
A2 = r2[0] * r2[1] - notch2
PER2 = 2 * (r2[0] + r2[1])
door2 = 0.80 * 2.05
win2 = (0.80, 1.20)
W2 = PER2 * H2 - door2 - win2[0] * win2[1]
TUB_FRONT = 1.60 * 0.48          # tiled bath front; the wall behind the bath below the rim stays in W2 instead of the bath's side
T2 = W2 + TUB_FRONT
GLIF2 = 2 * win2[0] + 2 * win2[1]
# — Room 3: pralnia, piwnica (projekt „pralnia”, bez zdjęcia)
P3 = 'Łazienka pralnia'
r3 = (2.025, 2.29); H3 = 0.91 + 1.251
A3 = r3[0] * r3[1]
PER3 = 2 * (r3[0] + r3[1])
door3 = 0.80 * 2.0
win3 = (0.78, 0.65)              # measured on kład A against the 2,025 wall; top at the ceiling
W3 = PER3 * H3 - door3 - win3[0] * win3[1]
GLIF3 = 2 * win3[1] + 2 * win3[0]
# — Room 4: WC piwnica (projekt „toaleta piwnica”, zdjęcie IMG_0427), L-shape
P4 = 'WC piwnica'
A4 = 0.915 * 1.28 + 0.765 * 1.01
PER4 = 6.41                      # outline of the L, measured on the rzut
H4 = 2.16
TILE_H4 = 1.20
W4_TILE = PER4 * TILE_H4 - 0.765 * TILE_H4             # below 1,20, minus the door's share
W4_PAINT = PER4 * (H4 - TILE_H4) - 0.765 * (2.046 - TILE_H4)
W4 = W4_TILE + W4_PAINT

CEILS = A1 + A2 + A3 + A4
ALL_BATHS = f"{P1} {pl(A1)}, {P2} {pl(A2)}, {P3} {pl(A3)}, {P4} {pl(A4)} m²"

A_DRAW = "wymiary i wysokość z projektu (rzut + kłady)"
A_RAW = "zdjęcia parteru: ściany z gołej cegły, nowe rury wod-kan i pętle ogrzewania podłogowego bez wylewki, stary tynk na suficie"
A_CEIL = "Notatki: „we wszystkich łazienkach zdjęcie tynku z sufitu i wyrównanie do kątów prostych”"

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

CEIL_TYNK = "Tynkowanie/wyrównywanie ścian lub sufitów na listwach tynkarskich do kilku cm grubości."

# — Prace dodatkowe
add(50402, 1, "1 kpl na cały remont: dom, cztery pomieszczenia (2 łazienki na parterze, pralnia i WC w piwnicy)",
    "cena j.m. z szablonu 1500 zł, katalog dla większego remontu na rynku wtórnym mówi ok. 2000 zł — do podniesienia ręcznie")
add(50406, 1, f"Manual: rynek wtórny z wyburzeniami → kontener, przy 4+ big bagach kontener; gruz: tynk z sufitów 4 pomieszczeń ({pl(CEILS)} m²) + skuwanie płytek w pralni; parter/piwnica → 1500 zł",
    "czy kontener zapewnia inwestor (np. na cały remont domu) — wtedy −1500 zł; jeśli w pralni nie ma płytek do skucia, wystarczą ok. 3 big bagi (1350 zł)")

# — Wyburzenia, demontaże, zabezpieczenia
add(50454, 30, "droga do łazienek po podłodze: hol i korytarz parteru, schody, korytarz piwnicy — ok. 30 m², szacunek agenta (projekty nie pokazują reszty domu)",
    "czy dom jest zamieszkany w trakcie (stawka 45 zł/m², +0,6 tys. zł) i jaka jest droga do łazienek")
add(50435, CEILS, f"{A_CEIL}: skucie tynku z sufitu w 4 pomieszczeniach — {ALL_BATHS}",
    "grubość i stan tynku na suficie (strop drewniany czy betonowy)")
add(50437, W3 + A3, f"{P3}: obecny brodzik 12 cm („brodzik obecnie ma 12 cm”) → pomieszczenie wykończone, zakładam stare płytki na ścianach ({pl(W3)}) i podłodze ({pl(A3)}) — brak zdjęcia pralni",
    "czy w pralni są płytki na ścianach i podłodze (brak zdjęcia) — bez skuwania ≈ −1,7 tys. zł razem ze szlifowaniem, i kontener może zejść do big bagów")
add(50440, W3, f"{P3}: ściany po skuciu płytek, przed tynkowaniem pod glazurę (Manual: szlifowanie po kleju idzie ze skuwaniem)",
    "jak skuwanie w pralni — zależy od tego, czy są płytki")
add(50432, 1, f"{P3}: obecny brodzik z kabiną, umywalka/zlew, pralka, grzejnik; {P4}: stara armatura i rury (zdjęcie IMG_0427); łazienki na parterze puste (zdjęcia)",
    "co dokładnie zostało w pralni (brak zdjęcia)")
add(50442, 2, f"stare ościeżnice w pralni i WC w piwnicy — projekt pokazuje nowe drzwi, a w pralni otwór do zmniejszenia",
    "czy drzwi w piwnicy są wymieniane")
add(50420, 6, f"nowe punkty wod-kan w piwnicy: {P3} ok. 2 mb (suszarka/druga pralka), {P4} ok. 4 mb (nowe podejścia pod WC podwieszane i umywalkę) — szacunek agenta",
    "materiał ścian w piwnicy (beton/żelbet: 150 zł/mb)")
add(50422, 34, "ok. 2 mb na punkt (katalog) × 17 punktów elektrycznych i oświetleniowych w 4 pomieszczeniach",
    "czy instalację elektryczną na parterze robi elektryk całego domu — wtedy bez bruzd i punktów na parterze (≈ −1,4 tys. zł)")

# — Podłogi (only the basement — the parter screed sits on the underfloor heating)
add(50494, A3 + A4, f"piwnica: {P3} {pl(A3)} po skuciu płytek + {P4} {pl(A4)} na surowym betonie (zdjęcie IMG_0427) — wyrównanie pod glazurę. Parter bez wylewki w tej wycenie: na pętlach ogrzewania podłogowego wylewkę zakładam robioną przez ekipę od wylewek razem z resztą domu",
    "czy wylewkę betonową na ogrzewaniu podłogowym w łazienkach na parterze robimy my — {0} m² × 80 zł ≈ +{1} zł".format(pl(A1 + A2), round((A1 + A2) * 80)))
add(50463, A3 + A4, "gruntowanie pod wylewkę samopoziomującą w piwnicy (katalog)")

# — Montaż stolarki
add(50664, 1, f"{P3}: notatka na projekcie „drzwi można zmniejszyć do 70 cm” (obecne 80 cm)",
    "czy zmniejszamy otwór w pralni (−200 zł, jeśli nie)")

# ——— Łazienka z prysznicem (parter)
S = P1
add(50569, 1, "stelaż WC podwieszanego (projekt, kład D)", section=S)
add(50583, 1, "zabudowa GK stelaża z półką na wys. 1,20 (projekt)", section=S)
add(50628, H1, f"zabudowa pionu kanalizacyjnego obok drzwi — pas 14 cm na całą wysokość (rzut, kład C; pion widać na zdjęciu IMG_0426), {pl(H1)} mb",
    "czy pion przy drzwiach jest zabudowany GK, czy obmurowany", section=S)
add(50580, 1, "prysznic bez brodzika z odpływem liniowym (rzut: strefa 0,92 × 1,23 przy oknie) — odpływ jednospadkowy",
    "koperta zamiast jednospadkowego (+300 zł); czy odpływ zmieści się w wylewce na ogrzewaniu podłogowym", section=S)
add(50586, 1, "ścianka szklana prysznica (kład A) — przyjęta jako szyba stała",
    "projekt rysuje drzwi przesuwne — montaż może być droższy niż szyba stała", section=S)
add(50552, W1 + 2 * A1, f"ściany {pl(W1)} + podłoga i sufit {pl(A1)} × 2 (katalog: dwukrotne gruntowanie ścian, sufitów i podłóg)", section=S)
add(50602, W1, A_RAW + f" (IMG_0426) — tynk pod glazurę na całej wysokości: obwód {pl(PER1)} mb × {pl(H1)} − drzwi {pl(door1)} − okno {pl(win1[0] * win1[1])}. " + A_DRAW, section=S)
add_new(S, CEIL_TYNK, "m²", 100, A1, f"{A_CEIL} — nowy tynk na suficie po skuciu, {pl(A1)} m²; praca z sekcji „Ściany i sufity bez łazienek”, wstawiona do łazienki (Manual: prace w łazience idą do sekcji łazienki)",
        "czy wystarczy tynk do 1 cm (60 zł/m²), jeśli strop jest równy")
add(50559, A1, f"sufit po nowym tynku: gładź + malowanie, {pl(A1)} m² — ściany w całości w płytkach", section=S)
add(50596, W1 + A1, f"folia w płynie na wszystkich ścianach i podłodze (Manual): {pl(W1)} + {pl(A1)}", section=S)
add(50619, 12, "ok. 15 mb na 4 m² (Manual) → mała łazienka 2,7 m², ok. 12 mb", section=S)
add(50613, W1, f"płytki do sufitu na wszystkich ścianach, Gl 59,8 × 119,8 → format standard (kłady A–D): {pl(W1)} m²", section=S)
add(50615, GLIF1, f"glify okna {pl(win1[0])} × {pl(win1[1])} w płytkach do sufitu (parapet + boki + nadproże) = {pl(GLIF1)} mb",
    "czy okno ma parapet z płytek czy konglomerat", section=S)
add(50607, A1, f"podłoga Gr 59,8 × 59,8 → format standard, {pl(A1)} m²", section=S)
add(50556, W1 + A1, "fugowanie = wszystkie płytki (Manual), format standard", "fuga cementowa czy epoksydowa (80 zł/m²)", section=S)
add(50598, 20, "Manual: 20–30 mb na łazienkę — dolna granica, łazienka 2,7 m²", section=S)
add(50617, 17, "WC 5 + prysznic natynkowy 2 + umywalka z baterią stojącą 3 + grzejnik 2 + puszki 2 + 2 punkty natynkowe + kratka 1 (Manual)", section=S)
add(50547, PER1, f"styk płytek z sufitem — obwód {pl(PER1)} mb", section=S)
add(50600, 4, "krawędzie półki nad stelażem WC i narożniki glifów okna — zaniżone (Manual: przy wątpliwościach nie zawyżaj)", section=S)
add(50563, 1, "kolumna prysznicowa natynkowa z termostatem (kład B)", section=S)
add(50587, 1, "umywalka na szafce (rzut, kład C); szafka podumywalkowa to praca stolarza", section=S)
add(50561, 1, "bateria stojąca na umywalce (kład C)", section=S)
add(50593, 2, "bateria stojąca → zawory kątowe pod umywalką (Manual)", section=S)
add(50585, 1, "syfon umywalki", section=S)
add(50592, 1, "WC podwieszane na stelażu (kład D)", section=S)
add(50572, 1, "grzejnik drabinkowy (kład A, C)", "grzejnik wodny czy elektryczny (elektryczny 200 zł)", section=S)
add(50577, 1, "szafka z lustrem nad umywalką (kład C) — montaż jak lustro", "czy szafkę lustrzaną montuje stolarz", section=S)
add(50560, 3, "wieszak na ręcznik i akcesoria — 3 szt. (szacunek agenta)", section=S)
add(50575, 1, "kratka wentylacyjna", section=S)
add(50626, 2, "projekt: „2 punkty natynkowe” (kład A)",
    "czy elektrykę na parterze robi elektryk całego domu", section=S)
add(50576, 2, "2 lampy na punktach natynkowych", section=S)
add(50627, 1, "gniazdko przy umywalce/szafce lustrzanej — szacunek agenta (projekt nie ma warstwy elektrycznej)", section=S)
add(50570, 2, "gniazdko + włącznik", section=S)
add(50581, 1, "drzwi 0,81 × 2,046 rysowane w projekcie (kład C)", "czy drzwi są w zakresie (dom w remoncie — może je montuje stolarz)", section=S)
add(50546, 0, "instalacja wod-kan na parterze: na zdjęciu IMG_0426 nowe rury i pion — zakładam, że podejścia są gotowe",
    MISSING + "czy podejścia pod prysznic, umywalkę i WC są już w miejscach z projektu (każdy punkt do przeniesienia 250 zł)", section=S)

# ——— Łazienka z wanną (parter)
S = P2
add(50546, 1, "Notatki: „przeniesienie kranu na wannie na środek” — 1 punkt (zasilanie baterii wannowej)",
    "czy przenosi się też odpływ wanny", section=S)
add(50591, 1, "wanna 1,60 z zabudową wys. 0,48, podcięcie z LED (kład) → zabudowa z rewizją i LED", section=S)
add(50552, W2 + 2 * A2, f"ściany {pl(W2)} + podłoga i sufit {pl(A2)} × 2", section=S)
add(50602, W2, A_RAW + f" (IMG_0424/0425) — tynk pod glazurę: obwód {pl(PER2)} mb × {pl(H2)} − drzwi {pl(door2)} − okno {pl(win2[0] * win2[1])}. " + A_DRAW, section=S)
add_new(S, CEIL_TYNK, "m²", 100, A2, f"{A_CEIL} — nowy tynk na suficie po skuciu, {pl(A2)} m² (2,04 × 2,15 minus wnęka 0,27 × 0,65); praca z sekcji „Ściany i sufity bez łazienek”, wstawiona do łazienki",
        "czy wystarczy tynk do 1 cm (60 zł/m²), jeśli strop jest równy")
add(50559, A2, f"sufit po nowym tynku: gładź + malowanie, {pl(A2)} m²", section=S)
add(50596, T2 + A2, f"folia w płynie na ścianach, zabudowie wanny i podłodze: {pl(T2)} + {pl(A2)}", section=S)
add(50619, 15, "ok. 15 mb na 4 m² (Manual), łazienka 4,2 m²", section=S)
add(50613, T2, f"Notatki: „łazienka z wanną będzie mieć inne kafle 120 na 60” (projekt: 30 × 60) — format standard, do sufitu: ściany {pl(W2)} + front zabudowy wanny {pl(TUB_FRONT)}",
    "wysokość płytek — projekt i Notatki nie zmieniają „do sufitu”, ale nowy format może zmienić układ", section=S)
add(50615, GLIF2, f"glify okna {pl(win2[0])} × {pl(win2[1])} = {pl(GLIF2)} mb", section=S)
add(50607, A2, f"podłoga Gr 59,8 × 59,8 → format standard, {pl(A2)} m²", section=S)
add(50556, T2 + A2, "fugowanie = wszystkie płytki (Manual)", "fuga cementowa czy epoksydowa", section=S)
add(50598, 25, "Manual: 20–30 mb na łazienkę — środek, wanna z zabudową", section=S)
add(50617, 15, "bateria wannowa natynkowa 2 + umywalka 3 + grzejnik 2 + puszki 2 + 2 punkty przy lustrze + kratka 1 = 12 → Manual: minimum 15 przy płytkach na wszystkich ścianach", section=S)
add(50547, PER2, f"styk płytek z sufitem — obwód {pl(PER2)} mb", section=S)
add(50600, 5, "krawędź zabudowy wanny (1,60 + 0,48) i narożniki glifów — zaniżone", section=S)
add(50563, 1, "bateria wannowa natynkowa, przeniesiona na środek wanny (Notatki)", section=S)
add(50582, 1, "parawan nawannowy (projekt)", section=S)
add(50587, 1, "umywalka na szafce 0,90 (projekt)", section=S)
add(50561, 1, "bateria stojąca na umywalce (projekt)", section=S)
add(50593, 2, "bateria stojąca → zawory kątowe (Manual)", section=S)
add(50585, 1, "syfon umywalki (syfon wanny w kpl wanny)", section=S)
add(50572, 1, "grzejnik drabinkowy na ścianie 0,65 (projekt)", "grzejnik wodny czy elektryczny", section=S)
add(50578, 1, "lustro podświetlane (projekt)", section=S)
add(50560, 3, "akcesoria — 3 szt. (szacunek agenta); wysoka szafka 0,30 × 1,73 to praca stolarza", section=S)
add(50575, 1, "kratka wentylacyjna", section=S)
add(50626, 5, "2 punkty przy lustrze + 3 punkty natynkowe na suficie (projekt)",
    "czy elektrykę na parterze robi elektryk całego domu", section=S)
add(50576, 5, "lampy na 5 punktach", section=S)
add(50627, 1, "gniazdko przy umywalce — szacunek agenta", section=S)
add(50570, 2, "gniazdko + włącznik", section=S)
add(50581, 1, "drzwi rysowane w projekcie", "czy drzwi są w zakresie", section=S)

# ——— Łazienka pralnia (piwnica) — bathroom-type: it has a shower (brodzik z kabiną)
S = P3
add(50546, 2, "nowe podejścia: druga maszyna (suszarka/pralka) — odpływ + zasilanie; reszta punktów zakładam na miejscu (pralnia istnieje)",
    "czy obecne podejścia pod brodzik, zlew i pralkę zostają w tych samych miejscach", section=S)
add(50567, 1, "brodzik 0,90 × 0,90 z kabiną (rzut) — pralnia liczona jak łazienka, bo ma prysznic: hydroizolacja, płytki do sufitu, biały montaż",
    "projekt: „brodzik obecnie ma 12 cm… niższy brodzik?” — niższy brodzik może wymagać obniżenia odpływu w posadzce piwnicy", section=S)
add(50552, W3 + 2 * A3, f"ściany {pl(W3)} + podłoga i sufit {pl(A3)} × 2", section=S)
add(50602, W3, f"Manual: po skuciu płytek zawsze tynk pod glazurę — obwód {pl(PER3)} mb × {pl(H3)} − drzwi {pl(door3)} − okno {pl(win3[0] * win3[1])}. " + A_DRAW,
    "jak skuwanie — zależy od tego, czy w pralni są płytki", section=S)
add_new(S, CEIL_TYNK, "m²", 100, A3, f"{A_CEIL} — nowy tynk na suficie po skuciu, {pl(A3)} m²; praca z sekcji „Ściany i sufity bez łazienek”, wstawiona do łazienki",
        "czy wystarczy tynk do 1 cm (60 zł/m²)")
add(50559, A3, f"sufit po nowym tynku: gładź + malowanie, {pl(A3)} m²", section=S)
add(50596, W3 + A3, f"folia w płynie na wszystkich ścianach i podłodze (Manual): {pl(W3)} + {pl(A3)}", section=S)
add(50619, 15, "ok. 15 mb na 4 m² (Manual), pralnia 4,6 m²", section=S)
add(50611, W3, f"płytki Gl 7,8 × 23,7 do sufitu na wszystkich ścianach → mały format: {pl(W3)} m² (wysokość {pl(H3)} z kładu A: 0,91 + 1,251)", section=S)
add(50604, GLIF3, f"glify okna {pl(win3[0])} × {pl(win3[1])} pod sufitem, mały format = {pl(GLIF3)} mb", section=S)
add(50607, A3, f"podłoga Gr 29,8 × 29,8 → format standard, {pl(A3)} m²", section=S)
add(50554, W3, "fugowanie płytek ściennych — mały format, fuga cementowa", "fuga cementowa czy epoksydowa", section=S)
add(50556, A3, "fugowanie podłogi — format standard", section=S)
add(50598, 25, "Manual: 20–30 mb na łazienkę — brodzik, blat 1,385 + 0,60", section=S)
add(50617, 18, "prysznic natynkowy 2 + zlew 3 + zawór i odpływ dla 2 maszyn 4 + gniazdka 3 + włącznik 1 + 2 punkty natynkowe + grzejnik 2 + kratka 1 = 18 (Manual)", section=S)
add(50547, PER3, f"styk płytek z sufitem — obwód {pl(PER3)} mb", section=S)
add(50600, 3, "narożniki glifów okna — zaniżone", section=S)
add(50563, 1, "bateria natynkowa w kabinie (rzut, kład D)", section=S)
add(50587, 1, "zlew/umywalka w blacie nad szafką 0,60 (kład A)", "zlewozmywak podwieszany pod blatem może wymagać więcej pracy", section=S)
add(50561, 1, "bateria stojąca przy zlewie (kład A)", section=S)
add(50593, 3, "zlew z baterią stojącą 2 + pralka 1 (Manual: zawory czerpalne dla pralki)", section=S)
add(50585, 1, "syfon zlewu", section=S)
add(50594, 1, "dwie maszyny pod blatem 1,385 (kład A) — przyjęte pralka + suszarka", "czy to pralka i suszarka, czy dwie pralki (+100 zł, +1 zawór)", section=S)
add(50595, 1, "suszarka pod blatem (kład A)", section=S)
add(50572, 1, "grzejnik drabinkowy (rzut, ściana B)", "grzejnik wodny czy elektryczny", section=S)
add(50560, 2, "akcesoria — 2 szt. (szacunek agenta); blat i szafka pod zlewem to praca stolarza", section=S)
add(50575, 1, "kratka wentylacyjna", section=S)
add(50626, 3, "projekt: „2 punkty natynkowe do oświetlenia blatu” + 1 punkt na suficie", section=S)
add(50576, 3, "lampy na 3 punktach", section=S)
add(50627, 3, "gniazdka: pralka, suszarka, blat — szacunek agenta", section=S)
add(50570, 4, "3 gniazdka + włącznik", section=S)
add(50581, 1, "drzwi 0,70 po zmniejszeniu otworu (notatka na projekcie)", "czy drzwi są w zakresie", section=S)

# ——— WC piwnica
S = P4
add(50546, 5, "na zdjęciu IMG_0427 stare rury i pion — nowe podejścia: WC podwieszane 2 + umywalka 3 (katalog)",
    "czy stare podejścia w WC w piwnicy zostają (każdy punkt 250 zł; razem ≈ −1,6 tys. zł z bruzdami)", section=S)
add(50569, 1, "stelaż WC podwieszanego (projekt)", section=S)
add(50583, 1, "zabudowa GK stelaża (projekt)", section=S)
add(50592, 1, "WC podwieszane (projekt)", section=S)
add(50628, H4, f"zabudowa pionu kanalizacyjnego widocznego na zdjęciu IMG_0427, {pl(H4)} mb",
    "czy pion jest w tym pomieszczeniu zabudowany (projekt go nie rysuje)", section=S)
add(50552, W4 + 2 * A4, f"ściany {pl(W4)} (płytki {pl(W4_TILE)} + malowane {pl(W4_PAINT)}) + podłoga i sufit {pl(A4)} × 2", section=S)
add(50602, W4, f"zdjęcie IMG_0427: ściany skute do cegły do ok. 1,5 m, wyżej stary tynk — tynk na całej wysokości, żeby wyrównać do kątów prostych: pod płytki do 1,20 ({pl(W4_TILE)}) i pod farbę wyżej ({pl(W4_PAINT)})",
    "czy stary tynk nad 1,5 m zostaje (tynk tylko na skutej części ≈ −0,2 tys. zł)", section=S)
add_new(S, CEIL_TYNK, "m²", 100, A4, f"{A_CEIL} — nowy tynk na suficie po skuciu (na zdjęciu tynk odpada), {pl(A4)} m²; praca z sekcji „Ściany i sufity bez łazienek”, wstawiona do WC",
        "czy wystarczy tynk do 1 cm (60 zł/m²)")
add(50559, W4_PAINT + A4, f"Manual: malowanie w łazience tylko ścian bez płytek — ściany nad 1,20 (farba Optiva na projekcie) {pl(W4_PAINT)} + sufit {pl(A4)}", section=S)
add(50596, W4_TILE + A4, f"folia w płynie na ścianach z płytkami i podłodze: {pl(W4_TILE)} + {pl(A4)}", section=S)
add(50619, 8, "WC bez prysznica — taśma w narożnikach ściana–podłoga i przy stelażu, ok. 8 mb (szacunek agenta)", section=S)
add(50611, W4_TILE, f"płytki Gl 7,8 × 23,7 do wys. 1,20 (projekt) → mały format: obwód {pl(PER4)} mb × 1,20 − drzwi = {pl(W4_TILE)} m²", section=S)
add(50607, A4, f"podłoga Gr 29,8 × 29,8 → format standard; WC w kształcie L 0,915 × 1,28 + 0,765 × 1,01 = {pl(A4)} m²", section=S)
add(50554, W4_TILE, "fugowanie płytek ściennych — mały format", "fuga cementowa czy epoksydowa", section=S)
add(50556, A4, "fugowanie podłogi — format standard", section=S)
add(50598, 10, "WC bez prysznica: styk ściana–podłoga, WC, umywalka — ok. 10 mb (Manual 20–30 mb dotyczy łazienki z prysznicem/wanną)", section=S)
add(50617, 10, "WC 5 + umywalka 3 + grzejnik 2 (Manual); płytki tylko do 1,20, więc bez minimum 15", section=S)
add(50547, PER4 + PER4, f"styk farby z sufitem ({pl(PER4)} mb) i górna krawędź płytek na 1,20 ({pl(PER4)} mb)", section=S)
add(50600, 2, "krawędź półki nad stelażem WC — zaniżone", section=S)
add(50587, 1, "umywalka 0,40 (projekt)", "umywalka wisząca (250 zł) czy na szafce", section=S)
add(50561, 1, "bateria stojąca (projekt)", section=S)
add(50593, 2, "bateria stojąca → zawory kątowe (Manual)", section=S)
add(50585, 1, "syfon umywalki", section=S)
add(50572, 1, "grzejnik drabinkowy (projekt)", "grzejnik wodny czy elektryczny", section=S)
add(50573, 0.6, "LED pod szafką wiszącą (projekt; szafka to praca stolarza) — ok. 0,6 mb", "długość szafki", section=S)
add(50574, 1, "zasilacz LED", section=S)
add(50560, 2, "akcesoria — 2 szt. (szacunek agenta)", section=S)
add(50575, 1, "kratka wentylacyjna", "WC w piwnicy bez okna — czy potrzebny wentylator (+120 zł)", section=S)
add(50626, 2, "projekt: 2 punkty natynkowe", section=S)
add(50576, 2, "lampy na 2 punktach", section=S)
add(50570, 2, "włącznik światła + włącznik LED pod szafką", section=S)
add(50581, 1, "drzwi 0,765 × 2,046 rysowane w projekcie", "czy drzwi są w zakresie", section=S)

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in sorted(by.items(), key=lambda kv: -kv[1]): print(f"{s:42} {v:12.2f}")
BATHS = {P1, P2, P3, P4}
known = {(v['section'], v['description']) for v in rows.values()}
added = [r for r in draft if ((TEMPLATE_BATH if r['section'] in BATHS else r['section']), r['description']) not in known]
zero = [r for r in draft if r['qty'] == 0]
print(f"{len(draft)} rows ({len(added)} added, {len(zero)} at qty 0), total {total:.2f}")
print(f"A1 {A1:.2f} W1 {W1:.2f} | A2 {A2:.2f} W2 {W2:.2f} T2 {T2:.2f} | A3 {A3:.2f} W3 {W3:.2f} H3 {H3:.3f} | "
      f"A4 {A4:.2f} W4 tile {W4_TILE:.2f} paint {W4_PAINT:.2f} | ceilings {CEILS:.2f}")
