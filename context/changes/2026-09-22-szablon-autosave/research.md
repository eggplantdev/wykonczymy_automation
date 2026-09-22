---
date: 2026-09-22T08:34:56+02:00
researcher: Claude Opus 5
git_commit: 211993777e17d04e4edab8312b89b46a54e7e489
branch: empty-preset-create
repository: wykonczymy
topic: 'Autozapis szablonu w warsztacie — co trzeba, żeby szablon zapisywał się sam jak kosztorys na inwestycji'
tags: [research, kosztorys, szablony, warsztat, autosave, presets, cache]
status: complete
last_updated: 2026-09-22
last_updated_by: Claude Opus 5
---

# Research: autozapis szablonu w warsztacie

**Date**: 2026-09-22T08:34:56+02:00
**Researcher**: Claude Opus 5
**Git Commit**: `211993777e17d04e4edab8312b89b46a54e7e489`
**Branch**: `empty-preset-create`
**Repository**: wykonczymy

## Research Question

Warsztat szablonu (`/szablony/[id]`) autozapisuje do inwestycji-warsztatu, ale przeniesienie treści
do `kosztorys_presets` wymaga kliknięcia „Zapisz szablon". Co trzeba, żeby szablon zapisywał się
sam, analogicznie jak kosztorys na inwestycji?

Ograniczenie właściciela: **nie rozstrzygamy „czy"** — wersjonowanie istnieje, zapis nie jest
nieodwracalny. Pytanie brzmi „jak".

## Summary

**„Zapisz szablon" nie jest przyciskiem zapisu. Jest przyciskiem publikacji w przebraniu zapisu.**

Każda zmiana w siatce warsztatu **już się zapisuje** — 500 ms debounce, do `kosztorys_items`
inwestycji-warsztatu, dokładnie tym samym kodem co na inwestycji. Przycisk robi coś innego:
serializuje drzewo warsztatu i nadpisuje nim `kosztorys_presets.payload`. Ekran ma więc **trzy
plany trwałości** — stan siatki → drzewo warsztatu → payload szablonu — i słowo „Zapisz" opisuje
tylko trzeci.

Cztery rzeczy, które rozstrzygają kształt zmiany:

1. **Nie ma decyzji, którą byśmy odwracali.** Przeszukane wszystkie dokumenty szablonowe
   w `context/` i cała historia commitów: **zero** miejsc, gdzie ważono autozapis przeciw
   jawnemu przyciskowi dla warsztatu. Przycisk to kształt pierwszej implementacji, nie ruling.
2. **Autozapis zamyka istniejącą dziurę, nie otwiera nowej.** Dziś wyjście z warsztatu bez
   kliknięcia gubi treść szablonu **po cichu** — nie ma `beforeunload`, nie ma strażnika nawigacji,
   nie ma znacznika „niezapisane". To jedyne miejsce w aplikacji, gdzie strażnik jest należny
   i go nie ma.
3. **Częstotliwość jest całym problemem inżynieryjnym.** Jeden mirror to pełny odczyt drzewa
   (~125 KB) + ślepe nadpisanie całego jsonb (~125 KB w górę, ~25 KB świeżego TOAST-u). Wklejenie
   50 komórek to dziś 50 równoległych zapisów bez żadnego zamka i bez tokenu wersji —
   podręcznikowy lost update.
4. **Nie ma klienckiego punktu, przez który przechodzi wszystko.** Jest za to serwerowy:
   `investmentAction`.

Rekomendacja: **mirror po stronie serwera, w `investmentAction`, dławiony znacznikiem czasu
w bazie, plus wymuszony zrzut przed eksmisją warsztatu.** Szczegóły i alternatywy w §Opcje.

## Detailed Findings

### 1. Co się dzieje dzisiaj — trzy plany trwałości

| Plan                                                               | Gdzie        | Kiedy zapisywany                   | Czy użytkownik wie             |
| ------------------------------------------------------------------ | ------------ | ---------------------------------- | ------------------------------ |
| Stan siatki (`useState`)                                           | przeglądarka | natychmiast, optymistycznie        | widzi liczbę                   |
| Drzewo warsztatu (`kosztorys_items` inwestycji `status='szablon'`) | Postgres     | **automatycznie**, 500 ms debounce | nie — sukces jest niemy        |
| `kosztorys_presets.payload`                                        | Postgres     | **tylko po kliknięciu**            | tak — toast „Zapisano szablon" |

