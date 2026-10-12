# Builds measure/ai-draft-load.json for production #207 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). Assumptions go into the row's `assumptions`, unknowns into `missingData`.
# Rys. = page of zakamarki-rys-tech-robocze.pdf, wiz. = page of wizualizacje-komplet.pdf. The plans print no
# room dimensions; the scale is taken from the stairs (rys. 7: antresola 161 × 339, tread 27) — 1,165 cm/px
# at 110 dpi — and every area below is measured off rys. 1–4 with it (measurement.md).
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

def pl(x): return f"{x:.2f}".replace(".", ",")

H_DOWN = 2.66  # przekrój A-A (rys. 7) prints 266 on the parter side
H_UP = 2.60    # nothing printed for the piętro → Manual default for rynek wtórny

# Parter, rys. 1/3 (inner faces).
lazienka = (2.63, 1.79)
dziecko = (4.30, 3.05)
sypialnia = (4.30, 3.40)
hol = (3.03, 4.66)
shaft = 0.82 * 0.77          # hatched block beside the stairs, printed 82 × 77 (rys. 7)
stairs = 1.32 * 3.39         # stair flight footprint
A_laz = lazienka[0] * lazienka[1]
A_dz = dziecko[0] * dziecko[1]
A_syp = sypialnia[0] * sypialnia[1]
A_hol = hol[0] * hol[1] - shaft
# Piętro, rys. 2/4: 5,01 × 7,98 gross; the antresola is new floor over the parter hol.
up_gross = 5.01 * 7.98
chimney = 0.55 * 0.79
antresola_rect = 1.61 * 3.39
antresola = antresola_rect - shaft
up_existing = up_gross - stairs - antresola_rect - chimney
A_floor = A_laz + A_dz + A_syp + A_hol + up_existing + antresola

def perim(r): return 2 * (r[0] + r[1])
P_dry = perim(dziecko) + perim(sypialnia) + perim(hol) + 2 * (5.01 + 7.98)

# Ceilings (łazienka apart). The parter hol has slab only beside the stairs; the rest is antresola or void.
ceil_hol_slab = 3.03 * 1.29
ceil_up_suspended = 5.01 * 4.43 - chimney       # „sufit podwieszany h=15cm”, rys. 4, upper 4,43 m of the salon
ceil_up_rest = up_gross - chimney - shaft - 5.01 * 4.43
ceil_existing = A_dz + A_syp + ceil_hol_slab + ceil_up_rest
antresola_fascia = 2.0
stair_soffit = 1.32 * 3.12                       # przekrój A-A prints 312 along the flight
ceil_gk = ceil_up_suspended + antresola + antresola_fascia + stair_soffit

# Pokój dziecka is painted, not structural (mail): walls less window 1,86 × 1,50 and a door 0,90 × 2,05.
walls_dz = perim(dziecko) * H_DOWN - 1.86 * 1.50 - 0.90 * 2.05
STRUCT = 130.0   # client's figure, mail

# Łazienka, rys. 9 rozwinięcia: tiled to the ceiling on every wall.
laz_walls = perim(lazienka) * H_DOWN - 0.80 * 2.05
laz_large = (lazienka[1] + 2 * 0.85) * H_DOWN    # shower recess: back wall 1,79 + two returns 0,85
laz_std = laz_walls - laz_large
old_tiles = perim(lazienka) * 2.0 - 0.80 * 2.0 + A_laz

# Elektryka, rys. 5–6: red = new, yellow = to remove or move.
pts_sockets = 26
pts_light = 18
bruzdy_el = 2 * (pts_sockets + pts_light)

A_PLAN = "wymiary zmierzone z rzutu w skali wziętej ze schodów (antresola 161 × 339, stopień 27 — rys. 7); rzuty nie podają wymiarów pomieszczeń"
A_HDOWN = "wysokość parteru 2,66 m — przekrój A-A (rys. 7)"
A_HUP = "wysokość piętra 2,60 m — rysunek jej nie podaje, Manual: rynek wtórny"

draft = []
def add(i, qty, assumptions=None, missing=None, price=None):
    r = dict(rows[i]); r['qty'] = round(qty, 2)
    if price is not None: r['clientPrice'] = float(price)
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

# — Prace dodatkowe
add(59691, 1, "rynek wtórny, dwa poziomy, poza Warszawą (Marki)",
    "cena j.m. z szablonu 1500 zł; katalog: rynek wtórny ok. 2000 zł, poza Warszawą wyżej — do podniesienia ręcznie")
add(59696, 1, "1 kontener: skucie łazienki, wyburzenie ściany na piętrze, demontaże; mieszkanie z dużym tarasem na piętrze → zakładam wyższe piętro",
    "piętro budynku i winda")

