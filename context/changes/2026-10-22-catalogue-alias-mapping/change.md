---
change_id: catalogue-alias-mapping
title: Map unlinked kosztorys pozycje onto katalog entries and backfill their links
status: new
created: 2026-10-22
updated: 2026-10-22
archived_at: null
branch: null
worktree: null
---

## Notes

— map unlinked kosztorys pozycje (opis + j.m. with no exact katalog key) to katalog entries: build the review list, then backfill links and let imports reuse the mapping

### Stan na prod (2026-10-22, odczyt)

- 35 011 pozycji w kosztorysach inwestycji; 29 933 z linkiem do katalogu.
- **0** pozycji bez linku, których opis + j.m. trafia dokładnie w klucz wpisu — dokładne
  dopasowanie jest już wyczerpane (import i „Popraw literówki" linkują same, `28335b0a6`).
- 5 078 pozycji (853 różne opis + j.m.) bez wpisu katalogu o tym tekście; 69 z linkiem do
  skasowanego wpisu.
- Dwie inwestycje z importu 2026-10-22: Belgijska 9 — 226 / 315 z linkiem, Koprowskiego 11 —
  280 / 373.
- Próbka niepodpiętych: „Montaż zaworów", „Montaż umywalki", „Montaż syfonów" (kpl), „Sufit
  podwieszany", „Montaż i podłączenie taśm LED" (mb) — te same grupy A / B / C co w
  `context/archive/2026-10-06-catalogue-usage-counter/change.md`.

### Lista do przeglądu — pomiar (prod, 2026-10-22)

Grupowanie po kluczu katalogu (`catalogueKey`) skleja 853 surowe teksty w **774**. Podpowiedź =
`closestEntries` z „Porównaj z katalogiem" (Dice ≥ 0,55).

- **Obecność to głównie stary cennik.** 137 tekstów stoi w ≥ 2 inwestycjach i pokrywa 4 414 / 5 078
  pozycji, ale większość z nich to wiersze z zerami: „Szlifowanie posadzki lub ścian do 1 cm" stoi w
  67 inwestycjach, użyte w 7; „Sufit podwieszany montaż stelaża z płytami" — 50 / 0.
- **Użycie** (Przedmiar > 0 albo etapy, jak w liczniku katalogu): 1 189 użyć w 674 tekstach. 87
  tekstów użytych w ≥ 2 inwestycjach = 602 użycia (51%); ≥ 5 — 33 teksty / 464; ≥ 10 — 16 / 362.
  Reszta (587 tekstów) to jednorazówki.
- Automatyczny podział A / B / C **nie trzyma się**: wysoka zgodność podpowiedzi nie znaczy „ta sama
  praca". „Wyburzanie ścian do 12cm grubości" → „… - żelbeton" (0,86) i „Montaż odpływu liniowego…"
  → „… - koperta" (0,91) to grupa B (wybór wariantu), nie literówka. Inna j.m. przy tym samym opisie
  (28 tekstów, np. syfony kpl / szt, LED mb / kpl, zabezpieczenia kpl / m²) to decyzja o stawce.
  Każdą parę musi zatwierdzić człowiek.

Lista: `alias-list.json` (774 teksty, posortowane po liczbie inwestycji; `usedIn` = w ilu użyta,
`liveIn` = w ilu aktywnych / ofertach / planowanych, `hints` = 3 podpowiedzi z katalogu). Odświeżenie
(tylko odczyt prod):

```bash
set -a; source .env; set +a
DB_URL="$DB_POSTGRES_URL_PROD" node --import tsx context/changes/2026-10-22-catalogue-alias-mapping/alias-list.ts
```

Otwarte przed planem:

- **Forma przeglądu dla właściciela** (odłożone 2026-10-22, brak czasu): strona z 87 tekstami
  użytymi w ≥ 2 inwestycjach, przy każdym 3 podpowiedzi i wybór „ta sama praca" / „inny wpis…" /
  „dodaj do katalogu" / „zostaw" — wybory zapisane na stronie i czytane do backfillu; albo arkusz
  Google z tymi samymi kolumnami.

- **Link i tekst rozjeżdżają się w „Porównaj z katalogiem".** Porównanie szuka wpisu najpierw po
  linku (`resolveCatalogueEntry`), a „Zastosuj" (`applyCatalogueToKosztorysAction`) tylko po tekście
  (`catalogueKey`). Pozycja podpięta pod wpis o innym tekście pokaże różnicę cen, a „Zastosuj"
  zakończy się „Część zaznaczonych prac nie jest już w katalogu." Dziś to rzadkość, po backfillu —
  każda podpięta pozycja z grupy A / B. Plan musi to ujednolicić (np. „Zastosuj" po linku).
- Gdzie mieszka mapa (tabela w bazie czytana przez import vs `CATALOGUE_NAME_FIXES`) i co z grupą B,
  dla której jeden tekst nie ma jednego wpisu.
