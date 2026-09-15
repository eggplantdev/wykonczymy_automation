---
change_id: transfers-server-sort
title: Sortowanie tabeli transakcji na serwerze; kolumny relacyjne tracą sortowanie
status: implementing
created: 2026-09-15
updated: 2026-09-15
archived_at: null
branch: transfers-server-sort
worktree: null
---

## Notes

EX-777. Sort nagłówka w tabeli transakcji jest dziś lokalny dla pobranej strony (100 wierszy),
a wydruk sortuje cały przefiltrowany zbiór — dla inwestycji z >1 stroną ekran i wydruk pokazują
inną kolejność.

**Decyzja właściciela (2026-09-15):** sort idzie na serwer dla kolumn będących kolumnami tabeli
`transactions`; w siedmiu kolumnach relacyjnych sortowanie zostaje **wyłączone** — te kolumny
zawęża się filtrami, nie sortowaniem. Pełne przepisanie listy na surowy SQL z JOIN-ami odpada.

### Sortowalne serwerowo (kolumny własne `transactions`)

`id`, `date`, `amount`, `type`, `paymentMethod`, `description`, `vatPlane`, `createdAt`

### Sortowanie do wyłączenia (nazwa z innej tabeli, w wierszu leży samo `id`)

| Kolumna | id kolumny | pokazuje | w bazie | filtr istnieje? |
|---|---|---|---|---|
| Inwestycja | `investment` | `investmentName` | `investment_id` | tak |
| Kategoria kosztu | `expenseCategory` | `expenseCategoryName` | `expense_category_id` | tak |
| Kategoria (inne) | `otherCategory` | `otherCategoryName` | `other_category_id` | tak |
| Kasa źródłowa | `sourceRegister` | `sourceRegisterName` | `source_register_id` | tak |
| Kasa docelowa | `targetRegister` | `targetRegisterName` | `target_register_id` | tak (ten sam filtr) |
| Pracownik | `worker` | `workerName` | `worker_id` | tylko z URL-a |
| Dodał | `createdBy` | `createdByName` | `created_by_id` | tak |

Ta sama siódemka co `COLUMN_TO_ACCESSOR` w `src/lib/transfers/sort-transfer-rows.ts` — to jedyne
kolumny, gdzie id kolumny ≠ klucz wiersza.

### Pokrycie filtrami — sprawdzone

Premisa „a tak można je odfiltrować dostępnymi filtrami" trzyma się dla sześciu z siedmiu.

- **Kasa docelowa** ma pokrycie, choć nie własnym filtrem: kontrolka „Kasa źródłowa" zawęża
  `sourceRegister` **LUB** `targetRegister` (`src/lib/queries/transfer-filters.ts:100`), więc wybór
  kasy pokazuje obie strony przelewu. Jedyny mankament to nazwa kontrolki, która obiecuje mniej niż
  robi.
- **Pracownik** to jedyna luka w UI. `where` obsługuje `?worker=<id>`, ale wyłącznie jako cel linku
  z podsumowania podwykonawców — w `TransferFilters` nie ma dla niego kontrolki i `worker` nie
  figuruje w `ENTITY_FILTER_KEYS`, więc nie czyści go też „Wyczyść filtry".
  **Decyzja (2026-09-15): dokładamy kontrolkę w tym slice.** Lista pracowników jest już pod ręką —
  `fetchReferenceData` zwraca `workers`, a `TransferDataTable` dostaje `referenceData`. Uwaga przy
  planowaniu: dzisiejszy `where` przyjmuje pojedyncze `?worker=<id>` (`equals`), a multi-select
  wymaga `in` — zmiana musi zachować działanie istniejącego linku z podsumowania podwykonawców,
  i `worker` trafia do `ENTITY_FILTER_KEYS`, żeby „Wyczyść filtry" go kasował.

### Zakres slice'a

1. Sort serwerowy (URL → `findTransfersRaw`), `manualSorting` jako opt-in `DataTable`.
2. `enableSorting: false` na siedmiu kolumnach relacyjnych.
3. Nowy filtr „Pracownik" w `TransferFilters`.

### Punkty zaczepienia w kodzie

- `src/components/ui/data-table/data-table.tsx` — `getSortedRowModel()` + lokalny `useState<SortingState>`,
  brak `manualSorting`. Zmiana musi być opt-in, żeby nie ruszyć pozostałych tabel na `DataTable`.
- `src/lib/queries/transfers.ts` — `findTransfersRaw` **już** przyjmuje `sort` (domyślnie `-id`) i
  ma go w kluczu cache'a; brakuje przekazania z URL-a.
- `src/components/tables/transfers.tsx` — miejsce na `enableSorting: false` w siedmiu kolumnach.
- `src/components/transfers/print-transfers-button.tsx` + `sort-transfer-rows.ts` — po zmianie
  wydruk i ekran sortują tym samym kluczem; sprawdzić, czy `sortTransferRows` nadal jest potrzebne
  w pełnej formie (fetch wraca `-date`, więc tak), i czy siódemka może z niego wypaść.
- `src/components/transfers/transfer-filters.tsx` + `src/lib/queries/transfer-filters.ts` — filtr
  „Pracownik" (`equals` → `in`, `ENTITY_FILTER_KEYS`). Rozważyć też label „Kasa źródłowa", który
  obiecuje mniej, niż filtr robi (zawęża źródłową LUB docelową).
- `src/components/ui/pagination-footer.tsx` / `use-url-filter-params` — sort trafia do URL-a obok
  filtrów i strony; zmiana sortu musi resetować `page`.
