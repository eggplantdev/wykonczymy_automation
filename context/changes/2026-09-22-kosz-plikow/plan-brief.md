# Brief: kosz plików

Odpięcie pliku przestaje kasować go z Bloba. Powstaje wpis w koszu, plik ginie po **7 dniach**,
zmieciony nocnym cronem. Blob nie ma undelete, więc dziś jedno kliknięcie kasuje fakturę na zawsze.

## Mechanizm w trzech zdaniach

1. `setUploadField` zapisuje „media N zeszło z `<kolekcja>/<id>/<pole>` o T" do surowej tabeli
   `media_detachments` i **nie woła** `deleteUnreferencedMedia`.
2. Nocny cron `/api/cron/cleanup` robi trzy rzeczy: zapisuje sieroty (pliki bez żadnej referencji —
   to naprawia wyciek kaskadowy), leczy wpisy na plikach wciąż przypiętych, kasuje to, co leży dłużej
   niż 7 dni.
3. Faza 3 dokłada „Kosz (N)" i „Przywróć" — jedna kontrolka parametryzowana celem, trzy montaże.

## Trzy odwrócenia względem szkicu z rozmowy

- **Zamiatacz pyta o referencje, nie o kosz.** Cztery z pięciu relacji mają `ON DELETE cascade` i
  nikt po nich nie sprząta — skasowanie inwestycji zostawia zdjęcia w Blobie na zawsze. Zapytanie
  zbiorowe łapie to przy okazji.
- **Najpierw prowenancja, potem zdjęcie referencji.** Rozerwany zapis zostawia wtedy wpis-widmo przy
  wciąż przypiętym pliku. Zamiatacz go leczy, więc **transakcja jest niepotrzebna**.
- **Surowa tabela, nie kolumny na `media`.** Jeden plik może legalnie wisieć na dwóch rodzicach
  (`promoteLeadAction`), więc „skąd zszedł" nie jest funkcją pliku.

## Dwa twarde ograniczenia

- **Podłogą retencji jest pełna doba** — kopia na FTP powstaje raz dziennie. Plan zamienia godziny
  (kopia `0 3`, sprzątanie `30 3`), żeby kopia szła **przed** sprzątaniem, nie pół godziny po nim.
- **Kasowanie szeregowo, nigdy `Promise.all`** — na Neonie równoległe `delete` meldują sukces,
  a commituje się jeden. Odtworzone; lokalny Postgres tego nie pokazuje.

## Trzy fazy

| Faza | Co dowozi                                                                                            | Użyteczna sama?                          |
| ---- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1    | migracja + `src/lib/db/media-detachments.ts` + przepięcie `setUploadField` + prawdziwe potwierdzenia | nie — `media` puchnie, aż wejdzie faza 2 |
| 2    | `gcMedia` + krok w cronie + zamiana godzin                                                           | tak — pliki wracają przez panel Payloada |
| 3    | zapytanie + akcja + kontrolka „Kosz (N)" ×3                                                          | tak — odzysk bez panelu                  |

## Czego plan świadomie NIE rusza

- **Skasowanie wydatku kasuje fakturę od razu** — samego wydatku i tak nie da się cofnąć, więc nie ma
  dokąd faktury przywrócić. `deleteInvoiceMediaAfterDelete` bez zmian, jego sześć przypadków przeżywa.
- **Panel Payloada nie dostaje blokady** na pliki w koszu — `preventReferencedMediaDelete` odmawia
  tylko na pliku, który ktoś realnie trzyma. Kosz jest siatką na pomyłkę w aplikacji, nie ochroną
  przed adminem, który kasuje świadomie.
- **Sprzątanie po nieudanym zapisie formularza** (`deleteOrphanedMediaAction`, rollback webhooka
  landingu) zostaje natychmiastowe — te pliki nigdy nie były przypięte.
- **Kolumny „kto odpiął" nie ma.** `setUploadField` widzi tylko `payload`; „kto" oznaczałoby
  przewleczenie użytkownika przez osiem miejsc wywołania.

## Co zamyka się przy okazji

- **EX-833** — pętla licząca referencje (~10 zapytań na plik) wypada ze ścieżki użytkownika do crona,
  gdzie staje się jednym zapytaniem zbiorowym.
- **Cztery ciche wycieki kaskadowe** (`investments`, `leads`, `vehicle-inspections`,
  `equipment-events`), z których żaden nie ma dziś niczego, co by po nim sprzątało.

## Ryzyka

- Faza 1 nie wychodzi na produkcję bez fazy 2 — sama przestaje kasować i nic nie zamiata.
- Migracja jest **addytywna**: `pnpm db:migrate:prod` (człowiek) **przed** pushem.
- Pierwszy produkcyjny przebieg zamiatacza zobaczy całą zaległość sierot od 2026-08 — wejdą do kosza
  jedną nocą, skasują się siedem nocy później, po `MAX_DELETES_PER_RUN` na noc.
- **E2E jest należne**: „usuń → Kosz (1) → Przywróć → plik wraca" przechodzi klient → akcja → DB →
  rewalidacja. Autorować przy bramce albo zgłosić z etykietą `e2e-backlog`.

Sprawdzenia ręczne: `context/foundation/manual-checks.md`, sekcja `kosz-plikow`.
