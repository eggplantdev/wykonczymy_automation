# Builds measure/ai-draft-load.json for #183 from the rozpiska TSV (section/description copied byte-for-byte by id).
# Rows added beyond the rozpiska carry a katalog price only where the katalog names the same operation;
# otherwise 0 zł + „brak w katalogu — do wyceny" in missingData (procedure rule 9). Every assumption goes into
# the row's `assumptions`, every unknown into `missingData`, one per line (owner, 2026-10-09).
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-183.tsv'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line: continue
        i, sec, desc, unit, price = line.split('\t')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

r2 = lambda x, n=2: round(x + 1e-9, n)
H = 2.68                      # house rule for a stan deweloperski; the rzut prints only rzędne
DOOR = 0.90 * 2.05            # ASSUMED interior door opening
ENTRY = 1.00 * 2.10           # ASSUMED entrance door

A_H = "wysokość 2,68 m (stan deweloperski, Wiedza firmowa) — rzut podaje tylko rzędne ±0,00 / +3,15 / +6,20"
A_SALON = "obwód salonu z kuchnią 31 mb — kształt L ok. 5,70 × 8,9 z krawędzią schodów"
A_WINDOWS = "wysokości okien: O1 180×150, OB-1P 270×230, 2× O2 150×160, 2× OB4 90×230 (rzut podaje szerokości)"
A_DOORS = "drzwi wewnętrzne 0,90 × 2,05, wejściowe 1,00 × 2,10 — odliczone"
A_STAIR = "ściany klatki schodowej nad stropem parteru ≈ 15 m²"
A_KITCHEN = "zabudowa kuchni 4,0 mb wzdłuż ściany — ściana za nią bez gładzi (Wiedza firmowa)"
A_WC_TAPETA = "tapeta w WC na 2 ścianach 1,80 + 1,03 (wizualizacja, długości z rzutu WC)"
A_SHOWER = "walk-in na szerokość 1,85 m, 1,0 m w głąb, hydroizolacja ścian do 2,0 m"
A_BATH_MICRO = "ściany łazienki w mikrocemencie na pełną wysokość (wizualizacja)"
A_WHITE = "wszystko na biało (klient: „głównie na biało”)"
M_TYNKI = "jakie tynki daje deweloper — przy gipsowych maszynowych gładź może odpaść"
M_WALLS = [M_TYNKI]
A_WALLS = [A_H, A_SALON, A_WINDOWS, A_DOORS]
M_POD = "przekrój dachu: wysokość ścianki kolankowej, kąt, membrana, istniejące ocieplenie"
A_POD = "poddasze bez przekroju: obrys 5,70 × 11,37, kąt dachu 35° → podłoga ≈ 59 m², skosy ≈ 72 m², szczyty ≈ 32 m²"
M_REK = "co przygotował deweloper pod rekuperację (kanały w stropach, szacht, miejsce na centralę)"
NEW = "brak w katalogu — do wyceny"

# printed m² (rzut); perimeter from printed side lengths, or area / printed side
rooms = dict(
    salon=(46.70, 31.0),                      # L-shape 5,70 × ~8,9 incl. stair edge — ASSUMED perimeter
    sien=(3.64, 2 * (2.08 + 1.75)),
    pokoj=(18.98, 2 * (3.65 + 18.98 / 3.65)),
    garderoba=(9.88, 2 * (4.02 + 9.88 / 4.02)),
    hobby=(10.29, 2 * (4.02 + 10.29 / 4.02)),
    hall=(4.33, 2 * (2.20 + 4.33 / 2.20)),
)
A_wc, P_wc = 1.85, 2 * (1.03 + 1.80)
A_bath, P_bath = 5.54, 2 * (1.85 + 2.96)
A_gen = sum(a for a, _ in rooms.values())
P_gen = sum(p for _, p in rooms.values())
A_floor = A_gen + A_wc + A_bath                      # = Pu1 + Pu2 = 101,21

