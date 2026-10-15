# Case 23 — review of the AI draft (production #218)

Reviewer pass, 2026-10-15. Spot-checks only, no re-measurement. The rule quotes come from
`inputs/manual-i-komentarze-do-prac.md`.

## Findings

- [x] fixed · Ściany i sufity bez łazienek / Wklejanie narożników aluminiowych… · Komentarz: „To dotyczy tynkowania, wiec przy rynku pierwotnym(stan deweloperski) nie ma to zastosowania, chyba, że budujemy ścianki z gk”. The salon corner sits on a developer wall, and the edges of the small GK frame structure are part of the zabudowa GK price. The row is kept at 0 with that explanation, and the appendix question is replaced by a „Przedmiar 0” line · 2,65 → 0 mb · −92,75 zł
- [x] fixed · Łazienka / Szlifowanie krawędzi płytek na 45 stopni · Komentarz: „zabudowy: … krawędzie nad stelażem WC (geberit)”. The draft counted only the półścianka and the wnęka. The full-width obudowa (110 cm) adds its top edge · 7 → 8 mb · +80,00 zł
- [x] fixed · Podłogi / Klejenie paneli winylowych + Wylewka samopoziomująca + Gruntowanie podłóg · Komentarz on gruntowanie: „gruntowanie pod wylewki samopoziomujące, … pod panele klejone”. Komentarz on listwa łączeniowa: „montujemy to wtedy jak mamy podłogę pływającą”. The laminate alternative also drops gruntowanie (−328,20 zł) and adds a listwa in the bathroom doorway (0,8 mb, +80 zł), so the saving is ≈ −2,1 tys. zł, not −1,8 tys. zł. The question is now also on Gruntowanie podłóg · qty unchanged · 0,00 zł
- [x] fixed · Ściany i sufity bez łazienek / Szlifowanie mleczka, Gruntowanie, Farba podkładowa, Malowanie ścian w kolorze · both places: the appendix point „Gładź bez ścian za zabudowami … (gładź, mleczko, grunt, farba podkładowa, malowanie)” was only on the Gładzie pozycja. It is now on all four · qty unchanged · 0,00 zł
- [x] fixed · Łazienka / Złożenie i montaż szafki nad geberitem · scope: the szablon row would have loaded at 0 with no comment. The visualisations show a tall cabinet above the WC, built in, so it goes to the stolarz. Now 0 with the reason and the 250 zł alternative, on the pozycja and in „Przedmiar 0” · 0 → 0 (with comment) · 0,00 zł
- [x] fixed · appendix „Źródło” line, measurement.md, header of build_draft.py · pliki oznaczone przez właściciela po szkicu. The sentence „Oba pliki nie miały oznaczenia „Do analizy AI” — zostały użyte mimo to…” is removed · — · 0,00 zł
- [x] asked · Kuchnia / Podłączenie płyty indukcyjnej · the rzut elektryki shows „Gniazdo trójfazowe KUCHNIA 400 V” but does not say whether it is the developer's. If the gniazdo is not at the płyta, add „Doprowadzenie przewodu 3-fazowego z montażem gniazda”. The question is on the pozycja and in the appendix (Elektryka) · qty unchanged · 0,00 zł (possible +500 zł)
- [x] dismissed · Łazienka / Wymurowanie ścianki w strefie prysznicowej + Płytki w glifach · Manual: count the ścianka in stan deweloperski when it is in the projekt. The glify in the wnęka are a separate operation, so nothing is counted twice
- [x] dismissed · Ściany i sufity / Gładzie na ścianach · the bed-wall and wardrobe deduction (14,5 m²) is backed by the visualisations: the padded headboard with shelving and the tall wardrobe reach the ceiling. The kitchen deduction is the Manual rule
- [x] dismissed · Łazienka / Malowanie sufitów i ścian bez glazury (3,38 m² of walls behind the WC cabinet and the pralka column) · the walls stay visible above and beside the zabudowa, so painting them is reasonable
- [x] dismissed · Wyburzenia / Bruzdowanie elektryczne 90 mb and Naprawy po bruzdach 72 + 20 mb · these follow the Manual's 2 mb/pkt and „naprawy tyle samo co bruzdowania” rules, and stay under the 100 mb limit
- [x] dismissed · Łazienka / Wiercenie 18, Taśma 16 mb, Silikon 25 mb, Folia, Gruntowanie 2× · each sits within its Manual band: min. 15; ok. 15 mb na 4 m²; 20–30 mb; folia on all walls + floor
- [x] dismissed · Łazienka / Fugowanie · the fuga covers every tile once: 17,33 + 4,52 standard and 4,45 small
- [x] dismissed · Łazienka / Zawór czerpalny 1 · Manual: „tylko pod pralkę”
- [x] dismissed · Elektryka / Montaż gniazdek 24 + łączniki schodowe 8 · Manual: montaż = punkty; the schodowe/krzyżowe are not double-counted
- [x] dismissed · Elektryka / Przebudowa rozdzielni 1 · Manual: przy indukcji minimum przebudowa rozdzielni
- [x] dismissed · Podłogi / Listwy 20 mb · Manual: „lepiej niedoszacować”
- [x] dismissed · Prace dodatkowe / Transport 1500, Big bagi 2 · Manual: small flat; rynek pierwotny
- [x] dismissed · Wyburzenia / Demontaż grzejników 3 · Manual: on the rynek pierwotny the grzejniki always come off
- [x] dismissed · Ściany / height 2,65 instead of 2,68 · the bathroom rozwinięcia (93 + 172) show it; the draft says so on the pozycja
- [x] dismissed · Łazienka / Fugowanie 20 × 20 at the standard rate · too minor to change
- [x] dismissed · glify okienne / zabudowa pionów / szafka podumywalkowa / montaż AGD · not added, and correctly so: tynki deweloperskie; piony already enclosed; stolarz. The reasons are in „Przedmiar 0”
- [x] dismissed · text · no client name, address, contacts, repo paths or code identifiers in the appendix or the Komentarze AI. „Orac Decor” is the drawing's product name

## Tally

7 fixed/asked (6 fixed, 1 asked), 16 dismissed · 0 open.

Total **69 113,14 zł → 69 100,39 zł** (−12,75 zł). Rows 104 → 105; qty-0 rows 1 → 3.
DRY fill: `ok: draft 96 matched + 9 new …, new sections: none, Uwagi AI: yes` ·
`expected AI przedmiar: 69100.39 zł`, which equals the script total.

## By category

| Category                  | Count | Findings                                              |
| ------------------------- | ----- | ----------------------------------------------------- |
| rule missed               | 1     | szlif 45° nad stelażem WC                             |
| rule violated / overcount | 1     | narożniki aluminiowe na rynku pierwotnym              |
| scope missed              | 2     | szafka nad WC without a reason; 400 V gniazdo (asked) |
| both places               | 1     | „bez ścian za zabudowami” on 4 pozycje                |
| arithmetic                | 1     | laminat saving −1,8 → ≈ −2,1 tys. zł                  |
| text                      | 1     | pliki oznaczone przez właściciela po szkicu           |
