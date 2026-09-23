---
change_id: filtry-bez-widoku
title: „Filtry" przestają zależeć od widoku cen, pokazują tylko to, co jest, i nazywają kategorie
status: implemented
created: 2026-09-23
updated: 2026-09-23
archived_at: null
branch: null
worktree: null
linear: EX-856
---

## Notes

Trzy rzeczy w jednym menu „Filtry", plus jedna konsekwencja w warsztacie szablonu.

1. **Zawężenia przestają zależeć od widoku cen.** Dziś filtr przypisany do płaszczyzny jest
   oferowany wyłącznie w widoku tej płaszczyzny (8 z 16 filtrów). Właściciel (2026-09-23): „i tak mi
   się nie podoba, nie ma sensu" — menu ma pokazywać wszystkie, zawsze.
2. **Filtr z licznikiem 0 nie jest listowany.** Dokładnie ta sama reguła, którą „Problemy" mają od
   dawna: lista jest raportem o tym, co w rozpisce JEST, a wiersze na stałym zerze zakopują ten
   jeden, który zerem nie jest. Zaangażowany filtr zostaje na liście także przy zerze — inaczej
   zabieramy wyłącznik, kiedy zawężenie dalej trzyma siatkę obciętą.
3. **Wiersze dostają nagłówki kategorii**, jak pozostałe rozwijane listy w tym pasku. Płaszczyzna
   przenosi się z ogona etykiety („… w widoku z narzędziami") do nagłówka grupy — ten sam ruch, który
   EX-820 zrobił w „Problemach".
4. **Warsztat szablonu traci przełącznik „Widok cen", a płaszczyzna zostaje przypięta do „Inwestor".**
   Lista kolumn warsztatu jest zamknięta (sufit i podłoga), więc obie płaszczyzny są tam na ekranie
   równocześnie i przełącznik nie zmienia ani jednej kolumny — ale **nie jest bezczynny**. Rusza
   listę filtrów (to zamyka punkt 1) i klucz sortowania kolumny „Cena j.m.", która na płaszczyźnie
   wykonawcy sortuje po stawce wykonawcy, pokazując cenę klienta — dzisiejsza usterka, którą
   przypięcie przy okazji zamyka. Przypięcie jest konieczne, bo ten przycisk jest **jedynym**
   zapisującym wybór widoku dla warsztatu: samo jego ukrycie zamroziłoby na zawsze każdą
   przeglądarkę, która wcześniej stanęła na płaszczyźnie wykonawcy, bez kontrolki, żeby wrócić.
   Przypinamy **bazowy** widok — ulotna nakładka z „Problemów" zostaje, bo to ona prowadzi
   czytelnika do wady. Panel podsumowania ma własny przełącznik, niezależny od tego.

Punkty 1 i 4 są sprzężone i muszą pójść razem: samo zdjęcie przycisku zostawiłoby warsztat na
widoku klienta z połową zawężeń niedostępną i kolumnami, których dotyczą, dalej na ekranie.

Kontekst: wypadło z bramki przeglądu `2026-09-22-szablon-autosave` (rozmowa o tym, co właściwie
w warsztacie robi przełącznik widoku). Sąsiedni slice EX-820 (`2026-09-22-stawka-problems-and-filters`)
dotknął tego samego menu od strony „co jest problemem, a co zawężeniem" — przeczytać jego
`change.md` przed planem, żeby nie odwrócić jego rozstrzygnięć.
