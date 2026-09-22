# Zakładka „Inwestycja" w panelu Podsumowanie — brief planu

> Pełny plan: `context/changes/2026-09-22-zakladka-inwestycja-w-panelu/plan.md`

## Co i po co

Zakres prac żyje w notatce inwestycji i jest niewidoczny z edytora, w którym ten zakres się wycenia.
Panel Podsumowania dostaje szóstą zakładkę — „Inwestycja" — z kompletem danych inwestycji
(adres, kontakt, notatki, opinia, status) i przeniesioną tam „Dokumentacją". Żeby galeria nie
znikała na świeżej inwestycji, panel zaczyna montować się także na pustym kosztorysie.

## Punkt wyjścia

Pasek zakładek to pięć wartości `SummaryViewT`, bramkowanych przez `allowedSummaryViews` na dwóch
sygnałach (`preview`, `hasMarginInputs`). Rekord inwestycji już leży na stronie edytora — trasa
szuka go tylko po to, żeby sprawdzić istnienie. „Dokumentacja" stoi w rzędzie narzędzi siatki,
zasilana `assets` z kontekstu edytora. Panel nie montuje się przy zerowej liczbie pozycji, bo
otwarty pokazywałby same zera na ekranie z jedynym wejściem („Pobierz z arkusza Google…").

## Stan docelowy

Ostatnia zakładka paska to „Inwestycja": pola z karty inwestycji tylko do odczytu, „Edytuj
inwestycję" i „Dokumentacja". Rząd narzędzi siatki bez galerii. Na pustym kosztorysie panel
zamontowany, ale zwinięty. Dokument klienta bez tej zakładki — jak bez „Podwykonawców".

## Podjęte decyzje

| Decyzja                    | Wybór                                                        | Dlaczego                                                                                  | Źródło   |
| -------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------- |
| Miejsce                    | Pasek zakładek istniejącego panelu, pozycja **ostatnia**      | Wybór właściciela — dane inwestycji nie wypychają Podsumowania z pierwszego miejsca        | Rozmowa  |
| Pusty kosztorys            | Montuj wszystko, panel domyślnie zwinięty                     | Galeria i notatki mają być osiągalne na świeżej inwestycji, bez zasłaniania importu        | Rozmowa  |
| „Zwinięty na pustym"       | **Drugi klucz localStorage** z domyślną `'closed'`            | Nadpisanie odczytu flagą robi z przełącznika martwy przycisk; `useSummaryView` ma precedens | Plan     |
| Notatki                    | Tylko odczyt + „Edytuj inwestycję"                            | Dialog już istnieje; autozapis notatek to własna zmiana                                    | Rozmowa  |
| Zestaw pól                 | Komplet z karty inwestycji, ta sama kolejność i etykiety      | Jeden zestaw pól, dwie powierzchnie — nie dwa zestawy do rozjechania                        | Rozmowa  |
| Bramka widoczności         | `!preview && hasInvestmentInfo`                               | Notatka wewnętrzna nie jest dla inwestora; warsztat szablonów nie ma żadnej inwestycji     | Plan     |
| Zakładki finansowe na pustym | Bez zmian                                                   | Mają już własne stany pustki — trzeci sygnał w `allowedSummaryViews` byłby zbędny          | Rozmowa  |
| Kanał danych               | Prop przez korpus edytora, nie `KosztorysEditorProvider`      | Kontekst obsługuje toolbar i siatkę; panel czyta to sam (zakaz z AGENTS.md, EX-496)        | AGENTS.md |
| `assets`                   | Schodzi z kontekstu edytora do propsa panelu                  | Po przeprowadzce nikt w toolbarze go nie czyta — martwe pole kontraktu                     | Plan     |

## Zakres

**W zakresie:** `'investment'` w `SummaryViewT`; `hasInvestmentInfo` w `allowedSummaryViews`; nowy
`summary/tabs/summary-investment-tab.tsx`; `investment?` w `KosztorysEditorDataT` i na trasie;
przeniesienie `InvestmentAssetsControl` do zakładki; `assets` poza kontekstem edytora; drugi klucz
w `useTotalsPanelOpen`; zdjęcie bramki montowania i `disabled` po stronie właściciela; specy DOM.

**Poza zakresem:** edycja notatek w miejscu; karta inwestycji (`InvestmentAssetsSection`,
`InfoList`); `INVESTMENT_PANEL_VIEWS` na stronie inwestycji; nagłówek podglądu klienta; zmiana nazw
pozostałych napisów „Zdjęcia i pliki"; nowe zapytania i akcje serwerowe; E2E.

## Podejście

```
kosztorys_v2/page.tsx ──investment={…} assets={…}──► KosztorysEditorV2
                                                          │
                                                          ▼
                                    KosztorysEditorBody ──► KosztorysTotalsPanel
                                          │                       │ investment, assets
                                          │                       ▼
                                          │              SummaryPanelContent
                                          │                       │ view === 'investment'
                                          ▼                       ▼
                        KosztorysEditorToolbar          SummaryInvestmentTab
                        (bez galerii po fazie 2)        InfoList + Edytuj + Dokumentacja
```

## Fazy

| Faza                          | Co dowozi                                        | Główne ryzyko                                                              |
| ----------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| 1. Zakładka „Inwestycja"      | Nowy widok, bramka, komponent, kanał danych      | Zapisany widok wskazujący zakładkę, której host nie ma (fallback już jest) |
| 2. Dokumentacja w zakładce    | Galeria poza toolbarem, `assets` poza kontekstem | `assets` może mieć innego konsumenta kontekstu — gate na typecheck         |
| 3. Panel na pustym kosztorysie | Montowanie bez bramki, zwinięty gdy pusto       | Wspólny store `usePersistedEnum` — przełącznik i panel muszą czytać to samo |

**Rozmiar:** jedna sesja, trzy fazy. Domyka otwarty punkt bramki przeglądu poprzedniej zmiany
(„Usuń wszystkie" w rzędzie narzędzi siatki).

## Otwarte ryzyka i założenia

- Dwa klucze stanu otwarcia to dwie preferencje do zapamiętania. Zakładamy, że to cecha, nie wada:
  pierwszy ekran nowej inwestycji nie powinien dziedziczyć wyboru zrobionego na pełnym kosztorysie.
- Zakładka jest ostatnia, więc na wąskim panelu pasek może się zawijać. Przyjęte świadomie.
- Zestaw pól jest skopiowany z karty inwestycji, nie współdzielony — rozjazd jest możliwy, ale
  wspólny moduł pod siedem etykiet byłby droższy niż sam rozjazd.

## Kryteria sukcesu

- Z edytora widać zakres prac i pliki inwestycji bez wracania na jej kartę.
- Na inwestycji bez kosztorysu `EmptyState` z importem jest w pełni widoczny, a panel da się otworzyć.
- Podgląd inwestora i warsztat szablonów nie znają zakładki „Inwestycja".
