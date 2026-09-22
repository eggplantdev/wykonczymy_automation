# Brief: Autozapis szablonu w warsztacie

**Change**: `szablon-autosave` · **Plan**: `plan.md` · **Research**: `research.md`

## Co i po co

Warsztat szablonu ma dziś dwa modele trwałości naraz: komórki zapisują się same do
inwestycji-warsztatu, ale treść szablonu trafia do biblioteki dopiero po kliknięciu „Zapisz
szablon". Likwidujemy drugi model. Przycisk znika, szablon zapisuje się sam, a warsztat przestaje
pokazywać pola, których szablon i tak nie przenosi.

## Jak

Mirror po stronie **serwera**, w `investmentAction` — jedynym punkcie, przez który przechodzi każdy
z ~36 sposobów zmiany drzewa (kliencki `dispatch` łapie ~4). Dławiony znacznikiem czasu w bazie,
bo jeden mirror to ~250 KB ruchu do Neona (`payload` jest w TOAST-cie, HOT update niemożliwy).
Dławik z definicji gubi ostatnią zmianę, więc obok niego stoją trzy dopchnięcia: po bezczynności,
przy opuszczeniu ekranu i przed eksmisją warsztatu przez inny szablon.

## Fazy

1. **Warstwa danych** — migracja (`mirrored_at`, `updated_at`), zapis w cudzej transakcji, koniec
   z nadpisywaniem `created_by`, `template_preset_id` dokłada się do zapytania o blokadę (zero
   dodatkowych round tripów).
2. **Mirror w `investmentAction`** — transakcyjny, pod `lockInvestmentForReplace`, ze strażnikiem
   wskaźnika czytanym wewnątrz transakcji; `deferRefresh`, żeby nie wrócił koszt zdjęty przez EX-597.
3. **Domknięcie ogona** — dopchnięcie bezwarunkowe (bez flagi „brudne"), hook bezczynności
   (15 s > dławik 10 s), dopchnięcie przed eksmisją jako **pierwszy** krok przełączenia. Przycisk znika.
4. **Zamknięta lista kolumn warsztatu** — sufit przy składaniu siatki, wzorem `PREVIEW_VISIBLE_COLUMNS`;
   picker i pozycje etapów znikają jako konsekwencja; komentarz zaczyna trafiać do szablonu.
5. **Porządki w menu Opcje** — „Wczytaj szablon…" → „Przełącz na inny szablon…" (przesuwa wskaźnik
   zamiast kasować szablon), rzeczownik edytora, inwestor poza warsztatem, „Zapisz jako nowy szablon…".
6. **Lista szablonów** — kolumna „Zmieniono", sortowanie po niej.

## Największe ryzyka

- **Wyścig o payload.** Dziś odczyt i zapis idą osobnymi połączeniami — mirror mógłby cofnąć edycję
  w szablonie, nie ruszając warsztatu, i nic by tego nie wykryło. Stąd jedna transakcja pod zamkiem.
- **Eksmisja.** Dopchnięcie przed przełączeniem musi być wewnątrz tego samego zamka co wymiana
  drzewa, inaczej mirror w locie wstempluje nowy szablon w wiersz starego.
- **Cache.** `updateTag('presets')` z `/szablony/[id]` przywraca 90–193 ms na zapis plus trzy
  odczyty wielkości drzewa.

## Weryfikacja

Ciężar w specach DB (`node`) — każda asercja czyta payload **z bazy**, nie z wyniku akcji. Hook
dopchnięcia przez `renderHook` w projekcie `dom` (ryzykiem jest cykl życia). E2E przełączenia
szablonu **napisany, nieuruchamiany** — albo issue `e2e-backlog`.

## Migracja

Addytywna (dwie nullowalne kolumny) → na produkcję **przed** wypchnięciem kodu, ręcznie, przez
człowieka (`pnpm db:migrate:prod`). Pisana ręcznie. Żadnego backfillu.
