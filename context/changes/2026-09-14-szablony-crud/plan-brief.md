# Podstrona /szablony — Plan Brief

> Pełny plan: `context/changes/2026-09-14-szablony-crud/plan.md`
> Research: `context/changes/2026-09-14-szablony-crud/research.md`

## What & Why

Biblioteka szablonów kosztorysu nie ma żadnego ekranu — szablon da się tylko zapisać z wnętrza edytora i wczytać z dialogu. Nie da się go zobaczyć na liście, przemianować ani usunąć. Ta zmiana dokłada podstronę `/szablony`, usuwanie i zmianę nazwy, oraz otwieranie szablonu w normalnym edytorze kosztorysu — przy czym użytkownik nigdy nie widzi, że pod spodem pracuje inwestycja.

## Starting Point

Pętla edycji już istnieje w całości: `reloadFromPresetAction` wczytuje szablon do inwestycji (robiąc snapshot ochronny), `savePresetAction` z trybem `overwrite` nadpisuje go w miejscu. `kosztorys_presets` to globalna tabela raw-SQL bez kolekcji Payloada — żaden FK na nią nie wskazuje. Brakuje wyłącznie ekranu wejściowego i dwóch operacji na tożsamości szablonu.

## Desired End State

W sidebarze stoi „Szablony". Lista pokazuje nazwę, liczbę sekcji i pozycji oraz datę, z trzema akcjami w wierszu. „Otwórz" prowadzi na `/szablony/<id>`, gdzie jest edytor kosztorysu z nazwą szablonu na belce; „Zapisz" nadpisuje ten szablon. „Usuń" i „Zmień nazwę" działają z listy, oba tylko dla właściciela. Inwestycja-warsztat nie występuje na `/inwestycje`, w żadnym pickerze ani jako możliwy cel wpłaty czy wydatku.

## Key Decisions Made

| Decyzja                           | Wybór                                             | Dlaczego                                                                                                             | Źródło                      |
| --------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Źródło prawdy                     | `kosztorys_presets`, inwestycja to tylko warsztat | Ruling właściciela; inwestycja nigdy nie staje się drugim magazynem szablonów                                        | Rozmowa                     |
| Czwarty status `szablon`          | Wchodzi, migracja addytywna                       | To jedyna rzecz, która **równocześnie** pozwala kodowi znaleźć warsztat i ukrywa go przed użytkownikiem              | Rozmowa (odwrócona decyzja) |
| Skąd kod wie o warsztacie         | Auto-provisioning po statusie                     | Brak zaszytego id — działa identycznie lokalnie i na produkcji, po `db:import` nie trafi w cudzą inwestycję          | Plan                        |
| Który szablon siedzi w warsztacie | Kolumna-wskaźnik `template_preset_id`             | Bez niej F5 na innym szablonie rozjeżdża pasek z treścią i „Zapisz" pisze nie tam                                    | Plan                        |
| „Napis szablon" na belce          | Nazwa szablonu jako `investmentName`              | Adres `/szablony/<id>` już niesie tożsamość — żaden parametr URL ani stan nie są potrzebne                           | Plan                        |
| Uprawnienia do delete/rename      | Owner-only                                        | Usunięcie jest nieodwracalne i nie zostawia snapshotu ochronnego, w odróżnieniu od nadpisania                        | Rozmowa                     |
| Kolizja nazwy przy rename         | Guard w SQL, nie `catch` po kodzie błędu          | `UPDATE` nie ma `ON CONFLICT`; surowy update rzuca PG 23505 i angielskie zdanie sterownika trafiłoby do polskiego UI | Research                    |
| Rewalidacja cache przy delete     | Ręcznie w handlerze                               | `ownerOnlyAction` nie przyjmuje tablicy tagów — precedens `notification-recipients.ts`                               | Research                    |

## Scope

