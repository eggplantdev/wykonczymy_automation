# Widok pracownika — projekt (część 1: tylko odczyt)

Uzgodnione z ownerem 2026-09-28. Wejście do `/10x-plan kosztorys-worker-view`.

## Cel

Pracownik / podwykonawca dostaje od ownera **imienny** widok kosztorysu inwestycji — link na żywo
albo wydruk PDF — w którym widzi, co ma zrobić i ile na tym zarobi, a w trakcie: ile zrobił, ile mu
wypłacono i ile mu się jeszcze należy. Analogia do widoku inwestora, ale po stawce wykonawcy.

**Poza zakresem (część 2, osobna zmiana):** pracownik niczego nie wpisuje. Ta zmiana świadomie
kładzie pod część 2 fundament — link identyfikuje pracownika, a zakres widoku to etapy z jego
przypisaniem, więc „uzupełnianie" przełoży się 1:1 na „wpisuje ilości tylko w swoich etapach".

## Punkt wyjścia w kodzie (już istnieje)

- Etap (`kosztorys-stages`) ma `worker` (EX-613) i `plane` (`w_tools` / `own_tools`, `null` =
  niepotwierdzone).
- `subcontractorDueByPlane(...).byWorker` — wartość wykonanej pracy per pracownik (jego etapy, po
  planie etapu, przed rabatem); `derivePayoutsByWorker` — wypłaty per pracownik.
- Widok inwestora: `kosztorys-shares` (token, jeden na inwestycję) → `/k/[token]`, allowlista
  `PREVIEW_VISIBLE_COLUMNS`, blokada `assertDisclosurePair`, reguła `client-empty`, wydruk
  `offer-print/`, ustawienia `kosztorys-client-view` + global domyślny.

## Ustalenia

