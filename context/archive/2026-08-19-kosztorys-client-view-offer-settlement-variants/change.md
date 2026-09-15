---
change_id: kosztorys-client-view-offer-settlement-variants
title: Warianty „Oferta / Rozliczenie" w ustawieniach podglądu inwestora
status: archived
created: 2026-08-19
updated: 2026-08-20
archived_at: 2026-08-20T09:10:00Z
branch: kosztorys-client-view-offer-settlement-variants
worktree: null
---

## Notes

Toggle „Oferta / Rozliczenie" w oknie „Ustawienia podglądu inwestora": osobne zestawy widocznych
kolumn per wariant, osobne domyślne firmowe per wariant, a tryb aktywny zapisywany na inwestycji —
inwestor widzi wariant, w którym inwestycja aktualnie jest.

Ustalenia z rozmowy poprzedzającej (2026-08-19):

- **Wariant to trwały tryb inwestycji, nie preset w oknie.** Inwestycja trzyma oba zestawy kolumn
  naraz plus to, który jest aktywny — przełączasz ją z oferty na rozliczenie, gdy prace ruszają, bez
  ponownego odklikiwania kolumn.
- **Przełącznik w oknie = zmiana tego, co widzi inwestor.** Jedna decyzja, nie dwie: nie ma
  „edytuję ofertę, ale pokazuję rozliczenie". Wybrany wariant jest jednocześnie edytowanym
  i (po zapisie) aktywnym.
- **Wyraźny zapis + potwierdzenie.** Przycisk nazywa skutek wprost („Zapisz i pokaż rozliczenie"),
  _— cofnięte 2026-09-15: napis czytał się jako obietnica otwarcia podglądu w tym oknie, więc zostało samo „Zapisz"; potwierdzenie bez zmian,_
  a zapis po zmianie wariantu podnosi to samo okienko „Uwaga — zmiana widoczna dla inwestora!", które
  stoi przed zmianą sposobu rozliczenia materiałów. Wzorzec jak tam: to samo okno, ten sam flow.
  (Korekta wobec pierwszego zapisu tej decyzji, który mówił „bez osobnego modala" i został wdrożony
  jako baner w oknie — owner odrzucił baner, ma być dokładnie ten dialog.)
- **„Zapisz jako domyślne" dotyczy jednego wariantu** — tego wybranego — i zapisuje **wyłącznie jego
  zestaw kolumn**. Domyślnego trybu firmowego nie rusza (przegląd kodu, 2026-08-20): ten tryb decyduje,
  co widzi każda inwestycja bez własnych ustawień, więc jego zmiana przestawiłaby naraz wszystkie żywe
  linki inwestorów — z przycisku, którego potwierdzenie mówi o jednej inwestycji. Nowa inwestycja i tak
  startuje w ofercie (wartość domyślna kolumny), a firmowy tryb zostaje świadomą zmianą w /admin.
- **Domyślne z kodu są dwa, różne.** Oferta: opis prac, przedmiar, jednostka miary, cena j.m. netto,
  wartość przedmiaru netto. Rozliczenie: pomiar, etapy, razem netto, % wykonania.
- **Brak danych do zachowania (owner, 2026-08-19).** Nikt nie odklikał jeszcze żadnego wariantu, więc
  migracja jest tępa: dodaje nowe kolumny, kasuje istniejące wiersze, zero backfillu. Stare kolumny
  (`hidden_columns`, `hide_empty_rows`) **zostają** — migracja jest czysto addytywna, bo tę tabelę
  czyta też niezalogowane wejście po tokenie: gdyby jednym ruchem dodawała i usuwała, żadna kolejność
  deployu nie byłaby bezpieczna (jedna ze stron trafiałaby na 42703 właśnie na `/k/:token`). Stare
  kolumny zdejmie osobna migracja, dopisana dopiero po wypuszczeniu tego deployu.
- **Odczyt po stronie inwestora bez zmian.** `getClientViewSettings(investmentId)` dalej zwraca jeden
  płaski zestaw — rozwiązuje tylko wariant aktywny — więc podgląd i wejście po tokenie zostają
  nietknięte.
