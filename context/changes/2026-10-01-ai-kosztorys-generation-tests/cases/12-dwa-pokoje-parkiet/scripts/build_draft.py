# Builds measure/ai-draft-load.json for production #202 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). No files exist for this investment: the only input is the scope the owner
# typed into Notatki (inputs/client-inquiry.md). Every quantity below is either read from that scope or
# follows from a read one; a pozycja the scope implies but whose quantity it doesn't give goes in at qty 0
# with a missingData starting MISSING, so the owner sees it was selected.
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

MISSING = "Praca wybrana, ilość nieznana: "

# Read from Notatki.
ROOMS = 20 + 8          # „dwóch pokoi o powierzchniach około 20 m² i 8 m²”
SUBIT = 28              # „Usunięcie istniejącego subitu – około 28 m²”
SCREED = 28             # „Wykonanie wylewki samopoziomującej. 28m2”
PARQUET = 28            # „Ułożenie nowego parkietu – około 28m2”
SANDING = 33            # „Cyklinowanie parkietu – około 33m² - razem z korytarzem”
PROTECT = 35            # „Zabezpieczenie istniejących elementów mieszkania … – około 35 m²”
GK_WALL = 5             # „nowej ścianki działowej z płyt gipsowo-kartonowych – około 5 m²”
EXTRA_PLASTER = 10      # „Dodatkowe prace tynkarskie i gładzie – około 10 mb”
ENTRY_DOOR = 5          # „Wykończenie obróbek wokół drzwi wejściowych – około 5 mb”
NEW_POINTS = 3          # „Wykonanie około 3 nowych punktów elektrycznych”
TILE_LUMP = 1500        # „Założony koszt pozycji: 1 500 zł” (prace glazurnicze i naprawcze)

WALLS_Q = "powierzchnia ścian obu pokoi (ok. 20 i 8 m² podłogi) — zakres nie podaje wysokości ani wymiarów pokoi, więc m² ścian nie da się policzyć"

draft = []
def add(i, qty, assumptions=None, missing=None):
    r = dict(rows[i]); r['qty'] = round(qty, 2)
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

def add_new(section, description, unit, price, qty, assumptions=None, missing=None):
    r = dict(section=section, description=description, unit=unit, clientPrice=float(price), qty=qty)
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

# — Prace dodatkowe
add(61202, 1, "1 kpl na cały remont (zawsze); cena j.m. z szablonu 1500 zł — katalog: „małe mieszkanie w całości 1500 zł”, „poza Warszawą … wyższe ceny”",
    "inwestycja w Rynie, daleko poza Warszawą: dojazd ekipy, noclegi i transport materiałów nie są w szablonie — kwotę ustalić ręcznie; piętro i winda")
add(61205, 2, "Manual: „rynek wtórny bez wyburzeń — 2 big bagi total”; gruz to subit z 28 m², zdarte powłoki i luźny tynk",
    "piętro i winda; czy 2 big bagi wystarczą po zdarciu tynku ze ścian")

# — Wyburzenia, demontaże, zabezpieczenia
add(61220, PROTECT, f"{PROTECT} m² podane w zakresie („około 35 m²”); obejmuje też przygotowanie pomieszczeń, zabezpieczenie ciągów komunikacyjnych i usunięcie zabezpieczeń na końcu",
    "czy mieszkanie będzie zamieszkane w trakcie (stawka 45 zł/m²: +700 zł)")
add(61245, SUBIT, f"{SUBIT} m² podane w zakresie; razem z mechanicznym szlifowaniem i oczyszczeniem podłoża (zakres, pkt 2)")
add(61253, 0, None,
    MISSING + "m² ścian do zdarcia („mechaniczne usunięcie starych powłok malarskich i luźnych warstw tynku”) — " + WALLS_Q)
add(61224, 2 * NEW_POINTS, f"katalog: ok. 2 mb na punkt × {NEW_POINTS} nowe punkty z zakresu",
    "materiał ścian — w żelbecie stawka 45 zł/mb (+120 zł)")

# — Podłogi
add(61255, SUBIT, f"pod wylewkę samopoziomującą (katalog) — {SUBIT} m², jak usuwanie subitu i wylewka")
add(61259, SCREED, f"{SCREED} m² podane w zakresie")
add(61291, PARQUET, f"{PARQUET} m² podane w zakresie; układ nieznany → wybrany parkiet mijanka (z gruntowaniem)",
    "układ parkietu — jodełka to inna pozycja, 110 zł/m² (+980 zł); parkiet lity czy warstwowy")