| #   | Decyzja                                                                                                                                                                                                                                                                                                                                                                                                                         | Dlaczego                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Link imienny**: jeden na parę inwestycja + pracownik. Imię i nazwisko w nagłówku widoku i PDF.                                                                                                                                                                                                                                                                                                                                | Część 2 musi wiedzieć, KTO wpisuje; link anonimowy trzeba by przepisać.                                                                                                           |
| 2   | Pracownik widzi **wszystkie pozycje** („Przedmiar" nie jest dzielony na etapy), ale **tylko kolumny swoich etapów**.                                                                                                                                                                                                                                                                                                            | Zgodne z przypisaniem etapu; w części 2 = „pisze tylko w swoich".                                                                                                                 |
| 3   | **Stawka wynika z rozliczenia jego etapów** — nikt jej nie wybiera. Pracownik widzi wyłącznie swoją stawkę.                                                                                                                                                                                                                                                                                                                     | Jeden pracownik na jednej inwestycji ma w praktyce jedno rozliczenie (owner).                                                                                                     |
| 4   | **Jeden tryb** — bez podziału Oferta / Rozliczenie.                                                                                                                                                                                                                                                                                                                                                                             | Pusta kolumna etapu to lista do zrobienia, nie szum; nie ma momentu „przełącz tryb".                                                                                              |
| 5   | **Jeden zestaw ustawień kolumn na całą firmę** (+ „ukryj puste pozycje"). Bez nadpisania per inwestycja.                                                                                                                                                                                                                                                                                                                        | Narzędzie robocze, nie dokument dla klienta; nadpisanie dołożymy, gdy ktoś poprosi.                                                                                               |
| 6   | Podsumowanie: **wykonane / wypłacone / pozostało do wypłaty**; nadwyżka wypłat → „Nadpłata", nie liczba ujemna.                                                                                                                                                                                                                                                                                                                 | Odpowiada na „ile mi jeszcze wisicie"; obie liczby już istnieją.                                                                                                                  |
| 7   | Link i PDF generowane z **edytora, menu „Pracownicy"**.                                                                                                                                                                                                                                                                                                                                                                         | Tam jest link inwestora i przypisanie etapu.                                                                                                                                      |
| 8   | Pracownik traci wszystkie etapy → link działa, pokazuje „Brak przypisanych etapów". Odwołanie tylko świadomie.                                                                                                                                                                                                                                                                                                                  | Jak u inwestora.                                                                                                                                                                  |
| 9   | „Pozostało" = wartość przedmiaru po jego stawce minus praca wykonana we **wszystkich** etapach (nie tylko jego).                                                                                                                                                                                                                                                                                                                | To lista „co jeszcze do zrobienia" na pozycji; pozycja dokończona przez kogoś innego pokazuje 0. Tak samo liczy widok inwestora.                                                  |
| 10  | „Wypłacone" = suma **+ lista jego wypłat** z tej inwestycji (data, kwota — bez opisu).                                                                                                                                                                                                                                                                                                                                          | Pracownik sam sprawdza, z czego suma się składa; opis bywa wewnętrzną notatką.                                                                                                    |
| 11  | Etapy pracownika na **dwóch różnych rozliczeniach** → menu blokuje link i PDF („Etapy pracownika mają różne rozliczenia"), jak przy etapie bez rozliczenia.                                                                                                                                                                                                                                                                     | W praktyce się nie zdarza; jedna „Cena j.m." na pozycję musi mieć jedno znaczenie.                                                                                                |
| 12  | Dezaktywowany pracownik — link działa dalej.                                                                                                                                                                                                                                                                                                                                                                                    | Odwołanie tylko świadomie (jak #8).                                                                                                                                               |
| 13  | **Nowa kolumna „Wartość przedmiaru netto — <rozliczenie>"** (przedmiar × stawka rozliczenia) w edytorze, w widokach „Z narzędziami" i „Bez narzędzi" — widzi ją owner **i manager**; ta sama kolumna jest „wartością przedmiaru po jego stawce" w widoku pracownika. Tylko netto — widoki podwykonawców nie mają brutto (wypłaty bez VAT, EX-558). W widoku klienta się nie pojawia (byłaby kopią „Wartości przedmiaru netto"). | Owner 2026-09-28. Nie zmienia ustalenia z 2026-09-23: istniejąca „Wartość przedmiaru netto" dalej liczy po cenie klienta w każdym widoku — to jest kolumna **obok**, nie zamiast. |

## Dane

- **Nowa kolekcja linków pracowniczych** (np. `kosztorys-worker-shares`): `investment`, `worker`
  (→ `users`), `token` (mintowany, readOnly); unikalność na parze `investment + worker`; odwołanie =
  usunięcie wiersza. Dostęp: admin / owner / manager.
  **Osobna od `kosztorys-shares`, nie kolumna w niej** — to token decyduje, który widok się otwiera;
  wspólna tabela wymagałaby rozgałęzienia „inwestor czy pracownik", którego pomyłka otwiera widok
  z ceną klienta.
- **Nowy global ustawień widoku pracownika**: `hiddenColumns` + `hideEmptyRows`. Odczyt admin / owner
  / manager, zapis admin / owner. Sanityzacja fail-closed jak `sanitizeClientViewVariant` (klucz spoza
  allowlisty odpada, brak/niepoprawna wartość → domyślny zestaw).
- **Migracja** ręczna (addytywna → na prod przed pushem).
- **Adres**: osobna trasa w `(share)`, np. `/p/[token]`; nieznany i odwołany token → ten sam 404.
  Lookup tokenu niecache'owany (odwołanie działa od następnego żądania).

## Widok

- **Allowlista pracownika** (sufit; ustawienia tylko z niej ukrywają): opis, „Przedmiar", j.m.,
  „Cena j.m." = jego stawka, wartość przedmiaru po jego stawce, ilości jego etapów, wartość jego
  etapów, „Pozostało".
- **Nigdy, niezależnie od ustawień:** cena klienta, „Wartość netto" po cenie klienta, rabat, brutto,
  mnożnik, „Źródło ceny wykonawcy", cudze etapy.
- **Blokada planu** — trzecia zamknięta powierzchnia obok preview i workshop w `closedColumnList`;
  odpowiednik `assertDisclosurePair`: widok pracownika wymaga `view` = plan jego etapów, inaczej
  **throw** (nie cicha naprawa).
- **Puste pozycje** — ta sama reguła co `client-empty` (puste na obu osiach naraz, więc ukrycie nie
  rusza żadnej sumy), z jedną różnicą: oś „wykonane" = **jego etapy**. Pozycja wykonana tylko przez
  kogoś innego jest dla niego pusta.
- **Podsumowanie** — jeden blok, bez przełącznika zakładek, w tej kolejności:
  1. wartość przedmiaru po jego stawce („ile zarobi, jeśli zrobi cały przedmiar");
  2. wykonane w rozbiciu na jego etapy (etap → kwota) + suma = `byWorker.get(workerId)`;
  3. wypłacone = suma + lista (data, kwota) wypłat tego pracownika na tej inwestycji;
  4. pozostało do wypłaty = różnica (ujemna → „Nadpłata").
     Nie renderują się: finanse inwestycji, materiały, zakładka „Robocizna" (sumy działów są już
     w wierszach „Razem" tabeli). Wypłata bez inwestycji / na innej inwestycji nie wchodzi — jak
     w „Podsumowaniu pracowników".
- **Etap bez potwierdzonego rozliczenia** (`plane = null`): menu blokuje link i PDF dla tego
  pracownika z komunikatem „Ustaw rozliczenie etapu".

## Edytor i PDF

- **Menu „Pracownicy"** obok menu inwestora: unikalni pracownicy z etapów inwestycji; per pracownik
  Podgląd (to samo co link, bez linku), Generuj/Kopiuj link, Odwołaj link, Drukuj PDF. W tym samym
  menu „Ustawienia widoku pracownika" (dialog: kolumny + „ukryj puste", zapis tylko admin/owner).
- **PDF** — ten sam mechanizm co `offer-print/`, sparametryzowany kolumnami, stawką, regułą pustych,
  nagłówkiem z imieniem i podsumowaniem pracownika. Bez drugiego generatora.
- **Uprawnienia**: link/PDF — admin/owner/manager (jak inwestor); ustawienia firmowe — admin/owner.

## Testy (od najtańszej warstwy)

- **unit**: reguła pustych po etapach pracownika; blokada planu rzuca przy złym `view`; allowlista —
  ceny klienta nie da się włączyć przez ustawienia; sanityzacja ustawień fail-closed; podsumowanie
  wraz z nadpłatą.
- **integracja (DB)**: nieznany / odwołany token → null; token pracownika nigdy nie serwuje widoku
  inwestora i odwrotnie; unikalność pary inwestycja + pracownik.
- **E2E**: odroczone do backlogu (Linear, etykieta `e2e-backlog`).

## Ryzyka

- **Wyciek ceny klienta na ekran pracownika** — ekran pracownika zdradza marżę. Bariery: osobna
  allowlista + blokada planu z throw + osobna tabela tokenów. To jest główne ryzyko zmiany i to, co
  testy mają przypiąć.
- **Suma w podsumowaniu ≠ widoczne pozycje** — dlatego reguła pustych jest dwuosiowa (decyzja z
  brainstormingu: „ukryj pusty Przedmiar" byłby błędem).
