"""Case 1 (#168) as a load-ai-draft draft: measure/przedmiar-v2.json + measure/new-works.json, keyed by
the szablon 165 rozpiska, with each old `note` split into assumptions / missingData (2026-10-09 rule).
A note that only names where a quantity was read is dropped — that is not an assumption.

Run from the case dir: python3 scripts/build_draft.py
"""

import json

ZELBET = "które ściany i stropy są żelbetowe"
UNPRICED = "brak w katalogu — do wyceny"

# szablon item id -> (assumptions, missingData)
NOTES = {
    41505: (["≈ 2 big bagi odpadów z etapu wykończeniowego — szacunek agenta"], []),
    41520: (
        [
            "15 mb tras wod-kan — szacunek agenta: łaz. duża umywalka + grzejnik na inne ściany, "
            "łaz. mała grzejnik + prysznic, zlew przesunięty do 100 cm; rysunek nie wymiaruje tras"
        ],
        [],
    ),
    41522: (
        [
            "140 mb bruzd elektrycznych z bilansu gniazd (80 nowych) + ~30 nowych przewodów "
            "oświetleniowych + 4 łączniki + Ethernet — długości tras szacowane"
        ],
        [],
    ),
    41523: (["~20% tras w ścianach/stropie żelbetowym — szacunek agenta"], [ZELBET]),
    41525: (
        ["8 grzejników wg listy zakupowej (6 pokojowych + 2 łazienkowe); mail mówi o 5 + 2"],
        ["ile grzejników faktycznie się demontuje — lista i mail się różnią"],
    ),
    41550: (["ściana w drugim korytarzu ≈ 8 m² — szacunek z rzutu, bez wysokości na rysunku"], []),
    41554: (
        ["125,6 m² mieszkania zamiast 1 kpl — cena 25 zł to stawka za m², choć j.m. w rozpisce to kpl"],
        [],
    ),
    41583: (["≈ 6 mb przejść płytki ↔ deska bez listew (hol/pokoje, kuchnia/salon) — szacunek"], []),
    41591: (["≈ 6 mb śladu po wyburzonej ścianie i otworze Eclisse — szacunek"], []),
    41622: (
        [
            "kaseta Eclisse ≈ 6,9 m² + dobudowy ścianek ≈ 4 m² + 2× zasklepienie otworu 90 cm ≈ 3,8 m² "
            "+ wygłuszenie ściany łaz. małej od pokoju dzieci ≈ 8 m² — wymiary szacowane z rzutu"
        ],
        [],
    ),
    41630: (["tylko linia 120 cm w pokoju dzieci i bawialni — pionowe styki kolorów pominięte"], []),
    41636: (["≈ 30 mb łączeń płyt na nowych zabudowach GK — szacunek"], []),
    41639: (
        ["≈ 40 mb krawędzi po wyburzeniach, przesunięciach, nowym otworze i zmniejszeniach — szacunek"],
        [],
    ),
    41642: (["≈ 30 mb narożników zabudów GK, siedzisk i kasety Eclisse — szacunek"], []),
    41646: (["≈ 19 mb styków płytka / ściana malowana / sufit w obu łazienkach — szacunek"], []),
    41696: (["podłogi 10,85 m² + strefy mokre ścian ≈ 11 m² — strefy mokre szacowane"], []),
    41698: (["≈ 30 mb na obie łazienki (wanna, prysznic, umywalki, narożniki) — szacunek"], []),
    41700: (
        ["≈ 15 mb krawędzi zabudów geberitów, przedścianki wanny, wnęk i frontu wanny — szacunek"],
        [],
    ),
    41716: (["≈ 10 mb: półki wnęki (4× 40 cm), wnęka 25×15, blaty zabudów, przedścianka wanny"], []),
    41717: (["≈ 20 otworów (baterie podtynkowe, deszczownica, FixFit, bidetki, gniazda) — szacunek"], []),
    41719: (["≈ 27 mb: obwody podłóg + narożniki strefy prysznica i wanny — szacunek"], []),
    41772: (["~10 odcinków LED × 2 łączenia — liczba odcinków szacowana"], []),
    41775: (["~28 łączników — liczba szacowana z projektu"], []),
    41784: (["bruzda LED w suficie: salon ≈ 4 mb + łaz. duża ≈ 2,5 mb — szacunek"], []),
    41598: (["gładź Q3 — Q4 to ≈ +7,6 tys. zł na gładziach razem"], []),
    41600: (
        [
            "gładź Q3 — Q4 to ≈ +7,6 tys. zł na gładziach razem",
            "tylko ściany zaznaczone kolorem na rys. 11 — bez ścian za zabudową kuchni i częścią szaf",
            "bez gładzi pod panelami tapicerowanymi i akustycznymi",
            "nad drzwiami ≈ 7 m² — szacunek",
            "okna sypialni i gabinetu bez etykiety ho — przyjęto 186 cm",
        ],
        ["czy za szafami robimy gładź — rys.: gabinet tak, sypialnia i drugi korytarz nie"],
    ),
    41612: (
        ["limewash wyceniony tą pozycją (100 zł/m²) — ani szablon, ani katalog nie mają osobnej"],
        [],
    ),
    41614: (["nad drzwiami ≈ 7 m² w kolorze — szacunek"], []),
    41615: ([], ["czy za każdą maskownicą jest karnisz — jeśli tak, karnisze = 15,2 mb"]),
    41635: (["okna sypialni i gabinetu bez etykiety ho — przyjęto 186 cm"], []),
    41653: (["fuga cementowa — epoksydowa to ≈ +2,8 tys. zł"], []),
    41655: (["fuga cementowa — epoksydowa to ≈ +2,8 tys. zł"], []),
    41656: (
        ["14 punktów nowych lub przenoszonych — przyjęto, że żaden nie jest gotowy u dewelopera"],
        ["które punkty wod-kan w łazienkach już są u dewelopera", "czy pod odpływ liniowy trzeba obniżać kanalizację"],
    ),
    41697: ([], ["czy mata jest potrzebna — zależy od wylewki"]),
    41714: (
        [],
        ["pas na rysunku ma 1,48 mb, a lista zakupowa 2 płyty 120×278", "czy ściany trzeba wyrównać pod płyty — zależy od tynku"],
    ),
    41570: (["w holu listwa, nie cokół z płytki"], ["cokół w holu: listwa czy cokół z płytki"]),
    41737: ([], ["czy zlew podwieszany wkleja firma od blatu"]),
    41788: (["4 mb szynoprzewodu w korytarzu — długość szacowana"], []),
    41797: ([], ["czy dołożyć 14 bezpieczników, czy przebudować rozdzielnię"]),
    41799: (["34 mb Ethernetu — długości tras szacowane"], []),
    41798: (["część punktów w żelbecie — 15 szt. to szacunek agenta"], [ZELBET]),
}