add(61260, SANDING, f"{SANDING} m² podane w zakresie: nowy parkiet {PARQUET} m² + korytarz z istniejącym parkietem ok. {SANDING - PARQUET} m²; cena z materiałem",
    "stan parkietu w korytarzu — naprawy przed cyklinowaniem płatne osobno")
add(61263, 0, None,
    MISSING + "mb listew — obwód obu pokoi minus zabudowy (katalog), zakres podaje tylko m² podłogi; rodzaj listew (MDF czy metalowe — 120 zł/mb)")
add(61261, 0, "tyle samo co listew (katalog)",
    MISSING + "jak montaż listew — mb obwodu obu pokoi")

# — Ściany i sufity bez łazienek
add(61294, GK_WALL, f"{GK_WALL} m² podane w zakresie; wełna i podwójna płyta jak w szablonie",
    "konstrukcja ścianki: podwójna płyta z wełną czy pojedyncza")
add(61293, 1, "1 kpl — jedne drzwi w nowej ściance („wzmocnienie konstrukcji GK pod montaż ościeżnicy”)")
add(61298, 0, "„Przygotowanie i wykończenie powierzchni nowej ścianki”",
    MISSING + "mb styków nowej ścianki z istniejącymi ścianami i sufitem — zakres podaje tylko jej m²")
add(61318, 2 * GK_WALL, f"nowa ścianka GK: {GK_WALL} m² × 2 strony; na płycie GK gładź standardu Q3, nie stawka rynku wtórnego",
    "czy obie strony ścianki są w remontowanych pomieszczeniach")
add(61320, 0, "gładź „standard prac dla rynku wtórnego” (zakres, pkt 3); stawka obejmuje miejscowe naprawy tynku pod gładzią i szlifowanie",
    MISSING + WALLS_Q + "; czy gładź także na sufitach")
add(61323, 0, "przed gładzią i ponownie przed malowaniem (zakres, pkt 3 i 7)",
    MISSING + WALLS_Q + " + 10 m² nowej ścianki GK (+ sufity, jeśli w zakresie)")
add(61310, EXTRA_PLASTER + ENTRY_DOOR, f"{EXTRA_PLASTER} mb „dodatkowych prac tynkarskich i gładzi” + {ENTRY_DOOR} mb obróbek wokół drzwi wejściowych — oba z zakresu",
    "zakres i sposób obmiaru 10 mb — klient sam pisze „do potwierdzenia”")
add(61307, 2 * NEW_POINTS, "jak bruzdy pod 3 nowe punkty — „naprawa bruzd i ubytków po pracach instalacyjnych”; gładź po bruzdach pominięta, bo gładź idzie na całe ściany (katalog)")
add(61332, 0, "dwukrotne malowanie ścian obu pokoi (zakres, pkt 7); na biało",
    MISSING + WALLS_Q + " + 10 m² nowej ścianki GK; kolor (malowanie w kolorze 26 zł/m²)")
add(61328, 0, "„ewentualnie sufitów” (zakres, pkt 7)",
    MISSING + f"czy sufity są w zakresie; jeśli tak — {ROOMS} m² (= podłoga obu pokoi): +644 zł, plus gruntowanie (i gładź, jeśli potrzebna)")

# — Montaż stolarki
add(61449, 1, "1 szt. — „montaż drzwi wewnętrznych wraz z ościeżnicą regulowaną” (liczba pojedyncza)")

# — Elektryka
add(61462, NEW_POINTS, f"{NEW_POINTS} nowe punkty podane w zakresie („około 3”); okablowanie w cenie punktu")
add(61469, 0, "wymiana istniejących gniazd + osprzęt na 3 nowe punkty",
    MISSING + "liczba istniejących gniazd i łączników do wymiany w obu pokojach (+ 3 nowe)")

# — Prace glazurnicze i naprawcze: the szablon has no repair pozycja; the scope fixes this section's cost.
add_new("Łazienka",
        "Prace glazurnicze i naprawcze: naprawa uszkodzonych płytek, wykonanie lub odtworzenie rewizji, uzupełnienie fug — ryczałt",
        "kpl", TILE_LUMP, 1,
        "ryczałt 1500 zł — „Założony koszt pozycji: 1 500 zł” wpisany w zakresie; szablon nie ma pozycji na naprawę płytek",
        "cena to założony koszt z zakresu, nie wycena z szablonu; gdzie są płytki i ile do wymiany — do potwierdzenia na oględzinach")

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in sorted(by.items(), key=lambda kv: -kv[1]): print(f"{s:42} {v:12.2f}")
zero = [r for r in draft if r['qty'] == 0]
print(f"{len(draft)} rows ({len(draft) - len(zero)} quantified, {len(zero)} at qty 0), total {total:.2f}")
