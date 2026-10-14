# Builds measure/ai-draft-load.json for production #214 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). Assumptions go into the row's `assumptions`, unknowns into `missingData`.
# Inputs: the owner's mail (inputs/client-inquiry.md), the designer's vector set (JKSTUDIO, 1:25): łazienka
# rzut + widoki 1–4, WC rzut + widoki 1i2 / 3i4, two łazienka renders, two WC renders and six phone photos
# (stan deweloperski). Two rooms, each its own sekcja (fill-case-prod renames „Łazienka” to the first and
# copies the template for the second): „Łazienka parter”, „WC parter”.
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

def pl(x): return f"{x:.2f}".replace(".", ",")

TEMPLATE_BATH = 'Łazienka'
MLECZKO = rows[50534]['description']

# ——— Łazienka parter (rzut + widoki 1–4)
P1 = 'Łazienka parter'
H1 = 3.24                                  # tiles up to the suspended ceiling (widoki; structure 3,70, band 0,46)
A1 = 2.40 * 2.93 + 1.47 * 1.17             # main part + shower extension
LEDGE = 0.20 * 1.80                        # zabudowa over WC + bidet, 20 cm deep
F1 = A1 - LEDGE
PER1 = 3.87 + 1.17 + 1.47 + 1.76 + 2.40 + 2.93
DOOR1 = 0.98 * 2.57
WIN1 = 0.85 * H1                           # full-height window in the left wall
MIRRORS1 = 2 * 0.60 * H1                   # two mirror strips on the umywalka wall, no tiles behind
WF1 = 1.80 * H1 + 0.57 * H1 + 3.18 + 1.47 * H1 + 6.74   # Laminam Bruno, Laminam widok 1, Stromboli 162x324 (door wall), shower side, left wall
STD1 = 2.07 * H1 + 0.60 * H1 + 1.20 * H1                # Bands 60x120: top wall, widok 1, umywalka wall between mirrors
W1 = WF1 + STD1
LEDGE_FRONT = 1.80 * 1.17
GLIF_LEDGE = 1.80 + 1.17
GLIF_WIN = 2 * H1 + 0.85
CORNER1 = H1 * 2

# ——— WC parter (rzut + widoki 1i2, 3i4); zabudowa 0,43 along the right wall already built
P2 = 'WC parter'
H2 = 2.70
F2 = 2.02 * 1.43 + 0.98 * 0.40             # floor in front of the zabudowa, plus the umywalka niche
C2 = 2.45 * 1.43 + 0.98 * 0.40             # ceiling over the whole room incl. the zabudowa
DOOR2 = 0.92 * 2.50
WALLS2 = {
    'ściana z drzwiami (widok 1)': 1.83 * H2 - DOOR2,
    'ściana za umywalką we wnęce': 0.98 * H2,
    'bok wnęki': 0.40 * H2,
    'ściana za blatem (widok 2)': 1.04 * H2,
    'front zabudowy WC do wys. 1,20 (widok 3)': 1.43 * 1.20,
    'ściana naprzeciw wnęki (widok 4)': 2.02 * H2,
}
W2 = sum(WALLS2.values())
ZAB_FRONT2 = 1.43 * 1.20
PER2 = 1.83 + 0.98 + 0.40 + 1.04 + 1.43 + 2.02
FRONTS2 = 1.43 * 1.48

A_DRAW = "wymiary z projektu (rzut + widoki, 1:25)"
A_DEW = "stan deweloperski ze zdjęć: tynki na ścianach, wylewka, kable i podejścia wod-kan doprowadzone"
NO_WHITE = "Notatki: „Bez białego montażu, później zamontujemy sami.”"

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
add(50402, 1, "1 kpl na cały zakres: łazienka i WC na parterze domu, rynek pierwotny",
    "cena j.m. z szablonu 1500 zł; katalog: łazienka na rynku pierwotnym ok. 700 zł — tu dwa pomieszczenia i dom poza Warszawą (Lesznowola), do korekty ręcznie")
add(50405, 2, "Manual: rynek pierwotny bez wyburzeń — 2 big bagi total (docinki płytek, GK, opakowania)")

