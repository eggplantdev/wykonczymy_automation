# Review-gate ledger — desktop-regression-audit · 2026-10-19

## Preflight

- **Target: deployed staging**, not :3010/5435 (user, 2026-10-19: the pass checks the deployed app).
  - URL `https://wykonczymy-git-staging-wykonczymys-projects.vercel.app`, Vercel SSO session in the MCP
    browser; preview DB (`DB_POSTGRES_URL_PREVIEW`).
  - Deployed sha `9d7572296` (Vercel `success`). Local `staging` is 2 ahead and unpushed: `9e046f8ce`
    (worker column width) and the plan commit — `9e046f8ce` is not on the deployed app.
  - Preview DB was behind: `20261019_0_big_bag_order` (additive) applied with `pnpm db:migrate:preview`
    — `users.phone does not exist` broke every `users` read.
- **Accounts** (`pnpm qa:staging-user`, one password `STAGING_QA_PASSWORD` from `.env`):
  - OWNER `qa-staging@wykonczymy.test` (id 75)
  - MANAGER `qa-staging-manager@wykonczymy.test` (id 76)
  - EMPLOYEE `qa-staging-worker@wykonczymy.test` (id 77)
  - ADMIN: none. The profile forbids minting accounts on the preview DB; every role branch is
    `isAdminOrOwnerRole`, so ADMIN cells resolve on the OWNER pass.
- **Fixes** land as local commits; they reach staging only when the user pushes.
- **Known noise:** `[ERROR] … status of 400` on page load = `vercel.live` toolbar preflight.
- **State created on the preview DB:**
  - Worker expense draft by EMPLOYEE 77 on „QA EX-855 Inwestycja” (210), note „QA audyt desktop 19.10”, blank PNG.
  - Payout #5967 by MANAGER 76 to EMPLOYEE 77, 7 zł, „QA EX-855 Inwestycja” / „QA EX-855 Kasa”, note
    „QA audyt desktop 19.10 wypłata” — rejected by 77, then confirmed from „Odrzucone wypłaty”.
  - Payout #5968 by OWNER 75 to EMPLOYEE 77, 5 zł, same investment/kasa, note „QA audyt desktop 19.10
    wypłata właściciela” — rejected by 77, cancelled by MANAGER 76 (kasa 48: 864,91 → 869,91 zł).
  - #5970 / #5971 by MANAGER 76, „Inny wydatek” 2 zł (big bag, worker 77) and 3 zł („inne”), same
    investment/kasa, notes „QA audyt desktop 19.10 big bag” / „… inne”.
  - Kosztorys v2 of 210: section 2597 „Nowa sekcja” (0 poz.) added by MANAGER 76 for the rename
    check, then deleted through „Usuń sekcję” — 12 sections, none else touched (checked by query).
- **Share tokens:**
  - Worker report link (EMPLOYEE 77 × investment 210):
    `/z/QA-EX-855-Inwestycja/Staging-QA-Pracownik/qBkjwA318v67MBD8pmffU2p-aFye8mtW`

## Matrix

Values: `pending` / `ok` / `finding #n` / `blocked` / `n/a`.

| #   | Route                           | EMPLOYEE | MANAGER | OWNER | ADMIN |
| --- | ------------------------------- | -------- | ------- | ----- | ----- |
| 1   | `/inwestycje/[id]/kosztorys`    | ok       | ok      | ok    | n/a   |
| 2   | `/inwestycje/[id]/kosztorys_v2` | ok       | ok      | ok    | n/a   |
| 3   | `/inwestycje/[id]`              | ok       | ok      | ok    | n/a   |
| 4   | `/` (transakcje)                | ok       | ok      | ok    | n/a   |
| 5   | `/pracownicy/[id]`              | ok       | ok      | ok    | n/a   |
| 6   | `/kasa/[id]`                    | ok       | ok      | ok    | —     |
| 7   | `/kasy`                         | ok       | ok      | ok    | —     |
| 8   | `/inwestycje`                   | ok       | ok      | ok    | —     |
| 9   | `/zgloszenia-wydatkow`          | ok       | ok      | ok    | —     |
| 10  | `/zgloszenia-prac`              | ok       | ok      | ok    | —     |
| 11  | `/pracownicy`                   | ok       | ok      | ok    | n/a   |
| 12  | `/kosztorysy`                   | ok       | ok      | ok    | —     |
| 13  | `/katalog-prac`                 | ok       | ok      | ok    | —     |
| 14  | `/szablony`, `/szablony/[id]`   | ok       | ok      | ok    | —     |
| 15  | `/zgloszenia` (leads)           | ok       | ok      | ok    | n/a   |
| 16  | `/flota`, `/flota/[id]`         | ok       | ok      | ok    | —     |
| 17  | `/sprzet`, `/sprzet/[id]`       | ok       | ok      | ok    | —     |
| 18  | `/kosz`                         | ok       | ok      | ok    | n/a   |
| 19  | `/warianty-badge`               | ok       | —       | ok    | —     |
| 20  | `[...catchAll]`                 | ok       | —       | ok    | —     |
| L   | logged-out + share routes       | ok       | n/a     | n/a   | n/a   |

EMPLOYEE notes (1280 + 1024, staging `9d7572296`):

- Every management route (rows 1–4, 6–18, plus `/szablony/1`, `/flota/1`, `/sprzet/1`) redirects to
  `/pracownicy/77`; `/kasa/1` and own `/kasa/50` too (registry L1317, L1459). Another worker's page and
  an unknown URL show „Nie znaleziono” inside the shell. `/warianty-badge` does not open (L1564).
- Empty sidebar nav is intended (`navigation.tsx` gated on `isManagementRole` since 2026-02).
- Row 5 OK so far: „Wydatek” send, „Potwierdzenie” filter (1 / 4 / 1, L1497), report-history „Status”
  filter, pagination, card view without „Pracownik” (L1550), `uk` switch: all copy translated, dates
  `dd.MM.yyyy, HH:mm` (L1372).
