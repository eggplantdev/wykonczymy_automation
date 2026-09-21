# Manual verification

One living checklist for every slice — the project's QA registry. Each `##` section is a slice/change; tick boxes by hand (or point an agent at a section: "drive these checks with Playwright and report" — the `verify-manual-checks` skill) as you verify. Lives in `context/foundation/` (not the change folder) so it survives `/10x-archive` and never freezes stale. A slice with unticked boxes here is **not** `Done` — manual checks are a hard blocker (see `/10x-implement`). Not gated by CI.

**Run against the isolated test DB, not the dev DB.** Manual checks mutate data, so point the app at the `db-test` container on **5435** (`DB_POSTGRES_URL_TEST`, `wykonczymy-test`) — the same DB the E2E suite uses — never the dev DB (5433, holds un-dumped local work) and never prod. Kosztorysy **są** w dumpie proda — `pnpm db:import:test` daje 65 kosztorysów / 4130 pozycji (policzone 2026-09-17), więc baza testowa nie jest pusta dla przepływów kosztorysowych. Seeduj tylko wtedy, gdy sprawdzenie potrzebuje **znanego** kształtu: `seed-kosztorys.ts` dla realistycznej rozpiski (czyta żywy arkusz wzorcowy) albo `perf-seed-kosztorys.ts` dla ~1000 syntetycznych wierszy, gdy sprawdzasz wydajność siatki — z DB env seeda wskazanym na `DB_POSTGRES_URL_TEST`.

**Ten plik został przycięty 2026-09-15** — agent czyta go przy każdym przebiegu, a 5,5 tys. linii to
w 90% dowody weryfikacyjne zamkniętych slice'ów, nie instrukcje. Zostają **wyłącznie sekcje z
nieodhaczonymi boksami** plus indeks zamkniętych przebiegów na końcu.

- **Pełny zapis, verbatim:** `context/archive/manual-checks/2026-09-15-pelny-rejestr.md` — 94 sekcje,
  71 bloków `### Findings`, komplet dowodów. Agenci nie czytają `context/archive/`, więc sięga się
  tam świadomie, gdy trzeba odtworzyć, **jak** coś zweryfikowano.
- **Trwała wiedza z tych przebiegów** została wydestylowana do żywych dokumentów: reguły inżynierskie
  do `context/foundation/lessons.md`, realia środowiska QA (blokady, konta, techniki obejścia) do
  `context/reference/preview-verification-accounts.md`.
- Dopisując nową sekcję, pisz **check**, nie sprawozdanie. Dowód („zweryfikowane na inw. 135, SQL
  pokazał…") jest wart tyle, ile długo boks jest otwarty — po odhaczeniu zostaje sam boks.

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
   Obejście do połowy licznikowej opisuje `context/reference/preview-verification-accounts.md`.
4. **Brak dostępu do skrzynki odbiorczej** — osobno od (2): nawet z produkcyjnym mailem treść
   trzeba obejrzeć okiem.

# Otwarte

## EX-594 — investment-summary-panel

26/27 odhaczone (ostatni przebieg 2026-09-03, staging). Pełny zapis: archiwum.

- [ ] `/raporty` renderuje kafle dokładnie jak przedtem, z odznaczaniem włącznie — **blokada 1**
      (trasa wygaszona do EX-598). Do przejechania dopiero, gdy EX-598 przywróci `/raporty`.

## EX-596 — materials-net-pricing-persisted

15/16 odhaczone (ostatni przebieg 2026-09-04, staging). Pełny zapis: archiwum.

- [ ] `/raporty` pokazuje baner ostrzegawczy nad liczbami bez przewijania — **blokada 1**. Na trasie
      nie ma żadnych liczb, nad którymi baner miałby stanąć. Nie jest blokerem dla samego EX-596:
      bramka jest świadoma i starsza niż ten boks.

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
- [ ] **Otwarty defekt: warunek flagi „nasycony formularz" jest zły.** `rawLeads.length >= PER_FORM_LIMIT`
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

## clean-texts-catalogue-names — nazwy prac z tabeli poprawek katalogu (2026-09-15)

Warsztat szablonu 4 (`/szablony/4`) jest fixturem: przed zmianą okno „Porównaj z katalogiem prac"
zgłaszało tam 30 prac spoza katalogu.

- [x] `/szablony/4` → „Porównaj z katalogiem prac" pokazuje **6** prac spoza katalogu zamiast 30,
      **bez klikania „Popraw literówki"** — zmierzone na dzisiejszym fixturze **30 → 5** (nie 6;
      patrz finding o dryfie). Ten sam skrypt na `86b40010` (commit przed zmianą) i na `f5f823d1`,
      ta sama kopia bazy, te same 202 pozycje: przed 30 spoza katalogu, po 5. Obietnica zmiany
      trzyma się co do joty, przesunęła się tylko liczba docelowa.
