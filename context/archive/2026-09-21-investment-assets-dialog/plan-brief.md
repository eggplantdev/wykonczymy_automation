# Galeria inwestycji bez miniatur — plan brief

> Pełny plan: `context/archive/2026-09-21-investment-assets-dialog/plan.md`

## What & Why

Sekcja „Zdjęcia i pliki" na stronie inwestycji renderuje dziś miniatury, których w 99% przypadków
nikt nie chce oglądać — chce pobrać plik. Zastępujemy je przyciskiem otwierającym istniejący podgląd
(pager, druk, pobieranie, zip) i przyciskiem „Dodaj pliki", który otwiera ten sam dialog wyboru co
faktura. Pliki da się też dorzucić z dialogu „Edytuj inwestycję".

## Starting Point

Mechanika istnieje po stronie faktur i jest już sparametryzowana: `InvoicePreviewDialog` przyjmuje
`labels`, `MediaFileT` rozszerza `InvoiceFileT`, `InvoiceCell` pokazuje wzorzec „podgląd ustępuje
dialogowi wyboru". Zaszyte na fakturę zostały trzy rzeczy: label triggera, `aria-label`, tytuł
dialogu wyboru. Brakuje też akcji „usuń wszystkie" dla inwestycji.

## Desired End State

Zero plików → sam przycisk „Dodaj pliki". N ≥ 1 → „Zdjęcia i pliki (N)" otwiera podgląd, a usuwanie
(„Usuń" / „Usuń wszystkie") żyje w jego stopce za potwierdzeniem. Wybór pliku jest zapisem — także
w dialogu edycji. Na stronie inwestycji nie renderuje się żadna miniatura.

## Key Decisions Made

| Decyzja | Wybór | Dlaczego | Źródło |
| --- | --- | --- | --- |
| Przycisk podglądu przy zerze plików | Nie renderuje się wcale | Klikalny element, który nic nie otwiera, to gorsza odpowiedź niż jego brak | Rozmowa |
| Gdzie żyje usuwanie | Stopka podglądu (`Usuń` / `Usuń wszystkie`) | Bez miniatur nie ma gdzie powiesić „×"; faktury robią to tak samo | Rozmowa |
| Dodawanie z „Edytuj inwestycję" | Natychmiastowy zapis przez `addInvestmentAssetsAction` | Wiersz już istnieje — ta sama semantyka co faktura w tabeli transferów. Koszt: „Anuluj" nie cofa | Rozmowa |
| Odrzucone: zbieranie plików do stanu formularza edycji | — | Wymagałoby, żeby `updateInvestmentAction` dopisywał `assets`; dziś je wycina, bo nadpisanie pustą listą skasowałoby galerię | Rozmowa |
| Usuwanie jako wspólny hak | `useMediaRemoval`, `useInvoiceRemoval` jako preset nad nim | Logika identyczna, różnią się akcje i teksty; kopia = drugie miejsce na tę samą poprawkę | Plan |

## Scope

**In scope:** parametryzacja `InvoicePreviewTrigger`/`Button`/`InvoiceUploadDialog`;
`removeAllInvestmentAssetsAction`; `useMediaRemoval`; przepisanie `InvestmentAssets`; pole dodawania
plików w formularzu edycji; przepisany spec DOM.

**Out of scope:** strip załączników zgłoszenia (zostaje read-only z miniaturami); pełne przenosiny
`lib/invoices` → `lib/media` (EX-826); `updateInvestmentAction` i `investmentSchema`; ścieżka
tworzenia inwestycji (`collectAssets`); podgląd/usuwanie w dialogu edycji.

## Architecture / Approach

Nic nowego nie powstaje poza jednym hakiem i jednym małym polem formularza. Reszta to przepięcie:
`InvestmentAssets` przestaje wołać `MediaStrip`, a zaczyna wołać `InvoicePreviewButton` +
`InvoiceUploadDialog` — te same komponenty, które obsługują faktury, tyle że z `ASSET_PREVIEW_LABELS`
i własnym tytułem.

## Phases at a Glance

| Faza | Co dowozi | Główne ryzyko |
| --- | --- | --- |
| 1. Odsłonięcie rejestru | Label/aria/tytuł jako propy, zachowanie faktur bez zmian | Regresja na powierzchni faktur |
| 2. Sekcja bez miniatur | Dwa przyciski, usuwanie w stopce podglądu, `removeAll` | Wyścig upload ↔ usuwanie musi przenieść się razem z blokadą |
| 3. Dodawanie z edycji | Pole w formularzu edycji, natychmiastowy zapis | Dialog w dialogu; „Anuluj" nie cofa (świadome) |

**Prerequisites:** brak — wszystko, na czym plan stoi, jest w `staging`.
**Estimated effort:** jedna sesja, trzy fazy.

## Open Risks & Assumptions

- `InvoiceUploadDialog` zagnieżdżony w `FormDialog` (dialog w dialogu) — Radix to udźwignie, ale to
  pierwsze takie miejsce w repo dla formularza; do sprawdzenia ręcznie.
- „Anuluj" w formularzu edycji nie cofa dodanych plików — zaakceptowane świadomie, może wymagać
  jednego zdania w UI, jeśli okaże się mylące.

## Success Criteria (Summary)

- Na stronie inwestycji nie ma miniatur, a plik da się otworzyć i pobrać w dwóch kliknięciach.
- Dodanie pliku działa z trzech miejsc: przycisku sekcji, stopki podglądu i dialogu edycji.
- Usunięcie pliku pyta o potwierdzenie i nie gubi pliku wrzucanego równolegle.