# — Wyburzenia, demontaże, zabezpieczenia
add(59709, A_floor, f"m² podłogi obu poziomów: parter {pl(A_laz + A_dz + A_syp + A_hol)} + piętro {pl(up_existing + antresola)} (z antresolą). " + A_PLAN,
    "czy mieszkanie będzie zamieszkane w trakcie (stawka 45 zł)")
add(59715, 1, "stara łazienka (armatura, WC, brodzik), pralka na parterze, stara kuchnia na piętrze, grzejniki — rynek wtórny",
    "zastany stan — rysunki pokazują tylko stan projektowany")
add(59716, 3, "3 stare ościeżnice: łazienka, pokój dziecka, sypialnia — w ich miejsce drzwi ukryte", "ościeżnice drewniane czy metalowe (+100 zł/szt.)")
add(59719, 4, "łazienka (przeniesienie), pokój dziecka i sypialnia (wymiana), salon (przeniesienie) — rys. 3–4")
add(59720, 50, "jak nowe listwy przypodłogowe")
add(59732, old_tiles, f"stara łazienka: ściany w płytkach do 2,0 m ({pl(perim(lazienka))} mb obwodu minus drzwi) + podłoga {pl(A_laz)} m²",
    "wysokość starych płytek i czy podłoga w płytkach")
add(59733, old_tiles, "jak skuwanie płytek")
add(59739, 3.39 * H_UP, f"„ściana do usunięcia” na piętrze (rys. 4): 3,39 mb × {pl(H_UP)} m, grubość z rzutu ok. 8 cm → materiał miękki do 12 cm",
    "materiał i wysokość ściany — jeśli to GK: 50 zł/m²; jeśli to murek przy antresoli ok. 1,1 m, o 5 m² mniej")
add(59711, 6, "łazienka ok. 2 mb (katalog) + pralka na piętrze ok. 3 mb + przeniesienie c.o. ok. 1 mb")
add(59713, bruzdy_el, f"2 mb na punkt (katalog): {pts_sockets} gniazd/łączników + {pts_light} punktów świetlnych z rys. 5–6; limit 150 mb dla 50–100 m² niedotknięty")

# — Podłogi
add(59775, antresola, f"panele tylko na antresoli ({pl(antresola)} m² = 1,61 × 3,39 minus szacht 0,82 × 0,77), jodełka jak na wizualizacjach — mail: „jak reszta górnego piętra”, czyli reszta zostaje",
    "czy panele idą też na resztę piętra i do sypialni (na rzutach i wizualizacjach wszędzie jodełka)")
add(59751, 50, f"czarna listwa aluminiowa z planszy (wiz. 7); obwód bez łazienki {pl(P_dry)} mb minus ok. 30% na zabudowy",
    "czy listwy wymieniamy, jeśli podłogi zostają")
add(59748, A_laz, "wylewka w łazience po skuciu starej posadzki, pod nowe płytki i niski brodzik")
add(59745, 3.39, "pod wyburzoną ścianą na piętrze")

# — Ściany i sufity bez łazienek
add(59784, 8.0 + 2.26 * H_UP, f"schowek/garderoba pod schodami ok. 8 m² (ścianki wokół schowka, rys. 1 i 7) + „nowa ściana projektowana” na piętrze 2,26 mb × {pl(H_UP)} (rys. 4); wysoki stopień — przy schodach, wzmocnienie OSB",
    "dokładny obrys schowka pod schodami — rzuty pokazują go tylko szkicowo")
add(59782, 1, "drzwi ukryte do schowka w nowej ścianie GK")
add(59786, ceil_gk, f"sufit podwieszany w salonie {pl(ceil_up_suspended)} m² (rys. 4) + spód antresoli {pl(antresola)} m² + czoło antresoli ok. 2 m² + spód biegu schodów {pl(stair_soffit)} m² (bieg 312 cm, rys. 7) — konstrukcję antresoli robi firma zewnętrzna, my tylko GK",
    "czy spód schodów obudowujemy (zależy od firmy schodowej)")
add(59803, 15, "krawędzie antresoli (ok. 5,8 mb × 2 narożniki) + narożnik nowej ściany")
add(59814, STRUCT, "pod farbę strukturalną: grunt + drobne poprawki zamiast pełnej gładzi — Kabric kryje drobne nierówności",
    "czy pod Kabric robimy pełną gładź (rynek wtórny 85 zł/m²: +9 100 zł)")
