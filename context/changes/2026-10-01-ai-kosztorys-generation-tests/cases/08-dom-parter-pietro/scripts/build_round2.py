# Builds measure/ai-draft-round-2.json for production #198 — round 2 (EX-1057), bathrooms only.
# Source: the owner's new Notatki line „niech przeliczy same łazienki jeszcze raz i podzieli. W domu mamy
# na parterze wc oraz na górze dwie łazienki" and the Powód zmiany on „Montaż geberitu" („połączone dwie
# łazienki"). Round 1 (2026-10-12) predates the one-sekcja-per-bathroom rule and summed three rooms into
# „Łazienka"; its build_draft.py already measured each room apart, so the split re-reads those figures
# from the same drawings (G 05 hydraulika: which fixtures stand in which upstairs room; P 05: the WC).
#
# „Łazienka" becomes the upstairs wet room (WC + bidet + shower + pralka) — the room holding most of the
# owner's accepted pozycje (odpływ, szyba, bateria prysznicowa), so the fewest verdicts move. The two
# other rooms are new copies of the szablon „Łazienka". Rows round 1 parked in „Łazienka" that belong to
# no bathroom (the kitchen spiek, mirrors outside the bathrooms) move to their own sekcje, and bathroom
# work it booked elsewhere (the wet room's GK sufit, the tapeta, bathroom floor primer) moves in — the
# Manual gained „dodajemy do sekcji łazienka" and the wiercenie / zawory / biały montaż rules since.
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(description=desc, unit=unit, clientPrice=float(price))

def pl(x):
    s = f"{x:.2f}".rstrip('0').rstrip('.')
    return s.replace('.', ',')

M = 'Łazienka piętro z prysznicem'   # „Łazienka" renamed — G 05 right: WC, bidet, umywalka, prysznic, pralka
W = 'Łazienka piętro z wanną'        # G 05 left: wanna wolnostojąca, 2 umywalki nablatowe
C = 'WC parter'                      # P 05: WC podwieszany, umywalka wisząca z baterią podtynkową
KITCHEN = 'Kuchnia'
WALLS = 'Ściany i sufity bez łazienek'

SPLIT = 'Powód: łazienki rozdzielone na 3 sekcje (Notatki: „na parterze wc oraz na górze dwie łazienki”); runda 1 liczyła je razem w „Łazienka”'

# Round-1 AI przedmiar of every row touched, for the „was → is" line.
ROUND1 = {60133: 11, 60136: 2, 60137: 2, 60149: 1, 60155: 56, 60158: 40, 60162: 2.11, 60164: 15.49,
          60170: 16.03, 60171: 39.38, 60172: 8.75, 60175: 54.87, 60178: 26.89, 60179: 75, 60183: 8.72,
          60184: 8, 60185: 3, 60188: 1, 60189: 1, 60201: 3, 60203: 7, 60209: 3, 60210: 1, 60211: 1,
          60212: 4, 60214: 2}

draft = []
OUT = 'Powód: łazienki rozdzielone na 3 sekcje — ta pozycja nie należy do żadnej łazienki, więc wychodzi z „Łazienka”'
INTO = 'Powód: Manual — „Jeżeli praca dotyczy pracy w łazience to dodajemy do sekcji łazienka”'

def put(section, i, qty, here, assumed=None, unknown=None, insert=False, before=None, reason=None):
    r = rows[i]
    if before is None: before = ROUND1.get(i, 0) if section == M else 0
    head = f"Runda 2 — nowa pozycja: 0 → {pl(qty)} {r['unit']}" if insert else \
        f"Runda 2 — AI przedmiar: {pl(before)} → {pl(qty)} {r['unit']}"
    if reason is None: reason = SPLIT if section in (M, W, C) else OUT
    lines = [head, f"{reason}; {here}"]
    if assumed: lines.append(f"Założono: {assumed}")
    if unknown: lines.append(f"Nie wiadomo: {unknown}")
    row = dict(section=section, description=r['description'], qty=round(qty, 2), newInformation='\n'.join(lines))
    # A pozycja the target sekcja lacks is inserted, so it carries its own unit and price.
    if insert: row.update(unit=r['unit'], clientPrice=r['clientPrice'])
    draft.append(row)

