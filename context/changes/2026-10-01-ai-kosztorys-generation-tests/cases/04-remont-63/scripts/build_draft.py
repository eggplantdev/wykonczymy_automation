# Builds measure/ai-draft-load.json for production #185 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). Under the „agent nie zakłada" rule only quantities read from the rzut / mail /
# photos, or derived by a house rule with its source named, are written; everything else is a question in
# the notes (investment-notes-appendix.txt).
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

H = 2.60                      # house clear height, rynek wtórny (owner, 2026-10-08); the scan prints none
H_SRC = "H 2,60 — rynek wtórny, reguła domowa"

# printed m² on the rzut; a missing side = m² ÷ the printed one
dry_rooms = dict(salon=14.5, pokoj_harmonijka=9.5, kuchnia=4.5, przedpokoj=8.0, pom_098=0.98, pokoj_11_8=11.8, pokoj_9_1=9.1)
A_dry = sum(dry_rooms.values())
floor_tiles = dry_rooms['przedpokoj'] + dry_rooms['kuchnia']
P_wc = 2 * (0.93 + 1.4 / 0.93)                          # printed 0,93 and 1,4 m²
kitchen_w = 4.5 / 3.12
# The przedpokój prints no sides, so it has no perimeter; the kuchnia walls are behind units on both
# long sides (photo; gładź excludes them, owner's notes). The łazienka extension is a corner notch of
# pokój 11,8, which keeps that room's perimeter.
gladz_perimeters = dict(salon=2 * (3.97 + 3.65), pokoj_harmonijka=2 * (2.25 + 9.5 / 2.25),
                        pokoj_11_8=2 * (3.97 + 2.97), pokoj_9_1=2 * (2.31 + 9.1 / 2.31), pom_098=2 * (1.41 + 0.98 / 1.41))
P_gladz = sum(gladz_perimeters.values())
walls_gross = P_gladz * H
gladz = walls_gross + A_dry
WALLS_SRC = (f"ściany {walls_gross:.2f} m² = obwody salonu, pokoi 9,5 / 11,8 / 9,1 i pom. 0,98 z rzutu × {H_SRC}; "
             "brutto — wymiary okien i drzwi niepodane; bez przedpokoju (obwód niepodany) i kuchni (zabudowa)")
# old łazienka 1,70 × 1,79, tiled to the ceiling (photo); WC and kuchnia wall tiles stop part-way, height unread
skuwanie_walls = 2 * (1.70 + 1.79) * H
skuwanie_floors = 3.0 + 1.4 + dry_rooms['kuchnia']
walls_removed = (1.79 + kitchen_w) * H

el_sockets, el_switches, el_stair, el_lights = 26, 9, 2, 12
el_points = el_sockets + el_switches + el_stair
bruzdy_el = (el_points + el_lights) * 2.5

