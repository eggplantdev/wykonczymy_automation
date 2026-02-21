Nic na sztywno

# AUTOMATYZACJA WYDATKÓW

Cel - migracja zarządzania wydatkami na materiały w ramach inwestycji z arkuszy excel do dedykowanego systemu. Uniknięcie nanoszenia tych samych wydatków w kilku miejscach jednocześnie. Wgląd w wydatki w czasie rzeczywistym. Wyeliminowanie "ghost expenses" - wydatków naniesionych w jednym arkuszu, których brakuje w powiązanych miejscach.

# Lista pracowników

Role:

- SZEF
- MAJSTER
- PRACOWNIK

Każda z ról musi mieć założone konto.
Na każdym koncie:

1. Lista transakcji z podziałem na dni miesiące lata.
2. Wpłaty / wypłaty (z jakiego konta doszła transakcja)
3. Saldo

W przypadku roli PRACOWNIK - konta to subkonta zaliczkowe PRACOWNIKÓW - dodatnia kwota na takim subkoncie oznacza że pracownik wisi pieniądze firmie lub może być potraktowane jako zaliczka na poczet wypłaty

# Inwestycje

1. Lista transakcji czyli jakie zostały poniesione koszta w ramacha danej inwestycji (budowy)
2. Saldo - ile inwestor musi zwrócić do firmy - podsumowanie zakupów / poniesionych kosztów

# Transakcje

Struktura:

- WYDATEK - czyli na co poszła kasa
- rodzaj (wydatek / zasilenie / zwrot) ?
- kwota
- forma płatności gotowka blik etc ?
- typ wydatku (wydatek INWESTYCJA / ZALICZKA (zasilenie subkonta PRACOWNIKA ) / INNE / WYDATEK PRACOWNICZY)
- załącznik z fakturą ewentualnie notatka / komentarz z powodem braku faktury
- wybrana inwestycja z LISTY KLIENTÓW (jeśli dotyczy czyli wydatek INWESTYCJA)

# Typy wydatków:

- WYDATKI INWESTYCJA
- ZALICZKI dla podwykonawców na subkonta (PRACOWNIK) - ZASILENIE SUBKONTA PRACOWNIKA
- WYDATKI PRACOWNICZE (z podziałem na konkretnego pracownika - potrzebna jest historia tych wydatków)
- INNE - nie przypisane do żadnej konkretnej inwestycji + rozdzielić na podkategorię + wymusić opis co to znaczy inne, lista rozwijana, jesli spoza listy to trzeba dodac opis etc

# WYDATKI BEZPOŚREDNIE INWESTYCJA

Spięte z SALDEM INWESTYCJI - każdy wydatek automatycznie aktualizuje kasę inwestycji (podsumowanie zakupów / kosztów inwestycji)

# ZALICZKI (subkonta zaliczkowe PRACOWNIKÓW - dodatnia kwota na takim subkoncie oznacza że pracownik wisi pieniądze firmie lub może być potraktowane jako zaliczka na poczet wypłaty)

FLOW:

1. PRACOWNIK dostaję dowolną ilość zaliczek (zasileń swojego subkonta) na różne materiały etc. Te zaliczki są zliczane aż do momentu rozliczenia się PRACOWNIKA z pieniędzy. Ale Pracownik może też nie zwracać tych pieniędzy tylko ciągle dostawać więcej na kolejne inwestycje. Ale musi się rozliczać.

2. PRACOWNIK kupuje za te zaliczki różne materiały i gromadzi faktury z których musi się rozliczyć. (musi być też opcja bez faktury ale z jakimiś obwarowaniami.)
   Wydatki pracownika nie są spięte z KOSZTAMI INWESTYCJI - te zostaną zaktualizowana dopiero po wprowadzniu WYDATKÓW PRACOWNICZYCH przez MAJSTRA.

3. PRACOWNIK wraca z fakturami.

- MAJSTER WPISUJE WYDATKI PRACOWNICZE
- te wydatki są odejmowane od kwoty zaliczki na subkoncie PRACOWNIKA
- jeśli na koncie zaliczkowym zostaną jakieś pieniądze to albo pracownik musi je zwrócić albo konieczne jest wyzerowanie konta poprzez wprowadzenie wydatku INNE (ZALICZKA NA POCZET WYPŁATY ? )

Tutaj przydałby się jakiś sprytny kalkulator faktur jakiś sposób żeby MAJSTER mógł szybko wpisać faktury i dostać kwotę dokładną

KONIECZNA JEST HISTORIA KAŻDEJ TRANSAKCJI WPŁATY WYPŁATY PRACOWNIKA ETC, z podziałem na każdego pracownika, miesiac etc. zeby pracownik miał wglad w historię

4. MAJSTER wklepuje robocze wydatki do systemu przypisując je do określonej inwestycji lub kategorii.

# PRZEPŁYW PIENIĘDZY

Do potwierdzenia - to są wysztko kasy gotówkowe ?

# 1. Kasa Bartek (SZEF)

- Tylko jedna
- Przekazuje pieniądze do kas głównych (MAJSTER).
- Może wydawać dowolne wydatki

# 2. KASY GŁÓWNE (MAJSTER)

- takich kas może być wiele - np. kasa Adrian, kasa Juri etc.
- wydatki (WYDATKI INWESTYCJI, ZALICZKI, WYDATKI PRACOWNICZE, INNE)

# 3. SUBKONTO PRACOWNICZe - KAŻDY PRACOWNIK MA SUBKONTO

## KOSZTY INWESTYCJI (PODSUMOWANIE KOSZTÓW INWESTYCJI)

Każdy wydatek musi aktualizować konto inwestycji jeśli jest do niej przynależny, musi też aktualizować listę transakcji w ramach inwestycji.

💡 Wyjątek - chyba że jest to specjalny wydatek nie przypisany do żadnej inwestycji (INNE)

# Lista klientów (INWESTYCJA)

Szkielet bazy klientów
Każda inwestycja składa się z:

- KOSZTY NWESTYCJI
- adres
- telefon
- email
- osoba kontaktowa
- inne / do ustalenia lista może być rozwijana

# Do Rozkminy raporty (dzień, miesiąc, rok etc.)

- podział na inwestycje
- pracownika
- kase główną etc.

# Tabele

- klienci
- pracownicy
- transakcje
- kasy
- inwestycje
- subkonta każdego pracownika

# Każda transakcja (wpłata, wypłata zaliczka) musi być zarejestrowana

# Tabela z transakcjami
