# Builds measure/ai-draft-load.json for production #200 from the szablon #166 rozpiska (section/description
# copied byte-for-byte by id). There are no files — no rzut, no photos — only the scope the owner typed into
# Notatki (inputs/client-inquiry.md). So this selects the prace that scope implies; a quantity is set only when
# Notatki state it (a count, a lump sum), and every selected pozycja whose quantity is unknown goes in at qty 0
# with a missingData starting „Praca wybrana, ilość nieznana:”.
import json, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = {}
with open(os.path.join(BASE, 'inputs/rozpiska-szablon-166.txt'), encoding='utf-8') as f:
    for line in f.read().split('\n'):
        if not line.strip(): continue
        _, sec, i, desc, unit, price, _ = line.split(' | ')
        rows[int(i)] = dict(section=sec, description=desc, unit=unit, clientPrice=float(price))

UNKNOWN = "Praca wybrana, ilość nieznana: "
Q_FLOOR = "powierzchnia podłogi lokalu (m²)"
Q_TILES = "powierzchnia płytek do skucia (m²) — podłoga, schody, czy także ściany"
Q_PERIM = "obwód lokalu bez zabudów meblowych (mb)"
Q_WALLS = "powierzchnia ścian i sufitów do malowania (m²) — wysokość lokalu i obwód"

draft = []
def add(i, qty, assumptions=None, missing=None, price=None):
    r = dict(rows[i]); r['qty'] = round(qty, 2)
    if price is not None: r['clientPrice'] = float(price)
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

def add_new(section_of, description, unit, price, qty, assumptions=None, missing=None):
    r = dict(section=rows[section_of]['section'], description=description, unit=unit,
             clientPrice=float(price), qty=round(qty, 2))
    if missing: r['missingData'] = missing
    if assumptions: r['assumptions'] = assumptions
    draft.append(r)

# — Prace dodatkowe
add(60900, 1, "1 kpl na cały remont — pozycja ryczałtowa; Notatki jej nie wymieniają, ale gres, klej, listwy i farbę trzeba kupić i wnieść",
    "cena j.m. z szablonu 1500 zł (katalog: małe mieszkanie w całości); lokal usługowy, zakres odświeżeniowy — piętro i dostęp nieznane, kwotę do potwierdzenia")
add(60903, 0, missing=UNKNOWN + "ilość gruzu zależy od powierzchni skuwanych płytek; przy 4 big bagach i więcej kontener (Manual: 1500 zł parter, od 1800 zł wyżej)")

# — Wyburzenia, demontaże, zabezpieczenia
add(60918, 0, "zabezpieczenia liczone po m² podłogi (katalog); stawka podstawowa — zakładam, że lokal jest zamknięty na czas remontu",
    UNKNOWN + Q_FLOOR + "; czy salon działa w trakcie remontu (wtedy stawka 45 zł/m²)")
add(60941, 0, missing=UNKNOWN + Q_TILES + " — Notatki: „skucie płytek”, „usunięcie istniejącej posadzki”, „glazura na schodach”")
add(60929, 0, missing=UNKNOWN + "długość istniejących listew (mb) — zwykle jak nowe listwy: " + Q_PERIM)
add(60925, 1, "1 szt. — Notatki: „Wymiana drzwi wewnętrznych. 1 szt.” i „Demontaż drzwi przeznaczonych do wymiany”; zakładam ościeżnicę drewnianą",
    "ościeżnica drewniana czy metalowa (metalowa futryna 200 zł: +100 zł)")
add(60942, 0, "po skuciu płytek podłoże szlifujemy z kleju (katalog) — Notatki: „Przygotowanie podłoża po usunięciu istniejącej posadzki”",
    UNKNOWN + "jak skuwanie: " + Q_TILES)

# — Podłogi
add(60953, 0, "grunt pod wylewkę i pod glazurę (katalog)", UNKNOWN + Q_FLOOR)
add(60957, 0, "Notatki: „Wyrównanie i naprawa podłoża” — zakładam wylewkę samopoziomującą do 5 mm pod nowy gres",
    UNKNOWN + Q_FLOOR + "; stan podłoża po skuciu — jeśli potrzebna wylewka betonowa 3–5 cm: 80 zł/m² zamiast 55 zł/m²")
add(60972, 0, "Notatki: „Ułożenie nowej podłogi na całej powierzchni lokalu. glazura” — zakładam format standard (30×30 do 60×120)",
    UNKNOWN + Q_FLOOR + "; format płytek (120×120: 300 zł/m², mały format: 250–380 zł/m²)")
