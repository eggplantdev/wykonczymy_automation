# Builds measure/ai-draft-load.json for #183 from the rozpiska TSV (section/description copied byte-for-byte by id).
# Rows added beyond the rozpiska carry a katalog price only where the katalog names the same operation;
# otherwise 0 zł + „brak w katalogu — do wyceny" (procedure rule 4).
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-183.tsv'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line: continue
        i, sec, desc, unit, price = line.split('\t')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

r = lambda x, n=2: round(x + 1e-9, n)
H = 2.75                      # ASSUMED clear height: floor-to-floor 3,15 / 3,05 minus slab + floor layers
DOOR = 0.90 * 2.05            # ASSUMED interior door opening
ENTRY = 1.00 * 2.10           # ASSUMED entrance door

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

pick = [
 # Prace dodatkowe
 (53571, 1, "assumed — transport i wniesienie, dom ~100 m² + poddasze (próg katalogu 2 000, rozpiska 1 500)"),
 (53574, 2, "assumed — stan deweloperski bez wyburzeń: odpady, opakowania, docinki ≈ 2 big bagi"),
 # Wyburzenia, demontaże, zabezpieczenia
 (53589, 4, "assumed — zasada 2 mb wod-kan na łazienkę × 2 (WC, łazienka)"),
 (53591, r(2.5 * n_wall, 1), f"assumed — zasada 2,5 mb/pkt × {n_wall} pkt ściennych: " + ", ".join(f"{k} {v}" for k, v in wall_pts.items())),
 (53592, r(2.5 * ceil_pts, 1), "assumed — 1 pkt sufitowy nad wyspą w stropie żelbetowym"),
 (53623, r(A_floor), "read — zasada: zabezpieczenia = m² podłóg, Pu1 52,19 + Pu2 49,02"),
 # Podłogi
 (53639, r(listwy, 1), "measured — obwody pokoi minus zabudowa kuchni 4,0, garderoba (zabudowa), otwory drzwiowe"),
 # Ściany i sufity bez łazienek
 (53664, r(acryl, 1), f"measured — styk sufit-ściana {P_gen:.1f} mb + {corners_in} narożniki × {H}"),
 (53666, stairwell, "assumed — ściany klatki schodowej powyżej stropu parteru ≈ 15 m² (dostęp z rusztowania)"),
 (53667, r(A_gen), "read — sufity bez łazienek = m² z rzutu: salon z kuchnią, sień, pokój, garderoba, hobby, hall"),
 (53669, r(gladz_walls + wc_tapeta), f"measured — ściany netto {walls_net:.1f} + klatka {stairwell:.0f} − za zabudową kuchni {kitchen_walls:.1f} + WC pod tapetę {wc_tapeta:.1f} (H {H} assumed)"),
 (53674, r(gladz_walls + wc_tapeta + A_gen), "measured — = gładź ścian + sufitów"),
 (53682, r(walls_net + stairwell + A_gen), "measured — ściany netto + klatka + sufity; biało (klient: głównie na biało)"),
 (53698, r(2.5 * (n_wall + ceil_pts), 1), "assumed — = długość bruzd elektrycznych"),
 (53706, r(wc_tapeta), "read — wizualizacja WC: tapeta w liście na 2 ścianach (1,80 + 1,03 assumed) × H"),
 (53711, r(narozniki, 1), "measured — glify okien i drzwi balkonowych (wysokości assumed) + 6 narożników zewn."),
 # Łazienka (WC parter + łazienka piętro)
 (53715, r(P_wc + P_bath, 1), "measured — styk sufit-ściana: WC 5,66 + łazienka 9,62"),
 (53718, 1, "read — wizualizacja łazienki: deszczownica + słuchawka, bateria podtynkowa"),
 (53720, r(A_bath * 2 + bath_walls + A_wc, 1), "measured — łazienka podłoga + sufit + ściany (pod mikrocement) + podłoga WC"),
 (53728, r(A_bath + A_wc + wc_painted, 1), f"measured — sufity łazienki i WC + ściany WC bez tapety {wc_painted:.1f}"),
 (53729, 6, "assumed — po 3 akcesoria w WC i łazience"),
 (53730, 2, "assumed — baterie umywalkowe stojące (wizualizacje: umywalki na szafkach)"),
 (53731, 1, "read — wizualizacja: bateria podtynkowa w prysznicu"),
 (53738, 2, "read — wizualizacje: WC podwieszane w WC i łazience"),
 (53742, 2, "read — wizualizacje: wnęka LED w WC (nad stelażem) i w prysznicu, ~1 mb każda"),
 (53745, 5, "assumed — wpusty: WC 2, łazienka 3"),
 (53747, 2, "read — wizualizacje: okrągłe lustro LED w WC, lustro LED w łazience"),
 (53749, 1, "read — wizualizacja: walk-in z odpływem liniowym; jednospadkowy assumed (mikrocement)"),
 (53752, 2, "read — wizualizacje: zabudowa stelaży WC"),
 (53754, 2, "assumed — syfony umywalek"),
 (53755, 1, "read — wizualizacja: stała szyba walk-in"),
 (53756, 2, "read — wizualizacje: umywalki na szafkach"),
 (53761, 2, "read — wizualizacje: WC podwieszane"),
 (53765, r(A_bath + shower_walls, 1), f"measured — podłoga łazienki 5,54 + ściany strefy prysznica {shower_walls:.1f} (do 2,0 m)"),
 (53767, 25, "assumed — zasada 20–30 mb na łazienkę: łazienka 20 + WC 5"),
 (53788, r(A_bath / 4 * 15, 1), "assumed — zasada ≈ 15 mb na 4 m² łazienki"),
 (53791, 1, "read — wizualizacja: wnęka LED w prysznicu → przedścianka z 1 półką"),
 (53795, 2, "assumed — zasilanie wnęk LED (WC, łazienka)"),
 (53739, 5, "assumed — osprzęt: WC 2, łazienka 3"),
 (53799, 2, "read — wizualizacje: szafki pod umywalkami (jeżeli nie robi ich stolarz)"),
 # Kuchnia
 (53801, 1, "assumed — zabudowa lodówki; klient: bez sprzętu AGD, montaż po naszej stronie assumed"),
 (53802, 1, "assumed — bateria zlewozmywakowa"),
 (53803, 3.5, "read — wizualizacja: LED pod szafkami, długość 3,5 mb assumed"),
 (53805, 1, "assumed — syfon zlewu"),
 (53806, 1, "assumed — zlew w ciągu przyściennym"),
 (53808, 1, "assumed — płyta indukcyjna"),
 (53809, 1, "assumed — piekarnik w zabudowie"),
 (53810, 1, "assumed — zmywarka"),
 # Montaż stolarki
 (53824, 6, "read — rzut: drzwi WC, sień, pokój, garderoba, hobby, łazienka"),
 (53827, r(parapety, 1), "read — szerokości okien z rzutu O1 180 + 2× O2 150 (+10 cm na okno); drzwi balkonowe bez parapetu"),
 (53831, r(parapety, 1), "measured — = długość parapetów"),
 # Instalacja elektryczna
 (53844, 46, "assumed — osprzęt stanu deweloperskiego ok. 45 pkt (salon z kuchnią 20, pokój 8, hobby 6, sień 4, hall 4, garderoba 3) + wyspa"),
 (53848, 8, "read — wizualizacja schodów: oprawy LED w ścianie przy stopniach, co drugi stopień assumed"),
 (53852, 1, "assumed — okap (pochłaniacz, bo dom ma rekuperację)"),
 (53854, 10, "assumed — lampy: salon 2, nad wyspą 3, sień, pokój, garderoba, hobby, hall po 1"),
 (53859, 4, "assumed — zasilacze LED: kuchnia, schody, wnęka WC, wnęka łazienki"),
 (53862, 2, "assumed — włączniki schodowe parter/piętro"),
 (53870, 11, "assumed — nowe punkty: oprawy schodowe 8, nad wyspą 1, LED kuchnia 1, LED garderoba 1"),
 (53872, 1, "assumed — gniazdo w wyspie"),
 # Instalacja wod-kan
 (53879, 1, "assumed — dopasowanie podejścia zlewu do projektu kuchni"),
]