- Payouts (#5967, #5968): cards, green/red outlined buttons filling on hover, reject with reason →
  „Odrzucone wypłaty” with „Powód odrzucenia: …” and only „Potwierdzam”, which still confirms
  (L1474, L1479, L1537, L1539; uk/ru strings checked in the dictionaries).

MANAGER notes (1280, staging `9d7572296`):

- „Edytuj”/„Anuluj” on `/`: active on own rows (#5967); on others' accepted payouts and expenses „Edytuj”
  is disabled and „Anuluj” absent — `canMutateTransfer` ownership rule, not a defect (L1531; the
  others'-pending and others'-robocizna halves confirmed in `canCancelTransfer`/`canMutateTransfer`, no
  such row on staging at check time).
- Others' rejected payout #5968: only „Anuluj” in „Odrzucone wypłaty”, no edit; cancel needs a reason
  and returns the amount to the kasa (L1528, L1533).
- Row 4 also: sort/pagination keep the URL, column menu, card/table toggle, edit dialog validates
  „NIP sprzedawcy” and saves, second-row selects per type, „Brak faktury” confirm on an investment
  expense without a file (L1596), Admin button in the sidebar, `/wyplaty` → 404.
- Row 2 (210, 1280 + 1024): summary tabs without „Marża” (`financials` gate, same at `c713fa2bf`);
  section nets and every other summary table visible — see L1413 doubt below. Pie legends in %, cost
  pie tooltip in %, section pie tooltip in zł (same at baseline) (L1300). Action menus and dialogs
  open (L1409); „Rozlicz wypłaty” validates under the field (half of L1450); section dot matches the
  band (L1561). Section band rename: double-click opens it, Enter saves, Escape restores (L937 partial —
  the „Sekcja” column variant is hidden in this view). Add + delete section persist (part of L1345).
- Row 3 (210, 1280 + 1024, no horizontal overflow): „Wróć” from the list and from a direct URL lands on
  `/inwestycje`; AI-stage select colours; „Kierownik budowy” persists, address intact; note edit saves,
  address intact (note restored afterwards). Order dialog: investment subtitle, „Kwota” recalculates
  (3 × 799,99 = 2399,97), big bag / kontener resets to the settings price, controls 36 px, no gear for
  MANAGER, `0,001` / `1e3` disable „Dalej”; order button on active rows of `/inwestycje`, none on
  completed. Supplier-in-step-1, SMS-on-save and default-kasa boxes are `na` — `8f2b923d2`,
  `442325fe3`, `a9fafe7ab` aren't deployed (staging at `9d7572296`). „Kontakt na miejscu” is empty (no
  worker with a phone), so the contact-star box stays open. Select chevrons → finding L1620 below.
- Row 1 (193 v1 sheet, 1280 + 1024): page and „Arkusz” embed render; only the docs.google.com 401 noise.
- Row 5 (`/pracownicy/77`, 1280 + 1024): worker page with reports, payouts and register summary; no
  horizontal overflow beyond the known „Zgłoszone wydatki” table scroll.
- Row 6: worker register 50 and QA register 48 open with balance and transfer list; the main register
  shows „Nie znaleziono” (L1325).
- Row 7: status toggle and trash only on worker/own registers (L1317, L1320); „Dodaj” with a worker owner
  and „Nie zamykaj po zapisaniu” creates the register and keeps the dialog open; own-manager owner on
  edit persists, another manager → „Brak uprawnień”; `/kosz` lists the temp register, then deleted for
  good with the typed name (DB row gone). Types read „Pomocnicze” / „Pracownicze” / „Wirtualne”; no Typ
  field for MANAGER by design (L1338 form/chart half → OWNER). After a refused save the reopened dialog
  lost „Nie zamykaj…” → fixed, see Findings.
- Row 8 (1280 + 1024, no overflow): status pointer in the table and in „Edytuj inwestycję” (L1463 hover
  half); order button active/completed and „column does not exist” already covered under row 3.
- Rows 9, 10 (1280 + 1024): lists, filters and the „Zweryfikuj” dialog of a zgłoszenie wydatku open;
  nav labels match the headings.
- Row 11 (1280 + 1024): „Edytuj pracownika” → clearing „Telefon” persists (L1600; QA worker 77 left
  with phone empty, active); „Dodaj pracownika” creates a worker with „Polski” (stored as no language,
  L1398); „Usuń pracownika” → `/kosz` → „Usuń na zawsze” with the typed name removes it (temp worker
  gone, DB count 0). Status badge → see the doubt below.
- Row 12 (1280 + 1024): „Kosztorysy” and „Inwestycje bez arkusza” render and search; „Problemy” →
  „Porównaj z katalogiem…” opens with matches and the empty state. The „może chodzi o…” hint and the
  „Importuj z arkusza” preview were not reached, so that box stays open.
- Row 13 (1280): list, search and filters; no repeating requests in the network tab, no flicker (L1448
  table half).
- Row 14 (1280 + 1024): list and template editor open; the template has no „Filtry” at all
  (`KosztorysFiltersMenu` returns null without options) — L843 waits on the owner's ruling, see the doubt
  below. The ~1000-item box needs a large template (none on preview).
- Row 15 (1280): leads list, photo and row selection, „Załączniki” dialog, wide „Szczegóły” with sharp
  thumbnails, „Skontaktowano”/„Oczekuje” toggle (toggled on a lead and restored, DB `new`). No shots in
  the report — the list carries real people's data. L318 needs a Facebook lead with files.
- Rows 16, 17 (1280 + 1024): `/flota`, `/flota/3`, `/sprzet`, `/sprzet/1` render, no overflow;
  recipient cards are read-only for MANAGER (no „Edytuj listę”) — the editor half of L1611 is OWNER.
- Row 18 (1280 + 1024, no overflow): investment „Usuń na zawsze” dialog lists what goes with it and keeps
  the button disabled until the exact name (opened and cancelled on a real row). Temp template „QA tmp
  szablon kosz”: created, „Przenieś do kosza” → listed under „Szablony” in `/kosz` → typed name, partial
  name keeps the button disabled → gone after reload and from the DB. The lead half of L1139 stays open
  (no lead in the Kosz). Cron boxes (L1451, L244, L251, L268, L270, L1129, L1133) and L1142 are left
  open: firing `cleanup` on preview purges every expired row there — not done without a go.

OWNER notes (OWNER 75 stands in for ADMIN, 1280 + 1024, staging `9d7572296`):

- Sweep: all 20 routes at 1280 and 1024, no horizontal overflow, console only the known noise.
- Row 4: „Wydatek” lists „Premia”, „Wpłata” lists „Zasilenie z konta firmowego”; BONUS (#5979, 1 zł)
  and COMPANY_FUNDING (+2 zł, kasa 854,91 → 856,91) book; add / edit / cancel move the kasa balance
  without a reload (L1354); delete of an expense with an invoice drops the file from the list (L1355);
  edit dialog reset + „Rozlicz wypłaty” save (L1370); sort and filters survive reload; „Potwierdzenie”
  filter; „Wypłaty odrzucone przez pracowników” collapses, links, reject and cancel work (L1516).
- Row 7: status toggle persists after reload (L1316); trash on a kasa with 19 transactions is refused
  with the count (toast); „Dodaj kasę” with a MANAGER owner and type „Wirtualne”, edit to a worker owner
  — both save (L1558); OWNER form has „Typ” with the four types (L1338 form half).
- Row 3: order settings (gear) → two suppliers, new price, default supplier → price updates in the
  dialog, quantity and contact kept (L1581, L1591); order saved, „Czeka” → „Dostarczone” → back,
  cancelled order's badge grey and inert (L1604, L1606); contact star sets „Kierownik budowy” (L1594);
  finish → date shown, unlock (L1441 first half); „Kosztorys”, „Umowa”, „Marża” open (L1376);
  „Zapisz jako domyślną kasę” persists (L1600 area). The order save opened the Mac's Messages with the
  SMS body — expected handoff; no further orders saved.
- Row 11: own account deactivation refused; „Rozlicz wypłaty” + payout; last-OWNER and inactive-login
  halves not run (no second OWNER to spare, would lock a real account).
- Row 9: accept / reopen / reject of a zgłoszenie wydatku, counter updates without reload; merge refused
  with a toast for mismatched drafts — successful merge needs two fresh drafts (not run).
- Row 2: cell edit, undo, reload persists, restored (Etap 1 of 210 back to 2). Import / sync preview
  (L1349), ~1000-item (L1401) and the history / offer switch (L1405) not run.
- Row 14: new template „QA audyt szablon” (id 6) with a section and two catalogue items persists;
  „Wstaw poniżej” not saved.
- Rows 16, 17: recipient cards „Edytuj listę” save and restore (L1611); vehicle duplicate shows the
  „istnieje” / „w Koszu” toasts (equipment-serial and worker-email variants not run).
- Work-report preview dialog opens. Left open: L318, L1412 half, L1523 (`/uzytkownicy` is no route),
  L222, the pulpit Typ-label chart, „Katalog prac” filter persistence, every cron stand-in, L1609, L1610,
  L1612 (phone).
- **Preview DB state left by stage B:** order settings (big bag 850, suppliers A/B, default B); worker 77
  phone 500100400; kasa 48 as default-kasa preference; cancelled #5972–#5975, #5977; BONUS #5979 (active);
  COMPANY_FUNDING +2 zł; template id 6 „QA audyt szablon”.

Stage C notes (logged out unless noted, 1280 + 1024, staging `9d7572296`):

- `/zaloguj`, „Nie pamiętam hasła” (sends, shows the confirmation), a protected route → `/zaloguj`,
  legal pages: render, no overflow (L1402). Login after the redirect lands on `/`, not the original URL —
  `src/proxy.ts` passes no return URL, same before the refactor.
- `/z/<worker link>` and `/k/<investor link>` (link generated now for 210) render the QA investment only,
  light and dark; `/podglad-pracownika/77/210` and `/podglad-inwestora/210` open for OWNER and redirect
  to `/zaloguj` without a session.
- Retired `/p/*` and `/zgloszenie-prac/*` show the custom expired-link page (PL/UK/RU); `/k/<bad token>` shows
  Next's default 404 — the share layout has no `not-found`, same at `c713fa2bf`.
- Work-report preview (OWNER): section names on green and purple sections take the section tint, dark
  text in light mode and light text in dark mode (L1544); a rozpiska line with no kosztorys item has a
  gray name, which is the no-section fallback.
- **Preview DB state left by stage C:** a `kosztorys_shares` row for investment 210 (investor link).

## Findings

<!-- [box] · category (regression|layout|doubtful) · disposition · route · role · width · what — reason
     regressions carry a `test:` sub-line -->

- [x] · layout · dismissed · `/pracownicy/77` · EMPLOYEE · 1280 · „Zgłoszone wydatki” table is 1283 px in a
      958 px `overflow-x:auto` box — „Decyzja”, „Transakcje” and actions need a sideways scroll — column
      min-widths are deliberate (`50796e2ec`); in-container scroll is the data-table pattern.
- [x] · layout · fixed · `/inwestycje/210` · MANAGER · 1280 · „Etap AI” and „Kierownik budowy” select
      arrows are foreground-black, not the „Notatki” gray (L1620) — `37706f5eb` muted `SelectTrigger`'s
      chevron but missed `SelectButtonTrigger` (`src/components/ui/select.tsx`); same class added there (`c7c47299f`).
- [x] · bug (pre-existing) · fixed · `/kasy` „Dodaj” · MANAGER · 1280 · after a refused save the dialog
      reopens without „Nie zamykaj po zapisaniu” — the optimistic path closes the dialog
      (`closeDialog` drops `showKeepOpen`, `3723589e9`, 30.09) and the failure reopen never restored it;
      not a refactor regression. `submitOptimistically` now restores it (`10cd3cbfa`).
      test: test-driven-debugging · unit — `optimistic-form-store.test.ts` „a failed submit reopens with
      the keep-open checkbox…”; green (17/17).
- [ ] · doubtful · open · `/inwestycje/210/kosztorys_v2` · MANAGER · 1280 · registry L1413 says the
      MANAGER editor shows no amounts, but it shows section nets and all summary tables; only „Marża”
      is hidden — identical at `c713fa2bf`. Likely stale box wording — ask the user at stage close.
- [ ] · doubtful · open · `/pracownicy` · MANAGER · 1280 · the „Aktywny/Nieaktywny” badge is clickable on
      OWNER/MANAGER rows too; the server refuses with „Kierownik może zmieniać tylko konta pracowników.”
      — no UI gate at `c713fa2bf` either (`/kasy` hides it instead). Not a regression — ask the user.
- [ ] · doubtful · open · `/szablony/[id]` · MANAGER · 1280 · registry L843 expects „Filtry” in the
      template like in the kosztorys; the template shows none (`KosztorysFiltersMenu` returns null with no
      filter options) — same at `c713fa2bf`. Box or menu: ask the user.

## Manual checks

251 open boxes in `context/foundation/manual-checks.md`, each assigned once (line refs = registry lines at triage time).

| Bucket                                             | Boxes |
| -------------------------------------------------- | ----- |
| Stage A (EMPLOYEE + MANAGER cells)                 | 148   |
| Stage B (OWNER cells)                              | 31    |
| Stage C (row L)                                    | 2     |
| ai? (in scope only if AI answers on the first try) | 11    |
| out: phone / PWA / push                            | 23    |
| out: Safari / WebKit                               | 11    |
| out: real mail / SMS / Sheets write / production   | 12    |
| out: dev tooling with no UI                        | 13    |

Source: `context/foundation/manual-checks.md` (251 open boxes). Rows = Route × role matrix in `context/changes/2026-10-19-desktop-regression-audit/plan.md`; `L` = logged-out/share routes.

Notes:

- **Row 1 vs row 2:** `/inwestycje/[id]/kosztorys` (row 1) is the v1 Google-Sheet iframe; the kosztorys editor is `/kosztorys_v2` (row 2) — every editor box sits in row 2. MANAGER sees the editor without the Marża tab (financials gated `isAdminOrOwnerRole`), so Marża boxes are OWNER.
- No ADMIN account: ADMIN-only boxes land on OWNER; a box naming ADMIN and MANAGER lands on MANAGER.
- `390vp` = runnable in desktop Chromium resized to 390 px; real-device-only boxes (touch, install, iOS, push) are out.
- `print:` = needs the native print dialog or paper; stub `window.print` / `page.pdf` covers part, the rest likely stays human.
- `cron stand-in` = fire `/api/cron/<name>` from a logged-in page with Bearer CRON_SECRET; writes to the preview DB.
- `misfit` = no listed out-reason fits cleanly; the closest one is used.
- Multi-route boxes go to the first named route; `also N` lists the rest.
- `app-audit-refactor` boxes (L1294–L1459) come first in each cell.

### cell 2/MANAGER (37)

- app-audit-refactor faza 1 — przeniesione komponenty wyglądają i działa · L1300 · Inwestycja z kosztorysem → podsumowanie kosztorysu: wykresy kołowe (koszty i „Udział sekcji w kosztach robocizny”) pokazują procenty w lege… _[section: ADMIN then MANAGER]_
- app-audit-refactor faza 4 — zgłoszenia wydatków, raporty prac, edytor · L1345 · Jako ADMIN i jako MANAGER w edytorze kosztorysu: dodaj, zmień nazwę i usuń dział, dodaj pozycję na końcu działu i pod wskazaną pozycją, zmi… _[names ADMIN and MANAGER — repeat at 2/OWNER]_
- app-audit-refactor faza 6 — porządki w komponentach · L1379 · Raport pracownika (kosztorys) → menu kolumn: zaznaczanie pozycji nie zamyka menu.
- app-audit-refactor faza 8 — edytor kosztorysu rozbity na części · L1407 · Pusty kosztorys pokazuje „Kosztorys jest pusty” z przyciskiem „Pobierz z arkusza Google…”; wyszukiwanie bez wyników pokazuje „Wyczyść wyszu… _[needs an empty kosztorys]_
- app-audit-refactor faza 8 — edytor kosztorysu rozbity na części · L1409 · Menu akcji kosztorysu: zapis presetu, porównanie z arkuszem, skan raportu, uzupełnienie tłumaczeń, czyszczenie tekstów pozycji, akcje praco…
- app-audit-refactor faza 8 — edytor kosztorysu rozbity na części · L1411 · Wysokość wierszy: przeciągnięcie krawędzi wiersza, dwuklik „dopasuj do treści” i przełączenie rozmiaru tekstu zmieniają wysokość jak wcześn…
- app-audit-refactor faza 8 — edytor kosztorysu rozbity na części · L1413 · Jako MANAGER ten sam edytor nie pokazuje kwot.
- app-audit-refactor — preview brancha vs staging (luki z listy ryzyk) · L1435 · Edytor: wpisz liczbę, od razu wklej kilka komórek, cofnij i ponów — każda wartość ląduje w swoim wierszu, cofnięcie przywraca dokładnie sta…
- app-audit-refactor — preview brancha vs staging (luki z listy ryzyk) · L1437 · Edytor otwarty w dwóch kartach: usuń pozycję w jednej, edytuj ją w drugiej — komunikat, że pozycji nie ma, bez błędu serwera. _[two tabs]_
- app-audit-refactor — poprawki z bramki przeglądu · L1457 · Pusty kosztorys w edytorze: widać podpowiedź na pustej siatce; w wypełnionym wpisanie wartości i cofnięcie błędnej zmiany działa jak wcześn…
- Phase 3: Dialog, menu item and print wiring · L179 · „Generuj" otwiera okno druku z logo; PDF zgadza się z przyciętym wzorem (bez stopki denwi, bez „Reprezentowany przez", bez pkt 7). _[print: stub window.print; owner's template PDF is outside the repo]_
- kosztorys-stage-worker-split — kilku pracowników na etap (2026-09-30) · L233 · Etap sprzed zmiany z jednym przypisanym pracownikiem: po wdrożeniu nagłówek pokazuje tę samą osobę bez „+N", a jej należne i wypłaty się ni… _[needs a pre-2026-09-30 single-worker stage in the fresh prod dump]_
- podsumowanie-pracownika-tabele · L258 · PDF pracownika z długą listą wypłat (kilkadziesiąt) → tabela, która nie mieści się na stronie, przechodzi na następną sama, a tabele nad ni… _[print: stubbed print + headless page.pdf; needs worker with dozens of payouts]_
- worker-form-mirrors-link — kartka do wypełnienia jak „Zgłaszam pracę”, · L295 · Ta sama kartka wydrukowana na papierze: linie tabeli, nagłówki kolumn i jednostki są wyraźnie widoczne; szare tło mają tylko Nr, Wykonano i… _[print: physical paper — likely stays human]_
- worker-form-mirrors-link — kartka do wypełnienia jak „Zgłaszam pracę”, · L297 · Wydrukuj kosztorys dla klienta i PDF pracownika: linie i szare podpisy też są widoczne na papierze, kolumny dalej w paski jak wcześniej. _[print: physical paper — likely stays human]_
- kosztorys-przedmiar-aktualny — „Aktualizacja przedmiaru” obok „Przedmi · L344 · Pracownik, któremu wcześniej odznaczono „Przedmiar” w ustawieniach widoku pracownika → po zmianie „Aktualizacja przedmiaru” nadal jest u ni… _[needs legacy plannedQty key in the worker-view global]_
- stage-column-picker — ukrywanie pojedynczych etapów w „Kolumny” · L442 · Z włączonym „Ukryj zakończone” oznacz w nagłówku etapu „Etap zakończony”: etap od razu znika z tabeli; odznacz — wraca. _[open product question from pass 3/7]_
- mobile-table-font — 12px w tabelach i kosztorysie na telefonie · L463 · Telefon → kosztorys: opis prac, ilości, „Razem” sekcji i pasek sekcji mniejsze; opis zawija się całymi liniami, a „…” pojawia się tylko prz… _[390vp]_
- review-gate-fixes — poprawki z przeglądu commitów z 13.10 · L471 · Kosztorys na telefonie (390px) → komórka z uciętym tekstem: „…" stoi w linii ostatniego wiersza tekstu, nie nad nim ani pod nim. _[390vp]_
- percent-one-decimal — procent z jednym miejscem po przecinku, bez „,0” · L481 · Wydruk kosztorysu z kolumną „% wykonania”: procenty jak w siatce („33,3%”, „75%”). _[print: stub window.print]_
- kosztorys-editor-text-size — wielkość czcionki w edytorze kosztorysu · L506 · Pusty kosztorys (bez pozycji) przy „Bardzo mała”, potem dodanie pozycji z długim opisem przy włączonym „Dopasuj wysokość do treści”: wiersz… _[needs an empty kosztorys]_
- kosztorys-ai-rounds — kolejne rundy AI: „Nowe informacje” i „Do ponown · L532 · Kosztorys AI → „Zapisz jako szablon”, potem ten szablon na innej inwestycji: zastosowane pozycje nie mają „Komentarza AI” ani „Nowych infor… _[needs an AI kosztorys + second investment]_
- kosztorys-ai-rounds — kolejne rundy AI: „Nowe informacje” i „Do ponown · L536 · Kosztorys AI z „Komentarzem AI” → przywrócenie wcześniejszej wersji: „Komentarz AI” zostaje, żadna pozycja nie pokazuje „Do ponownego spraw… _[restore overwrites a real kosztorys on preview]_
- kosztorys-ai-rounds — kolejne rundy AI: „Nowe informacje” i „Do ponown · L546 · Pozycja z flagą i jednolinijkową treścią → „Dopasuj wysokość”: wiersz zostaje na dwóch liniach, etykieta „Do ponownego sprawdzenia” się mie… _[needs one-line flagged item fixture]_
- kosztorys-ai-rounds — kolejne rundy AI: „Nowe informacje” i „Do ponown · L550 · Pozycja z wczytaną rundą: „Nowe informacje” wyglądają dokładnie jak „Komentarz AI” — etykieta zwykłą czcionką, odpowiedź pogrubiona, odstęp… _[needs a round-2 item with „Nowe informacje”]_
- backlog-fixes-14 — poprawki z backlogu: odrzucenie w zgłoszeniu, zapis · L564 · ten sam kosztorys w dwóch kartach. W karcie A „Zgłoszenia prac” → zgłoszenie → przy jednej pozycji tylko „Odrzuć” → zapisz. Przejdź do kart… _[two tabs; needs a pending work report]_
- backlog-fixes-14 — poprawki z backlogu: odrzucenie w zgłoszeniu, zapis · L569 · to samo z „Przyjmij” jednej pozycji zamiast „Odrzuć” — karta B **pokazuje** ten komunikat i ilość w etapie. _[two tabs; needs a pending work report]_
- backlog-fixes-14 — poprawki z backlogu: odrzucenie w zgłoszeniu, zapis · L572 · tak samo — świeża zmiana w komórce, od razu „Wyczyść kosztorys”, „Wczytaj z szablonu”, import z arkusza i „Ustaw kolejność”: każda kończy s… _[two tabs; „Wyczyść”/template/import overwrite a real kosztorys]_
- remount-latch-disarm — przerwane „Wyczyść” nie przebudowuje edytora pr · L598 · Jak wyżej, ale po powrocie Online od razu wpisz wartość w komórkę i w ciągu pół sekundy dodaj pozycję: wpisana wartość zostaje po odświeżen… _[offline emulation; overwrites a real kosztorys]_
- remount-latch-disarm — przerwane „Wyczyść” nie przebudowuje edytora pr · L602 · „Wersje” → przywróć wcześniejszą wersję (z siecią): siatka przebudowuje się na przywróconą wersję, jak dotąd. _[restore overwrites a real kosztorys]_
- staging-sweep-review — siatka kosztorysu po odmowie „Ustaw kolejność” · L643 · Kosztorys → „Importuj z arkusza” i „Ustaw kolejność” działają jak wcześniej (porządki bez zmiany zachowania): import podmienia pozycje, kol… _[import needs a sheet readable by the staging SA]_
- filters-tick-to-show — „Filtry” zaznaczasz to, co chcesz widzieć · L898 · Kosztorys, szablon → „Filtry”: bez „Wyczyść filtry”. Przy czymkolwiek zaznaczonym na górze jest „Wyczyść” — odhacza tylko opcje tego menu (… _[also 14]_
- enter-escape-keydown — Enter/Escape w polu komórki nie trafia już do s · L937 · Nazwa sekcji: zmień ją i **Enter** — zapis i zejście o wiersz; zmień ponownie i **Escape** — stara nazwa wraca, zaznaczenie zostaje w miejs…
- mobile-375-qa — poprawki widoków na telefonie (375 px) · L1230 · Telefon → raporty pracowników: „Skanuj raport (AI)” mieści się w ekranie na pełną szerokość; katalog prac → „Uzupełnij tłumaczenia (AI)” ta… _[390vp; also 13]_
- slice-review-gate — właściciel kasy, kolory kwot, odrzucone wypłaty · L1561 · Kosztorys → nagłówek sekcji: kropka ma kolor paska sekcji.
- investment-notes-save — zapis notatki nie czyści adresu inwestycji · L1571 · Ta sama zmiana notatki z zakładki inwestycji w podsumowaniu kosztorysu: zapis działa, adres zostaje.
- EX-1118 — user-register-stats — „Moje Kasy” po właścicielu kasy, nie p · L1626 · Edytor kosztorysu → podsumowanie → „Podwykonawcy” (inwestycja z wypłatą dla podwykonawcy): sekcja nad tabelą wypłat nazywa się „Lista wypła… _[needs a subcontractor payout]_

### cell 2/OWNER (5)

- app-audit-refactor faza 4 — zgłoszenia wydatków, raporty prac, edytor · L1349 · Jako ADMIN w edytorze kosztorysu: podgląd importu z arkusza i podgląd synchronizacji materiałów pokazują to samo co dotąd.
- app-audit-refactor faza 8 — edytor kosztorysu rozbity na części · L1401 · Jako ADMIN na dużym kosztorysie (~1000 pozycji): pisanie w komórce, cofnij/ponów wklejenie kilku komórek i przewijanie działają bez widoczn… _[needs a ~1000-item kosztorys]_
- app-audit-refactor faza 8 — edytor kosztorysu rozbity na części · L1403 · Jako ADMIN: dodaj, przesuń i usuń sekcję, dodaj pozycję z katalogu, zmień ilości w etapach i ustaw rabat globalny — sumy i „Pozostało” aktu…
- app-audit-refactor faza 8 — edytor kosztorysu rozbity na części · L1405 · Jako ADMIN przełącz na historię, widok raportu pracownika i podgląd oferty, a potem wróć — nagłówek podglądu (logo, nazwa inwestycji, przyc…
- app-audit-refactor faza 8 — edytor kosztorysu rozbity na części · L1414 · Jako ADMIN na 390 px edytor się wyświetla, przewija i przyjmuje edycję komórki. _[390vp]_

### cell 3/MANAGER (20)

- app-audit-refactor faza 1 — przeniesione komponenty wyglądają i działa · L1304 · Strona inwestycji wejściem z listy → „Wróć” wraca na listę; ta sama strona otwarta z adresu → „Wróć” prowadzi na listę inwestycji.
- app-audit-refactor — preview brancha vs staging (luki z listy ryzyk) · L1443 · Usunięcie pliku, który jest fakturą transakcji — odmowa.
- media-file-headers — pliki spoza dozwolonych typów pobierają się zamia · L579 · Plik SVG wgrany w pliki z ominięciem formularza (`/api/media/file/<nazwa>.svg`) → otwarcie linku pobiera plik zamiast wyświetlać obraz lub … _[needs a crafted SVG upload bypassing the form]_
- ungated-commits-review — „Do analizy AI” w galerii + cień pola wieloli · L609 · To samo na koncie z językiem Українська: przycisk „Позначити для аналізу AI”, toast „Файл позначено для аналізу AI”, po kliknięciu „Позначе… _[uk account]_
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1490 · Strona inwestycji → select etapu AI: obrys i kolor tekstu dalej zmieniają się z etapem (jak kolor badge'a tego etapu na liście inwestycji);…
- investment-notes-save — zapis notatki nie czyści adresu inwestycji · L1568 · Inwestycja z wpisanym kodem pocztowym, miastem i krajem → „Edytuj notatkę”, zmień tekst, „Zapisz”: notatka się zmienia, a po odświeżeniu „E…
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1579 · Strona inwestycji → „Kierownik budowy” → wybierz konto → odśwież: wybór zostaje, a adres, kod pocztowy i miasto bez zmian.
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1585 · Strona inwestycji → „Kontener” → kontener × 2 → „Dalej”: formularz pokazuje „2 × kontener”, 3000 zł, „Materiały budowlane” / „kontener”. Za… _[writes a transaction; SMS step only, no real SMS]_
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1588 · Dialog zamówienia: tytuł ma pod spodem nazwę inwestycji; zmiana „Cena za sztukę” przelicza „Kwota”, a przełączenie big bag / kontener wraca…
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1593 · Dialog zamówienia → „Cena za sztukę” `0,001` albo `1e3`: „Dalej” nieaktywne.
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1594 · Dialog zamówienia → „Kontakt na miejscu” → wybierz inną osobę → gwiazdka „Ustaw jako kierownika budowy” → strona inwestycji po odświeżeniu …
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1598 · W kroku SMS „Zapisz jako domyślnego dostawcę” przy innym dostawcy → następne zamówienie wybiera go od razu.
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1602 · Inwestycja bez kierownika budowy: kontakt „— brak —”, a treść SMS-a nie ma linii „Kontakt na miejscu”.
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1604 · Transakcje inwestycji → wiersz zamówienia pokazuje „Czeka” → klik → „Dostarczone” → odśwież: zostaje. Klik ponownie → „Czeka”.
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1606 · Anuluj transakcję zamówienia: znaczek jest wyszarzony i nieklikalny.
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1607 · Oznacz inwestycję jako zakończoną: na jej liście transakcji, w „Tabela” i „Karty”, znaczek jest widoczny, ale nieklikalny.
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1613 · Zamówienie 3 big bagów przy cenie z groszami (np. 799,99 zł): „Kwota” to dokładnie 2399,97.
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1615 · Strona inwestycji: w nagłówku nie ma „Dodaj” (kosztorys v1); przycisk v2 nazywa się „Kosztorys v2”. Inwestycja bez kosztorysu v1 nadal da s… _[also 12]_
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1617 · Strona inwestycji: Adres, Osoba kontaktowa, Etap AI, Kierownik budowy, status, Notatki, Uwagi AI i Zdjęcia i pliki stoją w jednym bloku z r… _[also 17, 6, 5, 16]_
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1620 · Dowolny select w aplikacji: strzałka ma ten sam szary co strzałka „Notatki”.

### cell 3/OWNER (4)

- app-audit-refactor faza 6 — porządki w komponentach · L1376 · Inwestycja → „Kosztorys” (przycisk arkusza), „Umowa” i Podsumowanie → „Marża” otwierają się jak wcześniej; `/kasa` → wykres salda kasy rysu… _[Marża is ADMIN/OWNER; also /kasa chart (6)]_
- app-audit-refactor — preview brancha vs staging (luki z listy ryzyk) · L1441 · Inwestycja: oznacz jako zakończoną (pojawia się data zakończenia), odblokuj status; inwestycja w Koszu nie daje się edytować. _[unlock is ADMIN/OWNER]_
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1581 · Jako OWNER w dialogu zamówienia: zębatka (prawy dolny róg, obok „Dalej”) → „Ustawienia zamówień” → dodaj dwóch dostawców, zmień cenę → zapi… _[MANAGER half (no gear) at 3/MANAGER]_
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1591 · Dialog zamówienia → ilość 3, wybierz kontakt → zębatka → zmień cenę big bagu → „Zapisz”: cena w dialogu się zmienia, ilość i kontakt zostaj… _[gear is ADMIN/OWNER]_

### cell 4/MANAGER (31)

- app-audit-refactor faza 1 — przeniesione komponenty wyglądają i działa · L1306 · `/transakcje` → menu kolumn: ukrywanie i pokazywanie kolumn działa, okno kolejności kolumn przestawia kolumny.
- app-audit-refactor faza 6 — porządki w komponentach · L1374 · Przełącznik lista/karty przelewów i skala UI działają jak wcześniej.
- app-audit-refactor faza 7 — bez ręcznych memo w tabelach i hookach · L1392 · Formularz przelewu → pole „Kasa”: „tylko aktywne” przełącza listę, wybrana nieaktywna kasa dalej widoczna; błąd walidacji pod polem pokazuj…
- app-audit-refactor — preview brancha vs staging (luki z listy ryzyk) · L1446 · Listy z sortowaniem (Transakcje, Leady, Zgłoszenia): posortuj, przejdź na stronę 2 — sortowanie zostaje w adresie i w kolejności. _[also 15, 9, 10]_
- app-audit-refactor — preview brancha vs staging (luki z listy ryzyk) · L1450 · Edycja przelewu i „Rozlicz wypłaty”: błąd walidacji pokazuje się pod polem, udany zapis zamyka okno.
- app-audit-refactor — poprawki z bramki przeglądu · L1455 · Formularz wydatków z kilkoma pozycjami: przy pozycji wybierz kategorię „Inne” i pracownika — drugi rząd wyboru pojawia się i zapisuje jak w…
- invoice-download-date-range — „Faktury” z zakresem dat · L397 · „Drukuj” dalej drukuje bieżący zestaw filtrów tabeli, niezależnie od dialogu. _[print: stub window.print, inspect printed HTML]_
- staging-sweep-review-2 — druk z PDF, scalanie paragonów, ustawienia wi · L725 · Podgląd z kilkoma plikami, wśród nich PDF (np. faktura + zdjęcie) → „Drukuj”: okno wydruku pokazuje wszystkie strony, z PDF-em włącznie, i … _[print: stub window.print]_
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1484 · Badge'e wyglądają jak dotąd (refaktor na wspólny komponent): status wypłaty w tabeli transakcji, „Od pracownika” w kolumnie typu, status in… _[spans 11, 15, 16, 17, 8, 9, 10]_
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1488 · Zielone badge'e (zaakceptowana wypłata, aktywna inwestycja, rola pracownika, aktywny pojazd) są teraz morskie, a nie szmaragdowe; tekst czy… _[light + dark]_
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1492 · Karty przelewów: chipy „Kasa:”, „Pracownik:”, „Kategoria:” itd. wyglądają jak dotąd — kolorowy obrys, zwykła grubość tekstu, długa wartość …
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1506 · Przycisk „Wpłata” wygląda jak dotąd (zielony obrys, wypełnia się po najechaniu).
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1507 · Typ przelewu w tabeli i na kartach przelewów: obrys i kropka w kolorze typu, nazwa ucina się wielokropkiem; rozliczony przelew ma kolor roz…
- rejected-payouts-table — odrzucone wypłaty na pulpicie, bez strony „Wy · L1519 · W tej tabeli ID, pracownik, inwestycja i kasa to linki: ID otwiera transakcję na liście inwestycji (wypłata bez inwestycji — na „Transakcje…
- rejected-payouts-table — odrzucone wypłaty na pulpicie, bez strony „Wy · L1521 · „Anuluj” w tej tabeli pyta o powód i anuluje wypłatę: wiersz znika, licznik przy „Transakcje” w menu spada o jeden. Przy zakończonej inwest…
- rejected-payouts-table — odrzucone wypłaty na pulpicie, bez strony „Wy · L1523 · W menu nie ma pozycji „Wypłaty”, a adres `/wyplaty` pokazuje „Nie znaleziono”. Na „Transakcje” filtr statusu potwierdzenia zawęża listę do …
- cancel-rejected-payout — odrzuconą wypłatę anuluje każdy z zarządu · L1528 · Jako MANAGER: wypłata zaksięgowana przez innego kierownika albo właściciela i odrzucona przez pracownika → „Anuluj” na pulpicie anuluje ją … _[needs a payout booked by another manager/owner and rejected]_
- cancel-rejected-payout — odrzuconą wypłatę anuluje każdy z zarządu · L1531 · Jako MANAGER na „Transakcje”: przy cudzej wypłacie oczekującej lub przyjętej i przy cudzym wydatku nie ma „Anuluj”; przy swoich transakcjac…
- cancel-rejected-payout — odrzuconą wypłatę anuluje każdy z zarządu · L1533 · Jako MANAGER przy cudzej odrzuconej wypłacie edycja dalej jest niedostępna.
- payout-card-buttons — przyciski karty wypłaty i warianty kolorów · L1542 · Przyciski „Wpłata”, „Wydatek”, „Kasa” w pasku i „Wyczyść” w formularzu wyglądają jak dotąd (obramowane w swoim kolorze).
- cards-hide-table-controls — „Kolumny” i „Szukaj duplikatów” tylko w wi · L1547 · Transakcje → widok kart: nie ma przycisków „Kolumny” ani „Szukaj duplikatów”; po powrocie do widoku tabeli oba są na miejscu.
- cards-hide-table-controls — „Kolumny” i „Szukaj duplikatów” tylko w wi · L1549 · Ukryj w tabeli kolumnę „Kasa źródłowa”, przełącz na karty: karty dalej pokazują „Kasa źródłowa: …”.
- slice-review-gate — właściciel kasy, kolory kwot, odrzucone wypłaty · L1559 · `/transakcje` w tabeli i na kartach: kwoty mają te same kolory co dotąd (wydatek, wpływ, wypłata), anulowane są szare.
- slice-review-gate — właściciel kasy, kolory kwot, odrzucone wypłaty · L1562 · Pulpit → odrzucone wypłaty: przy wypłacie z zablokowanej inwestycji „Anuluj transakcję” jest wyszarzone z dymkiem o blokadzie; numer ID otw… _[needs a rejected payout on a locked investment]_
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1596 · Wydatek big bag / kontener dodany ręcznie (zwykły formularz wydatku, bez faktury) nadal pyta o brak faktury.
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1610 · Druk tabeli transakcji: kolumna „Zamówienie” drukuje „Czeka” / „Dostarczone”. _[print: stub window.print]_
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1614 · Ekran „Transakcje” (konto zarządu): nie ma już przycisku „Wyślij wiadomość (test)”.
- EX-1118 — user-register-stats — „Moje Kasy” po właścicielu kasy, nie p · L1624 · Panel kierownika: „Moje Kasy” / „Saldo moich kas” pokazuje dokładnie kasy, których zalogowany jest właścicielem — także gdy inne konto ma t… _[needs a same-name second account]_
- EX-1118 — user-register-stats — „Moje Kasy” po właścicielu kasy, nie p · L1628 · Lista transakcji: kasa źródłowa i docelowa linkują do `/kasa/[id]`; kasa w koszu i „—” nie są linkami (zachowanie jak przed refaktorem).
- EX-1118 — user-register-stats — „Moje Kasy” po właścicielu kasy, nie p · L1636 · Lista transakcji: inwestycja linkuje do `/inwestycje/[id]`, pracownik do `/pracownicy/[id]`; „—” nie jest linkiem. „Wyczyść filtry” nad lis…
- transfers-worker-column-width — szersza kolumna „Pracownik” · L1649 · Lista transakcji (desktop), widok tabeli: imię i nazwisko w kolumnie „Pracownik” mieści się w jednej linii, tak jak w „Dodane przez”.

### cell 4/OWNER (7)

- app-audit-refactor faza 2 — dostęp do kas, synchronizacja arkusza, sal · L1320 · Jako ADMIN dodaj wydatek na inwestycji z podpiętym arkuszem: w logu serwera widać próbę synchronizacji arkusza (lokalnie konto tylko do odc… _[needs Vercel runtime logs]_
- app-audit-refactor faza 3 — sortowanie, duplikaty, etykiety kas, druk, · L1327 · Jako ADMIN na Transakcjach, Leadach, Zgłoszeniach wydatków i Zgłoszeniach prac: posortuj po każdej sortowalnej kolumnie i odśwież — kolejno… _[also 15, 9, 10]_
- app-audit-refactor faza 3 — sortowanie, duplikaty, etykiety kas, druk, · L1334 · Jako ADMIN wydrukuj listę transakcji, ofertę i umowę: logo i układ jak dotąd, okno zamyka się po druku. _[print: also offer (2) and umowa (3)]_
- app-audit-refactor faza 5 — reguły kolekcji w nowym miejscu · L1354 · Jako ADMIN dodaj, edytuj i anuluj transakcję — salda kas zmieniają się bez odświeżania.
- app-audit-refactor faza 5 — reguły kolekcji w nowym miejscu · L1355 · Jako ADMIN usuń wydatek z fakturą — faktura znika z listy plików.
- app-audit-refactor faza 6 — porządki w komponentach · L1370 · Jako ADMIN edytuj przelew i wyczyść formularz przyciskiem resetu; „Rozlicz wypłaty” zapisuje się jak wcześniej (oba formularze mają teraz w…
- rejected-payouts-table — odrzucone wypłaty na pulpicie, bez strony „Wy · L1516 · Jako OWNER na „Transakcje”, gdy pracownik odrzucił wypłatę: sekcja „Wypłaty odrzucone przez pracowników” jest zwijana, pod tytułem ma „Taki…

### cell 5/EMPLOYEE (14)

- app-audit-refactor faza 6 — porządki w komponentach · L1362 · Jako EMPLOYEE na telefonie (390 px) → „Zgłoszenia wydatków”: filtry „Status” i „Inwestycja” zawężają listę i wracają na stronę 1; zmiana „n… _[390vp]_
- app-audit-refactor faza 6 — porządki w komponentach · L1365 · Jako EMPLOYEE na swojej stronie pracownika → historia raportów: te same filtry i paginacja działają jak wcześniej.
- app-audit-refactor faza 6 — porządki w komponentach · L1372 · Na koncie z językiem ukraińskim/rosyjskim → „Zgłoszenia wydatków”: daty wysłania i decyzji w formacie tego języka (wcześniej zawsze polskim… _[uk account]_
- expense-draft-loader — „Nowy wydatek” pracownika: loader na środku ekr · L626 · Inne ekrany z loaderem (logowanie, filtry transakcji, zapis formularza) wyglądają jak dotąd — 🚧 dalej podskakuje. _[also L (login loader)]_
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1474 · Jako pracownik (EMPLOYEE) na swojej stronie z wypłatą czekającą na potwierdzenie: sekcja „Wypłaty do potwierdzenia” jest zwijana, domyślnie… _[needs a pending payout booked first]_
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1479 · Jako pracownik odrzuć wypłatę z powodem: znika z „Wypłat do potwierdzenia” i pojawia się w osobnej sekcji „Odrzucone wypłaty” z opisem o wy…
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1482 · Jako pracownik na telefonie (390 px): karty wypłat zajmują całą szerokość, przyciski są łatwe do trafienia, nic nie wychodzi poza ekran. _[390vp]_
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1497 · Strona pracownika z wypłatami → „Lista wydatków / zaliczek” ma filtr „Potwierdzenie” (czeka / potwierdzona / odrzucona) i zawęża listę do w…
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1499 · Karty przelewów (telefon, lista wypłat pracownika): status wypłaty stoi w tej samej linii co badge „Wypłata”, przy prawej krawędzi; nagłówe… _[390vp]_
- payout-card-buttons — przyciski karty wypłaty i warianty kolorów · L1537 · Pracownik, `/pracownicy/[id]` z wypłatą oczekującą: „Potwierdzam” jest zielony obramowany z ptaszkiem, „Odrzuć” czerwony obramowany z kosze…
- payout-card-buttons — przyciski karty wypłaty i warianty kolorów · L1539 · Odrzucona wypłata na karcie pracownika pokazuje „Powód odrzucenia: …” (uk/ru: przetłumaczone). _[uk account]_
- payout-card-buttons — przyciski karty wypłaty i warianty kolorów · L1540 · Na telefonie (390 px) „Dodaj wydatek” / „Zgłoś pracę” są niższe niż dotąd, a dłuższa etykieta uk/ru dalej się zawija, bez wychodzenia poza … _[390vp]_
- cards-hide-table-controls — „Kolumny” i „Szukaj duplikatów” tylko w wi · L1550 · Strona pracownika w widoku kart: brak etykiety „Pracownik”, jak dotąd.
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1609 · Jako EMPLOYEE na własnym `/pracownicy/[id]`, jeśli widać wiersz zamówienia: bez przycisku.

### cell 5/MANAGER (1)

- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1494 · Anuluj odrzuconą wypłatę pracownika: na jego stronie znika z kart „Odrzucone wypłaty”, a w „Liście wydatków / zaliczek” jest (przekreślona,… _[EMPLOYEE view of the same page too]_

### cell 6/EMPLOYEE (2)

- app-audit-refactor faza 2 — dostęp do kas, synchronizacja arkusza, sal · L1317 · Jako pracownik (EMPLOYEE) wpisz adres `/kasa/1`: trafiasz na swoją stronę pracownika, nie na „Nie znaleziono”.
- app-audit-refactor — poprawki z bramki przeglądu · L1459 · Jako EMPLOYEE otwórz `/kasa/{id}` swojej kasy — trafiasz na swoją stronę pracownika, nie na 404.

### cell 6/MANAGER (1)

- app-audit-refactor faza 2 — dostęp do kas, synchronizacja arkusza, sal · L1319 · Jako MANAGER otwórz adres kasy głównej: „Nie znaleziono” jak dotąd.

### cell 7/MANAGER (7)

- app-audit-refactor faza 1 — przeniesione komponenty wyglądają i działa · L1302 · Dowolny formularz w oknie (np. „Dodaj kasę”): otwiera się, zapis zamyka okno, a z zaznaczonym „Nie zamykaj po zapisaniu” zostaje otwarte; w…
- app-audit-refactor faza 2 — dostęp do kas, synchronizacja arkusza, sal · L1311 · Jako MANAGER na `/kasy`: przy kasie pracownika i swojej status („Aktywna” / „Nieaktywna”) da się przełączyć i zostaje po odświeżeniu; przy …
- app-audit-refactor faza 2 — dostęp do kas, synchronizacja arkusza, sal · L1314 · Jako MANAGER na `/kasy`: kosz w kolumnie „Akcje” jest przy kasie pracownika i swojej, przy kasie innego managera, ownera i admina go nie ma… _[also 18]_
- app-audit-refactor faza 3 — sortowanie, duplikaty, etykiety kas, druk, · L1332 · Jako MANAGER: typ kasy na `/kasy`, w formularzu kasy i na wykresie sald na pulpicie brzmi tak samo („Główne”, „Pomocnicze”, „Wirtualne”, „P… _[also 4 (dashboard chart)]_
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1504 · Kasy: kasę, którą możesz zmieniać, przełączasz kliknięciem w status; przy cudzej kasie status jest nieklikalny.
- slice-review-gate — właściciel kasy, kolory kwot, odrzucone wypłaty · L1554 · Jako MANAGER „Dodaj kasę” z innym managerem jako właścicielem: komunikat „Brak uprawnień”, kasa nie pojawia się na `/kasy`. Z pracownikiem …
- slice-review-gate — właściciel kasy, kolory kwot, odrzucone wypłaty · L1556 · Jako MANAGER edytuj kasę pracownika i ustaw siebie jako właściciela: zapis działa, po odświeżeniu właścicielem jesteś ty. Ustawienie innego…

### cell 7/OWNER (3)

- app-audit-refactor faza 2 — dostęp do kas, synchronizacja arkusza, sal · L1316 · Jako OWNER na `/kasy`: przełącz kasę na „Nieaktywna” i z powrotem — stan zostaje po odświeżeniu.
- app-audit-refactor faza 5 — reguły kolekcji w nowym miejscu · L1356 · Jako ADMIN spróbuj usunąć kasę, która ma transakcje — odmowa jak dotąd.
- slice-review-gate — właściciel kasy, kolory kwot, odrzucone wypłaty · L1558 · Jako OWNER „Dodaj kasę” i edycja kasy z dowolnym właścicielem działają jak dotąd.

### cell 8/MANAGER (3)

- kursor na statusie inwestycji · L1463 · „Edytuj inwestycję” i tabela inwestycji: najechanie na status („Aktywna” ze strzałką) pokazuje rączkę; w trakcie zapisu zmiany statusu kurs…
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1576 · Po restarcie `pnpm dev` `/inwestycje`, strona inwestycji i `/pracownicy` ładują się bez błędu „column does not exist”. _[staging equivalent of "after pnpm dev restart": pages load, preview DB migrated]_
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1601 · `/inwestycje` → „Akcje” przy aktywnej inwestycji ma przycisk zamówienia; zakończona go nie ma.

### cell 8/OWNER (1)

- app-audit-refactor faza 7 — bez ręcznych memo w tabelach i hookach · L1390 · Jako ADMIN ustaw filtr statusu w „Inwestycjach” i warunki w „Katalogu prac”, zwiń pasek boczny i odśwież stronę: filtry i zwinięty pasek zo… _[also 13]_

### cell 9/MANAGER (5)

- queue-entity-links — linki do inwestycji i pracownika w zgłoszeniach · L457 · „Zgłoszenia wydatków” → to samo dla inwestycji i pracownika; zgłoszenie bez inwestycji pokazuje „bez inwestycji” jako zwykły tekst. _[EMPLOYEE first files a draft without investment (Stage A)]_
- expense-draft-duplicates-per-row — duplikaty przy własnym paragonie + · L716 · Nieodczytane zgłoszenie bez pobranych zdjęć: nad pozycjami stały komunikat „Nie udało się pobrać zdjęć — zgłoszenie można tylko odrzucić.”,… _[needs a draft with ai_read NULL]_
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1511 · Filtr statusów linii (zaakceptowane / odrzucone / oczekujące) w zgłoszeniu wydatku: kliknięcie chowa i pokazuje linie, ukryty status jest p…
- EX-1118 — user-register-stats — „Moje Kasy” po właścicielu kasy, nie p · L1630 · Konto z językiem ukraińskim lub rosyjskim: „Wyczyść filtry” (lista i kolejka), „Nie znaleziono.” w wyszukiwanych selectach, dialog akceptac… _[uk/ru account; also 4]_
- EX-1118 — user-register-stats — „Moje Kasy” po właścicielu kasy, nie p · L1633 · To samo konto: w zgłoszeniu z odczytanymi paragonami przyjmij jeden paragon, potem odrzuć dwa — toasty („Paragon przyjęty”, „Odrzucono 2”) … _[uk/ru account]_

### cell 9/OWNER (3)

- app-audit-refactor faza 4 — zgłoszenia wydatków, raporty prac, edytor · L1341 · Jako ADMIN na `/zgloszenia-wydatkow`: zaakceptuj zgłoszenie, scal dwa zgłoszenia jednego pracownika i odrzuć paragony z trzeciego — kwoty i…
- app-audit-refactor faza 6 — porządki w komponentach · L1369 · Jako ADMIN w trybie paragonów: suma zaznaczonych pozycji w stopce zgadza się z zaznaczeniem. _[uses an already-read draft, no live AI]_
- app-audit-refactor — preview brancha vs staging (luki z listy ryzyk) · L1444 · Jako ADMIN na `/zgloszenia-wydatkow`: otwórz ponownie odrzucone zgłoszenie — wraca do decyzji, licznik w menu zmienia się bez odświeżania.

### cell 10/MANAGER (4)

- report-line-decisions — „Przyjmij / Odrzuć” pozycja po pozycji · L450 · Stare zgłoszenia z częściowymi decyzjami po migracji: „Do sprawdzenia” z postępem, nie „Przyjęte” (lokalnie: #7, #8, #11 na inw. 139; na pr… _[needs partially-decided old reports in the fresh dump]_
- catalogue-add-flow — „szukaj w katalogu → albo dodaj nową pracę” w kos · L476 · Praca bez j.m. w zgłoszeniu: „Brak j.m. — wybierz pracę z katalogu albo dodaj nową” znika po dodaniu jej do rozpiski. _[needs a legacy report line without unit]_
- nav-labels · L487 · Wejście w każdą z nich: nagłówek strony i tytuł podczas ładowania brzmią tak samo jak pozycja w menu — bez mignięcia starej nazwy. _[also 15; loading-title flash]_
- Findings — 2026-10-15 · L588 · **Praca z katalogu, którą sekcja już ma, nie jest zapamiętywana** — „Dodaj do rozpiski” z katalogu na pracę, której pozycja już stoi w wybr…

### cell 10/OWNER (1)

- app-audit-refactor faza 4 — zgłoszenia wydatków, raporty prac, edytor · L1343 · Jako ADMIN otwórz podgląd zgłoszenia prac i stronę zgłoszenia z linku pracownika na telefonie (390 px) — te same pozycje, kwoty i zdjęcia c… _[390vp for the share-page half (L)]_

### cell 11/MANAGER (4)

- app-audit-refactor faza 1 — przeniesione komponenty wyglądają i działa · L1298 · `/pracownicy`: kolorowe plakietki ról w tabeli jak dotąd; na telefonie (390 px) plakietka roli w menu. _[390vp for the menu half; section: ADMIN then MANAGER]_
- app-audit-refactor faza 6 — porządki w komponentach · L1380 · Nowy pracownik dodany przez „Dodaj pracownika” ma język polski.
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1501 · `/uzytkownicy`: status „Aktywny” / „Nieaktywny” to zwykły badge (morski / szary); kliknięcie przełącza aktywność konta i nie otwiera strony…
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1578 · „Edytuj pracownika” → wpisz „Telefon” → otwórz ponownie: numer zostaje.

### cell 11/OWNER (3)

- app-audit-refactor faza 2 — dostęp do kas, synchronizacja arkusza, sal · L1322 · Jako ADMIN na `/pracownicy` kliknij kwotę wypłat przy pracowniku („Rozlicz wypłaty”): kwota „Pozostało”, która zaokrągla się do zera, pokaz…
- app-audit-refactor faza 7 — bez ręcznych memo w tabelach i hookach · L1388 · Jako ADMIN przełącz aktywność pracownika i kasy: przełącznik zmienia się od razu, bez mignięcia, a ustawione filtry zostają. _[also 7]_
- app-audit-refactor — preview brancha vs staging (luki z listy ryzyk) · L1439 · Jako OWNER spróbuj dezaktywować własne konto i ostatniego OWNER-a — odmowa; logowanie kontem nieaktywnym — odrzucone. _[inactive-login half at L]_

### cell 12/MANAGER (1)

- app-audit-refactor faza 7 — bez ręcznych memo w tabelach i hookach · L1394 · Arkusze → „Kosztorysy” i „Inwestycje bez arkusza” wyświetlają się i wyszukują; kosztorys → „Porównaj z katalogiem prac” pokazuje podpowiedz… _[also 2]_

### cell 13/MANAGER (1)

- app-audit-refactor — preview brancha vs staging (luki z listy ryzyk) · L1448 · Tabele z fazy 7 i pole „Kasa” w formularzu przelewu: w zakładce sieci nie ma powtarzających się w kółko zapytań, strona nie miga sama z sie… _[also the other phase-7 tables + 4]_

### cell 13/OWNER (1)

- app-audit-refactor faza 7 — bez ręcznych memo w tabelach i hookach · L1386 · Jako ADMIN w tabelach „Katalog prac”, „Sprzęt”, „Flota”, „Pracownicy”, „Inwestycje” i „Kasy”: wyszukiwanie i filtry zawężają listę jak wcze… _[also 17, 16, 11, 8, 7]_

### cell 14/MANAGER (2)

- szablony-plain-revalidation · L222 · To samo w szablonie z ~1000 pozycji: zapis komórki bez widocznego opóźnienia względem małego szablonu. _[needs a ~1000-item template (none on preview; building one = writes)]_
- filters-tick-to-show — „Filtry” zaznaczasz to, co chcesz widzieć · L843 · Szablon → „Filtry” działają tak samo jak w kosztorysie (nic zaznaczone = wszystko).

### cell 14/OWNER (1)

- app-audit-refactor faza 4 — zgłoszenia wydatków, raporty prac, edytor · L1348 · Jako ADMIN w Szablonie: dodaj dział i pozycję pod wskazaną pozycją — zostają po odświeżeniu.

### cell 15/MANAGER (5)

- app-audit-refactor faza 6 — porządki w komponentach · L1378 · Leady → zaznaczanie zdjęć w „Zdjęcia” i przy przenoszeniu do inwestycji, zaznaczanie wierszy listy leadów.
- media-upload-other-forms — każdy formularz z plikami na szybkiej ścież · L318 · Okno leada (zgłoszenie z Facebooka) z plikami → miniatury wyglądają jak dotąd. POMINIĘTE 2026-10-07 (staging): żadne z 221 zgłoszeń na prev… _[needs a lead with files in the fresh dump]_
- szerszy dialog „Szczegóły" leada · L1468 · Leady → „Szczegóły" przy zgłoszeniu z długą wiadomością: okno jest szerokie, etykiety w wąskiej kolumnie po lewej, wiadomość zajmuje resztę…
- szerszy dialog „Szczegóły" leada · L1470 · To samo zgłoszenie z załącznikami: miniatury są ostre, nie rozmyte. _[needs a lead with attachments]_
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1503 · `/leady`: „Skontaktowano” / „Oczekuje” przełącza się kliknięciem jak dotąd.

### cell 15/OWNER (1)

- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1611 · Karty list odbiorców powiadomień (np. w „Zgłoszenia”, „Sprzęt”, „Flota”) wyglądają jak wcześniej, a „Edytuj listę” dalej zapisuje adresy (w… _[recipients editor ADMIN/OWNER; also 16, 17]_

### cell 17/OWNER (1)

- app-audit-refactor faza 3 — sortowanie, duplikaty, etykiety kas, druk, · L1329 · Jako ADMIN dodaj sprzęt z numerem seryjnym, pojazd z rejestracją i pracownika z e-mailem, które ma już pozycja w Koszu — komunikat „… jest … _[also 16, 11]_

### cell 18/MANAGER (9)

- app-audit-refactor — preview brancha vs staging (luki z listy ryzyk) · L1451 · Po najbliższym przebiegu crona czyszczenia wersji kosztorysu: w logach Vercela przebieg bez błędu. _[cron stand-in: fire cleanup, read response + Vercel logs]_
- kosz-zgloszen · L244 · „Usuń na zawsze" na zgłoszeniu, z którego utworzono inwestycję ze zdjęciami: wymaga wpisania nazwy; po usunięciu zgłoszenie znika z `/kosz`… _[needs a lead that spawned an investment with photos]_
- kosz-zgloszen · L251 · Usunięte na zawsze zgłoszenie z Facebooka nie wraca po nocnym uzgodnieniu zgłoszeń (staging, następny dzień). _[cron stand-in: fire leads-reconcile (live Meta) after erasing an FB lead still in Meta's window]_
- purge-runner — nocne czyszczenie Kosza po scaleniu sześciu kopii (2026 · L268 · Inwestycja, kasa, pracownik, pojazd, sprzęt i zgłoszenie w `/kosz` dłużej niż okres przechowywania → po przebiegu crona `cleanup` znikają z… _[cron stand-in: fire cleanup — purges every expired row on preview DB]_
- purge-runner — nocne czyszczenie Kosza po scaleniu sześciu kopii (2026 · L270 · Odpowiedź crona `cleanup` zawiera dla każdego rodzaju `purged` / `blocked` / `failed` (pojazdy, sprzęt i zgłoszenia mają teraz też `blocked… _[cron stand-in: fire cleanup (same run as L268)]_
- kosz-plikow — usunięte pliki trafiają do Kosza na 7 dni · L1129 · Plik w Koszu dłużej niż 7 dni: po wywołaniu `/api/cron/cleanup` znika z Kosza i z Bloba, a odpowiedź niesie krok `media` z rozbiciem `{ rec… _[cron stand-in: fire cleanup; needs a file trashed >7 days]_
- kosz-plikow — usunięte pliki trafiają do Kosza na 7 dni · L1133 · Paragon w zgłoszeniu wydatku pracownika i zdjęcie w zgłoszeniu prac przeżywają przebieg crona nietknięte. _[cron stand-in: fire cleanup]_
- kosz-plikow — usunięte pliki trafiają do Kosza na 7 dni · L1139 · „Usuń na zawsze" przy inwestycji, szablonie i zgłoszeniu w Koszu wygląda i działa jak dotąd: ta sama notka w oknie, wymaga wpisania nazwy (…
- kosz-plikow — usunięte pliki trafiają do Kosza na 7 dni · L1142 · Zgłoszenie, które wcześniej straciło plik do Kosza, usunięte na zawsze: plik znika też z sekcji „Pliki".

### cell 19/EMPLOYEE (1)

- slice-review-gate — właściciel kasy, kolory kwot, odrzucone wypłaty · L1564 · Jako pracownik (EMPLOYEE) wpisz adres `/warianty-badge`: strona się nie otwiera.

### cell L (2)

- app-audit-refactor faza 6 — porządki w komponentach · L1375 · Bez logowania: logowanie i „Nie pamiętam hasła” działają.
- payout-cards — wypłaty pracownika jako karty, wspólny badge · L1509 · Raport pracy: nazwa sekcji obok kolorowego paska ma tło i tekst w kolorze tej sekcji, czytelne w jasnym i ciemnym motywie. _[worker report share page /z/…]_

### ai? (11)

- ai-translations — AI uzupełnia tłumaczenia UA/RU i tłumaczy prace spoz · L275 · Gdy AI było niedostępne w chwili wysyłki: przegląd pokazuje „Brak tłumaczenia" i „Przetłumacz"; po kliknięciu (z działającym AI) polski opi… _[needs AI unavailable at send time, then working AI]_
- Jakość odczytu (prawdziwe zdjęcia) · L287 · Zdjęcie pod kątem / w słabym świetle / lekko pognieciona kartka → ilości dalej się zgadzają, a te nieczytelne mają „Niepewny odczyt — spraw… _[also needs a real phone photo of a paper sheet]_
- worker-form-mirrors-link — kartka do wypełnienia jak „Zgłaszam pracę”, · L299 · Wypełnij kartkę ręcznie (kilka ilości w „Zgłaszam”), wczytaj ją przez „Wczytaj zgłoszenie z kartki (AI)”: w zgłoszeniu są dokładnie wpisane… _[also needs a hand-filled paper sheet]_
- media-upload-other-forms — każdy formularz z plikami na szybkiej ścież · L315 · Raport ze skanu: dodaj zdjęcia → raport zapisany, zdjęcia się otwierają. _[needs a readable filled paper sheet photo]_
- invoice-duplicate-detection — duplikaty paragonów przy akceptacji zgło · L350 · „Dodaj wydatek" → między wierszem pliku a „Notatką" stoi wiersz z polami „Nr dokumentu", „NIP sprzedawcy" i „Data na paragonie"; „Skanuj" /… _[needs a legible real receipt]_
- worker-draft-one-expense-per-photo — każdy paragon na zdjęciu osobno · L433 · Kierownik → zgłoszenie z jednym zdjęciem, na którym leży kilka paragonów obok siebie → „Zobacz”: każdy paragon to osobna pozycja ze swoją k…
- worker-draft-one-expense-per-photo — każdy paragon na zdjęciu osobno · L435 · Zgłoszenie z jednym zdjęciem wysłane przed 2026-10-12 (pracownik wybrał wtedy „Jeden wydatek”), jeszcze bez odczytu → „Zobacz”: paragony ze… _[needs a pre-2026-10-12 unread single-photo draft]_
- worker-draft-one-expense-per-photo — każdy paragon na zdjęciu osobno · L437 · Kierownik przyjmuje zgłoszenie, pomijając jeden z paragonów → pominięty paragon w historii → „Przywróć”: wraca jako osobne zgłoszenie z jed…
- EX-1077 — scan-blocks-save — „Zapisz" czeka na odczyt paragonu · L1181 · Zgłoszenie wydatku z inwestycją, jedna pozycja ze zdjęciem paragonu i jedna bez → „Odczytaj ponownie" przy pozycji ze zdjęciem: póki trwa o…
- app-audit-refactor faza 3 — sortowanie, duplikaty, etykiety kas, druk, · L1336 · Jako ADMIN zeskanuj paragon i papierowe zgłoszenie prac, przetłumacz opis pozycji kosztorysu — wynik taki jak dotąd.
- app-audit-refactor faza 6 — porządki w komponentach · L1367 · Jako ADMIN dodaj przelew z pozycjami ze zeskanowanej faktury (przycisk skanu i przeciągnięcie pliku na oba tryby): pozycje powstają, suma p… _[scanned invoice]_

### out (59)

- cron-lead-reconcile · L60 · Wywołanie z poprawnym `CRON_SECRET` zwraca liczniki, a przebieg, który odzyskał leada, dostarcza Ma… — real mail/SMS/Sheets write/production
- lead-recovery-notifies-sales · L82 · Przebieg sweepa (cron `/api/cron/leads-reconcile`) → skrzynka sprzedaży dostaje jedno zwykłe Mail p… — real mail/SMS/Sheets write/production
- lead-recovery-notifies-sales · L90 · Dokładnie jeden mail podsumowujący, wyłącznie na „Alerty techniczne" (nie do sprzedaży), bez Mail p… — real mail/SMS/Sheets write/production
- Katalog narzędzi i urządzeń (rejestr sprzętu) · L102 · Ręczne `GET /api/cron/equipment-reminders` z `Bearer $CRON_SECRET` wysyła mail o właściwej Mail poz… — real mail/SMS/Sheets write/production
- lead-delivery (wykonczymy half, 2026-09-21) · L135 · Podpisany POST JSON z `curl`, wskazujący realny URL bloba, tworzy zgłoszenie razem z plikami Nie do… — dev tooling with no UI _[misfit: signed curl webhook, Preview LANDING_WEBHOOK_SECRET unreadable (403)]_
- lead-delivery (wykonczymy half, 2026-09-21) · L140 · Ten sam request powtórzony nie tworzy niczego i nie wysyła maila Nie do sprawdzenia na stagingu — a… — dev tooling with no UI _[misfit: signed curl webhook, Preview secret unreadable]_
- lead-delivery (wykonczymy half, 2026-09-21) · L145 · Request z `assets[].url` spoza hosta z allowlisty jest odrzucony i alertuje Nie do sprawdzenia na s… — dev tooling with no UI _[misfit: signed curl webhook, Preview secret unreadable]_
- lead-delivery (wykonczymy half, 2026-09-21) · L150 · Request z podmienionym body jest odrzucony (403) Nie do sprawdzenia na stagingu — agent nie zna sek… — dev tooling with no UI _[misfit: signed curl webhook, Preview secret unreadable]_
- Phase 3: E2E · L160 · `pnpm test:e2e e2e/client-share.spec.ts` na świeżo zaseedowanym db-test przechodzi. — dev tooling with no UI
- catalogue-picker-virtualization — „Dodaj pracę z katalogu" rysuje tylk · L171 · `pnpm exec playwright test e2e/work-catalogue.spec.ts` na bazie E2E — uruchamia człowiek — dev tooling with no UI
- „Udostępnij" kopiuje link · L192 · Działa w Safari (kopiowanie nie jest odrzucane). **Nie do zweryfikowania tym narzędziem** — Playwri… — Safari/WebKit
- E2E · L201 · `pnpm test:e2e e2e/client-share.spec.ts` przechodzi — uruchamia człowiek — dev tooling with no UI
- worker-payout-remaining — „Pozostało do wypłaty" per pracownik i „Rozl · L215 · (tylko produkcja) wypłaty pojawiają się w zakładce „transfery" arkusza właściciela. — real mail/SMS/Sheets write/production
- reorder-dialog-safari — lista „Ustaw kolejność” nie zapada się w Safar · L304 · Safari (desktop) → kosztorys z kilkoma sekcjami → „Akcje sekcji” → „Ustaw kolejność…”: lista sekcji… — Safari/WebKit
- media-upload-other-forms — każdy formularz z plikami na szybkiej ścież · L312 · Telmak: dodaj fakturę PDF → zapisana i otwiera się. — real mail/SMS/Sheets write/production _[misfit: needs a real Telmak invoice PDF (prod Blob only)]_
- media-upload-other-forms — każdy formularz z plikami na szybkiej ścież · L321 · Zgłoszenie z formularza na stronie (landing) ze zdjęciem z telefonu i PDF-em → oba pliki są przy zg… — real mail/SMS/Sheets write/production _[misfit: real landing form + signed webhook]_
- worker-pwa-install-and-long-session — ikona aplikacji na telefonie i l · L327 · Build produkcyjny, Chrome DevTools → Application → Manifest: nazwa „Wykończymy”, trzy ikony (maskow… — phone/PWA/push _[PWA manifest/installability in DevTools]_
- worker-pwa-install-and-long-session — ikona aplikacji na telefonie i l · L329 · Android Chrome, prawdziwy telefon, staging, 390px: na własnej stronie pracownika pod „Zmień e-mail … — phone/PWA/push
- worker-pwa-install-and-long-session — ikona aplikacji na telefonie i l · L331 · Ta ikona otwiera aplikację na pełnym ekranie na stronie pracownika, już zalogowaną, i przycisk inst… — phone/PWA/push
- worker-pwa-install-and-long-session — ikona aplikacji na telefonie i l · L333 · iPhone Safari, prawdziwy telefon, staging, 390px: przycisk otwiera instrukcję w trzech krokach; po … — phone/PWA/push
- worker-pwa-install-and-long-session — ikona aplikacji na telefonie i l · L335 · Android z już zainstalowaną aplikacją, strona otwarta w karcie Chrome: przycisk jest ukryty albo po… — phone/PWA/push
- worker-pwa-install-and-long-session — ikona aplikacji na telefonie i l · L337 · iPhone, ikona na ekranie głównym: logo jest wyśrodkowane, z marginesem dookoła, nie dotyka krawędzi… — phone/PWA/push
- worker-pwa-install-and-long-session — ikona aplikacji na telefonie i l · L339 · Aplikacja zainstalowana (Android i iPhone): obok hamburgera jest strzałka wstecz na każdej stronie;… — phone/PWA/push
- company-knowledge — „Manual Wykończymy” w górnym pasku · L363 · `dump-knowledge-prod.ts` dla przypadku (sesja produkcyjna): `inputs/manual-i-komentarze-do-prac.md`… — real mail/SMS/Sheets write/production
- company-knowledge — „Manual Wykończymy” w górnym pasku · L367 · Po migracji na świeżej bazie (produkcja): wpisy „Wysokość pomieszczeń…”, „Otwory w glazurze…”, „Gla… — real mail/SMS/Sheets write/production
- ui-scale — rozmiar interfejsu na telefonie · L374 · Przy 70% na iPhonie: dotknięcie pola (np. kwota w „Dodaj transakcję”) nie przybliża strony, a wpisy… — phone/PWA/push
- pwa-push-notifications — powiadomienia push w zainstalowanej aplikacji · L405 · Produkcja, Android, zainstalowana aplikacja → menu mobilne → „Włącz powiadomienia” → zgoda w system… — phone/PWA/push
- pwa-push-notifications — powiadomienia push w zainstalowanej aplikacji · L407 · Produkcja, iPhone (iOS 16.4+) → w karcie Safari przełącznika nie ma; w aplikacji z ekranu początkow… — phone/PWA/push
- pwa-push-notifications — powiadomienia push w zainstalowanej aplikacji · L409 · Odmowa zgody na powiadomienia → zamiast przycisku napis „Powiadomienia są zablokowane — włącz je w … — phone/PWA/push
- pwa-push-notifications — powiadomienia push w zainstalowanej aplikacji · L411 · „Wyłącz powiadomienia” → `/api/test-push` zwraca `sent: 0` i na telefon nic nie przychodzi; to samo… — phone/PWA/push
- pwa-push-notifications — powiadomienia push w zainstalowanej aplikacji · L413 · Pracownik z włączonymi powiadomieniami zdezaktywowany („Aktywny” wyłączone) albo przeniesiony do ko… — phone/PWA/push
- pwa-push-notifications — powiadomienia push w zainstalowanej aplikacji · L415 · 390px → przełącznik na własnej stronie `/pracownicy/[id]` (obok „Zainstaluj aplikację”) i w stopce … — phone/PWA/push
- pwa-push-notifications — powiadomienia push w zainstalowanej aplikacji · L417 · Produkcja, iPhone pracownika z włączonymi powiadomieniami → zarząd księguje mu wypłatę → przychodzi… — phone/PWA/push
- pwa-push-notifications — powiadomienia push w zainstalowanej aplikacji · L419 · Ten sam pracownik „Potwierdzam” albo „Odrzuć” → liczba na ikonie znika od razu, bez zamykania aplik… — phone/PWA/push
- pwa-push-notifications — powiadomienia push w zainstalowanej aplikacji · L421 · Produkcja, Android → po zaksięgowaniu wypłaty powiadomienie dociera. — phone/PWA/push
- pwa-push-notifications — powiadomienia push w zainstalowanej aplikacji · L423 · „Rozlicz wypłaty” dla jednego pracownika na dwóch inwestycjach → przychodzi jedno powiadomienie z s… — phone/PWA/push
- investment-ai-stage — „Etap AI” na inwestycji · L428 · Po deployu i migracji produkcji: ustaw „Recenzja zakończona” na jednej inwestycji, uruchom `collect… — real mail/SMS/Sheets write/production
- report-line-decisions — „Przyjmij / Odrzuć” pozycja po pozycji · L452 · Nagłówki kolumn liczbowych w „Z rozpiski” (Zgłoszono, Przyjmuję, Etap, oba „Pomiar z natury”, Aktua… — Safari/WebKit _[Chrome half already passed]_
- mobile-table-font — 12px w tabelach i kosztorysie na telefonie · L466 · Telefon (iPhone) → raport pracownika (`/z/…`): stuknij w komórkę ilości i zacznij pisać — strona si… — phone/PWA/push
- textarea-safari-rows — pole tekstowe rośnie z treścią w starszym Safar · L495 · Safari 18.x → strona inwestycji z długą, wielolinijkową notatką → „Edytuj notatkę”: pole otwiera si… — Safari/WebKit
- textarea-safari-rows — pole tekstowe rośnie z treścią w starszym Safar · L499 · Safari 18.x → dowolne inne pole wielolinijkowe (np. powód anulowania, notatka pozycji w katalogu pr… — Safari/WebKit
- kosztorys-editor-text-size — wielkość czcionki w edytorze kosztorysu · L511 · Telefon (390px), kosztorys: wejście w edycję komórki nie powiększa strony (brak zoomu iOS). — phone/PWA/push
- vertical-header-safari — pionowe nagłówki w Safari · L519 · **Safari** → okno przyjmowania zgłoszenia, tabela „Z rozpiski”: nagłówki „Pomiar z natury” z dopisk… — Safari/WebKit
- vertical-header-safari — pionowe nagłówki w Safari · L523 · Safari, to samo okno zwężone: nagłówek, który zawija się do dwóch linii, nadal mieści się w swojej … — Safari/WebKit
- kosztorys-ai-rounds — kolejne rundy AI: „Nowe informacje” i „Do ponown · L540 · Wczytanie szkicu rundy 2 z trzema wierszami (jedna pozycja zmieniona, jedna na 0, jedna nowa): flag… — dev tooling with no UI _[script-only (load-ai-draft.ts ROUND=2), no UI path]_
- szablon-own-structure — szablon jako odwołania do katalogu prac · L681 · Ładowarka kosztorysu AI na szablonie (lokalnie): pozycje w brzmieniu katalogu, bez duplikatów. — dev tooling with no UI _[local AI loader script]_
- umowa-dialog — „Umowa” generowana z widoku inwestycji · L969 · „Generuj” w Chrome z „Marginesy: Brak”, a potem z „Domyślne” → w obu przypadkach strona 2 i kolejne… — Safari/WebKit _[Chrome half checkable at 3/MANAGER]_
- umowa-dialog — „Umowa” generowana z widoku inwestycji · L976 · „Generuj” z pustym Numerem, PESEL-em i terminami → podgląd wydruku: kropkowane puste miejsca, „zwan… — Safari/WebKit _[Chrome half checkable at 3/MANAGER]_
- worker-pdf-totals — sumy kolumn i łamanie stron w PDF pracownika · L1047 · PDF zapisany z Safari: ostatnia litera „zł” w skrajnej prawej kolumnie nie jest obcięta, a kwota w … — Safari/WebKit
- worker-pdf-totals — sumy kolumn i łamanie stron w PDF pracownika · L1050 · PDF z Safari dla kosztorysu na 2+ strony: żaden wiersz nie jest rozcięty (opis na jednej stronie, k… — Safari/WebKit
- transfer-actions-db-spec — anulowanie i edycja kwoty zapisują się raze · L1096 · Anuluj wydatek materiałowy inwestycji podpiętej do arkusza: jego wiersz znika z arkusza jak dotąd. — real mail/SMS/Sheets write/production _[Sheets write]_
- EX-1076 — daily-snapshot-change-detection — nocna kopia kosztorysu tyl · L1190 · Noc po najbliższym wdrożeniu, które dokłada pole do pozycji kosztorysu (odczyt z proda, tylko SELEC… — real mail/SMS/Sheets write/production _[prod SELECT the night after a deploy]_
- prepush-overlap — testy w hooku pre-push równolegle · L1244 · Następny prawdziwy `git push`: najpierw nagłówek „unit tests + typecheck + DB integration specs, pa… — dev tooling with no UI
- prepush-overlap — testy w hooku pre-push równolegle · L1248 · Push z celowo zepsutym typem: hook się zatrzymuje, kończy linią „✗ pre-push FAILED at: typecheck”, … — dev tooling with no UI
- e2e-run-speed — E2E bez zbędnego buildu, na świeżej bazie · L1289 · Następny pełny `pnpm test:e2e`: na początku „test DB: cloned from template”, potem build bez sprawd… — dev tooling with no UI
- e2e-run-speed — E2E bez zbędnego buildu, na świeżej bazie · L1291 · Drugi `pnpm test:e2e` bez zmian w `src/` (zmieniony tylko spec): w logu „e2e build: reused”, serwer… — dev tooling with no UI
- big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy · L1600 · Z telefonu (IP w sieci LAN): „Wyślij SMS” otwiera Wiadomości z domyślnym dostawcą i treścią. — phone/PWA/push _[real phone + Messages app]_
- payout-push-unpause — push „Wypłata do potwierdzenia” włączony · L1641 · (tylko produkcja) Telefon z zainstalowaną aplikacją i włączonymi „Powiadomieniami”, aplikacja zamkn… — phone/PWA/push
- payout-push-unpause — push „Wypłata do potwierdzenia” włączony · L1644 · Stuknięcie w to powiadomienie otwiera stronę pracownika z wypłatą do potwierdzenia; po potwierdzeni… — phone/PWA/push

### Counts

| Bucket                                              | Boxes   |
| --------------------------------------------------- | ------- |
| Stage A — EMPLOYEE + MANAGER cells                  | 148     |
| Stage B — OWNER cells                               | 31      |
| Stage C — row L (logged-out/share)                  | 2       |
| ai?                                                 | 11      |
| out — phone/PWA/push                                | 23      |
| out — Safari/WebKit                                 | 11      |
| out — real mail/SMS/Sheets write/production         | 12      |
| out — dev tooling with no UI                        | 13      |
| out — needs real time to pass with no cron stand-in | 0       |
| **Total**                                           | **251** |

## Tests & suite

- Stage A: `optimistic-form-store.test.ts` 17/17 green (`10cd3cbfa`).
- Stage B: no fix, no spec.
- Stage C: no fix, no spec.
- Whole-tree gate: not run — on the user's ask only.

## Close-out

- Registry sweep (2026-10-19): 24 fully ticked sections collapsed into index rows, 154 ticked boxes removed
  from open sections; 187 open boxes kept (count unchanged).
- Still open: the three doubtful findings above (owner's call), and the registry box for the gray select
  arrows (`c7c47299f`) — the deployed staging build `9d7572296` predates the fix.
- Teardown: nothing to stop — the run used deployed staging, no local dev server, no `tsconfig.json` drift.
