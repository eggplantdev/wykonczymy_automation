---
change_id: kosztorys-per-etap-cost-variant
title: 'Wariant kosztu podwykonawcy per etap — kaskada + widok mieszany + bramka rozliczenia'
status: planned
created: 2026-07-21
updated: 2026-07-21
archived_at: null
branch: konradantonik/ex-554-podsumowanie-dodac-figure-kwota-do-zaplaty-podwykonawcy
worktree: null
---

**Linear:** [EX-562](https://linear.app/ex-plant/issue/EX-562) (Todo, powiązane z EX-554).

## Notes

Cena podwykonawcy „z narzędziami" i „bez narzędzi" to NIE dwie równoległe ceny tej samej pracy —
dana praca jest wykonana **albo** z narzędziami **albo** bez (OR, nie AND). Co więcej wariant zmienia
się **per etap** (kilka ekip; „etapy 1–2 z narzędziami, 3–4 bez"). Dziś silnik wycenia całość po
jednym **globalnym** widoku i jest ślepy na etap → rozjazd „suma wykonanej pracy" 78k (całość z) vs
56k (arkusz, realnie bez).

Ten change dokłada **oś etapu** do wyboru wariantu (kaskada default sekcji → sekcja×etap → praca×etap),
liczy koszt jako **Σ po komórkach** (ilość_etapu × stawka rozwiązanego wariantu), dodaje **czwarty
widok „Mieszany"** (= rzeczywistość; z/bez zostają jako widełki-hipoteza) i **bramkuje** blok
„pozostało do wypłaty" do widoku mieszanego. Nadbudowuje EX-554 (`podsumowanie-podwykonawcow`).

Design zamknięty: `context/reference/kosztorys-editor-domain-notes.md` → „Wariant z/bez narzędzi".

## Decyzje (właściciel, 2026-07-21)

- **Jeden slice** — silnik + pełna klikalna edycja per etap/komórka razem.
- **Pełna kaskada, 3 poziomy od razu** — default sekcji → sekcja×etap → praca×etap.
- **„Mieszany" na końcu przełącznika widoków** (najrzadziej używany; edytor startuje na Kliencie,
  `DEFAULT_VIEW` bez zmian); z/bez zostają jako widełki (bez bloku rozliczenia).