NEW = "brak w katalogu — do wyceny"
main_added = [
 ("Podłogi", "Posadzki z mikrocementu sama robocizna", "m²", 500, r(A_floor),
  "read — klient: preferowany mikrocement; = Pu1 52,19 + Pu2 49,02 (wszystkie pomieszczenia, łącznie z WC i łazienką); cena: katalog prac"),
 ("Łazienka", f"Mikrocement na ścianach łazienki — {NEW}", "m²", 0, r(bath_walls),
  "measured — wizualizacja: ściany łazienki z mikrocementu; obwód 9,62 × H − drzwi; najbliżej: Posadzki z mikrocementu 500 zł/m², Mikrocement gabinet 650 zł/m²"),
 ("Łazienka", "Wykuwanie wnęki pod półeczkę + GK", "szt", 500, 1,
  "read — wizualizacja WC: podświetlona wnęka nad stelażem; cena: katalog prac"),
 ("Montaż stolarki i ślusarski", f"Montaż okładzin drewnianych stopni i podstopni na schodach betonowych — {NEW}", "stopień", 0, 17,
  "read — rzut: schody żelbetowe 17 stopni parter → piętro; klient: wykończenie drewnem; najbliżej: Cyklinowanie schodów stopień+podstopień 380 zł/szt, Ułożenie gresu na stopniach 220 zł/szt"),
 ("Montaż stolarki i ślusarski", f"Montaż balustrady i poręczy drewnianej — {NEW}", "kpl", 0, 1,
  "read — wizualizacja schodów: drewniana poręcz i balustrada wzdłuż biegu i otworu na piętrze"),
]

