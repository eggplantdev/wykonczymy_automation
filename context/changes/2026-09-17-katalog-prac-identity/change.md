---
change_id: katalog-prac-identity
title: Tożsamość pracy w katalogu — id obok match_key, plus szybkie dodanie pracy do katalogu z edytora
status: new
created: 2026-09-17
updated: 2026-09-17
archived_at: null
branch: null
worktree: null
---

## Notes

Dwa wątki, jeden temat: jak rozpiska i katalog prac wiążą się ze sobą.

### Wątek 1 — identyfikacja przez id zamiast/obok `match_key`

Dziś jedynym wiązaniem jest treść: `catalogueKey(description, unit)` (`src/lib/kosztorys/work-catalogue/catalogue-key.ts`),
składowany jako `work_catalogue_items.match_key` z UNIQUE. `kosztorys_items` **nie trzyma żadnej referencji**
do katalogu — proweniencja jest wyrzucana przy wstawieniu i zgadywana z powrotem z treści przy każdym odczycie.

**Dlaczego tak jest (do potwierdzenia w brainstormingu, nie do obalenia z marszu):**

1. Katalog urodził się jako **pochodna rozpisek** — `build-catalogue-seed.ts` zlepił ~750 prac z 57 starych
   arkuszy klientów. W momencie narodzin nie było id, którym można by cokolwiek podlinkować.
2. „Ta sama praca" to pytanie o **treść**, nie o pochodzenie. UNIQUE na `match_key` odpowiada na
   „czy ta praca już jest w cenniku?" przy „Zapisz do katalogu…" — pytanie padające **zanim** id powstanie.
   Seed zwijający N wystąpień w jeden wpis też jest z natury zwijaniem po kluczu.
3. Fold jest współdzielony celowo — `catalogueKey` reużywa `foldDescription` z importu arkusza, żeby
   „Popraw literówki" nie odcięło wpisu katalogu od pracy, z której powstał.

**Koszt tego rozwiązania — dwa udokumentowane incydenty:**

- `context/foundation/lessons.md:1592` — „[stary arkusz]" jako display text wjechał do klucza; praca
  przestała matchować samą siebie, cicho.
- `context/foundation/lessons.md:1741` — appka porównuje ŚWIEŻO policzony klucz ze SKŁADOWANYM.
  Każda zmiana `foldDescription` to domyślnie dług backfillowy; rozjechany wiersz **znika cicho**
  (`ON CONFLICT DO NOTHING` → duplikat nie powstaje zamiast rzucić błąd).

**Gdzie klucz pęka dziś:** zmiana opisu albo j.m. w rozpisce, zmiana nazwy w katalogu, zmiana `foldDescription`.
Za każdym razem: „spoza katalogu" na pracy, która w katalogu siedzi, oraz picker pokazujący ją jako
niewstawioną (wjedzie drugi raz). Że nazwa jest w tej domenie **niestabilnym identyfikatorem**, dowodzi
`catalogue-name-fixes.ts` — 938 ręcznych poprawek nazw.

**Propozycja do przemyślenia — dołożenie, nie zamiana:**

```
kosztorys_items.catalogue_item_id  int NULL  REFERENCES work_catalogue_items ON DELETE SET NULL
```

- zapisywane w `appendCatalogueItems` i przy „Zapisz do katalogu…" (link zwrotny na wiersz źródłowy);
- backfill jednorazowy po `match_key` — ten sam fold co dziś, ale **raz**, w migracji;
- czytelnicy: `FK → jeśli null, fallback na klucz`. Nic nie znika, dochodzi szybki tor.

**Czego id NIE załatwi (i dlatego klucz zostaje):**

1. Większość istniejących wierszy nie będzie miała FK — import arkuszy i ręczne wpisy. A „Porównaj
   z katalogiem" istnieje **głównie dla nich**: jego zadaniem jest odkryć dopasowanie tam, gdzie
   pochodzenia nie ma. `catalogueKey` + hint Dice zostają w komplecie jako fallback.
   **Ruling właściciela (2026-09-17):** stare importy z FK `null` są akceptowalne; chodzi o to, żeby
   **nowe** prace link miały. Zmiana jest forward-only, backfill po kluczu to bonus, nie warunek.
2. UNIQUE na katalogu zostaje — dedup przy zapisie to pytanie o treść.
3. **Cena musi zostać snapshotem.** FK kusi, żeby „ciągnąć cenę z katalogu" — nie wolno, oferta dana
   klientowi nie może się ruszyć, gdy ktoś zmieni cennik. FK służy **porównaniu**, nie odczytowi.

**Pytanie otwarte, do rozstrzygnięcia PRZED migracją:** czy link przeżywa przepisanie opisu na coś
zupełnie innego? Wiersz wstawiony jako „Malowanie ścian" przerobiony na „Demontaż drzwi" zostanie
z FK i raport zacznie porównywać ceny dwóch różnych prac w pełnym zaufaniu. Klucz myli się tu
w bezpieczną stronę („spoza katalogu"), FK w niebezpieczną („rozjazd 400 zł"). Kandydaci: zrywać link
gdy folded opis **i** j.m. odjadą od katalogowych, albo pokazywać obie nazwy w raporcie, gdy się różnią.

**Koszt, którego nie widać z UI:** kolumna przechodzi przez ręczną listę kolumn w `insert-rows.ts:123`,
`snapshot-format.ts`, serializację szablonów i seedy. Plus decyzja, czy FK jedzie do szablonu
(szablon to właśnie zbiór prac z katalogu — pewnie tak) i do snapshotu (snapshot ma odtworzyć stan — tak).

### Wątek 2 — dodanie pracy do katalogu z edytora, bez wchodzenia w katalog

Właściciel (2026-09-17, przy menu „Dodaj" w edytorze v2): „musimy mieć opcję dodania pracy do katalogu
od razu, bez wchodzenia w katalog, kopiowania etc".

**Do doprecyzowania w brainstormingu — dwa czytania, materialnie różne:**

- (a) **„Zapisz do katalogu…" już istnieje**, ale tylko w menu „…" wiersza
  (`grid/menus/kosztorys-row-actions-menu.tsx` → `dialogs/save-item-to-catalogue-dialog.tsx`,
  bramkowane flagą `canSaveItemToCatalogue`). Jeśli o to chodzi, problemem jest **odkrywalność**,
  nie brak funkcji — i odpowiedzią jest wejście z toolbara / lepszy afordans, nie nowy dialog.
- (b) **Nowa praca prosto do katalogu** — utworzenie wpisu cennika, który nie istnieje w tej rozpisce,
  bez nawigacji na `/katalog-prac`. Wtedy to jest nowy dialog (opis / kategoria / j.m. / cena / stawki)
  wołający ścieżkę zapisu katalogu, ewentualnie z opcją „i wstaw od razu do sekcji".

Wątki są sprzężone: jeśli wejdzie FK (wątek 1), obie ścieżki zapisu do katalogu są naturalnym miejscem,
w którym link powstaje — (a) linkuje wiersz źródłowy, (b) linkuje świeżo wstawiony wiersz.
