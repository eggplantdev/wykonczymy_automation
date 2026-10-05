---
change_id: column-colors
title: Kolory kolumn w edytorze kosztorysu v2 — zapis lokalny w przeglądarce
status: new
created: 2026-10-05
updated: 2026-10-05
archived_at: null
branch: null
worktree: null
---

## Notes

Picker kolorów w menu nagłówka każdej kolumny kosztorysu v2 — ta sama paleta i ten sam
`SectionColorPicker` co przy sekcji. Wyrósł ze spike'a 2026-10-05; spike JEST implementacją.

**Zapis: localStorage, nie baza** (decyzja właściciela 2026-10-05). Klucz `kosztorys-v2-col-colors`,
mapa id kolumny → klucz palety, ten sam mechanizm co szerokości (`createJsonMapStore`). Skutki:

- kolor należy do przeglądarki, nie do kosztorysu — kolumna stała (np. „Przedmiar") ma ten sam
  kolor w każdym kosztorysie; kolumny etapów mają id z DB, więc są per etap;
- usunięcie etapu kasuje jego kolor razem z szerokością (id z DB mogą wrócić);
- podgląd inwestora i link pracownika kolorów nie pokazują.

Malowanie: `background-image` z 20% odcienia nałożony na komórkę i nagłówek (`.kosztorys-column-tint`
w `globals.css`) — nie zastępuje szarego „nie wpiszesz" ani czerwonych ostrzeżeń; pasmo nagłówka
sekcji wygrywa i zostaje jedną belką.

## Odłożone — zapis do bazy (EX-987, parked)

Jeśli kolor ma stać się częścią kosztorysu (widoczny dla innych i u inwestora), szacunek ~1,5 dnia:

- migracja: `kosztoryses.column_colors jsonb` + `kosztorys_stages.color varchar` (kolor etapu
  znika wtedy z etapem sam), walidacja kluczy przez `isSectionColorKey` na zapisie i odczycie —
  wzór: `kosztorys_sections.color`;
- akcja w `lib/actions/kosztorys.ts` + optymistyczny zapis i cofnij/ponów (wzór
  `handleSetSectionField`);
- do decyzji: czy snapshot/preset przywraca kolory; czy link pracownika je pokazuje;
- podgląd inwestora dostaje je prawie za darmo (to samo drzewo, ten sam `KosztorysEditorBody`) —
  trzeba tylko ustalić pierwszeństwo z paskami podglądu i kolumną raportu;
- wydruk oferty (`lib/kosztorys/print/offer.ts`) to osobny generator HTML — dodatkowe ~pół dnia.