POD = "Poddasze (osobna wycena)"
pod = [
 (POD, "Ocieplenie skosów — układanie wełny między krokwiami", "m²", 45, POD_slopes,
  "assumed — skosy ≈ 72 m² (obrys 5,70 × 11,37, kąt dachu 35° assumed); cena: katalog prac „Układanie wełny w ścianach”"),
 (POD, "Folia paroizolacyjna ściany i sufity", "m²", 20, POD_slopes, "assumed — = powierzchnia skosów; cena: katalog prac"),
 (POD, f"Zabudowa skosów płytą GK na stelażu — {NEW}", "m²", 0, POD_slopes,
  "assumed — = powierzchnia skosów; najbliżej: Przedścianka z GK + folia 150 zł/m², Zabudowa ścian z GK na stelażu 250 zł/m², Sufit podwieszany niski stopień 160 zł/m²"),
 (POD, rows[53667]['description'], "m²", 59, POD_slopes, "assumed — gładź na skosach z GK"),
 (POD, rows[53709]['description'], "m²", 60, POD_gables, "assumed — 2 ściany szczytowe ≈ 32 m², mur ceramiczny bez tynku assumed"),
 (POD, rows[53674]['description'], "m²", 12, POD_slopes + POD_gables, "assumed — skosy + szczyty"),
 (POD, rows[53682]['description'], "m²", 22, POD_slopes + POD_gables, "assumed — skosy + szczyty na biało"),
 (POD, rows[53664]['description'], "mb", 14, 36.7, "assumed — styki skosów ze ścianami kolankowymi i szczytami"),
 (POD, rows[53657]['description'], "m²", 60, POD_floor,
  "assumed — podłoga na istniejącej płycie OSB (rzut: „płyta OSB”), obrys ≈ 59 m² minus otwór schodów; panele jak na wizualizacji poddasza"),
 (POD, rows[53639]['description'], "mb", 45, POD_P, "assumed — obwód poddasza"),
 (POD, rows[53824]['description'], "szt", 380, 1, "read — rzut: drzwi D3 na strych"),
 (POD, f"Montaż okładzin drewnianych stopni i podstopni na schodach betonowych — {NEW}", "stopień", 0, 17,
  "read — rzut: schody 17 stopni piętro → strych; najbliżej: Cyklinowanie schodów stopień+podstopień 380 zł/szt"),
 (POD, f"Montaż balustrady i poręczy drewnianej — {NEW}", "kpl", 0, 1, "assumed — bieg na strych + otwór w podłodze strychu"),
 (POD, rows[53872]['description'], "szt", 130, 10, "assumed — pracownia/magazyn: 10 gniazd"),
 (POD, rows[53870]['description'], "szt", 100, 5, "assumed — 4 punkty oświetlenia + zasilanie taśmy LED"),
 (POD, rows[53868]['description'], "mb", 40, 60, "assumed — przewody za GK, ok. 4 mb na punkt × 15"),
 (POD, rows[53844]['description'], "szt", 39, 13, "assumed — 10 gniazd + 3 włączniki"),
 (POD, rows[53854]['description'], "szt", 100, 4, "assumed — 4 oprawy"),
 (POD, rows[53858]['description'], "mb", 60, 20, "read — wizualizacja poddasza: taśma LED pod skosami, 2 × 10 mb assumed"),
 (POD, rows[53859]['description'], "szt", 120, 2, "assumed — 2 zasilacze LED"),
 (POD, rows[53866]['description'], "szt", 200, 3, "assumed — osobne obwody: gniazda, oświetlenie, LED"),
 (POD, rows[53862]['description'], "szt", 70, 2, "assumed — oświetlenie biegu na strych"),
]

