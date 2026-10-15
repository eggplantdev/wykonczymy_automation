# Review — case 22 (Marki, 66 m², inwestycja #219)

Independent reviewer pass over the drafter's `measure/ai-draft-pre-review.json` /
`measure/investment-notes-appendix-pre-review.txt`. Fixes land in `scripts/build_draft.py` →
`measure/ai-draft-load.json`, `investment-notes-appendix.txt`, `measurement.md`.

DRY fill after the fixes:

```
kosztorys empty → seed from szablon #166
ok: draft 63 matched + 3 new (the loader writes them), new sections: none, Uwagi AI: yes
expected AI przedmiar: 54363.06 zł
```

= script total 54 363,06 zł.

## Findings

Format: box · disposition · sekcja / opis · rule or reason · qty before → after · zł delta.

### Fixed

- [x] fixed · Ściany i sufity / Gruntowanie farbą podkładową · Komentarz: „tam gdzie malowane tynki też warto zrobic warstwe podkładową… wpisujemy” — wiatrołap (tynk malowany bez gładzi, ściany 6,80 + sufit 2,72) had no farba podkładowa · 180,96 → 190,48 m² · +114,24 zł
- [x] fixed · Ściany i sufity / Naprawy ścian i sufitów po kuciu, bruzdowaniu… · Komentarz: naprawy „tyle samo co bruzdowania” — 2 mb bruzdy pod przesunięty punkt elektryczny, pozycja na 0 · 0 → 2 mb · +50,00 zł
- [x] fixed · Łazienka / Naprawy ścian i sufitów po kuciu, bruzdowaniu… (wstawiona z sekcji ścian) · same Komentarz + „Jeżeli praca dotyczy pracy w łazience to dodajemy do sekcji łazienka.” — 2 mb bruzdy wod-kan w łazience bez napraw · 0 → 2 mb · +50,00 zł
- [x] fixed · Instalacja elektryczna / Montaż gniazdek i włączników · Manual: „Montaż gniazdek i włączników = ilość punktów elektrycznych.” — the moved punkt needs its osprzęt; the draft had 0 and listed it under „Przedmiar 0 świadomie” · 0 → 1 szt · +39,00 zł
- [x] fixed · Łazienka / Akrylowanie · Komentarz: akryl na „styku płytek z sufitem lub ścianą” — the draft counted only the styk with the sufit; the two vertical styki of the płytki with the painted ściana z kotłem (2 × 2,68) were missing · 10,04 → 15,40 mb · +75,04 zł
- [x] fixed · Montaż stolarki / Montaż drzwi, ościeżnic regulowanych… 4 → 3 and Łazienka / Montaż ościeżnicy z drzwiami i klamkami 0 → 1 · „Jeżeli praca dotyczy pracy w łazience to dodajemy do sekcji łazienka.” — szablon has the bathroom-door row in Łazienka (precedent: cases 19 and 20); qty, not price, moved · 0,00 zł
- [x] fixed · Łazienka / Fugowanie ścian i podłóg · Manual: fugowanie = suma wszystkich płytek — 19,85 + 4,62 = 24,47, the draft had 24,48 (rounding of unrounded intermediates) · 24,48 → 24,47 m² · −0,30 zł
- [x] fixed · Łazienka / Szlifowanie krawędzi płytek na 45 stopni · the draft's own components (1,2 × 2 + 1,0 × 2 + 0,55 × 2) add to 5,5, not 5; the „klient ≈ 15 mb” delta fixed to +760 zł · 5 → 5,5 mb · +40,00 zł
- [x] fixed · every wall/area pozycja (Ściany: gładź, gruntowanie ×2, farba podkładowa, mleczko, malowanie; Łazienka: gruntowanie, folia, glazura, mleczko, malowanie, akrylowanie) · Manual: wysokość 2,68 m dla stanu deweloperskiego — „W „Co / ile założono” podaj, którą przyjęto.” — stated in the appendix only, on no pozycja · text only · 0,00 zł
- [x] fixed · Ściany / gruntowanie przed gładzią, farba podkładowa, mleczko, malowanie · both places — the appendix explains walls recomputed from the rzut (123,02 vs klient 144,90 m²); only the gładź pozycja carried it · text only · 0,00 zł
- [x] fixed · Łazienka / Montaż profili i płyt GK w zabudowie geberitu · both places — the appendix asks whether the deweloper already mounted the stelaż; the pozycja had no „Czego nie było wiadomo” · text only · 0,00 zł
- [x] fixed · Łazienka / Montaż zaworów czerpalnych · both places — the appendix pralka question (stoi w łazience? −60 zł) was missing on the pozycja · text only · 0,00 zł
- [x] fixed · Instalacja / Montaż grzejnika z zaworami · both places — the ogrzewanie podłogowe question lived only on Demontaż grzejników and in the appendix · text only · 0,00 zł
- [x] fixed · Podłogi / Układanie paneli + appendix · arithmetic in text — gres w aneksie priced „+0,6 tys. zł”; recomputed with fugowanie, gruntowanie and listwa łączeniowa it is ≈ +0,7 tys. zł · text only · 0,00 zł
- [x] fixed · Ściany / Gruntowanie ścian jednokrotne + appendix · arithmetic in text — wiatrołap w gładzi „+0,6 tys. zł” → ≈ +0,5 tys. zł · text only · 0,00 zł
- [x] fixed · Prace dodatkowe / zabezpieczenia (50425) · text — room codes from the rzut („L1-04 / L1-06”) replaced with the owner's names „pokój I / pokój II” · text only · 0,00 zł
- [x] fixed · appendix header and „Przedmiar 0 świadomie” · arithmetic in text — counts updated (66 pozycji, 6 na 0, 3 wstawione do łazienki), osprzęt removed from the zero list after the fix above · text only · 0,00 zł