def load_rozpiska():
    items = {}
    with open("inputs/rozpiska-szablon-165.txt", encoding="utf-8") as f:
        for line in f:
            cols = line.rstrip("\n").split(" | ")
            items[int(cols[2])] = {
                "section": cols[1].strip(),
                "description": cols[3].strip(),
                "unit": cols[4],
                "clientPrice": float(cols[5]),
            }
    return items


def joined(lines):
    return "\n".join(lines) if lines else None


def add(rows, section, description, qty, unit, price, assumptions=(), missing=()):
    row = {"section": section, "description": description, "qty": qty, "unit": unit, "clientPrice": price}
    if joined(missing):
        row["missingData"] = joined(missing)
    if joined(assumptions):
        row["assumptions"] = joined(assumptions)
    rows.append(row)


rozpiska = load_rozpiska()
rows = []
for entry in json.load(open("measure/przedmiar-v2.json", encoding="utf-8")):
    item = rozpiska[entry["id"]]
    assumptions, missing = NOTES.get(entry["id"], ([], []))
    add(rows, item["section"], item["description"], entry["qty"], item["unit"], item["clientPrice"], assumptions, missing)

NEW_WORKS = [
    ("Łazienka", "Ścianka z luksferów ze zbrojeniem, fugowaniem i obróbką", 1, "kpl", 0, [], [UNPRICED]),
    (
        "Ściany i sufity bez łazienek",
        "Siedzisko z G-K pod oknem z wnęką na grzejnik i kratką",
        2,
        "szt",
        0,
        [],
        [UNPRICED + "; najbliżej „Zabudowa ścian z GK na stelażu + przedścianki” 250 zł/m²"],
    ),
    (
        "Ściany i sufity bez łazienek",
        "Klejenie dużego lustra na ścianę",
        3,
        "szt",
        0,
        ["3 lustra wg maila — projekt pokazuje dwa (korytarz, salon)"],
        [UNPRICED + "; najbliżej „Montaż lustra - zwykłe wiszące” 120 zł", "czy jest trzecie lustro"],
    ),
    (
        "Wyburzenia, demontaże, zabezpieczenia",
        "Skucie glifu przy oknie",
        5.2,
        "mb",
        70,
        ["okno w salonie 145×186 — boki + góra; wymiar okna przyjęty, rysunek go nie podaje"],
        ["które okno ma podkute ościeża pod płytę meblową i jaki ma wymiar"],
    ),
    ("Prace dodatkowe", "Koordynacja i nadzór prac", 1, "kpl", 0, [], [UNPRICED]),
    ("Prace dodatkowe", "Sprzątanie końcowe", 1, "kpl", 0, [], [UNPRICED]),
]
for work in NEW_WORKS:
    add(rows, *work)

with open("measure/ai-draft-load.json", "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)
    f.write("\n")

total = sum(r["qty"] * r["clientPrice"] for r in rows)
print(
    f"{len(rows)} rows, {total:,.2f} zł, "
    f"{sum('assumptions' in r for r in rows)} with assumptions, "
    f"{sum('missingData' in r for r in rows)} with missingData, "
    f"{sum(r['clientPrice'] == 0 for r in rows)} unpriced"
)