`src/components/kosztorys/editor/hooks/use-debounced-save.ts:15` (debounce 500 ms),
`src/lib/actions/kosztorys-presets.ts:198` (`saveWorkshopPresetAction`),
`src/components/kosztorys/editor/toolbar/save-template-button.tsx:12`.

Warsztat to zwykła inwestycja o statusie `szablon` — `src/lib/constants/investment-lock.ts:26`
mówi wprost, że **nie jest zablokowana**, więc każda ścieżka zapisu działa na niej identycznie jak
na inwestycji. Stąd niespójność: połowa ekranu zachowuje się jak inwestycja, bo **jest** inwestycją.

### 2. Nie było decyzji „jawny zapis zamiast autozapisu"

Przeszukane: `context/archive/2026-07-11-kosztorys-preset/`,
`2026-07-28-scalable-preset-section-picker/`, `2026-08-12-ex-560-reload-from-preset/`,
`2026-08-31-work-item-catalog/`, `2026-09-14-szablony-crud/`, `2026-09-22-empty-preset-create/`,
obie bramki review, `lessons.md`, `kosztorys-editor-domain-notes.md`, `roadmap.md`, `git log --all`.

Całe uzasadnienie przycisku to jedno zdanie w commicie `9c63cd23`:

> „Jego obecność daje „Zapisz szablon" nadpisujące otwarty szablon bez pytania o nazwę; „Zapisz
> jako szablon…" zostaje w menu do odbicia kopii."

To zdanie o tym, **który dialog pomijamy**, nie o tym, **kiedy leci zapis**. Późniejszy ruling
(`e93977f3`) dotyczy **adresu** zapisu (po id, nie po nazwie), nie wyzwalacza.

Jedyna zapisana decyzja „jawny zapis, nie autozapis" w repo dotyczy innej powierzchni —
`context/archive/2026-08-15-client-preview-settings/plan-brief.md:36`, ustawienia widoku klienta:
„dialog jest też krokiem 1 udostępniania, przypadkowy ptaszek nie może zmienić tego, co klient już
ma". **Ten argument tu nie przenosi się**: kosztorysy zasiane z szablonu są kopiami zamrożonymi —
`context/archive/2026-07-11-kosztorys-preset/change.md:50` — edycja szablonu nigdy nie rusza
istniejących kosztorysów. Nikt w dole rzeki nie ucierpi na tym, że szablon się zmienia.

### 3. Dzisiejsza siatka bezpieczeństwa (i czym autozapis ją zastępuje)

Ruling o warsztacie, `context/archive/2026-09-14-szablony-crud/change.md:20`:

> „**Jeden warsztat na całą instalację.** Dwie osoby edytujące różne szablony w tej samej chwili
> nadpiszą sobie drzewo. Przy pięciu użytkownikach i ekranie używanym rzadko — akceptowalne;
> snapshot ochronny jest siatką bezpieczeństwa."

Jak ta siatka działa, gdy ktoś otworzy inny szablon na cudzej niezapisanej pracy
(`src/lib/kosztorys/reload-from-preset.ts:10`, `src/lib/db/snapshots.ts:40`):

1. Zmiany pierwszej osoby są w drzewie warsztatu, nie w payloadzie jej szablonu.
2. Otwarcie drugiego szablonu robi **wymuszony punkt `manual`** z etykietą „Przed wczytaniem: B",
   ostemplowany `template_preset_id = A` (wskaźnik przesuwa się dopiero po zrzucie).
3. Drzewo warsztatu zostaje zmiecione i zastąpione.
4. Praca jest odzyskiwalna: otwórz A → „Wersje" → przywróć.