wet_walls = 2 * (2.47 + 2.675) * 2.65 - 0.90 * 2.10   # round 1: tiled to the suspended ceiling (G 20)
bath_walls = 14.0
wc_walls = 2 * (0.93 + 2.27) * 2.80 - 0.90 * 2.10
wet_floor, bath_floor, wc_floor = 6.35, 9.14, 2.11
wet_ceil = 6.61
spiek = 8.75
wet_hydro = wet_walls + wet_floor
bath_hydro = 56 - wet_hydro                           # the owner accepted 56 for both upstairs rooms

# — Łazienka piętro z prysznicem (the renamed „Łazienka"): only rows whose figure changes.
put(M, 60133, 6, "tu: umywalka 1, WC 1, bidet 1, prysznic 2 (mieszacz + deszczownica), pralka 1 (G 05)",
    unknown="Twoje 4 pkt (świadomie zaniżone) było na cały dom — rozdziel je między 3 łazienki")
put(M, 60136, 1, "tu jeden stelaż WC; drugi w „WC parter” (G 05, P 05)")
put(M, 60137, 1, "zabudowa stelaża w płytkach, 150 mm; parterowa w „WC parter”")
put(M, 60149, 0, "sufit podwieszany z LED po obwodzie jest w WC na parterze (P) — przeniesiony do „WC parter”")
put(M, 60155, wet_hydro, f"tu ściany do sufitu {pl(wet_walls)} + podłoga {pl(wet_floor)} m²; łazienka z wanną {pl(bath_hydro)} m² w swojej sekcji")
put(M, 60158, 28, "tu ok. 26 z 40 mb z rundy 1 (narożniki dzielone wg powierzchni płytek na ścianach) + 2 mb krawędzi nad stelażem WC w płytkach — nowa reguła Manuala",
    assumed="podział 40 mb z rundy 1 proporcjonalnie do płytek ściennych; krawędź nad stelażem ok. 0,9 m × 2")
put(M, 60162, 0, "płytka 1198 × 1198 na podłodze jest w WC na parterze (P) — przeniesiona do „WC parter”")
put(M, 60164, wet_floor, f"tu podłoga {pl(wet_floor)} m² (G 06); łazienka z wanną {pl(bath_floor)} m² w swojej sekcji")
put(M, 60170, 0, "ściany 1198 × 1198 do sufitu są w WC na parterze (P) — przeniesione do „WC parter”")
put(M, 60171, wet_walls, f"tu ściany do sufitu {pl(wet_walls)} m² (G 20); łazienka z wanną 14 m² w swojej sekcji")
put(M, 60172, 0, "spiek 8,75 m² jest w niszy kuchennej (P) — przeniesiony do „Kuchnia”")
put(M, 60175, wet_walls + wet_floor, f"tu ściany {pl(wet_walls)} + podłoga {pl(wet_floor)} m²")
put(M, 60178, 0, "fuga cementowa dotyczy WC na parterze i spieku — przeniesiona do „WC parter” i „Kuchnia”")
put(M, 60179, 25, "25 mb na łazienkę (Manual), jak w rundzie 1 — 3 × 25 mb rozdzielone na sekcje")
put(M, 60183, wet_ceil, f"tu sufit podwieszany GK {pl(wet_ceil)} m² (G 04); WC na parterze w swojej sekcji")
put(M, 60184, 4, "tu: uchwyt papieru, szczotka WC, haczyk, wieszak", assumed="podział 8 szt. z rundy 1: tu 4, łazienka z wanną 2, WC parter 2")
put(M, 60185, 1, "tu jedna umywalka nablatowa (G 05); dwie w łazience z wanną")
put(M, 60188, 0, "umywalka wisząca z baterią podtynkową jest w WC na parterze (P 05)")
put(M, 60189, 0, "wanna jest w łazience z wanną (G 05)")
put(M, 60201, 1, "jedna kratka na pomieszczenie")
put(M, 60203, 0, "lustro klejone 1,27 m² jest w łazience z wanną; pozostałe 6 modułów jest poza łazienkami — „Ściany i sufity bez łazienek”")
put(M, 60209, 1, "tu jedna umywalka nablatowa (G 05)")
put(M, 60210, 0, "umywalka wisząca jest w WC na parterze (P 05)")
put(M, 60211, 0, "wanna jest w łazience z wanną (G 05)")
put(M, 60212, 1, "tu syfon jednej umywalki")
put(M, 60214, 1, "tu jedna miska WC; druga w „WC parter”")
# Rows round 1 left at 0 that the bathroom recount and the Manual's new rules fill.
RECOUNT = 'Powód: przeliczenie łazienek (Notatki)'
put(M, 60215, 1, "rysunek G 05: „wyprowadzenie wod-kan pralki we wnęce od boku geberitu”; runda 1 liczyła punkt wod-kan, ale pominęła podłączenie", reason=RECOUNT)
put(M, 60191, 1, "bidet podtynkowy ma też biały montaż (Manual: każda bateria podtynkowa ma montaż w ścianie i biały montaż)", reason=RECOUNT)
put(M, 60213, 3, "zawory pod umywalką z baterią stojącą 2 + pralka 1 (Manual)", reason=RECOUNT)
put(M, 60180, 19, "WC 5, bateria prysznicowa 3, bidet 2, umywalka 3, pralka 3, puszki przy lustrze 2, kratka 1 (Manual: przykładowe ilości; płytki na wszystkich ścianach — min. 15)", reason=RECOUNT)
put(M, 60146, wet_walls + wet_floor, f"pod płytki: ściany {pl(wet_walls)} + podłoga {pl(wet_floor)} m² (Manual: gruntowanie podłóg łazienek liczymy w łazience)", reason=RECOUNT)
put(M, 60089, wet_ceil, f"sufit podwieszany GK (−100 mm) {pl(wet_ceil)} m², 4 oprawy (G 04) — przeniesiony z „Ściany i sufity bez łazienek”", reason=INTO, insert=True)

