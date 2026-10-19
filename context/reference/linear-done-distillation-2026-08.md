# Destylacja zamkniętych issues (sierpień 2026)

Trwała wiedza z sześciu ostatnich zamkniętych zadań, spisana zanim issues zostaną usunięte.
Pominięte wszystko, co odtwarza się z kodu, historii gita lub `context/archive/`.

## Flota — jedna reguła, dwie powierzchnie

Mail o wymianie oleju i badge w UI liczyły termin **z dwóch różnych reguł**: digest z `oilTarget`
(preferuje ręcznie wpisany `nextDueOdometer`), badge ze sztywnego `OIL_CHANGE_INTERVAL_KM`.
Rozjazd szedł w obie strony — mail bez badge'a i badge bez maila.

Trwała zasada: **jeden termin ma jedną regułę**, a guardem jest spec liczący **obie powierzchnie
z jednego zestawu danych** — dwa osobne specki, każdy zielony na własnej regule, są dokładnie tym,
co ten defekt przepuściło.

## Edycja komórek liczbowych w kosztorysie

Trzy defekty jednego kontraktu edycji (`CellEditPolicyT` + `useCellDraft`); warto czytać razem,
bo pokazują trzy różne miejsca, w których draft może zgubić rozstrzygnięcie.

- **Odmontowanie w trakcie edycji nie rozstrzygało draftu.** `useCellDraft` rozstrzygał
  wyłącznie na `onBlur`/Escape, a wirtualizacja react-datasheet-grid, zmiana filtra i odświeżenie
  potrafią odmontować komórkę w środku pisania — zostawał **ostatni przyjęty prefiks odrzuconej
  wartości, bez toastu**. To jedyne miejsce w tym hooku, gdzie `useEffect` jest uzasadniony.
- **Rabat procentowy > 100%.** `discountPolicy` jako jedyna z trzech polityk nie używała
  slotu `guard`, więc ujemna wartość netto wiersza wchodziła w sumy sekcji i stopki. Próg zmienia
  to, **co użytkownik może zrobić** → decyzja właściciela, nie automatyczna poprawka z bramki review.
- **Cmd+Z przywracał odrzuconą liczbę.** Okno koalescencji undo (700 ms) skleja serię
  klawiszy; klawisze commitują się w locie, więc na stos trafia **prefiks, który polityka odrzuciła,
  a `cellSettle` zaraz potem wycofał**. Poprawka należy do koalescencji, nie do komórki.

## Upload stron faktury — sprzątanie sierot

Identyczne ~13 linii (upload stron → mutacja → `discardOrphanedUploads` przy porażce) w trzech
miejscach; **dwie kopie sprzątały tylko gdy akcja zwróciła `success: false`, nie gdy rzuciła** —
zerwana sieć w połowie zapisu albo deploy unieważniający id server action zostawiał bloby sierotami.
Jeden dom: `src/lib/invoices/submit-with-invoice-pages.ts`.

Przy okazji ujawnione: `use-form-submit` na ścieżce `keepOpen` robił gołe `await` bez `catch`, więc
**rzucający zapis kończył się całkowitą ciszą** — dotyczyło każdego formularza z „nie zamykaj".

## `form: any` w wrapperach form-fields

Issue myliło się co do rozmiaru naprawy: wrapper nie używa całego API TanStack Form, tylko `AppField`
(czasem `store`), więc wystarczył typ strukturalny `FormWithFieldT<TName>` w `form-hooks.ts` zamiast
przeciągania prawdziwych generyków po wszystkich call site'ach.

Podział ról, warty powtórzenia przy kolejnym wrapperze:

- **jeden konsument** → konkretny typ formularza przez nigdy nierenderowaną atrapę `withForm`
  (pełna inferencja; wzorzec z `bulk-expense-form.ts`);
- **kilku konsumentów** → `FormWithFieldT<'nazwa'>` — unia konkretnych typów odwróciłaby zależność warstw.

Sprawdzana jest **tylko nazwa pola, nie typ wartości** — świadomie. Instrument zwalidowany dwiema
mutacjami na znanym pozytywie, zanim uwierzono w zielony wynik.