# openings in the general rooms: 4 doors seen from both sides, WC + łazienka doors from one side, entrance,
# windows: O1 180×150, OB-1P 270×230, 2× O2 150×160, 2× OB4 90×230 (widths read, heights ASSUMED)
windows = 1.80 * 1.50 + 2.70 * 2.30 + 2 * 1.50 * 1.60 + 2 * 0.90 * 2.30
openings = 10 * DOOR + ENTRY + windows
walls_net = P_gen * H - openings
stairwell = 15.0                                     # ASSUMED walls of the stair shaft above the parter ceiling
kitchen_run = 4.0                                    # ASSUMED kitchen wall run incl. tall units
kitchen_walls = kitchen_run * H
gladz_walls = walls_net + stairwell - kitchen_walls
# WC: 2 walls tapeta (1,80 + 1,03 assumed), rest painted with the łazienka position
wc_tapeta = (1.80 + 1.03) * H
wc_painted = P_wc * H - DOOR - wc_tapeta
bath_walls = P_bath * H - DOOR
shower_walls = (1.85 + 1.00) * 2.0                   # ASSUMED walk-in across the 1,85 width, 1,0 deep
corners_in = 24
acryl = P_gen + corners_in * H
glify = (1.50 * 2 + 1.80) + (2.30 * 2 + 2.70) + 2 * (1.60 * 2 + 1.50) + 2 * (2.30 * 2 + 0.90)
narozniki = glify + 6 * H
listwy = P_gen - kitchen_run - (rooms['garderoba'][1] - 0.90) - 0.90 * (4 * 2 + 2) - 1.00
parapety = 1.80 + 2 * 1.50 + 3 * 0.10

wall_pts = dict(schody_led=8, kuchnia_led=1, garderoba_led=1, wnęka_wc=1, wnęka_łazienka=1, wyspa=1)
n_wall = sum(wall_pts.values())
ceil_pts = 1                                         # pendants over the wyspa

# poddasze (ASSUMED until a section drawing: obrys 5,70 × 11,37 minus stair box, pitch 35°)
POD_floor = 59.0
POD_slopes = 72.0
POD_gables = 32.0
POD_P = 34.0

def r(i, qty, assumptions=(), missing=()):
    return (i, qty, list(assumptions), list(missing))