- [ ] Ta szóstka to 5 wariantów, które właściciel doprecyzował w katalogu („Klejenie paneli
      winylowych" — mijanka / jodełka / układ prosty), plus „Dwukrotne gruntowanie ścian, sufitów
      i podłóg"
- [ ] Przycisk „Popraw literówki" zmienia opisy 24 prac; drugie kliknięcie pod rząd raportuje
      0 poprawionych
- [x] Żaden opis w rozpisce nie dostaje „[stary arkusz]"
- [ ] J.m. po kliknięciu jest taka sama jak przed, poza `klp` → `kpl`
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
- [ ] **`/szablony/4` katalog-comparison count and content have drifted from checks 1–2** — with
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
- [ ] **„Popraw literówki" change count and the „only `klp`→`kpl`" claim have also drifted, but the
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
- [x] **`m2` → `m²` w j.m. nie pochodzi z tej zmiany** — check 5 mówi „poza `klp` → `kpl`", a na
      dzisiejszym fixturze przycisk przepisuje 65 j.m., prawie wyłącznie `m2` → `m²`. To reguła
      z `src/lib/kosztorys/clean-unit.ts`, która weszła commitem `bfb1b337` („Popraw literówki"
      czyści też j.m.) — ten slice nie tknął tego pliku (`git log staging --not 86b40010 --
src/lib/kosztorys/clean-unit.ts` → 0 commitów), a tabela poprawek nazw z założenia nie rusza
      j.m. Czyli nie regresja, tylko stare zachowanie przycisku na nowszych danych; check 5 był
      pisany pod fixture, w którym brudna była jedna jednostka.

- [ ] **Stale JWT session survives a `db:import:test` user reseed with a broken, unreadable error**
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
- [ ] **"Typ wydatku inwestycyjnego" filter-option label clips in the "Typ" popover on `/` — likely
      pre-existing.** Minor, cosmetic; noted for completeness per the "never skip a problem because
      out of scope" rule, not chased further this pass since it's a label-length/wrap issue unrelated
      to the files EX-787 touched.
      **Needs human:** low priority — confirm whether it reproduced before `b744a3b1` (not done this
      pass) and decide if it's worth fixing now or filing.
      **Test disposition:** no automated test — cosmetic label wrap, not a behavior defect.

# Zamknięte — indeks

Jedna linia na slice, **wszystkie 94** — liczby są policzone z pełnego rejestru sprzed przycięcia.
`boksy` = odhaczone/wszystkie; wiersz, w którym te liczby się różnią, ma swoją sekcję wyżej
w „Otwarte" (tam boksy bywają scalone, więc liczba nieodhaczonych może się różnić od reszty z tej
kolumny — to ten sam fakt zapisany raz zamiast dwa). `0/0` to sekcja czysto prozatorska, bez boksów.
`ostatnia weryfikacja` to najpóźniejsza data w sekcji; `—` znaczy, że sekcja żadnej nie nosiła.
Pełne dowody, verbatim: `context/archive/manual-checks/2026-09-15-pelny-rejestr.md`.

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
| kosztorys-client-view-offer-settlement-variants — warianty „Oferta / Rozliczenie"                                        | 6/6   | 2026-09-15           |
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

## EX-802 — lead-delivery (wykonczymy half, 2026-09-21)

Sprawdzenia na bazie testowej (5435). Webhook wymaga `LANDING_WEBHOOK_SECRET` i
`LANDING_BLOB_HOST` w `.env`; kontrakt koperty: `context/reference/landing-intake-contract.md`.