### Asked

- [x] asked · Łazienka / Malowanie sufitów i ścian bez glazury + gładź · Komentarz: farba podkładowa „wpisujemy” on świeże gładzie, but the bathroom already has Dwukrotne gruntowanie and the gładź in this pozycja — a separate row may double-count. Question in the appendix and on the pozycja (11,31 m² × 12 zł ≈ +136 zł) · 11,31 unchanged · 0,00 zł

### Dismissed

- [x] dismissed · Łazienka / gruntowanie przed i po gładzi · covered by „Dwukrotne gruntowanie ścian, sufitów i podłóg” in the sekcja
- [x] dismissed · Łazienka / grzejnik at 0 · already asked in both places (rzut shows none)
- [x] dismissed · Wiatrołap / cokół z płytek vs MDF in the client's scope · already asked
- [x] dismissed · Łazienka / szafka podumywalkowa · Manual: „Zwykle montuje stolarz” — client listed it explicitly; already asked
- [x] dismissed · single bathroom sekcja stays „Łazienka” · one bathroom, no rename needed
- [x] dismissed · Kuchnia at 0 · outside the client's scope; asked with ≈ 1,1 tys. zł
- [x] dismissed · kratka wentylacyjna · n/a — wentylator łazienkowy already in Łazienka
- [x] dismissed · rules verified as applied correctly · transport 1 500 + Marki question; 2 big bagi; zabezpieczenia 66,56 m²; wod-kan 4 pkt + wkucie 4; bruzdy wod-kan 2 mb + elektryczne 2 mb; folia 31,17 m²; taśma 20 mb; silikon 20 mb; wiercenie 13; zawory 3; biały montaż 0 (natynkowa); mleczko in Łazienka; listwy −25%; gruntowanie podłóg only in the wiatrołap; opaski 0; walls behind kitchen cabinets left out; akrylowanie only at the sufit in Ściany

## Tally

17 fixed, 1 asked, 8 dismissed · 0 open

Total: **53 995,08 → 54 363,06 zł** (+367,98 zł). Rows 63 → 66 (3 moved into Łazienka), qty 0: 6.

| Category                            | Count |
| ----------------------------------- | ----- |
| rule missed (incl. bathroom sekcja) | 6     |
| scope missed                        | 0     |
| both-places                         | 5     |
| arithmetic (qty + text)             | 5     |
| text                                | 1     |
