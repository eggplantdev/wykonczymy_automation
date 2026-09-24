---
change_id: stawka-problems-and-filters
title: Sufit stawki wykonawcy schodzi z alarmu, a zawężenie zaczyna się nazywać
status: archived
created: 2026-09-22
updated: 2026-09-23
archived_at: 2026-09-23T08:36:36Z
branch: staging
worktree: null
linear: EX-820
---

## Notes

EX-820: menu „Problemy" nazywa zepsutą stawkę, którą właściciel 2026-09-20 uznał za legalną,
i od 2026-09-21 (zdjęcie twardego capa na mnożniku) jedno naciśnięcie klawisza w pasku potrafi
wrzucić tam całą rozpiskę. Burza mózgów rozszerzyła zakres z samego wpisu w rejestrze na całe
pytanie „co należy do «Problemów», a co do «Filtrów»" plus czytelność zawężenia.

Zmierzone na lokalnym zrzucie (docker 5433, kopia produkcji):

- 4239 pozycji w 13 rozpiskach; 3124 mają kwotę stałą, 1123 są „auto" na planie z narzędziami.
- 466 pozycji (483 trafienia na planach) przekracza sufit **na kwocie stałej**; tylko 52 z nich
  mają przedmiar albo wykonaną pracę.
- Dziś **żadna** inwestycja nie ma mnożnika powyżej 0,65 i żadna nie ma zera — bramka na „auto"
  jest więc czysto prewencyjna: zamyka dziurę otwartą przez zdjęcie capa.
- Warsztat szablonów = inwestycja 151, 311 pozycji, zero przedmiaru, współczynniki 0,65 / 0,5525.
- **Wszystkie 10** pozycji warsztatu powyżej sufitu zgadza się z katalogiem prac co do grosza.
- W całości bazy 118 z 483 trafień (24%) jest zgodnych z katalogiem; pozostałe 365 jest już
  policzone przez „Inne liczby niż w katalogu prac" (268) i „Brak w katalogu prac" (97).

## Decyzje właściciela (nie wynikają z kodu)

- **Stawka zgodna z katalogiem prac nie jest problemem, nawet powyżej 65%.** Skoro cennik ją nosi,
  jest legalna. To zdejmuje wpisowi o zbyt wysokiej stawce jego własny zbiór wierszy: reszta jest
  już liczona przez dwa wpisy katalogowe.
- **Pozycja na „auto" nie jest sądzona sufitem ani łapana na zero.** Autorem tej liczby jest
  mnożnik inwestycji, a mnożnik ma własne czerwone pole i własny komunikat — sądzenie pochodnej
  jest sądzeniem tej samej decyzji drugi raz, tyle że tysiąc razy.
- **Sufit zostaje w „Filtrach".** Pytanie „pokaż mi pozycje powyżej sufitu" jest sensownym
  czytaniem rozpiski; alarmem nie jest.
- **Etykiety w „Problemach" muszą nieść płaszczyznę** („z narzędziami" / „bez narzędzi"), bo po
  włączeniu zawężenia nie widać, który filtr jest wybrany.

## Rozstrzygnięcia inżynierskie

- Bramka „tylko kwota stała" siada **w strażniku** (`subcontractor-price-guard.ts`), nie w rejestrze
  — czerwona komórka, komunikat i filtr muszą mówić jednym głosem.
- Oba wpisy o zbyt wysokiej stawce wychodzą z „Problemów"; zostaje w nich **ujemna stawka** pod
  etykietą, która ją nazywa (dziś obie kondygnacje strażnika jadą pod jedną, mylącą nazwą).
- W „Filtrach" pojawia się **para** „powyżej sufitu" / „w granicach sufitu" — picker z jedną połową
  osi nie umie wyrazić „pokaż mi te drugie".
- Czerwona komórka i komunikat zostają na każdej kwocie stałej powyżej sufitu, także zgodnej
  z katalogiem: to jest miejsce, w którym liczba powstała.
- **Para „bez ceny j.m." zostaje rozdzielona — także na warsztacie (właściciel, odwrócone
  2026-09-22).** Rozważaliśmy zlanie jej w jeden wpis tam, gdzie „wykonana praca" jest strukturalnym
  zerem, ale rozdział jest narzędziem do debugowania importowanych kosztorysów: import wnosi pracę
  wykonaną bez ceny i to jest osobne zdarzenie od nieskończonej oferty. Długa nazwa drugiego wpisu
  zostaje, bo stoi obok swojego bliźniaka.
- **Płaszczyznę odzyskuje pasek chipów, nie wiersze menu (poprawione po researchu).** Menu obcina
  ogon „w widoku …", bo nagłówek grupy nad wierszem już nazywa widok — ta decyzja ma dzień
  (`7af9945b`) i dalej jest prawdziwa. Powierzchnią, która realnie gubi płaszczyznę, jest pasek
  zaangażowanych zawężeń (`active-filters-model.ts:75`) — czyta to samo, już obcięte pole,
  a renderuje się dokładnie wtedy, gdy zawężenie jest włączone. Chip dostaje etykietę nieobciętą;
  wiersze menu zostają bez zmian.
