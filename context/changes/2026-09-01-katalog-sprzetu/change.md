---
change_id: katalog-sprzetu
title: Katalog narzędzi i urządzeń — rejestr sprzętu z przypisaniem do pracownika/magazynu, serwisem i gwarancją
status: implemented
created: 2026-09-01
updated: 2026-09-04
archived_at: null
branch: staging
worktree: null
---

## Notes

Właściciel chce wiedzieć: jaki sprzęt firma ma, u kogo jest, czy nie stoi w serwisie, kiedy kończy
się gwarancja. Wzorzec z modułu Flota (rzecz + terminy + koszty + log zdarzeń) przenosi się na sprzęt.

Plan: `plan.md` (skrót: `plan-brief.md`). Research: `research.md`. **Część I (repo, 2026-09-03)** to wejście do `/10x-plan` — mapa tego, co
bierzemy gotowe z Floty, co piszemy, i trzech miejsc, w których świadomie od Floty odchodzimy.
**Część II (rynek, 2026-09-01)** jest historyczna: opisuje pełny model rynkowy, nie zakres. Zakres
poniżej jest wynikiem rozmowy z właścicielem 2026-09-03 i to on obowiązuje wszędzie tam, gdzie
Część II mówi co innego.

## Ustalony zakres (2026-09-03)

### Model

- **Dwie kolekcje**: sprzęt + log zdarzeń (przekazanie, serwis). Nie trzy — przekazania i serwisy
  to jeden strumień rozróżniony typem zdarzenia.
- **„Gdzie jest" jest pochodną ostatniego wpisu, nie polem na sprzęcie.** Sprzęt realnie krąży
  pracownik → pracownik bez postoju w magazynie, więc pole nadpisywane w kółko gubi trasę — a to
  trasa odpowiada na pytanie „u kogo to było, kiedy zniknęło".
- **Cel przekazania: pracownik | magazyn | serwis** — jedno z trzech, dokładnie jedno, z jednej
  listy wyboru. „W serwisie" nie jest osobnym statusem, tylko wynikiem ostatniego przekazania;
  wpis serwisowy dodatkowo niesie koszt i opis.
- **Serwis to wolny tekst z nazwą warsztatu, nie słownik** (2026-09-03). Magazyny są bytem, bo jest
  ich kilka i wracają; warsztat pojawia się raz i nie ma czego utrzymywać.
- **Schemat pod załączniki wpisu stoi od pierwszej wersji, ale UI ich nie pokazuje** (2026-09-03,
  skorygowane po review) — pole `attachments` (`hasMany` → `media`) i tabela `equipment_events_rels`
  są w kolekcji i w migracji (wzór `20260818_1_add_fleet.ts:73-90`), bo dołożenie ich później
  kosztowałoby drugą migrację. Formularze i historia ich nie dotykają: faktura z serwisu czy karta
  gwarancyjna wchodzi na razie przez `/admin`. Wypuszczenie tego na froncie to osobny kawałek.
- **Jedna akcja „Przekaż"** — nie ma pary wydanie/zwrot ani stanu „w drodze". Oddanie do magazynu
  to przekazanie, którego celem jest magazyn. Nowy wpis unieważnia poprzedni z definicji.
- **Inwestycja jest atrybutem wpisu, nie osią.** Pracownik odpowiada za sprzęt; inwestycja opisuje,
  na co go wziął, i wygasa razem z wpisem. Nie ma walidacji „pracownik tu, sprzęt tam"; jedyna reguła
  to „inwestycję niesie tylko zdarzenie pod pracownikiem" (patrz korekty po drugiej turze bramki).
- **Cykl życia osobnym polem na sprzęcie**: w użyciu / wycofany / sprzedany / zgubiony / skradziony.
  To koniec historii sztuki, nie miejsce. Oznaczenie „zgubiony" + log = wiadomo, kto miał ostatni.
- **Brak przypisania (ani pracownik, ani magazyn) to alarm** — dziura w danych, nie stan sprzętu.
  Stany bez opiekuna, które alarmu NIE wywołują: wycofany, sprzedany, zgubiony, skradziony.
- **Magazyny to słownik**, mała kolekcja zarządzana w panelu Payloada na wzór `other-categories`.
  Magazynów jest kilka. Zero ekranów w aplikacji; dodanie magazynu to wpis w adminie, nie deploy.
- **Identyfikacja**: nazwa własna wymagana (po niej się szuka i klika), numer seryjny opcjonalny
  i unikalny gdy podany (wymuszony blokowałby zakładanie rejestru — nikt nie przepisze stu tabliczek
  na start). Nazwa nieunikalna — trzy „szlifierki" są w porządku.
- **Brak pola „ilość"** — jeden rekord to jedna sztuka. To jest egzekwowanie progu sprzęt/materiał
  strukturą, nie regulaminem: wiertła i tarcze nie mają jak wejść. Reguła słowna dla właściciela:
  „rzecz, której będziesz szukał, jak zginie".

### Widoki

- **Lista** — domyślnie cały sprzęt, kolumna „u kogo" (człowiek i magazyn wyglądają tak samo, bo to
  ta sama informacja). Wyszukiwarka po nazwie, numerze seryjnym, marce i modelu — jedno pole, nie
  zestaw filtrów. Filtr „gdzie jest" z ludźmi i magazynami w jednym rozwijaniu. Skala nieznana,
  więc projektujemy na dużą.