add(60979, 0, "fugowanie = tyle m², ile gresu (katalog)", UNKNOWN + "jak gres: " + Q_FLOOR)
add_new(60953, "Ułożenie gresu na stopniach", "szt", 220, 0,
        "katalog prac (#661, 220 zł/szt.) — szablon nie ma pozycji na schody; Notatki: „układania glazury na schodach” (w części demontażowej)",
        UNKNOWN + "liczba stopni; czy na schodach skuwamy stare płytki i kładziemy nowe, czy tylko jedno z tych dwóch")
add(60961, 0, "Notatki: „Montaż nowych listew przypodłogowych. poliuretan”", UNKNOWN + Q_PERIM)
add(60959, 0, "Notatki: „Akrylowanie połączeń listew ze ścianami” — tyle samo mb co listew (katalog)", UNKNOWN + "jak listwy: " + Q_PERIM)
add(60962, 0, "listwy poliuretanowe zwykle idą pod malowanie, a Notatki przewidują malowanie całego lokalu",
    UNKNOWN + "jak listwy: " + Q_PERIM + "; czy listwy są malowane (gotowe białe listwy — pozycja wypada)")

# — Ściany i sufity bez łazienek
add_new(61009, "Uzupełnienie i wyrównanie tynków na ścianie w kuchni, za zabudową meblową", "kpl", 600, 1,
        "kwota ryczałtowa 600 zł wpisana w Notatkach — przyjęta jako Cena j.m.; w szablonie najbliżej „Tynkowanie ręczne ścian lub sufitów do 1 cm” 60 zł/m²",
        "czy 600 zł to cena dla klienta; kto demontuje i montuje zabudowę kuchenną, żeby dostać się do ściany")
add(61023, 0, "Notatki: „Przygotowanie powierzchni pod malowanie”, „Miejscowe szpachlowanie i przygotowanie ścian” — grunt z drobnymi poprawkami, bez pełnej gładzi (zakres „odświeżenia”)",
    UNKNOWN + Q_WALLS + "; jeśli ściany wymagają pełnej gładzi: rynek wtórny 85 zł/m² zamiast 15 zł/m²")
add(61030, 0, "Notatki: „Malowanie całego lokalu w zakresie odświeżenia pomieszczeń” — ściany i sufity, zakładam na biało; poprawki malarskie po pozostałych pracach w tej samej pozycji",
    UNKNOWN + Q_WALLS + "; kolor ścian (w kolorze 26 zł/m² zamiast 22 zł/m²)")

# — Montaż stolarki
add(61147, 1, "1 szt. — Notatki: „Wymiana drzwi wewnętrznych. 1 szt.”; zakładam ościeżnicę regulowaną",
    "ościeżnica regulowana czy stała (stała 450 zł + wklejanie opasek 200 zł)")

# — Elektryka
add_new(61158, "Uporządkowanie istniejącego okablowania", "kpl", 500, 1,
        "kwota ryczałtowa 500 zł wpisana w Notatkach — przyjęta jako Cena j.m.; szablon nie ma takiej pozycji",
        "czy 500 zł to cena dla klienta i co obejmuje (porządkowanie przewodów natynkowych, puszki, rozdzielnia?)")

# — Sprzątanie (Notatki: „Uprzątnięcie lokalu po zakończeniu remontu”): no szablon or katalog praca.
add_new(60900, "Sprzątanie lokalu po zakończeniu remontu", "kpl", 0, 1,
        "1 kpl — Notatki: „Uprzątnięcie lokalu po zakończeniu remontu”",
        "brak w szablonie i w katalogu — do wyceny (Cena j.m. pusta)")

os.makedirs(os.path.join(BASE, 'measure'), exist_ok=True)
with open(os.path.join(BASE, 'measure/ai-draft-load.json'), 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
total = sum(r['qty'] * r['clientPrice'] for r in draft)
by = {}
for r in draft: by[r['section']] = by.get(r['section'], 0) + r['qty'] * r['clientPrice']
for s, v in sorted(by.items(), key=lambda kv: -kv[1]): print(f"{s:42} {v:12.2f}")
zero = [r for r in draft if r['qty'] == 0]
print(f"{len(draft)} rows: {len(draft) - len(zero)} quantified, {len(zero)} selected with qty 0; total {total:.2f}")