add(59820, STRUCT, "ok. 130 m² podane w mailu („po za pokojem dziecka i łazienką”), 100 zł/m² jak w mailu; zgadza się z rzutami (ściany bez łazienki i pokoju dziecka ok. 125–150 m² brutto minus otwory)")
add(59809, walls_dz + ceil_existing, f"pokój dziecka — ściany {pl(walls_dz)} m² (malowane, nie strukturalne) + istniejące sufity {pl(ceil_existing)} m² (sypialnie, hol, część piętra bez sufitu podwieszanego). " + A_HDOWN)
add(59806, ceil_gk, "gładź Q4 na nowych sufitach GK — szynoprzewody i światło boczne pokazują każdą nierówność, klienci zwracają uwagę na detal")
add(59812, walls_dz + ceil_existing + ceil_gk, "przed i po gładziach — pod wszystkie gładzie")
add(59816, walls_dz + ceil_existing + ceil_gk, "farba podkładowa na świeże gładzie")
add(59817, ceil_existing + ceil_gk, "wszystkie sufity bez łazienki na biało (wizualizacje)")
add(59822, walls_dz, "pokój dziecka: ściana granatowa + szara (wiz. 6)")
add(59815, P_dry, f"łączenia ścian i sufitów — obwód bez łazienki: dziecko, sypialnia, hol, piętro 5,01 × 7,98")
add(59796, bruzdy_el + 6, "tynkowanie bruzd elektrycznych i wod-kan")
add(59797, 60, "gładź po bruzdach na ścianach pod farbę strukturalną (tam pełnej gładzi nie ma); ściany pokoju dziecka mają gładź całą")

# — Łazienka
add(59830, 8, "prysznic podtynkowy 3 (zimna, ciepła, odpływ brodzika) + umywalka podtynkowa 3 + stelaż WC 2 — rys. 3")
add(59843, laz_walls + 2 * A_laz, f"ściany {pl(laz_walls)} + podłoga + sufit {pl(A_laz)} m² — łazienka {pl(lazienka[0])} × {pl(lazienka[1])}, {A_HDOWN}")
add(59847, laz_walls, "po skuciu starych płytek — wyrównanie pod nowe")
add(59852, laz_walls + A_laz, "folia w płynie na wszystkich ścianach i podłodze (katalog)")
add(59854, 17, "ok. 15 mb na 4 m² (katalog), łazienka 4,7 m²")
add(59850, 1, "przedścianka GK z wnęką na szampony — na rozwinięciu i wizualizacji wnęka z kilkoma półkami podświetlonymi LED (rys. 9, wiz. 1)")
add(59833, 1, "„Zabudowa GK, stelaż podtynkowy” — rys. 3")
add(59834, 1, "zabudowa stelaża GK; wykończenie płytą meblową robi stolarz")
add(59891, 1, "„brodzik niski zlicowany z posadzką” + szyba stała (rys. 3, wiz. 1)",
    "czy odpływ da się zlicować bez obniżenia kanalizacji (jeśli nie: +800 zł)")
add(59868, laz_std, f"ściany poza strefą prysznica, płytki ok. 60 × 120 (rys. 9) — ściany {pl(laz_walls)} minus wielki format {pl(laz_large)}")
add(59869, laz_large, "wielki format pod prysznicem (mail): ściana 1,79 + dwa boki 0,85 × 2,66")
add(59865, laz_large, "mata pod płytki wielkoformatowe (katalog)")
add(59861, A_laz, "podłoga — beżowy gres, format standard (wiz. 1)")
add(59875, laz_walls + A_laz, "fugowanie = wszystkie płytki (Manual)", "fuga epoksydowa czy cementowa")
add(59871, 4, "półki we wnęce — wielki format, ok. 5 półek × 0,3 m + boki")
add(59855, 6, "pion wnęki i skrzynka umywalki z płytek (wiz. 1) — zaniżone, do weryfikacji (katalog: przy wątpliwościach nie zawyżaj)")
add(59877, 16, "WC 5 + prysznic 3 + umywalka 3 + grzejnik 2 + puszki przy lustrze 2 + kratka 1 (katalog)")
add(59876, 25, "Manual: 20–30 mb na łazienkę")
add(59879, perim(lazienka), "styk płytek z sufitem — obwód łazienki")
add(59880, A_laz, "sufit łazienki — jedyna powierzchnia bez płytek")
add(59883, 1, "armatura prysznicowa podtynkowa (rys. 9)")
add(59890, 1)
add(59885, 1, "„umywalka, armatura podtynkowa” — rys. 3")
add(59889, 1)
add(59906, 1, "umywalka na blacie z płytek (wiz. 1)")
add(59915, 1, "szafka pod umywalką (rys. 9)")
add(59911, 1)
add(59895, 1, "grzejnik drabinka — przeniesiony (rys. 3, wiz. 1)")
add(59900, 1, "lustro 125 × 148 (rys. 9)")
add(59896, 1.25 + 1.5, "LED za lustrem 1,25 mb (rys. 5) + LED we wnęce ok. 1,5 mb (wiz. 1)")
add(59897, 1)
add(59899, 2, "plafon + kinkiet (wiz. 1)")
add(59841, 3, "LED za lustrem, LED we wnęce, kinkiet")
add(59842, 2, "gniazdo przy lustrze + przeniesiony łącznik (rys. 5)")
add(59893, 3)
add(59898, 1, "nowa kratka przy remoncie", "wentylator czy kratka")
add(59881, 3, "wieszak na ręcznik, uchwyt na papier, haczyk (rys. 9)")
add(59912, 1, "pralka w kuchni na piętrze, „zasilanie pralka, suszarka” (rys. 6)")
add(59913, 1, "jak pralka")

