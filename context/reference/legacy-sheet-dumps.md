# Zassane stare arkusze (dumpy legacy)

Trwały adres surowych danych ze starych arkuszy klientów, zebranych przy zmianie
`2026-08-31-legacy-sheet-work-import`. To jedyne miejsce, gdzie te dane istnieją poza Google —
skrypty, które je pobrały, zostały skasowane na bramce review.

## Gdzie leżą

| Ścieżka                                    | Rola                                                           |
| ------------------------------------------ | -------------------------------------------------------------- |
| `~/.local/share/wykonczymy-legacy-sheets/` | katalog kanoniczny — domyślny `DUMP_DIR` skryptu pobierającego |
| `dumps/legacy-sheets/`                     | kopia w repo, bajt w bajt ta sama (nie symlink)                |

Obie po 48 MB: **57 plików `<googleSheetId>.json` + `raport.md`**. Nadpisanie lokalizacji:
zmienna `LEGACY_SHEET_DUMP_DIR` (nie jest ustawiona w `.env`, więc liczy się ścieżka z `~/.local/share`).

**Kopia w repo jest zamierzona i ma zostać ignorowana przez gita** — `.gitignore` wycina cały
`dumps/`, więc pliki są pod ręką w drzewie projektu, a mimo to nigdy nie trafią do historii.
Tak ma być: dumpy niosą ceny i nazwiska 57 klientów. Konsekwencja: to nie jest backup — obie kopie
istnieją tylko na tej maszynie i giną razem z dyskiem.

## Co jest w środku

Jeden plik na arkusz, kształt `SheetDumpT`:

```
sheetId, googleSheetId, sheetName,
investmentId, investmentName, investmentCreatedAt,
columnMapping,          // wykryte kolumny arkusza (Przedmiar, Wartość netto, etapy…)
grids,                  // surowe wiersze; puste, gdy pobranie padło
failure                 // powód, gdy grids puste (np. `forbidden`)
```

56 plików ma siatki, 1 ma `failure: forbidden` (konto serwisowe nie miało dostępu).

`raport.md` (5765 linii) to wynik analizy offline — nagłówek: **41 arkuszy przeczytanych,
16 nieprzeczytanych, 944 unikalne prace, 189 już w katalogu, 755 do dołożenia, w tym 56 ze stawką
0 zł**. Sekcja 2 wymienia każdy nieprzeczytany arkusz z powodem (brak kolumny „Wartość netto",
brak kolumny sekcji, brak „Przedmiaru", brak dostępu).

## Skąd się wzięły

Pipeline żył w `src/scripts/legacy-sheet-import/` i został skasowany w **`1fb50e6c`** na gałęzi
`legacy-sheet-work-import`. Odzyskanie dowolnego skryptu:

```bash
git show 1fb50e6c^:src/scripts/legacy-sheet-import/fetch-grids.ts
```

Skasowane: `fetch-grids.ts` (pobieranie, wznawialne, `PAUSE_MS = 1_500`, scope Sheets readonly),
`dump-store.ts` (zapis/odczyt dumpów), `parse-dumped-sheet.ts`, `collect-candidates.ts`,
`similar-names.ts`, `analyze.ts`, `run-analysis.ts`, `report.ts`, `rekey-catalogue.ts`.
Katalog wjechał na produkcję **2026-09-02** (940 pozycji, tabela była pusta), po czym skasowano
także `export-catalogue.ts` i `import-catalogue.ts` — cały `src/scripts/legacy-sheet-import/`
zniknął. Wsad był jednorazowy i insert-only po `match_key`, więc przegląd katalogu (kasowanie
śmieci, wycena zer, zdejmowanie dopisku „[stary arkusz]") robi się już **w aplikacji na
produkcji**, zwykłą edycją wiersza — nie powtórnym wsadem, który dołożyłby duplikaty pod nowymi
kluczami.

Ponowne pobranie: `node --env-file=.env --import tsx src/scripts/legacy-sheet-import/fetch-grids.ts`
(po przywróceniu skryptu). Czyta kontem read-only z `GOOGLE_SERVICE_ACCOUNT_JSON`, więc z laptopa
jest bezpieczne; arkusz, którego reader nie ma udostępnionego, wyląduje jako `failure`.