# — Łazienka piętro z wanną (new copy of the szablon „Łazienka").
for i, qty, here in [
    (60133, 3, "tu: wanna 1, umywalki 2 (G 05)"),
    (60155, bath_hydro, f"podłoga {pl(bath_floor)} m² + ściany do 1,2 m — reszta z 56 m² zaakceptowanych na obie łazienki piętra"),
    (60158, 14, "ok. 14 z 40 mb narożników ze szlifem 45° (G 06)"),
    (60164, bath_floor, f"podłoga Zimba Black {pl(bath_floor)} m² (G 06)"),
    (60171, bath_walls, "ściana umywalek i część wnęki wanny"),
    (60175, bath_walls + bath_floor, f"fuga epoksydowa: ściany {pl(bath_walls)} + podłoga {pl(bath_floor)} m²"),
    (60179, 25, "25 mb na łazienkę (Manual)"),
    (60184, 2, "wieszaki, haczyki"),
    (60185, 2, "baterie stojące na blacie przy 2 umywalkach (G 05)"),
    (60189, 1, "bateria wolnostojąca podłogowa przy wannie (G 05)"),
    (60201, 1, "jedna kratka na pomieszczenie"),
    (60203, 1, "lustro grafitowe klejone 1,27 m²"),
    (60209, 2, "dwie umywalki nablatowe (G 05)"),
    (60211, 1, "wanna wolnostojąca z syfonem (G 05)"),
    (60212, 2, "syfony dwóch umywalek (wanna ma syfon w swojej pozycji)"),
    (60213, 4, "zawory pod 2 umywalkami z bateriami stojącymi (Manual)"),
    (60180, 12, "bateria wannowa w posadzce 2 + odpływ 1, 2 umywalki × 3, puszki przy lustrze 2, kratka 1 (Manual: przykładowe ilości)"),
    (60146, bath_walls + bath_floor, f"pod płytki: ściany {pl(bath_walls)} + podłoga {pl(bath_floor)} m²"),
]:
    assumed = "ściany: rysunki nie podają powierzchni płytki — 14 m² jak w rundzie 1; każdy m² = 180 zł" if i == 60171 else \
        "płytki nie na wszystkich ścianach, więc minimum 15 otworów nie obowiązuje" if i == 60180 else None
    put(W, i, qty, here, assumed=assumed)