pick = [
    (50454, 63, "metraż z maila; zabezpieczenia = m² podłogi (katalog: Komentarz do pracy)"),
    (50432, 1, "armatura łazienki i WC, zabudowa kuchni — kpl wg ilości pracy (notatki ownera #181)"),
    (50450, walls_removed, f"łazienka–sypialnia 1,79 + kuchnia–przedpokój {kitchen_w:.2f} (szerokość kuchni) z rzutu × {H_SRC}; brutto, z otworem drzwi"),
    (50437, skuwanie_walls + skuwanie_floors, f"ściany starej łazienki 1,70 × 1,79 (płytki do sufitu na zdjęciu) × {H_SRC}, brutto + podłogi łazienki 3,0, WC 1,4, kuchni 4,5; bez ścian WC i kuchni (wysokość płytek nieznana)"),
    (50440, skuwanie_walls, "ściany starej łazienki po skuciu"),
    (50443, 6, "6 skrzydeł na rzucie: salon, kuchnia, łazienka, WC, pokoje 11,8 i 9,1"),
    (50444, 8.0, "mail: parkiet w przedpokoju; 8,0 m² z rzutu"),
    (50447, 1, "mail: otwór do pomieszczenia przy WC"),
    (50422, bruzdy_el, f"{el_points + el_lights} punktów z maila × ≈ 2,5 mb (katalog: Komentarz do pracy)"),
    (50529, bruzdy_el, "mail: obrobienie miejsc po bruzdowaniu; = bruzdy"),
    (50420, 4, "≈ 2 mb na łazienkę (notatki ownera #181) × łazienka + WC"),
    (50406, 1, "mail: wyniesienie gruzu do kontenera"),
    (50402, 1, "ryczałt dla małego mieszkania (katalog: Komentarz do pracy)"),
    (50478, floor_tiles, "mail: wejście, przedpokój, kuchnia; przedpokój 8,0 + kuchnia 4,5 z rzutu"),
    (50462, floor_tiles, "fugowanie = m² płytek (katalog: Komentarz do pracy)"),
    (50463, floor_tiles, "mail: gruntowanie podłoża; = m² płytek"),
    (50502, gladz, f"mail: siatka + tynk + gładź; {WALLS_SRC}; + sufity {A_dry:.2f} z rzutu"),
    (50496, gladz, "mail: położenie siatki; jak gładź"),
    (50505, gladz, "mail: gruntowanie; jak gładź"),
    (50503, gladz, "jak gładź"),
    (50514, walls_gross, f"mail: ściany w kolory; {WALLS_SRC}"),
    (50495, P_gladz, "mail: akryle; styk ściana/sufit = obwody jak przy gładzi, bez przedpokoju"),
    (50508, A_dry, "suma m² pokoi, kuchni, przedpokoju i pom. 0,98 z rzutu — poszerzenie łazienki przeniesie część do łazienki"),
    (50546, 3 + 3 + 2 + 2, "punkt = zimna + ciepła + kanalizacja (katalog): umywalka 3, prysznic 3, pralka 2 (zdjęcie), geberit 2"),
    (50598, 25 + 20, "20–30 mb na łazienkę (notatki ownera): łazienka 25, WC 20"),
    (50619, 15 + P_wc, "≈ 15 mb na łazienkę ~4 m² (notatki ownera) + obwód WC 0,93 × 1,50 z rzutu"),
    (50617, (2 + 3 + 2 + 1 + 2) + 5, "otwory wg armatury (notatki ownera): prysznic natynkowy 2, umywalka 3, grzejnik 2, pralka 1, lustro 2; WC geberit 5"),
    (50569, 1, "mail: WC — geberit"),
    (50583, 1, "mail: WC — geberit"),
    (50592, 1, "mail: WC — biały montaż"),
    (50567, 1, "mail: łazienka — brodzik, kabina"),
    (50563, 1, "mail: łazienka — zestaw natynkowy"),
    (50588, 1, "mail: łazienka — biały montaż"),
    (50561, 1, "mail: łazienka — biały montaż"),
    (50585, 1, "mail: łazienka — biały montaż"),
    (50572, 1, "mail: łazienka — grzejnik"),
    (50594, 1, "pralka na zdjęciu łazienki"),
    (50705, 1, "mail: nowy grzejnik na powstałej ścianie"),
    (50709, 2, "nowy grzejnik: zasilanie + powrót"),
    (50703, el_points, "mail: 26 gniazdek + 9 włączników + 2 schodowe; z puszką"),
    (50701, el_lights, "mail: 12 punktów oświetlenia"),
    (50675, el_sockets + el_switches, "mail: osprzęt gniazdek i włączników"),
    (50693, el_stair, "mail: 2 schodowe w przedpokoju"),
    (50694, 1, "mail: 6 bezpieczników + różnicowy + główny (≤ 12 modułów)"),
]
S_EXTRA = rows[50406]['section']
added = [
    (S_EXTRA, "Sprzątanie pomieszczeń po remoncie, rozklejanie zabezpieczeń", "kpl", 0, 1,
     "mail: sprzątanie, rozklejanie — brak w katalogu, do wyceny"),
]

out, by_sec = [], {}
def add(section, description, unit, price, qty, src):
    qty = round(qty + 1e-9, 2)
    out.append(dict(section=section, description=description, qty=qty, unit=unit, clientPrice=float(price), note=f"AI: {src}"))
    by_sec[section.strip()] = by_sec.get(section.strip(), 0) + qty * price

for i, q, src in pick:
    p = rows[i]
    add(p['section'], p['description'], p['unit'], p['clientPrice'], q, src)
for s, d, u, p, q, src in added: add(s, d, u, p, q, src)

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"rows {len(out)}  razem {sum(by_sec.values()):,.2f}  A_dry {A_dry:.2f}  P_wc {P_wc:.2f}")
for s, v in by_sec.items(): print(f"  {s}: {v:,.2f}")
