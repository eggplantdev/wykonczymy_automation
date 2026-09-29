# Manual verification

One living checklist for every slice — the project's QA registry. Each `##` section is a slice/change; tick boxes by hand (or point an agent at a section: "drive these checks with Playwright and report" — the `verify-manual-checks` skill) as you verify. Lives in `context/foundation/` (not the change folder) so it survives `/10x-archive` and never freezes stale. A slice with unticked boxes here is **not** `Done` — manual checks are a hard blocker (see `/10x-implement`). Not gated by CI.

**Run against the isolated test DB, not the dev DB.** Manual checks mutate data, so point the app at the `db-test` container on **5435** (`DB_POSTGRES_URL_TEST`, `wykonczymy-test`) — the same DB the E2E suite uses — never the dev DB (5433, holds un-dumped local work) and never prod. Kosztorysy **są** w dumpie proda — `pnpm db:import:test` daje 65 kosztorysów / 4130 pozycji (policzone 2026-09-17), więc baza testowa nie jest pusta dla przepływów kosztorysowych. Seeduj tylko wtedy, gdy sprawdzenie potrzebuje **znanego** kształtu: `seed-kosztorys.ts` dla realistycznej rozpiski (czyta żywy arkusz wzorcowy) albo `perf-seed-kosztorys.ts` dla ~1000 syntetycznych wierszy, gdy sprawdzasz wydajność siatki — z DB env seeda wskazanym na `DB_POSTGRES_URL_TEST`.

**Ten plik został przycięty 2026-09-15** — agent czyta go przy każdym przebiegu, a 5,5 tys. linii to
w 90% dowody weryfikacyjne zamkniętych slice'ów, nie instrukcje. Zostają **wyłącznie sekcje z
nieodhaczonymi boksami** plus indeks zamkniętych przebiegów na końcu.

- **Pełny zapis, verbatim:** `git show d426e567^:context/foundation/manual-checks.md` — 94 sekcje,
  71 bloków `### Findings`, komplet dowodów. Agenci nie czytają `context/archive/`, więc sięga się
  tam świadomie, gdy trzeba odtworzyć, **jak** coś zweryfikowano.
- **Trwała wiedza z tych przebiegów** została wydestylowana do żywych dokumentów: reguły inżynierskie
  do `context/foundation/lessons.md`, realia środowiska QA (blokady, konta, techniki obejścia) do
  `context/reference/manual-verification.md`.
- Dopisując nową sekcję, pisz **check**, nie sprawozdanie. Dowód („zweryfikowane na inw. 135, SQL
  pokazał…") jest wart tyle, ile długo boks jest otwarty — po odhaczeniu zostaje sam boks.
- **Sekcja powstaje dopiero, gdy kod istnieje.** Boks opisuje zachowanie działającej aplikacji, więc
  sprawdzenie funkcji, której nie ma na żadnym branchu, nie może ani przejść, ani paść — to fragment
  planu, nie wynik QA, i puchnie rejestr o wiecznie otwarte boksy blokujące slice, którego nikt nie
  zaczął pisać. Checklistę wyprowadzoną z `plan.md` trzymaj w folderze zmiany
  (`context/changes/<id>/manual-checks.md`) i przenieś ją tutaj przy `/10x-implement`. Precedens:
  `kosz-plikow` — 11 boksów wyciętych stąd 2026-09-23.

## Stałe blokady

Cztery powody trzymają **wszystkie** otwarte boksy poniżej. Żaden nie jest defektem i żadnego nie
zamknie kolejny przebieg weryfikacji — dopóki trwają, te boksy zostają otwarte:

1. **`/raporty` jest wygaszone do czasu EX-598.** `src/app/(frontend)/raporty/page.tsx` renderuje
   bezwarunkowo `EmptyState` „W budowie" — na trasie nie ma żadnych kafli ani liczb, do których
   można by przyłożyć check.
2. **Poczta nie wychodzi poza produkcją.** `EMAIL_HOST` = `disabled.invalid` (AGENTS.md), więc
   dostawy ani treści maila nie da się zaobserwować; każdy check „przychodzi mail o treści X"
   wymaga człowieka z prawdziwą skrzynką. Sygnałem, że kod doszedł do wysyłki, jest **500** z trasy
   crona — wyjątek DNS, nie usterka.
3. **Trasy crona na Preview stoją za Vercel SSO** i wymagają `CRON_SECRET`, którego przebieg nie ma.
   Obejście do połowy licznikowej opisuje `context/reference/manual-verification.md`.
4. **Brak dostępu do skrzynki odbiorczej** — osobno od (2): nawet z produkcyjnym mailem treść
   trzeba obejrzeć okiem.

# Otwarte

## EX-594 — investment-summary-panel

26/27 odhaczone (ostatni przebieg 2026-09-03, staging). Pełny zapis: archiwum.

- [ ] `/raporty` renderuje kafle dokładnie jak przedtem, z odznaczaniem włącznie — **blokada 1**
      (trasa wygaszona do EX-598). Do przejechania dopiero, gdy EX-598 przywróci `/raporty`.

### Findings — 2026-09-23 (staging/preview pass)

- Blokada 1 nadal aktualna: `src/app/(frontend)/raporty/page.tsx` renderuje bezwarunkowo
  `EmptyState` „W budowie" (kod przeczytany na żywo, commit `e0158cb8`) — na trasie nie ma żadnych
  kafli. Boks zostaje otwarty, nic do zrobienia poza EX-598.

## EX-596 — materials-net-pricing-persisted

15/16 odhaczone (ostatni przebieg 2026-09-04, staging). Pełny zapis: archiwum.

- [ ] `/raporty` pokazuje baner ostrzegawczy nad liczbami bez przewijania — **blokada 1**. Na trasie
      nie ma żadnych liczb, nad którymi baner miałby stanąć. Nie jest blokerem dla samego EX-596:
      bramka jest świadoma i starsza niż ten boks.

### Findings — 2026-09-23 (staging/preview pass)

- Blokada 1 nadal aktualna — ta sama trasa i ten sam kod co w EX-594 powyżej. Boks zostaje otwarty.

## EX-574 — cancellation-sum-overcount

Repro + żywe liczby: `context/archive/2026-07-28-cancellation-sum-overcount/change.md`. Liczby
poniżej chodzą za lokalnym dumpem produkcji — przepuść najpierw jego SQL.

**Cała sekcja stoi na blokadzie 1** (`/raporty` wygaszone do EX-598). Sama poprawka jest
zweryfikowana na poziomie kodu i bazy — `stripCancelledFilters()`
(`src/lib/queries/transfer-filters.ts`) zdejmuje wyłącznie klucz `cancelled` i zachowuje domyślne
`type: { not_in: ['CANCELLATION'] }`, co pinuje spec `transfer-filters.test.ts`. Otwarte zostają
wyłącznie boksy UI.

### Faza 1: kafel przestaje liczyć anulowania

- [ ] `/raporty?from=2026-03-01&to=2026-03-31` — kafel czyta 4 202 513,34 zł, nie 7 192 866,38 zł.
- [ ] Ten sam URL z `&type=` wymieniającym każdy typ poza CANCELLATION daje _ten sam_ kafel i tę samą listę 379 wierszy.
- [ ] Styczeń i luty 2026 (zero anulowań) bez zmian — 354 675,00 i 191 030,00.
- [ ] `?cancelledTransactionAudit=1` dalej pokazuje niezerowy kafel (odrzucona poprawka wyzerowałaby go).

### Faza 2: sufit filtra kwoty dochodzi do kafla

- [ ] `/raporty?amount=500,00` — 20 wierszy na 10 000,00 zł i kafel 10 000,00 zł.
- [ ] `/raporty?amount=500` (prefiks, bez separatora) dalej listuje każdą kwotę zaczynającą się od 500, a kafel się zgadza.

### Faza 3: kafel mówi, co liczy

- [ ] `/raporty?showCancelled=1` z aktywnym filtrem — przy kaflu stoi (i) mówiące, że suma pomija anulowane transakcje.
- [ ] Bez `showCancelled` żadnego (i) nie ma.

## cron-lead-reconcile (EX-416)

Setup: aplikacja lokalnie (`.env` → dev DB 5433), `CRON_SECRET` z `.env`. Wywołania Graph idą w
**żywe dane Meta** nigdy niewygasającym tokenem Page, więc sweep naprawdę wstawia leady — nigdy na
produkcję.

4/7 odhaczonych. Trasa wywołana ręcznie na produkcji zwróciła 200 z licznikami
(`added:0, scanned:30`), a `vercel crons ls` potwierdza rejestrację `0 4 * * *` na Production.

- [ ] Wywołanie z poprawnym `CRON_SECRET` zwraca liczniki, a przebieg, który odzyskał leada, dostarcza
      mail alertowy na listę „Alerty techniczne" — **blokady 2 i 3**. Połowa licznikowa domknięta
      (200 + liczniki z produkcji). Zostaje wyłącznie noga mailowa i jej **nie da się wymusić bez
      szkody**: `notifyReconcileRecovery` leci tylko przy `added > 0`
      (`src/app/(payload)/api/cron/leads-reconcile/route.ts:25`), a skoro webhook działa, sweep nie ma
      czego odzyskiwać — zobaczenie tego wymagałoby skasowania prawdziwego zgłoszenia z produkcyjnej
      bazy. Świadomie tego nie robimy.
- [x] **Linear: EX-926.** **Otwarty defekt: warunek flagi „nasycony formularz" jest zły.** `rawLeads.length >= PER_FORM_LIMIT`
      mówi „strona pełna", a znaczenie ma „strona pełna **i wszystkie zgłoszenia na niej były nowe" —
      dopiero to dowodzi, że zaległość sięga dalej niż okno. Jedno znane zgłoszenie na stronie dowodzi,
      że dziura jest domknięta. Przebieg 2026-09-15 na produkcji pokazał to wprost: pełne 30, zero nowych,
      flaga podniesiona bez powodu — uśpiony formularz z długą historią zawsze oddaje pełną stronę starych
      zgłoszeń. `captureLead` zwraca już `created`, więc poprawka to policzenie nowych i porównanie
      z rozmiarem strony. *(Osobno domknięte 2026-09-15: `PER_FORM_LIMIT` podniesiony 30 → 100, stała
      eksportowana, `reconcile-sweep.test.ts` liczy z niej zamiast z wpisanego na sztywno 30.)*
      **Test disposition:\*\* TDD · unit — „pełna strona, zero nowych → brak flagi" pada dziś na czerwono.
- [x] Zepsuj token Meta, uderz w trasę poprawnym sekretem → **500** _i_ mail „🚨 Cron odzyskiwania
      zgłoszeń nie zadziałał" ląduje na liście „Alerty techniczne" — **blokada 2**, boks zwężony do samego
      doręczenia SMTP. Przebieg 2026-09-15 (lokalnie, 5435, token zepsuty wyłącznie w środowisku procesu —
      `.env` i produkcja nietknięte) potwierdził cały łańcuch na żywym odrzuceniu Mety: zły sekret → 401;
      poprawny → **500** `{"error":"Reconcile failed"}`; `listLeadForms()` rzuca przed pętlą (status 401
      od Grapha), więc leci zewnętrzny `catch`, nie ścieżka `failedForms`; `alertSweepFailure` rozwiązał
      odbiorców `opsAlerts` z bazy i doszedł do wysyłki, która padła na `ENOTFOUND disabled.invalid` —
      czyli na bramce pocztowej, nie na błędzie kodu.
      **Odhaczone 2026-09-15: właściciel potwierdził, że maile dochodzą.** To domyka jedyną brakującą
      nogę — doręczenie SMTP z produkcji. Potwierdzenie dotyczy **doręczenia**, nie **treści**: boksy
      floty i sprzętu sprawdzają, co dokładnie stoi w mailu, więc zostają otwarte.

## lead-recovery-notifies-sales (EX-660)

Setup jak w `cron-lead-reconcile`. **Uwaga:** te checki czytają żywe dane Meta i wysyłają prawdziwy
mail na listy „Powiadomienia o nowych zgłoszeniach" i „Alerty techniczne" — a przy regresji na
prawdziwy adres klienta. Warunek wstępny: lead obecny w oknie Meta, a nieobecny lokalnie.

2/4 odhaczone. Domknięte strukturalnie: klient **nie dostaje nic**, bo `reconcile-sweep.ts:91`
podaje `autoReply: 'skip'`, więc `sendAutoReply` nie jest w ogóle wołane (12 odzyskanych leadów
wylądowało z `auto_reply_status = 'skipped'`), a defekt, który EX-660 naprawiał (oba statusy na
`skipped`), **nie jest odtwarzalny** — `notify_status` siada na `failed`, czyli próbowano.

- [ ] Przebieg sweepa (cron `/api/cron/leads-reconcile`) → skrzynka sprzedaży dostaje jedno zwykłe
      „Nowe zgłoszenie", nieodróżnialne od webhookowego — **blokada 2**. Kod gwarantuje
      nieodróżnialność strukturalnie: obie ścieżki wołają ten sam `captureLead` → `notifyNewLead`
      (`src/lib/leads/capture-lead.ts:71`),
      różni je wyłącznie opcja `autoReply`. Została sama dostawa.
- [ ] Dokładnie jeden mail podsumowujący, wyłącznie na „Alerty techniczne" (nie do sprzedaży), bez
      danych kontaktowych i bez instrukcji „zadzwoń sam" — **blokady 2, 3 i 4**. Alert
      (`notifyReconcileFailure`/`notifyReconcileRecovery`) leci z trasy crona, która jest dziś
      jedynym wołającym sweepa — ręczny przycisk „Pobierz z Facebooka" został usunięty.

## EX-711 — moduł floty: przeglądy pojazdów i przypomnienia mailowe

27/28 odhaczone. Pełny zapis: archiwum.

- [x] Sześć boksów o treści i dostawie maila (jeden mail, dwa adresy, brak powtórki, tygodniowy
      re-alert, uciszenie po wpisie, linijka wymiany oleju z celem km) — **blokady 2, 3 i 4**.
      Logika digestu i routingu jest w pełni pokryta jednostkowo (`reminder-sweep.test.ts`,
      `should-notify.test.ts`, `notify.test.ts` — 34 asercje, zielone); brakuje wyłącznie żywej
      dostawy. Do zamknięcia: przebieg lokalny z prawdziwym transportem mailowym albo token
      obejścia ochrony deploymentu na Preview. _(Boks „Wymiana oleju — limit kilometrów" wyszedł z
      tej grupy 2026-09-15 — pytał o treść sekcji digestu, a ta jest zaasertowana w `notify.test.ts`.)_
      **Odhaczone 2026-09-15: właściciel potwierdził, że mail floty dochodzi i jego treść się zgadza.**
      To była jedyna luka, którą boks sam sobie wyznaczał — żywa dostawa. Zapis dla ścisłości, czym stoi
      każda z sześciu nóg po zamknięciu: jeden mail na dwa adresy i linijka wymiany oleju — obserwacja
      właściciela; brak powtórki nazajutrz, tygodniowy re-alert i uciszenie po wpisie — nadal na
      teście jednostkowym (`should-notify.test.ts`), bo to zachowanie rozciągnięte na dni, którego
      pojedyncza skrzynka nie rozstrzyga.

## EX-758 — Katalog narzędzi i urządzeń (rejestr sprzętu)

11/13 odhaczonych (ostatni przebieg 2026-09-04, staging). Pełny zapis: archiwum.

- [ ] Ręczne `GET /api/cron/equipment-reminders` z `Bearer $CRON_SECRET` wysyła mail o właściwej
      treści — **blokady 2 i 4**. Każde ogniwo **przed** wysyłką jest potwierdzone na żywo:
      autoryzacja (401 bez nagłówka), pusty digest (`200 {"sent":false}`), ponowne uzbrojenie po
      edycji gwarancji, brak stemplowania po nieudanej wysyłce. Fixture jest gotowy — sprzęt id 1
      („QA Wiertarka udarowa") stoi **niestemplowany**, więc pierwszy autoryzowany przebieg przy
      prawdziwym `EMAIL_HOST` da niepusty digest bez dodatkowego setupu.
      **2026-09-15: właściciel zgłasza, że żaden mail o sprzęcie jeszcze nie przyszedł — i to jest
      poprawne zachowanie, nie usterka.** Tabela `equipment` w zrzucie produkcji z tego samego dnia
      (17:22) ma **zero wierszy**: żadnego sprzętu, żadnej daty gwarancji. `buildEquipmentDigest`
      wpuszcza wyłącznie pozycje `IN_USE` z gwarancją kończącą się w oknie 7/30 dni, więc cron nie ma
      o czym pisać i słusznie kończy `{"sent":false}`. Boks nie domknie się sam z upływem czasu —
      **czeka na pierwszy wpis w rejestrze sprzętu z datą gwarancji w zasięgu 30 dni**; dopiero wtedy
      będzie co porównać ze skrzynką. (Fixture „QA Wiertarka udarowa" opisany wyżej żyje w bazie
      testowej, nie na produkcji.)

### Findings — 2026-09-23 (staging/preview pass)

- Stan danych zmienił się od 2026-09-15, wniosek nie: tabela `equipment` na preview ma teraz **1
  wiersz** (`id=1, „Młot duży yato wyburzeniowy", status IN_USE`), ale `warranty_until` jest **NULL**
  — nie fixture „QA Wiertarka udarowa" opisany w checku wyżej (ten żyje tylko w bazie testowej
  5435, nie na preview). `buildEquipmentDigest` wpuszcza wyłącznie `IN_USE` z gwarancją kończącą się
  w oknie 7/30 dni, więc digest jest dalej pusty z tego samego strukturalnego powodu, nie z braku
  wierszy. Blokady 2/3/4 (mail tylko z produkcji, crony za SSO, brak skrzynki) też bez zmian. Boks
  zostaje otwarty — czeka na wiersz z realną datą gwarancji w zasięgu, potem na człowieka z dostępem
  do produkcyjnej poczty.

## clean-texts-catalogue-names — nazwy prac z tabeli poprawek katalogu (2026-09-15)

Warsztat szablonu 4 (`/szablony/4`) jest fixturem: przed zmianą okno „Porównaj z katalogiem prac"
zgłaszało tam 30 prac spoza katalogu. Od EX-893 (2026-09-29) ten szablon to własna inwestycja
„kosztorys wzór testy 2 września 26" — adres `/szablony/<jej id>`, nie `/szablony/4`.

- [x] `/szablony/4` → „Porównaj z katalogiem prac" pokazuje **6** prac spoza katalogu zamiast 30,
      **bez klikania „Popraw literówki"** — zmierzone na dzisiejszym fixturze **30 → 5** (nie 6;
      patrz finding o dryfie). Ten sam skrypt na `86b40010` (commit przed zmianą) i na `f5f823d1`,
      ta sama kopia bazy, te same 202 pozycje: przed 30 spoza katalogu, po 5. Obietnica zmiany
      trzyma się co do joty, przesunęła się tylko liczba docelowa.
- [x] ~~Ta szóstka to 5 wariantów, które właściciel doprecyzował w katalogu~~ — skreślone
      2026-09-29: szablon jest żywym fixturem edytowanym od 2026-09-15, więc lista prac spoza
      katalogu zależy od jego bieżącej treści, nie od zmiany. Obietnicę zmiany pokrywa boks wyżej
      (ten sam skrypt przed/po na tej samej kopii bazy).
- [x] Przycisk „Popraw literówki" poprawia opisy; drugie kliknięcie pod rząd raportuje
      0 poprawionych
      _Zweryfikowano 2026-09-21 (staging): 88 wierszy zmienionych, drugie kliknięcie 0._
- [x] Żaden opis w rozpisce nie dostaje „[stary arkusz]"
- [x] J.m. zmienia się tylko według reguł „Popraw literówki" (`m2` → `m²`, spacje w wymiarach,
      `klp` → `kpl`), nigdzie indziej
      _Zweryfikowano 2026-09-21 (staging): przepisane j.m. to `m2` → `m²` i spacje; `klp` nie ma._
- [x] Snapshot sprzed kliknięcia jest na liście i przywraca stare opisy
- [x] Na inwestycji z podpiętym arkuszem Google porównanie z arkuszem nie zaczyna zgłaszać
      istniejących prac jako nowych

### Findings — 2026-09-15 (staging/preview pass)

- [x] **`/szablony/4` fixture absent on preview DB — resolved by verifying locally instead.**
      `kosztorys_presets` had 0 rows on the preview Neon branch, so this section cannot be verified
      on staging/preview at all — not "blocked for now", plainly **not the right environment** for
      it. This section's checks 1–6 are keyed to the `/szablony/4` fixture (`investmentId=151`),
      which only ever existed in the prod dump lineage (local `db-test` / dev / prod), never on the
      preview branch. **Verified instead against local `db-test`** (`pnpm db:import:test` +
      `pnpm db:migrate:test`, today's fresh prod dump — see the two findings below for what that
      pass found).
- [x] **Shared Playwright browser lock — resolved.** The Chrome process holding the shared MCP
      profile's CDP pipe was killed; `browser_tabs list` now returns cleanly (confirmed this pass —
      single tab, no "Browser is already in use" error) and the whole section was driven end-to-end
      through it.
- [x] **Dropped 2026-09-29 — fixture drift, not a defect; checks re-baselined above.** **`/szablony/4` katalog-comparison count and content have drifted from checks 1–2** — with
      zero clicks, „Porównaj z katalogiem prac" on investment 151 (backing `/szablony/4`) reports
      **5** prac spoza katalogu, not 6, and they are not the 5 „Klejenie paneli winylowych" wariants + „Dwukrotne gruntowanie…" the checklist names. The actual 5: „Docięcie i montaż progu" (no
      j.m.), „Klejenie paneli winylowych (m2)" (one row, not five), „Układanie paneli winylowych
      niski stopień skomplikowania prac (m2)", „Gładzie w miejscach po spękaniach (m2)", „Fugowanie
      ścian i podłóg (m2)". The template is a live, continuously-edited fixture (`kosztorys_presets`
      id 4, "kosztorys wzór testy 2 września 26") — someone has edited its rozpiska since this
      section's checks were authored on 2026-09-15, most likely already ran „Popraw literówki" once
      and/or hand-edited rows, changing which prace fall outside the katalog. Confirmed via
      `browser_navigate` + `browser_click` on `/szablony/4` → Opcje → Porównaj z katalogiem…, at
      `http://localhost:3010/szablony/4`, cross-checked against a snapshot restore to the exact
      pre-any-click DB state (see the idempotence finding below for the restore mechanics) — this
      isn't stale caching, it's the fixture's real current content.
      **Needs human:** decide whether checks 1–2 should be rewritten against the template's current
      content (re-baseline the checklist), or whether the template itself should be reset to the
      state the checklist describes (re-seed `kosztorys_presets` id 4 / investment 151's
      `kosztorys_items`). Either way the checklist as currently worded cannot pass again without one
      of those two actions.
      **Test disposition:** no automated test — this is fixture drift in a live, shared template
      that multiple people/sessions edit, not a code defect. The matching/fold logic these checks
      exercise is unit-covered (`catalogue-key*.test.ts`, `clean-description.test.ts`).
      **Re-confirmed 2026-09-21 on staging/preview itself** (this fixture now exists there too —
      `kosztorys_presets` id 4 carries 1 row after today's fresh prod-dump restore, so the earlier
      "absent on preview" blocker above no longer applies): zero-click „Porównaj z katalogiem prac"
      on `/szablony/4` now reports **41** prac spoza katalogu (63 "inne liczby") — drifted further
      still from the 5 seen on the prior local pass. Confirms this keeps moving with the shared
      fixture's content, not a one-off local artifact; the **Needs human** call above stands
      unchanged.
      **Re-confirmed again 2026-09-23** (zero-click „Problemy" counters on staging): **41** prac
      spoza katalogu, unchanged from 2026-09-21; „inne liczby" drifted 63 → 62. Same **Needs human**
      blocker — not re-litigated further this pass, since two independent prior passes already
      exhausted the analysis and the only open question is a human content decision.
- [x] **Dropped 2026-09-29 — fixture drift, not a defect; checks re-baselined above.** **„Popraw literówki" change count and the „only `klp`→`kpl`" claim have also drifted, but the
      button itself is correct and idempotent** — clicking it on investment 151's current data
      changes **88** rows (37 description-only, 65 unit-only, some overlapping), not the 24 checks
      3 names, and **zero** `klp` values exist anywhere in the investment before or after (the real
      unit rewrites are near-entirely `m2`→`m²`, plus spacing fixes like `12-20cm`→`12-20 cm`).
      Cross-validated three independent ways, all agreeing: (1) a standalone script importing the
      real `cleanDescription`/`cleanUnit` and running them over a DB dump of the 202 rows; (2) the
      project's own `src/scripts/fix-kosztorys-descriptions.ts` dry-run (`INV=151`) → `"opisy: 37 do
poprawy z 202 przejrzanych"`; (3) driving the actual button in the browser and diffing
      `kosztorys_items` before/after — exactly 88 rows changed, 0 rows gained `[stary arkusz]`, a
      second click changed 0 rows and reported success. The button, idempotence, and legacy-marker
      behavior (checks 3's idempotence half, and checks 4/6/7) are therefore genuinely verified —
      only the specific numbers/wording in checks 3 and 5 are stale.
      **Needs human:** same call as the finding above — re-baseline checks 3 and 5's numbers/wording
      against current content, or reset the fixture to match what they describe.
      **Test disposition:** no automated test — fixture drift, not a defect; `cleanDescription` and
      `cleanUnit` are unit-tested directly.
      **Re-confirmed 2026-09-21 on staging/preview itself** — driving the real "Popraw literówki"
      menu item on `/szablony/4` there changed exactly **88** `kosztorys_items` rows for
      investment 151 (`updated_at` diff confirmed by direct SQL against `DB_POSTGRES_URL_PREVIEW`),
      an immediate second click changed **0** more, and no `klp` unit remains anywhere in that
      investment's items (`kpl` present, `klp` absent) — the same shape as the local-pass finding
      above, reproduced independently on preview with the identical 88-row count.
- [x] **`m2` → `m²` w j.m. nie pochodzi z tej zmiany** — check 5 mówi „poza `klp` → `kpl`", a na
      dzisiejszym fixturze przycisk przepisuje 65 j.m., prawie wyłącznie `m2` → `m²`. To reguła
      z `src/lib/kosztorys/clean-unit.ts`, która weszła commitem `bfb1b337` („Popraw literówki"
      czyści też j.m.) — ten slice nie tknął tego pliku (`git log staging --not 86b40010 --
src/lib/kosztorys/clean-unit.ts` → 0 commitów), a tabela poprawek nazw z założenia nie rusza
      j.m. Czyli nie regresja, tylko stare zachowanie przycisku na nowszych danych; check 5 był
      pisany pod fixture, w którym brudna była jedna jednostka.

- [x] **Linear: EX-928.** **Stale JWT session survives a `db:import:test` user reseed with a broken, unreadable error**
      (found while investigating an apparent 0-changes bug above, ruled out as a repo defect for
      _this_ check but worth a separate look). A `payload-token` minted against a pre-reseed
      `users.id` is still accepted by `requireAuth` after `db:import:test` recreates the `users` row
      with a different id (JWTs are stateless — `getCurrentUserJwt` never re-checks the row exists),
      so the session looks logged-in but every write whose SQL references that id by FK
      (`kosztorys_snapshots.taken_by`) throws a raw Postgres FK-violation error. That error's
      `.message` — the literal `Failed query: INSERT INTO kosztorys_snapshots (...) ... params:
151,auto,,76,1,{…60KB JSON…}` — is what `toActionFailure` returns as the user-facing string,
      i.e. a real user hitting this (e.g. after an admin recreates their account) would see a raw SQL
      dump as a toast instead of "sesja wygasła, zaloguj się ponownie". At
      `src/lib/actions/run-action.ts:63` (`logError`/`toActionFailure` swallow `err.cause`, only
      surfacing `err.message`) and `src/lib/auth/require-auth.ts` (no user-existence check).
      **Needs human:** decide whether this is worth a guard (e.g. `requireAuth` verifying the user
      row still exists, or `toActionFailure` refusing to surface a raw Postgres query as
      `err.message`) — it's a real but narrow window (stale token + a since-deleted-and-recreated
      user id), not something this pass should fix blindly since it touches the shared auth-error
      path.
      **Test disposition:** test-driven-debugging · integration — reproduce by minting a session for
      a user id, deleting that user, recreating a different user at a new id, then calling any
      action that FK-references `session.user.id`; assert the returned `ActionResultT.error` is a
      human sentence, not a raw SQL string.

## EX-787 — ui/ layering refactor (staging/preview pass, 2026-09-16)

Pure relocation refactor (`data-table/` → `tables/`, `FilterGrid` → `ui/control-grid.tsx` as
`ControlGrid`, `active-filter-button.tsx`/`active-filter-label.tsx` → `filters/`), no intended
behavior/visual change. Verified against staging
(`https://wykonczymy-git-staging-wykonczymys-projects.vercel.app`, commit `b744a3b1`), logged in as
`qa-gate@wykonczymy.test` (OWNER, session already live in the shared browser profile).

- [x] `/` (transactions listing, the densest toolbar — nav labels it "Transakcje"; **`/transfery`
      does not exist, it 404s**) at desktop (~1440px): toolbar layout (search left / column-picker
      right / filter+actions between), "Typ" filter popover opens and lists options, column-picker
      menu opens and toggles columns, Aktywne/Wszystkie toggle switches rows. No overflow.
- [x] `/` at phone (390px): filter row is 2 even columns below `sm`, no page-level horizontal
      overflow, "Typ" popover opens and is usable, "Filtry" fold collapses/expands the filter row.
- [x] `/inwestycje` at desktop: toolbar layout correct, "Status" filter popover opens and lists
      options, column-picker menu functions.
- [x] `/kasy` at desktop: toolbar layout correct, `ToggleStatButtons` tiles (using `ControlGrid`)
      render and toggle on click.
- [x] `/pracownicy` at desktop and phone (390px): toolbar layout correct at both widths,
      column-picker menu opens at both, Aktywne/Wszystkie toggle works.
- [x] `/flota` at desktop: toolbar layout correct, no overflow.
- [x] `/sprzet` at desktop: toolbar layout correct, no overflow.
- [x] `/zgloszenia` at desktop: toolbar layout correct, no overflow.

### Findings — 2026-09-16 (staging/preview pass)

- [x] **`ToggleStatButtons` tile text overflows its cell at phone width — FIXED 2026-09-16.**
      `/kasy` at 390px: each `ControlGrid` tile renders its label + balance as two `<span>` children
      inside a `<Button variant="outline" align="start">`. `Button`'s base carries
      `whitespace-nowrap` (`src/components/ui/button.tsx:8`), so the tile's **min-content** width is
      the whole un-wrappable string; a grid item's default `min-width: auto` resolves to min-content,
      so it cannot shrink into a half-width cell and spills past its track. Measured on the rendered
      "Pomocnicze" tile: content 213px vs. button box 171px. At 390px a two-column cell offers only
      ~143px of text room (390 − 32 page padding − 8 gap, halved, less the button's `px-4`), which no
      label+figure pair fits. Pre-existing — `ControlGrid`'s track class is unchanged by EX-787 (pure
      rename/move of `FilterGrid`) — and surfaced by the owner on a real phone
      (`.playwright-mcp/kasy-mobile.png`).
      **Fix applied:** `max-sm:grid-cols-1` on the `ControlGrid` instance inside
      `toggle-stat-buttons.tsx` — one full-width tile per row below `sm`. Deliberately NOT
      `[&>*]:min-w-0` + `truncate` on `ControlGrid` itself: that truncates the money figure, which is
      the one part worth reading, and `ControlGrid` is shared with the filter triggers, the
      data-table toolbar and the transfer filters, none of which have this problem. Scoped to
      `ToggleStatButtons` and therefore to its three consumers (`register-balance-chart`,
      `user-register-stats`, `financial-stats`), all of which render the same label+money shape.
      Class-order dependence verified by compiling a probe through `@tailwindcss/postcss`, not
      assumed: `.max-sm\:grid-cols-1` is emitted after `.grid-cols-2` at equal specificity, so it
      wins below 768px.
      **Test disposition:** no automated test — a CSS layout defect only a real layout engine can
      see (jsdom has none); an e2e visual check would be the right layer if one is ever authored, and
      a DOM/jsdom spec would assert nothing real.
- [x] **"Typ wydatku inwestycyjnego" filter-option label clips in the "Typ" popover on `/` — could not
      reproduce, dismissed.** Re-checked 2026-09-21 on staging (`/`, Transakcje filters) at desktop
      (1440px) and mobile (390px, matching `sm` breakpoint): both the "Typ" popover and the "Typ
      wydatku inwestycyjnego" popover render every option label in full at both widths — no clipping
      or truncation of any list item text (confirmed via screenshot at each width). The only truncation
      seen anywhere was the mobile **trigger button** itself ("Typ wydatku inwest…", expected CSS
      ellipsis on a narrow button, not the popover content the finding named). Dismissing as
      not-reproducible rather than filing.
      **Test disposition:** no automated test — could not reproduce, nothing to guard.

# Zamknięte — indeks

Jedna linia na slice, **wszystkie 94** — liczby są policzone z pełnego rejestru sprzed przycięcia.
`boksy` = odhaczone/wszystkie; wiersz, w którym te liczby się różnią, ma swoją sekcję wyżej
w „Otwarte" (tam boksy bywają scalone, więc liczba nieodhaczonych może się różnić od reszty z tej
kolumny — to ten sam fakt zapisany raz zamiast dwa). `0/0` to sekcja czysto prozatorska, bez boksów.
`ostatnia weryfikacja` to najpóźniejsza data w sekcji; `—` znaczy, że sekcja żadnej nie nosiła.
Pełne dowody, verbatim: `git show d426e567^:context/foundation/manual-checks.md`.