REK = "Rekuperacja (osobna wycena)"
rek = [
 (REK, "Rozprowadzenie kanałów rekuperacji", "mb", 120, 100,
  "assumed — 10 anemostatów × ~8 mb + czerpnia/wyrzutnia ~20 mb; cena: katalog prac „Montaż wentylacji”"),
 (REK, f"Montaż i uruchomienie centrali rekuperacyjnej — {NEW}", "kpl", 0, 1,
  "assumed — centrala na strychu; najbliżej: Montaż klimatyzacji + uruchomienie 600 zł"),
 (REK, rows[53744]['description'], "kpl", 100, 10,
  "assumed — nawiew: salon 2, pokój, hobby, garderoba, poddasze 2; wywiew: kuchnia, WC, łazienka"),
 (REK, rows[53584]['description'], "kpl", 350, 2, "assumed — czerpnia i wyrzutnia"),
 (REK, rows[53581]['description'], "kpl", 150, 1, "assumed — odprowadzenie skroplin z centrali"),
 (REK, rows[53872]['description'], "szt", 130, 1, "assumed — zasilanie centrali"),
 (REK, rows[53714]['description'], "mb", 350, 6,
  "assumed — pion kanałów z poddasza na parter w zabudowie GK; zależy od przygotowania dewelopera"),
]

out, totals = [], {}
def add(section, description, unit, price, qty, src, group):
    out.append(dict(section=section, description=description, qty=qty, unit=unit, clientPrice=float(price), note=f"AI: {src}"))
    totals[group] = totals.get(group, 0) + qty * price

for i, q, src in pick:
    p = rows[i]
    add(p['section'], p['description'], p['unit'], p['clientPrice'], q, src, 'dom')
for s, d, u, p, q, src in main_added: add(s, d, u, p, q, src, 'dom')
for s, d, u, p, q, src in pod: add(s, d, u, p, q, src, 'poddasze')
for s, d, u, p, q, src in rek: add(s, d, u, p, q, src, 'rekuperacja')

with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"rows {len(out)}  " + "  ".join(f"{k} {v:,.2f}" for k, v in totals.items()) + f"  razem {sum(totals.values()):,.2f}")
mikro = r(A_floor) * 500
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
