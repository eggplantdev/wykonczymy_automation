# Kosztorys robocizny w aplikacji (POC) — Plan Brief

> Full plan: `context/changes/kosztorys-poc-in-app/plan.md`
> Spec: `docs/superpowers/specs/2026-06-19-kosztorys-poc-in-app-design.md`

## What & Why

Edytowalna rozpiska robocizny per inwestycja w aplikacji — dowód, że appka może w
pełni zastąpić ręczny arkusz Google Sheets w tej części, której dziś nie obejmuje
(appka ma tylko zbiorczą kwotę `LABOR_COST`, arkusz ma pełną rozpiskę). Czysty
start, baza aplikacji = źródło prawdy (arkusze dryfują od bazy, więc import
odrzucony).

## Starting Point

Robocizna w appce to jedna transakcja `LABOR_COST`. Wszystkie pozostałe actuals
(materiały, wypłaty, rabaty, straty) są już liczone z transakcji
(`deriveFinancials`/`calculateMargin`). Detale inwestycji są route-based; „Arkusz"
to osobna trasa z iframe do Sheets. Inline-edit nie istnieje w repo (wszystko przez
dialogi).

## Desired End State

OWNER/ADMIN/MANAGER otwiera „Kosztorys (edytor)" w inwestycji i prowadzi pełną
rozpiskę jak arkusz — sekcje, pozycje, 3 ceny, przedmiar/pomiar, rabat, VAT,
dynamiczne etapy z postępem — z natychmiastowym zapisem per pole, czyta panel
plan-vs-actual (marża planowana vs rzeczywista), liczy metraż pokoi i generuje
PDF-ofertę dla klienta. EMPLOYEE nie widzi kosztorysu. Zakładka „Arkusz" działa bez
zmian.

## Key Decisions Made

| Decision             | Choice                                               | Why                                                               | Source    |
| -------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- | --------- |
| Schemat cen          | A — 3 sztywne kolumny na `kosztorys_items`           | Najtaniej; migracja A→B później mechaniczna                       | Plan      |
| Linkage `LABOR_COST` | Stoi obok (plan vs actual)                           | Zero ryzyka nadpisania ledgera; panel już to zakłada              | Plan      |
| Priorytet MVP        | Edytor + autosave = rdzeń; panel/PDF później         | Dowodzi tezy POC najwcześniej; panel/PDF czytają gotowe dane      | Plan      |
| Pokoje               | Luźny kalkulator metrażu                             | 1:1 z arkuszem, niezależne od rdzenia                             | Plan      |
| VAT default          | 8% (kaskada sekcja→pozycja)                          | Remont mieszkań; edytowalne                                       | Plan (P7) |
| Optymistyka          | Per-cell hook, NIE `useOptimisticFormStore`          | Store jest single-flight/dialog-owy; siatka edytuje wiele komórek | Plan      |
| Wartości             | Liczone w kodzie z `measured_qty`, nie przechowywane | Zapisujemy tylko inputy                                           | Spec      |

## Scope

**In scope:** 5 tabel (sekcje, pozycje, etapy, postęp, pokoje); edytowalna siatka z
autosave; dynamiczne etapy + postęp; panel plan-vs-actual; kalkulator pokoi;
konfigurowalny PDF-oferta; bramka dostępu (EMPLOYEE wykluczony).

**Out of scope:** import arkuszy, sprzężenie z `LABOR_COST`, schemat cen B,
szablony/auto-tworzenie, auto-link pokój→pozycja, ukrywanie komórek przed MANAGEREM,
drag-reorder, `work_catalogue`, multi-waluta, teardown Sheets.

## Architecture / Approach

Nowa trasa `/inwestycje/[id]/kosztorys-edytor` (route-based, jak „Arkusz"). Server
component pobiera drzewo kosztorysu (`getKosztorysTree`), renderuje siatkę TanStack
grupowaną po sekcji z dynamicznymi kolumnami etapów. Mutacje przez `protectedAction`

- `updateTag`; UI optymistyczne przez lekki per-cell hook (lokalny stan →
  debounced akcja → `router.refresh` na sukces). Wartości liczone czystymi funkcjami
  (`lib/kosztorys/calc.ts`); zapisujemy tylko inputy. Panel plan-vs-actual reużywa
  `deriveFinancials`/`calculateMargin`. PDF przez `buildPrintHtml`/`printViaIframe`
  (zero zależności).

## Phases at a Glance

| Phase                        | What it delivers                                      | Key risk                                                        |
| ---------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| 1. Schemat danych            | 5 tabel, kolekcje, migracja, typy                     | Ręczna migracja + rejestracja w `payload_locked_documents_rels` |
| 2. Odczyt + trasa + liczenie | Trasa, query drzewa, czyste formuły, read-only siatka | Dynamiczne kolumny etapów + grupowanie sekcji w TanStack        |
| 3. Edycja + autosave (RDZEŃ) | Pełna edycja jak arkusz, bez „Zapisz"                 | Nowy per-cell wzorzec optymistyczny (brak go w repo)            |
| 4. Plan-vs-actual            | Panel marży planowanej vs rzeczywistej                | Zgodność planu z sumami i actuals                               |
| 5. Pokoje                    | Kalkulator metrażu                                    | Niski — niezależne                                              |
| 6. Eksport PDF               | Konfigurowalna oferta klienta                         | Reguła domyślnej widoczności + tylko ceny klienta               |

**Prerequisites:** worktree `poc-kosztorys-in-app` + baza `wykonczymy-poc` (gotowe).
**Estimated effort:** ~4–6 sesji; fazy 1–3 to rdzeń, 4–6 przyrostowo.

## Open Risks & Assumptions

- Per-cell optymistyka to nowy wzorzec — największe ryzyko UX/wydajności (1000+
  wierszy). Złagodzone: zapis tylko zmienionego pola + debounce.
- Grupowanie sekcji + dynamiczne kolumny etapów w TanStack może wymagać własnego
  wrappera zamiast generycznego `DataTable`.
- Defaulty biznesowe (VAT 8%, reguła ukrywania w eksporcie, przedmiar w ofercie)
  przyjęte jako rozsądne — do potwierdzenia przez właściciela, nie blokują POC.

## Success Criteria (Summary)

- OWNER prowadzi pełny kosztorys od zera w aplikacji, bez kontaktu z Sheets.
- Edycja per pole zapisuje się natychmiast i trwale; sumy/marża/brutto/pozostało
  przeliczają się na żywo.
- Panel plan-vs-actual i PDF-oferta działają na realnych danych; EMPLOYEE nie ma
  dostępu.