- **Przycisk „Problemy" zostaje bez nazwy zawężenia.** Chip pod paskiem już je nazywa i ma przy
  sobie „X"; nazwa na triggerze byłaby drugą kopią tej samej informacji, ucinaną przez `truncate`.
- **Nowa para filtrów będzie oferowana tylko w widoku swojego planu** — `offeredFilterConditions`
  (`row-conditions/queries.ts:199`) wpuszcza filtr związany z planem wyłącznie w tym widoku.
  Świadomie przyjęte: tak zachowuje się istniejąca para „kwota stała" / „auto", a reguła
  „licznik jest niezależny od widoku" (2026-08-17) dotyczyła **defektów** — przeniesienie tych
  wierszy do „Filtrów" jest właśnie orzeczeniem, że to nie są defekty.
  > **ODWRÓCONE nazajutrz (EX-856, 2026-09-23, właściciel).** Bramka widoku zniknęła: menu „Filtry"
  > oferuje obie płaszczyzny zawsze, a listę skraca próg licznika (`count > 0`). Powód: połowa osi
  > była nieosiągalna z widoku, który czyta niemal każdy, zza przełącznika, którego nikt nie używa
  > jako włącznika filtrów.
- **Bramka „tylko kwota stała" obejmuje wyłącznie piętro sufitu.** `price < 0` zostaje bezwarunkowe:
  `investmentCoeffsSchema` nie ma `.min(0)`, więc ujemny mnożnik jest osiągalny, a wtedy „auto"
  produkuje ujemną stawkę, którą trzeba odmówić.
- Do poprawienia przy okazji, bo zaczną kłamać: `sheet-rates-block.tsx:145` odsyła do
  „Problemy → bez ceny wykonawcy"; `context/reference/kosztorys-editor-domain-notes.md:629`
  twierdzi, że mnożnik wciąż odmawia twardo (nieprawda od 2026-09-21), a `:914` opisuje wiersze
  sufitu jako problemy niezależne od widoku.
- Martwe pole `RowConditionT.tone` znika przy okazji (pisane 13×, czytane nigdzie).
- **Etykiety nowej pary nazywają źródło, nie tylko sufit (właściciel, 2026-09-22):** „z kwotą stałą
  powyżej sufitu" / „bez kwoty stałej powyżej sufitu". Dopełnienie musi być ścisłą negacją, więc
  druga połowa obejmuje też wiersze „auto" — etykieta przez zaprzeczenie czyta się ciężej, ale nie
  twierdzi, że ktoś te wiersze zmierzył.
- **Mnożnik 0 dostaje własne ostrzeżenie (właściciel, 2026-09-22)** — tym samym kanałem co sufit
  (`coeffWarning` + czerwone pole). Bramka na kwotę stałą zdejmuje sąd także z wpisów „bez ceny
  wykonawcy", a to było jedyne miejsce, które zero mnożnika w ogóle sygnalizowało.
- **`isWorkshop = templatePresetId != null` NIE jest bugiem — skreślone, nie zgłoszone.** Notatka
  w `research.md` była błędna: warsztat jest osiągalny wyłącznie przez `/szablony/[id]`, które przy
  pustym warsztacie renderuje `OpenWorkshopPrompt` zamiast edytora, a `/inwestycje/[id]/kosztorys_v2`
  404-uje na inwestycji szablonowej, bo `fetchReferenceData` wycina ją zapytaniem
  (`lib/queries/reference-data.ts:71`). Defekt bez możliwego użytkownika.
- **Dryf komentarzy wokół warsztatu naprawiamy** (`kosztorys-v2-columns.tsx:101`,
  `workshop-columns.test.ts:73-74,82-83`): twierdzą, że warsztat ukrywa przełącznik widoku i jest
  przypięty do planu klienta — nie jest. Asercje zostają, kłamią tylko uzasadnienia.
  > **CZĘŚCIOWO ODWRÓCONE nazajutrz (EX-856, 2026-09-23).** Warsztat stracił przełącznik „Widok
  > cen" — czyli pierwsza połowa tamtych komentarzy znów jest prawdziwa, tyle że z innego powodu
  > (decyzja właściciela, nie skutek uboczny). Przypięcie do planu klienta nadal nie zachodzi.
- **Menu „Filtry" dostaje zbiorcze zaznacz / odznacz wszystkie** — tym samym komponentem co picker
  kolumn (`ColumnToggleMenu`, ikona `CheckCheck`, wiersz `forceMount` na górze listy), nie drugą
  implementacją tego samego gestu. Odznaczenie wszystkiego wygasza siatkę, ale dokładnie tak samo
  zachowuje się „Ukryj wszystkie" w kolumnach, a „Zresetuj filtry" stoi w tym samym menu jako droga
  powrotna.
