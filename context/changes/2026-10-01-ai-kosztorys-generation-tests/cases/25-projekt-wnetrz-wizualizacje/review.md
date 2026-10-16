# Case 25 — review (fast-path step 6)

Reviewer: a separate agent, not the drafter. The drafter's output is frozen in `measure/ai-draft-pre-review.json` and `measure/investment-notes-appendix-pre-review.txt`. Fixes went into `scripts/build_draft.py`. The script was rerun, which rewrote `measure/ai-draft-load.json`, and the appendix and `measurement.md` were updated to match. Geometry was not re-measured.

## Findings

- [x] fixed · Elektryka / przebudowa rozdzielni · Manual: „Przy indukcji minimum ta” (rozdzielnia 18 modułów); precedent cases 18, 21, 23 · 50695 0 → 1, 50697 „dołożenie bezpiecznika” 1 → 0 with a reason · **+1 300,00 zł**. The question „rozdzielnia dewelopera ma miejsce → tylko bezpiecznik, −1 300 zł” is on both rows and in the appendix.
- [x] fixed · Łazienka / montaż kratki wentylacyjnej · Komentarz: „Jeżeli praca dotyczy pracy w łazience to dodajemy do sekcji łazienka”. The bathroom has no window, and the wiercenie count already includes the kratka otwór · 50575 0 → 1 · **+100,00 zł**
- [x] fixed · Kuchnia / fugowanie (moved from Podłogi) · Komentarz: „Dodajemy w sekcji, w której są fugowane płytki”; Manual: fugowanie = suma płytek. The 30x60 backsplash had płytki but no fuga · add_new 0 → 1,08 m² × 30 · **+32,40 zł**
- [x] fixed · Łazienka / szafka nad geberitem · scope. The wizualizacje show a szafka nad WC with LED in the zabudowa, and the client says the stolarz does all furniture; precedent cases 20, 23 · 50629 missing → 0 with a reason · 0 zł
- [x] fixed · Stolarka → Łazienka / obróbka drzwi ukrytych · Komentarz: „dodajemy do sekcji łazienka”; precedent case 22 · Stolarka 3 → 2, Łazienka add_new 0 → 1 × 800 · 0 zł (moved)
- [x] fixed · both places / gruntowanie przed i po gładziach (50505) · „Every point lives in both places”. The appendix gładź question (−12 807 zł) had no matching note on the gruntowanie row · missingData added · 0 zł (text)
- [x] fixed · both places / Manual height rule · Manual: „W »Co / ile założono« podaj, którą przyjęto” (wysokość). H 2,73 was missing on the wall rows · A_WALLS (50534, 50505, 50503, 50513), 50514 and 50596 folia now name H 2,73 m · 0 zł (text)
- [x] fixed · arithmetic / murowana ściana alternative · 180 × 3,34 + 250 + 35 × 13,37 − 110 × 3,34 − 150 = 802. The draft said −334, leaving out the taśma GK on the łączenia (4 mb/m² × 35) · appendix and 50523 −334 → −802 zł; the same question is now on 50521 and 50536 · 0 zł (text)
- [x] fixed · measurement.md / naprawy in the łazienka · arithmetic: 20 el + 2 wod-kan = 22 · text 20 → 22 mb · 0 zł
- [x] asked · Ściany / nowa ściana GK — where the 70 cm opening sits · rysunek wyburzeń/dobudów: the 70 opening with a new 20 cm filarek is in the korytarz wall, where the old 90 WC door was. The new wall toward the gabinet may have no opening · 3,34 m² kept; alternative 4,78 m² (+459 zł with szpachlowanie łączeń) on 50523, 50536 and in „Do ustalenia” · 0 zł now (+459 zł if confirmed)
- [x] asked · Łazienka / farba podkładowa · Komentarz: farba podkładowa „wpisujemy” on fresh gładzie, in the łazienka in the łazienka sekcja; precedent case 22. The łazienka malowanie row already includes gruntowanie ×2 and gładź · not added; ≈ 10,63 m² × 12 = +128 zł on 50559 and in „Do ustalenia” · 0 zł now (+128 zł if added)
- [x] dismissed · Łazienka sekcja count / no WC sekcja · per-bathroom rule. The inquiry says „usunięcie łączy hydraulicznych do umywalki i WC”, and the drawings show only a pralka in the pom. gosp. One bathroom gives one sekcja named „Łazienka”, and the ex-WC rows go in the general sekcje · correct as drafted
- [x] dismissed · Prace dodatkowe / transport 1 500 + gruz 3 big bagi · Manual transport ~2 000 for a big deweloperka is asked (+500); kontener +450 is computed correctly · correct
- [x] dismissed · Wyburzenia / zabezpieczenia 60,17 m², wyburzenie 4,78 m² (50450), demontaż 5 grzejników / montaż 3 + 1 · matches the karta and the drawing · correct
- [x] dismissed · Elektryka / bruzdy 150 mb · Manual cap „max dla 50–100 m²” · correct; naprawy 144 + 22 = bruzdy 150 + wod-kan 7 + wyburzenie line, checked
- [x] dismissed · Elektryka / montaż gniazdek and włączników · points minus the schodowe counted separately (35 + 7); oświetlenie 26 + 3 AC · sums checked
- [x] dismissed · Podłogi / gruntowanie without the łazienka, mata, fugowanie = płytki 7,40 m² · Manual fugowanie = płytki · correct
- [x] dismissed · Podłogi / cokół wkuwany 6,4 mb (katalog 377 at 220) · the c8 orange line runs around the whole pom. gosp.; katalog price checked on prod (read-only) · correct
- [x] dismissed · Podłogi / listwy 39 mb + akryl = listwy, równe cięcia 4,01 mb · Manual „lepiej niedoszacować”; korek is asked; no listwa łączeniowa because the floor is not pływająca · correct
- [x] dismissed · Ściany / gładź, gruntowanie, farba podkładowa = WALLS + CEIL; mleczko without the unplastered sanitary-room walls · karta: „nieotynkowane … zatarte na ostro” · correct
- [x] dismissed · Łazienka / mleczko on the painted ceiling · Manual: mleczko „zawsze” on deweloperka tynki · kept
- [x] dismissed · Łazienka / gruntowanie przed i po gładzi · covered by 50552 (precedent case 22) · correct
- [x] dismissed · Ściany / narożniki aluminiowe at the 20 cm filarek · part of the GK wall price (precedent case 23) · correct
- [x] dismissed · Ściany / profile UA, taśma 2 mb/m² · door opening in a GK wall · correct
- [x] dismissed · Ściany / akrylowanie 67,78 mb at the sufity; łazienka akryl 8,57 · sums checked · correct
- [x] dismissed · Łazienka / tile and licowanie joints at 120 cm and the vertical joints · covered by licowanie „wklejanie taśm i przygotowanie” · correct
- [x] dismissed · Wod-kan / zawory czerpalne only for the pralka; biały montaż = 2 baterie podtynkowe; przedścianka z półką (no separate półka) · correct
- [x] dismissed · Łazienka / folia on all walls + floor, taśma 15 mb, silikon 20 mb, wiercenie 18, fugowanie 17,55 m² · Manual folia „wszystkie ściany”; sums checked · correct
- [x] dismissed · Łazienka / cięcia 45° 5,5 mb · asked in the draft · correct
- [x] dismissed · Łazienka / montaż kabiny prysznicowej (katalog 206 at 1 200) · price checked on prod (read-only); szyba stała alternative −650 asked · correct
- [x] dismissed · Łazienka / szafka podumywalkowa, AGD, zabudowa rur, wymurowanie ścianki, akcesoria, wentylator, demontaże 50432 · stolarz / deweloperka / not in scope · correct
- [x] dismissed · Łazienka / sufit podwieszany · asked (+1,8 tys.) · correct
- [x] dismissed · Ściany / malowanie skrzydła drzwi łazienkowych 1,64 m² left in Ściany · too small to move · dropped as cosmetic
- [x] dismissed · pom. gosp. kratka · covered by zabezpieczenia demontaż/montaż · correct
- [x] dismissed · text · no client name, address, phone, „test”, code identifiers or paths in the draft or appendix (grep checked); Polish sheet vocabulary · clean
- [x] dismissed · arithmetic / appendix zł figures · 12 807; 888 / 456 / 296 / 171; 878; 650; 1 000; 1,0 tys.; 300; 312; 0,7 tys.; 39; 1,8 tys.; 500; 450; 519 all recomputed · correct

## Tally

**9 fixed, 2 asked, 25 dismissed · 0 open.**

Total **88 617,89 → 90 050,29 zł** (+1 432,40 zł). Rows 104 → 109 (5 rows added in review: 50695, 50575, 50629, the kitchen fugowanie and the bathroom door obróbka). Qty-0 rows 4 → 6. Added rows 9 → 11 (2 katalog + 9 moved).

| Category     | Count | Findings                                                                      |
| ------------ | ----- | ----------------------------------------------------------------------------- |
| rule missed  | 3     | rozdzielnia 18 modułów, kratka in the łazienka, kuchnia fugowanie             |
| scope missed | 2     | szafka nad WC (stolarz), bathroom door obróbka in Łazienka                    |
| both-places  | 2     | gładź question on 50505, H 2,73 on the wall rows                              |
| arithmetic   | 2     | murowana −334 → −802, naprawy 20 → 22 mb                                      |
| text         | 0     | —                                                                             |
| asked        | 2     | otwór 70 in the korytarz wall (+459), farba podkładowa in the łazienka (+128) |

No DRY fill was run: the hard limits forbid the fill and load scripts.

Note for the caller: the production file names listed in `case.json` include the client's street name. That is client address data in the repo. This review may not edit `case.json`.