pick = [
 # Prace dodatkowe
 r(53571, 1, ["1 kpl dla domu ~100 m² + poddasze (rozpiska 1 500 zł; próg katalogu dla tej wielkości 2 000 zł)"]),
 r(53574, 2, ["≈ 2 big bagi — stan deweloperski bez wyburzeń: opakowania, docinki"]),
 # Wyburzenia, demontaże, zabezpieczenia
 r(53589, 4, ["≈ 2 mb na łazienkę (Wiedza firmowa) × WC i łazienka"]),
 r(53591, r2(2.5 * n_wall, 1), ["≈ 2,5 mb bruzdy na punkt (katalog)",
     f"{n_wall} nowych punktów ściennych: " + ", ".join(f"{k} {v}" for k, v in wall_pts.items())]),
 r(53592, r2(2.5 * ceil_pts, 1), ["1 punkt sufitowy nad wyspą w stropie żelbetowym, ≈ 2,5 mb (katalog)"]),
 r(53623, r2(A_floor), ["zabezpieczenia = m² podłóg (katalog)"]),
 # Podłogi
 r(53639, r2(listwy, 1), [A_SALON, "bez listew wzdłuż zabudowy kuchni (4,0 mb) i w garderobie (zabudowa)", "drzwi 0,90 m odliczone"]),
 # Ściany i sufity bez łazienek
 r(53664, r2(acryl, 1), [A_SALON, f"{corners_in} narożniki pionowe × wysokość", A_H]),
 r(53666, stairwell, [A_STAIR + " — dostęp z rusztowania"]),
 r(53667, r2(A_gen), [], M_WALLS),
 r(53669, r2(gladz_walls + wc_tapeta), A_WALLS + [A_STAIR, A_KITCHEN, "ściany WC pod tapetę też z gładzią — " + A_WC_TAPETA], M_WALLS),
 r(53674, r2(gladz_walls + wc_tapeta + A_gen), ["= gładź ścian + sufitów"] + A_WALLS + [A_STAIR, A_KITCHEN], M_WALLS),
 r(53682, r2(walls_net + stairwell + A_gen), [A_WHITE, "ściana za zabudową kuchni też malowana"] + A_WALLS + [A_STAIR], ["kolory ścian"]),
 r(53698, r2(2.5 * (n_wall + ceil_pts), 1), ["= długość bruzd elektrycznych"]),
 r(53706, r2(wc_tapeta), [A_WC_TAPETA, A_H]),
 r(53711, r2(narozniki, 1), [A_WINDOWS, "6 narożników zewnętrznych na pełną wysokość", A_H]),
 # Łazienka (WC parter + łazienka piętro)
 r(53715, r2(P_wc + P_bath, 1), []),
 r(53718, 1),
 r(53720, r2(A_bath * 2 + bath_walls + A_wc, 1), ["łazienka: podłoga + sufit + ściany pod mikrocement; WC: tylko podłoga", A_BATH_MICRO, A_H]),
 r(53728, r2(A_bath + A_wc + wc_painted, 1), ["sufity łazienki i WC + ściany WC bez tapety", A_WC_TAPETA, A_H]),
 r(53729, 6, ["po 3 akcesoria w WC i łazience"], ["ile akcesoriów"]),
 r(53730, 2, ["baterie umywalkowe stojące — na wizualizacjach umywalki na szafkach"]),
 r(53731, 1),
 r(53738, 2),
 r(53742, 2, ["wnęki LED w WC i w prysznicu po ~1 mb (wizualizacje, bez wymiaru)"]),
 r(53745, 5, ["wpusty: WC 2, łazienka 3"], ["wpusty w łazience i WC wymagają sufitu podwieszanego — czy go robimy"]),
 r(53747, 2),
 r(53749, 1, ["odpływ jednospadkowy (pod mikrocement)"]),
 r(53752, 2),
 r(53754, 2, ["syfony obu umywalek"]),
 r(53755, 1),
 r(53756, 2),
 r(53761, 2),
 r(53765, r2(A_bath + shower_walls, 1), ["podłoga łazienki + ściany strefy prysznica", A_SHOWER]),
 r(53767, 25, ["20–30 mb na łazienkę (Wiedza firmowa): łazienka 20, WC 5 (bez prysznica)"]),
 r(53788, r2(A_bath / 4 * 15, 1), ["≈ 15 mb na łazienkę 4 m² (Wiedza firmowa), przeskalowane do 5,54 m²"]),
 r(53791, 1, ["wnęka LED w prysznicu = przedścianka z 1 półką (wizualizacja)"]),
 r(53795, 2, ["zasilanie wnęk LED w WC i łazience"]),
 r(53739, 5, ["osprzęt: WC 2, łazienka 3"]),
 r(53799, 2, ["szafki pod umywalkami kupne — montujemy my"], ["szafki robi stolarz z zabudowami czy kupne"]),
 # Kuchnia
 r(53801, 1, ["zabudowa lodówki; montaż AGD klienta po naszej stronie"], ["kto montuje AGD — klient: bez sprzętu AGD"]),
 r(53802, 1, ["zlew w ciągu przyściennym, wyspa bez wody"], ["czy w wyspie ma być zlew lub płyta"]),
 r(53803, 3.5, ["LED pod szafkami 3,5 mb (wizualizacja, bez wymiaru)"]),
 r(53805, 1, ["syfon zlewu w ciągu przyściennym"]),
 r(53806, 1, ["zlew w ciągu przyściennym"]),
 r(53808, 1, ["płyta indukcyjna w ciągu przyściennym"]),
 r(53809, 1, ["piekarnik w zabudowie"]),
 r(53810, 1, ["zmywarka w zabudowie"]),
 # Montaż stolarki
 r(53824, 6, ["ościeżnice regulowane"], ["drzwi zwykłe czy ukryte"]),
 r(53827, r2(parapety, 1), ["parapety wewnętrzne O1 + 2× O2, +10 cm na okno; drzwi balkonowe bez parapetu"], ["czy parapety są w standardzie dewelopera"]),
 r(53831, r2(parapety, 1), ["= długość parapetów"]),
 # Instalacja elektryczna
 r(53844, 46, ["osprzęt stanu deweloperskiego ok. 45 pkt (salon z kuchnią 20, pokój 8, hobby 6, sień 4, hall 4, garderoba 3) + wyspa"],
   ["liczba punktów dewelopera"]),
 r(53848, 8, ["oprawy LED przy schodach co drugi stopień (wizualizacja)"]),
 r(53852, 1, ["okap jako pochłaniacz — dom ma rekuperację"]),
 r(53854, 10, ["lampy: salon 2, nad wyspą 3, sień, pokój, garderoba, hobby, hall po 1"]),
 r(53859, 4, ["zasilacze LED: kuchnia, schody, wnęka WC, wnęka łazienki"]),
 r(53862, 2, ["włączniki schodowe parter/piętro"]),
 r(53870, 11, ["nowe punkty: oprawy schodowe 8, nad wyspą 1, LED kuchnia 1, LED garderoba 1"]),
 r(53872, 1, ["gniazdo w wyspie"]),
 # Instalacja wod-kan
 r(53879, 1, ["dopasowanie podejścia zlewu do projektu kuchni"]),
]