Siatka jest realna, ale słaba w trzech miejscach: punkt jest **nazwany po szablonie, który
eksmitował** (pod A szukasz wpisu nazwanego po B); **nikt nikogo nie informuje**, że tak się stało
— `OpenWorkshopPrompt` mówi tylko „w warsztacie leży inny szablon"; a kasacja szablonu A zeruje
stempel przez `ON DELETE SET NULL`.

**Autozapis usuwa potrzebę kroku 4** — payload byłby już aktualny, zanim B przyjdzie. Na osi
nazwanej w rulingu („nadpiszą sobie drzewo") autozapis jest **ściśle lepszy**: skraca okno straty
z „od ostatniego kliknięcia" do sekund. Ruling niczego tu nie blokuje; jego własne zastrzeżenie
(„per-szablon warsztaty to osobna funkcja") dotyczy czego innego.

**Jedna asymetria do domknięcia przy okazji:** `change.md:19` uzasadnia uprawnienia tym, że
„nadpisanie zostawia snapshot ochronny". To prawda o `openPresetInWorkshopAction`, **nie**
o `saveWorkshopPresetAction` — ten drugi to gołe `UPDATE … SET payload`, bez żadnego zrzutu.
Jeśli ten zapis ma lecieć automatycznie, brakujący zrzut po stronie **zapisu** jest luką wartą
zamknięcia (patrz §Otwarte pytania).

### 4. Gdzie może stanąć punkt przechwytu

Pełna mapa ścieżek zapisu w drzewo (agent zmapował je co do jednej):

| Rodzina                                                                                                                   | Ile ścieżek | Czy przechodzi przez debounce klienta |
| ------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------- |
| Komórki pozycji, komórki etapów, wiersze nagłówka/stopki sekcji, etykieta/plane/pracownik etapu                           | 4           | **tak** — `use-debounced-save.ts:36`  |
| Dodaj/wstaw/usuń pozycję, ▲▼, „Zapisz kolejność", undo/redo                                                               | 7           | nie                                   |
| Dodaj/wstaw/usuń/przemianuj/przesuń sekcję, kolor                                                                         | 6           | częściowo                             |
| Etapy: dodaj / usuń / zmień                                                                                               | 3           | nie                                   |
| Ustawienia: współczynniki, VAT, tryb, stawka materiałów, rabat globalny, **rabat % na wszystko**                          | 6           | nie                                   |
| Wymiana całego drzewa: wyczyść, wczytaj szablon, import z arkusza, przywróć wersję, otwórz w warsztacie                   | 5           | nie                                   |
| Hurtowe: „Popraw literówki", sekcje z szablonu, pozycje z katalogu, hurtowe zastąpienie z katalogu, porównanie z arkuszem | 5           | nie                                   |

Wnioski:

- **Kliencki `dispatch`** (`use-debounced-save.ts:36`) łapie ~4 z ~36 ścieżek. Za mało.
- **`onTreeReplaced`** (`kosztorys-editor-v2.tsx:42`) już istnieje i łapie całą rodzinę wymiany
  drzewa — to gotowy sygnał „całe drzewo się zmieniło", ale tylko dla niej.
- **`investmentAction`** (`src/lib/actions/investment-action.ts:27`) to **jedyny punkt, przez który
  przechodzi każdy zapis w drzewo**. Jego własna dokumentacja mówi „the action layer is the only
  chokepoint". Wyjątki: dwie akcje presetowe na `protectedAction`
  (`openPresetInWorkshopAction`, `saveWorkshopPresetAction`) — pierwsza to ścieżka ładowania,
  która **nie może** wywołać mirrora, więc wyjątek jest tu pożądany.
- **Licznik `revision`** (bramka auto-snapshotu) jest **ślepy** na etapy, dodawanie pozycji,
  ustawienia, hurtowe zastąpienie i porównanie z arkuszem. Skopiowanie bramki auto-snapshotu
  żywcem da szablon, który po „Dodaj etap" nigdy się nie zapisze. To pułapka nr 1.

### 5. Koszt jednego mirrora — zmierzony

`serializeKosztorysAsPreset` (`src/lib/kosztorys/serialize-preset.ts:10`) to **jeden round trip**,
nigdy cache'owany, cztery `json_agg` w jednym zapytaniu (`src/lib/db/kosztorys-tree.ts:56`).
Zmierzone na lokalnej bazie, inwestycja 106 (379 pozycji): **6,5 ms wykonania**, ale repo samo
notuje, że koszt to round trip do Neona — **20–60 ms ciepły, 160–200 ms zimny**.

Zapis: `updatePresetPayload` (`src/lib/db/presets.ts:77`) wiąże `JSON.stringify(payload)::jsonb`
— **cały dokument za każdym razem**, brak ścieżki `jsonb_set`.

Zmierzone rozmiary (lokalna baza, `kosztorys_snapshots` jako próbka tego samego kształtu jsonb):
**~310–325 B tekstu JSON na pozycję**, **~58–65 B po kompresji TOAST**. Największe lokalne
drzewo (379 pozycji) to **124 530 B tekstu**.

**Jeden mirror 379-pozycyjnego szablonu: ~125 KB w dół + ~125 KB w górę + ~25 KB świeżego łańcucha
TOAST i jedna martwa krotka.** ≈ 250 KB ruchu do Neona. Kolumna `payload` ma `attstorage = 'x'`
(EXTENDED), więc HOT update jest niemożliwy — każdy zapis to nowy łańcuch TOAST.

Skala przy złym wyzwalaczu: `investment-action.ts:52` notuje, że edytor „fans a write out per
changed cell, so a paste across fifty cells" — **wklejka w 50 komórek = 50 równoległych mirrorów
= ~12,5 MB ruchu na jedno Ctrl-V**.

Dla porównania, istniejący precedens częstotliwości: auto-snapshot robi zrzut całego drzewa
**co 10 minut**, bramkowany licznikiem edycji (`use-auto-snapshot.ts:9`) — czyli **≤ 6 zapisów
całego drzewa na godzinę**. Mirror per-klawisz byłby 100–1000× tego.

### 6. Cache — tu jest najostrzejsza pułapka

Jeden tag na wszystko: `CACHE_TAGS.presets` (`src/lib/cache/tags.ts:15`), a pod nim dwa wpisy:
`getPresets` (tania metadana) i **`getPresetSections`** — `CROSS JOIN LATERAL
jsonb_array_elements` po payloadach **wszystkich** szablonów, czyli dekompresja całej biblioteki
(`src/lib/db/presets.ts:122`).

Dziś `saveWorkshopPresetAction` przekazuje `['presets']` bez `deferRefresh`
(`kosztorys-presets.ts:224`), czyli idzie gałęzią `updateTag`. Reguła z `tags.ts:68`:

> „`EXPIRE_NOW` inside an action is observationally identical to `updateTag` — **including the
> 90–193 ms per debounced save that EX-597 removed from the editor's autosaves.**"

Co to znaczy dla mirrora per-klawisz: trasa wywołująca to `/szablony/[id]`, a jej render czyta
`getWorkshopView` + **cały kosztorys warsztatu jeszcze raz** + `getWorkCatalogue()` + (równolegle,
w slocie okruszka) `getPresets()`, który ta sama akcja właśnie unieważniła — czyli gwarantowane
twarde pudło. **Trzy odczyty wielkości drzewa tam, gdzie EX-597 zbił licznik do jednego.**

Konkluzja: mirror **nie może** strzelać `updateTag('presets')` z tej trasy. `deferRefresh: true`
(→ `EXPIRE_NEXT`) usuwa wymuszony re-render, zostawiając unieważnienie. Zero tagów też jest złe —
dodanie sekcji w warsztacie naprawdę zmienia to, co ma pokazać picker.

### 7. Współbieżność — dziś nic nie chroni payloadu

Dziś to nie ma znaczenia, bo pisze jeden przycisk pod `useTransition`. Przy automacie:

- Lane'y (`src/lib/kosztorys/save-lanes.ts:16`) serializują **wyłącznie per komórka**. Dwie różne
  komórki lecą równolegle z założenia. Mirror podpięty pod autozapis dziedziczy to: N komórek
  w serii = N nieuporządkowanych mirrorów **całego** dokumentu.
- `serializeKosztorysAsPreset` czyta **bez `req`**, czyli na własnym połączeniu, a
  `updatePresetPayload` leci osobnym stwierdzeniem. **Odczyt w T1, zapis w T2, nic ich nie łączy.**
- `updatePresetPayload` nie ma żadnego predykatu wersji — ślepe last-writer-wins na całym
  dokumencie. Mirror, który przeczytał drzewo przed twoją edycją, a commituje po niej, **cofa ją
  w szablonie**, podczas gdy warsztat nadal ją pokazuje. Nic tego nie wykryje.
- Zamek, który jest odpowiedzią repo na dokładnie tę klasę wyścigu — `lockInvestmentForReplace`
  (`src/lib/db/lock-investment-for-replace.ts:16`) — jest brany **tylko** przez `replaceTreeWithSnapshot`.
  Ścieżka mirrora go nie woła.
- Wyścig międzyścieżkowy: `openPresetInWorkshopAction` zamienia drzewo, a **potem** przesuwa
  wskaźnik. Mirror w locie przez tę granicę przeczyta drzewo **nowego** szablonu i wstemplluje je
  w wiersz **starego**. Strażnik wskaźnika w `saveWorkshopPresetAction:206` jest obroną, ale jego
  odczyt i zapis to dwa niezamknięte stwierdzenia.

### 8. Dwa długi, które autozapis zamienia z jednorazowych w ciągłe

**(a) Serializacja szablonu jest stratna — i warsztat o tym nie mówi.**
`serialize-preset.ts:14` zeruje w każdej pozycji `plannedQty`, `sheetMeasuredQty`, `discountType`,
`discountValue`, `note`, a całe `stages` i `progress` wyrzuca. Tymczasem menu „Dodaj" w warsztacie
oferuje **„Etap — …"** i pełną siatkę (`menus/kosztorys-add-menu.tsx:88`). Czyli warsztat pozwala
wpisać przedmiar, rabaty, notatki i etapy, które zapis szablonu po cichu wyrzuca. Dziś strata
następuje w jednym świadomym kliknięciu; automatycznie — warsztat i „jego" szablon rozjeżdżają się
w sposób ciągły i niewidoczny, a rozjazd materializuje się dopiero przy następnym „Otwórz".

**(b) `created_by` jest nadpisywane przy każdym zapisie** (`presets.ts:79,85`), a tabela **nie ma
`updated_at`** — lista sortuje po `created_at` (`presets.ts:181`) i pokazuje kolumnę „Utworzono".
Per-autozapis „kto założył szablon" cicho zmienia się w „kto ostatnio stuknął w klawisz", a lista
nigdy nie drgnie, choć szablon zmieniał się tysiąc razy.

### 9. Powierzchnia UI i testów

**Sukces autozapisu jest dziś niemy w całym edytorze.** Lane obsługuje wyłącznie błąd (czerwony
toast + rollback); gałąź sukcesu wypada z funkcji. Nie ma wskaźnika, nie ma `dirty`, nie ma
`lastSavedAt`, nie ma `beforeunload` (zero wystąpień w `src/` i `e2e/`). **Szablon ma dziś jedyne
w całym edytorze potwierdzenie zapisu** — toast „Zapisano szablon" i etykietę „Zapisuję…".
Usunięcie przycisku usuwa jedyne miejsce, gdzie edytor w ogóle mówi, że coś zapisał. To jest
koszt UX tej zmiany i wymaga osobnej decyzji (§Otwarte pytania).

**Testy, które trzeba przepisać** (żaden nie renderuje przycisku ani nie asertuje napisu — całe
zachowanie jest przypięte na poziomie akcji i bazy):

- `src/__tests__/lib/actions/kosztorys-presets.test.ts:333` — `saveWorkshopPresetAction — pointer
guard (DB)`, w tym `:407` („pisze treść warsztatu do szablonu, który faktycznie trzyma") i `:417`
  („odmawia i nie pisze nic, gdy warsztat trzyma inny szablon").
- `src/__tests__/lib/db/presets.test.ts:192` i `:207` — nadpisanie w miejscu po id oraz „nie
  wskrzesza szablonu skasowanego w trakcie". **Ten drugi robi się ostrzejszy, nie zbędny.**
- `src/__tests__/lib/db/snapshots.test.ts:180` — zakres punktów przywracania per szablon.
- `src/__tests__/lib/db/workshop-investment.test.ts:70`, `src/__tests__/helpers/workshop.ts:13`.

**E2E nie dotyka warsztatu** — `e2e/kosztorys-presets.spec.ts:129` testuje „Zapisz jako szablon…"
(inny dialog, adresowanie po nazwie), `:194` testuje „Wczytaj szablon…" i jest **jedyną
automatyczną asercją na etykietę punktu przywracania**.

**Manual checks do przepisania:** `context/foundation/manual-checks.md:554` (otwarty, z
`empty-preset-create`) oraz cztery wpisy w `context/archive/manual-checks/2026-09-15-pelny-rejestr.md`
(`:4878`, `:5408`, `:5427`, `:5438`).

### 10. Precedensy w repo na „automatyczne lustro pochodnego artefaktu"

- **`src/hooks/transfers/sync-sheet.ts:10` — najbliższy analog.** Każda mutacja transakcji jest
  wypychana do arkusza właściciela z **warstwy kolekcji**, „so EVERY mutation path is covered",
  odroczona przez `after()`, z jawną furtką `context.skipSheetSync` dla ścieżek hurtowych. Trzy
  ruchy do skopiowania: **hakuj warstwę trwałości, nie UI**; **odrocz**, żeby użytkownik nie płacił
  latencji; **daj furtkę**, żeby ładowanie szablonu nie wywołało mirrora zwrotnego.
- **`src/lib/actions/sheets-sync.ts:156/239`** — ten sam podsystem ma też ścieżkę ręczną
  z podglądem i potwierdzeniem, i **przelicza zbiór na nowo po stronie serwera**, nie ufając
  podglądowi. Stanowisko repo: przyrostowe delty lustrzą się same, hurtowe uzgodnienie pyta.
- **`use-auto-snapshot.ts:6`** — interwał + bramka „czy coś się zmieniło", fire-and-forget,
  retencja w dole rzeki. Najtańszy szkielet, ale jego bramka jest niepełna (§4).

## Opcje

### Opcja A — mirror serwerowy w `investmentAction`, dławiony znacznikiem w bazie _(rekomendacja)_

Po udanym handlerze w `investmentAction` sprawdź, czy inwestycja jest warsztatem trzymającym
szablon, i czy od ostatniego mirrora minęło więcej niż N sekund. Jeśli tak — jeden mirror
w transakcji.

- **Kompletność:** łapie wszystkie ~36 ścieżek, bo to jedyny wspólny punkt. Żaden gest nie może
  jej ominąć.
- **Dławienie bez timera:** serverless nie utrzyma timera między requestami, więc dławikiem jest
  nowa kolumna `mirrored_at` — „mirror tylko, jeśli ostatni był starszy niż N s". Wklejka w 50
  komórek daje **jeden** mirror, nie 50.
- **Koszt sprawdzenia:** zero dodatkowych round tripów — `investmentAction` już robi SELECT po
  statusie (`isInvestmentLocked`), wystarczy dołożyć do niego `template_preset_id`.
- **Współbieżność:** serializacja i UPDATE w jednej transakcji z `lockInvestmentForReplace`, czyli
  wzorzec, który repo już stosuje dla wymiany drzewa. Przy dławiku kontencja jest znikoma.
- **Cache:** `deferRefresh: true`, nigdy `updateTag` z tej trasy.
- **Eksmisja:** wymuszony zrzut **przed** zmieceniem drzewa w `openPresetInWorkshopAction` —
  to domyka okno „ostatnie N sekund pracy" i jest jedynym miejscem, gdzie mirror musi być
  natychmiastowy.
- **Kasacja szablonu:** wskaźnik zerowany przez `ON DELETE SET NULL`, więc mirror po prostu
  przestaje strzelać. Brak pętli błędów, którą dałby wariant kliencki.

### Opcja B — „szablon trzymany w warsztacie czyta się na żywo"

Zamiast lustrzyć, **usuń drugi plan dla trzymanego szablonu**: `getPreset` / `listPresetSections`
dla szablonu, którego id równa się `template_preset_id` warsztatu, serializują drzewo na żywo
zamiast czytać `payload`. Payload zrzucany raz, przy eksmisji.

- **Zaleta:** nieaktualność znika **z definicji**, nie przez częstotliwość. Jeden zapis na
  eksmisję zamiast tysięcy.
- **Koszt:** `listPresetSections` to dziś jedno zapytanie po całej bibliotece; mieszanie dwóch
  planów rozbija je na „wszystkie oprócz jednego" + osobny odczyt drzewa. Cache trzymanego
  szablonu musi wisieć na `KOSZTORYS_TREE_TAGS`, nie na `presets`.
- **Ryzyko:** awaria przed eksmisją zostawia payload stary — potrzebny okresowy zrzut jako
  zabezpieczenie, czyli i tak kawałek opcji A.

### Opcja C — kliencki timer, wzorem auto-snapshotu

Interwał krótszy niż 10 minut, bramkowany „czy coś się zmieniło", plus zrzut przy odmontowaniu.

- **Zaleta:** najmniej kodu, wzorzec już istnieje.
- **Wada, która to przekreśla:** bramką jest licznik `revision`, **ślepy** na etapy, dodawanie
  pozycji, ustawienia i hurtowe zastąpienie. Trzeba by najpierw poszerzyć to, co go bije — czyli
  dotknąć tych samych ~20 miejsc, których opcja A nie musi dotykać. Dodatkowo zamknięcie karty
  w złym momencie gubi ostatnie okno, a martwa karta trzymająca stary wskaźnik nadpisuje
  bibliotekę swoim nieświeżym drzewem.

## Code References

- `src/components/kosztorys/editor/toolbar/save-template-button.tsx:12` — cały dzisiejszy „zapis"
- `src/lib/actions/kosztorys-presets.ts:198` — `saveWorkshopPresetAction` + strażnik wskaźnika `:206`
- `src/lib/actions/kosztorys-presets.ts:173` — `openPresetInWorkshopAction`, miejsce na zrzut przed eksmisją
- `src/lib/actions/investment-action.ts:27` — jedyny wspólny punkt przechwytu
- `src/lib/kosztorys/serialize-preset.ts:14` — stratna serializacja (przedmiar, rabat, notatka, etapy)
- `src/lib/db/presets.ts:77` — `updatePresetPayload`, ślepe nadpisanie całego jsonb, nadpisuje `created_by`
- `src/lib/db/kosztorys-tree.ts:56` — zapytanie, które każdy mirror wykonuje
- `src/lib/db/lock-investment-for-replace.ts:16` — zamek, którego ścieżka mirrora dziś nie bierze
- `src/lib/cache/tags.ts:68` — reguła EX-597 o `updateTag` w akcji
- `src/lib/db/presets.ts:122` — `listPresetSections`, ekspansja jsonb po całej bibliotece
- `src/components/kosztorys/editor/hooks/use-debounced-save.ts:36` — kliencki lejek (niepełny)
- `src/components/kosztorys/editor/hooks/use-auto-snapshot.ts:9` — precedens częstotliwości: 10 min
- `src/components/kosztorys/editor/kosztorys-editor-v2.tsx:42` — `onTreeReplaced`, gotowy sygnał dla wymiany drzewa
- `src/hooks/transfers/sync-sheet.ts:10` — precedens lustra na warstwie trwałości
- `src/lib/constants/investment-lock.ts:26` — warsztat celowo niezablokowany

## Architecture Insights

- **Warsztat jest inwestycją, więc połowa spójności przyszła za darmo — i dlatego druga połowa
  kłuje.** Użytkownik dostaje ekran, który w 90% zachowuje się jak inwestycja, a w jednym miejscu
  żąda kliknięcia. To nie jest różnica funkcji, tylko przeciek implementacji.
- **Repo ma już odpowiedź na „kiedy wypchnąć kopię" i brzmi ona: na warstwie trwałości, odroczone,
  z furtką.** `sync-sheet.ts` rozwiązał ten sam problem dla arkusza właściciela.
- **Wzorzec „pojedynczy punkt przechwytu" jest w tym repo świadomy** — `investmentAction` sam
  deklaruje się jako jedyny chokepoint i to on dźwiga zamek na zakończonej inwestycji. Dołożenie
  do niego mirrora jest zgodne z ziarnem kodu, a nie wbrew niemu.
- **Licznik `revision` udaje sygnał „brudne", a nim nie jest.** Trzy funkcje już na nim wiszą
  (przyciski undo/redo, bramka auto-snapshotu), a on nie widzi jednej trzeciej mutacji. Każda
  czwarta funkcja oparta na nim odziedziczy tę dziurę.

## Historical Context (from prior changes)

- `context/archive/2026-09-14-szablony-crud/change.md:18-20` — trzy rulingi: źródło prawdy
  w `kosztorys_presets`, jeden warsztat na instalację, asymetria uprawnień oparta na snapshocie
  ochronnym.
- `context/archive/2026-08-12-ex-560-reload-from-preset/change.md:35` — punkt przywracania nazwany
  po szablonie, celowo bez limitu.
- `context/archive/2026-07-11-kosztorys-preset/change.md:50` — edycja szablonu **nigdy** nie rusza
  kosztorysów już z niego zasianych. To zdanie znosi jedyny argument, który mógłby bronić jawnego
  zapisu.
- `context/archive/2026-08-15-client-preview-settings/plan-brief.md:36` — jedyna zapisana decyzja
  „jawny zapis, nie autozapis" w repo; dotyczy innej powierzchni i nie przenosi się tutaj.
- `context/archive/2026-09-02-snapshot-retention-thinning/change.md` — pomiary rozmiaru payloadu,
  zgodne z tym, co zmierzono na nowo.
- `context/foundation/lessons.md:172` — wyścig cofnięcia z autozapisem; źródło lane'ów.
- `context/foundation/lessons.md:1762` — „liczba na ekranie to nie zapis". Pod autozapisem
  szablonu planów będą **trzy**, więc weryfikacja musi czytać trzeci przez przeładowanie.

## Open Questions

1. **Czy „Zapisz szablon" znika bez śladu, czy zamienia się w status?** Dziś to jedyne miejsce
   w edytorze, gdzie cokolwiek potwierdza zapis. Opcje: nic (pełna spójność z inwestycją, ale
   tracimy jedyne potwierdzenie), pasywny status „Zapisano 10:42" tylko w warsztacie, albo status
   na obu ekranach (najbardziej spójne, ale to już zmiana edytora inwestycji).
2. **Czy mirror ma zostawiać punkt przywracania?** Ruling o uprawnieniach opiera się na tym, że
   „nadpisanie zostawia snapshot ochronny" — a `saveWorkshopPresetAction` nie zostawia żadnego.
   Przy automacie zrzut per-mirror jest nie do utrzymania; zrzut przy eksmisji + istniejące
   auto-snapshoty to prawdopodobnie właściwy zakres, ale to decyzja właściciela.
3. **Co z tym, że warsztat pozwala wpisać przedmiar, rabaty, notatki i etapy, które szablon
   wyrzuca?** Albo ukryć te kolumny/menu w warsztacie, albo przestać je wycinać przy serializacji.
   Pod autozapisem rozjazd staje się ciągły, więc to pytanie przestaje być kosmetyczne.
4. **Jaki dławik?** Ile sekund między mirrorami to „sam się zapisuje" w odczuciu użytkownika,
   a jednocześnie nie jest 50 zapisami na wklejkę.
5. **Czy dokładamy `updated_at` / „Zmieniono" na liście szablonów?** Bez tego lista nigdy nie
   pokaże, że szablon żyje. Przy okazji: `created_by` powinno przestać być nadpisywane.
6. **Czy „Zapisz jako szablon…" w menu Opcje wymaga przemianowania?** Po zniknięciu przycisku
   zostaje jedyną pozycją ze słowem „Zapisz" na ekranie, który zapisuje się w sposób ciągły —
   będzie się czytać jak przycisk zapisu.