**W zakresie:** podstrona `/szablony` z listą · usuwanie szablonu · zmiana nazwy szablonu · otwieranie szablonu w edytorze pod `/szablony/<id>` · nadpisywanie otwartego szablonu · czwarty status inwestycji + wskaźnik · ukrycie warsztatu na liście, w pickerach i jako celu księgowania

**Poza zakresem:** zmiany w `serialize-preset.ts` (szablon nadal bez przedmiaru) · zmiana uprawnień do zapisu szablonu · `szablon` jako wybieralny status w formularzu inwestycji · wersjonowanie i kosz szablonów · istniejące dialogi „Wczytaj szablon" i „Dodaj sekcję z szablonu" · E2E (odroczone do backlogu)

## Architecture / Approach

Jedna ukryta inwestycja pełni rolę stołu roboczego. `resolveWorkshopInvestment()` znajduje ją po statusie `szablon` i zakłada przy pierwszym użyciu, więc nigdzie nie ma zaszytego id. „Otwórz" to server action: ustala warsztat, wczytuje do niego szablon istniejącą ścieżką (ze snapshotem ochronnym), zapisuje wskaźnik i oddaje sterowanie klientowi, który przechodzi na `/szablony/<id>`. Ta strona renderuje `KosztorysEditorV2` nad drzewem warsztatu, podając nazwę szablonu tam, gdzie edytor spodziewa się nazwy inwestycji, i zera we wszystkich polach finansowych — szablon nie ma transakcji.

## Phases at a Glance

| Faza                         | Co dostarcza                                              | Główne ryzyko                                                                     |
| ---------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1. Status i warsztat         | Migracja, czwarty status, wskaźnik, rozpoznanie warsztatu | `isBookableInvestment` jedzie po `string` — typecheck nie przypomni o dopisaniu   |
| 2. Delete + rename           | Operacje SQL, akcje owner-only, testy DB                  | Kolizja nazwy musi być złapana w SQL, nie po kodzie błędu                         |
| 3. Strona `/szablony`        | Lista, akcje wiersza, wpis w sidebarze                    | `sidebar.tsx` był świeżo zmieniany — sprawdzić stan drzewa                        |
| 4. Warsztat `/szablony/[id]` | Edytor nad warsztatem, „Zapisz" nadpisuje szablon         | Rozjazd wskaźnika z adresem musi kończyć się odbiciem, nie renderem cudzej treści |

**Wymagania wstępne:** lokalna baza na 5433 z zastosowanymi migracjami; jeden szablon w `kosztorys_presets` (jest — id 4).
**Szacunek:** ~2–3 sesje, cztery fazy.

## Open Risks & Assumptions

- **Jeden warsztat na całą instalację.** Dwie osoby edytujące różne szablony w tej samej chwili nadpiszą sobie drzewo. Przy pięciu użytkownikach i ekranie używanym rzadko — akceptowalne; snapshot „Przed wczytaniem" jest siatką bezpieczeństwa.
- **Asymetria uprawnień:** zapis szablonu zostaje otwarty dla ról zarządczych, usunięcie i zmiana nazwy są owner-only. Świadome — nadpisanie zostawia snapshot, usunięcie nie.
- **Warsztat z pozycjami rusza globalny licznik golden-mastera** (`kosztorysItemCount`). Nie łamie porównania, ale może wymagać regeneracji fixture'u.
- Migracja jest addytywna, więc na produkcję idzie **przed** pushem kodu — krok wykonywany przez człowieka.

## Success Criteria (Summary)

- Właściciel widzi listę swoich szablonów, otwiera dowolny jednym kliknięciem i edytuje go jak zwykły kosztorys.
- Zapis z warsztatu nadpisuje dokładnie ten szablon, który był otwarty — także po odświeżeniu strony.
- Szablon da się usunąć i przemianować, a nieudana zmiana nazwy tłumaczy się po polsku.
- Nigdzie w aplikacji nie widać inwestycji-warsztatu — ani na liście, ani w pickerach, ani jako celu księgowania.
