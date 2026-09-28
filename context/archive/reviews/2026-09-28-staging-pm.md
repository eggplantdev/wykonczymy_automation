# Review-gate ledger — staging `39e34155..4202d1dd` · 2026-09-28 (popołudnie)

Zakres: wszystko po domknięciu porannej bramki (`2026-09-28-staging.md`, ostatni commit `39e34155`)
do `4202d1dd`, plus `bf28bb57` (przycisk Admin w sidebarze — wszedł gałęzią kosza, poranny ledger go
nie wymienia). 152 pliki poza `context/`, +5736/−1157.

Changey: `kosztorys-worker-view` (EX-875, implementing), `protokol-odbioru` (implemented),
`kosztorys-client-view-auto-columns` (implementing), EX-880 (`eac747ee`, split `constants.ts`),
luźne: `170d5586`, `58e2f89b`, `4202d1dd`, `bf28bb57`.

Fan-out: impl-review (3 plany) · code-review (high, ×3 po changeach) · tailwind-v4 ·
feature-first + module-cohesion + structure-scatter (diff-scoped) · comment-noise (flag-only).

Step 0.5 (verify-manual-checks / przeglądarka) — POMINIĘTY: nie było o to prośby.

## Findings

<!-- correctness: impl-review + code-review (×3), zweryfikowane w kodzie przed triage; duplikaty scalone -->

- [x] 🟡 WARNING · fixed · impl-review + code-review · `src/lib/kosztorys/acceptance-protocol/investment-update.ts:19` · pusta osoba kontaktowa + zmiana samego adresu → nazwa inwestycji zapisywała się jako `contactPerson` (Zamawiający seedowany z `investment.name`); dotyczy 129/138 inwestycji — nietknięty prefill zostawia `investment.contactPerson`
      test: test-driven-debugging · unit — `investment-update.test.ts`: pusty contactPerson + edycja adresu → contactPerson zostaje `''` (czerwony → zielony)
- [x] 🟡 WARNING · fixed · impl-review + code-review · `src/lib/kosztorys/acceptance-protocol/settlement.ts:62` · „Robocizna" na protokole była po rabacie — decyzja ownera: jak „Podsumowanie", Robocizna przed rabatem + osobny wiersz „Rabat"
      test: test-driven-debugging · unit — `settlement.test.ts`: rabat > 0 → Robocizna przed rabatem, wiersz Rabat = −rabat, Suma/Pozostało bez zmian
- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/acceptance-protocol/investment-update.ts:14` · „Zaktualizuj dane inwestycji" odsyłał CAŁY rekord ze snapshotu — nowa wąska `updateInvestmentClientFieldsAction` (`lib/actions/investments.ts`) pisze tylko `contactPerson` + `address`
      test: TDD · unit — `investment-update.test.ts`: dane zapisu to wyłącznie `contactPerson` + `address`; sama akcja to cienki `protectedAction` → `payload.update`, bez osobnego speca
- [x] 🟡 WARNING · fixed · impl-review + code-review · `src/lib/kosztorys/offer-print/build-offer-print-html.ts:71` · PDF oferty drukował kolumny rabatu pozycji przy aktywnym rabacie globalnym — filtr tą samą regułą co grid (`bypassedByGlobalDiscount`, `column-config.ts`)
      test: TDD · unit — `build-offer-print-html.test.ts`: rabat globalny + zaznaczone kolumny rabatu → brak ich w nagłówku
- [x] 🟡 WARNING · skipped · impl-review · `toolbar/menus/kosztorys-workers-menu.tsx:55`, `worker-view/assigned-workers.ts:18` · linku pracownika nie da się odwołać przy zablokowanym zakresie / bez etapów — decyzja użytkownika: „olewka"
      test: no automated test — świadomie nie naprawiane
- [x] 🔵 OBSERVATION · fixed · code-review (×2) · `editor/actions/investor-actions.tsx:74-80` · „Udostępnij" rotował istniejący link przy nakładających się kliknięciach — `ensureShareLinkAction` (`writeShareToken(…, { rotate: false })`), jeden round-trip zamiast dwóch
      test: TDD · integration — `share-token.test.ts`: ensure przy istniejącym wierszu nie nadpisuje tokenu (5435)
- [x] 🔵 OBSERVATION · fixed · code-review · `editor/actions/investor-actions.tsx:94` · `requestShare` bez guardu latest-wins — `useLatestRequest`, jak bliźniak pracownika
      test: no automated test — ten sam prymityw co `worker-actions.tsx`, pokryty tam
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `editor/dialogs/acceptance-protocol-dialog.tsx:104` · `setIsSaving(true)` bez try/finally → try/finally + toast błędu
      test: no automated test — kopia wzorca z `add-items-from-catalogue-dialog.tsx:173`
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `src/lib/utils/date.ts:2` · `today()` = UTC → 00:00–02:00 wczorajsza data; `today` usunięty, 5 wywołań na `warsawToday()` (`lib/utils/days.ts`); /simplify dogonił szóstą, inline kopię w `cancelTransferAction` (`lib/actions/transfers.ts:226`)
      test: TDD · unit — `days.test.ts`: 00:30 Warszawa → dzisiejsza data
- [x] 🔵 OBSERVATION · fixed · code-review · `sheet-import/resolve-columns.ts:197` · etapy od kolumny A → `description = -1`, import `ok: true` z pustym kosztorysem — przywrócony guard, problem zamiast sukcesu
      test: TDD · unit — `resolve-columns.test.ts`: marker etapów w kolumnie A → `ok: false` z problemem
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/nav/admin-button.tsx:15` · tooltip „Admin" w zwiniętym sidebarze się nie otwierał (potwierdzone) — `TooltipTrigger asChild` przekazuje handlery/ref, a 5 komponentów (Admin, ThemeToggle, RefreshDataButton, LogoutButton, NavLinkItem) je gubiło; teraz rozlewają `...props` na `Button`
      test: TDD · dom — `components/nav/sidebar.test.tsx`: hover na każdym zwiniętym triggerze pokazuje tooltip (6/6)