# — Wyburzenia, demontaże, zabezpieczenia
add(50454, 10, "katalog: łazienka w stanie deweloperskim bez reszty domu — zabezpieczamy głównie okna; okno w łazience 0,85 × 3,24, wejście i droga do obu pomieszczeń ok. 7 m² — szacunek agenta",
    "czy reszta domu jest już wykończona — wtedy cała droga do łazienek po podłodze (25 zł/m²)")
add(50420, 3, "przedłużenie podejść pod baterie podtynkowe: łazienka ok. 2 mb (katalog), WC ok. 1 mb (bateria ścienna na wys. 1,05, podejścia na zdjęciu nisko pod zwykłą umywalkę)")
add(50422, 12.5, "katalog: ok. 2,5 mb na punkt × 5 nowych punktów (łazienka 3 punkty oświetleniowe, WC 1 punkt oświetleniowy + 1 gniazdo)",
    "na zdjęciach kable już doprowadzone — część punktów może być gotowa")

# ——— Łazienka parter
S = P1
add(50546, 4, f"katalog: stan deweloperski ok. 4 pkt — podejścia są (zdjęcia łaz1–3), przedłużenia pod baterie podtynkowe: prysznic z deszczownicą + 2 umywalki ścienne. {A_DEW}",
    "czy podejścia są już na wysokości baterii podtynkowych z projektu (każdy punkt 250 zł)", section=S)
add(50569, 0, "stelaż WC już zamontowany (zdjęcie łaz3) — montażu geberitu nie liczę", section=S)
add(50566, 0, "stelaż bidetu już zamontowany (zdjęcie łaz3) — montażu nie liczę; bateria bidetowa to biały montaż klienta", section=S)
add(50583, 2, f"zabudowa GK nad stelażami WC i bidetu: półka 1,80 × wys. 1,17 × gł. 0,20 z LED (rzut, widok) — 2 kpl, po jednym na stelaż",
    "czy liczyć jako jedną zabudowę (−450 zł)", section=S)
add(50580, 1, "Notatki: „Odpływ liniowy viega przyszykowany do zalania. Nie zalewaliśmy żeby wykonawca sam sobie dopasował wysokość” — osadzenie, wypoziomowanie i spadek; prysznic 1,47 × 1,17 bez brodzika (rzut)",
    "odpływ jednospadkowy czy koperta (+300 zł)", section=S)
add(50599, 1, "Manual: małego sufitu w łazience nie liczymy z metra — 1 kpl; sufit podwieszany na wys. 3,24 z LED (widoki: konstrukcja 3,70, pas 0,46)",
    "czy sufit robi ta sama ekipa, która postawiła stelaż sufitu w WC — wtedy −1800 zł", section=S)
add(50552, W1 + 2 * A1, f"ściany {pl(W1)} + podłoga i sufit {pl(A1)} × 2 (katalog: dwukrotne gruntowanie ścian, sufitów i podłóg)", section=S)
add_new(S, MLECZKO, "m²", 7, W1 - LEDGE_FRONT,
        f"Manual: tynki deweloperskie zawsze szlifujemy przed dalszymi pracami; praca w łazience idzie do sekcji łazienki — ściany pod płytki {pl(W1)} minus front zabudowy GK {pl(LEDGE_FRONT)} = {pl(W1 - LEDGE_FRONT)} m²; sufit podwieszany bez szlifowania")
