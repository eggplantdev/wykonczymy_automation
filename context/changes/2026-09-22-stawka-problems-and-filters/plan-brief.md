# Sufit stawki wykonawcy schodzi z alarmu — skrót planu

> Pełny plan: `context/changes/2026-09-22-stawka-problems-and-filters/plan.md`
> Research: `context/changes/2026-09-22-stawka-problems-and-filters/research.md`

## Co i po co

Menu „Problemy" nazywa zepsutą stawkę, którą właściciel uznał za legalną, a od zdjęcia twardego capa
na mnożniku (2026-09-21) jedno naciśnięcie klawisza wrzuca tam całą rozpiskę. Sufit 65% przestaje
więc być alarmem i staje się sposobem czytania rozpiski: sądzi wyłącznie **kwotę stałą**, a pozycja
„auto" odsyła do mnożnika, który ma własne czerwone pole.

## Punkt wyjścia

`checkSubcontractorPrice` sądzi liczbę **po** podstawieniu mnożnika, nie pytając, czy ktoś ją wpisał
— a czyta go jednym głosem pięć powierzchni (komórka, polityka edycji, wstawianie z katalogu, dwa
wpisy rejestru). Pole mnożnika ostrzega tylko powyżej 0,65. 466 z 4239 pozycji w bazie przekracza
sufit na kwocie stałej; 118 z 483 trafień zgadza się z katalogiem prac co do grosza, a pozostałe są
już policzone przez dwa wpisy katalogowe.

## Stan docelowy

Kwota stała 80 zł przy cenie 100 zł: komórka czerwona, komunikat jak dziś — ale w „Problemach" tej
pozycji nie ma. Znajduje się ją w „Filtrach", odznaczając „Pozycje bez kwoty stałej powyżej sufitu".
Mnożnik 0,9 czerwieni jedno pole zamiast wrzucać 1123 pozycje „auto" do listy; mnożnik 0 robi to
samo, czego dziś nie robi nic. W „Problemach" zostaje jeden wpis o stawce: „Pozycje z ujemną stawką
wykonawcy". Chip pod paskiem mówi, w którym widoku zawężenie działa. „Filtry" dostają zbiorcze
zaznacz / odznacz wszystkie.

## Podjęte decyzje

| Decyzja              | Wybór                                                       | Dlaczego                                                                                   | Źródło             |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------ |
| Gdzie siada bramka   | W strażniku, nie w rejestrze                                | Pięć powierzchni czyta jedną funkcję — powtórzenie warunku to rozjazd                      | Rozmowa            |
| Zasięg bramki        | Tylko piętro sufitu                                         | `investmentCoeffsSchema` nie ma `.min(0)`, więc ujemna stawka z „auto" jest osiągalna      | Research           |
| Etykiety nowej pary  | „z kwotą stałą powyżej sufitu" / „bez kwoty stałej powyżej" | Dopełnienie musi być ścisłą negacją, więc obejmuje „auto" — etykieta nie może tego ukrywać | Właściciel         |
| Identyfikatory       | Nowe, nie `overpriced-*`                                    | localStorage bez wersji i bez czyszczenia — przejęcie id odwróciłoby zapisany tick         | Research           |
| Mnożnik 0            | Ostrzegamy, tym samym kanałem co sufit                      | Bramka zamyka jedyne miejsce, które dziś to łapie                                          | Właściciel         |
| Płaszczyzna w UI     | Na chipie, nie w wierszu menu                               | Menu ma nagłówek grupy; pasek chipów nie ma nic                                            | Research (korekta) |
| Nazwa na przycisku   | Bez zmian                                                   | Chip już nazywa zawężenie i ma przy sobie „X"                                              | Research (korekta) |
| Zbiorczy przełącznik | Rozszerzenie `FilterMultiSelect`                            | Komponent ma już `toggleAll` — nie renderuje go tylko dla grupy `toggles`                  | Plan               |
| Para „bez ceny j.m." | Zostaje rozdzielona, także na warsztacie                    | To narzędzie do debugowania importowanych kosztorysów                                      | Właściciel         |
| Bug `isWorkshop`     | Skreślony, nie zgłoszony                                    | Nieosiągalny: warsztat wchodzi tylko przez `/szablony`, a `/inwestycje/151` 404-uje        | Plan (korekta)     |

## Zakres

**W zakresie:** bramka „tylko kwota stała" w strażniku; ostrzeżenie przy mnożniku 0; dwie diagnostyki
wymienione na `negative-rate-*`; cztery nowe filtry sufitu; `no-*-price` na źródle zamiast na
wyniku; kasacja martwego `tone`; nieobcięta etykieta na chipie; zbiorcze zaznacz/odznacz w „Filtrach";
pięć kłamiących kopii i komentarzy.

**Poza zakresem:** `isWorkshop` (nieosiągalny), obcięcie ogona „w widoku …" w menu, nazwa zawężenia
na przycisku „Problemy", `isOverCeiling` u czytelników katalogowych, `min={0}` i schemat mnożnika,
zlanie pary „bez ceny j.m.", E2E.

## Podejście

Pięć faz w kolejności zależności: strażnik (bo pięć powierzchni czyta go naraz) → rejestr (już tylko
konsekwencja) → chip → zbiorczy przełącznik → kopie i dokumentacja. Dwie ostatnie fazy są niezależne
od sufitu i dają się przestawić.
