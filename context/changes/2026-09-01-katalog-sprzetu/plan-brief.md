# Katalog sprzętu — brief planu

**Change**: `2026-09-01-katalog-sprzetu` · **Linear**: EX-758 · **Plan**: `plan.md`

## Co budujemy

Rejestr sprzętu: co firma ma, u kogo to jest, czy nie stoi w serwisie, kiedy kończy się gwarancja.
Encja + append-only log zdarzeń; „gdzie jest" to pochodna ostatniego wpisu, nie pole. Codzienny mail
o gwarancjach kończących się za 30 i za 7 dni.

## Sześć etapów

1. **Warstwa danych** — kolekcje `equipment` / `equipment-events` / `warehouses`, enum statusu,
   niezmiennik „dokładnie jeden cel" w hooku kolekcji, piąta sonda `preventDelete` na pracowniku,
   jedna ręcznie pisana migracja (tabele, enum, `_rels` pod załączniki, kolumny w
   `payload_locked_documents_rels`, czwarta tabela listy odbiorców, seed magazynów).
2. **Odczyt** — `DISTINCT ON` po `occurred_at DESC` w `lib/db/equipment.ts`, warstwa `queries`
   z wersjonowanym kluczem cache'a bez daty.
3. **Lista i detal** — wyszukiwarka po nazwie/marce/modelu/numerze, filtr „gdzie jest" z ludźmi
   i magazynami w jednym rozwijaniu, własna komórka gwarancji, detal z historią, wpis w menu.
4. **Akcje** — dodanie sprzętu w jednej transakcji z pierwszym wpisem, „Przekaż" z jednym wyborem
   celu, wpis serwisowy z kosztem dopisywanym później, edycja z dostępem do pięciu statusów.
5. **Strona pracownika** — sekcja „na stanie" doklejona do istniejącego ekranu, bez nowej trasy
   i bez nowej bramki dostępu.
6. **Przypomnienia** — `days.ts` i `deadline-label.ts` wychodzą z `lib/fleet/` do `lib/dates/`;
   własne progi 30/7, cron o 6:00, czwarta lista odbiorców, badge w menu.

## Trzy świadome odejścia od Floty

- **„Gdzie jest" liczy SQL, nie JS** — Flota grupuje w pamięci („kilkadziesiąt aut"), nasz zakres
  mówi „skala nieznana, projektujemy na dużą".
- **Z `lib/fleet/` wychodzi tylko czysta matematyka dni** — `thresholds.ts` trzyma
  `OIL_CHANGE_INTERVAL_KM`, a `DeadlineCell` renderuje „bezterminowo" z pola `exempt`. Oba zostają.
- **Po gwarancji cisza** — przegląd trzeba nadrobić, gwarancji nie da się. Odpowiednika
  `OVERDUE_RENAG_DAYS` nie ma.

## Decyzje podjęte przy pisaniu planu

- **Zdarzenie nie ma pola „typ"** — rozróżnia je cel. Wpis z warsztatem JEST serwisem; enum obok
  byłby drugim źródłem prawdy o tym samym fakcie.
- **Magazyn to kolekcja, warsztat to wolny tekst** — po magazynie się filtruje i wraca się do niego,
  więc wolny tekst rozsypałby filtr na warianty zapisu; warsztat pojawia się raz i nie jest kryterium.
- **Usunięcie magazynu jest blokowane**, nie zerowane — `ON DELETE SET NULL` zostawiłoby historyczny
  wpis bez celu, czyli złamany niezmiennik i fałszywy alarm „nie wiadomo gdzie".
- **Stempel powiadomienia siedzi na sprzęcie**, bo gwarancja jest własnością rzeczy, nie zdarzenia —
  a więc zmiana `warrantyUntil` musi zerować bookkeeping.
- **Nie ma strony magazynu** — zawartość magazynu to filtr na liście sprzętu.

## Ryzyko do pilnowania

„Naprawa na miejscu" (serwis bez ruchu sprzętu) nie ma reprezentacji: skoro typ zdarzenia wynika
z celu, wpis serwisowy zawsze przenosi sprzęt do warsztatu. Świadomie poza zakresem — gdyby padło
z rynku, wchodzi jako czwarty cel „u siebie", nie jako enum typu.