add(50596, W1 + F1, f"Manual: folia w płynie na wszystkich ścianach i podłodze — {pl(W1)} + {pl(F1)}", section=S)
add(50619, 20, f"Manual: ok. 15 mb na 4 m² (można lekko niedoszacować); łazienka {pl(A1)} m², ale prysznic tylko 1,47 × 1,17 — obwód podłogi ok. 12,7 mb + narożniki w strefie prysznica 2 × 2,0 + odpływ ≈ 20 mb", section=S)
add(50614, WF1, f"wielki format: Laminam Bruno 1,80 × 3,24 za WC i bidetem, Laminam na widoku 1 0,57 × 3,24, Stromboli 162 × 324 na ścianie z drzwiami 3,18, bok prysznica 1,47 × 3,24, ściana z oknem 6,74 = {pl(WF1)} m². Płytki do sufitu podwieszanego (3,24). {A_DRAW}", section=S)
add(50613, STD1, f"Bands 60 × 120 → format standard: górna ściana 2,07 × 3,24, widok 1 0,60 × 3,24, ściana z umywalkami między lustrami 1,20 × 3,24 = {pl(STD1)} m²; za lustrami (2 × 0,60 × 3,24 = {pl(MIRRORS1)}) bez płytek; umywalki zwykłe podwieszane, bez okładziny (Notatki: „Umywalki zwykła podwieszanie (nie z płytek)”)", section=S)
add(50597, WF1, f"katalog: mata kompensacyjna pod płytki wielkoformatowe — powierzchnia wielkiego formatu {pl(WF1)} m²", section=S)
add(50616, GLIF_LEDGE + GLIF_WIN, f"wielki format do 20 cm: półka nad stelażami (wierzch 1,80 + bok 1,17) + glify okna od podłogi do sufitu (2 × 3,24 + 0,85) = {pl(GLIF_LEDGE + GLIF_WIN)} mb",
    f"czy glify okna są w płytkach (bez nich −{pl(GLIF_WIN * 350)} zł)", section=S)
add(50605, F1, f"ReGea Stromboli 120 × 120 (rzut): podłoga {pl(A1)} minus półka nad stelażami {pl(LEDGE)} = {pl(F1)} m²", section=S)
add(50556, W1 + F1, f"fugowanie = wszystkie płytki (Manual): {pl(W1)} + {pl(F1)}", "fuga cementowa czy epoksydowa", section=S)
add(50598, 25, "Manual: 20–30 mb na łazienkę — środek, prysznic z odpływem liniowym", section=S)
add(50617, 23, "WC 5 + bidet 4 + prysznic podtynkowy 3 + deszczownica 1 + 2 umywalki z baterią podtynkową 2 × 3 + grzejnik 2 + puszki 2 = 23 (Manual)", section=S)
add(50547, PER1, f"styk płytek z sufitem podwieszanym — obwód {pl(PER1)} mb", section=S)
add(50600, CORNER1 + GLIF_LEDGE, f"narożnik zewnętrzny przy prysznicu 3,24 × 2 + krawędzie półki nad stelażami {pl(GLIF_LEDGE)} = {pl(CORNER1 + GLIF_LEDGE)} mb",
    f"narożniki glifów okna nie liczone (Manual: przy wątpliwościach nie zawyżaj) — z nimi +{pl(GLIF_WIN * 2)} mb", section=S)
add(50559, A1, f"Manual: malowanie w łazience tylko bez płytek — sufit podwieszany {pl(A1)} m² (gładź + malowanie)", section=S)
add(50562, 1, "bateria prysznicowa podtynkowa z deszczownicą (rzut: oś baterii prysznicowej) — korpus osadzany przed płytkami; biały montaż po stronie klienta", section=S)
add(50564, 2, "2 baterie umywalkowe podtynkowe (rzut: 2 osie baterii, 2 umywalki) — korpusy przed płytkami", section=S)
add(50550, 0, f"{NO_WHITE} — biały montaż baterii (prysznic, umywalki, bidet), syfony, lustra z LED i akcesoria po stronie klienta", section=S)
add(50592, 0, f"{NO_WHITE} — WC podwieszane montuje klient", section=S)
add(50588, 0, f"Notatki: „Umywalki zwykła podwieszanie” + {NO_WHITE} — 2 umywalki montuje klient",
    "czy montaż umywalek wiszących jest jednak po naszej stronie (2 × 250 zł)", section=S)
add(50586, 0, "przesuwna ścianka szklana prysznica (rzut) — montaż dostawcy szkła / biały montaż klienta",
    "czy szkło montujemy my (550 zł jak szyba stała)", section=S)
add(50572, 0, f"grzejnik na górnej ścianie (rzut: oś grzejnika) — {NO_WHITE}",
    "czy grzejnik to biały montaż klienta (+250 zł, jeśli nasz)", section=S)