put(W, 60131, 7.46, "tapeta „Enchanted River” 7,46 m² na ścianie okiennej tej łazienki (G 13) — przeniesiona z „Ściany i sufity bez łazienek”", reason=INTO, insert=True)

# — WC parter (new copy of the szablon „Łazienka").
for i, qty, here in [
    (60133, 2, "WC + umywalka (P 05)"),
    (60136, 1, "stelaż podtynkowy (P 05)"),
    (60137, 1, "zabudowa stelaża płytą meblową, 180 mm (P)"),
    (60149, 1, "sufit podwieszany GK, −100 mm, szczelina LED po obwodzie, RAL 9005 (P)"),
    (60162, wc_floor, f"podłoga w płytce 1198 × 1198, {pl(wc_floor)} m² (P)"),
    (60170, wc_walls, f"Tubądzin Lounge Stone Brown 1198 × 1198 do sufitu, ściany {pl(wc_walls)} m² (P)"),
    (60178, wc_walls + wc_floor, f"fuga cementowa: ściany {pl(wc_walls)} + podłoga {pl(wc_floor)} m²"),
    (60179, 20, "dolna granica 20–30 mb na łazienkę (Manual) — WC bez prysznica i wanny"),
    (60183, wc_floor, f"sufit z gładzią i malowaniem {pl(wc_floor)} m²"),
    (60184, 2, "uchwyt papieru, szczotka WC"),
    (60188, 1, "umywalka wisząca z baterią podtynkową (P 05)"),
    (60201, 1, "jedna kratka na pomieszczenie"),
    (60210, 1, "umywalka wisząca (P 05)"),
    (60212, 1, "syfon umywalki"),
    (60214, 1, "miska WC podwieszana (P 05)"),
    (60192, 1, "biały montaż baterii umywalkowej podtynkowej (Manual: każda bateria podtynkowa ma montaż w ścianie i biały montaż)"),
    (60180, 15, "WC 5, umywalka z baterią podtynkową 3, kratka 1 = 9 — płytki na wszystkich ścianach, więc minimum 15 (Manual)"),
    (60146, wc_walls + wc_floor, f"pod płytki: ściany {pl(wc_walls)} + podłoga {pl(wc_floor)} m²"),
]:
    put(C, i, qty, here)

# — Bathroom work round 1 booked outside the bathrooms (Manual: „dodajemy do sekcji łazienka”).
put(WALLS, 60089, 0, f"sufit GK {pl(wet_ceil)} m² jest w łazience piętra z prysznicem — przeniesiony do „{M}”", before=wet_ceil, reason=INTO)
put(WALLS, 60131, 0, f"tapeta 7,46 m² jest w łazience z wanną — przeniesiona do „{W}”", before=7.46, reason=INTO)
floors_all = 102.91
put('Podłogi', 60047, floors_all - wc_floor - bath_floor - wet_floor,
    f"bez podłóg łazienek {pl(wc_floor + bath_floor + wet_floor)} m² — Manual: „Nie liczymy w tym gruntowanie podłóg w łazienkach. łazienki robimy osobno”; łazienki mają „Dwukrotne gruntowanie” w swoich sekcjach",
    before=floors_all, reason='Powód: Manual (nowa reguła)')

# — Out of „Łazienka": priced as the bathroom pozycja, the only one the katalog has.
put(KITCHEN, 60172, spiek, "spiek Laminam Travertino Beige 8,75 m² klejony w niszy kuchennej (P) — cena j.m. z pozycji łazienkowej",
    unknown="format płyt i stawka — spiek wielkoformatowy może wyjść powyżej 550 zł/m²", insert=True)
put(KITCHEN, 60178, spiek, "fugowanie spieku 8,75 m² — cena j.m. z pozycji łazienkowej", insert=True)
put(WALLS, 60203, 6, "lustra grafitowe klejone poza łazienkami: parter 3 moduły (P), piętro: sypialnia i ściana przy schodach — cena j.m. z pozycji łazienkowej",
    unknown="podział tafli do ustalenia ze szklarzem", insert=True)

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-round-2.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + 1
print(f"{len(draft)} rows: " + ', '.join(f"{s} {n}" for s, n in by.items()))
