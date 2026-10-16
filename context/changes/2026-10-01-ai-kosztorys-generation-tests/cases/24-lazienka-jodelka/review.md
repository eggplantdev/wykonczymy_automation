# Case 24 — review of the AI draft (production #220)

Reviewer pass, 2026-10-16, over the drafter's `measure/ai-draft-pre-review.json` /
`measure/investment-notes-appendix-pre-review.txt`. Spot-checks only, no re-measurement. Rule quotes
come from `inputs/manual-i-komentarze-do-prac.md`. The client photos were opened only to settle the
stelaż, radiator, osprzęt and pion doubts. The fixes are in `scripts/build_draft.py` →
`measure/ai-draft-load.json`, `investment-notes-appendix.txt`, `measurement.md`.

The DRY fill (`fill-case-prod.ts`) was not run in this pass. Its „expected AI przedmiar” has to equal
60 661,97 zł.

## Findings

Format: box · disposition · sekcja / opis · rule or reason · qty before → after · zł delta.

- [x] fixed · Łazienka / Szlifowanie krawędzi płytek na 45 stopni · Komentarz: „każdy narożnik zewnętrzny (np. pion) — jego wysokość × 2”. The pion in the corner (rzut projektu 390 × 630; on the photo it is boxed in from floor to ceiling, next to the WC outlet) has an exposed vertical corner, and the tiles go to the ceiling. Added 2,80 × 2. The row is still flagged „do weryfikacji”, and the pozycja and the appendix now say a listwa on the pion corner would mean −448 zł · 5,1 → 10,7 mb · +448,00 zł
- [x] fixed · Łazienka / Szlifowanie krawędzi płytek na 45 stopni · arithmetic: the draft's own components (1,2 + 0,8) × 2 + 0,55 × 2 add to 5,1, not 5 · 5 → 5,1 mb · +8,00 zł
- [x] fixed · Łazienka / Montaż geberitu + Montaż profili i płyt GK w zabudowie geberitu + appendix · the „Stelaż WC” question (is it already mounted? −900 zł) is settled by the bathroom photo: no stelaż, only the podejścia and the kanalizacja outlet by the pion. The question is removed from both pozycje and from „Do ustalenia”, and the photo is now on the pozycje and in „Najważniejsze założenia” · qty unchanged · 0,00 zł
- [x] fixed · Ściany / Szlifowanie mleczka, Gruntowanie przed i po gładziach, Gruntowanie farbą podkładową, Malowanie ścian w kolorze · both places: the „Zabudowa kuchenna” question (3,60 mb assumed; each metre more ≈ −320 zł on gładź, mleczko, grunt, farba podkładowa and malowanie) was only on the Gładzie pozycja. It is now on all five. The text names farba podkładowa, which the 320 zł already contained (2,8 m² × 114 zł/m²) · qty unchanged · 0,00 zł
- [x] fixed · Ściany / Gruntowanie przed i po gładziach, Farba podkładowa, Malowanie ścian w kolorze; Łazienka / Fugowanie · Manual: „Wysokość z rysunku (Hpom) zawsze wygrywa. W „Co / ile założono” podaj, którą przyjęto.” These four wall-derived pozycje did not state the 2,80 m · text only · 0,00 zł
- [x] fixed · Ściany / Naprawy ścian i sufitów po kuciu…; Elektryka / Montaż gniazdek i włączników; Wyburzenia / Bruzdowanie pod kable elektryczne · both places: the „Gniazdka i kable oświetleniowe” question (−270 / −400 zł, with bruzdy and naprawy) was only on the points. It is now on naprawy and montaż gniazdek too, and the bruzdy text carries the zł impact · qty unchanged · 0,00 zł
- [x] fixed · Łazienka / Naprawy ścian i sufitów… (inserted) + Wyburzenia / Bruzdowanie pod kable elektryczne · both places: the „Lampy wiszące w łazience” question (≈ −400 zł with bruzdy and naprawy) was only on Wykonanie punktów oświetleniowych · qty unchanged · 0,00 zł
- [x] fixed · Wod-kan / Przebudowa punktów c.o. + Łazienka / Montaż grzejnika z zaworami + appendix · arithmetic in text: „jeśli elektryczny: montaż 200 zł zamiast przebudowy c.o.” mixed up two rows. It now reads: without przebudowa c.o. −500 zł, montaż grzejnika elektrycznego 200 instead of 250 zł, maybe a punkt elektryczny +120 zł, ≈ −0,5 tys. zł in total. Before, it was only on the c.o. pozycja; now it is also on the montaż pozycja and in the appendix's „Grzejnik w łazience” line · qty unchanged · 0,00 zł
- [x] asked · Łazienka / Malowanie sufitów i ścian bez glazury + gładź na suficie · Komentarz on farba podkładowa: „tam gdzie świeże gładzie… wpisujemy. Jeżeli praca dotyczy pracy w łazience to dodajemy do sekcji łazienka.” The bathroom ceiling gets fresh gładź, but the sekcja already has Dwukrotne gruntowanie and the 100 zł/m² bundle, so a separate row may double-count (same doubt as #219). The question is on the pozycja and in the appendix (4,36 m² × 12 zł ≈ +52 zł) · 4,36 unchanged · 0,00 zł
- [x] dismissed · Łazienka / Instalacja wod-kan nowe punkty at 0 · Komentarz: „w deweloperce np 4 pkt”. The client writes that the przyłącza „nie trzeba ich przenosić”. The +1 000 zł is already asked in both places
- [x] dismissed · Łazienka / gruntowanie przed i po gładzi on the ceiling · covered by „Dwukrotne gruntowanie ścian, sufitów i podłóg” in the sekcja (precedent #219)
- [x] dismissed · Wyburzenia / Bruzdowanie wod-kan 2 mb + Łazienka / Wkucie 3 + Naprawy 2 mb · Manual: 2 mb bruzd per bathroom, wkucie in deweloperka, naprawy = bruzdy. Same combination as #219
- [x] dismissed · Wyburzenia / Bruzdowanie elektryczne including the 2 bathroom lamps · the Komentarz on bruzdowanie has no „do sekcji łazienka”. The matching naprawy are in Łazienka. Bruzdy 12 + 2 = 14 mb = naprawy 8 + 6 mb
- [x] dismissed · Wyburzenia / Demontaż grzejników 1 · Komentarz: „właściwie zawsze trzeba demontować grzejniki na rynku pierwotnym”. The salon and hol photos show no radiator, but not the window walls, so the photos cannot settle it. The room radiators stay asked (350 zł per piece)
- [x] dismissed · Elektryka / Montaż gniazdek i włączników 2 · Manual: montaż = punkty. The photos show small plates or boxes on the walls, which cannot tell osprzęt from puszki. It stays asked (+1,0–1,2 tys. zł)
- [x] dismissed · Łazienka / LED mirror electrical point · wiercenie counts 2 holes for existing puszki by the mirror, and nothing in the projekt shows a new gniazdko
- [x] dismissed · Podłogi / Docięcie i montaż progu w drzwiach wejściowych · not in the client's scope, no Manual rule
- [x] dismissed · Podłogi / listwa łączeniowa · Komentarz: „montujemy to wtedy jak mamy podłogę pływającą”. The deska is glued, and the korek covers the bathroom threshold
- [x] dismissed · Stolarka / opaski · Komentarz: „Tylko przy ościeżnicach stałych”. The client has regulowane
- [x] dismissed · Kuchnia / AGD, szafki w łazience · Komentarze: „często robi stolarz”, „Zwykle montuje stolarz”. Both are at 0 with a reason and asked
- [x] dismissed · zabudowa pionów, narożniki aluminiowe, gładź po bruzdach, mata kompensacyjna · deweloperka, full-wall gładź, standard floor format
- [x] dismissed · Łazienka / wall tiles behind the wanna counted while the wanna front is not · the drafter offsets one against the other on the pozycja; that is a geometry choice, not re-measured here
- [x] dismissed · rules verified as applied correctly · transport 1500 (małe mieszkanie); 2 big bagi; zabezpieczenia 66,78 m²; listwy −25% and akrylowanie listew = listwy; gruntowanie podłóg without the bathroom; gładź without the kitchen wall; mleczko everywhere, minus the zabudowa stelaża in Łazienka; dwukrotne gruntowanie 22,86 + 2 × 4,36; folia on all walls + floor 27,22; taśma 16 mb (4,36 m²); silikon 20 mb; wiercenie 16 (min. 15); zawory 3 (umywalka with a standing bateria + pralka); fugowanie 19,89 + 2,97 + 3,08 = 25,94; akryl at the ceiling 8,75 mb; only the ceiling painted; mleczko, naprawy and bathroom door in the one „Łazienka” sekcja; appendix zł figures recomputed (−250, +3,4 tys., −2,4 tys., −270, −400, +1 000, ≈1,1 tys.)
- [x] dismissed · text · no client name, address, phone or e-mail, no code or repo paths, no „test” in the appendix or the Komentarze AI

## Tally

8 fixed, 1 asked, 15 dismissed · 0 open.

Total **60 205,97 → 60 661,97 zł** (+456,00 zł). Rows 67 → 67, qty-0 rows 8 → 8.

| Category                    | Count |
| --------------------------- | ----- |
| rule missed (szlif, height) | 2     |
| both places                 | 3     |
| arithmetic (qty + text)     | 2     |
| settled from the inputs     | 1     |
| asked                       | 1     |
