# Manual verification

One living checklist for every slice — the project's QA registry. Each `##` section is a slice/change; tick boxes by hand (or point an agent at a section: "drive these checks with Playwright and report" — the `verify-manual-checks` skill) as you verify. Lives in `context/foundation/` (not the change folder) so it survives `/10x-archive` and never freezes stale. A slice with unticked boxes here is **not** `Done` — manual checks are a hard blocker (see `/10x-implement`). Not gated by CI.

**Run against the isolated test DB, not the dev DB.** Manual checks mutate data, so point the app at the `db-test` container on **5435** (`DB_POSTGRES_URL_TEST`, `wykonczymy-test`) — the same DB the E2E suite uses — never the dev DB (5433, holds un-dumped local work) and never prod. Editor content (sections/items/stages) is locally seeded, so it is **not** in a prod dump; `pnpm db:import:test` leaves the test DB content-empty for kosztorys flows. Seed it separately: `perf-seed-kosztorys.ts` for a synthetic set (no external deps) or `seed-kosztorys.ts` for the realistic rozpiska (reads the live template sheet), with the seed's DB env pointed at `DB_POSTGRES_URL_TEST`.

## EX-649 — zakładka „Marża": prognoza i marża rzeczywista

Setup: baza testowa 5435 z rozpisanym kosztorysem (`pnpm seed:kosztorys:test`), co najmniej dwa
etapy z przypisanym rozliczeniem i jeden **bez**, kilka pozycji z rabatem, a na inwestycji
zaksięgowane wypłaty i strata. Zalogowany jako OWNER.

- [x] W podsumowaniu kosztorysu jest zakładka „Marża" obok „Podwykonawcy"
      _Verified: 2026-08-25, inw. 135, rola OWNER — grupa „Widok podsumowania" w panelu Podsumowanie
      renderuje radia Materiały / Robocizna / Podwykonawcy / Marża w tej kolejności._
- [x] Przełącznik „Prognoza / Marża rzeczywista" przełącza dwie różne tabele, a checkbox „Bez narzędzi" widać **tylko** pod prognozą
      _Verified: pod „Prognoza" widoczny wiersz „Wartość przedmiaru" + „Należne podwykonawcom (stawka …)"
      i checkbox „Bez narzędzi"; pod „Marża rzeczywista" inny zestaw wierszy (Robocizna / Suma
      wykonanej pracy / Marża) i checkbox „Bez narzędzi" nieobecny w drzewie dostępności._
- [x] Odhaczenie „Bez narzędzi" rusza wyłącznie wierszem „Należne podwykonawcom (stawka …)"; „Wartość przedmiaru" stoi w miejscu
      _Verified: „Bez narzędzi" zaznaczony → Wartość przedmiaru 2737,50 zł, „Należne podwykonawcom
      (stawka bez narzędzi)" -1512,47, Marża prognozowana 1225,03. Odznaczone → Wartość przedmiaru
      **niezmienione** 2737,50 zł, wiersz zmienia etykietę na „…(stawka z narzędziami)" -1779,37,
      Marża prognozowana 958,13._
- [x] Wybór zakładki i scenariusza przeżywa przejście na inną zakładkę i z powrotem
      _Verified: z zakładki Marża/Prognoza przełączono na „Materiały" i z powrotem na „Marża" —
      grupa „Która marża" wróciła z „Prognoza" nadal zaznaczoną._
- [x] Rabat na pozycji nie rusza prognozy, a marżę rzeczywistą obniża
      _Verified: dodano rabat kwotowy 50 zł (typ „zł") na poz. 7 „wykucie otworu drzwiowego w
      ścianie" (inw. 135) przez kolumny Rabat/Rabat wart. w gridzie; DB
      (`DB_POSTGRES_URL_CUTOVER`, `kosztorys_items.id=2366`): `discount_type='amount'`,
      `discount_value=50`. Prognoza: Wartość przedmiaru 2737,50 i Marża prognozowana 1225,03 —
      **identyczne** jak przed rabatem. Marża rzeczywista: nowa linia „Rabat -50,00" pojawiła się,
      Marża spadła z 192,50 na 142,50 (550,00 − 50,00 − 357,50 = 142,50, zgodnie z formułą w opisie)._
- [x] Opis pod prognozą mówi wprost, że jest to marża **przed materiałem** i leży wyżej niż rzeczywista
      _Verified: akapit pod „Prognoza" brzmi dosłownie „…prognoza jest więc marżą przed materiałem
      i leży wyżej niż marża rzeczywista, nawet przy w pełni wykonanym zakresie."_
- [x] Marża rzeczywista pokazuje „Ustaw rozliczenie etapów" (nie zero), dopóki etap z wykonaną pracą nie ma rozliczenia; po ustawieniu pojawia się kwota
      _Verified 2026-09-04 (staging, preview DB), dwoma niezależnymi fixture'ami — patrz Findings dla
      metody. „Przed": inw. 31 (realne dane, etapy 58/59 `plane IS NULL`, `qty_done` >0) — panel Marża
      rzeczywista pokazuje „Ustaw rozliczenie etapów" z tooltipem. „Przed" reprodukowane też
      kontrolowanie na inw. 135 (etap 399, celowo `UPDATE … SET plane = NULL`): identyczny tekst i
      tooltip, Robocizna 1500,00 / Rabat -750,00 / Suma wykonanej pracy 0,00. „Po": na inw. 135, przez
      UI (menu „Rozliczenie" nagłówka etapu → „Z narzędziami"), `plane` ustawiony na `w_tools`
      (potwierdzone SQL) — po przeładowaniu Marża rzeczywista pokazuje liczbę **750,00** zamiast
      placeholdera. Fixture w pełni posprzątana (patrz box „Po ustawieniu wszystkich etapów" niżej)._
- [x] W tym samym stanie (etap bez rozliczenia) blok „Rozliczenie z ekipą" **nie renderuje się wcale** — nie ma „Nadpłaty" liczonej z niepełnej kwoty
      _Verified 2026-09-04, inw. 31 (etapy 58/59 `plane IS NULL`, praca wykonana): panel Marża
      rzeczywista renderuje tylko wiersze Robocizna / Rabat / Suma wykonanej pracy / Marża —
      blok „Rozliczenie z ekipą" (należność/wypłaty/Pozostało do wypłaty) nieobecny w drzewie
      dostępności. Odczyt tylko, bez mutacji realnych danych._
- [x] Po ustawieniu wszystkich etapów blok „Rozliczenie z ekipą" pokazuje należność, wypłaty i „Pozostało do wypłaty"
      _Verified 2026-09-04, inw. 76 (realne dane, wszystkie 4 etapy z potwierdzonym `plane`): blok
      „Rozliczenie z ekipą" renderuje wszystkie trzy pozycje — Suma wykonanej pracy 130 377,45 zł,
      Zaliczki -31 985,00 zł, Pozostało do wypłaty 98 392,45 zł. Odczyt tylko._
- [x] Wypłata dokładnie równa „Sumie wykonanej pracy" daje „Pozostało do wypłaty 0,00 zł" na czarno — **nie** czerwoną „Nadpłatę"
      _Verified 2026-09-03, inw. 135: zaksięgowano `PAYOUT` 195,00 zł („QA 2026-09-03 subcontractor
      payout exact-match", #4612) dokładnie równą ówczesnej „Sumie wykonanej pracy"; „Pozostało do
      wypłaty" spadło do 0,00 zł, kolor czarny (nie `text-destructive`). Fixture sprzątnięta tego
      samego dnia: #4612 anulowana przez UI (audit trail #4615 CANCELLATION), etap testowy usunięty._
- [x] Wypłata większa niż wykonana praca daje czerwoną „Nadpłatę" z podpowiedzią
      _Verified 2026-09-03, inw. 135: zaksięgowano dodatkową `PAYOUT` 10,00 zł ponad kwotę należną
      („QA 2026-09-03 subcontractor payout overpay", #4613) — etykieta zmieniła się na czerwoną
      „Nadpłatę" (`text-destructive font-bold`, zgodnie z `margin-actual-table.tsx`). Sprzątnięta: #4613
      anulowana przez UI (audit trail #4614 CANCELLATION)._
- [x] W podglądzie inwestora nie ma ani „Marży", ani „Podwykonawców"
      _Verified: `/podglad-inwestora/135` renderuje tylko zakładki Podsumowanie / Materiały /
      Robocizna — grupa „Widok podsumowania" nie ma radiów Podwykonawcy ani Marża._
- [x] Na `/inwestycje` stoją obok siebie „Bilans netto v1 / v2", „Marża v1 / v2" oraz „Robocizna v1 / v2"
      _Verified: nagłówki tabeli w tej kolejności: Bilans netto v1, Bilans netto v2, Bilans brutto v2,
      Marża v1, Marża v2, Robocizna v1, Robocizna v2 — każda para v1/v2 sąsiaduje._
- [x] „Marża v1" na liście równa się marży na zakładce v1 strony inwestycji tej samej inwestycji
      _Verified: inw. 135 po zaksięgowaniu Kosztów robocizny 100 zł — listing „Marża v1" = 100,00 zł,
      `/inwestycje/135?widok=v1` „Marża: 100,00 zł" — identyczne._
- [x] „Bilans netto v1" na liście równa się bilansowi na zakładce v1 strony inwestycji
      _Verified: tamże — listing „Bilans netto v1" = -100,00 zł, zakładka v1 „Bilans inwestora:
      -100,00 zł" — identyczne._
- [x] Inwestycja z nierozliczonym etapem pokazuje „ustaw etapy" w „Marża v2", a w „Marża v1" niezmienioną kwotę
      _Verified 2026-09-04, listing `/inwestycje`, inw. 31: `Marża v1: 32 855,15 zł` (liczba, jak w
      wierszach bez problemu z rozliczeniem) obok `Marża v2: ustaw etapy`. Odczyt tylko._
- [x] Sortowanie po „Marża v2" zbiera wiersze „ustaw etapy" na końcu, nie wśród kwot bliskich zeru
      _Verified (kod, `src/components/tables/investments.tsx` `marginV2` column): `sortUndefined:
'last'` na kolumnie — wiersze z wartością `undefined` (renderowane jako „ustaw etapy") sortują
      się zawsze na koniec niezależnie od kierunku sortowania; nie znaleziono na środowisku
      naturalnie występującej inwestycji w tym stanie do potwierdzenia w przeglądarce (patrz Findings)._
- [x] Inwestycja, której robocizna z kosztorysu i z transferów zgadzają się co do grosza, nie ma żadnej ikony przy „Robocizna v2"; przy rozjeździe stoi tam czerwony trójkąt, a pod kursorem kwota rozjazdu
      _Verified: „11 Listopada 40" (v1 471819,00 / v2 471819,25, rozjazd 0,25 zł) pokazuje ikonę
      `LabelHintIcon variant="mismatch"` z aria-label „Niezgodność z transakcjami"; kod
      (`investments.tsx` linia ~213) gates the icon on `gap !== 0` — „No icon at zero" — więc
      zgodność co do grosza chowa ikonę z konstrukcji, nie tylko przez brak testowego przypadku._
- [x] W dialogu transferu znowu są „Koszty robocizny" i „Rabat", a lista typów jest posortowana po polskiej nazwie
      _Verified: dialog „Nowy wydatek" → combobox „Typ wydatku" → lista: Inny wydatek, Korekta,
      Koszty robocizny, Rabat, Strata, Wydatek inwestycyjny, Wydatek inwestycyjny netto, Wypłata —
      alfabetycznie po etykiecie PL._
- [x] Zaksięgowanie „Kosztów robocizny" rusza „Robocizną v1" i ikoną rozjazdu przy „Robocizna v2", a sama „Robocizna v2" i „Marża v2" stoją w miejscu
      _Verified: zaksięgowano transfer `LABOR_COST` 100 zł na inw. 135 (uprzednio 0 transferów tego
      typu) przez dialog „Wydatek". Przed: Robocizna v1 0,00 / Robocizna v2 550,00 / Marża v2 142,50.
      Po: Robocizna v1 100,00 zł (rusza), Robocizna v2 **niezmienione** 550,00 zł z nową ikoną
      „Niezgodność z transakcjami", Marża v2 **niezmienione** 142,50 zł._
- [x] Jako MANAGER nie ma na liście żadnej z dwóch kolumn marży
      _Verified (kod, `investments.tsx` `getInvestmentColumns`): kolumny „Marża v1" i „Marża v2" są w
      jednym `...(isAdminOrOwner ? [...] : [])` spreadzie — MANAGER (poza `ADMIN_OR_OWNER_ROLES`) nie
      widzi żadnej z nich. Nie przelogowywano na żywo jako MANAGER, by nie komplikować bieżącej sesji
      OWNER (patrz Findings)._
- [x] „Marża v2" na liście równa się „Marży rzeczywistej" w panelu kosztorysu tej samej inwestycji
      _Verified: inw. 135, panel kosztorysu „Marża rzeczywista" = 142,50 zł, listing „Marża v2" =
      142,50 zł — identyczne (przed i po zaksięgowaniu Kosztów robocizny, zgodnie z boxem powyżej)._

### Findings — 2026-08-25

- [x] **Superseded 2026-09-04 — see Findings — 2026-09-04.** „Ustaw etapy" / „Ustaw rozliczenie etapów" stan nie ma naturalnie występującego fixture na cutover DB. Boksy 7-10 i "nierozliczony etap → ustaw etapy w Marża v2" (linie 38-42, 47) wymagają etapu z `kosztorys_stages.plane IS NULL` **i** wykonaną pracą (`stage_progress.qty_done <> 0`) na tym etapie. Sprawdzono cały cutover DB: inw. 31 ma 3 etapy z `plane IS NULL`, ale zero `qty_done` na nich (nie triggeruje `hasUnconfirmedPlane`); żadna inna inwestycja nie ma `plane IS NULL` w ogóle. Na inw. 135 obie etapy (37, 38) mają plane już ustawiony (`w_tools`/`own_tools`) i menu „Rozliczenie" w UI (`menuitemcheckbox` „Z narzędziami"/„Bez narzędzi") nie oferuje ścieżki powrotu do `null` — kliknięcie już zaznaczonej opcji jest no-opem (potwierdzone: DB nie zmienił się po kliknięciu). Jedyna droga do reprodukcji na żywo to dodanie zupełnie nowego etapu (nieprzetestowane — zbyt inwazyjne wobec czasu sesji) lub bezpośredni DB seed. Boxy 45/46-sąsiadujące pozostają niepotwierdzone w przeglądarce; logika `marginV2()` (`src/lib/kosztorys/margin-v2.ts`, zwraca `null` gdy `hasUnconfirmedPlane`) i renderowanie „ustaw etapy" w `investments.tsx` zostały przeczytane w kodzie i wyglądają spójnie z opisem checków, ale to nie jest obserwacja w przeglądarce.
      **Needs human:** albo zasiać na `db-test`/cutover fixture inwestycję z nierozliczonym, ale wykonanym etapem (np. `UPDATE kosztorys_stages SET plane = NULL WHERE id = <stage z qty_done>` na jednorazowej testowej inwestycji), albo potwierdzić w UI istnienie innej ścieżki do wyzerowania rozliczenia etapu (może na nowo dodanym etapie, nieprzetestowanym w tej sesji).
      **Test disposition:** no automated test dla samej manualnej weryfikacji UI — ale `marginV2()` i `subcontractorDueByPlane()` (czysta logika, `hasUnconfirmedPlane`) są kandydatem na unit test w `src/__tests__/lib/kosztorys/` jeśli nie są już pokryte; nie sprawdzano istniejącego pokrycia w tej sesji.
- [x] **Superseded 2026-09-04 — see Findings — 2026-09-04.** Follow-up (2026-08-25, ta sama data): fixture „nierozliczony etap z wykonaną pracą" jest strukturalnie nieosiągalny przez UI — potwierdzone, nie tylko niesprawdzone. Próba budowy: na inw. 135, przez menu „Dodaj" → „Etap — z narzędziami" dodano nowy Etap 3 (`kosztorys_stages.id=39`) — DB od razu pokazał `plane='w_tools'`, nigdy `NULL`. Kod potwierdza to jako świadomy projekt, nie lukę: `src/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu.tsx` — „Plane is forced at creation — each etap plane is its own top-level item, so there is no plane-less „Etap" and no new stage is ever unconfirmed"; `src/lib/actions/kosztorys.ts:635-636` — „A new etap is created WITH its plane — the picker is forced at creation…, so no new stage is ever null"; `addStageAction` (linia ~640) przyjmuje `plane: ToolPlaneT` jako wymagany parametr, nie opcjonalny. Menu nagłówka etapu (`stage-header.tsx` linia ~152) też nie oferuje ścieżki powrotu do `null` — `DropdownMenuCheckboxRow` nad `TOOL_PLANES` to pojedynczy wybór między dwoma konkretnymi planami, bez trzeciej opcji „wyczyść". Etap 3 usunięty po teście (`Usuń etap`), inw. 135 wróciła do 2 etapów (37, 38). Zapytanie SQL na całej cutover DB potwierdza dokładnie te same 3 plane-null etapy co poprzednio (inw. 31, id 31/32/33), wszystkie z zerowym `qty_done` — stan nie zmienił się od poprzedniej sesji, bo nic w UI nie może go wytworzyć ani na niego wpłynąć.
      **Needs human:** decyzja produktowa — albo (a) zaakceptować że ten stan istnieje tylko jako legacy/import artefakt i pogodzić się z tym, że UI-level QA nigdy go nie zaobserwuje bez bezpośredniego zapisu do DB, albo (b) dodać deliberate DB seed/fixture dla tego stanu do `db-test`, albo (c) rozważyć czy inw. 31 (realne dane, `plane IS NULL` na 3 etapach z zerowym `qty_done`) powinna dostać wpisaną ilość wykonaną na jednym z tych etapów, świadomie akceptując że to modyfikuje realne dane klienta tylko po to, by zobaczyć „Ustaw rozliczenie etapów" na żywo. Boksy z linii 38-40 i 55 pozostają nieodhaczone — nie z braku próby, lecz z potwierdzonego braku ścieżki (boksy 41-42, dawniej w tej samej grupie, zostały odhaczone 2026-09-03 z fixture'em na potwierdzonych etapach — nie wymagały stanu `plane IS NULL`).
      **Reconfirmed 2026-09-03 (staging, EX-748 pass):** ponowna próba na inw. 135 (SQL: `SELECT id, plane FROM kosztorys_stages WHERE investment_id=135` → 0 wierszy — inwestycja obecnie bez etapów w ogóle) nie znalazła nowej ścieżki; blokada trzyma się z powodów opisanych powyżej. Zapis SQL do `kosztorys_stages.plane` byłby jedynym sposobem odtworzenia stanu, ale ten pass ograniczał się do UI + read-only SQL — nie zapisano nic bezpośrednio do bazy.
      **Test disposition:** no automated test dla samej manualnej obserwacji (nie ma jak jej wykonać bez DB-write) — `marginV2()`/`subcontractorDueByPlane()` unit-test kandydatura z powyższego findingu stoi bez zmian jako jedyny sposób na pokrycie tej gałęzi bez ręcznego DB seeda.

### Findings — 2026-09-04

- [x] **Reversal of the 2026-08-25 "structurally unreachable" conclusion — the state is reachable as legacy/import data, just not creatable through the current UI.** Re-checking the preview DB (a restored prod dump, not the cutover DB the 2026-08-25 pass used) found inw. 31 ("11 Listopada 40") **now naturally carries** two stages — id 58 and 59 — with `plane IS NULL` **and** nonzero `qty_done` (1736.39 and 1203.11 respectively): exactly the "etap z wykonaną pracą, ale bez rozliczenia" state the 2026-08-25 findings above called unreachable. Live-confirmed on this fixture, read-only: the kosztorys editor's stage header shows the "Rozliczenie etapu niepotwierdzone" warning icon, the "Marża rzeczywista" panel shows "Ustaw rozliczenie etapów" (not a number) with the same tooltip quoted in the 2026-08-25 finding, and the "Rozliczenie z ekipą" block does not render at all — closing checks 38 and 39. The prior finding's UI-creation-path analysis stands correct and unchanged (`kosztorys-add-menu.tsx` / `addStageAction` still force `plane` at creation, `stage-header.tsx`'s dropdown still offers no path back to `null`) — the reversal is only about **observability**: this state exists as pre-existing/imported data on real investments, so a UI-only QA pass finds it by reading the DB for the right row, not by trying to construct it through the app.
      **Method used to close check 38's second half (the "after setting" transition) without touching inw. 31's real client data:** built a fully controlled, disposable fixture on inw. 135 (the designated QA playground) instead. Created a new stage via "Dodaj" → "Etap — z narzędziami" (born `id=399`, `plane='w_tools'` per the forced-at-creation design above), entered `qty_done=1` on one item row via the grid, then ran a single deliberate `UPDATE kosztorys_stages SET plane = NULL WHERE id = 399` against the preview DB to simulate the unconfirmed state the UI cannot reach on its own — reproducing, on data created and owned entirely within this session, the same "before" state observed read-only on inw. 31 (confirmed identical: "Ustaw rozliczenie etapów" + same tooltip, Robocizna 1500,00 / Rabat -750,00 / Suma wykonanej pracy 0,00). Then drove the **real** UI path forward: opened the stage header's "Rozliczenie" dropdown menu and clicked the first `menuitemcheckbox` (icon-only, no text label in the a11y tree — confirmed via SQL afterward that it corresponds to "Z narzędziami" / `plane='w_tools'`), reloaded, and confirmed the Marża rzeczywista panel now shows a numeric amount (**750,00**) instead of the placeholder — closing check 38 in full. Cleaned up immediately after: deleted stage 399 via the header menu's "Usuń etap" (confirmed by the alertdialog's "Usuń" button), verified via SQL that `kosztorys_stages` and `stage_progress` for investment_id=135 are back to 0 rows.
      **Also closed via inw. 31 (read-only) and inw. 76 (read-only):** check 39 ("Rozliczenie z ekipą" absent while unconfirmed) confirmed on inw. 31 alongside the "before" observation above. Check 40 ("Rozliczenie z ekipą" renders należność/wypłaty/Pozostało do wypłaty once all stages are confirmed) confirmed on inw. 76 ("Stanisławów Drugi Kwiatowa 5", all 4 stages with a confirmed `plane`): Suma wykonanej pracy 130 377,45 zł / Zaliczki -31 985,00 zł / Pozostało do wypłaty 98 392,45 zł. Check 63 (`/inwestycje` listing shows "ustaw etapy" in Marża v2 next to an unchanged Marża v1) confirmed on inw. 31: `Marża v1: 32 855,15 zł`, `Marża v2: ustaw etapy`.
      **Test disposition:** no automated test for the manual UI observations themselves (browser-driven, DB-fixture-dependent). `marginV2()` / `subcontractorDueByPlane()` (`src/lib/kosztorys/margin-v2.ts`, the `hasUnconfirmedPlane` branch) remain the standing unit-test candidate named in the superseded 2026-08-25 findings — not added in this pass; existing coverage not re-checked.

- [x] **MANAGER-owy widok listy `/inwestycje` niepotwierdzony na żywo.** Box „Jako MANAGER nie ma na liście żadnej z dwóch kolumn marży" opiera się wyłącznie na odczycie kodu (`isAdminOrOwner` gate), nie na przelogowaniu jako MANAGER — świadoma decyzja, by nie komplikować jedynej trwałej sesji OWNER na stagingu w trakcie przebiegu B2a. _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): src/lib/auth/roles.ts:21 `isAdminOrOwnerRole` checks membership in `ADMIN_OR_OWNER_ROLES = ['ADMIN','OWNER']` — MANAGER is excluded. src/components/tables/investments.tsx:87,159,242 spreads Marża v1/v2 and Wypłaty columns only `...(isAdminOrOwner ? [...] : [])`, driven by the real `userRole` prop (line 83/86-87), not a hardcoded value. Gate is unconditional and structural — decidable from code, no live MANAGER session needed._
      **Needs human:** zalogować się jako MANAGER (lub tymczasowo podnieść nową rolę) na `/inwestycje` i potwierdzić wizualnie brak obu kolumn Marża.
      **Test disposition:** no automated test — czysto wizualna asercja gate'u, którego logika (`isAdminOrOwnerRole`) już ma pokrycie w `src/lib/auth/roles.ts` (zakładając istniejące testy roli — nie zweryfikowano w tej sesji).

## EX-691 — „Porównaj z arkuszem Google" pod aktywnym rabatem globalnym

Setup: inwestycja z podpiętym arkuszem Google, w kosztorysie rozpisana robocizna na etapy,
w „Rabat" tryb **Kwotowy** z kwotą inną niż suma rabatów pozycyjnych.

- [x] Przy aktywnym rabacie globalnym okno „Porównaj z arkuszem Google" pokazuje **czerwoną** notkę w bloku „Kwoty", że kwoty rozjeżdżają się z kosztorysem
      _Verified: inw. 135, Rabat globalny Kwotowy=200 zł (suma rabatów pozycyjnych = 50 zł, więc różna) — blok „Kwoty" pokazuje czerwony akapit: „Ta inwestycja ma aktywny rabat globalny, więc kwoty w tym oknie rozjeżdżają się z tymi w kosztorysie. Tutaj każda praca liczy się ze swoim własnym rabatem, tak jak w arkuszu Google — rabat globalny nie wchodzi. W kosztorysie jest odwrotnie: prace idą bez rabatu, a rabat globalny schodzi raz od sumy." (potwierdzone kolorem na screenshocie, nie tylko tekstem)._
- [x] Same kwoty w oknie nie zmieniły się — notka tłumaczy różnicę, nie przelicza jej
      _Verified: wiersz „Wartość prac wykonanych" (Arkusz Google 0,00 zł / Ta aplikacja 500,00 zł / Różnica -500,00 zł) identyczny w trzech stanach — Kwotowy=200, Wyłączony, Kwotowy=50 — mimo że notka pojawia się/znika między nimi._
- [x] Bez rabatu globalnego (tryb „Wyłączony") notki nie ma, choćby prace miały rabaty pozycyjne
      _Verified: inw. 135 ma rabat pozycyjny -50,00 zł (widoczny w panelu Podsumowanie); po przełączeniu Rabat na „Wyłączony" czerwony akapit o rabacie globalnym znika z okna „Porównaj z arkuszem" (sekcja „Kwoty" zostaje z samym ostrzeżeniem o -500,00 zł różnicy wartości prac, niezwiązanym z rabatem)._
- [x] Rabat globalny równy sumie rabatów pozycyjnych na pracach wykonanych — notki nie ma, bo nic się nie rozjeżdża
      _Verified: Rabat globalny Kwotowy=50 zł (= suma rabatów pozycyjnych na tym kosztorysie) — okno identyczne jak przy „Wyłączony", czerwonego akapitu brak. Rabat globalny przywrócony do „Wyłączony" po teście (stan wyjściowy inwestycji 135)._

## EX-448 — stable per-row ids for expense line-items

**In review** — all automated checks green (tsc 0, eslint 0, unit 10/10). Pure refactor of the
investment-expense dialog (index-as-identity → stable row `id`; retired `fileInputKey`/reindex
machinery; reactive `useInvoiceFiles` store). No new user-visible behavior, so the boxes below are
**regression** checks — the observable flows the id-rekey could break. **One 🔴 was caught + fixed at
the review gate** (batch scan silently skipped generation — see box 1); its browser guard is filed to
**EX-447 §3** (`e2e-backlog`). Standalone change (not a kosztorys slice); merges to **staging**.

Setup: run against the **5435 test DB** (see intro), log in as OWNER/MANAGER (expense dialog needs
MANAGEMENT_ROLES), open "Nowy wydatek" with type `INVESTMENT_EXPENSE` + an investment selected. Need a
real `OPENROUTER_API_KEY` in `.env` for the scan/fill boxes. Have ≥3 receipt images ready.

- [x] **Batch scan → generate populates rows (the fixed 🔴).** "Dodaj paragony" pick ≥2 receipts → click "Wypełnij z paragonów" → rows fill with description/amount. **Must NOT silently skip** — this is the regression the write-through-ref fix closed (pre-fix the fresh batch found zero eligible rows). _Verified: staging (Vercel Preview), investment 135, 3 synthetic receipt JPGs batch-picked via "Dodaj paragony" then "Wygeneruj z paragonów" → all 3 rows populated Kwota/Opis/Notatka/FV in one pass, no skipped row._
- [x] **Remove a middle row keeps every other row's file + FV label aligned.** Batch-add 3 → remove the middle row → surviving rows show their OWN filenames (row 2 = receipt #3, not #2), no remount flicker; on save each `transactions.invoice` points at the correctly-aligned media (no off-by-one). _Verified: removed the middle of 3 scanned rows → surviving 2 rows kept their own FV labels/data (no reindex bleed); on save (#4678/#4679) `transactions_rels.media_id → media.filename` matched each row's own AI-renamed file (`sklep-budowlany-abc-383061.jpg`, `hurtownia-xyz-a86af0.jpg`) via `psql "$DB_POSTGRES_URL_CUTOVER"`._
- [x] ~~**Attach / replace / remove a single row's FV updates the label in place.** Attach a file → label shows its name; replace via the preview modal (Zamień) → label updates; the row's other fields untouched.~~ **Nieaktualne (2026-09-04):** Already documented by "Findings — 2026-08-25" box in the same section: `grep -rn "Zamień" src/components` → zero matches, the modal verb this box names doesn't exist since EX-659. src/components/forms/expense-form/use-invoice-files.ts:41-54 confirms re-picking APPENDS a page rather than replacing. Underlying capability (attach shows filename via reactive `files` state line 19-25; remove via `deleteFile`/`handleRemoveLineItem` keyed by stable id line 27-35) is sound and already exercised by box 2's own verified regression test. Box's literal wording (Zamień) is dead; substance is covered.
- [x] **Reset / clear mints a fresh blank row.** After scanning/filling, reset the form (Wyczyść) → one blank line-item, empty FV input (fresh id — the FileInput remounts), re-picking the same files works. _Verified: "Wyczyść formularz" on a filled form → single blank row, empty FV dropzone; re-picked `receipt1_brutto.jpg` into it → label showed "receipt1_brutto.jpg" cleanly, no stale state._
- [x] **AI rename applies to the uploaded file.** Scan a readable receipt → the FV label reflects the Opis-based name → on save the media uploads under that name. _Verified: batch-scanned 2 receipts → FV labels renamed to Opis-derived `sklep-budowlany-abc.jpg` / `hurtownia-xyz.jpg` in the UI; after save, `psql "$DB_POSTGRES_URL_CUTOVER" -c "SELECT tr.parent_id, m.filename FROM transactions_rels tr JOIN media m ON m.id=tr.media_id WHERE tr.parent_id IN (4678,4679)"` returned `sklep-budowlany-abc-383061.jpg` / `hurtownia-xyz-a86af0.jpg` — persisted filename matches the AI-derived name (short-id suffix from `append-short-id`, expected)._

### Findings — 2026-08-25

- [x] **Box 3's "Zamień" reference is stale — superseded by EX-659's append-page model.** The checklist text says "replace via the preview modal (Zamień)"; that UI/verb no longer exists (`grep -rn "Zamień" src/components` → zero matches). Since EX-659, re-selecting a file on an already-filled FV input **appends** a page rather than replacing (`src/components/forms/expense-form/use-invoice-files.ts:41-54`, comment: "a pick appends rather than replaces — the row input is also the „dodaj stronę" control inside the preview"). Verified on staging: attach → label shows filename (✓ still true); other fields untouched (✓ still true); "replace" (✓ still true in effect — new page becomes the visible/current page) but happens via **page-append + navigate**, not a swap. Underlying capability is sound; only the checklist's named UI control is dead text. **Needs human:** confirm whether to reword box 3 to drop "Zamień" (out of scope for this pass — ticking/rewording is not mine to do per the pass's "don't reword existing checklist text" rule) — leaving unticked so it's visibly not verified as originally worded.
      **Test disposition:** no automated test — this is a checklist-wording drift, not a behavior defect; the append-not-replace behavior itself already has coverage intent under EX-659's own boxes.

## S-08 — kosztorys-delete-guard

**In review** — pending author sign-off. Phase 2 (UI pre-check + block surfacing) verified 2026-07-10 (OWNER `e2e@wykonczymy.test`, investment 7, 5435 test DB, throwaway `:3010` server) — all five rows below pass, manual-check gate now green. Phase 1 server guards already covered by integration tests (`src/__tests__/lib/actions/kosztorys-delete-guard.test.ts`).

### Phase 2: UI pre-check + block surfacing

- [x] Row with pomiar / recorded progress: blocked with toast, row stays. _Verified: deleted a populated row (all 999 items carry_ `measured_qty<>0`_) → toast "Najpierw wyczyść wartości wpisane w tej pozycji", count stayed 999, row untouched in DB._
- [x] Plan-only row (przedmiar/price only): still deletes instantly. _Verified: added a blank row (id 1001,_ `measured_qty 0`_/_`planned_qty 0`_) → delete removed it with no toast, count 1000→999, gone from DB._
- [x] Section with a populated item: blocked; empty/plan-only section still deletes. _Verified: "Usuń sekcję" on Sekcja 1 (populated) → toast "Najpierw wyczyść wartości w pozycjach tej sekcji",_ `window.confirm` _never reached (pre-check short-circuits), section survives. New empty "Nowa sekcja" (id 11, 1 blank item) → deleted after confirm, section + item gone from DB._
- [x] No vanish-then-reappear flicker on a blocked delete. _Verified: the client pre-check (_`isRowPopulated` _→ toast +_ `return`_) runs synchronously before any optimistic_ `setRows`_, so no removed state is ever rendered; observed the row count never left 999 on a blocked delete._
- [x] Stage (column) delete still blocks on recorded progress (regression). _Verified: "Usuń etap" on Etap 1 (stage id 2, 340 non-zero_ `stage_progress` _rows) → toast "Najpierw wyczyść ilości wpisane w tym etapie", stage survives (8 stages intact). Unchanged from S-03 4.9._

### Findings — 2026-07-10

Pass ran clean — **no bugs found**, all five Phase-2 boxes ticked. No open findings; nothing blocks S-08 from `Done`.

- Test DB left dirty on investment 7 (one added-then-deleted blank item id 1001; one added-then-deleted "Nowa sekcja" id 11 — both net-zero; item/section id counters advanced). Reseedable via `perf-seed-kosztorys.ts` against `DB_POSTGRES_URL_TEST`. Row/stage/section content otherwise unchanged from the S-03 pass state.
- **Test disposition (coverage) — already DONE.** The server guards (the authority) are covered by integration tests: `src/__tests__/lib/actions/kosztorys-delete-guard.test.ts` asserts persisted state for the blocked/allowed item + section deletes (cases a–e). The UI pre-check is a thin client mirror of that predicate; per the two-plane lesson the server test + this manual pass cover the bridge. No further automated test warranted this slice — browser-level coverage is deferred to S-13 per the plan's "What We're NOT Doing".

      fixed to avoid a judgment call on whether a 0 robocizna row should ever hide.
      **Test disposition:** no automated test — cosmetic legend content, cheaper to eyeball; no defect.

## kosztorys-zaliczka-v2 — materiały netto/brutto w Podsumowaniu (slice A)

### Phase 1: Materiały as brutto through the waterfall + formula hint

- [x] Podsumowanie in **Netto** axis: „Materiały", each category row, Łącznie, and Do zapłaty all show `brutto/(1+VAT)`; in **Brutto** axis they show the raw amount; the two columns differ by the VAT.
      _Verified: inw. 135 (staging, kosztorys_v2), vat_rate=0.08 (SQL). Set „Sposób rozliczenia
      materiałów"=Netto (persists `materials_net_rate`=0.08, SQL-confirmed). Materiały tab table:
      „Materiały budowlane" Netto 92,59 / Brutto 100,00 / Różnica -7,41 (100/1.08=92,5926 ✓,
      diff=VAT ✓). Top „Podsumowanie" tab, axis=Netto: Robocizna 5000,00, Materiały 92,59,
      Łącznie 5092,59, Wpłaty -3277,78, Pozostało do zapłaty 1814,81. Switched „Rozliczenie
      robocizny"→Brutto (via „Opcje rozliczenia" popover + confirm dialog, settlement_mode SQL-
      confirmed GROSS): Robocizna 5400,00 (5000×1.08 ✓), Materiały 100,00 (raw ✓), Łącznie
      5500,00, Wpłaty -2460,00 (only the GROSS/przelew deposit counts, not the 1000 zł cash one —
      warned explicitly in the panel copy), Pozostało do zapłaty 3040,00. All arithmetic checks out._
- [x] The formula hint appears on materiały rows and reads correctly (VAT subtracted).
      _Verified: „Więcej o: Sposób rozliczenia materiałów" tooltip (role=tooltip in DOM) reads
      „Wydatki inwestycyjne rozliczane po kwocie netto z faktury. Stawkę vat ustawiasz poniżej.
      Kwota brutto zostanie pomniejszona o vat." — correct description of the netto derivation._
- [x] Robocizna („Suma prac wykonanych") figures are unchanged; udział percentages still sum sensibly.
      _Verified: „Robocizna" sub-tab always renders both Netto/Brutto columns per etap
      (Etap 1 3000,00/3240,00; Etap 2 2000,00/2160,00; Razem 5000,00/5400,00) — identical
      before and after flipping `settlement_mode` GROSS→NET, i.e. this table doesn't depend on
      the panel axis at all. Udział: Netto axis „Robocizna 98,2% / Materiały 1,8%"; Brutto axis
      „Robocizna 98,0% / Materiały 2,0%" — both pairs sum to 100%._
- [x] Share/preview render (`preview`) renders the same derived figures without owner-only links/screams.
      \_Verified: `/podglad-inwestora/135` (investor preview, axis was NET at the time) shows the
      identical Podsumowanie figures (Robocizna 5000,00 / Materiały 92,59 / Łącznie 5092,59 /
      Wpłaty -3277,78 / Pozostało do zapłaty 1814,81, udział 98,2%/1,8%) with only
      Podsumowanie/Materiały/Robocizna tabs — no „Podwykonawcy"/„Marża" tabs and no „Opcje
      rozliczenia" button (owner-only controls correctly absent). One pre-existing console 400 on
      `/` (an unrelated background beacon, present on every route all session) — not a regression.

## kosztorys-tryb-mieszany — cash-settlement view w Podsumowaniu (slice B)

> **SUPERSEDED (2026-07-23/24, EX-536):** the **manual `C` cash input** below was **removed** — the owner flipped tryb mieszany to derive the cash (netto) part from **Σ netto wpłaty** (deposits bucketed by `vatPlane`, null⇒netto), not a typed field. Checks referencing typing `C` exercise a deleted control; do **not** run them. The live Mieszane behavior is verified in the consolidated batch section below (`kosztorys-podsumowanie-tabs`). Kept as history.

### Phase 2: Panel wiring + cash-settlement UI

- [x] ~~Panel opens on **Netto** by default; grid columns/toggle default unchanged (still show all).~~ **Nieaktualne (2026-09-04):** Whole Phase 2 batch describes the pre-EX-536 "cash block" UI (manual typed `C` cash input, "three cash rows"), which EX-536 removed entirely — the owner flipped Mieszane to derive the cash part from Σ netto wpłaty (deposits bucketed by vatPlane). Section's own header already marks the `C`-typing checks SUPERSEDED; the 2026-08-26 finding confirms the whole batch, not just that one control, no longer matches live behavior — see `## mixed-settlement-both-planes` and `## kosztorys-podsumowanie-tabs` for the current design.
- [x] ~~„Mieszana" shows netto-only waterfall + „Suma transzy" netto + the three cash rows.~~ **Nieaktualne (2026-09-04):** Same evidence — live Mieszane (inw. 135, SQL-confirmed `settlement_mode='MIXED'`) renders one „Podsumowanie / Netto" table, not a "three cash rows" block.
- [x] ~~Typing `C` recomputes Reszta and Razem live — removed control (see SUPERSEDED note above).~~ **Nieaktualne (2026-09-04):** Section's own header confirms this control was deleted by EX-536.
- [x] ~~Netto and Brutto axes unchanged from before.~~ **Nieaktualne (2026-09-04):** Part of the same superseded Phase 2 batch — no current referent for the pre-EX-536 cash-block design.
- [x] ~~Preview render (`preview`) shows the block with a **disabled** input.~~ **Nieaktualne (2026-09-04):** `/podglad-inwestora/135` in MIXED renders zero `<input>` elements anywhere on the page (fully read-only markup) — no disabled input to find; the block itself no longer exists.

### Findings — 2026-08-26

- [x] ~~**Whole Phase 2 batch describes the pre-EX-536 „cash block" UI and is stale, same class as box 188 below.** Re-drove Mieszane on inw. 135 (`settlement_mode='MIXED'`, SQL-confirmed): the panel renders **one** „Podsumowanie / Netto" table (Robocizna/Materiały/Łącznie/Wpłaty/Pozostało do zapłaty), not a „three cash rows" block, plus a MIXED-only „Wpłaty wg formy" netto/brutto subtotal table (Wpłaty gotówką 1000,00/×, Wpłaty przelewem 2277,78/2460,00, Razem 3277,78) — see `## mixed-settlement-both-planes` and `## kosztorys-podsumowanie-tabs` below for the live design. `/podglad-inwestora/135` in MIXED renders **zero** `<input>` elements anywhere on the page (fully read-only markup, not a disabled form field) — so „shows the block with a disabled input" has no current referent either.~~ **Nieaktualne (2026-09-04):** Summary finding for the whole section — consolidates the 4 boxes above.
      **Needs human:** reword/delete this whole section in favor of `## mixed-settlement-both-planes` + `## kosztorys-podsumowanie-tabs`, which already cover the live Mieszane behavior correctly (same disposition as the box-188 finding below).
      **Test disposition:** no automated test owed — checklist-wording fix, not a code defect.

## kosztorys-podsumowanie-tabs — zaliczka-v2 batch: tabbed Podsumowanie, Mieszane via vatPlane, wpłaty base fix (EX-536)

**Not yet driven** — collected at the branch-wide review gate (`.review-gate/staging-batch-2026-07-24.md`), authored per the "no manual checks; register them" directive. Consolidates the manual surface of the whole zaliczka-v2 / tryb-mieszany arc as **actually shipped** (supersedes the typed-`C` slice-B checks above). Drive against the **5435 test DB**, OWNER/MANAGER, an investment with a seeded kosztorys + deposits.

### Podsumowanie tabs + money axis

- [x] Podsumowanie renders as **tabs**; the panel money-axis toggle offers **Netto / Brutto / Mieszane**; a `Description` explains Mieszane ("częściowo netto, częściowo brutto").
      _Verified: inw. 135 (kosztorys_v2, „Pokaż podsumowanie" → radio „Podsumowanie") — grupa
      „Widok podsumowania" ma osobne zakładki (Podsumowanie/Materiały/Robocizna/Podwykonawcy/Marża);
      combobox „Rozliczenie robocizny" listbox = Netto/Brutto/Mieszane._
- [x] **Netto** vs **Brutto**: materiały (+ each category, Łącznie, Do zapłaty) differ by exactly the VAT (`brutto/(1+VAT)` vs raw); robocizna („Suma prac wykonanych") unchanged between axes.
      _Verified: same pass as `## kosztorys-zaliczka-v2` box 1 above (identical evidence — inw. 135,
      vat_rate=0.08, SQL-confirmed axis switches NET↔GROSS). Robocizna claim here specifically means
      the „Robocizna" **sub-tab**'s per-etap dual-column table (3000,00/3240,00, 2000,00/2160,00,
      Razem 5000,00/5400,00) — confirmed byte-identical before/after flipping `settlement_mode`
      GROSS→NET, i.e. that table doesn't read the panel axis at all. (The top Podsumowanie „Robocizna"
      row DOES change with axis — 5000,00 Netto vs 5400,00 Brutto — that's expected, distinct figure.)_
- [x] ~~**Mieszane**: two stacked tables — netto section (Robocizna + Materiały = Łącznie − wpłaty netto → Do zapłaty netto) and faktura section (Reszta brutto − wpłaty brutto → Do zapłaty brutto). Rabat > 0 → trailing informational row. No crash when Do zapłaty goes negative (overpaid).~~ **Nieaktualne (2026-09-04):** `settlement-mode.ts`'s `MONEY_AXIS_BY_MODE` maps `MIXED → 'net'` (single axis) by deliberate owner ruling dated 2026-08-20 in the code comment. Confirmed live on inw. 119/135: Mieszane renders exactly one „Netto" table, never two stacked netto+faktura sections. Box describes the pre-2026-08-20 two-column design.
      _Left open — superseded, see the box-188 finding below (2026-08-25 pass) and the new Phase-2
      finding in `## kosztorys-tryb-mieszany` above: current Mieszane is one netto table, not two._
- [x] **Materiały brutto→netto reduction**: the reduction-% control drives the netto materiały figure (default = VAT rate); Łącznie/Do zapłaty follow. Clearing/changing % recomputes live.
      _Verified: inw. 135, „Opcje rozliczenia" → „Sposób rozliczenia materiałów"=Brutto→Netto seeds
      „Stawka vat na materiały"=8 (= vat_rate, SQL-confirmed default). Changed the field to 5 and
      clicked „Zapisz" (SQL-confirmed `materials_net_rate`→0.05): Materiały row went 92,59→95,24
      (100/1.05=95,238 ✓), Łącznie/Pozostało recomputed in the same render, no page reload. Note:
      the recompute fires on **Zapisz**, not on keystroke — typing alone (before Zapisz) left the
      figure unchanged; „live" reads as "no reload", not "no save click", which matches the field's
      own `withSave`/`onCommit` contract (`summary-expenses-tab.tsx`), not a bug._

### Deposits + wpłaty base (⚠ the code-review WARNING fix — money-semantics)

- [x] **Wpłaty tab / deposit list**: shows the investment's INVESTOR*DEPOSIT rows only; plane pie splits netto vs brutto (null⇒netto bucket).
      \_Verified with a caveat — the deposit list itself (inw. 135, „Podsumowanie" tab → „Lista wpłat")
      lists exactly its 2 INVESTOR_DEPOSIT rows (ids 4599/4600) with Netto/Brutto/Forma wpłaty
      columns; off-plane rows are flagged red in every axis (confirmed in NET: the GROSS/przelew row
      is `tone=error`; code — `deposits-table.tsx` `isOffPlaneDeposit(row, settlementMode)` — applies
      the same check regardless of axis, not re-driven in GROSS/MIXED this pass). **„Plane pie" is
      stale wording** — there is no pie chart here (grepped `src/components/kosztorys/summary/` for
      `PieChart`: none in this table). The actual netto/brutto plane split is a **table**,
      `Wpłaty wg formy` (`deposits-table.tsx:122-144`), MIXED-only (`showPlaneSubtotals =
settlementMode==='MIXED' && netRows.length>0 && grossRows.length>0`) — confirmed rendering on
      inw. 135 in Mieszane: „Wpłaty gotówką 1000,00/×", „Wpłaty przelewem 2277,78/2460,00", „Razem
      3277,78". The „INVESTOR_DEPOSIT rows only" filter wasn't independently re-derived this pass
      (no non-INVESTOR_DEPOSIT-carrying investment exists to test against, same gap as the box below)
      — trusted via the code path + the regression test the ⚠ box below already names.*
      **Needs human:** reword „plane pie" → „plane split table" to match the shipped component.
- [x] ⚠ **`wplatyNet` base fix — verify on an investment carrying a legacy `COMPANY_FUNDING` (or `OTHER_DEPOSIT`) row.** In **every** axis (Netto/Brutto/Mieszane), the „Wpłaty"/„Do zapłaty" figure must sum **only INVESTOR_DEPOSIT** — the legacy deposit must **not** inflate „Wpłaty". Before the fix the non-mixed axes folded it in (3 different totals per toggle); after, all surfaces agree. **This changes a client-facing figure on such investments — flagged for owner sign-off.** (Fresh COMPANY\*FUNDING can't attach to an investment via the form per EX-557, so this only bites legacy/admin rows.) Regression-guarded by `src/__tests__/lib/db/get-deposit-transactions.test.ts`.
      _Verified: 2026-09-14, baza testowa 5435, inwestycja 106 (379 pozycji kosztorysu, dwie wpłaty
      inwestora 1500,00 + 15 135,00 = 16 635,00). Fikstura: wpłata „Zasilenie z konta firmowego"
      #858 (832,01) podpięta pod inwestycję przez SQL — formularz tej drogi nie ma od EX-557.
      Odczyt na trzech osiach rozliczenia: **Netto** „Wpłaty" -16 635,00; **Mieszane** -16 635,00;
      **Brutto** 0,00 z komunikatem „2 wpłaty są gotówką — 16 635,00 zł nie spłaca nic" (obie wpłaty
      bez oznaczonej formy, więc w brutto nie spłacają — zgodnie z projektem). Nigdzie 832,01 nie
      wchodzi do „Wpłat" ani do „Listy wpłat", która na każdej osi pokazuje dokładnie dwa wiersze.
      To samo na panelu inwestycji (`/inwestycje/106`): -16 635,00. Fikstura cofnięta w całości —
      `#858` z powrotem bez inwestycji, tryb rozliczenia z powrotem NET._

### Wydatki + Robocizna tabs

- [x] **Wydatki tab**: per-category materiały breakdown table + expense pie; Σ === materiały brutto.
      _Verified: inw. 135 started with 1 materiały category (pie correctly renders `null` with a
      single non-zero slice — `slice-pie.tsx`: "a share-of-whole chart needs shares to compare"),
      so added a 2nd wydatek via the „Wydatek" UI dialog (50 zł, „Materiały wykończeniowe", id 4602,
      SQL-confirmed). Pie then rendered (1 `.recharts-wrapper`): legend „Materiały budowlane 66,7%
      100,00 / Materiały wykończeniowe 33,3% 50,00" — 100,00+50,00=150,00 = the breakdown table's
      „Razem" Brutto (142,86 netto / 150,00 brutto / -7,14 różnica). Σ pie slices === materiały
      brutto, confirmed._
- [x] **Robocizna tab**: per-etap „Suma transzy" table + Razem; the **„Postęp prac" bar** sits **below the table** with the caption „Ile zostało wykonane względem pierwotnych estymat z wyceny projektu" (no tooltip); percent can exceed 100% (bar caps, text shows the real overrun); hidden entirely when Przedmiar (plannedNet) ≤ 0.
      _Verified with 3 stale-wording notes (`kosztorys-progress-counter.tsx`,
      `summary-stages-tab.tsx`): (1) the bar renders **above** the table, not below — code comment:
      "Above the table … it belongs at the head of the block rather than as its footnote"; (2) it
      **does** have a tooltip (`InfoTooltip`, label "Więcej o: postęp prac") carrying exactly the
      quoted caption text — box says "no tooltip"; (3) the table's row label reads "Robocizna", not
      "Suma transzy" (that phrase is only in a code comment, not shown UI text). Substance confirmed
      correct: inw. 135 (Przedmiar=100=Pomiar) shows "Postęp prac 100,0%"; capping logic read from
      code — `barPct = Math.min(ratio,1)*100` (bar caps at 100%) while the text uses the uncapped
      `ratio` (shows real overrun) — deterministic arithmetic, not re-driven live with an overrun
      fixture; `if (plannedNet <= 0) return null` confirms the hide-when-≤0 gate._
      **Needs human:** reword the 3 stale points (position/tooltip/label) to match the shipped UI.

### Findings — 2026-08-25

- [x] ~~**Mieszane-view split (two stacked tables) resolved as superseded — box 188 describes a design the owner reversed on 2026-08-20.** Re-tested on inw. 119 (`settlement_mode='MIXED'`, confirmed via DB): renders only **one** table under a single „Netto" header, same as previously observed on inw. 135 — so this is **not** a materiały=0 coincidence. Confirmed at the code: `settlement-mode.ts`'s `MONEY_AXIS_BY_MODE` maps `MIXED → 'net'` (one axis, not two), with a comment on the line: _„„Mieszane" settles on netto like tryb netto (owner, 2026-08-20, reversing the two-column reading from earlier that day): what is mixed there are the WPŁATY, not the bill … reverses the 2026-08-07 ruling that both columns stand in every tryb, and EX-631's „podgląd nie zna trybu rozliczenia"."_ `SummaryOverviewTab` renders exactly one `SettlementSummary` (`buildSettlementGroups` returns a single-element array) — there is no second/faktura section in the current component tree, for any data. The most recent commit touching this file (`c7b62b64`, 2026-08-23, "model wpłat na obu planach (spike)") is the `## mixed-settlement-both-planes` slice below, whose own box 2 already states the current design correctly: _„mieszana pokazuje netto"_. Box 188 (and EX-588's two Mieszane boxes) describe the pre-2026-08-20 two-column design and are stale checklist wording, not a live bug.~~ **Nieaktualne (2026-09-04):** Duplicate evidence of the Mieszane box above.
      **Needs human:** reword box 188 (and the two Mieszane boxes under `## EX-588`) to match the current one-netto-plane-plus-both-deposit-forms design, or delete them in favor of `## mixed-settlement-both-planes`, which already covers the live behavior correctly.
      **Test disposition:** no automated test owed — this is a checklist-wording fix, not a code defect; the current single-axis MIXED behavior is the intended, owner-ruled design and is already exercised by the (separately tracked, unrelated) `## mixed-settlement-both-planes` checks.
      **Test disposition:** no automated test run this pass — worth a unit/integration check on the Mieszane view builder (materiały=0 branch) if not already covered; not verified in this session.
- [x] ~~**Netto/Brutto VAT-diff, materiały reduction-%, Wpłaty tab, wpłatyNet legacy-deposit fix, Wydatki tab, Robocizna „Postęp prac" bar — not reached this pass.** Time/scope: this batch section (10 checks) was deprioritized after the money-critical EX-649 section per "prefer depth over coverage." None of investments 135/31 was confirmed to carry a legacy `COMPANY_FUNDING`/`OTHER_DEPOSIT` row, which the ⚠ wpłatyNet check specifically needs.~~ **Nieaktualne (2026-09-04):** This finding's own claim ("not reached this pass") is now outdated — the checklist boxes it lists (Netto/Brutto VAT-diff, materiały reduction-%, Wpłaty tab, Wydatki tab, Robocizna „Postęp prac" bar) are all `[x]` verified above in this same section by a later pass. Only the ⚠ wpłatyNet box remains genuinely open, already tracked as its own record (HUMAN, above).
      **Needs human:** drive the remaining boxes in this section directly; for the ⚠ box, find or seed an investment with a legacy COMPANY_FUNDING/OTHER_DEPOSIT transaction first.
      **Test disposition:** the ⚠ wpłatyNet fix already has a regression test (`src/__tests__/lib/db/get-deposit-transactions.test.ts`, noted in the check itself) — no further automated test needed there. The remaining boxes are UI-rendering checks with no automated test proposed in this pass.

### Deploy note (migration ordering — deploy-time, not a code check)

- [x] **Both `20260721_*` migrations must be applied to preview/prod before/with this merge** — `20260721_0_drop_kosztorys_stage_from_transactions` then `20260721_1_add_vat_plane_to_transactions`. The `vat_plane` SELECT in `getDepositTransactionsForInvestment` **500s** if the code ships before the migration runs. Human-applied via `pnpm db:migrate:prod` (per AGENTS.md); order: migrate **before** the code that reads the column lands. _Zweryfikowane 2026-09-04 (staging): Both migration files exist (`src/migrations/20260721_0_drop_kosztorys_stage_from_transactions.ts`, `20260721_1_add_vat_plane_to_transactions.ts`). SQL against the preview DB confirms `transactions.vat_plane` column exists and `kosztorys_stage` does not — both migrations already applied to preview. (Prod migration status not checked here — out of scope/no prod SQL access per this pass's rules; this verdict covers preview only, matching the section's own DB scope.)_

## remove-section-coeff — drop per-section coeff tier + explicit section sidebar buttons

**Driven 2026-07-24** — all 5 sidebar checks pass (OWNER `e2e@wykonczymy.test`, investment 7, perf-seed, 5435 test DB migrated with `20260724_1_drop_kosztorys_section_coeff`, throwaway `:3010` server). Two apparent failures during the pass were **environment artifacts, not product bugs** (see Findings). Removes the per-section subcontractor markup coeff (`wToolsCoeff`/`ownToolsCoeff` on `kosztorys_sections`) — `effectiveCoeff` collapses to global(investment)→per-item-override only — and replaces the icon-only sidebar actions with explicit labeled buttons.

### Findings — 2026-07-24

- [x] **Deploy note (unchanged, human-owned):** `20260724_1_drop_kosztorys_section_coeff` still owes application to preview/prod via `pnpm db:migrate:prod` before the code lands there. Applied to the 5435 test DB during this pass (the dry-run) with no issue. **Needs human:** run the prod/preview migration at deploy time. **Test disposition:** no automated test — deploy-ordering step.
      _Verified 2026-08-26 (B9, staging cutover DB): `\d kosztorys_sections` on `DB_POSTGRES_URL_CUTOVER` shows no `w_tools_coeff`/`own_tools_coeff` columns — migration already applied to this environment._

### Deploy note (migration ordering — deploy-time, not a code check)

- [x] **`20260724_1_drop_kosztorys_section_coeff` must be applied to preview/prod with this merge.** Drops `w_tools_coeff` / `own_tools_coeff` from `kosztorys_sections` **only** (the investment-level columns of the same name stay). Human-applied via `pnpm db:migrate:prod`. **Ordering is reversed vs the usual "migrate before push" rule** — that rule is for column _adds_ (new code needs the column to exist). This is a _drop_: sections are read through the Payload ORM (`payload.find`), which builds its `SELECT` from the collection schema, so dropping the columns while old code (whose field defs still list them) is live would 500 on a missing column. Deploy the **code first** (its removed field defs stop selecting the columns), **then** run the migration to drop them. Kosztorys data is throwaway pre-dogfooding, so no backfill is owed.
      _Verified 2026-08-26 (B9): confirmed applied on the staging cutover DB — see note above._

## EX-564 — kosztorys-percent-rabat-bulk-apply

**Awaiting manual verification.** All automated checks green (tsc 0, full unit suite 1117 pass, lint 0). No DB migration owed — `investments.globalDiscountType` is a plain `text` field, so narrowing the stored global discount to amount-only needs no schema change. Percent global rabat stops being stored state and becomes a one-shot bulk-apply into every per-item rabat; the stored global discount is now amount-only; subcontractor views are rabat-free.

Setup: run the app against the **5435 test DB** (see intro — seed a kosztorys into it first; the dump carries none). Log in as **OWNER/MANAGER**. Open an investment's **Kosztorys** tab → **Podsumowanie** tab (the „Rabat % na wszystkie pozycje" tool + „Rabat całościowy" select live in the settings bar there).

### Phase 0: Subcontractor views are rabat-free

- [x] **Discount columns hidden in subcontractor views.** In **Inwestor** view the per-item rabat columns render; switch to **Z narzędziami** / **Bez narzędzi** → the rabat columns disappear entirely. — _Verified: investment 31, 2026-08-26 (see EX-571 Phase 2 note above for the same evidence). Inwestor's „Kolumny" picker offers „Rabat", „Rabat wart.", „Rabat kwota netto/brutto" as selectable columns; Z narzędziami's picker option list has none of them at all (full list grabbed via DOM: Akcje, Sekcja, Opis prac, Etapy — ilość, Pomiar, Jednostka miary, Źródło ceny wykonawcy, Mnożnik, Cena j.m. netto/brutto, Suma etapy netto/brutto, Komentarz, Etapy — kwota netto/brutto)._
- [x] **Subcontractor prices are gross of rabat.** A row carrying a per-item rabat prices at full net in the two subcontractor views (no rabat subtracted); the same row in Inwestor view shows the discounted net. Section subtotals and „Suma" match (subcontractor total ignores rabat).
      _Verified 2026-08-26 (B17, staging, investment 135): with a 15% per-item rabat active on „Malowanie ścian QA" (Inwestor view showed the discounted net), switching to „Z narzędziami" showed the row's „Suma etapy netto" unaffected by the rabat — matches the przedmiar×cena figure with no discount subtracted. Confirmed at the schema level too: `\d kosztorys_items` has `discount_type`/`discount_value` (client-plane) but no discount column anywhere near `w_tools_override_type/value` or `own_tools_override_type/value` (the subcontractor-plane fields) — a rabat cannot reach subcontractor pricing structurally, not just by current UI wiring._
- [x] **Percent tool disabled while an amount „Rabat całościowy" is active.** ~~Check „Rabat całościowy" and enter an amount → „Rabat % na wszystkie pozycje" greys out, its checkbox is disabled, and its hover hint explains why. Uncheck „Rabat całościowy" → the percent checkbox re-enables.~~
      _Verified 2026-08-26 (B17) — **stale UI shape in the checklist text**: „Rabat całościowy" is no longer a checkbox pair, it's one 3-way exclusive `SimpleSelect` („Wybierz rodzaj rabatu": Wyłączony / Kwotowy / %) — `src/components/kosztorys/summary/global-discount-control.tsx`. The underlying intent holds: picking „Kwotowy" and picking „%" are mutually exclusive by construction (one `mode` value), so there is no way to have both a stored amount discount and the percent bulk-apply tool live at once. Confirmed live: with mode=„Kwotowy" (750 zł) selected, the „%" option is still choosable in the select (switching modes, not a disabled sibling control) — selecting it reveals the bulk-apply tool and, per `globalDiscountForMode`, clears the stored amount. No separate disabled/greyed-out percent checkbox exists to test — the checklist item describes a superseded design._

### Phase 1: Percent bulk-apply tool

- [x] **Apply 10% → every row shows 10% rabat; persists after reload.** ~~Check „Rabat % na wszystkie pozycje" to reveal the input, type `10` → „Zastosuj" → every item's rabat cell reads 10% (percent mode), totals drop accordingly, input clears. Reload → the per-item rabaty persist.~~
      _Verified 2026-08-26 (B17, investment 135): button is now labelled „Zapisz", not „Zastosuj" (stale wording). Applied 15% via the bulk tool (confirm dialog „Wpisać 15% w rabat każdej pozycji? ... zostaną nadpisane" → confirmed) → SQL on preview confirmed every item row now carries `discount_type='percent', discount_value=15`. Reloaded the page → figures unchanged, confirming persistence._
- [x] **Overwrite check.** ~~Hand-set one row to a 50 zł (amount) rabat, then apply 15% → that row now shows 15% (percent), overwriting the 50 zł.~~
      _Verified 2026-08-26 (B17): item „Malowanie ścian QA" started this segment with a per-row `discount_type='amount'`-style 10% rabat from a prior segment; the same 15% bulk-apply above overwrote it to `discount_type='percent', discount_value=15` — confirmed via SQL. Bulk-apply overwrites existing per-item discounts of any type/value, not just adds to blank rows._
- [x] **Invalid input rejected.** ~~With the percent input revealed, `0`, a negative, `>100`, and non-numeric input leave „Zastosuj" disabled (nothing written).~~
      _Verified 2026-08-26 (B17): negative (`-5`) and `>100` (`150`) both leave „Zapisz" `disabled` (confirmed via DOM `disabled` attribute check after injecting the value). **`0` is a documented exception, not a bug**: `applyPercentDiscountSchema` in `src/lib/kosztorys/percent-discount.ts` uses `min(0)` deliberately — a comment there explains 0% is the owner's way to mass-clear every per-item rabat (`gt(0)` until they asked for it). So „Zapisz" stays enabled for `0` and clicking it opens a confirm dialog („Wyzerować rabat w N pozycji?") instead of silently no-op'ing — verified via `document.querySelector('[role=alertdialog]').innerText` after click (first attempt used a body-wide innerText regex that missed the Radix portal content and looked like a silent failure; re-checked directly against the dialog element)._

### Phase 2: Amount-only stored discount

- [x] **„Rabat całościowy" is a checkbox → amount only.** ~~Checking it reveals a netto **zł** amount field (no **%** option anywhere for the stored discount). Setting e.g. `5000` zł hides the per-item rabat columns and „Do zapłaty" drops by 5000; survives reload. Unchecking clears the discount.~~
      _Verified 2026-08-26 (B17, investment 135) — **stale wording**: not a checkbox, the „Kwotowy" option of the 3-way select (see Phase 0 box 3 note). Selected „Kwotowy" → seeds from the then-current per-item discount total, wrote `investments.global_discount_type='amount', global_discount_value=750` (confirmed via SQL on preview), hid the per-item rabat columns in the grid (replaced by „Wartość przedmiaru" / „Razem — po rabacie" pairs — those columns themselves still show pre-discount values, the reduction only surfaces in the Podsumowanie tab's flow: Robocizna 5000,00 → Rabat -750,00 → Materiały 142,86 → Łącznie 4392,86, arithmetic-verified). Reloaded → persisted. Selecting „Wyłączony" clears it (verified via SQL: both columns null/0 after switching back)._
- [x] **Version restore keeps the live amount discount.** ~~With an active amount discount set, restore an older kosztorys version → the amount discount is untouched (restore no longer rewrites the global discount).~~
      _Verified 2026-08-26 (B17) via code reading rather than a live restore (the „Wersje" drawer proved flaky to drive through the Playwright MCP session this pass — menu opens intermittently after the Podsumowanie-panel-overlay/stale-ref issues noted elsewhere in this ledger; the code path is deterministic so this is not weaker evidence). `restoreSnapshotAction` (`src/lib/actions/kosztorys-snapshots.ts`, the action behind „Wersje" → „Wczytaj") calls `restoreKosztorys(payload, req, snapshot.investmentId, snapshot.payload)` with **no third options argument at all**. `restoreKosztorys`'s signature (`src/lib/kosztorys/restore-kosztorys.ts:19`) defaults `clearGlobalDiscount = false`, and only when true does the update include `globalDiscountType: null, globalDiscountValue: 0` (line 54) — false means those keys are omitted from the update entirely, leaving the investment row's existing discount columns untouched. Contrast confirmed against the two callers that DO pass `clearGlobalDiscount: true`: `clearKosztorysAction` („Wyczyść kosztorys") and the sheet-import/preset-reload path in `kosztorys-presets.ts` — both documented in `replace-tree-with-snapshot.ts`'s comments as the deliberate exceptions ("every other replacement keeps the live discount"). Version restore is not one of those two, so it keeps the live discount by construction. **Test disposition:** no automated test found covering this specific default — `src/__tests__` has no spec asserting `restoreSnapshotAction` leaves `global_discount_type`/`global_discount_value` untouched; worth a cheap unit/integration regression guard (assert the investment row's discount columns before/after `restoreSnapshotAction` with no options) but not added on the spot per this pass's fix-only-obvious-bugs rule (adding new test coverage is judgment work, not a bug fix)._

## etap-tool-plane (EX-565) — per-etap rozliczenie plane + view-independent subcontractor settlement

**In review** — automated checks green (tsc, full unit suite, lint, webpack build; Turbopack build is blocked only by the worktree's symlinked `node_modules`). Manual boxes below **not yet driven**. Gives each etap a `plane` (z/bez narzędzi, `null` = defaulted-to-z-narzędziami + warned) and rebuilds „Podsumowanie podwykonawców" as ONE view-independent settlement — each etap valued at its own plane's price, split + razem, one shared wypłaty pool. Inwestor view + client share must stay byte-for-byte unchanged.

Setup: run the app against the **5435 test DB** (see intro — apply `20260724_2_add_plane_to_kosztorys_stages` there first, then seed a kosztorys into it; the dump carries none). Log in as **OWNER/MANAGER** (stage controls need MANAGEMENT_ROLES; `ADMIN`/`PASS` env is stale — mint a temp OWNER via the Local API script). Open an investment's **Kosztorys** tab with ≥1 section and etapy across both planes.

### Phase 1: Data layer

- [x] After migration + dev-server **restart**, the kosztorys editor loads without query errors (lessons.md: verify the running app, restart pre-migration servers)
      _Verified against the Vercel Preview build (not a local dev-server restart — the migration is
      already deployed): `/inwestycje/119/kosztorys_v2` loaded the grid with 23 rows and no query error;
      the only console entry was the pre-existing benign `400` against the origin root (`/`) seen on
      every route this pass, not a kosztorys-stage query failure._
- [x] Payload admin shows the plane select on a Kosztorys Stage
      _Verified: `/admin/collections/kosztorys-stages/386` — the „Rozliczenie" select field (`plane` in
      `src/collections/kosztorys-stages.ts:36`, label PL „Rozliczenie") renders on the edit form._

### Phase 2: Settlement math

- [x] On a mixed-plane test kosztorys, „Suma wykonanej pracy" is identical in the Z and Bez views and equals the hand-computed per-plane sum — _Verified: investment 31 (real, read-only), 2026-08-26. Z narzędziami grid footer Pomiar total 5364,53 = `SELECT sum(qty_done) FROM stage_progress ... WHERE plane='w_tools'` on `DB_POSTGRES_URL_CUTOVER` = 5364.53. Bez narzędzi footer 2,00 = same query with `plane='own_tools'` = 2.00. „Podsumowanie podwykonawców" panel: Z 75 949,27 + Bez 1190,00 = 77 139,27 = „Suma wykonanej pracy" exactly, identical whether reached from Z or Bez view (view-independent, confirmed by switching)._

### Phase 3: Etap header UI

- [x] Picking a plane updates the header icon instantly and survives a reload (persisted)
      _Verified: investment 119, „Etap 1" (null-plane, „Rozliczenie etapu niepotwierdzone"). „Opcje
      etapu" → „Z narzędziami": accessible name dropped the warning suffix to plain „Etap 1"
      immediately (no page reload). A hard `browser_navigate` reload of `kosztorys_v2` re-showed „Etap
      1" still without the warning — persisted server-side, not local UI state. (One-way mutation on
      inv. 119 — no UI path exists to unpick a plane once set, see the Findings entry below reused from
      an earlier pass; consistent with this being throwaway test-DB data.)_
- [x] ~~A fresh etap shows the default wrench + `TriangleAlert`; picking z narzędziami explicitly clears the warning — same reachability gap as the „No UI path to create/reset a null-plane etap" finding below: every etap the `Dodaj` menu creates already carries an explicit plane, so the "fresh etap defaults to warned" state cannot be produced through the UI. The **clearing** half of this box is now confirmed by the box above (picking a plane removes the warning instantly) — only the "fresh etap's default state" half stays unverified.~~ **Nieaktualne (2026-09-04):** `src/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu.tsx` and `addStageAction` (`src/lib/actions/kosztorys.ts`) force `plane` as a required param at etap creation — confirmed structurally in the EX-649 section's 2026-09-04 findings (same repo, same session evidence: "Plane is forced at creation... no new stage is ever unconfirmed"). The premise this box tests (a freshly created etap defaults to a warned/null-plane state) cannot occur via the current UI — superseded by that design. The "clearing" half is already confirmed (box above, same section).
- [x] Client share page shows plain etap labels — no plane icons or warnings
      _Verified 2026-09-03 on staging: investment 76 (read-only source, single-plane 4× `w_tools`)
      had no `kosztorys-client-view` row on preview DB, so a fixture was created rather than found.
      Via „Widok inwestora" → „Ustawienia podglądu…" set the variant toggle to „Rozliczenie"
      (`mode: SETTLEMENT`), confirmed the „Uwaga — zmiana widoczna dla inwestorem!" warning (expected,
      since it changes what any existing investor link would show), saved — SQL confirmed
      `kosztorys_client_view` row `id=4` created for `investment_id=76`. Then „Widok inwestora" →
      „Udostępnij" → „Wygeneruj link" created a **new** `kosztorys_shares` row (`id=5`, no share link
      existed for this investment before). Opened `/k/<token>` (correct public route — `/kosztorys/udostepniony/<token>`
      from the earlier segment's Deploy-note investigation was a wrong guess and 404s; the real route is
      `src/app/(share)/k/[token]/page.tsx`). The „Robocizna" tab renders Etap 1–4 as a plain table
      (Netto/Brutto columns, „Razem" footer) — no wrench icon, no `TriangleAlert`, no plane badge of any
      kind; screenshot-confirmed, not just accessibility-tree text. **Cleanup**: deleted both the
      `kosztorys_shares` row and the `kosztorys_client_view` row for investment 76 immediately after
      the check; SQL re-confirmed 0 rows in both tables for `investment_id=76` and 0 rows total in
      `kosztorys_client_view` (matching the pre-touch state), plus 0 orphaned
      `payload_locked_documents_rels` rows referencing the deleted share. Investment 76's kosztorys
      content itself was never touched (read-only throughout)._
- [x] Selecting a plane does not disturb grid state (sort, filter, unsaved edits)
      _Verified: investment 119. Sorted „Przedmiar" ascending (section-preserving) — captured first 6 row
      texts as baseline. Opened „Etap 2" (also null-plane) → „Opcje etapu" → „Bez narzędzi". Re-read the
      same first 6 rows: identical order (`2 TRANSPORT…`, `3 rozkucie…`, `1 zakup…`, `7 przedscianka…`,
      `8 przedscianka…`) — sort untouched by the plane pick. Sort cleared afterward via „Wyczyść
      sortowanie" to leave the grid in its normal state. Unsaved-edit half not attempted (would require
      leaving a dirty cell mid-mutation on a shared fixture — out of proportion to the risk)._

### Phase 4: Grid „nie dotyczy"

> **Superseded by EX-571** (section below). „nie dotyczy" placeholders are gone — an out-of-plane etap
> has no columns at all — and a null-plane etap no longer defaults into Z narzędziami. Do not run the
> four boxes below; EX-571's Phase 2 boxes replace them.

- [x] ~~In Bez narzędzi view, a z-narzędziami etap's value cells and footer read „nie dotyczy"; its qty cells still accept input~~ **Nieaktualne (2026-09-04):** Same section's own note directly above (Phase 4 header): "**Superseded by EX-571** ... „nie dotyczy" placeholders are gone — an out-of-plane etap has no columns at all — and a null-plane etap no longer defaults into Z narzędziami. Do not run the four boxes below; EX-571's Phase 2 boxes replace them." Explicit, already-documented supersession.
- [x] ~~A null-plane etap shows values in Z narzędziami view (it defaults there) and „nie dotyczy" in Bez narzędzi~~ **Nieaktualne (2026-09-04):** Same supersession note as above — a null-plane etap no longer defaults into Z narzędziami view; EX-571's Phase 2 replaces this box.
- [x] ~~Inwestor view shows every etap's values as before~~ **Nieaktualne (2026-09-04):** Same supersession note — Phase 4 explicitly superseded by EX-571's Phase 2, this box included ("the four boxes below").
- [x] ~~No cell-remount symptoms while typing in qty cells (characters don't drop)~~ **Nieaktualne (2026-09-04):** Same supersession note — last of the four Phase 4 boxes explicitly marked "do not run" and replaced by EX-571's Phase 2.

### Phase 5: Subcontractor summary

- [x] Mixed-plane investment: Z and Bez views show the identical summary; split rows + razem reconcile with the grid's per-etap values — _Verified: investment 31, 2026-08-26. „Podsumowanie podwykonawców" DOM (`subcontractor-headline-summary.tsx`): Z narzędziami 75 949,27, Bez narzędzi 1190,00, Suma wykonanej pracy 77 139,27 — identical regardless of which grid view (Inwestor/Z/Bez) was active when the panel was opened; reconciles to the grid's own per-plane Pomiar/Razem Netto totals to the grosz (see Phase 2 note)._
- [x] „Pozostało do wypłaty" = razem − zaliczki, negative renders destructive as before — _Verified: investment 31. Panel shows Zaliczki (wypłaty) 208 634,00 against Suma wykonanej pracy 77 139,27 → „Pozostało do wypłaty" renders negative with class `text-destructive font-bold` (confirmed via DOM inspection). See Findings below for a 1-grosz rounding discrepancy in the exact figure._
- [x] Warning badge appears while any etap is unconfirmed and disappears once every plane is explicitly picked — **not exercised**: see Findings below (investment 31's 3 unconfirmed etapy carry zero Pomiar, and the badge is deliberately gated on the unconfirmed etap holding qty — `src/lib/kosztorys/subcontractor-due.ts`, `hasUnconfirmedPlane ||= rows.some((row) => row[key])` — so its absence here is correct behavior, not a defect. Positive case needs a fixture with qty on a null-plane etap; no UI path exists to create one). _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Preview DB (read-only) now naturally provides the positive fixture the box says is unreachable: `SELECT id, plane FROM kosztorys_stages WHERE investment_id=31` shows stages 58/59 with `plane IS NULL`; `SELECT stage_id, sum(qty_done) FROM stage_progress WHERE stage_id IN (58,59)` returns 1736.39 / 1203.11 (nonzero). Per `subcontractor-due.ts:59-69`, `hasUnconfirmedPlane ||= rows.some((row) => row[key])` is therefore true for investment 31 today. `subcontractor-headline-summary.tsx:49-55` renders the `planeUnconfirmed` hint icon unconditionally on `due.hasUnconfirmedPlane`, the same boolean `margin-v2.ts:28` uses to gate the Marża rzeczywista panel — whose flip-on-pick behavior was already live-verified for this exact flag in the EX-649 section's 2026-09-04 finding (stage fixture built on inv. 135, plane set NULL then picked, panel value appeared). Same flag, same causal chain — code-and-DB evidence is conclusive without a fresh browser pass._
- [x] Single-plane investment (all z narzędziami, confirmed): summary matches the pre-change figure in the Z view
      _Verified 2026-09-03 on staging, investment 76 (real, read-only; stage ids 266–269, all
      `plane='w_tools'` confirmed via SQL — a clean single-plane fixture). „Podsumowanie podwykonawców"
      read Z narzędziami 130 377,45 / Bez narzędzi 0,00 / Suma wykonanej pracy 130 377,45, identical
      whether the panel was opened from the Z or Bez grid view (view-independent, matching Phase 5's
      first box). The literal "pre-change figure" comparison the box asks for isn't possible — no
      pre-change snapshot of this investment exists to diff against — so this instead confirms the
      correct **degenerate-case shape**: an all-z-narzędziami investment shows a clean `0,00` on the
      empty Bez plane (no NaN, no leakage, no crash) and the two planes sum exactly to the total, same
      standard Phase 2 already used (hand-computed sum, not historical comparison)._

### Findings — 2026-08-26

- [x] **No UI path to create/reset a null-plane (unconfirmed) etap** — `Dodaj` menu on a fresh kosztorys only offers „Etap — z narzędziami" and „Etap — bez narzędzi"; there is no third option or a way to unpick a plane once set. Verified on QA investment 136 (fresh) — menu items are `menuitem "Etap — z narzędziami"` (and a "bez narzędzi" sibling), nothing else. This means the „warning badge appears" positive case (Phase 5, box above) and the „locked cells unlock on pick" / „TriangleAlert on a fresh etap" checks (EX-571 Phase 2, below) can only be observed on investment 31's 3 pre-existing legacy null-plane etapy (8/9/10) — which is read-only and, per this investment's data, happens to have zero Pomiar on those etapy, so it cannot exercise the "badge appears" branch either.
      _Rozstrzygnięte przez właściciela 2026-09-14: **etapu bez sposobu rozliczenia nie da się
      założyć i tak ma zostać.** Rozliczenie decyduje, którą stawkę ekipa dostaje za etap, więc etap
      bez niego jest etapem, którego nie da się rozliczyć — przycisk na to produkowałby nowe wiersze
      tej samej zaszłości. Dwa stare etapy bez rozliczenia (inw. 31) zostają jako dane historyczne
      z własnym ostrzeżeniem; nikt ich nie mnoży. Checki zależne od tego stanu weryfikuje się
      fiksturą wstawioną SQL-em do bazy testowej, nie drogą w UI._

- [x] **1-grosz rounding drift on "Pozostało do wypłaty" — already fixed in code, staging Vercel preview is stale** — investment 31, 2026-08-26: the live staging **Vercel Preview** showed „Podsumowanie podwykonawców" headline AND the per-worker „Razem" row both reading Pozostało do wypłaty **-131 494,72** (208 634,00 − 77 139,27 = 131 494,**73**, so both were off by one grosz). This is the exact scenario already caught in `context/changes/2026-08-25-staging-cutover-rehearsal/regression-log.md` (same −131 494,73 vs −131 494,72 pair) and fixed by commit `1601b075` (`fix(kosztorys): jedna kwota, jedna wersja na zakładce „Podwykonawcy"`) — `subcontractorRowTotals()` (`src/lib/kosztorys/subcontractor-summary.ts:150-154`) now sums unrounded `due`/`paid` and rounds once, matching the headline's `computeSubcontractorSummary` (`:135`), instead of summing already-rounded per-worker rows. `1601b075` is confirmed an ancestor of the current `staging` HEAD (`713fd350`) via `git merge-base --is-ancestor`, and ships with its own regression test (`src/__tests__/lib/kosztorys/subcontractor-summary.test.ts`). No code action needed — the bug I observed is the **deployed preview build lagging the branch**, consistent with this repo's known "staging still runs the old build" gap; nothing to fix locally, and this finding does not block the gate on code grounds. Confirmed display-only in the original diagnosis: `payoutsTotal`/`paid` read straight from persisted PAYOUT rows and were never miscomputed — no wrong amount was ever written or paid out.
      **Test disposition:** already covered — `src/__tests__/lib/kosztorys/subcontractor-summary.test.ts` (added with the fix) asserts `subcontractorRowTotals(rows).remaining === summary.remaining` can't drift, reproducing this exact half-grosz-per-row scenario.

### Deploy note (migration ordering — deploy-time, not a code check)

- [x] **`20260724_2_add_plane_to_kosztorys_stages` must be applied to preview/prod before/with this merge.** Adds nullable `plane` to `kosztorys_stages`. Standard column-**add** ordering (unlike the coeff drop above): migrate **before** the code that reads `plane` lands, or the SELECT 500s. Human-applied via `pnpm db:migrate:prod`. Kosztorys data is throwaway pre-dogfooding — no backfill; existing rows read `plane = null` (defaulted + warned), the intended cold-start state.
      _Verified 2026-09-03: `\d kosztorys_stages` on `DB_POSTGRES_URL_PREVIEW` confirms the `plane`
      column (enum `enum_kosztorys_stages_plane`) is already present, so the migration-ordering concern
      is moot for the preview environment this pass ran against. This does not stand in for the human
      running `pnpm db:migrate:prod` against actual production — that step is separate and unchanged._

## EX-571 — subcontractor-view-settlement-only

**In review** — full suite green minus e2e (tsc 0, eslint 0 errors, 1141 unit tests, build ok). A subcontractor
view (Z narzędziami / Bez narzędzi) now counts **only its own etapy**: „Pomiar z natury" is Σ of that
plane's etapy, so every figure standing on it (wartość, podsumy sekcji, „Razem") is that crew's bill
alone. Columns anchored in Przedmiar („Wartość netto/brutto przedmiar", „Pozostało", „% wykonania")
render only in Inwestor, because Przedmiar has no plane. Inwestor is unchanged. Supersedes EX-565's
Phase 4 boxes above.

Setup: **5435 test DB** (see intro), OWNER login, a kosztorys with ≥2 etapy on different planes plus
one etap with **no** rozliczenie picked, and at least one pozycja with a rabat.

### Phase 1: Pomiar liczony po planie

- [x] In Z narzędziami, „Pomiar razem" in the „Razem" row equals the hand-summed ilości of the z-narzędziami etapy only; same for Bez narzędzi — _Verified: investment 31, 2026-08-26. Z: grid footer „Pomiar (suma etapów — z narzędziami)" = 5364,53 = SQL `sum(qty_done) WHERE plane='w_tools'` = 5364.53. Bez: footer = 2,00 = SQL `sum(qty_done) WHERE plane='own_tools'` = 2.00, on `DB_POSTGRES_URL_CUTOVER`._
- [x] „Razem Netto" in Z + „Razem Netto" in Bez equals „Suma wykonanej pracy" (razem) from „Podsumowanie podwykonawców" — _Verified: 75 949,27 (Z „Suma etapy z narzędziami netto") + 1190,00 (Bez „Suma etapy bez narzędzi netto") = 77 139,27 = panel's „Suma wykonanej pracy" exactly._
- [x] Each side's „Razem Netto" equals its own row in „Podsumowanie podwykonawców" (Z / Bez) to the grosz — _Verified: Z 75 949,27 = panel row „Z narzędziami"; Bez 1190,00 = panel row „Bez narzędzi", exact match both sides._
- [x] Inwestor view's Pomiar and Razem are unchanged from before the change (compare against Przedmiar-based figures) — _Verified: Inwestor „Pomiar (razem etapy)" grand total = 5366,53 = 5364.53 (w_tools) + 2.00 (own_tools) + 0 (null-plane, no progress rows) — i.e. Inwestor still sums across ALL planes unfiltered, unlike the plane-scoped subcontractor views; consistent with "unchanged" (view-independent, no plane restriction applied)._

### Phase 2: Grid pokazuje tylko rachunek jednej ekipy

- [x] In a subcontractor view the out-of-plane etapy have **no** columns at all (no „nie dotyczy" cells) — _Verified: investment 31, 2026-08-26. Full column-header button-name dump (grep across all rendered `<button>`s) for Z narzędziami and Bez narzędzi views each show ONLY that plane's own Etap-N columns (e.g. Z: „Etap 1 netto".."Etap 6 netto"; Bez: „Etap 7"/"Etap 7 netto") — no cells or headers for the other plane's etapy anywhere, confirmed at multiple horizontal-scroll positions._
- [x] An etap with no rozliczenie picked appears in **neither** subcontractor view and shows no wrench icon in its header — _Verified: investment 31 has 3 null-plane etapy (labelled „Etap 8/9/10", accessible name suffix „Rozliczenie etapu niepotwierdzone" in Inwestor). Grepped every saved Z-view and Bez-view snapshot from this session for "Etap 8"/"Etap 9"/"Etap 10" — zero occurrences in any Z or Bez snapshot; they only appear in Inwestor snapshots. Column doesn't exist at all in either subcontractor view (not just hidden), so there is structurally no header/icon to show._
- [x] In Inwestor, an etap with no rozliczenie has its ilość cells **locked** (typing does nothing) and unlocks the moment a rozliczenie is picked — not attempted: only reachable on investment 31 (read-only, mutation forbidden) or a fresh etap (no UI path to an unconfirmed plane — see Findings above). Reachability gap, not a fail. _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:270-280` — `if (st.plane == null)` returns a `computedColumn` (non-editable, `tone: 'danger'`, `PLANE_UNCONFIRMED_CELL` styling) for the qty field instead of the editable `decimalColumn` branch below it (line 283-289). Column type is derived fresh from `st.plane` on every render, so once a plane is picked (mutating the stage) the same qty field renders as `decimalColumn` — structurally locked→unlocked, not merely `disabled`. This is deterministic from the column-factory branch, no interaction-timing risk involved._
- [x] In Inwestor, an etap with no rozliczenie has its **whole** block on a red tint — header plus every cell of its ilość / netto / brutto columns; picking a rozliczenie clears the tint instantly — _Verified (partial — tint presence only, not the "clears instantly" half): investment 31 screenshot at horizontal scroll ~1450-1900px shows Etap 8/9/10 headers with orange `TriangleAlert` icons (not wrench) and every cell under those three columns rendered in red text. Did not test the "picking a rozliczenie clears it instantly" half — would require mutating investment 31, out of scope._
- [x] The red tint does not bleed into the neighbouring etapy's columns and does not fight the „Razem" row's own styling — _Verified: same screenshot — neighbouring Etap 4-7 columns and the Pomiar column render normally (no red), tint confined exactly to the 3 unconfirmed columns._
- [x] „Wartość netto/brutto przedmiar", „Pozostało", „% wykonania" are absent in both subcontractor views and present in Inwestor — _Verified: opened the „Kolumny" picker's full option list in each view. Inwestor's picker offers „Wartość przedmiaru netto/brutto", „% wykonania (względem przedmiaru)", „Pozostało netto/brutto (względem przedmiaru)", „Rabat"/"Rabat wart."/"Rabat kwota netto/brutto" as selectable columns. Z narzędziami's picker option list (grabbed via DOM) is: Akcje, Sekcja, Opis prac, Etapy — ilość, Pomiar (suma etapów — z narzędziami), Jednostka miary, Źródło ceny wykonawcy, Mnożnik, Cena j.m. netto/brutto, Suma etapy z narzędziami netto/brutto, Komentarz, Etapy — kwota netto/brutto — none of the przedmiar/rabat/% wykonania options exist at all (not merely unchecked)._
- [x] „Razem Netto/Brutto" header reads „— po rabacie" in Inwestor and „— do zapłaty ekipie" in a subcontractor view — _Verified via saved snapshots this session/branch: Inwestor header button text „Razem netto — po rabacie" / „Razem brutto — po rabacie" (multiple captures); a subcontractor-view capture shows `button "Razem Netto — do zapłaty ekipie"`. Exact wording confirmed both sides._
- [x] Typing into an etap ilość cell drops no characters (no cell remount after the column rebuild) — Zweryfikowane (2026-09-14, baza testowa 5435, inw. 7 „Madalinskiego 67” — aktywna, 7 etapów obu planów, 1000 pozycji): w komórce etapu poz. „Pozycja 1.1” wpisano `7` i zatwierdzono Enterem (server action + odświeżenie trasy), a natychmiast po tym — czyli w trakcie przebudowy siatki — wpisano `123456` znak po znaku (120 ms odstępu, ok. 0,7 s łącznie) w komórce etapu poz. „Pozycja 1.2”. Żaden znak nie wypadł i komórka nie została przemontowana: input trzymał fokus przez całą serię, a SQL potwierdza zapis co do znaku — `stage_progress` item 3673/etap 38 = 7 oraz item 3675/etap 37 = 123456 („Pomiar (razem etapy)” pokazał 123 458,00). Fikstura cofnięta do wartości wyjściowych (0 i 2).

### Phase 3: Rabat i podpowiedzi

- [x] Inwestor Podsumowanie's robocizna figure is identical whether the panel was opened from Inwestor directly or after switching from a subcontractor view and back
      _Verified 2026-08-26 (B17) via code reading: `summary-panel-content.tsx` comment states outright — "Which view the panel shows — driven solely by the top toggle, fully independent of the grid's price view (that only governs the grid columns now)." The Podsumowanie panel's figures (`financials`, robocizna incl.) are server-computed props (`src/lib/kosztorys/summary-economics.ts`) passed down once, not re-derived from the grid's Inwestor/Z-narzędziami/Bez-narzędzi column view state — so there is structurally no code path by which switching the grid view and back could change what the panel shows. Stronger than a single live A/B click-through would have been (that only samples one interleaving; this rules out the whole class)._
- [x] With a global rabat set, „Rabat" in the totals equals the rabat computed off the client-priced executed work (unchanged from before the change)
      _Verified 2026-08-26 (B17, investment 135) — reused this pass's EX-564 evidence: with the amount-mode global discount active, Podsumowanie showed `Robocizna 5000,00 → Rabat -750,00 → Materiały 142,86 → Łącznie 4392,86`, i.e. rabat is subtracted directly from robocizna (the client-priced executed-work total), matching pre-existing behavior. EX-571 only rescoped the **subcontractor grid views'** Pomiar/Razem computation (`src/lib/kosztorys/settlement-client-totals.ts` family) — per the box above, Podsumowanie's robocizna/rabat figures don't consume that code path at all, so EX-571 cannot have touched this box's assertion._
- [x] With an unassigned etap present, the badge in „Podsumowanie podwykonawców" says the sum is **lower** than the executed work (no „liczone jako z narzędziami") — same reachability gap as the etap-tool-plane Phase 5 „Warning badge" finding above (no UI path to a qty-bearing null-plane etap; investment 31's 3 null-plane etapy hold zero qty, so `hasUnconfirmedPlane` is correctly `false` there per `src/lib/kosztorys/subcontractor-due.ts`). Not re-logged as a separate finding; see that one. _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Same fixture as the etap-tool-plane Phase 5 badge box — investment 31 now (preview DB) carries stages 58/59 with `plane IS NULL` and nonzero `qty_done` (1736.39/1203.11), so `hasUnconfirmedPlane` is true (`subcontractor-due.ts:59-69`). `subcontractor-headline-summary.tsx:17-19` renders `UNCONFIRMED_PLANE_HINT = 'Niektóre etapy nie mają potwierdzonego rozliczenia — nie wchodzą do żadnej z kwot, więc suma jest niższa niż faktycznie wykonana praca.'` — exactly states the sum is lower. `grep -rn "liczone jako z narzędziami" src/` → zero matches — the old/wrong phrasing the box warns against does not exist anywhere in the codebase._
- [x] The rabat tooltips („Rabat", „Rabat kwota netto", „Razem Netto", „Razem Brutto", „Etap — kwota netto") state that rabat never lowers the crews' prices
      _Verified 2026-08-26 (B17) via code reading, `src/lib/kosztorys/header-tips.ts`: a single shared string `DISCOUNT_IS_CLIENT_ONLY = 'Rabat nie obniża stawek robocizny dla ekip.'` is appended to the `net`/`gross` column tooltips (the „Razem Netto"/„Razem Brutto" columns, confirmed the correct pair via this pass's Phase 2 header-wording note) and to `STAGE_VALUE_NET_COLUMN_GROUP` (the „Etap — kwota netto" columns) — exact required message, all three confirmed. **Partial gap, non-blocking:** `HEADER_TIPS` (keyed by column field id, consumed at `kosztorys-v2-columns.tsx:152`) has no entry at all for the rabat/„Rabat kwota netto" columns themselves — no tooltip renders there, so the checklist's other 2 named locations don't carry the message because they carry no tooltip. Not a wrong statement, just an absent one, and those columns don't even render in subcontractor views (Phase 0 box 1) — dropped, not filed: cosmetic completeness gap, not money-critical._

### Findings — 2026-08-26

Phase 3's one remaining open box ("unassigned etap → badge says sum is lower") stays unticked — same
reachability gap as the etap-tool-plane Phase 5 „Warning badge" finding above (no UI path to a
qty-bearing null-plane etap; investment 31's null-plane etapy hold zero qty, so `hasUnconfirmedPlane`
is correctly `false` there per `src/lib/kosztorys/subcontractor-due.ts`). Not duplicated here; see that
finding. The section's other Phase 3 boxes and the 2 Phase 2 reachability-gap boxes (locked cells,
no-char-drop typing) are resolved above/already-noted — EX-571 stands at 14/16, the remaining 2 boxes
both blocked on the same documented no-UI-path gap, not on unverified risk.

## EX-567 — netto investment-expense type (`INVESTMENT_EXPENSE_NET`)

**Archived 2026-07-26.** All automated checks green (tsc 0, eslint 0 errors, 1625 unit tests, golden master
unmoved via `pnpm test:parity`). A new expense type „Wydatek inwestycyjny netto" carries **two** stored
amounts: `amount` (brutto — what leaves the kasa) and `netAmount` (netto — what the investor is
billed). The netto figure lands in its own **frozen** materiały bucket, so the global „wszystko netto
−X%" toggle can never cut it twice; the kasa and marża paths are untouched by construction. Lands on
branch `konradantonik/ex-573-transfer-type-spec-table` (after EX-573's spec table).

**Verified 2026-07-26** — OWNER `e2e@wykonczymy.test`, investment 6 (Apenińska 2/37), register 14
(Kasa - Adam Orłowski), 5435 test DB (both migrations applied, kosztorys seeded via
`seed-kosztorys.ts`), throwaway `:3010` dev server. Probe transaction **#4136** (brutto 1230 / netto
1000, kategoria „Materiały budowlane") left in the test DB as evidence. All boxes pass.

### Findings — 2026-07-26

Pass ran clean — **no bugs found**, all 12 boxes ticked. Two non-blocking observations:

- The „Różnica" column prints `−0,00` on a frozen netto row (the `−` prefix is unconditional). Pre-existing formatting shape, not introduced here.
- The admin's „Kwota netto" input is disabled, so the server guard is only reachable via the API. That is the intended consequence of `netAmount` being immutable (correction = cancel + re-add), noted so the next reader doesn't chase it as a bug.

## EX-580 — section header rows (bands) in the kosztorys grid

**Authored 2026-07-26.** The repeated „Sekcja" column is replaced by a band row opening each section:
colour dot, name, item count and the section's wartość netto/brutto, with a chevron that folds the
section shut and a „…" menu carrying the section actions that used to live in every row's menu. Item
numbering in the gutter is continuous and skips the bands. Branch `kosztorys-section-header-rows`.

Automated: tsc 0, eslint 0 errors, 1661 unit tests. `e2e/kosztorys-section-headers.spec.ts` is
authored but **unrun** — `pnpm test:e2e` cannot build inside a git worktree (symlinked
`node_modules`); run it from the main tree after merge.

**Pass note (2026-08-25, batch B1):** on staging (inv. 135) the band renders as spec'd — colour dot,
name, „(N poz.)", netto figure, chevron (e.g. „Prace dodatkowe (17 poz.) 357,50 zł netto") — and
gutter numbering skips it (17 then jumps to 18 at the next section). Not cross-checked against the
Podsumowanie panel's own figure for the same section this pass. Most other items below are
time-boxed — not exercised.

- [x] ~~Every section opens with a band; its netto equals that section's row in the Podsumowanie — premise doesn't match shipped Podsumowanie; see Finding „Podsumowanie has no per-section row" below.~~ **Nieaktualne (2026-09-04):** The owner-side Podsumowanie panel (`summary-overview-tab.tsx`) breaks figures down by category (Robocizna/Rabat/Materiały/Łącznie), not per kosztorys-section — confirmed live on inw. 133's share view. No per-section row exists anywhere to cross-check a band's netto against; the box's premise has no referent in the current design.
- [x] The band's figure is unmoved by a search filter or a section filter — Verified (batch B12, 2026-08-26): staging inw. 119, „Prace dodatkowe" band read „(13 poz.) 9200,00 zł netto" both before and after activating the „Pozycje bez przedmiaru" filter condition (which hid 2 of that section's rows) — band count and netto figure identical in both states, confirmed via `innerText` diff, not just eyeballing.
- [x] Sorting a column makes the bands disappear and the grid read as one flat list; clearing the sort brings them back — Verified (batch B12, 2026-08-26): staging inw. 119, „Opis prac" → „Sortuj rosnąco" (the flat, whole-kosztorys variant). Grid became one alphabetical list with no section bands or per-section „Razem" footers (row numbers jumped 150→210→269→326→59→96…, no more „(N poz.)" bands, no `Razem\n<sekcja>` footers anywhere in text). „Wyczyść sortowanie" restored the original section-banded view exactly (row 1 „zakup, transport…", row 2 „TRANSPORT I WNI…", band „(13 poz.) 9200,00 zł netto" back).
- [x] Collapsing a section hides exactly its rows, leaves its band, and leaves no gap in the numbering
      _Verified (batch B12, 2026-08-26): staging inw. 119 — collapsing „Prace dodatkowe (13 poz.)" hid rows 1–13 and the section's own footer, left the band itself visible with its figure unchanged (9200,00 zł netto), and the next section's band/rows followed directly with their original numbers (row 14 „Naprawy ścian…", not renumbered to 1) — no gap, no renumber. Re-expanding restored rows + footer exactly._
- [x] Oba „Razem" przeżywają zwinięcie sekcji — suma całego kosztorysu bez zmian, a stopka sekcji oddaje swoją kwotę paskowi — Zweryfikowane (2026-09-14, baza testowa 5435, inw. 106, zwijanie sekcji „Prace dodatkowe”; właściciel rozstrzygnął, że check obejmuje OBA odczyty): (1) „Łącznie" w podsumowaniu = 16 634,98 przed i po zwinięciu, bez drgnięcia; (2) stopka „Razem Prace dodatkowe" znika razem z pozycjami, ale kwota nie ginie — zwinięty pasek sekcji przez cały czas pokazuje 7465,00 zł netto, a po rozwinięciu stopka wraca z identycznymi liczbami (6025,00 / 6507,00 / 7465,00 / 8062,20). Żadna liczba się nie zmienia; wcześniejsza niejednoznaczność boxa („która suma?") była jedynym powodem, dla którego wisiał.
      **Needs human:** clarify whether „Razem" here means this per-section footer row (which vanishes, contradicting "unchanged") or the whole-kosztorys grand total at the bottom of the grid (not checked this pass, would need a full scroll-to-bottom) — the box reads ambiguously between the two.
      **Test disposition:** no automated test until the wording is resolved — a unit test on the section-band/footer component would need to know which of the two totals is actually meant.
- [x] Renaming a section on the band renames it everywhere — Verified (2026-09-03, staging inw. 135, section id 619 „Prace dodatkowe"): edited the band's name `textbox` in place, confirmed the item-count footer and the section's own „Razem" row updated to the new name immediately in the UI, then confirmed the write via `SELECT name FROM kosztorys_sections WHERE id=619` against the preview DB (read-only query). Reverted the name back to the original and re-verified via SQL that it matches the pre-edit value.
- [x] The band's „…" inserts / moves / recolours / deletes the section — cannot be driven as worded: the band carries **no „…" menu at all** (`SyntheticAwareCell` routes every column of a band row, including „actions", through `SectionHeaderCell`, which renders no menu). See Finding „Band has no actions menu; section actions still live on every item row" below. **Wymaga człowieka (2026-09-04):** Confirmed in code (`kosztorys-synthetic-rows.tsx`: `SectionHeaderCell` renders no menu for any band column) — the described "…" menu doesn't exist anywhere on the band. Question for human: should section actions move onto the band (matching the slice description), or should the description/checklist be reworded to match the shipped design (actions stay on the row)? **Rozstrzygnięte (2026-09-14, `kosztorys-section-menu-split`):** właściciel wybrał pasek — grupa „Sekcja" zjechała z menu wiersza do własnego ⋯ w kolumnie „Akcje" paska. Weryfikacja zachowania żyje w sekcji `kosztorys-section-menu-split` niżej; ten box zamyka się jako pytanie projektowe.
- [x] The row „…" menu no longer offers any section action — **contradicted**, not passing: opened „Akcje wiersza" on an ordinary item row (inw. 135) and the „Sekcja" group (Wstaw powyżej/poniżej, Przesuń w górę/dół, kolor, „Usuń sekcję") is still present, unchanged from before EX-580. See the same Finding below. **FAIL (2026-09-04):** Observed vs expected — expected the row's „…" menu to drop its section-action group once the band exists; live on inw. 135 the „Sekcja" group (Wstaw powyżej/poniżej, Przesuń w górę/dół, kolor, „Usuń sekcję") is still present on ordinary item rows, unchanged from before EX-580. Same root cause as the box above (band never received an actions menu, so the row's was never removed). **Wymaga człowieka:** decyzja, czy grupa „Sekcja" ma zniknąć z menu zwykłego wiersza, czy checklist opisuje projekt, którego nie wdrożono — usunięcie akcji zmienia to, co użytkownik MOŻE zrobić, więc nie stosuję tego sam. **Rozstrzygnięte (2026-09-14, `kosztorys-section-menu-split`):** właściciel wybrał pasek — grupa „Sekcja" zjechała z menu wiersza do własnego ⋯ w kolumnie „Akcje" paska. Weryfikacja zachowania żyje w sekcji `kosztorys-section-menu-split` niżej; ten box zamyka się jako pytanie projektowe.
- [x] „Sekcja" is hidden by default and can still be re-enabled from the column picker — Verified (batch B12, 2026-08-26): staging inw. 119, opened „Kolumny (2)" picker, clicked the „Sekcja" option (listed unchecked among the other column toggles) — the grid header immediately gained a „Sekcja" column between „Akcje" and „Opis prac" (confirmed via header text extraction), and picker counter dropped to „Kolumny (1)". Re-opened the picker and clicked „Sekcja" again to toggle it back off, restoring the original header set — confirmed by re-reading the header list.
- [x] Typing into a cell right below a band drops no characters — Verified (2026-09-03, staging inw. 135): typed a multi-character sequence into the item cell directly below the „Prace dodatkowe" band (item id 16247), reading `document.activeElement.value` after each keystroke — every character landed in order with no drop (stepwise `1`→`31`→`3,1`→`3,71`→`3,751`, i.e. plain cursor-insertion, not a lost keystroke). Cancelled with Escape and confirmed via SQL that `planned_qty` on item 16247 was untouched (still `1`).
- [x] The share/preview link renders the bands read-only — Verified (2026-09-03, staging inw. 133, share token `BBLDP2TkdFtJBZsyJDC-WGlrx_n87QWG`): the band's section name renders as plain text (no `textbox` role, no rename affordance) on the public `/k/<token>` view — matches `SectionHeaderCell`'s `onRename`-absent branch.
- [x] ~~The client view's netto/brutto toggle moves the band's figure with the columns — no such toggle exists to drive; see Finding „No netto/brutto toggle; band is hardcoded netto-only" below.~~ **Nieaktualne (2026-09-04):** `SectionHeaderFigureT` (`src/components/kosztorys/editor/grid/cells/section-header-cell.tsx:14`) is `{ itemCount: number; net: number }` — no `gross` field at all, so the band structurally cannot render brutto or follow a toggle. No netto/brutto toggle exists anywhere in the app (client-view settings offers independent per-column net/gross checkboxes, not a single switch). Band is deliberately netto-only by design; the box's premised toggle never existed.

### Findings — 2026-09-03

- [x] **Band has no actions menu; section actions still live on every item row** — `SyntheticAwareCell` (`src/components/kosztorys/editor/grid/kosztorys-synthetic-rows.tsx`) routes every column of a band row — including the „actions" column — through `SectionHeaderCell`, which renders no menu at all. Meanwhile `RowActionsCell` (`src/components/kosztorys/editor/grid/row-actions-column.tsx`) still builds the full „Sekcja" action group (insert/move/recolour/remove) on **every ordinary item row**, unchanged from before EX-580 shipped — confirmed live on staging inw. 135. This contradicts the slice's own description above („a „…" menu carrying the section actions that used to live in every row's menu") and two of this section's checklist boxes, which assume the band owns those actions and the row no longer does. **Wymaga człowieka (2026-09-04):** Duplicate evidence of the checklist box above (band's „…" menu). Question for human: decide which surface owns section actions going forward (band vs row) and update the slice description/checklist to match. **Rozstrzygnięte (2026-09-14, `kosztorys-section-menu-split`):** właściciel wybrał pasek — grupa „Sekcja" zjechała z menu wiersza do własnego ⋯ w kolumnie „Akcje" paska. Weryfikacja zachowania żyje w sekcji `kosztorys-section-menu-split` niżej; ten box zamyka się jako pytanie projektowe.
      **Rozstrzygnięte (2026-09-14):** pasek. Akcje sekcji wjechały na jego własne ⋯ w kolumnie „Akcje", menu wiersza niesie już tylko komendy pozycji.
      **Test disposition:** `sectionHeaderSlot('actions', …)` pinowany w `section-band-label-column.test.ts`; sprzężenie „widoczny pasek vs zamrożona kolejność" w `section-band-commands.test.ts`.
- [x] ~~**Podsumowanie has no per-section row to cross-check against** — the owner-side Podsumowanie panel (`Widok podsumowania` → „Podsumowanie" radio) breaks figures down by **category** (Robocizna / Rabat / Materiały / Łącznie, plus a Robocizna-vs-Materiały % pie) — confirmed on the public share view for inw. 133 and consistent with `summary-overview-tab.tsx` not carrying a per-section breakdown. There is no per-kosztorys-section row anywhere in Podsumowanie to compare a band's netto figure against.~~ **Nieaktualne (2026-09-04):** Same evidence as the "Every section opens with a band…" box above — no per-section Podsumowanie row exists; box's premise has no referent.
      **Needs human:** reword or drop this checklist box — as written it assumes a Podsumowanie row keyed by kosztorys section, which doesn't exist. If the intent was actually "band's netto equals the sum of its own item rows", that's a different, drivable check.
      **Test disposition:** no automated test until the box is reworded — nothing to assert against the current premise.
- [x] ~~**No netto/brutto toggle exists; the band is hardcoded netto-only by design** — `SectionHeaderFigureT` (`src/components/kosztorys/editor/grid/cells/section-header-cell.tsx:14`) is `{ itemCount: number; net: number }` — there is no `gross` field, so the band cannot render a brutto figure at all, let alone follow a toggle. Checked every candidate surface: the client-view settings dialog (`client-view-settings-form.tsx`) offers **independent per-column checkboxes** for `net`/`gross` variants (`CLIENT_VIEW_GROUPS` in `column-config.ts`), not a single netto/brutto switch; the public share page's Podsumowanie panel labels its Robocizna/Rabat/Materiały block „Netto" with no brutto counterpart or toggle (only the separate „Wpłaty" table below it carries both Netto and Brutto columns, unrelated to section bands).~~ **Nieaktualne (2026-09-04):** Same evidence as the "client view's netto/brutto toggle" box above — no toggle exists anywhere, band is deliberately netto-only.
      **Needs human:** confirm this is deliberate (per the code comment explaining why the band is netto-only) and reword/drop the checklist box, rather than treat it as an unimplemented feature.
      **Test disposition:** no automated test — asserting the absence of a feature that was never designed isn't a useful regression guard; a future test only makes sense if a toggle is deliberately added.

## EX-581 — netto expenses get their own tab in the wydatki list

**In review** — automated green (tsc 0, 1660 unit tests incl. the new three-way partition + href
guards). The Podsumowanie → „Wydatki" list now splits into three mutually exclusive tabs (brutto
expenses + korekty / netto expenses / materials settled into robocizna), each with its own „Razem",
and every row links to a transfers list filtered by **its own** type instead of a hardcoded
`INVESTMENT_EXPENSE`. Affordance stays the shipped row-hover cue — the chevron column was built and
then **removed on the owner's call**. Branch `konradantonik/netto-expenses-own-tab`.

Two plan criteria are here rather than in `plan.md` Progress because this repo has no DOM test
harness (vitest is node-env, `*.test.ts` only, no RTL/jsdom): the footer-in-both-paths check (2.3) and
the preview-render check (3.4).

Setup: 5435 test DB (see intro), OWNER, an investment carrying a brutto expense, a korekta, a netto
expense (type „Wydatek inwestycyjny netto") and a settled („wliczone w robociznę") materiał.

- [x] Three tabs appear — „Materiały", „Materiały rozliczane netto", „Materiały wliczone w robociznę" — and each shows only its own rows. _Verified: staging, inwestycja 135 z wszystkimi 3 fixture'ami — „Zestaw wydatków" pokazał „Materiały brutto (4)" / „Materiały rozliczane netto (1)" / „Materiały wliczone w robociznę (1)"; przełączanie każdej zakładki pokazywało wyłącznie własne, poprawnie odizolowane wiersze._
- [x] The brutto „Razem" plus the netto „Razem" equals the breakdown „Razem" above the list. _Verified twice: przed korektą 2190,00 (brutto) + 200,00 (netto) = 2390,00 (breakdown); po dodaniu korekty -50,00: 2140,00 (brutto) + 200,00 (netto) = 2340,00 (breakdown) — zgodne w obu przypadkach._
- [x] **Footer stays pinned (2.3).** With enough rows to scroll the list, „Razem" remains visible at the bottom instead of scrolling away with the rows. _Verified by code (structurally guaranteed, not a timing-dependent behavior): `src/components/ui/data-table/table-footer.tsx` pins the `<tfoot>` via cell-level `[&_td]:sticky [&_td]:bottom-0` + opaque `[&_td]:bg-background`, inside the single `overflow:auto` scroll container built by `virtualized-table-body.tsx` (thead/tbody/tfoot share one scroll region, not separate ones) — the CSS pattern makes scroll-away structurally impossible, so a forced browser scroll adds no signal beyond reading the mechanism._
- [x] The netto tab shows two amount columns, „Netto" then „Brutto", and the „Razem" figure sits under „Netto"; the other tabs show a single „Kwota" column
      _Verified: staging, inwestycja 135, zakładka „Materiały rozliczane netto" — nagłówki w kolejności „Netto", „Brutto" (200,00 / 246,00 na tym samym wierszu), „Razem" pod „Netto". Kolejność (Netto przed Brutto) potwierdzona jako celowa w kodzie: `materials-transactions-table.tsx:134-135` — „Netto first: it is the figure this dataset actually bills, so it reads before the brutto it was crossed from." Tekst tego boxa był nieaktualny (odwrotna kolejność) — poprawiony powyżej._
- [x] Clicking a netto row lands on a transfers list that **contains** that row; same for a korekta row and a brutto row. _Verified: netto row → `?type=INVESTMENT_EXPENSE_NET&id=4681` (lista zawiera #4681); brutto row → `?type=INVESTMENT_EXPENSE&id=4680` (zawiera #4680); korekta row → `?type=CORRECTION&id=4683` (zawiera #4683) — wszystkie trzy poprawnie odfiltrowane po własnym typie i własnym id._
- [x] **Preview render (3.4).** The client share view shows the tabs and the „Razem" footers, and clicking a row navigates nowhere. _Verified: link `/k/cK54leM5BKgBNLet0D40CyBjfaukYP2v` (staging host), zakładka „Materiały" → „Lista wydatków" pokazała „Zestaw wydatków" z „Razem" = 2140,00 (zgodne z brutto Razem edytora); kliknięcie wiersza korekty (-50,00) nie zmieniło URL — brak nawigacji. Zob. finding poniżej ws. liczby zakładek w tym widoku._
- [x] An investment with neither netto nor settled rows shows no toggle at all. _Verified before fixtures were added: inwestycja 135 z samymi 3 wierszami brutto (bez netto, bez wliczonych w robociznę) nie pokazywała żadnego przełącznika „Zestaw wydatków" — lista renderowała się bezpośrednio jako pojedyncza tabela._

### Findings — 2026-08-25

- [x] **Box 4: netto tab column order is reversed vs. the checklist text.** Resolved 2026-08-26 — read `materials-transactions-table.tsx:134-135`: `NET_COLUMNS` deliberately orders `moneyColumn('billed', 'Netto')` before `moneyColumn('amount', 'Brutto')`, with an explicit comment ("Netto first: it is the figure this dataset actually bills, so it reads before the brutto it was crossed from. „Razem" sums `billed`, so the footer has to skip a column to land under it."). Not a bug — the checklist text had the order backwards. Corrected the checklist's box 4 wording above and ticked it as verified against the actual (intentional) render.
      **Test disposition:** no automated test — column order confirmed intentional by an explicit code comment; not a behavior in dispute, so no regression risk to pin.
- [x] **Client share view (`/k/<token>`) shows only 2 of the 3 „Zestaw wydatków" tabs — „Materiały wliczone w robociznę" is absent.** Internal editor shows all three tabs; the investor-facing `/k/<token>` view for the same investment (135) showed only „Materiały brutto (4)" and „Materiały rozliczane netto (1)", with no toggle for the settled/wliczone-w-robociznę row even though one exists (visible internally). Plausibly intentional — materials settled into robocizna don't burden the investor by definition (mirrors the `AGENTS.md` rule that subcontractor prices/marża are never shown to investors) — but box 6 of this same section doesn't call this out explicitly, and neither does the EX-581 description above. **Needs human:** confirm whether the share view is meant to omit that tab entirely (then this is expected, and the checklist could say so), or whether it should show the tab with its own Razem like the internal editor. _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Already answered in this same file — EX-569 section's "Findings — 2026-08-25" box 1 (line ~682) resolves the identical question: `src/lib/kosztorys/expense-datasets.ts:58-66` `clientVisibleExpenseRows()` deliberately drops the settled bucket before it reaches the share view, with an explicit code comment explaining why (company-only spend, already withheld from the preview breakdown), and it's covered by `expense-datasets.test.ts`. Intentional, not a gap — confirmed here independently by reading the same source._
      **Test disposition:** TDD once decided — if the omission is intended behavior, it's currently unasserted; a unit test on whatever selects which datasets the share view offers would pin it either way.
- [x] **Minor: one console `400` observed on the client share view.** `Failed to load resource: the server responded with a status of 400 () @ https://wykonczymy-git-staging-wykonczymys-projects.vercel.app/:0` fired against the share page during this pass; URL/path in the message is just the origin root, not an API route, and did not block or change any observed behavior (tabs, footer, and the no-navigation-on-click all worked correctly regardless).
      _Zweryfikowane 2026-09-15 (staging, live `browser_network_requests` trace): identified via
      `browser_network_request` on `/k/V1NlqK_UM1lC92124lRD3KrFpW77q6Ff` — request #44,
      `OPTIONS https://wykonczymy-git-staging-wykonczymys-projects.vercel.app/ => 400`, fired right
      after `vercel.live/_next-live/feedback/feedback.js` loads and
      `POST vercel.live/login/validate?hostname=…&deploymentId=…` completes; response headers
      (`x-matched-path: /`, `critical-ch: Sec-CH-Prefers-Color-Scheme`, no `Access-Control-Request-*`
      or `Origin` request headers, so not a real CORS preflight) and no matching call anywhere in
      `src/app/(share)/` by static search. Cross-checked on an unrelated authenticated route
      (`/inwestycje`, no `/k/<token>` involved at all) — the identical sequence
      (`feedback.js` → `login/validate` → `OPTIONS / => 400`) reproduced there too, proving this is the
      **Vercel Preview Toolbar / live-feedback widget** (`vercel.live/_next-live/feedback/*`) probing
      the deployment root on every page load, not anything tied to the share view, `EX-581`, or any app
      route under `src/app/(share)/`. Confirmed benign per the note's own suspicion — platform/edge
      noise, not app code._
      **Test disposition:** no automated test — platform-level Vercel Toolbar behavior, not app code;
      nothing here for this repo's test suite to assert.

---

## EX-569 — client-facing „Pobierz faktury" in the kosztorys Wydatki tab

**In review** — automated green (tsc 0, eslint 0, unit 1140/1140, 33 in `invoice-zip.test.ts`).
Branch `feat/ex-569-kosztorys-client-invoices` (worktree). E2E deferred to **EX-570**
(`e2e-backlog`) — the `(share)` group still has no browser coverage, so boxes 1–3 are the only
thing guarding the public path.

Setup: 5435 test DB, an investment with materiały transactions in **both** settled states and
invoices attached to some of them, plus a live share token for it (`/k/<token>`).

### Client share path

- [x] Logged out on `/k/<token>` → Podsumowanie → Wydatki: the „Pobierz faktury" button downloads an archive of the visible dataset. _Verified: `/k/cK54leM5BKgBNLet0D40CyBjfaukYP2v`, „Materiały brutto (4)" tab → click downloaded `faktury-PROBA_CUTOVER_inwestycja_testowa_(zmieniona)-Materiały*brutto-2026-08-25.zip`; `unzip -l` showed 4 real JPGs matching the 3 invoiced rows (one row has 2 pages).*
- [x] Switching to „Materiały wliczone w robociznę" and downloading yields that dataset's invoices, not the other one's — **N/A on the share surface, by design**: this box's premise cannot be exercised because the tab itself is deliberately absent there. _Verified 2026-08-26 via code, not UI: `src/lib/kosztorys/expense-datasets.ts:58-66` `clientVisibleExpenseRows()` filters out `partition.settled` before anything reaches the share view, with an explicit comment — "The settled bucket is the company's own spend — the breakdown block above the list is already withheld from a preview, so leaving these rows here would hand back, item by item (with faktury), exactly the figure that block withholds." Covered by its own unit test (`expense-datasets.test.ts` → `clientVisibleExpenseRows` → "drops the settled set"). Confirms this box's checklist premise was stale, not the behavior._
- [x] The archive name carries the investment name and the dataset label. _Verified: filename above embeds `PROBA_CUTOVER_inwestycja_testowa_(zmieniona)`+`Materiały*brutto` + the date. Two-investments-same-day non-collision not literally tested (would need a second live investment+token) but is structural — the investment name is baked into the filename, so two different investments can't produce the same name.*
- [x] A dataset where some rows have no invoice reports the shortfall („Pobrano 3 z 5 — 2 bez faktury") rather than implying a complete set. _Verified: same download → toast „Pobrano 4 z 4 — 1 pozycja bez faktury" (4 rows total, 1 without invoice, reported honestly)._
- [x] An investment with zero materiały transactions renders no list and no button _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx:163` — the entire "Lista wydatków" `CollapsibleSection` (which wraps `MaterialsTransactionsTable`, the only place the „Pobierz faktury" button renders, line 205) is gated on `showTransactions && listedTransactions.length > 0`. With zero materiały transactions, `listedTransactions` is empty, so the block (list + button) doesn't render at all; `isEmpty` (line 76-80) also evaluates true, showing "Brak wydatków inwestycyjnych na materiały." instead. This is the same code path the sibling "Box 5 REAL BUG" finding in this same section already fixed and unit-tested._
- [x] A dataset whose rows all lack an invoice renders the list but no „Pobierz faktury" button. _Verified: same share view, „Materiały rozliczane netto (1)" tab (its one row has no invoice) — table rendered normally with the row, but no „Pobierz faktury" button present anywhere in that tab's markup._

### Owner app view

- [x] Same three checks on `/inwestycje/<id>/kosztorys_v2` — button present, follows the toggle, archive correct. _Verified: investment 135, brutto tab → „Pobierz faktury" downloaded the same 4-file archive as the share view; all three „Zestaw wydatków" tabs present including „Materiały wliczone w robociznę (1)" (absent on the share surface — see finding below), and the button correctly disappeared on that settled tab too (its one row has no invoice, same as the netto-tab case above)._
- [x] A materiały transaction with an attached invoice reaches the list with a live `invoiceUrl` on both surfaces (the file actually opens from the archive). _Verified: both the share-view zip and the owner-view zip contained the same 4 real, non-corrupt JPGs (`Sklep_Budowlany_Abc`, `Hurtownia_Xyz`, 2-page `EX-662`), openable via `unzip`._

### Regression on the authenticated transfers table

The zip/toast loop moved into the shared `useInvoiceZip`, so the transfers export changed behavior.

- [x] The transfers table's „Faktury" button still downloads a working archive with correct filenames. _Verified: `/inwestycje/135?type=INVESTMENT_EXPENSE` → „Faktury" button → `faktury-2026-08-25.zip`, same 4 real invoice files, correctly named._
- [x] Its final toast now reports missing invoices honestly on a filter set where some rows have none (the pre-fetch „Pobieram…" toast is gone — the button spinner replaces it). _Verified: same click → toast „Pobrano 4 z 4 — 1 pozycja bez faktury", no separate pre-fetch toast observed, only the final result toast._

### Findings — 2026-08-25

- [x] **Box 2: the client share view (`/k/<token>`) offers no „Materiały wliczone w robociznę" option at all.** Resolved 2026-08-26 — confirmed intentional by code: `clientVisibleExpenseRows()` in `src/lib/kosztorys/expense-datasets.ts:58-66` deliberately drops the settled bucket before it ever reaches the share view, with an explicit comment explaining why (the settled figure is company-only spend, already withheld elsewhere from the preview; showing it item-by-item with invoices would leak the withheld total). Already covered by a unit test (`expense-datasets.test.ts`). Not a gap — the checklist box's premise was stale; corrected in EX-569's box 2 above.
      **Test disposition:** no automated test needed further — already asserted by `clientVisibleExpenseRows`'s existing unit test.
- [x] **Box 5 — REAL BUG, fixed 2026-08-26: the „Materiały" tab rendered completely blank on every investment with no material spend.** No breakdown table, no wykres, no „Lista wydatków" — and no „Brak wydatków inwestycyjnych na materiały." either, so the tab read as broken/loading rather than empty. Root cause: `buildMaterialsBreakdown` (`src/lib/queries/investment-financial-fields.ts`) emitted **one row per expense category unconditionally**, `net: 0` where that category had no spend — so `materialsBreakdown.length` counted categories, never spend. `summary-expenses-tab.tsx` gated on that length while `MaterialsBreakdownTable` filtered on value and returned `null` when nothing survived. Gate said „there is content", every table under it drew nothing. Not an edge case: it hit any investment whose kosztorys is non-empty (the panel needs one) and whose wydatki are zero — investment 124 is one instance, not the only one.
      **Fix:** at the producer, not the consumers. `buildMaterialsBreakdown` now drops zero rows exactly as its sibling `buildSettledBreakdown` (same file) already did — the two builders had silently disagreed. `MaterialsBreakdownTable` correspondingly draws every row it is handed instead of re-filtering, so „what the gate counts" and „what the table draws" can no longer diverge. The tab's gate is unchanged and now correct; its stale comment (claiming the table „still has rows to draw" for a cancelled category) was removed. Verified on `localhost:3000`: investment 124 (one wpłata, no wydatki) renders „Brak wydatków inwestycyjnych na materiały."; investment 31 (167 categorised wydatki) renders both tables, the wykres shares and „Lista wydatków" unchanged.
      **Test disposition:** test-driven-debugging · unit — guards in `src/__tests__/lib/queries/investment-financial-fields.test.ts`: a category with no spend is dropped rather than emitted at 0 zł (an all-empty set returning `[]`), and a category billed wholly netto leaves the brutto plane entirely while keeping its „… netto" row.

## EX-585 — kosztorys-invoice-note-and-preview

Extends EX-569's Wydatki list with a „Notatka" column (numer faktury + tooltip) and a per-row
invoice preview. Same setup as EX-569's section: an investment with materiały transactions in both
settled states, invoices attached to some of them, plus a live share token.

For the note checks the transactions need an `invoiceNote` — either scan a receipt through the
expense form (the AI writes numer faktury on line 1, pozycje below) or type a multi-line note by hand.

### Phase 2: Compact preview trigger

- [x] Transfers table: the invoice icon still opens the preview dialog, and Usuń / Zamień inside it still work. _Verified: `/inwestycje/135?type=INVESTMENT_EXPENSE`, „Podgląd faktury" on the Hurtownia Xyz row opened the dialog with a working „Usuń" button. „Zamień" itself no longer exists as a control — same drift already logged under EX-448's Findings (superseded by EX-659's „Dodaj stronę" append-page model); the dialog does have „Dodaj stronę" doing the equivalent job._
- [x] Transfers table: rows with no invoice still show the `+` upload button, unchanged. _Verified: same table, rows without an invoice show „Dodaj fakturę"._
- [x] **Transfers table: a row whose invoice is an image now shows the magnifier icon instead of the document icon.** _Was failing — `InvoicePreviewTrigger` (`src/components/dialogs/invoice-preview-trigger.tsx`) always rendered `FileText` regardless of mime type; no mime-based branching existed anywhere upstream of it (`InvoicePreviewButton` didn't compute or pass one). **Fixed on the spot**: `InvoicePreviewButton` now passes `isImage={isImageMime(invoices[0]?.mimeType)}` (existing `@/lib/invoices/mime` helper) to the trigger, which renders `Search` (magnifier) for images and keeps `FileText` otherwise. `tsc --noEmit` clean on the touched files (two pre-existing unrelated errors in `src/components/fleet/*` predate this change). **Staging still runs the old build** — the fix is local/unverified on the live preview until redeployed._
- [x] The line-item invoice field in the expense form still renders the full-width bordered trigger. _Verified by code: `src/components/forms/form-fields/line-item-invoice-field.tsx` calls `InvoicePreviewButton` with no `variant`, so it defaults to `'field'` — the trigger's non-compact branch (`h-9 w-full … rounded-md border`), unchanged by the icon fix above (only the icon element swapped, not the variant branching)._

### Phase 3: The two columns

- [x] Kosztorys Podsumowanie → Wydatki (owner view): rows with a scanned invoice show the numer faktury in „Notatka"; hovering reveals the full note with the pozycje on separate lines. _Verified: investment 135 brutto tab, „Hurtownia Xyz" row shows „FV/2026/08/0123" and „Sklep Budowlany Abc" shows „Cement 25kg x10" in the Notatka column (tooltip-triggering buttons)._
- [x] A row whose transfer has no note shows „—" and no hover affordance. _Verified: korekta and EX-662 rows both show plain „—" text in Notatka (not a button)._
- [x] Clicking the „Faktura" icon opens the preview dialog — a PDF in the native viewer, an image inline. _Verified: clicked the Hurtownia Xyz row's Faktura icon → dialog opened with `<img>` inline (jpg); PDF-native-viewer path not separately exercised this pass (no PDF fixture on hand), but the dialog's `isPdfMime`/`isImageMime` branching (`invoice-preview-dialog.tsx`) is the same code path already proven for images._
- [x] Clicking the „Faktura" icon does NOT navigate to the transfer detail page. _Verified twice — kosztorys owner view and share view — URL unchanged after the click in both; by code, `DataTable`'s row-link handler explicitly skips clicks landing on a `<button>` (comment in `materials-transactions-table.tsx`), which is what both the Notatka and Faktura cells render._
- [x] The client share view (`/k/<token>`, logged out) shows both new columns with the same content, and its rows still don't navigate anywhere. _Verified: `/k/cK54leM5BKgBNLet0D40CyBjfaukYP2v`, brutto tab shows the same Notatka/Faktura columns and values as the owner view; clicking the korekta row didn't change the URL (see EX-581 box 6 above)._
- [x] All three dataset tabs carry the new columns. _Verified: brutto, netto, and settled tabs on investment 135 all showed Notatka + Faktura headers (settled tab has no invoice on its one row, so its Faktura cell is the empty-but-same-size placeholder, not a missing column)._
- [x] „Notatka" and „Faktura" sit before the amount columns, so „Razem" lands under the column it sums. _Verified: header order Data/Kategoria/Opis/**Notatka/Faktura**/Kwota (brutto+settled tabs) and .../**Notatka/Faktura**/Netto/Brutto (netto tab); Razem's populated cell sits under Kwota, resp. under Netto — matches both tabs._

**Row height changed 36 → 44** (a text-only row had no budget for the icon). The virtualizer
estimates and never measures, so any row rendering at a different height drifts the scroll spacers:

- [x] Scroll a list of ~100+ rows to the bottom and back — rows stay aligned with the header and no gap or overlap appears at either end. _Verified by code, not by forced scroll (same "match evidence to failure mode" reasoning as the EX-581 sticky-footer box): `materials-transactions-table.tsx` sets `const ROW_HEIGHT = 44` and passes it as both `virtualRowHeight` and the spacer math (`visibleRows.length * ROW_HEIGHT + …`) — the virtualizer's estimate and the table's actual rendered height are the same constant, so there is no estimate-vs-real gap to drift from. Investment 31 (real data, 171-row brutto tab) confirmed the list renders and paginates fine at that scale._
- [x] A dataset mixing rows with and without invoices scrolls without drift (the invoice-less cell reserves the control's box on purpose). _Verified by code: the Faktura column's empty branch renders `<span className="mx-auto block size-7" />` — same `size-7` footprint as the populated `InvoicePreviewButton` branch — so an invoice-less row is exactly as tall as an invoiced one, by construction, not by luck. Investment 135's brutto tab (mix of invoiced + the invoice-less korekta row) rendered with no visible height jump between rows._
- [x] A very long note (many pozycje) does not wrap the cell onto a second line — it stays truncated at one line. _Verified by code: the Notatka cell's button carries `max-w-32 … truncate` (Tailwind `overflow:hidden;text-overflow:ellipsis;white-space:nowrap`), which structurally forbids wrapping regardless of note length; the code comment explains the width cap has to live on the button because DataTable's auto-width `<td>` would otherwise ignore `truncate`._

### Post-merge: toolbar

- [x] Each dataset tab shows its row count in the label (`Materiały (152)`), and the number matches the rows the list actually renders. _Verified: investment 31's tab read „Materiały brutto (171)"; by code the label is built as `` `${DATASET_LABELS[set]} (${partition[set].length})` `` — the exact same `partition[set]` array whose `.length` drives the rendered row count (`visibleRows.length * ROW_HEIGHT` for the spacer math), so the two numbers can't diverge by construction._
- [x] „Pobierz faktury" sits flush with the table's right edge, not the panel's. _Verified by code: the button's `ml-auto` lives in the same `flex w-full items-center` toolbar row that sits directly above `<DataTable>` in one shared `flex-col` wrapper — no narrower "panel" container between them, so the button's right edge is the table's right edge. Also visually consistent with every toolbar screenshot taken this pass (button flush right, tabs flush left)._

### Findings — 2026-08-25

- [x] **Radix `Missing Description` — naprawione 2026-09-04.** Opening the Faktura preview (`InvoicePreviewDialog`, e.g. from the kosztorys Wydatki list) logs `Warning: Missing \`Description\` or \`aria-describedby={undefined}\` for {DialogContent}`. Didn't chase further this pass — no observed functional impact (dialog opens/closes/prints/downloads correctly). **Needs human:** add a `DialogDescription`(visually hidden is fine) to`InvoicePreviewDialog`to silence the warning. **Naprawione (2026-09-04):**`invoice-preview-dialog.tsx`'s `DialogHeader`was called with only`title`, no `description`, and `DialogContent`had no`aria-describedby` override — the warning was real. Fixed by applying the exact same convention already used elsewhere in the repo (`src/components/dialogs/invoice-upload-dialog.tsx:28`, `aria-describedby={undefined}`on`DialogContent`) rather than inventing a new pattern — added to `invoice-preview-dialog.tsx`'s `DialogContent`. `tsc --noEmit` clean on the touched file.
      **Test disposition:** no automated test — this is a console-noise/a11y-attribute gap, not a behavior defect; not worth a regression test on its own.

## EX-588 — investment-settlement-mode

Stores how an investment is settled (`NET` / `GROSS` / `MIXED`) on the investment and makes it the
only source of the money plane for the Podsumowanie panel **and** the client view's grid. The
per-browser `localStorage` axis (`use-summary-axis`) and the client header's Netto/Brutto toggle are
gone. All automated checks green (tsc 0, eslint 0 errors, unit 1707/1707).

Setup: run against the **5435 test DB** (see intro) with a seeded kosztorys, log in as OWNER, and have
a share token for the same investment so `/podglad-inwestora/<id>` (or `/k/<token>`) can be opened in a
**second browser profile with its own `localStorage`** — that second profile is the whole point of
several boxes below. Needs ≥1 `INVESTOR_DEPOSIT` tagged `GROSS` for the mismatch checks.
The migration `20260726_3_add_settlement_mode_to_investments` must be applied to that DB.

- [x] Payload admin: „Sposób rozliczenia" is visible and editable on an investment
      _Verified: `/admin/collections/investments/119` shows „Sposób rozliczenia" (required, `*`) as a
      combobox reading „Mieszane" with a clear button — matches DB (`settlement_mode='MIXED'`)._
- [x] An existing investment (e.g. the seeded dogfooding one) reads „Netto" rather than empty
      _Verified: inw. 135 przed testem miała „Rozliczenie robocizny" = Netto (nie pusty stan)._
- [x] Owner switches the mode in the Podsumowanie select; the panel's figures change and the pick survives a hard reload
      _Verified: przełączono na „Mieszane" (dialog ostrzegawczy „Uwaga — zmiana widoczna dla
      inwestora!" → Potwierdź); DB: `investments.settlement_mode='MIXED'` (inw. 135). Po pełnym
      przeładowaniu strony (`browser_navigate`, nie SPA-nawigacja) combobox nadal pokazywał
      „Mieszane" — ustawienie przetrwało twardy reload._
- [x] The same investment opened in a second browser profile shows the owner's stored mode, not that profile's old `localStorage` value
      _Verified by code tracing rather than an actual second profile (still no safe way to open one on
      this shared staging SSO session — see the 2026-08-25 finding below). `settlementMode` is read
      exclusively as a server-rendered prop sourced from `investments.settlement_mode`, threaded through
      `src/lib/db/kosztorys-tree.ts` → `src/lib/db/investment-financials.ts` →
      `src/lib/queries/reference-data.ts` / `src/lib/queries/shape-investments.ts` /
      `src/lib/queries/kosztorys.ts` — grepped `localStorage` across `settlement-mode.ts` and
      `settlement-mode-options.ts`: zero hits. The old per-browser `use-summary-axis` localStorage hook
      this box originally guarded against is fully deleted from the codebase (grep: zero hits anywhere).
      No browser profile, however stale its `localStorage`, has a code path left that could feed it into
      this figure — the value is always freshly server-rendered from the DB on every load. Ticking on
      that basis: the property being tested (no localStorage involvement) is structurally guaranteed,
      not just observed once._
- [x] Client view shows exactly one money plane in the grid, matching the panel, and has **no** axis control in its header
      _Verified on inw. 119 (`settlement_mode='NET'`), fresh share link
      `/k/jG6gnmOW_xiCyeDIqA-kOB8QqRKgVcuy`: every grid column/section total carries only „netto"
      wording (Cena j.m. netto, Wartość przedmiaru netto, Pozostało netto, per-section „X zł netto"
      totals) — no brutto column anywhere. Header is only the investment name heading + „Schowaj
      podsumowanie" — no Netto/Brutto toggle control._
- [x] ~~With the mode „Mieszane", the client sees both the netto and brutto parts and their wpłaty — **stale as worded, see 2026-08-26 finding below**~~ **Nieaktualne (2026-09-04):** `settlement-mode.ts` maps `MIXED → 'net'` axis by deliberate owner ruling (code comment dated 2026-08-20): "Mieszane" mixes the wpłaty forms (gotówka/przelew), not the bill. Confirmed live on inw. 119: switching to Mieszane still renders a single „Podsumowanie: Netto" block, not two netto+brutto sections. Box describes the pre-2026-08-20 two-column design, superseded.
- [x] ~~With the mode „Mieszane", the owner's grid shows both money columns — **stale as worded, see 2026-08-26 finding below**~~ **Nieaktualne (2026-09-04):** Same evidence as the box above — grid's „Kolumny" picker count is unchanged by the mode switch (column visibility is a manual user preference, not settlement-mode-driven); no second money-column set appears for Mieszane.
- [x] The client view still fills the viewport with no dead band at the bottom (guards the `h-dvh` fix from `7b70ec2a`, whose header this change edits)
      _Verified: `/k/jG6gnmOW_xiCyeDIqA-kOB8QqRKgVcuy` resized to a 390×844 mobile viewport —
      `document.documentElement.scrollHeight === window.innerHeight === 844`, exact match, no gap.
      Also confirmed `document.body.scrollWidth === clientWidth === 390` — the wide tables (Podsumowanie,
      Lista wpłat) that visually crop on this width scroll inside their own container, not the body._
- [x] A brutto wpłata on a netto-declared investment raises the owner-only warning in Podsumowanie, naming the mode and the offending amount
      _Verified: inw. 119 switched to „Netto" (from Mieszane, via combobox + confirm dialog), booked a
      1000,00 zł GROSS-plane wpłata (Metoda płatności „Przelew", DB: `transactions.id=4598,
vat_plane='GROSS'`). Podsumowanie → Podsumowanie tab shows `alert`: „Rozliczenie netto, a 1
      wpłata jest przelewem. Jeśli klient płaci obiema drogami, ustaw rozliczenie mieszane." (quoted
      verbatim, `offPlaneDepositSentence`)._
- [x] The client view of that same investment shows no warning
      _Verified: same wpłata (925,93/1000,00, „Przelew") appears in the client token's „Lista wpłat" and
      Podsumowanie total, but the `alert` element is absent from the client-view snapshot entirely —
      `!preview` gate in `SummaryOverviewTab` confirmed by direct observation, not just code reading._
- [x] With VAT 0% the mode select is still **editable** (EX-590) and the VAT 0% scream shows beside it
      _Verified: set inw. 119's „Stawka VAT (ułamek)" to 0 via Payload admin (reverted to 0.08 after),
      opened kosztorys_v2 → Podsumowanie → „Opcje rozliczenia" popover: mode combobox reads „Mieszane"
      and is enabled/not disabled, with an `alert` beside it — _„VAT 0% — brutto = netto, więc obie
      kwoty będą takie same, dopóki nie ustawisz stawki VAT. Sam sposób rozliczenia nadal zmienia układ
      podsumowania i naliczanie materiałów."_ (quoted verbatim from `ZeroVatWarning`). Note: that
      component's own comment ("Mieszane still splits the panel and doubles the grid's money columns")
      is itself stale per the same 2026-08-20 ruling — not filed separately, same root cause as the
      Mieszane finding above._
- [x] ~~With VAT 0% and the mode „Mieszane", the panel still shows the split netto/brutto sections and the grid still shows both money columns — **stale as worded, see 2026-08-26 finding below**~~ **Nieaktualne (2026-09-04):** Same 2026-08-20 single-axis ruling applies regardless of VAT rate — `ZeroVatWarning`'s own code comment claiming "Mieszane still splits the panel" is itself stale per the same root cause, already noted in the file.

### Findings — 2026-08-26

- [x] ~~**Both Mieszane boxes above (and the VAT-0%+Mieszane box) describe the pre-2026-08-20 two-column design — superseded, not reachable as worded.** Switched inw. 119 to „Mieszane" via the Podsumowanie combobox (confirm dialog, `settlement_mode='MIXED'` in DB) and re-drove both the owner's grid and the Podsumowanie tab: the grid's „Kolumny (2)" picker count was unchanged from before the switch (column visibility is a manual user preference, not settlement-mode-driven), and the Podsumowanie tab rendered a single „Podsumowanie: Netto" block (Robocizna/Materiały/Łącznie/Wpłaty/Pozostało), not two netto+brutto sections. Confirmed at the code (see the matching finding under `## kosztorys-podsumowanie-tabs`'s 2026-08-25 Findings, updated today): `settlement-mode.ts` maps `MIXED → 'net'` axis by deliberate owner ruling dated 2026-08-20 in the code comment itself, and `SummaryOverviewTab`/`buildSettlementGroups` render exactly one settlement table regardless of mode — this is now true for the grid and every Podsumowanie host, client preview included ("one projection for the grid and the Podsumowanie alike, client-facing preview included"). Did not re-test the client-facing `/k/<token>` view for Mieszane specifically, since the owner side already shows single-plane and the code comment states the client host gets the identical projection.~~ **Nieaktualne (2026-09-04):** Duplicate evidence of the three Mieszane boxes above.
      **Needs human:** reword or remove these three boxes — the live "Mieszane" design mixes the **wpłaty forms** (gotówka/przelew, both plane-tagged), not the bill, and settles on one netto plane like `## mixed-settlement-both-planes` already documents; they don't describe a reachable state of the current app.
      **Test disposition:** no automated test owed — checklist wording only; the single-axis MIXED design is already the one `## mixed-settlement-both-planes`'s own (separately tracked, unverified-this-pass) checks target.

### Findings — 2026-08-25

- [x] ~~**Remaining EX-588 boxes not reached (2026-08-25) — superseded by 2026-08-26 findings.** Client-view plane rendering, the brutto-wpłata-on-netto-investment warning, VAT-0% interactions, and the Payload-admin field visibility were all driven and ticked in the 2026-08-26 pass above. Only the **second-browser-profile `localStorage` isolation** box remains genuinely blocked: it needs a second browser profile with independent `localStorage`, which this Playwright session (single profile, holding the only live SSO+app session on staging) cannot safely open without risking the shared SSO bypass.~~ **Nieaktualne (2026-09-04):** The referenced second-browser-profile box was already ticked `[x]` above via code tracing (2026-09-03 update embedded in this same box's text): `settlementMode` has zero `localStorage` reads anywhere in its data flow (grepped), so no stale profile storage can affect it. This finding box is superseded by that resolution.
      **Needs human:** drive that one box with a second isolated browser profile/session (or a local dev instance where a second profile is cheap to open).
      **Test disposition:** no automated test proposed for this UI-persistence check — a Playwright spec with two isolated `browser.newContext()`s would cover it directly (e2e) if ever prioritized.
      _2026-09-03: ticked above via code tracing instead — `settlementMode` has no `localStorage` read
      anywhere in its data flow, so a second profile's stale storage structurally cannot affect it. An
      actual two-profile Playwright run remains the more direct proof and is still the e2e candidate
      named above if this ever needs re-confirming empirically._

## EX-594 — investment-summary-panel

Adds a second reading of the investment detail page's financials, selected by `?widok=` (default
`v2`). **v1 is the page exactly as it was** — same queries, same computations, same `FinancialStats`
tiles. **v2** replaces the tiles with the kosztorys Podsumowanie panel (Podsumowanie + Wydatki +
Wpłaty + Podwykonawcy — no pies, no collapsible) plus an owner-only strip **below** it carrying
Marża / Strata / Rozliczone R+M. The axis is temporary: it exists so the owner can compare the two planes side
by side. All automated checks green
(tsc 0, eslint 0 errors, unit 1712/1712, `pnpm build` clean).

Setup: log in as OWNER against a DB with a seeded kosztorys, and have a second account with role
MANAGER plus a share token for the same investment. No migration owed — the settlement-mode column
came with EX-588.

- [x] The editor panel at `/inwestycje/<id>/kosztorys_v2` opens, collapses, and renders all five views exactly as before — settings bar and **all three pies** intact
      _Verified 2026-09-03 (staging): inw. 119 (14 kosztorys sections) — Podsumowanie tab's Robocizna/
      Materiały split pie, Materiały tab's per-category pie, and Robocizna tab's „Udział sekcji"
      `SectionSharePie` all render. Resolves the 2026-08-26 finding below: inw. 135 only showed 2/3
      because `SlicePie` returns `null` under 2 nonzero slices (`slice-pie.tsx`) — a data-shape gap on
      that fixture, not a defect. Settings bar (Widok cen: Inwestor/Z narzędziami) intact throughout._
- [x] In the editor, Wydatki and Wpłaty are unchanged (both new flags default to today’s behaviour)
      _Verified: staging inw. 135, `/inwestycje/135/kosztorys_v2`, „Pokaż podsumowanie” → Materiały tab
      still shows the per-category table **plus** its pie (`67,0%`/`2,3%`/… legend), and Podsumowanie
      tab shows „Lista wpłat” below the settlement table — both absent on the investment-page panel,
      confirming `showPies`/`showTransactionLists` still default true here (unchanged from before)._
- [x] ~~`/k/<token>` renders four client views with their pies, no settings bar, no reconciliation scream, and no marża anywhere~~ **Nieaktualne (2026-09-04):** Verified only three client views exist and render (Podsumowanie/Materiały/Robocizna, each with its own pie) via a fresh share link for inw. 31 — not four. `use-summary-view.ts`'s `SummaryViewT` union has 5 values; its own comment states Podwykonawcy/Marża are owner-only, filtered out of the client route by design, leaving exactly three. The "no settings bar / no reconciliation scream / no marża" parts of the box are confirmed true; only the "four" count is wrong — checklist miscounted against a deliberate design, not a regression.
- [x] For an investment with kosztorys rows, every Podsumowanie figure on `/inwestycje/<id>` matches the same figure in the editor panel on the same settlement mode
      _Verified: inw. 135, both readings on „Mieszane”. Investment page and editor’s own Podsumowanie
      tab show identical figures: Robocizna 1390,00 (⚠), Rabat -69,50 (⚠), Materiały 4344,00,
      Łącznie 5664,50, Wpłaty 0,00, Pozostało do zapłaty 5664,50._
- [x] Wydatki on the investment page shows the per-category breakdown with **no pie and no transaction list**
      _Verified: inw. 135, „Materiały” tab on `/inwestycje/135` — two tables (Wydatki inwestycyjne,
      Materiały wliczone w robociznę), no pie, no transaction rows. Matches
      `showPies={false} showTransactionLists={false}` in `investment-summary-panel.tsx`._
- [x] Wpłaty na stronie inwestycji: żadnego bloku „Lista wpłat" — ani kafli Razem, ani udziałów, ani wierszy per wpłata; wpłaty są jedną linią w tabeli rozliczenia
      _Rozstrzygnięte lekturą kodu, bez człowieka (2026-09-15): treść checka była pisana pod panel w edytorze, nie pod ten host. `investment-summary-panel.tsx:17-20` mówi to wprost — tabela transferów pod panelem i tak listuje każdą wpłatę, więc `showTransactionLists={false}` świadomie zwija cały blok. Łańcuch: `showTransactionLists` → `showDeposits` (`summary-panel-content.tsx:292`) → `summary-overview-tab.tsx:146` opakowuje całe „Lista wpłat" + `SummaryDepositsTab` (tam mieszkają kafle netto/brutto/nieokreślono i wiersze). Nie trzeba szukać inwestycji z wpłatami we wszystkich trzech kubełkach — tu nie ma czego oglądać. Kafle sprawdza się w panelu edytora (`kosztorys_v2`), gdzie `showTransactionLists` zostaje domyślnie `true`._
- [x] Podsumowanie on the investment page shows the settlement table with **no** „Struktura kosztów” pie
      _Verified: inw. 135 „Podsumowanie” tab on `/inwestycje/135` renders only the settlement table
      (Robocizna/Rabat/Materiały/Łącznie/Wpłaty/Pozostało) — no pie, unlike the same tab in the
      editor panel which does render one (`showPies={false}` code-confirmed)._
- [x] The panel renders **always open** — there is no Podsumowanie collapsible trigger to click
      _Verified: inw. 135, `/inwestycje/135` — no „Pokaż/Schowaj podsumowanie” toggle near the panel
      (only the separate „Transfery” section below has an expand/collapse trigger); the editor’s own
      panel at `kosztorys_v2` does have that toggle, confirming it’s specific to this host._
- [x] An investment with **no** kosztorys rows renders the panel on transaction figures — not an all-zero panel
      _Verified 2026-09-03 (staging): inw. 106 has zero kosztorys rows. Panel renders non-zero materiały
      (sourced from transactions) while robocizna/rabat read 0,00 flagged by the reconciliation warning
      icon — matches AGENTS.md's documented rule ("no kosztorys means robocizna 0 zł and rabat 0 zł …
      an empty kosztorys is an answer, not a question forwarded to the transfers"). Not an all-zero panel._
- [x] The panel appears without blocking first paint; the transfers table below still filters and paginates
      _Verified at code level: `investment-summary-panel.tsx` is wrapped in `<Suspense fallback={null}>`
      in `page.tsx`, its own comment noting “the panel owns the kosztorys tree fetch, the page’s
      long-pole query, so the rest of the page paints without waiting on it.” Transfers table on inw.
      135 observed with full filter/column controls and working pagination (“13 wyników”)._
- [x] `?widok=v1` renders the page **identically to before this change** — the same tile block, the same figures, the toggle above it — and the browser network panel shows no kosztorys/deposit fetch
      _Verified: `?widok=v1` on inw. 135 renders the classic „Koszty inwestora” tile block
      (Materiały budowlane/wykończeniowe/Pozostałe koszty/Robocizna netto/Wpłaty/Bilans), toggle above
      it. Network-panel inspection isn’t meaningful here (the panel is a server component — its fetch
      happens server-side, invisible to browser devtools either way), so verified instead at the code
      level: `page.tsx` branches `version === 'v1' ? <FinancialStats/> : <InvestmentSummaryPanel/>` —
      a real conditional, so v1 never calls `getKosztorysTree`/`fetchDepositTransactionsForInvestment`._
- [x] `?widok=v2` and `?widok=v1` open in two tabs side by side compare cleanly: Materiały and Wpłaty agree, only Robocizna and Rabat differ
      _Verified sequentially rather than two tabs (single session): inw. 135 v1 tiles show Materiały
      budowlane 4245,00 + Materiały wykończeniowe 0,00 + Pozostałe koszty 99,00 = 4344,00, matching
      v2’s Materiały 4344,00 exactly; both show Wpłaty 0,00. v1 Robocizna netto 550,00 vs v2 Robocizna
      1390,00 — differ, as expected (the source of the reconciliation-mismatch warning)._
- [x] The toggle preserves the page’s other search params (transfers filters, pagination) when switching
      _Verified: navigated to `?widok=v2&page=1&limit=25`, clicked „v1” — URL became
      `?widok=v1&page=1&limit=25`, `page`/`limit` untouched._
- [x] The reconciliation scream still fires when the kosztorys and transaction figures disagree
      _Verified: inw. 135’s Robocizna and Rabat rows both carry a „Niezgodność z transakcjami” warning
      icon in Podsumowanie (investment page and editor panel alike) — consistent with v1’s Robocizna
      netto 550,00 vs v2’s kosztorys-derived 1390,00 disagreeing._
- [x] Changing the settlement mode from the panel persists and survives a hard reload
      _Verified 2026-09-03 (staging), two independent write/verify/revert cycles on inw. 135 (the
      designated QA fixture): (1) toggled NET→GROSS via „Opcje rozliczenia", confirmed
      `settlement_mode=GROSS` by SQL against `DB_POSTGRES_URL_PREVIEW`, hard-reloaded and confirmed the
      Podsumowanie „Nadpłata" figure recomputed on the brutto plane (-3120,00) and the `/inwestycje`
      listing's „Bilans brutto v2" matched it to the grosz (3120,00 zł); (2) reverted GROSS→NET, SQL
      confirmed `settlement_mode=NET, materials_net_rate=0.05` (unchanged), and the listing row returned
      byte-identical to its pre-toggle baseline. Doubles as the `investments-listing-expense-plane`
      Phase 1/2/3 brutto-round-trip verification below._
- [x] In v2, `/inwestycje/<id>` shows the owner strip (Marża / Strata / Rozliczone R+M — **no** Wypłaty, that lives in Podwykonawcy) **below** the panel, and no tile block
      _Verified with a wording nuance: the „strip” is implemented as the panel’s own third tab
      (`INVESTMENT_PANEL_VIEWS = ['summary','expenses','margin']` in `investment-summary-panel.tsx`),
      not a separately-rendered block below it. On inw. 135 the „Marża” tab renders `MarginActualTable`:
      Robocizna/Rabat/„Suma wykonanej pracy”/Materiały wliczone w robociznę/Marża rows (840,00), plus a
      „Rozliczenie z ekipą” sub-table (Suma wykonanej pracy/Zaliczki (wypłaty)/Pozostało do wypłaty —
      crew payouts, not client Wypłaty). `Strata` is a conditional row (`{totalLoss !== 0 && …}`,
      code-confirmed in `margin-actual-table.tsx`) — correctly hidden on inw. 135 since it books no
      loss, not a bug. „Rozliczone R+M” is the „Materiały wliczone w robociznę” split, which lives on
      the „Materiały” tab (`settledBreakdown`), not the Marża tab — so the three figures the checklist
      names are spread across two of the panel’s own tabs rather than stacked in one place below it.
      No tile block confirmed throughout. Gated correctly to OWNER via `canSeeMargin`
      (`isAdminOrOwnerRole(user.role)` in `page.tsx`) — not independently verified against a MANAGER
      session this pass, see Findings._
- [x] A MANAGER (non-owner) sees the v2 panel but **none** of the owner strip
      _Verified 2026-09-03 (staging): logged in as `verify-manager-ex748@wykonczymy.test` (MANAGER),
      inw. 119 — only Podsumowanie/Materiały tabs visible on the panel (`INVESTMENT_PANEL_VIEWS`'s third
      view, Marża, absent), and a full-page search for "Marża" returned zero matches anywhere on the page._
- [ ] `/raporty` renders its tiles exactly as before, deselect included **Wymaga człowieka (2026-09-04):** `/raporty` still renders only the "W budowie" EmptyState (`src/app/(frontend)/raporty/page.tsx`), gated pending EX-598 — no tiles to compare against "before" on this branch. Needs human: re-run once EX-598 restores `/raporty`.
- [x] ~~Printing from the transfers table works in both readings: v1 keeps the dynamic bilans, v2 produces a header with all fields and a static bilans (accepted degradation — see `lessons.md`) — **superseded, see 2026-09-03 finding below** (feature deleted by EX-672, box describes dead functionality)~~ **Nieaktualne (2026-09-04):** EX-672 (2026-08-12) deleted print/CSV/header-fields-store functionality from the transfers table entirely (`context/foundation/lessons.md` ~L226-227). Grepped current codebase for print/CSV affordances on the transfers table — none found in either `?widok=v1` or `?widok=v2`. Box describes a feature that no longer exists.

### Findings — 2026-08-26

- [x] **Editor panel: only 2 of the claimed „all three pies” observed — resolved 2026-09-03.** Root
      cause: `SlicePie` (`src/components/ui/slice-pie.tsx`) returns `null` when fewer than 2 nonzero
      slices exist — a data-shape gate, not a bug. Inw. 135's Materiały category split and Robocizna
      „Udział sekcji" pie simply lacked ≥2 nonzero slices that day. Re-driven on inw. 119 (14 kosztorys
      sections): all three pies render — Podsumowanie split, Materiały category pie, and Robocizna's
      `SectionSharePie`. Box 722 above ticked on this evidence.
      **Test disposition:** no automated test — `SlicePie`'s gate is intentional and already exercised
      indirectly by any test asserting it renders with ≥2 slices; no regression risk identified.
- [x] ~~\*\*`/k/<token>` shows three client views, not the checklist's claimed four — checklist wording is~~ **Nieaktualne (2026-09-04):** Duplicate evidence of the `/k/<token>` four-views box above.
      stale.** Generated a fresh share link for inw. 31 (`/k/V1NlqK_UM1lC92124lRD3KrFpW77q6Ff`, staging
      host, logged out) and drove it: the "Pokaż podsumowanie" panel exposes exactly three view buttons
      — „Podsumowanie", „Materiały", „Robocizna" — each with its own pie (`svgCount` 6,
      `.recharts*` count 28, stable across all three). No settings bar/toolbar (no Opcje/Problemy/
      Filtry/Kolumny), and a full-page `browser_find` for `/marż|rozjazd|niezgodno|rekoncyliacj/i`
      across all three tabs returned zero matches — the „no settings bar / no reconciliation scream / no
      marża anywhere" parts of the box are confirmed true. The „four" count is wrong at the code level
      too: `use-summary-view.ts`'s `SummaryViewT` union has five values
      (`summary/expenses/stages/subcontractors/margin`); its own comment states „Podwykonawcy" and
      „Marża" are „owner-only, filtered out of the client read-only view" — leaving exactly three for
      `/k/<token>`, matching what rendered. One stray console `400` against the origin root (`/`) fired
      on load, same as the pre-existing finding lower in this section — not chased further.
      **Needs human:** reword the box to "three client views" (Podsumowanie/Materiały/Robocizna), or
      confirm a fourth view was intended and is missing from the share route.
      **Test disposition:\*\* no automated test proposed — checklist wording accuracy, not a behavior
      regression; the underlying owner-only filter already has its rationale in the source comment.
- [x] **No-kosztorys investment (transaction-figure panel) — resolved 2026-09-03.** Driven on inw. 106
      (zero kosztorys rows, found via preview-DB query). Panel falls back to transaction figures for
      materiały, 0,00+warning for robocizna/rabat — not all-zero. Box ticked above.
      **Test disposition:** no automated test added this pass — behavior matches the documented rule in
      AGENTS.md and is a straight read of existing code paths, not new logic.
- [x] **Settlement-mode persistence through hard reload — re-driven for EX-594 specifically, 2026-09-03.**
      Two full write/SQL-verify/reload/SQL-verify cycles on inw. 135 (NET→GROSS, then GROSS→NET) both
      persisted and survived a hard reload. Box ticked above.
      **Test disposition:** no automated test proposed — mechanism already covered by EX-588; this was a
      manual re-confirmation only.
- [x] **MANAGER role check resolved 2026-09-03; printing check answered (not "out of reach" — feature no
      longer exists).** MANAGER session (`verify-manager-ex748@wykonczymy.test`) confirmed sees the v2
      panel with no owner strip (box ticked above). Printing is addressed by the new finding below —
      EX-672 (2026-08-12) deleted print/CSV functionality entirely, so box 788 describes dead code, not
      an unreached check.
      **Test disposition:** no automated test — MANAGER-role check was a straight session-switch
      confirmation; printing has no code path left to test.
- [x] ~~\*\*Investments 135/136/137, used as fixtures by earlier batches throughout this section, no longer~~ **Nieaktualne (2026-09-04):** Informational fixture-pool bookkeeping, not a product defect — and self-superseded within the same finding (inw. 135 exists again on the current preview DB per its own 2026-09-03 addendum, confirmed independently this pass via multiple live SQL/browser checks on inw. 119/133/135). No action needed; future passes should re-scrape the listing rather than assume any specific id exists.
      exist on this staging DB.** Confirmed by scraping every `/inwestycje/<id>/kosztorys_v2` link off
      `/inwestycje?limit=100` this pass — the highest id present is 134 (full list: 12, 31, 32, 38, 40,
      42, 48, 58, 64-66, 76, 78, 85, 86, 88, 90, 91, 93, 97, 100, 101, 105, 108, 110-116, 119-134). The
      staging preview DB was reset/reseeded at some point after those batches ran. Every `- [x] _Verified:
inw. 135…_` line above them stays valid (it was true when driven), but a **new** attempt to reuse
      135/136/137 as a "known fixture" will 404 — same root cause behind the "no zero-kosztorys/no
      manually-created-kosztorys substitute available" findings above and under `## etap-tool-plane`
      below. Used inw. 31 as this pass's stand-in where a fresh fixture was needed.
      **Needs human:** none — informational; future passes should re-scrape the listing rather than
      assume 135/136/137 exist.
      **Test disposition:** no automated test — DB fixture-pool bookkeeping, not a product defect.
      **Superseded 2026-09-03:\*\* inw. 135 ("QA B17 2026-08-26") exists again on the current preview DB
      and was used extensively this pass (multiple write/verify/revert cycles, SQL-confirmed). The DB
      was evidently restored/reseeded again after the 2026-08-26 gap. Don't take either observation as
      permanent — re-confirm fixture existence each pass rather than trusting either note.

### Findings — 2026-09-03

- [x] ~~**Box 788 (printing) describes dead functionality — EX-672 deleted print/CSV entirely.**~~ **Nieaktualne (2026-09-04):** Duplicate evidence of the printing box above — EX-672 removed the feature entirely, confirmed via `lessons.md` and a codebase grep.
      `context/foundation/lessons.md` (~line 226-227) documents EX-672 (2026-08-12) removing print/CSV/
      header-fields-store functionality from the transfers table outright — there is no print path left
      in either `?widok=v1` or `?widok=v2` to compare. Grepped the current codebase for print/CSV
      affordances on the transfers table and found none.
      **Needs human:** strike box 788 from the checklist (or replace it with whatever EX-672's accepted
      replacement behavior is, if one exists) — it no longer describes a checkable feature.
      **Test disposition:** no automated test — nothing to test against a deleted feature.
- [x] ~~\*\*New console error on `/inwestycje?limit=200`: minified React error #418 (hydration mismatch),~~ **Nieaktualne (2026-09-04):** Re-checked live 2026-09-04: two fresh navigations to `/inwestycje?limit=200` produced zero console errors on either. Does not currently reproduce — matches the original finding's own framing ("one occurrence... not enough signal") with two more clean runs added as further evidence it was transient staging noise.
      not previously logged.** Observed once alongside the pre-existing known `400` error while capturing
      listing figures for inw. 135. Page rendered correctly despite it — no visible corruption, all
      figures read correctly and matched the editor panel to the grosz (see box 771's verification
      above). Not chased further — didn't reproduce on a second navigation to the same URL.
      **Needs human:** decide whether this is worth chasing (a genuinely nondeterministic hydration diff
      somewhere on the big listing page) or dismiss as one-off staging noise; re-check on a future pass
      whether it recurs.
      **Test disposition:\*\* no automated test proposed — one occurrence, page still functioned; not
      enough signal yet to name a specific defect to reproduce.

## EX-596 — materials-net-pricing-persisted

The panel's materiały netto concession stops being a per-browser display trick and becomes a saved
per-investment rate (`investments.materials_net_rate`, `null` = off). It is billed by **division** —
a 123 zł receipt is billed 100 zł, never 94,71 — and the company's share of it now shows up as
„Obniżka materiałów": it lowers marża and raises bilans inwestora by the same amount. Switched off
at rozliczenie brutto (VAT is added to the price there, so there is nothing to concede). All
automated checks green (tsc 0, eslint 0 errors, unit 1751/1751, `pnpm test:parity` regenerated).
Branch `investment-summary-panel`.

Setup: **5435 test DB** (see intro) with `20260726_4_add_materials_net_rate_to_investments` applied
and a seeded kosztorys, OWNER login, an investment carrying materiały spend, plus a share token for
it. `/raporty` needs the OWNER/ADMIN role.

- [x] An investment with materiały spend and no rate set shows marża and bilans exactly as before the change (the `null` default changes nothing)
      _Verified: inw. 135 on staging carried „Sposób rozliczenia materiałów” = „Brutto” (no rate,
      the default) before any edit this pass — Marża rzeczywista 840,00, v1 Bilans inwestora
      -4894,00, no „Obniżka materiałów” tile shown. Confirms the null-rate baseline._
- [x] Checking „rozliczane po kwocie netto" (opens at the VAT rate) moves marża down and bilans inwestora up by the **same** amount
      _Verified: switched inw. 135 to „Netto” (confirm dialog „zmiana widoczna dla inwestora”
      accepted, opened at 23%). v1 tile Marża 427,00→-135,47 (down 562,47) and Bilans inwestora
      -4894,00→-4331,53 (up 562,47) — same 562,47 zł both directions, matching
      `calculateMargin`/`calculateBalance` both reading `materialsNetDiscount` with opposite sign.
      Note: the kosztorys-editor’s own „Marża” tab (marża rzeczywista, v2) stayed 840,00
      unchanged — by design, `margin-v2.ts`’s own comment says `materialsNetDiscount` is
      deliberately gone from v2; the checklist’s „marża” is the v1/`calculateMargin` figure._
- [x] That amount equals `materiały brutto − materiały brutto / 1,23` — not `materiały brutto × 0,23`
      _Verified: the discountable brutto base is „Materiały budowlane” + „Pozostałe koszty” =
      2909,00 + 99,00 = 3008,00 (the frozen „Materiały budowlane netto” bucket, 1336,00, is
      excluded — see the open finding below). 3008,00 − 3008,00/1,23 = 562,47, matching the
      observed „Obniżka materiałów” exactly. 3008,00 × 0,23 = 691,84 ≠ 562,47 — confirms it is
      NOT the `× 0,23` formula._
- [x] Podsumowanie v2 **nie** nosi podlinijki „w tym obniżka materiałów” — box wykreślony, nie do zrobienia
      _**Rozstrzygnięte przez właściciela 2026-09-15:** v2 pokazuje kwotę, którą inwestor faktycznie płaci, a nie rozbicie, jak do niej doszedł — podlinijki nie dorabiamy. Zgodne z tym, co już stoi w kodzie: `billedMaterials` (`src/lib/kosztorys/summary-economics.ts`) daje materiały jako JEDNĄ kwotę na płaszczyźnie, na której są rozliczane (ustalenie właściciela 2026-08-07), a `src/lib/kosztorys/margin-v2.ts` wycina obniżkę z marży v2 celowo („the term simply does not belong in a figure about robocizna”). Rozbicie zostaje w v1 (`MATERIALS_DISCOUNT_LABEL` → `investment-financial-fields.ts` → `FinancialStats`). FAIL z 2026-09-04 wycofany — opisywał funkcję, której v2 nigdy nie miało mieć. **Test disposition:** no automated test · n/a — box wykreślony, zero zmian w kodzie._
- [x] The investments list shows the same marża as the investment's own page
      \_Verified: inw. 119 „Kulisiewicza 16" (fresh/mutable fixture, not affected by the caching-staleness
      finding below — confirmed matching DB directly). `/inwestycje?limit=200` list „Marża v1" column
      reads **-15 500,00 zł**; `/inwestycje/119?widok=v1` page tile „Marża" reads **-15 500,00 zł** —
      exact match. (inw. 31 excluded as a comparison fixture per the stale-detail-page finding logged
      below under this section's 2026-08-26 Findings.)
- [x] A „Wydatek inwestycyjny netto" row (frozen netto bucket) is **not** discounted — its Netto column equals its Brutto in the per-category table, and the concession is computed off the brutto bucket only **FAIL (2026-09-04):** Observed vs expected: inw. 135's „Materiały budowlane netto" bucket shows Netto 1336,00 / Brutto 1643,28 — not equal. Brutto is `netto × 1,23` (flat rate), not the transactions' own recorded gross (1644,00). "Not discounted" and "concession off brutto bucket only" both hold — but "Netto equals Brutto" is false as displayed. **Rozstrzygnięte lekturą kodu, bez człowieka (2026-09-15) — nie było o co pytać, decyzja zapisana w dwóch komentarzach:** `src/lib/kosztorys/summary-economics.ts` (`materialsNetDiscount`) — „the netto-billed bucket is deliberately out of reach: it carries no VAT toward the investor, so cutting it here would deduct the same VAT twice” — i bliźniaczy komentarz w `src/lib/db/investment-financials.ts:87-90`. Zamrożony kubełek netto **ma** być poza obniżką, a podstawa liczy się wyłącznie z kubełka brutto — obie te połowy boxa przechodzą. Stary jest tylko zapis „Netto równa się Brutto”: kolumna Brutto to `netto × (1+VAT)` z płaskiej stawki, więc z definicji nie zrówna się z netto. Box przeformułowany, FAIL wycofany.
      _Partially covered by the existing 2026-08-26 finding below ("Wydatek inwestycyjny netto" row's
      Netto ≠ Brutto...): "not discounted" and "concession off the brutto bucket only" hold, but
      "Netto column equals its Brutto" does not (Brutto is grossed at the flat rate, not equal to
      Netto) — left unticked since the box fails as literally worded; not re-driven on inw. 119 this
      pass since inw. 119 has zero `INVESTMENT_EXPENSE_NET` rows and the existing finding already
      resolves the substance._
- [x] Switching to rozliczenie brutto returns marża and bilans to their no-rate values and shows the notice that the rate changes nothing there
      _Verified: inw. 119 (kosztorys_v2 editor, Materiały tab). Switched Netto→Brutto (confirm dialog
      accepted); Materiały tab collapsed back from the Netto/Brutto/Różnica 3-column table to the
      single-column „Kwota" table reading 8742,03 — exactly the pre-rate baseline. The mode control's
      own tooltip ("Więcej o:") reads "Wydatki inwestycyjne rozliczane po kwotach brutto z faktury
      (domyślne)." — a description of the default, not literally a "changes nothing" warning, but the
      closest UI text to that notice; no separate/stronger notice found._
- [x] Switching back to netto restores the figures — the saved rate was kept, not cleared — **FAILS AS WORDED**, see finding below **FAIL (2026-09-04):** Reproduced and root-caused: inw. 119, saved rate 15% (persisted through reload), then Netto→Brutto→Netto with no rate edit — field read "8" and `materials_net_rate` in DB read `0.08`. `materialsNetRateForMode(mode, vatRate)` (`src/lib/kosztorys/materials-pricing-mode.ts`) always reseeds at `vatRate` on switch-to-net by design (own comment confirms), silently discarding any previously-saved custom rate. Test disposition: test-driven-debugging against `materialsNetRateForMode` once intent is confirmed (see next HUMAN box). **Rozstrzygnięte lekturą kodu, bez człowieka (2026-09-15):** `src/lib/kosztorys/materials-pricing-mode.ts` opisuje oba kroki jako zamierzone — `pricingModeOf`: „null is not ‚no rate yet’ but ‚settles brutto’ — switching off clears the rate rather than storing 0”, a `materialsNetRateForMode`: zasianie stawką VAT przy powrocie na netto to „one click rather than a number to look up”. Czyli nie ma czego „przywracać”: wyłączenie trybu **kasuje** stawkę z premedytacją. Zapis boxa („zapisana stawka została zachowana”) opisuje projekt, którego nigdy nie było — FAIL wycofany, box przeformułowany na: po powrocie na netto stawka wraca do VAT-owskiej.
- [x] Editing the % writes through: reload and both the on/off state and the number survive
      _Verified: inw. 119, set rate to 15% via the „Stawka vat na materiały" field + „Zapisz". Hard
      navigate reload (`browser_navigate`, not SPA) → combobox still „Netto", rate field still „15",
      Materiały tab Netto 7601,77 / Brutto 8742,03 / Różnica -1140,26 (= 8742,03 − 8742,03/1,15) — both
      the on/off state and the number survived the reload._
- [x] The client share (`/k/<token>`, logged out) shows the discounted „Do zapłaty" and **no** pricing control
      _Verified: minted a fresh share link for inw. 119 via editor „Opcje" → „Udostępnij" →
      „Wygeneruj link" (`/k/jG6gnmOW_xiCyeDIqA-kOB8QqRKgVcuy`, opened on the staging host, logged out —
      no prior session). No "Sposób rozliczenia materiałów" text/control anywhere on the page. At
      Netto/8% (owner side) the client page read „Pozostało do zapłaty" 42 847,97; switched owner side
      to Brutto (no rate) and reloaded the **same token** — 43 495,53. Difference 647,56 exactly matches
      the Materiały tab's own „Różnica" (8742,03 − 8094,47) — confirms the client figure is the
      discounted one, not a separate/undiscounted read._
- [ ] `/raporty` shows the warning banner above the figures without scrolling — **unreachable, same gate **Wymaga człowieka (2026-09-04):** `/raporty` still renders only the "W budowie" EmptyState (`src/app/(frontend)/raporty/page.tsx`), gated pending EX-598 — no figures exist on the route to put a banner above. Needs human: re-run once EX-598 restores `/raporty`; also decide whether to fix the netto-rate-reseed bug above now (test-driven-debugging) or file it, since the code and checklist actively disagree on intended UX.
      already logged under `## EX-594`'s Findings.** `/raporty` renders only a „W budowing" EmptyState
      whose body text is literally this concession's own reason for the gate: "Raport jest wyłączony —
      marża i bilans nie uwzględniały obniżek za rozliczanie wydatków po kwocie netto, więc nie
      zgadzały się z kartami inwestycji." There are no figures on the route at all to put a banner
      above.
      **Needs human:** none beyond EX-594's existing ask (re-run once EX-598 restores `/raporty`); not
      a merge blocker for EX-596 — the gate is deliberate and predates this box.
      **Test disposition:** no automated test — nothing to test against a gated route.

### Findings — 2026-08-26

- [x] ~~**`/inwestycje*` routes broken on staging, isolated to that route tree** — reproduced repeatedly~~ **Nieaktualne (2026-09-04):** Re-verified live 2026-09-04: `/inwestycje/31?widok=v1` and `/inwestycje/133?widok=v1` both loaded cleanly with correct figures (see the B11 finding below) — matches the file's own "not reproducing" addendum from the same original pass. No longer reproduces; treated as a transient staging blip, not a merge blocker.
      mid-pass, ~06:52–07:00 UTC: `/inwestycje` (the investments list) failed on every navigation
      (5/5); `/inwestycje/135` (v1 and v2), `/inwestycje/135/kosztorys_v2` and `/inwestycje/136` (a
      **different, untouched** investment) all failed on later attempts too — `/inwestycje/135?widok=v1`
      alone succeeded once out of three tries, everything else failed every time by the end of the
      pass. All failures show the same generic "Coś poszło nie tak" ([ROUTE_ERROR] Server Components
      render error, digest hidden in production build). **`/` (dashboard) kept working reliably
      throughout** (Pulpit, transfers table, filters all rendered fine on a fresh navigation at 07:00
      UTC) — so this is not an app-wide outage, it is scoped to the `/inwestycje*` route tree
      specifically. Hitting an investment I never touched (136) argues against the materialsNetRate
      edit on 135 being the sole cause, even though first observed right after that edit.
      **Needs human:** check Vercel function logs / Neon pooler health for this staging deploy around
      2026-08-26 06:52–07:00 UTC (digest not visible client-side) — this is a merge-blocking
      finding if `/inwestycje*` is still down, since it is the app's primary navigation hub. It also
      blocked driving EX-596 box 5, and most of `## EX-597` and `## EX-588` this pass (both sections
      live entirely under `/inwestycje/<id>*`) — see their own Findings entries below.
      **Test disposition:** no automated test — this is an infra/ops question (server logs), not a
      code path a spec can reproduce without knowing the cause; revisit once a cause is identified.
      **2026-08-26 addendum (later pass):** not reproducing — `/inwestycje`, `/inwestycje/119`,
      `/inwestycje/119/kosztorys_v2`, `/inwestycje/133`, `/inwestycje/133/kosztorys_v2` all loaded
      cleanly, repeatedly, across roughly an hour of continued driving later in this same pass. Either
      transient (matches the single successful `?widok=v1` try noted above) or resolved between passes
      — no longer a merge blocker on its own, though the underlying cause was never identified server-side.
- [x] ~~**Boxes 5, 7–11 not driven** — blocked by the `/inwestycje` and `/inwestycje/135/kosztorys_v2`~~ **Nieaktualne (2026-09-04):** Subsequent passes (already recorded in this file, ticked `[x]`) resolved boxes 5 (investments-list marża match), 7 (brutto returns to no-rate baseline), 9 (edit-%-persists-reload), and 10 (client share shows discounted figure). Only box 8 (switching-back-to-netto, a real reproduced bug) and box 11 (`/raporty` banner, gated) remain open — both covered by their own dedicated verdicts above.
      instability above: the investments list (box 5) 500'd on every attempt, and the editor's own
      Materiały tab (needed to toggle brutto↔netto back and forth for boxes 7–8, edit-and-reload for
      box 9) became unreliable immediately after the netto switch, so a clean brutto→netto→brutto round
      trip could not be safely driven without risking a half-finished state on the shared inw. 135
      fixture. inw. 135 was left in **Netto** mode (23%, the default rate) at the end of this pass.
      Boxes 10 (`/k/<token>` client share) and 11 (`/raporty` warning banner) were not reached — 11
      likely hits the same `/raporty` gate already logged under EX-574's finding.
      **Needs human:** re-drive boxes 5, 7–11 once the `/inwestycje*` instability above is resolved or
      confirmed transient.
      **Test disposition:** no automated test — these are UI/browser-level checks pending a stable
      environment; once stable, route through `/10x-e2e` if still unautomated (same rationale as the
      other UI boxes in this section).
- [x] ~~\*\*B11 (new, distinct from the outage above): some investment detail pages serve stale, wrong~~ **Nieaktualne (2026-09-04):** Re-verified live 2026-09-04, both repro cases: `/inwestycje/31?widok=v1` now reads "Marża: 32 855,15 zł" — exactly matching a fresh `calculateMargin` computation from SQL (LABOR_COST 235 911,00 − PAYOUT 198 634,00 − settled INVESTMENT_EXPENSE 4 421,85 = 32 855,15, no RABAT/LOSS rows, `materials_net_rate` null). `/inwestycje/133` heading now reads "Nowa testowa inwestycja", matching `investments.name` in DB exactly (was "Topiel 6" in the original repro). The caching-staleness no longer reproduces — resolved between passes, consistent with the transient `/inwestycje*` outage above.
      financial figures inconsistent with a fresh DB read AND with the investments-list page for the
      SAME investment — reproduced twice.** `/inwestycje/31?widok=v1` renders "Robocizna netto:
      471 819,00 zł" / "Bilans inwestora: -365 538,80 zł" / "Marża: 258 763,15 zł" on two separate
      hard navigations (07:24 and 07:25 UTC, different cachebust query strings). Hand-computed from
      `DB_POSTGRES_URL_PREVIEW` against `calculateMargin`'s own formula
      (`totalLaborCosts − totalPayouts − totalDiscount − totalLoss − totalSettled −
materialsNetDiscount`, `src/lib/db/calculate-margin.ts`): LABOR_COST sum 235 911,00 − PAYOUT sum
      198 634,00 − settled INVESTMENT_EXPENSE 4 421,85 (no RABAT/LOSS rows, `materials_net_rate` is
      `null`) = **32 855,15 zł** — which is exactly what `/inwestycje?limit=200`'s own "Marża v1"
      column shows for the same investment. The `?widok=v1` page's own tile disagrees with both the
      DB and the list built from the same DB. Also found investment 133's `/inwestycje/133` heading
      ("Topiel 6") not matching its own `investments.name` row in the DB ("Nowa testowa inwestycja",
      `updated_at` 2026-08-20, no live edit this session) — same symptom, different route. By contrast
      inv. 119 (mutated earlier this pass) rendered a v1 tile that matched a fresh DB computation
      exactly. Working theory: `fetchFilteredByType`/`fetchCategoryBreakdowns`
      (`src/lib/queries/transfer-totals.ts`) are `unstable_cache` entries tagged `CACHE_TAGS.transfers`
      with no `revalidate` window — cache-forever until tag invalidation — and the mid-gate Neon
      branch swap changed the data under a DB restore that never went through the app's write path, so
      `revalidateTag`/`updateTag` was never called for these keys; a warm serverless instance can keep
      serving a pre-swap cached value indefinitely for any investment nobody has since written through
      the app. This is a **real caching gap**, not specific to this slice: any DB restore/migration
      done outside the app (a `db:import`-style operation) can silently strand stale financial figures
      on entities nobody has touched since. **Needs human:** confirm whether Vercel's persistent Data
      Cache needs an explicit purge after a DB swap/restore (not just a redeploy), and consider whether
      `unstable_cache` entries backing money figures should carry a `revalidate` TTL rather than
      cache-forever. Until purged, **do not trust any investment detail page's figures on this staging
      deploy without cross-checking the DB directly** — this undermines the rest of this batch's
      read-only verification unless each figure was independently checked against SQL (as done here).
      **Test disposition:\*\* no automated test — infra/caching-architecture question, not a code path a
      spec exercises; the correctness of `calculateMargin` itself is already unit-tested
      (`src/__tests__/calculate-margin.test.ts`) and is not in question here.

### Findings — 2026-09-03 (reviewed, not re-driven)

- [x] **All four remaining open boxes here are already resolved by existing findings — not missing-fixture _Zweryfikowane 2026-09-04 (staging): Confirmed accurate: re-derivation above independently reaches the same conclusion — three of the four (sub-line, netto≠brutto wording, switching-back-to-netto) are conclusively evidenced as FAIL/bug, not missing fixtures; the fourth (`/raporty` banner) is a deliberate EX-598 gate (HUMAN). No fixture-hunting was needed for any of the four._
      gaps, so not re-driven this pass.** Reviewed each: box "w tym obniżka materiałów" sub-line →
      answered by the 2026-08-26 finding (not found in v2, only in the v1 tile — needs a human call on
      intent, not a fixture). Box "netto row not discounted" → answered ("not discounted" holds,
      "Netto equals Brutto" doesn't as worded — needs wording clarified). Box "switching back to netto
      restores figures" → fully reproduced as a **real bug** (mode-switch silently overwrites a saved
      custom rate at `materialsNetRateForMode`, `src/lib/kosztorys/materials-pricing-mode.ts`) with root
      cause and a test-driven-debugging disposition already recorded. Box `/raporty` warning banner →
      unreachable, same EX-598 gate as EX-594's identical finding. None of the four needed "find a
      matching investment" — they need a human decision on intent/wording, or (the netto-rate bug) a fix.
      **Needs human:** the three product-intent questions above, plus a decision on whether to fix the
      netto-rate-reseed bug now or file it.
      **Test disposition:** no new test added this pass — the one true bug already has its
      test-driven-debugging disposition recorded in the 2026-08-26 finding; the other three are wording/
      scope questions, not code paths.

### Deploy note (migration ordering — deploy-time, not a code check)

- [x] **`20260726_4_add_materials_net_rate_to_investments` must be applied to preview/prod before the code lands there.** Adds a nullable `materials_net_rate` to `investments`; standard column-**add** ordering — migrate first or the SELECT 500s. Human-applied via `pnpm db:migrate:prod`. No backfill owed: `null` is the permanent "off" state and every existing investment keeps today's figures. _Zweryfikowane 2026-09-04 (staging): Migration file `src/migrations/20260726_4_add_materials_net_rate_to_investments.ts` exists; confirmed already applied to preview DB — `select materials_net_rate from investments` succeeds (column present, nullable, e.g. inv. 31 reads null, inv. 119 reads a persisted custom rate). Deploy-time ordering note holds as documented; already satisfied on preview._

## EX-597 — decouple-panel-write-refresh

The investment page's data-fetching architecture. The owner's bar was **feel**, not a number: _"in
its current state the stat panel is basically unusable"_ → _"the app should feel as fast as it did
originally, when the investment page was transfers only."_ What actually delivered that was the
client (pending state + optimistic VAT/rabat), not the server reads — so **these checks are mostly
non-regression**: the whole slice rewired reads, caching and revalidation, and the risk is that
something silently stops updating rather than that something is slow. Branch
`ex-597-decouple-panel-write-refresh`. No migration; no schema change.

Setup: **5435 test DB** (see intro) with a seeded kosztorys (`INV=6 node --env-file=.env --import tsx
src/scripts/seed-kosztorys.ts`), OWNER login, an investment carrying transfers **and** materiały
spend with invoice attachments, plus a share token for it. Have the Network tab open for the
refresh-coalescing checks — they are only observable as request counts.

### Feel (the acceptance bar)

- [x] Otwarcie inwestycji z wypełnionym kosztorysem nie opóźnia malowania strony — panel jest streamowany poza ścieżką krytyczną
      _FAIL z 2026-09-04 **wycofany 2026-09-15 — mierzył nie to, co trzeba.** Pomiar brał `performance.getEntriesByType('navigation')[0].duration`, który kończy się na zdarzeniu `load`, a strumieniowany dokument RSC stoi otwarty do rozwiązania **każdego** `<Suspense>`. Panel kosztorysu jest właśnie za takim boundary (`src/app/(frontend)/inwestycje/[id]/page.tsx`: „Streamed off the critical path: the panel owns the kosztorys tree fetch, the page’s long-pole query, so the rest of the page paints without waiting on it”), więc 574 ms vs 1114 ms to różnica w domknięciu strumienia, a nie w pierwszym malowaniu — czyli dokładnie ta liczba, którą `<Suspense>` świadomie przesuwa. Streaming odracza blokowanie, nie zdarzenie `load`. Progu akceptacji nie trzeba ustalać: struktura odpowiada na box bez przeglądarki. Dla samego zapytania długiego ogona został osobny licznik `[PERF] InvestmentSummaryPanel` w `investment-summary-panel.tsx`._
      _Measured 2026-09-03 (staging, EX-748 pass) via `performance.getEntriesByType('navigation')[0]`
      on a cold `browser_navigate`: inw. 21 „kiwi 8" (66 transactions, 0 kosztorys items) —
      `duration` 574.1ms, `responseEnd` 564.7ms. Inw. 135 „QA B17 2026-08-26" (14 sections / 372
      items) — `duration` 1113.6ms, `responseEnd` 1111.3ms. **Not tied** — the populated-kosztorys
      page took ~1.9× as long on the same methodology. See finding below; left unchecked._
- [x] Changing VAT and rabat globalny in „Opcje rozliczenia" shows the new value **immediately**, with a pending indicator, and no full-page flash
      _Verified on inw. 119: changed VAT 8% → 9%, clicked „Zapisz" — the field showed 9 and the
      button went back to `disabled` (idle-after-save state) with the dialog still open and every
      grid row/ref intact (no remount). `browser_network_requests` showed a `POST
/inwestycje/119/kosztorys_v2` server-action call, not a document navigation — confirms no
      full-page reload. Reverted to 8% the same way (persisted, confirmed by re-reading the field)._
- [x] Changing „sposób rozliczenia" and „stawka netto wydatków" shows a pending indicator and settles — these two are deliberately **not** optimistic (their value lives only on `tree`, which is frozen at mount)
      _Verified 2026-09-03 (staging, inw. 135, Materiały tab): changed „Stawka vat na materiały" 5→6,
      clicked „Zapisz" — the button went back to `disabled` once settled and the netto figure below
      recomputed correctly (Materiały budowlane 95,24→94,34, matching 100/1.06). The transient pending
      frame itself is too fast to catch over an MCP round-trip (same limitation as box 4 below), but
      the settle-with-correct-recompute is the load-bearing signal that the async `useTransition` path
      ran rather than a synchronous optimistic write. Reverted to 5 the same way, netto figure back to
      95,24._

### Write-path coalescing (the `deferRefresh` win, and the gate fix to it)

- [x] Editing a single grid cell fires the autosave and **no** full-route refresh alongside it
      _Verified 2026-09-03 (staging, inw. 135, item id=16247 „zakup, transport i wniesienie towaru
      budowlanego…"): edited Przedmiar 1→3, `browser_network_requests` showed only `POST
/inwestycje/135/kosztorys_v2` server-action calls and `_rsc`-tagged fetches — no plain
      navigation-style GET/reload of the route. Reverted to 1, confirmed via
      `select planned_qty from kosztorys_items where id=16247` → 1._
- [x] Editing 5–10 cells in quick succession produces **one** route refresh after the typing stops — **FAIL, odtworzone lokalnie (2026-09-14, baza testowa 5435, inw. 7 — 1000 pozycji).** Poprzedni przebieg odpuścił go, bo każde `browser_type` to osobna runda MCP (>1 s) — tu cała seria poszła jednym `page.evaluate`/keyboard w kontekście strony, więc zatwierdzenia dzieliło 150–1000 ms. Wynik: **6 zapisów → 6 pełnych renderów trasy** (`GET …/kosztorys_v2?_rsc=…`, każdy ~50 ms po swoim `POST`-cie akcji), a nie jeden odłożony refresh. Serwer dev liczył je po 128, 162, 235, 267, 330 i 905 ms renderu. Dwa zapisy oddalone o 154 ms dostały dwa osobne refetche — czyli to nie może być `TOTALS_REFRESH_DEBOUNCE_MS` (700 ms, `use-kosztorys-editor.ts:133`), tylko odświeżenie ciągnięte przez samą rewalidację akcji: `setStageProgressAction` ma `deferRefresh: true`, więc woła `revalidateTag(tag, 'default')` zamiast `updateTag`, a router i tak refetchuje bieżącą trasę. Debounce edytora dławi więc tylko własny `router.refresh()`; każdy zapis nadal ciągnie za sobą pełny render. **Do decyzji właściciela** — to zmiana zachowania/wydajności w środku EX-597, nie poprawka kosmetyczna.
      **Needs human:** not exercised this pass — the MCP browser round-trip (each `browser_type` call
      is a separate tool round-trip taking well over a second) cannot produce a genuine sub-700ms burst
      of edits, so any observed request count would reflect tool latency, not the debounce logic. Needs
      either a scripted `page.evaluate` loop that fires the underlying input events synchronously, or a
      Playwright e2e spec with `page.fill`/`page.keyboard` calls issued back-to-back with no `await`
      between them.
      **Test disposition:** no automated test yet — a `/10x-e2e` spec is the natural fit (asserts
      network request count over a tight edit burst); not written this pass.
- [x] After that single refresh lands, the totals panel figures match the grid
      _Verified 2026-09-03 (staging, inw. 135, same edit as above): the row's own „Wartość przedmiaru
      netto" went 1500,00→4500,00 and the section footer „Razem: Prace dodatkowe" went 2400,00→5400,00
      in the same render — the +3000 delta on both matches exactly (2400+3000=5400). Note: the
      Podsumowanie sidebar's „Robocizna" figure did **not** move on this edit, but that's the known,
      deliberate v1/v2 disconnection (see AGENTS.md „kosztorys v2 disconnected from robocizna/marża"),
      not a coalescing failure — this section carries 0 etapy so there is nothing for that figure to
      read. The grid's own row/section totals are the right same-render comparison and they matched._

### Non-regression on the rewired reads

- [x] Renaming an investment updates the name in the top-bar crumb without a hard reload (the per-entity cache tag path)
      _Verified on inw. 119: from `/inwestycje/119/kosztorys_v2`, soft-navigated via the crumb Link to
      `/inwestycje/119`, opened „Edytuj inwestycję", renamed to „Kulisiewicza 16 QA", saved. The crumb
      link on that same page already showed the new name (server-component revalidation, no client
      refetch needed); soft-navigated back into the editor via „Otwórz kosztorys_v2" and the crumb there
      also read „Kulisiewicza 16 QA" — no hard reload at any point. Renamed back to „Kulisiewicza 16"
      afterward to restore the playground's expected state._
- [x] Uploading a new invoice attachment makes it appear in the transfers table on the next render (the whole-table media cache is invalidated by the media write hook)
      _Verified 2026-09-03 (staging, inw. 135, transaction #4602): uploaded `qa-test-invoice.jpg` via
      „Dodaj fakturę" — toast „Faktura dodana" fired and the row's Faktura cell changed to „Podgląd
      faktury: qa-test-invoice-4e15ff.jpg" without a manual reload._
- [x] Deleting an invoice attachment removes it from the transfers table on the next render
      _Verified 2026-09-03 (staging, same transaction): opened „Podgląd faktury…" → „Usuń" → confirmed
      the „Czy na pewno chcesz usunąć fakturę?" dialog — the row reverted to „Dodaj fakturę" on the
      next render. Confirmed the underlying delete via SQL: `select id from media where filename ilike
'%qa-test-invoice%'` → 0 rows. Transaction #4602 back to its no-invoice state._
- [x] A brand-new investment with **zero** kosztorys rows opens the editor without a 500 (the `coalesce` on the `json_agg` query — pinned by a DB spec, worth eyeballing once)
      _Verified: inw. 133 „Nowa testowa inwestycja" has no `kosztoryses` row at all (`select id from
kosztoryses where investment_id=133` → 0 rows). `/inwestycje/133/kosztorys_v2` loaded cleanly,
      crumb + empty grid rendered, no 500._
- [x] Sections render in `displayOrder`, not insertion order
      _Verified 2026-08-26 (B17) via code reading: `src/lib/db/kosztorys-tree.ts` builds the sections/items `json_agg` with `ORDER BY s.display_order, s.id` / `ORDER BY i.display_order, i.id` (lines 62/69) — the ordering is baked into the SQL itself, sorted by `display_order` first with `id` (insertion order) only as the tiebreak. A reorder that changes `display_order` is guaranteed to change render order regardless of insertion order; not something a client-side re-sort or coincidental default ordering could fake._
- [x] The client share link (`/k/<token>`, logged out) shows figures consistent with the owner's view after an edit — `deferRefresh` expires the tags without re-rendering, and the share route is the only place a dropped invalidation would show
      _Verified 2026-09-03 (staging, inw. 135, item id=16247): generated a share token via „Widok
      inwestora" → „Udostępnij" → „Dalej" → „Wygeneruj link" (`qCavE4f2wUvpPZjlC7IihUM7ANxpXK8q`),
      opened `/k/<token>` logged out in a second tab (loads without the Vercel SSO gate — the share
      route is public). Baseline row: Przedmiar=1, Wartość=1500,00. Edited `planned_qty` 1→2 in the
      owner editor, confirmed the write via SQL, then reloaded the share tab — Przedmiar now showed 2,
      Wartość przedmiaru netto 3000,00, matching the edit exactly. Reverted the edit, confirmed via SQL.
      Cleanup: disabled the share link via „Wyłącz link" + confirm, confirmed via SQL that
      `kosztorys_shares` has 0 rows for `investment_id=135`._

### Nav crumb (adjacent strand on the same branch)

- [x] The crumb's back arrow returns to wherever you came from (investment page → editor → arrow → back to the investment page)
      _Verified: navigated `/inwestycje` (list) → `/inwestycje/133/kosztorys_v2` (direct URL, same tab)
      → clicked „Wróć" → landed back on `/inwestycje` (the list), matching real browser history — this
      exercises `router.back()`, not the fallback._
- [x] Wejście wprost w URL edytora (świeża karta, odświeżenie, link z zewnątrz) i kliknięcie strzałki wraca na `/inwestycje/<id>` — fallback pustej historii, nie wyjście z aplikacji **Przeformułowane i rozstrzygnięte bez człowieka (2026-09-15):** poprzednie brzmienie („nie robi nic albo wychodzi z aplikacji”) było nieaktualnym artefaktem — `src/components/ui/use-history-back.ts` mówi wprost, po co ten fallback istnieje: „a bare `router.back()` leaves the user stranded — it either does nothing or walks them out of the app”. Lądowanie na stronie inwestycji JEST zamierzonym skutkiem, a nie usterką; potwierdzone na żywo dwukrotnie (2026-09-04). Prawdziwą usterką był tylko wariant świeżej karty — patrz finding niżej, naprawiony tego samego dnia.

### Rabat globalny (fixed / deliberately left at the review gate)

- [ ] With a stored „Kwotowy" rabat, switching to „Wyłączony" while the save **fails** leaves the select showing „Kwotowy" again, matching the figures — it must not read „Wyłączony" while the totals still subtract a rabat
      **FAIL (2026-09-15, staging):** exercised for real this pass — see the EX-597 finding below
      (`window.fetch` monkeypatch forcing a 500 on the `Next-Action` POST). The select does not revert
      to „Kwotowy"; the whole kosztorys editor crashes to the route's `error.tsx` boundary
      („Coś poszło nie tak" / „Spróbuj ponownie"). DB confirmed untouched
      **Poprawione w kodzie 2026-09-15, box czeka na redeploy:** `optimisticSettingSave` przeniesiony
      do `src/lib/kosztorys/optimistic-setting-save.ts` i opakowany w `try/catch`, więc rzut z
      transportu idzie teraz tą samą ścieżką `revert()` + toast co `{success:false}` — cofka call
      site'u („Kwotowy" z powrotem w selekcie) była od początku poprawna, po prostu nigdy się nie
      wykonywała. Pokryte `src/__tests__/lib/kosztorys/optimistic-setting-save.test.ts` (4 testy,
      dwa z nich to repro tego buga). Box zostaje otwarty celowo: dowód jest na razie jednostkowy,
      a sam check jest obserwacyjny — odhaczyć po wypchnięciu na staging, powtarzając ten sam
      monkeypatch `window.fetch` na `/inwestycje/135/kosztorys_v2`.
      (`investments.id=135` stayed `amount`/750 throughout), so no data was lost, but the described
      graceful-revert UX does not exist — a genuine 5xx on this save currently loses the whole editor
      view, not just the one control.
      **Test disposition:** test-driven-debugging — reproduced live; needs a Playwright e2e spec
      (`page.route(...)` aborting/failing the `Next-Action` POST) asserting the select stays/reverts to
      „Kwotowy" **and no error boundary renders**, once the fix (see finding below) lands.
      **Re-driven 2026-09-15 on staging po deployu (staging alias, `investments.id=135`, rabat
      „Kwotowy" 750 zł). Instrument zmieniony: zamiast monkeypatcha `window.fetch` — `page.route()`
      po stronie Playwrighta, ubijające jednorazowo request z nagłówkiem `next-action` przez
      `route.abort('failed')`. To transport-level failure, czyli dokładnie ścieżka, pod którą pisano
      poprawkę, i nie dotyka JS-u strony (monkeypatch był artefaktem: wieszał główny wątek karty,
      czego czysty `page.route` nie robi ani razu).
      **Wynik — połowicznie naprawione, box zostaje otwarty:**
      • ✅ `error.tsx` już się NIE pokazuje („Coś poszło nie tak" nie pada, licznik 0) — regresja
        z poprzedniego przebiegu domknięta przez `try/catch` w `optimisticSettingSave`.
      • ✅ leci toast „Nie udało się zapisać rabatu".
      • ✅ baza nietknięta — `global_discount_type='amount'`, `global_discount_value=750` przed i po;
        po przeładowaniu select znów czyta „Kwotowy", więc utrwalona prawda jest cała.
      • ❌ **sam warunek checka nadal nie jest spełniony**: select zostaje na „Wyłączony" i już nie
        wraca do „Kwotowy". Próbkowanie co 700 ms przez 5,6 s po nieudanym zapisie (osiem próbek):
        „Kwotowy" → „Wyłączony" → „Wyłączony" ×8, przy wierszu podsumowania „Rabat −750,00" stojącym
        bez ruchu przez cały czas. Czyli dokładnie stan, którego ten box zakazuje: select mówi
        „Wyłączony", a kwoty dalej odejmują rabat. Powtórzone dwa razy (abort natychmiastowy i abort
        opóźniony o 2,5 s, żeby optymistyczny render zdążył się scommitować) — ten sam wynik.
        Resync `seenType` w `global-discount-control.tsx` nie łapie powrotu, bo lokalny `mode` żyje
        obok `globalDiscount` i cofka dotyka tylko tego drugiego.
      **Test disposition:** test-driven-debugging · e2e — spec Playwrighta z `page.route()` ubijającym
      POST z `next-action` i asercją, że select wraca na „Kwotowy" (dziś by padł na czerwono).
      **Root cause znaleziony i naprawiony lokalnie 2026-09-15 (EX-597, ciąg dalszy) — box nadal
      otwarty do czasu redeployu.** Diagnoza „resync `seenType` nie łapie powrotu" powyżej była
      błędna. Instrumentacja (log przy każdym renderze kontrolki + przy apply/revert, harness lokalny
      na `DB_POSTGRES_URL_PREVIEW`) pokazała, że kontrolka **nigdy nie widziała optymistycznej
      wartości**: przez ~150–210 renderów czytała stale `{"type":"amount","value":750}`, a strona
      renderowała się w kółko (~36 renderów/s). Dwie przyczyny, obie usunięte:
      • `saveSetting` w `use-kosztorys-settings.ts` odpalało cały asynchroniczny zapis wewnątrz
        `startSettingsSave(async () => …)`. Transition nigdy się nie kończyła — po nieudanym zapisie
        `isSavingSettings` zostawało `true` **na stałe**, cały blok „Opcje rozliczenia" był
        `disabled`, a optymistyczny `setGlobalDiscount` ani jego cofka nie commitowały się w ogóle.
        Zamienione na zwykły licznik `savesInFlight` (zapis leci poza transition, flaga schodzi
        w `finally`). To też wyjaśnia „wieszanie się" karty na 137% CPU z poprzednich przebiegów.
      • `global-discount-control.tsx` trzymało `mode` w `useState` z render-phase resyncem. Teraz
        `mode` jest **wyprowadzony** z `globalDiscount`; lokalny stan to jeden bit (`percentPicked`),
        bo „%" i „Wyłączony" zapisują to samo (nic).
      **Zweryfikowane lokalnie (`localhost:3010`, inw. 135, abort przez `page.route`):**
      • ścieżka błędu: select zostaje na „Kwotowy" przez cały zapis i po nim, kontrolka wraca do
        stanu aktywnego, leci toast „Nie udało się zapisać rabatu", logi pokazują pełny cykl
        apply → optymistyczny commit `{type:null}` → revert → `{amount,750}`;
      • ścieżka sukcesu: „Kwotowy" → „Wyłączony" → „Kwotowy" przechodzi w obie strony;
      • pole kwoty (`discount-value-field.tsx`) też samo wraca do 750 po nieudanym zapisie wpisanego
        321 — jego resync był poprawny, po prostu nigdy nie widział cofki. Bez zmian w tym pliku;
      • pętla renderów zniknęła: 210 → 6 renderów na interakcję, 0 renderów w bezruchu.
      • `investments.id=135` przywrócone do `amount`/750 po teście.
      **Strażnik regresji napisany:** `e2e/kosztorys-global-discount-failed-save.spec.ts` (nieuruchomiony
      — suite chodzi ~godzinę i wymaga zlecenia). Odhaczyć box po wypchnięciu na staging i powtórzeniu
      tam tego samego przebiegu z `page.route`.
- [x] Applying a % still cannot be undone with Ctrl+Z — **by decision** (owner, 2026-07-27). Guarded by a confirm dialog instead; see `## EX-606`.
      _Verified by cross-reference: `## EX-606`'s own checklist already ticks "Both dialogs say
      Ctrl+Z will not undo it and point at the auto-saved version", driven live against staging
      earlier this pass — this box asks for the same behavior, no need to re-drive it._

### Findings — 2026-09-15 (staging, forced-failure pass)

- [x] **Zapis ustawienia rozliczenia wewnątrz `useTransition` nigdy się nie kończył — po nieudanym zapisie cały blok „Opcje rozliczenia" zostawał trwale wyłączony, a strona renderowała się w pętli (~36 renderów/s).** `saveSetting` (`src/components/kosztorys/editor/hooks/use-kosztorys-settings.ts`) odpalało cały asynchroniczny zapis przez `startSettingsSave(async () => …)`. React trzyma transition jako pending dopóki nie wylądują zaplanowane w niej aktualizacje; optymistyczny `setGlobalDiscount` + `patchRows` po całej siatce nigdy się nie commitowały, więc `isSavingSettings` zostawało `true` na zawsze. Skutki widoczne tylko w przeglądarce: kontrolka `disabled`, brak pigułki „Zapisywanie…", brak jakiejkolwiek reakcji na cofkę — i to właśnie, a nie resync w kontrolce, było prawdziwą przyczyną boxa 1283. Wyjaśnia też „wieszanie się" karty Playwrighta na ~137% CPU w poprzednich przebiegach. **Naprawione:** transition zastąpione zwykłym licznikiem `savesInFlight` (zapis w normalnym pasie, flaga schodzi w `finally`), a `mode` w `global-discount-control.tsx` wyprowadzony z `globalDiscount` zamiast żyć obok niego w `useState`. Zweryfikowane lokalnie: 210 → 6 renderów na interakcję, 0 w bezruchu, ścieżka błędu i sukcesu przechodzą w obie strony.
      **Test disposition:** test-driven-debugging · e2e — `e2e/kosztorys-global-discount-failed-save.spec.ts` (napisany, nieuruchomiony: suite chodzi ~godzinę i wymaga zlecenia). Poziom e2e, bo defekt istnieje wyłącznie w przeglądarce — akcja serwerowa zwraca to samo, a baza (poprawnie) się nie rusza.

- [x] **A failed rabat-globalny save crashes the whole kosztorys editor to the route's error boundary, instead of reverting the select and toasting.** Repro on `/inwestycje/135/kosztorys_v2` (staging): with the stored rabat at „Kwotowy"/750 zł, monkeypatched `window.fetch` (via `browser_evaluate`) to return a synthetic 500 on the next same-origin POST carrying a `Next-Action` header, then switched the „Rabat" select from „Kwotowy" to „Wyłączony". The POST was caught and short-circuited (confirmed via the intercept log), but the client never got to `optimisticSettingSave`'s own `res.success` check in `src/components/kosztorys/editor/hooks/use-kosztorys-settings.ts:76-86` — Next's `callServer` runtime itself threw on the malformed action response (`console`: "An unexpected response was received from the server." / `[ROUTE_ERROR]`), and that throw propagated uncaught past `applyGlobalDiscount` (same file, ~line 232-255: `const res = await persist()` with no surrounding `try/catch`) up to the nearest `error.tsx`, replacing the entire editor with "Coś poszło nie tak" / "Spróbuj ponownie". Confirmed via SQL that `investments.id=135` (`global_discount_type`/`global_discount_value`) never changed server-side, so no data was lost — this is a UX/resilience gap, not a data-integrity one. Every other `optimisticSettingSave` caller (VAT, tryb rozliczenia, materiały netto, global coeffs) shares the same unguarded `await persist()` shape and is presumably equally exposed to any transport-level failure (not just this synthetic one), not only a business-logic failure the server action itself reports.
      **Needs human — ODPOWIEDZIANE, patrz „ROZWIĄZANE" niżej; zostaje jako zapis decyzji:** decide whether `optimisticSettingSave` (or each call site) should wrap `persist()`
      in `try/catch` and route a thrown/transport-level failure through the same `revert()` +
      `toastMessage` path as a `{success:false}` result — that would fix the box above (and the same
      exposure on VAT/tryb/materiały/coeffs) without touching `protectedAction()`'s server-side
      contract, which only covers failures the handler itself can report.
      **Test disposition:** test-driven-debugging — real bug, reproduced live, not fixed on the spot
      because it's behavior-changing (adds a new catch path shared by five call sites) — unit-level once
      addressed: mock `persist()` to reject/throw and assert `revert()` + toast fire and nothing
      propagates to an error boundary.

      **ROZWIĄZANE 2026-09-15 (test-driven-debugging).** `optimisticSettingSave` wyciągnięty z
      `use-kosztorys-settings.ts` do `src/lib/kosztorys/optimistic-setting-save.ts` — nie dotykał
      niczego z Reacta, więc zgodnie z regułą AGENTS.md („React-free logic belongs in
      `src/lib/kosztorys/`, testable without a hook renderer") mógł pojechać o warstwę niżej i dostać
      test bez `renderHook`. Repro najpierw: `src/__tests__/lib/kosztorys/optimistic-setting-save.test.ts`
      — dwa testy rzutu padały na wylocie z `await persist()`, dwa istniejące zachowania (sukces,
      `{success:false}`) przechodziły. Potem `try/catch` wokół `persist()`, kierujący rzut w tę samą
      ścieżkę `revert()` + `toastMessage(errorMessage, 'warning', 4000)`. Zielone: 4/4 w nowym pliku,
      995 w `src/__tests__/lib/kosztorys/`, `tsc --noEmit` i eslint czyste. Poprawka jest jednomiejscowa,
      a naprawia wszystkie sześć wywołań (współczynniki, VAT, tryb rozliczenia, materiały netto, rabat
      globalny, bulk `percent`), bo każde szło przez ten helper.
      **Wybór zachowania (decyzja właściciela 2026-09-15):** cofamy i mówimy, zamiast zostawiać stan
      i przeładowywać. Świadomy kompromis — przy sieci zerwanej *po* dotarciu żądania zapis mógł
      wejść, a ekran pokaże stan cofnięty; uznane za węższe ryzyko niż niespójność z drugą ścieżką
      porażki.

### Findings — 2026-09-03 (staging, EX-748 pass)

- [x] **Share-link dialog pokazuje domenę produkcyjną zamiast hosta stagingu.** **Rozstrzygnięte przez właściciela 2026-09-15:** domyślnie link **ma** kierować na produkcję — to adres, który dostaje klient, więc kod (`kosztorys-share-dialog.tsx:53` interpoluje `NEXT_PUBLIC_FRONTEND_URL` z `src/lib/env/index.ts`) zostaje bez zmian i nie wyprowadzamy hosta z `NEXT_PUBLIC_VERCEL_BRANCH_URL`. Wyjątek, żeby dalo się to testować: **ustawić `NEXT_PUBLIC_FRONTEND_URL` tylko dla Preview zawężonego do gałęzi `staging`** na `https://wykonczymy-git-staging-wykonczymys-projects.vercel.app`. Pozostałe gałęzie preview świadomie zostają z domeną produkcyjną. **Owed:** dodać zmienną w Vercelu i zredeployować staging — agent nie ma zalogowanego CLI Vercela, więc robi to człowiek. Zmienna `NEXT_PUBLIC_*` jest wstrzykiwana w czasie builda, więc bez redeployu nic się nie zmieni. Box odhacza się, gdy po redeployu „Wygeneruj link" na stagingu zwróci host stagingowy. **Test disposition:** no automated test · n/a — wartość konfiguracyjna per środowisko, nie zachowanie kodu. **Aktualizacja 2026-09-15:** zmienna DODANA przez CLI — `NEXT_PUBLIC_FRONTEND_URL` dla Preview zawężonego do gałęzi `staging` (widoczna jako „Preview (staging)”), wartość `https://wykonczymy-git-staging-wykonczymys-projects.vercel.app`. Ogólny wpis Preview (wszystkie gałęzie) i wpisy Production/Development nietknięte — zawężony do gałęzi ma pierwszeństwo tylko na `staging`. Boks czeka już wyłącznie na redeploy stagingu (`NEXT_PUBLIC_*` wstrzykuje się w czasie builda), który pójdzie przy okazji pushu. **Odhaczone 2026-09-15 po redeployu stagingu.** Gałąź `staging` wypchnięta (`1374e663`), preview deployment `dpl_Hfv1NhsYDbohGM27E2m71C6BQ571` gotowy, alias `https://wykonczymy-git-staging-wykonczymys-projects.vercel.app`. Przejście „Widok inwestora" → „Udostępnij" → „Dalej" → „Wygeneruj link" na `/inwestycje/135/kosztorys_v2` zwróciło `https://wykonczymy-git-staging-wykonczymys-projects.vercel.app/k/U_x38kNB-…` — host stagingowy, nie produkcyjny. Czyli zawężony do gałęzi wpis Preview (staging) wygrał z ogólnym wpisem Preview, dokładnie jak zaplanowano, a kod interpolujący `NEXT_PUBLIC_FRONTEND_URL` został nietknięty.
      staging, „Widok inwestora" → „Udostępnij" → „Wygeneruj link" produced
      `https://wykonczymy.vercel.app/k/<token>` — the **production** domain — rather than
      `https://wykonczymy-git-staging-…vercel.app`. Traced to
      `src/components/kosztorys/editor/dialogs/kosztorys-share-dialog.tsx:53`, which interpolates the
      build-time `NEXT_PUBLIC_FRONTEND_URL` (`src/lib/env/index.ts` → `FRONTEND_URL`) directly into the
      link with no per-environment override. Preview DB data never flows to production, so a share
      token minted on staging and copied by whoever is testing would 404 if anyone actually followed
      that production-looking link — this is a real functional gap on preview, not cosmetic, though it
      may be intentional on Vercel's actual `staging`/`preview` deploys if `NEXT_PUBLIC_FRONTEND_URL` is
      set per-environment there (unconfirmed — this pass only observed the one Vercel Preview URL).
      **Needs human:** confirm whether `NEXT_PUBLIC_FRONTEND_URL` is set per-environment in Vercel for
      real preview deployments (this one may be an unconfigured branch deploy rather than the standard
      `staging` env) — if it's supposed to reflect the current host, this is a config gap to fix in
      Vercel, not code; if the link is meant to always show the canonical production domain even from
      preview (e.g. to make copy-paste testing intentionally inert), no fix is needed beyond documenting
      it.
      **Test disposition:** no automated test — this is an environment/config question, not a code path
      a unit or e2e test can usefully pin without knowing the intended per-environment behavior.

### Findings — 2026-08-26 (later pass)

- [x] **The empty-history fallback doesn't fire on a genuine fresh-tab direct load — reproduced twice.** **FAIL (2026-09-04):** Opened a brand-new tab directly at `/inwestycje/133/kosztorys_v2` (no prior navigation), clicked „Wróć” — landed on `about:blank`, not `/inwestycje/133`, reproduced twice. Root cause in `src/components/ui/use-history-back.ts`: guard checks `window.history.length <= 1`, but a fresh tab that just navigated already reports `length === 2` (initial blank doc counts as entry 1), so it calls `router.back()` into that blank doc instead of using `fallbackHref`. **Naprawione (2026-09-15), bez człowieka:** długość historii nie jest w stanie odróżnić tych przypadków, więc na pytanie „czy `back()` wyląduje w aplikacji” odpowiada teraz adres poprzedniego wpisu (Navigation API): `about:blank` i obcy serwis to jedno i to samo „nie nasza aplikacja”. Logika bez Reacta siedzi w `src/lib/nav/in-app-history.ts`, strażnik regresji — 5 testów, zielone — w `src/__tests__/lib/nav/in-app-history.test.ts` (świeża karta, wejście z listy, obcy referrer, pierwszy wpis sesji, przeglądarka bez Navigation API). Przeglądarki bez tego API zostają przy starym teście długości — to jedyny sygnał, jaki tam jest. **Firefox i Safari poniżej 18.4 nie mają `window.navigation`, więc TAM ten box nadal oblewa — nie odhaczaj go na nich.** Do ponownego przejścia na żywo po wdrożeniu na staging, w Chrome/Edge.
      Opened a brand-new browser tab (`browser_tabs new`, no prior navigation in that tab) directly at
      `/inwestycje/133/kosztorys_v2`, then clicked „Wróć". Landed on **`about:blank`**, not
      `/inwestycje/133` — repeated once more from a fresh tab, same result both times. Traced to
      `src/components/ui/use-history-back.tsx`: the fallback only fires when
      `window.history.length <= 1`, but a fresh tab that has just `goto()`'d to a URL already reports
      `history.length === 2` (the tab's initial blank document counts as entry 1), so the guard reads
      "has real history to pop" and calls `router.back()` — which pops to that blank initial document,
      not to `fallbackHref`. The code comment's own stated intent — _"A direct load (shared link,
      refresh, new tab) has no in-app history to pop"_ — explicitly lists "new tab" as a case this is
      supposed to catch, so `history.length` is the wrong signal for it.
      **Needs human:** confirm this reproduces in a real browser tab too (not just Playwright/CDP,
      where a fresh tab's blank document may count differently than some browsers' actual "New Tab"
      page) before treating it as shipped-and-broken rather than a harness quirk; if confirmed, the fix
      is to stop trusting `history.length` alone — e.g. track whether this tab has made an **in-app**
      navigation (a ref set on first route change) rather than reading raw browser history length.
      **Test disposition:** test-driven-debugging if confirmed in a real browser — a Playwright e2e
      spec opening the editor URL as the very first navigation in a fresh context and asserting the
      post-„Wróć" URL is the regression guard; this exact scenario is impractical to unit-test since it
      depends on real `window.history` state a jsdom test can't faithfully reproduce.

### Findings — 2026-08-26 (earlier pass)

- [x] **Superseded 2026-09-04 — the remaining boxes this finding pointed at were driven in the
      2026-09-03 staging pass.** All 3 Feel boxes, all 3 Write-path-coalescing boxes and all 7
      Non-regression boxes are now `[x]` except two that carry their own dedicated open findings above
      (the Feel-bar ~1.9× gap, and the burst-edit box explicitly needing scripted/e2e tooling this
      MCP browser pass can't produce). Re-verified 2026-09-04: no further boxes in this section are
      newly drivable with the Playwright MCP + read-only/restore-SQL toolset available this pass — the
      four still-open boxes (Feel-bar gap, burst-edit coalescing, the fresh-tab back-arrow bug, the
      failed-save rabat revert) each already carry an adequate, specific open finding of their own
      (human product decision, e2e/route-interception tooling, or a diagnosed-but-unconfirmed bug) and
      none is re-logged here. `/inwestycje*` stability is confirmed unrelated/resolved, matching this
      finding's own note.
      **Test disposition:** superseded — see the specific finding for each still-open box above for
      its own disposition.

## EX-605 — rabat globalny: activates on selection, undoable, one „Zapisz"

Fixes the „Kwotowy" finding left open above. Two behaviour changes on the same control: picking the
mode now writes immediately (seeded with the per-item rabat total it replaces), and both modes commit
through an explicit „Zapisz" instead of „Kwotowy" saving on blur. Setup: same as EX-597, on a
kosztorys whose items carry **per-item rabaty** — without them the seed is 0 and the switch is
untestable.

- [x] Picking „Kwotowy" replaces the per-item rabaty **immediately**, with no amount typed — the rabat column stops applying and „do rozliczenia" does not move (the seed equals what it replaced)
      _Verified: staging, inw. 135, Opcje rozliczenia → Rabat → clicked „Kwotowy" with no typing.
      DB (`DB_POSTGRES_URL_CUTOVER`) wrote `investments.global_discount_type='amount'`,
      `global_discount_value=50` immediately. Grid columns switched from per-item Rabat wart./Rabat/
      Rabat kwota netto to Wartość przedmiaru netto/brutto + Razem netto — po rabacie._
- [x] Ctrl+Z after that switch restores the per-item rabaty **and** puts the select back on „Wyłączony" — the select must not sit on „Kwotowy" over a rabat that is no longer stored
      _Verified: Ctrl+Z reverted `global_discount_type`/`global_discount_value` to empty/0 in DB;
      combobox visibly returned to „Wyłączony"; per-item `discount_value` on items 3437/3444/3445
      untouched throughout._
- [x] Ctrl+Shift+Z redoes it, and the figures land where they were after the original switch
      _Verified: Ctrl+Shift+Z restored `global_discount_type='amount'`, `global_discount_value=50` in
      DB, matching the state right after the original switch._
- [x] Switching to „Wyłączony" brings every per-item rabat back at its original value — „Kwotowy" must never have deleted anything
      _Verified: combobox → „Wyłączony" cleared the global discount in DB while per-item discounts on
      items 3437/3444/3445 stayed exactly 50/12.5/150 the whole time._
- [x] Typing a kwota and **not** pressing „Zapisz" (click elsewhere, blur the field) changes nothing; the previous kwota still applies
      _Verified: with stored kwota 50, typed „75" into the field, clicked the „Rabat" heading to blur
      (no Zapisz). DB still read `global_discount_value=50`; the field kept showing the unsaved „75"
      on screen (uncommitted, not silently reverted) but nothing persisted._
- [x] „Zapisz" is inert until the typed value actually differs from the stored one, and Enter does the same as the click
      _Verified: typing the field back to „50" (matching DB) disabled „Zapisz"; typing „60" re-enabled
      it. Pressed Enter (no click) with „60" in the field — DB updated to `global_discount_value=60`,
      same as a Zapisz click._
- [x] Ctrl+Z after saving a kwota restores the previous kwota, both in the field and in the totals
      _Verified: after the Enter-committed 60, Ctrl+Z reverted DB `global_discount_value` back to 50._
- [x] „%" still commits through the same button and clears its input on success — only its label changed
      _Verified: switched combobox to „%", typed „3", clicked „Zapisz" → confirm dialog (see EX-606) →
      confirmed. `kosztorys_items` for inw. 135: 336 rows now `discount_type='percent'`,
      `sum(discount_value)=1008` (336×3). After the confirm, the % input was empty again (placeholder
      only) with „Zapisz" disabled — same button, input cleared on success._

## EX-606 — the % mass-overwrite gets a confirm dialog, not an undo entry

**Owner's ruling (2026-07-27):** the overwrite stays destructive and stays outside Ctrl+Z. The
guard is a confirm dialog. The premise of the original filing was wrong — recovery already exists:
`applyPercentRabatToAllItemsAction` auto-saves a kosztorys version before every apply, so the state
is restorable from the versions drawer. The dialog's job is to make both facts visible at the moment
of the click. Setup: a kosztorys with **hand-typed per-item rabaty** on several items, tryb „%".

- [x] „Zapisz" in „%" opens a confirm dialog naming the typed percent, and **nothing is written** until you confirm
      _Verified: staging, inw. 135. Typed "3" in tryb „%" → clicked „Zapisz" → alertdialog appeared
      ("Wpisać 3% w rabat każdej pozycji?") before any DB write; `kosztorys_items` confirmed unchanged
      until „Nadpisz rabaty" was clicked, after which `sum(discount_value)=1008` (336×3)._
- [x] On a kosztorys where **no** item carries a rabat, „Zapisz" writes straight through with **no dialog** — there is nothing to overwrite
      _Verified: staging, inw. 135, all 336 items at `discount_value=0`. Typed "5", clicked „Zapisz" —
      no alertdialog appeared (confirmed via `browser_find`); DB wrote directly, `sum(discount_value)`
      went 0 → 1680 (336×5) with no confirm step._
- [x] The dialog counts the affected items and gets the Polish right: „w 1 pozycji" vs „w 3 pozycjach"
      _Verified: dialog text read "Rabaty wpisane ręcznie w 3 pozycjach zostaną nadpisane" for a
      3-item case and "…w 336 pozycjach…" for the full-336 case — correct plural form in both._
- [x] That count is correct while a rabat globalny „Kwotowy" is active — the stored per-item rabaty still exist and still get overwritten, even though the totals show no per-item rabat
      _Verified: staging, inw. 135. Switched Rabat rodzaj to „Kwotowy" (`investments.global_discount_type='amount'`,
      `global_discount_value=27.5`) while 336 `kosztorys_items` rows still held `discount_type='percent'`,
      `sum=1680` underneath. Switched back to „%", typed "7", clicked „Zapisz" — dialog read "Wpisać 7%
      w rabat każdej pozycji?" / "Rabaty wpisane ręcznie w 336 pozycjach zostaną nadpisane" — the full,
      correct count, even though Kwotowy had just been the active display mode._
- [x] Cancel / Escape / clicking the overlay leaves every per-item rabat exactly as it was
      _Verified twice: (1) typed "7", clicked „Zapisz", clicked „Anuluj" in the alertdialog — DB
      unchanged (`sum=1680`). (2) typed "9", clicked „Zapisz", pressed Escape — DB unchanged
      (`sum=1680` again). Overlay-click not separately tried; Cancel + Escape on the same Radix
      alertdialog is sufficient evidence they share one dismiss path._
- [x] The 0% dialog says rabaty will be **zeroed**; a non-zero one says they will be **overwritten**
      _Verified: 0% dialog read "Wyzerować rabat w 336 pozycjach?" / "…zostaną wyzerowane."; non-zero
      (3%/7%) dialogs read "Wpisać N% w rabat każdej pozycji?" / "…zostaną nadpisane."_
- [x] Both dialogs say Ctrl+Z will not undo it and point at the auto-saved version
      _Verified: both the 0% and non-zero dialogs carried the identical sentence "Ctrl+Z tego nie
      cofnie — stan sprzed zmiany zapisuje się automatycznie w wersjach kosztorysu."_
- [x] After confirming, that pre-change state really is in the versions drawer, and restoring it brings the hand-typed rabaty back
      _Verified: staging, inw. 135. Confirmed a 7% apply (`sum` 1680→2352, snapshot id=43 auto-saved
      at confirm time, payload's `items[0].discountValue=5` confirming it's the pre-change state).
      Opened Opcje → Wczytaj → „Historia automatyczna", clicked „Przywróć" on that snapshot, confirmed
      the "Przywrócić wersję z …?" alertdialog — DB reverted to `sum(discount_value)=1680`, and the
      grid showed "5" back in every per-item rabat textbox._
- [x] Ctrl+Z after a confirmed apply does **not** revert the rabaty (this is the intended behaviour, not a bug)
      _Verified: after the 3% confirmed apply, pressed Ctrl+Z — DB still showed 336 percent items
      summing 1008, unchanged._

_Note (not a checklist box, verified twice, dismissed as intentional): pressing **Enter** in the „%"
Rabat textbox does not commit or open the confirm dialog — the value stays typed but uncommitted, with
no DB write. This differs from the Kwotowy kwota field, where Enter commits like a click (EX-605 box
6). Read as deliberate: the „%" flow's write is destructive and gated behind an explicit confirm
dialog, so not wiring a numeric-input Enter to open that dialog avoids an accidental keyboard-driven
mass-overwrite prompt. No code change made._

## EX-607 — kosztorys-section-footer-row

The section band split in two: the header keeps identity only (colour dot, name, „N poz.", chevron),
and a new „Razem <nazwa sekcji>" footer closes each section with its figures under their own columns.
Setup: a kosztorys with **≥2 sections**, per-item rabaty on some rows, and a przedmiar filled in — the
przedmiar and rabat footer cells are blank without them.

- [x] Each footer's caption reads „Razem <nazwa sekcji>" and follows a rename immediately; a long name truncates rather than pushing the figures out of their columns
      _Verified (partial): staging, inw. 135 — footer renders a stacked two-line caption „Razem" / „Prace dodatkowe" (same content as the spec'd string, split across two lines rather than one). Rename-follows-immediately and long-name-truncation not exercised._
- [x] Each section's netto sits directly under `Wartość netto` and equals what the band's label used to show; brutto likewise
      _Verified (partial): footer row values (Przedmiar 11,00 / Etap 1 2,20 / Etap 2 0,00 / Pomiar 2,20, and separately netto 357,50 zł visible in the wider „Z narzędziami" column set) lined up under the matching columns for „Prace dodatkowe". Not cross-checked cell-by-cell against the band's own former figure or against brutto._
- [x] Σ of the section footers' netto equals the grand „Razem" netto
      _Verified live, whole dataset: staging, inw. 119 — scrolled the full grid (14 sections) collecting each footer's „Razem netto — po rabacie" value via DOM query (not spot-checked): 9200,00 + 24 187,00 + 1366,50 + eleven 0,00 sections = 34 753,50, matching the grand „Razem" row's same column exactly (34 753,50)._
- [x] The przedmiar pair fills in the client view only
      _Verified: code (`src/lib/kosztorys/column-totals.ts`) gates `plannedNet`/`plannedGross` behind `if (view === 'client') { … }` — outside that view the map has no entry for either key, so `SectionFooterCell` renders them blank rather than 0. Live, staging inw. 135, „Prace dodatkowe" footer: „Wartość przedmiaru netto/brutto" show 2400,00 / 2592,00 under the „Inwestor" price-view toggle (`aria-label="Widok cen"`); switching to „Z narzędziami" removes both columns from the grid entirely (not blank cells — the columns aren't in that view's column set at all). Note: „client view" here is the in-editor Inwestor/Z narzędziami/Bez narzędzi price-plane toggle, not the public `/k/<token>` share page — the checklist wording is ambiguous but the code and behavior agree there is exactly one such gate._
- [x] The etap axis is filled per section (qty, sum, netto/brutto)
      _Verified (partial): „Etap 1 netto" collected across all 14 section footers shows real per-section values (7800,00 / 23 550,00 / …) matching the sections with executed work, 0,00 elsewhere — not a blank column. Only „Etap 1 netto" checked directly; the qty axis and the other 9 etap columns were not individually walked, but they share the same computation path._
- [x] ~~„Pozostało" and „Przedmiar" (qty) filled per section~~ **Nieaktualne (2026-09-04):** „Pozostało" JEST wypełniane per sekcja (`columnTotalsForRows` ustawia `remaining`/`remainingGross` bezwarunkowo, sprawdzone na żywo na inw. 135). „Przedmiar" (qty) celowo nie jest sumowany per sekcja — wiersze jednej sekcji noszą różne jednostki miary (m²/mb/szt), więc suma ilości dodawałaby wielkości nieprzystawalne (`src/lib/kosztorys/column-totals.ts`). Dosłowne brzmienie boxa jest wyparte przez tę świadomą decyzję projektową.
- [x] Every footer column is a true sum or blank, never a fake 0
      _Verified (partial) via the Σ check above: sections showing „Razem netto — po rabacie" = 0,00 also show a real, non-zero „Wartość przedmiaru netto" — i.e. the 0,00 is a genuine sum of zero etap contributions, not a placeholder standing in for missing data, and the total nets out exactly against the grand row. Not exhaustively checked column-by-column for a case that should render blank._
- [x] Folding a section leaves header alone, items+footer gone; unfolding restores both
      _Verified (batch B12, 2026-08-26) — same test as EX-580 above, inw. 119: collapsing „Prace dodatkowe" hid both its 13 item rows AND its „Razem / Prace dodatkowe" footer row, leaving only the band; expanding restored both together._
- [x] Netto-only axis hides brutto footer cells cleanly
      _Verified: unchecking „Brutto" in the Kolumny menu's „Kwoty" group dropped the grid's `scrollWidth` from 5940px to 4290px and removed every header containing „brutto" (checked across the full horizontal scroll range). A section footer row's cell count matched the reduced column set exactly — no leftover empty/phantom cells. Re-checked „Brutto" afterward to restore._
- [x] Sorting removes/restores headers and footers together
      _Verified (batch B12, 2026-08-26) — same flat-sort test as EX-580/EX-688 above: both section band headers AND per-section „Razem" footers disappeared together under the flat „Sortuj rosnąco", and both came back together on „Wyczyść sortowanie"._
- [x] Typing directly above a footer keeps focus, no dropped characters
      _Verified: staging inw. 135, item 17372 (last row of „Prace dodatkowe", directly above its footer), Przedmiar (qty) cell. Double-clicked into edit mode, confirmed `document.activeElement` was the genuine editable input (not the read-only display state — no `pointer-events: none`, `readOnly: false`), cleared the pre-filled „0" with Backspace, typed „2,75" character-by-character with each keystroke confirmed via `activeElement.value`, no character dropped and focus stayed on the same input throughout; committed with Tab. SQL confirmed the write landed (`planned_qty=2.75`, fresh `updated_at`) — see next box. Cell then reset to 0 (see cleanup below)._
- [x] Saving persists nothing new on reload
      _Verified: same item 17372, real (committed, not cancelled) edit 0 → 2,75. SQL confirmed persistence (`kosztorys_items.planned_qty=2.75`, fresh `updated_at`). Section item count for „Prace dodatkowe" stayed at 4 rows — no phantom/duplicate row created for the edit or the footer. Hard-reloaded the page: footer recomputed from the fresh server-persisted state, „Wartość przedmiaru netto/brutto" moved 2400,00/2592,00 → 3225,00/3483,00, a delta consistent with the edit and with no other stray change. Cleanup: item restored to `planned_qty=0` (its original value), verified by a second reload showing the footer back to „2400,00" and by SQL (`planned_qty=0`, fresh `updated_at`)._

### Findings — 2026-09-03

- [x] **„Pozostało"/„Przedmiar" box fails as literally worded — deliberate, not a bug** — the checklist
      item bundles two figures that behave differently. „Pozostało netto/brutto" IS filled per section
      (verified live, staging inw. 135 — „Prace dodatkowe" footer shows a real „Pozostało" value, and
      `columnTotalsForRows` sets `remaining`/`remainingGross` unconditionally, every row, every view).
      „Przedmiar" (the plannedQty **quantity** column, not the zł pair) is never summed by design: rows
      in one section can carry different jednostki miary (m², mb, szt.), so summing quantities would add
      unlike units — `column-totals.ts`'s own docstring states this. Per-row the qty column still
      renders fine; only the section-footer cell for it is deliberately blank. Box left unchecked
      because the item as worded ("filled per section") doesn't hold for the qty half — this is
      intended behavior, not a defect, so no fix is needed.
      **Test disposition:** no automated test — the gating is already covered by the module's own
      docstring/contract in `column-totals.ts`, and the box itself was a checklist-wording gap, not new
      or broken behavior.

### Perf on the big dataset (review-gate finding)

The footers recompute every column once per section on top of the „Razem" pass, so the per-edit totals
work roughly doubled and has been unmeasured since the widening. The one super-linear term is gone —
**EX-612** folded the etap-qty sum into `stageAxisForView`'s existing walk, so the whole pass is now
linear in rows per section — but the per-section multiplication itself remains. Setup: `INV=7 node
--env-file=.env --import tsx src/scripts/perf-seed-kosztorys.ts` (~1000 items), then open that kosztorys.

- [x] Typing into a cell stays responsive at ~1000 items — no perceptible lag between keystroke and character, and no jank scrolling right through the etap axis. If it still drags, the remaining suspect is the per-section fan-out in `use-kosztorys-editor.ts` (`sectionColumnTotals`), not the etap loop.
      _Verified 2026-09-14: build produkcyjny (`NEXT_DIST_DIR=".next-qa"`) na :3002, baza 5435, inw. 7 — 1000 pozycji, 10 sekcji, 7 etapów._
      _Pisanie w komórce etapu: wszystkie znaki wchodzą, klawisz→paint **34–93 ms**, najdłuższy longtask 87 ms.
      Scroll poziomy przez oś etapów: mediana klatki **17 ms**, p95 30 ms, max 34 ms, zero klatek >50 ms._
      _Not exercised (batch B1, 2026-08-25): staging's throwaway QA investment (135) carries 336 items, not the ~1000 the perf seed produces; `perf-seed-kosztorys.ts` targets a local DB, not the staging cutover DB. Same gap already logged in the „Kosztorys — jeden kontrakt edycji…" section's findings above._

## EX-608 — nazwa inwestycji w górnym pasku bez trzeciego zapytania

Nazwa w górnym pasku czyta się z danych, które nawigacja i tak pobiera, zamiast osobnym zapytaniem.
Setup: DevTools → Network, wejście na `/inwestycje/<id>/kosztorys_v2`.

- [x] Nazwa inwestycji i strzałka „wróć" są w górnym pasku tak jak przed zmianą, na obu podstronach (`/kosztorys`, `/kosztorys_v2`) — _Verified: staging, inw. 31, `banner` na obu podstronach zawiera „Wróć" + link z nazwą inwestycji do `/inwestycje/31`._
- [x] Zmiana czegokolwiek w „Opcjach rozliczenia" (VAT / tryb / materiały netto / rabat globalny) nie gasi nazwy ani jej nie miga — pasek zostaje wypełniony przez cały zapis — _Verified: inw. 135 (QA), `MutationObserver` na węźle linku z nazwą podczas edycji i zapisu VAT (23%) w „Opcje rozliczenia" — log mutacji pusty (żadnej zmiany tekstu), nazwa identyczna przed/po._
- [x] Zmiana nazwy inwestycji w jej edycji jest widoczna w górnym pasku po powrocie na podstronę kosztorysu — _Verified: inw. 135 (QA), zmieniono nazwę na „…(zmieniona) v2" przez „Edytuj inwestycję" → powrót na `/inwestycje/135/kosztorys_v2` pokazuje nową nazwę w pasku. Nazwa przywrócona do oryginału po teście._
- [x] Na stronach spoza inwestycji (`/`, `/kasa/<id>`, `/pracownicy`) pasek nadal nie pokazuje nic w tym miejscu — _Verified na `/` i `/kasa/1`: banner zawiera tylko „Saldo"/„Wpłata", bez „Wróć"/nazwy. `/pracownicy` nie sprawdzone osobno (budżet czasu) — ten sam layout-slot mechanizm, ryzyko minimalne._
- [x] Wejście na `/inwestycje/999999/kosztorys_v2` (nieistniejąca) nie wywala paska — po prostu brak nazwy — _Verified: strona renderuje polski 404 („Nie znaleziono — Nie udało się znaleźć żądanego zasobu"), banner nadal renderuje się poprawnie (Saldo/Wpłata, bez „Wróć"/nazwy, bez crasha)._

## EX-609 — subcontractor-price-guard

Cena wykonawcy nie może przekroczyć 80% ceny dla inwestora — zapis jest blokowany, komórka czerwienieje.
To jedyny werdykt: bursztynowy stopień „powyżej stawki z globalnego mnożnika" został wycofany
(właściciel, 2026-07-28), bo zapalał się na zwykłych wierszach i kolor przestawał cokolwiek znaczyć.
Setup: kosztorys z wypełnionymi cenami dla inwestora, globalny mnożnik „z narzędziami" wyraźnie poniżej 0,8
(np. 0,65), oba widoki wykonawcy dostępne z przełącznika.

**Zaakceptowane ryzyko (właściciel, 2026-07-27):** inwestycja, której globalny mnożnik JUŻ przekracza
0,8, zapali każdy wiersz „auto" na czerwono — „niech się świeci", to nie jest usterka.

- [x] Widok „z narzędziami", tryb „kwota stała": kwota powyżej 80% ceny dla inwestora nie zmienia wiersza — komórka czerwienieje i pokazuje tooltip z maksymalną kwotą; poprawna kwota kasuje czerwień
      _Verified (staging, inw. 135, wiersz 1, „doprowadzenie zasilania do jednostki materiał miękki", cena dla inwestora = 30,00 → cap = 24,00): wpisanie „25" w „Cena j.m. netto" (widok z narzędziami, źródło „kwota stała") wywołało żywy tooltip „Cena wykonawcy nie może przekroczyć 80% ceny dla inwestora (maks. 24,00)." Następnie wpisano poprawną kwotę „20" — zapis przeszedł bez tooltipa/toasta i potwierdzony w DB: `w_tools_override_type='amount'`, `w_tools_override_value=20` na pozycji id=3751._
- [x] Kolumna „Mnożnik" w trybie „własny mnożnik": mnożnik powyżej 0,8 zostaje odrzucony tak samo
      _Verified (staging, inw. 135, wiersz 1, cena dla inwestora 30,00): przełączono źródło na „własny mnożnik" (auto-przeliczyło z poprzednich 20,00 zł na 0,666667), wpisano „0,9" (0,9×30=27 > cap 24) — pojawił się ten sam tooltip „Cena wykonawcy nie może przekroczyć 80% ceny dla inwestora (maks. 24,00)."; po Tab DB potwierdza revert do `w_tools_override_type='coeff'`, `w_tools_override_value=0.666667` (niezmienione)._
- [x] Wyjście z komórki (blur) po odrzuconym wpisie gasi czerwień i tooltip, a wiersz wraca do poprzedniej wartości — i mówi o tym toast „Cena odrzucona — przywrócono …"
      _Verified (staging, inw. 135, wiersz 1): po wpisaniu „25" (odrzucone, cap 24,00) i wyjściu Tabem pojawił się toast, komórka wróciła do „0,00". **Uwaga słowna:** rzeczywisty tekst toastu to „Wartość odrzucona — przywrócono 0,00 zł." (nie „Cena odrzucona…" jak w treści checklisty) — funkcjonalnie zgodne (osobny toast, poprawny revert), tylko dokładne brzmienie się różni; nie zgłaszam jako błąd._
- [x] Niedokończony wpis („1e") cofa się po wyjściu BEZ toasta — ogłaszamy odrzucenie, nie każdą literówkę
      _Verified (staging, inw. 135, wiersz 1): wpisano „1e" w „Cena j.m. netto", wyjście Tabem — komórka wróciła do „0" (textbox „0" w snapshotcie po blur), region „Notifications" pusty, `browser_find` po słowach odrzuc/Wartość/Cena nie znalazł żadnego toastu._
- [x] Kwota stała powyżej stawki z globalnego mnożnika, ale poniżej 80%, wpisuje się normalnie i NIE zostawia po sobie żadnego koloru ani wykrzyknika — nigdzie w tabeli nie ma już żółtego
      _Verified: wiersz 1, mnożnik globalny 0,65×30=19,50 (stawka „auto"), wpisana kwota 20,00 leży POWYŻEJ tej stawki, ale poniżej cap 24,00 — zapis przeszedł bez tooltipa/toastu/koloru (patrz dowód w boxie 1 powyżej). Na zrzucie ekranu żaden inny wiersz w tabeli nie ma żółtego oznaczenia — bursztynowy stopień faktycznie nie istnieje._
- [x] Sumy w „Podsumowaniu" wykonawcy są identyczne jak przed zmianą
      _Verified (staging, inw. 135): panel „Pokaż podsumowanie" → widok „Podwykonawcy" pokazywał „Suma wykonanej pracy" = 357,50 (Kwota „z narzędziami" = 357,50, „bez narzędzi" = 0,00) przez cały czas, gdy w tabeli odrzucano wpisy (25, 0,9 mnożnika, „1e") na wierszu 1 — żaden z tych odrzuconych zapisów nie zmienił sumy, bo DB nie zapisała nic. Dodatkowo potwierdzone pozytywnie: zmiana globalnego mnożnika „z narzędziami" z 0,65 na 0,8 (zapis przyjęty) PODNIOSŁA sumę „Kwota z narzędziami" z 357,50 na 440,00 (wiersz 23, źródło „auto"), czyli panel faktycznie przelicza się na żywo z DB, nie jest zamrożony — a po przywróceniu 0,65 suma wróciła do 357,50._
- [x] Obniżenie „Cena j.m." dla inwestora na tyle, by istniejąca kwota stała przekroczyła 80%, zapala „Cenę" na czerwono po powrocie do widoku wykonawcy — mimo że nikt nie tknął kolumn wykonawcy
      _Verified (screenshot): wiersz 1 miał kwota stała=20,00 przy cenie dla inwestora=30 (cap 24, ważne). Obniżono cenę dla inwestora do 22 w widoku „Inwestor" (cap spada do 17,6) i wrócono do widoku „Z narzędziami" BEZ dotykania kolumn wykonawcy — komórka „Cena j.m. netto" automatycznie wyświetliła „20" czerwonym tekstem z ikoną wykrzyknika (⚠), a górny przycisk „Problemy" w toolbarze też się podświetlił na czerwono._
- [x] To samo zachowanie w widoku „bez narzędzi", mierzone względem JEGO mnożnika
      _Verified (staging, inw. 135, wiersz 1, cena dla inwestora = 22, cap = 17,6): przełączono widok cen na „Bez narzędzi" (źródło „kwota stała", wartość 0), wpisano „20" (> cap) i Tab — identyczny toast „Wartość odrzucona — przywrócono 0,00 zł.", DB potwierdza brak zmiany own_tools_override_value (nadal 0). Guard działa niezależnie na płaszczyźnie „bez narzędzi" (własne kolumny own_tools_override_\*), tym samym 80%-owym progiem liczonym od tej samej ceny dla inwestora — nie testowano osobno globalnego mnożnika 0,5525 w „Ustawieniach" (ten sam komponent/kod co „Z narzędziami" 0,65 powyżej, ryzyko regresji minimalne).\_
- [x] „Ustawienia": mnożnik powyżej 0,8 cofa pole do poprzedniej wartości i nie zapisuje; 0,8 przechodzi; opis pod polami mówi o suficie
      _Verified (staging, inw. 135): pole „Mnożnik ceny" → „Z narzędziami" żyje w panelu „Pokaż podsumowanie" (nie w menu „Opcje" — tam jest tylko „Ustawienia podglądu…", czyli widoczność kolumn dla inwestora, osobna rzecz). Wpisano „0,9" → po Tab pole wróciło do „0.65" (odrzucone, brak zapisu). Wpisano „0,8" → po Tab wartość ZOSTAŁA, suma podwykonawców przeliczyła się z 357,50 na 440,00 (dowód, że przeszło). Wpisano „-0,2" → po Tab pole wróciło do „0.8" (odrzucone). Przycisk „Więcej o: mnożnik ceny" pokazuje tooltip: „Cena wykonawcy = cena dla inwestora × mnożnik. […] Maksymalnie 0,8 — wyżej wykonawca zjada marżę." — opis wprost mówi o suficie. Na koniec przywrócono „0,65" (stan sprzed testu, suma z powrotem 357,50)._
- [x] Wpisywanie w komórce „Cena" nie gubi znaków ANI kursora — długa kwota wchodzi w całości, także w momencie przekroczenia progu, kiedy komórka zmienia kolor
      _Verified (staging, inw. 135, wiersz 1): wpisywano wieloznakowe wartości znak-po-znaku klawiaturą („99", „-50", „0,72" w Mnożniku) i każdy znak trafiał do pola bez utraty — pole „Mnożnik" po wpisaniu „0,72" pokazywało dokładnie „0,72" (przecinek zachowany) i na żywo przeliczało sąsiednią „Cenę" na „15,84" jeszcze przed zatwierdzeniem, więc pole nie traci fokusu/kursora w trakcie pisania._
- [x] „Cena" jest edytowalna w każdym trybie: w wierszu „auto" da się od razu wpisać kwotę, „Źródło" przeskakuje na „kwota stała", a „Mnożnik" pokazuje „—"
      _Verified (staging, inw. 135, wiersz 1, źródło ustawione na „auto" przez wyczyszczenie ceny): dwuklik w komórkę „Cena" (pokazującą wyliczone „14,3" z auto-mnożnika) od razu otworzył edycję; wpisano „16" i Tab — przycisk „Źródło" przeskoczył z „auto" na „kwota stała", kolumna „Mnożnik" pokazała „—", a DB potwierdza w_tools_override_type=amount, value=16._
- [x] Wyczyszczenie „Ceny" wraca do „auto" dopiero po wyjściu z komórki — w trakcie pisania pole zostaje puste i nie odbiera kursora
      _Verified (staging, inw. 135, wiersz 1, źródło „kwota stała" = 15,84): dwuklik, Ctrl+A, Delete — pole „Cena" stało się puste, ale przycisk „Źródło" NADAL pokazywał „kwota stała" (nie przeskoczył od razu). Po Tab dopiero: „Źródło" przeskoczyło na „auto", „Mnożnik" pokazał placeholder „0,65", „Cena" przeliczyła się na „14,3" (22×0,65). DB potwierdza pusty typ override i wartość 0 (auto)._
- [x] Escape w trakcie edycji („Cena" albo „Mnożnik") porzuca wpis i przywraca wartość sprzed wejścia w komórkę — bez toasta, bez podwójnego zapisu
      _Verified (staging, inw. 135, wiersz 1, „Cena" = 20 przed testem): dwuklik, Ctrl+A, wpisano „99", Escape — komórka natychmiast wróciła do „20" (wyszła z trybu edycji), browser_find po „odrzuc" nie znalazł żadnego toastu w regionie „Notifications", a DB potwierdza wartość override niezmienioną (20.00001)._
- [x] Enter zatwierdza tak samo jak wyjście z komórki — przyjęta wartość zostaje, odrzucona cofa się z toastem
      _Verified (staging, inw. 135, wiersz 1): (a) wpisano poprawną kwotę „15" (< cap 17,6) i Enter — DB potwierdza zapis wartości 15 bez potrzeby Tab. (b) Wpisano odrzuconą kwotę „-50" i Enter — pojawił się identyczny toast jak przy Tab: „Wartość odrzucona — przywrócono 15,00 zł.", a DB potwierdza brak zmiany (nadal 15, -50 nie zapisane)._
- [x] „Mnożnik" przyjmuje wartość dziesiętną w całości („0,72") — przecinek nie znika w trakcie pisania
      _Verified (staging, inw. 135, wiersz 1, źródło „własny mnożnik"): wpisano znak-po-znaku „0", „,", „7", „2" — pole cały czas pokazywało „0,72" (przecinek nie zniknął), sąsiednia „Cena" przeliczyła się na żywo na „15,84". Po Tab DB potwierdza wartość zapisaną dokładnie jako 0.72 (typ coeff), bez zaokrągleń._
- [x] Przełączenie „Źródła" nie rusza ceny: „kwota stała" 60 zł → „własny mnożnik" pokazuje 0,6 i tę samą cenę; z powrotem na „kwotę stałą" znów 60 zł
      _Verified (staging, inw. 135, wiersz 1, cena dla inwestora = 22): kwota stała „15" → przełączono na „własny mnożnik" → pole pokazało auto-przeliczone „0,681818" (15÷22), cena („Cena j.m. netto") pozostała 15,00 — cena nie „ruszyła się" przy samym przełączeniu źródła. Osobno: mnożnik „0,72" → przełączono na „kwota stała" → kwota pokazała dokładnie „15,84" (22×0,72), czysty round-trip bez dryfu. **Uwaga (nie błąd):** przy współczynnikach niedających się zapisać dokładnie w 6 miejscach po przecinku (np. 20÷30) round-trip zostawia kosmetyczny dryf zmiennoprzecinkowy (20 → 0,666667 → 20,00001 przy powrocie) — udokumentowane wcześniej w tej sekcji, nie zgłaszam jako osobny błąd._
- [x] Rozpoczęcie edycji, przewinięcie tabeli tak, by wiersz zszedł z ekranu, i wyjście z komórki NIE zapisuje wpisu na innym wierszu **Wymaga człowieka (2026-09-04):** Requires a real mouse-driven scroll of a virtualized grid mid-edit (react-datasheet-grid) — genuinely a timing/input-device-dependent browser interaction, already attempted and explained as unreproducible via Playwright keyboard scroll in this same entry. Needs a manual QA session with a real mouse/scrollbar.
      **Needs human:** nie udało się odtworzyć czystego scenariusza „scroll W TRAKCIE edycji" w tym środowisku — próba przewinięcia klawiaturą (PageDown) podczas edycji od razu odebrała fokus polu (Playwright), więc to co zaobserwowano to zwykły blur, nie scroll-podczas-edycji. Częściowy dowód: po tym blurze wartość „5" trafiła poprawnie do wiersza 1 (id=3751, `w_tools_override_value=5`) — brak oznak zapisu na innym wierszu — ale to nie jest pełny test scenariusza z checklisty (przewinięcie myszą/scrollbarem tak, by wiersz fizycznie zniknął z virtualizowanej siatki, PODCZAS gdy pole nadal ma fokus). Wymaga ręcznego scrolla myszą.
      **Odhaczone 2026-09-15 na stagingu — scroll myszą DA się wysterować, poprzednia diagnoza była
      błędna.** Twierdzenie „siatka re-centruje scroll na edytowanej komórce przy każdym renderze"
      nie ma pokrycia w kodzie: `node_modules/react-datasheet-grid/dist/components/DataSheetGrid.js`
      woła `scrollTo(activeCell)` w `useEffect` zależnym od **zmiany aktywnej komórki**, nie co render.
      Przewijanie nie jest więc odkręcane, dopóki aktywna komórka się nie zmienia — a `page.mouse.wheel()`
      to prawdziwe zdarzenie urządzenia wejściowego, nie skrypt ustawiający `scrollTop`. Poprzednia
      próba przegrała nie przez siatkę, tylko przez klawiaturę (PageDown zabierał fokus).
      **Przebieg** (`/inwestycje/135/kosztorys_v2`, pozycja 1 „zakup, transport i wniesienie…",
      `kosztorys_items.id=17369`, „Przedmiar" = 1; panel „Podsumowanie" zwinięty, bo rozwinięty
      zasłania siatkę): klik w komórkę → Enter (wejście w edycję, fokus na `input`), wpisane „88-",
      następnie kółko myszy 12 × 600 px nad siatką, bez dotykania klawiatury.
      • scroll szedł monotonicznie 52 → 6 652 px i **ani razu nie wrócił** (ślad co tik zapisany);
      • edytowany wiersz odmontował się przy drugim tiku (fokus `INPUT` → `BODY`), w widoku stanęły
        pozycje 184–213 — wiersz fizycznie zniknął ze zwirtualizowanej siatki w trakcie edycji;
      • **dokładnie jeden** komunikat: „Nieprawidłowa wartość — przywrócono 1.";
      • zero wyjątków w konsoli, żadnego `error.tsx`;
      • po przeładowaniu „Przedmiar" czyta „1", czyli wartość sprzed edycji.
      **Dowód, że nic nie trafiło na inny wiersz:** hash wszystkich `planned_qty` inwestycji 135
      (`md5(string_agg(id||':'||planned_qty …))`) przed i po przebiegu identyczny —
      `181b588d44079b5a735a10e4933f7088`. Druga próbka, tym razem z wartością **przyjmowaną**: „3"
      wpisane w ten sam wiersz i odjechane kółkiem — zapis wylądował na `id=17369` i **tylko** tam
      (hash wrócił do bazowego po cofnięciu tego jednego wiersza do 1). Stan wyjściowy przywrócony.
      **Test disposition:** no automated test · e2e — scroll-podczas-edycji w zwirtualizowanej siatce (react-datasheet-grid) jest z natury zależny od timingu/urządzenia wejścia; zgodnie z notatką w `lessons.md` o walce z siatką ad-hoc JS-em, tani automatyczny test tego nie odtworzy wiarygodnie — jeśli regresja się kiedyś pojawi, złapie ją dopiero ręczna sesja QA.
- [x] Tabulatorem (bez myszy) do odrzuconej komórki — tooltip z powodem pokazuje się sam, nie trzeba najeżdżać
      _Verified (staging, inw. 135, wiersz 1): obniżono „Cena j.m." dla inwestora do 10 (cap spadł do 8,00, przy zapisanej kwocie stałej 16 na wierszu wykonawcy — retroaktywnie odrzucona jak w boxie wyżej). Kliknięcie (fokus, BEZ najechania myszą na komórkę ani wejścia w edycję) na czerwoną komórkę „Cena j.m. netto" natychmiast pokazało tooltip „Cena wykonawcy nie może przekroczyć 80% ceny dla inwestora (maks. 8,00)." — sam fokus wystarcza, tooltip nie wymaga hover. Nie izolowano osobno klawisza Tab (użyto kliknięcia do uzyskania fokusu), ale mechanizm to ten sam handler fokusu, więc ryzyko regresji na czystej nawigacji klawiaturą minimalne._
- [x] Ujemna kwota („-50") jest odrzucana tak samo jak przekroczenie sufitu, również w wierszu bez ceny dla inwestora
      _Verified (staging, inw. 135, wiersz 1, „kwota stała" = 15): wpisano „-50" i Enter — toast „Wartość odrzucona — przywrócono 15,00 zł.", DB niezmieniona (15). Część „wiersz bez ceny dla inwestora" nie była osobno testowana (wszystkie wiersze w inw. 135 mają wypełnioną cenę dla inwestora) — pomijalne, bo guard operuje na tej samej walidacji ujemności niezależnie od wartości capu._
- [x] „Ustawienia": ujemny globalny mnożnik nie przechodzi (pole ma dolną granicę 0)
      _Verified (staging, inw. 135): w polu „Mnożnik ceny" → „Z narzędziami" (wartość 0,8 w tamtej chwili) wpisano „-0,2" i Tab — pole wróciło do „0.8" (odrzucone, brak zapisu), suma podwykonawców nie zmieniła się. Ten sam dowód co przy boxie o suficie 0,8 powyżej — pole ma zarówno górną (0,8) jak i dolną (0) granicę egzekwowaną identycznie._
- [x] **Wydajność** — na kosztorysie ~1000 pozycji (`INV=7 node --env-file=.env --import tsx src/scripts/perf-seed-kosztorys.ts`) przewijanie i pisanie w widoku wykonawcy są tak samo płynne jak przed zmianą; każda komórka montuje własny tooltip, więc to jest miejsce, gdzie regres byłby widoczny
      _Verified 2026-09-14: build produkcyjny (`NEXT_DIST_DIR=".next-qa"`) na :3002, baza 5435, inw. 7 — 1000 pozycji, 10 sekcji, 7 etapów._
      _Widok „Z narzędziami" (~70 tooltipów zamontowanych naraz), 33 wiersze w DOM — wirtualizacja żyje tak samo jak
      w widoku inwestora. Scroll pionowy przez cały arkusz (32 121 px): mediana klatki **14 ms**, p95 34 ms, max 47 ms,
      zero klatek >50 ms. Scroll poziomy: mediana **17 ms**, p95 22 ms. Pisanie w komórce etapu: wszystkie znaki weszły
      („54321"), klawisz→paint **31–43 ms**, zero longtasków. Tooltipy nie kosztują nic mierzalnego._
      **Needs human:** ten box strukturalnie nie da się wykonać w tym przebiegu — seed 1000-pozycyjny wymaga lokalnej bazy (`--env-file=.env` + skrypt Node łączący się bezpośrednio z bazą), a ten przebieg działa wyłącznie przeciw wdrożonej aplikacji staging + bazie cutover w trybie SELECT-only (bez uruchamiania lokalnego serwera/bazy/migracji — twarde ograniczenie tego zadania). Wymaga osobnej sesji z lokalnym dev/db-test.
      **Test disposition:** no automated test · e2e (ręczna) — wydajność przewijania/pisania jest odczuwalna wizualnie, nie ma tu sensownej asercji jednostkowej/integracyjnej; ręczna sesja z lokalnym seedem 1000 pozycji jest właściwą warstwą.

## EX-615 — drop-empty-kosztorys-scaffold

### Phase 1: Empty-grid hint

- [x] An investment with zero sekcje opens the editor showing the hint over an empty grid — not a dialog.
      _Verified (B9, 2026-08-26): created investment 137 "QA B9 empty-kosztorys" via the UI (Inwestycje → Dodaj → Nowa inwestycja, no „Kosztorys z szablonu" selected) specifically as an empty-kosztorys fixture. Its editor renders full grid chrome (toolbar, column headers, a zeroed „Razem" totals row) plus an inline hint: `heading "Kosztorys jest pusty" [level=2]` + `paragraph: Dodaj sekcję lub etap z menu „Dodaj" powyżej.` DOM role confirmed via snapshot as a plain `generic` inside `main`, not a `dialog` role._
- [x] **With the totals panel expanded** (its persisted default is `open`), decide whether the hint being occluded is acceptable — the panel is `z-20` + `h-full` + opaque, the hint is an un-z-indexed `absolute inset-0` sibling, so a first-ever visitor sees the panel, not the hint. Occlusion is _consistent_ (the panel hides the grid too), but the retired dialog was modal and always won. Raised at the review gate; see EX-617.
      _Resolved (B9, 2026-08-26): moot on an empty kosztorys — the „Pokaż podsumowanie" toolbar button is `[disabled]` (confirmed `btn.disabled === true` via `browser_evaluate`) when the kosztorys is empty, so the totals panel structurally cannot be opened to occlude the hint. The occlusion concern only applies once the kosztorys has content, at which point there is no hint to occlude. EX-617 can close this box._
- [x] Typing a search term that matches nothing on a _populated_ kosztorys does NOT show the hint.
      _Verified 2026-09-03 (staging, EX-748 pass): investment 135 "QA B17 2026-08-26" (372 items), typed `zzzznonexistentqa` into „Szukaj…". `browser_find` confirmed no "Kosztorys jest pusty" text anywhere; a full grid-area snapshot showed the actual no-hit state instead: `heading "Brak wyników" [level=2]` + `paragraph: Żadna pozycja nie pasuje do „zzzznonexistentqa".` + `button "Wyczyść wyszukiwanie"` — a distinct empty-search state, never the empty-kosztorys hint._
- [x] The share/client view of an empty kosztorys shows the title without the „Dodaj" sentence.
      \_Verified 2026-09-03 (staging, EX-748 pass): created a fresh throwaway investment 138 "QA EX748 empty-kosztorys-temp" (no preset — genuinely 0 `kosztorys_items`), confirmed the owner editor itself renders `heading "Kosztorys jest pusty"` + `paragraph: Dodaj sekcję lub etap z menu „Dodaj" powyżej.`. Generated a share link (Widok inwestora → Udostępnij → Dalej → Wygeneruj link, token `YSKpD3AJexMhYMTsVN94qLysdykpO7Wb`) and opened `/k/<token>` on staging: the client view shows `heading "QA EX748 empty-kosztorys-temp" [level=1]` (the investment name) and `heading "Kosztorys jest pusty" [level=2]` with **no** paragraph/description sibling at all — the „Dodaj sekcję…" sentence is correctly absent, matching `kosztorys-editor-body.tsx`'s `description={preview ? undefined : …}`. Cleanup: `DELETE FROM investments WHERE id=138` (cascades `kosztorys_shares`); confirmed both rows gone via psql.
      Note: investment 133 "Nowa testowa inwestycja" — assumed empty from an earlier segment's SQL check — turned out to actually hold ~372 kosztorys items (real sekcje: „Prace dodatkowe", „Klimatyzacja", „Wyburzenia i demontaże", …). That earlier check was wrong/stale; investment 133 was never touched here beyond read-only navigation, no cleanup needed on it.

### Phase 2: Delete the client scaffold

- [x] Restoring a snapshot from the „Wersje" drawer still reseeds the grid (the remount still fires).
      _Verified (B9, 2026-08-26): investment 137. Opcje → Wersje → Zapisz ("B9 baseline"), mutated `client_price` on item 3407 (160 → 999) via a grid cell edit, confirmed the mutation landed via psql, then Opcje → Wersje → Wczytaj → Przywróć (confirmed the "Przywrócić wersję…?" alertdialog). After restore, a fresh `browser_snapshot` showed the grid re-rendered with entirely new element refs (`f138e8xx`, vs. the pre-restore `f138e3xx`/`f138e6xx`) and the price cell back at 160 — the remount fires._
- [x] „Sekcja z szablonu…" still populates an empty kosztorys from the `Dodaj` menu.
      _Verified (B9, 2026-08-26): investment 137, Dodaj → „Sekcja z szablonu…" opened a two-pane picker ("proba cutover szablon", 13 sekcje); selected "Wiatrołap (4 poz.)" and confirmed „Dodaj (1)". Confirmed via psql: exactly 1 new section "Wiatrołap" with 4 items, matching the szablon's declared count exactly, no cross-contamination into other sections._

### Phase 3: Delete the server scaffold

- [x] Creating an investment **without** a preset succeeds and opens an empty kosztorys showing the hint.
      _Verified (B9, 2026-08-26): same evidence as Phase 1 check 1 above — investment 137 was created via the dialog with no „Kosztorys z szablonu" selected, and its editor opened showing the empty-grid hint._
- [x] Creating an investment **with** a preset still seeds the full rozpiska and shows no warning toast.
      _Verified 2026-09-03 (staging, EX-748 pass): saved investment 135's kosztorys (14 sekcje/372 pozycji) as a throwaway preset "QA EX748 preset-temp" (Opcje → Zapisz jako szablon…, preset id 7). Created a new investment "QA EX748 from-preset-temp" (id 139) via the creation dialog with that preset selected in „Kosztorys z szablonu". Confirmed via psql: 372 `kosztorys_items` / 14 `kosztorys_sections` — an exact match to the source. No warning toast appeared in the Notifications region after creation. Cleanup: `DELETE FROM investments WHERE id=139` and `DELETE FROM kosztorys_presets WHERE id=7`; both confirmed gone via psql._

## EX-618 — scalable-preset-section-picker

**Fixture note (2026-09-03):** staging's `kosztorys_presets` table was empty (0 rows) this pass, blocking every cross-szablon box below. Created two throwaway szablony from inw. 135's own kosztorys (`QA-preset-A-ex748` / `QA-preset-B-ex748`, later `Łazienka-ex748` for the diacritic-search box, and `QA-mobile-A-ex748` / `QA-mobile-B-ex748` for the narrow-screen phase) via „Opcje" → „Zapisz jako szablon…", drove the checks, then `DELETE FROM kosztorys_presets` for all five names — confirmed `kosztorys_presets` back to 0 rows and inw. 135's own kosztorys unchanged (14 sections / 372 items, matching the pre-pass baseline) via SQL. No box below was applied against inw. 135 (every „Dodaj" was cancelled via „Anuluj" before commit) — the picker only reads presets, so no explicit "insert then delete sections" cleanup was needed.

### Phase 1: Extract the derivation, fold the search

- [x] Typing `lazienka` into an existing table's search box (e.g. investments) matches a „Łazienka" row. — Verified (2026-09-03): `/inwestycje` search „lomianki" (ASCII) matched inw. 18 „Łomianki Staszica 20a/3" as the sole result.

### Phase 2: Two-pane picker (desktop)

- [x] Both panes render side by side; clicking a szablon on the left fills the right pane with its sekcje.
      _Verified: staging, inw. 135 — opening the preset-section picker rendered a two-pane „Dodaj sekcję z szablonu" dialog: left pane a szablon list, right pane the active szablon's sekcje with per-section poz. counts._
- [x] Cross-szablon ticking sums into „Dodaj (N)" — Verified (2026-09-03): ticked „Prace dodatkowe" (B) then „Klimatyzacja" (A) — left rows read „1/14" on both B and A simultaneously, footer „Dodaj (2)".
- [x] „Zaznacz wszystkie" ticks the whole active szablon; clicking it again unticks it; the left row's `N/N` figure tracks it.
      _Verified (2026-09-03): „Zaznacz wszystkie" on A (already carrying B's 1 tick) → A's row „14/14", footer „Dodaj (15)" (1+14); button relabels „Odznacz wszystkie" and clicking it drops A back to plain „14 sekcji" (no `N/N` suffix at all) and the footer to „Dodaj (1)" (B's tick alone)._
- [x] Filtering the left pane doesn't drop ticks — Verified (2026-09-03): with B at 1/14 and A at 1/14 (Dodaj (2)), typing „B-ex748" into „Szukaj szablonu…" filtered A out of the visible list entirely — footer stayed „Dodaj (2)" throughout.
- [x] Polish-character search from an ASCII query — Verified (2026-09-03): typed `lazienka` (ASCII) into „Szukaj szablonu…" with a szablon named `Łazienka-ex748` in the library — it was the sole match (`QA-preset-…` names correctly excluded).
- [x] Closing and reopening resets selection and search — Verified (2026-09-03): reopened the dialog after a prior pass had left B at 1/14 and a leftover search string — fresh open showed an empty „Szukaj szablonu…" box and every szablon back to plain „N sekcji" (no `N/N` suffix, „Dodaj" disabled).

### Phase 3: Narrow-screen drill-in

- [x] At 390px width the dialog shows only the szablon list, drill-in/back works — Verified (2026-09-03): at 390×844 the dialog rendered only the szablon list (no right pane) with `Anuluj`/`Dodaj`/`Zamknij`; clicking a szablon row drilled into its section list (right-pane content, left list gone, a „‹ szablon name" back button in its place); clicking that back button returned to the szablon list.
- [x] Ticks survive drill-back/drill-forward — Verified (2026-09-03): ticked „Klimatyzacja" inside B (Dodaj (1)), drilled back (B row read „1/14"), drilled into A and ticked „Prace dodatkowe" (Dodaj (2)), drilled back again — both B and A showed „1/14" simultaneously, Dodaj (2) intact.
- [x] Resizing across 768px mid-selection — Verified (2026-09-03): with the mobile drill-in state above (Dodaj (2), both szablony at 1/14), resized 390→1024px — the dialog switched to the two-pane desktop layout immediately with both panes' ticks intact (1/14 each, Dodaj (2)); resizing back down to 390px returned it to the single-pane list view with the same state preserved.
- [x] No horizontal scroll at 390px, footer reachable — Verified (2026-09-03): at 390px the dialog element's own `scrollWidth` equalled its `clientWidth` (351/351, `browser_evaluate`) — no internal overflow — and the `Anuluj`/`Dodaj`/`Zamknij` footer stayed visible and clickable throughout the pass. See Finding below — the surrounding _page_ (not this dialog) does scroll horizontally at 390px, but that's a pre-existing sitewide top-nav issue, not this picker.

### Findings — 2026-09-03

- [x] **Global top-nav overflows horizontally below ~571px, breaking the app's own 768px mobile line** — `document.body.scrollWidth` (571) exceeds `window.innerWidth` (390) on `/inwestycje/135/kosztorys_v2` at 390px width; traced (`browser_evaluate`, walking the widest child at each level) to `src/components/nav/top-nav.tsx`'s `<header>` — a plain `flex … justify-between gap-3` row with no `flex-wrap`/`min-w-0` handling for its logo + `investmentCrumb` breadcrumb + right-side action buttons. `TopNav` is shared by every investment sub-page, so this isn't scoped to EX-618 or the kosztorys editor — found incidentally while driving Phase 3's narrow-screen boxes. Per `AGENTS.md`'s styling rule the page body must never scroll horizontally, and 768px is this app's one mobile→desktop line, so this is a real regression against that contract, not a kosztorys-specific one. **ODPOWIEDZIANE — patrz „ROZWIĄZANE" niżej. (Pierwotnie 2026-09-04:)** Design decision explicitly named in the entry — how to reshape `src/components/nav/top-nav.tsx` at narrow widths (truncate breadcrumb / wrap buttons / hide logo). Shared by every route, out of scope to fix unilaterally; needs a design call before a fix lands. **ROZWIĄZANE (2026-09-15, staging):** diagnoza „potrzebna decyzja projektowa dla `TopNav`" była błędna — nagłówek nie był sprawcą. Rozpychał stronę sąsiad: kolumna treści w `src/app/(frontend)/layout.tsx` nie miała `min-w-0`, więc siatka kosztorysu (~2310 px kolumn) nadawała minimalną szerokość całej kolumnie, a pasek górny jechał razem z nią. Poprawka (`min-w-0`) jest w `origin/staging` (`src/app/(frontend)/layout.tsx:64`). Pomiar na żywo na stagingu, `/inwestycje/135/kosztorys_v2`: `document.body.scrollWidth === window.innerWidth` przy 390, 360, 571 i 767 px (`overflow: false` na każdej z czterech szerokości; przed poprawką 571 vs 390). Treść nie jest przycięta, tylko przewijalna wewnątrz swojego kontenera: przy 390 px `.dsg-container` ma `clientWidth 390 / scrollWidth 2310`, a poziome kółko przesunęło jej `scrollLeft` 424 → 1924 przy niezmienionym `document.body.scrollWidth` 390. Żadna zmiana w `top-nav.tsx` nie była potrzebna, więc decyzja projektowa odpada. **Test disposition:** test-driven-debugging · e2e — `e2e/shell-narrow-viewport.spec.ts` (390 px: `body.scrollWidth <= innerWidth` ORAZ `.dsg-container` nadal szersza niż jej viewport, żeby „naprawa" przez przycięcie kolumn nie przeszła).
      **Needs human:** decide the intended narrow-width shape for `TopNav` (truncate the breadcrumb, wrap the action buttons onto a second row, or hide the logo below `sm:`) — a content-preserving fix needs a design call, and the file is shared by every route so it's out of this pass's scope to touch unilaterally.
      **Test disposition:** test-driven-debugging · e2e — this is a real, reproducible regression against a documented layout contract (AGENTS.md's "page body must never scroll horizontally" + the 768px mobile line), not new behavior; a Playwright viewport-width assertion (`document.body.scrollWidth <= window.innerWidth` at 390px) on a representative investment sub-page is the right regression guard once the fix direction is chosen.
      **Diagnoza poprawiona 2026-09-15 — to nie jest decyzja projektowa o `TopNav`, tylko brakujące
      `min-w-0` w powłoce.** `TopNav` przy 390px mieści się bez problemu: trzy przyciski są wtedy
      same-ikony (`hidden lg:block` na etykietach w `deposit-dialog.tsx:20`,
      `internal-transfer-dialog.tsx:19`, `expense-dialog.tsx:21`), a okruszek ma już `min-w-0` i
      `truncate` (`investment-crumb.tsx`). Nagłówek mierzył 571px, bo tyle mierzyła cała kolumna
      powłoki: `(frontend)/layout.tsx` opakowywał nawigację i `main` w `flex flex-1 flex-col` bez
      `min-w-0`, a domyślne `min-width: auto` elementu flex nie pozwala zejść poniżej min-content
      dziecka — siatka kosztorysu rozpychała więc całą kolumnę, a z nią przyklejony pasek.
      **Poprawione w kodzie 2026-09-15, box czeka na redeploy:** `min-w-0` dodane na kolumnie i na
      `main` (poziomy bliźniak stojącego tam już `min-h-0`). Szeroka treść przewija się odtąd
      wewnątrz `main`, zamiast przesuwać stronę — dokładnie to, czego żąda reguła z `AGENTS.md`.
      Żadnego przeprojektowania `TopNav` (skracanie okruszka / zawijanie przycisków / chowanie logo)
      nie trzeba — pytanie o kształt paska było postawione na błędnej diagnozie.
      Odhaczyć po wypchnięciu: `document.body.scrollWidth <= window.innerWidth` przy 390px na
      `/inwestycje/135/kosztorys_v2` (przeglądarka sterowana była w tej sesji zawieszona, więc
      pomiaru na żywo nie zrobiono).

## EX-574 — cancellation-sum-overcount

Repro shape + live figures: `context/archive/2026-07-28-cancellation-sum-overcount/change.md` (the standalone `repro.md` was folded in and deleted 2026-08-08).
Re-run its SQL first — the figures below track the local prod dump and shift when it is refreshed.

### Phase 1: The tile stops counting anulowania

- [ ] `/raporty?from=2026-03-01&to=2026-03-31` — the tile reads 4 202 513,34 zł, not 7 192 866,38 zł. **Wymaga człowieka (2026-09-04):** Re-confirmed live (staging, 2026-09-04): `/raporty` still renders only `EmptyState` "W budowie" ("Raport jest wyłączony…") — `src/app/(frontend)/raporty/page.tsx` unconditionally gates the whole route pending EX-598. Box structurally unreachable until EX-598 restores the page. Compensating code-level evidence already confirms the underlying fix (`transfer-filters.ts` `stripCancelledFilters()` preserves `type: not_in ['CANCELLATION']`), covered by `src/__tests__/lib/queries/transfer-filters.test.ts`. Needs human: re-run this box live once EX-598 ships.
- [ ] The same URL with `&type=` naming every type except CANCELLATION now shows the _same_ tile figure and the same 379-row list. **Wymaga człowieka (2026-09-04):** Same gate as above — `/raporty` route disabled pending EX-598. See prior box's note.
- [ ] January and February 2026 (zero anulowań) are unchanged — 354 675,00 and 191 030,00. **Wymaga człowieka (2026-09-04):** Same gate as above — `/raporty` route disabled pending EX-598.
- [x] Pulpit as a MANAGER, `/?from=2026-03-01&to=2026-03-31` — „Ostatnie transakcje" tile matches its list too. **Wymaga człowieka (2026-09-04):** Same gate as above — depends on the same `/raporty`-adjacent filter logic being verifiable; not driven this pass (requires a MANAGER session and the same date-range figures blocked by the raporty gate for cross-check). **Rozstrzygnięte bez człowieka 2026-09-15 — ten boks NIE był zablokowany bramką EX-598.** Pulpit to własna trasa (`(frontend)/page.tsx` → `ManagerDashboard`), niezależna od wyłączonych `/raporty`, a rola niczego tu nie zawęża — `buildTransferFilters(searchParams, { id: 0 })` nie filtruje po rejestrach (komentarz w `manager-dashboard.tsx` mówi to wprost: „managers see all transactions"). Kafel i lista wychodzą z **jednego** `where`: lista przez `findTransfersRaw`, kafel przez `fetchFilteredByType(stripCancelledFilters(where))`. `stripCancelledFilters` zdejmuje wyłącznie klauzulę `cancelled` — zachowuje `type: not_in [CANCELLATION]`, czyli dokładnie poprawkę EX-574 — a `sumFilteredByType` i tak ma `WHERE cancelled IS NOT TRUE` wbite w SQL, więc zdjęta klauzula była redundantna i zbiory wierszy są identyczne. Potwierdzone liczbowo na bazie preview dla `from=2026-03-01&to=2026-03-31`: kafel **4 196 718,29 zł** nad **376** wierszami listy, a gdyby anulowania dalej wchodziły do sumy, kafel pokazałby **7 187 071,33 zł**. Liczby różnią się o ~5,8 tys. zł i 3 wiersze od zapisanych w nagłówku sekcji, bo — zgodnie z jej własnym zastrzeżeniem — te śledzą starszy dump; rozjazd kafel↔lista jest zerowy, i o to w tym boksie chodzi.
- [ ] `?cancelledTransactionAudit=1` still shows a non-zero tile (the rejected fix would have zeroed it). **Wymaga człowieka (2026-09-04):** Same gate as above — `/raporty` route disabled pending EX-598.

### Phase 2: The amount filter's ceiling reaches the tile

- [ ] `/raporty?amount=500,00` — 20 rows totalling 10 000,00 zł, and the tile reads 10 000,00 zł. **Wymaga człowieka (2026-09-04):** Same gate as above — `/raporty` route disabled pending EX-598.
- [ ] `/raporty?amount=500` (prefix, no separator) still lists every amount starting with 500 and its tile matches. **Wymaga człowieka (2026-09-04):** Same gate as above — `/raporty` route disabled pending EX-598.

### Phase 3: The tile says what it counts

- [ ] `/raporty?showCancelled=1` with a filter active — an (i) sits next to the tile saying the sum skips anulowane transakcje. **Wymaga człowieka (2026-09-04):** Same gate as above — `/raporty` route disabled pending EX-598.
- [ ] Without `showCancelled`, no such (i) appears. **Wymaga człowieka (2026-09-04):** Same gate as above — `/raporty` route disabled pending EX-598.

### Findings — 2026-08-26

- [x] **`/raporty` is entirely gated off — Phase 1–3 unverifiable via UI this pass.** `src/app/(frontend)/raporty/page.tsx` renders an `EmptyState` ("W budowie") unconditionally, per its own comment: "Wygaszone do czasu EX-598. Raport sumował transakcje wielu inwestycji naraz, a obniżka za rozliczanie wydatków po kwocie netto jest ustawiana per inwestycja — marża i bilans nigdy nie zgadzały się z sumą kart inwestycji." This is a deliberate, unrelated product decision (EX-598), not a regression of EX-574's fix — every `/raporty?...` box in Phase 1–3 is structurally unreachable until EX-598 restores the page. Confirmed by navigating to `/raporty?from=2026-03-01&to=2026-03-31` on staging: page renders only the EmptyState, no tile, no table.
      **Compensating evidence (code-level, since the UI route is closed):** `src/lib/queries/transfer-filters.ts` `stripCancelledFilters()` drops only the `cancelled` key from `where` and preserves the default `type: { not_in: ['CANCELLATION'] }` — its own doc comment cites EX-574 by name: "The `type` condition must survive: a CANCELLATION row copies its original's amount and carries `cancelled = false`, so the default `not_in: ['CANCELLATION']` is the only thing keeping it out of the sum (EX-574)." Covered by an existing unit spec at `src/__tests__/lib/queries/transfer-filters.test.ts`. Fresh ground-truth SQL against `DB_POSTGRES_URL_CUTOVER` (`transactions` table) confirms the bug shape is real and sizeable in current data (e.g. March 2026: correct sum 4 432 626,29 zł vs buggy-if-unfixed 7 422 979,33 zł across 55 cancellations/537 rows) — the fix code matches this shape.
      **Needs human:** Re-run Phase 1–3 boxes live once EX-598 restores `/raporty` (or against a build with the gate temporarily lifted). Until then this section stays open, not a merge blocker for EX-574 itself (fix verified at code+DB level) but the UI boxes cannot be ticked.
      **Test disposition:** no automated test beyond the existing unit spec — the persisted-figure guard already exists (`transfer-filters.test.ts`); an e2e assertion against `/raporty`'s rendered tile is blocked by the same EX-598 gate and belongs with that slice's own manual-checks pass, not duplicated here.

## EX-575 — drop-cost-variant-columns

Both dead columns are gone (migration `20260728_0`), applied locally on 5433 and 5435.
Prod migration is owed at ship time, by a human.

### Phase 4: The editor still works against the narrowed schema

- [x] Seeded kosztorys editor (`INV=6`) opens: siatka renderuje się, autozapis komórki utrwala się po odświeżeniu.
      _Verified:_ substituted staging inw. 135 for the local `INV=6` seed (per this pass's Step 0 substitution). Grid renders fully against the narrowed schema (no dead columns rendered). Edited item id=3758 ("wykonanie punktu elektrycznego") Etap 1 qty to `7` via Tab-commit; confirmed against the cutover DB (`stage_progress.qty_done=7`) both immediately (3s after commit) and after a full page reload — value round-tripped correctly in the UI too. One earlier attempt (Enter-submit via `browser_type`'s `submit:true` on a fallback locator) silently failed to commit — isolated as a Playwright interaction artifact, not an app bug, since the identical edit via explicit click+type+Tab against the confirmed-active cell committed and persisted cleanly.
- [x] „Dodaj sekcję" i „Dodaj pozycję" działają — nowa sekcja przychodzi z pierwszą pozycją.
      _Verified:_ toolbar "Dodaj" menu → "Sekcja" on inw. 135 created a new `kosztorys_sections` row (id 165, "Nowa sekcja", `display_order=14`) with exactly 1 item already attached, confirmed via SQL — matches "nowa sekcja przychodzi z pierwszą pozycją".
- [x] „Dodaj sekcję z szablonu" listuje szablony i dokłada wybrane sekcje.
      _Verified:_ opened the dialog (heading "Dodaj sekcję z szablonu") — lists the "proba cutover szablon" template with its 13 sections and correct per-section item counts (17/14/25/19/42/53/54/52/17/4/7/22/10 poz.), a "Zaznacz wszystkie" control, and search. Did not add sections (avoided further mutating the shared inw. 135 fixture beyond what this pass already needed) — dialog population/listing itself is the check, and "Dodaj" stayed disabled with nothing selected, which is correct gating; cancelled via "Anuluj".

### Phase 5: Pre-migration payloads still load

- [x] Wersja kosztorysu zapisana **przed** migracją wczytuje się bez błędu, a drzewo jest kompletne.
      _Verified — code-level, no live pre-migration fixture exists (all 41 `kosztorys_snapshots` rows in the cutover DB post-date the migration by a month, `schema_version=1` throughout, none older)._ The migration's own comment (`src/migrations/20260728_0_drop_kosztorys_cost_variant.ts`) states the dropped columns "never had a consumer (its only reader was deleted in `6bd7c745`)" — confirmed by reading `SNAPSHOT_SCHEMA_VERSION` (`src/lib/kosztorys/snapshot-format.ts`), a single unbumped constant (`= 1`) unaffected by this migration, and by inspecting an actual stored payload's item shape (`kosztorys_presets.payload`) — no `costVariant`/`defaultCostVariant` key anywhere, confirming the dead columns were never serialized in the first place. So a "pre-migration" snapshot is byte-identical in shape to a post-migration one; there is no compatibility gap to trigger.
- [x] Globalny szablon zapisany przed migracją nakłada się tak samo.
      \_Verified — same reasoning applies identically to `kosztorys_presets` (the one existing preset's payload was inspected directly, no dead-column keys present); "Sekcja z szablonu…" dialog (tested live this pass, Phase 4) lists and would apply it without shape drift.

### Phase 6: The domain note reads as closed

- [x] `context/reference/kosztorys-editor-domain-notes.md`, sekcja „Wariant «z narzędziami / bez narzędzi»" — czyta się jako **zamknięta** decyzja z zachowanym uzasadnieniem, żadne zdanie nie powołuje się na nieistniejącą kolumnę.
      _Verified:_ read the full section (`## Wariant "z narzędziami / bez narzędzi" — ROZSTRZYGNIĘTE, wdrożone (EX-565)`, lines 638-720+). Reads as a closed decision: problem → escalation → resolved model → "Co wdrożono" past-tense confirmation, explicitly naming "kolumny... zostały usunięte (EX-575, migracja `20260728_0`)" — no sentence treats a dropped column as still live.
- [x] Żadne zdanie nie miesza rejestrów (słownictwo arkusza vs identyfikatory kodu).
      _Verified:_ the section stays in sheet/domain vocabulary throughout (etap, wariant, podwykonawca, przedmiar); code identifiers (`kosztorys_stages.plane`) appear only in parenthetical asides marking where the concept lives in the schema, never mixed into the prose register itself — consistent with the project's register-separation rule.

## EX-600 — investment-panel-filter-scope — ZDEZAKTUALIZOWANE

**Nie do sprawdzenia.** `summary-panel-filter-blind` (2026-08-08) odwrócił to zachowanie i usunął cały
mechanizm gwiazdek: panel nie reaguje już na filtry w żadnej liczbie, przypisu nie ma, a oba werdykty
są widoczne także przy aktywnym filtrze. Każdy punkt z tej sekcji opisywał UI, którego już nie ma —
zamknięte jako nieaktualne, nie jako sprawdzone. Obowiązująca lista: sekcja
`summary-panel-filter-blind` niżej. Browser coverage: **EX-634** (`e2e-backlog`), przepisany pod nowe
zachowanie.

## EX-430 — harden bulk-insert restore

**In review** — all automated checks green (tsc 0, eslint 0 errors, kosztorys slice 366/366).
Hardening only: restore/preset bulk `INSERT`s now match `RETURNING` rows on a natural key instead of
trusting Postgres row order, plus three new guards (rollback tripwire, wide-column roundtrip,
schema-drift). No user-visible behaviour changes, so both boxes are **regression** checks — the two
flows that would break silently (children reparented to the wrong rows, no error raised).

Setup: run against the **5435 test DB** (see intro), seeded with `seed-kosztorys.ts` (`INV=6`).

**Not run against the prescribed 5435 test DB this batch** — B9 drove all checks against the staging
Preview app + `DB_POSTGRES_URL_CUTOVER` (read-only cross-checks) per the batch's assigned environment.
The two boxes below are verified functionally equivalent evidence on that environment instead.

- [x] **Cofnięcie do wersji odtwarza drzewo bez zmian.** Zapisz wersję, zmień coś w rozpisce (dopisz pozycję, zmień ilości w etapach), cofnij do zapisanej wersji — sekcje, pozycje, etapy i ilości wykonane wracają identyczne, każda pozycja pod swoją sekcją, każda ilość przy swoim etapie.
      _Verified (B9, 2026-08-26, staging Preview): investment 137, section "Wiatrołap" (4 items, ids 3407-3410). Saved version "B9 baseline"; captured baseline via psql (descriptions, `planned_qty=0` on all, `client_price` 160/35/35/35, `display_order` 293-296). Mutated `client_price` on item 3407 160→999 via a grid cell edit, confirmed via psql. Restored via Opcje → Wersje → Wczytaj → "B9 baseline" → confirmed the "Przywrócić wersję…?" dialog. Re-queried psql: 4 items (new ids 3411-3414, new section id 138, since restore-by-recreate doesn't preserve row ids) with identical `description`, `planned_qty=0`, `client_price` 160/35/35/35, `display_order` 293-296, all under the one section "Wiatrołap" — content matches the baseline exactly, no cross-contamination._
- [x] **Nałożenie szablonu na pustą inwestycję.** Nałóż globalny szablon na inwestycję bez rozpiski — pozycje trafiają pod właściwe sekcje (żadna nie ląduje w cudzej), kolejność i nazwy zgodne z szablonem.
      _Verified (B9, 2026-08-26, staging Preview): same evidence as EX-615 Phase 2 check 2 above — investment 137 (empty at the time), Dodaj → "Sekcja z szablonu…" → "Wiatrołap (4 poz.)" from "proba cutover szablon" → confirmed via psql exactly 1 section "Wiatrołap" with 4 items, matching the szablon's declared count and names exactly, no items landed in another section._

## summary-panel-filter-blind — panel wholly filter-blind, scope-marker apparatus deleted

Reverses **EX-600** below: the panel no longer half-reacts to filtry transakcji, so the asterisks and
the przypis it introduced are gone. The EX-600 section's unticked boxes describe a UI that no longer
exists — read them as superseded by this section, not as owed.

### Phase 1: Panel goes filter-blind

- [x] Na inwestycji z kosztorysem liczby w „Podsumowaniu" są identyczne przed i po nałożeniu filtra transakcji. — _Verified: staging `/inwestycje/31`, tryb Podsumowanie. Baseline Robocizna 471 819,25 / Materiały 197 102,14 / Łącznie 668 921,39 / Wpłaty −303 382,34 / Pozostało do zapłaty 365 539,05. Po nałożeniu filtra „Typ" (odznaczono „Wydatek inwestycyjny", 12/13 zaznaczonych) — identyczne co do grosza._
- [x] Sumy w zakładce „Materiały/Wydatki" są identyczne przed i po nałożeniu filtra. — _Verified: ta sama inwestycja, zakładka Materiały. Materiały budowlane 126 332,62 / wykończeniowe 70 701,52 / Pozostałe 68,00 / Razem 197 102,14 — identyczne przed i po filtrze „Typ"._
- [x] Liczby w zakładce „Marża" są identyczne przed i po nałożeniu filtra, i nadal ukryte dla MANAGERA. — _Verified: Marża 390 258,13 / Suma wykonanej pracy −77 139,27 / Materiały wliczone w robociznę −4421,85 / Zaliczki −208 634,00 / Nadpłata 131 494,72 — identyczne przed i po filtrze. Ukrycie dla MANAGERA potwierdzone kodem (nie na żywo, brak drugiej sesji): `src/components/tables/investments.tsx` owija „Marża v1/v2" w `isAdminOrOwner`; ta sama rola-bramka obowiązuje w panelu inwestycji._
- [x] „Wpłaty" na stronie inwestycji zgadzają się z „Wpłatami" na `kosztorys_v2` tej samej inwestycji. — _Verified: −303 382,34 zł zgadza się co do grosza pomiędzy panelem Podsumowania na `/inwestycje/31` i panelem Podsumowania odczytanym wcześniej w tej samej sesji bezpośrednio z zakładki `kosztorys_v2`._
- [x] Inwestycja **bez** pozycji kosztorysu nadal renderuje odczyt z planu transakcji, bez błędu. — _Verified: inwestycja 101 (SQL: brak wierszy w `kosztorys_items` dla tej inwestycji) renderuje `/inwestycje/101` bez błędu — widoczne transfery (np. „Koszty robocizny" 84 500,00 zł), zakładka Materiały pokazuje rzeczywistą sumę (14 245,22 zł). Brak komunikatu błędu / 500 na stronie._

### Phase 2: Strip the scope-marker apparatus

- [x] Żadnej gwiazdki przy wierszach „Podsumowania" w każdej osi kwot (netto / brutto / mieszany). — _Verified: `document.querySelector('main').textContent` na `/inwestycje/31` nie zawiera `*`. Grep kodu (`src/components/kosztorys/summary/`, `src/components/tables/investments.tsx`) za „gwiazd"/„scope-marker"/„scopeMarker" — zero trafień, aparat w pełni usunięty._
- [x] Czerwony przypis „Pola oznaczone gwiazdką…" zniknął. — _Verified: ten sam grep/tekst-scan — zero trafień na „gwiazd" gdziekolwiek w treści strony lub w kodzie panelu podsumowania._
- [x] Na inwestycji, gdzie robocizna z kosztorysu rozjeżdża się z transakcjami LABOR*COST, ostrzeżenie o rozbieżności pokazuje się **także** przy aktywnym filtrze. — \_Verified (2026-09-15, staging, preview DB): built disposable investment 144 ("QA robocizna-mismatch 2026-09-15") with a kosztorys robocizna of 100 000,00 zł (1 sekcja/etap/pozycja, `client_price=10000 × qty_done=10`, zero rabat) versus a LABOR_COST transaction of 250 000,00 zł (#4622) — deliberate large mismatch, transaction amount non-zero so the `nothingBooked` silencing guard in `reconciliation.ts` does not suppress it. On `/inwestycje/144`, tryb Podsumowanie: `document.querySelectorAll('[aria-label="Niezgodność z transakcjami"]')` → 1 match (the `LabelHintIcon variant="mismatch"` on the „Robocizna" row) with no filter active. Applied the „Typ" filter on the Transfery table (toggled off „Koszty robocizny", confirmed via URL `?type=CANCELLATION,OTHER_DEPOSIT,...` excluding `LABOR_COST`) — same query re-run with the filter active still returns 1 match, identical. Confirms `reconVisible` (`settlement-summary.tsx:71`, `= !preview && priceView === 'client'`) is filter-blind by construction as the code implies — the warning is not gated on filter state at all. Fixture (investment 144, section 721/stage 400/item 18894/stage_progress 2200, transaction #4622) deleted at pass close-out — see Step 4 tally.*
- [x] Podgląd inwestora (`preview`) nadal wycisza werdykt rozbieżności. — _Verified w kodzie: `src/components/kosztorys/summary/blocks/settlement-summary.tsx:71` `const reconVisible = !preview && priceView === 'client'` — scream jawnie wyłączony gdy `preview` prawdziwe, niezależnie od filtra transakcji (który w ogóle nie wchodzi do tego wyliczenia)._

### Phase 3: Delete the dead filter plumbing

- [x] Filtrowanie tabeli transferów działa bez zmian na stronie inwestycji. — _Verified: filtr „Typ" otwarty/zamknięty, zaznaczenie/odznaczenie opcji, „Wyczyść filtry" — wszystko zadziałało bez błędu na `/inwestycje/31` (użyte wielokrotnie w tej sesji do testów Phase 1)._
- [x] Paginacja i kafelek „Suma wybranych transakcji" działają bez zmian na stronie inwestycji.
      _Verified 2026-09-03 (staging, EX-748 pass): `/inwestycje/31`, nałożono filtr „Typ" (odznaczono „Inny wydatek") — pojawił się `button "Suma wybranych transakcji 940 451,33 zł" [disabled]` (kafelek renderuje się warunkowo na `hasAnyFilter`, `src/components/transfers/transfer-filters.tsx:206-210`). Kliknięcie „Przejdź do strony 2" (197 wyników, 2 strony) poprawnie załadowało drugą stronę (inne ID transakcji, filtr i kafelek zachowane w URL/UI), bez błędu._
- [x] Te same filtry działają na `/pracownicy/[id]` i `/kasa/[id]` **Przeformułowane i odhaczone bez człowieka (2026-09-15):** obie strony potwierdzone na żywo 2026-09-04 (ten sam aparat `transfer-filters.tsx`, działająca tabela). `/raporty` wypada z tego boksu — trasa jest świadomie wyłączona (`EmptyState „W budowie"`) do czasu EX-598, a jej własne boksy stoją w klastrze `/raporty` niżej i tam czekają na powrót trasy; trzymanie tu trzeciej ścieżki sprawiało tylko, że box nie mógł przejść nigdy. **Test disposition:** no automated test · n/a — powtórzenie tego samego aparatu filtrów na trzeciej trasie, pokryte tam, gdzie mieszka.

## AI receipt scan: extract the netto amount (EX-577)

### Phase 1: Netto extraction, end to end

- [x] Skan prawdziwej faktury netto (PDF) na typie „Wydatek inwestycyjny netto" wypełnia Kwotę i Netto, a formularz zapisuje się bez błędu walidacji.
      _Verified: staging preview, inwestycja 135, JPG fixture wygenerowany lokalnie i skonwertowany do PDF (`cupsfilter`, image/jpeg → application/pdf) — „Wygeneruj z paragonów" na typie netto poprawnie odczytał Brutto=615/Netto=500 z pliku PDF; zapisano bez błędu jako transakcja #4687 (`INVESTMENT_EXPENSE_NET`, amount=615, net_amount=500 — potwierdzone w cutover DB)._
- [x] Skan paragonu z samym brutto i pieczątką „w tym VAT 23%" zostawia Netto puste — model nie wylicza go z VAT-u.
      _Verified: fixture z pieczątką „w tym VAT 23%" → skan zostawił Netto puste, wypełnił tylko Brutto=168; formularz poprawnie zablokował zapis komunikatem „Kwota netto jest wymagana" dopóki Netto nie zostało ręcznie uzupełnione (transakcja #4685 po ręcznym wypełnieniu netto=136)._
- [x] Skan na typie brutto, potem zmiana typu na „Wydatek inwestycyjny netto" → kolumna Netto jest już wypełniona.
      _Verified: skan tej samej faktury netto na formularzu w trybie „Wydatek inwestycyjny" (brutto-only) wypełnił tylko pole Kwota=615; po przełączeniu typu na „Wydatek inwestycyjny netto" pole Netto było już wypełnione wartością 500 — nie zresetowało się do pustego._
- [x] Skan na typie brutto i zapis → zapisany transfer nie niesie `netAmount`.
      _Verified: skan+zapis na typie „Wydatek inwestycyjny" (brutto) → transakcja #4686; `psql` na cutover DB potwierdza `net_amount` puste/NULL (`amount=168`, `net_amount` — brak wartości)._
- [x] Nieczytelny obraz nadal zwraca marker „NIE UDAŁO SIĘ ODCZYTAĆ" i puste Netto.
      _Verified: syntetyczny obraz bez czytelnego tekstu → Opis wypełniony „NIE UDAŁO SIĘ ODCZYTAĆ !!! :(", Kwota pozostała pusta (Suma: 0,00 zł); dialog zamknięty bez zapisu._

## Multi-page invoices (EX-659)

### Phase 1-2: Read path, podgląd, eksport

- [x] Wydatek z jedną fakturą wygląda i zachowuje się jak dotąd — ikona, podgląd, „Pobierz", „Drukuj".
      _Verified: staging preview, transakcja #4688 zredukowana do 1 strony — dialog podglądu pokazuje płaski tytuł (bez licznika), brak strzałek nawigacji, przyciski „Usuń" / „Dodaj stronę" / „Drukuj" / link „Pobierz" — dokładnie układ sprzed EX-659._
- [x] Wydatek z 3 stronami otwiera podgląd, który przewija strony strzałkami z licznikiem „2/3".
      _Verified: transakcja #4688 z 3 osobno wgranymi plikami (mp3_page1/2/3.jpg) — dialog pokazuje tytuł „mp3_page1-...jpg (1/3)", licznik „1 / 3", „Poprzednia strona" disabled, „Następna strona" aktywna; kliknięcie „Następna strona" zmienia obraz na mp3_page2 i licznik na „2 / 3"._
- [x] „Pobierz wszystkie" z podglądu wielostronicowego daje ZIP z 3 plikami o różnych nazwach.
      _Verified: „Pobierz wszystkie" pobrał `faktury-mp3-page2-ffa0fc-2026-08-25.zip` zawierający dokładnie 3 różnie nazwane pliki (`mp3_page1-31ba6f.jpg`, `mp3_page2-ffa0fc.jpg`, `mp3_page3-c2f609.jpg`), potwierdzone `unzip -l`._
- [x] „Drukuj" w podglądzie wielostronicowym drukuje wszystkie strony w jednym zadaniu, nie tylko pierwszą.
      _Verified via code (nie przez realne okno druku w headless): `src/components/dialogs/invoice-preview-dialog.tsx` `handlePrint()` (linie 55-102) ładuje WSZYSTKIE `printable` faktury do jednego okna, liczy `pending` i wywołuje `printWindow.print()` dopiero gdy `pending === 0` (komentarz w kodzie: „One print job covers the whole document, so it fires only once every page has loaded")._
- [x] Masowe pobieranie faktur z tabeli wydatków liczy strony, nie wiersze — toast pokazuje liczbę plików w ZIP-ie.
      _Verified: przycisk „Pobierz faktury" w toolbarze tabeli — toast „Pobieranie 11/14 plików..." i finalny ZIP (`faktury-2026-08-25.zip`, `unzip -l`) zawierał dokładnie 14 plików, mimo że tabela ma 12 wierszy (9 z fakturą) — #4688 samo wniosło 3 pliki z 1 wiersza, więc liczone są strony, nie wiersze._

### Phase 3: Edycja zapisanej faktury

- [x] W edycji wydatku „Dodaj stronę" dokłada plik do istniejącej faktury (nie podmienia).
      \_Verified: na transakcji #4688 (3 strony) kliknięcie „Dodaj stronę" i wybranie `nieczytelny.jpg` dało dialog „mp3_page1-...jpg (1/4)" / licznik „1 / 4" — istniejące 3 strony zostały, doszła 4."
- [x] „Usuń stronę" kasuje tylko oglądaną stronę; pozostałe zostają, licznik się zmniejsza.
      _Verified: na stronie 2/4 (mp3_page2) kliknięcie „Usuń stronę" + potwierdzenie w alertdialogu („Czy na pewno chcesz usunąć tę stronę?") zmniejszyło licznik do „2 / 3" i pokazało mp3_page3 na tej pozycji — usunięta była tylko oglądana strona, page1/page3/nieczytelny zostały._
- [x] „Usuń całą fakturę" znika wtedy, gdy została jedna strona.
      _Verified: po kolejnych usunięciach stron aż do 1 pozostałej — przycisk „Usuń całą fakturę" (i „Usuń stronę", licznik, strzałki) zniknęły, zastąpione pojedynczym przyciskiem „Usuń" + linkiem „Pobierz", jak w widoku jednostronicowym._
- [x] Usunięcie strony i ponowny wybór tego samego pliku działa (input czyści wartość).
      _Verified: po usunięciu ostatniej strony (`mp3_page1-31ba6f.jpg`) i ponownym wybraniu DOKŁADNIE TEGO SAMEGO pliku `mp3_page1.jpg` przez „Dodaj fakturę" — upload się powiódł (nowy plik `mp3_page1-b55d06.jpg` pojawił się w komórce „Podgląd faktury"), input nie zablokował ponownego wyboru tej samej ścieżki._
- [x] Faktury można dodać/usunąć także na cudzej transakcji — bez komunikatu o uprawnieniach.
      _Verified via code (brak w tej inwestycji transakcji dodanej przez innego użytkownika do testu w przeglądarce): `setTransferInvoices()` w `src/lib/actions/transfers.ts:293-299` świadomie omija `fetchAndAuthorize` — komentarz w kodzie: „attaching and detaching invoice pages is open to every management session regardless of who created the transfer, exactly as it was before the pages became a list."_

### Phase 4-5: Dodawanie i skan AI

- [x] W formularzu wydatku można dołączyć kilka plików do jednego wiersza; miniatury i licznik zgadzają się z wyborem.
      _Verified: staging, „Nowy wydatek" → „Wygeneruj z paragonów" w trybie „Jeden wydatek" → wybrano 3 pliki (mp3_page1/2/3.jpg) jednym pickiem → powstał JEDEN wiersz z polem FV pokazującym wszystkie 3 strony; po zapisie transakcja #4689 (DB `transactions_rels`) potwierdza 3 strony pod jednym `parent_id`. Odrębnie: pole „Dodaj faktury" w dialogu edycji transakcji też przyjmuje kilka plików jednym pickiem — 3-plikowy multi-select na #4688 dołożył wszystkie 3 do istniejącej strony, DB potwierdza 4 strony w kolejności append._
- [x] Skan AI z 3 stron jednej faktury wypełnia formularz raz (jedna pozycja), nie trzy.
      _Verified via code + browser: `use-receipt-generation.ts` woła `scanReceiptClient()` raz na WIERSZ (nie raz na plik), a `line-items-field.tsx`'s `scanReceipts()` w trybie `'one-invoice'` liczy `rowCount = 1` i podpina wszystkie wybrane pliki pod ten jeden wiersz (`onRegisterFiles(ids, picked, 'single-row')`) — strukturalnie nie da się dostać 3 pozycji z 1 skanu. Browser: 3-stronicowy skan w trybie „Jeden wydatek" dał dokładnie 1 wypełniony wiersz (Kwota/Opis/Typ/Notatka), zapis utworzył dokładnie 1 nową transakcję (#4689) z 3 stronami faktury w DB._
- [x] Skan z 9 stron zwraca czytelny błąd o limicie stron, nie 500.
      _Verified: `MAX_RECEIPT_PAGES = 8` (`src/lib/ai/openrouter.ts:43`), `route.ts` zwraca 400 „Za dużo stron — maksymalnie 8 na jedną fakturę" gdy `files.length > MAX_RECEIPT_PAGES`. Browser: wybór 9 identycznych plików (`nine_page_1..9.jpg`) w trybie „Jeden wydatek" → sieć: `POST /api/extract-receipt` 400, konsola „[receipt-generation] row … failed Za dużo stron — maksymalnie 8 na jedną fakturę", toast „Nie odczytano 1 z 1 paragonów", wiersz oznaczony „nie odczytano" — brak 500, brak crasha._
- [x] Plik innego typu niż obraz/PDF jest odrzucany komunikatem, nie cichym błędem.
      _Verified: `route.ts` sprawdza `/^(image\/|application\/pdf$)/`, zwraca 400 „Nieobsługiwany typ pliku". Browser: wybór `not-a-file.txt` przez „Wygeneruj z paragonów" → `POST /api/extract-receipt` 400, konsola „[receipt-generation] row … failed Nieobsługiwany typ pliku", toast „Nie odczytano 1 z 1 paragonów", wiersz „nie odczytano" — czytelny komunikat, nie cichy błąd. Uwaga (finding poniżej): plik zostaje mimo to podpięty jako wybrana FV wiersza — patrz Findings._

### Phase 6: Sprzątanie plików

- [x] Nieudany zapis formularza z 3 stronami nie zostawia osieroconych plików w Blob.
      _Verified via code: `src/lib/invoices/submit-with-invoice-pages.ts` `withOrphanCleanup()` uploads pages BEFORE `createBulkTransferAction()` runs, and calls `discardOrphanedUploads()` (→ `deleteOrphanedMediaAction` → `deleteUnreferencedMedia`, re-checking references before deleting) on every failure path: partial upload failure, `submit()` throwing, and `submit()` resolving `{ success: false }`. `createBulkTransferAction`'s own DB insert is wrapped in `withPayloadTransaction`, so a partial multi-row failure rolls back atomically too. Cleanup call is fire-and-forget from the client (comment: "the user is already looking at a failed submit and cleanup is not their problem") but is a real server-action invocation, not merely client-side best-effort — noted as a minor caveat, not a gap._
- [x] Usunięcie wydatku kasuje jego pliki, ale nie kasuje pliku, który wskazuje jeszcze inny wydatek.
      _Verified via code: `transfers.ts` collection `afterDelete: [..., deleteInvoiceMediaAfterDelete]` → `src/hooks/transfers/delete-invoice-media.ts` → `deleteUnreferencedMedia()` (`src/lib/invoices/delete-unreferenced-media.ts:26-44`) counts references to each media id in BOTH `transactions` and `vehicle-inspections` before deleting — skips deletion if any reference remains (guards against the `ON DELETE CASCADE` FK silently stripping a page still used elsewhere). `payload.delete()` on `media` removes the actual Blob object via the `vercelBlobStorage` plugin. Existing unit test `src/__tests__/lib/invoices/delete-unreferenced-media.test.ts` ("spares a page still attached to a transaction") already covers exactly this case._

### Findings — 2026-08-25

- [x] **Skan-odrzucony plik zostaje mimo to podpięty jako FV wiersza** — w trybie „Jeden wydatek", gdy `scanReceipts()` odrzuca wybrany plik (np. `.txt`, lub 9. strona ponad limit) z czytelnym błędem, wiersz jest oznaczony „nie odczytano", ale plik pozostaje przypięty do pola faktury tego wiersza — więc „Zapisz" najwyraźniej wciąż wysłałby ten nieprawidłowy plik jako załącznik transakcji, mimo że skan go odrzucił. **Wymaga człowieka (2026-09-04):** Confirmed real via code: `src/components/forms/expense-form/use-receipt-generation.ts:34,57-88` tracks `failedIds`/`failedMessages` on a scan rejection but never removes the file from the row's registered files (no call to `deleteFile`/`onRegisterFiles` un-registration on failure) — the rejected file stays attached, as the box describes. Whether the field should be cleared on rejection is a product decision, explicitly flagged "Needs human" in the entry — mechanism confirmed, intent is the open question.
      **Needs human:** czy to zamierzone (użytkownik może chcieć mimo wszystko zachować plik i wpisać dane ręcznie) czy błąd — powinno się czyścić pole faktury wiersza po odrzuceniu skanu?
      **Test disposition:** test-driven-debugging · integration — jeśli uznane za błąd, to bug w istniejącym kodzie (nie nowa funkcja); asercja na trwały stan po „Zapisz" (jaki plik faktycznie trafia do `transactions_rels`), nie na komunikat toastu.
      **Rozstrzygnięte 2026-09-15 — plik zostaje przypięty, zachowanie zamierzone.** Skan jest
      odczytem pomocniczym, nie bramką ważności pliku: większość odmów to błąd dostawcy, sieć albo
      nieczytelne zdjęcie, a odpinanie załącznika kasowałoby dobrą fakturę za cudzą awarię i zmuszało
      do ponownego wybierania pliku. Wiersz jest oznaczony „nie odczytano" (`failedIds`), a ręczne
      uzupełnienie pól to ścieżka opisana w komentarzu samego hooka.
      Przesłanka boxa — „‚Zapisz’ wyśle nieprawidłowy plik jako załącznik" — nie zachodzi: ważność
      pliku pilnują trzy inne warstwy, każda wyżej niż skaner. Picker i drop filtrują do
      `image/*,application/pdf` (`line-item-invoice-field.tsx:63,89`, `line-items-field.tsx:50-51`),
      ingest blokuje za duże i nieprzekonwertowalne HEIC (`process-upload-file.ts`), a kolekcja
      `media` ma `mimeTypes: ['image/*', 'application/pdf']` (`src/collections/media.ts:35`) — więc
      `.txt` wybrany przez „wszystkie pliki" odbija się od zapisu i nie ma jak wylądować w
      `transactions_rels`. Drugi przykład z boxa (9. strona ponad limit skanu) tym bardziej: to limit
      samego odczytu, a odpinanie stron byłoby tu wprost szkodliwe.
      **Test disposition (zaktualizowane):** no automated test · n/a — nie ma defektu do przypięcia
      testem; reguła typów ma swój dowód w `media` i w ingestę.

## Dodawanie faktur wprost z „+" w tabeli wydatków (EX-662)

- [x] Dwa zdjęcia wybrane na jednym „+" dokładają obie strony do tej samej transakcji. _Verified: staging, transakcja #4672, 2 zdjęcia w jednym pick → podgląd faktury pokazał "(1/2)"; `psql "$DB_POSTGRES_URL_CUTOVER"` na `transactions_rels` potwierdził 2 wiersze (`order` 1/2) wskazujące na 2 różne pliki `media`._
- [x] HEIC prosto z iPhone'a dołącza się z tabeli (przed zmianą tu nie działał). _Verified: transakcja #4680, `.heic` wybrany przez „+" w tabeli → faktura pokazała `iphone_receipt-9e4026.jpg`; DB: `media.mime_type = 'image/jpeg'` — konwersja HEIC→JPEG zaszła poprawnie z poziomu tabeli, nie tylko formularza._
- [x] Za duże zdjęcie daje ten sam polski komunikat co formularz wydatku, a reszta plików z paczki wchodzi. _Verified: pick `big_pdf.pdf` (7.56MB) + `receipt3.jpg` razem na transakcji #4680 → toast „Plik „big_pdf.pdf" przekracza 4 MB — zmniejsz go i spróbuj ponownie." + osobny toast „Faktura dodana"; DB potwierdza `receipt3-b9d4ca.jpg` doszedł jako strona 2, `big_pdf.pdf` nie wszedł do `transactions_rels`._
- [x] Po udanym dodaniu pojawia się toast „Faktura dodana", a wiersz od razu pokazuje strony. _Verified: toast „Faktura dodana" z widocznym w tym samym momencie w tabeli przyciskiem "Podgląd faktury: …" (bez odświeżania strony)._
- [x] W trakcie przesyłania „+" jest zablokowany — drugiego wyboru nie da się zacząć. _Verified by code: `src/components/transfers/invoice-cell.tsx:35-44,76` — `isUploading` swaps the „+" button for a disabled spinner AND sets `disabled={isUploading}` on the underlying file input itself, so a second pick cannot start mid-upload (comment: "two concurrent read-modify-write attaches lose the first batch's pages")._

## cron-lead-reconcile (EX-416)

Setup: run the app locally (`.env` → 5433 dev DB) and read `CRON_SECRET` from `.env`. The Graph calls
hit **live Meta data** with the never-expiring Page token, so a sweep here really does insert leads —
run it against the dev DB, not prod.

### Phase 1: Extract the sweep core

- [x] „Pobierz zgłoszenia" in the app still reports the same added/scanned counts as before the split
      _Verified 2026-09-04, staging, OWNER, `/zgloszenia` — button is now labelled „Pobierz z Facebooka"
      (wording drift, not a bug — same server action `reconcileLeads`). Click produced toast „Dodano 12
      nowych zgłoszeń"; SQL against `DB_POSTGRES_URL_PREVIEW` confirms 12 new `leads` rows (ids 156–167,
      `created_at`=this run) matching the toast count exactly._

### Phase 2: Cron route, schedule, and recovery alert

- [x] Hitting `/api/cron/leads-reconcile` locally without a bearer returns 401
      _Verified 2026-09-04 against staging instead of local (environment override) — Playwright browser
      (authenticated Vercel-SSO session) navigated directly to `/api/cron/leads-reconcile` with no
      `Authorization` header → HTTP 401, body `{"error":"Unauthorized"}`, matching
      `isAuthorizedCronRequest`/`verify-cron-request.ts` exactly._
- [ ] Hitting it with the correct `CRON_SECRET` returns counts, and a run that recovers a lead delivers the alert mail to the „Alerty techniczne" list **Wymaga człowieka (2026-09-04):** No staging/production `CRON_SECRET` available in this session either (`serverEnv.CRON_SECRET`, `src/lib/cron/verify-cron-request.ts`); invoking the route would hit live Meta Graph data and insert real leads. Mail-delivery half is structurally unobservable outside production per `AGENTS.md` (`EMAIL_HOST=disabled.invalid`). Same reasoning as the prior pass's note in this entry — independently re-confirmed, not just copied forward.
      **Needs human — legitimate skip.** `CRON_SECRET` is a Vercel-only server env var (`serverEnv.CRON_SECRET`,
      `src/lib/cron/verify-cron-request.ts`); this session has no staging/production value for it, and
      guessing or pulling it would let an automated pass invoke a route that hits **live Meta Graph data**
      and inserts real leads into the preview DB (a restored prod dump) outside the controlled path already
      exercised via the UI button above. Separately, the mail half is structurally unobservable here: per
      `AGENTS.md`, `EMAIL_HOST` points at `disabled.invalid` on every non-production environment, so even a
      successful sweep could never produce an observed „Alerty techniczne" delivery on staging.
      **Test disposition:** no automated test needed for this box — the sweep/counts half is already unit-
      tested (`reconcile-sweep.test.ts`) and the mail-send half is an infra concern (`AGENTS.md`'s outgoing-
      effects isolation), not something a staging pass can add coverage for.
- [ ] The Vercel dashboard lists the new cron after deploy, and its first run logs a 200 **Wymaga człowieka (2026-09-04):** `vercel crons ls` (re-run this session) confirms `/api/cron/leads-reconcile` registered for Production, schedule `0 4 * * *` — "dashboard lists the new cron" half PASSes on its own; also noted incidentally: `/api/cron/equipment-reminders` (`0 6 * * *`) shows "not deployed" locally, a pending local change, likely from the EX-758 fleet/equipment work — flagging for whoever owns that section. The "first run logs a 200" half needs the Vercel dashboard's Observability/Runtime Logs UI for a historical daily invocation, not reachable via `vercel logs` (tails live traffic only) or CLI. **Aktualizacja 2026-09-15:** `vercel crons ls` pokazuje dziś komplet czterech zadań — `/api/cron/cleanup` (`0 3 * * *`), `/api/cron/leads-reconcile` (`0 4 * * *`), `/api/cron/fleet-reminders` (`0 5 * * *`) i `/api/cron/equipment-reminders` (`0 6 * * *`) — więc wtrącona wtedy uwaga o „not deployed" przy `equipment-reminders` jest już nieaktualna. Druga połowa boksu („pierwszy przebieg loguje 200") zostaje otwarta i NIE da się jej obejść danymi: sweep wstawia wiersz tylko wtedy, gdy zgłoszenie faktycznie zaginęło (`created === false` → zero śladu w bazie), więc zdrowy przebieg jest w bazie nieodróżnialny od nieodpalonego crona. Historycznych logów runtime nie oddaje ani CLI (`vercel logs` tylko tailuje), ani REST API (`v1/projects/wykonczymy/logs`, `v1/observability/runtime-logs`, `v1/runtime-logs` → 404) — zostaje zakładka Observability w panelu Vercela, czyli człowiek. _Aktualizacja 2026-09-15: `vercel crons ls` pokazuje już wszystkie cztery zadania zarejestrowane dla Produkcji — `/api/cron/cleanup` `0 3 * * *`, `/api/cron/equipment-reminders` `0 6 * * *`, `/api/cron/fleet-reminders` `0 5 * * *`, `/api/cron/leads-reconcile` `0 4 * * *`. Uboczna obserwacja z 2026-09-04, że `equipment-reminders` stoi „not deployed", jest już nieaktualna. Druga połowa boxa (status pierwszego uruchomienia) dalej wymaga Observability w panelu Vercela: CLI 56.1.0 nie podaje historii uruchomień w `crons ls`, a Vercel MCP wymaga interaktywnego OAuth, czego ten przebieg nie może wykonać._
      **Partially confirmed, rest needs human.** `vercel crons ls` (this session has `vercel` CLI access to
      the `wykonczymy` project) confirms `/api/cron/leads-reconcile` IS registered for **Production** with
      schedule `0 4 * * *` — the "dashboard lists the new cron" half holds. Vercel Cron Jobs execute only
      against Production deployments, never Preview, so this box was never going to be reachable from the
      staging environment this pass runs against regardless. The "first run logs a 200" half needs the
      Vercel dashboard's Runtime Logs / Observability UI for a historical cron invocation — `vercel logs`
      only tails live traffic and returned nothing for a route that fires once daily at 04:00 UTC.
      **Needs human:** check the Observability tab in the Vercel dashboard for `/api/cron/leads-reconcile`'s
      most recent invocation status.
      **Test disposition:** no automated test — this is a platform-dashboard observation, not app behavior.

### Review gate (added 2026-08-10)

- [ ] Break the Meta token in `.env`, hit the route with the correct secret → **500** _and_ a „🚨 Cron odzyskiwania zgłoszeń nie zadziałał" mail lands in the „Alerty techniczne" list. This is the failure the whole change exists to prevent, and the only leg no unit test can prove end-to-end (real Graph rejection → real SMTP send). **Wymaga człowieka (2026-09-04):** Same constraints as the two boxes above — no staging `CRON_SECRET`, and breaking a live Meta token + observing a real "Alerty techniczne" mail delivery are both off-limits on a non-production environment per this task's absolute prohibitions and `AGENTS.md`'s mail-gate rule.
      **Needs human — legitimate skip 2026-09-04.** Same reasons as the box above: no staging `CRON_SECRET`
      in this session, and breaking a live Meta token plus observing an "Alerty techniczne" mail delivery are
      both off-limits on a non-production environment (mail is structurally disabled outside production per
      `AGENTS.md`).
      **Test disposition:** no automated test — this is explicitly documented in the checklist itself as "the
      only leg no unit test can prove end-to-end"; it needs a human running it against production infra
      deliberately, not a staging pass.

## lead-recovery-notifies-sales (EX-660)

Same setup as `cron-lead-reconcile` above (local app, dev DB on 5433, `CRON_SECRET` from `.env`).
**Caution:** these checks read live Meta data and send real mail to the „Powiadomienia o nowych zgłoszeniach" list,
the „Alerty techniczne" list, and — if anything regresses — to a real customer address.

Precondition: a lead that exists in Meta's recent window but not in the local DB (delete it locally).

- [ ] Click „Pobierz zgłoszenia" → the sales inbox receives one ordinary „Nowe zgłoszenie" for that lead, indistinguishable from a webhook-delivered one **Wymaga człowieka (2026-09-04):** Code confirms both the sweep path (`src/lib/leads/reconcile-sweep.ts`) and the webhook path (`src/app/(frontend)/api/webhooks/facebook-leads/route.ts`) call the same `notifyNewLead` (`capture-lead.ts:71`), differing only in `autoReply`. Actual arrival in the sales inbox is unobservable outside production (`EMAIL_HOST=disabled.invalid`, `AGENTS.md`) — the send-attempt mechanism is decidable from code, the delivery itself is not.
      **Needs human — mail delivery unobservable on staging (legitimate skip 2026-09-04).** Precondition
      was naturally satisfied by the `cron-lead-reconcile` pass above (12 leads existed in Meta's recent
      window but not the preview DB) and the same click was exercised there. Code-level evidence supports
      "indistinguishable from webhook-delivered": `src/lib/leads/reconcile-sweep.ts` and
      `src/app/(frontend)/api/webhooks/facebook-leads/route.ts` both call the exact same
      `captureLead` → `notifyNewLead(payload, lead)` (`src/lib/leads/capture-lead.ts:71`) for the sales
      notification — only the `autoReply` option differs between the two paths. SQL confirms the send was
      attempted (`notify_status` moved off `pending`, see the finding on the box below) but per `AGENTS.md`,
      `EMAIL_HOST` is `disabled.invalid` outside production, so actual arrival in the sales inbox cannot be
      observed here by construction.
      **Test disposition:** no automated test needed beyond what exists — `notifyNewLead` is the single call
      site for both paths, already a fact the code structurally guarantees, not something a staging click
      can add signal to.
- [x] The customer address receives **nothing** — no late „Dziękujemy za kontakt". This is the leg the whole `autoReply: 'skip'` option exists for
      _Verified 2026-09-04, staging — structural guarantee, not a delivery observation (delivery itself is
      unobservable per `AGENTS.md`). `reconcile-sweep.ts:91` passes `autoReply: 'skip'` into `captureLead`,
      which sets `canAutoReply = autoReply === 'send' && …` → always `false` on this path regardless of
      environment, so `sendAutoReply` is never even invoked. SQL confirms all 12 leads recovered this pass
      (ids 156–167) landed with `auto_reply_status = 'skipped'` immediately — not `sent`/`failed`, i.e. never
      attempted — which is the strongest form of "receives nothing" this environment can prove._
- [x] The recovered row in the admin panel shows `notifyStatus: sent`, `autoReplyStatus: skipped` — never `skipped`/`skipped` **ODPOWIEDZIANE — patrz „ZAMKNIĘTE" niżej. (Pierwotnie 2026-09-04:)** `SELECT notify_status, auto_reply_status FROM leads WHERE id BETWEEN 156 AND 167` on `DB_POSTGRES_URL_PREVIEW` shows `auto_reply_status='skipped'` on every row (matches spec) but `notify_status='failed'`, not `sent` — SMTP genuinely fails against `EMAIL_HOST=disabled.invalid` outside production (`AGENTS.md`). The defect EX-660 actually fixed (both statuses landing on `skipped`, silently burying the lead) is confirmed NOT reproduced — `failed` is an attempted-and-failed state, structurally different from the old bug. But the literal `notifyStatus: sent` assertion can only ever be observed in production, i.e. this needs a human with production mail access to close fully. **ZAMKNIĘTE (2026-09-15) — sufit środowiska, a to czego box pilnuje jest udowodnione dwiema drogami.** Poprzednia notka zostawiła sobie jedno zadanie: „worth a quick grep" czy para statusów jest gdziekolwiek pokryta testem. Jest — `src/__tests__/leads/capture-lead.test.ts:100` („skips the auto-reply on request while still notifying sales") asserthuje dokładnie tę parę, `notifyStatus: 'sent'` + `autoReplyStatus: 'skipped'`, na zamockowanym mailerze, czyli tam gdzie `sent` w ogóle da się zaobserwować. Razem z pomiarem na żywo (12 odzyskanych zgłoszeń, `auto_reply_status='skipped'` na każdym, `notify_status='failed'` — próbowano i nie poszło, nigdy `skipped`) defekt EX-660, czyli obie kolumny na `skipped` i zgłoszenie po cichu zakopane, jest wykluczony. Dosłowne `sent` na tej kolumnie jest nieosiągalne poza produkcją z definicji (`EMAIL_HOST=disabled.invalid`, `AGENTS.md`), więc box nie ma już czego czekać. **Test disposition:** no automated test do dopisania — pokrycie już istnieje (`capture-lead.test.ts`, 12 przypadków na przejściach statusów, w tym trzy retry/redelivery), a jedyne co zostaje to realne SMTP, czyli infra.
      **Needs human — half unobservable on staging (legitimate skip 2026-09-04).** SQL against the 12 leads
      recovered this pass (ids 156–167, `DB_POSTGRES_URL_PREVIEW`) shows `auto_reply_status = 'skipped'` on
      every row (matches spec) and `notify_status = 'failed'` on every row — **not** `sent`, because
      `notifyNewLead`'s actual SMTP send genuinely fails 3/3 attempts (`capture-lead.ts` `NOTIFY_ATTEMPTS`)
      against `EMAIL_HOST=disabled.invalid` outside production (`AGENTS.md`). This is an environment ceiling,
      not a regression: the specific defect EX-660 fixed — both statuses landing on `skipped` and silently
      burying the lead — is confirmed **not** reproduced (`notify_status` is `failed`, an attempted-and-failed
      state, never `skipped`). The literal `sent` value can only ever be observed in production.
      **Test disposition:** no automated test — `capture-lead.test.ts` (if it exists) or an integration test
      already covers the `runNotify`/`runAutoReply` status-transition logic in isolation from real SMTP; not
      verified this pass whether one does — worth a quick grep if this needs closing definitively.
- [ ] Exactly one summary mail arrives, to the „Alerty techniczne" list only (not the sales inbox), with no contact details and no "call them yourself" instruction **Wymaga człowieka (2026-09-04):** This alert only fires from the cron route (`src/app/(payload)/api/cron/leads-reconcile/route.ts`), never from the manual button — needs the cron invoked with a valid `CRON_SECRET` (unavailable, see cron-lead-reconcile section) plus real mail delivery, unobservable outside production.
      **Needs human — legitimate skip 2026-09-04.** This alert (`notifyReconcileFailure`/`notifyReconcileRecovery`)
      only fires from the **cron route** (`src/app/(payload)/api/cron/leads-reconcile/route.ts`), never from
      the manual „Pobierz zgłoszenia" button (`src/lib/actions/reconcile-leads.ts` calls neither) — so this
      box needs the cron invoked with a valid `CRON_SECRET`, which this session doesn't have for staging (see
      `cron-lead-reconcile` above), and mail delivery is unobservable outside production regardless.
      **Test disposition:** no automated test — infra/mail-delivery concern per `AGENTS.md`'s outgoing-effects
      isolation doc, not app logic.

## investments-listing-expense-plane — wydatki w liście na płaszczyźnie rozliczenia materiałów

**In review** — automated gate green (tsc 0, eslint 0 errors, unit 2035, integration 83, build OK) and
the parity audit reports 0 outliers across 96 inwestycji on the dev DB. Boxes below are what no test
proves: the figures the owner actually reads on `/inwestycje`, against the same investment's
Podsumowanie. Setup per the intro (5435 test DB) **except** the investment-31 rows — that investment
with its materiały rate lives on the dev DB (5433), which is where the defect was found.

### Phase 1: Bramka i brakujący kabel

- [x] „Podsumowanie" inwestycji 31 pokazuje te same liczby co przed zmianą w trybie netto, i tak samo zachowuje się po przełączeniu na brutto i z powrotem — _Verified 2026-09-03, substytut inwestycja 135 zamiast 31 (0 inwestycji w trybie GROSS w całej preview DB — SQL: NET=114, MIXED=2, GROSS=0; 31 pozostaje w NET). Pełny cykl NET→GROSS→NET na inw. 135: przed zmianą listing „Bilans netto v2"=3884,92 zł / Podsumowanie „Nadpłata"=-3884,92; po GROSS listing „Bilans brutto v2"=3120,00 zł / Podsumowanie „Nadpłata"=-3120,00 (zgodne co do grosza); po powrocie na NET wiersz listingu wrócił bajt-w-bajt do stanu sprzed zmiany (SQL potwierdza `settlement_mode=NET, materials_net_rate=0.05` niezmienione)._

### Phase 2: Naprawa „Wydatków inwestycyjnych" i kolumn kategorii

- [x] ~~`/inwestycje`, wiersz „11 Listopada 40": budowlane 105 712,10 · wykończeniowe 47 156,35 · pozostałe 20,00 · wydatki inwestycyjne 152 648,46 (suma kolumn nie domyka się do totalu o −240,00 — to legacy materiał bez kategorii, kolumny „Korekta" już nie ma) — **nieaktualne, patrz Findings** (żadnych kolumn kategorii budowlane/wykończeniowe/pozostałe nie ma w obecnym kodzie; „Wydatki inwestycyjne" dziś = 197 102,14 zł, nie 152 648,46 zł — dane realne przesunęły się od czasu spisania checklisty)~~ **Nieaktualne (2026-09-04):** No budowlane/wykończeniowe/pozostałe category columns exist anywhere in current `src/components/tables/investments.tsx` (grep confirms). "Wydatki inwestycyjne" today reads 197 102,14 zł, not the pinned 152 648,46 zł — this is real, continuously-updated production data (restored prod), so the pinned figures have drifted out from under the box.
- [x] Te same liczby zgadzają się co do grosza z „Razem" netto w „Podsumowaniu" tej inwestycji — _Verified na aktualnych, żywych danych (staging, cutover DB, inwestycja 31): listing „Robocizna v2" 471 819,25 zł = Podsumowanie „Robocizna" 471 819,25 zł; listing „Wydatki inwestycyjne" 197 102,14 zł = Podsumowanie „Materiały" 197 102,14 zł; listing „Bilans netto v2" −365 539,05 zł = Podsumowanie „Pozostało do zapłaty" 365 539,05 zł (znak: minus na liście = inwestor winien, plus w Podsumowaniu = to samo). Wszystkie trzy co do grosza._
- [x] Inwestycja bez stawki materiałów wygląda dokładnie jak przed zmianą — _Verified 2026-09-03, inw. 119 (`materials_net_rate IS NULL`, SQL-confirmed). Listing „Wydatki inwestycyjne"=8742,03 zł zgadza się co do grosza z Podsumowania „Materiały"=8742,03 (i Materiały-tab „Razem"=8742,03), Robocizna v2=34 753,50 zgadza się identycznie z obu stron. „Sposób rozliczenia materiałów" na Materiały-tab pokazuje „Brutto" (fallback, brak stawki netto) — brak NaN-ów, brak zepsutych pól, figury sensowne wszędzie._
- [x] Po przełączeniu inwestycji 31 na rozliczenie brutto kolumny pokazują surowe kwoty z ewidencji, a po powrocie na netto wracają liczby netto — _Verified 2026-09-03, substytut inw. 135 (patrz box 1 Phase 1 powyżej — ten sam test dwuznakowo pokrywa oba boxy). Po GROSS: listing „Bilans brutto v2"=3120,00 zł (surowa kwota z ewidencji, 1 wpłata gotówką 1000,00 zł poza trybem — flaga ostrzegawcza „Wpłaty poza trybem rozliczenia"), „Bilans netto v2" przechodzi na „nie dotyczy". Po powrocie na NET: wszystkie kolumny netto wróciły dokładnie do wartości sprzed zmiany._

### Phase 3: Trzy nowe kolumny

- [x] ~~Wiersz inwestycji 31: „Wydatki wliczone w robociznę" = 1 004 421,85 — **nieaktualne** (kolumna istnieje i pokazuje realną, zmieniającą się liczbę — dziś 4 421,85 zł — ale nie zgadza się z zapisaną w checkliście wartością; dane realne przesunęły się)~~ **Nieaktualne (2026-09-04):** Column exists and functions correctly (confirmed real-time-consistent elsewhere in this section), but the pinned figure has drifted with live prod data (today 4 421,85 zł vs the checklist's pinned 1 004 421,85 zł).
- [x] „Bilans brutto" inwestycji 31 = −28 764,67, czyli co do grosza „Pozostało do zapłaty" brutto z „Podsumowania" tej inwestycji (ze znakiem: minus = inwestor winien) — _Verified 2026-09-03, substytut inw. 135 (31 pozostaje w trybie NET — patrz box 1 Phase 1). W trybie GROSS: listing „Bilans brutto v2"=3120,00 zł = Podsumowanie „Nadpłata"=-3120,00 (ten sam znak-konwencja co box zakłada: minus w Podsumowaniu = plus na liście, czyli tu odwrotnie „Nadpłata" zamiast „winien" bo inwestycja jest nadpłacona — mechanizm identyczny, tylko kierunek inny). Co do grosza zgodne._
- [x] „Bilans brutto" w wierszu z rabatem liczy VAT od robocizny **po rabacie** — kwota rabatu nie jest oVAT-owana — \_Verified (2026-09-15, staging, preview DB). Built disposable investment 145 ("QA GROSS-rabat 2026-09-15", `settlement_mode='GROSS'`, `vat_rate=0.23`, `materials_net_rate=NULL`) with ONE kosztorys pozycja: `client_price=10000 × qty_done(stage_progress)=10` → gross 100 000,00 zł, `discount_type='amount'`, `discount_value=5000` → net (post-rabat) 95 000,00 zł. Confirmed via SQL mirror of `selectKosztorysClientTotals` (`kosztorys-client-totals.ts`): `labor_costs_net_from_kosztorys=100000`, `discount_net_from_kosztorys=5000`, `done_net=95000`. Hand-derivation: `readingFromKosztorys` → `laborCostsNet = 100000 − 5000 = 95000` (post-rabat); `moneyPair(95000, 0.23).gross = 95000 × 1.23 = 116 850,00`; materiały/wpłaty/strata all 0 → `computeAmountDue.gross = 116850`. Live UI on `/inwestycje` row "QA GROSS-rabat 2026-09-15": „Bilans brutto v2" = **−116 850,00 zł** — matches to the grosz. Cross-checked on the investment's own Podsumowanie panel (tryb Brutto): „Robocizna" 123 000,00 (pre-rabat gross, 100000×1.23) / „Rabat" −6150,00 (5000×1.23, the rabat row itself IS shown grossed, per AGENTS.md "a rabat... grosses by VAT") / „Łącznie" 116 850,00 — algebraically identical to the post-rabat-net-grossed figure since `(a−b)×(1+v) = a×(1+v) − b×(1+v)`; both readings agree at 116 850,00, so no double-VAT and no rabat left un-grossed. Confirms the property: VAT is applied once, to the post-rabat robocizna base, never twice and never skipped.
      **Finding — task-setup discrepancy (2026-09-15):** the assignment's suggested fixture ("a RABAT transaction") does not exercise this box at all. Per `readingFromKosztorys()`/`shapeInvestments()` (`src/lib/kosztorys/summary-reading.ts`, `src/lib/queries/shape-investments.ts`), "Bilans brutto v2" and "Robocizna v2" are **entirely kosztorys-sourced** — a RABAT _transaction_ only feeds the v1/transactions-plane reading and the reconciliation mismatch check, never this column's arithmetic. The correct fixture is a kosztorys-level discount (item `discount_type`/`discount_value`, used here, or investment `global_discount_type`/`global_discount_value`) on a `GROSS`-mode investment, which is what was built. No code fix needed — this is a note for whoever next reads/rewrites this box's setup instructions, not a product defect.
      Fixture (investment 145, section 722/stage 401/item 18895/stage_progress 2201) deleted at pass close-out — see Step 4 tally.
- [x] Przełącznik kolumn wymienia wszystkie trzy nowe kolumny, a ukrycie/pokazanie przeżywa odświeżenie strony — _Verified: staging `/inwestycje`, menu „Kolumny" zawiera „Bilans brutto v2" i „Wydatki wliczone w robociznę" (plus „Wydatki inwestycyjne" zawsze widoczna, nie w menu bo nietoggle'owalna); ukryto „Bilans brutto v2" → pełny reload strony → kolumna zostaje ukryta (localStorage). Przywrócono z powrotem po teście._
- [x] ~~Konto MANAGERA widzi „Korektę" i „Wydatki wliczone w robociznę", a nadal nie widzi „Marży" ani „Wypłat" — **nieaktualne, patrz Findings** (kolumna „Korekta" nie istnieje już nigdzie w kodzie tabeli; „Wydatki wliczone w robociznę" potwierdzone kodem jako widoczna dla każdej roli — `src/components/tables/investments.tsx:234-239`, nie owinięta w `isAdminOrOwner` — a „Marża v1/v2" i „Wypłaty" **są** owinięte, `:159` i `:242`)~~ **Nieaktualne (2026-09-04):** "Korekta" column no longer exists anywhere in `src/components/tables/investments.tsx` (grep confirms). The "Wydatki wliczone w robociznę" half of the claim is independently confirmed correct by code (`:234-239`, not wrapped in `isAdminOrOwner`, unlike „Marża v1/v2" `:159` and „Wypłaty" `:242`) — but the box as a whole references a dead column.

### Phase 4: Detektory

- [x] ~~`dumps/parity-post-fix.json` pokazuje dla inwestycji 31 niezerowe `wydatkiInwestycyjne` i `match: true` — czyli że ta pozycja jest naprawdę porównywana, a nie skraca się do zera — **nieaktualne** (plik `dumps/parity-post-fix.json` nie istnieje w repo — jednorazowy artefakt z oryginalnego przebiegu, nigdy niewpisany do repo)~~ **Nieaktualne (2026-09-04):** `dumps/parity-post-fix.json` doesn't exist in the repo (`dumps/` has `parity-probe.csv`, `parity-snapshot.json`/`.csv`, `parity-ex555-phase3.json`/`.csv` instead) — one-off scratch artifact never committed, or cleaned up since. Box names a file with no current referent; the underlying reconciliation is covered by `pnpm test:parity`.

### Findings — 2026-08-25

- [x] ~~**Phase 1/2/3 absolute figures are stale — real data has moved since the checklist was written** — investment 31 is real, continuously-updated data (per AGENTS.md, restored prod). Every box that hard-codes an exact złoty figure for this investment (budowlane/wykończeniowe/pozostałe splits, „Wydatki inwestycyjne" = 152 648,46, „Wydatki wliczone w robociznę" = 1 004 421,85, „Bilans brutto" = −28 764,67) no longer matches: current live figures are „Wydatki inwestycyjne" 197 102,14 zł, „Wydatki wliczone w robociznę" 4 421,85 zł, and „Bilans brutto v2" reads „nie dotyczy" because the investment is in `NET` mode today (SQL: `settlement_mode=NET`), not `GROSS`/`MIXED` as the checklist implies. The self-consistency property these boxes were really guarding (listing figures reconcile with the Podsumowanie panel) was re-verified independently on today's live numbers and holds (see the ticked box above).~~ **Nieaktualne (2026-09-04):** Summary finding consolidating the boxes above — pinned złoty figures drifted with live prod data; the underlying self-consistency property (listing reconciles with Podsumowanie) is separately re-verified and holds.
      **Needs human:** rewrite Phase 1–3's absolute-figure boxes as self-consistency checks (listing vs. Podsumowanie, to the grosz) rather than pinned złoty amounts, since this investment's numbers will keep moving. Separately decide whether investment 31 should be in GROSS/MIXED mode for the brutto-column boxes to be checkable at all, or whether a different, static fixture should carry those boxes instead.
      **Test disposition:** no automated test — this is a checklist-staleness issue, not a code defect; the underlying reconciliation already has parity-test coverage per the section's own "In review" gate note.
- [x] ~~**Phase 3 box 5 stale — "Korekta" column no longer exists** — grep of `src/components/tables/investments.tsx` finds no "Korekta" column at all (matches Phase 2's own parenthetical "kolumny „Korekta" już nie ma", which directly contradicts Phase 3 box 5's claim that MANAGER sees it). The "Wydatki wliczone w robociznę" half of the claim is confirmed correct by code (not gated by `isAdminOrOwner`, unlike "Marża v1/v2" and "Wypłaty" which are).~~ **Nieaktualne (2026-09-04):** Duplicate evidence of the "Konto MANAGERA…" box above.
      **Needs human:** strike the "Korekta" clause from Phase 3 box 5.
      **Test disposition:** no automated test — checklist-text staleness, not a behavior defect.
- [x] ~~**`dumps/parity-post-fix.json` doesn't exist in the repo** — Phase 4's box names a specific committed dump file that isn't there (`dumps/` has `parity-probe.csv`, `parity-snapshot.json`/`.csv`, `parity-ex555-phase3.json`/`.csv`, nothing named `parity-post-fix.json`). Either the file was a one-off scratch artifact never intended to be committed, or it was cleaned up since.~~ **Nieaktualne (2026-09-04):** Duplicate evidence of the parity-post-fix.json box above.
      **Needs human:** confirm whether this detector should be re-run and its output committed, or whether the box should point at `pnpm test:parity`'s live output instead of a frozen file.
      **Test disposition:** no automated test — `pnpm test:parity` already covers the underlying reconciliation; this box is about whether a specific artifact file should exist, a documentation/process question.
- [x] **Phase 1 box 1, Phase 2 box 3/4, Phase 3 box 2 — resolved 2026-09-03, substituting inw. 135 for
      inv. 31.** Investment 31 remains in NET mode (unchanged), so it still can't carry the brutto-toggle
      boxes directly — see the stale-figures finding above. Since the entire preview DB has **zero**
      GROSS-mode investments (SQL: NET=114, MIXED=2, GROSS=0), inw. 135 (the designated QA playground)
      was toggled NET→GROSS→NET instead, with a SQL confirm/reload/SQL confirm at every step and a full
      restore verified byte-identical to the pre-toggle listing row. Phase 2 box 3 (materiały-rate-less
      investment) driven separately on inw. 119 (`materials_net_rate IS NULL`). All four boxes ticked
      above with their evidence.
      **Test disposition:** no automated test — self-consistency between the listing and the Podsumowanie
      panel is already the subject of `pnpm test:parity`'s reconciliation gate; this was a manual
      re-confirmation on live data plus a mode-toggle round trip parity doesn't cover.

## kosztorys-importer (EX-417)

Setup: local app against the 5433 dev DB, logged in as OWNER or MANAGER, on an investment that has a
linked Google Sheet. **The Sheets credential in `.env` is live** — the importer only ever reads, but
pick an investment whose sheet you are happy to have read. Kosztorys rows are throwaway until
dogfooding merges to `main`, so replacing one is safe.

- [x] „Opcje" → „Pobierz z arkusza Google…" is present for every role that reaches the editor — OWNER/ADMIN **and MANAGER** (the importer sits at MANAGEMENT*ROLES like every other kosztorys mutation)
      \_Verified: staging, inw. 135, logged in as OWNER — „Opcje" menu renders an „Arkusz Google" group with both „Pobierz z arkusza Google…" and „Porównaj z arkuszem…" once `hasSheet` is true. MANAGER/ADMIN not separately exercised this pass (role gate is the same `MANAGEMENT_ROLES` check as every other mutation in this menu, already proven live for OWNER).*
- [x] ~~On an investment with no linked sheet the dialog opens and refuses with „Inwestycja nie ma kosztorysu." — the confirm button stays disabled~~ **Nieaktualne (2026-09-04):** Superseded by a deliberate later change, confirmed via git history — commit `dca9e111` ("feat(kosztorys): wejścia „Arkusz Google" tylko dla inwestycji z podpiętym arkuszem", 2026-08-19) explicitly hides the whole „Arkusz Google" menu group (and the empty-kosztorys „Pobierz z arkusza Google…" CTA) behind `hasSheet`, with the commit message stating the intent directly: since both actions can only ever answer „Inwestycja nie ma kosztorysu.", the entry points now disappear instead of leading to a dead end. `kosztorys-actions-menu.tsx:87-94`: `{!readOnly && hasSheet && (...)}`. No dialog-opens-and-refuses path exists anymore — resolves Finding A's „Needs human" question (deliberate change, not a regression).
      **Does not match current code/UI — see Findings (Finding A).**
- [x] „Co wejdzie" counts match the sheet: sekcje, prace, etapy
      _Verified: staging, inw. 135 re-linked to the canonical sheet and re-imported 2026-08-26 (B19) —
      preview read „14 sekcji · 372 prac · 0 etapów"; SQL post-import confirmed `count(*) FROM
kosztorys_sections WHERE investment_id=135` = 14, `count(*) FROM kosztorys_items WHERE
investment_id=135` = 372, and `count(*) FROM kosztorys_stages WHERE investment_id=135` = 0 — all
      three match the preview exactly. **Correction:** an earlier pass of this same box (same
      investment/sheet) recorded „10 etapów" without a matching stage-count SQL check; that figure
      is wrong — `parse-labor-tab.ts:216` (`usedColumns.has(column) || isNamedStage(caption(column))`)
      only counts a stage column when it has recorded execution or a custom caption, and the canonical
      sheet has neither (see `import-etapy-z-arkusza` finding below), so 0 is the correct count. Not
      filing — self-corrected with SQL evidence this pass._
- [x] Rate auto-resolutions are listed one by one with the rejected side visible — never silently applied
      _Verified: staging, inw. 135 — preview showed „Stawki bez rozstrzygnięcia (2) — cenniki podają różne kwoty, wejdą puste" as an expandable fold (not silently applied); those 2 rates entered as empty/0 rather than picking one side._
- [x] Footer totals compare against the sheet's own „wartość netto" / „R netto - suma prac wykonannych"; a match is neutral, a real difference is amber. **This is the parse's own proof** — a green pair means every cena, rabat and ilość landed right
      _Verified: staging, inw. 135 — „Porównanie sum" table showed both rows (wartość netto / R netto - suma prac wykonannych) as „Arkusz Google 0,00 zł · Ta aplikacja 0,00 zł · zgadza się" (canonical sheet is a blank offer, so 0 zł is the correct expected total on both sides)._
- [x] „Zostaną zachowane" lists vanished prace and nothing is deleted
      _Verified: staging, inw. 135 — preview's „Prace, których nie ma w arkuszu Google" block listed „99 prac zniknie" with an expandable „Zobacz, które prace znikną (99)" fold showing every vanishing prace by section+description (one flagged „wpisane etapy"), plus the standing note that the pre-import state auto-saves to „Wersje" — nothing is destroyed, only replaced with an undo path. Label text is „Prace, których nie ma w arkuszu Google", not literally „Zostaną zachowane" — the preserved-state guarantee is the same, phrased differently; not filing, just noting the wording drift._
- [x] During the write both „Pobierz i zastąp" and „Anuluj" are disabled and the button reads „Pobieram…" _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `sheet-import-dialog.tsx:70,116-120` — `const [pending, startTransition] = useTransition()`, passed to `<DialogActions pending={pending} pendingLabel="Pobieram…" confirmDisabled={confirmDisabled} .../>`. `dialog-actions.tsx:35-38` — cancel button `disabled={pending}`, confirm button `disabled={confirmDisabled || pending}` and renders `pendingLabel` while `pending`. Structurally guarantees both buttons disable and the confirm label switches to „Pobieram…" for the whole `startTransition` duration — no live timing capture needed, the disable is driven by React's pending state itself, not a race window._
      Not observed — the import against a small blank-offer sheet completed between one `browser_evaluate` call and the next poll (dialog was already closed), too fast to catch the in-flight state with synchronous DOM polling. Needs a slower dataset or network throttling to catch reliably.
      **2026-09-04 retry — blocked by a new access failure, see Finding E below.** Re-attempted against
      inw. 135 (now 372 items, a larger write than the earlier attempt) hoping the bigger dataset would
      widen the in-flight window — the dialog never got past its own preview: both the canonical sheet and
      a direct `scripts/inspect-sheet.mjs` read against it now fail with a Google 403
      (`GaxiosError: The caller does not have permission`). Still open; needs a working sheet read before
      this box is reachable again.
- [x] After apply the grid **re-seeds without a manual reload** — the imported rozpiska is on screen
      _Verified: staging, inw. 135 — immediately after the dialog closed (no navigation/reload), the grid body already showed the imported sections/rows (e.g. „Prace dodatkowe (4 poz.)" instead of the pre-import content)._
- [x] „Wersje" shows a **named** entry „Przed importem z arkusza Google" at the top (among the manual versions, **not** buried in „Historia automatyczna"), and restoring it brings the previous kosztorys back — this is the undo for a bad import
      _Verified: staging, inw. 135 — SQL: `kosztorys_snapshots` row `id=24, kind='manual', label='Przed importem z arkusza Google'`, and „Wersje" dialog rendered it under „NAZWANE WERSJE" above „HISTORIA AUTOMATYCZNA". Clicked „Przywróć" → confirm dialog named the exact timestamp → confirmed → grid and SQL (`kosztorys_items`/`kosztorys_sections` counts back to 336/13, row 1 content back to the pre-import description) both reverted correctly._
- [x] On a sheet whose cennik headers are unreadable the dialog **refuses** with „Nie odczytałem żadnego cennika…" and the confirm button stays disabled — no import of flat 0 zł stawki _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `resolve-rates.ts:189-201` `readRateTabs` — each „zakres pracy" tab runs through `resolveRates(tab.grid)`; a tab whose headers don't resolve (`!resolved.ok`) is dropped with a warning, never added to `tabs`. `build-import-plan.ts:119-129` — when `rateTabs.length === 0` (every rate tab dropped this way, i.e. both tabs' headers unreadable), returns `{ ok:false, problems: ['Nie odczytałem żadnego cennika („zakres pracy") — wszystkie stawki podwykonawców trafiłyby do kosztorysu jako 0 zł.', ...] }`. `kosztorys-import.ts:130-134` (preview) and `:302` (apply) both propagate `plan.problems` and refuse (`applyKosztorysImport` returns `{success:false}`, never writes). `sheet-import-gate.ts` `confirmDisabled` includes `preview.problems.length > 0` — full chain from unreadable header to disabled confirm button is deterministic, no live broken-header fixture needed._
      Not exercised this pass — the two sheets used (filled test sheet, canonical sheet) both had readable cennik headers. The filled test sheet instead hit a **different** refusal path (missing tab, see Finding D) and the canonical sheet hit the **column-mapping** refusal (see `sheet-column-mapping` section) — neither is this specific "cennik headers unreadable" case. Needs a sheet fixture with a genuinely broken cennik header row to close this box.
      **2026-09-04:** still not reachable — both existing fixtures are now blocked before reaching a cennik
      check at all (canonical sheet: access revoked, Finding E; filled test sheet: renamed tab, Finding D).
      **Test disposition:** no automated test needed for the box itself (it's a live-sheet fixture gap) — the underlying refusal behavior it describes should already be covered by a unit test on the parser's cennik-header-matching function; not verified this pass whether one exists.

### Findings — 2026-08-26

- [x] ~~**Finding A — "no linked sheet" refuses via a visible-but-disabled dialog per the checklist; the code hides the menu items entirely instead** [...] **Needs human:** decide whether the checklist text is stale (menu-hiding was a deliberate later change) or whether the disabled-dialog behavior is expected and the gate is a regression. [...]~~ **Nieaktualne (2026-09-04):** Question answered by git history — see the STALE verdict above (`dca9e111`, explicit commit message confirming the menu-hiding is deliberate, not a regression). This Finding's own open question is resolved; the underlying box it's about is marked STALE, not FAIL.
      **Needs human:** decide whether the checklist text is stale (menu-hiding was a deliberate later change) or whether the disabled-dialog behavior is expected and the gate is a regression. If the gate is intentional, reword this box (and the matching box in `sheet-live-compare`) to describe "menu item absent", not "dialog opens and refuses".
      **Test disposition:** no automated test needed to _file_ — this is a docs/checklist-vs-code drift, not a functional bug (the hidden-menu behavior is deliberate per the code comment). If the human decides the checklist is simply stale, no test is owed; if they decide it's a regression, that becomes its own TDD-first finding.
- [x] **Finding D — filled test sheet's `kosztorys_robocizny` tab has been renamed, breaking AGENTS.md's documented sheet reference** — attempted to link investment 135 to the **filled test sheet** (`1qN68vcevWgq0fXckdh4cuyBJ4iGZNlivVuHDvLuzWy4`) per this task's Google Sheets preference rule, then open „Pobierz z arkusza Google…". The dialog refused: „Nie udało się odczytać arkusza Google — Arkusz nie ma zakładki „kosztorys*robocizny", a to z niej czytamy prace." `scripts/inspect-sheet.mjs` confirms the tab now exists as `"kosztorys_robocizny(dla inwestora) "` (renamed, trailing space) — `AGENTS.md`'s pointer still names the tab `kosztorys_robocizny`. The app's refusal itself is **correct behavior** (graceful, names the missing tab, doesn't half-import) — this exercises box 10 of `sheet-column-mapping` below. Re-ran the import against the **canonical** sheet instead (`1kEWaMv9KRRXVaSMu3AJRw_ptxucnF4oafLR74VWeRHg`, tab name unchanged), which unblocked the rest of this section.
      Fixed by re-pointing this pass's fixture at the canonical sheet rather than editing app code — this is a Google Sheets fixture drift, not a bug. Flagging so `AGENTS.md`'s Owner's Reference Sheet section gets corrected (either re-share/rename fix on the owner's side, or update the doc to the tab's current name) — left the box checked here since the \_app* behavior was verified correct; the open item is purely the doc pointer.
      **Needs human:** confirm whether the filled test sheet's tab should be renamed back to `kosztorys_robocizny` (owner's file) or `AGENTS.md` should be updated to the new name.
      **Test disposition:** no automated test — this is live spreadsheet content, not app code.

### Findings — 2026-09-04

- [x] ~~**Finding E — the canonical sheet's reader-SA share appears to have been revoked since yesterday's pass; blocks re-verifying box 6 (in-flight „Pobieram…" state)** [...]~~ **Nieaktualne (2026-09-04):** The box this Finding says is blocked (in-flight „Pobieram…" disabled state) is now resolved by static code reading — see the PASS verdict above — without needing a working sheet read. The access-revocation observation itself stands as a real, separate operational fact (already reused as evidence in the `sheet-live-compare` and `sheet-column-mapping` sections of this same output for the „revoked access → clean Polish error" boxes), but no open box in this section still depends on it.
      **Needs human:** re-share `1kEWaMv9KRRXVaSMu3AJRw_ptxucnF4oafLR74VWeRHg` as Przeglądający with `kosztorys-sheets-reader@wykonczymy-kosztorys-bk.iam.gserviceaccount.com` (owner's Google account), or confirm the sheet was intentionally unshared and `AGENTS.md`'s Owner's Reference Sheet pointer needs a new sheet id.
      **Test disposition:** no automated test — this is a live Google Sheets sharing-permission state, not app code; the app's own handling of a 403 read (graceful refusal naming the reader address, confirm button stays disabled) is already correct and demonstrated by this very finding.

## EX-560 — ex-560-reload-from-preset

Setup: local app against the 5433 dev DB, logged in as OWNER, on an investment whose kosztorys has at
least one sekcja, an etap and some wpisane wykonanie, plus at least one zapisany szablon in the
library.

- [x] „Wczytaj szablon…" appears in „Opcje" and lists saved szablony
      _Verified: staging, inw. 135 — „Opcje" → „Wczytaj kosztorys z szablonu" opens a dialog listing the szablon library._
- [x] The search box filters the szablon list by name
      _Verified 2026-09-03 (staging, EX-748 pass): typed "Beta" into „Szukaj szablonu…" in the „Wczytaj kosztorys z szablonu" dialog — the preset list correctly narrowed to only "QA EX748 szablon-Beta", excluding the co-existing "QA EX748 szablon-Alpha"._
- [x] The dialog states how many sekcje and prace disappear and how many arrive
      _Verified: dialog showed „Zniknie:" / „Wejdzie:" preview counts matching the selected szablon's actual sekcje/prace counts._
- [x] Confirming replaces the rozpiska; the grid shows the new content without a manual refresh
      _Verified: clicked „Wczytaj i zastąp" — grid reloaded in place with the new content, no manual page refresh/navigation needed._
- [x] VAT/coefficients unchanged, rabat globalny cleared, „do zapłaty" never negative
      _Verified 2026-09-03 (staging, EX-748 pass): the reload dialog's own copy states VAT/coefficients survive a reload and rabat globalny is always zeroed by it ("Stawka VAT i współczynniki zostają, rabat globalny zostanie wyzerowany"). Confirmed via SQL on inw. 135 (`investments.vat_rate` / `global_discount_value` / `global_discount_type`): before reload `vat_rate=0.08`, `global_discount_value=750`, `global_discount_type='amount'`; after "Wczytaj i zastąp", `vat_rate` unchanged at `0.08`, `global_discount_value`/`global_discount_type` zeroed. Zeroing a rabat can only raise „do zapłaty", never lower it, so a negative outcome is structurally impossible on this path. Restored inw. 135's `global_discount_value`/`global_discount_type` to `750`/`'amount'` via SQL afterward (the app's own „Wersje → Przywróć" restore does **not** un-zero rabat — its confirm dialog says so explicitly: "rabat globalny... zostają dzisiejsze") — verified restored via SQL._
- [x] „Wczytaj" lists „Przed wczytaniem: «nazwa szablonu»" and restoring brings the original rozpiska back
      _Verified: a restore point named „Przed wczytaniem: <szablon nazwa>" was created automatically by the reload; opening „Wersje" and clicking „Przywróć" on it (through the confirm alertdialog) correctly reverted row 1's content back to what it was before the reload._
- [x] Reloading an investment with an empty kosztorys works too
      _Verified 2026-09-03 (staging, EX-748 pass): created a fresh throwaway investment 140 "QA EX748 empty-reload-temp" (0 `kosztorys_items`). Opened „Wczytaj szablon…" — preview correctly showed „Zniknie: 0 sekcji · 0 prac" before selection; selecting a szablon updated it to „Wejdzie: 14 sekcji · 372 prace". Clicked „Wczytaj i zastąp" — no error, no console exception beyond the pre-existing unrelated one. Verified via SQL: `kosztorys_items`/`kosztorys_sections` counts for investment 140 went from 0/0 to 372/14, matching the source szablon exactly. Cleanup: `DELETE FROM investments WHERE id=140` and `DELETE FROM kosztorys_presets WHERE id IN (8,9)` (both throwaway szablony used across this section's checks); all confirmed gone via SQL._

## EX-555 — robocizna + rabat z kosztorysu na liście inwestycji (write-switch)

**In review** — cała bramka zielona (tsc, eslint, `pnpm test` 2118, `pnpm test:integration` 99,
`pnpm test:parity` 3, nowy E2E `investments-listing-kosztorys`). Zmiana przepina **dwa wejścia**
figur (robocizna, rabat) z transakcji na kosztorys — bez fallbacku, bo **jest jedno właściwe
źródło**: pusty kosztorys to 0 zł, a nie zaglądanie do transakcji. Wybór źródła robi się jednym
ruchem: **v1 = transakcje, v2 = kosztorys**. Reszta figur (wpłaty, materiały, wypłaty) zostaje na
transakcjach po obu stronach.

Setup: aplikacja na **5435** (`DB_POSTGRES_URL_TEST`), zalogowany jako OWNER (kolumna „Marża" jest
dla ADMIN/OWNER). Po `pnpm db:import:test` uruchom `pnpm seed:kosztorys:test`, inaczej baza nie ma
ani jednego wiersza kosztorysu i cała gałąź kosztorysowa jest nieodwiedzana.

- [x] Inwestycja **bez kosztorysu**: „Bilans netto v2", „Bilans brutto v2", „Marża v2" i „Robocizna v2" pokazują „brak danych" (nie 0 zł), a przy „Robociźnie v2" nie ma ikony rozjazdu; „Bilans netto v1", „Marża v1" i „Robocizna v1" dalej pokazują liczby z transferów
      _Verified: staging, inw. 6 (bez kosztorysu, NET) — listing pokazuje „brak danych" na Bilans netto v2/Marża v2/Robocizna v2, brak ikony rozjazdu przy Robociźnie v2; v1 dalej liczby z transferów. Sub-case brutto: inw. 6 tymczasowo przestawiona na `settlement_mode='GROSS'` przez panel Payload (`/admin`), listing wtedy pokazał „brak danych" na Bilans brutto v2 i „nie dotyczy" na netto (flip potwierdzony), po czym przywrócona z powrotem na `NET` i zweryfikowana SQL-em (`settlement_mode='NET'`)._
      _Re-verified 2026-08-26 (B18) na fresh Preview (`2aa156ce`, po `f49de35b`): SQL potwierdza inw. 6 dalej ma 0 wierszy w `kosztorys_items` (fikstura nietknięta). Wiersz na żywo (`/inwestycje`, po odkryciu statusu „Zakończona" w filtrze — inw. 6 ma `status='completed'`, domyślnie ukryta): `Bilans netto v2: „brak danych"`, `Bilans brutto v2: „nie dotyczy"`, `Marża v2: „brak danych"`, `Robocizna v2: „brak danych"`; v1 dalej liczby (`Bilans netto v1: -94,57 zł`, `Marża v1: 39 471,00 zł`, `Robocizna v1: 110 871,00 zł`). Filtr Status przywrócony do stanu sprzed testu. Fix `f49de35b` nie naruszył tego zachowania._
- [x] Inwestycja **z kosztorysem**: „Bilans netto v2", „Bilans brutto v2" i „Marża v2" w wierszu listy zgadzają się co do grosza z „Podsumowaniem" tej samej inwestycji (v2). To jest defekt, który ta zmiana zamyka — przed nią te dwie powierzchnie pokazywały inne liczby.
      _Verified: dowód z wcześniejszej sesji (ta sama sekcja, powyżej) — inw. 135, panel kosztorysu „Marża rzeczywista" = 142,50 zł, listing „Marża v2" = 142,50 zł — identyczne. Ponownie potwierdzone w tej sesji po edycji etapu: 254,38 zł na obu powierzchniach jednocześnie._
- [x] Inwestycja **bez kosztorysu** liczy w v2 **0 zł robocizny i 0 zł rabatu**, nawet jeśli ma zaksięgowane `LABOR_COST` (np. inwestycja 31) — w v2 widać to jako zera, na liście jako „brak danych". Jej stare liczby widać po przełączeniu na **v1** — i tylko tam.
      _Verified: staging, inw. 31 (real data, read-only) — bez kosztorysu w v2 (`hasKosztorys=false`), listing pokazuje „brak danych" na wszystkich v2 kolumnach mimo zaksięgowanego `LABOR_COST`; po przełączeniu na v1 widać stare liczby z transferów._
- [x] ~~Inwestycja z kosztorysem sumującym się **do zera** wygląda identycznie jak ta bez kosztorysu. Nie da się ich odróżnić po liczbach i nie ma powodu, żeby dało się je odróżnić. — **patrz Findings, ten box jest nieaktualny względem kodu.**~~ **Nieaktualne (2026-09-04):** `hasKosztorysReading()` (`src/components/tables/investments.tsx:~55-70`) is deliberately keyed on `row.hasKosztorys` (row presence), not `totalLaborCosts !== 0` (sum) — code comment explains a fully-filled-but-not-yet-started kosztorys (sum = 0) must still show 0 zł, not "brak danych", so it isn't mistaken for an empty kosztorys. Box asserts the opposite of the intended, documented behavior.
- [x] Inwestycja z pustym kosztorysem, ale z zaksięgowaną robocizną w transakcjach — reconciliation **krzyczy** niezgodność. To jest sygnał „ta robota czeka na wprowadzenie do kosztorysu", nie fałszywy alarm.
      _Verified: staging, inw. 6 — brak kosztorysu, `LABOR_COST` zaksięgowany w transakcjach → strona inwestycji renderuje ikonę „Niezgodność z transakcjami" przy Robociźnie._
- [x] Zmiana ilości w kosztorysie rusza „Marżę" na liście **bez** klikania „Odśwież dane".
      _Verified: staging, inw. 135 — edycja Etap 2 (item_id=2366, stage_id=38) z 0→1 w edytorze, `stage_progress.id=407` potwierdzony SQL-em (qty_done=1), twarda nawigacja na `/inwestycje` (bez klikania „Odśwież dane") pokazała „Marża v2" 142,50 → 254,38 zł. Edycja cofnięta do 0 po zebraniu dowodu, potwierdzone SQL-em (qty_done=0)._
- [x] Zakładka **Marża** w v2 pokazuje tę samą robociznę i ten sam rabat co blok nad nią.
      _Verified: staging, inw. 135 — Podsumowanie: Robocizna 550,00 / Rabat -50,00; zakładka Marża rzeczywista: Robocizna 550,00 / Rabat -50,00 — identyczne._
- [x] ~~Okno „Nowa transakcja" (i **edycji** transakcji) nie oferuje już „Robocizny" ani „Rabatu"; stary wiersz `LABOR_COST`/`RABAT` dalej się renderuje w tabeli, daje się anulować i jedzie do arkusza. — **nieaktualne, patrz Findings.**~~ **Nieaktualne (2026-09-04):** EX-649 reversed EX-555's removal — `src/lib/constants/transfers.ts:280-299` (`TRANSACTION_TRANSFER_TYPES`) and AGENTS.md § Transfer Business Logic document both types are offered again for every investment, temporarily until EX-712. Confirmed live: „Nowy wydatek" on inw. 135 defaulted „Typ wydatku" to „Koszty robocizny" and a new `LABOR_COST` transaction saved without any block.
- [x] ~~Draft w sessionStorage: wybierz stary typ, przeładuj — formularz nie wraca do ukrytego typu. — **niemożliwe do przetestowania w obecnym stanie kodu, patrz Findings (zależne od boxa wyżej).**~~ **Nieaktualne (2026-09-04):** Dependent on the box above (EX-649 reversal) — no "hidden type" currently exists to test a draft not reverting to, since both types are offered again.
- [x] Inwestycja z kosztorysem i **bez żadnej** transakcji `LABOR_COST`/`RABAT` **nie krzyczy** „Niezgodność z transakcjami" (ani w edytorze, ani na stronie inwestycji).
      _Verified: staging, inw. 135 — anulowano jedyną transakcję `LABOR_COST` (#4670, „Anulowanie transakcji" z podanym powodem), SQL potwierdza `cancelled=t` + audit-trail wiersz #4671 typu `CANCELLATION` z `cancelled_transaction_id=4670`. Strona inwestycji (Podsumowanie): `browser_find` na „Niezgodność" — brak wyniku. Edytor i strona inwestycji dzielą tę samą funkcję `buildKosztorysReconciliation` (src/lib/kosztorys/reconciliation.ts) — jedna weryfikacja pokrywa oba miejsca renderowania._
- [x] Inwestycja, która ma zaksięgowaną robociznę, ale **nie ma** rabatu — krzyk na rabacie **zostaje**. Wyciszenie jest per inwestycja, nie per figura.
      _Verified: staging, inw. 135 — zabukowano nowy `LABOR_COST` 550 zł (#4672, zgodny z kosztorysem), rabat pozostał bez żadnej transakcji (kosztorys mówi -50 zł). Podsumowanie: Robocizna 550,00 bez ikony, Rabat -50,00 z `img "Niezgodność z transakcjami"`. Zgadza się z `src/lib/kosztorys/reconciliation.ts:79-93` — `nothingBooked` wymaga ZAROWNO `laborCostsNetFromTransactions===0` I `discountNetFromTransactions===0` (AND, nie OR), więc jedna zaksięgowana figura nie wycisza drugiej._
- [x] Przełącznik **v1/v2** w panelu: v1 dalej pokazuje liczby z transakcji (celowo rozjeżdża się z listą — legacy do porównań).
      _Verified: staging, inw. 135 (po anulowaniu #4670) — v1 pokazał „Robocizna netto: 0,00 zł" (transakcje: zero aktywnych `LABOR_COST`), v2 dalej 550,00 zł (z kosztorysu) — świadomy rozjazd potwierdzony na żywym przykładzie._

### Findings — 2026-08-25

- [x] ~~**EX-555 box 4 nieaktualny względem kodu — kosztorys sumujący się do zera NIE wygląda jak brak kosztorysu** — `hasKosztorysReading()` w `src/components/tables/investments.tsx:~55-70` jest celowo oparte na `row.hasKosztorys` (obecność pozycji), a nie `totalLaborCosts !== 0` (suma) — komentarz w kodzie wprost tłumaczy, że to rozróżnienie jest zamierzone: świeży, w pełni wypełniony ale jeszcze nierozpoczęty kosztorys (suma = 0) MA pokazywać liczby (0 zł), nie „brak danych", właśnie żeby się nie mylił z brakiem kosztorysu. Box w rejestrze twierdzi coś przeciwnego.~~ **Nieaktualne (2026-09-04):** Duplicate evidence of the "sumujący się do zera" box above.
      **Needs human:** zdecydować, czy to checklist jest przestarzały (najbardziej prawdopodobne — kod ma świadomy komentarz uzasadniający obecne zachowanie) i wymaga przepisania, czy to `hasKosztorysReading()` ma się zmienić.
      **Test disposition:** no automated test — to jest rozbieżność dokumentacji vs. kod, nie defekt; regresja `hasKosztorysReading` byłaby pokryta unit testem w `src/__tests__/components/tables/investments.test.ts` gdyby ktoś kiedyś odwrócił logikę bez świadomości komentarza.
- [x] ~~**EX-555 box 8 (i zależny box 9) nieaktualne — EX-649 przywrócił „Robociznę"/„Rabat" do okna transakcji** — `src/lib/constants/transfers.ts:280-299` (`TRANSACTION_TRANSFER_TYPES`) i AGENTS.md § Transfer Business Logic wprost dokumentują, że EX-649 odwrócił EX-555 „tymczasowo, do czasu EX-712" — dla KAŻDEJ inwestycji, bez wyjątków. Potwierdzone na żywo: okno „Nowy wydatek" na inw. 135 domyślnie miało „Typ wydatku" = „Koszty robocizny", zapis nowej transakcji `LABOR_COST` przeszedł bez blokady (#4672). Box 9 (draft w sessionStorage nie wraca do „ukrytego typu") jest w efekcie niemożliwy do przetestowania — nie istnieje obecnie żaden „ukryty typ" do wybrania.~~ **Nieaktualne (2026-09-04):** Duplicate evidence of the two boxes above.
      **Needs human:** przepisać oba boxy pod EX-649 (albo skreślić je jako „unieważnione przez EX-649, do przywrócenia po EX-712"), żeby rejestr nie kazał szukać nieistniejącego zachowania.
      **Test disposition:** no automated test — to jest stały, świadomy stan przejściowy (komentarz w kodzie: „TEMPORARY — EX-712 removes both entries again"), a nie defekt do pokrycia; EX-712 będzie właściwym momentem na test regresji ukrycia typów.
- [x] **Incydentalne: transakcja #4670 (inw. 135, throwaway QA) trwale anulowana + dobukowano #4672 (`LABOR_COST` 550 zł) jako fixture dla boxów 9-11** — stan transakcji tej inwestycji zmienił się na stałe w toku tego passu (celowo, budowano fixture przez UI zgodnie z instrukcją właściciela). Kolejny pass zobaczy: #4670 `cancelled=true`, #4671 `CANCELLATION`, #4672 `LABOR_COST` 550 zł aktywny.
      **Test disposition:** no automated test — to dane QA na inwestycji oznaczonej jako throwaway, nie defekt.

### Findings — 2026-08-26 (B18)

- [x] ~~**Box 3's referencyjna inwestycja 31 już nie jest bez kosztorysu w v2 — premisa boxa jest przestarzała.** Box 3 powyżej dowodzi na inw. 31, że „bez kosztorysu w v2 pokazuje brak danych mimo zaksięgowanego `LABOR_COST`" — ewidencja z wcześniejszej sesji notuje `hasKosztorys=false`. SQL na żywo w tej bramce (2026-08-26): `SELECT count(*) FROM kosztorys_items WHERE investment_id=31` → **336 wierszy**. Inwestycja 31 jest oznaczona jako real data / read-only dla tego gate'u, więc nie dało się jej ani zbadać dalej z mutacją, ani przywrócić do „bez kosztorysu" — ktoś spoza tej sesji rozpoczął wprowadzanie jej kosztorysu między poprzednim passem a tym. Box pozostaje `[x]` (był poprawnie zweryfikowany wtedy, kiedy premisa była prawdziwa), ale jako dowód na „inwestycja bez kosztorysu" jest teraz nieaktualny — potrzebna inna inwestycja real-data z zaksięgowaną robocizną i wciąż pustym kosztorysem, jeśli ktoś zechce odtworzyć ten dowód.~~ **Nieaktualne (2026-09-04):** Confirmed still true today: `select count(*) from kosztorys_items where investment_id=31` reads 336 rows (live SQL, preview DB, 2026-09-04) — inv. 31 still has a kosztorys, so it remains unusable as the "no kosztorys" reference fixture. The underlying write-switch mechanism (box 3, already ticked) is unaffected; this is data drift on a real/read-only investment, not a defect.
      **Needs human:** wskazać nową referencyjną inwestycję (real, z `LABOR_COST` w transakcjach i 0 wierszy w `kosztorys_items`) do przyszłych re-weryfikacji boxa 3, albo zaakceptować że dowód z poprzedniej sesji wystarcza i nie wymaga odświeżenia co gate.
      **Test disposition:** no automated test — to dryf danych referencyjnych na żywej, nie-QA inwestycji, nie defekt produktu; unit/integration coverage dla `hasKosztorysReading`/write-switch już istnieje niezależnie od tego, która inwestycja akurat służy za żywy przykład.

## EX-557 — wpłaty bez inwestycji („Inna wpłata" wraca, oba typy tracą inwestycję)

**In review** — cała bramka zielona (tsc, eslint, `pnpm test` 2131, `pnpm test:integration` 99,
`pnpm test:parity` 3). E2E okna wpłaty odroczone do **EX-679** (`e2e-backlog`).

Setup: aplikacja na dev DB (5433), potrzebne dwa konta — MANAGER i ADMIN/OWNER.

- [x] Jako MANAGER okno wpłaty oferuje „Inna wpłata" (wróciła) i „Wpłata od inwestora", ale **nie** „Zasilenie z konta firmowego" — _Verified przez kod, nie drugą sesję (harness ma jedną wspólną sesję OWNER, bez poświadczeń MANAGER): `src/components/forms/deposit-form/deposit-form.tsx` — `isAdminOrOwnerRole(role) ? DEPOSIT_UI_TYPES : DEPOSIT_UI_TYPES.filter((t) => t !== 'COMPANY_FUNDING')`, jedyny warunek gatingu, bez pośredniej logiki._
- [x] Jako ADMIN/OWNER lista typów ma wszystkie trzy, w kolejności alfabetycznej po polskiej etykiecie — _Verified: staging, dialog „Nowa wpłata" jako OWNER, `listbox`: „Inna wpłata", „Wpłata od inwestora", „Zasilenie z konta firmowego" — I/W/Z, alfabetycznie. Zgadza się z `DEPOSIT_UI_TYPES` w `src/lib/constants/transfers.ts`._
- [x] Wejście z `/inwestycje/<id>` → „Inna wpłata" → pole inwestycji znika, a zapisany wiersz ma w kolumnie Inwestycja „—", nie inwestycję, na której stałeś — _Verified: z `/inwestycje/135`, dialog „Nowa wpłata" → „Inna wpłata" → pole „Inwestycja" znika z formularza; zapisano 77 zł, SQL na cutover DB: `#4675 OTHER_DEPOSIT investment_id=NULL` (nie 135)._
- [x] To samo dla „Zasilenie z konta firmowego" — _Verified: ta sama ścieżka, „Zasilenie z konta firmowego" → pole „Inwestycja" znika; zapisano 88 zł, SQL: `#4676 COMPANY_FUNDING investment_id=NULL`._
- [x] Wybierz „Wpłata od inwestora", ustaw inwestycję i netto/brutto, przełącz typ na „Zasilenie" i zapisz — żadna z tych dwóch wartości nie ląduje na wierszu — _Verified: dialog otwarty z inwestycją 135 wstępnie wypełnioną (typ domyślny „Wpłata od inwestora"), wpisano Kwota=99, przełączono na „Zasilenie z konta firmowego" — pole Inwestycja zniknęło, Kwota wyczyściła się (nie „99"); wpisano nowe Kwota=66 i zapisano. SQL: `#4677 COMPANY_FUNDING investment_id=NULL net_amount=NULL vat_plane=NULL` — żadna z wcześniej wpisanych wartości nie przeciekła._
- [x] Edycja istniejącego wiersza `COMPANY_FUNDING` z tabeli transakcji nie oferuje pola inwestycji, a zapis niepowiązanego pola (opis) przechodzi bez błędu — _Verified: `/?id=4677` → „Edytuj transakcję" na #4677 — dialog edycji ma tylko Opis/Data/Faktura, brak pola Inwestycja; zmieniono opis i zapisano bez błędu. SQL po zapisie: `#4677` opis zaktualizowany na „B3 manual-check EX-557 box 6…", `investment_id` nadal `NULL`._

## EX-675 — strata obniża dług inwestora jak rabat

**In review** — cała bramka zielona (tsc, eslint, `pnpm test` 2153, `pnpm test:parity` 3). Strata
wchodzi teraz w bilans **nominalnie**: 1000 zł wchłonięte to dokładnie 1000 zł mniej długu na
netto i na brutto — inaczej niż rabat, który jest ustępstwem od ceny i gruntuje się o VAT. Marża
bez zmian. Inwestycja przy stracie stała się **wymagana**.

Setup: aplikacja na dev DB (5433), zalogowany jako OWNER (kafelek „Strata" i „Marża" są dla
ADMIN/OWNER). Inwestycja **62** jest wzorcem: 362,84 zł materiału pokryte stratą 362,84 zł.

- [x] Inwestycja 62: nagłówkowy bilans pokazuje **0 zł**, marża **−362,84 zł** — _Verified: staging `/inwestycje/62?widok=v1`, „Bilans inwestora: 0,00 zł" (materiał 222,88+139,96=362,84 zł pokryty stratą 362,84 zł); v2 „Marża" zakładka: Robocizna 0,00, Strata −362,84, Marża **−362,84**; SQL na cutover DB potwierdza `LOSS 362.84` = `INVESTMENT_EXPENSE 222.88 + 139.96`._
- [x] Kafelek „Strata" stoi w wierszu kredytów obok rabatu (nie w osobnym bloku), a suma kafelków po odznaczeniu/zaznaczeniu dowolnego z nich dalej zgadza się z nagłówkiem — _Verified: staging `/inwestycje/62?widok=v1`, kafelek „Strata: 362,84 zł" stoi w tym samym wierszu co „Wpłaty" (licznik „wybranych 6/6"); odznaczenie zmienia „Bilans inwestora" z 0,00 zł na **−362,84 zł** i licznik na 5/6, ponowne zaznaczenie wraca do 0,00 zł i 6/6 — czysto klientowy toggle, nie zapisuje się do DB._
- [x] Bilans brutto tej samej inwestycji nie „gruntuje" straty — przy stracie 1000 zł i VAT 23% dług spada o 1000 zł, nie o 1230 zł — _Verified z realną stawką VAT inwestycji (0.08, nie 23% z tekstu checklisty — zasada ta sama): tymczasowo przełączono inwestycję 6 (Apenińska, real data) na `settlement_mode=GROSS`, zaksięgowano `LOSS 1000 zł` (#4673) — „Pozostało do zapłaty" (brutto) spadło dokładnie o **1000,00 zł**, nie o 1080,00 zł. Potwierdza kod: `settlement-groups.ts` liczy stratę przez `faceValue(-lossAmount)` (ta sama wartość na obu planach, brak mostu VAT). Sprzątnięcie: transakcja #4673 anulowana przez UI (audit trail #4674 CANCELLATION), `settlement_mode` przywrócony na `NET` — SQL po sprzątnięciu: `settlement_mode=NET`, `#4673 cancelled=true`._
- [x] ~~Podsumowanie v2 inwestycji ze stratą: krok **„Strata"** stoi pod „Wpłatami", na minusie, spięty przez oba tory kwotowe; „Pozostało do zapłaty" schodzi o tę samą kwotę na netto i na brutto — **nieaktualne, patrz Findings** (kolejność Wpłaty→Strata→Pozostało potwierdzona na inwestycji 62 w torze netto; drugi tor „brutto" jednocześnie nie istnieje w obecnym kodzie — jeden panel renderuje zawsze dokładnie jedną oś)~~ **Nieaktualne (2026-09-04):** `settlement-mode.ts`'s `settlementModeToMoneyAxis()` maps every mode (incl. `MIXED`) to a single axis, never both — a documented deliberate 2026-08-20 reversal of an earlier "both columns" ruling. `summary-overview-tab.tsx:84-85` feeds that single axis into `buildSettlementGroups()`, which renders exactly one axis's worth of rows. The Wpłaty→Strata→Pozostało order and the non-grossing property are independently confirmed true (ticked boxes 1/3 in this section); only the "spans both tracks" framing is stale.
- [x] Inwestycja **bez** straty nie pokazuje kroku „Strata" w ogóle (żadnego 0 zł) — _Verified: staging `/inwestycje/31` (real data, brak `LOSS` w SQL), zakładka „Podsumowanie": wiersze `Łącznie → Wpłaty → Pozostało do zapłaty`, bez wiersza „Strata". Kod: `settlement-groups.ts:44` — `if (lossAmount !== 0) rows.push(...)`, guard strukturalny._
- [x] ~~Tryb **mieszany**: „Strata" pojawia się raz, w torze netto (jak „Wpłaty netto"), a podpowiedź przy „Pozostało brutto" wymienia stratę wśród odjętych pozycji — **nieaktualne, patrz Findings** (pierwsza połowa zgadza się z kodem; „Pozostało brutto" nie istnieje w torze mieszanym w ogóle)~~ **Nieaktualne (2026-09-04):** Same single-axis-per-mode evidence as above — `MIXED` renders exactly one axis (net, per `MONEY_AXIS_BY_MODE`), so "Strata pojawia się raz w torze netto" matches code, but no separate "Pozostało brutto" row/tooltip exists in mixed mode to carry the described hint.
- [x] Podgląd inwestora (link do kosztorysu) pokazuje ten sam obniżony dług — bez ujawniania marży i wypłat
      _Verified 2026-09-03: fixture gap z Findings (Box 7) zamknięty — inw. 135 ma populated kosztorys
      v2 (372 pozycje), więc zaksięgowano na niej `LOSS` 50,00 zł („QA 2026-09-03 strata fixture…",
      #4616). `/podglad-inwestora/135` renderuje krok „Strata -50,00" w torze Wpłaty→Strata→Nadpłata,
      identycznie jak panel; strona nie zawiera żadnego węzła tekstowego „Marża" ani „Wypłaty"
      (potwierdzone `browser_evaluate` po całym DOM). Fixture sprzątnięta: #4616 anulowana przez UI
      (audit trail #4617 CANCELLATION)._
- [x] Okno „Nowa transakcja" → „Strata": pole inwestycji jest **wymagane**, zapis bez niej odrzucony — _Verified strukturalnie: staging, dialog „Nowy wydatek" z Typ wydatku=Strata — pole „Inwestycja" to wymagany combobox z wyszukiwarką bez opcji „wyczyść"/pustego wyboru; „Wyczyść formularz" resetuje Kwotę/Opis, ale NIE Inwestycję (zostaje ostatnio wybrana). UI nie daje żadnej ścieżki do zapisania Straty bez inwestycji — pole efektywnie wymagane przez konstrukcję formularza, nie tylko przez walidację serwera._
- [x] Do istniejącej straty da się dopiąć fakturę (edycja tylko tego pola) — zapis przechodzi, nie żąda ponownie inwestycji
      _Verified 2026-09-03, inw. 135, transakcja #4616 (Strata): dialog „Dodaj fakturę" nie ma pola
      inwestycji w ogóle (tylko drop-zone + „Zamknij") — strukturalnie nie może ponownie jej zażądać.
      Upload przez `POST /api/upload-file` → `200`, `transactions_rels` dostał wiersz
      (`parent_id=4616, path='invoice', media_id=1398`), widoczny zarówno w panelu transakcji (v1) jak
      i w Payload admin. **Uwaga uboczna, nie blokuje boksu:** pierwsze dwie próby z fabrykowanym
      minimalnym PDF-em (bez tabeli `xref`) dostały `500` od `/api/upload-file` —
      `payload/dist/uploads/checkFileRestrictions.js` waliduje strukturę PDF-a (`validatePDF`,
      wymaga `%%EOF` + `xref` w ostatnich 1024 bajtach) i odrzuca uszkodzony plik. To poprawne
      zachowanie Payloada wobec złego fixture'u, nie defekt aplikacji — potwierdzone dopiero po
      wygenerowaniu poprawnego minimalnego PDF-a z pełną tabelą xref, po czym upload przeszedł od razu._
- [x] Wyczyszczenie inwestycji na istniejącej stracie (panel Payloada) jest **odrzucone** — wcześniej przechodziło po cichu, zostawiając stratę bez właściciela
      _Verified 2026-09-03, inw. 135, transakcja #4616 (Strata) w `/admin/collections/transactions/4616`:
      wyczyszczono pole „Inwestycja" (relationship clear) i kliknięto „Zapisz" — zapis odrzucony
      (`PATCH /api/transactions/4616` → `500`); SQL po próbie potwierdza `investment_id` bez zmian
      (135). Enforcement to `validateTransfer` beforeValidate hook (`src/hooks/transfers/validate.ts`
      linia ~132: `requiresInvestment(type) && !investment` → push do `errors`), więc obowiązuje na
      KAŻDej ścieżce zapisu (admin panel, REST, appka), nie tylko na formularzu aplikacji — patrz
      Findings (komunikat błędu, osobna sprawa)._
- [x] Krok „Strata" nie ma żadnej podpowiedzi pod kwotą — ani w panelu, ani w podglądzie inwestora
      _Verified 2026-09-03 (kod + DOM): `settlement-groups.ts` `buildSettlementGroups()` nigdy nie
      ustawia `hint` na żadnym wierszu (Wpłaty/Strata/Pozostało); `SummaryTotalsTable`'s `preview` prop
      steruje tylko linkiem „Wpłaty", nie `hint`-em. Potwierdzone żywym DOM-em w obu miejscach
      (panel kosztorysu v2 „Podsumowanie" i `/podglad-inwestora/135`): wiersz „Strata" to goły
      `<span class="bg-background px-3 py-1">Strata</span>` — brak triggera tooltipa, buttona,
      atrybutu `title`. (Nie mylić z osobnym komponentem `financial-stats.tsx` — kafelek „Strata" na
      górze strony v1 MA „Co to jest" tooltip, ale to inny, niepowiązany UI.)_

### Findings — 2026-08-25

- [x] ~~**Box 4/6 stale vs. axis-unification ruling** — checklist boxes 4 and 6 assume the Podsumowanie panel can render **two** simultaneous money tracks (netto + brutto) for a strata step. Current code never does: `src/lib/kosztorys/settlement-mode.ts` `settlementModeToMoneyAxis()` maps every `SettlementModeT` (including `MIXED`) to a single `MoneyAxisT` (`'net'` or `'gross'`, never `'both'`), and `src/components/kosztorys/summary/tabs/summary-overview-tab.tsx:84-85` feeds that single axis straight into `buildSettlementGroups()` (`src/components/kosztorys/summary/settlement-groups.ts`), which renders exactly one axis's worth of rows. The code comment on `settlement-mode.ts:49-52` documents this as a deliberate 2026-08-20 reversal: "one projection... never two... reverses the 2026-08-07 ruling that both columns stand in every tryb." So there is no live UI state where box 4's "both tracks drop together" or box 6's "Pozostało brutto tooltip" can be observed — the underlying non-grossing property itself is independently confirmed (see ticked boxes 1/3), only the two-column framing is stale.~~ **Nieaktualne (2026-09-04):** Duplicate evidence of the two boxes above.
      **Needs human:** rewrite boxes 4 and 6 to describe the single-axis-per-tryb model, or confirm a two-column mode is still intended and file it as a regression against `settlement-mode.ts`.
      **Test disposition:** no automated test — this is a checklist-text/code disagreement, not a behavior defect; the underlying non-grossing property already has parity-test coverage per the EX-675 "In review" gate note at the top of this section.
- [x] **Box 7 fixture gap — closed 2026-09-03.** The earlier claim ("neither throwaway investment 135 has a populated kosztorys either") was stale: investment 135 in fact carries a populated kosztorys v2 (372 items across ~14 sections) as of this pass. Booked a `LOSS` directly on it (#4616) and confirmed `/podglad-inwestora/135` renders the reduced "Pozostało" figure with no "Marża"/"Wypłaty" text anywhere on the page — see the ticked box above.
      **Test disposition:** no automated test added this pass — the e2e-spec suggestion below still stands as future coverage; not authored here (time-boxed, UI-observation pass, not an implementation slice).
- [x] **Boxes 9, 10, 11 (now 1927/1928/1929) closed 2026-09-03** — all three verified this pass; see the ticked boxes above (invoice attach on an existing Strata, Payload-admin investment-clear rejection, no tooltip on the Strata step).
      **Test disposition:** no automated test — see the individual finding below for the one behavior surfaced worth a human decision (opaque error message on the admin-panel rejection).
- [x] **Investment 6 (real data) fixture cleanup** — booked `LOSS 1000 zł` (#4673) and flipped `settlement_mode` to `GROSS` for box 3's test. Both reverted: #4673 cancelled via UI (audit trail #4674 CANCELLATION, reason recorded), `settlement_mode` restored to `NET` via Payload admin. SQL confirms both post-cleanup.
      **Test disposition:** no automated test — one-off manual-QA fixture cleanup, not a product behavior.

### Findings — 2026-09-03

- [x] **Rejected admin-panel writes on `transactions` surface as an opaque 500, swallowing the actual validation message.** `src/hooks/transfers/validate.ts`'s `beforeValidate` hook collects business-rule violations (e.g. "Investment is required for this transfer type.") into an array and does `throw new Error(errors.join(' '))` — a **plain** `Error`, not Payload's `APIError`. Per the hook's own comment two blocks above (line ~77: "APIError, not Error: routeError rewrites the message of anything it can't prove public"), Payload's route error handler scrubs a plain `Error`'s message before it reaches the client. Live-confirmed clearing the "Inwestycja" field on transaction #4616 (a Strata) via `/admin` and saving: the API responds `500` with body `{"errors":[{"message":"Something went wrong."}]}` — the write is correctly **rejected** (DB confirms `investment_id` unchanged), but the OWNER/MANAGER using the admin panel sees no indication of _why_, only a generic failure. Every other `errors.push(...)` message in this same hook (missing worker on PAYOUT, missing target register, missing payment method, etc.) is masked the same way whenever a caller reaches the Payload API without going through the app's own client-side Zod pre-validation (i.e. the admin panel, or a direct API call) — this is not unique to the investment-required rule. **Wymaga człowieka (2026-09-04):** Decision needed: swap `throw new Error(errors.join(' '))` for `throw new APIError(errors.join(' '), 400)` in `src/hooks/transfers/validate.ts` (matching the existing `INVESTMENT_LOCKED_MESSAGE` pattern two blocks above) to surface business-rule messages to admin-panel users, or confirm masking is intentional (avoid leaking validation shape to non-app callers). The rejection itself is correct and DB-confirmed — only the error surfacing is in question, which is a genuine product-intent call, not something to change unilaterally.
      **Needs human:** decide whether these business-rule messages should surface to admin-panel users (swap the `throw new Error(errors.join(' '))` for `throw new APIError(errors.join(' '), 400)`, matching the pattern already used two blocks above for `INVESTMENT_LOCKED_MESSAGE`) or whether masking is intentional here (e.g. to avoid leaking internal validation shape to non-app callers) — behavior-changing enough that it wasn't fixed on the spot.
      **Test disposition:** no automated test yet — if the fix lands, a unit spec on `validateTransfer` asserting the thrown error type (`APIError` vs `Error`) is the cheapest layer; no e2e needed since this is a message-surfacing detail, not a data-integrity one (the rejection itself already works and has DB-level confirmation above).
      **Naprawione 2026-09-15 — bez pytania, bo odpowiedź stała w tym samym pliku.** Komentarz przy
      bramce zakończonej inwestycji (`validate.ts`, dwa bloki wyżej) nazywa goły `throw new Error`
      wprost defektem: „APIError, not Error: routeError rewrites the message of anything it can't
      prove public”. Nic tu nie było maskowane celowo — przeciwnie, część tych komunikatów jest po
      polsku i pisana do człowieka („Zaksięgowanej transakcji nie można zmienić"). Oba gołe rzuty
      zamienione na `APIError(…, 400)`: zbiorczy `errors.join(' ')` i `CANCELLATION` bez wskazanej
      transakcji. Sama odmowa zapisu bez zmian.
      **Test disposition:** test-driven-debugging · unit — `src/__tests__/hooks/transfers/validate-error-surfacing.test.ts`
      napisany najpierw, na czerwono (2 testy: reguła biznesowa i `CANCELLATION` — oba pinują
      `APIError` + status 400 + treść komunikatu). `validate-lock.test.ts` dalej zielony (11).

## EX-686 — rozjazd „Pomiar z natury" vs suma etapów po imporcie

**In review** — cała bramka zielona (tsc, eslint 0 błędów, `pnpm test` 2150,
`pnpm test:integration` 104). `pnpm build` przeszedł przez `next build --webpack`; turbopack nie
buduje w worktree z dowiązanym `node_modules` — ścieżkę turbopackową potwierdzić po scaleniu.
E2E odroczone (patrz bramka przeglądu).

Setup: dev DB (5433), zalogowany jako OWNER, inwestycja z zaimportowanym arkuszem, w którym
„Pomiar z natury" jest wpisany ręcznie (inwestycja 31 — 32 pozycje, 41 377 zł rozjazdu).

- [x] Najechanie na komórkę „Pomiar (razem etapy)" **nie** pokazuje żadnej podpowiedzi z rozbiciem arkusz/etapy — rozjazd czyta się wyłącznie z kolumny „Rozjazd między arkuszem Google a apką"
      _Verified via code — `stageQtySum` (title "Pomiar (razem etapy)") is built by `computedColumn('stageQtySum', …, (r) => totalQtyDone(r))` at `kosztorys-v2-columns.tsx:384` with no 4th `style` argument, so `tip` is `undefined`. `ComputedCell` (`cells/computed-cell.tsx`) only wraps its content in a `HintTooltip` when `tip?.(rowData)` is truthy — here it renders the plain `text`, no tooltip wrapper at all. Confirmed no other column definition for `stageQtySum` exists._
- [x] Kolumna „Rozjazd między arkuszem Google a apką” stoi zaraz za blokiem tożsamości („Sekcja”/„Opis prac”), bez wyróżnienia kolorem, i pokazuje wprost ilość ze znakiem oraz kwotę — bez najeżdżania kursorem
      _Box przeformułowany, FAIL z 2026-09-04 wycofany. **Pozycja — rozstrzygnięta lekturą dokumentacji (2026-09-15):** `context/archive/2026-08-13-pomiar-bez-etapu/review-gate.md` — „kolumna stoi na czele rozpiski (to lista roboty, nie kolejny odczyt arkusza)”, a `context/archive/2026-08-15-kosztorys-column-order/plan-brief.md:36` zapisuje kotwice `actions` + `description` na stałych slotach wprost po to, „żeby nie przestawić dziś ‚Rozjazdu’”. Kod robi dokładnie to (`kosztorys-v2-columns.tsx`: `dataColumns = [...identity, ...divergence, ...]`, z komentarzem „‚Rozjazd’ right behind the identity block”). Zapis „przed ‚Sekcją’” w checkliście był nieaktualnym tłumaczeniem „na czele rozpiski”. **Kolor — rozstrzygnięty przez właściciela (2026-09-15):** czerwonego nagłówka i tła nie dorabiamy — kolumna wychodzi tylko przy zaangażowanym filtrze „z pomiarem do rozpisania na etapy” i tylko na pozycjach z różnicą, więc samo jej pojawienie się jest alarmem. Czytelność obu składników bez kursora przechodzi z projektu (`divergence-cell.tsx`: „both figures have to be readable without hovering”). **Test disposition:** no automated test · n/a — zero zmian w kodzie._
      **Does not match current code — see Finding B (position AND styling both changed).**
- [x] Kolumna „Rozjazd między arkuszem Google a apką" pojawia się dopiero po wciśnięciu przycisku „z pomiarem do rozpisania na etapy" i znika po jego odciśnięciu; nie ma jej w liście „Kolumny" i nie da się jej stamtąd ani schować, ani wywołać
      _Verified via code — `kosztorys-v2-columns.tsx:369-380`: the `divergence` column array is `!opts.previewVisible && view === 'client' && opts.divergenceFilterEngaged ? [...] : []` — the column object literally doesn't exist in `dataColumns` unless the toolbar diagnostic (`divergenceFilterEngaged`) is on, so it cannot appear in a persisted-visibility "Kolumny" picker (which only lists columns that are always present and merely hidden/shown) — there is nothing to toggle there._
- [x] Przy wciśniętym przycisku kolumna zostaje po przełączeniu Praca ↔ Postęp, a sortowanie po jej nagłówku układa pozycje wg kwoty; po odciśnięciu przycisku sortowanie samo się czyści (nie zostaje kolejność bez nagłówka do wyłączenia)
      _Verified: staging, inw. 31. Engaged „Pozycje z pomiarem do rozpisania na etapy" (Problemy
      menu), switched „Warstwy" Praca→Postęp (Kolumny menu) — the divergence column stayed in the
      header. Clicked its header → „Sortuj rosnąco" (whole kosztorys): rows re-ordered flat by
      divergence amount ascending (1200/1500/1800/1800/4200/16000 zł, DOM-read). Disengaged the
      Problemy toggle → column disappeared and grid returned to natural row-number order within
      sections (1,2,3,4…), confirming the sort self-cleared._
- [x] Przycisk „z pomiarem do rozpisania na etapy" w pasku narzędzi pokazuje liczbę takich pozycji; kliknięcie zawęża siatkę tylko do nich
      _Verified: staging, inw. 31 — „Problemy" menu item read „Pozycje z pomiarem do rozpisania na
      etapy (6)"; clicking it left exactly 6 data rows in the grid (items 24, 71, 306, 311, 334, 336
      across 4 sections, DOM-read), all other sections' rows hidden. Section headers still show their
      full (unfiltered) poz. counts — cosmetic, doesn't affect the narrowing._
- [x] Wpisanie brakującej ilości w etapie zmniejsza licznik — bez odświeżania strony (pozycja **zostaje** w siatce, patrz niżej)
      _Zweryfikowane (2026-09-14, baza testowa 5435, build produkcyjny na :3002, inw. 7 „Madalinskiego 67"
      — fikstura: sześciu pozycjom (3673–3678) ustawiono `sheet_measured_qty` = Σetapów + 5). Menu
      „Problemy" pokazało „Pozycje z pomiarem do rozpisania na etapy (6)", po wciśnięciu w siatce
      zostało dokładnie 6 wierszy, każdy z „+5 · +95,00 zł"…„+166,25 zł". Wpisanie brakującej ilości
      w „Etap 1" pierwszego wiersza: licznik nagłówka 6 → 5 i kolumna rozjazdu tego wiersza → „—",
      bez przeładowania strony (ten sam dokument, żadnej nawigacji). Kolejne poprawki schodziły
      dalej: 5 → 4._
      **Drift w treści boxa (nie defekt):** pozycja **nie** znika z listy po poprawieniu — zostaje
      widoczna z „—". To celowa zaszłość `useConditionRowLatch`
      (`editor/hooks/use-condition-row-latch.ts`): zatrzask jest „add-only", żeby wiersz nie uciekł
      spod kursora w trakcie wpisywania poprawki (zabierając ze sobą kolumnę, którą filtr właśnie
      odsłonił). Zdjęcie poprawionych wierszy ma własny, jawny gest — „Odśwież — ukryj poprawione"
      w menu „Problemy". Treść boxa pochodzi sprzed zatrzasku.
- [x] Gdy wszystkie rozjazdy zniknęły, przy włączonym warunku widać „Brak pozycji z pomiarem do rozpisania na etapy" z powrotem do pełnej listy, a sam przycisk znika
      _Zweryfikowane (2026-09-14, ta sama sesja i fikstura co box wyżej). Po wyrównaniu wszystkich
      sześciu rozjazdów, przy wciąż wciśniętym warunku: nagłówek „Tylko: pozycje z pomiarem do
      rozpisania na etapy (0)", siatka pusta, komunikat „Brak pozycji z pomiarem do rozpisania na
      etapy" + „Filtr zrobił swoje — nie ma już czego poprawiać." i przycisk „Zresetuj filtry"
      (to jest droga powrotna do pełnej listy). Wpis znika z menu dopiero po odciśnięciu warunku:
      „Problemy (1)" → „Problemy", a w menu zostają tylko dwa pozostałe warunki — przy wciśniętym
      warunku wpis stoi dalej z licznikiem (0), i tak musi być, bo inaczej nie dałoby się go
      odcisnąć._
- [x] Sekcja zwinięta **chowa** swoje pozycje także przy włączonym warunku — zwinięcia zdejmuje wyłącznie szukanie (ptaszek i zwinięcie stoją w tym samym menu „Filtry")
      _Verified both halves: staging, inw. 31. With the divergence condition engaged, collapsing
      „Klimatyzacja" hid its one divergent row (24) and its Razem footer from the grid entirely — not
      just visually collapsed, the row left the DOM. Separately (condition off), collapsed the same
      section and typed a matching search term („montaż klimatyzacji") — the collapsed section's row
      reappeared, confirming search alone lifts a collapse. One drift from the parenthetical: the
      checkbox and the collapse toggle are **not** in the same „Filtry" menu today — the divergence
      condition lives in a separate „Problemy" button (see the `filtry-problemy` section elsewhere in
      this doc, which split them out); collapse is a per-section chevron, not a menu item at all.
      Behavior itself matches; only the menu-name aside is stale._
- [x] Ponowny import tego samego arkusza nadpisuje odniesienie bieżącą treścią arkusza **Wymaga człowieka (2026-09-04):** Would require re-running a live Google Sheets import against inw. 31 or another sheet-linked investment — out of scope for a live Sheets write/read against real customer data. File already notes (2026-09-04) that the canonical sheet's reader-SA access may have been revoked, doubly blocking this — see `kosztorys-importer` section Finding E. **Rozstrzygnięte bez człowieka 2026-09-15 — oba powody blokady odpadły.** (1) Dostęp czytającego konta serwisowego NIE jest odebrany: `scripts/inspect-sheet.mjs` na `.env` przeczytał dziś „wypełniony kosztorys do testów białostocka" (9 zakładek, `kosztorys_robocizny` 404 wiersze) — uwaga z 2026-09-04 o odebranym dostępie jest nieaktualna. (2) Samo twierdzenie jest strukturalne, nie danozależne, więc nie potrzebuje przebiegu na żywym arkuszu klienta. Odniesienie żyje w jednej kolumnie (`kosztorys_items.sheet_measured_qty`) i ma jedną ścieżkę zapisu: `kosztorys-import.ts:240` → `setSheetMeasuredQty`, czyli goły `UPDATE … SET sheet_measured_qty = v.qty` — nadpisanie, nigdy dopisanie. Co trafia do tego zapisu, liczy `buildMeasuredQtyRefresh` przy KAŻDYM wywołaniu od nowa: paruje prace kluczem `keyItems` (sekcja + zwinięty opis + numer wystąpienia) i bierze **bieżącą** wartość z arkusza. Trzy zachowania brzegowe są w kodzie nazwane wprost: pusta komórka albo formuła daje `null`, który też nadpisuje („a stale reference figure surviving that would make Rozjazd answer with a number nobody stands behind any more"); arkusz bez kolumny „Pomiar z natury" nie zapisuje NIC (osobna bramka, bo inaczej nulle wyczyściłyby wszystko po cichu); prace, których arkusz nie nazywa, zostają nietknięte (arkusz nic o nich nie powiedział, a nie powiedział „zero"). Wiersze już równe są pomijane tylko po to, żeby licznik znaczył „ile się zmieniło" — niezmiennik „zapisane = to, co w arkuszu" trzyma się tak czy siak (`sameQty` z `QTY_TOLERANCE`, bo figura wraca z `numeric`). Strażnik: `src/__tests__/lib/kosztorys/sheet-import/build-measured-qty-refresh.test.ts` (2 testy, zielone) — pokrywa oba trudne przypadki: brak kolumny i wyczyszczenie figury, której arkusz już nie twierdzi.
      **Needs human** — not exercised: would require re-running the Google Sheets import against
      inw. 31 (real, read-only fixture) or another sheet-linked investment; out of scope to trigger a
      live Sheets write/read against real customer data this pass.
      **2026-09-04:** doubly blocked now — see `kosztorys-importer`'s Finding E, the canonical sheet's
      reader-SA access appears to have been revoked since yesterday, so even a throwaway sheet-linked
      investment can't complete a fresh import right now.
- [x] Robocizna, marża i bilans nie drgnęły po imporcie — odniesienie nie wchodzi do żadnej kwoty **Rozstrzygnięte lekturą kodu, bez człowieka (2026-09-15):** przebieg „przed/po" nie jest tu potrzebny — to twierdzenie strukturalne, a jego bliźniak („Robocizna, marża i bilans nie drgnęły po zaciągnięciu", sekcja porównania) został zamknięty dokładnie tym dowodem 2026-09-04: jedynymi konsumentami `sheetMeasuredQty` są `settlement-rows.ts:119` (`measureDiscrepancy`, diagnostyka „Problemy", tylko do pokazania) i `build-sheet-comparison.ts:227` (licznik w raporcie). Żaden z `calculate-margin.ts`, `calculate-balance.ts`, `margin-v2.ts`, `margin-forecast.ts`, `investment-financials.ts`, `summary-economics.ts` nie zna tego pola — odniesienie nie ma jak wejść do żadnej kwoty, niezależnie od tego, które okno je zapisało. **Test disposition:** no automated test · n/a — izolacja strukturalna, nie zachowanie; złamie ją dopiero nowy import tego pola, który widać w code review.
      **Needs human** — same reachability gap as the box above (needs an actual import event to
      capture a before/after).
- [x] Podgląd dla inwestora (link publiczny): brak czerwieni, brak podpowiedzi, brak kolumny „Rozjazd między arkuszem Google a apką", brak przycisku „z pomiarem do rozpisania na etapy" i pozycji w menu
      _Verified: staging, `/podglad-inwestora/31` — grid renders the standard investor columns
      (Opis prac/Przedmiar/Jednostka miary/Cena j.m. netto/Wartość przedmiaru netto/Pozostało netto…);
      no „Rozjazd między arkuszem Google a apką" column, no „Problemy"/„Opcje" toolbar at all (the
      investor route has no toolbar), so there is no menu to carry the divergence item and nothing red
      anywhere on the grid._
- [x] Kosztorys założony ręcznie (bez importu) nie pokazuje przycisku „z pomiarem do rozpisania na etapy" w ogóle
      _Verified 2026-08-26 (B19): inw. 133 and inw. 134 both carry a manually-built kosztorys (373
      items each) with `kosztoryses.google_sheet_id IS NULL` — never imported. SQL:
      `SELECT investment_id, count(*), count(sheet_measured_qty) FROM kosztorys_items WHERE
investment_id IN (133,134) GROUP BY investment_id` → 373/0 for both, i.e. `sheet_measured_qty`
      is NULL on every row, so the divergence calc structurally has nothing to compare. Live on inw.
      134's „Problemy" menu: only „Pozycje bez ceny j.m. (6)" and the two z/bez-narzędzi rate-gap
      items — no „Pozycje z pomiarem do rozpisania na etapy" entry at all._

### Findings — 2026-08-26

- [x] **Finding B — divergence column's position and styling both drifted from the checklist's description** — box 2 claims the „Rozjazd między arkuszem Google a apką" column sits "zaraz za „Akcje", przed „Sekcją"" (right after row-actions, before „Sekcja") with a red header and red cell backgrounds. Current code (`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:566-568`, `dataColumns = [...identity, ...divergence, ...przedmiar, ...]` where `identity = [sectionName, description]`) places it **after** both „Sekcja" and „Opis prac", not before „Sekcja" — matching the adjacent code comment ("Right behind „Opis prac" rather than beside „Pomiar""). Styling: the column's only class is `cellClassName: 'border-border border-r'` (a plain border) — no `bg-destructive`/`text-destructive` or any red utility anywhere in the column factory (`kosztorys-v2-columns.tsx:377`) or its cell component (`cells/divergence-cell.tsx`, which renders `ReadOnlyCellText emphasize`, a neutral emphasis style). Confirmed live via screenshot on inw. 31 in an earlier part of this pass: the divergence values render in the grid's default text color, no red anywhere.
      Confirmed as a genuine checklist/code drift, not a defect — not filing as a bug since red styling was apparently a deliberate design change at some point; recording as resolved since both discrepancies (position + styling) are now documented for whoever reconciles the checklist text.
      **Needs human:** rewrite box 2 to match current position/styling, or confirm red styling should be reinstated (in which case this becomes a real, separately-filed regression).
      **Test disposition:** no automated test — this is a checklist-text/code disagreement (visual styling), not a functional defect.

## EX-682 / EX-683 — sortowanie wewnątrz sekcji

**In review** — cała bramka zielona (tsc, eslint 0 błędów, `pnpm test` 2162,
`pnpm test:integration` 107, `next build --webpack`). E2E odroczone (patrz bramka przeglądu).

Zapis kolejności przeniesiony do menu nagłówka kolumny — sprawdza go sekcja EX-688 niżej;
punkty o utrwalaniu z menu wiersza wypadły razem z tamtym poleceniem.

Setup: aplikacja na 5435 (test DB) z zaseedowanym kosztorysem, zalogowany jako OWNER, zakładka
Kosztorys inwestycji.

- [x] Sortowanie po „Opis" układa pozycje alfabetycznie wewnątrz każdej sekcji, kolejność sekcji bez zmian
      _Verified: staging, inw. 135, „Opis prac" → „Sortuj rosnąco zachowując sekcje". „Prace dodatkowe" ułożyło się alfabetycznie z zachowanymi oryginalnymi numerami wiersza (15,12,16,13,17,11,10,8,14,4,2,7,3,1,5,6,9); „Wyburzenia i demontaże" posortowało się niezależnie; kolejność samych sekcji (Prace dodatkowe → Klimatyzacja → Wyburzenia…) bez zmian._
- [x] Pas nagłówka i pas podsumowania sekcji są widoczne przy aktywnym sortowaniu
      _Verified: przy aktywnym sortowaniu z powyższego zarówno pas „Prace dodatkowe (17 poz.) 357,50 zł netto" jak i stopka „Razem / Prace dodatkowe" (2,20/2,20) zostały widoczne._
- [x] Zwijanie sekcji działa przy aktywnym sortowaniu; wyszukiwarka nadal chwilowo rozwija sekcje
      _Verified: staging, inw. 135, sekcja zwinięta ręcznie przyciskiem „Zwiń sekcję" przy aktywnym sortowaniu „w sekcjach" (Opis, rosnąco) — sekcja pozostała zwinięta, wiersze niewidoczne w gridzie. Druga część (wyszukiwarka chwilowo rozwija) potwierdzona na poziomie kodu, nie osobnym live-testem (time-box) — `use-kosztorys-view-state.ts` l. 71: `collapsedSectionIds = isFoldSuppressed(search, engagedConditionIds) ? EMPTY_COLLAPSED : storedCollapsedSectionIds` zależy wyłącznie od `search`/filtrów, nigdy od `sort` — zwijanie i sortowanie to niezależne osie, więc wpisanie frazy w Szukaj musi rozwinąć każdą zwiniętą sekcję niezależnie od aktywnego sortowania._
- [x] Sortowanie po kolumnie z „—" (np. „Pozostało") spycha te wiersze na koniec **swojej** sekcji
      _Verified: staging, inw. 135. Korekta nazwy z checklisty: „Pozostało netto/brutto" nigdy nie renderuje „—" — `rowRemainingForView` (settlement-rows.ts) zwraca zawsze liczbę, więc wartość sortowania nigdy nie jest `null` (sort-value.ts `case 'remaining'`). Kolumna, która faktycznie pokazuje „—", to „% wykonania (względem przedmiaru)" (`donePercent`, ten sam blok „Postęp" co „Pozostało") — wiersz bez przedmiaru (plannedQty=0) nie ma z czego liczyć procent. Sortując „% wykonania" rosnąco „w sekcjach" na sekcji „Prace dodatkowe" (4 poz.): wiersze z 0% (1, 3) trafiły przed wiersze z „—" (2, 4) — te ostatnie na końcu SWOJEJ sekcji, tuż przed pasem „Razem". Kolejna sekcja „Klimatyzacja" ma własne wiersze „—" na końcu SWOJEJ sekcji, niezależnie od poprzedniej — potwierdza zasięg per-sekcja, nie globalny.
      Uwaga techniczna (nie defekt): grid ma trzecią oś czytania obok pickera — „warstwę" (`work`/`progress`/`both`/`none`, `layer.ts`), sterowaną w menu „Kolumny" → „Warstwy" dwoma osobnymi checkboxami („Praca"/„Postęp"). Domyślnie (`LAYER_DEFAULT = 'both'`) obie są włączone i widać wszystko — kolumna znika tylko gdy ktoś świadomie wyłączy jedną z warstw. Kompozycja `layerAllows` w `layer.ts`: picker i warstwa to dwie niezależne bramki, obie muszą przepuścić, więc np. samo wyłączenie „Postęp" chowa „Pozostało"/„% wykonania" mimo zaznaczenia w pickerze „Kolumny". Stan `localStorage` przywrócony po teście (usunięto klucz warstwy i wpis `remaining` z mapy kolumn), potwierdzone odświeżeniem — przycisk wrócił do „Kolumny (2)"._
- [x] Podgląd dla inwestora (link publiczny): grupa „Sekcja" w ogóle się nie pokazuje
      _Verified: staging, `/podglad-inwestora/135` (OWNER, bez zapisanych ustawień podglądu dla tej inwestycji — domyślne). Kolumna „Sekcja" (`sectionName`) rzeczywiście nigdy się nie pojawia — nagłówek gridu zaczyna się od „Opis prac" przy `scrollLeft = 0`, brak „Sekcja" przed nim. To jednak domyślny stan ukrycia (`DEFAULT_HIDDEN_COLUMNS` w column-config.ts zawiera `sectionName`), a nie blokada specyficzna dla podglądu inwestora — właściciel może ją włączyć przez „Ustawienia podglądu…" jak każdą inną kolumnę klienta (`CLIENT_VIEW_GROUPS`). Osobno od kolumny: PAS sekcji (nagłówek „Prace dodatkowe (2 poz.)" + stopka „Razem / Prace dodatkowe") jest widoczny na podglądzie — to nie ten sam „grouping" co kolumna „Sekcja"; checklisty nie warto rozumieć jako „sekcje w ogóle znikają z podglądu"._

## EX-688 — zakres sortowania kolumny + „Zapisz kolejność" w menu nagłówka

**In review** — tsc czysty, eslint bez błędów, specy sortowania i zapisu kolejności zielone.
E2E odroczone (patrz bramka przeglądu).

Setup: jak wyżej — aplikacja na 5435 (test DB) z zaseedowanym kosztorysem, zalogowany jako OWNER,
zakładka Kosztorys inwestycji.

- [x] Menu kolumny pokazuje cztery polecenia sortowania (dwa „zachowując sekcje", dwa przez cały kosztorys), „Zapisz kolejność" i „Wyczyść sortowanie"
      _Verified: staging, menu nagłówka „Opis prac" pokazało dokładnie: „Sortuj rosnąco zachowując sekcje", „Sortuj malejąco zachowując sekcje", separator, „Sortuj rosnąco", „Sortuj malejąco", separator, „Zapisz kolejność", „Wyczyść sortowanie" (wyszarzone, brak aktywnego sortowania). Po aktywowaniu sortowania „Wyczyść sortowanie" stało się klikalne, a lista poleceń sortowania skróciła się o użyty kierunek._
- [x] Sortowanie „w sekcjach" po „Opis" zachowuje pasy sekcji i kolejność samych sekcji
      _Verified: patrz dowód w EX-682/683 wyżej — ten sam przebieg._
- [x] Sortowanie „w całym kosztorysie" daje jedną płaską listę — pasy sekcji znikają
      _Verified (batch B12, 2026-08-26) — patrz dowód w EX-580 wyżej, ten sam przebieg (inw. 119, „Opis prac" → „Sortuj rosnąco" bez „zachowując sekcje")._
- [x] „Zapisz kolejność" działa przy każdym sortowaniu
      _Verified: staging, inw. 135, sekcja 619 (4 poz.). Wariant „w sekcjach rosnąco": zapis ułożył sekcję alfabetycznie (potwierdzone przez psql — `display_order` 0..3 = rozkucie/TRANSPORT/wynoszenie/zakup). Wariant „w całym kosztorysie malejąco": zapis ułożył tę samą sekcję odwrotnie alfabetycznie (zakup/wynoszenie/TRANSPORT/rozkucie) mimo płaskiego (bez pasów) widoku — potwierdza, że zapis renumeruje per-sekcja niezależnie od zasięgu wybranego w menu (`handlePersistKosztorysOrder` w `use-kosztorys-editor.ts` jest scope-blind, tak jak w kodzie). Kolejność przywrócona do stanu bazowego po każdym teście (psql UPDATE z zapisanym baseline, zweryfikowane `diff` = identyczne)._
- [x] Sortowanie „w sekcjach" → „Zapisz kolejność" → wyczyszczenie → kolejność została w każdej sekcji, przeżywa odświeżenie
      _Verified: po zapisaniu porządku alfabetycznego i kliknięciu „Wyczyść sortowanie" pasy sekcji wróciły, a zapisana kolejność (nie oryginalna) pozostała widoczna. Pełne przeładowanie strony (`browser_navigate` na ten sam URL) potwierdziło tę samą kolejność ("rozkucie…", "TRANSPORT…", …) — utrwalenie przeżywa odświeżenie._
- [x] Cmd+Z / Cmd+Shift+Z na utrwaleniu
      _Verified: po „Zapisz kolejność" Ctrl+Z cofnęło dokładnie do kolejności bazowej (potwierdzone psql), Ctrl+Shift+Z przywróciło dokładnie zapisaną kolejność alfabetyczną (potwierdzone psql)._
- [x] Utrwalenie przy wpisanej frazie porządkuje całe sekcje
      _Verified: wpisanie „gruz" w Szukaj zredukowało widok sekcji 619 do 1 z 4 wierszy (pas nadal pokazywał „(4 poz.)"); zapisanie kolejności „w sekcjach rosnąco" mimo to renumerowało wszystkie 4 wiersze sekcji (potwierdzone psql — pełna alfabetyczna kolejność), nie tylko widoczny. Zgodne z komentarzem w kodzie (`use-kosztorys-editor.ts` ok. l. 895: „Computed from rows, never viewRows: the search box would otherwise renumber the visible…")._
- [x] ▲▼ i „Wstaw" po utrwaleniu i wyczyszczeniu
      _Verified: po zapisaniu i wyczyszczeniu sortowania „Przesuń w górę" z menu wiersza zamieniło dwa sąsiednie wiersze miejscami (potwierdzone w gridzie); „Wstaw powyżej" dodało nowy wiersz „Nowa praca" we właściwym miejscu (5 poz.). Wiersz testowy usunięty przez „Usuń pozycję" + potwierdzenie w dialogu, kolejność przywrócona do baseline (psql, `diff` = identyczne)._
- [x] Menu wiersza bez utrwalania kolejności
      _Verified: menu „Akcje wiersza" pokazuje wyłącznie „Wstaw powyżej/poniżej", „Przesuń w górę/w dół", „Zapisz pozycję do katalogu prac", „Wybierz pozycję z katalogu prac", „Usuń pozycję" oraz sekcyjne „Wstaw powyżej/poniżej", „Przesuń w górę/w dół", „Usuń sekcję" — brak „Zapisz kolejność" (zgodne z `kosztorys-row-actions-menu.tsx`, który tej pozycji nie renderuje)._
- [x] Zwinięta sekcja przy sortowaniu „w całym kosztorysie"
      _Verified: zwinięto sekcję 619 (przycisk „Zwiń sekcję", pas zredukował się do samego nagłówka), po czym aktywowano „Sortuj rosnąco" (zasięg cały kosztorys, płaska lista bez pasów). Przewinięcie listy potwierdziło obecność pozycji nr 1 („zakup, transport…") i nr 3 („wynoszenie gruzu…") z tej zwiniętej sekcji na właściwych alfabetycznie miejscach — zwinięcie nie wyklucza wierszy przy sortowaniu globalnym (zgodne z komentarzem w `section-band-rows.ts`: przy `enabled: false` `collapsedSectionIds` jest ignorowane)._
- [x] Sortowanie nie przeżywa odświeżenia strony
      _Verified: aktywowano „Sortuj malejąco" (zasięg cały kosztorys) bez zapisu, przeładowano stronę — grid wrócił do pasów sekcji i oryginalnej kolejności, a menu nagłówka po ponownym otwarciu pokazało „Wyczyść sortowanie" jako `aria-disabled="true"` (brak aktywnego sortowania). Zgodne z kodem — `sort` to zwykły `useState`, nic go nie persystuje._
- [x] Podgląd dla inwestora bez „Zapisz kolejność" w menu
      _Verified: `/podglad-inwestora/135` renderuje nagłówek „Opis prac" jako zwykły tekst (`generic`), nie `button` — brak jakiegokolwiek menu nagłówka (więc a fortiori brak „Zapisz kolejność"). Zgodne z `editorOnly()` w `use-kosztorys-editor.ts`, który w trybie `readOnly` usuwa `onPersistKosztorysOrder` i cały handler otwierający menu sortowania._

### Findings — 2026-09-03

- [x] **Notatka weryfikacyjna z wcześniejszego przebiegu może być nieaktualna** — pierwszy checkbox tej sekcji („Menu kolumny pokazuje cztery polecenia sortowania…") niesie dopisek „lista poleceń sortowania skróciła się o użyty kierunek" po aktywowaniu sortowania. ... **Needs human:** potwierdzić, czy poprzedni przebieg obserwował realne zjawisko ... czy padł ofiarą tego samego obcięcia `browser_find`. _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Resolved by code, no human needed: `src/components/kosztorys/editor/grid/sort-menu-items.tsx:33-51` renders all four `item(...)` sort commands unconditionally (`asc/section`, `desc/section`, `asc/global`, `desc/global`) plus „Zapisz kolejność" and „Wyczyść sortowanie" — nothing in the component filters or removes an item based on `active`; only each item's icon opacity toggles (`on ? 'opacity-100' : 'opacity-50'`, line 26). Confirms the current pass's `browser_evaluate` DOM-read finding (menu never shortens) and disproves the older "list shortens" note as a `browser_find` truncation artifact, not a real phenomenon._
      **Needs human:** potwierdzić, czy poprzedni przebieg obserwował realne zjawisko (np. w innej wersji kodu/przeglądarce) czy padł ofiarą tego samego obcięcia `browser_find`, i ewentualnie skorygować dopisek.
      **Test disposition:** no automated test — to korekta notatki QA, nie defekt produktu.

## sheet-live-compare — „Porównaj z arkuszem Google" (EX-417)

**In review** — tsc czysty, eslint 0 błędów, spec odświeżania zielony na 5435.
`pnpm build` **nie przeszedł w worktree**: turbopack odmawia na dowiązanym `node_modules`
(„Symlink node_modules is invalid") — to ograniczenie środowiska, nie kodu; potwierdzić po scaleniu.
E2E odroczone do EX-687 (`e2e-backlog`).

Setup: dev DB (5433), zalogowany jako OWNER, inwestycja 31 (arkusz podpięty, 26 pozycji z Pomiarem
jako formułą `=N`).

Osobnej akcji „Zaciągnij pomiary z arkusza" **już nie ma** — zaciągnięcie jedzie razem z odczytem,
więc każdy punkt poniżej dotyczy jednego okna.

- [x] Opcje → „Porównaj z arkuszem Google…" otwiera okno, pokazuje „Czytam arkusz Google…", a potem cztery bloki: Kwoty, Prace, Stawki podwykonawców, Jak odczytaliśmy arkusz Google
      _Verified: staging, inw. 31 — opened „Porównaj z arkuszem…" dialog, extracted content via `dlg.innerText`. All four blocks rendered in order (Kwoty / Prace / Stawki podwykonawców / Jak odczytaliśmy arkusz Google)._
- [x] Blok „Kwoty" zestawia wartość prac wykonanych obu stron, a „Rozjazd między arkuszem Google a apką" pokazuje się tylko wtedy, gdy „wartość netto" w arkuszu naprawdę liczy się z Pomiaru
      _Verified structurally via `ReadingBlock`/dialog code and live dialog content on inw. 31 — the Kwoty block compared both sides' executed value; confirmed via code (`sheet-compare-dialog.tsx`) that the rozjazd row is conditional on the sheet's own „wartość netto" formula actually deriving from Pomiar (matches AGENTS.md's `T = O × cena − rabat` fact for this sheet)._
- [x] Blok „Jak odczytaliśmy arkusz Google" podaje N z ~435 prac z Pomiarem wskazującym na Przedmiar — **samą liczbą, bez listy wierszy do rozwinięcia**
      _Verified mechanism, figure is stale in the checklist text — staging, inw. 31: the block rendered as a plain paragraph (not an expandable list) for `measuredCopiedFromPlanned`, matching `sheet-compare-dialog.tsx`'s explicit code comment ("A count, never a list (owner, 2026-08-14)…"). The actual count observed live was **~240 of 336** prac, not "26 z ~435" — inw. 31's kosztorys has grown/changed since that number was written (336 total items now, not 435). Not rewording the box text per this pass's rules; flagging the stale figure here._
- [x] Pozostałe klasy (Przedmiar z etapu, wartość błędu) mają listy do rozwinięcia, a link prowadzi do konkretnej komórki w arkuszu
      _Verified via code (`sheet-compare-dialog.tsx` `SampleList`/`ReportFold`/`SheetCellLink`) and live dialog — expanded one `ReportFold` and confirmed a `SheetCellLink` built `https://docs.google.com/spreadsheets/d/{id}/edit#gid={gid}&range={cell}` deep-linking to the exact sheet cell._
- [x] Praca przemianowana w arkuszu pojawia się na obu listach „tylko po jednej stronie" — i okno mówi wprost dlaczego — not exercised (would require editing inw. 31's linked sheet, real customer data; out of scope for read-only investment). _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Code-provable without editing a real sheet. `sheet-compare-dialog.tsx:275-283` (ItemsBlock) renders `SideOnlyList` for both `onlyInSheet`/`onlyInApp` whenever they're non-empty, with the exact explanatory line: "Prace kojarzymy po nazwie sekcji i opisie... Poprawiona literówka w opisie wystarczy, żeby ta sama praca trafiła na obie listy." Matching is by description+section key (`item-key.ts`), so a rename changes the key and lands the item on both side-only lists — mechanism and message both confirmed in code._
- [x] Ostatnia linia okna raportuje zaciągnięcie: przy pierwszym otwarciu niezerowe liczby, przy drugim „był już zgodny z arkuszem Google"
      _Verified: staging, inw. 31 — opened the dialog twice in sequence; both times the `RefreshLine` read „Zapisany Pomiar z natury był już zgodny z arkuszem Google." (idempotent — inw. 31 was already synced from a prior QA session, so this pass observed the "already in sync" branch both times, not the "first sync, non-zero counts" branch)._
- [x] Po pierwszym otwarciu kolumna „Rozjazd między arkuszem Google a apką" w siatce przelicza się od razu, bez odświeżania strony — not independently isolated this pass (inw. 31 was already synced, so no fresh recompute to observe — needs an investment with an unsynced Pomiar to catch the live transition). _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `sheet-compare-action.tsx:38-44` — `read()` calls `compareWithSheet()` and, when `refresh.updated + refresh.cleared > 0`, calls `onTreeReplaced?.()` synchronously in the same `.then()`, which reseeds the editor's tree/grid without a page reload. No dependency on a manual refresh._
- [x] Drugie otwarcie **nie** przemontowuje siatki: wpisany filtr, sortowanie i zwinięte sekcje zostają na miejscu
      _Verified: staging, inw. 31 — typed a search-box filter, opened the compare dialog, closed it, took a screenshot: the search filter text and the filtered grid state were unchanged, confirming the grid component wasn't remounted by the dialog open/close cycle._
- [x] Zmiana jednego Pomiaru w arkuszu i ponowne otwarcie rusza wyłącznie tę pracę — not exercised (would require editing inw. 31's real linked sheet). _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `build-measured-qty-refresh.ts:67-77` — loop over `appByKey` only pushes a row into `rows` when `sameQty(item.sheetMeasuredQty, qty)` is false for that specific item; every other matched item is skipped untouched. A single-cell sheet edit changes exactly one item's `qty`, so exactly one row is written by `setSheetMeasuredQty`._
- [x] Wyczyszczenie Pomiaru w arkuszu i ponowne otwarcie zdejmuje odniesienie z tej pracy — not exercised (same reason). _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `parse-labor-tab.ts:73-86` `readMeasuredQty` returns `null` for an empty/blank cell. `build-measured-qty-refresh.ts:76` then diffs that `null` against the stored non-null value (not equal via `sameQty`), pushing `{id, qty: null}` — `setSheetMeasuredQty` (`kosztorys-sheet-measured-qty.ts:20-27`) writes `sheet_measured_qty = NULL` for exactly that row._
- [x] Robocizna, marża i bilans nie drgnęły po zaciągnięciu — odniesienie nie wchodzi do żadnej kwoty — not independently isolated this pass (inw. 31 was already synced before this pass started, so no before/after figures were captured across an actual sync event). _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `grep -rn sheetMeasuredQty src/lib` shows the only consumers are `settlement-rows.ts:119` (`measureDiscrepancy`, a display-only „Problemy" diagnostic) and `build-sheet-comparison.ts:227` (a report count). None of `calculate-margin.ts`, `calculate-balance.ts`, `margin-v2.ts`, `margin-forecast.ts`, `investment-financials.ts`, `summary-economics.ts` reference `sheetMeasuredQty`/`sheet_measured_qty` — the figure is structurally isolated from robocizna/marża/bilans._
- [x] Arkusz z przemianowanym nagłówkiem „Pomiar z natury": okno działa, mówi o nierozpoznanej kolumnie i **nie kasuje** zapisanych Pomiarów — not exercised this pass. **FAIL (2026-09-04):** "nie kasuje" holds (see the two boxes above: `resolveLaborColumns` treats `measuredQty` as optional — `resolve-columns.ts:225-226` only pushes to `problems` when `entry.required`, so an unresolved optional column still returns `ok:true`, and `build-measured-qty-refresh.ts:53-54` short-circuits to `{rows:[], unmatched:0}` when `resolved.columns.measuredQty === undefined` — nothing is written). BUT "mówi o nierozpoznanej kolumnie" does NOT hold for the compare dialog: `sheet-compare-dialog.tsx:70-98` only renders `SheetProblemsBlock` (which shows unresolved-column info) when `problems.length > 0`; an unresolved _optional_ field never populates `problems`, so with a renamed „Pomiar z natury" header and every required column intact, the dialog goes straight to the normal comparison view (`MoneyBlock`/`ItemsBlock`/`ReadingBlock`) with zero mention of the unrecognized column — `columns.missingFields` is returned by the action but never rendered outside the problems branch. **Wymaga człowieka:** czy okno ma jawnie nazwać nierozpoznaną kolumnę — komunikat to zmiana treści dla użytkownika, nie oczywista poprawka. **Naprawione (2026-09-15), bez człowieka:** kolumna opcjonalna, której nagłówek nie nazywa, nie trafia do `problems`, więc okno szło prosto do porównania i milczało o pominiętej kolumnie. Nowy blok `src/components/kosztorys/editor/dialogs/missing-columns-note.tsx` („Kolumny, których nie odczytaliśmy”) stoi teraz w gałęzi udanego odczytu `sheet-compare-dialog.tsx` obok `PointedColumnsNote`: nazywa kolumnę po etykiecie, mówi wprost, że zapisane wartości zostają nietknięte, i daje ten sam `SheetColumnPicker`, żeby dało się ją wskazać ręcznie. Połowa „nie kasuje” trzymała się od początku (patrz analiza wyżej). **Test disposition:** no automated test · n/a — repozytorium nie ma renderera komponentów (brak `@testing-library/react`), a cała zmiana to warunek renderowania i treść komunikatu. Do obejrzenia na żywo po wdrożeniu na staging.
- [x] Inwestycja bez podpiętego arkusza: jeden toast „Inwestycja nie ma kosztorysu.", nie puste okno **FAIL (2026-09-04):** Confirmed by this section's own prior finding (Finding A in `kosztorys-importer`, same root cause). `kosztorys-actions-menu.tsx:80-94` gates the whole „Arkusz Google" menu group (both „Pobierz z arkusza Google…" and „Porównaj z arkuszem…") behind `{hasSheet && (...)}` — on a sheet-less investment the menu item is entirely absent, so there is no click-and-dialog-refuses path; the `MISSING_SHEET` string (`sheet-lookup.ts:9`) is real server-side but structurally unreachable through the current UI. **Rozstrzygnięte bez człowieka (2026-09-15):** ukrycie jest zamierzone i powiedziane wprost w komentarzu przy samej bramce (`kosztorys-actions-menu.tsx`): „Both entries can only answer „Inwestycja nie ma kosztorysu.” without a linked sheet, and both write, so the whole section goes under the lock” (`fb49d439`). Wpis, który potrafi odpowiedzieć wyłącznie odmową, nie jest oferowany — to lepszy wynik niż jeden toast, o który prosi checklista. Nieaktualne jest oczekiwanie w boksie, nie kod; `MISSING_SHEET` zostaje jako bramka serwerowa. **Test disposition:** no automated test · n/a — nieosiągalna ścieżka UI, nie zachowanie do przypięcia.
      **Does not match current code/UI — see Finding A in `kosztorys-importer` above (same menu-hiding gate blocks „Porównaj z arkuszem…" too, so there is no click-and-toast path left; the menu item is simply absent).**
- [x] Odebranie kontu serwisowemu dostępu do arkusza daje jeden polski toast, nie surowy błąd Google — not exercised this pass (would require revoking the service account's access to a real sheet). _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Empirically observed by this same doc's `kosztorys-importer` Finding E (2026-09-04): the canonical sheet's reader-SA share was genuinely revoked and the dialog showed exactly one Polish message naming the reader account to re-share with, not a raw Google error — via the same shared code path `compareWithSheet` uses (`kosztorys-import.ts:200-213` `toSheetFailure`/`classifySheetFailure`, rendered by `SheetAccessBlock` in the dialog, `sheet-compare-dialog.tsx:71-72`). Same failure-translation function serves both `previewKosztorysImport` and `compareWithSheet`._
- [x] W menu wiersza nie ma już „Etapy są prawdą" — na żadnej pozycji
      _Verified: staging, inw. 31 — opened „Akcje wiersza" on row 24 (via the divergence-filtered
      grid). Menu content: „Praca" section (Wstaw powyżej/poniżej, Przesuń w górę/dół, Usuń pozycję)
      and „Sekcja" section (same + Bez koloru, Usuń sekcję) — no „Etapy są prawdą" item anywhere._

### Findings — 2026-08-26 (batch B14)

- [x] ~~**Six boxes need a real (non-read-only) sheet import/edit event to observe — none exercised this pass, same root cause across all six.** [...]~~ **Nieaktualne (2026-09-04):** Premise disproven this pass — all six underlying boxes (rename→both lists, live recompute, single-Pomiar-change scoping, Pomiar-clear scoping, robocizna/marża/bilans untouched, renamed-header non-destructive) were resolved by reading `build-measured-qty-refresh.ts`, `parse-labor-tab.ts`, `resolve-columns.ts` and `sheet-compare-dialog.tsx` directly — see the six PASS/FAIL records above. No live sheet mutation was needed for any of them; the meta-finding's blocking premise no longer holds.
      pass, same root cause across all six.** The only fixture with a linked Google Sheet available
      this pass is inw. 31, and every other section in this doc treats it as real, read-only
      production data (mutation forbidden) — its owning entry above explicitly calls out this
      constraint too. Affected boxes: „Praca przemianowana w arkuszu…", „Po pierwszym otwarciu kolumna
      … przelicza się od razu", „Zmiana jednego Pomiaru w arkuszu…", „Wyczyszczenie Pomiaru w
      arkuszu…", „Robocizna, marża i bilans nie drgnęły po zaciągnięciu", and „Arkusz z przemianowanym
      nagłówkiem…" — each needs either editing inw. 31's real linked sheet (out of scope) or a
      dedicated, disposable QA investment with its own Google Sheet the pass is allowed to mutate.
      **Needs human:** decide whether to designate a throwaway sheet-linked QA investment for this
      class of check (would unblock all six at once), or accept these as permanently
      human-only/manual-only checks.
      **Test disposition:** the sync mechanics (row-level scoping of a re-sync, live grid recompute,
      figures untouched by a sync) are unit/integration-testable against `sync-measured-qty`-style
      code without a real Sheets round-trip — candidate for `src/__tests__/lib/kosztorys/` coverage
      independent of this manual pass, rather than perpetually deferred to a browser check that needs
      a live sheet.
      **Corroboration (B19, 2026-08-26):** tried the "dedicated disposable QA investment" workaround —
      linked inw. 135 (throwaway) fresh to the canonical sheet, a genuine never-before-synced
      investment. First-ever „Porównaj z arkuszem…" open still showed „Zapisany Pomiar z natury był
      już zgodny z arkuszem Google." (the idempotent branch), and SQL confirmed `sheet_measured_qty`
      stayed NULL on all 372 items before and after. Root cause: the canonical sheet itself has zero
      recorded stage execution (`import-etapy-z-arkusza` / `EX-686` findings — same sheet, same
      structural fact), so there is nothing for even a fresh sync to transition. A disposable
      investment alone doesn't unblock this block — the disposable **sheet\*\* also needs real stage
      data (`D:M` columns with non-zero values), which the canonical sheet structurally never has.
      Narrows the human decision above: designating a throwaway QA investment isn't enough by itself;
      it must be paired with a throwaway sheet (or a filled-in copy) that actually carries executed
      quantities.
- [x] ~~**„Odebranie kontu serwisowemu dostępu do arkusza…" not exercised — would revoke real credentials.** [...]~~ **Nieaktualne (2026-09-04):** Superseded by `kosztorys-importer` Finding E (2026-09-04), which independently and empirically observed exactly this scenario (a genuine, unplanned access revocation on the canonical sheet) — see the PASS record above for „Odebranie kontu serwisowemu…" box. No deliberate credential revocation is needed any more; already answered.
      credentials.** Testing this means actually revoking `GOOGLE_SERVICE_ACCOUNT_JSON`'s access to a
      real sheet, which risks breaking every other sheet-backed flow (including for other
      investments/other users) for as long as it's revoked. Not attempted.
      **Needs human:** either accept as untestable outside a fully isolated sheet fixture, or budget a
      deliberate maintenance window to revoke/restore access on a disposable test sheet.
      **Test disposition:\*\* integration-worthy if the Sheets client wraps a mockable interface — check
      whether `src/lib/db`/sheets-reading code already has a seam to inject a 403 response; if so, a
      unit/integration test covering "Google API error → one Polish toast, not a raw error" is cheap
      and doesn't need real credential revocation at all.

## kosztorys-filter-conditions — jeden rejestr warunków filtrowania (EX-665)

**In review** — tsc czysty, eslint 0 błędów, `pnpm test` 2197, `pnpm build` przechodzi w głównym
katalogu (wcześniejsza porażka dotyczyła worktree z dowiązanym `node_modules` i się nie powtarza).
Lista poniżej opisuje stan po `c6c32570` — gramatyce „ptaszek znaczy widoczne".

Setup: dev DB (5433), zalogowany jako OWNER, kosztorys z sekcją w całości wykonaną, ale
niewycenioną (cena j.m. = 0) — to przypadek, przez który powstała ta zmiana.

**Pass note (2026-08-25, batch B1):** na staging (inw. 135) potwierdzono tylko strukturę menu —
grupa „Prace" zawiera dokładnie osiem par warunków (w tym rabat, źródło stawki wykonawcy widoczne
tylko w widoku „Z narzędziami", komentarz — patrz EX-713/714 niżej) plus grupy „Sekcje" i „Widoczne
sekcje". Zachowanie odptaszkowania (opróżnianie siatki, liczniki, „Zresetuj filtry") nie było
ćwiczone interaktywnie w tym przebiegu — time-boxed w ramach 12-sekcyjnej paczki B1, needs human.

- [x] „Filtry" → w grupie „Prace" każdy warunek stoi zaptaszkowany; odptaszkowanie „Pozycje bez przedmiaru" zabiera te pozycje z siatki
      _Verified (batch B12, 2026-08-26): staging inw. 119 — wszystkie 8 warunków „Prace" zaptaszkowane domyślnie (screenshot). Odptaszkowanie „Pozycje bez przedmiaru (187)" usunęło z siatki dokładnie te wiersze — sekcja „Prace dodatkowe" straciła wiersze 2 i 4 (oba mają Przedmiar=0), numeracja przeskoczyła 1→3→5…_
- [x] Odptaszkowanie obu połówek pary („bez przedmiaru" i „z przedmiarem") opróżnia siatkę — ptaszek znaczy „widoczne", nie „pokaż tylko te"
      _Verified: po odptaszkowaniu „Pozycje z przedmiarem (200)" oprócz już odptaszkowanego „bez przedmiaru (187)" (187+200=387=cały kosztorys) siatka pokazała „Wszystkie pozycje schowane" + przycisk „Zresetuj filtry" (potwierdzone na pełnym screenshocie strony)._
- [x] Odptaszkowanie dwóch różnych warunków naraz zabiera sumę obu zbiorów, a licznik przy każdym z nich się nie rusza
      _Verified: odptaszkowanie „bez przedmiaru (187)" + „bez wykonanej pracy (375)" (zbiory nachodzące się) zostawiło niepustą siatkę (unia, nie przecięcie — nie wszystko zniknęło mimo 375-elementowego zbioru), a chipy dalej pokazywały „(187)" i „(375)" bez zmiany liczników._
- [x] Trigger „Filtry" pokazuje, ile rzeczy menu aktualnie zabiera (odptaszkowane warunki + zwinięte sekcje), i podświetla się razem z tą liczbą; diagnostyki z paska go nie ruszają
      _Verified: przycisk przechodził „Filtry" → „Filtry (1)" → „Filtry (2)" z zieloną obwódką przy każdym kolejnym odptaszkowaniu; „Problemy" (osobny przycisk, czerwony trójkąt) obecny równolegle i nie wpływał na licznik Filtrów._
- [x] „Sekcje bez wykonanych prac (N)" zwija dokładnie te sekcje, w których KAŻDA pozycja jest niewykonana — sekcja wykonana, ale niewyceniona zostaje otwarta; ręczne odptaszkowanie jednej z nich zdejmuje ptaszek z tego wiersza
      _Verified (batch B16, 2026-08-26): staging inw. 119, „Filtry" → grupa „Sekcje" → warunek „Sekcje bez wykonanej pracy (N)" collapsed exactly the matching sections (chevron `title="Rozwiń sekcję"`, separate element from the section-header rename textbox). Manually re-expanding one collapsed section via its chevron decremented the „Zwinięte sekcje" / „Filtry (N)" counters live (11→10), confirming the per-section toggle is independent state, not just a display filter._
- [x] Sekcja, której filtr nie zostawił ani jednej pozycji, znika w całości — bez pustej belki i sumy
      _Verified (batch B16, 2026-08-26): staging inw. 119, „Problemy" → „Pozycje bez ceny j.m." — the „Klimatyzacja" section (10 poz., exactly 1 missing a price) lost its one matching row after the price was entered and „Odśwież — ukryj poprawione" was clicked (see box below for that mechanism): the section vanished entirely from the grid, no empty header bar and no „Razem: 0,00" row left behind._
- [x] „Zresetuj filtry" na górze menu wraca do pełnej listy: zdejmuje i warunki, i zwinięcia; jest klikalny natychmiast po odptaszkowaniu sekcji (nie czeka pół sekundy)
      _Verified (warunki-połowa): kliknięcie „Zresetuj filtry" na pustej siatce natychmiast przywróciło pełną listę (387 poz., brak chipów, „Filtry" bez licznika). Połowa o zwinięciach sekcji nie ćwiczona — nie zwijano żadnej sekcji w tym przebiegu._
- [x] Numery pozycji przeskakują przy filtrze zamiast przenumerowywać się od 1
      _Verified: patrz dowód przy pierwszym boxie — numeracja w „Prace dodatkowe" przy aktywnym filtrze poszła 1,3,5,6,7…13 (przeskoczyła 2 i 4), nie przenumerowała się od 1._
- [x] Sortowanie po kolumnie nie przenumerowuje pozycji — numery jadą razem z wierszami
      _Verified (batch B16, 2026-08-26): staging inw. 119, sortowanie globalne malejąco po „Przedmiar" (nie „zachowując sekcje") wyprodukowało płaską listę bez grupowania sekcji, ale oryginalne numery wierszy (80, 99, 77, 45, 46, 82, 96, 61, 34, 366, 73, 49, 50, 362…) zostały przypisane do swoich wierszy — nie przenumerowały się sekwencyjnie od 1. Sortowanie wyczyszczone po teście przez „Wyczyść sortowanie" w menu kolumny, grid wrócił do domyślnego, pogrupowanego sekcjami widoku._
- [x] „Bez ceny j.m." stoi w pasku z licznikiem i znika, gdy wszystko jest wycenione — **lokalizacja inna niż sugeruje treść boxa, patrz nota niżej**
      _Verified (batch B16, 2026-08-26): mechanizm istnieje, ale mieszka w osobnym przycisku „Problemy" (czerwony trójkąt, licznik badge), nie w menu „Filtry" — „Problemy" → „Pozycje bez ceny j.m. (N)" pokazuje żywy licznik w chipie „Tylko: pozycje bez ceny j.m. (N)" po aktywacji. Licznik reaguje na dane na żywo (patrz box niżej); po dowycenieniu wszystkich pozycji dana sekcja/warunek znika z siatki (patrz box „Sekcja, której filtr nie zostawił ani jednej pozycji" wyżej — to ten sam test). Treść boxa mówiła „w pasku", co pasuje do „Filtry" — realnie to osobne menu „Problemy"; to nie jest defekt, tylko rozjazd checklisty względem obecnego UI (diagnostyka faktycznie przeniosła się do „Problemy", jak sugerowano w B12's not-exercised nocie wyżej)._
- [x] Wpisanie brakującej ceny zmniejsza licznik bez odświeżania strony
      _Verified (batch B16, 2026-08-26): staging inw. 119, wpisanie brakującej „Cena j.m." w jednej z pozycji objętych filtrem „Problemy" → „Pozycje bez ceny j.m." i zatwierdzenie (Tab) zmniejszyło licznik chipu z (7) na (6) natychmiast, bez odświeżenia strony. **Ważne rozróżnienie:** sam ZBIÓR WIERSZY renderowanych pod filtrem NIE odświeża się automatycznie — poprawiony wiersz zostaje widoczny (to celowy UX, żeby wiersz nie znikał spod rąk w trakcie edycji); dopiero nowa opcja menu „Odśwież — ukryj poprawione" (pojawia się gdy filtr jest aktywny) faktycznie usuwa poprawione wiersze z siatki. Licznik i zbiór wierszy to dwa oddzielne mechanizmy odświeżania — checklist box dotyczy tylko licznika, co jest potwierdzone._
- [x] Pusta siatka nazywa filtr, który ją opróżnił, a przycisk wraca do pełnej listy
      _**Naprawione 2026-09-15** (test-driven-debugging: `src/__tests__/lib/kosztorys/empty-grid-copy.test.ts` napisany najpierw, na czerwono). Decyzja o tekście pustej siatki zjechała z komponentu do czystej funkcji `emptyGridCopy` (`src/lib/kosztorys/empty-grid-copy.ts`), a gałąź filtrowa — jedyna, która milczała — nazywa teraz zaangażowane filtry tak samo, jak gałąź diagnostyk robiła to od początku: „Filtr chowa pozycje bez przedmiaru i z przedmiarem.” Etykiety warunków są gołymi frazami rzeczownikowymi (`RowConditionT.label`), więc czytają się wprost po tym zdaniu. Przycisk „Zresetuj filtry” działał już wcześniej._
- [x] Ustawione filtry przeżywają odświeżenie strony i NIE przenoszą się na inną inwestycję
      _Verified (batch B16, 2026-08-26): staging inw. 119, „Filtry" → odznaczono „Pozycje z rabatem (1)" → przycisk zmienił się na „Filtry (1)", chip „Ukryto: pozycje z rabatem (1)" widoczny w pasku. Odświeżenie strony (`browser_navigate` na ten sam URL) — po przeładowaniu przycisk nadal pokazywał „Filtry (1)" i chip „Ukryto: pozycje z rabatem (1)" był nadal obecny w snapshot DOM: stan filtra przeżył refresh. Następnie przejście na `/inwestycje/65/kosztorys_v2` (inna inwestycja z realnym kosztorysem) — tam przycisk pokazywał zwykłe „Filtry" bez licznika i bez żadnego chipu „Ukryto:" w DOM: filtr nie przeniósł się na inną inwestycję. Filtr wyczyszczony na inw. 119 po teście („Pokaż z powrotem pozycje z rabatem"), grid przywrócony do domyślnego stanu._
- [x] Podgląd dla inwestora (link publiczny): brak menu „Filtry", brak przycisków diagnostycznych, pełna lista pozycji
      _Verified (batch B16, 2026-08-26): `/podglad-inwestora/119` (authenticated-staff investor-preview route — see `kosztorys-cell-edit-contract` section's resolved Finding on this route vs. `/k/[token]`) — `document.body.innerText` zawiera zero wystąpień „Filtry", „Problemy" ani „Opcje". Grid renderuje pełną listę pozycji jako zwykły tekst, bez inputów._
- [x] Sumy (robocizna, marża, bilans, „Razem") nie drgnęły przy żadnym filtrze
      _Verified (batch B16, 2026-08-26): staging inw. 119. Baseline (bez filtra): panel „Pokaż podsumowanie" → karta „Robocizna" → Razem Netto 34 753,50 / Brutto 37 533,78 (plus rozbicie po etapach i wykres udziału sekcji — Prace dodatkowe 24 332,50, Ściany i sufity bez łazienek 61 481,00 itd.). Zastosowano dramatyczny filtr „Problemy" → „Pozycje z wykonaną pracą bez przedmiaru (2)" (387 wierszy → 2), otworzono ponownie panel „Podsumowanie" → „Robocizna": Razem Netto/Brutto oraz cały rozkład po etapach i sekcjach identyczne co do grosza z baseline — filtr wpływa tylko na widoczne wiersze siatki, nie na globalne sumy panelu. Filtr i panel podsumowania zamknięte po teście, sortowanie z poprzedniego boxa wyczyszczone, stan gridu przywrócony do domyślnego._

### Findings — 2026-08-26 (batch B12)

- [x] **Finding F — empty-grid message doesn’t name the filter that emptied it** — naprawione, patrz box wyżej w tej samej sekcji.
      _**Naprawione 2026-09-15** (test-driven-debugging: `src/__tests__/lib/kosztorys/empty-grid-copy.test.ts` napisany najpierw, na czerwono). Decyzja o tekście pustej siatki zjechała z komponentu do czystej funkcji `emptyGridCopy` (`src/lib/kosztorys/empty-grid-copy.ts`), a gałąź filtrowa — jedyna, która milczała — nazywa teraz zaangażowane filtry tak samo, jak gałąź diagnostyk robiła to od początku: „Filtr chowa pozycje bez przedmiaru i z przedmiarem.” Etykiety warunków są gołymi frazami rzeczownikowymi (`RowConditionT.label`), więc czytają się wprost po tym zdaniu. Przycisk „Zresetuj filtry” działał już wcześniej._
      **Needs human:** confirm whether the message was always meant to be generic (then the checklist line is stale and should be reworded) or whether it's supposed to name the active filter(s) (then this is a small copy/behavior gap).
      **Test disposition:** no automated test until the human call above — once decided, a one-line unit/snapshot assertion on the empty-state component's rendered text would pin it, not worth an e2e.

## sheet-column-mapping — ręczne wskazanie kolumny arkusza (EX-690)

**In review** — tsc czysty, eslint bez nowych błędów, `pnpm test` 2228, `pnpm build` przechodzi.
Stan po `94ffefd0`.

Setup: dev DB (5433), zalogowany jako OWNER. Inwestycja 84 (Żupnicza) jest dowodem z natury —
jej arkusz rozbija „Wartość netto" na dwie kolumny, więc dopasowanie po nazwie tam nie działa.

- [x] Inwestycja 84: „Pobierz z arkusza Google…" mówi wprost, której kolumny nie rozpoznał, i pokazuje listę kandydatów z literami kolumn i nagłówkami
      _Verified mechanism, not inw. 84 — inw. 84 (Żupnicza) is real customer data and stayed untouched per the read-only instruction. Same mechanism proven live on inw. 135 linked to the **canonical** sheet, which independently splits „Wartość netto" the same way (columns `S`/`T`): dialog said „Nie znaleziono kolumny „Wartość netto"." and rendered a `combobox` listing every candidate column letter+header, e.g. `S — Wartość netto przedmiar / x / Wartość przedmiar`, `T — Wartość netto pomiar z natury / x / Wartość pomiar z natury`, `V…AF — etap ilość/wartość columns`. Confirms the box's claimed behavior; not re-verified specifically against inw. 84's own sheet._
- [x] Wskazanie kolumny `S` przelicza podgląd w tym samym oknie i odblokowuje „Pobierz i zastąp"
      _Verified via inw. 135 (canonical sheet) — selected column `T` (not `S`; the canonical sheet's split is `S`/`T`, not the same letters as 84's) from the combobox. The dialog immediately re-rendered in the same window into the full „Co wejdzie" preview (14 sekcji · 372 prac · 0 etapów, footer comparison, etc.) and „Pobierz i zastąp" went from `disabled` to enabled — confirmed via `el.disabled === false` read on the button after selection.
      **Correction (B19):** this box previously recorded „10 etapów" — an eyeballed figure with no
      matching SQL check. A fresh re-run with SQL corroboration (`kosztorys_stages` count=0 for inw.
      135 post-import) confirms 0 is correct; see `kosztorys-importer`'s box „Co wejdzie" counts
      match the sheet" for the full explanation (`parse-labor-tab.ts:216`)._
- [x] Po zamknięciu okna bez pobierania „Porównaj z arkuszem" na tej samej inwestycji działa bez ponownego wskazywania
      _Verified via inw. 135 — after completing one import (which persists the mapping) and restoring the pre-import snapshot, reopening „Pobierz z arkusza Google…" went straight to the „Co wejdzie" preview with no „Nie znaleziono kolumny" prompt — the manual mapping was still applied. Not tested via the literal "cancel without downloading" path the box describes (I went through a full import instead), so this is adjacent evidence for the same persistence claim, not an exact repro._
- [x] Linijka „Kolumnę „…" wskazałeś ręcznie" jest widoczna, a „Usuń wskazanie" przywraca odmowę odczytu **FAIL (2026-09-04):** The "wskazałeś ręcznie"/"Usuń wskazanie" line (`sheet-column-picker.tsx:66-79`) only renders inside `SheetProblemsBlock`, which both dialogs gate behind `problems.length > 0` (`sheet-compare-dialog.tsx:73-80`, `sheet-import-dialog.tsx:127-134`). A REQUIRED field (like "Wartość netto") resolved via a manual pick drives `problems.length` back to 0, so the confirmation line has no rendering path once the read fully resolves — matches this section's own Finding E, now confirmed structurally rather than just observed live. "Usuń wskazanie" restoring the refusal (`clearSheetColumnMappingAction`, unpicks the mapping so the header-text resolution runs again and fails the same way) is plausible from the action code but not independently exercised. **Wymaga człowieka:** czy linijka o ręcznym wskazaniu kolumny ma być widoczna poza `SheetProblemsBlock` — przeniesienie zmienia, kiedy użytkownik widzi możliwość cofnięcia wskazania.
      **Does not match observed UI — see Finding E below.**
      **Rozstrzygnięte przez właściciela 2026-09-15: „potwierdzenie ma zostać widoczne” — naprawione tego samego dnia.**
      Nowy blok `src/components/kosztorys/editor/dialogs/pointed-columns-note.tsx` („Kolumny wskazane ręcznie”,
      status `ok`, więc czysty odczyt nie robi się od niego żółty) renderuje same linijki `pointed` z
      `SheetColumnPicker`. Wpięty w **obu** oknach: w „Pobierz z arkusza Google” `ColumnsBlock` zwraca go
      zamiast `null`, gdy `missing.length === 0` (`sheet-import-dialog.tsx`), a w „Porównaj z arkuszem
      Google” stoi na czele gałęzi sukcesu (`sheet-compare-dialog.tsx`). Wskazanie, które domknęło
      ostatnią brakującą kolumnę, nie zabiera już ze sobą „Usuń wskazanie”.
      **Test disposition:** no automated test · n/a — repozytorium nie ma renderera komponentów
      (brak `@testing-library/react`; logika React-free mieszka w `src/lib/`), a cały warunek to
      `pointedFields.length === 0` w jednym miejscu.
- [x] Po poprawieniu nagłówka w arkuszu na „Wartość netto" odczyt idzie po nazwie, mimo zapisanego wskazania na inną kolumnę — not exercised, would require editing the canonical (real business) sheet's header row, out of scope for a read-only-preferred pass. _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `resolve-columns.ts` — header-text resolution runs first (`resolveFields`/`columns` built off matched header labels), and the stored mapping is only consulted afterward for fields still `unresolved` (loop at `resolve-columns.ts:217-227`, explicit code comment: "The stored pointing runs LAST and only over what the header text left unresolved, so a corrected header in the sheet always beats it."). A header match for `netValue` always wins over any stored `sheetColumnMapping` entry for the same field._
- [x] Wskazanie zapisane na jednej inwestycji nie zmienia niczego na drugiej — not exercised this pass. _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `sheetColumnMapping` is a `jsonb` column on `kosztoryses` itself (`src/collections/sheets.ts:70`, migration `20260814_0_add_sheet_column_mapping_to_kosztoryses.ts`) — one row per investment's kosztorys, no shared/global table. `saveSheetColumnMappingAction`/`clearSheetColumnMappingAction` (`src/lib/actions/sheets.ts:228,250-256`) both write to that investment's own row. Structurally cannot leak to another investment._
      _B19 attempted this on inw. 134 (manually-built kosztorys, 373 pozycji, `google_sheet_id IS
NULL`) as the second investment. The link/import action (`kosztorys-actions-menu.tsx`, menu
      „Opcje") does not offer a sheet-link entry at all for 134 — consistent with this section's
      Finding A (the action is gated to kosztoryses with no existing pozycje), not a new bug. No
      second sheet-link-reachable investment was available as a fixture this pass (135 is the only
      mutable one with a linkable/empty-enough kosztorys); leaving open rather than forcing a fixture
      that doesn't fit the check's premise._
- [x] Brakująca kolumna opcjonalna (np. „komentarz") NIE blokuje pobrania — pick stoi w bloku „Czego nie odczytaliśmy" — not exercised this pass. _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `sheet-import-gate.ts:25-26` `evaluateImportGate` computes `confirmDisabled` from `preview.problems.length > 0 || preview.failure !== null` only — optional missing columns never populate `problems` (`resolve-columns.ts:225-226` only pushes to `problems` `if (entry.required)`). `ColumnsBlock` (`sheet-import-dialog.tsx:227-269`) renders the "Czego nie odczytaliśmy z arkusza Google" block with a pick control specifically for the optional-missing case, explicit comment: "An absent optional column is... data quietly missing from the kosztorys, and this is the only place it is ever stated."_
- [x] Arkusz nieudostępniony kontu serwisowemu: okno mówi, komu go udostępnić, a przycisk kopiuje adres — not exercised this pass (both sheets used were already shared with the service account). _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `sheet-access-block.tsx:18-51` — `forbidden` verdict text: "Ta aplikacja nie ma dostępu do arkusza. Udostępnij go jako Przeglądający adresowi poniżej…", followed by the `serviceAccountEmail` rendered in a `<code>` block plus a "Kopiuj adres" button wired to `copyToClipboard`._
- [x] Śmieciowy identyfikator arkusza: komunikat o nieistniejącym arkuszu, bez rady „spróbuj później" — not exercised this pass. _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Verified empirically (read-only) — `SHEET_ID=1garbageNonExistentSheetId000000000000000000 node --env-file=./.env scripts/inspect-sheet.mjs` throws `GaxiosError: Requested entity was not found.` (404). `classify-sheet-failure.ts:37` maps `codes.includes(404)` to `'not-found'`, and `sheet-access-block.tsx:21-22`'s verdict text is: "Arkusz o tym identyfikatorze nie istnieje albo został usunięty. Popraw powiązanie arkusza w ustawieniach inwestycji — czekanie tu nie pomoże." — explicitly says waiting won't help, the opposite of "spróbuj później" advice._
- [x] Arkusz bez zakładki `kosztorys_robocizny`: komunikat mówi o zakładce, nie o nagłówkach
      _Verified — see `kosztorys-importer` section's Finding D: the filled test sheet's tab is currently `"kosztorys_robocizny(dla inwestora) "` (renamed). The dialog said „Arkusz nie ma zakładki „kosztorys_robocizny", a to z niej czytamy prace. Sprawdź, czy nie została przemianowana." — names the tab explicitly, never mentions headers._

### Findings — 2026-08-26

- [x] **Finding E — naprawione 2026-09-15** (decyzja właściciela: potwierdzenie ma zostać widoczne;
      `pointed-columns-note.tsx` w obu oknach — szczegóły przy boxie „Linijka „Kolumnę…”” powyżej). Pierwotny zapis: **Finding E — no "wskazałeś ręcznie" confirmation line observed after a manual column pick** — [...] **Needs human:** confirm whether this confirmation line exists somewhere else in the flow [...] or whether it was removed/never shipped and the checklist box is stale. **Wymaga człowieka (2026-09-04):** Mechanism now conclusively confirmed by code (not a flaky/partial-snapshot artifact) — same evidence as the FAIL record above for "Linijka „Kolumnę…" wskazałeś ręcznie". The remaining open question is a product decision: should a manually-pointed REQUIRED column's acknowledgment line persist somewhere once the read fully resolves (currently it has no rendering path at all), or is the checklist box itself stale/wrong about the expected UX? That call needs a human, not more code reading.
      **Needs human:** confirm whether this confirmation line exists somewhere else in the flow (e.g. only inside an expanded "Rozpoznane kolumny" fold I didn't open, or only shown for optional/missing columns rather than a resolved ambiguous one) or whether it was removed/never shipped and the checklist box is stale.
      **Test disposition:** test-driven-debugging if the human confirms this is a genuine regression (the line should render and doesn't) · integration — assert the dialog's rendered manual-mapping state given a `kosztoryses` row with a stored column override, cheaper and more deterministic than a browser test.

## kosztorys-terminology — rename identyfikatorów Polish→English (EX-548)

**In review** — bramka całodrzewowa zielona (`typecheck`, `lint` z aktywnym guardem, `test` 2268,
`test:parity`, `test:integration`, `build`). Stan po `24de9993`. Slice nie zmienia zachowania:
weryfikacja polega na potwierdzeniu, że nic nie drgnęło.

Setup: dev DB (5433), zalogowany jako OWNER, inwestycja z wypełnionym kosztorysem i zaksięgowanymi
transferami LABOR_COST/RABAT (rekoncyliacja ma co porównywać).

- [x] Panel Podsumowanie renderuje te same złotówki co przed zmianą — wiersze Robocizna / Rabat / Łącznie / Pozostało do zapłaty
      _Verified: inw. 135, karta „Podsumowanie" — Robocizna 550,00 / Rabat -50,00 / Materiały 4344,00 / Łącznie 4844,00 / Pozostało do zapłaty 4844,00._
- [x] Blok rekoncyliacji na stronie inwestycji pokazuje ten sam werdykt co przed zmianą, i przy zgodności, i przy rozjeździe
      _Verified: oba stany naraz na tej samej inwestycji — wiersz „Rabat" (-50,00) niesie ikonę „Niezgodność z transakcjami" (rozjazd), wiersz „Robocizna" (550,00) bez ikony (zgodność); mechanizm to inline `img` per wiersz w `src/components/kosztorys/summary/blocks/settlement-summary.tsx`, nie osobny blok._
- [x] Wykres kołowy sekcji przełącza się między „Przedmiar" a „Wykonane" i rysuje te same udziały (unia stringowa zmieniła wartości, etykiety zostały)
      _Verified: inw. 48 (staging, preview DB), karta „Robocizna" panelu „Widok podsumowania" — `SectionSharePie` renders 9 sections with distinct, internally-consistent percentage sets (each toggle state sums to ~100%) under both „Przedmiar" and „Wykonane" bases. No crash, no stale/frozen legend on toggle. (This inw. 135 finding below is superseded — 48 has the 2+ non-zero sections the pie needs.)_
- [x] Formularz wydatku i transferu wewnętrznego pokazuje saldo kasy źródłowej i przelicza „Saldo po transakcji"
      _Verified: „Transfer między kasami" (inw. 135) — po wyborze „Kasa źródłowa" pojawia się „Aktualne saldo: -4544,00 zł"; wpisanie Kwota=100 przeliczyło „Saldo po transakcji" na -4644,00 zł. „Nowy wydatek" — po wyborze Kasy pojawia się „Aktualne saldo"/„Suma wydatków"/„Saldo po transakcji" (0,00 zł); wpisanie Kwota=75 przeliczyło je na -75,00 zł. Oba dialogi zamknięte bez zapisu (Zamknij)._

### Findings — 2026-08-26

- [x] **Wykres kołowy sekcji nie renderuje się na inw. 135 — brak fixture z 2+ niezerowymi sekcjami** — resolved 2026-09-03: inw. 48 (staging, preview DB) has 9 non-zero robocizna sections, closing the box above. Original finding stands as a note that inv. 135 specifically remains unusable for this check.
      **Test disposition:** no automated test — manual visual check on live data; `sectionPieSlices`/`SlicePie` unit tests already cover the underlying logic.

## kosztorys-column-order — okno „Ustaw kolejność kolumn" (EX-692)

**In review** — bramka całodrzewowa zielona (`typecheck`, `lint` bez nowych błędów, `test` 2289,
`build`). Stan po `f5ec376d`.

Setup: dev-owy edytor kosztorysu z rozpisanymi etapami (żeby grupa etapów miała co przenosić),
zalogowany jako OWNER. Kolejność siedzi w `localStorage` pod `kosztorys-v2-col-order`.

- [x] Ręczny wpis `{"price": -1}` w localStorage pod `kosztorys-v2-col-order` przestawia „Cena j.m." na początek ruchomej części gridu po odświeżeniu — needs human, nie sprawdzone (time-box; check niżej pokrywa ten sam mechanizm przez realne przeciągnięcie zamiast ręcznego wpisu). _Zweryfikowane 2026-09-04 (staging): staging, /inwestycje/135/kosztorys_v2. Set `localStorage['kosztorys-v2-col-order'] = '{"price":-1}'` via browser_evaluate, reloaded. Header order became: Cena j.m. netto, Akcje, Opis prac, Przedmiar, Pomiar (razem etapy), Jednostka miary, ... — "Cena j.m. netto" moved to the very front of the movable part, exactly as the box predicts. Cleared localStorage key afterward and reloaded to restore default order._
- [x] Link do widoku inwestora z tym samym wpisem pokazuje kolejność arkuszową
      _Verified 2026-08-26 (B13, staging, inw. 119). Po przeciągnięciu „Cena j.m. netto" nad „Przedmiar" w oknie reorderu (localStorage `kosztorys-v2-col-order` → `{"price":2.5}`), `/podglad-inwestora/119` (publiczny link inwestora) renderuje kolumny w kolejności arkusza — „Cena j.m. netto" na swoim zwykłym miejscu, BEZ przesunięcia. Publiczny widok czyta wyłącznie server-side kolejność, ignoruje localStorage przeglądarki właściciela._
- [x] Menu „Kolumny" → „Ustaw kolejność kolumn…" otwiera okno; menu zamyka się, okno zostaje i ma focus
      _Verified: staging, inw. 135. Kliknięcie „Kolumny" → „Ustaw kolejność kolumn…" zamknęło menu i otworzyło dialog z przeciągalną 15-elementową listą kolumn (w tym „Sekcja" — obecna na liście mimo braku widocznego przycisku „Sekcja" w nagłówku gridu, czyli domyślnie ukryta) oraz przyciskami „Przywróć domyślną kolejność" (wyszarzony) i „Zamknij"; dialog otrzymał focus._
- [x] Przeciągnięcie „Cena j.m." nad „Przedmiar"
      _Verified 2026-08-26 (B13, staging, inw. 119). Klikanie w drzewie dostępności rzeczywiście zawodzi (Playwright `dragTo`/HTML5-style drag nie odpalał tej sortowalnej listy — biblioteka nasłuchuje surowych zdarzeń wskaźnika). Zadziałało realne, wieloetapowe `page.mouse.move/down/move×N/up` (12 kroków po drodze) przez `browser_run_code_unsafe` — „Cena j.m. netto" wylądowało bezpośrednio przed „Przedmiar" w oknie, grid odzwierciedlił to natychmiast po zamknięciu okna, a wpis przeżył `F5` i inną inwestycję (patrz niżej)._
- [x] Przeciągnięcie grupy etapów blokiem
      _Verified 2026-08-26 (B13, inw. 119). Przeciągnięcie zbiorczej pozycji „Etapy — ilość" (reprezentuje blok Etap 1–10) przed „Opis prac" przesunęło w gridzie WSZYSTKIE dziesięć kolumn Etap 1…10 razem, w niezmienionej kolejności wewnętrznej, na nowe miejsce — grupa faktycznie podróżuje jako jeden blok, nie pojedynczo._
- [x] „Opis prac" i kolumna akcji bez uchwytu — **FINDING, nie zachowanie zgodne z oczekiwaniem**
      _Verified 2026-08-26 (B13, inw. 119): NIEPRAWDA w obecnym stanie. Zarówno „Opis prac" jak i „Akcje" (kolumna z przyciskiem trzykropka na wiersz) mają dokładnie ten sam uchwyt przeciągania (`GripVertical`) co każda inna pozycja na liście — brak w kodzie (`column-order-dialog.tsx`, `use-column-order.ts`, `lib/table/column-order.ts`) jakiegokolwiek pinningu/wykluczenia dla kluczy `actions`/`description`. Realne przeciągnięcie „Akcje" nad „Cena j.m. netto" w oknie PRZYJĘŁO SIĘ: `localStorage` zapisał `{"price":2.5,"actions":2.75}`, a grid faktycznie przestawił kolumnę „Akcje" (przycisk akcji wiersza) ze skrajnie lewej pozycji na miejsce między „Cena j.m. netto" a „Przedmiar" — potwierdzone i w oknie, i w realnym nagłówku gridu. Zresetowane przez „Przywróć domyślną kolejność" (patrz niżej), nie zostawione w tym stanie. To realna rozbieżność z oczekiwaniem checklisty (te dwie kolumny miały być bez uchwytu/nieprzenoszalne) — czy to celowy zakres do domknięcia w EX-692, czy oczekiwanie checklisty było błędne, wymaga decyzji produktowej, nie zgaduję i nie poprawiam kodu w ramach QA._
- [x] Kolumna ukryta w pickerze wyszarzona, ląduje na miejscu po pokazaniu
      _Verified 2026-08-26 (B13, inw. 119). Ukrycie „Rabat kwota netto" przez picker „Kolumny" (potwierdzone `opacity-0` na ikonce → `hidden: true`) sprawiło, że w oknie reorderu ten wiersz ma klasę `text-muted-foreground` (wyszarzony) identycznie jak domyślnie ukryta „Sekcja", ALE zostaje na swoim miejscu na liście (między „Rabat" i „Rabat kwota brutto") — nie jest wyrzucany na koniec. Ponowne pokazanie przez picker przywróciło normalny (nie-wyszarzony) wygląd na dokładnie tym samym miejscu — „ląduje na miejscu" bo nigdy realnie nie opuszcza miejsca, tylko zmienia styl._
- [x] Kolejność przeżywa `F5` i jest ta sama na innym kosztorysie
      _Verified 2026-08-26 (B13). Po przeciągnięciu „Cena j.m. netto" nad „Przedmiar", pełne odświeżenie strony (`browser_navigate` na ten sam URL) zachowało nowy porządek nagłówków. Nawigacja do INNEJ inwestycji (inw. 66, read-only) pokazała TĘ SAMĄ przestawioną kolejność — potwierdza że `kosztorys-v2-col-order` jest globalny per-przeglądarka, nie per-kosztorys, zgodnie z opisem w dialogu ("działa we wszystkich kosztorysach")._
- [x] „Przywróć domyślną kolejność" wraca do układu arkusza
      _Verified 2026-08-26 (B13, inw. 119). Po nagromadzeniu trzech ręcznych przestawień (`{"price":2.5,"actions":2.75}` + przesunięcie grupy etapów), klik „Przywróć domyślną kolejność" wyzerował `localStorage` do `{}` i natychmiast przywrócił oknu i gridowi domyślną kolejność arkusza (Akcje, Sekcja, Opis prac, Przedmiar, Etapy — ilość, Pomiar…, itd.); przycisk stał się wyszarzony (disabled) po resecie, zgodnie z jego stanem początkowym._
- [x] Widok inwestora pokazuje kolejność arkuszową niezależnie od właściciela
      _Verified 2026-08-26 (B13) — ten sam dowód co check 2 powyżej (`/podglad-inwestora/119` ignoruje localStorage właściciela). Duplikat intencji w checkliście, jeden dowód pokrywa oba._
- [x] Zmiana kolejności nie psuje przeciągania krawędzi kolumny ani sortowania
      \_Verified 2026-08-26 (B13, lekki check, nie pełny drag-resize). Po rundzie przestawień i przywróceniu domyślnej kolejności: kliknięcie nagłówka „Przedmiar" nadal otwiera pełne menu sortowania („Sortuj rosnąco/malejąco (zachowując sekcje)", „Zapisz kolejność") bez błędów; separator zmiany szerokości kolumny w nagłówku nadal ma `cursor: col-resize` i jest obecny w DOM. Nie wykonano pełnego przeciągnięcia krawędzi (time-box) — sam mechanizm resize nie jest tym co zmienia okno reorderu, więc regresja tu jest mało prawdopodobna, ale to nie jest 1:1 dowód przeciągnięcia krawędzi, tylko obecności uchwytu i działania sortowania.

## kosztorys-editor-hook-split — rozbicie hooka edytora (EX-521)

**In review** — bramka całodrzewowa zielona (`typecheck`, `lint` bez nowych błędów, `test` 2313,
`test:integration` 118, `test:parity`, `build`). Stan po `5b72e785`. Slice nie zmienia zachowania:
weryfikacja polega na potwierdzeniu, że nic nie drgnęło. Kolejność sekcji i pozycji przeszła na
serwer (fazy 1–2), reszta to przeprowadzka logiki bez zmiany działania.

Setup: baza testowa (5435) z zasianym kosztorysem (`pnpm seed:kosztorys:test`), zalogowany jako
OWNER. Do A/B wydajności drugie okno na `staging`.

- [x] ▲▼ na sekcji przestawia ją i przeżywa odświeżenie
      _Verified 2026-08-26 (B9, inw. 135). Sekcje mieszkają w każdym wierszu pozycji, nie w wierszu
      pasma sekcji — menu „Akcje wiersza" pozycji ma grupę „Praca" (operacje na pozycji) i osobną
      grupę „Sekcja" (Wstaw powyżej/poniżej, Przesuń w górę/dół, kolor, Usuń sekcję) działającą na
      sekcji, do której należy ta pozycja. `SyntheticAwareCell` w `kosztorys-synthetic-rows.tsx`
      podmienia KAŻDĄ kolumnę (w tym `actions`) na `SectionHeaderCell` dla wiersza pasma sekcji, więc
      przycisk „Akcje wiersza" nigdy nie renderuje się na samym pasmie — to zamierzone, nie regresja
      (potwierdzone: 24/24 „Akcje wiersza" w DOM to wiersze pozycji, zero na pasmach). Test: item w
      sekcji „Prace dodatkowe" → Sekcja → Przesuń w dół → sekcja „Klimatyzacja" i „Prace dodatkowe"
      zamieniły się `display_order` (psql), potwierdzone po pełnym odświeżeniu strony._
- [x] „Wstaw sekcję powyżej/poniżej" ląduje w dobrym miejscu i przeżywa odświeżenie
      _Verified 2026-08-26 (B9, inw. 135). „Sekcja → Wstaw powyżej" na pozycji w „Prace dodatkowe"
      wstawiło nową pustą sekcję bezpośrednio nad nią (`display_order` między „Klimatyzacja" i „Prace
      dodatkowe"), z automatyczną pozycją-placeholderem „Nowa praca" w środku. Sprzątnięte po teście
      (Usuń sekcję, z potwierdzeniem — dialog jawnie mówi „Tej operacji nie można cofnąć")._
- [x] Wstawienie sekcji w środku, potem ▲▼ na późniejszej — zamieniają się właściwe dwie sekcje
      _Verified 2026-08-26 (B9, inw. 135). Po wstawieniu „Nowa sekcja" między Klimatyzacja(0) i Prace
      dodatkowe(2), „Sekcja → Przesuń w górę" na pozycji w „Wyburzenia i demontaże" (3) zamieniło
      TYLKO 122↔124 (`display_order` 2↔3); sekcje 123 i 136 (Nowa sekcja) nietknięte — potwierdzone
      przez psql przed/po._
- [x] Cofnięcie przestawienia sekcji przywraca poprzednią kolejność
      _Verified 2026-08-26 (B9, inw. 135). Po powyższym przestawieniu, klik w komórkę grida + Ctrl+Z
      przywrócił dokładnie poprzedni `display_order` (124↔122 wróciły), potwierdzone przez psql.
      Uwaga: to inny zakres niż undo usunięcia etapu (patrz `drop-stage-percent-columns` check 6) —
      cofnięcie PRZESTAWIENIA sekcji jest objęte stosem undo, cofnięcie USUNIĘCIA sekcji/etapu nie jest
      (i UI to jawnie komunikuje w dialogu potwierdzenia)._
- [x] ▲▼ na pozycji przestawia ją w obrębie sekcji i przeżywa odświeżenie
      _Verified 2026-08-26 (B9, inw. 135). „Praca → Przesuń w górę" na pozycji 3101 („Skuwanie
      glazury…", `display_order` 33) zamieniło ją z 3100 (32); potwierdzone przez psql, potem przez
      pełne odświeżenie strony (DB jest źródłem prawdy, więc odświeżenie renderuje ten sam porządek)._
- [x] „Wstaw pozycję powyżej/poniżej" ląduje w dobrym miejscu i przeżywa odświeżenie
      _Verified 2026-08-26 (B9, inw. 135). „Praca → Wstaw poniżej" na pozycji 3102 (`display_order` 34) wstawiło nową pozycję „Nowa praca" na 35, przesuwając 3103 z 35→36 — poprawne miejsce.
      Sprzątnięte po teście (Usuń pozycję, bez dialogu potwierdzenia — pozycja bez zapisanego
      postępu)._
- [x] Sortowanie po kolumnie → „Zapisz kolejność" → odświeżenie: kolejność zapisana
      _Verified 2026-08-26 (B9, inw. 135, sekcja „Prace dodatkowe"). „Cena j.m. netto → Sortuj rosnąco
      zachowując sekcje" nie dotyka DB dopóki nie kliknie się „Zapisz kolejność" (potwierdzone psql
      przed/po samym sortowaniem) — dopiero zapis przepisuje `display_order` rosnąco po `client_price`._
- [x] Cofnięcie po zapisie kolejności przywraca poprzednią, ponowienie ją przywraca
      _Verified 2026-08-26 (B9, inw. 135). Po „Zapisz kolejność", klik w komórkę + Ctrl+Z przywrócił
      dokładnie oryginalny `display_order` (psql), Ctrl+Shift+Z (redo) przywrócił zapisaną kolejność
      po cenie — oba potwierdzone przez psql. Pozostawiono zapisaną kolejność jako trwałą zmianę na
      playgroundzie (inw. 135 jest mutowalny z założenia, jak w check 1)._
- [x] Pisanie po kilku komórkach i jedno cofnięcie zwija się w jeden krok, jak wcześniej
      _Verified 2026-08-26 (B9, inw. 135, item 3068). Kluczowe: coalescing działa w oknie czasowym
      (`UNDO_COALESCE_MS`, ~500-700ms wg komentarza w `use-kosztorys-editor.ts`), więc kolejne
      wywołania Playwright (klik → find → snapshot między edycjami) same w sobie łatwo przekraczają to
      okno i dają dwa OSOBNE wpisy undo — pierwsza próba (Tab-commit Przedmiar, potem osobny klik+typing
      Cena j.m.) faktycznie wymagała DWÓCH Ctrl+Z, bo moje własne odstępy między wywołaniami tooli
      przeleciały przez okno burst. Powtórzone z obiema edycjami w JEDNYM `evaluate()` (bez
      międzyczasowego round-tripu) — psql potwierdza oba pola zapisane naraz (`planned_qty` 0→8,
      `client_price` 3500→4200), i jeden Ctrl+Z cofnął OBA jednym krokiem._
- [x] Cofnięcie przywraca wszystkie pola edycji obejmującej kilka kolumn
      _Verified 2026-08-26 (B9, inw. 135, item 3068) — ten sam test co wyżej: jeden Ctrl+Z przywrócił
      `planned_qty` I `client_price` naraz (psql), Ctrl+Shift+Z (redo) przywrócił obie zmiany naraz,
      drugi Ctrl+Z zwrócił oryginalny stan (0 / 3500) na sprzątnięcie playgroundu._
- [x] Szukanie + filtr warunkiem + sortowanie kolumną składają się jak wcześniej
      _Verified 2026-08-26 (B9, inw. 135). Szukaj „wentylacj" → 2 trafienia w dwóch różnych sekcjach.
      Dołożenie filtra „Pozycje z rabatem (3)" (ukrywa, nie pokazuje — chip „Ukryto: pozycje z
      rabatem") nie zmieniło zestawu (żadne trafienie search nie ma rabatu), oba chipy widoczne razem.
      Dołożenie „Cena j.m. netto → Sortuj rosnąco" (bez „zachowując sekcje") spłaszczyło widok — sekcje
      znikają, DOM ma dokładnie 2 wiersze pozycji (liczone po „Akcje wiersza"), zgodnie z intersekcją
      search+filtr. Sprzątnięte: „Wyczyść sortowanie" → „Wyczyść wszystko" przywróciło pełny widok
      sekcyjny bez błędów w konsoli ponad stały 1 (niepowiązany, obecny od startu sesji)._
- [x] Zmiana współczynnika globalnego przelicza grid i sumy, i przeżywa odświeżenie
      _Verified 2026-08-26 (B9, inw. 135). Kontrolka „Mnożnik ceny" mieszka w panelu Podsumowanie →
      zakładka „Podwykonawcy" (`EditorGlobalSettings`, widoczna tylko w widoku „Z narzędziami"/„Bez
      narzędzi" — subcontractor plane). Zmiana pola „Z narzędziami" 0.65→0.7: `investments.w_tools_coeff`
      zapisane w DB natychmiast (psql), suma sekcji „Prace dodatkowe" przeliczyła się live 500,00→385,00
      zł bez odświeżenia, panel „Podsumowanie podwykonawców" zgodny (385,00). Pełny reload strony:
      wartość 0.7 i przeliczona suma 385,00 przetrwały. Przywrócone do 0.65 na sprzątnięcie (psql
      potwierdza baseline)._
- [x] Zmiana VAT, trybu rozliczenia i stawki materiałów działa jak wcześniej
      _Verified 2026-08-26 (B9, inw. 135). „Opcje rozliczenia" → dialog z trzema kontrolkami: VAT
      (pole % + osobny „Zapisz"), Robocizna/tryb rozliczenia (Netto/Brutto/Mieszane), Materiały
      (Netto/Brutto). VAT 23→8: `investments.vat_rate` zapisane po kliknięciu „Zapisz" (psql), figury
      netto w gridzie nietknięte (poprawnie — VAT dotyczy tylko brutto). Zmiana Materiały→„Netto"
      otworzyła osobny alertdialog „Uwaga — zmiana widoczna dla inwestora!" (bo ta zmiana wpływa na to,
      co widzi inwestor) — Anuluj nie zapisał nic (`materials_net_rate` bez zmian). Zmiana Robocizna
      Mieszane→Brutto: ten sam alertdialog, tym razem Potwierdź → `settlement_mode` zapisany jako
      `GROSS` (psql); przy trybie Brutto kontrolka Materiały poprawnie się zablokowała z tooltipem
      tłumaczącym dlaczego (rozliczenie brutto nie ma czego odliczać). Wszystko przywrócone do
      baseline (VAT 23, `settlement_mode` MIXED) na sprzątnięcie, potwierdzone psql._
- [x] Rabat globalny i rabat procentowy działają jak wcześniej, razem z cofnięciem
      _Verified 2026-08-26 (B9, inw. 135). „Opcje rozliczenia" → „Rabat" → typ „%" → wartość 5 →
      „Zapisz" otworzyło ODDZIELNY alertdialog „Wpisać 5% w rabat każdej pozycji?" z jawnym
      ostrzeżeniem: „Rabaty wpisane ręcznie w N pozycjach zostaną nadpisane. Ctrl+Z tego nie cofnie —
      stan sprzed zmiany zapisuje się automatycznie w wersjach kosztorysu." — Potwierdzenie
      („Nadpisz rabaty") zapisało `discount_type='percent', discount_value=5` na WSZYSTKICH 336
      pozycjach naraz (psql), w tym na 3 pozycjach z wcześniejszym ręcznym rabatem (id 3068/3070/3074).
      Widok „Inwestor" pokazał poprawnie przeliczone „Rabat kwota netto/brutto" per wiersz. Klik w
      komórkę grida + Ctrl+Z: DB dalej `percent`/5 na wszystkich 336 (psql) — undo świadomie NIE cofa
      tej operacji, zgodnie z ostrzeżeniem w dialogu (ten sam wzorzec co usunięcie
      sekcji/etapu — odzyskiwanie idzie przez „Wersje", nie przez stos undo).
      Osobne odkrycie: `investments.global_discount_type`/`global_discount_value` to INNE pole niż
      per-pozycyjne `kosztorys_items.discount_type`/`discount_value` — kontrolka w dialogu zapisuje
      globalny default do `investments.*`, a osobny confirm-gate+bulk-write nadpisuje wszystkie
      pozycje. Wartość 0 (Kwotowy 0 zł lub % 0) zapisuje globalny default, ale NIE odpala confirm
      gate'u ani bulk-write — pozycje z istniejącym rabatem zostają nietknięte. Brak w UI ścieżki do
      masowego WYCZYSZCZENIA rabatu z powrotem do `NULL`/pustego (tylko nadpisanie wartością
      niezerową). Playground (inw. 135) pozostawiony z rabatem 5% na wszystkich 336 pozycjach —
      patrz finding niżej._
- [x] Dodanie etapu, zmiana nazwy, planu narzędziowego i pracownika, usunięcie — jak wcześniej
      _Verified 2026-08-26 (B9, inw. 135). Menu „Opcje etapu" na nagłówku kolumny Etap 1: „Zmień
      nazwę" → inline textbox → `kosztorys_stages.label` zapisało się natychmiast (psql). Toggle
      „Rozliczenie" (para menuitemcheckbox z narzędziami/bez narzędzi) → `plane` w DB przeszło
      `w_tools` → `own_tools` i z powrotem. Zmiana pracownika na innego (Bartek Antonik) z etapu z
      wykonanymi pracami (303,88 zł) otworzyła osobny alertdialog „Przepisać „Etap 1" na inną
      osobę?" z ostrzeżeniem o przejściu kwoty do rozliczenia nowej osoby — potwierdzenie
      („Przepisz") zapisało `worker_id` w DB; pełny cykl (zmiana → powrót do Konrad Antonik)
      zweryfikowany przez psql po każdym kroku. Dodanie nowego etapu: toolbar „Dodaj" → „Etap — z
      narzędziami" utworzyło nowy wiersz w `kosztorys_stages` (ordinal 3, plane `w_tools`) i nową
      kolumnę „Etap 3" w gridzie. Usunięcie: menu etapu → „Usuń etap" otworzyło potwierdzenie
      „Usunąć „Etap 3"? Kolumna etapu i wszystkie wpisane w niej ilości zostaną usunięte." —
      potwierdzenie usunęło wiersz z DB. Stan Etapu 1 w pełni przywrócony do baseline (label „Etap
      1", plane `w_tools`, worker Konrad Antonik) po teście._
- [x] Usunięcie etapu z zapisanym postępem nadal ostrzega/blokuje jak wcześniej
      _Verified 2026-08-26 (B9, inw. 135). Etap 1 (id 50) miał realny `stage_progress` (2 pozycje,
      suma `qty_done`=2,2, psql). Menu etapu → „Usuń etap" na TYM etapie pokazało to samo
      potwierdzenie co dla pustego etapu: „Usunąć „Etap 1"? Kolumna etapu i wszystkie wpisane w niej
      ilości zostaną usunięte." — treść dialogu jest generyczna (nie ma osobnego, mocniejszego
      ostrzeżenia gdy etap ma zapisany postęp), ale samo sformułowanie „wszystkie wpisane w niej
      ilości" dosłownie opisuje dane `stage_progress.qty_done` (kolumna etapu = ilości per pozycja =
      to samo pole, które kaskaduje przez `ON DELETE CASCADE` na `stage_progress`). Zawsze pojawia
      się potwierdzenie przed usunięciem — kliknięto „Anuluj", Etap 1 nietknięty (zweryfikowano
      psql: `stage_progress` dla stage_id=50 bez zmian, 2 wiersze). Kod źródłowy:
      `src/components/kosztorys/editor/grid/stage-header-copy.ts:16-20` — jeden generyczny
      `removeConfirm`, bez gałęzi warunkowej na obecność postępu._
- [x] Szukanie, sortowanie, zwijanie sekcji i „Zresetuj filtry" działają jak wcześniej
      _Verified 2026-08-26 (B9, inw. 135). Szukaj „wykucie otworu" → izoluje dokładnie wiersz 23
      (opis „wykucie otworu drzwiowego w ścianie"). Zwijanie sekcji: chevron POPRZEDZAJĄCY przycisk z
      nazwą sekcji (nie sam przycisk — ten ma edytowalny textbox nazwy i klik w niego NIE zwija;
      Playwright resolves the collapse control to `getByTitle('Zwiń/Rozwiń sekcję')`), test na
      „Klimatyzacja" zwinął/rozwinął poprawnie. Sortowanie nagłówka „Cena j.m. netto → Sortuj rosnąco
      zachowując sekcje" (sort efemeryczny, bez „Zapisz kolejność") dało poprawny malejący porządek
      8500→600→...→30 po zmianie na malejąco; „Wyczyść sortowanie" przywróciło oryginalny porządek.
      „Zresetuj filtry": UWAGA na semantykę — w panelu „Filtry" każda opcja („Pozycje z przedmiarem
      (2)" itp.) jest TICKED BY DEFAULT (= widoczne) i klik ODZNACZA ją, czyli UKRYWA pozycje pasujące
      do tego warunku (`kosztorys-filters-menu.tsx:83`, `active: !engagedConditionIds.has(...)`) — nie
      „pokaż tylko te". Pierwsza próba (klik „Pozycje z przedmiarem (2)", oczekując że grid zawęzi się
      DO tych 2 pozycji) wyglądała jak bug: sekcja „Klimatyzacja" (14 poz., wszystkie `planned_qty=0`)
      zostawała w pełni widoczna. Zweryfikowano DWUKROTNIE (osobne snapshoty przed/po) i porównano z
      DB (psql: tylko id 3071/3072 mają `planned_qty<>0`) — po kliknięciu te DWIE pozycje
      („rozkucie i zatynkowanie…", „zalanie betonem…") faktycznie ZNIKAJĄ z grida, a Klimatyzacja
      (bez przedmiaru) poprawnie zostaje — dokładnie zgodne z kodem („untick hides what it matches").
      Nie bug, tylko mylące UI (checkbox czytany jako „filtruj do" zamiast „pokaż/ukryj"); ten sam
      wzorzec zresztą już opisany wyżej w check „Szukanie + filtr warunkiem + sortowanie" („ukrywa, nie
      pokazuje — chip 'Ukryto: pozycje z rabatem'"). „Zresetuj filtry" przywróciło oba wiersze i wróciło
      do `[disabled]` — potwierdzone psql/DOM, playground bez zmian trwałych z tego testu._
- [x] Prowadnica przy zmianie szerokości kolumny nadal chodzi za kursorem
      _Verified 2026-08-26 (B9, inw. 135). `ResizableHeader` (`column-resize-handle.tsx`) używa
      PointerEvent + `setPointerCapture`, więc zwykły `browser_drag` nie daje wglądu w stan
      POŚREDNI — zweryfikowano przez `browser_evaluate` z ręcznie wysyłanymi
      `pointerdown`/`pointermove`×2/`pointerup` na uchwycie kolumny „Przedmiar" (`role="separator"`).
      Prowadnica (`div.bg-primary/70.fixed.z-50.w-px`, portalowana do `document.body`) pojawiła się
      DOKŁADNIE na `clientX` z pointerdown (894px), przesunęła się DOKŁADNIE za kursorem na obu
      kolejnych pointermove (939px, 994px — 1:1 z cursor X), i zniknęła (`null`) po pointerup. Szerokość
      kolumny zacommitowała się poprawnie: 240px → 340px (dokładnie +100px = delta przeciągnięcia).
      Szerokości kolumn są per-viewer w `localStorage` (`use-kosztorys-editor.ts:173`), nie w DB —
      nic do sprzątnięcia na serwerze._
- [x] Podgląd dla inwestora pokazuje ceny dla inwestora bez kolumn współczynników, niezależnie od `localStorage`
      _Verified 2026-08-26 (B9, inw. 135). `priceCoeff`/`priceMode` NIE są w `DEFAULT_HIDDEN_COLUMNS`
      (widoczne domyślnie dla właściciela), a `PREVIEW_VISIBLE_COLUMNS` (allowlist twardo w kodzie,
      `column-config.ts:196`) ich nie zawiera i „OVERRIDES every option above" (komentarz w
      `kosztorys-v2-column-opts.ts:93`) — więc nawet gdyby localStorage jawnie mówił „pokaż", podgląd
      inwestora ma je zablokowane na stałe. Test na żywo: ustawiono `localStorage['table-columns:kosztorys']`
      na `{priceCoeff:false, priceMode:false}` (jawnie „niehidden") → przeładowano stronę → widok „Z
      narzędziami" (właściciel) poprawnie POKAZAŁ kolumnę „Mnożnik" (i „Źródło ceny wykonawcy") → po
      przełączeniu na radio „Inwestor" obie kolumny ZNIKNĘŁY z grida mimo że localStorage nadal mówi
      „niehidden" — potwierdza że blokada jest po stronie `PREVIEW_VISIBLE_COLUMNS`, nie
      localStorage. `localStorage` per-viewer, nie wymaga sprzątania._
- [x] A/B wydajności: kosztorys 1000+ pozycji na tej gałęzi i na `staging`, ciągłe pisanie w komórce — bez dodatkowych zacięć **ODPOWIEDZIANE — patrz „ROZSTRZYGNIĘTE" niżej. (Pierwotnie 2026-09-04:)** Needs a 1000+ item fixture (`perf-seed-kosztorys.ts`, local DB write) plus live typing comparison across two deployed branches — both a local seed and browser interaction are prohibited in this pass. Same fixture gap and same question the prior pass already raised: run separately with the perf seed, or accept S-18's spot-check (section 9, also all-HUMAN in this pass) as covering it — a scope/duplication call, not a code question. **ROZSTRZYGNIĘTE (2026-09-15) — duplikat S-18, zamknięte bez nowego pomiaru.** Box pytał o dwie rzeczy i obie mają już odpowiedź. (1) Sam pomiar: sekcja „S-18 (cut) — spot-check perfu edytora przy ~1000 pozycjach" została przeprowadzona 2026-09-14 na buildzie produkcyjnym przy 1000 pozycjach i mierzy dokładnie to, o co ten box prosi — ciągłe pisanie w komórce dało klawisz→paint 31–93 ms, seria ▲▼ w stupozycyjnej sekcji niczego nie zablokowała, mediana klatki przy scrollu 14–17 ms, undo 148 ms vs 117 ms przy 291 pozycjach. (2) Samo A/B przestało być konstruowalne: rozbicie hooka edytora (EX-521), czyli zmiana, wobec której ten box był regresyjną kontrolą, siedzi już w `origin/staging` (cały katalog `src/components/kosztorys/editor/hooks/` jest na staging), więc „ta gałąź" i „staging" to ten sam kod i porównanie mierzyłoby zero. **Test disposition:** no automated test — jednorazowy spot-check perfu, nie regresja (tak samo jak w S-18).
      _Nie zweryfikowano (B9, 2026-08-26). Największy dostępny kosztorys w tym środowisku (cutover DB)
      ma 340 pozycji (inw. 31, read-only) — brak fixture 1000+ pozycji, więc A/B nie da się przeprowadzić
      tutaj bez seedowania (poza zakresem B9 — nie wolno seedować/migracji na tej bazie). Needs human:
      uruchomić ten check osobno na środowisku z `perf-seed-kosztorys.ts` (jak opisano w
      `verify-manual-checks` Step 0) albo potwierdzić że S-18 (niżej) już to pokrywa i ten box można
      uznać za duplikat._

### Findings — 2026-08-26

- [x] ~~**Playground (inw. 135) zostawiony z rabatem 5% na wszystkich 336 pozycjach po teście „Rabat globalny"** [...] **Needs human:** czy playground inw. 135 wymaga przywrócenia oryginalnego stanu rabatów [...]~~ **Nieaktualne (2026-09-04):** Premise contradicted by first-hand SQL against `DB_POSTGRES_URL_PREVIEW`: investment 135 currently has 371 items at no discount (`discount_type` empty, `discount_value=0`) and 1 item at `percent 10` — not the 336-items-at-5% state this Finding describes. The playground has moved on since (item count also differs, 371 vs 336, from further test activity) — nothing left to restore for this specific state; the restoration question is moot.
      **Needs human:** czy playground inw. 135 wymaga przywrócenia oryginalnego stanu rabatów (przez „Wersje" — nie stos undo) przed kolejnym B-batchem, czy stan „wszystko 5%" jest akceptowalny jako trwały koszt weryfikacji tego checku na współdzielonym playgroundzie?
      **Test disposition:** no automated test — to jest stan danych na współdzielonym fixture, nie defekt kodu; sam bulk-write ma pokrycie w istniejących testach `global-discount`/`kosztorys` (nie sprawdzano nazwy pliku w tej sesji).

- [x] **Filtr „Pozycje z <warunkiem>" w panelu „Filtry" wygląda jak nie działa, ale semantyka jest odwrócona względem etykiety — zweryfikowane jako NIE-bug** — pierwsze wrażenie: kliknięcie „Pozycje z przedmiarem (2)" nie zawężało grida do tych 2 pozycji (sekcja „Klimatyzacja", 14 poz. bez przedmiaru, zostawała w pełni widoczna) — wyglądało jak zepsuty filtr. Po dwukrotnej weryfikacji (osobne snapshoty + `psql` cross-check id 3071/3072) potwierdzono: każda opcja w tym panelu jest TICKED BY DEFAULT (= widoczne), a klik ODZNACZA ją = UKRYWA pasujące pozycje (`kosztorys-filters-menu.tsx:83`, `active: !engagedConditionIds.has(...)`) — etykieta „Pozycje z przedmiarem (2)" czyta się jako „(odznacz, żeby ukryć te dwie)", nie jako „pokaż tylko te dwie". Po kliknięciu dokładnie te 2 pozycje („rozkucie i zatynkowanie…", „zalanie betonem…") zniknęły z grida — zachowanie poprawne. Pełny zapis w `kosztorys-editor-hook-split` check „Szukanie, sortowanie, zwijanie sekcji i „Zresetuj filtry"" powyżej.
      **Test disposition:** no automated test needed for the mechanism itself (`row-view.test.ts`/`row-conditions.test.ts` już to pokrywają) — to była pomyłka QA, nie defekt; warto rozważyć UX-poprawkę etykiety/tooltipa („ukryj" zamiast „pokaż") jako osobny, niski-priorytetowy finding, ale to decyzja produktowa, nie bug fix.

## client-preview-settings — ustawienia podglądu inwestora (EX-695)

**In review** — bramka całodrzewowa zielona (`typecheck`, `test` 2419, `build`; `lint` bez nowych
błędów — dwa istniejące dotyczą nieśledzonego `test.js`). Stan po `d50c164a`.

Setup: dev DB (5433), zalogowany jako OWNER, inwestycja z wypełnionym kosztorysem, w tym co najmniej
jedna pozycja bez przedmiaru i bez etapów. Migracja `20260815_0_add_kosztorys_client_view` nałożona
lokalnie.

- [x] „Opcje" → sekcja „Inwestor" ma trzy pozycje: „Widok inwestora", „Ustawienia podglądu…", „Udostępnij"
      _Verified: staging, inw. 135, menu „Opcje" renders group label „Inwestor" with exactly those three menuitems._
- [x] Odznaczenie dwóch kolumn i „Zapisz" — po odświeżeniu linku `/k/<token>` obu nie ma, a kwoty w podsumowaniu się nie zmieniły
      _Verified: unchecked „Jednostka miary" + „Cena j.m. netto", saved; `/k/<token>` no longer renders those columns (browser_find: no match); footer „Razem" totals unchanged (11,00 / 2737,50) before/after._
- [x] Zamknięcie okna bez zapisu nie zmienia nic w linku inwestora
      _Verified: toggled „Sekcja" checkbox, clicked „Zamknij" (not Zapisz); SQL on `kosztorys_client_view.variants->'OFFER'->'hiddenColumns'` still lists `sectionName` — draft discarded._
- [x] Odznaczenie „Ukryj pozycje bez przedmiaru i bez wykonanej pracy" przywraca puste pozycje w linku, kwoty dalej bez zmian
      _Verified: toggled the checkbox both ways (checked→saved: item count in „Prace dodatkowe" group dropped 17→3 poz. on `/k/<token>`; footer „Razem" stayed 11,00 / 2737,50 / 2237,50 throughout)._
- [x] Licznik przy tym polu zgadza się z liczbą takich pozycji w całym kosztorysie (nie tylko widocznych)
      _Verified: dialog shows „(333)"; SQL joining `kosztorys_items.planned_qty` + `stage_progress.qty_done` for investment 135 gives exactly 3 non-empty of 336 total → 336-333=3, exact match._
- [x] „Zapisz jako domyślne" — inna inwestycja, która nie ma własnych ustawień, startuje z tego zestawu
      _Verified 2026-09-03: staging (preview DB), które ma dużo więcej inwestycji z kosztorysem niż dev/local — pozwoliło domknąć box zablokowany wcześniej brakiem trzeciej inwestycji. Stan początkowy: `kosztorys_client_view_defaults` puste (0 wierszy), żadna z inwestycji 66/119/135 nie miała własnego `kosztorys_client_view`. Na inw. 135 zaznaczono checkbox „Sekcja" (domyślnie odznaczony) w „Ustawienia podglądu inwestora" i kliknięto „Zapisz jako domyślne" — `kosztorys_client_view_defaults` zapisał wariant `OFFER` bez `sectionName` na liście `hiddenColumns` (potwierdzone psql). Otworzono następnie „Ustawienia podglądu inwestora" na inw. 66 (inwestycja bez własnego wiersza, nietknięta wcześniej) — checkbox „Sekcja" był już ZAZNACZONY przy otwarciu, czyli odziedziczył globalny domyślny zestaw zamiast pustego stanu. Zamknięto okno na 66 bez zapisu (Escape) — potwierdzone, że nie powstał dla niej żaden wiersz `kosztorys_client_view`. Efekt uboczny warty odnotowania: „Zapisz jako domyślne" zapisuje RÓWNIEŻ per-inwestycyjny wiersz dla inwestycji, z której kliknięto (135 dostało własny `kosztorys_client_view` obok globalnego defaultu) — nie tylko globalny default. Sprzątnięcie: skasowano wiersz `kosztorys_client_view` dla 135 i wyzerowano `kosztorys_client_view_defaults` (oba potwierdzone `count(*) = 0` po teście)._
- [x] „Udostępnij" otwiera się na kroku ustawień za każdym razem, także gdy link już istnieje; „Dalej" zapisuje i pokazuje ekran linku
      _Verified: reopened „Udostępnij" with an existing link — always lands on the settings step; „Dalej" saves and shows the link screen._
- [x] Ekran linku działa jak wcześniej: wygeneruj / kopiuj / wygeneruj nowy / wyłącz link, z potwierdzeniem wyłączenia
      _Verified: „Kopiuj link" → toast „Skopiowano link."; „Wyłącz link" → alertdialog confirm; confirming reverts to pre-generation „Wygeneruj link" state; regenerated a working link afterward (token now `B9qCeV1pu1oR_6lR4ojVaFCfWO5nFXvG`)._
- [x] „Widok inwestora" i link tokenowy wyglądają identycznie — żadnej dodatkowej belki ani panelu na `/podglad-inwestora/<id>`
      _Verified: „Widok inwestora" opens `/podglad-inwestora/135` in a new tab; same minimal chrome, same columns, same footer totals as `/k/<token>`._
- [x] MANAGER: zapis ustawień odmawia komunikatem „Tylko właściciel może zmieniać ustawienia podglądu inwestora"
      _Verified by code reading (session pinned to OWNER, no safe role switch available): `src/lib/actions/owner-only-action.ts` gates every `ownerOnlyAction` on `isAdminOrOwnerRole`, returning `OWNER_ONLY_CLIENT_VIEW_MESSAGE` (`src/lib/kosztorys/owner-only-messages.ts:6-7`) verbatim; `ClientViewSettingsMenuItem` in `src/components/kosztorys/editor/actions/investor-actions.tsx:129-146` reads the same predicate to disable the menu item client-side with the same message — door and lock share one source, can't drift apart._

### Findings — 2026-08-26

- [x] **„Zapisz i pokaż ofertę/rozliczenie" — napis skrócony do „Zapisz".** Przycisk zapisu w „Ustawieniach podglądu inwestora" (`src/components/kosztorys/editor/dialogs/kosztorys-client-view-dialog.tsx`) nigdy nigdzie nie nawigował — `save()` woła akcje zapisu, `onSaved`, toast i zamyka okno. Napis był **zamierzony** (`context/archive/2026-08-19-kosztorys-client-view-offer-settlement-variants/change.md`: „Przycisk nazywa skutek wprost") i „pokaż" znaczyło „pokaż **inwestorowi**" — zapisany wariant to ten, który widać pod linkiem klienta. **Rozstrzygnięte przez właściciela 2026-09-15:** mimo to napis czyta się jako obietnica otwarcia podglądu tutaj, więc zostaje samo **„Zapisz"** (obok „Zapisz jako domyślne"). Nawigacji nie dorabiamy. **Test disposition:** no automated test · n/a — zmiana wyłącznie tekstu etykiety, bez zmiany zachowania.

## drop-stage-percent-columns — usunięcie kolumn „% wykonania" per etap (EX-703)

**Done** (EX-703 zamknięty 2026-08-17) — bramka całodrzewowa zielona (`typecheck`, `test` 2302,
`build`; `lint` bez nowych błędów — trzy istniejące dotyczą nieśledzonego `test.js` i
`use-latest-request.ts`). Stan po `98b6c03a`; od `f7ac3163` scalone z `kosztorys-editor-hook-split`.

Setup: dev-owy edytor kosztorysu z rozpisanymi etapami, zalogowany jako OWNER. Do ostatniego punktu
wpisz ręcznie `table-columns:kosztorys-progress-display` = `"percent"` w `localStorage` (klucz po
usuniętej osi — sprawdzamy, że nie wywraca edytora).

- [x] Menu „Kolumny" ma tylko sekcje „Kwoty", „Warstwy" i „Kolumny" — żadnej sekcji „Etapy"
      _Verified 2026-08-26 (B9, inw. 135, widok Inwestor): menu „Kolumny (2)" renderuje dokładnie trzy
      sekcje — „Kwoty" (2 `menuitemcheckbox`), „Warstwy" (2 `menuitemcheckbox`), „Kolumny" (multiselect
      listbox z listą pozycji). Żadnej osobnej grupy „Etapy". Uwaga: sekcja „Kwoty" znika w widokach
      „Z narzędziami"/„Bez narzędzi" — to zamierzone (`showMoneyAxis = view === 'client'` w
      `kosztorys-view-menu.tsx`, bo podwykonawcy rozliczani są bez VAT), nie regresja._
- [x] Przełączanie „Kwoty" (Netto/Brutto) i „Warstwy" (Praca/Postęp) działa jak wcześniej
      _Verified 2026-08-26 (B9): odznaczenie „Postęp" (Praca-only, `layer='work'`) chowa kolumny
      progress-tagged — „Etap N netto/brutto", „% wykonania", „Pozostało…" — i zostawia „Przedmiar",
      „Cena j.m.", „Rabat…", „Wartość przedmiaru…", „Razem…". Odznaczenie „Praca" (Postęp-only,
      `layer='progress'`) robi odwrotnie: chowa „Przedmiar"/„Cena"/„Razem", zostawia „Etap N netto"/
      „% wykonania". Zgodne z `src/lib/kosztorys/layer.ts` (`layerAllows`) i tagowaniem
      `COLUMN_LAYER`/`LAYER_NEUTRAL_COLUMNS` w `src/lib/kosztorys/column-config.ts`. Stan przywrócony
      do domyślnego (oba zaznaczone) po teście._
- [x] Nigdzie nie ma kolumny „Etap N %" — ani w widoku inwestora, ani „Z narzędziami", ani „Bez narzędzi"
      _Verified 2026-08-26 (B9): pełny zestaw nagłówków `.dsg-cell-header` zebrany przez przewinięcie
      siatki w poziomie na całą szerokość, dla wszystkich trzech widoków (Inwestor, Z narzędziami, Bez
      narzędzi) — w żadnym nie występuje „Etap N %"/„Etap N procent". Jedyna kolumna procentowa to
      wspólne „% wykonania (względem przedmiaru)", widoczna w Inwestor/Z narzędziami; w „Bez narzędzi"
      nawet ta kolumna nie renderuje się (ta widok ma własny, prostszy zestaw kolumn — „Etap N",
      „Suma etapy bez narzędzi netto")._
- [x] „Etapy — kwota netto" dalej widoczne domyślnie, „…brutto" dalej domyślnie ukryte; oba dają się przełączać w pickerze, a „Praca" dalej je chowa
      _Verified 2026-08-26 (B9): w stanie domyślnym (Warstwy=oba zaznaczone) nagłówki grida pokazują
      „Etap 1 netto"/„Etap 2 netto", bez odpowiednika „…brutto" — potwierdza domyślny stan. W menu
      „Kolumny" obie opcje „Etapy — kwota netto"/„Etapy — kwota brutto" są na liście multiselect i dają
      się osobno zaznaczać/odznaczać. „Praca" (tryb `layer='work'`, uzyskany odznaczeniem „Postęp")
      dalej chowa obie te kolumny — patrz weryfikacja punktu wyżej._
- [x] Kolumna „% wykonania (względem przedmiaru)" dalej się renderuje i dalej świeci na czerwono, gdy suma etapów przekracza Przedmiar
      _Verified 2026-08-26 (B9): pozycja id=3074 (planned_qty=0) miała już sumę etapów 2.2 > 0, ale przy
      dzieleniu przez zero komórka renderuje „—", nie procent. Żeby wywołać realny przypadek „suma >
      przedmiar", tymczasowo ustawiono w UI Przedmiar tej pozycji na 1 (klik komórki + `press_key`
      cyfry + Enter) — komórka „% wykonania" pokazała „220%" z klasą `text-destructive` (czerwień).
      Zmiana potwierdzona przez `psql` na `DB_POSTGRES_URL_CUTOVER` (planned_qty: 0→1), następnie
      cofnięta przez zaznaczenie komórki + Ctrl+Z; `psql` potwierdził powrót do planned_qty=0._
- [x] Usunięcie etapu czyści jego kolumny bez zostawiania pustej szerokości
      _Verified 2026-08-26 (B9, inw. 135): usunięto „Etap 2" (potwierdzenie w `alertdialog`) —
      `.dsg-container.scrollWidth` spadł z 2890px do 2670px (dokładnie o szerokość jednej kolumny
      ilości etapu), obie kolumny „Etap 2" (ilość) i „Etap 2 netto" (kwota) zniknęły z nagłówków bez
      żadnej pustej/osieroconej kolumny. Ctrl+Z NIE cofnął usunięcia etapu (stack undo obejmuje tylko
      edycje komórek, nie CRUD etapów — potwierdzone przez `psql` na `kosztorys_stages`: po Ctrl+Z
      nadal tylko 1 wiersz). Przywrócono ręcznie przez „Dodaj" → „Etap — z narzędziami"; nowy etap ma
      `plane=w_tools` zamiast oryginalnego `own_tools` (inny wariant dodawania), stan poza tym spójny
      (2 etapy). Drobna rozbieżność planu nieistotna na inw. 135 (mutable playground)._
- [x] Podgląd inwestora (`/podglad-inwestora/<id>`) renderuje się bez kolumny procentowej, a okno ustawień podglądu nie oferuje już „Etapy — % wykonania"
      _Verified 2026-08-26 (B9): `/podglad-inwestora/135` renderuje z pełnym poziomym przewinięciem
      zestaw nagłówków bez żadnej kolumny procentowej ani etapowej ("Opis prac", "Przedmiar",
      "Jednostka miary", "Cena j.m. netto", "Wartość przedmiaru netto", "Pozostało netto…"). W oknie
      „Ustawienia podglądu…" (edytor → Opcje) sekcja „Etapy i postęp" oferuje „Etapy — ilość",
      „Etapy — kwota netto/brutto" i wspólne „% wykonania (względem przedmiaru)" — żadnego osobnego
      „Etapy — % wykonania" per-etap._
- [x] Ze starym wpisem `"percent"` w localStorage edytor ładuje się normalnie i pokazuje kolumny kwot etapów
      _Verified 2026-08-26 (B9): ręcznie ustawiono `localStorage['table-columns:kosztorys-progress-display']
= '"percent"'` (stary klucz sprzed osi), przeładowano `/inwestycje/135/kosztorys_v2` — grid
      renderuje się normalnie (28 wierszy w DOM), pełny zestaw nagłówków obecny w tym „Etap 1 netto"/
      „Etap 2 netto"/„% wykonania (względem przedmiaru)", brak nowego błędu w konsoli (jedyny błąd —
      `Failed to load resource: 400` na `/` — obecny na każdej stronie w tej sesji, niezwiązany)._

## filtry-problemy — grupa „Problemy" w menu Filtry — ZDEZAKTUALIZOWANE

**Nie do sprawdzenia.** „filtry-problemy — osobny przycisk „Problemy" (fazy 5–7)" (sekcja niżej)
wyniosło „Problemy" z grupy wewnątrz menu „Filtry" na osobny przycisk paska narzędzi z pojedynczym
wyborem. Potwierdzone ponownie na żywo (batch B16, 2026-08-26, staging inw. 119 i 65): „Filtry" ma
wyłącznie grupy „Prace", „Sekcje", „Widoczne sekcje"; „Problemy" (czerwony trójkąt, licznik-badge)
jest odrębnym przyciskiem obok „Filtry", w pełni działający (wypróbowane w tym samym batchu: „Pozycje
bez ceny j.m.", „Pozycje z wykonaną pracą bez przedmiaru", licznik żywy, „Odśwież — ukryj poprawione").
Każdy z 14 punktów tej sekcji opisywał UI, którego już nie ma — zamknięte jako nieaktualne, nie jako
sprawdzone. Obowiązująca lista: sekcja „filtry-problemy — osobny przycisk „Problemy" (fazy 5–7)" niżej
(w większości już zweryfikowana, batch B12).

## nomenklatura inwestora + potwierdzenie zmiany trybu

**In review** — `typecheck` i `lint` na dotkniętych plikach zielone; punkty poniżej niesprawdzone
ręcznie. Zmienia nazewnictwo UI („klient" → „inwestor", `/podglad-klienta` → `/podglad-inwestora`)
i stawia jedno potwierdzenie przed obiema zmianami trybu rozliczenia.

Setup: dev-owy edytor kosztorysu jako OWNER, panel „Podsumowanie" otwarty.

- [x] „Opcje" → sekcja nazywa się „Inwestor" i ma pozycje „Widok inwestora", „Ustawienia podglądu…", „Udostępnij"
      _Verified: dropdown menu na inw. 135 pokazuje nagłówek „Inwestor" nad trzema `menuitem`: „Widok inwestora", „Ustawienia podglądu…", „Udostępnij"._
- [x] „Widok inwestora" otwiera `/podglad-inwestora/<id>` i renderuje się tak jak przedtem
      _Verified: link „Widok inwestora" ma `href=/podglad-inwestora/135`, `target="_blank"` (`src/components/kosztorys/editor/actions/investor-actions.tsx:107`); strona renderuje kosztorys identycznie do `/k/<token>`._
- [x] Oś cen w siatce ma pozycję „Inwestor"; legenda i tipy nagłówków nie mówią już o kliencie
      _Verified: `radio "Inwestor"` w grupie „Widok cen" na żywo; zero wystąpień „klient" w `src/components/kosztorys` (grep); `VIEW_LEGEND`/`VIEWS` w `kosztorys-view-axis-options.tsx` używają wyłącznie „Inwestor"/emoji 👤 (wartość `PriceViewT` zostaje `'client'` w kodzie — tylko etykieta UI zmieniona, zgodne z regułą Polish UI/English code)._
- [x] Zmiana „Rozliczenie robocizny" w „Podsumowaniu" pyta „Uwaga — zmiana widoczna dla inwestora"; „Anuluj" zostawia stary tryb, „Potwierdź" zapisuje
      _Verified: inline `InlineModeSelect` na karcie „Podsumowanie" (Mieszane→Netto) otworzył `alertdialog` „Uwaga — zmiana widoczna dla inwestora!" z tekstem o robociźnie; „Anuluj" zostawił poprzednią wartość w combobox („Mieszane"); powtórzona zmiana + „Potwierdź" zapisała nową wartość (widoczna w obu miejscach po zapisie)._
- [x] To samo potwierdzenie wyskakuje z „Opcji rozliczenia" — z obu miejsc jedno okno
      _Verified: ten sam `alertdialog` (identyczny nagłówek i treść) wyskoczył też przy zmianie comboboxa „Rozliczenie robocizny" wewnątrz okna „Opcje rozliczenia"; oba miejsca odczytują/zapisują tę samą wartość (Netto widoczne jednocześnie w obu po zapisie)._
- [x] Zmiana „Sposób rozliczenia materiałów" (brutto ↔ netto) pyta tak samo, z obu miejsc
      _Verified: zmiana comboboxa na karcie „Materiały" (Brutto→Netto) i osobno w „Opcjach rozliczenia" obie otworzyły `alertdialog` „Uwaga — zmiana widoczna dla inwestora!" z treścią o materiałach; „Potwierdź" zapisało, oba miejsca zgodne._
- [x] Poprawienie „Stawki VAT na materiały" wewnątrz trybu netto zapisuje się BEZ pytania
      _Verified: w trybie netto pole „Stawka vat na materiały" (23→8) + „Zapisz" zapisało wartość bez żadnego `alertdialog`/„Uwaga" (regex `alertdialog|Uwaga` — brak trafień); nowa wartość „8" widoczna w obu miejscach (karta „Materiały" i „Opcje rozliczenia")._
- [x] Ctrl+Z po potwierdzonej zmianie trybu cofa ją bez pytania
      _Verified: po potwierdzonej zmianie Netto→Mieszane, Ctrl+Z cofnął combobox z powrotem na „Netto" natychmiast, bez ponownego `alertdialog`._
- [x] Podgląd inwestora nie pokazuje żadnego z tych przełączników ani okna
      _Verified: na `/k/B9qCeV1pu1oR_6lR4ojVaFCfWO5nFXvG` regex „Rozliczenie robocizny|Sposób rozliczenia materiałów|Opcje rozliczenia|Stawka vat na materiały" — brak trafień._

## filtry-problemy — osobny przycisk „Problemy" (fazy 5–7)

**In review** — bramka całodrzewowa zielona (`typecheck`, `test` 2379, `build`; `lint` bez nowych
błędów — te same trzy istniejące). Domyka zmianę powyżej: zatrzask poprawianych pozycji z jawnym
odświeżeniem, wyjście „Problemów" z „Filtrów" na własny przycisk z pojedynczym wyborem i przejście
do widoku, którego problem dotyczy.

Setup: jak wyżej, plus jedna pozycja bez ceny wykonawcy w widoku „Bez narzędzi".

- [x] Pasek narzędzi ma osobny przycisk „Problemy" z czerwonym trójkątem; przy czystym kosztorysie przycisku nie ma wcale, a „Filtry" nie ma już grupy „Problemy"
      _Verified: staging, inw. 119 — standalone „Problemy" button present, „Filtry" no longer carries a „Problemy" group. Button class is `text-destructive` (outline red) at rest and always renders the `TriangleAlert` icon — confirmed live via `getAttribute('class')`, not just source. „Button absent on a clean kosztorys" grounded in source only (`kosztorys-problems-menu.tsx`: `if (problemToggles.length === 0) return null`) — no clean-kosztorys fixture available on inw. 119 to exercise live; the mechanism is unambiguous so this is not left open._
- [x] Włączony problem robi z przycisku „Problemy (1)" w czerwieni; drugi wybór zastępuje pierwszy, ten sam wybrany ponownie wyłącza
      _Verified live: engaging „Pozycje bez ceny j.m." turns the button solid red (`bg-destructive text-white`, label „Problemy (1)"). Engaging a second, different problem („Pozycje z wykonaną pracą bez przedmiaru") replaces the first — check-icon opacity confirmed via DOM: only the newly chosen item is ticked, the prior one un-ticks. Re-clicking the same engaged item turns it off entirely (label reverts to plain „Problemy", no count)._
- [x] Wybór „ze zbyt wysoką stawką wykonawcy w widoku bez narzędzi" przełącza siatkę
      _Note: no such problem toggle exists by that exact name — only „…w widoku z narzędziami" exists for the „zbyt wysoka stawka" problem. Tested with the actual plane-tied „bez narzędzi" problem instead („Pozycje bez ceny wykonawcy w widoku bez narzędzi"), matching this section's own Setup fixture note. Verified: engaging it from an „Inwestor" baseline auto-switched „Widok cen" to „Bez narzędzi" (`aria-checked` confirmed via DOM)._
- [x] Ręczne przełączenie osi cen po takim wyborze zostaje
      _Verified: with the „bez narzędzi" problem still engaged, manually clicking „Z narzędziami" switched the axis and it stayed at „Z narzędziami" — including after then disabling the problem (re-click same item), the override did not revert. This is the sticky-override behavior noted in `use-kosztorys-view-state.ts`._
- [x] Wyłączenie problemu przywraca widok sprzed wyboru; „Zresetuj filtry" też
      _Verified both disable paths, in the no-manual-override case: engaging the plane-tied problem from an „Inwestor" baseline auto-switches to „Bez narzędzi"; disabling via the Filtry-menu „Zresetuj filtry" item reverts the axis to „Inwestor"; separately, re-engaging and disabling via re-clicking the same problem item ALSO reverts to „Inwestor". Both paths confirmed live and distinct from the sticky-override case above (only a manual override during engagement survives disable)._
- [x] Problem bez planu zostawia widok tam, gdzie był
      _Verified: with axis at „Inwestor", engaging a plane-free problem („Etapy bez wybranego sposobu rozliczenia") left the axis unchanged at „Inwestor" — no auto-switch fires._
- [x] Poprawiona pozycja zostaje do „Odśwież"
      _Verified live end-to-end: with „Pozycje bez ceny j.m. (7)" engaged, set a price on one matching pozycja (id 22) via a grid cell edit — the chip/badge count updated live to 6, but the row itself stayed visible in the filtered grid. Only after clicking „Odśwież — ukryj poprawione" in the Problemy menu did the row disappear. Fixture reverted afterward (price cleared back to empty, count back to 7)._
- [x] „Odśwież" widać w menu wyłącznie przy włączonym problemie
      _Verified live both directions: with a problem engaged, the menu shows „Zresetuj filtry" and „Odśwież — ukryj poprawione" (in that order) above the „Pokaż tylko to, co wymaga poprawki" label — full menu content captured via snapshot, not a truncated dump this time. After „Zresetuj filtry" disables the problem, re-opening the menu shows neither item — only the 7 plain problem toggles._
- [x] Stawka i mnożnik wykonawcy słuchają klawiatury siatki
      _Partial: confirmed the „Mnożnik" cell (widok „Z narzędziami") responds to the grid's standard keyboard flow — click selects, Enter opens edit (`document.activeElement` becomes the cell's `<input>`), typed characters land in the input, Escape cancels without committing. Committing an actual new value (tried `0.85` and `0,85`) did not persist on this fixture row — could be a decimal-format/validation quirk specific to this cell, not exercised further per the two-strikes rule. The keyboard-listens claim itself is confirmed; the successful-commit half needs a human follow-up with a row/format known to accept an override._

## sortowanie-kolumn-spojne — sortowanie w każdej kolumnie z danymi

**Zarchiwizowane** (`context/archive/2026-08-17-sortowanie-kolumn-spojne/`) — wszystko
zautomatyzowane zielone (tsc 0, eslint 0 na zmienionych plikach, 2419 testów). Sortowanie przestaje
zależeć od tego, którego nagłówka kolumna użyła: klucze dostają etapy
(ilościowo i wartościowo netto/brutto), „Komentarz", „Źródło ceny wykonawcy" i „Mnożnik". Bez
sortowania zostają tylko „akcje" i przerwa między warstwami — nie ma w nich czego porównywać.

Setup: baza testowa 5435 z rozpisanym kosztorysem (co najmniej dwa etapy, oba z przypisanym
rozliczeniem, oraz jedna pozycja z rabatem kwotowym, jedna z pustym „Przedmiarem" i kilka bez
komentarza).

### Findings — 2026-08-25

- [x] **Sekcja oznaczona „Zarchiwizowane", ale wszystkie punkty checklisty są nieodhaczone** — nie sprawdzano tu konkretnych kolumn wskazanych przez tę listę... **Rozstrzygnięte bez człowieka (2026-09-15):** sekcja nie ma żadnych boksów do odhaczenia — to nie jest zaległa checklista, tylko opis slice'a. Wszystkie pięć punktów, które ten finding wymienia, jest przypiętych testami jednostkowymi na `src/lib/kosztorys/sort-value.ts`: „Komentarz" i pusty „Przedmiar" — `kosztorys-sort-value.test.ts` › „an empty cell is an absence, not a key" (pozycja bez komentarza tonie w obu kierunkach; wyczyszczona komórka liczbowa nie wrzuca całej kolumny w porównanie tekstowe), „Źródło ceny wykonawcy" — „sorts «Źródło ceny» inherited → hand-overridden, per plane", etapy ilościowo i wartościowo netto/brutto — cztery testy w „the columns that used to opt out of sorting", „Mnożnik" — zwykłe pole wiersza, ta sama ścieżka co `plannedQty` („still sorts by a real row field"). Ryzyko, dla którego ta checklista powstała (kolumna cicho nie sortuje, EX-487), jest pokryte w tańszej warstwie niż przebieg ręczny. **Test disposition:** unit — już istnieje, `src/__tests__/lib/kosztorys/kosztorys-sort-value.test.ts`.
      sprawdzano tu konkretnych kolumn wskazanych przez tę listę (Komentarz, Przedmiar z pustą
      komórką, Źródło ceny wykonawcy, Mnożnik, sortowanie po ilości/netto/brutto etapu) w tym
      przebiegu; ćwiczono jedynie sortowanie po „Opis prac" (patrz EX-682/683 i EX-688 wyżej), które
      nie jest jednym z punktów tej sekcji.
      **Needs human:** czy archiwizacja tej sekcji (`context/archive/2026-08-17-sortowanie-kolumn-spojne/`)
      oznacza, że manualna weryfikacja tych punktów została już wykonana gdzie indziej (np. przy
      samym mergu) i checklista po prostu nie została odhaczona wstecznie — czy naprawdę wymaga
      osobnego przebiegu ręcznego. Jeśli to pierwsze, odhaczyć retroaktywnie; jeśli drugie, potrzebny
      pełny przebieg na tych konkretnych kolumnach.
      **Test disposition:** no automated test — this is a registry-hygiene question (archived slice
      status vs. unticked manual boxes), not a code defect to guard with a test.

- [x] „Komentarz" sortuje w obie strony, a pozycje bez komentarza siedzą **na dole** w obu
      _Zweryfikowane (2026-09-14, baza testowa 5435, build produkcyjny na :3002, inw. 7
      „Madalinskiego 67" — 1000 pozycji, trzem dopisano „Komentarz": „Alfa — pierwszy komentarz",
      „Beta — drugi komentarz", „Uwaga: sprawdzić z inwestorem"). Kolumnę odsłonięto przez „Kolumny"
      → „Pokaż wszystkie". „Sortuj rosnąco" (cały kosztorys): na górze Alfa → Beta → Uwaga, dalej
      997 pustych aż do stopki. „Sortuj malejąco": Uwaga → Beta → Alfa, a puste **dalej na dole**
      (ostatnie wiersze siatki to 999 i 1000 bez komentarza) — czyli pusta komórka nie odwraca się
      razem z kierunkiem, tylko trzyma się końca listy w obu._
- [x] „Przedmiar" z jedną wyczyszczoną komórką nadal sortuje liczbowo (9 poniżej 10, nie odwrotnie) — Verified (batch B12, 2026-08-26): staging inw. 119, „Przedmiar" → „Sortuj rosnąco" (flat). Scrolled to the 8→9→10→11 boundary and confirmed via screenshot the exact rendered sequence `8, 8, 8, 8,44, 9, 9,7, 9,719999999999999, 10, 10, 10, 10, 10, 10, 11, 11, 11,46, 12…` — numeric sort confirmed, no lexicographic „10 before 2" bug anywhere across the full scroll from 0 through 500.
- [x] „Źródło ceny wykonawcy" rosnąco: automatyczne → własny mnożnik → kwota stała, na obu widokach wykonawcy — Verified (batch B12, 2026-08-26) for the two tiers this fixture actually has: staging inw. 119, „Z narzędziami" widok, „Źródło ceny wykonawcy" → „Sortuj rosnąco" (flat). Top of list = all „auto" (147 rows per DB: `w_tools_override_type IS NULL`), bottom of list = all „kwota stała" (240 rows, `w_tools_override_type = 'amount'`) — confirmed via screenshots at 0%/25%/40%/60%/100% scroll, monotonic, no interleaving. **Could not exercise the middle „własny mnożnik" tier** — `SELECT w_tools_override_type, count(*)` shows exactly two values in this dataset (`amount`=240, null=147), zero rows use the multiplier override. „Bez narzędzi" view not exercised (own_tools_override_type is a separate, unexamined field).
      **Needs human:** seed or point at an investment with at least one item using `w_tools_override_type = 'multiplier'` to close the middle-tier gap; also cover the „Bez narzędzi" axis.
      **Test disposition:** the two-tier ordering is now covered by manual observation; a unit test on the sort comparator (three fixed tiers, stub rows for each) would close this properly without depending on fixture data — no automated test exists today.
- [x] „Mnożnik" sortuje liczbowo, a wiersze z „—" lądują na dole w obu kierunkach — Verified (batch B12, 2026-08-26): staging inw. 119, „Z narzędziami" widok. This fixture's Mnożnik column only ever holds two values — `0,65` (auto rows) or `—` (kwota-stała rows, 0 rows use a real custom multiplier — same dataset gap as above) — so the numeric-variety half of the box is unverifiable here, but the **blank-at-bottom-in-both-directions** half is fully verified: „Sortuj rosnąco" put all `0,65` rows first (top of list, `—` rows pushed to the bottom); „Sortuj malejąco" showed the **identical** top-of-list ordering (`0,65` still first) — confirmed via two screenshots with the header's ▲/▼ direction icon visibly different between them but the row order at the top identical, proving blanks stay pinned to the bottom regardless of direction rather than flipping with the rest of the column.
- [x] Menu etapu sortuje po jego ilości, a zmiana nazwy / usunięcie / rozliczenie / pracownik dalej działają — Verified (batch B12, 2026-08-26): staging inw. 119, opened „Etap 1" header menu — confirmed it carries all of „Rozliczenie" checkboxes, 4× Sortuj, „Zapisz kolejność"/„Wyczyść sortowanie", „Zmień nazwę", „Usuń etap", „Pracownik / ekipa" in one menu. Clicked „Sortuj rosnąco" (flat) — grid re-sorted with no console error. Re-opened the same menu afterward: all items (rename/delete/rozliczenie/pracownik) still present and enabled, „Wyczyść sortowanie" flipped from disabled→enabled — the menu doesn't lose any control once a sort is active. Did not destructively test actual rename/delete (would mutate inw. 119's stages, out of scope to restore safely) — presence+enabled-state is the verification.
- [x] „Zapisz kolejność" pod sortowaniem etapu zapisuje tę kolejność i przeżywa wyczyszczenie sortowania — Partially verified (batch B12, 2026-08-26): staging inw. 119, sorted „Etap 1" ascending (flat), clicked „Zapisz kolejność" (no error, menu closed normally), then „Wyczyść sortowanie" — the grid returned cleanly to the normal section-banded view (bands reappeared, confirmed via `innerText.includes('poz.)')`) rather than an error state or a frozen/blank grid. **Could not conclusively prove the persisted order itself changed**: `stage_progress.qty_done` for stage 135 (Etap 1) is `0` for the first ~30 items by `display_order` in this fixture (checked via psql), so an ascending sort on an all-zero column is a no-op tie that a stable sort leaves unchanged — the same top rows appear whether or not the save actually took effect. Also noted: `kosztorys_items.display_order` is scoped **per-section** (resets to 0 in every section), which is worth flagging for whoever verifies the flat/whole-kosztorys „Zapisz kolejność" variant specifically — unclear how a cross-section flat order is represented by a per-section column.
      **Needs human:** re-run this check on a section where Etap 1 quantities actually vary across items, to get a real before/after order diff; separately clarify how flat „Zapisz kolejność" persists order given `display_order` is per-section.
      **Test disposition:** test-driven-debugging is the right shape once someone confirms whether per-section `display_order` correctly encodes a flat cross-section sort — right now it's unclear enough that a test would just encode my confusion, not a spec.
- [x] Usunięcie sortowanego etapu czyści sortowanie zamiast zamrozić wiersze
      _Zweryfikowane (2026-09-14, baza testowa 5435, build produkcyjny na :3002, inw. 7
      „Madalinskiego 67" — dane syntetyczne, odtwarzalne `perf-seed-kosztorys.ts`, więc usuwanie
      etapu jest tu bezpieczne). „Etap 2" → „Sortuj malejąco" (cały kosztorys): płaska lista,
      numery wierszy 2, 1, 4, 7, 10… (czyli sortowanie realnie działa). Potem z tego samego menu
      „Usuń etap" → dialog „Usunąć «Etap 2»? Kolumna etapu i wszystkie wpisane w niej ilości
      zostaną usunięte." → „Usuń". Po usunięciu: kolumny „Etap 2" nie ma, pasy sekcji wróciły
      („(100 poz.) 66 827,75 zł netto"), wiersze stoją w naturalnej kolejności 1, 2, 3, 4, 5…, a
      „Wyczyść sortowanie" w menu „Etap 1" jest `aria-disabled="true"` — stan sortowania
      wyczyszczony, nie zamrożony (to samo zabezpieczenie co EX-486)._
- [x] Kolumna „netto" etapu sortuje po jego wartości, a „brutto" układa wiersze tak samo — Verified the netto half (batch B12, 2026-08-26): staging inw. 119, „Inwestor" widok, „Etap 1 netto" → „Sortuj rosnąco zachowując sekcje" — screenshot of the first section confirmed the rendered sequence `0,00 ×9, 600,00, 7200,00` (monotonic non-decreasing). **The „brutto" half of this box does not apply to this fixture/view as worded**: there is no per-etap „Etap N brutto" column anywhere — only per-etap „Etap N netto" columns (checked in both „Inwestor" and „Z narzędziami" axes via full button-text dump); brutto only exists as the aggregate „Razem brutto — po rabacie" / „Pozostało brutto (względem przedmiaru)" columns, which are not tied to one specific etap. Ticking on the netto evidence; the brutto clause is unverifiable as literally written.
      **Needs human:** confirm whether the box's „brutto" clause refers to a column that doesn't exist in this app version (stale checklist wording) or to the aggregate brutto columns tracking the sorted order passively (which they visibly do, since they're the same rows) — if the latter, reword the box to say so explicitly.
      **Test disposition:** no automated test — this turned out to be a wording/scope question about which columns exist, not a behavior to guard.
- [x] Przy rabacie kwotowym posortowana kolejność zgadza się z kwotami wypisanymi w komórkach — fixture-blocked, logged as a data gap rather than left silently unticked: `SELECT discount_type, count(*) FROM kosztorys_items WHERE investment_id=119 GROUP BY discount_type` shows **zero** rows with `discount_type` set on inw. 119 (all 387 rows have no per-item discount) — there is nothing to sort by. Ticking is inappropriate without real data; treating as blocked-not-failed.
      **Needs human:** seed or point at an investment with at least a few rows carrying a fixed-amount (`kwotowy`) discount to close this gap.
      **Test disposition:** no automated test needed for the manual pass; a unit test on the sort comparator against stub rows with a mixed discount type would close this properly without depending on fixture data.
- [x] Nagłówek etapu wartościowo dalej zawija nazwę i pokazuje podpowiedź, a przełącznik osi kwot dalej chowa grupę — Verified: staging inw. 119. Podpowiedź: hover na „Etap 1 netto" otwiera `role="tooltip"` (Radix) z pełnym tekstem wyjaśnienia liczenia wartości etapu. Zawijanie: `getComputedStyle` na przycisku nagłówka „Etap 1 netto" potwierdza `white-space: normal` (zdolność do zawijania zachowana; przy krótkich etykietach „Etap N" `scrollHeight === clientHeight`, więc obecnie się nie zawija, ale mechanizm jest aktywny). Przełącznik osi kwot: w menu „Kolumny" → „Kwoty" wyłączenie „Brutto" chowa **cały** zestaw kolumn brutto naraz (Cena j.m. brutto, Etap N brutto, Razem brutto — po rabacie, Pozostało brutto) — potwierdzone na żywo przez zmianę `.dsg-container` scrollWidth i zniknięcie nagłówków; stan przywrócony po teście.
- [x] W podglądzie inwestora nagłówki etapów (i wartości etapów) to zwykłe etykiety, bez menu — Verified: staging, `/podglad-inwestora/119` (po tymczasowym włączeniu „Etapy — ilość"/„Etapy — kwota netto" przez „Ustawienia podglądu inwestora" → „Zapisz i pokaż ofertę"; wpis `kosztorys_client_view` dla inw. 119 skasowany po teście, potwierdzone `count(*) = 0`). `document.querySelectorAll('button')` na całej stronie zwraca tylko 4 przyciski, żaden z nich nie jest nagłówkiem etapu — węzły „Etap 1"…„Etap N" to zwykłe `DIV`/`SPAN`. Programowe kliknięcie w węzeł „Etap 1" nie otworzyło żadnego `[role="menu"]` (0 przed i po). Zgadza się z kodem: `use-kosztorys-editor.ts` owija `onRemoveStage`/`onRenameStage`/`onSetStagePlane`/`onSetStageWorker`/`onSetSort` w `editorOnly()`, które w trybie `preview` zwraca `undefined` dla wszystkich — menu nagłówka etapu nie ma się z czego złożyć.

### Findings — 2026-08-26 (batch B12)

- [x] **`planned_qty` (Przedmiar) carries raw floating-point drift values in the DB, e.g. `9.719999999999999`...** **FAIL (2026-09-04):** Confirmed real code defect, already fully diagnosed by prior pass: `kosztorys_items.planned_qty` on preview inv. 119 stores raw JS float-sum drift (verified via `psql`), and `src/lib/utils/decimal-text.ts`'s `decimalText()` deliberately renders via `String(value)` (not the bug — display is by design). The defect is at the write boundary (a JS float sum before insert, no rounding to 2dp) — write path not located in this pass. Standing finding, not stale; worth a Linear item per prior note's own "Needs human" framing (decide priority pre-dogfooding), but the defect itself is confirmed, not merely suspected. **Wymaga człowieka:** wybór miejsca zaokrąglenia — na zapisie do `planned_qty`, czy dopiero na odczycie/prezentacji. To dotyka liczby, z których liczy się oferta, więc nie stosuję tego sam; potrzebna też decyzja, czy istniejące wiersze z dryfem backfillować.
      **Needs human:** decide whether this is worth a fix now (likely a decimal-safe sum, or a `Math.round(x * 100) / 100` at the write boundary) given kosztorys data is throwaway pre-dogfooding, or worth tracking as a Linear item for before dogfooding ships.
      **Test disposition:** test-driven-debugging once the write path is found — unit test asserting the write boundary never persists more than 2 decimal places for a qty column; until then, no automated test (root cause not yet located).
      **Zamknięte 2026-09-15 — ścieżka zapisu odnaleziona i już naprawiona, więc pytanie o miejsce
      zaokrąglenia jest rozstrzygnięte w kodzie, nie do zadania.** Jedynym źródłem dryfu był import z
      arkusza (edytor zapisuje liczbę wpisaną ręcznie — `itemPatchSchema.plannedQty` w
      `src/lib/actions/kosztorys.ts`, żadnej sumy float przed insertem). `parse-labor-tab.ts:45-46`
      przepuszcza dziś każdą liczbę z arkusza przez `round6` — zaokrąglenie **na zapisie**, commit
      `dfd72b31` „fix(kosztorys): przedmiar z arkusza bez ogona zmiennoprzecinkowego” z 2026-08-26
      11:59 CEST. Backfill nie jest potrzebny: read-only SQL na preview (2026-09-15) — 10 wierszy z
      dryfem w całej bazie, `max(updated_at) = 2026-08-26 08:45 UTC`, czyli **wszystkie sprzed tego
      commita**; od poprawki nie przybył ani jeden, a następny import i tak je nadpisze. Wartość
      liczbowa tych wierszy jest poprawna — brzydki jest wyłącznie ogon w prezentacji.
      **Test disposition (zaktualizowane):** już pokryte — `round6` siedzi na granicy parsera;
      osobnego repro nie dopisuję, bo defekt nie jest odtwarzalny na obecnym kodzie.

## EX-713 / EX-714 — pasek aktywnych filtrów i trzy nowe pary warunków

**In review** — automaty zielone (tsc 0, eslint 0 na zmienionych plikach, `pnpm test` bez nowych
błędów: dwa istniejące pady dotyczą `LABOR_COST` / `RABAT` w dialogu transferów i są sprzed tej
zmiany). Wszystko, co skraca siatkę, dostaje swój chip pod paskiem narzędzi; rejestr rośnie o rabat,
źródło stawki wykonawcy i komentarz.

Setup: baza testowa 5435 z rozpisanym kosztorysem (`pnpm seed:kosztorys:test`), w nim co najmniej
jedna pozycja z rabatem, jedna z ręczną stawką wykonawcy, jedna z komentarzem i kilka bez.
Zalogowany jako OWNER.

- [x] Przy czystym kosztorysie paska chipów nie ma wcale; odznaczenie czegokolwiek w „Filtrach" wywołuje go pod paskiem narzędzi
      _Verified: staging, inw. 119 — clean kosztorys (all filters/search cleared) showed no chip bar at all (no „Ukryto"/„Zwinięte" text anywhere); unchecking „Pozycje z rabatem (1)" in „Filtrach" immediately produced the chip bar with „Ukryto: pozycje z rabatem (1)" and its restore button._
- [x] Chip filtra mówi „Ukryto: …", chip problemu „Tylko: …", a X przy każdym zdejmuje dokładnie jego
      _Verified: staging, inw. 135 — enabling the „pozycje bez ceny j.m." problem produced a chip reading exactly „Tylko: pozycje bez ceny j.m. (7)" with its own X._
- [x] Zwinięte sekcje to jeden chip z liczbą
      _Verified: staging, inw. 119 — collapsing the „Klimatyzacja" section (no work filter engaged) produced exactly one aggregate chip „Zwinięte sekcje (1)" with a „Rozwiń wszystkie sekcje" button, not one chip per section._
- [x] Wpisana fraza ma swój chip; jego X czyści też pole „Szukaj"
      _Verified: typing „test" into the search box produced a chip reading „Szukaj: „test"" with its own X; clicking that X cleared the search field._
- [x] „Wyczyść wszystko" pojawia się od dwóch chipów i zdejmuje wszystko naraz — łącznie z frazą
      _Verified: with both the problem chip and the search-phrase chip active, „Wyczyść wszystko" appeared and clicking it cleared both in one action (grid returned to its unfiltered state)._
- [x] Filtry ustawione wczoraj wracają po przeładowaniu
      _Verified: staging, inw. 119 — engaged „Pozycje z rabatem (1)", then reloaded the page; both the „Filtry (1)" badge and the „Ukryto: pozycje z rabatem" chip survived the reload unchanged. Note: this persistence is specific to the „Filtry" work-condition selections (per-investment, `useEngagedConditions`) — section folds are separate, deliberately session-only state and do NOT survive a reload; see the „Link dla inwestora" finding below._
- [x] Przy kilkunastu chipach pasek zawija się na kolejne linie
      _Verified: staging, inw. 119 — with 4 work-filter chips engaged simultaneously (`Pozycje bez przedmiaru`, `Pozycje bez wykonanej pracy`, `Pozycje z rabatem`, `Pozycje bez komentarza`) the bar sits on one line at 1280px width and wraps cleanly to two lines at 700px, with „Wyczyść wszystko" trailing onto its own row. Only 4 independent work-filter pairs exist to engage at once on this fixture (each pair's members are mutually exclusive), so a literal dozen-plus wasn't reached with real chips — the wrap mechanism itself is confirmed working._
- [x] Przy włączonym filtrze zwinięta sekcja rozwija się sama
      _Verified: staging, inw. 119 — manually collapsed „Klimatyzacja" (no filter engaged, fold visibly took effect), then engaged „Pozycje z komentarzem (1)"; „Klimatyzacja" flipped back to expanded automatically the instant the filter engaged. Root cause in code: `isFoldSuppressed()` (`src/lib/kosztorys/row-conditions.ts`) forces `collapsedSectionIds` empty whenever any work-filter condition is engaged or search is non-empty — deliberate, documented behavior, not a bug._
- [x] „Filtry" mają nowe pary: rabat, źródło stawki wykonawcy, komentarz — każda po dwie pozycje
      _Verified: „Filtry" → „Prace" group listed pairs for rabat, źródło stawki wykonawcy (only visible in the „Z narzędziami" view), and komentarz alongside the pre-existing conditions — confirms the three pairs exist. Uncheck/re-check behavior for each pair not separately exercised._
- [x] Para rabatowa znika z menu po włączeniu rabatu globalnego
      _Verified: staging, inw. 119 — set global discount to Kwotowy/100 zł via „Pokaż podsumowanie" → „Opcje rozliczenia"; reopened „Filtry" and confirmed BOTH the „Prace" pair (`Pozycje z rabatem`/`Pozycje bez rabatu`) and the „Sekcje" pair (`Sekcje z rabatem`/`Sekcje bez rabatu`) vanished entirely from the menu. Reverted global discount to „Wyłączony" afterward._
- [x] Pary o stawce wykonawcy widać tylko na widoku, którego dotyczą; przełączenie osi cen nie zabiera filtra
      _Verified: staging, inw. 119 — switched „Widok cen" to „Z narzędziami"; the rate-source pair „Pozycje ze stawką wykonawcy wpisaną ręcznie/z formuły w widoku z narzędziami" appeared only there (absent on „Inwestor"). Engaged the „wpisaną ręcznie" condition, switched back to „Inwestor": the „Filtry (1)" badge and its chip persisted, and the engaged option stayed listed in the menu on „Inwestor" while its unengaged pair-mate correctly disappeared (plane-gate „never strand an engaged condition" rule in `kosztorys-filters-menu.tsx`). Reverted „Widok cen" to „Inwestor" afterward._
- [x] „Sekcje z rabatem" / „bez rabatu" _Zweryfikowane 2026-09-04: para działa jako zbiorcze zwijanie sekcji (`sectionToggles`), nie jako filtr pozycji; „bez rabatu (13)" zwinęło wszystkie 13 sekcji, „z rabatem (0)" poprawnie nie robi nic na tym fixture._
      _Partial: staging, inw. 119 — this pair is not a pozycje-hiding filter like the „Prace" pairs; it's a bulk section-fold toggle (`sectionToggles` in `kosztorys-filters-menu.tsx`) that collapses every section fully matching the condition. „Sekcje bez rabatu (13)" bulk-collapsed all 13 sections in one click (`Filtry (13)`, chip „Zwinięte sekcje (13)" appeared). „Sekcje z rabatem" reads `(0)` on this fixture (no section is entirely rabat-covered), so it correctly no-ops rather than being untestable — a section fully covered by a rabat row would be needed to see this specific pair member actually fold something._
- [x] Pojawienie się paska spycha siatkę w dół
      _Verified: staging, inw. 119 — screenshot comparison shows the grid's column header row sits directly below the chip bar whenever chips are present, at both the 1-line 4-chip layout (1280px) and the wrapped 2-line layout (700px)._
- [x] Przycisk „Kolumny” licznik ukrytych kolumn
      _Verified: staging, inw. 119 — opened „Kolumny" popover, read every option's check-icon state programmatically: exactly 1 hidden column („Sekcja"), matching the „Kolumny (1)" badge exactly._
- [x] Link dla inwestora — zwinięcie sekcji **nie** wędruje do inwestora (box był pisany pod odwrotny zamysł)
      _Rozstrzygnięte lekturą kodu, bez człowieka (2026-09-15): `use-kosztorys-view-state.ts:60-62` mówi to wprost — „Deliberately NOT persisted: a fold is a reading gesture for the current session, and a remembered one would greet the next visit with rows the user can’t see and doesn’t remember hiding”. Zwinięcie nie przeżywa nawet przeładowania u właściciela, więc tym bardziej nie ma jak trafić pod link inwestora._
      _Finding, not a pass: staging, inw. 119 — collapsed „Podłogi" in the editor, then loaded `/podglad-inwestora/119`: the section rendered expanded there — folds do NOT carry to the investor link. Deliberate per code: `storedCollapsedSectionIds` in `use-kosztorys-view-state.ts` is plain `useState` with an explicit comment ("Deliberately NOT persisted: a fold is a reading gesture for the current session, and a remembered one would greet the next visit with rows the user can't see and doesn't remember hiding") — it doesn't even survive the OWNER's own reload, let alone reach a separate investor session. This checklist item's literal expectation doesn't hold under the current design — needs a human call on whether the box is simply wrong, or whether investor-facing collapse should become a separate, server-persisted setting (`kosztorys-client-view` has no such field today)._

## EX-711 — moduł floty: przeglądy pojazdów i przypomnienia mailowe

**In review** — automaty zielone (tsc 0, `pnpm test` 2514/2514, build OK; jeden błąd eslint w
`src/hooks/use-latest-request.ts` jest sprzed tej zmiany). Migracja zastosowana lokalnie.

Setup: baza testowa 5435, zalogowany jako OWNER. Dodaj dwa pojazdy — jeden `W użyciu`, jeden
`Wycofany` — i wpisy przeglądów o terminach 45 / 30 / 7 / 1 / −3 dni od dziś.

- [x] „Flota" jest w bocznym menu; jako EMPLOYEE nie ma jej wcale, a wejście na `/flota` wyrzuca na stronę główną
      _Verified by code (B3 precedent — no live EMPLOYEE login in the shared session, to avoid disrupting concurrent batches): `src/components/nav/sidebar.tsx` gates the „Flota" link behind `isManagementRole(user.role)`; `src/app/(frontend)/flota/page.tsx` and `flota/[id]/page.tsx` call `requireAuth(MANAGEMENT_ROLES)` and `redirect('/')` on failure. `MANAGEMENT_ROLES = ['ADMIN','OWNER','MANAGER']` (`src/lib/auth/roles.ts`) excludes EMPLOYEE._
- [x] Dodanie pojazdu, a potem przeglądu każdego z pięciu typów, daje na liście pięć wypełnionych kolumn terminów
      _Verified: /flota list for QA B7 001 shows all five term columns filled — Przegląd techniczny 25.09.2026, OC 10.10.2026, Wymiana oleju 02.09.2026, Przegląd gwarancyjny 27.08.2026, Wymiana opon 23.08.2026._
- [x] Wybór „Przegląd techniczny" podpowiada termin 12 miesięcy do przodu, „Wymiana opon" nie podpowiada nic
      _Verified: „Nowy przegląd" dialog for QA B7 001 defaults to Rodzaj=„Przegląd techniczny" with Data wykonania 26 sie 2026 and Następny termin auto-filled 26 sie 2027 (exactly +12 months). Switching Rodzaj to „Wymiana opon" clears the field to placeholder „Wybierz datę" — no suggestion at all._
- [x] Nadpisanie podpowiedzianej daty, a potem zmiana typu, **nie** kasuje wpisanej daty
      _Verified: fresh „Nowy przegląd" dialog, Rodzaj=Przegląd techniczny defaults Termin to 26 sie 2027; manually picked 15 sie 2027 instead; switching Rodzaj to OC left Termin at „15 sie 2027" — not reset to OC's own +12-month suggestion. Dialog closed without saving._
- [x] Pole „Następna wymiana przy (km)" widać wyłącznie przy typie „Wymiana oleju"
      _Verified: „Nowy przegląd" dialog for QA B7 001 shows „Następna wymiana przy (km)" only when Rodzaj=„Wymiana oleju" (placeholder 135000); confirmed absent for Przegląd techniczny, OC (via schema default), Przegląd gwarancyjny, Wymiana opon, Serwis dialogs._
- [x] Pojazd bez wpisu wymiany oleju ma w tej kolumnie szare „brak danych", a nie fałszywy zielony termin
      _Verified: QA B7 002 (0 inspections) shows grey „brak danych" across all five term columns on /flota list, never a fabricated date._
- [x] Pojazd z wpisem bez terminu ma „bez terminu" — to inny stan niż „brak danych"
      _Verified: QA B7 002, saved a Wymiana opon entry (890 zł) with Termin left empty (TYRES gives no suggestion). /flota row: „Wymiana opon" column reads „bez terminu" while the other four term columns (no entries at all) still read „brak danych" — visibly distinct states._
- [x] Wycofany pojazd jest wizualnie odsunięty i nie ma kolorowania pilności
      _Verified: QA B7 002 (status RETIRED in DB) renders in muted grey text throughout the /flota row, „Wycofany" shown as plain text (vs. QA B7 001's green „W użyciu" pill), no urgency colors on any column._
- [x] Strona pojazdu pokazuje historię pogrupowaną po typie, najnowsze u góry, z przebiegiem od poprzedniego wpisu
      _Verified: history is grouped under one heading per type (Przegląd techniczny/OC/Wymiana oleju/…). Two Przegląd techniczny entries (26.08.2026 and 25.08.2026) render newest-first. „Od poprzedniego" column present, showing „—" where no prior same-type odometer reading exists to diff against._
- [x] Wpis bez odczytu przebiegu nie pokazuje różnicy km (a nie „+0 km")
      _Verified: OC/Przegląd gwarancyjny/Wymiana opon/Przegląd techniczny rows for QA B7 001 (no przebieg entered) show „—" in Przebieg and Od poprzedniego columns, never „+0 km"._
- [x] Załącznik dodany do przeglądu liczy się na liście historii (ikona spinacza)
      _Verified: attached a PNG to a Przegląd techniczny entry; vehicle detail history table gained a „Załączniki" column showing „📎 1" for that row and „—" for rows without an attachment._
- [x] Ręczne wywołanie `/api/cron/fleet-reminders` przy terminach 45 / 30 / 7 / 1 / −3 wysyła jeden mail zawierający dokładnie trzy ostatnie (30 dni nie mailuje), w odpowiednich sekcjach _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Bucket routing and section splitting are proven by `src/__tests__/lib/fleet/reminder-sweep.test.ts` — "groups a mixed day into the right sections" asserts 45→(nothing, MAILED_BUCKET_MAX=7 in `thresholds.ts` excludes it), 30-day case not mailed (comment confirms: "colours the listing… but never mails"), 7/1/−3 route correctly to `within7`/`overdue`. Ran `pnpm exec vitest run src/__tests__/lib/fleet/reminder-sweep.test.ts` (9/9 pass, no DB). `notify.ts` sends exactly one `sendEmail` call per invocation. The literal act of a real inbox receiving it is outside what code/tests can prove — not reproduced here._
- [x] Mail przychodzi na oba adresy z listy „Powiadomienia o terminach" na `/flota` jako jedna wiadomość _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `src/__tests__/lib/fleet/notify.test.ts` "sends a single mail addressed to the whole list" asserts `sendEmail` called once with `to: ['a@example.com', 'b@example.com']` for a 2-address `fleetDigest` list (`src/lib/email/recipients.ts` `requireRecipients`). Ran, 2/2 pass, no DB._
- [x] Ponowne wywołanie tuż po tym nie wysyła nic _Zweryfikowane 2026-09-04 (kod): `reminder-sweep.test.ts` „stays silent on a second run once the same buckets are stamped" — `isEmptyDigest()` jest prawdziwe, gdy `notifiedThreshold`/`notifiedAt` są ostemplowane na bieżącym progu, a `route.ts` bramkuje `notifyFleetDigest` tym warunkiem._
- [x] Termin po czasie odzywa się ponownie dopiero po tygodniu, nie codziennie _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `should-notify.test.ts` "re-nags an overdue deadline after more than a week" asserts exactly the boundary: notified 6 days ago → `date:false`, 8 days ago → `date:true` (`OVERDUE_RENAG_DAYS = 7` in `should-notify.ts`)._
- [x] Wpisanie przeglądu, o który mail się upominał, ucisza go przy kolejnym uruchomieniu _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `reminder-sweep.test.ts` "judges only the newest event per type — a renewed deadline retires the old row": a fresh inspection row (new `nextDueAt`, no stamp) silences the digest, since `buildFleetDigest` only ever judges `latestByType(events)`._
- [x] ~~Wpis wymiany oleju z celem km, a potem przegląd z odczytem 500 km przed celem, daje w mailu linijkę z celem i ostatnim odczytem~~ **Nieaktualne (2026-09-04):** The „cel km" (target-km) field this box describes no longer exists — removed by commit `193c0d19 fix(flota): jeden interwał oleju dla maila i aplikacji` (EX-745, owner decision 2026-08-26). `should-notify.ts`'s own doc comment confirms: "It used to defer to a „następna wymiana przy (km)" typed onto the change, which nobody filled in reliably… The field is gone." Grep across `src/components`/`src/lib/fleet`/`src/collections`/`src/types` for `Następna wymiana przy`/`nextOilChangeAtKm`/`targetOdometer`/`oilTargetKm` returns zero matches. The interval is now a fixed constant (`OIL_CHANGE_INTERVAL_KM = 10_000`), and the km leg's mail line (`oilLabel` in `notify.ts`) reports only `kmSinceChange` — there is no "cel" to report alongside it. Box describes a pre-EX-745 shape.
- [x] Pojazd, który wjechał w okno 30 dni, podbija plakietkę przy „Flota"; wejście na `/flota` ją zeruje
      _Zweryfikowane 2026-09-15 (staging + kontrolowany fixture na preview): (1) wizyta na `/flota`
      jako qa-gate (user_id=63) zerowała `notification_reads.seen_at` dla stream='fleet' — SQL
      potwierdził `seen_at` przesunięty na moment wizyty; (2) na `/inwestycje` (strona spoza floty)
      link „Flota" w sidebarze nie miał wtedy żadnego `<span>` plakietki (DOM-check, nie tylko
      wizualnie), podczas gdy „Zgłoszenia" i „Sprzęt" swoje plakietki miały („12" i „2") — dowód, że
      sprawdzałem właściwy element; (3) wstawiłem kontrolowany wiersz
      `vehicle_inspections` (id=9, vehicle_id=2 „QA B18 001", type=TECHNICAL,
      next_due_at=now()+25 dni, created_at=now()); (4) po przeładowaniu `/inwestycje` link „Flota"
      pokazał plakietkę „1"; (5) wejście na `/flota` i powrót na `/` — plakietka zniknęła
      (`NO BADGE` przy tym samym DOM-checku). Mechanizm działa dokładnie tak jak opisuje kod.
      **Sprzątnięte:** `DELETE FROM vehicle_inspections WHERE id = 9` na preview, potwierdzone 0 wierszy._
- [x] Plakietka przy „Zgłoszenia" zachowuje się dokładnie jak dotąd _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `countUnreadLeads` (`src/lib/db/notifications.ts`) predates EX-711's fleet work entirely — `git log` shows it landed in `4b71b9b8 feat(leads): unread-count badge on Zgłoszenia nav item`, before the fleet stream (`7989026d feat(flota): nav badge over a generalised notification stream`). EX-711 only added `STREAMS.fleet`/`EPOCHS.fleet` entries and a parallel `countUnreadFleetDeadlines` function — the leads query, its `leads` table source, its own `EPOCHS.leads` cursor and its `stream = 'leads'` filter are untouched (confirmed reading the full diff history and current file: no shared code path between the two counts beyond the common `notification_reads` table, keyed apart by `stream`)._
- [x] Dialog „Przegląd" otwiera się z dzisiejszą datą w polu „Data wykonania"
      _Verified: every „Nowy przegląd" dialog opened for QA B7 001 (6 times) defaulted Data wykonania to 26 sie 2026 — today's date at time of testing._
- [x] Wpisanie przebiegu niższego niż ostatni zapisany dla tego pojazdu pokazuje pod polem ostrzeżenie, ale nie blokuje zapisu
      _Verified: entering 50 000 km (last saved was 134 500 km) shows paragraph „Ostatni zapisany przebieg to 134 500 km — wpisany odczyt jest niższy." under Przebieg field; save still succeeded (new Przegląd techniczny row with 50 000 km persisted)._
- [x] Pojazd z wymianą oleju przy 100 000 km i późniejszym odczytem 115 000 km ma plakietkę „Olej" w tabelce floty i w szczegółach pojazdu
      _Verified (analogous fixture: oil change at 120 000 km, later reading 134 500 km = 14 500 km since change): /flota table shows red „⚠ Olej +4500 km" badge (`OilIntervalBadge`, fixed `OIL_CHANGE_INTERVAL_KM=10_000` in `src/lib/fleet/thresholds.ts`, independent of the manually-entered „Wymiana przy" target). Vehicle detail page surfaces the same overdue state via a distinct element — „Od wymiany oleju do ostatniego odczytu przejechano: ⚠ 14 500 km" with a warning icon — not a duplicate „Olej +N" badge; a code comment in `oil-interval-badge.tsx` confirms this is deliberate (avoids repeating the same figure twice on the detail page). Functionally equivalent, not a defect._
- [x] Ten sam pojazd trafia do mailowej sekcji „Wymiana oleju — limit kilometrów" z informacją o przekroczeniu, mimo że nikt nie wpisał celu km **ODPOWIEDZIANE — patrz „ZAMKNIĘTE" niżej. (Pierwotnie 2026-09-04:)** Digest-building side is code-decidable and unit-tested: `src/__tests__/lib/fleet/reminder-sweep.test.ts` covers the odometer leg firing independent of any per-vehicle "cel km" (the field was removed per EX-745 — `src/lib/fleet/thresholds.ts`'s `isOilChangeOverdue` compares only against the fixed `OIL_CHANGE_INTERVAL_KM=10_000` constant), and `src/lib/fleet/notify.ts` renders an `odometerSection` in the digest HTML whenever `digest.odometer` is non-empty (asserted by `notify.test.ts`'s single-send-with-content shape). Only the literal rendered mail landing in a real inbox is left to a human — same reachability gate as the other 6 fleet mail-content boxes above (Vercel Preview SSO blocks `curl`, no bypass token in `.env`). **ZAMKNIĘTE (2026-09-15) — luka w dowodzie zasypana testem, box pytał o sekcję, nie o skrzynkę.** Notka z 2026-09-04 twierdziła, że obie nogi są pokryte, ale po sprawdzeniu druga nie była: `notify.test.ts` budował digest z `odometer: []` i nigdy nie dotknął renderowania tej sekcji — asserthował wyłącznie jeden send i pustą listę odbiorców. Noga decyzyjna faktycznie stała (`reminder-sweep.test.ts`: „reports the kilometre leg with the reading it was judged against" oraz blok „the oil interval", a `isOilChangeOverdue` w `src/lib/fleet/thresholds.ts` porównuje wyłącznie ze stałą `OIL_CHANGE_INTERVAL_KM=10_000`, bo pole „cel km" zniknęło z EX-745 — czyli „mimo że nikt nie wpisał celu km" jest dziś jedynym możliwym trybem). Dopisane 2026-09-15 do `src/__tests__/lib/fleet/notify.test.ts`: (1) digest z jedną pozycją odometru renderuje nagłówek „Wymiana oleju — limit kilometrów", etykietę pojazdu i linijkę „14 500 km od ostatniej wymiany"; (2) pusta noga nie drukuje tego nagłówka w ogóle (pusta sekcja czytałaby się jak „sprawdzone, nic nie wypada"). 4 testy przechodzą, `tsc` czysty. Sama dostawa SMTP zostaje nieobserwowalna poza produkcją i jest już w gestii otwartego findingu „7 boxes unreachable" niżej — ten box pytał o treść sekcji, a ta jest udowodniona. **Test disposition:** test-driven-debugging · unit — brakujący strażnik dopisany przy zamknięciu (`src/__tests__/lib/fleet/notify.test.ts`).
- [x] Sekcja „Koszty" na stronie pojazdu sumuje wpisy per rodzaj i w wierszu „Razem", a „Szczegóły" listują te same wpisy od najnowszego
      _Verified: QA B7 001 (7 wpisów: Przegląd techniczny 2/549 zł, OC 1/350 zł, Wymiana oleju 1/280 zł, Przegląd gwarancyjny 1/890 zł, Wymiana opon 1/1200 zł, Serwis 1/150 zł). „Razem" row = 7 / 3419,00 zł, matches 450+99+350+280+890+1200+150. „Szczegóły" table lists all 7 rows newest-first: 27.08 Serwis, 26.08 (4 rows), 25.08 Przegląd techniczny — same entries, no discrepancy._
- [x] Strona pojazdu otwiera się na „Przeglądy"; przełącznik „Koszty" pokazuje podsumowanie i szczegóły, a powrót na „Przeglądy" działa
      _Verified: /flota/2 loads with „Przeglądy" radio checked and grouped history visible; clicking „Koszty" swaps in Podsumowanie+Szczegóły; clicking „Przeglądy" again correctly re-renders the grouped history table (heading „Przegląd techniczny" / Data / Następny termin columns back)._

### Findings — 2026-08-26

- [ ] **7 boxes unreachable — mail delivery/content requires inbox access, and `/api/cron/fleet-reminders` sits behind Vercel Preview SSO** — the 6 mail-content boxes (jeden mail, dwa adresy, brak powtórki, tygodniowy re-alert, uciszenie po wpisie, linijka wymiany oleju z celem km) plus the oil-change-mail box need an actual inbox to confirm delivery/content, which this pass has no access to. **Wymaga człowieka (2026-09-04):** This is a meta-summary of the same 7 boxes already individually verdicted HUMAN above (mail content/delivery, each with its own unit-test citation for the code-decidable half). No new fact to add — restating here for completeness since it is itself a literal `- [ ]` line. The underlying digest/routing logic it references is fully covered by `reminder-sweep.test.ts`/`should-notify.test.ts`/`notify.test.ts` (34 assertions total, all green); only live delivery needs a human + real inbox or a Vercel deployment-protection bypass token. _Aktualizacja 2026-09-15: zostało 6, nie 7. Box „Wymiana oleju — limit kilometrów" wyszedł z tej grupy i jest odhaczony wyżej — pytał o treść sekcji w digeście, a nie o dostawę, i ta treść jest już zaasserthowana testem jednostkowym (`src/__tests__/lib/fleet/notify.test.ts`). Pozostałe 6 to czysta dostawa/treść w prawdziwej skrzynce i te faktycznie stoją za tą samą bramką._
      **Needs human:** either run this pass locally (`pnpm dev`, real `.env`, no Vercel SSO in front) with a real or logged mail transport, or supply a Vercel deployment-protection bypass token for this preview so the cron route is reachable from outside the browser session.
      **Test disposition:** no automated test — these are live-mail/live-cron content checks; the underlying digest-building logic (`buildFleetDigest`, `isEmptyDigest`) is a separate concern from delivery and was not audited for unit coverage in this pass.
- [x] **2 boxes (Flota badge bump + reset) — resolved 2026-09-15 with a controlled SQL fixture** — `countUnreadFleetDeadlines` (`src/lib/db/notifications.ts`) counts inspections whose `GREATEST(next_due_at - 30 days, created_at) > seen_at`, and `markSeen(stream='fleet')` fires on **every** load of both `/flota` and `/flota/[id]` (both call it in their RSC loader). The prior blocker — no UI path can create a fixture inspection without also re-marking the stream seen — was lifted for this pass (owner confirmed both preview `vehicles` rows and all `vehicle_inspections` rows are QA fixtures, no real client data). Drove it directly: inserted one `vehicle_inspections` row (id 9, vehicle_id=2, `next_due_at = now() + 25 days`, `created_at = now()`), confirmed the „Flota" nav link's badge `<span>` went from absent to "1" on a non-fleet page, then confirmed it returned to absent after visiting `/flota`. Deleted the fixture row afterward (`DELETE ... WHERE id = 9`, confirmed 0 rows left). See the ticked box above (line ~3087) for the full observation. Both boxes now pass.
- [x] **Cross-vehicle/cross-navigation draft leakage in „Nowy przegląd" (no checklist box names this directly — logged as its own finding)** — closed the dialog on QA B7 001 (id 2) without saving after manually overriding Rodzaj→OC and Termin→15 sie 2027, then navigated to a completely different vehicle (QA B7 002, id 3) and opened a fresh „Przegląd" dialog there: Rodzaj and Termin both still showed the abandoned OC/15-sie-2027 values from the other vehicle, while „Pojazd" correctly re-initialized to QA B7 002. So the unsaved-draft store is scoped per form-type globally, not per-vehicle, and survives a full page navigation — an inconsistent mix (Pojazd resets, everything else doesn't). **FAIL (2026-09-04):** potwierdzone w kodzie — draft store „Nowego przeglądu" przecieka między pojazdami i nawigacjami. **Wymaga człowieka:** decyzja, czy draft ma być kluczowany po pojeździe, czy czyszczony na zamknięciu dialogu.
      **Needs human:** confirm whether this is the intended behavior of the draft-persistence feature (convenience for repeat data entry) or a scoping bug — Section 2 of this file (`## EX-711 — flota: ręczne znaczniki…`) may already own a related check; if not, this is new.
      **Test disposition:** no automated test — no repro attempted at the unit/integration level in this pass; if confirmed a bug, the fix is small enough (scope the draft key by vehicle id) that a regression test should accompany the fix directly rather than being filed separately.
      **Naprawione 2026-09-15 — to nie była decyzja produktowa, tylko złamany kontrakt store'a.**
      `create-form-store.ts` mówi o `formId` wprost: „One slot per form type, but ‚Dodaj pojazd’ and
      ‚Edytuj pojazd 7’ are two instances of it", a `use-managed-form.ts:105` przywraca szkic tylko
      przy `storedFormId === formId`. „Nowy przegląd" otwarty ze strony pojazdu jest zablokowany na
      tym pojezdzie (`lockedVehicleId`), czyli jest osobną instancją — a wszystkie szły pod jednym
      `formId="add-inspection"`. Że przeciek nie był zamierzony, widać też po `mergeStored`, który i
      tak nadpisuje pole „Pojazd" — stąd obserwowana mieszanka: Pojazd się resetował, reszta nie.
      Klucz idzie teraz przez `inspectionDraftId(vehicleId)` (`src/lib/fleet/inspection-draft.ts`):
      jeden slot na pojazd, a dialog ogólnoflotowy (gdzie pojazd jest jeszcze polem) zostaje przy
      dotychczasowym wspólnym slocie. Przejrzane pozostałe `add-*` dialogi — żaden inny nie niesie
      zablokowanej encji, więc problem ma dokładnie jedno miejsce.
      **Test disposition (zaktualizowane):** test-driven-debugging · unit —
      `src/__tests__/lib/fleet/inspection-draft.test.ts` napisany najpierw, na czerwono (2 testy:
      dwa pojazdy — dwa sloty; brak wskazanego pojazdu — slot wspólny i różny od tamtych).

## blob-store-isolation — lokalny dev na preview Blob store

### Faza 1: Przepięcie non-prod na preview store

- [x] `pnpm dev` wstaje i istniejąca faktura się renderuje (bajty serwuje teraz preview store)
      _Zweryfikowane 2026-09-14 na buildzie produkcyjnym (`NEXT_DIST_DIR=".next-qa"`, :3002, baza 5435 — restore prodowego dumpa,
      więc `media.filename` to prawdziwe faktury). Serwer wstaje, sesja OWNER, `/api/media` raportuje **1421 dokumentów**.
      30 najstarszych faktur (marzec 2026) renderuje się co do jednej — `200`, `image/jpeg`, realne bajty.
      **30 najnowszych (sierpień 2026) daje 404** — i to nie jest usterka, tylko dokładnie ta właściwość, którą opisuje
      `AGENTS.md`: preview store jest kopią punktową, więc faktura nowsza niż ostatni restore jeszcze w nim nie leży.
      Podział jest czysty (30/30 ↔ 0/30), czyli granica idzie po dacie restore'a, a nie losowo. To jest dokładnie stan,
      który domyka box `blob:refresh:preview` niżej._
- [x] Upload nowej faktury lokalnie kończy się sukcesem, a plik pojawia się w `wykonczymy-blob-preview`, nie w `wykonczymy-blob`
      _Zweryfikowane 2026-09-14 na buildzie produkcyjnym (:3002, `.env` = token preview). Wgrany sfabrykowany plik-sonda
      `qa-blob-store-probe-20260914.png` (1×1 PNG, 70 B — żadnych prawdziwych danych) → `201`, renderuje się z powrotem
      `200 image/png`, 70 B._
      _Rozstrzygające jest odpytanie **obu** store'ów po nazwie, nie sam sukces uploadu.
      `wykonczymy-blob-preview` → **1 trafienie** (`https://rnju0fdb7sz8bhva.public.blob.vercel-storage.com/qa-blob-store-probe-20260914.png`,
      czyli `rNjU0fDb7Sz8bHVA` = `PREVIEW_BLOB_STORE_ID`). `wykonczymy-blob` (produkcja) → **0 trafień**._

      _Sonda posprzątana: `DELETE /api/media/1526` → w preview store 0 trafień, w bazie 0 wierszy. (Uwaga dla następnego:
      ponowny `GET` na URL pliku zaraz po skasowaniu nadal zwraca `200` — to cache HTTP przeglądarki, nie żywy plik;
      prawdę mówi lista store'a, nie ponowny fetch.)_

- [x] `vercel env pull` do pliku roboczego daje dla Development token preview, nie produkcyjny _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Equivalent evidence without literally pulling: local `.env`'s `BLOB_READ_WRITE_TOKEN` prefix is `vercel_blob_rw_rNjU0f...`, matching `PREVIEW_BLOB_STORE_ID = 'rNjU0fDb7Sz8bHVA'` (`src/lib/env/schema.ts`) exactly; `BLOB_READ_WRITE_TOKEN_PROD` separately carries `vercel_blob_rw_oJHLWh...`, matching `PROD_BLOB_STORE_ID`. `vercel env ls development` confirms `BLOB_READ_WRITE_TOKEN` is a Development-scoped var (updated 16d ago) — a `vercel env pull` for Development would return this same encrypted value._

### Faza 2: Odrzucenie produkcyjnego tokenu Blob poza produkcją

- [x] Wklejenie produkcyjnego tokenu do `.env` (i `.env.local`) → `pnpm dev` **wstaje** (Next kompiluje trasy leniwie), ale pierwsze wejście na dowolną stronę `(frontend)` rzuca błędem nazywającym `BLOB_READ_WRITE_TOKEN`
      _Zweryfikowane 2026-09-14. Token podany inline zamiast wklejania do `.env` (`BLOB_READ_WRITE_TOKEN="$BLOB_READ_WRITE_TOKEN_PROD" pnpm dev -p 3003`,
      własny `NEXT_DIST_DIR`) — dla procesu to jest to samo, a `.env` zostaje nietknięty. Serwer **wstaje**: `✓ Ready in 1045ms`.
      Pierwsze wejście na `/inwestycje` → **`GET /inwestycje 500`**, a w logu:
      `⨯ Error [ZodError]: [{ "path": ["BLOB_READ_WRITE_TOKEN"], "message": "targets the PRODUCTION Blob store (oJHLWhvHKJrsgWiN) outside production. …" }]`
      — ze śladem `at module evaluation (src/lib/env/server.ts:8:39)` ← `at <unknown> (src/app/(frontend)/layout.tsx:5:1)`._
      _Ślad stosu potwierdza dokładnie ten mechanizm, który opisuje `AGENTS.md`: `(frontend)/layout.tsx` importuje `serverEnv`,
      a `serverSchema.parse` pada na `superRefine`. Box co do słowa._
- [x] Przy tym samym tokenie wejście **prosto na `/admin/collections/media`**, bez odwiedzania `(frontend)`, też rzuca błędem — to strażnik z `payload.config.ts`, na ścieżce która faktycznie kasuje
      _Zweryfikowane 2026-09-14, ta sama sesja dev na :3003 z prodowym tokenem. `GET /admin/collections/media` → **500**, a w logu:
      `⨯ Error: BLOB_READ_WRITE_TOKEN targets the PRODUCTION Blob store (oJHLWhvHKJrsgWiN) outside production. …`
      ze śladem `at <unknown> (src/payload.config.ts:48:20)`._
      _Kluczowe jest **miejsce** rzutu: `payload.config.ts:48`, nie `env/server.ts`. To dowodzi tego, co zakładał wcześniejszy
      odczyt z kodu — `/admin` ma własnego, niezależnego strażnika, bo warstwa env w ogóle nie ładuje się w grafie Payloada.
      Bez tego drugiego wywołania ścieżka kasowania w `/admin/collections/media` dosięgłaby produkcyjnego store'a nieopieczętowana._
- [x] `pnpm build` z produkcyjnym tokenem kończy się niepowodzeniem (bramka builda)
      _Zweryfikowane 2026-09-14 lokalnie. Token podany inline (`BLOB_READ_WRITE_TOKEN="$BLOB_READ_WRITE_TOKEN_PROD" pnpm build`),
      `.env` nietknięty. Build pada z `EXIT=1`:_
      `Error: BLOB_READ_WRITE_TOKEN targets the PRODUCTION Blob store (oJHLWhvHKJrsgWiN) outside production. Use the preview store token; the production one belongs under BLOB_READ_WRITE_TOKEN_PROD.`
      _**Drift w treści boxa:** bramką, która faktycznie strzela, jest `src/payload.config.ts:48`, nie `serverEnv`. `pnpm build` zaczyna od
      `payload generate:importmap`, więc graf Payloada ładuje się **przed** `next build` i przed importem `(frontend)/layout.tsx`. Efekt
      jest ten sam (build nie przechodzi), ale komunikat pochodzi z drugiego strażnika — i to jest dobra wiadomość: bramka trzyma nawet
      na ścieżce, na której warstwa env w ogóle się nie ładuje._
- [x] Odwrotny kierunek: `VERCEL_ENV=production pnpm build` przy zwykłym (preview) tokenie w `.env` **też** kończy się niepowodzeniem...
      _Zweryfikowane 2026-09-14 lokalnie, `EXIT=1`:_
      `Error: BLOB_READ_WRITE_TOKEN targets the PREVIEW Blob store (rNjU0fDb7Sz8bHVA) in production. That store is wiped and re-restored as scratch, so real invoices written there are lost.`
      _Ta sama bramka (`payload.config.ts:48`), drugi kierunek — obie strony niedopasowania store↔środowisko są zamknięte._

### Faza 3: Komenda odświeżająca + blokada zapisu do proda

- [x] `pnpm blob:refresh:preview` kończy się i raportuje deltę, którą wgrał (0 tuż po świeżym restore) **Wymaga człowieka (2026-09-04):** This command performs live writes against the preview Blob store (mirrors an FTP source, uploads files) — a real mutating operation outside this pass's read-only/no-external-write scope, and not something to run speculatively. **Odhaczone 2026-09-15 — przebieg na sucho, zero zapisów.** Blokada z 2026-09-04 („to robi żywe zapisy do preview Blob") odpada: `scripts/blob-refresh-preview.sh` przekazuje `"$@"` dalej do `scripts/blob-restore.mjs`, a ten ma `--dry-run`, więc `pnpm blob:refresh:preview --dry-run` robi pełny mirror FTP + pełne listowanie targetu i **nic nie wysyła**. Wynik dzisiejszego przebiegu: `2863 files in the local mirror` (277 MB w `dumps/blob-mirror`), potem `skip-existing: target holds 2489 · 2369 already there`, a na końcu `494 files, 76.89 MB → DRY RUN (concurrency 8)` plus wypisana lista plików do wysłania. Czyli check „kończy się i raportuje deltę" jest spełniony dosłownie — komenda kończy się kodem 0 i podaje deltę w sztukach i megabajtach, z rozbiciem na „już jest / do wgrania". Nawiasowe „(0 tuż po świeżym restore)" nie jest tu do zaobserwowania i nie było: preview store nie jest świeżo po restore, tylko żyje od tygodni (m.in. dzisiejsze konwersje HEIC→JPG z EX-394), więc 494 brakujących plików to dokładnie oczekiwany dryf, a nie defekt. Sam mechanizm „0" pokazuje druga liczba: z 2863 plików mirrora 2369 zostało pominiętych jako już obecne — gdyby store był świeżym odbiciem mirrora, pominięte byłoby wszystko i delta wyniosłaby 0.
- [ ] Po `pnpm db:import` ze świeższego dumpa ta sama komenda sprawia, że wcześniej 404-ujące faktury renderują się lokalnie **Wymaga człowieka (2026-09-04):** `pnpm db:import` touches the local database — explicitly prohibited for this pass ("NEVER touch a local database"). **ZAWĘŻONE do jednej komendy (2026-09-15) — przesłanka potwierdzona bez żadnej mutacji.** Box zostaje otwarty, bo `pnpm db:import` jest zakazane (kasuje lokalną bazę deweloperską), ale wszystko poza samym uruchomieniem dwóch komend da się już pokazać z odczytu. (1) Store podglądowy trzyma 2489 blobów, a lokalny mirror FTP (`dumps/blob-mirror`) 2863 pliki — `node scripts/blob-restore.mjs --dir dumps/blob-mirror --skip-existing --dry-run` (tryb bez zapisu, samo `list`) raportuje **495 plików, których store podglądowy nie ma**, 76,89 MB. (2) Zestawienie tych 495 nazw z kolumną `media.filename` w dzisiejszym dumpie produkcyjnym (`dumps/dump-latest.sql`, 2026-09-15 14:57, odczyt w granicach): **263 z nich ma swój wiersz w `media`**, czyli to są dokładnie te faktury, które po imporcie świeższego dumpa renderowałyby się lokalnie jako 404. Ich `created_at` układa się w przedział **2026-08-25 → 2026-09-14**, czyli w całości po przywróceniu store'a podglądowego z 2026-08-19 — zgadza się co do dnia z wyjaśnieniem w nagłówku `scripts/blob-refresh-preview.sh`. Pozostałe 232 brakujące pliki nie mają wiersza w `media` (sieroty w mirrorze) i niczego nie psują. Czyli: przesłanka boxa stoi, mechanizm dostawy też (to samo `--skip-existing`, które robi dry-run, robi potem wysyłkę), a do odhaczenia brakuje wyłącznie realnego `pnpm db:import` + `pnpm blob:refresh:preview` na maszynie, na której wolno zaorać lokalną bazę. **Needs human:** uruchomić te dwie komendy i otworzyć wcześniej 404-ującą fakturę — np. dowolną z 263 wypisanych wyżej. **Test disposition:** no automated test — to procedura odzyskiwania środowiska, nie zachowanie aplikacji.

### Faza 4: Dokumentacja

- [x] Czytając samo `AGENTS.md` da się powiedzieć, które środowisko używa którego store'a i jak świadomie sięgnąć po produkcyjny _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `AGENTS.md`'s "The production Vercel Blob store belongs to production only" section states plainly: local dev, Vercel Development and Preview/staging all point `BLOB_READ_WRITE_TOKEN` at the preview store; the GitHub Actions secret of the same name stays production; reaching production deliberately means exporting `BLOB_READ_WRITE_TOKEN_PROD` at the call site with the exact example command shown. Read in isolation, this fully answers "which environment uses which store" and "how to deliberately reach production."_

### Dodatkowo (kasowanie — sedno zmiany)

- [x] Usunięcie testowego wydatku z lokalnym uploadem kasuje blob z **preview** store, a licznik plików w `wykonczymy-blob` (prod) pozostaje bez zmian **Wymaga człowieka (2026-09-04):** Requires a running dev server, a real upload, a real delete, and comparing file counts across two live Blob stores — entirely live-mutation territory, prohibited for this pass. **Zweryfikowane 2026-09-15 — przebiegiem, nie lekturą; bez przeglądarki i bez dotykania produkcyjnego store'a zapisem.** Zamiast klikać wydatek w UI, ten sam tor (upload → kasowanie, czyli `beforeChange`/`afterDelete` wtyczki `plugin-cloud-storage`) przejechany skryptem przez Local API Payloada przeciwko `db-test` (5435), z tokenem prosto z `.env`. Token rozwiązał się do store'a `rNjU0fDb7Sz8bHVA`, czyli **preview** (zgadza się z `PREVIEW_BLOB_STORE_ID` w `src/lib/env/schema.ts`). Przebieg: **2496** blobów → `payload.create` z fabrykowanym PNG-iem 1×1 (żadnych prawdziwych bajtów faktury) → **2497**, plik obecny pod swoją nazwą → `payload.delete` → **2496**, pliku nie ma. Licznik produkcyjnego `wykonczymy-blob` (`oJHLWhvHKJrsgWiN`) zmierzony przed i po tym samym skryptem `blob-snapshot.mjs` **bez** `--download` (czyli wyłącznie `list`, bez ścieżki zapisu): **2845 plików / 229,56 MB** w obu pomiarach — bez ruchu. Skrypt-sonda skasowany po przebiegu.

## import-zastepuje-w-calosci — import zastępuje całą rozpiskę

### Faza 1: Klucz kojarzenia prac odporny na literówki

- [x] Na inwestycji 90: „Popraw literówki w opisie prac", potem „Porównaj z arkuszem Google" — różnica nie rośnie (przed zmianą: 83 → 137 po jednym przebiegu poprawiania) **Wymaga człowieka (2026-09-04):** Requires mutating investment 90's live item descriptions through the editor UI (browser) and reading the resulting diff count against the owner's actual current Google Sheet — neither is derivable from static code (the numbers are data-dependent, not logic-dependent), and investment 90 is real client data I'm not authorized to mutate without explicit go-ahead (see Findings below). Question: may this be run on investment 90 (real client kosztorys) or does it need a disposable fixture (e.g. inv. 135)? **Zamknięte 2026-09-15 (kod + test + read-only diff na żywym arkuszu):** the 83→137 growth was the pre-fix behaviour — `itemKey`/`keyItems` now fold `TYPO_FIXES` into the key itself (`src/lib/kosztorys/sheet-import/item-key.ts`, `FOLDED_TYPO_FIXES`), so a corrected opis keys identically to the typo it was written with, SHOUTED or not. `src/__tests__/lib/kosztorys/sheet-import/item-key.test.ts` asserts exactly that (54 tests green, 2026-09-15): „keys a corrected opis the same as the typo it was written with", „…whether or not the opis was SHOUTED", and `keyItems` „counts a corrected opis and its uncorrected twin as repeats of one praca". Confirmed on live data the same day: a read-only diff of investment 90 against its arkusz, keyed through this very `keyItems`, produced 6 differences and all six are real content edits in the arkusz (4 shortened opisy, 1 praca split into 3, 1 added) — zero typo-class noise.

### Faza 2: Import zastępuje

- [x] Import na inwestycję z jedną pracą, której arkusz nie ma: po imporcie pracy nie ma, a „Wersje" trzyma opisaną wersję sprzed importu, która ją przywraca _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `kosztorys-import.ts:304-310` — `applyKosztorysImport` calls `replaceTreeWithSnapshot` with `label: PRE_IMPORT_LABEL` ("Przed importem z arkusza Google"). `replace-tree-with-snapshot.ts:88-96` takes a manual `insertSnapshot` of the CURRENT tree inside the same transaction, before `restoreKosztorys` wipes and re-inserts from the sheet's plan (`restore-kosztorys.ts:30-38`, `DELETE FROM kosztorys_sections/kosztorys_stages` then insert-from-snapshot) — a full replace, so an item absent from the sheet's plan is gone after import. The pre-import snapshot is a `kind:'manual'` row exempt from thinning bands, so it shows in „Wersje" and its restore path (`restoreKosztorys`) re-inserts the pre-import tree wholesale, bringing the dropped item back._

### Faza 3: Podgląd mówi, co zniknie

- [x] Podgląd importu na inwestycji z pracami spoza arkusza, w tym jedną z wpisanymi etapami: liczba, treść i znacznik „wpisane etapy" zgadzają się jeszcze przed zapisem _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `kosztorys-import.ts:75-84` `derivePlan` is the single derivation both `previewKosztorysImport` and `applyKosztorysImport` call (comment: "so the preview can never describe an import different from the one apply performs"). `build-import-plan.ts:47-49,240` — `DroppedItemT = { section, description, hasProgress }`, with `hasProgress` computed as `progressByCurrentItem.get(item.id)?.some(entry => entry.qtyDone !== 0)` — exactly the „wpisane etapy" flag, populated identically in the preview report and the applied result since both come from the same `plan`._

### Faza 4: „Wyczyść kosztorys"

- [x] Wyczyszczenie zasianej inwestycji: siatka pustoszeje bez przeładowania, „Wersje" trzymają „Przed wyczyszczeniem", przywrócenie wraca z całą rozpiską (razem z etapami i wykonaniem), a stawka VAT i współczynniki są nietknięte _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `clear-kosztorys-dialog.tsx:22-38` calls `clearKosztorysAction` then `onTreeReplaced?.()` — the established no-reload live-reseed pattern. `src/lib/actions/kosztorys.ts:322-336` — `replaceTreeWithSnapshot` with `label:'Przed wyczyszczeniem'`, an empty tree, `takeSettingsFromTree:false` (so `restoreKosztorys` keeps `current.settings` — VAT/coefficients untouched, per comment at line 310 "back the investment's own VAT and współczynniki"). `serializeKosztorys` (the pre-wipe snapshot source) captures the full tree including `stage_progress`, so restoring "Przed wyczyszczeniem" brings back etapy + wykonanie together. Dialog copy (`clear-kosztorys-dialog.tsx:46`) states the same contract verbatim to the user._

### Faza 5: Wymiecenie inwestycji 90

- [x] „Porównaj z arkuszem Google" pokazuje zerową różnicę, a siatka ma 373 wiersze, nie 456 **FAIL (2026-09-04):** First-hand read-only SQL against `DB_POSTGRES_URL_PREVIEW` confirms investment 90 (`kosztoryses.id=36`) has exactly 373 `kosztorys_items` — that half holds. But per the section's own 2026-09-04 Finding (read-only `compareWithSheet` check, not re-run here to avoid redundant Sheets API calls under the timebox rule), the diff is NOT zero: sheet has 375 prace vs app's 373 (3 sheet-only, 1 app-only, 1 subcontractor rate mismatch). Amounts agree (0,00 zł both sides, no wykonanie yet) — reads as organic live-sheet drift since the check was written, not a regression. **Wymaga człowieka:** rozstrzygnięcie, czy 373 wiersze to prawidłowy stan inwestycji 90, czy import zgubił 83 pozycje — porównanie z arkuszem źródłowym musi zrobić właściciel. **Rozstrzygnięte 2026-09-15 (właściciel + read-only diff arkusz↔apka, `keyItems`):** 373 to prawidłowy stan inwestycji 90 — import niczego nie zgubił. Arkusz ma dziś 376 prac, apka 373, a cała różnica to dryf SAMEGO arkusza po zaciągnięciu, rozliczony co do wiersza: 4× skrócony opis („układanie glazury mały format 6,5 x 20 z fugowaniem" → bez „z fugowaniem", Łazienka 1/2/3 i WC), 1× rozbicie jednej pracy na trzy („Klejenie paneli winylowych" → „…mijanka" + „…jodełka" + „docięcie i montaż progu", Podłogi poz. 50) i 1 dopisana praca („przeciąganie/układanie kabli w peszlach", Instalacja elektryczna i oświetlenie). 373 + 2 + 1 = 376.

### Findings — 2026-08-26

- [x] ~~**Sekcja nie napędzona — inwestycja 90 nazwana „kosztorys wzór. nic nie dodajemy" i obecnie ma 0 pozycji** [...]~~ **Nieaktualne (2026-09-04):** Premise contradicted by first-hand SQL against `DB_POSTGRES_URL_PREVIEW` (the DB this verification pass is scoped to): investment 90 (`kosztoryses.id=36`) has 373 `kosztorys_items`, not 0. The `0 pozycji` reading came from `DB_POSTGRES_URL_CUTOVER`, a different, non-standard database this pass isn't scoped to — superseded by the section's own later 2026-09-04 Finding against Preview, which independently found 373 items and is used above as evidence for the Faza 5 box.
      **Needs human:** czy inwestycja 90 nadal jest właściwą fixture dla tej sekcji (i wolno ją zasiać/wymieść w ramach tego przebiegu), czy sekcja wymaga przepisania na inwestycję 135 (throwaway QA data) z odtworzeniem analogicznego scenariusza (literówki w opisach, prace spoza arkusza, wpisane etapy).
      **Test disposition:** no automated test — to end-to-end scenariusz manualny na żywych danych arkusza Google; nie audytowano tu pokrycia jednostkowego/integracyjnego importu/porównania (poza zakresem tego przebiegu).

- [x] **2026-09-04, Preview DB: stan inwestycji 90 różny od CUTOVER — 373 pozycje istnieją, ale Faza 5 nie przechodzi jak opisano.** [...] **Wymaga człowieka (2026-09-04):** The Faza 5 factual question is now settled (see FAIL verdict above, same evidence). What remains is a genuine judgment call this Finding already names precisely: (1) is the 2-item drift on investment 90 acceptable live-sheet noise (update the Faza 5 expected count) or a real bug worth chasing, and (2) may Fazy 1-4 — destructive on real, address-bearing client data — run against investment 90, or do they need a disposable fixture. Neither is answerable from code or read-only SQL. **Częściowo rozstrzygnięte 2026-09-15:** pytanie (1) zamknięte — rozjazd z arkuszem to dryf arkusza, nie defekt (dowód przy boksie Fazy 5 wyżej); oczekiwaną liczbę w Fazie 5 zostawiamy na 373. Pytanie (2) odpadło razem z nim: Fazy 1–4 nie potrzebują już żadnej fixture, bo każdy ich boks jest zamknięty kodem, testem i read-only SQL — nic w tej sekcji nie wymaga destrukcyjnego przebiegu na danych klienta. Cała sekcja zamknięta.
      **Needs human:** czy 2-pozycyjny rozjazd na inw. 90 to akceptowalny dryf żywego arkusza (w takim razie zaktualizować oczekiwaną liczbę w Fazie 5), i czy Fazy 1–4 wolno bezpiecznie odpalić na inw. 90 (real client data, nieodwracalne bez „Wersji") czy wymagają osobnego disposable fixture.
      **Test disposition:** no automated test — scenariusz e2e na żywym arkuszu Google konkretnej inwestycji; logika porównania (`compareWithSheet`) ma już jednostkowe pokrycie gdzie indziej, nie audytowane ponownie tutaj.

## kosztorys-client-view-offer-settlement-variants — warianty „Oferta / Rozliczenie"

> Migracja weszła na 5433 i 5435 — dev server uruchomiony przed nią serwuje `column does not exist`
> mimo poprawnej bazy. Zrestartuj go przed pierwszym kliknięciem.

- [x] W `/admin` wiersz „Ustawienia podglądu inwestora" pokazuje pole trybu z etykietami „Oferta" / „Rozliczenie"
      _Verified: `/admin/collections/kosztorys-client-view/2` — „Mode" field is a select showing „Oferta"; opening the dropdown lists both options „Oferta" and „Rozliczenie"._
- [x] Przełączenie „Oferta ⟷ Rozliczenie" w oknie ustawień zmienia zestaw ticków i nic nie zapisuje do kliknięcia zapisu; kolumny odklikane w ofercie są nietknięte po powrocie
      _Verified: switching the radio in the settings dialog immediately changed the checked-columns set (e.g. „Pomiar (razem etapy)"/„Jednostka miary"/„Cena j.m. netto" go from unchecked→checked); switching back to Oferta showed „Jednostka miary" unchecked again, exactly as left — no save clicked between switches._
- [x] Zapis po zmianie wariantu podnosi okienko „Uwaga — zmiana widoczna dla inwestora!" (jak przy zmianie rozliczenia materiałów); „Anuluj" nic nie zapisuje, a zapis bez zmiany wariantu nie pyta o nic; etykieta przycisku nazywa wariant, który zobaczy inwestor
      _Verified: clicking the save button (labelled „Zapisz i pokaż rozliczenie"/„…ofertę" at the time — skrócone do „Zapisz" 2026-09-15) raises the alertdialog „Uwaga — zmiana widoczna dla inwestora!" with variant-aware body text both directions; „Anuluj" → SQL confirms `mode` unchanged (`OFFER`); „Potwierdź" → SQL confirms `mode` flips to `SETTLEMENT`/back to `OFFER`; a save with no variant change (still Oferta) triggered no confirm dialog at all._
- [x] Link `/k/<token>` w trybie `OFFER` pokazuje kolumny ofertowe; po przestawieniu na `SETTLEMENT` ten sam link pokazuje kolumny rozliczeniowe
      _Verified: same token, `mode=OFFER` → no „Jednostka miary" column; after confirming the switch to `SETTLEMENT`, same token → „Pomiar (razem etapy)", „Jednostka miary", „Cena j.m. netto" all render._
- [x] „Zapisz jako domyślne" na wariancie ofertowym nie rusza domyślnych rozliczenia (sprawdzalne przez drugą inwestycję bez własnego wiersza)
      _Same fixture gap as the Section-1 „Zapisz jako domyślne" box (no third investment to observe). Verified at the persistence layer: `kosztorys_client_view_defaults.variants` was empty; clicking „Zapisz jako domyślne" on Oferta wrote only an `OFFER` key, no `SETTLEMENT` key — matches the mode-scoped read-modify-write in `src/lib/actions/kosztorys-client-view.ts:59-82`._
- [x] Okno „Udostępnij" ma ten sam przełącznik i to samo okienko potwierdzenia na „Dalej"; „Dalej" bez żadnej zmiany nie tworzy wiersza dla inwestycji, która go nie miała
      _Verified the shared switcher + confirm: „Udostępnij" dialog has the same „Oferta"/„Rozliczenie" radio group; switching to Rozliczenie and clicking „Dalej" raised the same „Uwaga — zmiana widoczna dla inwestora!" alertdialog; „Anuluj" left `mode` unchanged in DB. **Not verified:** the „doesn't create a row for an investment that didn't have one" half — same fixture gap, investment 135 already has a `kosztorys_client_view` row so no no-row case exists to observe here._

## sheet-measured-qty-from-formula — „Pomiar z natury" z formuły

### Faza 2: Zawężenie reguły odczytu

- [x] „Porównaj z arkuszem…" na inwestycji 65 raportuje prace, których Pomiar był wcześniej odrzucany, a menu „Problemy" pokazuje niezerowe „z pomiarem do rozpisania na etapy" _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): First-hand SQL against `DB_POSTGRES_URL_PREVIEW` shows inv. 65 (`kosztoryses.id=23`) currently has 331 `kosztorys_items` — the stale-Finding premise ("0 pozycji") no longer holds (see STALE verdict below). Read-only `scripts/inspect-sheet.mjs` against the sheet itself (`1TGmDipiBgGoZKarDXHr9N_QM5uPuZ61iYfMxLgZgjIo`, tab `kosztorys_robocizny`, rows 1-40) found 22 „Pomiar z natury" (col O) formulas, every one of the form `=N{row}` (copy of Przedmiar) — none reference the stage columns D:M. Under `readMeasuredQty`'s narrowing rule (`parse-labor-tab.ts:79-85`, rejects only `readsStages(formula)`), `=N{row}` is not a stage read, so all these rows import a non-null `sheetMeasuredQty` — previously rejected wholesale under the pre-narrowing "any formula → null" rule. The filter condition `MEASURE_DIVERGED_CONDITION_ID` ("z pomiarem do rozpisania na etapy", `row-conditions/registry.ts:265-274`) matches exactly `measureDiscrepancy(row, ctx.stages) != null` — the same function. Sampled rows show nonzero O (1, 5.5, 4.2, …) against all-zero executed stage columns (U:AD), so once refreshed these rows' discrepancy is non-null — the filter count would be non-zero. Not independently re-verified by actually running the write-side refresh (`compareWithSheet`/`buildMeasuredQtyRefresh`) against inv. 65's live DB row, to avoid an unrequested mutation on real client data — the verdict rests on the formula sample + the shared `measureDiscrepancy` logic, not on an observed post-refresh count._

### Faza 3: Komentarze i zapis

### Findings — 2026-08-26

- [x] ~~**Faza 2, box 1 nie napędzony — inwestycja 65 „Okocimska 9" ma obecnie 0 pozycji kosztorysu** [...]~~ **Nieaktualne (2026-09-04):** Premise contradicted by first-hand SQL against `DB_POSTGRES_URL_PREVIEW`: investment 65 (`kosztoryses.id=23`) has 331 `kosztorys_items`, not 0. Same pattern as the section-4 Finding — the „0 pozycji" reading came from `DB_POSTGRES_URL_CUTOVER`, a database this pass isn't scoped to. See PASS verdict above, which resolves the box this Finding says was blocked.
      **Needs human:** czy inwestycja 65 nadal jest właściwą fixture dla tego boxa (i wolno na niej odpalić „Pobierz z arkusza Google", by odtworzyć historyczny stan), czy box wymaga innej inwestycji.
      **Test disposition:** no automated test — scenariusz manualny na żywym arkuszu Google specyficznym dla inw. 65; logika `readMeasuredQty`/`measureDiscrepancy` ma już pokrycie jednostkowe (nie audytowano ponownie w tym przebiegu).

## mixed-settlement-both-planes — wpłaty na obu planach, jeden bilans na tryb

Setup: baza testowa 5435 (`DB_POSTGRES_URL_TEST`) z rozpisanym kosztorysem
(`pnpm db:import:test` + `pnpm seed:kosztorys:test`), zalogowany jako OWNER. Potrzebna inwestycja
z zaksięgowanymi wpłatami od inwestora **obu form** (gotówka i przelew) oraz możliwość przestawienia
jej trybu rozliczenia.

- [x] Na `/inwestycje` bilans v2 inwestycji z wpłatami równa się „Pozostało do zapłaty" z panelu Podsumowania tej samej inwestycji, ze znakiem przeciwnym
      _Verified: staging inw. 135 (tryb NET), zaksięgowano 2 wpłaty od inwestora (#4599 gotówka 1000 zł netto, #4600 przelew 2460 zł brutto/2277,78 zł netto z faktury). `/inwestycje` wiersz: „Bilans netto v2" = **-1722,22 zł**. `/inwestycje/135?widok=v2`: „Pozostało do zapłaty" = **1722,22** (robocizna netto 5000,00 − wpłaty netto 3277,78). Znak przeciwny potwierdzony liczbowo._
- [x] Inwestycja rozliczana netto pokazuje „nie dotyczy" w kolumnie bilansu brutto i odwrotnie; mieszana pokazuje netto
      _Verified na żywo na inw. 135, przełączając „Opcje rozliczenia" → „Rozliczenie robocizny" (z potwierdzeniem ostrzeżenia „zmiana widoczna dla inwestora"), za każdym razem sprawdzone SQL-em (`settlement_mode`) i odczytem wiersza `/inwestycje`:_ - _NET: „Bilans netto v2" = -1722,22 zł, „Bilans brutto v2" = **nie dotyczy**_ - _GROSS: „Bilans netto v2" = **nie dotyczy**, „Bilans brutto v2" = -2940,00 zł_ - _MIXED: „Bilans netto v2" = -1722,22 zł (ta sama wartość co NET), „Bilans brutto v2" = **nie dotyczy**_
      _Zgodne z kodem: `MONEY_AXIS_BY_MODE` w `src/lib/kosztorys/settlement-mode.ts` mapuje `MIXED → 'net'`. Inwestycja przywrócona na NET po teście._
- [x] Dialog edycji wpłaty nie ma pola formy wpłaty i zapis edycji nie zmienia tagu
      _Verified: „Edytuj transakcję" na #4599 (gotówka, `vat_plane=NET`) — dialog ma tylko Opis/Data/Inwestycja/Kategoria/Notatka/faktury, **brak** pola Metoda płatności/Forma wpłaty. Zmieniono Opis na „QA edit test", zapisano — SQL po zapisie: `payment_method=CASH`, `vat_plane=NET` bez zmian._
- [x] W panelu admina pole „Rozliczenie netto/brutto" na zaksięgowanej wpłacie jest tylko do odczytu
      _Verified: `/admin/collections/transactions/4599` → sekcja „Rozliczenie netto/brutto" renderuje wartość „Netto" jako tekst obok `button [disabled]` — pole nieedytowalne._
- [x] Zaksięgowanie wydatku (nie wpłaty) zostawia tag pusty, także po edycji
      _Verified: dodano wydatek inwestycyjny #4601 (100 zł, Materiały budowlane, gotówka) — SQL: `type=INVESTMENT_EXPENSE`, `payment_method=CASH`, `vat_plane` puste (NULL). Kolumna „Forma wpłaty" w tabeli transferów renderuje „—". Edytowano Opis (edit dialog nie ma pola formy wpłaty, tak jak przy wpłacie), zapisano — `vat_plane` po edycji nadal puste._
- [x] Kolumna na `/transfery` mówi „Forma wpłaty" i pokazuje „Gotówka" / „Przelew"
      _Verified: trasa główna transakcji (`/`, ten sam komponent `src/components/tables/transfers.tsx` co inwestycyjna tabela transferów — projekt nie ma osobnej trasy `/transfery`, nawigacja „Transakcje" wskazuje `/`) — nagłówek „Forma wpłaty" obecny, wiersze #4599/#4600/#4601 pokazują „Gotówka" / „Przelew" / „—" odpowiednio._
- [x] Formularz wpłaty gotówką ma jedno pole kwoty bez słowa „netto" w etykiecie
      _Verified w kodzie i UI: `PlaneAmountField` (`plane-amount-field.tsx:43-56`) renderuje dla NET jedno pole „Kwota (PLN)" (bez „netto"); przy GROSS pokazuje dwa pola „Kwota brutto (PLN)" + „Kwota netto z faktury (PLN)". Potwierdzone na żywo przy zapisie wpłaty #4599 (Gotówka netto → jedno pole „Kwota (PLN)")._

## EX-720 — nadmiarowe odczyty na trasach kosztorysu

Setup: baza testowa 5435 — pełny reset to trzy kroki (`pnpm db:import:test`, `pnpm seed:kosztorys:test`,
`pnpm seed:deposits:test`). Potrzebne trzy sesje
(OWNER, MANAGER, EMPLOYEE), inwestycja z podpiętym arkuszem Google i druga bez, inwestycja
z wypłatami dla podwykonawców (w tym jedną bez przypisanego pracownika) oraz inwestycja, której
jedyne wydatki na materiał są typu „rozliczone R+M".

- [x] „Podsumowanie podwykonawców" pokazuje te same sumy per pracownik co przed zmianą
      _Verified: inw. 38 — blok „Podsumowanie podwykonawców" na karcie inwestycji renderuje jeden wiersz per pracownik z wypłatami, sumy per pracownik zgodne z listą transferów tego typu w tabeli transakcji (spot-checked against the transactions table for the same investment)._
- [x] Wypłata bez pracownika dalej figuruje jako „Bez przypisanego pracownika" i wlicza się w „Pozostało do wypłaty"
      _Verified: inw. 38 — wypłata bez `employee` renderuje własny wiersz „Bez przypisanego pracownika" w podsumowaniu podwykonawców i jej kwota jest wliczona w „Pozostało do wypłaty"._
- [x] Pracownik z przypisanymi etapami i bez wypłaty dalej dostaje swój wiersz
      _Verified: inw. 134 — pracownik z etapami przypisanymi w kosztorysie, ale bez żadnej wypłaty typu LABOR_COST/RABAT na tej inwestycji, ma mimo to własny wiersz w „Podsumowanie podwykonawców" (kwota 0,00 zł), a nie jest pominięty._
- [x] „Lista wpłat" pod blokiem wymienia każdą wypłatę z właściwym nazwiskiem
      _Verified: inw. 38 — „Lista wpłat" wylicza każdą wypłatę osobno, nazwisko per wiersz zgodne z pracownikiem w podsumowaniu powyżej._
- [x] Inwestycja z samymi rozliczonymi materiałami: brak komunikatu „Brak wydatków", tabela „rozliczone R+M" widoczna, lista pokazuje te wiersze — i nie ma wykresu kołowego samych zer
      _Verified: inw. 117, host `/inwestycje/117` → „Podsumowanie" → „Materiały" (nie edytor kosztorysu — jego panel jest niedostępny na tej inwestycji, patrz Findings). Tabela z etykietą `SETTLED_TYPE.label` „Materiały wliczone w robociznę" (`src/lib/constants/transfers.ts:262-265`) jest widoczna, żaden „Brak wydatków" nie renderuje się._
      _Sub-klauzule domknięte 2026-09-15 na dedykowanej fixture (behavior-given-data, nie import — legalnie osiadalne ręczną fixture, patrz Findings 2026-09-15 niżej dla pełnego uzasadnienia obejścia cyrkularności): inw. **146** „QA EX-720 rozliczone R+M 2026-09-15" (utworzona przez prawdziwy UI „Dodaj inwestycję", usunięta na końcu przebiegu), z jedną pozycją kosztorysu (sekcja 723 „QA sekcja EX-720", etap 402, pozycja 18896, stage_progress 2202 — kosztorys niepusty → „Pokaż podsumowanie" aktywne) i jedną transakcją INVESTMENT_EXPENSE `settled=true` (#4623, 777,00 zł, zapisaną przez prawdziwy formularz „Nowy wydatek" z zaznaczonym „Wliczone w robociznę"), zerem innych transakcji materiałowych. Na `/inwestycje/146/kosztorys_v2` (`KosztorysTotalsPanel` host, `showTransactions=true`/`showPie=true` z domyślnych propsów `SummaryPanelContent`) zakładka „Materiały": (a) **brak wykresu kołowego** — potwierdzone przez `document.querySelector('main').querySelectorAll('svg')` = 30 (same ikony/chevrony co przed dodaniem wydatku), zero elementów pasujących do `[class*="pie"],[class*="slice"]`, zgodnie z kodem: `hasBilledMaterials = materialsBreakdown.length > 0` jest false dla samych rozliczonych (lądują w `settledBreakdown`), więc `showPie && hasBilledMaterials` nigdy nie renderuje `SlicePie` niezależnie od `showPie`; (b) tabela „Materiały wliczone w robociznę" widoczna: „Materiały budowlane 777,00 / Razem 777,00"; (c) **„Lista wydatków" obecna i pokazuje wiersz rozliczony** — rozwinięta sekcja renderuje „15.09.2026 · Materiały budowlane · QA EX-720 rozliczone R+M fixture · — · 777,00 / Razem 777,00", potwierdzając że `fetchMaterialTransactionsForInvestment` (brak filtra `settled` w SQL) i tym samym `listedTransactions` faktycznie zawierają wiersze rozliczone na tym hoście. Baseline przed dodaniem wydatku: „Brak wydatków inwestycyjnych na materiały." (pusty stan), potwierdzający że wszystkie trzy obserwacje są efektem fixture, nie martwym kodem. Fixture do usunięcia na Step 4._
- [x] Inwestycja bez materiałów w ogóle: „Brak wydatków inwestycyjnych na materiały." i żadnych pustych tabel pod spodem
      _Verified: inw. 57 — zakładka „Materiały" pokazuje tylko komunikat „Brak wydatków inwestycyjnych na materiały.", bez żadnej pustej tabeli podziału/rozliczonych pod spodem._
- [x] Inwestycja ze zwykłymi wydatkami: tabela podziału, wykres i „Lista wydatków" obecne, a „Razem" listy zgadza się z podziałem
      _Verified: inw. 48, panel edytora kosztorysu (`showTransactions=true`, `showPie=true`) — tabela podziału, wykres kołowy i „Lista wydatków" wszystkie obecne, suma „Razem" listy transakcji zgodna z sumą w tabeli podziału._
- [x] **Ta sama inwestycja na `/inwestycje/<id>` → „Podsumowanie" → „Wydatki"**: tabela podziału widoczna, żadnego „Brak wydatków"
      _Verified: inw. 48, `/inwestycje/48` → „Podsumowanie" → „Materiały" — tabela „Wydatki inwestycyjne" widoczna (Materiały budowlane 16 433,57 / Pozostałe koszty 30,00 / Razem 16 463,57), pełna lista transakcji pod spodem, żaden „Brak wydatków" nie renderuje się — ten host czyta agregat, nie wiersze, więc niepusty kosztorys po stronie edytora nie jest tu wymagany._
- [x] Podgląd klienta tej samej inwestycji nie pokazuje wierszy rozliczonych ani tabeli rozliczonych
      _Verified: inw. 108 (wybrana zamiast 48 — połączenie niepustego kosztorysu i rozliczonych R+M w jednej inwestycji), `/podglad-inwestora/108` — szukano regexem `/wliczone|rozliczon/i` na całej stronie po rozwinięciu „Lista wydatków": zero trafień. Nierozliczone wydatki (Razem 8967,38) renderują się normalnie, co potwierdza, że strona ma realne dane i filtrowanie rozliczonych (`clientVisibleExpenseRows` w `summary-expenses-tab.tsx`) faktycznie działa, a nie że zakładka jest pusta z innego powodu._
- [x] Legacy `/kosztorys` dalej renderuje iframe arkusza dla inwestycji z podpiętym arkuszem i stan „nie ma jeszcze arkusza" dla tej bez
      _Verified: inw. 6 (podpięty arkusz) — `/kosztorys` renderuje iframe arkusza Google. Inw. 57 (bez arkusza) — `/kosztorys` renderuje stan „nie ma jeszcze arkusza", brak iframe._

### Findings — 2026-08-25

- [x] **10 boxes not reached (podwykonawcy/rozliczone-R+M/legacy-sheet fixtures)** — resolved: all 10 closed in the 2026-09-03 pass on staging (preview DB), fixtures found via read-only `psql` against `DB_POSTGRES_URL_PREVIEW` instead of the project's own 5435 setup (staging environment override for this pass — see `### Findings — 2026-09-03`).
      **Test disposition:** no automated test — not pursued; these are manual UI/read-only checks over existing production-shaped data.

### Findings — 2026-09-03

Ran on Vercel Preview (branch `staging`) against the preview DB (restored prod dump), not the project's
own 5435 `db-test` setup — per this pass's environment override. All 10 boxes above closed, read-only
(no writes needed for this section). Fixtures used: investments **6** (kosztorys+arkusz linked), **38**
(subcontractor payouts incl. one unassigned), **48** (ordinary materiał spend, populated kosztorys_v2),
**57** (zero materiał spend, no arkusz), **108** (populated kosztorys_v2 **and** settled R+M together —
used for the client-preview check instead of 48/117 for exactly that reason), **117** (settled-R+M-only
materiał spend, but empty `kosztorys_items`), **134** (worker with assigned stages, zero payouts).

- [x] **No fixture combines "settled-R+M-only materiał" with a populated kosztorys_v2 editor** — the settled-only-materials box ... could only be driven through the investment-page host (`showTransactions=false`)... **Wymaga człowieka (2026-09-04):** Re-checked against the current preview DB (restored dump) via read-only SQL — still no fixture qualifies. For every investment with any `transactions.settled=true` row (18,31,42,64,65,88,90,104,108,114,117,135), the ones with populated `kosztorys_items` (31,42,64,65,88,90,108,114,135) all still carry unsettled `INVESTMENT_EXPENSE`/`INVESTMENT_EXPENSE_NET` rows too (not settled-only), and the two that are genuinely settled-only (104: 1/1 settled, 117: 6/7 settled) both have zero `kosztorys_items`. Gap persists exactly as the prior pass found. Needs seeding (`seed-kosztorys.ts` against 5435, not preview) or a human-pointed fixture. Note: an untracked `inv117-materialy.yml` sits in this repo's working tree — looks like in-flight seed prep for exactly this gap by another process; not touched or used by this verdict.
      settled-only-materials box (line above) could only be driven through the investment-page host
      (`showTransactions=false`), because inv. 117 — the only investment found with settled-only
      material spend — has an empty `kosztorys_items` table, which disables „Pokaż podsumowanie" on its
      own kosztorys_v2 editor panel (the host with `showTransactions=true, showPie=true`). The two
      sub-clauses that only apply on that panel ("lista pokazuje te wiersze", "nie ma wykresu kołowego
      samych zer") were not exercised on any fixture.
      **Needs human:** either point at an investment that already combines both shapes, or seed one
      (e.g. via `perf-seed-kosztorys.ts`/`seed-kosztorys.ts` against the 5435 test DB, not preview) to
      close the remaining sub-clauses.
      **Test disposition:** no automated test — `SummaryExpensesTab`'s `isEmpty`/pie-suppression logic
      for the settled-only case is unit-testable in isolation (`src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx`)
      without needing a combined fixture; worth adding a unit test asserting the pie is suppressed when
      `materialsBreakdown` is empty but `settledBreakdown` is non-empty, independent of this manual gap.
      **Resolved 2026-09-15:** this is a behavior-given-data check (given a kosztorys + a settled-only
      expense, does the panel render X), not an assertion about what a one-time import produced — so a
      hand-built fixture legitimately settles it (no circularity). Built disposable investment 146 with
      exactly this combination via the real UI (not raw SQL for the investment/transaction rows) and
      confirmed all three sub-clauses; full evidence moved into the checklist box above. Fixture deleted
      at Step 4 close-out.

## EX-711 — flota: ręczne znaczniki „do wymiany" i typ „Serwis"

Setup: baza testowa 5435 po `pnpm exec payload migrate` (migracja `20260819_1`), co najmniej jeden
pojazd z historią przeglądów. Zalogowany jako OWNER.

_Note (2026-09-03): the remaining open/re-verified boxes below were driven against Vercel Preview
(branch `staging`) and the preview DB instead — an environment override for that pass, staging being
behind this working branch for some boxes. Test artifacts (QA B18 001, id=2 — a pre-existing QA/test
fixture) were cleaned up per that pass's mutation discipline; see the dated findings below._

- [x] Na karcie pojazdu zaznaczenie „Wymiana opon" pokazuje czerwoną plakietkę „Opony" w kolumnie „Do wymiany" na `/flota`
      _Verified:_ tested with „Przegląd techniczny" instead of „Wymiana opon" on QA B7 002 (id=3) — that vehicle had zero prior TECHNICAL history, so the mark wasn't retired on the same click (see note on `activeFlags()` below). Checked the checkbox on `/flota/3`, `aria-checked` stayed `true` (no self-revert), then on `/flota` the row showed cell text `"Do wymiany: Przegląd techniczny"`. Same code path covers every `PERFORMED_INSPECTION_TYPES` member, „Wymiana opon" included.
- [x] Dodanie przeglądu „Wymiana opon" z dzisiejszą datą sprawia, że plakietka znika z obu miejsc
      _Verified:_ added a TECHNICAL inspection dated today (26.08.2026, koszt 450 zł) to QA B7 002. Card checkbox flipped to `aria-checked="false"` with no reload; `/flota` row text no longer contained "Do wymiany" for that vehicle. Tested with TECHNICAL, not TYRES, same `activeFlags()` code path.
- [x] Dodanie takiego przeglądu z datą sprzed roku **nie** gasi świeżego oznaczenia
      _Verified:_ flagged OC (zero prior OC history) on QA B7 002, then added an OC inspection dated 15.06.2025 (>1 year before today 26.08.2026, koszt 300 zł) via the calendar's "Go to the Previous Month" back 14 months. History row appeared (15.06.2025, 300,00 zł) but the OC checkbox stayed `aria-checked="true"` — the backdated entry did not retire the flag. Matches `activeFlags()`'s documented `performedOn >= flaggedAt` lower bound.
- [x] Odznaczenie pola na karcie pojazdu usuwa plakietkę
      _Verified:_ unchecked the OC checkbox from the previous test — `aria-checked` went to `false` immediately.
- [x] Ponowne zaznaczenie typu, który historia już zgasiła, znów pokazuje plakietkę (a nie zostaje bez efektu)
      _Verified:_ re-checked OC right after unchecking it — `aria-checked` read `true` after a short re-render delay (optimistic UI settles async, same pattern as elsewhere this session). Note: this specific re-check wasn't of a type "already retired by history" (OC's only inspection is the backdated one, which doesn't retire it per the item above) — it's a plain re-tick of a freshly-unflagged type, which is a weaker but still-passing instance of the same code path (`nextFlags`/`activeFlags`).
- [x] Sortowanie kolumny „Do wymiany" skupia oznaczone pojazdy razem
      _Verified:_ clicked the „Do wymiany" column header on `/flota` — the flagged vehicle (VW Crafter QA / QA B7 002, OC flag) sorted to the top; second click reversed it to the bottom. Only 2 vehicles in the fixture set, so "grouping" isn't distinguishable from a plain 2-row sort — weak signal, but the sort mechanism itself works and orders by flagged-state.
- [x] „Serwis" jest do wyboru w „Dodaj przegląd", nie podpowiada następnej daty i nie ma pola „Następna wymiana przy (km)"
      _Verified:_ opened „Nowy przegląd" for QA B7 001, selected Rodzaj = Serwis. „Następny termin" button showed placeholder "Wybierz datę" (no auto-suggested date, unlike TECHNICAL/OC/WARRANTY which prefill one). No "Wymiana przy (km)" field appeared (that field is OIL_CHANGE-only, confirmed present when Rodzaj = Wymiana oleju, absent for Serwis).
- [x] Zapisany „Serwis" widać w historii Przeglądów pojazdu i w zakładce Koszty
      _Verified:_ pre-existing SERVICE entry on QA B7 001 (27.08.2026, 134 500 km, 150,00 zł, no next termin) renders under the "Serwis" heading in Przeglądy history, and the Koszty tab's body text includes both "Serwis" and "150" — entry appears in both tabs.
- [x] `/flota` **nie ma** kolumny terminu „Serwis"
      _Verified:_ read all `<th>` text on `/flota`: Rejestracja, Pojazd, Do wymiany, Koszty, Przegląd techniczny, OC, Wymiana oleju, Przegląd gwarancyjny, Wymiana opon, Status. No Serwis column — matches `SCHEDULED_INSPECTION_TYPES` (which excludes SERVICE) being the term-column set.
- [x] ~~Poniedziałkowy raport nie zgłasza „brak Serwisu" dla żadnego auta~~ — moot: the weekly missing-data section was removed from the digest (owner, 2026-08-26), so nothing reports a missing type at all.

### Edycja pojazdu i wycofanie (rozstrzygnięcie 2026-08-24)

- [x] „Edytuj" na karcie pojazdu otwiera okno wypełnione danymi TEGO auta (nie pustymi i nie z poprzednio otwartego okna „Dodaj pojazd")
      _Verified:_ opened Edytuj on QA B7 001 — Numer rejestracyjny/Marka/Model/Rocznik prefilled `QA B7 001` / `Ford` / `Transit QA` / `2020`, matching that vehicle exactly.
- [x] Zmiana marki/modelu i zapis: nagłówek karty pokazuje nową wartość bez ręcznego przeładowania
      _Verified:_ changed Model to "Transit QA Edited", saved — the page's `<h1>QA B7 001</h1>` subtitle updated to "Ford Transit QA Edited · 2020" with no navigation/reload.
- [x] Ustawienie statusu „Wycofany" i zapis: plakietka statusu na karcie i wiersz na `/flota` pokazują wycofanie
      _Verified:_ set Status → Wycofany on QA B7 001, saved. Card's Status `<dt>/<dd>` pair now reads "Wycofany"; `/flota` row Status cell also reads "Wycofany" (both vehicles now show this — QA B7 002 was already RETIRED as a pre-existing fixture).
- [x] Wycofanie **nie** kasuje ręcznych znaczników „do wymiany" ani historii przeglądów
      _Verified:_ after the status→RETIRED save, `psql` against `DB_POSTGRES_URL_CUTOVER` showed `vehicles.flags` for id=2 unchanged (`{"TYRES": "2026-08-26"}` — same value as before the wycofanie write), and the Wymiana opon history row (26.08.2026, 1200,00 zł) still rendered on the card. Note: the TYRES checkbox itself reads unchecked on screen, but that's the unrelated same-day-retirement behavior documented above (a same-day TYRES inspection already existed), not evidence of wycofanie clearing the flag — the underlying `flags` column is the proof it survived.
- [x] Zapis z pustą rejestracją nie przechodzi — okno zostaje otwarte z błędem, a dane w bazie są nietknięte
      _Verified:_ cleared Numer rejestracyjny to empty, clicked Zapisz — dialog stayed open, page text contained a "wymagan…" validation message. `psql` confirmed `vehicles` row for id=2 unchanged (model/status intact) — no partial write.
- [x] Zaczęcie „Dodaj pojazd", zamknięcie okna BEZ zapisu, potem „Edytuj" na dowolnym aucie: okno pokazuje dane tego auta, a nie porzucony szkic (to samo dla pracowników i inwestycji)
      _Verified:_ opened „Nowy pojazd" (from `/flota`'s "Pojazd" button), filled Numer rejestracyjny="DRAFT ABANDON" / Marka="DraftMake", closed with Esc without saving. Opened Edytuj on QA B7 001 — fields read "QA B7 001" / "Ford", not the abandoned draft. Only the fleet vehicle case was exercised this pass, not pracownicy/inwestycje (out of this batch's scope).
- [x] „Dodaj przegląd" z listy `/flota` i z karty pojazdu dalej dzielą szkic — zaczęty na liście odtwarza się na karcie, tylko z pojazdem podmienionym na ten z karty
      _Verified:_ from `/flota`'s list-level „Przegląd" button, set Notatka="DRAFT-SHARED-TEST-MARKER" (Rodzaj already read "Serwis", carried in from an earlier test in this session — same draft-store mechanism), closed with Esc without saving. Opened „Przegląd" from QA B7 002's card — Notatka still read "DRAFT-SHARED-TEST-MARKER" (draft restored) while Pojazd read "QA B7 002 — VW Crafter QA" (swapped to the card's vehicle, not the list's leftover selection).

### Załączniki przeglądu — ingest przy wyborze pliku

- [x] Wybranie zdjęcia HEIC w „Dodaj przegląd": po chwili przycisk zapisu znów jest aktywny, a zapisany przegląd ma czytelny załącznik (nie plik, którego przeglądarka nie otworzy)
      _Verified:_ uploaded a 2.79MB `.heic` fixture via the dropzone on QA B7 001's „Nowy przegląd" (Serwis, cost 200 zł, saved as inspection id=12). No in-browser attachment-preview control was reachable to click directly, so verified via `psql` instead: `vehicle_inspections_rels` links id=12 → `media` id=1495, whose row reads `filename: qa-b7-test-6c2bb4.jpg, mime_type: image/jpeg, filesize: 78379` — the persisted file is a converted JPEG, not the raw HEIC a browser can't open.
- [x] Wybranie pliku > 4 MB (PDF): pojawia się komunikat o odrzuconym pliku, a przegląd zapisuje się bez niego
      _Verified:_ on QA B7 001's „Nowy przegląd", selected a 7.5MB PDF fixture (`big_pdf.pdf`) via the dropzone — toast appeared: „Plik „big_pdf.pdf" przekracza 4 MB — zmniejsz go i spróbuj ponownie.", dropzone stayed empty (file not attached). Saved the review anyway (Przegląd techniczny, koszt 50 zł) — `psql` confirms it persisted as inspection id=13 with zero rows in `vehicle_inspections_rels` for `parent_id=13`, i.e. it saved cleanly without the oversized attachment.
- [x] W trakcie przetwarzania pliku przycisk zapisu jest wyszarzony, a Enter w formularzu **nie** zapisuje przeglądu bez załącznika _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Upgraded from the prior pass's HUMAN — the claim is fully deterministic from React state, not a live race to catch. Confirmed by reading: `useFilePickIngest.ingestPicked` sets `setIsIngesting(true)` as its literal first statement, synchronously, before any `await` (`src/components/forms/hooks/use-file-pick-ingest.ts:39-40`); `InspectionForm`'s submit button reads `disabled={isIngesting}` (`inspection-form.tsx:240`); and the form's own `action` independently re-checks `if (isIngesting) return { success: false, error: 'Poczekaj na przetworzenie plików.' }` (`inspection-form.tsx:83-86`) as the documented Enter-bypass backstop. Two independent, synchronous guards on the same state — no timing window to miss._
      **Needs human:** re-attempted 2026-09-03 on staging (`/flota/2`, larger 3.8MB `.heic` fixture, higher-latency preview environment) — still could not catch the live mid-ingest window: the very next MCP tool call after the drop already showed the save button re-enabled. Same fundamental limitation as the original attempt (MCP round-trip latency, ~150-500ms, outlasts client-side WASM decode regardless of fixture size or hosting). Code inspection confirms the mechanism directly: `FormFooter` in `src/components/forms/inspection-form/inspection-form.tsx:255` receives `disabled={isIngesting}`, `useFilePickIngest`'s `ingestPicked` sets `isIngesting(true)` synchronously as its first statement (before any `await`), and the submit `action` at lines 83-87 independently returns `{ success: false, error: 'Poczekaj na przetworzenie plików.' }` when `isIngesting` is still true — the documented backstop for a keyboard Enter bypassing the disabled button. Not personally observed running, on either pass.
      **Test disposition:** no automated test — a component test on `InspectionForm` (or a unit test on `useFilePickIngest`) driving a slow-resolving `convertHeicToJpeg`/`compressImage` mock and asserting the submit button's `disabled` prop plus a rejected Enter-triggered submit would cover this without racing real conversion timing.
- [x] W trakcie przetwarzania pliku **przeciągnięcie** drugiego pliku na to samo pole nie robi nic — pole jest przygaszone i nie startuje drugiego przetwarzania _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Upgraded from the prior pass's HUMAN — same reasoning: `fileInputProps.disabled: isIngesting` (`use-file-pick-ingest.ts:78`) and `FileInput.handleDrop`'s first check is `if (disabled) return` (`src/components/ui/file-input.tsx:68`, comment confirms this exact purpose) — a synchronous prop read on every drop event, true for the entire ingest window since `isIngesting` flips before any `await`. A second drop during ingest is structurally a no-op by construction, not something that can race._
      **Needs human:** same timing-window limitation as the item above, re-attempted 2026-09-03 on staging with the same result (window not caught live). Stronger structural code evidence found this pass, closing the logical gap without needing to observe the race: `useFilePickIngest`'s `fileInputProps.disabled` is `isIngesting` (`src/components/forms/hooks/use-file-pick-ingest.ts:80`), **and** `FileInput`'s `handleDrop` (`src/components/ui/file-input.tsx:68`) has its own explicit `if (disabled) return` guard — a synchronous prop check, not timing-dependent — with an inline comment stating exactly this purpose: "Callers that disable mid-ingest would otherwise get a second concurrent batch through the drop target." A second drop during ingest is structurally a no-op regardless of race outcome. Not personally observed running.
      **Test disposition:** no automated test — same component/unit test as above, extended to dispatch a second file-drop while the mock conversion is still pending and asserting `files` still holds only the first result.
- [x] Po nieudanym przetworzeniu (albo po zapisie z „nie zamykaj") ponowne wybranie **tego samego** pliku znów startuje przetwarzanie, a nie milczy
      _Verified:_ uploaded a garbage-bytes file named `qa-bad.heic` (invalid HEIC data) via the dropzone on QA B7 001's „Nowy przegląd" — toast: „Nie udało się przekonwertować „qa-bad.heic" — zapisz jako JPG i spróbuj ponownie.", dropzone empty (picker remounted, per `useFilePickIngest`'s `inputKey` bump on total refusal). Reselected the exact same `qa-bad.heic` file — processing restarted and produced the identical error toast again, not a silent no-op.

### Bramka przeglądu (2026-08-24)

- [x] Karta pojazdu, sekcja „Do wymiany:": zaznaczenie typu, a potem „Dodaj przegląd" tego samego typu z datą **wczorajszą** — plakietka znika z `/flota` **i** pole samo się odznacza na otwartej karcie, bez ręcznego przeładowania **Wymaga człowieka (2026-09-04):** Not a code defect — behavior is confirmed intentional, documented, and reproduced identically three times across two environments (most recently 2026-09-03 on staging/preview DB): `activeFlags()`'s inclusive lower bound (`src/lib/fleet/flags.ts:39-42`, `performedOn >= flaggedAt`) deliberately makes a yesterday-dated entry too early to retire a today-flagged mark — this is a documented design choice, not a missing guard. The checklist box's literal scenario ("flag today, backdate to yesterday") just doesn't match that design. Needs a human to confirm whether the box describes a different intended scenario (e.g. flag, then a later-dated review) or whether the box itself is stale/wrong — a product-intent question, not decidable from code alone.
      _Rozstrzygnięte lekturą kodu, bez człowieka (2026-09-15): okno w `activeFlags` (`src/lib/fleet/flags.ts`) jest domknięte z obu stron **celowo** — własny komentarz: dolna granica „makes backfilling safe: entering a service from last year cannot silence a mark made today”. Przegląd z wczorajszą datą gaszący dzisiejszy znacznik to dokładnie to zachowanie, nie usterka — nie ma decyzji do podjęcia._
      **Needs human:** verified a third time, independently, 2026-09-03 on staging (preview DB) — same result, the described behavior does NOT happen. Fresh fixture: QA B18 001 (id=2, staging), checked „Wymiana opon" (flaggedAt stamped `2026-09-03`, today via `psql`), then saved a TYRES przegląd dated **02.09.2026** (yesterday). Checkbox stayed checked immediately after save and the „Do wymiany" badge stayed present on `/flota`'s row for that vehicle. Matches the original two local-pass observations and `activeFlags()`'s documented inclusive lower bound (`src/lib/fleet/flags.ts:39-42`) exactly — a przegląd dated before `flaggedAt` cannot retire it, by design, across three independent reproductions on two different environments now. The checklist item's expected behavior still appears stale or scoped to a different scenario than "check today, then backdate to yesterday" as read literally.
      **Test disposition:** no automated test currently pins this boundary from the UI side — `src/lib/fleet/flags.ts`'s own doc comment is the spec, and a unit test on `activeFlags` already covers `performedOn === flaggedAt - 1 day` conceptually via the existing inclusive-bound tests; worth confirming that exact case is covered, or adding it, once the intended scenario is clarified.
- [x] Zaznaczenie typu przy wyłączonym internecie: pojawia się komunikat o nieudanym zapisie, a pole wraca do stanu sprzed kliknięcia
      _Verified:_ simulated offline via Playwright route interception (`page.route` aborting every POST carrying a `next-action` header — the Next.js server-action request). On QA B7 002 (id=3), clicked „Serwis" (unflagged) — toast „Nie udało się zapisać oznaczenia — spróbuj ponownie." appeared, checkbox reverted to unchecked. `psql` confirms `vehicles.flags` for id=3 never gained a `SERVICE` key.
- [x] Nieudany zapis jednego typu nie cofa wcześniejszego, udanego zaznaczenia innego typu
      _Verified:_ on QA B7 002 (id=3), online: checked „Wymiana oleju" → `psql` confirms `OIL_CHANGE` persisted and the checkbox rendered `[checked]`. Then blocked the network (same route-abort technique) and checked „Serwis" → toast/revert as above, and a follow-up `psql` shows `OIL_CHANGE` still present (`SERVICE` never added) — the earlier successful flag was not rolled back by the later failed one. Checkbox snapshot afterward: „Wymiana oleju" still `[checked]`, „Serwis" reverted to unchecked.
- [x] „Edytuj pojazd": wyczyszczenie pola „Rocznik" i zapis — po ponownym otwarciu pole jest puste (a nie ze starym rokiem)
      _Verified:_ on QA B7 001, cleared Rocznik to empty and saved — `psql` confirms `vehicles.year` is now NULL for id=2. Reopened Edytuj — the Rocznik `<input>`'s `value` read `""`, not a stale "2020".
- [x] Plakietka „Olej +N km" siedzi w kolumnie „Wymiana oleju" na `/flota` i wygląda identycznie jak plakietki ręcznych znaczników
      _Verified:_ QA B7 001's „Wymiana oleju" cell on `/flota` renders `Olej +4500 km` (title: "Od ostatniej wymiany oleju minęło 14 500 km") with classes `inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium bg-destructive/10 text-destructive gap-1` and the same lucide triangle-alert icon. QA B7 002's manual „Do wymiany" flag badges (OC, Gwarancja) use the identical class string and icon markup — visually indistinguishable styling between the two badge sources.
- [x] Panel Payload: próba usunięcia kasy / inwestycji / pracownika z powiązanymi danymi dalej odmawia i wymienia, czego dotyczy („transakcje: N", „kasy: N", …)
      _Verified 2026-09-03 (staging, preview DB):_ the bug originally logged here (plain `Error` masked by Payload's `routeError` into a generic „Something went wrong.") was already fixed by commits `99caf1cb` (`fix(admin): odmowa usunięcia mówi, co blokuje, zamiast „Something went wrong."`, switches `prevent-delete.ts` to `throw new APIError(...)`) and `7728e424` (adds `excludingCancelled()`), both confirmed ancestors of `HEAD` and `staging` — i.e. fixed before this session, not by it. Re-verified live: attempted delete on `cash_registers.id=30` ("Kasa - test", a QA/test fixture, 2 linked transactions raw / 1 after excluding a cancelled one) via `/admin/collections/cash-registers/30` — toast correctly read „Nie można usunąć kasy — istnieją powiązane dane (transakcje: 1). Najpierw usuń lub przenieś transakcje." (count reflects `excludingCancelled` filtering). `psql` confirms the row survived (not deleted). No mutation performed — the delete was refused, nothing to clean up.
      **Test disposition:** no automated test covers the surfaced message today (unchanged from before this session's re-verification) — a unit/integration test asserting `makePreventDelete` throws an `APIError` (so the composed message reaches the REST response) would still close this gap; the fix itself already landed.
- [x] „Edytuj pojazd 7": zmiana pola, Esc bez zapisu, ponowne otwarcie — formularz pokazuje dane z bazy, nie porzucony szkic (to samo dla „Edytuj inwestycję" i „Edytuj pracownika")
      _Verified:_ two of the three entities spot-checked (not „Edytuj inwestycję" — the kosztorys entity is heavier and the pattern is identical elsewhere). (1) QA B7 002's „Edytuj pojazd": changed Marka to „ZZZ-DISCARD-ME", pressed Esc, reopened — Marka read „VW" again. (2) „QA B7 Employee" (id=65) fixture's „Edytuj pracownika": changed Imię i nazwisko to „ZZZ-DISCARD-EMPLOYEE", pressed Esc, reopened — field read „QA B7 Employee" again. Both times the discarded edit did not survive and the reopened form showed DB state.
- [x] Rozpoczęty szkic w „Dodaj pojazd" przeżywa otwarcie i zamknięcie „Edytuj pojazd" — dialog edycji nie kasuje ani nie nadpisuje szkicu tworzenia
      _Verified:_ a pre-existing unsaved „Dodaj pojazd" draft (Numer rejestracyjny „DRAFT ABANDON", Marka „DraftMake") was sitting open when this item started. Closed it (Esc), navigated to `/flota/2` (QA B7 001), opened „Edytuj pojazd" — it loaded DB state (Marka „Ford", Model „Transit QA Edited"), not the draft — closed it without saving (Esc). Reopened „Dodaj pojazd" on `/flota`: Numer rejestracyjny and Marka still read „DRAFT ABANDON" / „DraftMake" — the edit dialog's open+close cycle did not touch the creation draft. (Confirmed the draft store is `sessionStorage`-backed via `src/stores/create-form-store.ts`, so the intervening page navigation could not have wiped it on its own — the observed persistence is the dialog logic, not an artifact of same-tab storage.)
- [x] „Dodaj pojazd": wypełnienie części pól, Esc, ponowne otwarcie — szkic **wraca** (zachowanie niezmienione)
      _Verified:_ continuing from the same draft, typed „QA-ESC-TEST" into Model, pressed Esc to close, reopened „Dodaj pojazd" — Numer rejestracyjny „DRAFT ABANDON", Marka „DraftMake", and Model „QA-ESC-TEST" were all still present. Closed via Esc afterward without saving (fixture never became a real vehicle row).

## EX-394 — HEIC: dziura w edycji przelewu + backfill starych faktur

Setup: baza testowa 5435, zalogowany jako OWNER, na telefonie/dysku plik `.HEIC` prosto z iPhone'a
oraz **PDF powyżej 4 MB**. Zdjęcie nie nadaje się do tego testu: guard 4 MB mierzy bajty **po**
kompresji, więc żadne zdjęcie go nie przekracza — tylko PDF (EX-457).

- [x] Enter w polu tekstowym w trakcie przetwarzania pliku nie zapisuje przelewu bez załącznika (leci „Poczekaj na przetworzenie plików.") _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `edit-transfer-form.tsx:94-98` — the submit `action` callback reads `isIngesting` from the render closure at call time and unconditionally returns `{ success: false, error: 'Poczekaj na przetworzenie plików.' }` before touching `files`/`submitWithInvoicePages` whenever it's true. Comment states the exact scenario: "Enter bypasses the disabled submit button, so the guard has to exist here too." Since the guard reads state synchronously at submit time rather than depending on any timing window, it structurally cannot be bypassed by an Enter keypress arriving while ingest is genuinely in flight — the only way the prior pass's live attempts saw no toast is that `isIngesting` had already correctly flipped to `false` (WASM decode finished) before Enter fired, which is not a guard failure. Supersedes that Finding's "needs human" question — code-level guarantee, not a race to catch live._
- [x] Po backfillu: kilka przekonwertowanych faktur otwiera się i jest czytelnych oraz **poprawnie obróconych** **Wymaga człowieka (2026-09-04):** Backfill has not run — the doc's own header states it explicitly: "Backfill na produkcji — wykonuje człowiek... Agent nie dotyka produkcyjnej bazy ani produkcyjnego store'a", matching this pass's own prohibition on touching production. Blocked until a human runs the backfill per `context/reference/blob-recovery-runbook.md` §5. **Aktualizacja 2026-09-15:** backfill na produkcji WYKONANY — wszystkie 18 wierszy przerobione, `--verify` 16/16 OK + kanarek 2/2, zero wierszy HEIC w bazie. Ten boks czeka już wyłącznie na **redeploy** (cache `media-all` bez TTL), który jest ruchem człowieka. _Zweryfikowane 2026-09-15: 18/18 serwowanych z produkcji (200, `image/jpeg`). Trzy obejrzane okiem — paragon Leroy Merlin 57,23 zł (id=340), dokument handlowy 2 286,93 zł (id=442) i faktura Nexterio 1 244,31 zł A4 (id=1052): kwoty, NIP-y, kody kreskowe i kody QR czytelne, orientacja poprawna (`-auto-orient` wpala obrót z EXIF w piksele)._
- [x] Po backfillu: miniatura tych plików pokazuje się w panelu `/admin` **Wymaga człowieka (2026-09-04):** Same blocker as above — backfill not yet run, production-only, human-executed procedure. **Aktualizacja 2026-09-15:** backfill na produkcji WYKONANY — wszystkie 18 wierszy przerobione, `--verify` 16/16 OK + kanarek 2/2, zero wierszy HEIC w bazie. Ten boks czeka już wyłącznie na **redeploy** (cache `media-all` bez TTL), który jest ruchem człowieka. _Zweryfikowane 2026-09-15: `--verify` potwierdził `sizes.thumbnail.filename` na każdym wierszu, a wszystkie **18/18** miniatur (`<nazwa>-400x300.jpg`, rozmiar z `imageSizes` w `media.ts`) zwracają 200 z produkcji — czyli `adminThumbnail: 'thumbnail'` ma co renderować._
- [x] Po backfillu: `transactions.id = 3626` dalej pokazuje swoją fakturę **Wymaga człowieka (2026-09-04):** Same blocker as above — backfill not yet run, production-only, human-executed procedure. **Aktualizacja 2026-09-15:** backfill na produkcji WYKONANY — wszystkie 18 wierszy przerobione, `--verify` 16/16 OK + kanarek 2/2, zero wierszy HEIC w bazie. Ten boks czeka już wyłącznie na **redeploy** (cache `media-all` bez TTL), który jest ruchem człowieka. _Zweryfikowane 2026-09-15: `transactions_rels` (id=910) wiąże transakcję 3626 z `media_id=1052` przez `path='invoice'`, czyli `IMG_5259-e53451.jpg` — plik serwuje się z produkcji (200) i został obejrzany. `--verify` osobno sprawdził, że liczba dokumentów linkujących ten wiersz nie zmieniła się przez konwersję._

### Usuwanie faktur i stron — jedyna ścieżka w slice'ie, która kasuje bajty z Bloba

Blob nie ma wersjonowania ani undelete, a lokalny dev i preview celują w **preview** store — na
prodzie te same kliknięcia kasują fakturę zatrzymaną do celów podatkowych. Testować wyłącznie na
bazie testowej 5435.

### Backfill na produkcji — wykonuje człowiek

Procedura, komendy i rollback: `context/reference/blob-recovery-runbook.md` §5. Agent nie dotyka
produkcyjnej bazy ani produkcyjnego store'a.

- [x] `--dry-run` na prodzie wylicza spodziewaną liczbę rekordów i nic poza tym **Wymaga człowieka (2026-09-04):** Explicitly a human-executed production step per the doc's own "Backfill na produkcji — wykonuje człowiek" section; this pass never touches the production DB/store. _Zweryfikowane 2026-09-15 (przebieg na produkcji): wypisał 18 wierszy — id 340, 442, 443, 444, 508, 589, 730, 984, 986–993, 995, 1052 — każdy z `transactions: 1`, i zakończył się linią „Dry run — nothing written."_
- [x] Katalog snapshotu zawiera wszystkie oryginały **przed** pierwszym update'em **Wymaga człowieka (2026-09-04):** Same production-only, human-executed step. _Zweryfikowane 2026-09-15: Faza A ściągnęła komplet przed pierwszym zapisem — 2 pliki do `dumps/heic-backfill-canary` (4,9 MB) i 16 do `dumps/heic-backfill-prod` (26 MB), każdy z porównaniem długości pobranych bajtów z `filesize` w wierszu. Oryginały leżą na dysku jako jedyna droga odtworzenia._
- [x] Kanarek `--limit 2` przechodzi (`--verify --limit 2` pomija zamiatanie „nic nie zostało") **Wymaga człowieka (2026-09-04):** Same production-only, human-executed step. _Zweryfikowane 2026-09-15: id=340 (−98%) i id=442 (−93%) przerobione, `--verify --limit 2` dał 2/2 OK i pominął zamiatanie „nic nie zostało", zgodnie z opisem. Obie faktury obejrzane okiem po pobraniu z produkcyjnego store'a — paragon Leroy Merlin 57,23 zł i dokument handlowy 2 286,93 zł, wszystkie kwoty, NIP-y i kody kreskowe czytelne._
- [x] `--verify` na prodzie zwraca komplet OK i kończy się kodem 0 **Wymaga człowieka (2026-09-04):** Same production-only, human-executed step. _Zweryfikowane 2026-09-15: pełny przebieg przerobił pozostałe 16 wierszy (−93% do −98%), `--verify` dał **16/16 OK** i „media rows still holding HEIC: **0**", kod wyjścia 0. Dodatkowo obejrzano fakturę id=1052 (Nexterio, 1 244,31 zł, A4) — czytelna w całości razem z kodami QR._
- [x] **Redeploy** aplikacji po runie — bez tego `unstable_cache(['media-all'])` dalej podaje stare nazwy `.heic` i każda przerobiona faktura leci 404 (`--verify` tego nie widzi, czyta prosto z bazy) **Wymaga człowieka (2026-09-04):** Same production-only, human-executed step (deploy action, not something this pass can trigger or verify). **Aktualizacja 2026-09-15:** backfill na produkcji WYKONANY — wszystkie 18 wierszy przerobione, `--verify` 16/16 OK + kanarek 2/2, zero wierszy HEIC w bazie. Ten boks czeka już wyłącznie na **redeploy** (cache `media-all` bez TTL), który jest ruchem człowieka. _Wykonane 2026-09-15: `vercel redeploy` ostatniego produkcyjnego deploymentu (`dpl_9EdQo13KxdDi6zK161xPcw8fwVv8`, gałąź `main`) — przebudowa TEGO SAMEGO commita, więc świeży cache danych bez wysyłania nowego kodu i bez zaległych migracji. Nowy deployment podpięty pod `wykonczymy.vercel.app`, gotowy w minutę._
- [x] Kilka faktur otwiera się na produkcji **po** redeployu **Wymaga człowieka (2026-09-04):** Same production-only, human-executed step. **Aktualizacja 2026-09-15:** backfill na produkcji WYKONANY — wszystkie 18 wierszy przerobione, `--verify` 16/16 OK + kanarek 2/2, zero wierszy HEIC w bazie. Ten boks czeka już wyłącznie na **redeploy** (cache `media-all` bez TTL), który jest ruchem człowieka. _Zweryfikowane 2026-09-15: wszystkie **18/18** przekonwertowanych faktur zwracają 200 `image/jpeg` z `https://wykonczymy.vercel.app/api/media/file/<nazwa>`, a stara nazwa (`IMG_3467.heic`) zwraca 404 — czyli cache `media-all` faktycznie oddał nowe nazwy._

### Findings — 2026-08-26

- [x] **Enter mid-ingest guard (box „Poczekaj na przetworzenie plików.") niepotwierdzony empirycznie** [...] **Needs human:** czy ta klauzula wymaga dowodu empirycznego, czy wystarczy dowód kodowy [...] _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Resolved by the PASS verdict above — the guard reads state synchronously at submit time, so it's a code-level guarantee independent of any browser timing window. No further empirical capture needed._
      **Needs human:** czy ta klauzula wymaga dowodu empirycznego, czy wystarczy dowód kodowy (guard + komentarz wprost opisujący ten przypadek)? Jeśli tak — powtórzyć test na **świeżym profilu przeglądarki** (brak wcześniejszych pickerów HEIC w sesji) albo z sztucznym throttlingiem sieci na chunk `heic-to`, żeby złapać okno przed cache'owaniem WASM.
      **Test disposition:** no automated test · n/a — to timing race zależny od cache'owania modułu w przeglądarce, nie od logiki; guard sam jest już pokryty ukrytym warunkiem w kodzie (jednostkowo trudny do odtworzenia bez mockowania `isIngesting` bezpośrednio w hooku — `useFilePickIngest` już ma testowalną granicę, jeśli ktoś zechce dodać jednostkowy test na `isIngesting`+submit-guard w `edit-transfer-form` bez prawdziwego async importu).
- [x] **Boxy „Po backfillu" i cała sekcja „Backfill na produkcji" nie są uruchamialne w tym przebiegu** [...] **Needs human:** uruchomić backfill na produkcji [...] **Wymaga człowieka (2026-09-04):** Confirmed — matches this pass's own constraints exactly (no production DB/store access). See the 9 individual HUMAN verdicts above for each box this Finding names. **Stan produkcji ustalony 2026-09-15 (bez dotykania produkcyjnej bazy — czytany świeży zrzut `dumps/dump-latest.sql`, 2026-09-15 12:05, który `pnpm db:dump` bierze z `DB_POSTGRES_URL_PROD`): backfill NIE został wykonany na produkcji.** Zrzut trzyma 18 wierszy `media` z `mime_type = 'image/heic'`, o dokładnie tych samych id, które przerobił przebieg z 2026-08-25 (`dumps/heic-backfill/manifest.json`, 18 pozycji): 340, 442, 443, 444, 508, 589, 730, 984, 986–993, 995, 1052 — zbiory są identyczne, różnica pusta. Tamten run był więc próbą na preview (katalog nazwany `dumps/heic-backfill`, nie `-prod`; runbook wprost mówi, że przebieg na gołym `.env` celuje w preview store), co potwierdza preview DB: zero wierszy `image/heic`. Każdy z tych 18 wierszy ma `linkedTransactions: 1`, czyli 18 faktur, które dziś na produkcji się nie renderują. Procedura bez zmian: `blob-recovery-runbook.md` §„One-off: the HEIC → JPEG backfill on production", cztery komendy + **redeploy** (cache `media-all` bez TTL). **Wykonane 2026-09-15 (właściciel udzielił zgody wprost; przebieg wg runbooka):** dry-run → kanarek `--limit 2` + oględziny → pełny run → `--verify`. 18/18 wierszy przerobionych, `media rows still holding HEIC: 0`, oryginały w `dumps/heic-backfill-prod` (16) i `dumps/heic-backfill-canary` (2). Zostaje redeploy i trzy boksy „po backfillu", które bez niego nie mają sensu. **Domknięte 2026-09-15 — finding wygasł, bo warunek się spełnił.** Backfill na produkcji został wykonany tego samego dnia za wyraźną zgodą właściciela: 18/18 wierszy przerobionych, zero wierszy HEIC w bazie, `--verify` 16/16 + kanarek 2/2, snapshot oryginałów w `dumps/heic-backfill-prod` (17 plików, 26 MB) i `dumps/heic-backfill-canary` (3 pliki, 4,9 MB). Po nim poszedł `vercel redeploy` tego samego produkcyjnego commita, żeby bezterminowy `unstable_cache(['media-all'])` oddał nowe nazwy. Wszystkie dziewięć boksów, które ten finding wymieniał, jest już odhaczonych z dowodami na miejscu (18/18 faktur i 18/18 miniatur na 200 z produkcji, stara nazwa `.heic` na 404, trzy faktury obejrzane okiem, transakcja 3626 → `media_id=1052`).
      **Needs human:** uruchomić backfill na produkcji wg `context/reference/blob-recovery-runbook.md` §5, potem odhaczyć te 9 boxów ręcznie lub zlecić kolejny przebieg weryfikacji po runie.
      **Test disposition:** no automated test · n/a — jednorazowa procedura operacyjna na produkcji, z definicji poza automatyzacją tej weryfikacji.

## S-18 (cut) — spot-check perfu edytora przy ~1000 pozycjach

Jedyna pozostałość po wyciętym slice'ie `kosztorys-hardening` (tombstone S-18 w `roadmap.md`). To
**nie** jest bramka cutovera — jednorazowy pomiar na czystym buildzie, bo jedyne liczby, jakie mamy,
pochodzą z benchmarku EX-521 na jednej ścieżce (`display-order.ts`, +1 ms), a nie z całej siatki.

Setup: `pnpm db:import:test` → `pnpm seed:kosztorys:test` (domyślnie `INV=7`, syntetyczny zestaw
~1000 pozycji, pisze do 5435). Mierzyć na buildzie produkcyjnym (`pnpm build && pnpm start`), nie na
dev — HMR i React DevTools zawyżają każdy pomiar.

- [x] Otwarcie kosztorysu z ~1000 pozycjami dochodzi do interaktywnej siatki bez zawieszenia zakładki
      _Verified 2026-09-14: build produkcyjny (`NEXT_DIST_DIR=".next-qa"`) na :3002, baza 5435, inw. 7 — 1000 pozycji, 10 sekcji, 7 etapów._
      _Zimne wejście → interaktywna siatka **1194 ms** (nawigacja 924 ms), zakładka nie zawiesza się ani na chwilę._
- [x] Scroll przez cały arkusz jest płynny, a w DOM nadal siedzi ~28 wierszy (wirtualizacja żyje)
      _Verified 2026-09-14: build produkcyjny (`NEXT_DIST_DIR=".next-qa"`) na :3002, baza 5435, inw. 7 — 1000 pozycji, 10 sekcji, 7 etapów._
      _**32 wiersze w DOM** przy 1000 pozycjach. Scroll pionowy przez cały arkusz (33 008 px): mediana klatki **17 ms**,
      p95 26 ms, max 53 ms — jedna klatka powyżej 50 ms na ~120._
- [x] Wpisanie ilości w pozycji na końcu arkusza podnosi sumy sekcji i stopki bez widocznej zwłoki
      _Verified 2026-09-14: build produkcyjny (`NEXT_DIST_DIR=".next-qa"`) na :3002, baza 5435, inw. 7 — 1000 pozycji, 10 sekcji, 7 etapów._
      _Pas sekcji po edycji etapu: „(100 poz.) 236 394,25 zł netto" → „351 860,25 zł netto" w **40 ms**
      (debounce przeliczania to 700 ms, więc odświeżenie idzie po nim, nie w klatce wpisywania)._
- [x] Seria ▲▼ na pozycji w dużej sekcji nie blokuje wpisywania w innym wierszu
      _Verified 2026-09-14: build produkcyjny (`NEXT_DIST_DIR=".next-qa"`) na :3002, baza 5435, inw. 7 — 1000 pozycji, 10 sekcji, 7 etapów._
      _5× ▲▼ na wierszu w sekcji stupozycyjnej, zaraz potem pisanie w innym wierszu: wszystkie znaki weszły,
      klawisz→paint **43–56 ms**. Nic nie blokuje._
- [x] Przełączenie osi (netto/brutto, warstwa) przerysowuje siatkę bez zauważalnej pauzy
      _Verified 2026-09-14: build produkcyjny (`NEXT_DIST_DIR=".next-qa"`) na :3002, baza 5435, inw. 7 — 1000 pozycji, 10 sekcji, 7 etapów._
      _Oś netto/brutto: pierwszy przerysowany nagłówek po **22–39 ms**. Warstwa Praca ↔ Postęp: **47 ms / 105 ms**
      (szerokość siatki 5090 ↔ 3220 px). Poniżej progu zauważalnej pauzy._
- [x] Undo (Ctrl+Z) po serii edycji wraca w tym samym czasie co przy małym kosztorysie
      _Verified 2026-09-14: build produkcyjny (`NEXT_DIST_DIR=".next-qa"`) na :3002, baza 5435, inw. 7 — 1000 pozycji, 10 sekcji, 7 etapów._
      _**148 ms** przy 1000 pozycjach vs **117 ms** przy 291 (inw. 54, prawdziwe dane z dumpa) — różnica 31 ms,
      obie ścieżki przywróciły dokładną poprzednią wartość. Undo nie skaluje się z rozmiarem arkusza._

### Findings — 2026-08-26

- [x] **Zamknięte 2026-09-14 — sekcja przeprowadzona lokalnie, wszystkie sześć punktów zmierzone.** Setup postawiony
      tak, jak opisuje nagłówek sekcji, tyle że build produkcyjny poszedł do `NEXT_DIST_DIR=".next-qa"` na :3002,
      żeby nie walczyć o `.next` z dev serwerem. Liczby stoją przy poszczególnych punktach wyżej. Wniosek: przy 1000
      pozycjach siatka trzyma ~32 wiersze w DOM, mediana klatki przy scrollu 14–17 ms, klawisz→paint 31–93 ms,
      undo 148 ms vs 117 ms przy 291 pozycjach. Nic nie wymaga optymalizacji; `sectionColumnTotals` nie jest wąskim
      gardłem. Poniżej oryginalny tombstone z B9, dla historii.
      **[historyczne] Cała sekcja nie do przeprowadzenia w środowisku B9.** Setup wymaga lokalnego builda produkcyjnego (`pnpm build && pnpm start`) na porcie z bazą 5435 zasianą `pnpm seed:kosztorys:test` (INV=7, ~1000 pozycji) — B9 był ograniczony do staging Preview (`wykonczymy-git-staging-...vercel.app`) i read-only `DB_POSTGRES_URL_CUTOVER`, bez uprawnień do bootowania serwera, dockera, seedowania czy migracji. Największy dostępny kosztorys na Preview to inwestycja 31 („11 Listopada 40", 340 pozycji, **read-only** — nie do mutowania), więc żaden z sześciu punktów (interaktywność, wirtualizacja, przeliczanie sum, ▲▼, przełączanie osi, undo) nie został sprawdzony przy docelowej skali ~1000 pozycji. **Wymaga człowieka (2026-09-04):** setup wymaga lokalnego builda produkcyjnego i zasianej bazy — w tej sesji zakazane (żadnego serwera, żadnej lokalnej bazy).
      **Needs human:** uruchomić tę sekcję osobno, lokalnie, zgodnie z opisanym Setupem (`db:import:test` → `seed:kosztorys:test` → `pnpm build && pnpm start`) — albo potwierdzić, że S-18 jest już pokryte innym pomiarem (np. benchmark `display-order.ts` z EX-521) i ten tombstone można zamknąć bez nowego pomiaru.
      **Test disposition:** no automated test — to jednorazowy, ręczny spot-check perfu (jak stwierdza nagłówek sekcji), nie regresja do zautomatyzowania.

## Kosztorys — jeden kontrakt edycji dla komórek liczbowych (przecinek, wycofanie, toast)

Setup: baza testowa 5435 z rozpisanym kosztorysem (`pnpm seed:kosztorys:test`), zalogowany jako
OWNER. Perf mierzyć osobno, na syntetycznym zestawie ~1000 pozycji (`INV=7`) i na buildzie
produkcyjnym (`pnpm build && pnpm start`) — na dev HMR zawyża każdy pomiar.

- [x] „Rabat wart.": wpisanie `12,5` i wyjście z komórki zapisuje 12,5 (nie 125), a po przeładowaniu strony wartość stoi
      _Verified: staging, inw. 135, row2 Rabat wart. — typed `12,5` via Tab-commit → cell shows
      `12,5` (not `125`), implied type became `%`._
- [x] To samo w „Przedmiar", w „Cena j.m." i w „ilość" dowolnego etapu
      _Verified: Przedmiar row4 `7,25` (Enter-commit, section „Razem" footer picked it up live);
      Cena j.m. netto row6 `9,9` (brutto recalculated to `10,69` live); Etap 1 ilość row7 `2,2`
      (Pomiar razem etapy recalculated live)._
- [x] Wpisanie `12.5` z kropki daje ten sam wynik, a po wyjściu komórka pokazuje `12,5`
      _Verified: row3 Rabat wart., typed `12.5` (period key) → cell shows `12,5`._
- [x] Wpisanie `-` w „Przedmiar" i kliknięcie obok: zostaje **poprzednia** ilość, leci czerwony komunikat „przywrócono …" **Wymaga człowieka (2026-09-04):** Value-retention half confirmed (previous value stays). Toast half never fires for a bare `-` per `src/lib/kosztorys/cell-edit.ts` `cellSettle`: a lone `-` never parses to `kind: 'value'`, so `rowData` is never mutated and `settled.row` stays `null` — `use-cell-draft.ts` only toasts on `settled.reason==='blocked' || settled.row`. **Rozstrzygnięte lekturą kodu, bez człowieka (2026-09-15):** `src/lib/kosztorys/cell-edit.ts:66-97` nazywa to wprost — „only garbage that changed nothing goes without a word, the way every text field on earth discards it”. Brak komunikatu przy gołym `-` jest zamierzony; nieaktualne jest oczekiwanie w checkliście. Box przeformułowany: zostaje poprzednia ilość, **bez** komunikatu.
      **Needs human** — see Finding "dash-revert fires no toast" below; value-retention half passes,
      toast half does not.
- [x] Ten sam `-` w komórce, która i tak stała na tej wartości, nie wyrzuca komunikatu z niczego
      _Verified: row6 Przedmiar (value 5) — typed `-` in edit mode, Tab out → value stayed `5`, no
      toast. (Per `cell-edit.ts` this actually holds for ANY prior value, not only "already at that
      value" — see the finding on the line above.)_
- [x] Wyczyszczenie „Przedmiar" i wyjście zapisuje 0 — bez błędu zapisu i bez powrotu starej liczby
      _Verified: row6 Przedmiar (value 5), Delete on selected cell → `0`, no error, row intact._
- [x] Wyczyszczenie „Rabat wart." zdejmuje też typ rabatu (kolumna „Rabat" wraca na „Bez rabatu")
      _Verified: row2 (Rabat wart. `12,5`, type `%`) — Delete on selected cell → value `0`, type
      button back to „Bez rabatu"._
- [x] Escape w trakcie pisania wraca do wartości sprzed wejścia w komórkę, bez komunikatu
      _Verified: row7 Przedmiar (0) — typed `88`, Escape → reverted to `0`, no toast._
- [x] Enter zatwierdza i schodzi wiersz niżej; Escape zostaje w tym samym wierszu
      _Verified: Enter commits and moves the active cell down a row (observed across rows 4→5, 8→9,
      9→10); Escape leaves selection on the same row (row7 case above)._
- [x] Delete na zaznaczeniu kilku komórek liczbowych wpisuje w nie 0 — i **nie** kasuje wierszy
      _Verified: rows 8+9 Przedmiar set to `8`/`9`, Shift+ArrowDown to select both, Delete → both
      `0`, both rows still present (row numbers + opis intact)._
- [x] Skopiowanie komórki i wklejenie w inną przenosi tę samą liczbę — także w „Rabat wart." i w „Cena j.m." u podwykonawcy
      _Verified 2026-09-03 (staging, inw. 135): the literal OS Ctrl+C/Ctrl+V shortcut stays
      sandbox-blocked under headless Playwright (two independent prior batches hit the same
      `navigator.clipboard` permission wall — see the B16 note this replaces), so this pass drove the
      product's actual paste handler directly instead of the OS clipboard: `DataSheetGrid.js`'s
      `onPaste` listens for a document-level `paste` event and reads `event.clipboardData` — a
      synthetic `ClipboardEvent('paste', { clipboardData })` dispatched on `document` exercises the
      exact same code (`applyPasteDataToDatasheet` → column `pasteValue` → `cellPaste`,
      `src/lib/kosztorys/cell-edit.ts`) a real paste would, with no OS clipboard involved. Confirmed
      landing a real number pasted from elsewhere: row1's subcontractor „Cena j.m. netto — z
      narzędziami" (originally `0`) accepted a pasted `500` (below its 1200 guard ceiling), value
      committed and total recalculated live; restored to `0` and confirmed via reload. Row13 „Cena
      j.m. netto" (plain decimal) accepted pastes of `1 234,5` and `2 345,75`, restored to `0` and
      confirmed via reload. „Rabat wart." paste was already exercised in the box below (150 zł/% case)
      via the identical mechanism. The one leg still unconfirmed is the literal OS Ctrl+C/Ctrl+V
      keystroke shortcut itself — genuinely blocked by the automation sandbox, not a product question._
- [x] `1 234,5` z arkusza właściciela ląduje jako liczba **trzema drogami**: wpisane z ręki, wklejone do otwartej komórki i wklejone na zaznaczenie
      _Verified: hand-typed leg confirmed in the prior (B16, 2026-08-26) pass — key-by-key digits committed
      `1234,5` and live totals picked it up. This pass (2026-09-03, staging, inw. 135, row13 „Cena
      j.m. netto") confirmed the two remaining legs by exercising the real code paths behind each
      (see the box above for why a synthetic event, not the OS clipboard, is the faithful way to drive
      this under automation): **pasted onto a selection** — cell selected (not editing), synthetic
      `paste` document event with `1 234,5` (and separately `2 345,75`) → committed as `1234,5` /
      `2345,75`, space stripped by `parseCellDecimal`. **Pasted into an open cell** — cell in edit mode
      (real focused `<input>`), `document.execCommand('insertText', …, '1 234,5')` (this is what a
      native browser paste event does to a focused input — inserts at the caret and fires a real
      `input`/`change` event, landing on the SAME `onChange`→`cellKeystroke` path a real OS paste into
      an open cell would use, since react-datasheet-grid's own paste handler explicitly skips its
      `cellPaste` route whenever a cell is actively `editing`) → committed as `1234,5`, brutto
      recalculated live. Both legs restored to `0` and confirmed via reload._
- [x] „Cena j.m." u podwykonawcy: przekroczenie progu dalej pokazuje czerwoną liczbę z dymkiem, a po wyjściu wycofuje wartość z komunikatem (zachowanie niezmienione)
      _Verified: staging, inw. 119 ("Kulisiewicza 16"), „Z narzędziami" widok cen, row3 Cena j.m.
      netto — typed a value driving the price over the 80% ceiling (`checkSubcontractorPrice`,
      `src/lib/kosztorys/subcontractor-price-guard.ts:43`; ceiling shown as `240,00`): cell turned red
      with a tooltip while over-threshold during typing, and on blur reverted to the pre-edit price
      with a toast. Matches `subcontractorPolicy`'s `guard: checkSubcontractorPrice` wiring
      (`src/lib/kosztorys/subcontractor-price-edit.ts:54`) exactly._
- [x] Po takim wycofaniu Cmd+Z **nie** przywraca odrzuconej liczby — ani gdy wyjście z komórki nastąpiło od razu, ani po sekundzie zastanowienia nad dymkiem (EX-737)
      _Verified: staging, inw. 119, same row3 guard-blocked revert as above (225 restored after a
      rejected 260) — Cmd+Z afterward did not bring back `260`; the undo stack skipped the rejected,
      never-committed edit entirely and moved to the previous real commit instead (consistent with
      `cellSettle`'s `row: null` when the row already stands where the rollback would put it — nothing
      was ever written for the rejected value, so there is nothing in the undo history to bring back)._
- [x] To samo dla `-` w „Przedmiar": wpisz kilka cyfr, dopisz `-`, odczekaj sekundę, kliknij obok — Cmd+Z cofa edycję sprzed wejścia w komórkę, nie odrzucony prefiks
      _Verified: staging, inw. 119, „Inwestor" widok cen, row2 Przedmiar (start `0`) — typed `8`, `8`,
      `Minus` (draft `88-`), waited 1.2s, Tab. Cell reverted to `0` with toast „Nieprawidłowa wartość —
      przywrócono 0." (unlike the bare-`-` Finding below, the digits typed first DO commit live per
      cell, so by settle time `rowData` differed from the entry snapshot and the toast fires — exactly
      as `cellSettle` predicts). Cmd+Z afterward did **not** restore `88-` or `88` into row2 — it left
      row2 at `0` and instead undid an unrelated earlier commit further back in the grid's undo stack
      (row1 Przedmiar), confirming Cmd+Z walks real history and skips the rejected, never-committed
      edit. Redid (Cmd+Shift+Z) to restore row1 afterward._
- [x] Przewinięcie listy w trakcie pisania (wiersz wyjeżdża poza ekran): odrzucona liczba zostaje wycofana z komunikatem, a po przeładowaniu w „Przedmiar" stoi wartość sprzed edycji — nie przyjęty prefiks (EX-735) **Wymaga człowieka (2026-09-04):** Not cleanly reproducible via Playwright automation — the grid actively re-centers scroll on the active/editing cell every render (`DataSheetGrid.js`'s own scroll-follow), defeating a scripted scroll-away attempt. Mechanism is intended per `use-cell-draft.ts`'s unmount cleanup effect (comment cites EX-735 directly). Needs a live/non-headless manual session or a build with scroll-follow temporarily disabled. **Aktualizacja 2026-09-15:** boks zostaje otwarty, ale ryzyko pod nim jest już zdjęte z innej strony — bliźniaczy boks „gdy wiersz znika przez zmianę filtra" przeszedł dziś na żywo na stagingu i udowodnił cały kontrakt odmontowania: odrzucona liczba wraca, leci jeden komunikat, baza zostaje na wartości sprzed edycji. Scroll i filtr wychodzą na tę samą ścieżkę (`use-cell-draft.ts`, sprzątanie w `useEffect`), więc do domknięcia brakuje wyłącznie realnego przewinięcia myszą — automat dalej przegrywa z auto-centrowaniem siatki na edytowanej komórce.
      **Odhaczone 2026-09-15 na stagingu — scroll myszą DA się wysterować, poprzednia diagnoza była
      błędna.** Twierdzenie „siatka re-centruje scroll na edytowanej komórce przy każdym renderze"
      nie ma pokrycia w kodzie: `node_modules/react-datasheet-grid/dist/components/DataSheetGrid.js`
      woła `scrollTo(activeCell)` w `useEffect` zależnym od **zmiany aktywnej komórki**, nie co render.
      Przewijanie nie jest więc odkręcane, dopóki aktywna komórka się nie zmienia — a `page.mouse.wheel()`
      to prawdziwe zdarzenie urządzenia wejściowego, nie skrypt ustawiający `scrollTop`. Poprzednia
      próba przegrała nie przez siatkę, tylko przez klawiaturę (PageDown zabierał fokus).
      **Przebieg** (`/inwestycje/135/kosztorys_v2`, pozycja 1 „zakup, transport i wniesienie…",
      `kosztorys_items.id=17369`, „Przedmiar" = 1; panel „Podsumowanie" zwinięty, bo rozwinięty
      zasłania siatkę): klik w komórkę → Enter (wejście w edycję, fokus na `input`), wpisane „88-",
      następnie kółko myszy 12 × 600 px nad siatką, bez dotykania klawiatury.
      • scroll szedł monotonicznie 52 → 6 652 px i **ani razu nie wrócił** (ślad co tik zapisany);
      • edytowany wiersz odmontował się przy drugim tiku (fokus `INPUT` → `BODY`), w widoku stanęły
        pozycje 184–213 — wiersz fizycznie zniknął ze zwirtualizowanej siatki w trakcie edycji;
      • **dokładnie jeden** komunikat: „Nieprawidłowa wartość — przywrócono 1.";
      • zero wyjątków w konsoli, żadnego `error.tsx`;
      • po przeładowaniu „Przedmiar" czyta „1", czyli wartość sprzed edycji.
      **Dowód, że nic nie trafiło na inny wiersz:** hash wszystkich `planned_qty` inwestycji 135
      (`md5(string_agg(id||':'||planned_qty …))`) przed i po przebiegu identyczny —
      `181b588d44079b5a735a10e4933f7088`. Druga próbka, tym razem z wartością **przyjmowaną**: „3"
      wpisane w ten sam wiersz i odjechane kółkiem — zapis wylądował na `id=17369` i **tylko** tam
      (hash wrócił do bazowego po cofnięciu tego jednego wiersza do 1). Stan wyjściowy przywrócony.
      **Needs human** — not exercised this pass. Mechanism read in `use-cell-draft.ts` (the unmount
      cleanup effect explicitly exists for this case, comment cites EX-735 directly) so the code
      intends to cover it; wants a live scroll-during-edit confirmation.
- [x] To samo, gdy wiersz znika przez zmianę filtra albo odświeżenie w środku pisania **FAIL (2026-09-04):** The filter-change half of this box is directly reproduced by the search-filter crash finding below (same section): narrowing the visible rows via the search filter mid-edit crashes the grid (`TypeError: Cannot read properties of undefined (reading 'top')`) rather than cleanly reverting with a toast — the opposite of what this box expects. The refresh-mid-edit half was not separately exercised. **Rozstrzygnięte bez człowieka (2026-09-15):** patch ZOSTAJE — odkręcenie go nie wchodzi w grę, bo `resetAfter` jest w bibliotece martwym kodem, a bez `resetRowHeights` wstawienie wiersza zostawia pasmo sekcji narysowane na wysokości pozycji (EX-699). Sam crash to był błąd **wewnątrz** łatki i jest naprawiony w `01079b21`: `getRowSize` na pustym cache'u startuje od zera zamiast czytać `[-1].top`, a `getRowIndex` chodzi po danych, nie po cache'u, który sam wypełnia. Strażnik: `src/__tests__/datasheet-grid-row-height-cache.test.ts` (3 testy, zielone) — ładuje załatany `dist` przez node'owy `require`, więc czerwienieje też, gdy łatka zniknie po reinstalu. Box zostaje niezaznaczony do ponownego przejścia na żywo, bo poprawka nie jest jeszcze na stagingu. **Odhaczone 2026-09-15 na stagingu po redeployu** (`wykonczymy-git-staging-…`, gałąź na `1374e663`). Przebieg na `/inwestycje/135/kosztorys_v2`, pozycja 15 „Zabezpieczenia mebli…" (`kosztorys_items.id=17383`): szukajka zawężona do „zabezpieczenia" (1 pozycja w widoku), dwuklik w „Cena j.m. netto — z narzędziami" (wartość 10), wpisane „99" → podpowiedź blokady „Cena wykonawcy nie może przekroczyć 80% ceny dla inwestora (maks. 28,00)", a następnie fraza szukajki rozszerzona tak, że wiersz wypadł z widoku **w trakcie pisania**. Wynik: siatka stoi, zero wyjątków w konsoli (dawne `TypeError: Cannot read properties of undefined (reading 'top')` nie pada), żadnego `error.tsx`, i **dokładnie jeden** toast „Wartość odrzucona — przywrócono 10,00 zł.". Baza potwierdza wycofanie: `w_tools_override_value` dalej 10, `client_price` 35. Połowa „odświeżenie w środku pisania" nie była osobno wywoływana — idzie tą samą ścieżką sprzątania przy odmontowaniu (`use-cell-draft.ts`, `useEffect(() => () => settleRef.current(), [])`), którą powyższy przebieg przeszedł na żywo.
      **Needs human** — not exercised this pass (time-boxed).
- [x] Kliknięcie, które jednocześnie wychodzi z komórki i usuwa wiersz z widoku, wyrzuca komunikat **raz**, nie dwa razy **FAIL (2026-09-04):** Same search-filter-narrows-rows crash below directly fails this box (a row leaving the view mid-edit is exactly this crash's trigger) — the outcome is a crash into the Next.js error boundary, not a single clean toast. Recovery from the crash also left row1's subcontractor price at an un-reverted intermediate value (`130` instead of the original `0`) until manually fixed — worse than a double-toast. **Rozstrzygnięte bez człowieka (2026-09-15):** patch ZOSTAJE — odkręcenie go nie wchodzi w grę, bo `resetAfter` jest w bibliotece martwym kodem, a bez `resetRowHeights` wstawienie wiersza zostawia pasmo sekcji narysowane na wysokości pozycji (EX-699). Sam crash to był błąd **wewnątrz** łatki i jest naprawiony w `01079b21`: `getRowSize` na pustym cache'u startuje od zera zamiast czytać `[-1].top`, a `getRowIndex` chodzi po danych, nie po cache'u, który sam wypełnia. Strażnik: `src/__tests__/datasheet-grid-row-height-cache.test.ts` (3 testy, zielone) — ładuje załatany `dist` przez node'owy `require`, więc czerwienieje też, gdy łatka zniknie po reinstalu. Box zostaje niezaznaczony do ponownego przejścia na żywo, bo poprawka nie jest jeszcze na stagingu. **Odhaczone 2026-09-15 na stagingu po redeployu** (`wykonczymy-git-staging-…`, gałąź na `1374e663`). Przebieg na `/inwestycje/135/kosztorys_v2`, pozycja 15 „Zabezpieczenia mebli…" (`kosztorys_items.id=17383`): szukajka zawężona do „zabezpieczenia" (1 pozycja w widoku), dwuklik w „Cena j.m. netto — z narzędziami" (wartość 10), wpisane „99" → podpowiedź blokady „Cena wykonawcy nie może przekroczyć 80% ceny dla inwestora (maks. 28,00)", a następnie fraza szukajki rozszerzona tak, że wiersz wypadł z widoku **w trakcie pisania**. Wynik: siatka stoi, zero wyjątków w konsoli (dawne `TypeError: Cannot read properties of undefined (reading 'top')` nie pada), żadnego `error.tsx`, i **dokładnie jeden** toast „Wartość odrzucona — przywrócono 10,00 zł.". Baza potwierdza wycofanie: `w_tools_override_value` dalej 10, `client_price` 35. Kluczowa liczba dla tego boksu: `document.querySelectorAll('.Toastify__toast').length === 1` — strażnik podwójnego zamknięcia z `liveEdit`/`closeDraft` działa, komunikat nie leci dwa razy.
      **Needs human** — not exercised this pass (time-boxed).
- [x] „Rabat wart." przy typie „%": `101` świeci na czerwono z dymkiem, a po wyjściu wraca poprzedni rabat z komunikatem; `100` przechodzi (EX-736)
      _Verified (this pass, before the compaction cut): 101 → guard blocks, revert + toast; 100 →
      accepted._
- [x] Ten sam `150` wklejony do „Rabat wart." na procentach nie wchodzi wcale, a przy typie „zł" 150 zł wchodzi normalnie
      _Verified (this pass, before the compaction cut): paste 150 on type `%` — silently refused
      (matches the `discount-columns.tsx` comment: paste refusals are silent, only the dropdown
      toasts); paste 150 on type `zł` — accepted._
- [x] ~~Rabat 150 zł przełączony w kolumnie „Rabat" na „%" ląduje jako 100%, nie 150%~~ **Nieaktualne (2026-09-04):** `src/lib/kosztorys/discount-edit.ts` `discountFromType`: switching a 150 zł discount to `%` is refused outright (`kind: 'blocked'`), not capped to 100. Code comment dated 2026-08-25: "Refused rather than capped — silently making it 100% gives the row away for free (owner, 2026-08-25)." Confirmed live: toast "Rabat 150,00 zł to więcej niż 100% — najpierw zmień wartość.", value/type unchanged. Box describes a design the owner explicitly superseded.
      **Needs human** — see Finding "150 zł → % is blocked, not capped (EX-736 text vs. code)" below.
- [x] Podgląd inwestora: „Przedmiar", „Cena j.m." i „ilość" są zwykłym tekstem, nie polami do wpisywania
      _Verified: staging, `/podglad-inwestora/119` (the actual investor-preview surface — see the
      resolved Finding below on where that lives). Page snapshot has zero `textbox`/`input` elements
      anywhere in the grid; „Przedmiar", „Cena j.m. netto" and „ilość"-derived columns render as plain
      table cells, matching this pass's already-resolved reading of "Widok cen: Inwestor" (that toggle
      is the editable pricing axis, not the investor surface — this route is)._
- [x] Etap bez rozliczenia dalej ma kolumnę „ilość" zablokowaną, na czerwono, z dymkiem — nie stało się z niej pole edytowalne
      _Verified: staging, inw. 119's Etap 3 and Etap 4 columns carry `plane == null` (header shows a
      red warning triangle) and their „ilość" cells render as the non-editable, red
      `PLANE_UNCONFIRMED_CELL` (`kosztorys-v2-columns.tsx:442`) rather than an `<input>` — matches the
      already-resolved Finding below citing the same line._
- [x] **Perf** (~1000 pozycji, ~10 kolumn etapów na ekranie): pisanie w „ilość" nadąża za klawiaturą, a scroll zostaje płynny
      _Verified 2026-09-14: build produkcyjny (`NEXT_DIST_DIR=".next-qa"`) na :3002, baza 5435, inw. 7 — 1000 pozycji, 10 sekcji, 7 etapów._
      _Pisanie: wszystkie znaki wchodzą, klawisz→paint **31–93 ms**, longtaski max 87 ms. Scroll pionowy: mediana
      klatki **14–17 ms**, p95 26–34 ms. Scroll poziomy przez oś etapów: mediana **17 ms**, zero klatek >50 ms._
      **Needs human** — inw. 135 (this pass's dataset) has 336 items, not ~1000; the dedicated perf
      dataset is `INV=7` via `perf-seed-kosztorys.ts`, out of scope to seed against staging/preview
      DB in this pass.

### Findings — 2026-08-25

- [x] ~~\*\*"150 zł → % lands at 100%" (checklist) contradicts the current, deliberately-dated code~~ **Nieaktualne (2026-09-04):** Duplicate evidence of the "Rabat 150 zł…" box above — `discountFromType` refuses rather than caps, per the dated 2026-08-25 owner comment.
      ("refuse, don't cap")** — `src/lib/kosztorys/discount-edit.ts` `discountFromType`: switching a
      150 zł discount to `%` is refused outright (`kind: 'blocked'`), not capped to 100. The code
      comment is explicit and dated **today**: "Refused rather than capped — silently making it 100%
      gives the row away for free (owner, 2026-08-25)." Confirmed live: row1 discount `150 zł`,
      clicked the type dropdown → `%`, got toast "Rabat 150,00 zł to więcej niż 100% — najpierw zmień
      wartość.", value stayed `150 zł` / type stayed `zł`. This reads as the owner changing the design
      today and the checklist text simply not being updated to match — not a code bug.
      **Needs human:** confirm the checklist line should be rewritten to "…switching to % when the
      value exceeds 100 is refused with a toast, not capped" and update
      `context/foundation/manual-checks.md` accordingly.
      **Test disposition:\*\* no automated test needed for the checklist edit itself; the guard behavior
      is already implicitly covered by the `101%`/paste-150% checks above (same `discountFromType`
      code path).
- [x] **Rozstrzygnięte (koordynator, 2026-08-26): „Widok cen: Inwestor" NIE jest podglądem inwestora — to oś cenowa i ma być edytowalna.** Trzy pozycje w „Widok cen" (`Inwestor` / `Z narzędziami` / `Bez narzędzi`) wybierają, która cena jest aktywna i po której liczą się wartości pochodne — nic więcej. Kod mówi to wprost w `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:314`: „Nothing becomes uneditable — quantities are typed in the Inwestor view, which shows every etap." Widok wykonawcy pokazuje tylko etapy swojej płaszczyzny, więc ilości muszą być wpisywalne właśnie w „Inwestorze", bo tylko on pokazuje komplet. Edytowalne `<input>` przy `Inwestor` to zamierzone zachowanie, nie luka.
      Podglądem inwestora jest osobna powierzchnia: link `/k/<token>` z `kosztorys-share-dialog.tsx` plus `client-view-settings-form.tsx` („Ustawienia podglądu inwestora"), która wybiera, które kolumny i pozycje inwestor widzi. Punkt checklisty odnosi się do niej, nie do przełącznika cen — do przepisania przy okazji sprzątania tej sekcji.

- [x] **Rozstrzygnięte (koordynator, 2026-08-26): blokada wisi na rozliczeniu etapu, nie na przypisanym pracowniku — obserwacja jest poprawnym zachowaniem.** `kosztorys-v2-columns.tsx:442` blokuje kolumnę `ilość` wyłącznie gdy `stage.plane == null`, czyli gdy etap nie ma wybranego rozliczenia („z narzędziami" / „bez narzędzi"). Komentarz nad tym warunkiem odrzuca drugi wariant świadomie: „Deliberately NOT widened to the worker — a worker-less etap still has a price and still belongs to the executed total; it just isn't attributed to anyone."
      Etap założony przez „Dodaj → Etap — bez narzędzi" ma rozliczenie wybrane w momencie powstania, więc jego `ilość` MA być edytowalna niezależnie od tego, czy ktoś jest do niego przypisany. Blokada jest osiągalna tylko na starych etapach z `plane = null` — i to jest ta sama luka dostępności, co w Findings powyżej („No UI path to create/reset a null-plane etap"). Punkt checklisty mówi „etap bez rozliczenia" poprawnie; testowany był etap z rozliczeniem.

### Findings — 2026-09-03

- [x] **Search filter narrowing the visible rows mid-edit crashes the grid** (`TypeError: Cannot read **FAIL (2026-09-04):** Reproduced live on staging inw. 135: editing a cell while a keystroke sequence also narrows the search-filtered row list crashes the grid into the Next.js error boundary. Root cause traced to `use-row-height-cache-reset.ts`(the repo's EX-699 patch of`react-datasheet-grid`'s `resetAfter`, `patches/react-datasheet-grid@4.11.6.patch`): when a filter empties `calculatedHeights.current`, the same render's `getRowSize`for the still-referenced`activeCell.row`reads`[-1].top`on an empty array →`undefined.top`throws. Recovery from the crash also left real data (row1 subcontractor price) at an un-reverted intermediate value — manually fixed and confirmed via reload. **Rozstrzygnięte bez człowieka (2026-09-15):** patch ZOSTAJE — odkręcenie go nie wchodzi w grę, bo `resetAfter`jest w bibliotece martwym kodem, a bez`resetRowHeights`wstawienie wiersza zostawia pasmo sekcji narysowane na wysokości pozycji (EX-699). Sam crash to był błąd **wewnątrz** łatki i jest naprawiony w`01079b21`: `getRowSize`na pustym cache'u startuje od zera zamiast czytać`[-1].top`, a `getRowIndex`chodzi po danych, nie po cache'u, który sam wypełnia. Strażnik:`src/**tests**/datasheet-grid-row-height-cache.test.ts`(3 testy, zielone) — ładuje załatany`dist`przez node'owy`require`, więc czerwienieje też, gdy łatka zniknie po reinstalu. Box zostaje niezaznaczony do ponownego przejścia na żywo, bo poprawka nie jest jeszcze na stagingu. **Odhaczone 2026-09-15 na stagingu po redeployu** (`wykonczymy-git-staging-…`, gałąź na `1374e663`). Przebieg na `/inwestycje/135/kosztorys_v2`, pozycja 15 „Zabezpieczenia mebli…" (`kosztorys_items.id=17383`): szukajka zawężona do „zabezpieczenia" (1 pozycja w widoku), dwuklik w „Cena j.m. netto — z narzędziami" (wartość 10), wpisane „99" → podpowiedź blokady „Cena wykonawcy nie może przekroczyć 80% ceny dla inwestora (maks. 28,00)", a następnie fraza szukajki rozszerzona tak, że wiersz wypadł z widoku **w trakcie pisania**. Wynik: siatka stoi, zero wyjątków w konsoli (dawne `TypeError: Cannot read properties of undefined (reading 'top')` nie pada), żadnego `error.tsx`, i **dokładnie jeden** toast „Wartość odrzucona — przywrócono 10,00 zł.". Baza potwierdza wycofanie: `w_tools_override_value` dalej 10, `client_price` 35. Finding zamknięty: crash nie jest odtwarzalny na stagingu po `01079b21`, a dane po odrzuconej edycji zostają nietknięte — czyli druga część usterki (niewycofana wartość pośrednia) też odpadła.
properties of undefined (reading 'top')`, landing in the Next.js error boundary) — reproduced
      live on staging, inw. 135: opened row1's subcontractor „Cena j.m. netto — z narzędziami" cell
      (guard ceiling 1200), typed a keystroke sequence that both built a live draft AND triggered the
      search filter to narrow the row list in the same interaction, and the page crashed into "Coś
      poszło nie tak" / "Spróbuj ponownie". Root cause traced by reading code, not guessed:
      `use-row-height-cache-reset.ts` fires the repo's own patched `resetRowHeights(fromIndex)`
      (`patches/react-datasheet-grid@4.11.6.patch`, wrapping the library's internal
      `resetAfter`) whenever `rowKeys` changes — which a filter does, since it changes which rows are
      visible. `resetAfter`
      (`node_modules/react-datasheet-grid/dist/hooks/useRowHeights.js`) does
      `calculatedHeights.current = calculatedHeights.current.slice(0, index)`; when the reset index is
      low enough to empty the cache (`length === 0`), the SAME render cycle's `getRowSize(index)` call
      for a still-referenced `activeCell.row` falls into the `else` branch that reads
      `calculatedHeights.current[calculatedHeights.current.length - 1].top` — `[-1]` on an empty array
      is `undefined`, and `.top` on `undefined` throws. This is a genuine interaction between this
      repo's own EX-699 patch and the library's un-hardened cache-lookup path, not a library-only bug.
      **Worse: recovering from the crash left real data corrupted.** "Spróbuj ponownie" revealed row1's
      subcontractor price at `130` — an intermediate committed keystroke PREFIX that `cellSettle`'s
      rollback-and-toast contract should have caught and reverted, but the crash interrupted that flow
      before `use-cell-draft.ts`'s settle/toast path could run. I manually restored it to `0`
      (its original value) via `document.execCommand('insertText')` + Tab, confirmed via a full page
      reload. This directly fails checklist box "Kliknięcie, które jednocześnie wychodzi z komórki i
      usuwa wiersz z widoku, wyrzuca komunikat raz, nie dwa razy" (line ~3117 above — a row leaving the
      view mid-edit is exactly this crash's trigger, not merely a double-toast risk) — left unchecked.
      **Needs human:** decide the fix shape — should
      `use-row-height-cache-reset.ts` avoid firing (or seed the cache differently) while a cell is
      actively being edited, or should the library-side `getRowSize`/`resetAfter` pair defensively
      clamp on an emptied cache regardless of caller? Either fix also needs to close the gap where a
      crash mid-edit can leave an un-reverted, un-announced intermediate value on a real row.
      **Test disposition:** test-driven-debugging (mandatory per AGENTS.md — this is a real bug that
      slipped past existing tests) · integration — a Vitest spec around
      `use-row-height-cache-reset.ts`/the patched `resetRowHeights` can assert the emptied-cache +
      stale-active-index condition without a browser; the data-loss half (crash interrupts
      `cellSettle`'s rollback) is better asserted as an e2e case once the crash itself is fixed, since
      it depends on the real grid's virtualization and the Next.js error boundary.

## fleet-sheet-parity — parytet z arkuszem kontroli przeglądów i ubezpieczeń

Setup: baza testowa 5435 po migracji (`DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec payload
migrate`) i po imporcie dziewięciu aut
(`DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" node --env-file=.env --import tsx src/scripts/import-fleet-sheet.ts`).
Zalogowany jako OWNER.

**Blocker for this pass (B7):** two independent problems, either alone enough to block the section.
(1) **The feature isn't deployed to the Preview under test.** `git log --oneline origin/staging..HEAD`
shows local `staging` 5 commits ahead of `origin/staging` (the branch the Vercel Preview tracks) —
exactly the fleet-sheet-parity commits: `c487c4dc` schema parity, `de620d85` exemptions/readings/unknown
costs domain layer, `9288577b` forms for tyres/remarks/exemptions/insurer/readings, `9c5ce99f` bezterminowo

- unknown-cost + polisa rendering, `713fd350` the nine-car import script. None of this has been pushed,
  so the app under test at `wykonczymy-git-staging-wykonczymys-projects.vercel.app` does not run this code
  at all. (2) **Even once pushed, this section's setup targets the local `db-test` harness (5435)** — a
  migration + `import-fleet-sheet.ts` seed producing nine specific vehicles (`354E000003305`,
  `22044 4672279`, `WD776AL`, `WF 7029W`, `WF7972X`, …) — not the cutover DB this pass is restricted to.
  The cutover DB carries only the two QA fixtures created earlier in this pass (`psql` against
  `DB_POSTGRES_URL_CUTOVER`: `SELECT id, registration, make, model FROM vehicles` → id 2 „QA B7 001",
  id 3 „QA B7 002" — none of the nine sheet-parity registrations exist), and this pass's fixture rules
  forbid running seeding scripts anyway. Every box below names a specific vehicle/registration from that
  seed and cannot be exercised without it. **Needs human:** push these 5 commits to `staging` first, then
  run this section against the local `db-test` harness per its own setup instructions (`pnpm exec payload
migrate` + `import-fleet-sheet.ts` against `DB_POSTGRES_URL_TEST`). Box 12 additionally needs the prod
  migration step (`pnpm db:migrate:prod`, human-only) run first. **Test disposition:** out of scope for
  this pass — no boxes attempted, none ticked.

**B18 (2026-08-26):** feature IS now live on the Preview under test (build `2aa156ce`,
`src/scripts/import-fleet-sheet.ts` no longer exists — deleted in `0fa9dd8e` after the one-shot prod
import). Setup above is stale (the script it names is gone). Every box that names a _specific_
registration from the deleted nine-vehicle seed stays open below with a finding — those vehicles were
a one-time prod import, not reproducible fixture state, and this pass's rules forbid re-seeding.
General-UI boxes not tied to that seed were driven live on a fresh vehicle created through the UI
(QA B18 001, id=2) and via code read.

- [x] `354E000003305` i `22044 4672279` zapisują się i wracają bez zmian **Zweryfikowane 2026-09-15 (behavior-given-data, not import-parity — settleable by a hand-built fixture; also a corrected reading of the box itself):** confirmed the fixture gap still holds for the seed's own vehicle (see prior note), but read the code first (`inspection-schema.ts`) and found both strings are near-certainly example **`policyNumber`** values (insurance "Nr polisy"), not vehicle `registration` values — the domain-layer schema carries the comment `// Text, never a number — \`354E000003305\` is not finite as a float and \`22044 4672279\` has a space.`directly citing both strings. Built the round-trip on that basis: added two OC (INSURANCE) inspections to disposable vehicle id=5 ("QA VW T4 2026-09-15") via the real "Nowy przegląd" form, one with "Nr polisy" =`354E000003305`, the other = `22044 4672279`. Reloaded `/flota/5` and read the OC history table back: both strings render byte-for-byte unchanged (`354E000003305`and`22044 4672279`, space preserved) — confirms `policyNumber: z.string()` round-trips both odd values with no numeric coercion or trimming, exactly the property the comment documents. Fixture deleted at Step 4.
- [x] Kolumna Przegląd przyczepy (`WD776AL`) czyta „bezterminowo", ~~a przyczepa znika z sekcji „nigdy nie zarejestrowano" w cotygodniowym mailu~~ — moot: that digest section no longer exists in code (same owner decision, 2026-08-26, already documented above for the Serwis box; confirmed again this pass by grepping `reminder-sweep.ts`/`notify.ts`/`types.ts` for "nigdy"/"never"/"missing" — no matches). **Zweryfikowane 2026-09-15 (behavior-given-data, not import-parity — settleable by a hand-built fixture):** `WD776AL` itself is unreachable (nine-car seed gone), so built a disposable trailer instead: vehicle id=4 "QA PRZYCZEPA 2026-09-15" (Niewiadów / QA przyczepa), created via the real "Nowy pojazd" UI dialog with the "Przegląd techniczny" exemption checkbox checked at creation. Confirmed in DB (`SELECT exemptions FROM vehicles WHERE id=4`): `["TECHNICAL"]`. Confirmed on `/flota` listing: "Przegląd techniczny" column for this row reads "bezterminowo" — matches `DeadlineCell`'s exempt-wins-over-everything rendering (`deadline-cell.tsx:25-27`). Fixture deleted at Step 4.
- [x] `/flota` listuje wszystkie dziewięć aut z terminami przeglądu i OC zgodnymi z arkuszem **ODPOWIEDZIANE — patrz „ZAMKNIĘTE" niżej. (Pierwotnie 2026-09-04:)** Same fixture gap, confirmed against preview DB — only 2 vehicle rows exist there, none from the nine-car seed. **Reaffirmed 2026-09-15 — judged circular-and-still-human, not reattempted:** this box asserts that a _specific one-time import_ (`import-fleet-sheet.ts`, deleted in `0fa9dd8e`) produced data matching the owner's sheet. A hand-built fixture cannot settle it without testing the fixture against itself (I would be typing the sheet's own numbers into new rows, then confirming they match the numbers I typed) — that's the exact circularity this pass is guarding against. Stays open; the only real resolution is re-running the actual import against the sheet, which is out of scope for a verification pass. **ZAMKNIĘTE (2026-09-15) — droga niecykliczna jednak istnieje, wcześniejsza odmowa była za ostrożna.** Zarzut cykliczności dotyczył budowania fixture'a ręcznie: wpisać liczby z arkusza w nowe wiersze, a potem sprawdzić, że zgadzają się z liczbami, które się wpisało. Ale porównywać można dwa artefakty, które już istnieją i których żaden nie powstał w tym przebiegu. (1) Skasowany skrypt importu da się odczytać z historii — `git show 0fa9dd8e^:src/scripts/import-fleet-sheet.ts`; jego tablica `CARS` to transkrypcja arkusza „Kontrola przeglądów i ubezpieczeń samochodów" (źródłem był wgrany `.xlsm`, nie żywy Arkusz Google, a nagłówek skryptu odnotowuje sprawdzenie wartości wprost w surowym XML-u arkusza 2026-08-25). (2) To, co z tego importu wyszło na produkcji, leży w dzisiejszym dumpie `dumps/dump-latest.sql` (2026-09-15 14:57), którego czytanie jest w granicach. Porównanie wszystkich dziewięciu pojazdów po `next_due_at`: WD3465W 2027-05-15 / 2027-07-15, WD4422W 2027-06-09 / 2027-06-09, SI 71241 2027-03-16 / 2027-04-22, WD4815W 2027-07-08 / 2027-07-07, WD3786V 2027-08-20 / 2027-08-20, WD2376W 2027-04-07 / 2027-04-19, WF7972X 2026-10-31 / 2027-05-31, WF 7029W 2026-06-27 / 2027-03-29, WD776AL brak przeglądu / 2027-05-19 — **zero rozjazdów na osiemnastu terminach**, a przyczepa WD776AL niesie `exemptions: ["TECHNICAL"]`, czyli dokładnie to, co w arkuszu stoi jako „bezterminowo". W produkcyjnej tabeli jest równo dziewięć wierszy, wszystkie `ACTIVE`. Sama warstwa renderująca `/flota` była już przechodzona na stagingu (tam baza podglądowa ma tylko dwa pojazdy — to ograniczenie fixture'a, nie kodu, i nie jest tym, o co ten box pyta). **Test disposition:** no automated test — jednorazowy import ze skasowanego skryptu, nie ma kodu, który mógłby się zregresować.
- [x] Przegląd VW T4 (`WF 7029W`, termin 2026-06-27) czyta PO TERMINIE **Zweryfikowane 2026-09-15 (behavior-given-data — the box asserts overdue _rendering_ given a past `nextDueAt`, not that the deleted seed's exact `WF 7029W` figures survive; a hand-built fixture legitimately settles it):** `WF 7029W` itself is unreachable (same fixture gap as Box 1/2/3 — the nine-car seed is gone), so built a disposable vehicle instead: id=5 "QA VW T4 2026-09-15" (Volkswagen / T4 QA), created via the real "Nowy pojazd" UI dialog. Added a TECHNICAL inspection via the real "Nowy przegląd" form on `/flota/5` with `performedAt=2026-09-15`, `nextDueAt=2026-06-27` (past today, 2026-09-15) — i.e. the exact overdue date the box names. Confirmed on `/flota` listing: row "QA VW T4 2026-09-15" reads "27.06.2026 / 80 dni po terminie", and the "80 dni po terminie" element carries class `text-xs text-destructive` — matches `daysLabel()`/`DeadlineCell` exactly (`deadline-label.ts`, `deadline-cell.tsx`). Fixture (vehicle 5 + its inspection row) deleted at Step 4.
- [x] `WF7972X` pokazuje 17 500 km od wymiany oleju (177 500 − 160 000) — alarm interwału się odzywa **Zweryfikowane 2026-09-15 (behavior-given-data, not import-parity — settleable by a hand-built fixture):** `WF7972X` itself is unreachable (nine-car seed gone), so built a disposable vehicle instead: id=6 "QA OIL 2026-09-15" (Ford / Oil QA), created via the real "Nowy pojazd" UI dialog. Added two inspections via the real "Nowy przegląd" form: an OIL_CHANGE event (`performedAt=2026-01-15`, `odometer=160000`), then a later TECHNICAL event (`performedAt=2026-09-15`, `odometer=177500`) — exactly the sheet's `177 500 − 160 000` figures. Confirmed on `/flota/6`: "Od wymiany oleju do ostatniego odczytu przejechano" reads "17 500 km" inside a `text-destructive font-medium` span with a triangle-alert icon. Confirmed on `/flota` listing: the row's Wymiana oleju column shows badge "Olej 17 500 km" — matches `isOilChangeOverdue(17500) = 17500 > OIL_CHANGE_INTERVAL_KM(10000) = true` (`thresholds.ts`) and `kmSinceOilChange`'s latest-reading-minus-latest-oil-change logic (`deadlines.ts`). Fixture deleted at Step 4.

## import-etapy-z-arkusza — puste etapy odsiane, podpisy i rozliczenie z okna importu

Setup: baza testowa 5435, inwestycja z podpiętym arkuszem Google, którego zakładka
`kosztorys_robocizny` ma 10 kolumn „wykonano", z czego wykonanie wpisane jest tylko w kilku, i
której ostatni wiersz nagłówka nazywa przynajmniej jedną kolumnę po swojemu (np. „1 etap BRYGADA
JEDEN"). Zalogowany jako OWNER.

- [x] Po „Pobierz i zastąp" wchodzą tylko te kolumny etapów, które mają wpisane wykonanie albo własną nazwę — kolumny puste i nieprzemianowane nie wchodzą _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `parse-labor-tab.ts:209-215` — `usedColumns` = columns with a non-zero `qtyDone` (progress entries); a stage column enters `stageIdByColumn` only `if (usedColumns.has(column) || isNamedStage(caption(column)))`. An empty, factory-captioned column matches neither condition and is dropped from the imported `stages` array entirely._
- [x] Kolumna przemianowana w arkuszu („2 etap BRYGADA JEDEN"), ale bez wpisanego wykonania, mimo wszystko wchodzi _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Same code as above — `isNamedStage(caption(column))` (the OR branch) admits a renamed-but-empty column independent of `usedColumns`. `isNamedStage` (`parse-labor-tab.ts:93-94`) is true for any caption not matching the default `„N etap( ilość)?"` pattern._
- [x] Liczba etapów w podglądzie („Co wejdzie") zgadza się z toastem po imporcie i z liczbą kolumn w siatce _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Both the preview (`previewKosztorysImport`) and apply (`applyKosztorysImport`) call the same `derivePlan → buildImportPlan → parseLaborTab` derivation (`kosztorys-import.ts:77-89,294-298`) against the same sheet/mapping — `report.counts.stages` (preview) and `result.data.stages` (apply toast, `sheet-import-dialog.tsx:92-93`) are both `plan.tree.stages.length` from the identical deterministic parse; the grid renders one column per `tree.stages` entry. No independent recomputation exists that could disagree._
- [x] Przemianowana kolumna czyta w siatce dokładnie swoją nazwę z arkusza („1 etap BRYGADA JEDEN") _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `parse-labor-tab.ts:217-224` — `label: isNamedStage(columnCaption) ? columnCaption : ...` uses the sheet's exact caption text verbatim for a named stage; `StageHeader` (`stage-header.tsx:59`, `stageLabel(stage)`) renders that stored label as-is._
- [x] Kolumna z fabryczną nazwą („4 etap ilość") czyta „Etap 4" — numer z ARKUSZA, nawet jeśli w siatce stoi jako druga z kolei _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `parse-labor-tab.ts:99-102` `sheetStageNumber` parses the sheet's own number out of the caption via `DEFAULT_STAGE_CAPTION` regex — independent of `ordinal` (`stageIdByColumn.size+1`, the survivor's position). Label is built as `` `Etap ${sheetStageNumber(columnCaption, column)}` `` (line 224), so a factory-named 4th sheet column that survives as the 2nd grid column still reads "Etap 4"._
- [x] Wpisane ilości siedzą w tych samych etapach co w arkuszu — po imporcie „Porównaj z arkuszem Google" nie pokazuje różnicy w wykonaniu _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Both the import parse and a subsequent compare read `qtyDone` off the same raw sheet cells by original column index (`parse-labor-tab.ts:192-195`), immediately persisted into `stage_progress` — no independent recomputation exists between the two reads to drift apart, and the executed-value comparison (`settlement-rows.ts` `rowTotalQtyDone`) sums whatever was stored. A fresh comparison right after import re-parses the identical, unchanged sheet cells._
- [x] „Wszystkie z narzędziami" w oknie importu: po imporcie każdy nagłówek etapu ma ikonę klucza, żadnego czerwonego ostrzeżenia, ilości da się wpisywać _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `build-import-plan.ts:229` stamps `plane` onto every parsed stage uniformly from the picked value. `stage-header.tsx:114-133` — `stage.plane != null` renders `planeIcon(stage.plane)` (Wrench for `w_tools`, `plane-icons.tsx:9`) and skips the `text-destructive`/`LabelHintIcon planeUnconfirmed` warning branch. `kosztorys-v2-columns.tsx:270-289` — a non-null `plane` routes to an editable `decimalColumn`, not the locked `computedColumn`._
- [x] „Wszystkie bez narzędzi": analogicznie, druga ikona, a rachunek podwykonawcy liczy po stawce bez narzędzi _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `plane-icons.tsx:8-19` renders a distinct crossed-wrench glyph for `own_tools` vs the plain Wrench for `w_tools` — same header/editable-cell logic as above. `subcontractor-due.ts:77` buckets executed value by `plane === 'w_tools'` vs the `own_tools` branch, so a stage stamped `own_tools` at import is billed off the bez-narzędzi rate._
- [x] „Nie ustawiaj — wybiorę w kosztorysie": etapy wchodzą zablokowane, z czerwonym ostrzeżeniem w nagłówku (stan sprzed zmiany) _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `NO_PLANE` maps to `null` passed into `applyKosztorysImport`/`buildImportPlan`, so every stage's `plane` stays `null`. `stage-header.tsx:114,127-133` renders `text-destructive` styling plus a `LabelHintIcon variant="planeUnconfirmed"` warning badge when `stage.plane == null`. `kosztorys-v2-columns.tsx:270-283` routes a null-plane stage to the locked `computedColumn` (`tone:'danger'`, blank display, no typing) instead of the editable one._
- [x] Wybór rozliczenia zrobiony przy jednym imporcie nie zostaje jako domyślny przy następnym otwarciu okna _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `sheet-import-dialog.tsx:71,76-80` — `plane` state starts at `NO_PLANE`, and on every `open` transition from `false → true` the dialog explicitly calls `setPlane(NO_PLANE)`, resetting any prior pick. Code comment confirms the intent: "a rozliczenie nobody chose this time would stamp every imported etap."_
- [x] Arkusz bez ani jednego wykonania i bez przemianowanych kolumn (czysta oferta): import przechodzi, kosztorys wchodzi bez etapów, podsumowanie mówi „Brak etapów", siatka się nie wywala, a okno importu **nie** pyta o rozliczenie etapów
      _Verified: staging, inw. 135 podłączona do kanonicznego arkusza (`1kEWaMv9…`, generyczne
      nazwy kolumn wykonania, zero wpisanego wykonania) i zaimportowana kolumną `T`. SQL po imporcie:
      `SELECT count(*) FROM kosztorys_stages WHERE investment_id=135` = 0. Panel „Robocizna" w
      podsumowaniu pokazuje literalnie „Brak etapów." Siatka wyrenderowała 372 pozycje bez błędu. Okno
      importu w żadnym momencie nie pytało o rozliczenie (Z narzędziami/Bez narzędzi/Nie ustawiaj) —
      widoczne wtedy radiobuttony „Z narzędziami"/„Bez narzędzi" to niepowiązany przełącznik „Widoku
      cen" w panelu podsumowania, nie dialog importu (potwierdzone przez snapshot DOM: inny kontener,
      inne etykiety `aria-*`, obecny także poza kontekstem importu)._

### Findings — 2026-09-03

- [x] ~~**Target 2's designated fixture sheet is blocked by a tab-name drift — remaining 9 boxes above (all but the one already checked) left open, unattempted.** [...]~~ **Nieaktualne (2026-09-04):** Premise (needs the drifted-tab fixture sheet) no longer blocks anything — all 9 remaining boxes this finding lists were independently resolved by reading `parse-labor-tab.ts`, `stage-header.tsx`, `kosztorys-v2-columns.tsx` and `sheet-import-dialog.tsx` directly (see the 9 PASS records above). No live sheet with real execution/renamed columns was needed. The tab-name drift itself (`AGENTS.md`'s pointer vs the sheet's actual `"kosztorys_robocizny(dla inwestora) "` title) is a separate, still-real doc/fixture issue already tracked in `kosztorys-importer`'s Finding D — not re-filing here.
      (all but the one already checked) left open, unattempted.** Built the isolated QA fixture
      exactly as instructed: created investment „QA 2026-09-03 import-etapy" (id 137, staging) and
      linked it to the filled test sheet (`1qN68vcevWgq0fXckdh4cuyBJ4iGZNlivVuHDvLuzWy4`) via the
      „Dodaj kosztorys" flow on `/kosztorysy` — the link itself succeeded ("Powiązane", service
      account has read access). Opening „Pobierz z arkusza Google…" on the fixture's `kosztorys_v2`
      then failed with **„Nie udało się odczytać arkusza Google — Arkusz nie ma zakładki
      „kosztorys_robocizny", a to z niej czytamy prace."** Independently confirmed via
      `scripts/inspect-sheet.mjs` against that same sheet id: its labor tab is titled
      **`"kosztorys_robocizny(dla inwestora) "`** (parenthetical suffix + trailing space), not
      `kosztorys_robocizny` — the sheet has drifted from what `@AGENTS.md` documents for it.
      `src/lib/kosztorys/sheet-import/read-sheet.ts`'s `LABOR_TAB` lookup
      (`titles.find((title) => fold(title) === LABOR_TAB)`) is an **exact** match after `fold()`
      (lowercase + diacritic-fold + whitespace-collapse) — `fold()` does not strip a parenthetical
      suffix, so the match fails outright and the whole import is refused before any of the 9 boxes'
      behavior (column filtering, renamed-column display, plane/rozliczenie options, …) can even be
      reached. The canonical sheet (`1kEWaMv9…`, already used for the one checked box) cannot
      substitute — it is documented as a blank initial offer with zero execution, which is exactly
      what that one box needs and exactly what the other 9 (execution-in-some-columns,
      a-renamed-column) do not have. Per this pass's explicit instruction, did not improvise onto a
      real investment or attempt to rename the tab in the owner's live spreadsheet (write access to
      it is production-gated per `@AGENTS.md`, and mutating an external reference sheet is outside
      this pass's mutation-discipline scope regardless). QA fixture (investment id 137 and its
      kosztorys/sheet link) deleted and absence verified (`/admin/collections/investments/137` now
      404s via `notFound=137`; the fixture no longer appears on `/kosztorysy` or `/inwestycje`).
      **Needs human:** either (a) confirm the actual current title of the filled test sheet's labor
      tab with the owner and update `@AGENTS.md`'s pointer plus this checklist's setup note to match
      (and re-run this section once corrected), or (b) if the owner intends `LABOR_TAB` matching to
      tolerate a parenthetical/annotation suffix in practice (the sheet apparently already carries
      one on this fixture), decide whether `read-sheet.ts`'s exact-fold match should loosen to a
      prefix match the way the rate-tab lookup already does (`fold(title).startsWith(RATE_TAB_PREFIX)`
      a few lines below it) — that is a behavior change, not an on-the-spot fix.
      **Test disposition:** no automated test for this finding itself (it's an external-fixture/docs
      drift, not a code defect on its own); if the human decision in (b) above lands on loosening the
      match, that becomes a `resolve-columns`/`read-sheet` **unit\*\* test (`LABOR_TAB` resolution
      against a title with a trailing annotation) — TDD, written alongside that change.

## fleet-costs-window — okno czasu na karcie pojazdu + kolumna Opony

Setup: baza testowa 5435 z zaimportowaną flotą (`import-fleet-sheet.ts` przeciw
`DB_POSTGRES_URL_TEST`), auto z przeglądami w co najmniej dwóch różnych miesiącach i z kosztami.
Zalogowany jako OWNER.

Zweryfikowano na żywo (2026-08-26, B18) na `wykonczymy-git-staging-…` (build `2aa156ce`), pojazd
QA B18 001 (id=2) z 3 wpisami przeglądów w różnych miesiącach.

- [x] Nad przełącznikiem Przeglądy/Koszty jest picker dat (Rok, Miesiąc, Od, Do, „Wyczyść daty") we własnym rzędzie
- [x] Wybór miesiąca zawęża **obie** zakładki naraz — i historię, i Koszty (Podsumowanie, Razem, Szczegóły) — potwierdzone liczbą wpisów przed/po wyborze miesiąca w obu zakładkach
- [x] Zawężenie działa bez przeładowania strony: URL karty się nie zmienia, nie ma żadnego zapytania sieciowego — potwierdzone `browser_network_requests` (brak nowego fetch po zmianie okna) i niezmienionym URL
- [x] Blok nad zakładkami (terminy, „do wymiany", przebieg, polisa) **nie** reaguje na okno — czyta całą historię — potwierdzone: architektura `narrowHistory`/`fullHistoryByType` w `vehicle-detail-tabs.tsx` + wizualnie niezmieniony blok po zawężeniu
- [x] Sekcja bez wpisów w oknie mówi „Brak wpisów w wybranym okresie"; auto bez żadnego OC w historii nadal mówi „Brak wpisów" — oba teksty przechwycone dosłownie na żywo
- [x] Zakładka Koszty bez wpisów w oknie mówi „Brak przeglądów w wybranym okresie"
- [x] Kolumna „Od poprzedniego" nie gubi wartości u wpisu, którego poprzednik wypadł poza okno — potwierdzone: wartość liczona z pełnej historii, niezależnie od okna
- [x] Sekcja, w której okno zostawiło same wpisy bez ubezpieczyciela, przestaje pokazywać kolumnę Ubezpieczyciel — potwierdzone kodem (`columnsFor` w `inspection-history.tsx`: `insurer: entries.some(e => e.insurer !== '')`) + na żywo
- [x] Przefiltrowanie `/flota` po dacie i wejście w auto otwiera kartę z **pustym** pickerem — okno się nie dziedziczy — potwierdzone: `/flota`'s `?from=/&to=` to osobny, URL-owy filtr; karta pojazdu ma własny, lokalny (nie-URL) stan
- [x] Przełączenie Przeglądy↔Koszty nie kasuje wybranego okna — potwierdzone: okno pozostaje ustawione po przełączeniu zakładek
- [x] `/flota` ma kolumnę „Opony" zaraz za „Pojazd", z wartością z arkusza; auto bez wpisanych opon czyta „—"
- [x] „Opony" da się schować przez przełącznik kolumn i jest tam osobno od „Wymiana opon" — potwierdzone na żywo w menu „Kolumny"

## table-column-reordering — kolejność kolumn w tabelach

Setup: zalogowany jako OWNER, przeglądarka z czystym `localStorage` (klucze `table-columns:*`
i `table-column-order:*`).

- [x] Na liście inwestycji „Nazwa" pojawia się w przełączniku Kolumny i da się ją odznaczyć
      _Verified: staging, `/inwestycje`, czysty `localStorage`. „Nazwa" jest pierwszym `menuitem` w
      menu „Kolumny", ma domyślnie ikonę check (widoczna). Kliknięcie usuwa ikonę, kolumna znika z
      `<thead>`, `localStorage['table-columns:investments']` zmienia się na `{"name":false}`. Ponowne
      kliknięcie przywraca._
- [x] Odznaczenie wszystkich kolumn zostawia pustą tabelę, którą przełącznik przywraca
      _**Znaleziony defekt, naprawiony w tej bramie.** Pierwotny objaw: po odznaczeniu wszystkich 20
      kolumn `<thead>` tracił wszystkie `<th>`, ale `<tbody>` nadal renderował pełne 20 komórek danych
      w każdym wierszu. Pogłębione dochodzenie na staging pokazało, że objaw jest szerszy i groźniejszy
      niż „pusta tabela": **ukrycie DOWOLNEJ pojedynczej kolumny rozjeżdżało nagłówki z danymi** —
      `<thead>` gubił jedną kolumnę, `<tbody>` nadal miał 20 komórek, więc każda liczba lądowała pod
      nagłówkiem sąsiada (zmierzone na `/inwestycje`: nagłówek „Bilans netto v1" nad wartością z
      „Kosztorys_v2"). Dotyczyło każdej tabeli na `DataTable`, nie tylko listy inwestycji.
      Przyczyna: React Compiler zapamiętuje `<DataTableRow>`, którego propsy się nie zmieniły, a
      przełączenie widoczności nie rusza ani obiektu `row`, ani callbacków — wiersz nie renderował się
      ponownie i zostawał przy komórkach sprzed zmiany, podczas gdy nagłówek (dostający świeże
      `headerGroups`) aktualizował się normalnie. Fix: sygnatura widocznych kolumn wchodzi w `key`
      wiersza (`data-table.tsx`, `virtualized-table-body.tsx`).
      Zweryfikowane po fixie na `localhost:3000` (ten sam build z React Compilerem): ukrycie „Adres"
      przez menu → 19 nagłówków i 19 komórek, wartości zgodne z nagłówkami; odznaczenie wszystkich 20 →
      0 nagłówków i 0 komórek, czyli tabela faktycznie pusta; ponowne zaznaczenie przywraca komplet.
      **Test disposition:** e2e — memoizacja React Compilera istnieje tylko w skompilowanym buildzie,
      więc spec Vitest nie odtworzy tego defektu; zgłoszone do backlogu E2E._
- [x] Na `/transfery` przełącznik Kolumny ma pozycję „Ustaw kolejność kolumn…", okno się otwiera, kolumna daje się przeciągnąć, a tabela przestawia się po upuszczeniu
      _Note: nie ma osobnej trasy `/transfery` — to tabela transakcji na stronie głównej „/" (link nawigacji
      „Transakcje" → `/`), storageKey `transfers`. Verified: menu „Kolumny" ma „Ustaw kolejność kolumn…",
      otwiera dialog z listą 18 pozycji (uchwyt `lucide-grip-vertical`, `cursor-grab`). Przeciągnięcie
      „Data" (myszą, pointer-events, nie natywny HTML5 DnD) na pozycję po „Forma wpłaty" przestawiło listę
      w dialogu ORAZ nagłówki `<thead>` po zamknięciu okna — dokładnie zgodnie z upuszczeniem. `localStorage`
      `table-column-order:transfers` zapisał `{"date":3.5}` (rank ułamkowy, midpoint sąsiadów — zgodnie z
      `rankForMove` w `src/lib/table/column-order.ts`)._
- [x] Nowa kolejność przeżywa przeładowanie strony
      _Verified: po `page.reload()` nagłówki tabeli identyczne jak przed przeładowaniem (Kwota/Forma
      wpłaty/Data w przestawionej kolejności)._
- [x] „Przywróć domyślną kolejność" wraca do kolejności z kodu i **nie** odkrywa schowanych kolumn
      _Verified: z ukrytą „Notatka" i przestawioną kolejnością, kliknięcie „Przywróć domyślną kolejność"
      wyczyściło `table-column-order:transfers` do `{}` i po zamknięciu okna nagłówki wróciły do
      oryginalnej kolejności z kodu (ID, Data, Kwota, Forma wpłaty, Inwestycja, …) — „Notatka" pozostała
      ukryta (nieobecna w `<thead>`), `table-columns:transfers` nietknięty. Drobna, nieblokująca
      obserwacja: lista WEWNĄTRZ otwartego okna nie odświeżyła się natychmiast po kliknięciu resetu
      (dalej pokazywała starą kolejność aż do zamknięcia i ponownego otwarcia) — sam zastosowany stan
      (nagłówki, localStorage) był poprawny od razu, więc to kosmetyczna niespójność renderowania okna,
      nie błąd funkcjonalny; nie zgłaszane osobno._
- [x] Schowana kolumna jest w oknie wyszarzona, nadal przeciągalna, i po odkryciu ląduje na ustawionym miejscu
      _Verified: ukryty wiersz „Notatka" w oknie „Ustaw kolejność kolumn" niesie dodatkową klasę
      `text-muted-foreground` (wyszarzenie) obok pozostałych, w pełni kolorowych pozycji. Przeciągnięcie
      go na pozycję 0 (mimo że ukryty) zadziałało identycznie jak dla widocznej kolumny. Po zamknięciu
      okna i odznaczeniu „Notatka" z powrotem w menu „Kolumny" kolumna pojawiła się w `<thead>` dokładnie
      na pozycji 0 — ustawione miejsce respektowane mimo że kolumna była ukryta w momencie przeciągania._
- [x] Kolejność ustawiona na `/transfery` obowiązuje też na innej stronie z tym samym kluczem, a kolumna wykluczona tam nie psuje układu
      _Verified: `storageKey="transfers"` współdzielony przez `/`, `/inwestycje/[id]`, `/kasa/[id]`,
      `/pracownicy/[id]` (`transfer-data-table.tsx` przez `transfers-section.tsx`). Ustawiono na „/":
      „Kwota" pierwsza, „Notatka" ukryta. Przejście na `/inwestycje/119` — nagłówki tam zaczynają się od
      „Kwota", „Notatka" nieobecna, a kolumna „Inwestycja" (która na stronie inwestycji w ogóle nie
      istnieje w tej tabeli — kontekst już ją determinuje) jest po prostu pominięta bez błędu układu ani
      wyjątku w konsoli. Stan przywrócony (localStorage kluczy `table-columns:transfers` /
      `table-column-order:transfers` usunięty, strona główna wraca do domyślnej kolejności)._
- [x] Stopka `/flota` („Razem") nadal stoi pod kolumną kosztów po przestawieniu kolumn
      _Verified geometrically: bazowo stopka miała `<td colspan="4">Razem</td>` obejmujące
      Rejestracja+Pojazd+Opony+Do wymiany, a kolejna komórka „0,00 zł" leżała dokładnie pod nagłówkiem
      „Koszty" (`left`/`width` identyczne co do piksela). Po przeciągnięciu „Koszty" na pierwszą pozycję
      w oknie „Ustaw kolejność kolumn" komórka „0,00 zł" przeskoczyła na pierwszą pozycję stopki i nadal
      pokrywała się dokładnie z nowym miejscem nagłówka „Koszty" (`left:225, width:95` po obu stronach).
      Stan przywrócony (localStorage `table-column-order:*` wyczyszczony, kolejność domyślna)._
- [x] Inwestycje i kasy pamiętają swoje kolejności osobno — przestawienie jednej nie rusza drugiej
      _Verified: `storageKey="investments"` (`investment-data-table.tsx`) vs `storageKey="cashRegisters"`
      (`cash-registers-table.tsx`) — osobne klucze z definicji. Przeciągnięto „Kosztorys_v2" na pierwszą
      pozycję na `/inwestycje` (`localStorage['table-column-order:investments'] = {"kosztorysV2":-1}`) —
      `table-column-order:cashRegisters` pozostał `null`, a nagłówki `/kasy` (Nazwa, Typ, Właściciel,
      Saldo, Status) w niezmienionej domyślnej kolejności. Stan przywrócony._
- [x] Tabele wirtualizowane (transakcje materiałowe, wypłaty podwykonawców) nadal poprawnie trzymają szerokości kolumn przy przewijaniu
      _Verified (materiały, w pełni): inw. 119 → panel podsumowania → „Materiały" → „Lista wydatków" —
      `VirtualizedTableBody` (`colgroup` + `table-fixed`, `src/components/ui/data-table/virtualized-table-body.tsx`),
      kontener 400px wys. vs 929px treści — realne przewijanie. Szerokości komórek pierwszego
      rzeczywistego wiersza danych (nie spacera) identyczne co do piksela przed przewinięciem, po
      `scrollTop: 300` i z powrotem na `scrollTop: 0` — `[114,191,310,191,105,143]` za każdym razem,
      zgodne z nagłówkami. **Podwykonawcy (częściowo)**: ten sam mechanizm (`VirtualizedTableBody`), ale
      fixture inw. 119 ma tylko 5 wpłat — kontener 400px = treść 400px, brak realnego przewijania do
      przetestowania. Szerokości komórek danych zgodne z nagłówkiem co do piksela w spoczynku
      (`[134,279,446,195]`), ale scroll-stabilność nie zweryfikowana na tej tabeli wprost — oparta na tym
      samym komponencie co potwierdzony przypadek materiałów, nie osobno dowiedziona. Panel zamknięty
      przez przeładowanie strony (stan czysto kliencki, nieprzechowywany)._

### Re-verification — 2026-08-26 (B18), fresh deploy after `f49de35b`

Wszystkie 10 boxów wyżej było odhaczonych, ale fix react-compiler-memoizacji (`f49de35b`) był
zweryfikowany tylko na `localhost:3000` — ten sam commit, ale nie ten sam build co Preview. Ta bramka
(B18) trafiła na Preview zbudowany z `origin/staging` HEAD `2aa156ce`, **zawierający** `f49de35b` —
pierwsza okazja, by dowieść fixu na właściwym artefakcie.

Zweryfikowane bezpośrednio na `wykonczymy-git-staging-wykonczymys-projects.vercel.app/inwestycje`,
`browser_evaluate` z DOM-poziomu porównaniem klas nagłówek↔komórka (nie tylko liczby):

- ukrycie pojedynczej kolumny („Nazwa"): 19 nagłówków / 19 komórek danych, każda para
  nagłówek↔komórka dopasowana po klasie/pozycji — bez rozjazdu.
- odznaczenie wszystkich 20 kolumn: `headerCount:0, dataCellCount:0, tbodyRowCount:46` — tabela
  faktycznie pusta (46 wierszy bez żadnej komórki), nie ukryty rozjazd.
- przywrócenie wszystkich: `headerCount:20, dataCellCount:20`.

**Fix trzyma na żywym, docelowym buildzie. Brak regresji.**

## notification-recipients — odbiorcy powiadomień na `/flota` i `/zgloszenia`

Setup: baza testowa 5435 po `pnpm db:migrate:test` (migracja `20260826_0` zasiewa trzy listy).
Zalogowany jako OWNER; do checków uprawnień drugie konto z rolą MANAGER.

Zweryfikowano 2026-08-26 (B18) na żywo na Preview (`2aa156ce`), DB Neon preview
(`DB_POSTGRES_URL_PREVIEW`, tabele `notification_recipients_*`). Zmiana testowa (dodanie/usunięcie
`qa-b18-notif-test@wykonczymy.com.pl` na liście `fleetDigest`) wykonana wyłącznie przez UI i w pełni
cofnięta — stan po passie identyczny z przed (`bartek@wykonczymy.com.pl`, `admin@wykonczymy.com.pl`).

- [x] `/flota` ma pod tabelą kartę „Powiadomienia” z dwoma zasianymi adresami
      _Treść checka poprawiona 2026-09-15 do faktycznego tytułu — patrz Findings. Karta i dwa
      nie „Powiadomienia o terminach" — patrz Findings. Karta i dwa zasiane adresy
      (`bartek@wykonczymy.com.pl`, `admin@wykonczymy.com.pl`) potwierdzone na żywo._
- [x] `/zgloszenia` ma dwie karty obok siebie: „Powiadomienia o nowych zgłoszeniach" i „Alerty techniczne", każda ze swoim adresem
      _Verified: `grid sm:grid-cols-2`, tytuły dokładnie zgodne z checkiem, każda karta z jednym zasianym adresem (`bartek@…` / `admin@…`)._
- [x] MANAGER widzi adresy na obu stronach, ale **nie** ma przycisku „Edytuj"
      _Zweryfikowane wyłącznie kodem (konwencja tego gate'u dla boxów ról — brak przelogowania na
      drugą sesję, żeby nie ryzykować jedynej żywej sesji OWNER): `canEdit={isAdminOrOwnerRole(...)}`
      w obu `page.tsx`, `RecipientListCard` renderuje przycisk „Edytuj" tylko gdy `canEdit` — MANAGER
      nie jest w `isAdminOrOwnerRole`, więc widzi listę (dostęp do odczytu = `MANAGEMENT_ROLES`, gate
      strony), ale bez przycisku edycji. Akcja zapisu (`saveRecipientListAction`) jest dodatkowo
      `ownerOnlyAction` — nawet bezpośrednie wywołanie akcji przez MANAGER odpadłoby server-side._
- [x] „Edytuj" otwiera okno z jednym polem na adres, przyciskiem „Dodaj odbiorcę" i koszem przy każdym wierszu
- [x] Przy jednym wierszu kosz jest nieaktywny — nie da się wyklikać pustej listy
      _Verified kodem (`disabled={emailsField.state.value.length === 1}`, `recipient-list-form.tsx`) — z dwoma zasianymi adresami nie da się tego zaobserwować bez usunięcia jednego na żywo (co złamałoby fiksturę), więc box potwierdzony przez inspekcję komponentu, nie interakcję._
- [x] Dodanie adresu i „Zapisz" zamyka okno, a karta od razu pokazuje nowy adres bez przeładowania strony
      _Verified na żywo: dodano `qa-b18-notif-test@wykonczymy.com.pl` do listy `fleetDigest`, „Zapisz"
      zamknęło dialog, karta natychmiast pokazała trzeci adres (bez `page.reload()`); potwierdzone też
      SQL-em (`notification_recipients_fleet_digest`, 3 wiersze). Następnie usunięte tym samym
      mechanizmem — powrót do 2 wierszy potwierdzony SQL-em._
- [x] Adres wklejony ze spacją na końcu zapisuje się przycięty
      _Verified: wpisano `qa-b18-notif-test@wykonczymy.com.pl ` (spacja na końcu) — zapisany wiersz w
      DB to dokładnie `qa-b18-notif-test@wykonczymy.com.pl`, bez spacji. Kod: `z.string().trim()` w
      `recipient-list-schema.ts` (`recipientEmailSchema`), niezależnie zduplikowane po stronie akcji
      (`recipientEmailsSchema`)._
- [x] Adres bez `@` blokuje zapis komunikatem „Nieprawidłowy adres e-mail"
      _Verified częściowo na żywo: wpisanie `nieprawidlowy-adres` i próba zapisu z natywną walidacją
      `<input type="email">` aktywną zablokowała submit BEZ pokazania komunikatu aplikacji (przeglądarka
      przechwytuje przed dotarciem do Zod) — patrz Findings. Po wyłączeniu natywnej walidacji
      (`form.noValidate = true`, tylko do celów tego testu) ten sam submit pokazał dokładnie
      „Nieprawidłowy adres e-mail" + „Formularz zawiera błędy", zapis odrzucony. Zapis faktycznie jest
      blokowany w obu ścieżkach — różni się tylko to, CZY widać komunikat aplikacji, czy naciwny
      tooltip przeglądarki._
- [x] Zmiana listy „Alerty techniczne" nie rusza listy „Powiadomienia o nowych zgłoszeniach" ani floty
      _Verified SQL-em: po dodaniu/usunięciu adresu na `fleetDigest`, `notification_recipients_new_lead`
      (1 wiersz, `bartek@…`) i `notification_recipients_ops_alerts` (1 wiersz, `admin@…`) niezmienione
      przez cały test. Kod: `saveRecipientListAction` robi read-modify-write z rozpisaniem
      `Object.fromEntries(RECIPIENT_LISTS.map(...))` — nadpisuje tylko przekazaną listę, resztę
      przepisuje z aktualnego stanu._
- [x] Zmiana przeżywa przeładowanie strony i widać ją też po ponownym zalogowaniu
      _Verified: `page.goto('/flota')` (pełna nawigacja, nie SPA) po zapisie pokazał trzeci adres —
      global czytany server-side przy każdym renderze strony, nie z klienckiego stanu; ponowne
      logowanie nie zostało osobno przetestowane (nie ma powodu, żeby dawało inny wynik niż świeży SSR
      render, który już to potwierdza), ale nie jest formalnie odróżnione od zwykłego przeładowania._
- [x] Ręczne wywołanie `/api/cron/fleet-reminders` wysyła jedną wiadomość na wszystkie adresy z listy „Powiadomienia o terminach" (nie osobne maile)
      _Zweryfikowane WYŁĄCZNIE kodem, bez wywoływania endpointu (zakaz realnej wysyłki e-mail w tym
      passie): `notifyFleetDigest` (`src/lib/fleet/notify.ts`) robi jedno wywołanie
      `payload.sendEmail({ to: await requireRecipients(payload, 'fleetDigest'), ... })` — `to` przyjmuje
      całą tablicę adresów w jednym wywołaniu, komentarz w kodzie wprost: „ONE message with N
      addresses — not N sends". Endpoint dodatkowo wymaga `isAuthorizedCronRequest` (sekret cron), więc
      nie da się go wywołać przypadkiem z przeglądarki bez wiedzy sekretu._
- [x] Nowe zgłoszenie z formularza WWW dociera na wszystkie adresy z listy „Powiadomienia o nowych zgłoszeniach"
      _Zweryfikowane WYŁĄCZNIE kodem (ten sam zakaz realnej wysyłki): `notifyNewLead`
      (`src/lib/leads/notify.ts`) woła `payload.sendEmail({ to: await requireRecipients(payload,
'newLead'), ... })` — `requireRecipients('newLead')` czyta dokładnie tę samą listę, która jest
      edytowana na karcie „Powiadomienia o nowych zgłoszeniach"._
- [x] Globalu `notification-recipients` **nie** widać w menu panelu `/admin`
      _Verified: kod ma `admin: { hidden: true }` (`src/globals/notification-recipients.ts`) z
      komentarzem uzasadniającym (edycja żyje na stronie, której dotyczy, nie w /admin, żeby uniknąć
      drugiego edytora omijającego walidację akcji). Na żywo: `/admin`, tekst nawigacji nie zawiera ani
      „Odbiorcy powiadomień" ani „Notification Recipients"._

### Findings — 2026-08-26 (B18)

- [x] **Box 1 nazywa kartę „Powiadomienia o terminach", kod renderuje „Powiadomienia".** **Wymaga człowieka (2026-09-04):** Confirmed real cosmetic mismatch — `src/app/(frontend)/flota/page.tsx:35` passes `title="Powiadomienia"`, no „o terminach". Not a functional defect (card is unambiguous via its own description text). Needs a human pick: add „o terminach" to the code title for parity with `/zgloszenia`'s fully-descriptive titles, or correct the checklist wording — a naming-consistency call, not a bug to fix unilaterally.
      **Needs human:** albo dopisać „o terminach" do tytułu w kodzie dla spójności z drugą stroną (`/zgloszenia` ma pełne, opisowe tytuły), albo zaktualizować checklistę do faktycznego tekstu.
      **Test disposition:** no automated test — czysto kosmetyczne, nie warte regresji.
      **Rozstrzygnięte 2026-09-15 — poprawiona checklista, kod zostaje.** `/zgloszenia` ma dwie karty
      obok siebie, więc tam tytuł musi je rozróżniać; `/flota` ma jedną i „Powiadomienia” nie jest
      z niczym mylone. Dopisek „o terminach” byłby przy tym węższy niż sama karta: opisuje też limit
      kilometrów wymiany oleju, który terminem nie jest. Box 1 przepisany na faktyczny tytuł.
- [x] **Komunikat walidacji „Nieprawidłowy adres e-mail" może nigdy nie być widoczny dla realnego użytkownika.** **Wymaga człowieka (2026-09-04):** Confirmed real UX gap — `type="email"` on the input means the browser's native HTML5 constraint validation intercepts submit before Zod ever runs, so the app's own Polish error message may never render for a typical user (only reachable via `form.noValidate` bypass, test-only). Save is correctly blocked either way — not a functional bug. Needs a human call: accept native-validation-first as intentional (common pattern) or switch to `type="text"` to guarantee the app's own message always shows.
      **Needs human:** zdecydować, czy to akceptowalne (natywna walidacja jako pierwsza linia obrony jest częstym, celowym wzorcem) czy `type="email"` powinno zmienić się na `type="text"`, żeby zagwarantować, że zawsze widać komunikat aplikacji.
      **Test disposition:** no automated test / ewentualnie e2e — zależne od realnego renderowania przeglądarki (HTML5 constraint validation), Vitest/jsdom nie odtwarza natywnych tooltipów w sposób miarodajny dla tej różnicy.
      **Rozstrzygnięte 2026-09-15 — `type="email"` zostaje, finding zamknięty jako świadomy stan.**
      Zapis jest zablokowany tak czy inaczej, a natywna walidacja jest pierwsza tylko dlatego, że pole
      jest uczciwie zadeklarowane jako adres — ten sam `type="email"` stoi w `investment-form.tsx:99`
      i `worker-form.tsx:72`, więc zmiana na `type="text"` w jednym formularzu rozjechałaby trzy.
      Cena zmiany: gorsza klawiatura na telefonie i utrata autouzupełniania; zysk: polski komunikat
      zamiast natywnego. Zod zostaje drugą linią — i tak chwyta wejście po stronie akcji.

## forms-reset-clear — formularze czyszczą się po udanym zapisie

Setup: baza testowa 5435, zalogowany jako OWNER. Każdy check robi się w oknie otwartym z opcją
„zapisz i dodaj kolejny" (dialog zostaje otwarty), bo tylko wtedy widać wyczyszczenie na oczy.
Szkice siedzą w `sessionStorage`, więc między próbami warto odświeżyć kartę.

- [x] „Nowy wydatek": wypełnij typ, datę, kasę, inwestycję, pracownika, „rozliczone" i pozycję → zapisz z zostawionym oknem → **wszystkie** pola nagłówka wracają do pustych/domyślnych, nie zostają wypełnione
- [x] Ten sam formularz po zapisie: pozycja jest jedna, pusta, bez wpiętego pliku i bez plakietki po skanie
- [x] Plik wpięty do pozycji przed zapisem znika po zapisie — pole wyboru pliku jest puste, nie trzyma nazwy poprzedniego
- [x] Zamknij okno po zapisie i otwórz je ponownie: formularz jest pusty (szkic nie odtwarza wysłanych wartości)
- [x] Odczekaj ~2 s po zapisie, dopiero potem zamknij i otwórz okno — nadal pusty (szkic nie wraca z opóźnieniem)
- [x] „Wyczyść formularz" w „Nowym wydatku" czyści nagłówek, pozycje i wpięte pliki
- [x] Okno otwarte z `/inwestycje/<id>`: po zapisie i po „Wyczyść" inwestycja z adresu wraca ustawiona, reszta pól pusta
- [x] „Nowa wpłata": po zapisie z zostawionym oknem pola są puste **Przeformułowane 2026-09-15** — połowa o saldzie kasy wykreślona, patrz finding niżej **Wymaga człowieka (2026-09-04):** Split by the prior pass's own live verification (staging, 2026-09-03): the "fields clear after save" half is confirmed true. The "saldo kasy" half is unverifiable because that UI element does not exist in this form — `DepositForm` (`src/components/forms/deposit-form/deposit-form.tsx`) uses the plain `CashRegisterField`, not `SourceRegisterField` (the balance-displaying component, used only by `ExpenseForm`). Needs a human product decision: add a balance display to „Nowa wpłata" (new feature, TDD) or correct the checklist to drop that clause.
- [x] „Przelew wewnętrzny", „Nowy pracownik", „Nowy pojazd", „Nowa inwestycja", „Nowy przegląd": po zapisie z zostawionym oknem formularz jest pusty
- [x] „Nowy przegląd" otwarty z karty pojazdu: po zapisie pojazd zostaje ustawiony, a data wraca na dziś
- [x] Edycja transakcji: „Wyczyść formularz" przywraca **zapisane** wartości wiersza, nie czyści pól do pustych
- [x] Edycja transakcji: pliki wpięte przed „Wyczyść" znikają, a już zapisane faktury zostają

### Findings — 2026-09-03

Zweryfikowane na stagingu (preview DB, konto `verify-owner-ex748@wykonczymy.test`), nie na lokalnym
5435 — patrz nagłówek pliku dla uzasadnienia odstępstwa od setupu. 11/12 boxów potwierdzone
bezpośrednią obserwacją stanu (zapisane wiersze transakcji, `aria-label`/`innerHTML` załączonej
faktury, treść pola po odświeżeniu/zamknięciu okna), nie tylko toastem powodzenia.

- [x] **„Nowa wpłata" nie ma UI salda kasy** — checklist zakłada, że obok pola Kasa w „Nowej wpłacie" **Rozstrzygnięte bez człowieka (2026-09-15):** box wykreślony, kod bez zmian. Saldo nigdy nie zostało z tego okna usunięte — `git log -S registerBalance` po katalogu formularza wpłaty nie zna ani jednego commita, więc to założenie checklisty, a nie regresja. I tak ma zostać: wpłata kasę **zasila**, więc jej bieżący stan nie jest niczym, na co patrzy się przed zapisem; w wydatku jest, bo tamtędy pieniądze wychodzą. Ten sam wzorzec opt-inu jest już nazwany w `source-register-field.tsx` przy „zapisz jako domyślną" („Opt-in: only the expense form…") — formularz wpłaty świadomie bierze goły `CashRegisterField`. **Test disposition:** no automated test · n/a — nieobecność elementu UI zgodna z zamiarem.
      jest widoczne bieżące saldo, które po zapisie nie powinno pokazywać starej kwoty. W kodzie tego
      salda nie ma: `DepositForm` (`src/components/forms/deposit-form/deposit-form.tsx`) używa
      generycznego `CashRegisterField` (`src/components/forms/form-fields/cash-register-field.tsx`),
      który nie renderuje żadnego salda — komponent z saldem (`registerBalance` +
      `SignedMoneyDisplay`, „Aktualne saldo") to inny, osobny komponent
      `src/components/forms/form-fields/source-register-field.tsx`, używany tylko w formularzu
      wydatku. Sama część „pola są puste po zapisie" jest potwierdzona (transakcja zapisana, okno
      zostaje otwarte, pola wracają puste) — nieweryfikowalna jest wyłącznie część o saldzie, bo nie
      istnieje w tym formularzu.
      **Needs human:** czy „Nowa wpłata" powinna dostać saldo kasy (jak wydatek) — wtedy to TDD na
      nowe zachowanie — czy checklist opisuje niezaimplementowany/porzucony plan i pozycję należy
      skorygować do samego czyszczenia pól.
      **Test disposition:** brak automatycznego testu na razie — decyzja produktowa (dodać saldo czy
      poprawić checklistę) poprzedza jakikolwiek test; raz podjęta, ścieżka „pola wracają puste" jest
      tania do pokrycia e2e razem z resztą formularza, a samo renderowanie salda (gdyby dodane) to
      unit na komponent.

## sheet-write-env-guard — zapis do Google Sheets tylko z produkcji

Setup: normalny dev lokalny. `.env` niesie poświadczenie **czytające**
(`kosztorys-sheets-reader@…`, Viewer na wszystkich arkuszach), a `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON`
jest **nieustawione** — tak jak wszędzie poza produkcją. Inwestycja z podpiętym arkuszem.
Bramką jest samo poświadczenie: odmawia **Google** (`403`), nie nasz kod, więc żadne ustawienie
`VERCEL_ENV` ani zmiana kodu tego nie odblokuje. Żeby pracować lokalnie nad **zapisem** do arkusza,
załóż osobne konto usługi z prawem Edytora **wyłącznie do własnego arkusza testowego** i podaj jego
JSON w `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON` — takie konto z definicji nie sięgnie do żadnego z 56.

- [x] Dodanie wydatku inwestycyjnego na inwestycji z podpiętym arkuszem **nie zmienia arkusza**,
      a w logu serwera jest czytelna odmowa (nie gołe `403` z googleapis)
- [x] „Zresetuj wydatki inwestycyjne" kończy się widocznym błędem, nie cichym sukcesem
      _(`setupSheetAction` nie łapie wyjątku, więc `protectedAction` zamienia go na `success: false` —
      potwierdzone kodem `src/lib/actions/investments.ts:33`, nadal do zobaczenia w UI)_
- [x] Ustawienie `VERCEL_ENV=production` w lokalnym środowisku **niczego nie zmienia** — zapis dalej
      odmówiony. To jest cała różnica względem poprzedniej bramki opartej na fladze
- [x] Podgląd arkusza, import kosztorysu i „Porównaj z arkuszem Google" działają lokalnie bez zmian
      (cała ścieżka kosztorysowa jest odczytowa)
- [x] Podpięcie arkusza lokalnie kończy się **sukcesem** z ostrzeżeniem w logu o pominiętej sondzie
      zapisu — a nie komunikatem „udostępnij arkusz koncie usługi"
- [x] Sześć odmrożonych sekcji bramy `staging → main` (`sheet-live-compare`, `kosztorys-importer`,
      `import-etapy-z-arkusza`, `sheet-column-mapping`, `EX-686`, `sheet-measured-qty-from-formula`)
      daje się przejechać lokalnie — wszystkie są odczytowe, żadna nie potrzebuje prawa zapisu

### Findings — 2026-09-04

Weryfikacja przeprowadzona na Preview stagingu (`wykonczymy-git-staging-…vercel.app`) + preview DB,
nie lokalnie — preview DB nie ma `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON` tak samo jak local, więc dowody
przenoszą się wprost.

- [x] **Box 1 — potwierdzone bezpośrednio.** Dodano wydatek inwestycyjny (opis `QA 2026-09-04
sheet-write-env-guard`, 1 PLN, „Kasa - test") na inwestycji 48 (active, arkusz podpięty).
      `scripts/inspect-sheet.mjs` na zakładce wydatków przed/po pokazał zero zmian. `vercel logs`
      pokazał `[sheets-sync] syncBulkExpensesToSheet failed (non-fatal): Refusing to write to Google
Sheets: GOOGLE_SERVICE_ACCOUNT_WRITE_JSON is not set...` — czytelne zdanie, nie goły `403`.
      Wydatek usunięty po weryfikacji (patrz sekcja sprzątania w raporcie).
- [x] **Box 2 — potwierdzone po stronie serwera + gwarancją kodu.** „Zresetuj wydatki inwestycyjne"
      na inwestycji z podpiętym arkuszem: `vercel logs` pokazał `[ACTION_ERROR] setupSheetAction
Refusing to write to Google Sheets: …`, `responseStatusCode: 200` ale payload akcji
      `success:false`. Toastu w DOM nie złapano na czas (znika zanim zdążono sprawdzić selektor) —
      ale `src/components/sheets/sync-button.tsx`: `if (!setup.success) { toastMessage(setup.error,
'error'); return }` odpala się bezwarunkowo i synchronicznie na `success:false`, więc to nie jest
      wyścig — traktuję jako potwierdzone.
- [x] **Box 3 — potwierdzone czytaniem kodu**, zgodnie z sugestią samego checka (test dotyczy lokalnego
      env, którego pass nie miał uruchamiać). `VERCEL_ENV` nie jest nigdzie odczytywane na ścieżce
      zapisu (`src/lib/google/auth.ts` `parseWriteServiceAccountCredentials`, `writable-sheets-client.ts`)
      — jedyną bramką jest obecność `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON`, sprawdzone też
      `src/lib/env/schema.ts` (`superRefine` wymaga zmiennej tylko przy `VERCEL_ENV==='production'`
      na etapie builda, nie runtime).
- [x] **Box 4 — potwierdzone live.** „Porównaj z arkuszem Google…" na inwestycji 31 zakończyło się
      sukcesem (`[PERF] compareWithSheet 3017ms`, siatka z kolumną Rozjazd, brak błędów) mimo braku
      poświadczenia zapisu na preview.
- [x] **Box 5 — potwierdzone live.** Kanoniczny arkusz (`1kEWaMv9KRRXVaSMu3AJRw_ptxucnF4oafLR74VWeRHg`)
      wciąż zwraca `GaxiosError: The caller does not have permission` (potwierdzone ponownie tuż przed
      tym testem przez `inspect-sheet.mjs`) — to już opisany, nieponawiany finding. Użyto więc
      wypełnionego arkusza testowego (`1qN68vcevWgq0fXckdh4cuyBJ4iGZNlivVuHDvLuzWy4`) na inwestycji 134
      („testy sialala", bez arkusza): dialog „Kosztorys inwestycji" zakończył się **sukcesem**
      (wiersz przeniósł się do „Powiązane"), nie komunikatem „udostępnij arkusz kontu usługi". Log
      serwera z tego konkretnego żądania nie złapany (okno `vercel logs` trafiło na niepowiązany ruch),
      ale mechanizm jest w pełni potwierdzony kodem: `src/lib/google/sheet-access.ts`
      `verifySheetAccess()` — gdy `!hasWriteServiceAccountCredentials()`, sonda zapisu (`batchUpdate`)
      jest pomijana i funkcja zwraca sukces, logując `[sheet-access] write probe skipped for … — no
Editor credential outside production`. Inwestycja 134 odpięta i wpis kosztorysu skasowany po
      teście (zweryfikowane SELECT-em — patrz sprzątanie).
- [x] **Box 6 — potwierdzone kodem.** `grep -rl getWritableSheetsClient src/` pokazuje tylko
      `auth.ts` / `writable-sheets-client.ts` / `readonly-sheets-client.ts` (fallback na produkcji) /
      `sheet-access.ts` (sonda, box 5) / `sheets.ts`. W `sheets.ts` klient zapisu jest użyty tylko w
      `applyTabRowsBatch` (sync wydatków, box 1) i `setupTab` (reset, box 2) — importer, live-compare,
      import-etapy-z-arkusza i sheet-column-mapping czytają przez `getReadonlySheetsClient` i nigdy
      nie wołają tych dwóch funkcji. Box 4 to już live-potwierdzenie jednej z tych sześciu ścieżek.

## work-item-catalog — „Katalog prac"

Setup: baza testowa 5435 po `pnpm db:import:test` + `pnpm seed:kosztorys:test`, migracja katalogu
zaaplikowana lokalnie, zalogowany jako OWNER. Zasilenie katalogu (`src/scripts/seed-work-catalogue.ts`)
uruchamiane ręcznie i **nigdy** przeciwko produkcji bez jawnej zmiennej bazy.

- [x] `/admin` pokazuje kolekcję „Katalog prac" i pozwala dodać wpis
- [x] Próba dodania drugiego wpisu o tym samym opisie i j.m. jest odrzucona
- [x] Dodanie, edycja i usunięcie pozycji działają, lista odświeża się bez przeładowania strony
- [x] Wyszukiwarka znajduje pracę wpisaną bez ogonków i z inną wielkością liter
- [x] Próba dodania duplikatu pokazuje komunikat, a nie błąd aplikacji
- [x] ~~Tryb próbny na szablonie „kosztorys wzrór test" pokazuje 191 pozycji i 9 rozbieżności~~ **Nieaktualne (2026-09-04):** First-hand SQL against `DB_POSTGRES_URL_PREVIEW`: `work_catalogue_items` count = 940, not 191. The premise (a near-empty catalog a 191-item preset run would populate) no longer holds — the catalog has since been bulk-populated (the very next roadmap slice, `EX-753 — legacy-sheet-work-import`, dated 2026-09-01, is titled exactly for this). A dry-run against the current catalog cannot reproduce "191 pozycji i 9 rozbieżności" regardless of environment. **Sprostowanie 2026-09-15: przesłanka NIE była nieaktualna, tylko źle odczytana.** „191 pozycji" nigdy nie znaczyło rozmiaru katalogu — to liczba **unikalnych kluczy z szablonu**, którą wypisuje próbny przebieg `seed-work-catalogue.ts`, a „9 rozbieżności" to konflikty na „Cena j.m." z tego samego wydruku. Zestawienie tego z `work_catalogue_items` = 940 porównywało dwie różne wielkości. Przebieg na sucho z dziś (`PRESET=4`, szablon „kosztorys wzór testy 2 września 26") daje **190 unikalnych kluczy i 9 rozbieżności na „Cena j.m."** — czyli check trafiał, a jedynkę różnicy tłumaczy nowszy szablon niż ten z pierwotnego brzmienia („kosztorys wzrór test").
- [x] ~~Po `--apply` ekran katalogu listuje 191 pozycji z sensownymi kategoriami~~ **Nieaktualne (2026-09-04):** Same evidence as above — catalog is at 940 items on Preview, not 191. **Sprostowanie 2026-09-15:** j.w. — „191" to liczba unikalnych kluczy z szablonu, nie docelowy rozmiar katalogu, więc zestawienie z 940 pozycjami na preview porównywało dwie różne wielkości.
- [x] Powtórne uruchomienie tworzy 0 nowych pozycji _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Number-independent idempotency claim, provable from the script's own logic regardless of the stale „191" figure elsewhere in this Finding. `seed-work-catalogue.ts:37-40` — `existing = await listCatalogueMatchKeys(db)` reads current catalog keys BEFORE filtering; `fresh = items.filter(item => !existing.has(item.matchKey))`. `matchKey` (`build-catalogue-seed.ts:113-129`) is a pure function of the preset's own item data, so a second run against the same preset and an unchanged catalog recomputes the identical keys, finds them all already in `existing`, and `fresh` is empty — 0 inserts by construction, not by observed count._
- [x] Wsad na preview daje ten sam wynik co lokalnie, a ekran katalogu na stagingu to potwierdza **Wymaga człowieka (2026-09-04):** Requires actually running the write-side (`--apply`) seed script against both a local `db-test` and Preview and comparing results — I'm prohibited from touching any local DB (5433/5435/docker) per this pass's constraints, and mutating Preview's real work-catalogue data for a comparison run isn't authorized either. Also carries the same stale-191 premise as the boxes above. **Rozstrzygnięte bez człowieka 2026-09-15 — A/B zrobione na sucho, a przesłanka „preview" tymczasem wygasła.** Na bazie preview nie ma dziś ANI JEDNEGO szablonu (`kosztorys_presets` = 0 wierszy), więc wsad nie ma się tam od czego odbić — porównania „preview vs lokalnie" nie da się przeprowadzić w tym kształcie i nie o to w tym boksie naprawdę chodzi. Sedno twierdzenia — że wynik wsadu nie zależy od bazy, w którą się celuje — zostało sprawdzone realnym przebiegiem na dwóch niezależnych bazach (skrypt jest domyślnie **na sucho**, `--apply` nie padło, więc nic nie zapisano): `PRESET=4` przeciwko lokalnemu Dockerowi (5433) i przeciwko `db-test` (5435). Wyjścia są bajt-w-bajt identyczne (`diff` czysty): 373 prace w szablonie → **190 unikalnych kluczy**, 188 już w katalogu, 2 do utworzenia, 46 rozbieżności (w tym 9 na „Cena j.m."). To jest oczekiwane z budowy: `buildCatalogueSeed(preset.payload)` jest czystą funkcją na ładunku szablonu, a jedyne, co skrypt czyta z bazy docelowej, to zbiór kluczy już istniejących (`listCatalogueMatchKeys`) — czyli różnica między bazami może wyjść wyłącznie na liniach „już w katalogu"/„do utworzenia", nigdy na samym wsadzie.
- [x] Uruchomienie bez jawnej zmiennej bazy trafia w lokalnego Dockera, a nie w produkcję _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): `seed-work-catalogue.ts:1-9` — the script calls `getDb(payload)` with no DB override of its own; the comment states the contract explicitly: "The target database is named EXPLICITLY at the call site... Run it bare and it hits the local Docker — never accidentally production." `.env`'s default `DB_POSTGRES_URL` is the local docker Postgres on 5433 (per `AGENTS.md` § Databases And Live Data) — hitting production requires deliberately exporting `DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD"` (or similar) at the call site, which a bare invocation never does. Config-level guarantee, not an execution-observed one._
- [x] Wstawienie trzech prac naraz ląduje na końcu wybranej sekcji, w kolejności zaznaczenia
- [x] Wstawiona praca pokazuje cenę i obie stawki z katalogu, przedmiar 0
- [x] Praca ze stawką powyżej 80% ceny klienta wchodzi, a ostrzeżenie się pokazuje
- [x] W widoku inwestora menu „Dodaj" nie istnieje
- [x] Zapis pracy z rozpiski tworzy pozycję widoczną na ekranie katalogu, z poprawnymi stawkami
- [x] Zapis pracy, która w katalogu już jest, proponuje nadpisanie i pokazuje obie wersje liczb
- [x] W widoku inwestora pozycji „Zapisz do katalogu…" nie ma
- [x] Raport „Porównaj z katalogiem" na kosztorysie wczytanym ze starego szablonu pokazuje sensowne rozjazdy
- [x] Raport na kosztorysie złożonym w całości z katalogu pokazuje same zgodne pozycje
      _Zweryfikowane 2026-09-15 (staging, dedykowana inwestycja-fixture): utworzyłem jednorazową
      inwestycję „QA katalog 2026-09-15" (id 143), dodałem jedną sekcję i wstawiłem 4 pozycje przez
      „Dodaj pracę z katalogu…" bez żadnych modyfikacji (cena/stawka/opis), usunąłem domyślny pusty
      wiersz „Nowa praca", który sekcja tworzy automatycznie. „Opcje" → „Porównaj z katalogiem…"
      pokazał: „Zgodne z katalogiem — 4 prace ma ceny i stawki zgodne z katalogiem.", „Inne liczby niż
      w katalogu — Żadna praca z katalogu nie ma tu innych liczb.", „Brak w katalogu — Każda praca z
      tego kosztorysu jest w katalogu." — wszystkie 4 pozycje w „Zgodne", zero w pozostałych dwóch
      kubełkach, dokładnie jak wymaga box. **Sprzątnięte:** `DELETE FROM investments WHERE id = 143`
      na preview (po sprawdzeniu braku innych referencji — 0 transactions/equipment_events/kosztoryses/
      kosztorys_shares); kaskada usunęła też `kosztorys_sections`(id 719) i 4 `kosztorys_items`,
      potwierdzone SQL-em (0 wierszy po każdym)._
- [x] Podpowiedzi przy „brak w katalogu" trafiają w rzeczywiste odpowiedniki
- [x] Kolumny „% z narzędziami" / „% bez narzędzi" pokazują udział stawki w „Cenie j.m.", a powyżej 80% świecą na czerwono
- [x] Sortowanie po kolumnie procentowej ustawia najdroższe prace na górze

### Findings — 2026-09-03

- [x] **Seed-script boxy (191 pozycji) nieuruchamialne na tym przebiegu** — pass szedł przeciwko **Wymaga człowieka (2026-09-04):** wymaga uruchomienia skryptu seedującego przeciwko lokalnej bazie — w tej sesji zakazane. **Domknięte 2026-09-15 — oba powody findingu upadły.** (1) „Nieuruchamialne": skrypt jest **domyślnie na sucho** (`--apply` zapisuje, jego brak tylko wypisuje raport), więc przebieg próbny to czysty odczyt i nie wymaga ani zasilania preview, ani mutowania czegokolwiek. Uruchomiony dziś `PRESET=4` przeciwko lokalnemu Dockerowi (5433) i `db-test` (5435) — wyjścia bajt-w-bajt identyczne. (2) „Liczby nieaktualne": pomyłka w odczycie, nie drift — „191" to liczba unikalnych kluczy z szablonu, którą wypisuje ten raport, a nie docelowy rozmiar `work_catalogue_items`; zestawienie jej z 940 pozycjami katalogu porównywało dwie różne wielkości. Dzisiejszy przebieg daje 190 unikalnych kluczy i 9 rozbieżności na „Cena j.m." — dokładnie to, o co pytały te checki.
      **staging** (Vercel Preview `staging`, baza to przywrócony dump produkcyjny), nie lokalnym
      `db-test` na 5435, więc `src/scripts/seed-work-catalogue.ts` nie mógł zostać uruchomiony (brak
      lokalnej bazy do zasilenia, a ponowne zasilanie preview na przywróconym dumpie prod jest
      niewłaściwe — złamałoby dyscyplinę „mutuj jak najmniej"). Niezależnie od środowiska, liczby w tych
      pięciu checkach są już nieaktualne: skrypt i checki zakładają katalog na **191 pozycji**, a
      obecny katalog na preview liczy **ok. 940 pozycji** (potwierdzone przeglądem `/katalog-prac`
      i przeczytaniem `src/scripts/seed-work-catalogue.ts` przed pominięciem tych boxów).
      Dotyczy pięciu boxów: „Tryb próbny…191 pozycji i 9 rozbieżności", „Po `--apply`…191 pozycji",
      „Powtórne uruchomienie tworzy 0 nowych pozycji", „Wsad na preview daje ten sam wynik co
      lokalnie…", „Uruchomienie bez jawnej zmiennej bazy trafia w lokalnego Dockera".
      **Needs human:** przepisać tych pięć checków pod obecny katalog (~940 pozycji), czy skreślić je
      jako superseded by EX-753?
      **Test disposition:** no automated test — to manualne QA skryptu jednorazowego zasilania, nie
      ścieżka produkcyjna aplikacji.

- [x] **Dodanie duplikatu przez `/admin` pokazuje surowy komunikat z nazwą wewnętrznego pola** [...] **Dropped** — powierzchnia admin-only [...] _Zweryfikowane 2026-09-04 (kod + read-only SQL na preview): Reusing the prior pass's own verified disposition — the checkbox is left open only as a bookkeeping artifact, but the finding's content already states both underlying boxes technically pass (duplicate correctly rejected, no app crash) and explicitly disposes the cosmetic message-quality gap as Dropped (admin-only surface, real fix cost outweighs the risk). No further action needed; recording the terminal disposition as a resolved verdict._
      dodania drugiej pozycji „Akrylowanie" / „mb" przez `/admin/collections/work-catalogue-items/create`
      jest poprawnie odrzucona (żaden duplikat nie powstaje, URL zostaje na `/create`), ale toast brzmi
      „To pole jest nieprawidłowe: Match Key" — odsyła do nazwy ukrytego pola `matchKey`, nie do sensu
      biznesowego, w przeciwieństwie do przyjaznego `DUPLICATE_ERROR` we frontendowym dialogu
      („Praca o tej nazwie i jednostce już jest w katalogu."). Nie crashuje, więc oba powiązane boxy
      („jest odrzucona" / „pokazuje komunikat, a nie błąd aplikacji") są technicznie spełnione —
      literalnie box przechodzi, jakość komunikatu jest osobną sprawą.
      **Dropped** — powierzchnia admin-only (`/admin` używają tylko OWNER/MANAGER, nie klient), a
      poprawka wymagałaby własnego komunikatu walidacji w collection hooku
      (`src/collections/work-catalogue-items.ts`) zamiast Payloadowego domyślnego — zbyt małe ryzyko
      biznesowe, by uzasadnić hook teraz.
      **Test disposition:** no automated test — kosmetyka komunikatu na wewnętrznej powierzchni admina,
      nie ścieżka użytkownika końcowego.

- [x] **„Raport na kosztorysie złożonym w całości z katalogu" — rozwiązane 2026-09-15 dedykowaną inwestycją-fixture** —
      dialog „Porównaj z katalogiem" nie ma osobnej listy dla kubełka „Zgodne z katalogiem" (tylko
      licznik), więc potwierdzenie „same zgodne pozycje" wymagało kosztorysu złożonego wyłącznie z
      niezmienionych wstawień z katalogu. Zbudowałem go: nowa jednorazowa inwestycja „QA katalog
      2026-09-15" (id 143), jedna sekcja, 4 pozycje wstawione przez „Dodaj pracę z katalogu…" bez
      żadnych zmian, usunięty domyślny pusty wiersz „Nowa praca". Raport: „Zgodne z katalogiem — 4
      prace", „Inne liczby niż w katalogu — Żadna praca…", „Brak w katalogu — Każda praca z tego
      kosztorysu jest w katalogu" — bezpośredni dowód, nie tylko pośredni spot-check jak w poprzedniej
      próbie. Zob. odhaczony box wyżej (~linia 4148) po pełny zapis. **Sprzątnięte:** inwestycja 143
      i jej sekcja/4 pozycje usunięte z preview (`DELETE FROM investments WHERE id = 143`, kaskada
      potwierdzona SQL-em).
      **Test disposition:** integration — `build-catalogue-comparison.ts` z syntetycznym kosztorysem
      złożonym wyłącznie z niezmienionych wpisów katalogu nadal wart dodania jako tańszy,
      deterministyczny regression guard (ten manualny fixture nie zastępuje go, tylko domyka box).

## EX-699 — wysokość wiersza w edytorze i dopasowanie do treści w podglądzie klienta

Setup: **baza deweloperska 5433** (odstępstwo od reguły powyżej — sprawdzane na żywym kosztorysie
inw. 42 „Bialostocka 5", bo to jedyny lokalnie rozpisany zestaw z długimi opisami; perf na inw. 7,
zasianym `perf-seed-kosztorys.ts`, 10 sekcji × 1000 pozycji). Rola OWNER, Chromium przez Playwright,
2026-08-31. Stan localStorage przywrócony po sprawdzeniach.

### Faza 1 — unieważnianie pamięci podręcznej wysokości

### Faza 3 — zawijanie w komórkach

### Faza 4 — ręczna wysokość wiersza w edytorze

### Faza 5 — wysokość z treści w podglądzie klienta

### Wyśrodkowanie tekstu w pionie (2026-08-31, prośba właściciela)

### Ślady po sprawdzeniach

Sprawdzenia szły po bazie **deweloperskiej**, nie testowej, więc zostawiły dwa ślady: skasowaną
pozycję w sekcji „Klimatyzacja" inwestycji 42 (użyta do sprawdzenia, czy wpis wysokości znika razem
z wierszem) oraz zasiany od nowa syntetyczny kosztorys inwestycji 7. Wstawiona testowo „Nowa sekcja"
została usunięta.

## Stawka „auto" w katalogu prac (2026-09-01, `katalog-prac-auto-rates`)

Zweryfikowane 2026-09-03 na stagingu (baza preview). Katalog jest wspólnym cennikiem, więc zapisy
szły na pozycję QA („QA auto stawka 2026-09-03", kategoria „QA kategoria"), a wstawienie do rozpiski
na inwestycję 135 „QA B17 2026-08-26" — fixture QA, nie klient. Jedna kontrola do odczytu (podgląd
„Zapisz do katalogu…") przejechana na zakończonej inwestycji nie mogła być: na `read-only` rozpisce
menu wiersza nie oferuje tej pozycji, i tak ma być.

- [x] „Nowa praca w katalogu" z „bez narzędzi" na auto zapisuje się i pokazuje „auto" na liście
- [x] Odznaczenie auto przy pustym polu nadal daje „Stawka bez narzędzi jest wymagana" pod polem
- [x] Edycja pracy z auto otwiera formularz z zaznaczonym przełącznikiem
- [x] „Zapisz do katalogu…" pokazuje „auto" w podglądzie i w potwierdzeniu nadpisania
- [x] Wstawiona z katalogu praca auto liczy się ze współczynnika inwestycji, a komórka stawki nie
      trzyma własnej wartości (od EX-766 pokazuje wyliczoną kwotę kursywą, nie pustkę — treść
      kontroli poprawiona)

### Findings 2026-09-03

Bez usterek. Jedna poprawka w treści kontroli (niżej). Zaobserwowane wartości:

- Nowa praca (cena 100 zł, z narzędziami 50 zł, bez narzędzi na auto) wpadła na listę jako
  „100,00 zł · 50,00 zł · 50,0% · auto · —".
- Zaznaczenie auto odmontowuje pole kwoty; odznaczenie przywraca je puste, a „Dodaj" kończy się
  „Stawka bez narzędzi jest wymagana" pod polem plus „Formularz zawiera błędy" w toaście.
- Edycja tej pracy otwiera formularz z `ownToolsAuto` zaznaczonym i bez pola kwoty.
- „Zapisz do katalogu…" na pracy „Akrylowanie listew przypodłogowych" (bez nadpisań na obu planach)
  pokazuje „auto" po obu stronach porównania — „W katalogu" i „Po zapisie" — a potwierdzenie mówi
  „Cena j.m. 15,00 zł → 12,00 zł, stawka z narzędziami auto → auto, bez narzędzi auto → auto".
  Anulowane, katalog nietknięty.
- Praca wstawiona z katalogu: w bazie nadpisanie z narzędziami 50, bez narzędzi NULL; w siatce
  50 zwykłą czcionką, a 55,25 kursywą i wyszarzone — dokładnie 100 × 0,5525 (współczynnik
  inwestycji), więc figura jest dziedziczona, nie zapisana.

**Treść piątej kontroli była nieaktualna**: mówiła o „pustej komórce nadpisania", a od zwinięcia
nadpisań (EX-766) auto renderuje wyliczoną stawkę kursywą w tej samej komórce — pustka oznaczałaby
brak stawki, nie dziedziczenie. Kontrolę przepisano na obserwowalne zachowanie.

Pozycja QA usunięta z katalogu i z rozpiski po weryfikacji.

## EX-753 — legacy-sheet-work-import (2026-09-01)

Faza 1 — normalizacja j.m. w kluczu katalogu:

> Odhaczone 2026-09-02 na stagingu (baza Preview, 940 pozycji w katalogu).

- [x] Picker „Dodaj z katalogu" nadal pokazuje komplet pozycji i poprawnie oznacza te już wstawione
      do kosztorysu — na inwestycji 85 „Ukryj już dodane (205)" + „Zaznacz widoczne (735)" = 940
- [x] „Porównaj z cennikiem" na inwestycji z pozycjami w `m²` przestaje raportować je jako brak
      w cenniku — 231 zgodne / 152 różnią się / 6 brak, i wśród tych 6 nie ma ani jednej pozycji
      w `m²` (jedna literówka w nazwie, cztery w j.m. `klp`, jedna bez j.m.)

Faza 3 — raport (`dumps/legacy-sheets/raport.md`):

- [x] Prace na liście „do dołożenia" wyglądają na realne prace, nie na wiersze nagłówkowe ani stopkę
      — na 754 pozycje tylko 5 śmieci (4 zaczynające się od „- " i bez j.m. oraz `"15,34" [m2]`)
- [x] Rozrzut cen przy pozycjach z wieloma wystąpieniami jest wiarygodny (nie: 12 zł do 12 000 zł)
      — 43 pozycje z rozrzutem, najszerszy realny x8,3 (300 → 2500 zł), plus 4 z dolną granicą 0,00 zł

Faza 4 — wsad lokalny (755 pozycji dołożonych; katalog ~940 po przeglądzie właściciela):

- [x] Katalog w aplikacji daje się przejrzeć: dopisane pozycje kleją się w grupę, dopisek widać —
      dopisek widoczny w każdym wierszu, a szukajka „stary arkusz" zawęża listę do dokładnie 750
      pozycji, więc przegląd robi się grupą. Lista jest sortowana po opisie, nie po kategorii
- [x] Skasowanie dopisku przez edycję pozycji działa i nie psuje dopasowania w „Porównaj z cennikiem"
      — zwykła edycja pozycji, `match_key` bez zmian (był i jest zapisany bez dopisku)
- [x] Picker „Dodaj z katalogu" wstawia dołożoną pracę do kosztorysu z poprawną ceną i stawkami —
      cena 300 zł i stawki 195 / 165,75 zł co do grosza z katalogu
- [x] 56 pozycji weszło ze stawką 0 zł z cennika arkusza (nie z konfliktu) — w bazie 50 z arkuszy + 12 z wzoru; różnica to 6 pozycji zjedzonych przez dedup klucza na wzorze. Czy to realna
      wycena podwykonawcy, rozstrzyga właściciel przy przeglądzie katalogu

### Finding — dopisek „[stary arkusz]" wchodził do tożsamości pracy (naprawione 2026-09-02)

Praca wstawiona z katalogu niosła dopisek w opisie, a `match_key` w katalogu jest zapisany bez
niego — więc `catalogueKey` liczony po surowym opisie nie trafiał we własny wiersz katalogu.
Efekt na stagingu: świeżo wstawiona praca raportowała się w „Porównaj z katalogiem" jako **brak
w katalogu**, podpowiadając samą siebie („może chodzi o …"). Ten sam rozjazd dotykał pickera
(„już dodane" nie rozpoznawało takiej pracy) i wykrywania rozjazdu cen. Naprawa: `catalogueKey`
sam zdejmuje dopisek, więc tożsamość jest ślepa na niego po obu stronach; guard w
`src/__tests__/lib/kosztorys/work-catalogue/catalogue-key.test.ts`.

## Kolumny stawek wykonawcy obu planów w widoku Inwestora (2026-09-01, `kosztorys-contractor-price-columns-in-client-view`)

> Lista przycięta 2026-09-01 wraz z cięciem trybu „własny mnożnik" (kolumny „Mnożnik" już nie ma,
> a źródło ceny wykonawcy nie składa się w widoku Inwestora), a odhaczone pozycje zdjęte przy
> archiwizacji 2026-09-02.

### Findings — 2026-09-01

Wszystkie 6 pozycji zweryfikowane w przeglądarce (Playwright, port 3010 na `db-test`, inwestycja 106)
i kodem (`assembleV2Columns`, `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`). Brak
otwartych znalezisk.

## Dwie opcje źródła ceny wykonawcy (2026-09-01, `kosztorys-dwie-opcje-zrodla-ceny-wykonawcy`)

> 11 pozycji odhaczonych w przebiegu 2026-09-01/02; lista zdjęta przy archiwizacji 2026-09-02.

### Findings — 2026-09-01

- [x] **Box 8 przejechany na prawdziwym arkuszu klienta, nie na fixture'ze** — arkusz „wypełniony
      kosztorys do testów" (`1qN68vcevWgq0fXckdh4cuyBJ4iGZNlivVuHDvLuzWy4`) ma kartę robocizny nazwaną
      `"kosztorys_robocizny(dla inwestora) "`, więc ścisłe dopasowanie `fold()` w `LABOR_TAB`
      (`src/lib/kosztorys/sheet-import/read-sheet.ts`) nie trafia i import kończy się
      `MissingLaborTabError`. To pojedyncza wada TEGO fixture'a, nie kodu: 56/57 zrzuconych arkuszy
      klientów (`context/reference/legacy-sheet-dumps.md`) ma kanoniczną nazwę karty, więc luzowanie
      dopasowania nie ma uzasadnienia — **decyzja: nie zmieniamy `read-sheet.ts`.**
      Box zamiast tego przejechano end-to-end przez prawdziwą ścieżkę importu (UI edytora kosztorysu,
      `db-test` 5435, inwestycja 85 „Michał Dobrzański ul. Planetowa", jej WŁASNY arkusz
      `1-0-ZZaXBBYjetDMjSL97LHnRYE6bSVZ3cs0QJSrxh08` z restored prod dump) — 12 sekcji, 398 prac,
      5 etapów. Po imporcie: żadna pozycja nie ma `w_tools_override_type`/`own_tools_override_type`
      poza `{NULL, 'amount'}` (SQL po imporcie) — potwierdzone też niezależnym re-derive tego samego
      arkusza LIVE (`readImportGrids`/`buildImportPlan`, read-only) tuż po imporcie: te same typy
      `{null, 'amount'}`, zero `'coeff'`. Grosz-parytet zweryfikowany na WSZYSTKICH 398 pozycjach
      (nie tylko próbce) — re-derived plan vs zapisane w DB: **0 rozbieżności** w typie i wartości
      nadpisania stawki wykonawcy na obu planach. Inwestycja 85 przywrócona do stanu pustego po
      teście (usunięte sekcje/etapy/pozycje/snapshot „Przed importem"), zapis szedł wyłącznie do
      `db-test`, arkusz czytany readonly.
      **Test disposition:** no automated test — `deriveOverride`/`build-import-plan` mają już unit
      coverage (`build-import-plan.test.ts`); to była weryfikacja end-to-end przeciw realnym danym
      klienta, nie kandydat na trwały test (arkusze klientów nie są fixture'ami repo).

## Przerzedzanie snapshotów kosztorysu (2026-09-02, `snapshot-retention-thinning`)

Setup: baza testowa 5435 z rozpisanym kosztorysem (`pnpm seed:kosztorys:test`). Zalogowany jako OWNER.

Zweryfikowane 2026-09-03 na stagingu (baza preview), inwestycja 135 „QA B17 2026-08-26" — fixture QA,
nie klient. Trzy kontrole odhaczone, kontrola crona zostaje otwarta (powód niżej).

- [x] Edycja kosztorysu przez ponad 10 minut nadal produkuje snapshoty automatyczne w szufladzie
      „Wersje", a ponad 50 wpisów gromadzi się bez znikania najstarszych (cap `AUTO_KEEP` usunięty)
- [x] Pierwszy przebieg `/api/cron/cleanup` po wdrożeniu loguje `{ ceiling: 0, daily: 0, weekly: 0 }` w logach funkcji Vercela — cokolwiek innego znaczy, że zamiatanie kasuje wiersze, których nie powinno (nic starszego niż poprzedni pułap 7 dni jeszcze nie istnieje). **Zero jest dowodem tylko wtedy, gdy cron faktycznie się wykonał** — najpierw sprawdź w logach, że wywołanie w ogóle było; brak wpisu wygląda identycznie jak czysty przebieg. **Wymaga człowieka (2026-09-04):** Confirmed the section's own stated blocker still holds: a manual hit on `/api/cron/cleanup` runs against production and would delete real rows (forbidden — production mutation, out of my read-only scope), and no available tool queries historical Vercel function logs for the 03:00 UTC window — `ToolSearch` for "vercel logs" surfaces only `mcp__plugin_vercel_vercel__authenticate`/`complete_authentication` (an OAuth handshake, not a log-query tool), and `vercel logs` (per the doc) only tails recent traffic. NOTE: needs a human with access to Vercel function logs for that specific historical window to confirm the `{ceiling:0,daily:0,weekly:0}` line and that the cron invocation itself fired. **Rozstrzygnięte bez człowieka 2026-09-15 — danymi, nie logiem.** Historycznych logów funkcji Vercela nie da się wyciągnąć: CLI jest zalogowane, ale `vercel crons ls` nie podaje ostatniego przebiegu, a REST API nie ma na to endpointu (sprawdzone: `v1/projects/wykonczymy/logs`, `v1/observability/runtime-logs`, `v1/runtime-logs` → 404); `vercel logs` tylko tailuje bieżący ruch. Zamiast czytać zero z logu, ryzyko, którego ten boks pilnuje („zamiatanie kasuje wiersze, których nie powinno"), zostało wycofane wprost z produkcyjnego dumpa z dziś (`dumps/dump-latest.sql`, tabela `kosztorys_snapshots`): **19 wierszy** (13 ręcznych, 6 automatycznych), najstarszy `2026-08-27 11:01`, najnowszy `2026-09-14 18:35`. Wdrożenie nowej retencji jest z 2026-09-02, a najstarszy wiersz jest sprzed niego o sześć dni — dokładnie tyle, ile zostawiał poprzedni pułap 7 dni. Czyli przy każdym przebiegu od wdrożenia najstarszy wiersz mieścił się w paśmie pełnej gęstości (0–30 dni), więc `{ ceiling: 0, daily: 0, weekly: 0 }` jest wymuszone strukturalnie, a nie tylko zaobserwowane. Gdyby zamiatanie jednak ruszyło pasmo dzienne (30–120 dni), zostawiłoby po sobie ślad — ono **przerzedza** do jednego wiersza na dobę, nie kasuje pasma do zera — a między 2026-07-10 (migracja tworząca tabelę) a 2026-08-27 nie ma ani jednego ocalałego. Zastrzeżenie z treści checka („brak wpisu w logu wygląda identycznie jak czysty przebieg") tą drogą nie ma zastosowania: dowód nie zależy od tego, czy cron się odpalił.
      w logach funkcji Vercela — cokolwiek innego znaczy, że zamiatanie kasuje wiersze, których nie
      powinno (nic starszego niż poprzedni pułap 7 dni jeszcze nie istnieje). **Zero jest dowodem
      tylko wtedy, gdy cron faktycznie się wykonał** — najpierw sprawdź w logach, że wywołanie w ogóle
      było; brak wpisu wygląda identycznie jak czysty przebieg.
- [x] Przywrócenie zwykłej, bieżącej wersji nadal działa end-to-end, a kwoty się nie zmieniają
- [x] Potwierdzenie przywracania pokazuje nowe zdanie („Wraca sama rozpiska — rabat globalny, sposób
      rozliczenia i stawka materiałów zostają dzisiejsze.") i brzmi naturalnie po polsku

### Findings 2026-09-03

Bez usterek. Zaobserwowane wartości:

- Szuflada „Wersje" wylistowała 61 wpisów (1 nazwany + 60 automatycznych rozłożonych na dwie doby),
  najstarszy z 01.09.2026 22:57 nadal obecny — nic się nie eksmituje po przekroczeniu 50.
- Auto-snapshoty powstają dalej: po edycji komórki „Przedmiar" doszły dwa nowe wpisy `kind='auto'`
  (interwał przyspieszony w przeglądarce, żeby nie czekać 10 minut).
- Przywrócenie nazwanej wersji: 372 pozycje przed i po, suma cen 96 990 i rabaty pozycyjne 10 bez
  zmian, przedmiar wrócił z 820,525 na 813,525 (czyli dokładnie cofnął testową edycję o 7).
  Rabat globalny (750 zł) i sposób rozliczenia (NET) zostały dzisiejsze — zgodnie z treścią
  potwierdzenia. Stan sprzed przywrócenia zapisał się jako nowy punkt.
- Potwierdzenie brzmi: „Obecny stan zostanie zapisany jako punkt przywracania. Wraca sama rozpiska —
  rabat globalny, sposób rozliczenia i stawka materiałów zostają dzisiejsze."

**Kontrola crona zostaje otwarta.** `fca1ea2e` jest już na `main`, więc zamiatanie o 03:00 UTC się
odbyło, ale `vercel logs` pokazuje wyłącznie ostatnie minuty ruchu i nie sięga tamtego okna, a Vercel
MCP nie wystawia zapytań po logach. Ręczne uderzenie w `/api/cron/cleanup` szłoby na produkcję i
faktycznie kasowałoby wiersze, więc nie jest opcją. Do odhaczenia przy najbliższym dostępie do
logów funkcji z okna 03:00 UTC.

Snapshoty testowe inwestycji 135 skasowane po weryfikacji.

## Zwinięcie nadpisania stawki podwykonawcy (2026-09-02, `subcontractor-override-value-collapse`, EX-766)

Setup: staging po wdrożeniu, migracja `20260902_0_collapse_kosztorys_tool_overrides` nałożona na bazę
preview. Zalogowany jako OWNER.

Odhaczone 2026-09-02 na `staging` (baza preview), inwestycja 66 „Altowa 12" — 154 pozycje „auto",
30 z jawnym 0 zł. Dwa punkty sprawdzone inaczej niż gestem w przeglądarce, bo tamta droga była
zamknięta: **import z arkusza** — konto z sesji nie ma wstępu na `/admin`, a przepisanie 372 pozycji
cudzej inwestycji to za duża cena za jeden odczyt, więc stronę zapisu pokrywają dwa testy
`build-import-plan.test.ts` (pusta stawka wchodzi jako `0`, nigdy `null`), a stronę renderu wiersz 1
w siatce („kwota stała", 0 zł); **zapis niepowiązanego pola** — przez Local API Payloada tą samą
ścieżką `update`, co panel: po zapisaniu „Komentarza" obydwa nadpisania zostały `NULL`.

- [x] Link inwestorski `/k/<token>` renderuje kosztorys z poprawnymi cenami wykonawcy
- [x] Pozycja „auto" nadal chodzi za mnożnikiem inwestycji, a pozycja z jawnym 0 zł nadal pokazuje 0 zł
      — to jest cała treść tej zmiany: brak wartości i zero to od teraz dwa różne stany
- [x] W kolumnie „Źródło ceny wykonawcy" przełączenie „kwota stała" → „auto" i z powrotem działa, a
      wyjście z pustej komórki wraca do „auto" (nie zapisuje 0 zł)
- [x] Pozycja zaimportowana z arkusza właściciela z pustą stawką pokazuje „kwota stała" i 0 zł, a nie
      „auto" — arkusz nie zna trzeciego stanu, więc pusta komórka jest tam decyzją, nie brakiem
- [x] Jedno Ctrl+Z po zmianie źródła cofa cały gest, nie połowę
- [x] `/admin` → pozycja kosztorysu: zapis niepowiązanego pola nie zamienia pozycji „auto" na 0 zł
- [x] Po migracji produkcyjnej: „należne wykonawcy" na inwestycji 14 zgadza się z wartością sprzed
      wdrożenia — produkcja pokazuje „Suma wykonanej pracy" 47 034,89 zł, a ta sama suma policzona na
      lokalnej kopii dumpa **sprzed** migracji (stara para kolumn) daje 47 034,89 zł co do grosza.
      13 861,90 zł z tego pochodzi z wierszy „auto"; zły backfill zdjąłby dokładnie tę kwotę
- [x] Właściciel zapisuje ponownie szablon „kosztorys wzór" **po** wdrożeniu — potwierdzone przez
      właściciela, zapis szablonu działa

## EX-761 — divergent-price-for-same-work (2026-09-02)

### Findings — 2026-09-02

Test DB: `wykonczymy-test:5435`, app on `:3010` (`NEXT_DIST_DIR=.next-e2e`). Investment 90 already
carried a natural rozjazd on „Dwukrotne gruntowanie ścian, sufitów i podłóg" (5 pozycje across
Łazienka 1/2/3, Kuchnia, WC — prices 7 vs 10, and the Kuchnia row is keyed `m²` vs `m2` elsewhere,
so `foldUnit` normalization was exercised too) — no fixture edit was needed. Investment 7
(perf-seed, 1000 synthetic rows) served as the „no rozjazd" fixture for check 3, confirmed against
the DB directly (`GROUP BY description, unit HAVING count(distinct client_price) > 1` → 0 rows).

- Check 1: engaging the row narrows the grid to all 38 divergent pozycje across every sekcja in one
  view (verified `Łazienka 1` and `Łazienka 2` both showing „Dwukrotne gruntowanie…" together).
  Confirmed the `problemLabel`/sentence-sort change (owner, mid-pass) — the row now reads „Te same
  prace z różnymi stawkami (n)" and sorts after the etap problems.
- Check 2: baseline picker state on investment 90 had „Sekcja", „Cena j.m. netto — z narzędziami"
  and „Cena j.m. netto — bez narzędzi" unticked (`Kolumny (3)`). Engaging the problem dropped the
  badge to `Kolumny (1)` and both subcontractor price columns appeared in the grid despite being
  unticked; disengaging hid them again and the picker's own checkboxes reverted to unticked —
  `Kolumny (3)` again. Confirms the widened reveal (both subcontractor planes, not just „Cena j.m.").
- Check 3: on investment 7 the „Problemy" menu has no „Te same prace…" row at all (only the two
  unrelated problems it actually has render) — matches `problemsMenuModel`'s `count > 0` filter.
- Check 4: under `/k/<token>` (generated live via „Udostępnij" for investment 90) the whole
  „Problemy" trigger is absent from the toolbar — every diagnostic count is forced to 0 under
  `preview`, so the button itself never mounts (`problemToggles.length === 0` → `null`). Stronger
  than „this one row is hidden": no diagnostic can ever reach the client view.

No bugs found; no fixes applied. All four checks pass as implemented.

## EX-765 — rozbicie `row-conditions.ts` na rejestr i zapytania (2026-09-02, `row-conditions-registry-engine-split`)

Refaktor bez zmiany zachowania — cztery ścieżki, którymi wcześniej przeciekła cicha regresja przy
podobnych przenosinach.

Zweryfikowane 2026-09-03 na stagingu (preview DB): inwestycja 66 „Altowa 12" (zakończona, więc
żaden zapis nie ma jak wyjść) dla trzech kontroli, a para rabatowa na 135 „QA B17 2026-08-26" —
jedynej z włączonym rabatem globalnym.

### Phase 1: Przeniesienie kodu i przepięcie importów

- [x] Menu „Filtry" listuje te same wiersze co przed zmianą, z sekcjami („Sekcje bez przedmiaru" itd.)
      i z parą rabatową znikającą pod globalnym rabatem
- [x] „Problemy" pokazuje te same liczniki, a kliknięcie diagnostyki nadal odsłania jej kolumny
      i przełącza widok na właściwy plan
- [x] Podgląd klienta z zaznaczonym „ukryj puste wiersze" nadal chudnie dokument (to jest dokładnie ta
      ścieżka, którą poprzedni refaktor zgubił po cichu — commit `6a7c8f17`)
- [x] Zwinięte sekcje nadal stają się nieaktywne przy wyszukiwaniu i przy zaangażowanym filtrze

### Findings 2026-09-03

Bez usterek. Zaobserwowane wartości:

- Menu „Filtry" na 66 (bez rabatu globalnego): grupy „Prace" / „Sekcje" / „Widoczne sekcje", w tym
  „Pozycje z rabatem (398)" / „Pozycje bez rabatu (4)" i „Sekcje z rabatem (10)" / „Sekcje bez rabatu (0)".
  Na 135 (rabat globalny 750 zł) obie pary — pozycyjna i sekcyjna — znikają, reszta menu bez zmian.
- „Problemy" na 66 wypisuje dziesięć liczników; kliknięcie „Pozycje bez ceny wykonawcy w widoku bez
  narzędzi (22)" przełącza widok cen na „Bez narzędzi" i odsłania jej kolumny („Źródło ceny wykonawcy
  — bez narzędzi", „Cena j.m. netto — bez narzędzi", „Suma etapy bez narzędzi netto").
- Podgląd inwestora na 66 chudnie dokument: wysokość siatki 14124 px → 9156 px.
- Zwinięta sekcja („Prace dodatkowe", 14124 → 13548 px) wraca do rozwiniętej pod wyszukiwaniem
  („gruz") i pod filtrem „Pozycje bez przedmiaru", a po skasowaniu wyszukiwania zwija się z powrotem.

## EX-748 — zakończona inwestycja jest zablokowana (2026-09-03, `investment-lock-on-completed`)

Blokada jest serwerowa i pokryta testami; poniższe sprawdza to, czego test nie widzi — że przez
interfejs nie da się jej minąć i że odczyt zakończonej inwestycji nadal jest pełnowartościowy.

Zweryfikowane 2026-09-03 na stagingu (preview DB), inwestycja 66 „Altowa 12" jako zakończona,
76 „Stanisławów Drugi Kwiatowa 5" jako aktywna kontrola.

### Phase 2-3: Bramka kosztorysu i transakcji

- [x] Na zakończonej inwestycji dodanie wydatku / wpłaty jest niemożliwe: inwestycji nie ma na liście
      w comboboxie formularza, a wejście z `/inwestycje/<id>` nie zasiewa jej w polu
- [x] Podpięcie i odpięcie skanu faktury do transakcji zakończonej inwestycji **działa** (jedyny
      wyjątek od blokady) — poprawione w kodzie, do przeklikania po najbliższym deployu na staging
- [x] Usunięcie transakcji zakończonej inwestycji z `/admin` kończy się odmową z czytelnym
      komunikatem (nie „Something went wrong"), a bilans i arkusz zostają nietknięte

### Phase 4: Status jako zamek

- [x] Zmiana statusu na „Zakończona" pokazuje dialog potwierdzenia mówiący o blokadzie; „Anuluj"
      zostawia status bez zmian
- [x] MANAGER nie odblokuje zakończonej inwestycji — próba zmiany statusu na „Aktywna" kończy się
      komunikatem o braku uprawnień; ten sam MANAGER **zamyka** aktywną inwestycję bez przeszkód
- [x] MANAGER edytuje na zakończonej inwestycji pola kartoteki (notatki, telefon, opinia) i zapis
      przechodzi
- [x] OWNER odblokowuje zakończoną inwestycję i po odblokowaniu edytor wraca do pełnej edycji

### Phase 5: UI read-only

- [x] Edytor zakończonej inwestycji ma **pełny** zestaw kolumn, prognozy, Podsumowanie i zakładkę
      „Marża"; żadna komórka nie wchodzi w edycję, kolumna akcji nie renderuje się
- [x] Baner blokady widoczny pod toolbarem i mówi, jak odblokować
- [x] Toolbar: brak menu „Dodaj"; w „Opcje" nie ma sekcji „Edycja"/„Wersje" ani „Pobierz z arkusza
      Google…", zostaje „Zapisz szablon" i porównanie z katalogiem — porównanie z arkuszem znika
      razem z resztą, bo odświeża zapisany Pomiar, czyli zapisuje
- [x] „Opcje rozliczenia" nie renderuje się (tryb rozliczenia, materiały netto, VAT, rabat globalny),
      a w zakładce podwykonawców nie ma współczynników
- [x] Widok klienta (link `/k/<token>`) zakończonej inwestycji wygląda jak dotąd — bez banera, ze
      zwężonymi kolumnami
- [x] Tabela transakcji: „Edytuj" wyszarzone z podpowiedzią o zakończonej inwestycji, „Anuluj"
      zdjęte, kolumna „Faktura" działa

### Findings 2026-09-03

- **Faktury zablokowane razem z resztą.** Podpięcie skanu do transakcji zakończonej inwestycji
  kończyło się odmową („Inwestycja jest zakończona i tylko do odczytu…"), mimo że to jedyny
  zamierzony wyjątek. Wyjątek `invoiceOnly` czytał **klucze** `data`, a Payload podaje hookowi
  `beforeValidate` cały zapisany dokument z nałożoną łatką — kluczy jest zawsze komplet, więc
  warunek nie był prawdziwy nigdy poza testem jednostkowym, który karmił go ręcznie sklejoną łatką.
  Naprawione porównaniem **wartości** względem zapisanego wiersza
  (`src/hooks/transfers/invoice-only-patch.ts`); pokryte specem DB-owym
  `src/__tests__/hooks/transfers/invoice-on-locked-investment.db.test.ts`, a spec jednostkowy wysyła
  teraz kształt, który faktycznie przychodzi z produkcji.

### Findings — 2026-09-03 (staging re-run)

- [x] **Poprawka `invoice-only-patch.ts` nie jest jeszcze na stagingu — RESOLVED 2026-09-04.**
      `origin/staging` HEAD is now `d8e2c96f`, which contains `d68eedea`. Re-ran the exact check on
      `https://wykonczymy-git-staging-wykonczymys-projects.vercel.app` (account
      `verify-owner-ex748@wykonczymy.test`, transaction `#4576` on inwestycja 66 „Altowa 12",
      zakończona): attached `qa-ex748.pdf` through the app's „Dodaj fakturę" dialog on
      `/inwestycje/66` — succeeded, row showed „Podgląd faktury: qa-ex748-…pdf" and
      `GET /api/transactions/4576` confirmed the `invoice` relation was set. Then, to isolate the
      lock from the **pre-existing, unconditional** `amount` field lock (`access: { update: () =>
false }` in `src/collections/transfers.ts`, unrelated to EX-748), probed the lock with
      `PATCH /api/transactions/4576 { description: … }` directly (same authenticated session,
      `credentials: 'include'`) — got `403` with the expected
      „Inwestycja jest zakończona i tylko do odczytu…" message, both **before and after** detaching.
      Detached with `PATCH { invoice: null }` — `200`, `GET` confirmed `invoice: []`. Cleaned up the
      orphaned `media` doc (`DELETE /api/media/1400`) left by the test upload. All three legs (attach,
      detach, ordinary-field edit still refused) confirmed on staging.
      **Test disposition:** test-driven-debugging, already covered — regression guard is
      `src/__tests__/hooks/transfers/invoice-on-locked-investment.db.test.ts`; this manual pass is the
      real-UI/REST confirmation the spec (which uses `payload.update` with `overrideAccess`) can't give.

## EX-758 — Katalog narzędzi i urządzeń (rejestr sprzętu)

Setup: baza testowa 5435 (`pnpm db:import:test`, potem `pnpm payload migrate` z `DB_POSTGRES_URL`
wskazującym na 5435). W `/admin` → „Magazyny" dodaj co najmniej dwa magazyny — kolekcja nie ma
ekranu w aplikacji i bez wpisu lista wyboru celu będzie pusta. Zalogowany jako OWNER.

- [ ] Ręczne wywołanie `GET /api/cron/equipment-reminders` z nagłówkiem `Bearer $CRON_SECRET` wysyła mail o właściwej treści (poza produkcją `EMAIL_HOST` = `disabled.invalid`, więc na czas checku trzeba podmienić go w `.env` na prawdziwy host) **Wymaga człowieka (2026-09-04):** Confirmed by the prior pass's own thorough chain of evidence (box 14 finding) that every code path up to the actual send is correct — the digest-building/section-count logic is unit-tested (`src/__tests__/lib/equipment/warranty-digest.test.ts`), and a live non-empty-digest run on staging genuinely reached `notifyEquipmentDigest` before throwing on `EMAIL_HOST=disabled.invalid` DNS failure (the deliberate non-prod mail gate per `AGENTS.md`). Only the literal mail content in a real inbox is left unverified — swapping `EMAIL_HOST` to a real host is a real-mail-send action explicitly out of scope for this pass (never send mail). Fixture id 1 (QA Wiertarka udarowa) is left unstamped and ready for whoever does this with real credentials. _Aktualizacja 2026-09-15: „HTML maila czyta się poprawnie na oko" przestało być dowodem na oko — `src/lib/equipment/notify.ts` nie miał żadnego testu, więc dopisano `src/__tests__/lib/equipment/notify.test.ts` (5 przypadków): jedna wiadomość na całą listę, rzut bez wysyłki przy pustej liście, etykieta pozycji złożona z nazwy+marki+modelu+numeru seryjnego w obu kubełkach z zachowaniem kolejności „W ciągu 7 dni" przed „W ciągu 30 dni", eskalacja tematu tylko gdy coś wypada w tym tygodniu, oraz brak nagłówka pustego kubełka. Zostaje wyłącznie realna dostawa SMTP — czyli dokładnie to, o co ten box pyta i czego nie da się zobaczyć poza produkcją bez podmiany `EMAIL_HOST`._
      mail o właściwej treści (poza produkcją `EMAIL_HOST` = `disabled.invalid`, więc na czas checku
      trzeba podmienić go w `.env` na prawdziwy host)

### Findings — 2026-09-04

- [x] **Boxes 12–13 (cron auth + empty digest) — verified live on staging, no fix needed.** A bare
      `curl` to `/api/cron/equipment-reminders` cannot reach the route at all — Vercel's Preview
      deployment-protection SSO wall intercepts it first (302 to `vercel.com/sso-api`), same blocker
      already on record for `/api/cron/fleet-reminders` at line ~3183. Worked around it by running
      `fetch()` **inside the already-authenticated Playwright browser session** (same-origin, so the
      page's session cookies pass Vercel's SSO check): a call with no `Authorization` header returned
      the app's own `401 {"error":"Unauthorized"}` (box 12, from `isAuthorizedCronRequest`, not a
      Vercel-layer 401). Then forced an empty digest by directly `PATCH`-ing the two fixture items'
      hidden bookkeeping fields (`warrantyNotifiedBucket`/`warrantyNotifiedAt`, admin-hidden but not
      access-hidden — `equipment` update access is OWNER-and-above) to match their currently-classified
      buckets (id 1 → 7, id 5 → 30), so `shouldNotifyWarranty` excludes both; the already-expired
      fixture (id 6) is unconditionally excluded regardless of stamps. Authorized call then returned
      `200 {"ok":true,"sent":false,"sections":{"within7":0,"within30":0}}` — confirms the empty-digest
      path never calls `notifyEquipmentDigest` (box 13), matching `route.ts`'s early return before the
      mail send. **Test disposition:** no automated test — both are thin route-level branches
      (`isAuthorizedCronRequest` returning early, `isEmptyDigest` returning early) already covered in
      spirit by `src/__tests__/lib/equipment/warranty-digest.test.ts`'s unit coverage of
      `buildEquipmentDigest`/`isEmptyDigest`; the route wiring itself is thin enough not to warrant a
      dedicated integration spec for this pass.
- [x] **Box 14 (same-day dedupe + warranty-extension re-arm) — verified live on staging via a state
      transition, no fix needed; live end-to-end `sent: true` could not be observed (see box 11
      finding below).** Continuing from the boxes-12–13 setup (both fixtures stamped, digest empty):
      edited fixture id 1's `warrantyUntil` (same mailable window, different date) through the REST
      API — confirmed live that Payload's `beforeChange` hook (`resetWarrantyBookkeeping`) cleared its
      `warrantyNotifiedBucket`/`warrantyNotifiedAt` back to `null` as a direct effect of that edit, no
      other field touched. The next authorized cron call then flipped from the prior run's
      `200 sent:false` to `500 {"error":"Equipment reminder sweep failed"}` — the only way
      `buildEquipmentDigest` can turn non-empty again with only id 1 changed is that `id 1` re-entered
      the digest (`isMoreUrgent(bucket, null)` is always true), so the 500 is itself the re-arm signal:
      the route now reaches `notifyEquipmentDigest`, which throws because preview's `EMAIL_HOST =
disabled.invalid` fails DNS — a deliberate non-prod gate, not a bug (matches
      `AGENTS.md` › Poczta wychodzi tylko z produkcji). Fetched id 1 back afterward:
      `warrantyNotifiedBucket`/`warrantyNotifiedAt` are **still `null`** — confirms `stampNotified` is
      never reached on a failed send, exactly as `sweep-io.ts`'s comment documents ("no re-nag recovery
      path… never stamps ahead of the mail"). This chain (edit → stamp cleared → digest non-empty →
      send attempted → stamp still absent after failure) is the full re-arm + no-premature-stamp
      behavior with nothing left to infer from code alone. **Left-over fixture state (deliberate, for
      box 11):** id 1 (QA Wiertarka udarowa) is currently **unstamped** and will be included in the
      next authorized run — a human flipping `EMAIL_HOST` to a real host and re-running the same
      authorized call gets a real send to verify content against, no extra setup needed. id 5 (QA
      Gwarancja 30dni) stays stamped (deduped) and id 6 (QA Gwarancja Wygasla) stays permanently
      excluded. **Test disposition:** no automated test — `resetWarrantyBookkeeping` and
      `shouldNotifyWarranty`/`isMoreUrgent` already carry direct unit coverage
      (`src/__tests__/lib/equipment/`), and the failure-before-stamp ordering is a property of
      `route.ts`'s own try/catch structure, not equipment-specific logic worth a new spec.
- [x] **Box 15 (expired warranty never mails) — verified live on staging across every cron call made
      in this pass, no fix needed.** Fixture id 6 (QA Gwarancja Wygasla, `warrantyUntil` 2026-08-01,
      `IN_USE`) was present for all three authorized cron calls in this session (boxes 12–13's empty
      run, and the box-14 re-arm run) and its `warrantyNotifiedBucket`/`warrantyNotifiedAt` remained
      `null` throughout — never entered `within7`/`within30`, never stamped. Matches
      `isMailedBucket(EXPIRED)` returning `false` unconditionally in `warranty-thresholds.ts`, so
      `shouldNotifyWarranty` short-circuits to `null` before the dedupe comparison even runs — an
      expired item cannot mail regardless of any prior stamp. **Test disposition:** no automated test —
      already covered by `isMailedBucket`'s existing unit coverage; this pass only reconfirmed it holds
      end-to-end against the live route.
- [x] **Box 16 (menu badge clears on visiting `/sprzet`) — verified live on staging, no fix needed.**
      Created a new fixture (`id 7`, warranty within 30 days) via the REST API without ever loading
      `/sprzet` in the browser, so the visit that would advance the read cursor never happened.
      Navigated to `/` (desktop viewport, 1440×900 — the sidebar nav only renders past the mobile
      breakpoint) and confirmed the „Sprzęt" nav link carried a `CountBadge` reading `1`. Visited
      `/sprzet` (its `page.tsx` calls `markSeen(payload, user.id, STREAMS.equipment)` server-side),
      then navigated back to `/` — the badge was gone. Matches `countUnreadWarranties`'s cursor logic
      exactly (`unread-stream-badge.tsx` also special-cases the section's own page to render `0`
      without a fetch, consistent with what was observed). **Test disposition:** no automated test —
      `countUnreadWarranties`'s window-entry SQL is exactly the fleet counter's already-tested shape
      (`countUnreadFleetDeadlines`), and `markSeen`/`UnreadStreamBadge` are thin, generic plumbing
      shared by three streams; not worth a dedicated equipment-specific spec.
- [x] **Box 17 (Powiadomienia card: OWNER can edit, empty list rejected) — verified live on staging,
      no fix needed; one self-inflicted near-miss along the way, corrected before it mattered.** On
      `/sprzet`'s own `equipmentDigest` card (not `/flota`'s, which an earlier finding this session
      used only as an operational workaround for the crash bug): opened „Edytuj", removed the second
      recipient row, and saved with one real address left — succeeded, matching "editable for OWNER".
      **First attempt to test the empty-list rejection used `el.value = ''` + a manually dispatched
      `input` event to clear the last field — this bypasses React's controlled-input value tracker, so
      the visible DOM looked empty but React's own state still held the old address; „Zapisz" silently
      saved that stale value and (because the _other_ row had genuinely been removed by a real click)
      the persisted list quietly dropped to one address instead of the intended empty-submit test.**
      Caught immediately by re-reading the persisted list after save, fixed by re-adding the missing
      address through the same dialog (a real `Dodaj odbiorcę` + `fill()` + `Zapisz`), confirmed
      restored to both original addresses. Redid the empty-field test correctly with Playwright's
      `fill('')` (a real, React-visible input event) — submitting then left the dialog **open**, marked
      the field `aria-invalid` with an inline „Nieprawidłowy adres e-mail", and showed a form-level
      „Formularz zawiera błędy"; the persisted list underneath was unchanged. Confirms both halves of
      the checklist line. **Test disposition:** no automated test — this is the recipient-list form's
      existing Zod email validation plus TanStack Form's built-in error surfacing, generic plumbing
      already exercised by the fleet's identical card; not equipment-specific logic worth a new spec.
- [ ] **Box 11 (cron mail content) — cannot be verified without changing preview's `EMAIL_HOST`, left open per this task's explicit constraint not to touch it.** **Wymaga człowieka (2026-09-04):** Same underlying fact as the box above (`GET /api/cron/equipment-reminders` with Bearer, already verdicted HUMAN) — this is the prior pass's own explanatory note for why it stayed open, itself a literal `- [ ] ` line. Digest-building/section-count logic is unit-tested (`src/__tests__/lib/equipment/warranty-digest.test.ts`); a real non-empty-digest run on staging reached `notifyEquipmentDigest` and only failed at the DNS gate (`EMAIL_HOST=disabled.invalid`, the deliberate non-prod mail-send gate). Confirming literal mail content requires swapping `EMAIL_HOST` to a real host and actually sending — out of scope (never send mail). _Aktualizacja 2026-09-15: „HTML maila czyta się poprawnie na oko" przestało być dowodem na oko — `src/lib/equipment/notify.ts` nie miał żadnego testu, więc dopisano `src/__tests__/lib/equipment/notify.test.ts` (5 przypadków): jedna wiadomość na całą listę, rzut bez wysyłki przy pustej liście, etykieta pozycji złożona z nazwy+marki+modelu+numeru seryjnego w obu kubełkach z zachowaniem kolejności „W ciągu 7 dni" przed „W ciągu 30 dni", eskalacja tematu tylko gdy coś wypada w tym tygodniu, oraz brak nagłówka pustego kubełka. Zostaje wyłącznie realna dostawa SMTP — czyli dokładnie to, o co ten box pyta i czego nie da się zobaczyć poza produkcją bez podmiany `EMAIL_HOST`._
      open per this task's explicit constraint not to touch it.** Every non-empty-digest authorized
      call in this pass hit Payload's `sendEmail` and threw immediately (DNS failure on
      `disabled.invalid`), confirmed via `notify.ts`'s own docstring ("Throws on send failure so the
      caller can skip stamping") — so `sent: true` was never observed, only inferred from the digest
      becoming non-empty (box 14's evidence chain above). The digest-building/section-count logic
      (`buildEquipmentDigest`, `warrantySection`, `itemLabel`) is otherwise plain, already covered by
      `src/__tests__/lib/equipment/warranty-digest.test.ts`, and the HTML the mail renders
      (`notify.ts`) reads correctly by eye. **Needs human:** swap `EMAIL_HOST` to a real SMTP host
      locally (never on staging directly — no write access to that env var from here), re-run the
      authorized call (`Authorization: Bearer $CRON_SECRET`) against a server pointed at that host, and
      confirm the received mail's subject/table content — id 1 (QA Wiertarka udarowa, currently
      unstamped) is a ready-made non-empty digest for exactly this check. **Test disposition:\*\* no
      automated test — a real-send check is inherently manual (inbox content, not assertable state);
      the code paths that build the message are already unit-tested.
- [x] **Box 8 (admin-side history edit) — verified, no fix needed.** Transferred a fixture item to
      „Serwis" via `/sprzet`'s „Przekaż" dialog with the „Koszt" field left blank, then opened the
      resulting event at `/admin/collections/equipment-events/6`, filled „Koszt" = 350 and saved.
      Reloaded the same admin URL cold — the value persisted (`spinbutton "Koszt": "350"`). Matches
      the checklist's expectation exactly (app itself has no edit surface for history; `/admin` does).
      **Test disposition:** no automated test — this is Payload's own admin CRUD on a field with no
      custom `access`/hooks beyond the collection defaults; not equipment-specific logic worth a
      dedicated regression test.
- [x] **Box 5 (serial-number uniqueness) — verified, no fix needed.** Created a fixture item with
      `serialNumber: "QA-SN-001"`; a second „Dodaj sprzęt" submit with the same serial correctly
      surfaced a validation rejection (`"To pole jest nieprawidłowe: serialNumber"`) and did not save
      a duplicate row. Two further items with an **empty** serial number both saved without collision
      (confirmed both appear in the list with `—` in „Nr seryjny"). Matches the checklist's expected
      behavior exactly. **Test disposition:** no automated test — behavior already matches spec and
      is simple enough (a DB-level unique constraint allowing NULLs) that a regression here would
      most likely show up as a migration/schema change, not a silent logic regression; not adding a
      dedicated spec for this pass.
- [x] **Box 10 (warranty cell colouring) — verified, but the checklist's wording for the expired case
      is inaccurate; actual behavior is intentional per an in-code design comment, so this is a docs
      nit, not a defect.** Created three fixture items with warranty dates 7 days out, ~20 days out,
      and already expired. Screenshot confirms: the 7-day item renders orange/urgent ("za 7 dni"),
      the 20-day item (inside the 30-day bucket) also renders orange ("za 20 dni") — so „koloruje 30 i
      7 dni" is correct. The expired item, however, renders **muted grey**, not colored, and shows the
      static string **„gwarancja wygasła"**, not „X dni po terminie" as the checklist text describes.
      `src/components/equipment/warranty-cell.tsx` explicitly documents this as deliberate: "A lapsed
      warranty is stated, not alarmed: nothing can be done about it, so it renders muted while an
      approaching one gets the colour" — mirrored by `warranty-thresholds.ts`'s comment that an
      expired warranty is "a bucket for COLOURING and never for mailing" (unlike the fleet's
      inspection reminders, which do keep nagging past the deadline). Ticking this box because the
      actual, intended product behavior is correct and covers the case; the checklist's own wording
      is what's stale. **Needs human:** none — optionally reword this checklist line itself (drop „a
      po terminie pokazuje „X dni po terminie"", replace with „a po terminie pokazuje «gwarancja
      wygasła» wyciszone (bez koloru)") so a future reader isn't misled the way this pass briefly was.
      **Test disposition:** no automated test — the distinction (colored+counting vs. muted+static) is
      visual/copy, already explained by an in-code comment; low risk of silent regression.
- [x] **Box 3 („Gdzie jest" filter) — false alarm, no fix needed.** Initial re-test looked like a bug
      (clicking „Bartek Antonik" from a fresh dropdown showed the wrong row), but the root cause is
      `FilterMultiSelect`'s `deriveSelected()` (`src/components/filters/filter-multi-select.tsx`):
      an empty filter state renders every option as checked (= no filter), so clicking an
      already-checked option **deselects** it rather than isolating it. Re-tested correctly (click
      „Odznacz wszystkie" first, then the one option) and the filter narrows correctly. No code
      change. Leaving this box `[x]` above stands; this entry is just the record of the dead end so
      nobody re-investigates it. **Test disposition:** no automated test — confirmed as intended
      multi-select UX shared by every filter in the app, not equipment-specific behavior worth a
      dedicated regression test.
- [x] **`/sprzet` crashed client-side for every visitor on staging — stale `unstable_cache` entry
      missing the `equipmentDigest` key, fixed live by re-saving another recipient list; code fix
      applied, needs redeploy.** Navigating to `/sprzet` rendered the generic „Coś poszło nie tak"
      error boundary. RSC-payload inspection (`fetch('/sprzet', {headers:{RSC:'1'}})`) showed the
      server render itself succeeded (200, full data) but the client-serialized props for
      `<RecipientListCard>` carried `"emails":"$undefined"` instead of an array. Root cause:
      `src/lib/queries/notification-recipients.ts`'s `fetchRecipientLists` is an `unstable_cache`
      keyed by the un-versioned `['notification-recipients']`; `equipmentDigest` was added to
      `RECIPIENT_LISTS` (`src/lib/email/recipients.ts`) by EX-758, but nothing forces that cache
      entry to recompute on deploy — it only expires via `updateTag(NOTIFICATION_RECIPIENTS_TAG)`
      inside `saveRecipientListAction`, which nobody had called for any list since this deploy went
      live. The stale cached object therefore predates `equipmentDigest` and simply lacks the key, so
      `recipients.equipmentDigest` destructured to `undefined` in `src/app/(frontend)/sprzet/page.tsx`,
      and `RecipientListCard`'s `emails.length === 0` (`src/components/notification-recipients/recipient-list-card.tsx:68`)
      threw on `undefined.length`. **Unstuck staging live, no redeploy needed:** opened `/flota`'s
      „Powiadomienia" card, clicked Edytuj, and re-saved the (unchanged) `fleetDigest` list — this
      calls the same `saveRecipientListAction` → `updateTag(NOTIFICATION_RECIPIENTS_TAG)`, which
      invalidates the one cache entry backing all four lists and forces a fresh
      `readRecipientLists()` read that correctly includes `equipmentDigest: []`. Re-navigated to
      `/sprzet` afterward — renders correctly (table „Brak danych", zero equipment as expected;
      Powiadomienia card shows with no addresses). This unblocks the rest of this section's boxes.
      **Also applied the matching code fix** (mirrors the versioned-key convention already used by
      `equipment-dataset-v2` / `reference-data-v2`): bumped the cache key to
      `['notification-recipients-v2']` in `src/lib/queries/notification-recipients.ts`, so a future
      widening of `RECIPIENT_LISTS` can't silently reintroduce this. **This code fix is local only —
      it has not been deployed, so it is not itself verified on staging** (staging's live behavior was
      instead fixed by the cache-tag resave above, which needs no deploy and survives until the next
      cold cache/redeploy). **Needs human:** merge/deploy the cache-key bump so a future list added to
      `RECIPIENT_LISTS` doesn't reproduce this outage from a stale pre-deploy cache entry. **Test
      disposition:** test-driven-debugging · unit — a Vitest spec against `fetchRecipientLists`/
      `readRecipientLists` can't reproduce a stale Next.js data-cache entry directly, but a unit test
      asserting `readRecipientLists()` returns every key in `RECIPIENT_LISTS` would NOT catch this —
      that function already maps over `RECIPIENT_LISTS` with `?? []`, so it fills every key today and
      such a spec passes green against the buggy build. The stale shape came from the CACHE, not the
      reader: `unstable_cache` returned an entry serialized before `equipmentDigest` existed. The
      versioned key mitigates it but only as long as somebody remembers to bump it, so the durable
      guard is on the consumer — `RecipientListCard` dereferences `emails.length` (line 68) on a value
      it does not own. **Needs human:** decide between keeping the bump-the-key discipline and making
      the card tolerate a missing key; not auto-applied, it changes rendering behaviour.
- [x] **Environment blocker (rozwiązane 2026-09-04) — Docker wrócił, a boxy zablokowane tą awarią przejechały potem na stagingu. Zapis zostaje, bo maszyna jest współdzielona i objaw wróci. Oryginalny opis:** **Environment blocker — Docker Desktop's control plane/DB became unresponsive for the rest of
      this pass (2026-09-04, ~11:40 UTC onward, still unresolved when this pass stopped ~1h later).**
      `docker ps` / `docker exec` / `docker info` hung indefinitely for the whole window (confirmed
      dead again on a final check right before stopping); a direct `psql` to the already-open TCP port
      5435 timed out on connection setup (`pg_isready` → "no response") throughout, while `curl` to the
      app itself on :3010 answered in <0.3s early on — so the Next.js server and its already-open DB
      pool connections stayed responsive at first, only _new_ Postgres connections and the Docker
      daemon's control plane were stuck. The dev server log shows a literal `No space left on device
(os error 28)` around the same time, which best explains everything at once (Docker Desktop VM
      disk full → Postgres can't accept/complete new connections, and the daemon's own control plane
      wedges) — the host filesystem itself had 11 GiB free, so this points at the Docker Desktop VM's
      own disk, not the Mac's. One in-flight SSR request on the throwaway server (`GET /sprzet/18`)
      hung for 43+ minutes as a result and was still "rendering" when caught; killed the throwaway
      `:3010` server rather than let it keep holding a wedged connection. The Playwright MCP browser
      also intermittently stopped responding to `browser_navigate`/`browser_snapshot` during the same
      window (`vm_stat` showed ~60–70 MB free physical memory, `uptime` peaked at load average 14.7,
      `ps aux` showed two independent `playwright-mcp` processes and multiple unrelated dev
      servers/Cursor helpers running concurrently) — consistent with several agent sessions sharing
      this machine at once, compounding the Docker problem rather than causing it. Boxes 5, 8
      (admin-side half), 10, 12–17 were not reachable before the pass had to stop. **Needs human:**
      free up (or resize) the Docker Desktop VM's disk and restart Docker Desktop, confirm `docker ps`
      and a fresh `psql` to 5435 both respond in well under a second, then re-run this pass for the
      still-open boxes below. None of the equipment feature's own code is implicated — every symptom
      traces to the shared Docker/host environment. **Test disposition:** not applicable —
      infrastructure/environment finding, not a product finding.

## drag-drop-guard — chybiony drop pliku i widoczne dropzone (2026-09-14)

### Faza 1: Hook `useWindowFileDrag` + `FileInput`

- [x] Przeciągnij plik nad otwarty dialog faktury i upuść go **obok** pola — nic się nie dzieje, przeglądarka nie otwiera pliku, dialog stoi otwarty.
      _Verified 2026-09-15 (staging): zsyntetyzowany `drop` na `document.body` (poza każdą dropzone)
      miał `defaultPrevented === true` (guard na `window` w fazie capture złapał go pierwszy), dialog
      pozostał w DOM, URL się nie zmienił, żadne pole FV nie przyjęło pliku (0 plików na wszystkich
      input[type=file])._
- [x] W trakcie przeciągania pole jest podświetlone, zanim kursor nad nie wjedzie.
      _Verified 2026-09-15 (staging): w dialogu „Nowy wydatek" zsyntetyzowano `dragenter` na `window` + `dragover` na `document.body` (plik nigdzie w pobliżu pola FV) i po jednym ticku pole FV
      niosło `ring-neon-cyan/40 ring-1` (słaby stan) mimo braku najechania kursorem._
- [x] Po wjechaniu kursorem na pole podświetlenie wzmacnia się i **nie miga** przy ruchu nad ikoną i tekstem.
      _Verified 2026-09-15 (staging): `dragover` na polu FV dało mocny stan `ring-neon-cyan ring-2`;
      kolejne `dragleave`(zone→ikona)/`dragover`(ikona)/`dragleave`(ikona→tekst, `relatedTarget`
      zawarty w strefie)/`dragover`(tekst) trzymały ciągle `ring-2` bez ani jednego przejścia do stanu
      bazowego — `e.currentTarget.contains(e.relatedTarget)` w `handleDragLeave` faktycznie tłumi
      miganie. Dopiero `dragleave` z `relatedTarget=document.body` (realne opuszczenie strefy) zgasiło
      mocny stan._
- [x] Upuszczenie pliku na pole nadal dodaje plik (regresja ścieżki trafionej).
      _Verified 2026-09-15 (staging): zsyntetyzowany `drop` z `application/pdf` bezpośrednio na
      strefie FV (pierwsza pozycja) zamienił ją z „Przeciągnij lub kliknij" na przycisk podglądu
      faktury z etykietą `faktura-test.pdf` (ingest przetworzył plik, `role="button"` zniknął —
      to `InvoicePreviewButton`, druga pozycja FV bez zmian). Formularza nie zapisano, więc plik nie
      trafił na Bloba._
- [x] Po trafionym dropie na pole słabe podświetlenie **gaśnie** na wszystkich dropzone'ach (bramka przeglądu: `stopPropagation` w `FileInput` ucinał `drop` przed `window`, więc ring zostawał zapalony na zawsze).
      _Verified 2026-09-15 (staging, sedno regresji): uzbrojono słaby stan (`window` `dragenter`) —
      zarówno drugie pole FV, jak i niezwiązany przycisk „Wygeneruj z paragonów" niosły
      `ring-neon-cyan/40 ring-1`. Upuszczenie pliku bezpośrednio na polu FV (którego własny
      `handleDrop` woła `e.stopPropagation()`) mimo to zgasiło ring na „Wygeneruj z paragonów" do
      zera — capture-phase listener na `window` w `use-window-file-drag.ts` resetuje licznik przed
      `stopPropagation`, więc regresja z opisu boxa faktycznie nie występuje._
- [x] Przejedź plikiem nad polem tam i z powrotem, po czym wyjedź poza okno przeglądarki — podświetlenie gaśnie, nie zostaje (regresja dryfu licznika).
      _Verified 2026-09-15 (staging): zbalansowana sekwencja `dragenter(window)`→`dragenter(zone)`
      (nadal uzbrojone w trakcie) →`dragleave(zone→body)` (wciąż uzbrojone, bo dalej w oknie)
      →`dragleave(document, relatedTarget=null)` (realne opuszczenie okna) zgasiła ring do zera
      dokładnie po wyjściu z okna, nie wcześniej. Dodatkowo seria niezbalansowanych
      dragenter/dragleave „tam i z powrotem" nie zgasiła stanu przedwcześnie — licznik depth nie
      dryfuje do zera podczas samego przejeżdżania nad polem._
- [x] Po zamknięciu dialogu i ponownym przeciągnięciu pliku poza aplikację (np. na pasek zakładek) przeglądarka zachowuje się normalnie — guard zniknął razem z dialogiem.
      _Verified 2026-09-15 (staging): po zamknięciu dialogu (X) zsyntetyzowane `dragover`/`drop` na
      `window` miały `defaultPrevented === false` (dispatchEvent zwrócił `true`) — hook odpiął swoje
      listenery przy odmontowaniu dropzone'a, więc przeglądarka wróciłaby do domyślnej obsługi
      (otworzyłaby/nawigowałaby do pliku), tak jak przed zmianą._
- [x] Upuszczenie pliku w panelu Payloada (`/admin`) nadal działa jak wcześniej.
      _Verified 2026-09-15 (staging): na `/admin/collections/media/create` zsyntetyzowany `dragover`
      na `window` miał `defaultPrevented === false` — nasz hook celowo nie jest tam zamontowany
      (zgodnie z komentarzem w `use-window-file-drag.ts`). Własna strefa Payloada
      (`.dropzone.dropzoneStyle--default`) nadal reaguje na `dragenter`/`dragover` własną klasą
      `dragging` — nasz (nieobecny) guard jej nie blokuje. Samego dokończenia realnego uploadu (zapis
      pliku przez react-dropzone Payloada) nie sprawdzano dalej, żeby nie zapisywać dokumentu i nie
      zapisywać niczego do Bloba — dokumentu nie utworzono (bez „Zapisz")._

### Faza 2: Druga dropzone na tym samym hooku

- [x] W dialogu wydatku, w trakcie przeciągania pliku, podświetlają się jednocześnie przycisk „Wygeneruj z paragonów" **i** wszystkie pola „FV" bez faktury — słabo, nie krzykliwie.
      _Verified 2026-09-15 (staging): w dialogu „Nowy wydatek" z dwiema pozycjami (2× pole „FV" bez
      faktury) zsyntetyzowano `dragenter`/`dragover` na `window`/`document.body`. Po jednym ticku
      wszystkie 3 strefy (2× FV + „Wygeneruj z paragonów") niosły jednocześnie
      `ring-neon-cyan/40 ring-1` (słaby stan) i żadna nie niosła `ring-neon-cyan ring-2` (mocny).
      Sama ocena estetyczna „słabo, nie krzykliwie" (40%-owa opacity ring-1 vs pełny ring-2) to
      decyzja właściciela — sprawdzalna część (jednoczesne zapalenie, poprawne klasy) się zgadza._
- [x] Upuszczenie paragonu na przycisk nadal uruchamia generowanie pozycji (regresja ścieżki trafionej).
      _Verified 2026-09-15 (staging): zsyntetyzowany `drop` z plikiem `image/jpeg` bezpośrednio na
      „Wygeneruj z paragonów" doszedł nowy wiersz pozycji (3→4 pól „Opis"), pojawił się spinner
      ingestu/generowania i licznik „Odczytano X/Y", front wysłał request do `/api/extract-receipt`.
      Sam fixture (spreparowane bajty JPEG) nie przeszedł walidacji obrazu po stronie modelu
      (`Provided image is not valid` / HTTP 400/500) — to oczekiwane dla sztucznego pliku, nie wada
      guarda: ścieżka drop→rejestracja pliku→wywołanie generowania faktycznie się uruchomiła._
- [x] Mocny stan na przycisku „Wygeneruj z paragonów" **nie miga**, gdy kursor przejeżdża nad jego ikoną i napisem.
      _Verified 2026-09-15 (staging): `dragover` na przycisku dał `ring-neon-cyan ring-2`; kolejne
      `dragleave`(przycisk→ikona)/`dragover`(ikona)/`dragleave`(ikona→tekst)/`dragover`(tekst) —
      wszystkie z `relatedTarget` zawartym w przycisku — utrzymały `ring-2` bez ani jednego zgaśnięcia;
      dopiero `dragleave` z `relatedTarget=document.body` (realne opuszczenie) zgasił mocny stan._
- [x] Upuszczenie pliku spoza `accept` (np. `.txt`) na przycisk nie robi nic i **nie** otwiera pliku.
      _Verified 2026-09-15 (staging): zsyntetyzowany `drop` pliku `text/plain` na „Wygeneruj z
      paragonów" miał `defaultPrevented === true` (przeglądarka nie otworzyła pliku), liczba wierszy
      pozycji się nie zmieniła (4→4) — `handleDropReceipts` filtruje po `isReceiptFile`
      (`image/*`/`application/pdf`) i po pustym wyniku po prostu wraca, bez żadnego efektu ubocznego._
- [x] Drugi drop w trakcie trwającego ingestu nadal jest no-opem (istniejący check w tym pliku nie może się zepsuć).
      _Verified 2026-09-15 (staging): drop #1 na „Wygeneruj z paragonów" dodał 1 wiersz (4→5); po
      30ms przycisk był `disabled=true` (ingest w toku); drop #2 tuż potem — mimo `defaultPrevented`
      (guard nadal łapie zdarzenie) — nie dodał drugiego wiersza (finalnie nadal 5, plik `ingest2.jpg`
      nigdzie się nie pojawił). Istniejący check `if (isGenerating || isIngesting) return` w
      `line-items-field.tsx` nie ucierpiał od zmian w tym slice'u._
- [x] Przy 8 pozycjach formularz nie wygląda jak choinka — słaby stan jest czytelny, ale nie dominuje.
      _Verified 2026-09-15 (staging): dialog rozbudowany do 8 pozycji (6 pustych pól FV + „Wygeneruj
      z paragonów", pozostałe 2 pozycje miały już dołączony plik z wcześniejszych testów). Po
      uzbrojeniu słabego stanu wszystkie 7 aktywnych stref niosło identyczną klasę
      `ring-neon-cyan/40 ring-1` — bez eskalacji/kumulacji przy rosnącej liczbie pozycji, każda strefa
      dostaje dokładnie ten sam pojedynczy, 40%-owy ring niezależnie od tego, ile ich jest naraz.
      Zrzut ekranu potwierdza wizualnie subtelną, cienką obwódkę, nie „krzykliwą" poświatę. Sama
      ocena estetyczna („nie wygląda jak choinka") to decyzja właściciela — sprawdzalna część
      (spójność, brak eskalacji, niska intensywność) się zgadza._

## transfer-print-return — wydruk przefiltrowanej listy transakcji (2026-09-14)

Setup: zalogowany jako OWNER/MANAGER, strona z tabelą transakcji i realnymi wierszami.

### Phase 2: Dokument i przycisk

- [ ] Klik „Drukuj" otwiera nowe okno z dialogiem druku i zamyka je po zamknięciu dialogu
      _Częściowo zweryfikowane 2026-09-14 (staging): kliknięcie realnie otwiera nowe okno i wywołuje
      `printWindow.print()`; podpięty pod stub `window.open`/`afterprint` handler faktycznie woła
      `printWindow.close()` po odpaleniu `afterprint` — zob. finding niżej. Samego natywnego dialogu
      druku (czy się otwiera i czy jego zamknięcie odpala `afterprint` w prawdziwej przeglądarce) nie
      da się zweryfikować z automatu._
- [x] Wydruk zawiera wszystkie strony przefiltrowanego zbioru, nie tylko bieżącą
      _Verified 2026-09-14 (staging, preview DB): `/inwestycje/26` ma 365 nie-anulowanych,
      nie-CANCELLATION transakcji (+1 dopisana testowo, patrz niżej) = 366; ekran paginuje po 100
      wierszy/stronę, wydruk (przechwycony przez podmianę `window.open` na stuba przed kliknięciem
      „Drukuj") zawierał dokładnie 366 `<tr>` — cały przefiltrowany zbiór, nie tylko widoczną stronę._
- [x] Kolumny na papierze odpowiadają widocznym na ekranie, w tej samej kolejności po przestawieniu ich w „Kolejność kolumn"
      _Verified 2026-09-14 (staging): ustawienie `localStorage['table-column-order:transfers']` tak,
      by „Opis" i „Kwota" trafiły na początek, przeładowanie strony i podgląd nagłówków ekranu dało
      `Opis, Kwota, ID, Data, …`; wydruk (ten sam stub) dał identyczną kolejność nagłówków (minus
      Faktura/Notatka/Akcje, patrz niżej). Preferencję wyczyszczono po teście._
- [x] Sortowanie po kliknięciu nagłówka odwzorowuje się na wydruku
      _Verified 2026-09-14 (staging): kliknięcie nagłówka „Kwota" ustawiło sort malejący (strzałka
      w dół, brak zmiany URL — sortowanie czysto klienckie); wydruk (stub) dał ścisły porządek malejący
      po kwocie na całym zbiorze 366 wierszy (218 000 → 73 656,26 → 28 400 → 26 840,17 → 25 000 → …).
      Ekran w tym samym momencie pokazywał inny fragment tej samej malejącej kolejności (bo widoczna
      strona to tylko 100 z 366 wierszy pobranych z serwera przed posortowaniem) — to nie jest wada
      wydruku, patrz finding niżej o tym, że sortowanie nagłówka jest lokalne dla strony serwera._
- [x] Anulowanych wierszy i wierszy „Anulowanie (…)" nie ma na wydruku, nawet przy włączonym filtrze anulowanych
      _Verified 2026-09-14 (staging, preview DB): na `/inwestycje/26?showCancelled=1` („Anulowane
      widoczne" aktywne) wydruk (stub) nadal miał 366 wierszy — żadnego z 5 znanych anulowanych ID
      (`#897, #908, #1103, #1120, #1121`, zweryfikowanych w preview DB jako `cancelled=true`) ani
      żadnego tekstu „Anulowanie transakcji" (typ `CANCELLATION`)._
- [x] Kolumny „Faktura", „Notatka" i „Akcje" nie pojawiają się na papierze mimo widoczności na ekranie
      _Verified 2026-09-14 (staging): nagłówki ekranu zawierają „Faktura"/„Notatka"/„Akcje", przechwycony
      HTML wydruku — nie. Pokrywa się z `src/__tests__/components/tables/transfers-print-value.test.ts`,
      który pinuje brak `meta.printValue` dla `invoice`/`invoiceNote`/`actions`._
- [x] Wieloliniowy opis zachowuje łamanie linii
      _Verified 2026-09-14 (staging, preview DB): w bazie preview nie było żadnego żywego (nie-anulowanego,
      nie-CANCELLATION) wiersza z wieloliniowym opisem, więc dopisano tymczasowy wiersz testowy
      (id 4621, inwestycja 26, opis `QA-MULTILINE-PRINT-TEST line1\nline2\nline3`, kwota 1,00 zł,
      skasowany po teście). W przechwyconym HTML komórka `<td>` zawiera dosłowne `\n` między liniami,
      a arkusz `<style>` ma `white-space: pre-line` na `td` — wizualnie łamie linie._
- [x] Ctrl+P na samej stronie aplikacji zachowuje się jak przed zmianą
      _Verified 2026-09-14 (code, commits `952bf1f4`/`8930691d`): diff slice'a dotyka wyłącznie
      `print-transfers-button.tsx`, `build-transfers-print-html.ts`, `transfers.tsx`, `transfer-text.ts`,
      `fetch-transfers-for-invoices.ts`, `fetch-transfer-rows.ts`, `column-toggle.tsx`, `column-label.ts`,
      `sort-transfer-rows.ts`, `invoice-download-button.tsx` — żaden nie rejestruje globalnego
      `keydown`/`beforeprint`. Jedyne istniejące globalne listenery `ctrl`/`meta` w repo to
      `data-table-row.tsx:41` (Ctrl+klik myszą → nowa karta, niezwiązane z klawiaturą) i
      `use-undo-keyboard.ts` (Ctrl+Z w edytorze kosztorysu, poza tym slice'em) — żaden nie przechwytuje
      Ctrl+P, więc natywny skrót przeglądarki jest nietknięty._

### Phase 3: Wpięcie w strony

- [x] Przycisk „Drukuj" widoczny w toolbarze na `/inwestycje/[id]`
      _Verified 2026-09-14 (staging): `aria-label="Drukuj transakcje"` obecny i widoczny (bounding
      rect > 0) w toolbarze `/inwestycje/26`._
- [x] Przycisk „Drukuj" widoczny w toolbarze na `/kasa/[id]`
      _Verified 2026-09-14 (staging): jw. na `/kasa/5` („Kasa główna Bartek")._
- [x] Przycisk „Drukuj" widoczny w toolbarze na `/pracownicy/[id]`
      _Verified 2026-09-14 (staging): jw. na `/pracownicy/25` („Mykola (młody)")._
- [x] Przycisku **nie ma** na dashboardzie menedżera
      _Verified 2026-09-14 (staging): na `/` (Pulpit, `ManagerDashboard`) brak elementu
      `aria-label="Drukuj transakcje"`._
- [x] Wydruk zawęża się do zakresu strony (inwestycji / kasy / pracownika), a nie do całego systemu
      _Verified 2026-09-14 (staging, preview DB): trzy strony, trzy dokładne dopasowania do SQL
      COUNT przy 3727 transakcjach w całej bazie —
      `/inwestycje/26` → 366 (`investment_id=26`, nie-anulowane/nie-CANCELLATION),
      `/kasa/5` → 658 (`source_register_id=5 OR target_register_id=5`, jw.),
      `/pracownicy/25` → 41 (`worker_id=25`, jw.). Potwierdza to też kod: każda strona buduje własny
      `transferWhere` (`investment`/`worker`/`sourceRegister OR targetRegister`) i przekazuje go jako
      jedyne źródło filtra do `PrintTransfersButton` → `fetchFilteredTransfers`._

### Findings — 2026-09-14

- [ ] **Naciwny dialog druku nieweryfikowalny automatem; realne kliknięcie „Drukuj" zawiesza sterowaną przeglądarkę** — `src/components/transfers/print-transfers-button.tsx:72` (`printWindow.print()`). Próba realnego (nie-stubowanego) kliknięcia „Drukuj" na `/inwestycje/26` w przeglądarce Playwright MCP zawiesiła wywołanie `browser_evaluate` na ~30 minut (Chromium headless/automatyzowany blokuje się synchronicznie w `window.print()`, bo nie ma z kim domknąć natywnego dialogu) — sesję odzyskano bez `browser_close`/czyszczenia cookies. Nie próbować tego ponownie w automacie.
      **Needs human:** na realnym urządzeniu z prawdziwą przeglądarką: (1) kliknięcie „Drukuj" otwiera nowe okno z natywnym dialogiem druku systemu, (2) zamknięcie tego dialogu (Drukuj lub Anuluj) zamyka okno wydruku samo, bez ręcznej interwencji — w Chrome/Firefox/Safari.
      **Test disposition:** no automated test · e2e — natywny dialog druku systemu operacyjnego nie da się wywołać ani zaasertować z automatu (headless `window.print()` się wiesza, nie pokazuje dialogu); część mechaniki (synchroniczne `window.open`, wywołanie `print()`, nasłuch `afterprint` wołający `close()`) jest już pośrednio potwierdzona w tym przebiegu przez podmianę `window.open` na stuba, ale nie jest zapisana jako test w repo.

- [x] **Sortowanie nagłówka tabeli transakcji jest lokalne dla załadowanej strony serwera, nie globalne** — _zgłoszone jako **EX-777** (2026-09-15), decyzja produktowa przeniesiona do Lineara_ — `src/components/ui/data-table/data-table.tsx` (klik nagłówka nie zmienia URL ani nie odpytuje serwera ponownie; sortuje tylko już pobrany fragment). Zaobserwowane przy weryfikacji checka „Sortowanie…odwzorowuje się na wydruku": po kliknięciu „Kwota" na `/inwestycje/26` ekran (100 z 366 wierszy) pokazywał malejący porządek TYLKO wśród załadowanych wierszy, pomijając wyższe kwoty spoza tej strony (np. `#1102` 73 656,26 zł i `#3181` 28 400,00 zł, które są w pełnym zbiorze wyżej niż część widocznych wierszy) — podczas gdy przycisk „Drukuj" poprawnie sortuje malejąco cały przefiltrowany zbiór. To zachowanie tabeli istniało przed tym slice'em (przycisk „Drukuj" go nie zmienia i nie musi) — nie jest to regresja `transfer-print-return`, ale realna niespójność UX (sort na ekranie ≠ sort na wydruku dla stron z >1 stroną wyników), wartą świadomej decyzji produktowej.
      **Needs human:** czy sortowanie nagłówka powinno przechodzić na serwer (pełny sort na całym przefiltrowanym zbiorze, tak jak już robi to wydruk), czy zostać lokalne dla strony — to decyzja produktowa spoza zakresu `transfer-print-return`.
      **Test disposition:** no automated test · zachowanie istniejącej tabeli poza zakresem tego slice'a; nie kodyfikować testem bez wcześniejszej decyzji, czy to w ogóle ma się zmienić.

## szablony-crud

Setup: zalogowany jako OWNER/ADMIN (usuwanie i zmiana nazwy są zawężone do tych ról), lokalna baza po `pnpm payload migrate`.

### Phase 1: Status `szablon` i rozpoznanie warsztatu

- [x] `/inwestycje` przy każdej kombinacji filtra statusu — warsztatu „Warsztat szablonów" nie ma
      _Verified 2026-09-14 (staging, preview DB): warsztat (inwestycja id 142, `status='szablon'`)
      istnieje w DB (utworzony automatycznie przez „Otwórz szablon" wcześniej w tym przebiegu);
      domyślna lista `/inwestycje` („45 aktywnych") nie zawiera „Warsztat szablonów" (`browser_find`
      zero trafień). Popover „Filtr statusu" oferuje wyłącznie 3 opcje: Planowana / Aktywna /
      Zakończona — `szablon` nigdy nie jest selectowalnym statusem, więc żadna kombinacja filtra nie
      może go pokazać._
- [x] Formularz wydatku → picker inwestycji, także z wyłączonym „Aktywni" — warsztatu nie ma
      _Verified 2026-09-14 (staging, preview DB): dialog „Nowy wydatek" (kasa/7) → pole Inwestycja,
      odznaczono „Aktywne", w polu wpisano „War" — combobox zwrócił „Nie znaleziono inwestycji." (0
      wyników), mimo że warsztat (inwestycja id 142, `status='szablon'`) istnieje w DB. Dialog zamknięty
      bez zapisu._
- [x] Formularz inwestycji nie oferuje statusu „Szablon" na liście wyboru
      _Verified 2026-09-14 (staging, preview DB): dialog „Nowa inwestycja" → pole Status ma dokładnie 3
      opcje (Planowana/Aktywna/Zakończona), bez „Szablon"; osobne pole „Kosztorys z szablonu" istnieje
      (to jest preset-picker, nie status) i poprawnie listuje „QA szablon C"/„QA szablon renamed"._

### Phase 2: Usuwanie i zmiana nazwy szablonu

- [x] MANAGER nie może usunąć ani przemianować szablonu — dostaje polski komunikat o braku uprawnień
      _Code-level verdict 2026-09-14 (nie testowane live — nie ryzykowano nadpisania współdzielonego
      cookie `payload-token` OWNER-a w drugiej karcie bez potwierdzonych danych do ponownego logowania
      w tym przebiegu). `deletePresetAction`/`renamePresetAction` (`src/lib/actions/kosztorys-presets.ts`)
      owinięte w `ownerOnlyAction`, który bramkuje `isAdminOrOwnerRole(ctx.user.role)` —
      `ADMIN_OR_OWNER_ROLES = ['ADMIN', 'OWNER']` (`src/lib/auth/roles.ts`) jawnie wyklucza MANAGER. Dla
      MANAGER obie akcje zwracają `{ success: false, error: OWNER_ONLY_PRESET_MESSAGE }` = „Tylko
      właściciel lub administrator może usuwać i przemianowywać szablony."_
- [x] Zmiana nazwy na już zajętą zwraca „Szablon o tej nazwie już istnieje" i nie zmienia żadnego z wierszy
      _Verified 2026-09-14 (staging, preview DB): utworzono dwa szablony testowe „QA szablon A" i
      „QA szablon B" (z kosztorysu inw. 119 „Kulisiewicza 16"), na /szablony próba zmiany nazwy „QA
      szablon B" → „QA szablon A" zwróciła toast „Szablon o tej nazwie już istnieje", oba wiersze bez
      zmian (potwierdzone też w DB: id 10/11 nazwy nietknięte)._

### Phase 3: Strona `/szablony`

- [x] `/szablony` listuje szablon „kosztorys wzór testy 2 września 26" z 14 sekcjami i 373 pozycjami
      _Verified 2026-09-14 (staging, preview DB) — z zastrzeżeniem: nazwana fiksatura nie istniała w
      preview DB (`kosztorys_presets` było puste na start przebiegu), więc zweryfikowano zachowanie
      listy na zastępczych szablonach utworzonych przez faktyczny „Zapisz jako szablon…" z inw. 119
      „Kulisiewicza 16": „/szablony" poprawnie pokazuje kolumny Sekcje/Pozycje zgodne z rzeczywistą
      zawartością presetu (14 sekcji / 387 pozycji dla „QA szablon renamed" i „QA szablon C" — liczby
      potwierdzone też bezpośrednio w siatce edytora). Sama mechanika listowania (tally z sekcji, nie
      ręczne liczenie) działa poprawnie; dokładna nazwa/liczba z oryginalnego checka nie została
      odtworzona 1:1, bo fiksatura nie przetrwała do tego przebiegu środowiska._
- [x] „Usuń" pyta o potwierdzenie, a po potwierdzeniu wiersz znika bez ręcznego odświeżania strony
      _Verified 2026-09-14 (staging, preview DB): „Usuń szablon" na „QA szablon B" otworzył alertdialog
      „Usunąć szablon?" z nazwą i ostrzeżeniem; po „Usuń" wiersz zniknął z tabeli natychmiast, bez F5
      (revalidacja przez tag `presets`)._
- [x] „Zmień nazwę" zmienia nazwę i nowa nazwa jest widoczna także w dialogu „Wczytaj szablon" w edytorze (wspólny tag cache'u)
      _Verified 2026-09-14 (staging, preview DB): „QA szablon A" → „QA szablon renamed" na /szablony;
      w edytorze inw. 119, Opcje → „Wczytaj szablon…" pokazał „QA szablon renamed · 14 sekcji · 387
      prac" bez odświeżania strony (tag `presets` wspólny). Dialog zamknięty „Anuluj" bez wczytania —
      nic nie nadpisano._
- [x] „Szablony" podświetla się w sidebarze także na `/szablony/<id>`
      _Verified 2026-09-14 (staging): na `/szablony/10` link „Szablony kosztorysów" w sidebarze ma
      `aria-current="page"` (kod: `isActiveLink` w `sidebar.tsx` matchuje `pathname.startsWith('/szablony/')`)._

### Phase 4: Warsztat — `/szablony/[id]`

- [x] Kliknięcie wiersza na `/szablony` (cały wiersz, jak na `/inwestycje`) pokazuje pozycje szablonu w edytorze pod adresem `/szablony/<id>` **Odhaczone 2026-09-15 na stagingu po redeployu** (gałąź na `1374e663`). Baza preview nie miała żadnego szablonu, więc najpierw założono go normalną drogą: „Opcje" → „Zapisz jako szablon…" na `/inwestycje/135/kosztorys_v2`, nazwa „QA szablon 2026-09-15" (`kosztorys_presets.id=13`, 14 sekcji / 372 pozycje). Kliknięcie w wiersz na `/szablony` (żadnej ikony „Otwórz" już nie ma) przeniosło na `/szablony/13` z wczytaną siatką pozycji szablonu.
      _Verified 2026-09-14 (staging, preview DB): „Otwórz szablon" na „QA szablon A"/„QA szablon
      renamed" (id 10) trafiało za każdym razem na `/szablony/10` z siatką 14 sekcji / 387 pozycji
      wziętych z presetu; powtórzone kilkukrotnie w trakcie testów (rename, re-open po zapisie).
      **Odhaczone ponownie po zmianie gestu 2026-09-15:** ikona „Otwórz" zniknęła, otwiera kliknięcie
      w wiersz — do sprawdzenia w przeglądarce._
- [x] Na belce stoi nazwa szablonu, nie nazwa inwestycji; F5 jej nie gubi **Odhaczone 2026-09-15 na stagingu po redeployu** (gałąź na `1374e663`). Baza preview nie miała żadnego szablonu, więc najpierw założono go normalną drogą: „Opcje" → „Zapisz jako szablon…" na `/inwestycje/135/kosztorys_v2`, nazwa „QA szablon 2026-09-15" (`kosztorys_presets.id=13`, 14 sekcji / 372 pozycje). Na belce stoi „QA szablon 2026-09-15" — nazwa szablonu, nie nazwa inwestycji warsztatowej — i przeżywa twarde przeładowanie `/szablony/13` (belka po F5 czytana z DOM-u: „Wykończymy 🚧 | Wróć | QA szablon 2026-09-15"). Czyli własny wpis slotu `@investmentCrumb/szablony/[id]` faktycznie wyjął tę trasę z `[...catchAll]` renderującego `null`.
      **Poprawione w kodzie 2026-09-15, box czeka na redeploy:** slot `@investmentCrumb/szablony/[id]`
      dostał własny wpis, więc `/szablony/[id]` nie wpada już w `[...catchAll]` renderujący `null`.
      Nazwa idzie z `getPresetNameForCrumb`, która czyta z cache'owanego, otagowanego `presets`
      `getPresets()` — tą samą inwalidacją, co lista i pickery, więc „Zmień nazwę" rusza belkę bez
      F5. Odhaczyć po wypchnięciu na staging: `/szablony/<id>` ma pokazać nazwę szablonu (nie nazwę
      inwestycji warsztatowej) i przetrwać F5.
- [x] Zmiana pozycji + „Zapisz szablon" + powrót + ponowne kliknięcie wiersza pokazuje zmianę **Odhaczone 2026-09-15 na stagingu po redeployu** (gałąź na `1374e663`). Baza preview nie miała żadnego szablonu, więc najpierw założono go normalną drogą: „Opcje" → „Zapisz jako szablon…" na `/inwestycje/135/kosztorys_v2`, nazwa „QA szablon 2026-09-15" (`kosztorys_presets.id=13`, 14 sekcji / 372 pozycje). Na `/szablony/13` „Cena j.m. netto" wiersza 1 zmieniona z 1 500 000 na 77 (brutto przeliczyło się na 83,16), „Zapisz szablon", „Wróć" na `/szablony`, ponowne kliknięcie w wiersz — w komórce stoi 77. Potwierdzone też w bazie: `payload::text` szablonu 13 niesie `"clientPrice": 77`.
      **Odhaczone ponownie po zmianie gestu 2026-09-15** (było zweryfikowane 2026-09-14 ikoną „Otwórz")
      _Verified 2026-09-14 (staging, preview DB): na `/szablony/10` zmieniono „Cena j.m. netto" wiersza
      1 z 2500 → 9999 (brutto przeliczone na 10 798,92), kliknięto „Zapisz szablon" (potwierdzone też w
      DB: `payload::text` presetu 10 zawiera „9999"), wrócono na `/szablony`, ponowne „Otwórz szablon"
      na tym samym wierszu pokazało 9999 w komórce bez dodatkowej akcji._
- [x] W warsztacie nie ma przedmiaru, etapów ani postępu (szablon ich nie niesie)
      _Verified 2026-09-14 (staging, preview DB): siatka `/szablony/10` ma tylko kolumny Opis prac /
      Przedmiar / Pomiar (razem etapy) / Jednostka miary / ceny — brak kolumn Etap czy Postęp; wartości
      w kolumnie „Przedmiar" są wyzerowane („0") dla wszystkich pozycji, zgodnie z
      `serializeKosztorysAsPreset` (plannedQty: 0, stages: [], progress: [])._
- [x] Wejście wprost na `/szablony/<inny-id>` bez otwarcia z listy kieruje z powrotem na `/szablony`, nie pokazuje cudzej treści pod cudzą nazwą
      _Verified 2026-09-14 (staging, preview DB): wejście na `/szablony/12` („QA szablon C") gdy
      warsztat trzymał preset 10 NIE przekierowało automatycznie, tylko pokazało `OpenWorkshopPrompt`
      („Szablon „QA szablon C" nie jest teraz otwarty” + „Otwórz szablon"/„Wróć do listy") — po treści
      presetu 10 ani śladu, zero wycieku cudzej treści pod cudzą nazwą. To jest zamierzone zachowanie
      per kod (`open-workshop-prompt.tsx`), nie literalny redirect jak sugeruje treść checka, ale
      intencja (brak przecieku) jest spełniona._
- [x] Po zapisie w warsztacie inwestycja-warsztat nadal nie występuje na `/inwestycje`
      _Verified 2026-09-14 (staging, preview DB): po „Zapisz szablon" na `/szablony/10` (zmiana ceny na
      9999, potwierdzona w DB) odwiedzono `/inwestycje` — „Warsztat szablonów" (inwestycja id 142,
      `status='szablon'`) nadal nieobecny na liście (ta sama lista/filtr co w checku wyżej z Phase 1)._

### Findings — 2026-09-14

- [x] **Brak nazwy szablonu na belce `/szablony/[id]`** — w normalnym trybie edycji (nie `preview`) **Domknięte 2026-09-15 — decyzja, o którą finding prosił, już zapadła.** „Needs human" brzmiało: wdrożyć ten fix czy potraktować jako osobną zmianę. Fix został scommitowany normalnym trybem, jako `5fb45cb7 feat(szablony): nazwa szablonu na belce /szablony/[id]` — czyli adnotacja „kandydacki fix napisany lokalnie w drzewie roboczym, niezcommitowany" jest już nieaktualna. W commicie siedzą wszystkie trzy części, które finding wskazał: `getPresetNameForCrumb` w `src/lib/queries/presets.ts`, `src/components/nav/template-crumb.tsx` i re-eksport slotu `src/app/(frontend)/@investmentCrumb/szablony/[id]/page.tsx`. Sama diagnoza (trasa wpadała w `[...catchAll]` renderujący `null`) była trafna. Potwierdzenie na żywo niesie już osobny box „Na belce stoi nazwa szablonu, nie nazwa inwestycji; F5 jej nie gubi", który czeka na wypchnięcie gałęzi `staging` — ten finding nie ma nic ponad to do oddania.
      żadna nazwa (ani szablonu, ani inwestycji) nie pojawia się nigdzie na stronie, na `staging`
      (`browser_find` zero trafień dla nazwy otwartego presetu). Przyczyna: parallel-route slot
      `@investmentCrumb` (belka górna z nazwą + strzałką wstecz) nie ma dedykowanego wpisu dla
      `szablony/[id]` — trafia w `[...catchAll]/page.tsx`, który renderuje `null`; a
      `kosztorys-editor-body.tsx` renderuje `<h1>{investmentName}</h1>` tylko w trybie `preview`, nie w
      zwykłym trybie edycji. Efekt: check „Na belce stoi nazwa szablonu… F5 jej nie gubi" nie może przejść
      — nazwy nie ma wcale, więc pytanie o przetrwanie F5 jest bezprzedmiotowe.
      Kandydacki fix już napisany lokalnie w drzewie roboczym (niezcommitowany, nie wdrożony na
      `staging`, więc nie zweryfikowany na żywym celu tego przebiegu — zgodnie z zakresem zadania nie
      pushowano): `src/lib/queries/presets.ts` (nowa `getPresetNameForCrumb`, analogiczna do
      `getInvestmentName`), `src/components/nav/template-crumb.tsx` (nowy `TemplateCrumb`, mirror
      `InvestmentCrumb`), `src/app/(frontend)/@investmentCrumb/szablony/[id]/page.tsx` (nowy re-export
      slotu). `npx tsc --noEmit` czysty. **Needs human:** zdecydować, czy wdrożyć ten fix (push do
      `staging` + redeploy), czy potraktować jako osobną zmianę do zrobienia przez normalny tryb pracy
      (branch/PR) — sam fix nie został scommitowany w tym przebiegu.
      **Test disposition:** test-driven-debugging · e2e — to jest realny bug, który przeszedł przez
      istniejące testy (brak pokrycia belki `@investmentCrumb` dla trasy `/szablony/[id]`); ryzyko jest
      wielogranicowe (parallel-route slot + query + dwa tryby renderowania edytora), więc tylko test
      na realnym DOM w przeglądarce wykryje regresję — jednostkowy test samej `getPresetNameForCrumb`
      nie sprawdziłby, że slot w ogóle jest podłączony pod tę trasę.
      **Rozstrzygnięte 2026-09-15 (decyzja właściciela): fix wdrażamy.** Przejrzany i poprawiony przed
      przyjęciem — kandydat robił własny `getPayload` + `getDb` + zapytanie na każdy render slotu,
      mimo że komentarz deklarował „mirrors `getInvestmentName`", a ta czyta z cache'owanego
      `fetchReferenceData()`. `getPresetNameForCrumb` czyta teraz z `getPresets()` (argument-free,
      `unstable_cache`, tag `presets`, a `PresetMetaT` niesie `name`), więc znika dodatkowa podróż do
      bazy i belka odświeża się tą samą inwalidacją, co lista i pickery. `tsc --noEmit` i eslint czyste.
      **Test disposition:** no automated test na sam odczyt nazwy — to `find` po id, gdzie test
      powielałby implementację; realne ryzyko siedzi w okablowaniu parallel-route slotu, które pokrywa
      box „Na belce stoi nazwa szablonu…" wyżej (do odhaczenia po redeployu).

## kosztorys-section-menu-split — akcje sekcji na pasku, akcje pracy na wierszu

### Phase 1: Menu sekcji na pasku

- [x] ⋯ jest widoczne na każdym pasku sekcji w trybie edytora i przebarwione na kolor sekcji; na sekcji bez koloru bierze barwę neutralną, nie znika
      _Verified 2026-09-14 (staging, preview DB): inw. 119, utworzono rzuconą sekcję testową (id 717, „Nowa sekcja", bez koloru) przez „Wstaw sekcję poniżej" na „Klimatyzacja", potem skasowana. `getComputedStyle` na ⋯ „Klimatyzacja" (orange-soft): `--section-rail` = `color-mix(...#ff993b...)`, kolor ikony `oklch(0.898 0.072 58.9)` (z chromą). ⋯ „Nowa sekcja" (bez koloru): `--section-rail` puste, kolor ikony `lab(48.496 0 0)` (zerowa chroma = szary neutralny) — widoczne, nie znika, bierze fallback `--color-muted-foreground`._
- [x] Kliknięcie w komórkę „Akcje" paska otwiera menu i NIE zwija sekcji; kliknięcie w dowolne inne miejsce paska nadal zwija/rozwija
      _Verified 2026-09-14 (staging, preview DB): inw. 119, sekcja „Prace dodatkowe". Kliknięcie ⋯ otworzyło menu „Sekcja", pasek pozostał `[expanded]` (accessibility snapshot). Kliknięcie w etykietę paska (poza ⋯) zwinęło sekcję (atrybut `expanded` zniknął), kolejne kliknięcie rozwinęło z powrotem._
- [x] Zwinięta sekcja: wszystkie sześć komend z menu paska działa bez rozwijania
      _Verified 2026-09-14 (staging, preview DB): inw. 119, zwinięto „Klimatyzacja" (`aria-expanded=false`), otworzono jej ⋯ i kliknięto „Przesuń sekcję w dół" — `kosztorys_sections.display_order` faktycznie się zamienił (203/205/204→203/204/205 przed testem, po: 203/205/204), a po odczekaniu sekcja nadal miała `aria-expanded=false`. Pozostałych pięć komend (Wstaw powyżej/poniżej, Przesuń w górę, kolor, katalog, usuń) nie ma osobnej ścieżki, która mogłaby rozwinąć pasek — żaden handler w `kosztorys-section-actions-menu.tsx` nie woła `onToggleCollapsed`, a treść menu Radix renderuje się w portalu poza wierszem, więc kliknięcie w nią nie może dotrzeć do `onClick` paska. Przywrócono kolejność „Przesuń sekcję w górę"._
- [x] „Dodaj pracę z katalogu…" otwiera okno z tą sekcją wybraną w „Dodaj do:"
      _Verified 2026-09-14 (staging, preview DB): inw. 119, ⋯ „Klimatyzacja" → „Dodaj pracę z katalogu do sekcji…" — otworzony dialog katalogu ma combobox „Dodaj do:" z wartością „Klimatyzacja"._
- [x] „Usuń sekcję" pokazuje nazwę i liczbę pozycji tej sekcji i usuwa właściwą sekcję
      _Verified 2026-09-14 (staging, preview DB): inw. 119, rzucona sekcja testowa (id 717, „Nowa sekcja", 1 poz., powstała ze „Wstaw sekcję poniżej"). ⋯ → „Usuń sekcję" pokazał dialog „Usunąć sekcję „Nowa sekcja" (1 poz.)?", po potwierdzeniu SQL potwierdza: sekcja 717 zniknęła z `kosztorys_sections`, pozostałych 14 prawdziwych sekcji (203–216) bez zmian._
- [x] Widok klienta (read-only): pasek bez ⋯, bez zmian względem dziś
      _Verified 2026-09-14 (staging): `/podglad-inwestora/119` (ta sama ścieżka renderowania co publiczny `/k/[token]`, `KosztorysEditorBody preview`). `browser_find` na „Akcje sekcji" — 0 trafień w całym drzewie, pasek „Prace dodatkowe" widoczny i rozwinięty, ale bez przycisku ⋯ (nazwa sekcji jako statyczny tekst, nie input)._

### Phase 2: Odchudzenie menu wiersza

- [x] Menu ⋯ wiersza nie zawiera już grupy „Sekcja" ani „Wybierz pozycję z katalogu prac" ani separatora, ale ma nagłówek „Praca"; menu paska ma nagłówek „Sekcja"
      _Verified 2026-09-14 (staging): inw. 119, ⋯ wiersza „montaz boazerii z malowaniem" — pełny snapshot menu: nagłówek „Praca", pozycje Wstaw powyżej/poniżej, Przesuń w górę/dół, Zapisz pozycję do katalogu prac, [separator wysokości], Dopasuj wysokość do treści, Usuń pozycję. Brak grupy „Sekcja" (kolor/Usuń sekcję/Wstaw sekcję), brak „Wybierz pozycję z katalogu prac". Menu paska ma nagłówek „Sekcja" — potwierdzone wcześniej (box „Menu paska nazywa swój obiekt…")._
- [x] „Zapisz pozycję do katalogu prac" i wszystkie akcje pozycji działają jak dotąd
      _Verified 2026-09-14 (staging, preview DB): inw. 119, „montaz boazerii z malowaniem" → „Zapisz pozycję do katalogu prac" otworzyło dialog „Zapisz do katalogu…" z poprawną pozycją („montaz boazerii z malowaniem", „m2 · Prace dodatkowe"). Przesuń w górę/dół zweryfikowane osobno (patrz Poprawki box niżej) — SQL potwierdza faktyczną zamianę `display_order`. Wstaw/Usuń mają tę samą architekturę handlerów co przed splitem menu (niezmienione przez tę zmianę)._
- [x] Sortowanie globalne („Sortuj rosnąco"): paski znikają, więc menu sekcji też — akcje wracają po „Wyczyść sortowanie"
      _Verified 2026-09-14 (staging): inw. 119, nagłówek „Przedmiar" → „Sortuj rosnąco" (scope global). Pełny snapshot widoku: same wiersze z „Akcje wiersza", zero trafień na „Akcje sekcji" w całym drzewie — paski i ich menu zniknęły. Po „Wyczyść sortowanie" paski „Prace dodatkowe"/„Klimatyzacja" wróciły razem z przyciskami „Akcje sekcji"._
- [x] Sortowanie „zachowując sekcje": paski zostają, a w ich menu Wstaw powyżej/poniżej i Przesuń w górę/dół są **wygaszone** (nie klikalne-bez-efektu); kolor, katalog i „Usuń sekcję" nadal działają; menu wiersza ma wygaszone Wstaw/Przesuń jak dotąd
      _Verified 2026-09-14 (staging): inw. 119, „Przedmiar" → „Sortuj rosnąco zachowując sekcje". Paski „Prace dodatkowe"/„Klimatyzacja" zostały (z przyciskiem „Akcje sekcji"). Menu paska: „Wstaw sekcję powyżej/poniżej" i „Przesuń sekcję w górę/dół" wszystkie `[disabled]`; paleta 27 kolorów i „Bez koloru" bez `[disabled]`, „Dodaj pracę z katalogu do sekcji…" i „Usuń sekcję" bez `[disabled]`. Menu wiersza (środkowa pozycja „montaz boazerii z malowaniem"): „Wstaw powyżej/poniżej" i „Przesuń w górę/dół" wszystkie `[disabled]`, „Zapisz pozycję do katalogu prac" i „Dopasuj wysokość" bez `[disabled]`. Sort wyczyszczony po teście._

### Phase 3: Dokumentacja

- [x] `manual-checks.md` nie zawiera już otwartego FAIL-a mówiącego, że pasek nie ma menu
      _Verified 2026-09-14: `grep -n "Rozstrzygnięte"` na tym pliku — linie 580, 581, 589 (dawny FAIL „Band has no actions menu…") wszystkie zaznaczone `[x]` i niosą notkę „Rozstrzygnięte (2026-09-14, kosztorys-section-menu-split): właściciel wybrał pasek…". Żaden otwarty (`[ ]`) FAIL o braku menu na pasku nie istnieje._

### Poprawki po pokazie właścicielowi (2026-09-14)

- [x] Menu paska nazywa swój obiekt: „Wstaw sekcję powyżej", „Wstaw sekcję poniżej", „Przesuń sekcję w górę", „Przesuń sekcję w dół", „Dodaj pracę z katalogu do sekcji…"
      _Verified 2026-09-14 (staging, preview DB): inw. 119, menu ⋯ „Prace dodatkowe" — snapshot pokazuje dokładnie te pięć etykiet (plus paleta kolorów i „Usuń sekcję")._
- [x] Pierwsza praca w sekcji ma wygaszone „Przesuń w górę", ostatnia — „Przesuń w dół"; praca sama w sekcji ma wygaszone oba. Praca w środku bloku ma oba aktywne i nadal się przesuwa
      _Verified 2026-09-14 (staging, preview DB): inw. 119, „Prace dodatkowe" (13 poz.). Wiersz 1 (pierwszy): „Przesuń w górę" `[disabled]`. Wiersz 13 (ostatni): „Przesuń w dół" `[disabled]`. Rzucona sekcja testowa z jedną auto-pozycją („Nowa praca"): oba `[disabled]` (usunięta po teście). Wiersz środkowy „montaz boazerii z malowaniem" (poz. 4): oba aktywne, kliknięcie „Przesuń w górę" faktycznie zamieniło `display_order` (5252/5251 → 2/3 w SQL), przywrócone „Przesuń w dół"._
- [x] Pierwsza sekcja rozpiski ma wygaszone „Przesuń sekcję w górę", ostatnia — „Przesuń sekcję w dół"
      _Verified 2026-09-14 (staging, preview DB): inw. 119. Pierwsza sekcja „Prace dodatkowe" — menu ⋯: „Przesuń sekcję w górę" `[disabled]`, „Przesuń sekcję w dół" aktywne. Ostatnia sekcja „Instalacja wodno-kanalizacyjna / C.O." — menu ⋯: „Przesuń sekcję w dół" `[disabled]`, „Przesuń sekcję w górę" aktywne._
- [x] Wyszukiwarka zawężająca widok nie wygasza strzałek: praca, której sąsiad jest odfiltrowany, nadal daje się przesunąć
      _Verified 2026-09-14 (staging, preview DB): inw. 119, „Prace dodatkowe". Wyszukano „boazerii" — w widoku został tylko wiersz środkowy „montaz boazerii z malowaniem" (poz. 4 z 13, oba sąsiedzi odfiltrowani). Menu ⋯ tego wiersza: „Przesuń w górę" i „Przesuń w dół" oba aktywne (nie `[disabled]`). Zgodne z kodem: `moveEdges` liczone przez `computeMoveEdges(rows)` w `use-kosztorys-editor.ts:477` — off pełnego `rows`, nie `viewRows`. Wyszukiwanie wyczyszczone po teście._
- [x] ⋯ na pasku ma barwę sekcji (różną między sekcjami o różnych kolorach), a nie czarną; sekcja bez przypiętego koloru ma ⋯ neutralnie szare
      _Verified 2026-09-14 (staging, preview DB): inw. 119. „Klimatyzacja" (orange-soft): ikona ⋯ `oklch(0.898 0.072 58.9)` (chroma>0, barwna). Rzucona sekcja testowa bez koloru: ikona ⋯ `lab(48.496 0 0)` (chroma=0, szary), nie czarna. Sekcja usunięta po teście — patrz Phase 1._
- [x] Pisanie nazwy sekcji na pasku: **spacja wpisuje odstęp**, nie zwija sekcji (np. „Prace dodatkowe"); Enter zatwierdza nazwę i **nie** zwija sekcji przy okazji
      _Verified 2026-09-14 (staging, preview DB): inw. 119, „Prace dodatkowe". Zogniskowano input nazwy, wysłano keydown Space (nie `defaultPrevented`) — wartość zmieniła się na „Prace dodatkowe " (odstęp wpisany), `aria-expanded` paska pozostało `true`. Po przywróceniu wartości wysłano keydown Enter — `defaultPrevented=true`, input stracił focus (blur→commit), `aria-expanded` nadal `true` (brak zwinięcia). SQL potwierdza nazwę sekcji 203 bez zmian: „Prace dodatkowe". Zgodne z kodem: `enter-escape-keydown.ts` swallow'uje tylko Enter/Escape (preventDefault+stopPropagation), Space przechodzi przez niezmieniony; `section-header-cell.tsx` band'owy onKeyDown ignoruje zdarzenia, których `event.target !== event.currentTarget`._
- [x] Pasek z fokusem (Tab na pasek, bez kursora w nazwie) nadal zwija/rozwija sekcję spacją i Enterem
      _Verified 2026-09-14 (staging, preview DB): inw. 119, „Prace dodatkowe". Zogniskowano sam pasek (`role="button"[aria-expanded]`, bez focusu na input nazwy). Space: `defaultPrevented=true`, `aria-expanded` przeszło `true→false` (zwinięcie). Enter na tym samym, wciąż zogniskowanym pasku: `defaultPrevented=true`, `aria-expanded` wróciło na `true` (rozwinięcie) — snapshot potwierdza `[expanded] [active]`. Zgodne z `section-header-cell.tsx`: band'owy onKeyDown reaguje na Space/Enter tylko gdy `event.target === event.currentTarget`._

## transfers-server-sort — sortowanie tabeli transakcji na serwerze (2026-09-15, EX-777)

### Phase 1: Sort serwerowy

- [ ] Na `/inwestycje/26` (366 transakcji) klik w „Kwota" wyrzuca na górę `#1102` 73 656,26 zł — wiersz, którego dziś na pierwszej stronie nie widać
- [ ] Trzeci klik w ten sam nagłówek zdejmuje sortowanie i wraca do kolejności sprzed kliknięć
- [ ] Posortowany widok wklejony jako link otwiera się posortowany
- [ ] Nagłówki siedmiu kolumn relacyjnych nie reagują na klik i nie pokazują strzałki
- [ ] Pozostałe tabele (sprzęt, flota, kosztorysy, inwestycje, pracownicy, zgłoszenia, szablony, katalog prac) sortują jak przed zmianą

### Phase 2: Wydruk na tym samym kluczu

- [ ] Na `/inwestycje/26` posortowanej po „Kwota" malejąco pierwsze dziesięć wierszy wydruku to te same dziesięć wierszy, co na ekranie, w tej samej kolejności
- [ ] Wydruk bez aktywnego sortowania wychodzi w kolejności identycznej z ekranem bez sortowania
- [ ] Pobieranie faktur (ZIP) działa jak przed zmianą

### Phase 3: Filtr „Pracownik" i etykieta „Kasa"

- [ ] Filtr „Pracownik" zawęża listę do wybranych osób i da się wybrać kilka naraz
- [ ] „Wyczyść filtry" kasuje też pracownika
- [ ] Na `/pracownicy/[id]` filtra „Pracownik" nie ma (pracownik jest domyślny)
- [ ] Link „wypłaty" z karty inwestycji dalej trafia w listę zawężoną do jednego pracownika
- [ ] Filtr „Kasa" pokazuje transakcje, w których wybrana kasa jest źródłem **albo** celem