- [x] 🔵 OBSERVATION · fixed · code-review · `offer-print/columns.ts:155` · `c-stage-qty` miało szerokość tylko w `WIDE_PRINT_STYLES` — dodane do `OFFER_PRINT_STYLES`
      test: no automated test — layout druku, ocena wzrokowa
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/kosztorys/header-tips.ts:29,36` · tipy nagłówków pracownika tłumaczyły rabat klienta — zamiast proponowanego „bez tipów" (skasowałoby też tipy pisane dla wykonawcy): `WORKER_HEADER_TIPS` nadpisuje trzy kolumny pod `workerSurface`
      test: no automated test — dobór tekstu podpowiedzi
- [x] 🔵 OBSERVATION · fixed · impl-review · `settlement-columns.ts:7` · „Kwota rabatu" (netto/brutto) teraz w zbiorze „pokazuj tylko przy wpisach" — decyzja użytkownika
      test: TDD · unit — `settlement-columns.test.ts`: brak wpisów → kolumny kwoty rabatu w zbiorze pustych
- [x] 🔵 OBSERVATION · dropped · impl-review · `migrations/20260928_2_client_view_single_set.ts:29` · `hide_empty_rows` bez `NOT NULL` — nieszkodliwe (ADD wypełnia, backfill nie da NULL, sanitizer czyta nie-`false` jako `true`); migracja już na preview
      test: no automated test — brak zachowania do ochrony

<!-- plan / docs drift -->

- [x] fixed · impl-review · `acceptance-protocol/constants.ts:3`, `build-protocol-html.ts:65,92` · odwrócone decyzje z change.md — potwierdzone jako decyzje ownera, zapisane w `protokol-odbioru/change.md` („Decyzje")
- [x] fixed · impl-review · `context/reference/kosztorys-editor-domain-notes.md:383` · PDF pracownika niesie te same kolumny i kolejność co podgląd, łącznie z Σ etapów i Wartością wykonaną
- [x] fixed · impl-review · `2026-09-28-kosztorys-worker-view/plan.md` · addendum „As built" (trasy, `proxy.ts`, `ViewSettingsFields`/`ShareLinkPanel`, `buildKosztorysPrintHtml`, `sectionName`, kolejność kolumn, `share-token.ts`)
- [x] fixed · impl-review · `context/foundation/manual-checks.md` · nowa sekcja `kosztorys-worker-view` (4 podsekcje) + 2 checki protokołu (wiersz Rabat; zapis samego adresu)
- [x] dropped · impl-review · `protokol-odbioru/plan.md` · planowany zod-schema formularza nie powstał — Select + wolne stringi; odnotowane w planie („As built")
- [x] fixed · impl-review + code-review · `offer-print-action.tsx:25`, `hooks/use-investor-impact-confirm.ts:6` · przestarzałe komentarze po usunięciu trybu — przepisane

<!-- cleanups (reuse / simplify) -->

- [x] fixed · code-review · `lib/actions/kosztorys-worker-share.ts:40-70` vs `kosztorys-share.ts:36-62` · mint/rotate/race-recovery → `lib/kosztorys/share-token.ts` (`writeShareToken`, `findShare`, `deleteShare`, `TOKEN_BYTES` raz)
- [x] fixed · code-review · `offer-print/worker-columns.ts:38` · `moneyColumn`/`qtyColumn`/`stageQtyColumns` wspólne z `columns.ts`
- [x] fixed · code-review · `grid/column-selection.ts:188-192` · early return `documentOrder` przed komentarzem, komentarz nad swoim bailem
- [x] dropped · code-review · `kosztorys-worker-share.ts:44` · mint buduje całe drzewo dla samych etapów — akcja klikana raz, brak helpera stages-only
- [x] dropped · code-review · `nav/admin-button.tsx:26` · `next/link` → `<a>` dla `/admin` — niezmierzony zysk
- [x] dismissed · code-review + feature-first F4 · `acceptance-protocol/investment-update.ts:1` · lib importuje typ z `components/forms/…` — repo akceptuje ten kierunek (9 plików `lib/actions`), type-only

<!-- feature-first / cohesion / scatter -->

- [x] fixed · feature-first F1 · `lib/actions/kosztorys-worker-share.ts:26` (+ `kosztorys-share.ts:22`) · odczyty `get*ShareLinkAction` → inwestor przez `ensure`, pracownik `lib/queries/worker-share-link-endpoint.ts` (`readWorkerShareToken`)
- [x] fixed · feature-first F2 · `offer-print/print-popup.ts` · `writeAndPrint` → `lib/utils/print-window.ts`; `resolveSectionFills` zostaje
- [x] fixed · cohesion C4 · `worker-view/constants.ts` → `worker-view/labels.ts`
- [x] dropped · cohesion C5 · `editor/use-kosztorys-editor.ts` · leaf hook dla klastra pracownika — `documentSettings` musi poprzedzać `stages`, parametry ≈ ciało; przenosiny bez zysku
- [x] filed · scatter S1 + cohesion C1 + feature-first F3 · `lib/kosztorys/{client-view-settings,investor-share-url,column-config}.ts` · `client-view/` lustrzanie do `worker-view/` — filed EX-887
- [x] filed · scatter S2 + cohesion C2 · `lib/kosztorys/offer-print/` → `print/` — filed EX-887 (razem z S1)
- [x] dropped · scatter S3 · `lib/queries/*-endpoint.ts` vs nazwy od zwracanej rzeczy · 3 vs 4 pliki, obie grupy czytelne
- [x] dropped · cohesion C3 · `acceptance-protocol/constants.ts` · 2 eksporty
- [x] skipped · scatter (junk drawer) · `editor/dialogs/` (39 plików), `lib/kosztorys/` (94) · pre-existing; reorganizacja to osobna zmiana
- [x] dismissed · feature-first · reszta nowych plików · właściwe warstwy, testy lustrzane, brak importu `ui/` → feature

<!-- tailwind-v4 -->

- [x] dismissed · tailwind · `acceptance-protocol-dialog.tsx:200` · `gridTemplateColumns` z `minmax(...)` przez istniejący prymityw `summary-grid.tsx` — brak formy utility
- [x] dismissed · tailwind · `summary/totals-panel-overlay.tsx:24,28` · `transition-[height]`, `data-[state=closed]` — przeniesione, nie nowe; v4 nie ma tokenu, `data-closed:` nie pasuje do Radixa

<!-- comment-noise (flag-only, zastosowane w /simplify) -->

- [x] fixed · comment-noise · 16 usunięć + 9 przycięć (narracja propsów/nagłówków, powtórzenia nazw `it()`)
- [x] fixed · comment-noise · polskie frazy w komentarzach → angielski (`labels.ts`, `worker-view/summary.ts`, `form-defaults.ts`, `decimal-field.tsx`, `flagged-tone.ts`); rzeczowniki arkusza zostają
- [x] fixed · comment-noise + code-review · `nav/admin-button.tsx:23` · komentarz opisuje teraz tylko stałą przyczynę (względny URL)

<!-- /simplify (reuse / simplification / efficiency / altitude) -->

- [x] fixed · simplify · `lib/kosztorys/share-token.ts:28,50` · `writeShareToken` zwraca `ActionResultT<string>`; `shareTokenResult` usunięty
- [x] fixed · simplify · `worker-view/share-row.ts` · `investorShare`/`workerShare`/`WorkerShareKeyT` obok `ShareRowT` w `share-token.ts`; plik usunięty
- [x] fixed · simplify · `acceptance-protocol/investment-update.ts:15,26` · reguła „Zamawiający nietknięty" 2× → `isClientNameUntouched`
- [x] fixed · simplify (reuse + simplification + altitude) · `build-offer-print-html.ts:79`, `column-selection.ts:113,157` · reguła rabatu globalnego 3× → `bypassedByGlobalDiscount` w `column-config.ts` (`DISCOUNT_COLUMN_IDS` prywatne); głębsze „jedna funkcja zbioru kolumn dla podglądu i druku" nie usuwa kopii w gridzie właściciela, więc predykat wystarcza
- [x] fixed · simplify (reuse + simplification) · `offer-print/worker-columns.ts:77`, `columns.ts:211` · kolumny wartości etapu netto 2× → `stageNetColumns(stages, money)`; `perStage` na poziomie modułu, `stageNetValue` prywatne
- [x] fixed · simplify (altitude) · `grid/kosztorys-v2-columns.tsx:287,302` · flaga `workerSurface` przy każdym wywołaniu → `stageValueHeader` przyjmuje klucz grupy i sam rozwiązuje tip (brutto dostaje flagę automatycznie)
- [x] dismissed · simplify · `header-tips.ts:54` · „przekaż `opts` wprost" — `opts.workerSurface` to obiekt ustawień, nie boolean; zostaje `!!opts.workerSurface`, teraz tylko w `column-headers.tsx`
- [x] dropped · simplify (efficiency) · `share-token.ts`, `lib/actions/investments.ts` · `depth: 0` na `update`/`create` — kilka SELECT-ów na kliknięcie, ~5 użytkowników
- [x] dismissed · simplify (efficiency) · reszta — `ensure` usuwa round-trip, `headerTipFor` per kolumna nie per wiersz, `rows.some` raz na wydruk

<!-- primitive-reuse-scan -->

- [x] dismissed · reuse-scan · nowy kod diffu vs katalog (`lib/utils`, `hooks`, `forms/hooks`, `lib/kosztorys/**`, `ui/`) · `share-token.ts` to jedyny minter tokenów; akcja na `protectedAction` + `validateAction`; druk na `openPrintWindow`/`writeAndPrint`; latest-wins przez `useLatestRequest`; daty `warsawToday`; kwoty `formatPLN`/`zloty`. Dwie prawdziwe re-implementacje (reguła rabatu globalnego, kolumny wartości etapu) już naprawione wyżej pod `simplify`
- [x] dropped · reuse-scan · `findShare` vs ~10 ręcznych `payload.find({ where: equals, limit: 1 })` (`sheet-lookup.ts:25`, `store-lead.ts:32`, `worker-kosztorys.ts:57` …) · wszystkie sprzed diffu; wspólny `findOneBy` z typowaniem kolekcji Payloada to refaktor na 10 plików za kilka linijek zysku
- [x] dismissed · reuse-scan · `lib/actions/workers.ts:17` `crypto.randomUUID()` obok `randomId()` · sprzed diffu; `randomId` istnieje dla przeglądarek bez secure context, serwer go nie potrzebuje

## Simplify pass

Ran /simplify — 7 applied, 0 proposed, 3 dismissed/dropped; primitive-reuse-scan — 0 nowych, 1 dropped, 2 dismissed; each finding folded into ## Findings (tagged simplify / reuse-scan). Raport: w tym pliku (bez osobnego).

## Tests & suite

- tsc — czysto
- vitest (celowane: protokół, share, offer-print, grid, worker-view, akcje edytora, nav) — 307 zielonych; DB `share-token` + `worker-share-token` na 5435 — 14/14
- pełny suite — odłożony przez użytkownika (drzewo współdzielone z innymi agentami, wynik byłby niemiarodajny)