main_added = [
 ("Podłogi", "Posadzki z mikrocementu sama robocizna", "m²", 500, r2(A_floor),
  ["mikrocement na wszystkich podłogach, łącznie z WC i łazienką (klient: preferowany)"],
  ["mikrocement czy winyl — klient prosi o porównanie", "czy pod mikrocement trzeba wyrównać wylewkę dewelopera"]),
 ("Łazienka", "Mikrocement na ścianach łazienki", "m²", 0, r2(bath_walls), [A_BATH_MICRO, A_H, "drzwi 0,90 × 2,05 odliczone"],
  [NEW + " — najbliżej: Posadzki z mikrocementu 500 zł/m², Mikrocement gabinet 650 zł/m²"]),
 ("Łazienka", "Wykuwanie wnęki pod półeczkę + GK", "szt", 500, 1, ["podświetlona wnęka nad stelażem WC (wizualizacja)"], []),
 ("Montaż stolarki i ślusarski", "Montaż okładzin drewnianych stopni i podstopni na schodach betonowych", "stopień", 0, 17,
  ["okładziny drewniane na 17 stopniach parter → piętro (rzut, klient: drewno)"],
  [NEW + " — najbliżej: Cyklinowanie schodów stopień+podstopień 380 zł/szt, Ułożenie gresu na stopniach 220 zł/szt",
   "jakie drewno, nakładki czy pełne stopnie, podstopnice, spód biegu"]),
 ("Montaż stolarki i ślusarski", "Montaż balustrady i poręczy drewnianej", "kpl", 0, 1,
  ["drewniana poręcz i balustrada wzdłuż biegu i otworu na piętrze (wizualizacja)"], [NEW, "kto dostarcza balustradę"]),
]

POD = "Poddasze (osobna wycena)"
pod = [
 (POD, "Ocieplenie skosów — układanie wełny między krokwiami", "m²", 45, POD_slopes, [A_POD, "jedna warstwa wełny"], [M_POD]),
 (POD, "Folia paroizolacyjna ściany i sufity", "m²", 20, POD_slopes, ["= powierzchnia skosów", A_POD], [M_POD]),
 (POD, "Zabudowa skosów płytą GK na stelażu", "m²", 0, POD_slopes, ["= powierzchnia skosów", A_POD],
  [NEW + " — najbliżej: Przedścianka z GK + folia 150 zł/m², Zabudowa ścian z GK na stelażu 250 zł/m², Sufit podwieszany niski stopień 160 zł/m²", M_POD]),
 (POD, rows[53667]['description'], "m²", 59, POD_slopes, ["gładź na skosach z GK", A_POD], [M_POD]),
 (POD, rows[53709]['description'], "m²", 60, POD_gables, ["2 ściany szczytowe, mur ceramiczny bez tynku", A_POD], ["szczyty: tynk czy płytki cegłopodobne"]),
 (POD, rows[53674]['description'], "m²", 12, POD_slopes + POD_gables, ["skosy + szczyty", A_POD], [M_POD]),
 (POD, rows[53682]['description'], "m²", 22, POD_slopes + POD_gables, ["skosy + szczyty na biało", A_POD], [M_POD]),
 (POD, rows[53664]['description'], "mb", 14, 36.7, ["styki skosów ze ścianami kolankowymi i szczytami ≈ 36,7 mb", A_POD], [M_POD]),
 (POD, rows[53657]['description'], "m²", 60, POD_floor,
  ["panele na istniejącej płycie OSB (rzut: „płyta OSB”, wizualizacja poddasza)", "podłoga = obrys minus otwór schodów; wydrukowane 32,38 m² to powierzchnia ważona wysokością", A_POD], []),
 (POD, rows[53639]['description'], "mb", 45, POD_P, ["obwód poddasza ≈ 34 mb", A_POD], []),
 (POD, rows[53824]['description'], "szt", 380, 1, [], []),
 (POD, "Montaż okładzin drewnianych stopni i podstopni na schodach betonowych", "stopień", 0, 17,
  ["okładziny drewniane na 17 stopniach piętro → strych (rzut)"], [NEW + " — najbliżej: Cyklinowanie schodów stopień+podstopień 380 zł/szt"]),
 (POD, "Montaż balustrady i poręczy drewnianej", "kpl", 0, 1, ["bieg na strych + otwór w podłodze strychu"], [NEW]),
 (POD, rows[53872]['description'], "szt", 130, 10, ["pracownia/magazyn: 10 gniazd"], ["układ pomieszczenia na poddaszu"]),
 (POD, rows[53870]['description'], "szt", 100, 5, ["4 punkty oświetlenia + zasilanie taśmy LED"], []),
 (POD, rows[53868]['description'], "mb", 40, 60, ["przewody za GK, ok. 4 mb na punkt × 15"], []),
 (POD, rows[53844]['description'], "szt", 39, 13, ["10 gniazd + 3 włączniki"], []),
 (POD, rows[53854]['description'], "szt", 100, 4, ["4 oprawy"], []),
 (POD, rows[53858]['description'], "mb", 60, 20, ["taśma LED pod skosami 2 × 10 mb (wizualizacja, bez wymiaru)"], []),
 (POD, rows[53859]['description'], "szt", 120, 2, ["2 zasilacze LED"], []),
 (POD, rows[53866]['description'], "szt", 200, 3, ["osobne obwody: gniazda, oświetlenie, LED"], []),
 (POD, rows[53862]['description'], "szt", 70, 2, ["oświetlenie biegu na strych z dwóch miejsc"], []),
]

