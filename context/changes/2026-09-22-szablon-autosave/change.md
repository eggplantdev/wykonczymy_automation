---
change_id: szablon-autosave
title: Szablon zapisuje się sam — koniec z „Zapisz szablon" jako osobnym krokiem
status: implemented
created: 2026-09-22
updated: 2026-09-22
archived_at: null
branch: empty-preset-create
worktree: null
---

## Notes

Warsztat szablonu (`/szablony/[id]`) renderuje ten sam edytor co inwestycja, ale ma dwa różne
modele trwałości naraz: komórki zapisują się same (do inwestycji-warsztatu), a treść szablonu
przenosi się do biblioteki dopiero po kliknięciu „Zapisz szablon". To jest źródło konfuzji
zgłoszone przez właściciela — na inwestycji nic się nie klika, tutaj trzeba.

Cel: szablon ma zapisywać się sam, analogicznie do kosztorysu na inwestycji.

## Decyzje właściciela (nie wynikają z kodu)

- **Nie dyskutujemy „czy".** Wersjonowanie (punkty przywracania per szablon) już istnieje, więc
  zapis nie jest nieodwracalny. Rozmowa dotyczy wyłącznie kształtu rozwiązania.
- **Przycisk „Zapisz szablon" znika bez śladu** — nie zastępuje go pasywny status („Zapisano
  10:42"). Powód: na inwestycji sukces też jest niemy, a status tylko na szablonie odtwarzałby tę
  samą asymetrię, którą ta zmiana likwiduje. Odmowa „warsztat trzyma teraz inny szablon" zostaje po
  stronie serwera jako cichy warunek zapisu.
- **Warsztat dostaje własną, zamkniętą listę kolumn** — Sekcja, Opis prac, Jednostka miary,
  Cena j.m. netto/brutto, Źródło ceny wykonawcy, Komentarz. Reszta siatki (Przedmiar i wszystko
  z niego liczone, rabaty, etapy, Razem, Rozjazd z arkuszem) nie ma się w warsztacie **budować** —
  nie „być domyślnie schowana" i nie „być readonly". Readonly „Razem netto" z zerem w każdym wierszu
  czyta się jak zepsute liczenie, a nie jak „tu nie dotyczy".
  Lista nie czyta globalnych preferencji kolumn (`table-columns:kosztorys` jest per przeglądarka,
  nie per kosztorys), więc wybór zrobiony na inwestycji nie wycieka do warsztatu.
  **Picker kolumn znika w warsztacie jako konsekwencja**, nie jako mechanizm: samo schowanie go
  przy dzisiejszych domyślnych ustawieniach zostawiłoby komplet pól-pułapek bez możliwości ich zdjęcia.
  **„Akcje" zostaje** — siatka stoi na `lockRows`, więc to menu jest jedyną drogą do usunięcia,
  przestawienia i wstawienia pozycji, a belka sekcji ma w tej samej kolumnie swoje „…".
- **Komentarz jest jedynym wyjątkiem w drugą stronę** — zostaje w siatce i szablon zaczyna go nieść
  (dziś jest wycinany przy serializacji). Uwaga o samej pracy („cena zawiera transport") przenosi się
  na każdą kolejną budowę; Przedmiar, rabat i etapy nie.

## Rozstrzygnięcia inżynierskie (bez pytania właściciela)

- Zapis do biblioteki **dławiony w czasie** — wklejenie 50 komórek daje jeden zapis, nie 50.
- Serializacja + zapis w **jednej transakcji** pod tą samą blokadą inwestycji co reszta mutacji.
- Zapis **nie wymusza odświeżenia trasy** (koszt zdjęty przez EX-597 nie ma tu wrócić).
- Szablon dostaje **datę modyfikacji** — dziś tabela jej nie ma, więc lista szablonów nigdy by nie
  drgnęła; przy okazji zapis przestaje nadpisywać autora.
- **Punkty przywracania zostają co 10 minut** — warsztat nie dostaje gęstszego interwału.
  Świadomie przyjęte okno: przy nadpisywaniu szablonu co kilkanaście sekund cofnąć się można
  najwyżej do stanu sprzed 10 minut. Uzasadnienie właściciela: „to jest tylko szablon, realnie nic
  tam nie tracimy". Automatyczny zapis **nie** zostawia własnego punktu; punkt powstaje tylko przed
  eksmisją warsztatu przez inny szablon (tak jak dziś).
- **Dławik: ~10 s** między zapisami do biblioteki, plus dopchnięcie po bezczynności i przy
  opuszczeniu ekranu. Sam dławik nie wystarcza — bez dopchnięcia ostatnia zmiana przed odejściem
  od klawiatury nigdy nie trafiłaby do szablonu (cichy ubytek, ten sam co dziś przy niekliknięciu,
  tylko bez przycisku, którego można nie kliknąć).

## Porządki w menu Opcje (warsztat)

- **„Wczytaj szablon…" w warsztacie znaczy „przełącz warsztat na tamten szablon"** — ta sama
  ścieżka co kliknięcie szablonu na liście: przesuwa wskaźnik i robi punkt ochronny przed
  zmieceniem drzewa. Dzisiejsze znaczenie (zastąp treść, **nie ruszając wskaźnika**) jest pod
  autozapisem pułapką kasującą szablon: treść wybranego szablonu zostaje po kilkunastu sekundach
  przepisana do wiersza tego, który był otwarty. Etykieta zmienia się na **„Przełącz na inny
  szablon…"**, a ostrzeżenie w oknie mówi, że bieżący szablon zostaje w bibliotece — zamiast
  dzisiejszego „cała rozpiska zostanie zastąpiona".
- **Edytor dostaje rzeczownik, którym o sobie mówi** — „kosztorys" na inwestycji, „szablon"
  w warsztacie — zamiast generycznych etykiet, które psułyby oba ekrany naraz. Dotyczy m.in.
  „Wyczyść kosztorys…" + okna, „Przywróć kosztorys do wcześniej zapisanego stanu.",
  „Kosztorys jest pusty", opisu porównania z katalogiem.
- **Z warsztatu wypadają rzeczy bez adresata:** podgląd inwestora i udostępnianie linku (szablon nie
  ma inwestora). Sekcja „Arkusz Google" już się nie pokazuje — szablon nie ma podpiętego arkusza.
- **„Zapisz jako szablon…" → „Zapisz jako nowy szablon…"** — jedna etykieta na obu ekranach; „nowy"
  odróżnia odbicie kopii od zapisu bieżącego.