- **Detal sztuki** — dane + historia zdarzeń, na wzór `flota/[id]`.
- **„Co ma Marek" wchodzi na ISTNIEJĄCĄ stronę pracownika** (2026-09-03), jako sekcja
  `src/app/(frontend)/pracownicy/[id]/page.tsx` obok wypłat i transferów — nie jako nowy ekran
  w module sprzętu. Pytanie „co ten człowiek ma na stanie" pada dokładnie tam, gdzie już się patrzy
  przy zwolnieniu i rozliczeniu; osobna trasa rozbiłaby jedną osobę na dwa adresy.
  Zakres pierwszej wersji: nazwa, numer seryjny, data przekazania, link do detalu sztuki — bez akcji,
  przekazuje się z detalu sprzętu.
- **Magazyn NIE dostaje własnej strony** (2026-09-03, korekta wcześniejszego zapisu). „Co leży na
  Kwiatowej" to filtr „gdzie jest" na liście sprzętu — ta sama lista, to samo zapytanie, o jedną
  trasę mniej. Zapytanie i tak jest sparametryzowane opiekunem, więc karta magazynu zostaje możliwa,
  gdyby kiedyś była potrzebna.
- **Gwarancja**: własna komórka, nie `DeadlineCell` (2026-09-03, korekta) — tamten renderuje
  „bezterminowo" z pola `exempt` i „brak danych" per typ przeglądu, czyli dwa pojęcia, których sprzęt
  nie ma. Wspólny zostaje `daysLabel`. Progi 30 i 7 dni, własny dzienny cron obok floty; **po
  wygaśnięciu gwarancji mail nie wychodzi** — przeglądu nie da się nie nadrobić, gwarancji nie da się
  nadrobić wcale.

### Poza zakresem (świadomie)

Potwierdzanie odbioru przez pracownika — jedyna pozycja wciągająca rolę `EMPLOYEE` do modułu, który
w całości jest kierownictwa (jak Flota); to osobna powierzchnia dostępu i ekran mobilny.
Dalej: ilości i materiały eksploatacyjne, zdjęcia stanu przy wydaniu/zwrocie, inwentaryzacja,
koszt sprzętu alokowany na inwestycję, terminy UDT / pomiarów elektrycznych, QR na nalepce.

### Korekty po drugiej turze bramki (2026-09-04)

Praca po pierwszym przejściu bramki cofnęła dwie decyzje zapisane wyżej i dołożyła zakres, którego
plan nie przewidywał. Zapis, żeby kod i dokument nie mówiły dwóch różnych rzeczy:

- **Kolumna „u kogo" rozpadła się na „Kto ma" + „Miejsce".** Zapis wyżej mówi, że człowiek i magazyn
  to ta sama informacja i wyglądają tak samo — na liście już nie. Powód: przy sortowaniu po opiekunie
  jedna kolumna miesza ludzi z magazynami i sortuje po nazwach z dwóch różnych słowników. Filtr
  „gdzie jest" ZOSTAJE jednoosiowy — jedno rozwijanie z ludźmi i magazynami — więc filtr i kolumny
  modelują ten sam fakt inaczej. To świadome: filtruje się „gdzie to jest", a czyta się „kto" osobno
  od „gdzie".
- **Magazyn zakłada się z formularza** („+ Nowy magazyn" przy polu, `createWarehouseAction`), wbrew
  „zero ekranów w aplikacji". Powód: „nie ma go na liście" w trakcie wpisywania sprzętu wyrzucało
  z formularza do `/admin` i kasowało wpisane dane. Słownik nadal nie ma własnego ekranu — jest tylko
  przycisk w miejscu, w którym brak pozycji boli.
- **Inwestycja tylko pod pracownikiem** — pole pokazuje się wyłącznie dla celu „pracownik", a hook
  kolekcji (`src/hooks/equipment/validate.ts`) zeruje `investment` na każdym innym celu. To zawężenie
  wobec „brak walidacji «pracownik tu, sprzęt tam»": reguła stoi na wierszu, nie tylko w formularzu,
  bo lista czyta `investment_id` z najnowszego zdarzenia bezwarunkowo — wpis z `/admin` renderowałby
  „leży w magazynie, na inwestycji X" jako fakt.
- **Zakres dołożony ponad plan**: filtr statusu na liście (plan przewidywał jeden filtr — „gdzie jest"),
  kolumna „Inwestycja" na liście i wiersz na karcie, inwestycja na pierwszym zdarzeniu w „Dodaj sprzęt",
  akcje w wierszu („Przekaż" / „Edytuj"), historia sztuki przepisana z `SummaryTable` na `DataTable`
  z kolumnami Data / Gdzie trafił / Inwestycja / Notatka / Wpisał / Koszt i stopką „Koszty serwisu",
  oraz `createdBy` na zdarzeniu (kto wpisał — „kogo ścigać").
- **Migracje: są DWIE, nie jedna.** `20260903_0_add_equipment` i `20260904_0_equipment_event_author`
  (`equipment_events.created_by_id`, `ON DELETE set null`). Obie addytywne, więc na produkcji idą
  PRZED pushem kodu. `20260903_1_equipment_digest_recipients` skasowana — była duplikatem DDL już
  zawartego w `20260903_0`.
