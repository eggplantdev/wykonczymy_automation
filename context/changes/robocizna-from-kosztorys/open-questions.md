# Open questions — robocizna-from-kosztorys (EX-535)

Domain questions that **block finishing this slice** (archive is gated on them). These need the
owner's answer against the reference sheet — they are not resolvable from our code. Add new ones at
the bottom; when one is answered, fold the answer into
`context/reference/kosztorys-editor-domain-notes.md` (the domain authority) and strike it here.

Vocabulary reminder (AGENTS.md): sheet names only — „zaliczka", „wpłaty", „Wartość netto", etc.

---

## Q1 — zaliczka: netto czy brutto? (blocker)

**Obserwacja (arkusz `kosztorys_robocizny`, stopka).** Zaliczki występują w arkuszu w **dwóch
osobnych wierszach**: „zaliczka netto" i „zaliczka brutto" (analogicznie „aktualnie do zapłaty R + M
netto" / „...brutto"). Czyli arkusz trzyma zaliczkę **na obu osiach**.

**Sprzeczność z ustaleniem z 2026-07-19.** Zamknęliśmy model: **VAT dotyczy wyłącznie prac**, a wpłaty
to „pieniądze już wpłacone przez inwestora — nie ma czego gruntować" (face value, brutto === netto).
Skoro zaliczka to wpłata, skąd w arkuszu osobne netto i brutto? Jedna kwota gotówki nie ma dwóch
wartości.

**Czego nie rozumiem / co trzeba rozstrzygnąć:**

- Czy „zaliczka netto" vs „zaliczka brutto" to ta sama kwota widziana z dwóch stron faktury
  (zaliczka = wpłata brutto klienta, z której netto = kwota / (1 + vat))? Wtedy zaliczka jest
  **brutto** u źródła, a „netto" to jej rozbicie — odwrotnie niż nasz model wpłat.
- Czy raczej to artefakt arkusza (dwie osie dla spójności układu), a biznesowo liczy się jedna?
- Jak to wpływa na „Do zapłaty R + M" u nas: dziś gruntujemy tylko robociznę, a wpłaty odejmujemy
  face value. Jeśli zaliczka jest brutto, to od strony brutto odejmujemy brutto — i model „wpłaty bez
  VAT" trzeba zrewidować **tylko dla osi brutto**.

**Dlaczego blokuje slice:** figura „Do zapłaty" (obie surface: edytor Podsumowanie + strona
inwestycji) zależy od tego, czy zaliczka wchodzi netto czy brutto. Bez odpowiedzi nie wiem, czy
obecne „wpłaty face value" jest poprawne na osi brutto.

**Status:** otwarte — czeka na właściciela. Linear: **EX-536** (blokuje EX-535).

---

## Q2 — transakcja `RABAT`: wpisywana netto czy brutto? (blocker rekoncyliacji)

**Obserwacja.** Rekoncyliacja (strona inwestycji „z kosztorysu") porównuje **rabat kosztorysowy
netto** z **Σ transakcji `RABAT`** dla inwestycji. Porównanie jest **netto ↔ netto** — nie gruntujemy
strony kosztorysowej.

**Sprzeczność / czego nie wiemy.** Ustaliliśmy (2026-07-19), że rabat to obniżka **prac**, więc na
osi brutto gruntuje: `rabat_brutto = rabat_netto × (1 + vat)`. Skoro rabat ma wymiar netto/brutto, to
gdy właściciel wpisuje transakcję `RABAT`, wpisuje kwotę **netto czy brutto**? Jeśli myśli „daję 100%
rabatu z brutto" i wpisuje brutto, to Σ `RABAT` jest brutto, a kosztorysowy rabat netto — i
rekoncyliacja **fałszywie zaświeci o VAT** (rabat 100 netto vs 123 brutto). Dokładnie ta sama pułapka
co przy zaliczce (Q1/EX-536).

**Do rozstrzygnięcia:**

- Czy transakcja `RABAT` (i `LABOR_COST`) jest wpisywana netto? Jeśli tak — obecne netto ↔ netto jest
  poprawne, nic nie zmieniamy.
- Jeśli `RABAT` jest brutto — rekoncyliacja musi gruntować **stronę kosztorysową rabatu** przed
  porównaniem (albo degrossować transakcję), inaczej sygnalizacja świeci na zdrowej inwestycji.

**Dlaczego blokuje slice:** cała figura tego slice'u to „krzycząca" sygnalizacja niezgodności. Jeśli
źle dobierzemy oś (netto vs brutto) dla rabatu, wskaźnik daje false-positive — czyli robi dokładnie to,
przed czym ma ostrzegać.

**Status:** otwarte — czeka na właściciela. Linear: **EX-539** (blokuje EX-535), siostra EX-536.

<!-- Q3 — dopisz kolejne pytania tutaj, tym samym wzorem (Obserwacja / Sprzeczność / Do rozstrzygnięcia / Dlaczego blokuje / Status). -->