add(50581, 0, "drzwi łazienkowe — zakładam montaż dostawcy drzwi do całego domu",
    "czy drzwi są w zakresie (+380 zł)", section=S)
add(50622, 0, "wnęka/półka w prysznicu widoczna na wizualizacji, widoki jej nie rysują — nie liczę",
    "czy jest wnęka w prysznicu (przedścianka z półką 1200–1800 zł)", section=S)
add(50626, 3, "nowe zasilania LED: półka nad stelażami + pionowa taśma LED na styku Laminamu i Bands + zasilanie przy lustrach — 3 punkty",
    "na zdjęciach kable już doprowadzone (tymczasowe żarówki) — część punktów może być gotowa", section=S)
add(50573, 1.80 + H1, f"taśma LED w półce nad stelażami 1,80 + pionowa listwa LED 3,24 = {pl(1.80 + H1)} mb",
    "rzut ma 4 oznaczenia LED przy lustrach — jeśli to taśmy przy lustrach (ok. 4 × 2,3 mb), ok. +1,4 tys. zł", section=S)
add(50574, 1, "zasilacz LED", section=S)
add(50576, 6, "oprawy w suficie podwieszanym — ok. 6 szt. z wizualizacji (projekt nie ma rzutu sufitu)", "liczba opraw", section=S)

# ——— WC parter
S = P2
add(50546, 1, "bateria umywalkowa ścienna na wys. 1,05 (rzut: oś baterii, h = 105) — podejścia na zdjęciu wc2 są nisko, pod zwykłą umywalkę: przedłużenie 1 pkt",
    "czy podejścia są już na wysokości baterii ściennej", section=S)
add(50569, 0, "stelaż WC już zamontowany i zabudowany (zdjęcie wc1)", section=S)
add(50583, 0, "zabudowa GK stelaża z wnęką na szafki już wykonana przez inną ekipę (zielone płyty GK na zdjęciu wc1)", section=S)
add(50599, 0, "stelaż sufitu podwieszanego w WC już stoi (zdjęcia wc1, wc3) — zakładam, że sufit kończy ta sama ekipa",
    "czy płyty na suficie i LED w suficie są po naszej stronie (sufit z LED 1800 zł kpl)", section=S)
add(50552, W2 + F2 + C2, f"ściany {pl(W2)} + podłoga {pl(F2)} + sufit {pl(C2)} (katalog: dwukrotne gruntowanie ścian, sufitów i podłóg)", section=S)
add_new(S, MLECZKO, "m²", 7, W2 - ZAB_FRONT2,
        f"Manual: tynki deweloperskie zawsze szlifujemy przed dalszymi pracami — ściany pod płytki {pl(W2)} minus front zabudowy GK {pl(ZAB_FRONT2)} = {pl(W2 - ZAB_FRONT2)} m²")
add(50596, W2 + F2, f"folia w płynie na ścianach z płytkami i podłodze (Manual; jak w łazience): {pl(W2)} + {pl(F2)}", section=S)
add(50619, 8, "WC bez prysznica — taśma w narożnikach ściana–podłoga i przy stelażu, ok. 8 mb (szacunek agenta)", section=S)
add(50614, W2, "Laminam Nero i Bruno 1620 × 3240 → wielki format, do wys. 2,70 na wszystkich ścianach (widoki 1–4): "
    + ", ".join(f"{k} {pl(v)}" for k, v in WALLS2.items()) + f" = {pl(W2)} m² (drzwi 0,92 × 2,50 odjęte). {A_DRAW}", section=S)
add(50597, W2, f"katalog: mata kompensacyjna pod płytki wielkoformatowe — {pl(W2)} m²", section=S)
add(50605, F2, f"podłoga {pl(F2)} m² (2,02 × 1,43 przed zabudową + wnęka 0,98 × 0,40) — na wizualizacji jasna płytka jak w łazience, przyjęta Stromboli 120 × 120",
    "projekt WC nie podaje płytki podłogowej", section=S)