- [ ] `/admin` → Media: kolumna „Rodzaj" jest widoczna i filtruje listę
- [ ] Skasowanie faktury podpiętej pod transakcję jest odrzucone czytelnym polskim komunikatem
- [ ] Inwestycja pokazuje podpięte pliki w `/admin` po akcji dodania
- [ ] Dodanie trzech zdjęć + PDF z karty inwestycji — pojawiają się bez przeładowania
- [ ] Dodanie zdjęcia przy tworzeniu nowej inwestycji — leży na jej karcie
- [ ] Pasek miniatur nie przewija się w poziomie przy 375px
- [ ] Zdjęcie HEIC z iPhone'a konwertuje się i wgrywa
- [ ] W `/admin` zgłoszenie z Facebooka nie pokazuje trzech pól landingowych, zgłoszenie z landingu pokazuje
- [ ] Podpisany POST JSON z `curl`, wskazujący realny URL bloba, tworzy zgłoszenie razem z plikami
- [ ] Ten sam request powtórzony nie tworzy niczego i nie wysyła maila
- [ ] Request z `assets[].url` spoza hosta z allowlisty jest odrzucony i alertuje
- [ ] Request z podmienionym body jest odrzucony (403)
- [ ] Promocja zgłoszenia z landingu od początku do końca — karta nowej inwestycji pokazuje zdjęcia klienta
- [ ] Zgłoszenie po promocji jest „Skontaktowano" i podaje link do inwestycji zamiast przycisku
- [ ] Odznaka nieprzeczytanych zgłoszeń w nawigacji spada o jeden

## EX-802 — investment-assets-dialog (galeria bez miniatur, 2026-09-21)

Zastępuje sprawdzenie „Pasek miniatur nie przewija się w poziomie przy 375px" z sekcji
lead-delivery — na karcie inwestycji nie ma już paska miniatur (został tylko u leada).

- [ ] Inwestycja bez plików nie pokazuje w sekcji żadnego przycisku — dodać można tylko z „Edytuj inwestycję"
- [ ] Przycisk „Zdjęcia i pliki (N)" ma szerokość swojej treści, nie całej kolumny
- [ ] Podgląd przy N ≥ 1 ma „Dodaj kolejne", które dokłada plik bez wychodzenia z karty
- [ ] Po dodaniu pliku licznik „Zdjęcia i pliki (N)" rośnie bez przeładowania strony
- [ ] Podgląd otwiera plik, „Pobierz" zapisuje go pod właściwą nazwą, „Drukuj" otwiera podgląd wydruku
- [ ] Przy 2+ plikach „Pobierz wszystkie" daje zip o nazwie zaczynającej się od `pliki-`, nie `faktury-`
- [ ] Stopka podglądu przy 2+ plikach mówi „Usuń ten plik" + „Usuń wszystkie"; przy jednym pliku samo
      „Usuń", bez „Usuń wszystkie" — nigdzie nie pada słowo „faktura"
- [ ] „Usuń" pyta o potwierdzenie i po potwierdzeniu plik znika z podglądu
- [ ] W obu dialogach („Nowa inwestycja" i „Edytuj inwestycję") „Status" i „Zdjęcia i pliki" stoją
      w jednym wierszu, a przy zwężonym oknie wracają jedno pod drugie
- [ ] „Edytuj inwestycję" → „Dodaj zdjęcia lub pliki" → wybór pliku dodaje go natychmiast (toast), dialog w dialogu działa
- [ ] Zamknięcie formularza edycji przez „Anuluj" nie usuwa dodanego pliku
- [ ] Formularz „Nowa inwestycja" dalej zbiera pliki po staremu i zapisuje je razem z inwestycją
- [ ] Podgląd i dodawanie faktury w tabeli transferów działa jak przed zmianą (tytuły, pager)

## katalog-problems — rozjazdy z katalogiem prac jako problemy edytora (2026-09-21)

Na inwestycji z niepustą rozpiską (np. po `INV=6 … seed-kosztorys.ts`), edytor `kosztorys_v2`.

- [ ] Wejście na edytor bez otwierania żadnego okna: „Problemy" pokazują „Inne liczby niż w katalogu prac (N)" i „Brak w katalogu prac (M)"
- [ ] Zmiana ceny j.m. na zgodną z katalogiem zmniejsza licznik „Inne liczby…" natychmiast, bez zapisu i bez przeładowania
- [ ] Liczby w oknie „Porównaj z katalogiem prac" i w menu „Problemy" są identyczne, także po niezapisanych zmianach
- [ ] Okno otwiera się od razu z liczbami — nie pokazuje „Porównuję z katalogiem…"
- [ ] „Pokaż w rozpisce" w obu blokach zamyka okno i zawęża siatkę do właściwego zbioru pozycji
- [ ] Zawężenie na „Inne liczby…" odsłania kolumny cenowe, nawet jeśli były odznaczone w wyborze kolumn
- [ ] „Dodaj do katalogu" na pracy spoza cennika zmniejsza licznik „Brak w katalogu" bez utraty niezapisanych wierszy
- [ ] Podgląd szablonu / tryb tylko-do-odczytu: raport widoczny, brak „Dodaj do katalogu", „Edytuj w katalogu" i „Pokaż w rozpisce"