REK = "Rekuperacja (osobna wycena)"
rek = [
 (REK, "Rozprowadzenie kanałów rekuperacji", "mb", 120, 100,
  ["10 anemostatów × ~8 mb + czerpnia/wyrzutnia ~20 mb", "cena z katalogu: „Montaż wentylacji” 120 zł/mb"], [M_REK]),
 (REK, "Montaż i uruchomienie centrali rekuperacyjnej", "kpl", 0, 1, ["centrala na strychu"],
  [NEW + " — najbliżej: Montaż klimatyzacji + uruchomienie 600 zł", "jaką centralę wybiera klient"]),
 (REK, rows[53744]['description'], "kpl", 100, 10,
  ["nawiew: salon 2, pokój, hobby, garderoba, poddasze 2; wywiew: kuchnia, WC, łazienka"], [M_REK]),
 (REK, rows[53584]['description'], "kpl", 350, 2, ["czerpnia i wyrzutnia"], [M_REK]),
 (REK, rows[53581]['description'], "kpl", 150, 1, ["odprowadzenie skroplin z centrali"], []),
 (REK, rows[53872]['description'], "szt", 130, 1, ["zasilanie centrali"], []),
 (REK, rows[53714]['description'], "mb", 350, 6, ["pion kanałów z poddasza na parter w zabudowie GK, 6 mb"], [M_REK]),
]

out, totals = [], {}
def add(section, description, unit, price, qty, assumptions, missing, group):
    row = dict(section=section, description=description, qty=qty, unit=unit, clientPrice=float(price))
    if missing: row['missingData'] = '\n'.join(missing)
    if assumptions: row['assumptions'] = '\n'.join(assumptions)
    out.append(row)
    totals[group] = totals.get(group, 0) + qty * price

for i, q, a, m in pick:
    p = rows[i]
    add(p['section'], p['description'], p['unit'], p['clientPrice'], q, a, m, 'dom')
for s, d, u, p, q, a, m in main_added: add(s, d, u, p, q, a, m, 'dom')
for s, d, u, p, q, a, m in pod: add(s, d, u, p, q, a, m, 'poddasze')
for s, d, u, p, q, a, m in rek: add(s, d, u, p, q, a, m, 'rekuperacja')

with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"rows {len(out)}  " + "  ".join(f"{k} {v:,.2f}" for k, v in totals.items()) + f"  razem {sum(totals.values()):,.2f}")
mikro = r2(A_floor) * 500
winyl = (A_gen) * 60 + (A_wc + A_bath) * 180
print(f"wariant: mikrocement {mikro:,.2f} vs winyl klejony układ prosty {A_gen:.2f}×60 + gres WC/łazienka {A_wc + A_bath:.2f}×180 = {winyl:,.2f}  różnica {mikro - winyl:,.2f}")
for k, v in dict(A_gen=A_gen, P_gen=P_gen, A_floor=A_floor, windows=windows, openings=openings, walls_net=walls_net,
                 kitchen_walls=kitchen_walls, gladz_walls=gladz_walls, wc_tapeta=wc_tapeta, wc_painted=wc_painted,
                 bath_walls=bath_walls, acryl=acryl, narozniki=narozniki, listwy=listwy, parapety=parapety).items():
    print(f"{k}: {v:.2f}")
by_sec = {}
for o in out: by_sec[o['section']] = by_sec.get(o['section'], 0) + o['qty'] * o['clientPrice']
for s, v in by_sec.items(): print(f"  {s.strip()}: {v:,.2f}")
print("bez ceny:", [o['description'][:60] for o in out if o['clientPrice'] == 0])