# — Kuchnia
add(59920, 1.8, "pas między szafkami ok. 3,0 mb × 0,6 m (wiz. 2)", "płytki czy spiek od blaciarza — jeśli spiek, pozycja wypada (−396 zł)")
add(59925, 3, "lodówka, piekarnik, ekspres w zabudowie — „zasilanie ekspres / piekarnik / lodówka” (rys. 6)")
add(59932, 1, "płyta indukcyjna (wiz. 2)")
add(59934, 1)
add(59930, 1)
add(59926, 1)
add(59929, 1)
add(59918, 2.26 * H_UP, "„ściana z płyt GK wzmocnienie płytą osb” pod zabudowę kuchni (rys. 7)")

# — Montaż stolarki
add(59939, 4, "drzwi z ukrytą ościeżnicą malowane farbą strukturalną (mail): łazienka, pokój dziecka, sypialnia, schowek pod schodami",
    "liczba drzwi — rysunki ich nie numerują")

# — Elektryka
add(59951, pts_sockets, "nowe i przenoszone gniazda/łączniki z rys. 5–6: parter ok. 8, piętro ok. 18 (aneks: nadblatowe, lodówka, piekarnik, ekspres, okap, pralka + suszarka; RTV-ściana; łączniki przy schodach)",
    "liczba punktów z rysunków roboczych — projekt jest „w połowie pracy”")
add(59949, pts_light, "nowe punkty świetlne z rys. 5–6: hol 5, sypialnia 2, łazienka 2, piętro 4, zasilanie szyn 2, wyjścia LED 3")
add(59958, 45, "cały osprzęt wymieniany (Simon 55, wiz. 7) — szacunek z rys. 5–6")
add(59959, 2, "łącznik schodowy na dole i na górze schodów (rys. 5–6)")
add(59962, 2, "RTV + internet przy TV w salonie (rys. 6)")
add(59970, 17, "salon ok. 12 mb (obrys na rys. 6, wiz. 4) + sypialnia ok. 5,2 mb (rys. 5, wiz. 5)", "montaż reflektorów na szynach — ich liczba")
add(59971, 2.6, "pionowy profil LED w narożniku salonu przy schodach (wiz. 3, wizualizacja zabudowy)")
add(59974, 6, "LED pod szafkami w kuchni ok. 3 mb + półki w pokoju dziecka ok. 3 mb (wiz. 2, 6); LED w poręczy robią ludzie od schodów")
add(59975, 3, "kuchnia, pokój dziecka, profil w salonie")
add(59969, 14, "plafony i oprawy: hol 5, sypialnia 3, pokój dziecka 1, piętro 5")
add(59976, 1, "„zasilanie okap” (rys. 6)")
add(59982, 1, "nowe obwody: indukcja, piekarnik, pralka/suszarka, ekspres — przy indukcji min. 18 modułów (katalog)")

# — Wod-kan + c.o.
add(59991, 2, "pralka na piętrze: zimna + odpływ (rys. 4)", "czy zlew w kuchni zostaje w miejscu — rysunki nie pokazują zmian wod-kan w aneksie")
add(59987, 2, "„WOD-KAN pralka, do usunięcia” na parterze (rys. 3)")
add(59986, 1, "pokój dziecka — wymiana grzejnika płytowego (rys. 3, wiz. 6)")
add(59989, 2, "sypialnia (wymiana) i salon (przeniesienie) — grzejniki pionowe z wizualizacji (wiz. 4–5)")
add(59990, 6, "przeniesienia: łazienka 2, salon 2; sypialnia — inne podejście pod grzejnik pionowy 2")
add(59992, 3, "łazienka, salon, sypialnia")

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in sorted(by.items(), key=lambda kv: -kv[1]): print(f"{s:42} {v:12.2f}")
print(f"{len(draft)} rows, total {total:.2f}; floor {A_floor:.2f} (parter {A_laz + A_dz + A_syp + A_hol:.2f}, piętro {up_existing + antresola:.2f}), "
      f"ceil_gk {ceil_gk:.2f}, ceil_existing {ceil_existing:.2f}, walls_dz {walls_dz:.2f}, laz_walls {laz_walls:.2f}, laz_large {laz_large:.2f}, P_dry {P_dry:.2f}")
