# Wydatki zgłaszane przez pracownika (EX-971) — Plan Brief

> Full plan: `context/changes/2026-10-05-worker-expenses/plan.md`
> Research: `context/changes/2026-10-05-worker-expenses/research.md`

## What & Why

Pracownik zgłasza zakup na budowę zdjęciem paragonu zamiast oddawać paragon managerowi do przepisania.
Manager zamienia zgłoszenie w zwykły wydatek tym samym dialogiem, którego używa dziś.

## Starting Point

Strona pracownika (przycisk, dialog, lista „Moje wydatki", tabela zgłoszeń) jest w drzewie,
niecommitowana. Strony managera nie ma.

## Desired End State

Nad tabelą Transakcji czekają zgłoszenia. „Przyjmij" otwiera „Nowy wydatek" z inwestycją, kasą
pracownika, zdjęciami i notatką; manager wpisuje kwotę albo klika „Generuj" i zapisuje. „Odrzuć"
odrzuca. Filtr „Zgłoszenia pracowników" + badge „od pracownika" w tabeli.

## Key Decisions Made

| Decision                       | Choice                                                               | Why                                                         | Source   |
| ------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------- | -------- |
| Gdzie manager widzi zgłoszenia | Lista nad tabelą Transakcji, bez podstrony                           | Decyzja właściciela                                         | Research |
| AI                             | Na żądanie — przycisk „Generuj"                                      | Decyzja właściciela                                         | Plan     |
| Zdjęcia → pozycje              | Jedno zgłoszenie = jeden wydatek, wszystkie zdjęcia w jednej pozycji | Jak przy zwykłym wydatku                                    | Plan     |
| Zdjęcia w wydatku              | Wgrane ponownie, nie podpięte istniejące                             | „Generuj" i tak podmienia pliki; zero nowej ścieżki uploadu | Plan     |
| Atomowość                      | Wydatek + „przyjęty" w jednej transakcji; wyścig ⇒ „już rozpatrzone" | Brak podwójnych wydatków                                    | Research |

## Scope

**In scope:** zabezpieczenie zdjęć zgłoszeń przed reclaimem, sprzątanie plików pracownika, przyjęcie,
odrzucenie, prefill dialogu, filtr, badge.

**Out of scope:** AI przy kliknięciu, podstrona, licznik w nawigacji, ponowne rozpatrzenie, edycja
zgłoszenia przez pracownika.

## Phases at a Glance

| Phase                                     | What it delivers                                            | Key risk                                    |
| ----------------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| 1. Zdjęcia bezpieczne + strona pracownika | Reclaim nie kasuje zdjęć zgłoszeń; commit strony pracownika | Zdjęcie zgłoszenia uznane za sierotę        |
| 2. Przyjęcie / odrzucenie — serwer        | Atomowe przyjęcie, odrzucenie                               | Wydatek bez oznaczonego zgłoszenia          |
| 3. Dialog managera                        | Lista + wypełniony „Nowy wydatek"                           | Prefill nadpisuje szkic zwykłego formularza |
| 4. Filtr + badge                          | „Zgłoszenia pracowników", „od pracownika"                   | Filtr gubi istniejące zawężenie             |

**Prerequisites:** EX-985 (konto pracownika) — zrobione.
**Estimated effort:** ~1–2 sesje.

## Open Risks & Assumptions

- Migracja addytywna — prod przed pushem, ręcznie.
- Kopia zdjęć w Blob na każde przyjęte zgłoszenie — świadomie.