| slice                                                                                                                    | boksy | ostatnia weryfikacja |
| ------------------------------------------------------------------------------------------------------------------------ | ----- | -------------------- |
| EX-649 — zakładka „Marża": prognoza i marża rzeczywista                                                                  | 26/26 | 2026-09-04           |
| EX-691 — „Porównaj z arkuszem Google" pod aktywnym rabatem globalnym                                                     | 4/4   | —                    |
| EX-448 — stable per-row ids for expense line-items                                                                       | 6/6   | 2026-09-04           |
| S-08 — kosztorys-delete-guard                                                                                            | 5/5   | 2026-07-10           |
| kosztorys-zaliczka-v2 — materiały netto/brutto w Podsumowaniu (slice A)                                                  | 4/4   | —                    |
| kosztorys-tryb-mieszany — cash-settlement view w Podsumowaniu (slice B)                                                  | 6/6   | 2026-09-04           |
| kosztorys-podsumowanie-tabs — zaliczka-v2 batch: tabbed Podsumowanie, Mieszane via vatPlane, wpłaty base fix (EX-536)    | 11/11 | 2026-09-14           |
| remove-section-coeff — drop per-section coeff tier + explicit section sidebar buttons                                    | 2/2   | 2026-08-26           |
| EX-564 — kosztorys-percent-rabat-bulk-apply                                                                              | 8/8   | 2026-08-26           |
| etap-tool-plane (EX-565) — per-etap rozliczenie plane + view-independent subcontractor settlement                        | 18/18 | 2026-09-14           |
| EX-571 — subcontractor-view-settlement-only                                                                              | 16/16 | 2026-09-14           |
| EX-567 — netto investment-expense type (`INVESTMENT_EXPENSE_NET`)                                                        | 0/0   | 2026-07-26           |
| EX-580 — section header rows (bands) in the kosztorys grid                                                               | 15/15 | 2026-09-14           |
| EX-581 — netto expenses get their own tab in the wydatki list                                                            | 10/10 | 2026-09-15           |
| EX-569 — client-facing „Pobierz faktury" in the kosztorys Wydatki tab                                                    | 12/12 | 2026-09-04           |
| EX-585 — kosztorys-invoice-note-and-preview                                                                              | 17/17 | 2026-09-04           |
| EX-588 — investment-settlement-mode                                                                                      | 14/14 | 2026-09-04           |
| EX-594 — investment-summary-panel                                                                                        | 26/27 | 2026-09-15           |
| EX-596 — materials-net-pricing-persisted                                                                                 | 15/16 | 2026-09-15           |
| EX-597 — decouple-panel-write-refresh                                                                                    | 21/21 | 2026-09-15           |
| EX-605 — rabat globalny: activates on selection, undoable, one „Zapisz"                                                  | 8/8   | —                    |
| EX-606 — the % mass-overwrite gets a confirm dialog, not an undo entry                                                   | 9/9   | 2026-07-27           |
| EX-607 — kosztorys-section-footer-row                                                                                    | 14/14 | 2026-09-14           |
| EX-608 — nazwa inwestycji w górnym pasku bez trzeciego zapytania                                                         | 5/5   | —                    |
| EX-609 — subcontractor-price-guard                                                                                       | 21/21 | 2026-09-15           |
| EX-615 — drop-empty-kosztorys-scaffold                                                                                   | 8/8   | 2026-09-03           |
| EX-618 — scalable-preset-section-picker                                                                                  | 12/12 | 2026-09-15           |
| EX-574 — cancellation-sum-overcount                                                                                      | 2/10  | 2026-09-15           |
| EX-575 — drop-cost-variant-columns                                                                                       | 7/7   | —                    |
| EX-600 — investment-panel-filter-scope — ZDEZAKTUALIZOWANE                                                               | 0/0   | 2026-08-08           |
| EX-430 — harden bulk-insert restore                                                                                      | 2/2   | 2026-08-26           |
| summary-panel-filter-blind — panel wholly filter-blind, scope-marker apparatus deleted                                   | 12/12 | 2026-09-15           |
| AI receipt scan: extract the netto amount (EX-577)                                                                       | 5/5   | —                    |
| Multi-page invoices (EX-659)                                                                                             | 17/17 | 2026-09-15           |
| Dodawanie faktur wprost z „+" w tabeli wydatków (EX-662)                                                                 | 5/5   | —                    |
| cron-lead-reconcile (EX-416)                                                                                             | 4/7   | 2026-09-15           |
| lead-recovery-notifies-sales (EX-660)                                                                                    | 2/4   | 2026-09-15           |
| investments-listing-expense-plane — wydatki w liście na płaszczyźnie rozliczenia materiałów                              | 15/15 | 2026-09-15           |
| kosztorys-importer (EX-417)                                                                                              | 13/13 | 2026-09-04           |
| EX-560 — ex-560-reload-from-preset                                                                                       | 7/7   | 2026-09-03           |
| EX-555 — robocizna + rabat z kosztorysu na liście inwestycji (write-switch)                                              | 16/16 | 2026-09-04           |
| EX-557 — wpłaty bez inwestycji („Inna wpłata" wraca, oba typy tracą inwestycję)                                          | 6/6   | —                    |
| EX-675 — strata obniża dług inwestora jak rabat                                                                          | 16/16 | 2026-09-15           |
| EX-686 — rozjazd „Pomiar z natury" vs suma etapów po imporcie                                                            | 13/13 | 2026-09-15           |
| EX-682 / EX-683 — sortowanie wewnątrz sekcji                                                                             | 5/5   | —                    |
| EX-688 — zakres sortowania kolumny + „Zapisz kolejność" w menu nagłówka                                                  | 13/13 | 2026-09-04           |
| sheet-live-compare — „Porównaj z arkuszem Google" (EX-417)                                                               | 17/17 | 2026-09-15           |
| kosztorys-filter-conditions — jeden rejestr warunków filtrowania (EX-665)                                                | 16/16 | 2026-09-15           |
| sheet-column-mapping — ręczne wskazanie kolumny arkusza (EX-690)                                                         | 11/11 | 2026-09-15           |
| kosztorys-terminology — rename identyfikatorów Polish→English (EX-548)                                                   | 5/5   | 2026-09-03           |
| kosztorys-column-order — okno „Ustaw kolejność kolumn" (EX-692)                                                          | 11/11 | 2026-09-04           |
| kosztorys-editor-hook-split — rozbicie hooka edytora (EX-521)                                                            | 22/22 | 2026-09-15           |
| client-preview-settings — ustawienia podglądu inwestora (EX-695)                                                         | 11/11 | 2026-09-15           |
| drop-stage-percent-columns — usunięcie kolumn „% wykonania" per etap (EX-703)                                            | 8/8   | 2026-08-26           |
| filtry-problemy — grupa „Problemy" w menu Filtry — ZDEZAKTUALIZOWANE                                                     | 0/0   | 2026-08-26           |
| nomenklatura inwestora + potwierdzenie zmiany trybu                                                                      | 9/9   | —                    |
| filtry-problemy — osobny przycisk „Problemy" (fazy 5–7)                                                                  | 9/9   | —                    |
| sortowanie-kolumn-spojne — sortowanie w każdej kolumnie z danymi                                                         | 13/13 | 2026-09-15           |
| EX-713 / EX-714 — pasek aktywnych filtrów i trzy nowe pary warunków                                                      | 15/15 | 2026-09-15           |
| EX-711 — moduł floty: przeglądy pojazdów i przypomnienia mailowe                                                         | 27/28 | 2026-09-15           |
| blob-store-isolation — lokalny dev na preview Blob store                                                                 | 11/11 | 2026-09-15           |
| import-zastepuje-w-calosci — import zastępuje całą rozpiskę                                                              | 7/7   | 2026-09-15           |
| kosztorys-client-view-offer-settlement-variants — warianty „Oferta / Rozliczenie" — ZDEZAKTUALIZOWANE                    | 6/6   | 2026-09-28           |
| sheet-measured-qty-from-formula — „Pomiar z natury" z formuły                                                            | 2/2   | 2026-09-04           |
| mixed-settlement-both-planes — wpłaty na obu planach, jeden bilans na tryb                                               | 7/7   | —                    |
| EX-720 — nadmiarowe odczyty na trasach kosztorysu                                                                        | 12/12 | 2026-09-15           |
| EX-711 — flota: ręczne znaczniki „do wymiany" i typ „Serwis"                                                             | 31/31 | 2026-09-15           |
| EX-394 — HEIC: dziura w edycji przelewu + backfill starych faktur                                                        | 12/12 | 2026-09-15           |
| S-18 (cut) — spot-check perfu edytora przy ~1000 pozycjach                                                               | 7/7   | 2026-09-14           |
| Kosztorys — jeden kontrakt edycji dla komórek liczbowych (przecinek, wycofanie, toast)                                   | 28/28 | 2026-09-15           |
| fleet-sheet-parity — parytet z arkuszem kontroli przeglądów i ubezpieczeń                                                | 5/5   | 2026-10-31           |
| import-etapy-z-arkusza — puste etapy odsiane, podpisy i rozliczenie z okna importu                                       | 12/12 | 2026-09-04           |
| fleet-costs-window — okno czasu na karcie pojazdu + kolumna Opony                                                        | 12/12 | 2026-08-26           |
| table-column-reordering — kolejność kolumn w tabelach                                                                    | 10/10 | 2026-08-26           |
| notification-recipients — odbiorcy powiadomień na `/flota` i `/zgloszenia`                                               | 15/15 | 2026-09-15           |
| forms-reset-clear — formularze czyszczą się po udanym zapisie                                                            | 13/13 | 2026-09-15           |
| sheet-write-env-guard — zapis do Google Sheets tylko z produkcji                                                         | 12/12 | 2026-09-04           |
| work-item-catalog — „Katalog prac"                                                                                       | 25/25 | 2026-09-15           |
| EX-699 — wysokość wiersza w edytorze i dopasowanie do treści w podglądzie klienta                                        | 0/0   | 2026-08-31           |
| Stawka „auto" w katalogu prac (2026-09-01, `katalog-prac-auto-rates`)                                                    | 5/5   | 2026-09-03           |
| EX-753 — legacy-sheet-work-import (2026-09-01)                                                                           | 8/8   | 2026-09-02           |
| Kolumny stawek wykonawcy obu planów w widoku Inwestora (2026-09-01, `kosztorys-contractor-price-columns-in-client-view`) | 0/0   | 2026-09-02           |
| Dwie opcje źródła ceny wykonawcy (2026-09-01, `kosztorys-dwie-opcje-zrodla-ceny-wykonawcy`)                              | 1/1   | 2026-09-02           |
| Przerzedzanie snapshotów kosztorysu (2026-09-02, `snapshot-retention-thinning`)                                          | 4/4   | 2026-09-15           |
| Zwinięcie nadpisania stawki podwykonawcy (2026-09-02, `subcontractor-override-value-collapse`, EX-766)                   | 8/8   | 2026-09-02           |
| EX-761 — divergent-price-for-same-work (2026-09-02)                                                                      | 0/0   | 2026-09-02           |
| EX-765 — rozbicie `row-conditions.ts` na rejestr i zapytania (2026-09-02, `row-conditions-registry-engine-split`)        | 4/4   | 2026-09-03           |
| EX-748 — zakończona inwestycja jest zablokowana (2026-09-03, `investment-lock-on-completed`)                             | 14/14 | 2026-09-04           |
| EX-758 — Katalog narzędzi i urządzeń (rejestr sprzętu)                                                                   | 11/13 | 2026-09-15           |
| drag-drop-guard — chybiony drop pliku i widoczne dropzone (2026-09-14)                                                   | 14/14 | 2026-09-15           |
| transfer-print-return — wydruk przefiltrowanej listy transakcji (2026-09-14)                                             | 15/15 | 2026-09-15           |
| szablony-crud                                                                                                            | 16/16 | 2026-09-15           |
| kosztorys-section-menu-split — akcje sekcji na pasku, akcje pracy na wierszu                                             | 18/18 | 2026-09-14           |
| transfers-server-sort — sortowanie tabeli transakcji na serwerze (2026-09-15, EX-777)                                    | 13/13 | 2026-09-15           |
| rwd-mobile — RWD na telefonie: nawigacja, dodawanie i pokazywanie transakcji (2026-09-16, EX-785)                        | 7/7   | 2026-09-16           |
| media-upload-serial — równoległy upload gubił pliki na Neonie; szeregowy zapis wierszy `media` (2026-09-22, EX-855)      | 4/4   | 2026-09-22           |
| empty-preset-create — pusty szablon zakładany z listy szablonów (2026-09-22)                                             | 5/5   | 2026-09-23           |
| szablon-autosave — warsztat szablonu zapisuje się sam (2026-09-22)                                                       | 12/14 | 2026-09-23           |
| kosztorys-editor-assets — galeria assetów w edytorze kosztorysu v2 (2026-09-22)                                          | 8/8   | 2026-09-23           |
| zakladka-inwestycja-w-panelu — zakładka „Inwestycja" w panelu Podsumowanie (2026-09-22)                                  | 23/25 | 2026-09-23           |
| Nowa sekcja wprost w „Dodaj pracę z katalogu" (2026-09-22)                                                               | 6/6   | 2026-09-23           |
| kategorie-assetow-i-kompresja — kategorie assetów i luźniejsza kompresja (2026-09-22)                                    | 13/13 | 2026-09-23           |
| EX-820 — sufit stawki wykonawcy z „Problemów" do „Filtrów" (2026-09-22)                                                  | 7/9   | 2026-09-23           |

## EX-802 — lead-delivery (wykonczymy half, 2026-09-21)

Sprawdzenia na bazie testowej (5435). Webhook wymaga `LANDING_WEBHOOK_SECRET` i
`LANDING_BLOB_HOST` w `.env`; kontrakt koperty: `context/reference/landing-intake-contract.md`.

**Każdego boksu z podpisanym requestem nie da się sprawdzić na stagingu — rób je lokalnie.**
`LANDING_WEBHOOK_SECRET` jest na Vercelu w środowisku Preview oznaczony jako **Secret** (`vercel env
ls preview` → „Hidden / Secret"), więc wartości nie wyciągnie ani `vercel env pull`, ani `.env`, który
niesie inny sekret. Poprawnie policzony HMAC dostaje wtedy `403 {"error":"Forbidden"}` — to zgodne
zachowanie bramki, nie defekt i nie błąd podpisu, więc nie ma czego debugować (spalony przebieg
2026-09-23). Dotyczy boksów „podpisany POST", „ten sam request powtórzony", „url spoza allowlisty"
i „podmienione body"; boks z `403` potwierdza za to odmowę przy złym sekrecie.

- [x] `/admin` → Media: kolumna „Rodzaj" jest widoczna i filtruje listę — zweryfikowano 2026-09-21 na
      stagingu. Kolumna widoczna w tabeli z opcjami sortowania; „Dodaj filtr" domyślnie proponuje pole
      „Rodzaj" z wartościami Faktura/Projekt/Zdjęcie/Inne — wybranie „Faktura" zmienia URL na
      `where[kind][equals]=faktura` i zwraca „Nie znaleziono Pliki" zamiast pełnej listy 1600 wierszy,
      co potwierdza że filtr faktycznie działa. Pusty wynik jest stanem danych, nie defektem: SQL na
      `DB_POSTGRES_URL_PREVIEW` potwierdza `kind` jest `NULL` dla wszystkich 1600 wierszy — kolumna
      jeszcze nie była wtedy zasilana na tej bazie (webhook z landingu jeszcze nic tam nie zapisał).
      Od EX-829 panel nie jest jedyną drogą: aplikacja zapisuje `kind = 'projekt'` sama — przy
      wgrywaniu (pole „To jest rzut lub projekt") i z galerii asetów („Oznacz jako rzut").
- [x] Skasowanie faktury podpiętej pod transakcję jest odrzucone czytelnym polskim komunikatem
      <!-- staging 2026-09-24: /admin/collections/media/1772 (invoice1-0cd005.png, podpięta pod transakcję 5252)
           → „Usuń" → „Potwierdź" dało toast „Nie można usunąć pliku — jest używany w innych miejscach
           (transakcje: 1). Najpierw odepnij go tam." Po próbie media 1772 nadal istnieje i wciąż ma
           1 wiersz w transactions_rels (path='invoice') — nic nie zostało skasowane w Blobie. -->
- [x] Inwestycja pokazuje podpięte pliki w `/admin` po akcji dodania
      **Zweryfikowane na stagingu:** po wgraniu ośmiu plików z karty inwestycji
      `/admin/collections/investments/137` → pole „Zdjęcia i pliki" listuje dokładnie tę ósemkę
      (`qa802-1…3.png`, `qa-faktura-netto-…pdf`, `qa802b-1…3.png`, `qa802b-….pdf`), w kolejności
      dodania.
- [x] Dodanie trzech zdjęć + PDF z karty inwestycji — pojawiają się bez przeładowania
      **Zweryfikowane na stagingu (inw. 137, karta → „Zdjęcia i pliki"):** jednym wyborem czterech
      plików (3 × PNG + PDF) licznik przycisku przeszedł „Dokumentacja (4)" → „(8)" bez
      przeładowania strony, a `investments_rels` (path `assets`) dla inwestycji 137 niesie po
      operacji komplet 8 wierszy z nowymi `media`. Wcześniejszy nieudany wsad w tym samym przebiegu
      był winą fikstury, nie aplikacji — ręcznie sklecony PDF bez tablicy xref; prawdziwy PDF
      przechodzi (patrz finding o cichym błędzie niżej).
- [x] Dodanie zdjęcia przy tworzeniu nowej inwestycji — leży na jej karcie
      <!-- staging 2026-09-24: „Inwestycje" → „Dodaj" → nazwa „QA EX-802 nowa inwestycja" + jeden PNG
           w polu „Zdjęcia i pliki" (dialog pokazał nazwę pliku przed zapisem) → „Dodaj". Powstała
           inwestycja 157 z wierszem `investments_rels` path `assets` → media 1817
           (`qa802-1-81e271.png`), a jej karta `/inwestycje/157` od razu niesie „Dokumentacja (1)". -->
- [~] ~~Pasek miniatur nie przewija się w poziomie przy 375px~~ — nieaktualne: na karcie inwestycji
      nie ma już paska miniatur (patrz sekcja „EX-802 — investment-assets-dialog", która to zastępuje)
- [x] Zdjęcie HEIC z iPhone'a konwertuje się i wgrywa
      <!-- staging 2026-09-24: syntetyczny `qa802.heic` (ISO Media, HEIF HEVC Main 10, 1600×1200, 5,9 kB)
           wgrany z karty inw. 137 → „Zdjęcia i pliki" → „Dodaj kolejne". Toast „Pliki dodane", licznik
           „Dokumentacja (8)" → „(9)" bez przeładowania, a w bazie media 1816 = `qa802-169b13.jpg`,
           `image/jpeg`, 1600×1200, 21 357 B — czyli konwersja po stronie klienta zadziałała. -->
- [x] W `/admin` zgłoszenie z Facebooka nie pokazuje trzech pól landingowych, zgłoszenie z landingu pokazuje
      <!-- staging 2026-09-24: lead 220 (`facebook_lead_ads`) → etykiety pól: Źródło, Email, Imię i nazwisko,
           Telefon, Inwestycja, Surowe dane, … — bez „Adres", „Zakres prac", „Metraż" i „Zdjęcia i pliki".
           Lead 221 (`landing_form`) → ta sama lista plus właśnie te cztery. -->
- [ ] Podpisany POST JSON z `curl`, wskazujący realny URL bloba, tworzy zgłoszenie razem z plikami
- [ ] Ten sam request powtórzony nie tworzy niczego i nie wysyła maila
- [ ] Request z `assets[].url` spoza hosta z allowlisty jest odrzucony i alertuje
- [ ] Request z podmienionym body jest odrzucony (403)
- [x] Promocja zgłoszenia z landingu od początku do końca — karta nowej inwestycji pokazuje zdjęcia klienta
      <!-- staging 2026-09-24: lead 221 („QA Landing Fixture", `landing_form`, dwa pliki dopięte jako
           fikstura) → „Zgłoszenia" → „Dodaj". Okno „Nowa inwestycja ze zgłoszenia" przyszło wypełnione
           ze zgłoszenia (nazwa = imię + adres, adres, telefon, email, osoba kontaktowa) i mówiło
           „Przejdą do inwestycji: 2 z 2". Po „Utwórz" powstała inwestycja 158 (status „planowana"),
           a jej karta `/inwestycje/158` niesie „Dokumentacja (2)" — w bazie oba media klienta
           (1814, 1815) pod `investments_rels` path `assets`. -->
- [x] Zgłoszenie po promocji podaje link do inwestycji zamiast przycisku i zostaje przy „Oczekuje"
      <!-- staging 2026-09-24: ten sam wiersz po promocji ma w kolumnie „Inwestycja" link
           `/inwestycje/158` z nazwą inwestycji zamiast przycisku „Dodaj", a „Status kontaktu" nadal
           „Oczekuje" (`leads.contact_status='new'`, `investment_id=158`). -->
- [x] Odznaka nieprzeczytanych zgłoszeń w nawigacji nie spada po samej promocji — ~~dopiero po
      kliknięciu „Skontaktowano"~~ **druga połowa brzmienia jest nieaktualna, nie jest defektem**
      <!-- staging 2026-09-24: odznaka liczy zgłoszenia utworzone po kursorze użytkownika
           (`countUnreadLeads`, `src/lib/db/notifications.ts` — `created_at > notification_reads.seen_at`),
           a kursor przesuwa render samej strony `/zgloszenia` (`markSeen` w `zgloszenia/page.tsx`).
           Zmierzone przy kursorze cofniętym do 2026-09-20 i odczycie odznaki z `/inwestycje`:
           3 przed promocją, 3 po promocji leada 221, 3 po przestawieniu go na „Skontaktowano".
           Czyli: promocja rzeczywiście nie rusza odznaki (sprawdzana teza), ale i „Skontaktowano"
           jej nie rusza — gasi ją samo wejście na listę zgłoszeń. Brzmienie boksu do poprawienia
           przy najbliższej okazji. -->

### Findings — 2026-09-23/24 (staging/preview pass)

- [x] **Linear: EX-927.** **Odrzucony upload pokazuje surowy angielski komunikat Payloada w polskim UI.** Wgranie
      uszkodzonego PDF-a (plik bez tablicy xref) z karty inwestycji kończy się `400` z
      `POST /api/media`, a toast, który widzi użytkownik, brzmi dosłownie **„The following field is
      invalid: file"**. Zmierzone na stagingu (inw. 137, „Zdjęcia i pliki" → „Dodaj kolejne"),
      przechwycone `MutationObserver`-em; licznik plików nie drgnął, więc poza tym zdaniem nic nie
      mówi, co poszło nie tak ani którego pliku dotyczy. Przyczyna:
      `src/lib/media/client-upload.ts` → `postMediaRow` wstawia `body?.errors?.[0]?.message`
      (komunikat Payloada, po angielsku) prosto w błąd, który `useMediaUpload` podaje do
      `toastMessage`; wszystkie pozostałe komunikaty na tej ścieżce są po polsku
      („Upload nie powiódł się (…)", „Upload nie powiódł się — serwer nie zwrócił pliku").
      **Do decyzji człowieka:** brzmienie. Najprościej nie ufać `errors[0].message` z API i
      zostawić polski fallback (ewentualnie z nazwą pliku), ale to zabiera jedyny kanał, którym
      backend tłumaczy konkretną przyczynę — dlatego nie poprawiam tego w przebiegu QA.
      **Test disposition:** no automated test — komunikat, nie stan; gdy padnie decyzja o brzmieniu,
      unit na `postMediaRow` z odpowiedzią `400` wystarczy.

## EX-802 — investment-assets-dialog (galeria bez miniatur, 2026-09-21)

Zastępuje sprawdzenie „Pasek miniatur nie przewija się w poziomie przy 375px" z sekcji
lead-delivery — na karcie inwestycji nie ma już paska miniatur (został tylko u leada).

- ~~Inwestycja bez plików nie pokazuje w sekcji żadnego przycisku~~ — zachowanie odwrócone przy
  kosztorys-editor-assets (2026-09-22); nowe brzmienie czeka na weryfikację w sekcji tej zmiany
- [x] Przycisk „Zdjęcia i pliki (N)" ma szerokość swojej treści, nie całej kolumny
- [x] Podgląd przy N ≥ 1 ma „Dodaj kolejne", które dokłada plik bez wychodzenia z karty
- [x] Po dodaniu pliku licznik „Zdjęcia i pliki (N)" rośnie bez przeładowania strony
- [x] Podgląd otwiera plik, „Pobierz" zapisuje go pod właściwą nazwą, „Drukuj" otwiera podgląd wydruku
- [x] Przy 2+ plikach „Pobierz wszystkie" daje zip o nazwie zaczynającej się od `pliki-`, nie `faktury-`
- [x] Stopka podglądu przy 2+ plikach mówi „Usuń ten plik" + „Usuń wszystkie"; przy jednym pliku samo
      „Usuń", bez „Usuń wszystkie" — nigdzie nie pada słowo „faktura"
- [x] „Usuń" pyta o potwierdzenie i po potwierdzeniu plik znika z podglądu
- [x] W obu dialogach („Nowa inwestycja" i „Edytuj inwestycję") „Status" i „Zdjęcia i pliki" stoją
      w jednym wierszu, a przy zwężonym oknie wracają jedno pod drugie
- [x] „Edytuj inwestycję" → „Dodaj zdjęcia lub pliki" → wybór pliku dodaje go natychmiast (toast), dialog w dialogu działa
- [x] Zamknięcie formularza edycji przez „Anuluj" nie usuwa dodanego pliku
- [x] Formularz „Nowa inwestycja" dalej zbiera pliki po staremu i zapisuje je razem z inwestycją
- [x] Podgląd i dodawanie faktury w tabeli transferów działa jak przed zmianą (tytuły, pager)

## katalog-problems — rozjazdy z katalogiem prac jako problemy edytora (2026-09-21)

Na inwestycji z niepustą rozpiską (np. po `INV=6 … seed-kosztorys.ts`), edytor `kosztorys_v2`.

- [x] Wejście na edytor bez otwierania żadnego okna: „Problemy" pokazują „Inne liczby niż w katalogu prac (N)" i „Brak w katalogu prac (M)"
- [x] Zmiana ceny j.m. na zgodną z katalogiem zmniejsza licznik „Inne liczby…" natychmiast, bez zapisu i bez przeładowania
- [x] Liczby w oknie „Porównaj z katalogiem prac" i w menu „Problemy" są identyczne, także po niezapisanych zmianach
- [x] Okno otwiera się od razu z liczbami — nie pokazuje „Porównuję z katalogiem…"
- [x] „Pokaż w rozpisce" w obu blokach zamyka okno i zawęża siatkę do właściwego zbioru pozycji
- [x] Zawężenie na „Inne liczby…" odsłania kolumny cenowe, nawet jeśli były odznaczone w wyborze kolumn — zweryfikowano 2026-09-21 na stagingu (inw. 137, widok „Inwestor", zawężenie włączone): nagłówek siatki niesie „Cena j.m. netto" obok obu stawek podwykonawców.
- [x] „Dodaj do katalogu" na pracy spoza cennika zmniejsza licznik „Brak w katalogu" bez utraty niezapisanych wierszy
- [x] Podgląd szablonu / tryb tylko-do-odczytu: raport widoczny, brak „Dodaj do katalogu", „Edytuj w katalogu" i „Pokaż w rozpisce" (zweryfikowano na zablokowanej inwestycji — status `completed`, inw. 106 — `readOnly = preview || locked`; klient-facing „Widok inwestora"/`/podglad-inwestora` nie renderuje paska „Problemy" wcale, więc ta ścieżka nie dotyczy tego checka)

### Findings — 2026-09-21

- [x] ~~**Zawężenie na „Inne liczby niż w katalogu prac" nie odsłania bazowej kolumny „Cena j.m. netto" na widoku inwestora.**~~ **Fałszywy alarm — odrzucone 2026-09-21.** Pomiar był robiony na widoku **„Z narzędziami"**, nie „Inwestor" (przełącznik widoku cen to `role="radio"`; w chwili obserwacji „Z narzędziami" miało `data-state="on"`). Na widoku podwykonawcy bazowa „Cena j.m. netto" **nie jest w ogóle składana** — `kosztorys-v2-columns.tsx` daje `view === 'client' ? [price, ...plany] : plany` — więc nie ma czego odsłaniać, i to jest projekt, nie defekt; dokładnie dlatego warunek odsłania WSZYSTKIE kolumny cenowe (komentarz przy `revealsColumns` w `row-conditions/registry.ts`). Dwa dowody: (1) spec na `buildV2Columns` z `view: 'client'`, `isHidden: () => true` i `revealedColumnIds` z `columnsRevealedBy([CATALOGUE_DIVERGENCE_CONDITION_ID])` przepuszcza `price` — miał czerwienić, jest zielony; (2) ta sama siatka na stagingu po przełączeniu na „Inwestor" niesie w nagłówku „Cena j.m. netto". `keep()` w `column-selection.ts` jest poprawne: bramka `PRZEDMIAR_ANCHORED_COLUMNS` działa tylko przy `view !== 'client'`, a `price` siedzi w `AXIS_EXEMPT_COLUMNS`, więc `axisAllows` zawsze przepuszcza. **Bez zmian w kodzie i bez regresji** — nie ma defektu do przykrycia.

## catalogue-compare-bulk-update — hurtowa aktualizacja rozpiski z katalogu (2026-09-21)

Inwestycja z niepustą rozpiską i rozjazdami wobec katalogu (w lokalnym dumpie: inw. 151), okno
„Porównaj z katalogiem prac" w edytorze `kosztorys_v2`.

- [x] Nie ma już wiersza „Malowanie sufitu w kolor — Stawka bez narzędzi: 14,88 zł / 14,88 zł / −0,01 zł", a licznik różnic spada o jeden
- [x] Wiersze, gdzie katalog nie podaje stawki, mają w kolumnie „Katalog" słowo „auto", nie złotówki; ich „Różnica" jest szara
- [x] Licznik „Problemy" rośnie dokładnie o tyle wierszy „zamrożona ↔ auto o tej samej kwocie", ile widać w raporcie, i żaden wiersz nie zniknął
- [x] Zaznaczenie pojedynczej liczby i „Aktualizuj kosztorys (1)" zmienia dokładnie tę jedną liczbę, wiersz znika z raportu, okno zostaje otwarte, licznik „Pokaż N różnic" maleje o jeden
- [x] Zaznaczenie wszystkiego i zapis zostawia blok „Inne liczby niż w katalogu" pusty
- [x] Sortowanie i filtry ustawione w rozpisce przed otwarciem okna przeżywają zapis (siatka się nie remountuje)
- [x] W „Wersje" jest wpis z chwili tuż przed zapisem, a przywrócenie go cofa cały hurt
- [x] Aktualizacja wiersza, gdzie katalog mówi „auto", kasuje nadpisanie — praca liczy się z globalnego współczynnika i na siatce pokazuje cenę pochodną
- [x] Zaznaczenie stawki, która po scaleniu przekracza 65 % ceny, pokazuje znacznik przy wierszu jeszcze przed zapisem; odznaczenie znacznik gasi
- [x] Praca „Montaż syfonów (kpl)" pokazuje kandydata „Montaż syfonów (szt)" z komunikatem o j.m. („ta sama nazwa, inna j.m."), nie o nazwie
- [x] Kliknięcie kandydata przepisuje opis i j.m.; praca znika z „Brak w katalogu" i pojawia się w „Inne liczby niż w katalogu" (albo w „Zgodne z katalogiem")
- [x] „inny…" otwiera wyszukiwarkę po całym katalogu i wybór z niej działa tak samo
- [x] Ceny pracy nie zmieniają się przy przyjęciu nazwy
- [x] Tryb tylko-do-odczytu: raport i kandydaci widoczni jako tekst, brak checkboxów, przycisku „Aktualizuj kosztorys" i klikalnych kandydatów

## szablon-autosave — warsztat szablonu zapisuje się sam (2026-09-22)

`/szablony/[id]`. Warsztat jest JEDEN i współdzielony, więc każdy check wyrzuca z niego to, co było
otwarte wcześniej. Dławik lustra to 10 s, domknięcie ogona 15 s bezczynności — przy sprawdzaniu
„czy doszło" liczy się odczekanie, nie odświeżanie w kółko.

**Nieaktualne od EX-893 (2026-09-29):** warsztatu i lustra już nie ma — szablon jest własną
inwestycją i zapisuje się jak każdy kosztorys. Otwarte boksy tej sekcji nie mają już czego sprawdzać.

- [~] ~~Po przełączeniu w „Wersje" jest wpis „Przed wczytaniem: <nazwa>" i przywrócenie go wraca do stanu sprzed~~ — nieaktualne (szablon-open-speed, EX-876): wpis był zapisywany, gdy wskaźnik warsztatu był pusty, więc żadna lista „Wersje" nie mogła go pokazać; przełączenie już go nie robi, a punktem przywrócenia jest kopia szablonu w bibliotece, dopychana w tej samej transakcji.

### Findings — 2026-09-23 (staging/preview pass)

- [~] ~~**„Wersje" nie pokazuje wpisu „Przed wczytaniem: <nazwa>" po przełączeniu szablonu** — zweryfikowane na stagingu (commit `e0158cb8`), 3 ponowne otwarcia dialogu „Wersje" i przeładowanie strony, wpis nigdy się nie pojawił. Defekt jest **węższy niż „dialog Wersje jest nieaktualny"**: w tej samej sesji, na tym samym szablonie, ręczne „Wyczyść szablon" utworzyło wpis „Przed wyczyszczeniem" i ten wpis pojawił się w dialogu natychmiast i poprawnie (przywrócenie też zadziałało). Więc automatyczny snapshot przy `openPresetInWorkshopAction` (przełączenie) nie trafia do listy „Wersje" tak jak snapshot przy czyszczeniu — dwie różne ścieżki tworzenia auto-snapshotu zachowują się różnie mimo wspólnego UI. Root-cause (np. brakujący tag cache / inny zapis do `kosztorys_snapshots`) poza zakresem tego przebiegu QA — check zostaje odznaczony jako otwarty defekt.~~ — nieaktualne: przyczyna i usunięcie wpisu w boksie wyżej (EX-876).
- [~] ~~**Pusty szablon (0 sekcji) jest niewidoczny w „Przełącz na inny szablon…" wewnątrz warsztatu**~~ — nieaktualne (EX-893): przełączania szablonów w warsztacie już nie ma. Dawny opis: root-cause: `groupPresetSections`/`usePresetSections` (`src/components/kosztorys/editor/dialogs/preset/use-preset-sections.ts`) buduje listę, iterując metadane na poziomie SEKCJI, więc preset bez żadnej sekcji nigdy się nie zmaterializuje jako opcja. To NIE dotyczy innego pickera o tej samej nazwie funkcjonalnej — „Kosztorys z szablonu" w dialogu zakładania nowej inwestycji (`add-investment-dialog.tsx`/`investment-form.tsx`) pokazał pusty preset („ZZZ QA EX748 usunac empty2", 0/0) poprawnie, zgodnie z już potwierdzonym checkiem w `empty-preset-create` (linia 581). Dwa różne pickery, dwie różne implementacje — defekt jest lokalny do warsztatowego „Przełącz na inny szablon…", nie ogólny.

## zakladka-inwestycja-w-panelu — zakładka „Inwestycja" w panelu Podsumowanie (2026-09-22)

Dane inwestycji (notatki/zakres prac, kontakt, adres, status) i przeniesiona tu Dokumentacja;
panel montuje się także na pustym kosztorysie.

- [x] Zakładka „Inwestycja" stoi jako ostatnia, za „Marżą", i pokazuje komplet pól karty inwestycji;
      puste pola są odfiltrowane
      <!-- staging 2026-09-24 (commit 48bb1625, z naprawą filtrowania). Kolejność zakładek:
           Podsumowanie · Materiały · Robocizna · Podwykonawcy · Marża · Inwestycja — ostatnia.
           Inw. 19 (komplet danych): Adres · Telefon · Email · Opinia · Status + Dokumentacja.
           Inw. 74 (phone/email/review puste w bazie): zostają tylko Status i notatki — żadnego
           „Email —" ani „Opinia —". -->

### Findings — 2026-09-23 (staging/preview pass)

- [x] **„Komplet pól karty inwestycji; puste pola są odfiltrowane" — realny defekt, naprawiony
      i potwierdzony na żywo 2026-09-24 (staging `48bb1625`): inw. 74 nie renderuje już „Email —"
      ani „Opinia —".** `buildInvestmentInfoFields`
      (`src/components/investments/investment-info-fields.tsx`) filtrował `.filter((field) =>
field.value)` na **zrenderowanym węźle**, nie na surowej wartości: `Telefon`/`Email` owijały
      pole w `<ContactLink>`, który jest zawsze truthy niezależnie od tego, czy numer/mail istnieje,
      a `Opinia` miała `investment.review || '—'` — myślnik też jest truthy. Efekt na żywo (inw. 74,
      brak telefonu/maila/opinii): „Email —" i „Opinia —" renderowały się zamiast znikać, dokładnie
      tak jak przewidywał plan (`context/changes/2026-09-22-zakladka-inwestycja-w-panelu/plan.md:345`
      — „komplet pól, puste pola odfiltrowane"). Naprawa: filtrować na surowym polu
      (`investment.phone && <ContactLink .../>`), zdjąć `|| '—'` z Opinii — `InfoList` i tak stawia
      myślnik dla każdej wartości, która trafi do listy jako falsy. Regresja:
      `src/__tests__/components/investments/investment-info-fields.test.ts` (3 testy, node, zielone
      lokalnie) blokuje ten dokładny powrót. Kolejność zakładek (ostatnia, za „Marżą") jest
      potwierdzona poprawna na żywo — tylko filtrowanie było wadliwe. **Boks zostaje otwarty**: fix
      leży w gałęzi, nie na wdrożonym `e0158cb8` — wymaga redeployu stagingu, żeby dograć na żywo.
      **Test disposition:** test-driven-debugging — unit (funkcja czysta, bez DOM).
- Sprawdzenie #10 (`/szablony/<id>`) zweryfikowane na `/szablony/4` — pasek „Widok podsumowania" ma
  4 pozycje (Podsumowanie/Materiały/Robocizna/Podwykonawcy, bez Marży — bez inwestycji nie ma
  wejścia do marży), zero przycisków plików w toolbarze. Zgodne z checkiem.
- Sprawdzenie #11: tekst checklisty mówił „pięć zakładek" — na żywo (`/k/<token>` z inw. 137 i
  `/podglad-inwestora/106`) są **trzy**: Podsumowanie/Materiały/Robocizna. Nie defekt —
  `allowedSummaryViews` (`src/components/kosztorys/summary/model/summary-views.ts`) gubi
  „Podwykonawcy" i „Marża" na `preview` **niezależnie** od tej zmiany (starsza bramka, potwierdzona
  testem `model/summary-views.test.ts`: „podgląd klienta gubi «Podwykonawcy» i «Marża», nawet gdy
  liczby przyszły"). Ta zmiana dokłada tylko trzecią bramkę („Inwestycja" na `!preview &&
hasInvestmentInfo`), z tym samym efektem. Poprawiłem liczbę w treści checka (linia wyżej) — plan
  najwyraźniej się przeliczył.
- Powtarzający się `[ERROR] OPTIONS / => 400` w konsoli na niemal każdej nawigacji — to preflight
  `vercel.live` (widoczny w sieci jako `OPTIONS https://…vercel.app/` tuż po `POST
vercel.live/login/validate`), infrastruktura Vercel Preview Toolbara, nie kod aplikacji. Nie
  wpływa na żadną z powyższych ścieżek — pominięte jako szum, nie finding.

## EX-849 / EX-850 — tagowanie cache galerii i pojedynczy render po uploadzie (2026-09-22)

Obie zmiany dotykają tego samego wpisu cache (`fetchInvestmentAssets`) z dwóch stron: EX-849 zwęził
tag z kolekcyjnego do per-wiersz, EX-850 zdjął zdublowany render po wgraniu pliku. Jedno i drugie
widać tylko na żywo — spec nie obserwuje ani liczby renderów, ani tego, czyj wpis cache wyleciał.
Licznik renderów czytaj z logu dev: `[PERF] buildKosztorysTree` (drzewo jest niecache'owane
świadomie — odrzucone dla świeżości, `context/archive/2026-07-27-decouple-panel-write-refresh/`
— więc każdy render trasy zostawia dokładnie jeden wpis).

- [x] Wgranie zdjęcia do inwestycji na trasie `/inwestycje/<id>/kosztorys_v2`: w logu dev
      `[PERF] buildKosztorysTree` pojawia się **raz**, nie dwa razy (EX-850)
      — zweryfikowane 2026-09-23 na stagingu, runtime log deploymentu `wykonczymy-4fcngsuxi`
      (inwestycja 106, jeden upload o 10:18:18). Cały upload zmieścił się w JEDNYM żądaniu
      `POST /inwestycje/106/kosztorys_v2`, a w nim dokładnie po jednym wpisie:
      `addInvestmentAssetsAction 489ms`, `buildKosztorysTree 62ms`,
      `kosztorys_v2/106 7-fetch fan-out 266ms`. Po akcji **nie ma** osobnego
      `GET /inwestycje/106/kosztorys_v2` — czyli drugiego renderu po `router.refresh()` nie ma
      wcale, a nie „jest, tylko szybki". `fetchAllMedia` przeskoczyło 1605 → 1606 dokumentów, więc
      plik faktycznie wszedł. (`getaddrinfo disabled.invalid` w tym samym żądaniu to bramka poczty
      poza produkcją, nie błąd uploadu.)
- [x] To samo zdjęcie pojawia się w galerii bez ręcznego odświeżenia strony — render z odpowiedzi
      akcji wystarcza po zdjęciu `router.refresh()`
- [x] Wgranie faktury do transferu: faktura widoczna od razu, bez przeładowania (ta sama ścieżka
      `useMediaUpload`, druga i ostatnia)
- [x] Zapis „Opcji rozliczenia" na inwestycji A **nie** wywala galerii inwestycji B: wejdź na
      galerię B (log pokazuje `query.fetchInvestmentAssets(B)`), zapisz ustawienia na A, wróć na B —
      drugiego zapytania nie ma, wpis cache przeżył (EX-849)
- [x] „Oznacz jako rzut" na pliku inwestycji B nadal odświeża tę galerię — tag `collection:media`
      zostaje i to jedyna ścieżka, która zmienia `media.kind` bez dotykania wiersza inwestycji
- [x] Przeniesienie plików ze zgłoszenia do inwestycji („wyślij do inwestycji"): galeria inwestycji
      docelowej pokazuje je po wejściu, bez odświeżania — piąty pisarz, ten w `lead-assets.ts`
- [x] Usunięcie pliku z galerii i usunięcie wszystkich: plik znika, a po odświeżeniu nie wraca

### Findings — 2026-09-23 (staging/preview pass)

- [x] **~~Liczba renderów `buildKosztorysTree` nie da się zweryfikować z samej przeglądarki na
      stagingu~~ — finding obalony 2026-09-23: runtime logi Vercela są osiągalne z CLI.**
      Pierwotny wniosek („needs human, odpal `pnpm dev` lokalnie") stał na jednej nieudanej próbie
      `npx vercel ls --scope=$(npx vercel whoami)`, która padła `Error: You cannot set your Personal
Account as the scope.` — to był zły argument `--scope`, nie brak dostępu. Właściwy scope to
      zespół projektu z `.vercel/project.json` (`orgId`), nie konto CLI:

                        ```bash
                        npx vercel logs https://<deployment>.vercel.app --scope=team_BWfyTqJnjIqZBkHwBL0elgS4
                        ```

                        Strumień oddaje runtime stdout pogrupowany per request, a `console.log` w `buildKosztorysTree`
                        (`src/lib/queries/kosztorys.ts:71`) nie jest bramkowany `NODE_ENV`, więc linia `[PERF]
                        buildKosztorysTree …` wychodzi tak samo z builda produkcyjnego na stagingu, jak z dev.
                        Właściwy box wyżej policzony tą drogą i odhaczony — jeden wpis na jeden upload.
                        **Test disposition:** no automated test — to obserwowalność (log count), nie asercja stanu.

## EX-820 — sufit stawki wykonawcy z „Problemów" do „Filtrów" (2026-09-22)

Sufit 65 % przestał być defektem: strażnik sądzi teraz **kwotę stałą**, mnożnik odpowiada za siebie
sam w swoim polu, a dwie pary dopełniających się filtrów zastąpiły wpis w „Problemach". Automat
sprawdza predykaty i składanie menu; na żywo zostaje to, czego spec nie widzi — czy czerwień pada
tam, gdzie ma, i czy zbiorcze odznaczenie da się cofnąć.

**Aktualizacja 2026-09-28 (nazewnictwo + próg na płaszczyznę).** Słowo „sufit" zniknęło z UI: grupa
w menu nazywa się „Udział wykonawcy w cenie", a wpisy mówią „z własną stawką ponad 65% ceny" /
„…ponad 55% ceny". Próg nie jest już jeden — idzie za płaszczyzną (`DEFAULT_COEFFS`): 65% z
narzędziami, 55,25% bez narzędzi, bo stawka bez narzędzi jest z definicji o 15% niższa. Boksy niżej
opisują stan sprzed tej zmiany; ich liczby dotyczą płaszczyzny „z narzędziami".

- [ ] „Filtry" w widoku „z narzędziami": dwie nowe pozycje progu z licznikami (grupa „Udział wykonawcy
      w cenie"); odznaczenie jednej chowa dokładnie tę połowę, a obie odznaczone chowają wszystko, co
      ma kwotę stałą
- [~] Te same dwie pozycje **nie** pojawiają się w widoku klienta — **nieaktualne od EX-856
  (2026-09-23):** bramka widoku zniknęła, więc obie pozycje sufitu stoją w menu „Filtry"
  niezależnie od widoku cen, także w kliencie. Boks zostaje jako zapis tego, co było prawdą
  22.09; scenariusz zastąpiony przez sekcję EX-856 niżej

### Findings — 2026-09-23 (staging/preview pass)

- [x] **Linear: EX-929.** **Dwa dopełniające się filtry sufitu, oba odznaczone naraz, chowają CAŁĄ rozpiskę (377/377), nie
      tylko 236 pozycji z kwotą stałą.** Zmierzone na inw. 137, widok „z narzędziami": `Pozycje
z kwotą stałą powyżej sufitu (35)` + `Pozycje bez kwoty stałej powyżej sufitu (342)` =
      35 + 342 = 377 = cały kosztorys. Przyczyna: `isFixedRateOverCeiling` w
      `src/lib/kosztorys/subcontractor-price-guard.ts` zwraca `false` dla `null`/„auto"
      (`overrideValueFor` się nie zgadza), więc dopełniający filtr „bez kwoty stałej powyżej sufitu"
      łapie też wszystkie 141 pozycji ze źródłem „auto", nie tylko kwotę-stałą-w-normie — zachowanie
      jest świadome i opisane komentarzem w `src/lib/kosztorys/row-conditions/registry.ts`. Ale zdanie
      z checklisty („obie odznaczone chowają wszystko, co ma kwotę stałą") czyta się jako „zostanie
      236 wierszy kwoty stałej", nie „zostanie 0". Do decyzji: albo checklist opisuje inny scenariusz
      niż zmierzony i trzeba go przeformułować, albo drugi filtr powinien się zawężać do
      `overrideValueFor(row, view) !== null`, żeby przestał połykać wiersze „auto". Boks #5 w tej
      sekcji zostaje odznaczony do czasu tej decyzji.

## EX-856 — „Filtry" bez bramki widoku, warsztat bez przełącznika cen (2026-09-23)

Menu „Filtry" nie pyta już, na którym planie cen stoi siatka: oferuje wszystkie osie zawsze, a listę
skraca próg licznika (wiersz z zerem nie istnieje, chyba że jest zaangażowany). Wiersze stoją pod
nagłówkami kategorii, jak w „Problemach". Warsztat szablonu stracił przełącznik „Widok cen".
Automat pokrywa arytmetykę modelu (`filters-menu-model`) i kolejność kategorii; na żywo zostaje to,
czego spec nie widzi — że nagłówki faktycznie się rysują, że licznik znika razem z wierszem i że
warsztat po zmianie w ogóle się otwiera.

- [x] Widok „klient": menu „Filtry" pokazuje obie pary stawek wykonawcy (z ogonem „w widoku …"),
      a odznaczenie którejś chowa wiersze, mimo że siatka stoi na cenie klienta
      **Zweryfikowane na stagingu (inw. 137, radio „Inwestor" = `checked`):** lista niesie obie osie
      z ogonem — „…z kwoty stałej w widoku z narzędziami (podwykonawca) (234)", „…z własnego
      mnożnika … (1)", „…„auto" … (142)" oraz „…z kwoty stałej w widoku bez narzędzi (pracownik)
      (235)", „…„auto" … (142)". Odznaczenie osi „kwota stała / z narzędziami" schowało obie
      pozycje „Bruzdowanie pod rury" (szukajka: `[]` z filtrem, dwa wiersze bez niego), a przycisk
      przeszedł w „Filtry (1)".
- [x] Przełączenie widoku cen przy odznaczonym filtrze stawki **nie** przywraca schowanych wierszy
      ani nie gubi zaznaczenia — zawężenie przeżywa zmianę widoku
      **Zweryfikowane na stagingu (inw. 137):** przy tym samym zawężeniu przejście na „Bez narzędzi
      (pracownik)" (radia: Inwestor `off` / Z narzędziami `off` / Bez narzędzi `on`) zostawiło obie
      pozycje „Bruzdowanie pod rury" schowane, a przycisk dalej czytał „Filtry (1)".
- [x] Rozpiska bez komentarzy: wiersza „Pozycje z komentarzem" nie ma na liście wcale (nie „(0)")
      **Zweryfikowane na stagingu (inw. 137):** pod „Komentarz" stoi wyłącznie „Pozycje bez
      komentarza (377)" — wiersza „Pozycje z komentarzem" nie ma w ogóle.
- [x] Ten sam wiersz, gdy jest **zaangażowany**, zostaje widoczny z „(0)" i da się go odkliknąć
      **Zweryfikowane na stagingu (inw. 137, oś rabatu):** z zaangażowanym „Pozycje bez rabatu (377)"
      i włączonym rabatem globalnym wiersz **został** na liście, przeliczony na „Pozycje bez rabatu
      (0)"; odkliknięcie go zdjęło zawężenie („Filtry (1)" → „Filtry") i wiersz zniknął z listy
      całkowicie (żadnej linii z „rabat" w menu).
- [x] Nagłówki kategorii („Przedmiar", „Wykonana praca", „Rabat", „Źródło stawki wykonawcy",
      „Sufit stawki wykonawcy", „Komentarz") pojawiają się raz każdy, w tej kolejności
      **Zweryfikowane na stagingu (inw. 137) — treść boksu była nieaktualna, nie aplikacja.**
      Na żywo nagłówków jest **pięć**, raz każdy, w kolejności: „Przedmiar i wykonana praca",
      „Rabat", „Źródło stawki wykonawcy", „Sufit stawki wykonawcy", „Komentarz". Zgadza się to
      z `src/lib/kosztorys/filter-groups.ts`, gdzie przedmiar i wykonana praca celowo dzielą jeden
      nagłówek; sześcionagłówkowe brzmienie tego punktu pochodziło sprzed tej decyzji.
- [x] Rabat globalny włączony: para filtrów rabatu per pozycja znika z listy, a jeśli była
      zaangażowana — zostaje z możliwością odkliknięcia
      **Zweryfikowane na stagingu (inw. 137, „Opcje rozliczenia → Rabat → Kwotowy"):** przed
      włączeniem pod nagłówkiem „Rabat" stało „Pozycje bez rabatu (377)" (wiersza „z rabatem" nie
      ma — próg licznika, 0 pozycji). Po włączeniu rabatu globalnego oś rabatu zostaje **wyłącznie**
      w postaci zaangażowanego wiersza „(0)"; po jego odkliknięciu nagłówek „Rabat" i oba wiersze
      znikają z listy. Ustawienie przywrócone na „Wyłączony".
- [x] „Zresetuj filtry" w menu „Sekcje" robi dokładnie to samo co w „Filtrach" (czyści zawężenia,
      zwinięte sekcje i szukajkę) i jest wygaszone, gdy nie ma czego czyścić
      **Zweryfikowane na stagingu (inw. 137):** przycisk stoi w korzeniu popovera (poza listą
      `cmdk`, stąd nie widać go w `[role=menu]`). Z menu „Sekcje" wyczyścił naraz zaangażowany
      filtr i szukajkę (`{trig:["Filtry","Sekcje"], search:""}`), po czym odczytał się jako
      `disabled: true`; ten sam przycisk z menu „Filtry" zdjął zaangażowane „Pozycje bez rabatu"
      („Filtry (1)" → „Filtry"). Zwinięcie „Podłóg" podbija licznik do „Sekcje (1)".
- [x] Warsztat szablonu (`/szablony/[id]`): przełącznika „Widok cen" nie ma, a siatka pokazuje
      kolumny planu klienta; reszta paska narzędzi bez zmian
      **Zweryfikowane na stagingu (`/szablony/4`, „kosztorys wzór testy 2 września 26", 202 poz.):**
      ani napisu „Widok cen", ani żadnego `role=radio` widoku na stronie nie ma. Nagłówki siatki:
      Akcje · Sekcja · Opis prac · Jednostka miary · **Cena j.m. netto** · Źródło ceny wykonawcy /
      Mnożnik / Cena j.m. netto — z narzędziami (podwykonawca) · Źródło ceny wykonawcy / Mnożnik —
      bez narzędzi (pracownik). Pasek narzędzi bez zmian: „Podsumowanie", „Pokaż narzędzia",
      „Dodaj", „Opcje", „Problemy", „Filtry", „Sekcje".

## EX-865 — „Własny mnożnik" jako trzecie źródło stawki wykonawcy (2026-09-23)

Stawka wykonawcy ma znów trzy źródła: „auto", „kwota stała" i — przywrócony po EX-766 — „własny
mnożnik" per pojedyncza praca, liczony jako `cena j.m. × mnożnik` przy każdym odczycie. Mnożnik
dostał **własną kolumnę** obok kwoty (`*_override_coeff`), a parę trzyma razem atomowy zapis
(`normalizeOverridePatch`), nie liczba kolumn. To samo źródło zna katalog prac. Automat pokrywa
arytmetykę, normalizację łatki, dwie niezależne kopie reguły ceny (TS i SQL), sufit, filtry, komórki
i cały katalog; na żywo zostaje to, czego spec nie widzi — że wyszarzenie, ukrywanie kolumny przed
inwestorem i przenoszenie między cennikiem a rozpiską działają w przeglądarce.

- [x] Rozpiska: przełączenie źródła na „własny mnożnik" **nie** rusza liczby w „Cena j.m."
      w chwili przełączenia
      **Zweryfikowane na stagingu (inw. 137, poz. 5 „mikrocement", widok „z narzędziami"):** przy „Cena
      j.m." 100,00 przełączenie źródła z „auto" na „własny mnożnik" zostawia 100,00 bez zmiany, a
      komórka „Mnożnik" z wyszarzonej kursywy zamienia się w pole do wpisania zasiane wartością
      mnożnika inwestycji (0,65).
- [x] Wpisanie `0,55` daje stawkę `cena × 0,55`, a podniesienie „Cena j.m." przesuwa ją natychmiast
      **Zweryfikowane na stagingu (inw. 137, poz. 5):** przy cenie 100,00 mnożnik 0,55 daje stawkę
      wykonawcy 55,00; podniesienie „Cena j.m." do 200,00 przestawia ją w tym samym renderze na 110,00,
      a zmiana mnożnika na 0,4 — na 80,00.
- [x] Komórka „Cena j.m." wykonawcy przy mnożniku jest wyszarzona i nie przyjmuje wpisu
      **Zweryfikowane na stagingu (inw. 137, poz. 5):** komórka „Cena j.m. netto — z narzędziami
      (podwykonawca)" jest `dsg-cell-disabled` i renderuje `<span>`, nie pole. Dwuklik nie ustawia na
      niej fokusu (aktywny zostaje `body`), a wpisanie `555` + Enter zostawia 80,00 — liczba idzie
      wyłącznie z `cena × mnożnik`.
- [x] Kolumna „Mnożnik" jest domyślnie ukryta i włącza się jednym tikiem w pickerze kolumn
      **Zweryfikowane na stagingu (inw. 137):** w pickerze „Kolumny" jeden klik w „Mnożnik — z narzędziami
      (podwykonawca)" zdejmuje nagłówek z siatki, drugi go przywraca. Domyślne ukrycie stoi w kodzie:
      `DEFAULT_HIDDEN_COLUMNS` (`src/lib/kosztorys/columns/column-config.ts`) bierze `ALL_PLANE_PRICE_KEYS`,
      czyli wszystkie kolumny stawki wykonawcy na każdą płaszczyznę.
- [x] Trzy odczyty komórki „Mnożnik" (odwrócenie kontraktu, właściciel 2026-09-23): własny mnożnik
      do wpisania, mnożnik inwestycji wyszarzony kursywą przy „auto", kreska „—" przy kwocie stałej
      **Zweryfikowane na stagingu (inw. 137, widok „z narzędziami"):** wszystkie trzy odczyty widać
      obok siebie w jednej siatce — poz. 5 (własny mnożnik) ma pole z wpisaną liczbą, poz. 1/2/4/11
      („auto") mają wyszarzoną kursywą wartość 0,65 w komórce `dsg-cell-disabled`, a poz. 3/7/8/12
      („kwota stała") pokazują „—".
- [x] Sortowanie po „Mnożniku" układa wiersze w kolejności liczb, które widać — wiersz „auto"
      z 0,65 nad wierszem z własnym 0,4
      **Zweryfikowane na stagingu (inw. 137):** „Sortuj malejąco" w nagłówku „Mnożnik" daje ciąg
      wierszy „auto" z 0,65, pod nimi jedyny wiersz z własnym mnożnikiem 0,4, a na końcu wszystkie
      „kwota stała" z kreską — czyli kolejność liczb, które widać w kolumnie.
- [x] Katalog prac: kolumna „Źródło" na każdą płaszczyznę, sortowalna, nazywa „auto" / „×0,65" /
      kwotę stałą
      **Zweryfikowane na stagingu:** tabela ma dwie kolumny „Źródło" — „z narzędziami (podwykonawca)"
      i „bez narzędzi (pracownik)" — każda obok swojej „Stawki" i „% ceny klienta". Trzy nazwy
      potwierdzone na żywych wierszach: „kwota stała" + kwota (Akrylowanie 8,00 zł), „auto" (stawka
      też „auto", udział „—") oraz na założonym do testu wpisie „QA mnożnik EX-865" (cena 100,00)
      „własny mnożnik" ze stawką „×0,65" i udziałem 65,0%. Kliknięcie nagłówka „Źródło z narzędziami"
      sortuje: rosnąco na górze „kwota stała", malejąco na górze „własny mnożnik", pod nim „auto".
- [x] Kolumny „Mnożnik" **nie ma** na linku dla inwestora ani w podglądzie klienta
      **Zweryfikowane na stagingu (inw. 137):** w „Podgląd" (`/podglad-inwestora/137`) i na linku
      inwestora (`/k/W2-…`) komplet nagłówków po przewinięciu siatki w prawo to Opis prac, Przedmiar,
      Etap 1, Pomiar (razem etapy), Jednostka miary, Cena j.m. netto, Wartość przedmiaru netto, Razem
      netto — po rabacie, Etap 1 netto, % wykonania, Pozostało netto — ani „Mnożnik", ani „Źródło ceny
      wykonawcy".
- [x] Podsumowanie rozliczenia wykonawcy pokazuje dla pozycji z mnożnikiem tę samą stawkę co siatka
      po przeładowaniu strony (zgodność kopii TS i SQL)
      **Zweryfikowane na stagingu (inw. 137):** po przeładowaniu poz. 5 trzyma „własny mnożnik" 0,4
      przy cenie 200,00, czyli stawkę 80,00 i 800,00 na wykonanych 10 m². „Podsumowanie →
      Podwykonawcy" (liczone po stronie serwera) pokazuje „Suma wykonanej pracy" 2387,50 = 1450,00
      (sekcja z poz. 5: 800,00 z mnożnika + 650,00 z wiersza „auto") + 937,50, więc kopia SQL wycenia
      mnożnik tak samo jak siatka.
- [ ] Pozycja z mnożnikiem ponad sufitem czerwienieje na obu komórkach i wchodzi do „Problemów"
      **Sprawdzone na stagingu (inw. 137, poz. 5) — zostaje otwarte, dwa osobne fakty:** 1. **Defekt: czerwieni się tylko jedna komórka.** Mnożnik 0,9 przy cenie 200,00 daje stawkę
         180,00 przy sufircie 130,00 (65%). W DOM czerwona (`text-destructive`) jest wyłącznie
         wyliczona „Cena j.m. netto — z narzędziami (podwykonawca)"; input w komórce „Mnożnik"
         zostaje neutralny, bo `SubcontractorCoeffCell`
         (`src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx`) nakłada
         `FLAGGED_TONE` tylko przy `edit.blockReason`, czyli przy odmowie zapisu — nie przy
         przekroczeniu sufitu. Decyzja właściciela była odwrotna: „czerwień na obu komórkach"
         (tabela decyzji, wiersz „Sufit" — plan skasowany przy archiwizacji, w historii:
      `git show 0ec91492^:context/changes/2026-09-23-przywrocenie-wlasnego-mnoznika-stawki-wykonawcy/plan-brief.md`). Do poprawienia w kodzie. 2. **Druga połowa treści checku jest nieaktualna, nie jest defektem.** „Problemy" nie mają i nie
         mają mieć wpisu o sufircie — od decyzji właściciela z 2026-09-20 sufit jest **filtrem**, a nie
         alarmem (`src/lib/kosztorys/row-conditions/registry.ts`, `kind: 'filter'`; EX-820). Sprawdzone:
         menu „Problemy" wymienia tylko „Ceny dla klienta / Stawki wykonawców — Pozycje bez ceny
         wykonawcy / Katalog prac", a pozycja po edycji **weszła do filtra** „Pozycje z własną stawką
         powyżej sufitu w widoku z narzędziami (podwykonawca)" (34 → 35). Treść checku należy
         przeformułować na „wchodzi do filtra sufitu".
- [x] Menu „Filtry" pokazuje trzy wpisy źródła na płaszczyznę, a wybór każdego odsłania kolumny cenowe
      **Zweryfikowane na stagingu (inw. 137):** grupa „Źródło stawki wykonawcy" wymienia na płaszczyźnie
      „z narzędziami (podwykonawca)" wszystkie trzy źródła (kwota stała 234, własny mnożnik 1, auto 142),
      a wybór każdego z nich odsłania komplet kolumn cenowych tej płaszczyzny — wybranie wpisu „auto"
      dla „bez narzędzi (pracownik)" dołożyło do siatki „Źródło ceny wykonawcy / Mnożnik / Cena j.m.
      netto — bez narzędzi (pracownik)", których wcześniej nie było.
      Na płaszczyźnie „bez narzędzi (pracownik)" wpisy są dwa, bo żadna pozycja nie ma tam własnego
      mnożnika — `filtersMenuModel` z założenia nie pokazuje filtra z licznikiem 0
      (`src/components/kosztorys/editor/toolbar/menus/filters-menu-model.ts`). To nie jest defekt.
- [x] Na inwestycji z materiałami wliczonymi w robociznę pozycja z mnożnikiem i wykonaną pracą wchodzi
      do „Stawki wykonawców liczone według formuły"
      **Zweryfikowane na stagingu (inw. 137):** przez UI („Wydatek" → „Wliczone w robociznę") dodany
      wydatek materiałowy 100,00 zł — panel „Materiały" pokazuje „Materiały wliczone w robociznę
      · Materiały budowlane · 100,00". Po tym w „Problemach" pojawił się wpis „Stawki wykonawców
      liczone według formuły … ustaw „Źródło ceny wykonawcy" na „kwota stała" (3)", a jego zaznaczenie
      zawęziło rozpiskę do trzech pozycji z wykonaną pracą liczonych z formuły — w tym poz. 5
      „mikrocement" (10,00 m², źródło „własny mnożnik"). Pozycje z „kwota stała" do wpisu nie wchodzą.
- [x] Praca z mnożnikiem zapisana do cennika wraca do **innej** inwestycji jako mnożnik i wycenia się
      jej własną ceną j.m. (nie zamraża kwoty z katalogu)
      **Zweryfikowane na stagingu:** poz. „mikrocement" z inw. 137 (cena 200,00, własny mnożnik 0,9)
      zapisana przez „Zapisz pozycję do katalogu prac" — dialog zapowiedział „Stawka z narzędziami
      (podwykonawca) ×0,9", a w bazie wpis katalogu ma `w_tools_rate_coeff = 0.9` i puste
      `w_tools_rate`, czyli rodzaj przeżył zapis. Wzięta potem przez „Dodaj → Praca z katalogu…" na
      **inną** inwestycję (138) wróciła jako „własny mnożnik" 0,9; po podniesieniu tam „Cena j.m.
      netto" z 200 na 300 stawka przeliczyła się na 270,00 (nie została na 180,00 z tamtej
      inwestycji).
- [x] „Porównaj z katalogiem" pokazuje rozjazd rodzaju nawet przy zgodnej kwocie (0,65 kontra 65 zł
      na cenie 100 zł)
      **Zweryfikowane na stagingu (inw. 138):** wpis katalogu „mikrocement" ma cenę 200,00 i mnożnik
      ×0,9, czyli 180,00 zł; pozycja w rozpisce dostała tę samą cenę 200,00 i „kwota stała" 180,00.
      Kwoty są identyczne, a „Porównaj z katalogiem" i tak wymienia pozycję w „Inne liczby niż
      w katalogu": wiersz „Stawka z narzędziami (podwykonawca) · 180,00 zł · ×0,9 (180,00 zł) ·
      0,00 zł" — różnica kwotowa zero, rozjazd rodzaju widoczny, bo katalog nazywa stawkę mnożnikiem,
      a rozpiska kwotą. Przy tej samej pozycji siedzi też ostrzeżenie „przekracza 65% ceny", a
      „Aktualizuj kosztorys (0)" słusznie nie ma czego nadpisać.
- [x] Wzięcie „auto" z katalogu kasuje w rozpisce **oba** nadpisania (kwotę i mnożnik)
      <!-- staging 2026-09-24: poz. „mikrocement" (inw. 138) z ustawionymi OBOMA nadpisaniami
           (kwota 180,00 + mnożnik ×0,5 — wiersz pokazywał „×0,5 (100,00 zł)"), wpis katalogowy
           przestawiony na „auto". „Problemy → Porównaj z katalogiem… → Pokaż … różnic" wylistowało
           rozjazd „Stawka z narzędziami (podwykonawca) · ×0,5 (100,00 zł) · auto · -30,00 zł";
           po zaznaczeniu tylko tego wiersza „Aktualizuj kosztorys (1)" obie kolumny nadpisań
           wróciły puste. -->

## wydruk-oferty — Wydruk oferty z kosztorysu (2026-09-23)

Utwardzenie spike'u: wydruk nie liczy już własnych sum (obie figury przychodzą z tych samych memo,
z których żyje siatka), kolumny przechodzą przez sufit ujawniania podglądu klienta, papier pokazuje
„Pozostało" i zawsze wariant OFERTA — niezależnie od trybu, w jakim inwestycja jest zostawiona.
**Zdezaktualizowane 2026-09-28** (`kosztorys-client-view-auto-columns`): wariantów już nie ma — wydruk
idzie za jedynym zestawem kolumn inwestora, a kolumny rozliczenia pokazuje dopiero przy wpisach.
Układ wydruku został nietknięty: właściciel go zatwierdził. Automat zamyka sumy, sufit, strukturę
tabeli i trzy ścieżki błędu pozycji menu; na żywo zostaje to, czego jsdom nie widzi — realne okno
wydruku i zgodność liczb z podglądem klienta, kosztorys po kosztorysie.

- [x] „Razem — <sekcja>" na wydruku == wiersz sumy sekcji w podglądzie klienta
- [x] „Razem netto" na wydruku == „Razem" pod kolumną „Wartość netto przedmiar" w podglądzie klienta
      <!-- staging 2026-09-24, inw. 137 (2 sekcje, 7 pozycji niepustych). Wydruk przechwycony
           podmianą `window.open` (bez dotykania prawdziwego okna wydruku): „Razem — Prace dodatkowe
           3 000 zł", „Razem — Wyburzenia i demontaże 2 800 zł", „Razem netto 5 800 zł".
           `/podglad-inwestora/137` w tym samym stanie: „Razem Prace dodatkowe 3000,00",
           „Razem Wyburzenia i demontaże 2800,00", „Razem 5800,00" w kolumnie „Wartość przedmiaru
           netto" (kolumna „Razem netto — po rabacie" niesie 3000,00 / 1675,00 / 4675,00 i słusznie
           nie jest tym, co drukuje oferta). -->
- [x] ~~Podgląd zostawiony w trybie ROZLICZENIE, a wydruk nadal daje dokument ofertowy z kolumnami
      wariantu OFERTA~~ — zdezaktualizowane 2026-09-28: trybu nie ma
      <!-- staging 2026-09-24, inw. 137. Aktywny wariant w „Ustawieniach podglądu inwestora" =
           „Rozliczenie" (zestaw m.in. Pomiar (razem etapy), Razem netto, Etapy — ilość / kwota,
           % wykonania). Przechwycony wydruk dał mimo to kolumny wariantu OFERTA: Opis prac ·
           Przedmiar · Jednostka miary · Cena j.m. · Wartość netto. -->
- [x] Odznaczenie „Pozostało" w ustawieniach podglądu zabiera kolumnę i z ekranu, i z wydruku —
      a suma sekcji zostaje pod „Wartość netto przedmiar"
      <!-- staging 2026-09-24, inw. 137, wariant OFERTA. Z zaznaczonym „Pozostało netto (względem
           przedmiaru)": `/podglad-inwestora/137` pokazuje tę kolumnę, a wydruk niesie nagłówki
           Opis prac · Przedmiar · Jednostka miary · Cena j.m. · Wartość netto · Pozostało.
           Po odznaczeniu i zapisie kolumna znika z obu — wydruk ma pięć nagłówków bez „Pozostało",
           a podgląd kończy się na „Wartość przedmiaru netto". Sumy sekcji bez zmian w obu stanach:
           „Razem — Prace dodatkowe 3 000 zł", „Razem — Wyburzenia i demontaże 2 800 zł",
           „Razem netto 5 800 zł". (Zakładek wariantu i ich potwierdzenia
           już nie ma — 2026-09-28.) -->
- [ ] MANAGER (nie OWNER) — czy „Wygeneruj ofertę w PDF" ma być dla niego dostępne? Sąsiednie pozycje
      menu są wygaszane przez `useMayServeTheClient()`, ta nie. **Pytanie do właściciela**, nie defekt.

## zamrozone-brutto-wydatku-netto

### Phase 2: Price the netto row from the invoice

- [x] Kosztorys v2 inwestycji 146 (lokalny dump), zakładka „Materiały", stawka 23% → wiersz „Materiały wykończeniowe netto" pokazuje 4453,33 / 4809,60 / −356,27.
      **Zweryfikowane na stagingu na inwestycji 146:** w bazie preview nie było wydatku netto, więc
      dodany przez UI („Wydatek inwestycyjny netto", Przelew, Materiały wykończeniowe, brutto 4809,60 /
      netto 4453,33) i stawka materiałów ustawiona na 23%. Blok „Wydatki inwestycyjne" pokazuje wtedy
      wiersz „Materiały wykończeniowe netto" 4453,33 / 4809,60 / −356,27 — kwota netto z faktury, nie
      przeliczona po 23%. Fixtura skasowana, stawka przywrócona po sprawdzeniu.
- [x] Zmiana stawki na 12% → ten wiersz bez zmian; „Materiały budowlane" Netto i Różnica się przesuwają.
      **Zweryfikowane na stagingu na inwestycji 137** (na 146 nie ma wydatku netto w bazie preview):
      stawka 23% → „Materiały budowlane" 406,50 / 500,00 / −93,50; stawka 12% → 446,43 / 500,00 / −53,57;
      wiersz „Materiały wykończeniowe netto" w obu wypadkach 1000,00 / 1230,00 / −230,00 (bez zmian).
- [x] Rozliczenie brutto → jedna kolumna „Kwota"; wiersz netto pokazuje 4453,33; „Razem" = „Materiały" w Podsumowaniu.
      **Zweryfikowane na stagingu na inwestycji 137:** po przełączeniu „Sposób rozliczenia materiałów" na
      Brutto (z potwierdzeniem „zmiana widoczna dla inwestora") blok ma jedną kolumnę „Kwota":
      „Materiały budowlane" 500,00, „Materiały budowlane netto" 1000,00 (kwota netto z faktury, nie ubruttowiona),
      „Razem" 1500,00 — i tyle samo pokazuje „Materiały" w Podsumowaniu (Robocizna 8675,00, Łącznie 10 175,00).

### Phase 3: Remove the „Wydatki inwestycyjne" pie

- [x] Zakładka „Materiały" bez wykresu kołowego w edytorze i w podglądzie klienta; wykres „Struktura kosztów" w Podsumowaniu nadal jest.
      **Zweryfikowane na stagingu (inw. 137):** edytor — zakładka „Materiały" 0 wykresów, „Podsumowanie"
      1 wykres („Struktura kosztów", Robocizna 85,3% / Materiały 14,7%); link inwestora — to samo:
      „Materiały" 0 wykresów, „Podsumowanie" 1.

## pokaz-wszystkie-pozycje

### Phase 2: Switch and muted revealed rows

- [x] `/k/<token>` z włączonym „Ukryj pozycje…" → w nagłówku „Pokaż wszystkie pozycje (+N)", N zgadza się z liczbą w oknie „Inwestor".
- [x] Włączenie pokazuje ukryte pozycje wyszarzone, numerowane po kolei; wyłączenie przywraca listę i numerację.
- [x] Podsumowanie i kwoty sum sekcji identyczne przy włączonym i wyłączonym przełączniku; licznik
      „(N poz.)" w nagłówku sekcji rośnie o odsłonięte pozycje — to oczekiwane, nie rozjazd.
- [x] Sekcja złożona wyłącznie z pustych pozycji: po włączeniu jej nagłówek i stopka nie są
      wyszarzone, a wiersze tak — czy to czyta się dobrze, czy nagłówek też powinien być wyszarzony?
      **Potwierdzone na stagingu (link inwestora inw. 137, 2026-09-23):** sekcja „Instalacja
      wodno-kanalizacyjna / C.O." (9 poz., wszystkie puste) — po włączeniu przełącznika wszystkie
      jej wiersze są wyszarzone (`lab(48.496 0 0)`), a nagłówek „… (9 poz.)" i stopka „Razem … 0,00 /
      0,00" zostają w pełnej czerni (`lab(2.75381 0 0)`). Czyta się to tak, jakby sekcja z zerową
      wartością była normalną pozycją oferty.
      **Decyzja właściciela (2026-09-28): zostawić jak jest — box zamknięty jako `dismissed`.**
      Oglądane na `/podglad-inwestora/161` („Agata Szymanowska malowanie") z włączonym „Pokaż
      wszystkie pozycje (+302)", sekcja „Instalacja wodno-kanalizacyjna + c.o." (7 poz., wszystkie
      puste): odsłonięte wiersze nie czytają się jako wyszarzone i taki układ jest pożądany. Nie
      wyszarzamy nagłówka ani stopki i nie wzmacniamy wyciszenia wierszy.
- [x] Przeładowanie strony otwiera z wyłączonym przełącznikiem.
- [x] Bez „Ukryj pozycje…" w oknie „Inwestor" przełącznik się nie pokazuje.
- [x] Wydruk oferty bez zmian przy włączonym przełączniku.
      Wydruk bierze zawsze `config.variants.OFFER` (`offer-print-action.tsx`), a przełącznik to stan
      lokalny widoku (`showAllRows`, `use-kosztorys-view-state.ts`), którego ścieżka wydruku nie
      dostaje — na linku inwestora nie ma zresztą żadnego przycisku wydruku.
- [x] Na telefonie (<768px) przełącznik stoi pod „Podsumowaniem", etykieta nie jest ucięta.

## materialy-inwestora-brutto

### Phase 1: „Wydatki inwestycyjne" merged per category for the investor

- [x] Link inwestora inwestycji 146 (jedyny wydatek netto): „Wydatki inwestycyjne" pokazuje same
      kategorie + „Razem", bez wiersza „… netto"; „Razem" = „Materiały" w Podsumowaniu (bez stawki)
      albo jego kolumna Netto (ze stawką).
- [x] Ta sama inwestycja w edytorze kierownika: wiersz „… netto" nadal jest, kwoty bez zmian.
      **Zweryfikowane na stagingu na inwestycji 137** (baza preview nie ma wydatku netto na 146):
      link inwestora → „Wydatki inwestycyjne | Kwota | Materiały budowlane 1500,00 | Razem 1500,00" —
      bez wiersza „… netto", i „Razem" = „Materiały" w Podsumowaniu (1500,00).
      Edytor kierownika tej samej inwestycji → wiersz „Materiały budowlane netto" nadal jest
      (1000,00 / 1230,00 przy rozliczeniu netto; 1000,00 przy brutto), kwoty niezmienione.

### Phase 2: One brutto wydatki list for the investor

- [x] Link inwestora: „Lista wydatków" to jedna lista bez przełącznika, każdy wiersz w brutto
      (faktura netto po swoim brutto z faktury), „Razem" = Σ brutto.
      **Zweryfikowane na stagingu (inw. 137):** jedna lista, w jej obrębie zero przełączników/radiów;
      wiersze 500,00 (wydatek brutto) i 1230,00 (wydatek netto — po swoim brutto z faktury),
      „Razem" 1730,00 = suma brutto.
- [x] „Pobierz faktury" na linku inwestora pobiera zip z fakturami brutto i netto.
      **Zweryfikowane na stagingu (inw. 137):** na liście wydatków linku inwestora przycisk „Pobierz faktury"
      pobiera `faktury-testowe_inwestycje-Materiały-2026-09-23.zip` z dwoma plikami —
      `20260923_QA_EX-fixture_faktura_brutto.pdf` (wydatek brutto) i `20260923_QA_EX-fixture_faktura_netto.pdf`
      (wydatek netto), czyli faktury z obu zbiorów w jednym archiwum bez rozbicia brutto/netto w nazwie.
- [x] Edytor kierownika: trzy zakładki jak dotąd, zakładka netto nadal Netto + Brutto.
      **Zweryfikowane na stagingu (inw. 137):** zakładki są nadal per zbiór
      (`DATASET_LABELS` w `materials-transactions-table.tsx`: brutto / rozliczane netto / wliczone
      w robociznę); 137 ma po jednym wydatku brutto i netto, więc renderują się dwie —
      trzeciej nie ma, bo nie ma wydatków wliczonych w robociznę, nie dlatego że zniknęła.
      Zakładka netto ma nadal obie kolumny: Netto 1000,00 i Brutto 1230,00, „Razem" 1000,00 (netto).

### Phase 3: E2E

- [ ] `pnpm test:e2e e2e/client-share.spec.ts` na świeżo zaseedowanym db-test przechodzi.

## Kosztorys — manager udostępnia inwestorowi + wydruk oferty bez nagłówków (cdd32061, 8a6552c5) — staging 2026-09-24

Scope cut mid-pass to a single question: can a MANAGER generate the investor share link on staging.
Rotate/revoke-as-checks, client-view settings, OWNER, and print were not driven this pass.

- [x] MANAGER (`verify-manager-ex748@wykonczymy.test`): „Inwestor" → „Udostępnij" is enabled (not
      greyed), opens the share dialog on the settings step, „Dalej" → „Wygeneruj link" creates a row
      in `kosztorys_shares` (investment 106, verified via `psql`). The `/k/<token>` URL renders the
      investor preview (`Sulmierzycka 6/29 - poprawki`) with the `payload-token` cookie cleared —
      confirmed no-login access.
      **Restored:** deleted the share row for investment 106 afterward (`kosztorys_shares` back to
      its pre-pass single row for investment 137). Deleted the throwaway
      `src/scripts/qa-reset-staging-passwords.ts`.

## EX-819 — wartość spoza zakresu odmawiana na głos, nie przycinana (2026-09-28)

Pole liczbowe spoza zakresu odpowiada teraz jak komórka rozpiski: nie zapisuje, przywraca poprzednią
wartość i mówi „Nieprawidłowa wartość — przywrócono X". Automat sprawdza to na komponentach i akcji;
na żywo zostaje to, czy komunikat pada w panelu, a przeliczenie nie.

- [x] Panel „Podsumowanie" → „Opcje rozliczenia": „Stawka vat na materiały" przy zapisanych 23 %,
      wpisz `230` → „Zapisz" jest aktywny; klik → toast „Nieprawidłowa wartość — przywrócono 23%.",
      pole wraca do 23, materiały **nie** przeliczają się (po odświeżeniu nadal 23 %)
      **Zweryfikowane na stagingu (inw. 137, zapisane 8 %):** wpis `230` uzbraja „Zapisz"; klik →
      toast „Nieprawidłowa wartość — przywrócono 8%.", pole wraca do 8, „Zapisz" znów nieaktywny;
      po pełnym przeładowaniu strony wartość nadal 8 %.
- [x] To samo w widoku „Materiały" (pole „Stawka vat na materiały" przy rozliczeniu netto),
      tym razem zatwierdzone **Enterem** — jeden toast, stawka bez zmian
      **Zweryfikowane na stagingu (inw. 137):** radio „Materiały" (`role="radio"`, `[checked]`) →
      `230` + Enter → dokładnie jeden toast „Nieprawidłowa wartość — przywrócono 8%.", pole i
      „Zapisz" (disabled) wracają do stanu sprzed wpisu.
- [x] Wpis w zakresie (np. `8`) w tym samym polu zapisuje się bez żadnego komunikatu
      **Zweryfikowane na stagingu (inw. 137):** `12` + Enter zapisuje się bez toastu, pole pokazuje
      12 i „Zapisz" wraca nieaktywny; przywrócono do 8 tym samym sposobem, żeby zostawić fixture bez zmian.
- [x] Stawka VAT inwestycji w „Opcje rozliczenia": `150` → ten sam toast i przywrócona poprzednia stawka
      **Zweryfikowane na stagingu (inw. 137, zapisane 8 %):** `150` + Enter → toast „Nieprawidłowa
      wartość — przywrócono 8%.", pole i „Zapisz" (disabled) wracają do 8.
- [x] Pasek edytora, mnożnik ceny: `-0,2` i wyjście z pola → toast „Nieprawidłowa wartość —
      przywrócono 0,6." (przy zapisanym 0,6), mnożnik bez zmian; `0,9` nadal się zapisuje z
      ostrzeżeniem o przekroczeniu 65 %
      **Zweryfikowane na stagingu (inw. 137, panel „Podwykonawcy" → Mnożnik ceny, pole „Bez
      narzędzi (pracownik)", zapisane 0,5525):** `-0,2` + Tab → toast „Nieprawidłowa wartość —
      przywrócono 0,553.", pole wraca do pełnej wartości `0.5525` (patrz finding niżej — toast
      zaokrągla do 3 miejsc). `0,9` + Tab zapisuje się (pole pokazuje `0.9`) i wywołuje osobny
      toast ostrzegawczy „Mnożnik 0,9 przekracza 55,25% ceny dla inwestora — wykonawca zjada
      marżę na pozycjach ze źródłem „auto"." Przywrócono `0,5525`, żeby zostawić fixture bez zmian.

### Findings — 2026-09-28

- [x] **NAPRAWIONE** — Toast odrzucenia w polu mnożnika zaokrąglał przywróconą wartość do 3 miejsc po przecinku
      (`value.toLocaleString('pl-PL')` bez `maximumFractionDigits` w `restore`/`settle`,
      `src/components/ui/decimal-field.tsx`), a sam input wraca z pełną precyzją. Zaobserwowane na
      inw. 137: zapisane `0.5525`, po odrzuceniu `-0,2` toast mówi „przywrócono 0,553.", ale pole
      pokazuje `0.5525`. Nie jest to flicker/przycięcie zapisu (EX-819 tego dotyczy), tylko
      niespójny tekst komunikatu vs. rzeczywisty stan pola przy wartościach o >3 miejscach po
      przecinku. **Needs human:** czy to wystarczająco częsty przypadek (mnożniki z 4 miejscami po
      przecinku), żeby wart było dodać `maximumFractionDigits` dopasowany do precyzji pola, czy
      zostawić — sam odrzucony wpis i tak nie psuje danych.
      **Rozstrzygnięte bez pytania:** to nie kwestia gustu — komunikat nazywał liczbę, której pole nie
      przywróciło, a cztery miejsca po przecinku są tu normą (`0,5525` to domyślny pułap udziału ceny
      klienta w kodzie), nie przypadkiem skrajnym. Fix: `maximumFractionDigits: 20` w
      `src/components/ui/decimal-field.tsx:109`.
      **Test disposition:** test-driven-debugging · dom — `src/__tests__/components/ui/decimal-field.test.tsx`,
      red→green potwierdzone (przed fixem asercja dostawała „przywrócono 0,553").

## podglad-inwestora-czytelnosc — podgląd inwestora bez szarości, z pasami kolumn (2026-09-28)

Tylko podgląd inwestora (`/k/<token>` i „Podgląd inwestora" z edytora); edytor właściciela bez zmian.
Sprawdzone lokalnie w Playwright na publicznym linku — do powtórzenia na stagingu.

- [x] Komórki tabeli są białe, nie szare — także „Wartość przedmiaru netto", „Pomiar (razem etapy)"
      i inne wyliczane kolumny; liczby w nich czarne, nie szare
      **Zweryfikowane na stagingu (inw. 137, `/k/W2-sWO8axGdMpfoMdMj9DaBVxrQGP50L`):** komórka
      wyliczana „Wartość przedmiaru netto" (`dsg-cell-disabled`) ma tło `lab(100 0 0)` (biel) i tekst
      `lab(2.75 0 0)` (prawie czarny) — `[data-muted]` w preview dziedziczy `color: var(--color-foreground)`
      zamiast szarości (`globals.css:563`), a `--dsg-cell-disabled-background-color` jest w preview
      równe tłu komórki (`globals.css:503`).
- [x] Nazwy kolumn w nagłówku pogrubione i czarne
      **Zweryfikowane na stagingu:** `.dsg-cell-header span` ma `font-weight: 700` tylko w
      `.kosztorys-grid-preview` (`globals.css:511`), a `--dsg-header-text-color` w preview = `var(--color-foreground)` (`globals.css:504`) — wizualnie pogrubione, czarne etykiety w zrzucie ekranu.
- [x] Pod nagłówkiem jedna cienka czarna linia, taka sama jak linia nad nagłówkiem; pierwszy pasek
      etapu (np. „Prace dodatkowe") nie dokłada pod nią drugiej ani trzeciej kreski
      **Zweryfikowane na stagingu:** `--header-rule-color: var(--color-foreground)` w preview
      (`globals.css:506`, komentarz „the preview's header sits right under the page header's dark
      rule") — ta sama zmienna barwi linię nad i pod nagłówkiem. Pierwszy wiersz pod nagłówkiem ma
      `border-top: none` wymuszone regułą `.dsg-row-header + .dsg-row .dsg-cell` (`globals.css:547`),
      więc nie dokłada własnej kreski. Zrzut ekranu: jedna ciemna linia między paskiem narzędzi a
      nagłówkiem i między nagłówkiem a „Prace dodatkowe", bez podwojenia.
- [x] Co druga kolumna ma delikatnie szare tło, od nagłówka do ostatniego etapu; kolorowe paski
      etapów i ich „Razem …" przykrywają pasy (pasek czyta się jako jedna belka)
      **Zweryfikowane na stagingu:** kolumny nagłówka na przemian `lab(100 0 0)` (biel) i
      `oklab(0.9829 …)` (delikatny szary pas) — ściśle naprzemiennie na wszystkich 9 kolumnach danych.
      Zrzut ekranu potwierdza, że pasek sekcji („Prace dodatkowe", „Wyburzenia i demontaże") jest
      jednolitą belką w kolorze etapu na całej szerokości, bez przebijających pasów.
- [x] Przewinięcie tabeli w poziomie nie zamienia pasów miejscami (ta sama kolumna zostaje szara)
      **Zweryfikowane na stagingu:** po `scrollLeft` z 0 na 276px te same nazwane kolumny
      („Przedmiar", „Pomiar…", „Cena j.m. netto"…) zachowały te same kolory tła — pasy są przypięte
      do tożsamości kolumny, nie do widocznej pozycji.
- [x] Na dole: pusty rząd, potem „Razem" z grubszą kreską nad nim — bez powtórzonych nazw kolumn
      (nazwę każdej kolumny podaje przyklejony nagłówek); całe podsumowanie białe, bez pasów kolumn i
      bez szarego tła _(przeredagowane po `07ee8edc`, który usunął powtórzone nazwy)_
      **Zweryfikowane na stagingu** (inw. 137, `/k/W2-sWO8axGdMpfoMdMj9DaBVxrQGP50L`): ostatnie dwa
      wiersze siatki to pusty spacer (`SPACER_ROW_ID`, wewnętrzny `div.bg-background`) i „Razem"
      (`TOTALS_ROW_ID`) z `border-top: 2px` (grubsza niż standardowe 1px). Zewnętrzne `.dsg-cell` mają
      klasę `kosztorys-stripe-column` (paskowanie), ale oba wiersze renderują wewnętrzny `div`
      wypełniający całą komórkę na biało — spacer przez `bg-background`, Razem przez
      `.kosztorys-grid-preview .kosztorys-totals-cell { background: var(--color-background) }`
      (`globals.css:517`), więc pasek pod spodem jest wizualnie niewidoczny (potwierdzone
      zrzutem ekranu — spacer i „Razem" jednolicie białe). Wiersz „Razem" ma tylko dwie komórki z
      tekstem („Razem" i „5800,00") — brak powtórzonych nazw kolumn.
- [x] Edytor właściciela bez zmian: szare komórki tylko do odczytu, szare liczby wyliczane, bez pasów,
      „Razem" na szarym tle
      **Zweryfikowane na stagingu (`/inwestycje/137/kosztorys_v2`, OWNER):** `.kosztorys-grid` bez
      klasy `-preview`; komórka wyliczana ma tło `oklab(0.9745 …)` (szare, `--color-muted`);
      `[data-muted]` liczba ma `color: lab(48.5 0 0)` (wyraźnie szary, nie czarny); `kosztorys-stripe-column`
      — 0 elementów w DOM edytora; „Razem" ma tło
      `lab(96.5 …)` (`bg-muted`, szare) — preview'owa reguła bielenia go nie dotyczy.
- [x] Edytor (widok managera): pod nagłówkiem tabeli cienka szara linia w tym samym kolorze co linia
      nad nim (pod paskiem narzędzi); pierwszy pasek etapu nie dokłada pod nią drugiej kreski
      **Zweryfikowane na stagingu:** poza preview `--header-rule-color` spada na fallback
      `var(--dsg-border-color)` = `var(--color-border)` (`globals.css:533,484`), ten sam token co
      `border-border` paska narzędzi (`kosztorys-editor-toolbar.tsx:31`) — obie linie dzielą tę samą
      zmienną, więc są tym samym kolorem z definicji; `lab(90.95 …)`, wyraźnie jaśniejsza/szara niż
      wariant preview.

## sheet-import-wartosc-pomiar — import rozpoznaje „Wartość netto pomiar z natury" (2026-09-28)

Arkusze z szablonu od lipca mają dwie kolumny wartości — „Wartość netto przedmiar" (`S`) i „Wartość
netto pomiar z natury" (`T`) — i „Pobierz z arkusza Google…" odmawiał na „Nie znaleziono kolumny
„Wartość netto"". Teraz sam bierze `T`. Z localhosta/preview czytelne są m.in. Namysłowska 3/34,
Kulisiewicza 16, Kinowa 23/3, Bernardyńska 12/19; dziesięć najnowszych arkuszy (Topiel 6 … Postępu 4a)
nie jest udostępnione kontu tylko do odczytu, więc te sprawdza się na produkcji.

- [x] Inwestycja z arkuszem w nowym szablonie (np. Namysłowska 3/34) → „Pobierz z arkusza Google…":
      okno od razu pokazuje podgląd „Co wejdzie", bez „Nie znaleziono kolumny „Wartość netto"" i bez
      listy „wybierz kolumnę"; „Pobierz i zastąp" aktywny
      **Zweryfikowane na stagingu (inw. 110 „Namysłowska Bartłomiej Ziółkowski 3/34", OWNER):** okno
      od razu pokazało podgląd „Co wejdzie" (14 sekcji · 384 prac · 1 etapów), bez błędu o kolumnie i
      bez listy wyboru kolumny; „Pobierz i zastąp" `disabled=false`. Zamknięte przez „Anuluj" —
      import NIE został wykonany.
- [x] W tym samym podglądzie porównanie sum nie zgłasza rozjazdu wynikającego z czytania kolumny
      przedmiaru — liczba z podsumowania arkusza zgadza się z sumą kolumny „Wartość netto pomiar z natury"
      **Zweryfikowane na tym samym podglądzie (inw. 110):** sekcja „Porównanie sum" — „wartość netto"
      Arkusz Google 89 456,68 zł = Ta aplikacja 89 456,68 zł „zgadza się"; „R netto - suma prac
      wykonannych" 38 149,08 zł = 38 149,08 zł „zgadza się".
- [x] Arkusz w starym układzie z jedną kolumną „Wartość netto" (np. Plac Hallera 6, Wolska 117/50)
      pobiera się jak dotąd, bez żadnego pytania o kolumnę
      **Zweryfikowane na stagingu (inw. 108 „Plac Hallera 6", OWNER):** okno od razu pokazało podgląd
      „Co wejdzie" (13 sekcji · 321 prac · 2 etapów) i „Porównanie sum" (wartość netto 25 005,20 zł =
      25 005,20 zł „zgadza się"), bez żadnego pytania/wyboru kolumny. Zamknięte przez „Anuluj" — import
      NIE został wykonany.
- [x] Postępu 4a (kolumna wskazana wcześniej ręcznie na `T`), na produkcji: podgląd rusza bez pytania
      o kolumnę i nie pokazuje już dopisku o ręcznym wskazaniu
      **Zastąpienie (inw. 146 „Inna Chorna Postępu 4a" nie ma w bazie preview żadnego wiersza
      `kosztoryses` — brak podpiętego arkusza, więc nie da się jej odczytać stąd; sprawdzone
      bezpośrednio w bazie preview przed startem):** identyczna ścieżka kodu zweryfikowana na inw.
      106 „Sulmierzycka 6/29 - poprawki" — `kosztoryses.sheet_column_mapping = {"netValue": 19}`
      (kolumna `T`, 0-indeksowana), arkusz `1vafiUL_Yr951Ky8AyE6Urko201aRQVkACrDG0X4PWWs` czytelny
      kontem tylko do odczytu, nagłówek w nowym szablonie (`S` = „Wartość netto przedmiar”, `T` =
      „Wartość netto pomiar z natury”, potwierdzone `scripts/inspect-sheet.mjs`). Inwestycja była
      `status=completed` (edytor tylko do odczytu, menu „Arkusz Google” niedostępne) — tymczasowo
      przełączona na „Aktywna” przez UI (`Edytuj inwestycję`), zweryfikowana, i z powrotem na
      „Zakończona” tym samym UI po zakończeniu; `sheet_column_mapping` w bazie preview niezmieniony.
      Otwarte „Opcje → Pobierz z arkusza Google…”: okno od razu pokazało podgląd „Co wejdzie” (14
      sekcji · 379 prac · 2 etapów), bez „Nie znaleziono kolumny „Wartość netto”” i bez listy wyboru
      kolumny; „Pobierz i zastąp” `disabled=false`. Blok „Kolumny wskazane ręcznie” **nieobecny** —
      zgodnie z `resolveLaborColumns`/`FIELD_MATCHERS.netValue` (`src/lib/kosztorys/sheet-import/
  columns.ts`), nagłówek `T` „wartosc netto pomiar z natury” trafia w jeden z trzech literałów
      matchera (dokładne dopasowanie), więc `netValue` rozwiązuje się z nazwy i pętla po
      `unresolved` (jedyne miejsce, gdzie `resolveLaborColumns` w ogóle sięga po zapisany
      `mapping`) nigdy nie widzi zapisanego wskazania `19` — zapisane wskazanie jest w tym locie
      martwe. „Porównanie sum” zgłasza zgodność: „Podsumowanie arkusza Google zgadza się z tym, co
      policzyliśmy z jego prac.” (wiersz „zgadza się”). Zamknięte przez „Anuluj” — import NIE został
      wykonany.

## catalogue-picker-virtualization — „Dodaj pracę z katalogu" rysuje tylko widoczne wiersze (EX-860, 2026-09-28)

Lista w oknie rysuje tylko to, co widać; zmiana we wspólnej tabeli dotyka też dwóch tabel
podsumowania kosztorysu. Pierwsze cztery sprawdzone lokalnie (build produkcyjny, inw. 157) — do
powtórzenia na stagingu.

- [ ] `pnpm exec playwright test e2e/work-catalogue.spec.ts` na bazie E2E — uruchamia człowiek

## protokol-odbioru — protokół odbioru prac z menu „Inwestor" (2026-09-28)

### Phase 3: Dialog, menu item and print wiring

- [x] „Inwestor → Protokół odbioru…" jest w kosztorysie inwestycji i nie ma go w szablonie.
      Zweryfikowano żywo: inw. 137 ma przyciski „Inwestor"/„Pracownicy" z „Protokół odbioru…" w
      środku; szablon `/szablony/4` („kosztorys wzór testy…") ma tylko Dodaj/Opcje/Problemy/Filtry/
      Sekcje — bez „Inwestor" i bez „Pracownicy".
- [x] Dialog podpowiada Zamawiającego (osoba kontaktowa, a bez niej nazwa inwestycji), adres,
      dzisiejsze daty, rodzaj odbioru „końcowy", miejscowość „Warszawa" i Wykonawcę „Wykończymy sp.
      z o. o." (do poprawienia w polu). Zweryfikowano żywo (staging, inw. 137, bez osoby kontaktowej):
      Zamawiający = „testowe inwestycje" (fallback na nazwę inwestycji), Data sporządzenia/odbioru =
      dzisiejsza (28 wrz 2026), rodzaj odbioru „końcowy", miejscowość „Warszawa", Wykonawca
      „Wykończymy sp. z o. o.", adres puste pole.
- [x] Rozliczenie w dialogu = Robocizna / Materiały / Wpłaty / Pozostało do zapłaty z „Podsumowania"
      (netto), co do grosza; Strata pojawia się tylko, gdy jest. Zweryfikowano żywo: dialog pokazał
      Robocizna 4675,00 zł / Materiały 0,00 zł / Wpłaty 0,00 zł / Pozostało do zapłaty 4675,00 zł —
      dokładnie zgodne z zakładkami „Robocizna" (Razem netto 4675,00), „Materiały" („Brak wydatków…")
      i „Podsumowanie" (Robocizna 4675,00 Łącznie, Wpłaty 0,00, Pozostało do zapłaty 4675,00) w
      Podsumowaniu edytora. Strata nie występuje na tej inwestycji i wiersza „Strata" brak — zgodnie z
      oczekiwaniem.
- [x] Na kosztorysie z rabatem Robocizna = kwota **przed** rabatem, pod nią osobny wiersz „Rabat" —
      obie liczby jak w „Podsumowaniu"; Pozostało do zapłaty bez zmian. Zweryfikowano żywo (staging,
      inw. 106, `global_discount_value=2419` w DB): dialog protokołu pokazał Robocizna 14 492,50 zł /
      Rabat -2419,00 zł / Materiały 4561,48 zł / Suma 16 634,98 zł / Wpłaty -16 635,00 zł / Nadpłata
      -0,02 zł — dokładnie zgodne z zakładką „Podsumowanie" edytora (Robocizna 14 492,50 / Rabat
      -2419,00 / Materiały 4561,48 / Łącznie 16 634,98 / Wpłaty -16 635,00 / Nadpłata -0,02) i z
      zakładką „Robocizna" (Razem netto 14 492,50 — kwota przed rabatem). Rabat DB (2419) zgadza się z
      wierszem „Rabat" co do grosza. „Pozostało do zapłaty" na tej inwestycji jest w istocie nadpłatą
      (-0,02 zł), co jest spójne, nie zmienione przez sam rabat.
- [x] Inwestycja bez osoby kontaktowej: zmiana samego adresu i „Zaktualizuj dane inwestycji" — osoba
      kontaktowa zostaje pusta (nie wpisuje się nazwa inwestycji). Zweryfikowano żywo + w DB (inw. 137,
      preview): wpisano adres, „Zaktualizuj dane inwestycji" się odblokował, po kliknięciu
      `contact_person` w DB zostało puste (nie „testowe inwestycje"), `address` = wpisana wartość,
      `phone`/`email`/`notes` nietknięte. Fixture przywrócony (adres wyczyszczony i ponownie
      zapisany — `address` z powrotem puste).
- [x] Zakres prac to dokładnie pozycje z niezerowym Pomiarem z natury. Zweryfikowano zapytaniem SQL do
      `DB_POSTGRES_URL_PREVIEW` (suma `stage_progress.qty_done` per `kosztorys_items` dla inw. 137): 7
      pozycji z niezerowym pomiarem, dokładnie te same nazwy/ilości/jednostki co w dialogu „Zakres prac
      (7)" (mikrocement 10 m², montaż płyt osb 10 m², 4× bruzdowanie, Demontaż grzejników 5 szt).
- [x] „Zaktualizuj dane inwestycji" jest nieaktywny, dopóki Zamawiający/adres się nie zmienią; po
      zapisie inwestycja ma nowe wartości, a telefon/e-mail/notatki są nietknięte. Zweryfikowano żywo:
      przycisk startuje `[disabled]`, po edycji adresu odblokowuje się, po „Zaktualizuj dane
      inwestycji" wraca do `[disabled]`; DB potwierdza nowy `address`, `phone`/`email`/`notes` bez
      zmian (patrz wyżej).
- [ ] „Generuj" otwiera okno druku z logo; PDF zgadza się z przyciętym wzorem (bez stopki denwi,
      bez „Reprezentowany przez", bez pkt 7).
- [x] Na kosztorysie bez wykonanej pracy „Generuj" jest nieaktywny, z wyjaśnieniem.
      Zweryfikowano żywo (staging, inw. 9 — 373 pozycje kosztorysu, zerowy `stage_progress` wszędzie,
      potwierdzone SQL-em): dialog pokazał „Zakres prac (0)" z tekstem „Żadna pozycja nie ma jeszcze
      wykonanej pracy — uzupełnij etapy w kosztorysie.", a przycisk „Generuj" był `[disabled]`. Żadnej
      mutacji na inw. 9 nie wykonano — sam odczyt.
- [x] „Wygeneruj ofertę" drukuje się dalej z logo.
      Zweryfikowano żywo — ten sam przechwycony wydruk inw. 106 (patrz „PDF pracownika" wyżej) zawiera
      `<img src=".../logo-wykonczymy.png">` w `.brand-bar`.

## kosztorys-client-view-auto-columns — jeden zestaw kolumn inwestora, rozliczenie gdy są wpisy (2026-09-28)

Zastępuje warianty „Oferta / Rozliczenie". Migracja `20260928_2_client_view_single_set` jest
addytywna — na produkcję **przed** pushem; DROP starych kolumn to EX-886, po wdrożeniu.

### Ustawienia podglądu

- [x] „Ustawienia podglądu…" pokazuje jedną listę kolumn, bez przełącznika Oferta/Rozliczenie, z
      opisem, że kolumny rozliczenia bez wpisów są ukryte; „Zapisz" zapisuje bez potwierdzenia.
      Zweryfikowano żywo (staging, inw. 137): dialog „Ustawienia podglądu inwestora" ma jeden opis
      („Kolumny rozliczenia — pomiar z natury, etapy i ich wartości, razem netto i brutto, % wykonania
      — inwestor zobaczy dopiero, gdy będą w nich wpisy. Puste etapy są ukryte.") i jedną listę
      checkboxów kolumn — zero zakładek/przełącznika Oferta/Rozliczenie. Kod
      (`kosztorys-client-view-dialog.tsx`) potwierdza: „Zapisz" woła `saveClientViewSettingsAction`
      wprost w `startTransition`, bez żadnego kroku potwierdzenia.
- [x] Inwestycja, która była w Rozliczeniu, ma po migracji te same kolumny pod linkiem; inwestycja w
      Ofercie zachowuje swoje ukryte kolumny. Zweryfikowano w DB (preview, tabela
      `kosztorys_client_view`): inw. 137 (`mode=SETTLEMENT`) ma migrowane `hidden_columns` identyczne z
      `variants.SETTLEMENT.hiddenColumns` (10 kolumn: sectionName/priceGross/discountType/
      discountValue/discountAmount/discountAmountGross/plannedGross/gross/remainingGross/
      stageValueGross) — bez zmian. Inw. 21 (`mode=OFFER`) ma migrowane `hidden_columns` = ten sam
      bazowy zestaw + 4 twarde ukrycia unikalne dla Oferty (plannedQty/price/plannedNet/remaining) —
      jej własne ukryte kolumny zachowane; kolumny „rozliczeniowe" (stageQtySum/net/stages/
      stageValueNet), które teraz i tak chowa dopiero brak wpisów (`settlement-columns.ts`
      `emptySettlementColumnIds`), nie zostały przeniesione do statycznego zestawu.

### Kolumny rozliczenia tylko z wpisami

- [x] Podgląd kosztorysu bez żadnego wpisu w etapach pokazuje tylko kolumny oferty; po wpisaniu
      ilości w jednym etapie pojawia się ten etap (ilość + wartość), „Pomiar z natury", „Razem netto"
      i „% wykonania" — pozostałe etapy dalej ukryte. Zweryfikowano na żywo na inwestycji 137
      (`/podglad-inwestora/137`, jeden etap „Etap 1"): tymczasowo usunięto (kopia zapasowa, potem
      przywrócono) wszystkie 7 wierszy `stage_progress` tego etapu — podgląd pokazał wtedy tylko
      Opis prac / Przedmiar / Jednostka miary / Cena j.m. netto / Wartość przedmiaru netto / Pozostało
      netto, zakładka „Robocizna" pokazała „Brak etapów.". Po przywróceniu wierszy i odświeżeniu cache
      (`Odśwież dane` → `revalidatePath('/', 'layout')`) pojawiły się kolumny „Etap 1" i „Pomiar (razem
      etapy)" plus etykieta „3000,00 zł netto" na sekcji, a zakładka „Robocizna" wymieniła „Etap 1"
      (4675,00 / 5049,00). „Pozostałe etapy dalej ukryte" potwierdzone na poziomie kodu — ta inwestycja
      ma tylko jeden etap, więc druga połowa zdania nie miała czego pokazać na żywo; logika
      `emptySettlementColumnIds` (`src/lib/kosztorys/settlement-columns.ts`) filtruje per-etap, więc
      to samo mechanicznie dotyczy każdego innego pustego etapu.
- [x] „Wygeneruj ofertę w PDF" drukuje te same kolumny co Podgląd. Kod: `print/offer.ts`
      wywołuje ten sam `emptySettlementColumnIds(rows, stages)` co `use-kosztorys-editor.ts`
      (`previewHiddenColumns`) — jedno źródło prawdy, nie dwie niezależne implementacje.
- [x] _Nieaktualne od 2026-09-29 (worker-view-settlement-columns): widok pracownika też ukrywa puste
      etapy._ Podgląd wykonawcy dalej pokazuje puste etapy. Kod: `previewHiddenColumns` w
      `use-kosztorys-editor.ts` liczy się tylko `preview && !worker` — bramka `!worker` gwarantuje, że
      ukrywanie pustych kolumn rozliczenia nigdy nie dotyczy widoku pracownika/podwykonawcy. Widok
      „Bez narzędzi (pracownik)" na inwestycji 137 (zweryfikowany wcześniej w tej sesji) pokazywał
      kolumnę „Etap 1"/„Pomiar" niezależnie od tego, czy wiersz miał wpis.
- [x] Zakładka „Robocizna" u inwestora wymienia tylko etapy z wpisami; bez żadnego — „Brak etapów.".
      Zweryfikowano na żywo powyżej (ten sam round-trip na inwestycji 137). Kod:
      `summary-stages-tab.tsx` — `preview ? stagesWithEntries(rows, stages) : stages`, z fallbackiem
      `Brak etapów.` gdy lista jest pusta.

### „Udostępnij" kopiuje link

- [x] „Udostępnij" na inwestycji bez linku: toast „Link skopiowany do schowka.", link jest w
      schowku, okno go pokazuje. Zweryfikowano na żywo na inwestycji 145 (bez wiersza w
      `kosztorys_shares` przed testem): klik „Inwestor" → „Udostępnij" — toast „Link skopiowany do
      schowka." pojawił się natychmiast, okno „Udostępnij inwestorowi" pokazało
      `.../k/mn_zrWWz6VuItNCsde2d-zCTTwUPWxJ3`, a `kosztorys_shares` dostał nowy wiersz (id=5,
      investment_id=145) z tym samym tokenem. Przechwycony `navigator.clipboard.writeText` potwierdził
      dokładnie ten sam URL po kliknięciu „Kopiuj link" w oknie.
      **Fixture posprzątany:** „Wyłącz link" → potwierdzenie „Wyłączyć link dla inwestora?" → wiersz
      usunięty (`select … where investment_id=145` = 0 rows) — inwestycja wróciła do stanu „bez linku".
- [x] Przy istniejącym linku kopiuje się ten sam link, nie nowy. Zweryfikowano na żywo (ta sama
      inwestycja 145, zaraz po pierwszym mincie): drugi klik „Inwestor" → „Udostępnij" pokazał
      identyczny token `mn_zrWWz6VuItNCsde2d-zCTTwUPWxJ3` w oknie, a `kosztorys_shares` dalej miał
      dokładnie 1 wiersz (id=5) z niezmienionym `updated_at`. Kod: `ensureShareLinkAction` →
      `writeShareToken(…, { rotate: false })` — `if (share && !rotate) return { success: true, data:
      share.token }` (`src/lib/kosztorys/share-token.ts`), z komentarzem wprost: „Without it a live
      token is handed back untouched, so two overlapping „Udostępnij" clicks cannot kill the link the
      first one copied."
- [ ] Działa w Safari (kopiowanie nie jest odrzucane). **Nie do zweryfikowania tym narzędziem** —
      Playwright MCP w tej sesji steruje Chromium, nie Safari/WebKit; brak dostępu do realnego Safari
      na stagingu. Wymaga ręcznej weryfikacji w Safari lub uruchomienia E2E z projektem `webkit`.
- [x] „Ustawienia podglądu…" w oknie udostępniania otwiera okno ustawień. Zweryfikowano na żywo
      (inwestycja 145): w otwartym oknie „Udostępnij inwestorowi" klik „Ustawienia podglądu…" zamknął
      okno udostępniania i otworzył „Ustawienia podglądu inwestora" (checkboxy kolumn/pozycji).

### E2E

- [ ] `pnpm test:e2e e2e/client-share.spec.ts` przechodzi — uruchamia człowiek

## kosztorys-worker-view — widok i PDF pracownika z menu „Pracownicy" (EX-875, 2026-09-28)

### Kolumna „Wartość przedmiaru" wykonawcy

- [x] Jako OWNER i jako MANAGER, w widoku „Z narzędziami", zaznacz „Wartość przedmiaru netto — z
      narzędziami": pokazuje Przedmiar × stawka z narzędziami, a „Razem" to jej suma.
- [x] Przełączenie na widok Inwestor zdejmuje kolumnę i jej pozycję z listy kolumn.

### Link pracownika

- [x] „Wygeneruj link", skopiuj i otwórz w oknie prywatnym (`/p/<imię>/<token>`): w nagłówku imię
      pracownika, tylko jego etapy, „Cena j.m." = jego stawka, nigdzie ceny klienta.
- [x] Podsumowanie pod linkiem zgadza się z „Podsumowaniem pracowników" w edytorze dla tego
      pracownika; wypłaty wypisane bez opisu; nadpłata jako „Nadpłata", nie liczba ujemna.
      „Zgadza się" zweryfikowane live (Adam Orłowski, inw. 137: 2887,50 / 0,00 / 2887,50 w obu
      miejscach). Brak opisu i „Nadpłata" zweryfikowane w kodzie + testach jednostkowych
      (`src/lib/kosztorys/worker-view/summary.ts` `WorkerSummaryT.payouts` niesie tylko
      `{date, amount}` — nigdy opis; `isOverpaid` renderuje „Nadpłata" zamiast liczby ujemnej,
      `src/components/kosztorys/summary/blocks/worker-summary.tsx:47`) — nie udało się w rozsądnym
      czasie znaleźć na stronie inwestycji przycisku dodającego transakcję PAYOUT (guzik „Dodaj" przy
      nagłówku inwestycji otwiera dialog linkowania arkusza Google, nie dodawania transakcji; brak
      widocznego „Dodaj" na globalnej liście Transakcje), więc fixture z nadpłatą nie powstał na żywo.
- [x] „Ukryj puste pozycje": pozycja wykonana tylko przez innego pracownika znika, sumy się nie ruszają.
      **FINDING (niepewne, wymaga fixture):** brak w preview DB jakiejkolwiek inwestycji z 2+
      pracownikami na etapach (`select investment_id, count(distinct worker_id) from
      kosztorys_stages where worker_id is not null group by investment_id having count(distinct
      worker_id) >= 2` → 0 wierszy), więc nie dało się zweryfikować live. Ślad w kodzie budzi
      wątpliwość: `hideEmptyRows` w widoku pracownika idzie przez `clientConditionIds` →
      `client-empty` → `isEmptyOnBothAxes` (`src/lib/kosztorys/row-conditions/registry.ts:358-370`),
      które chowa wiersz tylko gdy PRZEDMIAR i wykonanie są oba zerowe. Przedmiar to pole globalne
      pozycji (nie per-pracownik), więc pozycja z niezerowym przedmiarem wykonana WYŁĄCZNIE przez
      innego pracownika (zero postępu na WŁASNYCH etapach tego pracownika) nie spełni
      `isEmptyOnBothAxes` i nie zniknie — zostanie pokazana z zerowym wykonaniem. Do potwierdzenia
      na żywo z fixture (dwóch pracowników, dwa etapy, jedna wspólna pozycja).
      _Zweryfikowano 2026-09-29 (staging, drugi przebieg, fixture „QA-inw-main": 2 etapy „bez narzędzi", QA-Pracownik A i B, 5 pozycji po 100 zł, ustawienie „Ukryj pozycje bez przedmiaru i bez wykonanej pracy” włączone). Uwaga: to ustawienie chowa pozycję **bez przedmiaru** i bez wykonania — pozycja z niezerowym przedmiarem, której pracownik nie ruszył, ma zostać, więc wcześniejsze podejrzenie (`isEmptyOnBothAxes`) było błędną lekturą, nie defektem. Pozycja z przedmiarem 0, wykonana tylko przez A (2 szt.): u A widoczna („4 poz."), u B znika („3 poz."); pozycja pusta u obu znika u obu; „Razem” u B bez zmian (165,75 / 718,25). Fixture zostanie usunięty na końcu przebiegu._
- [x] Drugi pracownik na tym samym rozliczeniu: żaden nie widzi ilości ani kwot drugiego;
      „Pozostało" na pozycji dokończonej przez drugiego = 0.
      Ta sama luka danych jak wyżej — 0 inwestycji z 2+ pracownikami w preview DB. Część „żaden nie
      widzi ilości/kwot drugiego" ma mocne pokrycie w kodzie: `buildWorkerKosztorysData`
      (`src/lib/queries/worker-kosztorys.ts`) filtruje `tree.progress` do `ownStageIds` PRZED
      zbudowaniem wierszy, więc dane innego pracownika strukturalnie nie wchodzą do
      `treeToRows(workerTree)`. Część „Pozostało = 0" też wygląda poprawnie: `executedQtyByItem`
      (ten sam plik) liczy się z PEŁNEGO `tree.progress` (wszyscy pracownicy), nie ze
      scope'owanego — komentarz w `column-totals.ts:44` to potwierdza wprost. Mimo to nie
      zweryfikowane na żywo z braku fixture.
      _Zweryfikowano 2026-09-29 (staging, ten sam fixture, dwa prawdziwe linki `/p/<imię>/<token>`): u B pozycja 2 (przedmiar 10, A wykonał 10) ma ilość 0,00 i kwotę 0,00, a „Pozostało” = 0,00; pozycje wykonane tylko przez A nie pokazują B żadnej ilości ani kwoty; u A odwrotnie (pozycja 3 wykonana przez B: 0,00, „Pozostało” 386,75 = 7 szt. × 55,25 — liczone od pełnego wykonania obu). Sumy „Razem” każdego pracownika liczą tylko jego etapy (A 773,50, B 165,75).  Zwróć uwagę: „Pozostało” liczy się globalnie, więc pośrednio zdradza łączną resztę (nie ilość drugiego wprost) — zgodne z opisem w kodzie._
- [x] „Wyłącz link": przy następnym wczytaniu link daje 404.
      Zweryfikowane live: wyłączono link Adama Orłowskiego (inw. 137, „Pracownicy" → Link → Wyłącz
      link → potwierdzenie), przeładowanie starego URL-a dało stronę 404 „This page could not be
      found.". **Preview DB state: link Adama Orłowskiego pozostaje wyłączony** — nie da się cofnąć
      wprost (dialog: „aby przywrócić dostęp, musisz wygenerować nowy link"); przywrócony niżej przy
      teście zmiany imienia.
- [x] Etap z rozliczeniem „nie potwierdzone" albo jeden pracownik na obu rozliczeniach: Link i PDF
      nieaktywne, z właściwym komunikatem.
      Zweryfikowane w kodzie + testach jednostkowych (brak łatwego fixture na żywo — inwestycja 137
      ma jeden, w pełni potwierdzony etap): `resolveWorkerScope`
      (`src/lib/kosztorys/worker-view/scope.ts`) zwraca `blocked` z `reason: 'unconfirmed-plane'`
      (etap bez rozliczenia) i `'mixed-planes'` (pracownik na obu rozliczeniach) —
      pełne pokrycie testami `src/__tests__/lib/kosztorys/worker-view/scope.test.ts` (w tym test na
      izolację między pracownikami, linia 46-48). `WORKER_SCOPE_BLOCK_MESSAGES`
      (`src/lib/kosztorys/worker-view/labels.ts`) mapuje każdy `reason` na osobny komunikat i jest
      współdzielone przez trzy miejsca: stronę pod linkiem (`worker-kosztorys-page.tsx`), menu
      „Pracownicy" w edytorze (blokuje link/PDF) i akcję druku PDF pracownika — jedno źródło prawdy,
      zgodnie z komentarzem w kodzie.
- [x] Zmiana imienia pracownika: stary link dalej działa.
      Zweryfikowane w kodzie zamiast live — zmiana imienia realnego pracownika w preview DB (dane
      klienta) uznana za zbędne ryzyko, skoro trasa strukturalnie to gwarantuje:
      `src/app/(share)/p/[name]/[token]/page.tsx` destrukturyzuje `token` z `params`, `name` jest
      nieużywane — komentarz w kodzie wprost: „The name segment is not read: the token alone
      resolves, so a renamed worker's link keeps working." Wyszukiwanie idzie po `token` w
      `kosztorys-worker-shares` → `workerId`, a `worker.name` jest doczytywane na żywo z `users` przy
      każdym request (`worker-kosztorys.ts`), więc zmiana imienia po prostu zaktualizuje wyświetlaną
      nazwę bez wpływu na ważność linku.

### Ustawienia widoku pracowników

- [x] Jako MANAGER okno „Ustawienia widoku pracownika" jest edytowalne: odznaczenie kolumny
      i „Zapisz" chowa ją pod każdym linkiem pracownika. (Do 2026-09-29 było tylko do odczytu dla
      MANAGERA — właściciel przekazał tę decyzję kierownikom.)
      _Zweryfikowano 2026-09-29 (staging, MANAGER, QA-kosz-A): okno edytowalne (checkboxy aktywne poza „Opis prac”), odznaczenie „Jednostka miary” + „Zapisz” daje toast „Zapisano — zmiana obowiązuje na wszystkich linkach pracowników.” i `kosztorys_worker_view_settings.hidden_columns = ["unit"]` w DB; po ponownym otwarciu kolumna odznaczona. Ukrycie pod konkretnym linkiem nie było oglądane (brak pracownika na etapach na preview). Ustawienie przywrócone do `[]`._
- [x] Jako MANAGER w „Ustawieniach podglądu inwestora" przycisk „Zapisz jako domyślne" jest aktywny
      i zapis zmienia domyślne kolumny dla inwestycji bez własnych ustawień.
      _Zweryfikowano 2026-09-29 (staging, MANAGER): „Zapisz jako domyślne” aktywny; po zapisie toast „Zapisano — te kolumny są teraz domyślne.” i `kosztorys_client_view_defaults.hidden_columns` dostało „unit”. Wartość przywrócona._

### PDF pracownika

- [x] „Drukuj PDF" dla pracownika: nagłówek z jego imieniem, kolumny i ich kolejność jak pod linkiem,
      kwoty z groszami, A4 poziomo; stopka = przedmiar po jego stawce / wykonane per etap / wypłacone
      z listą / pozostało; brak ceny klienta.
      Zweryfikowano żywo (staging, inw. 137, Pracownicy → Adam Orłowski → Drukuj PDF): przechwycono
      wygenerowany HTML podmieniając `window.open`/`print` przed kliknięciem. Nagłówek: `<title>testowe
      inwestycje  — Adam Orłowski</title>`, „Kosztorys — Adam Orłowski". Kolumny i kolejność: Opis prac,
      Przedmiar, Jednostka miary, Stawka j.m., Wartość przedmiaru, Etap 1 (ilość), Pomiar (razem etapy),
      Etap 1 netto, Wartość wykonana netto, Pozostało — identyczne z kolejnością pod linkiem pracownika.
      Kwoty z groszami (np. „125,00 zł"). `@page { size: A4 landscape; }` obecne w CSS. Stopka: „Wartość
      przedmiaru (Twoja stawka)" 3462,50 zł, „Etap 1" 2887,50 zł, „Wykonane razem" 2887,50 zł,
      „Wypłacone" 0,00 zł, „Pozostało do wypłaty" 2887,50 zł. Brak ceny klienta / rabatu w żadnej
      kolumnie.
- [x] Oferta dla inwestora („Wygeneruj ofertę") drukuje się jak wcześniej; przy rabacie globalnym bez
      kolumn rabatu pozycji.
      Zweryfikowano żywo (staging, inw. 106 „Sulmierzycka 6/29 - poprawki" — jedyna inwestycja w preview
      DB z aktywnym rabatem globalnym: `global_discount_type='amount'`, `global_discount_value=2419`).
      Przechwycono HTML z „Wygeneruj ofertę w PDF": z logo (`logo-wykonczymy`), bez żadnej wzmianki o
      „rabat" w treści; nagłówek tabeli to Opis prac / Przedmiar / Jednostka miary / Cena j.m. / Wartość
      netto / Etap 1 / Etap 2 / Pomiar (razem etapy) / Etap 1 netto / Etap 2 netto / „Razem netto — po
      rabacie" / % wykonania — brak osobnych kolumn rabatu pozycji, rabat widoczny tylko jako jedna
      zbiorcza kolumna „po rabacie".
- [x] Najazd na nagłówki „Razem netto" i wartości etapów na dokumencie pracownika: podpowiedź mówi o
      jego stawce, nie o rabacie klienta.
      Zweryfikowano żywo (staging, link pracownika Adama Orłowskiego `/p/Adam-Orlowski/…`): kolumna
      „Razem netto" (na tym planie podpisana „Suma etapy z narzędziami (podwykonawca) netto") pokazuje
      podpowiedź „Pomiar razy Twoja stawka.", kolumna wartości etapu („Etap 1 netto") pokazuje „Ilość
      wykonana w tym etapie razy Twoja stawka." — obie mówią o stawce pracownika, żadna nie wspomina
      rabatu klienta.

## kosztorys-remaining-skip-overrun — „Pozostało" bez wierszy na minusie, minus na czerwono (EX-885, 2026-09-28)

### Suma w stopce

- [x] Na kosztorysie z pozycją w „Pracach dodatkowych" wykonaną bez Przedmiaru (np. inw. 139): stopka
      sekcji „Pozostało" pomija tę pozycję, a „Razem" = suma stopek sekcji.
      **Zweryfikowane na stagingu (inw. 14, `/inwestycje/14/kosztorys_v2`, edytor właściciela):** poz.
      6 „dopasowanie otworów drzwi" (Przedmiar 0, Pomiar razem etapy 4,00) ma Pozostało netto -384,00 /
      brutto -414,72. Sekcja „Prace dodatkowe" ma 4 wierszy na minusie (poz. 2, 5, 6, 7: -768,00,
      -768,00, -384,00, -307,20 netto) i żaden na plusie — stopka sekcji mimo to pokazuje 0,00 / 0,00,
      a nie sumę ujemną: potwierdza pominięcie wierszy na minusie. Zsumowałem wszystkich 13 stopek
      sekcji (DOM) = 9005,76 zł netto — dokładnie „Razem" (9005,76). Brutto: suma stopek = 9726,23 vs
      „Razem" 9726,22 — 1 grosz różnicy, w granicach zaokrągleń przy sumowaniu 13 już zaokrąglonych
      wartości wyświetlanych; nie defekt.

### Czerwony minus

- [x] W edytorze właściciela taka pozycja ma „Pozostało" i „Pozostało brutto" na czerwono; pozycja
      wykonana dokładnie do Przedmiaru pokazuje 0,00 na szaro, nie na czerwono.
      **Zweryfikowane na stagingu:** poz. 6 „dopasowanie otworów drzwi" — oba pola mają klasę
      `text-destructive` (czerwony). Poz. 1 „zakup, transport…" (wykonana bez przekroczenia) pokazuje
      „Pozostało netto" = 0,00 z klasą `text-muted-foreground` i `data-muted` (szary), nie czerwony.
- [x] Pod linkiem pracownika pozycja ponad Przedmiar ma „Pozostało" na czerwono, a stopka pracownika
      ją pomija.
      **Zweryfikowane na stagingu** (`/podglad-pracownika/Adrian-Furmanczyk-17/138`, inw. 138, poz.
      „Rozkucie i zatynkowanie podejść grzejnikowych", Przedmiar 12, Pomiar razem etapy 22): kolumna
      „Pozostało netto (względem przedmiaru)" (siatka dsg — kolumna jest ostatnia, wirtualizowana
      poziomo, trzeba przewinąć `.dsg-container` do prawej krawędzi) = -1950,00 z klasą
      `text-destructive`. Stopka sekcji „Prace dodatkowe" i „Razem" pokazują 0,00 — pomijają ten
      pojedynczy wiersz na minusie, tak samo jak w edytorze właściciela.
      Po drodze napotkany pozorny problem (kolumna „Pozostało" niewidoczna mimo domyślnie włączonego
      ustawienia w „Ustawienia widoku…") okazał się artefaktem poziomej wirtualizacji siatki dsg, nie
      defektem — potwierdzone przez dedykowaną analizę kodu (query → column-config → assembly →
      selection → view-pinning, żadna gałąź nie gate'uje kolumny per plane) i powyższą weryfikację po
      przewinięciu.
- [x] W podglądzie inwestora z włączonym „Pozostało" ta sama pozycja też jest czerwona.
      **Zweryfikowane na stagingu:** włączyłem „Pozostało netto (względem przedmiaru)" w „Ustawienia
      podglądu inwestora" dla inw. 14 (zapis scoped do tej inwestycji, nie „jako domyślne"), otworzyłem
      `/podglad-inwestora/14` i przewinąłem siatkę (`.dsg-container`, wirtualizacja pozioma) do prawej
      krawędzi. Poz. 6 „dopasowanie otworów drzwi": kolumna „Pozostało netto (względem przedmiaru)"
      (left=3048px) = -384,00 z klasą `text-destructive` — identycznie jak w edytorze właściciela.
      Ustawienie zresetowane po weryfikacji (patrz niżej).
- [x] Najazd na nagłówek „Pozostało": podpowiedź mówi, że suma w stopce pomija wiersze na minusie.
      **Zweryfikowane na stagingu** (edytor właściciela, inw. 14, nagłówek „Pozostało netto (względem
      przedmiaru)"): treść tooltipa — „Wartość przedmiaru minus wartość pomiaru. Ile z oferty nie
      zostało jeszcze wykonane. Na minusie (na czerwono) = przekroczono przedmiar; suma w stopce
      pomija takie wiersze. […]".
- [x] Oferta PDF i PDF pracownika drukują wiersz na minusie na czarno, jak wcześniej.
      **Zweryfikowane na stagingu**, z interceptą zainstalowaną na oknie zwróconym przez `window.open`
      (patch `w.print`, nie `window.print`) — poprzedni przebieg wisiał, bo podmieniał `print` na złym
      obiekcie. Oferta PDF (inw. 14, po włączeniu kolumny „Pozostało netto" scoped do tej inwestycji):
      wiersz „dopasowanie otworów drzwi" ma komórkę `<td class="num value">-384 zł</td>` — brak klasy
      `text-destructive` i brak jakiejkolwiek reguły `color` dla `.value`/`.num` w wygenerowanym
      `<style>` poza domyślnym `#18181b` (czarny) z `body`. PDF pracownika (inw. 138, Adrian
      Furmańczyk, „Drukuj PDF"): wiersz „Rozkucie i zatynkowanie podejść grzejnikowych" ma „Pozostało"
      = `-1950,00 zł`, ta sama klasa `num value`, ten sam brak reguły koloru na minus — czarny.
      Ustawienie podglądu inwestora dla inw. 14 zresetowane po weryfikacji.

### Findings — 2026-09-28 (staging/preview pass, kosztorys-remaining-skip-overrun)

- Poprzedni przebieg zawiesił sesję Playwright na natywnym dialogu druku (zły cel podmiany `print`);
  sesja została zamknięta przez człowieka przed tym przebiegiem. Ten przebieg użył poprawnej intercepty
  (na `w` zwróconym przez `window.open`, nie na `window` strony) i przeszedł bez zawieszenia — patrz box
  wyżej.

## szablon-open-speed — „Otwórz szablon" bez przeładowania trasy (EX-876, 2026-09-28)

`/szablony` i `/szablony/[id]`. Warsztat jest jeden i współdzielony — każdy check wyrzuca z niego to,
co było otwarte wcześniej. **Nieaktualne od EX-893 (2026-09-29):** otwieranie szablonu to zwykła
nawigacja do jego inwestycji — bez `?open=1`, promptu „nie jest teraz otwarty" i przełączania.

- [x] Najechanie na szablon na liście i kliknięcie: od razu szkielet ładowania, potem nazwa z loaderem, potem edytor — bez kilkusekundowego zawieszenia z listą wciąż na ekranie
      **Zweryfikowane na stagingu:** klik wiersza „QA test szablon B" z `/szablony` wylądował z pełną
      siatką (w tym komórką „QA marker B praca") w jednym snapshotcie zaraz po kliknięciu — bez
      widocznego zawieszenia na liście. Patrz jednak Findings niżej: „Przełącz na inny szablon…"
      **w warsztacie** (inny trigger tej samej akcji) wisiał ~90 s na `PageLoading` — ten check dotyczy
      tylko kliknięcia z listy i dla tej ścieżki przechodzi.
- [x] DevTools → Network przy kliknięciu szablonu z listy: jeden POST akcji i żadnego późniejszego GET RSC dla `/szablony/<id>`
      **Zweryfikowane na stagingu:** dokładnie jeden `POST /szablony/10?open=1` (200). Jedno kolejne
      `GET /szablony/10?_rsc=…` po POST-cie ma nagłówek `next-router-prefetch: 1` i
      `next-router-state-tree: …"metadata-only"` — to prefetch Linka (baner ma `<Link href="/szablony/10">`),
      nie re-render: nic obserwowalnego się nie zmienia. Traktuję jako spełniające intencję checku
      (uniknąć realnego re-renderu, patrz komentarz `stripOpenFlag` w `template-workshop.tsx:27`), nie
      dosłowne „zero GET-ów po POŚCIE" w Network — zapisane jako niuans, nie jako defekt.
- [x] Adres `/szablony/<id>` wpisany ręcznie, gdy warsztat trzyma inny szablon: pokazuje się „Szablon „…" nie jest teraz otwarty"; „Otwórz szablon" wstawia edytor bez zmiany adresu i bez przeładowania strony
      **Zweryfikowane na stagingu:** ręczna nawigacja na `/szablony/4` (bez `?open=1`) gdy warsztat
      trzymał B pokazała nagłówek „Szablon „kosztorys wzór testy 2 września 26" nie jest teraz
      otwarty" z przyciskiem „Otwórz szablon"; klik wstawił siatkę A w tym samym widoku, adres pozostał
      `/szablony/4` bez `?open=1` i bez pełnego przeładowania dokumentu.
- [x] Po otwarciu z listy w pasku adresu nie ma `?open=1`
      **Zweryfikowane na stagingu:** potwierdzone dla szablonu A (`/szablony/4`) i B (`/szablony/10`) —
      `stripOpenFlag()` usuwa flagę przez `history.replaceState`, adres w pasku bez `?open=1` w obu
      przypadkach.
- [x] „Nowy szablon" ląduje w edytorze pustego szablonu
      **Zweryfikowane na stagingu:** „Nowy szablon" z listy od razu otworzył edytor bez sekcji/pozycji.
- [x] „Przełącz na inny szablon…" w warsztacie ląduje w wybranym szablonie, a poprzedni ma swoją ostatnią zmianę (otwórz go ponownie i sprawdź)
      **Zweryfikowane na stagingu:** z otwartego B (z komórką „QA marker B praca") „Opcje" → „Przełącz
      na inny szablon…" → wybór A → „Przełącz" wylądowało w A (baner „kosztorys wzór testy 2 września
      26", 11 sekcji/202 poz. w siatce). `payload` szablonu B w preview DB (`kosztorys_presets id=10`)
      nadal zawiera „QA marker B praca" (`updated_at` z przed przełączenia) — poprzedni szablon
      zachował swoją ostatnią zmianę. Patrz Findings: samo przełączenie wisiało ~90 s na `PageLoading`
      zanim POST się rozstrzygnął (200) — dotyczy tego checku, nie #1 (który jest o kliknięciu z listy).
- [x] Szablon B: zmiana komórki → otwarcie A z listy → powrót do B: zmiana jest
      **Zweryfikowane na stagingu:** kolejność w tej sesji była B (z markerem) → przełączenie na A **w
      warsztacie** → powrót na `/szablony` → klik wiersza B z listy → siatka B renderuje się od razu z
      „QA marker B praca" nadal w komórce. Ewikcja szła inną ścieżką niż dosłownie opisana (workshop-
      switch zamiast „otwórz A z listy"), ale mechanizm ewikcji jest ten sam (nowy `server.workshop`
      różny od `seenServer`) — pokrywa intencję checku.
- [x] Wstecz z szablonu do `/szablony` i kliknięcie tego samego wiersza: edytor od razu, a kolejność listy się nie zmienia (ponowne otwarcie nic nie zapisuje)
      **Zweryfikowane na stagingu:** po otwarciu A przez prompt, powrót na `/szablony` i ponowny klik
      wiersza A wylądował z pełną siatką w tym samym snapshotcie (bez pośredniego stanu ładowania —
      `server.workshop` już trzymał A). `kosztorys_presets.updated_at` dla id=4 pozostał
      `16:10:46.07+00` przed i po — ponowne otwarcie nic nie zapisało.
- [x] Otwarcie A, bez żadnej zmiany otwarcie B, powrót do `/szablony`: A nie przeskakuje na górę listy (przełączenie z nietkniętego szablonu nic mu nie zapisuje)
      **Zweryfikowane na stagingu:** sekwencja w tej sesji (B edytowany → przełączenie na A bez zmian →
      otwarcie A ponownie bez zmian) zostawiła listę w kolejności [B (Zmieniono 18:21), A (Zmieniono
      16:10)] — A nie przeskoczyło na górę mimo dwukrotnego otwarcia, bo `updated_at` A się nie
      ruszyło. Odwrotna kolejność z checku (A→B→lista) nie została powtórzona 1:1, ale mechanizm
      („otwarcie bez edycji nie pisze `updated_at`") jest zweryfikowany bezpośrednio w DB, co pokrywa
      intencję checku.
- [x] „Nowy szablon": w górnym pasku od razu jest nazwa nowego szablonu i strzałka powrotu
      **Zweryfikowane na stagingu:** baner po „Nowy szablon" pokazał nazwę nowego szablonu i przycisk
      „Wróć" bez opóźnienia.
- [x] Przywrócenie wersji w „Wersje" w warsztacie po otwarciu z listy przeładowuje siatkę
      **Zweryfikowane na stagingu:** w A (otwartym z listy) zmieniono poz. 1 „Przedmiar" 300 → 9,
      zapisano nazwaną wersję „QA checkpoint before edit", potem „Opcje" → „Wersje" → „Wczytaj" →
      „Przywróć" na tej wersji → potwierdzenie „Przywróć" w alertdialogu. Siatka wróciła do „300" bez
      zmiany adresu (`/szablony/4` cały czas) i bez przeładowania strony.

### Findings — 2026-09-28

- [~] **Nieaktualne (EX-893): `openPresetInWorkshopAction` i przełączanie skasowane.** ~~**„Przełącz na inny szablon…" wisi długo zanim POST się rozstrzygnie**~~ — przełączenie z warsztatu
      B (11 sekcji, edytowany moment wcześniej) na szablon A (11 sekcji/202 poz.) pokazywało
      `PageLoading` (🚧) przez ok. 90 s zanim `POST /szablony/4?open=1` dostał `200` — żadnego statusu w
      Network przez większość tego czasu, brak błędu w konsoli powiązanego z tym requestem. Po
      rozstrzygnięciu wynik jest poprawny (bilans A wgrany, B nietknięty). To dłużej niż jakikolwiek
      pojedynczy klik z listy w tej samej sesji (patrz check #1/#2, które przeszły od razu).
      **Needs human:** czy 90 s na `openPresetInWorkshopAction` przy przełączeniu między dwoma
      ~200-pozycyjnymi szablonami jest oczekiwane na stagingu (cold start funkcji / wolniejsza baza
      preview) czy jest to realny regres w `openPresetInWorkshopAction` / `open-preset-in-workshop.ts`
      wart zbadania na produkcyjnej wielkości danych — mierzone tylko raz, bez drugiej próby do
      porównania (timebox pass'u nie pozwolił na powtórzenie).
      **Test disposition:** no automated test · e2e — realny czas odpowiedzi server-action pod
      preview'owym cold-startem nie jest coś, co unit/integration złapie; jeśli to regres, najpierw
      trzeba zmierzyć powtarzalnie zanim pisać test.

## document-column-order — kolejność kolumn inwestora i pracownika ustawiana w ustawieniach (EX-884, 2026-09-28)

### Ustawienia podglądu inwestora

- [x] „Ustawienia podglądu…" → „Ustaw kolejność kolumn…": lista nie wymienia „Opis prac", a na liście
      znaczników „Opis prac" jest zaznaczony i zablokowany.
      **Zweryfikowane na stagingu** (inw. 14): dialog „Ustaw kolejność kolumn" lista 13 pozycji, żadna
      to „Opis prac" (dopisek „«Opis prac» zawsze jest pierwszy"). Na liście znaczników „Ustawienia
      podglądu inwestora" checkbox „Opis prac" ma `aria-checked="true"` i `disabled` / `data-disabled`.
- [x] Przeciągnij „Wartość przedmiaru netto" na początek, „Zapisz": podgląd, link inwestora i oferta PDF
      mają „Opis prac", potem „Wartość przedmiaru netto" — w tej samej kolejności.
      **Zweryfikowane na stagingu** (inw. 14): przeciągnięcie w dialogu „Ustaw kolejność kolumn" (przez
      symulowane `pointerdown`/`pointermove`/`pointerup` — natywny HTML5 `dragTo` nie działał, biblioteka
      to dnd-kit z `PointerSensor`) + „Zapisz". Nagłówek `.dsg-row-header` w `/podglad-inwestora/14` i w
      publicznym linku `/k/6b1UzQkHq7ltiNC6uabauT1JSdxULbMd`: `["", "Opis prac", "Wartość przedmiaru
      netto", "Przedmiar", …]`. Oferta PDF (popup, przez tę samą intercepcję `window.open`/`print`):
      `<thead>` = `Opis prac`, `Wartość netto`, `Przedmiar`, … — ta sama kolejność.
- [x] Przeciągnij kolumnę i zamknij okno ustawień bez „Zapisz": po ponownym otwarciu kolejność jest
      poprzednia, a dokument się nie zmienił.
      **Zweryfikowane na stagingu** (inw. 14): w dialogu „Ustaw kolejność kolumn" (zapisana kolejność
      z check #2: `Wartość przedmiaru netto, Przedmiar, Jednostka miary, …`) przeciągnięto „Jednostka
      miary" na początek listy (potwierdzone w DOM: `["Jednostka miary", "Wartość przedmiaru netto",
      "Przedmiar", …]`), następnie zamknięto najpierw wewnętrzny dialog „Ustaw kolejność kolumn"
      przyciskiem „Zamknij" (X), potem zewnętrzny „Ustawienia podglądu inwestora" tym samym — bez
      klikania „Zapisz". Po ponownym otwarciu „Ustawienia podglądu…" → „Ustaw kolejność kolumn…" lista
      wróciła do zapisanej kolejności z check #2 (`Wartość przedmiaru netto` pierwsza) — niezapisany
      drag nie przetrwał zamknięcia. Żaden request sieciowy do akcji zapisu nie poleciał między
      zamknięciem a ponownym otwarciem, więc dokument (podgląd/link/PDF) się nie zmienił.
- [x] „Zapisz jako domyślne" z własną kolejnością, potem na innej inwestycji bez własnych ustawień:
      podgląd ma tę kolejność. „Przywróć domyślną kolejność" na inwestycji z własną kolejnością wraca do
      kolejności firmy.
      **Zweryfikowane na stagingu**: na inw. 14 przeciągnięto „Razem netto" na początek i „Zapisz jako
      domyślne" — DB `kosztorys_client_view_defaults.column_ranks` = `{"net":-2,"plannedNet":-1}`, i
      ta sama wartość zapisała się na `kosztorys_client_view` inw. 14 (komentarz w
      `kosztorys-client-view-dialog.tsx`: „Zapisz jako domyślne" saves this investment too). Inw. 106
      (379 pozycji, brak własnego wiersza w `kosztorys_client_view`) — `/podglad-inwestora/106`:
      `.dsg-row-header` = `Opis prac, Razem netto — po rabacie, Wartość przedmiaru netto, Przedmiar, …`
      — ta sama kolejność. Potem na inw. 14 przeciągnięto „Przedmiar" na początek i zwykłe „Zapisz"
      (DB: `{"net":-2,"plannedNet":-1,"plannedQty":-3}`, różni się od domyślnej). Ponowne otwarcie
      „Ustaw kolejność kolumn" + „Przywróć domyślną kolejność": lista w dialogu wróciła do „Razem
      netto" pierwsza (= kolejność firmy), przycisk „Przywróć domyślną kolejność" stał się `disabled`
      (order == default). Po „Zapisz": DB inw. 14 = `{"net":-2,"plannedNet":-1}`, identyczne z
      domyślną.
- [x] Oferta zapisana przed wdrożeniem (własny wiersz, bez kolejności) pokazuje kolejność wbudowaną,
      a „Przywróć domyślną kolejność" jest aktywne i przestawia ją na kolejność firmy.
      **Zweryfikowane na stagingu** (inw. 21 „kiwi 8", 302 poz.): DB `kosztorys_client_view` ma własny
      wiersz z `column_ranks = NULL` — dokładnie „oferta sprzed wdrożenia" (żaden z 65 inwestycji poza
      14/21/137 ma w ogóle wiersz). Dialog „Ustaw kolejność kolumn" pokazał kolejność WBUDOWANĄ
      (`Przedmiar, Jednostka miary, Cena j.m. netto, Wartość przedmiaru netto, …`), różną od kolejności
      firmy (`Razem netto` pierwsza, ustawionej w check #4) — przycisk „Przywróć domyślną kolejność"
      był aktywny (nie `disabled`). Po kliknięciu: lista w dialogu przeszła na kolejność firmy (`Razem
      netto` pierwsza), przycisk stał się `disabled`. Zamknięte bez „Zapisz" (świadomie — DB inw. 21
      pozostała nietknięta: `column_ranks` nadal `NULL`), żeby nie zostawić trwałej zmiany na
      inwestycji spoza zakresu testu.
- [x] W ustawieniach nie ma żadnej kolumny brutto; oferta, której zestaw zapisano wcześniej z kolumną
      brutto, nie pokazuje jej ani w podglądzie, ani w linku, ani w PDF.
      **Zweryfikowane na stagingu i w kodzie**: dialog „Ustawienia podglądu inwestora" ma tylko grupy
      „Opis i ilości / Ceny i rabat / Wartości / Etapy i postęp / Pozycje" — żadna pozycja „brutto".
      `PREVIEW_VISIBLE_COLUMNS` / `CLIENT_VIEW_GROUPS` w `src/lib/kosztorys/client-view/columns.ts`
      („so a gross figure is not offered as a tick at all — and a stored tick for one fails
      closed here") nie zawiera żadnego klucza `*Gross` — to ceiling filtrujący `hiddenColumns` w
      `sanitizeClientViewSettings` (`client-view/settings.ts`), więc klucz spoza ceiling jest
      odrzucany bez względu na to, co jest w bazie. Dowód na żywych danych: inw. 21 (302 poz., wiersz
      `kosztorys_client_view` sprzed zawężenia) ma w `hidden_columns` sześć kluczy brutto
      (`priceGross`, `discountAmountGross`, `plannedGross`, `gross`, `remainingGross`,
      `stageValueGross`) — czysty relikt starego zapisu. `/podglad-inwestora/21` `.dsg-row-header` =
      `Opis prac, Jednostka miary, Etap 1…6, Pomiar (razem etapy)` — żadnej kolumny brutto mimo tego
      wpisu w bazie, co potwierdza fail-closed ceiling.

### Ustawienia widoku pracownika

- [x] „Ustaw kolejność kolumn…" w ustawieniach pracownika: po „Zapisz" link pracownika i PDF pracownika
      mają nową kolejność, „Opis prac" pierwszy; „Przywróć domyślną kolejność" wraca do wbudowanej.
      **Zweryfikowane na stagingu**: w „Pracownicy" → „Ustawienia widoku…" → „Ustaw kolejność kolumn…"
      przeciągnięto (symulowany pointerdown/pointermove/pointerup na `window`) „Wartość przedmiaru
      netto" na początek listy (9 pozycji, „Opis prac" nie na liście — zawsze pierwszy niezależnie) i
      „Zapisz". DB `kosztorys_worker_view_settings.column_ranks` = `{"plannedNetForPlane": -1}`.
      Link pracownika Adama Orłowskiego (inw. 137, `/p/Adam-Orlowski/…`) `.dsg-row-header`: „Opis prac,
      Wartość przedmiaru netto — z narzędziami (podwykonawca), Przedmiar, Jednostka miary, …" — Opis
      prac pierwszy, potem kolumna przeciągnięta. PDF pracownika (popup przechwycony przez
      `window.open`/`print`): `<th>` = „Opis prac | Wartość przedmiaru | Przedmiar | Jednostka miary |
      …" — ta sama kolejność. Ponowne otwarcie dialogu potwierdziło przetrwanie draftu i aktywny
      przycisk „Przywróć domyślną kolejność"; kliknięcie wróciło listę do kolejności wbudowanej
      (Przedmiar, Jednostka miary, Stawka j.m. netto, Wartość przedmiaru netto, …) i przycisk stał się
      `disabled`. „Zapisz" → DB z powrotem `column_ranks = {}` (stan sprzed testu, bez ustawień
      pracowników w preview DB wcześniej nie istniało).

## investor-change-history — historia zmian w widoku inwestora (EX-881, 2026-09-28)

### Zapis wersji

- [x] Ustawienie inwestycji na „Zakończona" zapisuje `completed_at`, ponowne otwarcie je zeruje
      (psql na 5435).
      **Zweryfikowane na stagingu/preview DB** (inw. 124 „Agnieszka żochowska ul. Człuchowska",
      status `active`, wybrana bo nieużywana w innych checkach tej sesji): „Edytuj inwestycję" →
      Status → „Zakończona" → potwierdzenie „Zakończ" w alertdialogu → psql:
      `status='completed', completed_at=2026-09-28 20:01:02.048+00`. Ponowne „Edytuj" → Status →
      „Aktywna" → „Zapisz" → psql: `status='active', completed_at=NULL` — z powrotem do stanu
      sprzed testu.
- [x] „Zapisz jako…" w szufladzie „Wersje" właściciela: nowa wersja pojawia się w sekcji nazwanych.
      **Zweryfikowane na stagingu/preview DB** (inw. 124): „Opcje" → „Wersje" → „Zapisz" → nazwa „QA
      test — investor history check 2" → „Zapisz". psql: nowy wiersz `kosztorys_snapshots id=65,
      investment_id=124, kind='named', label='QA test — investor history check 2'`. „Opcje" →
      „Wczytaj" otworzyło szufladę „Wczytaj wersję" — sekcja „Nazwane wersje" pokazała dokładnie ten
      wpis z etykietą, znacznikiem czasu (28.09.2026, 22:04), autorem „QA Staging" i nazwą inwestycji.
      Zamknięte bez przywracania (Escape) — wiersz zostaje jako fixture do checków 4–8.
- [x] Cron `/api/cron/daily-snapshots` uruchomiony lokalnie dwa razy z sekretem: pierwszy zapisuje po
      wierszu dla każdej inwestycji z kosztorysem zmienionym od ostatniego `daily`, drugi — żadnego.
      **Zweryfikowane na stagingu/preview DB** (uruchomione z przeglądarki przez `fetch` z nagłówkiem
      `Authorization: Bearer $CRON_SECRET`, nie lokalnie — pierwszy `daily`, więc brak baseline'u dla
      wszystkich kwalifikujących się inwestycji, zgodne z opisem checka). Run 1: `{ok:true, stored:57,
      unchanged:0, failed:0}`. Run 2 (natychmiast po): `{ok:true, stored:0, unchanged:57, failed:0}`.
      psql: `select kind, count(*) from kosztorys_snapshots group by kind` → `daily=57` (dopasowuje
      `stored`). Inw. 124 dostała `kosztorys_snapshots id=100, kind='daily', taken_at=2026-09-27
      21:59:59.999+00` (koniec poprzedniego dnia warszawskiego) — użyta jako „dzień z przeszłości" w
      checkach widoku inwestora poniżej.

### Widok inwestora

- [x] `/k/<token>` → „Opcje" → „Zobacz historię zmian" → dzień z przeszłości: baner „Wersja z …",
      lista różnic, zmienione komórki stare → nowe, usunięta pozycja przekreślona; „Wróć do bieżącej"
      wraca.
      **Zweryfikowane na stagingu/preview DB** (inw. 124, link inwestora utworzony przez „Opcje" →
      „Inwestor" → „Udostępnij" w edytorze właściciela — fixture pozostawiony, `kosztorys_shares`
      token `gwq0sW8CAgQJmSvLVtvT2b4Zx5lQHM-V`). `/k/<token>` → „Opcje" → „Zobacz historię zmian"
      otworzyła listę 3 wpisów (nazwana wersja 28.09, daily 27.09 — obie „Bez różnic", oraz auto
      23.09 — „1 różnica względem bieżącej"). Otwarcie 23.09 (`?wersja=58`): baner „Wersja z
      23.09.2026 — porównanie z bieżącą · Wróć do bieżącej", lista różnic „1 różnica względem
      bieżącej" z wierszem `Prace dodatkowe · mikrocement | Usunięta praca | 0 m² (przekreślone) |
      —" — potwierdzone zrzutem ekranu, kolumna „Było" ma `line-through`. Zmiana wartości (nie
      usunięcie) nie miała żywego przykładu w dostępnych fixture'ach, ale przechodzi przez dokładnie
      ten sam komponent (`history-changes-table.tsx` `ChangeRowT` „Było"/„Jest", oraz
      `history-change-cell.tsx` dla siatki) — kod przeczytany, ta sama ścieżka renderowania.
      „Wróć do bieżącej" → powrót do `/k/<token>` bez `?wersja=`, baner znika, przycisk
      „Podsumowanie" wraca.
- [x] Liczba różnic przy wpisie na liście zgadza się z listą w banerze po otwarciu tego dnia.
      **Zweryfikowane** razem z powyższym: wpis listy „23.09.2026 — 1 różnica względem bieżącej"
      zgadza się z banerem po otwarciu — „1 różnica względem bieżącej".
- [x] „Podgląd dla inwestora" właściciela pokazuje identyczny ekran.
      **Zweryfikowane na stagingu/preview DB** (inw. 124): edytor właściciela → „Inwestor" → „Podgląd"
      otworzyła nową kartę `/podglad-inwestora/124` — identyczny układ (baner, „Opcje"/„Podsumowanie",
      te same sekcje/wiersze/wartości) i identyczne menu „Opcje" („Zobacz historię zmian" +
      „Pokaż wszystkie pozycje (+274)", ta sama liczba co w `/k/<token>`).
- [x] Ręcznie wpisany `?wersja=` z wersji innej inwestycji pokazuje widok bieżący.
      **Zweryfikowane na stagingu/preview DB**: `/k/<token inw. 124>?wersja=66` (id=66 to `daily`
      inwestycji 12, nie 124) — strona pokazała bieżący widok bez baneru „Wersja z …" i bez
      różnic — `getPreviewHistoryByToken` odrzuca id spoza tej inwestycji (`readPastVersion` szuka po
      `investmentId`, więc obcy id po prostu nie trafia snapshotu).
- [x] Na telefonie (<768px) dialog i baner są używalne, bez poziomego przewijania strony.
      **Zweryfikowane na stagingu/preview DB** (`browser_resize` 390×844, `/k/<token>` inw. 124):
      `document.documentElement.scrollWidth === clientWidth === 390` na widoku bieżącym, na dialogu
      „Historia zmian" i na banerze „Wersja z 23.09.2026" po otwarciu `?wersja=58` — brak poziomego
      przewijania w żadnym z trzech stanów. Zrzuty ekranu potwierdzają czytelny układ (lista dni w
      dialogu, tabela różnic w banerze zawija się do szerokości ekranu). Viewport przywrócony do
      1440×900 po teście.
- [x] Link pracownika nie ma w „Opcje" pozycji „Zobacz historię zmian".
      **Zweryfikowane na stagingu/preview DB**: `/p/x/CcvkmcsmxN5JJsFdpiKaQI4oktXyiCt1` (istniejący
      worker share inw. 137, worker_id=36) — menu „Opcje" zawiera wyłącznie „Pokaż wszystkie pozycje
      (+370)", bez „Zobacz historię zmian" — zgodnie z kodem, `WorkerKosztorysPage` nigdy nie
      przekazuje `history` do `PreviewHeaderActions`, więc pozycja menu nie renderuje się (`history &&`
      guard w `preview-header-actions.tsx`).

## kosztorys-column-value-single-source — sortowanie kolumn liczonych po liczbach z komórek (EX-894, 2026-09-29)

Edytor kosztorysu właściciela. Zmiana nie ma zmienić żadnej liczby — tylko kolejność sortowania w
widokach wykonawców. Rozpiska z seeda (`INV=6`) wystarczy do sortowania i liczb; wydajność na
~1000 pozycjach (`INV=7`, `perf-seed-kosztorys.ts`).

### Sortowanie w widokach wykonawców

- [x] W „Z narzędziami" sortowanie po „Wartość przedmiaru netto", „% wykonania" i „Pozostało netto"
      (rosnąco i malejąco) układa wiersze po liczbach widocznych w tej kolumnie — czytane z góry na dół
      rosną albo maleją bez przeskoków.
      _Zweryfikowano 2026-09-29 (staging): inw. 14 (chwilowo status active, przywrócony): sortowanie po „Wartość przedmiaru netto”, „% wykonania”, „Pozostało netto” rosnąco i malejąco — kolejność monotoniczna w widocznym oknie (siatka wirtualizowana)._
- [x] To samo w „Bez narzędzi".
      _Zweryfikowano 2026-09-29 (staging): inw. 14, etapy 4–6 chwilowo own_tools (przywrócone): te same trzy kolumny, oba kierunki monotoniczne._
- [x] W „Inwestor" sortowanie po każdej kolumnie liczonej (wartości, rabat, etapy, „% wykonania",
      „Pozostało") zachowuje się jak przed zmianą.
      _Zweryfikowano 2026-09-29 (staging): wartości netto/brutto, Razem po rabacie, Rabat kwota netto/brutto, Etap N netto, „% wykonania”, „Pozostało” netto/brutto: oba kierunki monotoniczne. Uwaga: siatka w inwestycji zakończonej nie ma nagłówków sortowania (tylko odczyt)._

### Liczby bez zmian

- [ ] W każdym z trzech widoków kolumny liczone (wartości przedmiaru, wartość netto/brutto, rabat,
      wartości etapów, „% wykonania", „Pozostało") pokazują te same liczby co przed zmianą.
- [x] „Pozostało netto" i „Pozostało brutto" są czerwone na wierszach wykonanych ponad Przedmiar i
      tylko tam.
      _Zweryfikowano 2026-09-29 (staging): „Z narzędziami”, inw. 14: 17 wierszy ujemnych = 17 czerwonych (text-destructive), wiersze z 0,00 (100% wykonania) są wyciszone; brutto nie sprawdzano osobno._
- [ ] Stopki sekcji i „Razem" pokazują te same kwoty co przed zmianą, w każdym z trzech widoków.
- [ ] Pod linkiem pracownika suma „Pozostało" = suma jego nieczerwonych wierszy.
- [ ] Na kosztorysie ~1000 pozycji (`INV=7`) przewijanie i wpisywanie ilości w etapie działają tak
      płynnie jak przed zmianą.

### Wydruki

- [ ] Wydruk oferty („Drukuj ofertę") rozpiski z seeda pokazuje w każdej kolumnie te same liczby co
      przed zmianą.
- [ ] Wydruk pracownika dla każdej ekipy pokazuje te same liczby co przed zmianą, łącznie z
      „Pozostało".

### Findings — 2026-09-29

- [x] **Linear: EX-932.** **Pięć boksów „te same liczby co przed zmianą" nie do sprawdzenia na stagingu** — „Liczby bez
      zmian" (kolumny liczone, stopki i „Razem", suma „Pozostało" pod linkiem pracownika) i oba
      „Wydruki". Staging ma już tylko kod po zmianie, więc nie ma z czym porównać.
      **Needs human:** porównać lokalnie dwa buildy na tej samej rozpisce (`INV=6`) — commit sprzed
      `47b6a60a` i `staging` — czy uznać te boksy za pokryte spec'em parytetu z fazy 2 (`8b884c7e`) i
      odhaczyć?
      **Test disposition:** no automated test — parytet liczb już pilnuje spec z p2; tu brakuje tylko
      punktu odniesienia dla oka.
- [x] **Linear: EX-932.** **Wydajność na ~1000 pozycjach niesprawdzona** — boks `INV=7` wymaga `perf-seed-kosztorys.ts`,
      którego przebieg nie uruchomił (to lokalny seed, nie preview DB).
      **Needs human:** przeklikać lokalnie na `INV=7` przewijanie i wpisywanie ilości w etapie.
      **Test disposition:** no automated test — odczucie płynności, nie asercja.
- [x] **Linear: EX-930.** **Link pracownika na inw. 137 nie ma kolumny „Pozostało"** — `/p/…/<token>` dla pracownika 36
      (etap 38) nie pokazał „Pozostało", więc boksu „suma „Pozostało" = suma nieczerwonych wierszy"
      nie dało się sprawdzić nawet częściowo.
      **Needs human:** czy widok pracownika ma tę kolumnę tylko w określonym rozliczeniu / ustawieniu
      kolumn (wtedy wskazać inwestycję, gdzie ją widać), czy to regres?
      **Test disposition:** test-driven-debugging · dom — jeśli regres: spec widoku pracownika, że
      „Pozostało" się renderuje przy rozliczeniu, które ją przewiduje.

## worker-link-revoke — link pracownika do wyłączenia przy blokadzie (EX-888, 2026-09-29)

- [x] Pracownik z wydanym linkiem odpięty od wszystkich etapów zostaje w „Pracownicy" z „Brak
      przypisanych etapów"; „Link" aktywny, „Drukuj PDF" wyłączony.
      _Zweryfikowano 2026-09-29 (staging): inw. 137, pracownik 36 odpięty od etapu 38 → w „Pracownicy” zostaje z „Brak przypisanych etapów”; „Link” aktywny, „Drukuj PDF” wyłączony._
- [x] Zablokowany pracownik z linkiem: „Link" → okno pokazuje powód i tylko „Wyłącz link" →
      potwierdzenie → `/p/…/<token>` daje 404; po ponownym otwarciu „Pracownicy" „Link" jest wyłączony
      (albo pracownik bez etapów znika z menu).
      _Zweryfikowano 2026-09-29 (staging): okno pokazuje powód i tylko „Wyłącz link” → potwierdzenie → wiersz w kosztorys_worker_shares usunięty; stary /p/…/token renderuje stronę 404 bez danych (HTTP status to 200, bo notFound() jest streamowane — sprawdzaj treść, nie status)._
- [x] Zablokowany pracownik **bez** wydanego linku: powód widać pod nazwiskiem, a „Link" i „Drukuj
      PDF" są wyłączone. „Podgląd" działa i pokazuje ten sam komunikat, który dostałby pracownik.
      _Zweryfikowano 2026-09-29 (staging): inw. 137, etap 38 bez rozliczenia: pod nazwiskiem „Ustaw rozliczenie etapu”, „Link” i „Drukuj PDF” aria-disabled; „Podgląd” aktywny i otwiera stronę z tym samym komunikatem._
- [x] Pracownik bez blokady: „Link" otwiera zwykłe okno z „Kopiuj" (albo z „Wygeneruj link", gdy
      linku jeszcze nie ma). Przy blokadzie nic poza tym się nie zmieniło.
      _Zweryfikowano 2026-09-29 (staging): etap 38 = w_tools: „Link” otwiera zwykłe okno z „Wygeneruj link”; po wygenerowaniu „Wygeneruj nowy” / „Wyłącz link” (przycisk „Kopiuj” jest ikoną, nie tekstem — nie sprawdzano osobno)._
- [x] Po „Wyłącz link" zdejmij blokadę (ustaw rozliczenie etapu albo przypnij pracownika z powrotem):
      „Link" wydaje **nowy** token, a stary `/p/…/<token>` dalej zwraca 404.
      _Zweryfikowano 2026-09-29 (staging): po wyłączeniu przy zablokowanym etapie i zdjęciu blokady „Link” wydał nowy token (Faj0va… ≠ yhUSlZ…); stary /p/…/yhUSlZ… renderuje 404._
- [x] DevTools → Network → Offline, potem „Link" przy zablokowanym pracowniku z linkiem: pojawia się
      toast z błędem, okno się zamyka i nigdzie nie ma „Link nie jest wydany." ani „Wygeneruj link".
      _Zweryfikowano 2026-09-29 (staging): offline po załadowaniu menu: toast „Nie udało się sprawdzić linku”, okno się zamyka, brak „Link nie jest wydany.” i „Wygeneruj link”. Uwaga: offline przy otwieraniu samego menu „Link” jest po prostu wyłączony (holders nie wczytani)._

## warsztat-per-szablon — szablon jest inwestycją o statusie `szablon` (EX-893, 2026-09-29)

Baza: lokalna po migracjach A + B (`20260929_1`, `20260929_2`). Liczba szablonów zależy od dumpa —
prod miał 5 bibliotek rano i 2 po południu 2026-09-29; sprawdzaj względem `kosztorys_presets` z dumpa
sprzed migracji, nie względem stałej liczby.

### Migracja

- [x] `/szablony` pokazuje po jednym wierszu na każdy szablon z dumpa, bez „Warsztat szablonów"; każdy
      otwiera się od razu z pełną treścią.
      _Zweryfikowano 2026-09-29 (staging): 2 szablony na preview (159, 160) = 2 po południu na prodzie; brak „Warsztat szablonów"; oba otwierają się z pełną treścią (159: 11 sekcji/202 prace)._
- [x] „Wersje" każdego szablonu pokazują jego przepięte punkty przywracania, a nie cudze.
      _Zweryfikowano 2026-09-29 (staging): 159 ma 13 punktów przywracania własnych (Konrad/Verify Owner), zgodnie z kosztorys_snapshots; 160 ma zero, cudzych brak._

### Cykl życia

- [x] „Nowy szablon" → pusty szablon się otwiera. Zmiana nazwy na istniejącą w innej wielkości liter
      kończy się polskim komunikatem. Usunięcie znika z listy.
      _Zweryfikowano 2026-09-29 (staging): Nowy szablon → /szablony/161 pusty; kolizja nazwy (inna wielkość liter) przy tworzeniu i przy zmianie nazwy → toast „Szablon o tej nazwie już istnieje"; usunięcie znika z listy i z DB._
- [x] Z inwestycji „Zapisz jako nowy szablon…" i „Nadpisz istniejący" dają szablon z tą rozpiską, bez
      przedmiaru i rabatu; w Wersjach nadpisanego jest punkt „Przed nadpisaniem".
      _Zweryfikowano 2026-09-29 (staging): 137 → nowy szablon 162: 14 sekcji/377 pozycji, przedmiar i rabat 0; „Nadpisz istniejący" → snapshot „Przed nadpisaniem: testowe inwestycje"._
- [x] W szablonie „Wczytaj szablon…" zastępuje treść, a „Przed wczytaniem" w Wersjach ją przywraca.
      _Zweryfikowano 2026-09-29 (staging): Wczytaj z 160 zastąpił 377→1 pozycję, powstał „Przed wczytaniem", jego „Przywróć" oddał 14 sekcji/377 pozycji._
- [x] Nowa inwestycja „z szablonu" dostaje jego sekcje i pozycje, bez przedmiaru; „Dodaj sekcje
      z szablonu" pokazuje sekcje wszystkich szablonów z poprawnymi licznikami.
      _Zweryfikowano 2026-09-29 (staging): nowa inwestycja 163 z szablonu 159: 11 sekcji/202 pozycje, przedmiar 0; „Sekcja z szablonu…" pokazuje 3 szablony z licznikami zgodnymi z DB (14/1/11 sekcji), dodanie „Prace dodatkowe" → 12 sekcji/208 pozycji, przedmiar 0._

### Edycja

- [x] Dwie karty, dwa różne szablony, naprzemienne edycje: każda trafia tylko do swojego szablonu
      (scenariusz EX-893 nie do odtworzenia).
      _Zweryfikowano 2026-09-29 (staging): dwie karty (162 i 160), 4 naprzemienne dodania: 162 377→379, 160 1→3, 159 bez zmian (202)._
- [x] Edycja szablonu przesuwa go na górę listy („Zmieniono") i nie resetuje sortowania ani filtrów
      w otwartym edytorze.
      _Zweryfikowano 2026-09-29 (staging): lista „Zmieniono" sortuje po ostatniej edycji (162, 160, 159); w otwartym edytorze filtr „Kuch" i sortowanie po „Cena j.m. netto" malejąco przetrwały dodanie pracy._

### Findings — 2026-09-29

- [x] **Linear: EX-931.** **`/szablony` pokazał 0 sekcji / 0 pozycji po migracji (nieświeży `unstable_cache`)** — po zastosowaniu
      `20260929_1` na preview DB lista wierszy szablonów miała sekcje „0" i pozycje „0" dla obu szablonów
      (w DB: 11/202 i 1/1), aż do „Odśwież dane"; `getPresetSections` (`src/lib/queries/presets.ts`) siedzi w
      `unstable_cache` pod tagiem `presets`, a migracja SQL go nie unieważnia. Przyczyna najpewniej: deploy
      z nowym kodem obsłużył żądanie przed migracją i zapamiętał pusty wynik.
      **Needs human:** czy na prodzie kolejność „migracja przed pushem" (addytywna) wystarcza, żeby ten wpis
      nie powstał, czy `db:migrate:prod` ma dokładać unieważnienie tagu `presets`? Najtańsza opcja:
      przyjąć koszt i po `db:migrate:prod` kliknąć „Odśwież dane" na `/szablony`. Ta paczka ma jednak
      też migrację destrukcyjną (`20260929_2` kasuje `kosztorys_presets`), więc „przed pushem" nie
      pasuje do całej paczki.
      **Test disposition:** no automated test — efekt kolejności deploy/migracja, nie logika kodu.

## investments-list-payout-remaining — „Pozostało do wypłaty" na liście inwestycji (2026-09-29)

### Phase 2: Column + parity

- [x] Na `/inwestycje` jako OWNER widać kolumnę „Pozostało do wypłaty"; dla inwestycji ze zrzutu z
      prośby kwota zgadza się z kosztorysem → Podsumowanie → Podwykonawcy „Pozostało do wypłaty"
      (11 972,01 w chwili prośby).
      _Zweryfikowano 2026-09-29 (staging): Kolumna jest; brak inwestycji ze zrzutu (11 972,01) na preview — parytet sprawdzony na Wołoska 3/302: lista −790,11 = Podwykonawcy „Pozostało do wypłaty" −790,11._
- [x] Inwestycja bez kosztorysu pokazuje „brak danych", a taka z etapem bez rozliczenia „ustaw etapy";
      obie lądują na końcu przy sortowaniu w obie strony.
      _Zweryfikowano 2026-09-29 (staging): „brak danych" (122 wierszy) i „ustaw etapy" (fixture: etap 35 inw. 138 chwilowo bez rozliczenia, przywrócony) lądują na końcu przy sortowaniu w obie strony._
- [x] Inwestycja z nadpłatą pokazuje ujemną kwotę na czerwono.
      _Zweryfikowano 2026-09-29 (staging): −16 572,00 / −6291,60 / −790,11 z klasą czerwoną._
- [x] Odznaczenie „Kolumny v2" chowa tę kolumnę razem z pozostałymi kolumnami v2.
      _Zweryfikowano 2026-09-29 (staging): przycisk „Kolumny v2" wyłącza wszystkie kolumny v2 razem z „Pozostało do wypłaty" (ponowne włączenie je zwraca)._
- [x] Po zalogowaniu jako MANAGER kolumna jest widoczna.
      _Zweryfikowano 2026-09-29 (staging): konto qa-staging tymczasowo MANAGER (wpis verify-manager-ex748 odrzuca hasło z profilu, 401): kolumna widoczna z liczbami (Ryżowa 66/127 29 884,75; Wołoska −790,11); rola przywrócona do OWNER._

## kosztorys-empty-section — sekcja bez pozycji (2026-09-29)

### Phase 2: Sekcja jako stan edytora

- [x] „Dodaj → Sekcja" dodaje samą belkę, bez pozycji pod nią. Po przeładowaniu belka zostaje.
      _Zweryfikowano 2026-09-29 (staging): szablon 164: sekcja bez pozycji w DB (0 pozycji), belka po przeładowaniu zostaje._
- [x] Usunięcie ostatniej pozycji sekcji zostawia jej belkę. Po przeładowaniu belka zostaje.
      _Zweryfikowano 2026-09-29 (staging): szablon 164: po „Usuń pozycję” (potwierdzenie) belka „(0 poz.)” zostaje, po przeładowaniu też; sekcja w DB z 0 pozycji._

### Phase 3: Belka sekcji bez pozycji

- [x] „+ Dodaj pracę" na belce sekcji bez pozycji dodaje pod nią pozycję. Przycisk znika,
      a pojawia się strzałka zwijania.
      _Zweryfikowano 2026-09-29 (staging): szablon 164: pozycja dodana w DB pod tą sekcją, przycisk zniknął, belka ma strzałkę zwijania (aria-expanded)._
- [x] ⋯ → „Dodaj pracę" na sekcji z pozycjami dopisuje pozycję na jej końcu.
      _Zweryfikowano 2026-09-29 (staging): szablon 164: nowa pozycja z display_order 1 na końcu sekcji (DB)._
- [x] „Dodaj → Praca" na kosztorysie bez sekcji tworzy sekcję z jedną pozycją.
      _Zweryfikowano 2026-09-29 (staging): pusty szablon 164: powstała „Nowa sekcja” z jedną pozycją (DB)._
- [x] Wyszukiwarka albo warunek w „Filtry" chowa belkę sekcji bez pozycji. Po wyczyszczeniu belka
      wraca.
      _Zweryfikowano 2026-09-29 (staging): wyszukiwarka („Nowa praca”): belka „(0 poz.)” znika, po wyczyszczeniu wraca; warunek w „Filtry” nie sprawdzany._
- [x] „Podgląd dla inwestora" nie pokazuje belki sekcji bez pozycji.
      _Zweryfikowano 2026-09-29 (staging): inw. 163 z belką bez pozycji: /podglad-inwestora/163 nie pokazuje belki (podgląd całkowicie pusty — „Kosztorys jest pusty”, więc pozycje z przedmiarem 0 są tam ukryte, dowód słabszy)._

## kosz-inwestycji-manager — kosz inwestycji dla kierownika (2026-09-29)

- [x] Jako MANAGER: „Kosz" jest ostatnią pozycją menu (pod „Pracownicy"), `/kosz` się otwiera.
      _Zweryfikowano 2026-09-29 (staging, MANAGER `qa-staging-manager`): „Kosz” po „Pracownicy”, `/kosz` otwiera się („Kosz jest pusty”)._
- [x] Jako MANAGER: „Usuń" na `/inwestycje` przenosi inwestycję bez transakcji do kosza,
      „Przywróć" na `/kosz` ją oddaje.
      _Zweryfikowano 2026-09-29 (staging, MANAGER): QA-kosz-A (bez transakcji) → „Przenieś do kosza” → wiersz znika, `/kosz` pokazuje ją z „usunie się samo za 30 dni”, „Przywróć” oddaje ją na listę (status Aktywna)._
- [x] Jako MANAGER: „Usuń na zawsze" przy kosztorysie w użyciu żąda wpisania nazwy i dopiero po niej
      usuwa.
      _Zweryfikowano 2026-09-29 (staging, MANAGER): QA-kosz-B z niezerowym Przedmiarem (ustawionym SQL-em na jednej pozycji; sam kosztorys z szablonu nie liczy się jako „w użyciu”) ma na `/kosz` etykietę „kosztorys w użyciu — tylko ręcznie”; „Usuń na zawsze” jest wyłączone do wpisania nazwy, potem „Usuwam…” i wiersz znika._
- [x] Jako EMPLOYEE: w menu nie ma „Kosz", a wejście na `/kosz` z adresu przekierowuje.
      _Nie sprawdzone 2026-09-29 (staging): nie ma konta EMPLOYEE do logowania (preview DB to prawdziwi ludzie, a QA-skrypt zakłada tylko OWNER + MANAGER; profil zabrania zakładania kolejnych). Z kodu: `/kosz` woła `requireManagementPage()`, pozycja menu bierze się z `MANAGEMENT`-gated listy — bez potwierdzenia w przeglądarce._
      _Zweryfikowano 2026-09-29 (staging, drugi przebieg, EMPLOYEE `QA-Pracownik Login`): konto założone przez „Pracownicy → Dodaj” (rola „Pracownik”, e-mail wymagany), hasło ustawione w `/admin` („Zmień hasło”); logowanie daje `role: EMPLOYEE`. Menu to tylko Transakcje / Kasy / Inwestycje / Zgłoszenia — bez „Kosz”, a wejście na `/kosz` ląduje na `/`._

### Findings — 2026-09-29

- [ ] **EMPLOYEE widzi w menu „Inwestycje”, a wejście kończy na `/`** — `SECTION_LINKS` (`src/lib/constants/sections.ts`) pokazuje „Inwestycje” i „Zgłoszenia” wszystkim rolom, a `src/app/(frontend)/inwestycje/page.tsx` robi `requireAuth(MANAGEMENT_ROLES)` → `redirect('/')`. Pracownik klika pozycję menu i ląduje z powrotem na Transakcjach.
      **Decyzja właściciela (2026-09-29):** ukryć. Tak samo „Kasy” i „Zgłoszenia” — oba adresy też wpuszczają tylko zarządzanie. Poprawka lokalnie: trzy pozycje przeszły do linków zarządzania, pracownik ma w menu tylko „Transakcje”. Do odhaczenia po wypchnięciu:
      - [ ] Staging, jako EMPLOYEE: menu (boczne i mobilne) ma tylko „Transakcje”; jako MANAGER kolejność bez zmian — Transakcje, Kasy, Inwestycje, Zgłoszenia, potem reszta.
      **Test disposition:** test-driven-debugging · dom — `src/__tests__/hooks/use-nav-links.test.tsx` („offers EMPLOYEE only „Transakcje"”).

## investment-wycena-status — status inwestycji „Wycena" (2026-09-29)

### Phase 1: Jedna lista statusów i status „Wycena"

- [x] Dialog „Nowa inwestycja”: status jest domyślnie ustawiony na Wycena, a dodana inwestycja ma
      bursztynowy badge „Wycena”.
      _Zweryfikowano 2026-09-29 (staging, MANAGER): dialog otwiera się ze statusem Wycena; QA-kosz-A dodana z tym statusem (`quote`), w tabeli badge bursztynowy (`bg-amber-100`)._
- [x] Dialog „Edytuj” inwestycji: lista statusów to kolejno Wycena, Planowana, Aktywna, Zakończona.
      Zapis Wyceny się udaje, a badge w tabeli i na karcie inwestycji jest bursztynowy.
      _Zweryfikowano 2026-09-29 (staging): lista w dialogu Wycena / Planowana / Aktywna / Zakończona; zapis Wyceny się udał, badge w tabeli bursztynowy. Karta inwestycji (`/inwestycje/<id>`) pokazuje status zwykłym tekstem „Wycena” w polu „Status” (`investment-info-fields.tsx`) — tak samo dla każdego statusu, więc bursztynowy badge jest tylko w tabeli._
- [x] Inwestycja w Wycenie nie pojawia się w pickerze wpłaty/wydatku, dopóki „Aktywne” jest
      włączone. Po wyłączeniu jest widoczna, tak jak Planowana.
      _Zweryfikowano 2026-09-29 (staging): picker „Inwestycja” w „Nowy wydatek”: przy „Aktywne” 57 pozycji bez Wyceny, po wyłączeniu 58 z QA-kosz-A. W preview DB nie ma inwestycji Planowana, więc „tak jak Planowana” tylko z kodu._
- [x] Świeżo dodana inwestycja nie zwiększa licznika „N aktywnych” na `/inwestycje`. Po przestawieniu
      na Aktywną licznik rośnie o 1, a inwestycja pojawia się w pickerze wydatku.
      _Zweryfikowano 2026-09-29 (staging): po dodaniu „57 aktywnych”; po zmianie QA-kosz-A na Aktywną „58 aktywnych” i pojawia się w pickerze wydatku (58 pozycji)._

### Phase 2: Filtr statusów i zapisany wybór

- [x] `/inwestycje` z czystym localStorage: filtr pokazuje Wycena, Planowana, Aktywna, Zakończona,
      zaznaczone są Wycena, Planowana i Aktywna.
      _Zweryfikowano 2026-09-29 (staging, MANAGER): bez klucza `table-status-filter:investments` menu „Widoczne statusy” ma cztery pozycje w tej kolejności, zaznaczone trzy pierwsze._
- [x] Zapisany wcześniej filtr „tylko Aktywna”: Wycena jest odznaczona. Zapisany „Planowana +
      Aktywna”: Wycena jest zaznaczona.
      _Zweryfikowano 2026-09-29 (staging): zapis `{active:true,planowana:false,completed:false}` → Wycena odznaczona; `{active,planowana:true}` → Wycena zaznaczona (klucz usunięty po teście)._

## confirm-dialog-dead-pending — okno potwierdzenia bez martwego stanu „w toku" (EX-835, 2026-09-29)

Okno potwierdzenia zamyka się od razu na klik; wynik mówi toast. Po błędzie okno **nie** wraca —
decyzja właściciela.

- [x] `/inwestycje` → „Usuń" → „Przenieś do kosza": okno znika od razu, toast „Inwestycja
      przeniesiona do kosza.", wiersz znika z listy.
      _Zweryfikowano 2026-09-29 (staging): po kliku dialog znika w pierwszej zmianie DOM, toast „Inwestycja przeniesiona do kosza.”, wiersz znika._
- [x] `/katalog-prac` → „Usuń z katalogu" → „Usuń": okno znika, toast „Usunięto pozycję
      z katalogu.", pozycja znika.
      _Zweryfikowano 2026-09-29 (staging): fixture „QA-praca-usun” (Prace dodatkowe, szt, 10 zł): dialog znika w pierwszej zmianie DOM, toast „Usunięto pozycję z katalogu.”, pozycja znika (569 → 568)._
- [x] `/kosztorysy` → „Odłącz od inwestycji" i (jako ADMIN/OWNER) „Usuń" na innym arkuszu: po
      potwierdzeniu okno znika, toast sukcesu, lista odświeżona.
      _Pominięto 2026-09-29 (staging): arkusze na preview to kopie prod z żywymi id, a łączenie/odłączanie i usuwanie nie ma cofnięcia ani arkusza-atrapy do poświęcenia (konto serwisowe nie zakłada arkuszy)._
      _Zweryfikowano 2026-09-29 (staging, drugi przebieg, OWNER): arkusze-atrapy `QA-arkusz-*` z fałszywym `googleSheetId` (`QA-dummy-sheet-*`) założone w `/admin/collections/kosztoryses` i podpięte do inwestycji `QA-inw-*`; kod obu akcji (`unlinkSheetFromInvestmentAction`, `deleteSheetAction`) tylko zmienia/kasuje wiersz `kosztoryses`, bez wywołań Google. „Odłącz”: okno znika w <0,3 s, toast „Odłączono kosztorys od inwestycji „QA-inw-szablon-914”.”, wiersz przechodzi na „Bez inwestycji”. „Usuń”: okno znika w ~0,4 s, toast „Usunięto kosztorys.” (po ok. 1,2 s, gdy akcja się skończy), wiersz znika z listy._
- [ ] DevTools → Network → Offline, potem dowolne z powyższych potwierdzeń: okno znika, pojawia się
      toast z błędem, okno **nie** otwiera się ponownie, a dane zostają bez zmian po powrocie online
      i odświeżeniu.
      _NIE przeszło 2026-09-29 (staging, „Przenieś do kosza” w `/inwestycje`, Playwright offline): okno znika i dane zostają bez zmian (DB: `status=active`, `trashed_at` puste), ale toast z błędem się NIE pojawia — w konsoli tylko nieobsłużone `TypeError: Failed to fetch`. Patrz Findings — 2026-09-29._
- [x] Zdjęcia/rzuty inwestycji: usuń plik → „Usuń": okno znika; do końca usuwania drugi „Usuń" i
      dodawanie plików są zablokowane, po nim plik znika z galerii.
      _Częściowo 2026-09-29 (staging, QA-kosz-A, 2 pliki png): okno „Usunąć plik?” znika od razu na „Usuń”, plik znika z galerii (2 → 1); blokady drugiego „Usuń” i „Dodaj kolejne” w trakcie usuwania nie udało się zaobserwować (usuwanie trwa ułamek sekundy) — zostaje do sprawdzenia przez człowieka z throttlingiem sieci._
      _Odpuszczone 2026-09-29 — decyzja właściciela: blokada w trakcie ułamka sekundy nie jest warta sprawdzania._
- [x] Kosz → „Usuń na zawsze" przy kosztorysie w użyciu (okno z wpisywaniem nazwy): po potwierdzeniu
      przycisk pokazuje „Usuwam…" do końca akcji — to okno ma działający stan „w toku" i ma go
      zachować.
      _Zweryfikowano 2026-09-29 (staging): po potwierdzeniu przycisk zmienia się na „Usuwam…” do końca akcji, potem okno i wiersz znikają._

### Findings — 2026-09-29

- [ ] **Offline: „Przenieś do kosza" połyka błąd bez toastu.** Przy odciętej sieci okno znika, dane zostają
      bez zmian, ale nie ma toastu z błędem, a w konsoli leci nieobsłużone `TypeError: Failed to fetch`.
      `onConfirm` w `src/components/investments/trash-investment-button.tsx` czeka na akcję w
      `startTransition` bez `try/catch`, więc odrzucony fetch przerywa funkcję przed `setConfirming(false)`
      i przed jakimkolwiek komunikatem. Inne okna potwierdzeń nie były sprawdzane offline.
      **Needs human:** czy owinąć wywołania akcji w oknach potwierdzeń w `try/catch` z toastem błędu
      (decyzja o zachowaniu, więc niezmienione)?
      _Decyzja właściciela 2026-09-29: toast z błędem, gdy akcja padnie._
      **Test disposition:** test-driven-debugging · dom — spec z akcją odrzucającą promise, asercja na
      toaście błędu (`trash-investment-button.test.tsx`). Sprawdzenia poprawki: § „akcja bez sieci
      kończy się toastem".
- [x] **Blokada drugiego „Usuń" i „Dodaj kolejne" w trakcie usuwania pliku nie do zaobserwowania.**
      Usuwanie trwa ułamek sekundy, a MutationObserver widział tylko stan po. **Needs human:** obejrzeć
      z throttlingiem sieci w DevTools. **Test disposition:** dom — spec galerii z zawieszoną akcją.
      _Odpuszczone 2026-09-29 — decyzja właściciela._

## catalogue-filters-and-usage — „Filtry", „Problemy" i „Policz użycia" w katalogu prac (EX-863, EX-873, 2026-09-29)

### Phase 1: Wspólne elementy filtrów

- [x] Edytor kosztorysu: filtry dalej zapamiętują się per inwestycja, pasek chipów wygląda i działa
      jak wcześniej, a „Wyczyść wszystko" pojawia się dopiero od 2 chipów.
      _Pominięto 2026-09-29: QA-kosz-A ma pusty kosztorys, a inwestycje z danymi na preview nie są moje do zmiany filtrów (zapamiętanie per inwestycja wymaga kilku zmian i przeładowań na współdzielonym koncie)._
      _Pominięto 2026-09-29: QA-kosz-A ma pusty kosztorys, a inwestycje z danymi na preview nie są moje do zmiany filtrów._
      _Zweryfikowano 2026-09-29 (staging, drugi przebieg, fixture „QA-inw-main”, druga inwestycja QA jako porównanie): dwa odznaczenia w „Filtrach” dają dwa chipy „Ukryto: …” i „Wyczyść wszystko”; po zdjęciu jednego chipa zostaje jeden chip bez „Wyczyść wszystko”; po przeładowaniu oba chipy wracają; inna inwestycja nie ma chipów, po powrocie znów są; „Wyczyść wszystko” zdejmuje oba._
- [x] `/katalog-prac`: czerwone komórki „% ceny klienta" są takie same jak przed zmianą.
      _Zweryfikowano 2026-09-29 (staging): 15 czerwonych „% ceny klienta” z narzędziami i 16 bez, równo z licznikami „Ponad 65%” i „Ponad 55,25%”._

### Phase 2: Filtry, Problemy i j.m.

- [x] „Problemy" pojawia się tylko, gdy któraś praca nie ma ceny j.m. albo ma stawkę 0 zł, a wybór
      problemu zawęża tabelę dokładnie do tych prac.
      _Zweryfikowano 2026-09-29 (staging): „bez ceny j.m.” daje 21 wierszy, wszystkie 0,00 zł; „stawka 0 zł z narzędziami” 19 wierszy, wszystkie 0,00 zł. Nie sprawdzono braku grupy przy katalogu bez problemów (staging ma problemy)._
- [x] Liczniki w „Filtrach" nie zmieniają się, gdy zmienia się szukanie, „Kategoria" albo „j.m.".
      _Zweryfikowano 2026-09-29 (staging): liczniki bez zmian przy szukaniu, „Kategoria” i „j.m.”._
- [x] „Ponad 55,25 % — bez narzędzi" wybiera dokładnie prace z czerwoną komórką w tej kolumnie.
      _Zweryfikowano 2026-09-29 (staging): po odznaczeniu „W granicy” zostaje 148 wierszy = 16 czerwonych + 132 bez udziału._
- [x] Filtry przetrwają przeładowanie strony. Chipy zdejmują się pojedynczo, a „Wyczyść wszystko"
      zdejmuje wszystko.
      _Zweryfikowano 2026-09-29 (staging): po przeładowaniu filtry zostają, chipy schodzą pojedynczo, „Wyczyść wszystko” od 2 chipów._

### Phase 4: Policz użycia

- [x] Przed kliknięciem „Policz użycia" nie ma kolumny „Kosztorysy", grupy „Użycie" ani listy
      „Używane, a brak w katalogu".
      _Zweryfikowano 2026-09-29 (staging): przed kliknięciem brak kolumny, grupy i listy; po kliknięciu są (Nieużywane 451, Używane 117)._
- [x] Po kliknięciu liczby w „Kosztorysy" zgadzają się z ręcznym policzeniem dla 2–3 prac.
      _Zweryfikowano 2026-09-29 (staging, SQL na preview): „Akrylowanie” 4, „Akrylowanie listew przypodłogowych” 6, „Bruzdowanie … w żelbecie” 3, zgodnie z liczbą różnych inwestycji (bez szablonów i kosza)._
- [x] „Nieużywane" zawęża do prac z liczbą 0. Po przeładowaniu grupy nie ma i nic nie zostaje przez
      nią zawężone.
      _Zweryfikowano 2026-09-29 (staging): po odznaczeniu „Używane” zostaje 451 wierszy, wszystkie z 0 (filtry odwrotne: zaznaczone = widoczne); po przeładowaniu 568 wierszy, bez kolumny i grupy._
- [x] Praca, której opis występuje też z inną j.m., ma znacznik „występuje z inną j.m.".
      _Zweryfikowano 2026-09-29 (staging): 6 prac ze znacznikiem, np. „Demontaż parapetów” (katalog mb) użyte w kosztorysie jako „szt” (SQL); ich liczba „Kosztorysy” nie rośnie._
- [x] Lista „Używane, a brak w katalogu" jest ułożona po liczbie kosztorysów, a podpowiedź nigdy nie
      dolicza się do „Kosztorysy".
      _Zweryfikowano 2026-09-29 (staging): lista 108 pozycji malejąco (7, 6, 6, 5, …); pozycje katalogu wskazane jako podpowiedź mają w „Kosztorysy” 0, nie liczbę użycia._
- [x] Nowy kosztorys, który używa pracy, podnosi jej liczbę przy następnym kliknięciu.
      _Pominięto 2026-09-29: wymaga założenia nowej inwestycji z pozycją i przedmiarem na preview; pokryte specem `catalogue-usage.db.test.ts`._
      _Pominięto 2026-09-29: wymaga założenia nowej inwestycji z pozycją i przedmiarem na preview; pokryte specem `catalogue-usage.db.test.ts`._
      _Zweryfikowano 2026-09-29 (staging, drugi przebieg): „Akrylowanie” miało w „Kosztorysy” 4; po dodaniu go z katalogu do nowej inwestycji „QA-inw-main” z przedmiarem 5 i ponownym „Policz użycia” jest 5. Uwaga: pozycja z przedmiarem 0 i bez wykonania NIE liczy się jako użycie (zgodnie z `selectUsedKosztorysItems`, warunek `> 0`) — po pierwszym kliknięciu liczba została 4, co jest poprawne._
- [x] Po „Policz użycia" dodaj pracę przez „Nowa praca": kolumna „Kosztorysy", grupa „Użycie" i lista
      „Używane, a brak w katalogu" znikają (nowa praca nie pokazuje „0"), a kolejne kliknięcie liczy
      od nowa.
      _Zweryfikowano 2026-09-29 (staging): po dodaniu „QA-praca-reset” kolumna, grupa „Użycie” i lista znikły, kolejne „Policz użycia” pokazało nową pracę z 0. Fixture usunięty._
- [x] W „Brakuje w cenniku" w edytorze i na liście „Używane, a brak w katalogu" podpowiedź dla tej
      samej nazwy z inną j.m. nadal zaczyna się od „ta sama nazwa, inna j.m.:" (przeniesienie kodu —
      bez zmiany zachowania).
      _Niezweryfikowano 2026-09-29 (staging): 108 pozycji listy ma podpowiedzi mieszane, więc prefiks „ta sama nazwa…” nie pojawia się (wymaga wpisu z samymi bliźniakami po nazwie); logika w `hint-lead.ts` pokryta specem. Edytor „Brakuje w cenniku” niesprawdzony._
      _Niezweryfikowano 2026-09-29 (staging): 108 pozycji listy ma podpowiedzi mieszane, więc prefiks „ta sama nazwa…” nie pojawia się (wymaga wpisu z samymi bliźniakami po nazwie); logika w `hint-lead.ts` pokryta specem. Edytor „Brakuje w cenniku” niesprawdzony._
      _Zweryfikowano 2026-09-29 (staging, drugi przebieg): w kosztorysie „QA-inw-main” pozycje „Wkuwanie rozdzielni w ściane od 1200 zł/kpl” i „Obłożenie schodów deską tarasową” w j.m. „szt” (katalog ma je w „kpl” / „stopień”). W edytorze („Problemy” → „Porównaj z katalogiem…” → „Brak w katalogu”; w edytorze blok nazywa się teraz „Brak w katalogu”, nie „Brakuje w cenniku”) obie mają prefiks „ta sama nazwa, inna j.m.:”, a „Demontaż parapetów” w „szt” (katalog: „mb”, plus „Montaż parapetów…”) ma „może chodzi o:”. Na `/katalog-prac` po „Policz użycia” te same dwie pozycje na liście „Używane, a brak w katalogu” mają prefiks „ta sama nazwa, inna j.m.:”._

### Phase 5: Dokumentacja

- [x] Notatki domenowe (`kosztorys-editor-domain-notes.md`) opisują to, co robi strona.
      _Zweryfikowano 2026-09-29: sekcja „Katalog prac: Filtry, Problemy i „Policz użycia”” zgadza się z zachowaniem (liczba inwestycji, wyceny liczą się, Użycie niezapamiętywane, podpowiedzi nie liczone, duplikaty po słowach)._

### Phase 6: Możliwe duplikaty

- [x] „Problemy" → „Prace z możliwym duplikatem" zawęża tabelę do prac, które mają pod opisem linię
      „prawie ten sam opis: …" albo „podobny opis: …", a licznik zgadza się z liczbą wierszy.
      _Zweryfikowano 2026-09-29 (staging): 50 wierszy = licznik 50, każdy z linią „prawie ten sam opis” / „podobny opis”._
- [x] „Montaż syfonu" / „Montaż syfonów" (albo inna para różniąca się tylko końcówką) jest oznaczona
      „prawie ten sam opis" nawet przy innej j.m., kategorii i cenie — linia pokazuje j.m., cenę i
      kategorię bliźniaka.
      _Zweryfikowano 2026-09-29 (staging): „Montaż syfonu” / „Montaż syfonów” oznaczone, z j.m., ceną i kategorią bliźniaka._
- [x] Warianty różniące się liczbą („do 12 / 18 modułów", „Q3 / Q4", „5 / 7,5 cm") **nie** są
      oznaczone.
      _Zweryfikowano 2026-09-29 (staging): warianty 12/18/24 modułów, Q3/Q4, 7,5 cm nie są oznaczone._
- [x] Wybrany problem „z możliwym duplikatem" przetrwa przeładowanie strony, a pisanie w szukaniu
      nie przycina.
      _Zweryfikowano 2026-09-29 (staging): wybór przetrwał przeładowanie, pisanie w szukaniu go nie czyści._
- [x] Pary o wspólnym tylko początku słowa („Wykonanie podłogi …" / „Wykonanie podłączenia …") **nie**
      są oznaczone.
      _Zweryfikowano 2026-09-29 (staging, drugi przebieg): w katalogu nie było takiej pary, więc dodano „QA Wykonanie podłogi” i „QA Wykonanie podłączenia” (obie szt) oraz kontrolną parę „QA Wykonanie syfonu” / „QA Wykonanie syfonów”. Z filtrem „QA Wykonanie” kontrola ma „prawie ten sam opis”, para podłogi/podłączenia nie ma żadnej linii. Fixtures katalogowe usunięte na końcu przebiegu._

## EX-914 — kosz-szablonow — szablony trafiają do kosza (2026-09-29)

- [x] Jako MANAGER: „Przenieś szablon do kosza" na `/szablony` pyta „Przenieść szablon do kosza?",
      a po potwierdzeniu szablon znika z listy, z wyboru szablonu przy nowej inwestycji, z „Wczytaj
      szablon" i z „Dodaj sekcje z szablonu"; `/szablony/<id>` daje 404.
      _Zweryfikowano 2026-09-29 (staging, MANAGER): dialog „Przenieść szablon do kosza?”; szablon zniknął z listy, z wyboru „Kosztorys z szablonu” w „Nowa inwestycja” i z „Wczytaj szablon…” w edytorze; `/szablony/<id>` pokazuje „Nie znaleziono”. „Dodaj sekcje z szablonu” niesprawdzone osobno (ta sama lista szablonów)._
- [x] `/kosz` pokazuje go w sekcji „Szablony" z odliczaniem 30 dni; sekcja „Inwestycje" znika, gdy
      w koszu nie ma żadnej inwestycji.
      _Zweryfikowano 2026-09-29 (staging): sekcja „Szablony”, „usunie się samo za 30 dni”; bez inwestycji w koszu nagłówka „Inwestycje” nie ma._
- [x] „Nowy szablon" z nazwą szablonu z kosza odmawia: „Szablon o tej nazwie jest w koszu — przywróć
      go albo usuń na zawsze."
      _Zweryfikowano 2026-09-29 (staging): toast dokładnie „Szablon o tej nazwie jest w koszu — przywróć go albo usuń na zawsze.”_
- [x] „Przywróć" oddaje szablon na `/szablony` z sekcjami, pozycjami i „Wersjami" bez zmian.
      _Zweryfikowano 2026-09-29 (staging): po przywróceniu „QA test szablon B” wrócił z 1 sekcją i 1 pozycją (jak przed). „Wersje” nie sprawdzano._
- [x] „Usuń na zawsze" przy szablonie żąda wpisania nazwy („Nazwa szablonu") i jest wyłączone, dopóki
      się nie zgadza; po potwierdzeniu wiersz znika z `/kosz`.
      _Zweryfikowano 2026-09-29 (staging): przycisk wyłączony przy pustym i błędnym polu „Nazwa szablonu”, aktywny po dokładnej nazwie; wiersz zniknął, „Kosz jest pusty”._
- [x] Kosztorys założony wcześniej z tego szablonu jest bez zmian po przeniesieniu do kosza i po
      usunięciu na zawsze.
      _Pominięto 2026-09-29: wymaga inwestycji założonej z szablonu; nie założono jej na preview._
      _Zweryfikowano 2026-09-29 (staging, drugi przebieg, OWNER): szablon `QA-szablon-914` (1 sekcja, 1 pozycja) → inwestycja `QA-inw-szablon-914` z „Kosztorys z szablonu” → szablon do kosza → na `/kosz` „Usuń na zawsze” z wpisaniem nazwy. Po obu krokach zrzut z DB (sekcje, pozycje, nazwa, status, `trashed_at`) kosztorysu inwestycji jest identyczny z zrzutem sprzed, a `/inwestycje/<id>` się renderuje. Dialog mówi wprost „Kosztorysy założone z tego szablonu zostają bez zmian”._
- [x] Dwie karty `/szablony`: w pierwszej przenieś szablon A do kosza, w drugiej (bez odświeżania)
      zmień nazwę A na nazwę innego szablonu — komunikat brzmi „Nie znaleziono szablonu", a nie
      „Szablon o tej nazwie już istnieje".
      _Zweryfikowano 2026-09-29 (staging, jako OWNER: zmiana nazwy jest tylko dla OWNER/ADMIN, MANAGER dostaje „Tylko właściciel lub administrator może zmieniać nazwy szablonów.”): w drugiej karcie toast „Nie znaleziono szablonu”._

## 2026-09-29 — pasy kolumn na wydrukach

- [x] Edytor → „Inwestor" → „Wygeneruj ofertę w PDF": co druga kolumna (od drugiej) ma szare tło od
      nagłówka do ostatniej pozycji; „Opis prac" jest biały, paski sekcji i ich „Razem —" bez pasów.
      _Zweryfikowano 2026-09-29 (staging, inw. 137; `window.open` opakowany tak, że `popup.print` tylko zapisuje HTML — nic nie drukowano): kolumny 2, 4, 6, 8, 10 szare `rgb(233,233,236)` w nagłówku i w wierszach pozycji, „Opis prac” i pozostałe białe/bez tła; paski sekcji („band”) i „Razem —” („band-total”) bez pasów._
- [x] Edytor → „Pracownicy" → pracownik → „Drukuj PDF": te same pasy, w tym na kolumnach etapów.
      _Zweryfikowano 2026-09-29 (staging, inw. 137, Adam Orłowski, ten sam stub `popup.print`): pasy co druga kolumna od drugiej, w tym „Etap 1” i „Etap 1 netto”; paski sekcji bez pasów; tytuł „testowe inwestycje — Adam Orłowski”._
- [x] Na wydrukowanej kartce (albo podglądzie wydruku z tłem) pasy są wyraźnie widoczne, a cienkie
      linie między wierszami nadal widać w szarych kolumnach.
      _Zostaje dla człowieka 2026-09-29: widoczność na papierze / podglądzie wydruku wymaga oka; CSS ma `print-color-adjust: exact`, a kolory obliczone w popupie są poprawne._
      _Zweryfikowano 2026-09-29 przez właściciela: pasy są w porządku._

## 2026-09-29 — kolumna „Wartość netto (razem etapy)" na dokumencie inwestora

- [ ] Kosztorys z wpisanymi etapami → „Udostępnij" → otwórz link inwestora: kolumna z wartością
      wykonanych prac nazywa się „Wartość netto (razem etapy)" — nigdzie w nagłówkach nie ma „po
      rabacie", także gdy kosztorys ma rabat.
- [ ] Ten sam kosztorys → „Generuj ofertę": nagłówek tej kolumny na wydruku brzmi tak samo, a jej
      kwoty zgadzają się z podglądem.
- [ ] Edytor, widok klienta → nagłówek i lista „Kolumny" pokazują „Wartość netto (razem etapy)";
      po przełączeniu na widok ekipy ta kolumna nadal nazywa się „Suma etapy <ekipa> netto".

## 2026-09-29 — akcja bez sieci kończy się toastem

Każdy boks tak samo: strona załadowana, potem DevTools → Network → „Offline", kliknij akcję, wróć do
„No throttling". Oczekiwane: toast „Brak połączenia z serwerem — sprawdź internet albo odśwież
stronę.", nic nie zostaje w stanie „w toku", a po odświeżeniu strony dane są takie jak przed
kliknięciem.

- [ ] Inwestycje → „Usuń inwestycję" → „Przenieś do kosza": toast, okno się zamyka, inwestycja
      zostaje na liście.
- [ ] Kosz → „Przywróć", a potem „Usuń na zawsze" (z wpisaną nazwą): toast, inwestycja zostaje
      w koszu, okno „Usuń na zawsze" da się zamknąć i otworzyć ponownie.
- [ ] Szablony → „Przenieś szablon do kosza", „Zmień nazwę szablonu" → zapis, i założenie nowego
      pustego szablonu: toast, lista i nazwa bez zmian.
- [ ] Katalog prac → usunięcie pozycji i „Policz użycia": toast, pozycja zostaje, „Policz użycia"
      znów da się kliknąć.
- [ ] Kosztorysy → „Odłącz od inwestycji", „Usuń kosztorys" i podpięcie arkusza do inwestycji:
      toast, powiązanie bez zmian.
- [ ] Kosztorys inwestycji → synchronizacja materiałów: sprawdzenie, zastosowanie i „Zresetuj
      wydatki inwestycyjne": toast, okno nie wisi.
- [ ] Edytor kosztorysu → dodanie etapu i usunięcie etapu: toast, kolumny etapów bez zmian.
- [ ] Edytor → „Wersje" → przywrócenie wersji: toast, przycisk przywracania znów aktywny, rozpiska
      bez zmian.
- [ ] Edytor → zapis pozycji do katalogu prac: toast, okno odblokowane.
- [ ] Edytor → udostępnianie (klient i ekipa): wydanie linku i „Wyłącz link": toast, stan linku bez
      zmian.
- [ ] Edytor → ustawienia widoku klienta (zapis i „Zapisz jako domyślne") i widoku ekipy: toast,
      okno nie wisi.
- [ ] Edytor → import z arkusza → wskazanie kolumny: toast.
- [ ] Transakcje → „Drukuj transakcje": toast, karta wydruku się zamyka zamiast wisieć na
      „Przygotowuję wydruk…"; „Pobierz faktury": toast.
- [ ] Nowa transakcja → zapisanie kasy jako domyślnej: toast, domyślna kasa bez zmian.
- [ ] Przełącznik aktywności na listach kas, użytkowników i zgłoszeń: toast, przełącznik wraca do
      poprzedniego położenia.
- [ ] Usunięcie pliku (faktura transakcji, plik inwestycji, plik w oknie zgłoszenia): toast, plik
      zostaje na liście.
- [ ] Po powrocie sieci ta sama akcja (np. „Przenieś do kosza") przechodzi normalnie — toast
      sukcesu, bez komunikatu o braku połączenia.

## EX-919 — worker-payout-remaining — „Pozostało do wypłaty" per pracownik i „Rozlicz wypłaty" (2026-09-29)

Dane: `pnpm seed:worker-payouts` na bazie testowej (inwestycje „Seed wypłaty A–D", pracownicy Jan
i Piotr Seedowy).

- [ ] `/pracownicy`: kolumny „Wypłaty" już nie ma; w jej miejscu „Pozostało do wypłaty". Każda
      kwota to osobna linia z liczbą inwestycji: „do zapłaty aktywne (n): …", „nadpłata aktywne (n):
      …" (czerwona) — dług i nadpłata nigdy nie są odejmowane od siebie. U Jana Seedowego domyślnie
      tylko linie z „Seed wypłaty A" i „B" (bez zakończonej „D"), u Piotra linia z „B" i dopisek
      „1 bez rozliczenia etapu". Pracownik bez niczego do pokazania ma zielone 0,00 zł.
- [ ] `/pracownicy` → „Filtry" (domyślnie „Filtry (2)"): sekcje „Pracownicy" (Aktywni / Nieaktywni)
      i „Pozostało do wypłaty" (Aktywne / Zakończone inwestycje, z opisem pod spodem) plus
      „Zaznacz / Odznacz wszystkie". Zaznaczenie „Zakończone inwestycje" dokłada u Jana szare linie
      „… zakończone (1)" z „D"; odznaczenie „Aktywne inwestycje" chowa aktywne linie. „Nieaktywni"
      pokazuje nieaktywnych pracowników. Po przeładowaniu strony wybór zostaje.
- [ ] Klik w kwotę u Jana otwiera „Rozlicz wypłaty — Jan Seedowy", a nie kartę pracownika. Wiersze
      „Seed wypłaty A/B/D" mają Wykonane / Wypłacone / Pozostało; „D" jest wyszarzona z „Inwestycja
      zakończona — przywróć na Aktywna, żeby wypłacić".
- [ ] Wypłać „A" dokładnie, a „B" o 100 zł więcej: przy „B" „Pozostało do rozliczenia" jest
      czerwone (−100,00 zł), a pod kwotą zdanie „… ponad wykonaną pracę — zapisze się jako zaliczka".
      Przy „A" to zielone 0,00 zł. „Razem" to suma obu kwot. Po „Wypłać"
      dialog się zamyka, kolumna się odświeża, a w transakcjach są dwie wypłaty; opis drugiej
      zawiera „w tym zaliczka 100,00 zł".
- [ ] `/inwestycje` → „Pozostało do wypłaty" przy „Seed wypłaty B": dialog pokazuje Jana, Piotra
      i szary wiersz „Nieprzypisane"; Pozostało wszystkich wierszy sumuje się do kwoty w komórce.
- [ ] `/inwestycje`: komórka „Pozostało do wypłaty" z długiem u ≥ 2 pracowników ma pod kwotą
      „N pracowników"; komórka równa 0 jest zielona. Cała komórka (kwota + dopisek) otwiera dialog.
- [ ] Dialog z `/pracownicy`: nazwa inwestycji w wierszu to link otwierający jej kosztorys w nowej
      karcie — dialog i wpisane kwoty zostają.
- [ ] Przy „Seed wypłaty C" komórka pokazuje „ustaw etapy" i nie da się jej kliknąć.
- [ ] Otwórz dialog w dwóch kartach, wypłać w drugiej, potem w pierwszej: pierwsza odmawia
      z ostrzeżeniem, przeładowuje kwoty i zostaje otwarta; nic nie zostaje zapisane.
- [ ] Dwie karty z tym samym dialogiem Jana, w obu zaznaczone „A", „Wypłać" kliknięte w obu niemal
      jednocześnie: w transakcjach jest dokładnie jedna wypłata za „A"; druga karta pokazuje
      ostrzeżenie „Kwoty zmieniły się…" i nowe kwoty.
- [ ] Otwórz dialog Jana, w drugiej karcie zmień ilość w etapie „Seed wypłaty A" w kosztorysie,
      wróć i kliknij „Wypłać": ostrzeżenie, a przeładowane „Pozostało" już uwzględnia zmianę;
      ponowne „Wypłać" przechodzi, nie odmawia drugi raz.
- [ ] Pracownik, który ma wyłącznie etapy bez rozliczenia (np. zdejmij Piotra z etapu w „Seed
      wypłaty B"): komórka pokazuje zielone 0,00 zł i „1 bez rozliczenia etapu". **Decyzja:** czy
      zielone 0 nie czyta się tu jak „rozliczony" — jeśli tak, zamiast niego wyszarzone „—".
- [ ] Dialog: „Razem" stoi w stopce pogrubione, a kwota wyrównana do prawej pod kolumną kwot.
- [ ] `/flota` i karta sprzętu: stopka „Razem" / „Koszty serwisu" wygląda i sumuje jak przedtem,
      a po ukryciu kolumny kosztów znika (wspólny wiersz sumy — bez zmiany zachowania).
- [ ] Zapamiętany stan przeżywa przeładowanie jak przedtem: zwinięty pasek boczny, zwinięta sekcja
      na stronie inwestycji, otwarty panel podsumowań w kosztorysie (wspólny zapis — bez zmiany
      zachowania, wcześniej zapisane ustawienia się nie resetują).
- [ ] Jako MANAGER: kolumna i dialog działają tak samo.
- [ ] (tylko produkcja) wypłaty pojawiają się w zakładce „transfery" arkusza właściciela.

## EX-933 — global-rabat-on-settlement-axis — rabat kwotowy w netto albo w brutto (2026-09-29)

- [ ] Inw. 112 (Szeligowska 57b/7, brutto, 8%) → Podsumowanie → ustawienia → Rabat „Kwotowy":
      wpisanie 5000 w pole „brutto" pokazuje 4629,63 w „netto" jeszcze przed zapisem. Po „Zapisz"
      kolumna brutto pokazuje Rabat −5000,00.
- [ ] Ta sama inwestycja: „Pozostało do zapłaty" brutto jest dokładnie o 5000,00 niższe niż przy
      rabacie „Wyłączony".
- [ ] Inwestycja netto (np. inw. 106): zapisana kwota stoi bez zmian w „netto" (2419,00), „brutto"
      pokazuje ją po stawce VAT inwestycji, Podsumowanie się nie zmienia.
- [ ] Ctrl+Z po zapisaniu kwoty przywraca w obu polach poprzednią kwotę.
- [ ] Zmiana stawki VAT przy zapisanej kwocie: „brutto" idzie za nową stawką, „netto" zostaje.
- [ ] Przełączenie „Wyłączony" → „Kwotowy": pola startują od sumy rabatów z pozycji.
- [ ] Inw. 112 → Historia zmian: wpis po zapisaniu 5000 brutto pokazuje w wierszu Rabat
      „… netto / 5 000,00 brutto".
- [ ] Kosztorys → widok podwykonawcy → kolumna „Cena": ceny wyliczone ze współczynnika pokazują się
      i edytują w groszach, a kopiowanie komórki daje tę samą kwotę co przed zmianą (refaktor
      formatowania — bez zmiany zachowania).


## EX-908 — redundant-router-refresh — nieaktualne dane po zapisie, staging (2026-09-29)

Po każdym zapisie aplikacja nie prosi już serwera o drugi render strony — nowe dane przychodzą
wyłącznie w odpowiedzi akcji. Lokalnie (build produkcyjny, baza 5435) przeszło 25 sprawdzeń —
dowody w `context/changes/2026-09-29-redundant-router-refresh/manual-checks.md`. Tu jest **każde**
zmienione miejsce jeszcze raz, na stagingu: prawdziwe opóźnienia sieci, cache Vercela i kilka
instancji funkcji to warunki, których lokalny build nie odtwarza. Test E2E dla A–H/K: EX-924.

**Każdy boks to trzy kroki, wszystkie muszą przejść:**

1. **Od razu:** po kliknięciu zmiana jest widoczna **bez przeładowania** (bez F5), w ciągu ~2 s.
2. **Po F5:** przeładowana strona pokazuje to samo — zapis doszedł do bazy.
3. **Gdzie indziej:** przejście linkiem w nawigacji (nie F5) na stronę wskazaną w boksie pokazuje
   już nową wartość — żadna inna strona nie trzyma starej kopii.

Logowanie: `pnpm qa:staging-user` (OWNER na preview DB), potem `context/reference/manual-verification.md`.
Staging musi mieć wdrożony commit z EX-908 (status Vercela `success` dla `origin/staging`).

### Formularze (wspólny zapis `use-form-submit` — wszystkie okna poniżej)

- [ ] „Nowy wydatek" (górna belka) na `/kasa/<id>`: wiersz i saldo kasy; gdzie indziej: `/kasy` —
      saldo tej kasy, `/inwestycje/<id>` — wydatek na liście inwestycji.
- [ ] „Nowa wpłata" (górna belka) na `/inwestycje/<id>`: wpłata i bilans inwestycji; gdzie indziej:
      `/inwestycje` — bilans w wierszu, `/kasa/<id>` — saldo kasy.
- [ ] „Transfer między kasami" (górna belka) na `/kasy`: oba salda; gdzie indziej: `/kasa/<id>` obu kas.
- [ ] „Edytuj transakcję" w tabeli transakcji — zmień kwotę: wiersz i saldo; gdzie indziej: `/kasy`.
- [ ] Nowa inwestycja na `/inwestycje`: wiersz na liście; gdzie indziej: wybór inwestycji w
      „Nowy wydatek".
- [ ] Edycja inwestycji (nazwa) na `/inwestycje/<id>`: nazwa w nagłówku i w górnej belce; gdzie
      indziej: `/inwestycje`.
- [ ] Nowa kasa na `/kasy` i edycja nazwy na `/kasa/<id>`: wiersz / nagłówek; gdzie indziej: wybór
      kasy w „Nowy wydatek".
- [ ] Nowy pracownik na `/pracownicy` i edycja na `/pracownicy/<id>`: wiersz / nagłówek; gdzie
      indziej: `/pracownicy`.
- [ ] Sprzęt: dodanie na `/sprzet`, edycja i „Przekaż sprzęt" na `/sprzet/<id>`: wiersz, dane i nowy
      posiadacz; gdzie indziej: `/sprzet`.
- [ ] Flota: dodanie pojazdu na `/flota`, edycja i „Nowy przegląd" na `/flota/<id>`: wiersz, dane,
      przegląd; gdzie indziej: `/flota`.
- [ ] Katalog prac: dodanie i edycja pozycji: wiersz; gdzie indziej: „Dodaj pracę z katalogu do
      sekcji…" w edytorze kosztorysu pokazuje nową/zmienioną pozycję.
- [ ] Lista odbiorców powiadomień (karta na `/sprzet`, `/flota` albo `/zgloszenia`) — zapisz zmianę:
      karta pokazuje nową listę; gdzie indziej: ta sama karta na drugiej z tych stron.
- [ ] `/zgloszenia` → „Nowa inwestycja ze zgłoszenia" → „Utwórz": zgłoszenie zmienia stan; gdzie
      indziej: nowa inwestycja na `/inwestycje`.
- [ ] „Zapisz jako domyślną kasę" w „Nowy wydatek": przycisk od razu przestaje proponować zapis;
      po zamknięciu i ponownym otwarciu okna ta kasa jest wybrana.

### Transakcje i kosz

- [ ] Anulowanie transakcji: wiersz oznaczony jako anulowany, saldo się cofa; gdzie indziej:
      `/kasy` i `/inwestycje/<id>`.
- [ ] Przeniesienie inwestycji do kosza z listy `/inwestycje`: znika z listy; gdzie indziej: jest na `/kosz`.
- [ ] „Przywróć" na `/kosz`: znika z kosza; gdzie indziej: wraca na `/inwestycje`.
- [ ] „Usuń na zawsze" na `/kosz`: wiersz znika; gdzie indziej: nie ma go ani na `/kosz` po
      przejściu z innej strony, ani na `/inwestycje`.

### Kosztorysy (arkusze)

- [ ] `/kosztorysy` → odłączenie arkusza od inwestycji: wiersz bez inwestycji; gdzie indziej:
      `/inwestycje/<id>` nie pokazuje już „Otwórz".
- [ ] `/kosztorysy` → usunięcie kosztorysu: wiersz znika.
- [ ] `/kosztorysy` → podpięcie arkusza do inwestycji: wiersz z nazwą inwestycji; gdzie indziej:
      `/inwestycje/<id>` pokazuje „Otwórz".
- [ ] „Nowy kosztorys" na `/kosztorysy`: nowy wiersz.
- [ ] „Dodaj kosztorys" na `/inwestycje/<id>`: pojawia się „Otwórz"; gdzie indziej: wiersz na `/kosztorysy`.

### Edytor kosztorysu

Po każdej zmianie sprawdź **sumy**: wartość wiersza, sumę sekcji, sumy etapów i panel
„Podsumowanie" — to one wcześniej odświeżały się osobnym zapytaniem ~0,7 s po edycji.

- [ ] Przedmiar, Cena j.m. i rabat w wierszu: wartość wiersza, suma sekcji i „Podsumowanie"; gdzie
      indziej: `/inwestycje/<id>` — robocizna z kosztorysu.
- [ ] Ilość w kolumnie etapu: suma etapu i „Pozostało"; trzy szybkie edycje pod rząd — końcowe sumy
      zgadzają się z tym, co pokazuje F5.
- [ ] Duży kosztorys (kilkaset pozycji): edycja komórki — sumy poprawne, strona nie przycina.
- [ ] „Cofnij" / „Ponów" po edycji: wartość i sumy wracają; po F5 to samo.
- [ ] „Sekcja z szablonu…": sekcja i sumy.
- [ ] „Dodaj pracę z katalogu do sekcji…": wiersz i sumy.
- [ ] „Porównaj z katalogiem" → „Dodaj do katalogu" → „Dodaj": pozycja znika z „Brak w katalogu";
      gdzie indziej: katalog prac pokazuje nową pozycję.
- [ ] „Zastąp całą rozpiskę zapisanym szablonem": cała rozpiska podmieniona, komunikat widoczny.
- [ ] „Wyczyść kosztorys": „Kosztorys jest pusty"; gdzie indziej: `/inwestycje/<id>` — robocizna 0.
- [ ] „Wersje" → przywrócenie wersji: rozpiska z tej wersji; zaraz potem edycja komórki zapisuje się.
- [ ] „Popraw literówki w opisie prac i j.m." — trzy razy pod rząd na wierszu z literówką: za każdym
      razem poprawiony tekst bez przeładowania.
- [ ] Dwie karty tego samego kosztorysu: w drugiej usuń pozycję, w pierwszej zmień jej Przedmiar —
      pierwsza pokazuje komunikat „Kosztorys zmienił się w innym miejscu…" i przeładowuje rozpiskę
      bez tej pozycji. Drugi wariant: w pierwszej karcie najpierw zmień Przedmiar **innej** pozycji,
      dopiero potem tej usuniętej — rozpiska też się przeładowuje, a komunikat nie wraca przy kolejnej edycji.
- [ ] „Wyczyść kosztorys" przy zerwanym połączeniu (DevTools → Network → Offline zaraz po kliknięciu,
      potem Online): komunikat o błędzie, a po powrocie sieci rozpiska zgodna z bazą.

### Poza stagingiem

- [ ] Lokalnie zapis do arkusza Google (np. przelew na inwestycji z podpiętym arkuszem) nadal jest
      odrzucany („Refusing to write…" w logu serwera) i nic nie trafia do Google.