add(50556, W2 + F2, f"fugowanie = wszystkie płytki (Manual): {pl(W2)} + {pl(F2)}", "fuga cementowa czy epoksydowa", section=S)
add(50598, 10, "WC bez prysznica: styk ściana–podłoga, WC, blat — ok. 10 mb", section=S)
add(50617, 10, "WC 5 + bateria ścienna 3 + zawór w zabudowie 1 + gniazdo przy blacie 1 = 10 (Manual; minimum 15 dotyczy łazienki — WC ma 3,3 m²)", section=S)
add(50547, PER2, f"styk płytek z sufitem — {pl(PER2)} mb", section=S)
add(50600, H2 * 2, "narożnik zewnętrzny przy wnęce na umywalkę 2,70 × 2 (Manual)", section=S)
add(50559, C2, f"czarny sufit (wizualizacje) — gładź + malowanie {pl(C2)} m²", section=S)
add(50564, 1, "bateria umywalkowa podtynkowa ścienna (rzut: h = 105, nad blatem) — korpus przed płytkami; biały montaż po stronie klienta", section=S)
add(50592, 0, f"{NO_WHITE} — czarne WC podwieszane montuje klient", section=S)
add(50587, 0, f"umywalka wpuszczana w czarny kamienny blat 20 cm (widok 2) — {NO_WHITE}; blat z szufladami robi stolarz/kamieniarz",
    "kto robi i montuje kamienny blat", section=S)
add(50629, 0, "szafki nad WC we wnęce zabudowy (widok 3: trzy fronty 1,43 × 1,48) — praca stolarza", section=S)
add_new(S, "Klejenie płytek Laminam na fronty szafek nad WC (płyta meblowa)", "m²", 0, FRONTS2,
        f"Notatki: „Jeśli można to płytki laminam też na szafki nad wc (trzeba płyta meblowa i na to nakleić). Jeśli nie to damy stolarzowi do przyklejenia” — fronty 1,43 × 1,48 = {pl(FRONTS2)} m²",
        f"brak w szablonie i w katalogu — do wyceny (Cena j.m. pusta); najbliżej „Układanie glazury na ścianie wielki format 120x270” 550 zł/m² (≈ +{pl(FRONTS2 * 550)} zł); płyta meblowa po stronie stolarza")
add(50626, 1, "taśma LED w szczelinie nad szafkami (wizualizacja wc6, widoki: szczelina 2 cm) — 1 nowy punkt; kabel pod szynoprzewód już wisi z sufitu (zdjęcie wc1)", section=S)
add(50573, 1.43, "LED nad szafkami wzdłuż zabudowy — 1,43 mb", section=S)
add(50574, 1, "zasilacz LED", section=S)
add(50576, 2, "szynoprzewód z reflektorem nad blatem (wizualizacja wc8) — 2 szt.", "liczba opraw na szynie", section=S)
add(50627, 1, "gniazdo podwójne nad blatem (widok 1, 60 cm od narożnika)", "czy puszka jest już w tym miejscu", section=S)
add(50570, 2, "gniazdo podwójne — 2 mechanizmy", section=S)
add(50581, 0, "drzwi do WC — zakładam montaż dostawcy drzwi do całego domu", "czy drzwi są w zakresie (+380 zł)", section=S)

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in sorted(by.items(), key=lambda kv: -kv[1]): print(f"{s:42} {v:12.2f}")
BATHS = {P1, P2}
known = {(v['section'], v['description']) for v in rows.values()}
added = [r for r in draft if ((TEMPLATE_BATH if r['section'] in BATHS else r['section']), r['description']) not in known]
zero = [r for r in draft if r['qty'] == 0]
print(f"{len(draft)} rows ({len(added)} added, {len(zero)} at qty 0, {len(draft) - len(zero)} with qty > 0), total {total:.2f}")
print(f"A1 {A1:.2f} F1 {F1:.2f} PER1 {PER1:.2f} WF1 {WF1:.2f} STD1 {STD1:.2f} W1 {W1:.2f} gross {PER1 * H1:.2f} "
      f"(door {DOOR1:.2f} win {WIN1:.2f} mirrors {MIRRORS1:.2f}) | F2 {F2:.2f} C2 {C2:.2f} W2 {W2:.2f} PER2 {PER2:.2f}")
