# Design discussion: VAT planes, bilans reconciliation, and the real-cash-flow constraint

> Status: **open / no decision yet** (2026-07-21). Captured mid-discussion with the owner-facing
> user. This doc records the problem framing and the alternatives on the table so the next session
> resumes without re-deriving. It does **not** pick a mechanic. Feeds back into `plan.md` once a
> direction is chosen.

## Why this doc exists

EX-536 started as „a wpłata carries netto/brutto". The conversation widened: the owner wants a
**bilans netto/brutto on the investment page** (`/inwestycje/[id]`), and — new this turn — wants
**materiał** in the kosztorys to be reducible by `÷(1+vat)` when the client settles **bez VAT**.
That turns EX-536's local question into a general one: **how does VAT-as-a-plane run through every
money figure, reconcile against the kosztorys, and never corrupt the real cash history?**

## The core problem (what this is actually about)

**VAT is not permanently a property of one plane.** Whether a given amount (materiał, wpłata,
robocizna) counts as netto or brutto depends on **how the client settles** — and that varies:

- per investment (one client rozlicza z VAT, another bez),
- possibly per **etap** (temp_notes: „WZÓR COEFF SIĘ MOŻE ZMIENIĆ W TRAKCIE … 1 ETAP TAK A 2 ETAP SIAK"),
- and **mixed within one investment** (temp_notes: „część faktura część gotówką" → część brutto, część netto).

The app must simultaneously:

1. **Show both planes** (netto and brutto) where the figure needs them.
2. **Reconcile with the kosztorys** — and _scream_ when the two disagree (owner: „they need to
   scream otherwise it is pointless").
3. **Never touch the real cash flow.** (owner-facing user: „to jest kombinowanie z rzeczywistym
   przepływem pieniędzy").

**The tension:** real cash is single-plane — 108 zł physically moved, that's the truth in the kasa
and the transaction history. Presentation/reconciliation is dual-plane. These must be **separated**:
cash = fact; plane = interpretation. The netto/brutto flag is **metadata on a real amount**, never a
rewrite of it. The derived axis (e.g. 100 from a real 108) is **poglądowe/przeliczone**, colour-coded,
and must never masquerade as cash.

## What is already settled (from the discussion)

- **Marża is independent of wpłaty.** Confirmed against code: `marża = robocizna − wypłaty − rabat −
strata − materiał-wliczony` (`calculate-margin.ts`). Wpłaty enter **bilans only**
  (`bilans = wpłaty − koszty + rabat`, `calculate-balance.ts`). So the netto/brutto choice on a
  wpłata **cannot move marża** — profit is driven by robocizna (the billed price), not by cash
  received. The VAT inside a brutto wpłata is money held but owed to the tax office; it was never
  profit, which is why it isn't in the marża formula.
- **Total owed = suma prac wykonanych (executed / Pomiar), never przedmiar/oferta.** The kosztorys
  footer „Do zapłaty" already uses executed.
- **Reconcile by scream, not merge.** Both computations coexist; the firewall stays. The kosztorys
  and app planes are kept separate on purpose (the parked P5 link).
- **Only robocizna can actually scream.** It has two independent sources: the kosztorys sheet
  (`laborCostsNetFromKosztorys`) vs Σ LABOR_COST transakcji (`laborCostsNetFromTransactions`). This
  scream already exists (the mismatch tooltip on the „Suma prac wykonanych" row). **Wpłaty and
  materiał each have a single source** (the deposit/expense transactions; the kosztorys reads the
  same rows) — so they can't disagree, so they can't scream. **The reconciliation the owner wants
  therefore already exists** — it's the robocizna scream, and the footer „Do zapłaty" _is_ the
  kosztorys-driven bilans.
- **Real cash flow is untouchable.** The register always moves the real `amount`. The flag never
  changes a grosz.

## The bilans question — Wariant A vs B (undecided)

The owner said „bilans brutto netto na stronie inwestycji". Two readings:

- **Wariant A — bilans = realna gotówka.** „Ile realnie wpłynęło" − „ile realnie zostało do
  zapłaty po cenie którą widzi klient". **Jedna płaszczyzna** — ta, w jakiej klient płaci tej
  inwestycji. Zero przeliczeń VAT na kasie. Najbliżej „nie kombinujemy z przepływem". Nie spełnia
  wprost „netto i brutto" chyba że rozumiemy je jako dwie osobne inwestycje/tryby.
- **Wariant B — bilans pokazany netto _i_ brutto.** Jeden realny przepływ, dwa obiektywy. Oś
  „realna" (ta w jakiej klient płacił) = prawdziwe kwoty; druga oś = **przeliczona, poglądowa,
  oznaczona kolorem**, tylko do zestawienia z kosztorysem na drugiej płaszczyźnie. Nigdy nie dotyka
  kasy ani historii. **To brzmi jak intencja właściciela** — ale ma sens tylko gdy druga oś jest
  jawnie „to jest wyliczone, nie wpłynęło".

**Open:** which one. B needs the derived axis unmistakably marked as przeliczone.

## The materiał extension (new this turn)

Currently the kosztorys carries a **fixed** materiał amount (face value, no VAT). The owner wants:
when the client settles **bez VAT**, materiał is shown **reduced by `÷(1+vat)`** (e.g. `/1.08`).
So materiał gains the **same netto/brutto plane** as wpłaty — it is not permanently face-value.

This is the tell that the problem is **general, not wpłata-specific**: robocizna, materiał, wpłaty
(and rabat, „od kwoty brutto" per temp_notes) all need a plane, and the plane can be per-investment
/ per-etap / mixed. Materiał is just the next figure to hit the same wall.

## The materiał rozjazd is inherent — and correct (key reframing)

Owner-facing user spotted: reducing materiał by `÷(1+vat)` for the netto view means the **transaction
shows a different amount than what was really paid for materials**. Firma kupiła materiał za 108
brutto (realna gotówka z kasy), a kosztorys pokazuje 100 (bez VAT). Rozjazd = 8.

**To nie jest błąd do wyeliminowania — to jest treść ekonomiczna.** Transakcja i kosztorys mierzą
**dwa różne pytania**:

- **Transakcja / kasa:** „ile firma **realnie wydała** na materiał" = 108 (brutto, tak jak kupiła).
- **Kosztorys:** „ile **klient płaci** za materiał" = 100 (netto, gdy rozlicza się bez VAT).

Różnica (8) = **VAT, którego firma nie przerzuca na klienta**. To dokładnie ten sam „LEKKI ROZJAZD",
który właściciel już zaakceptował dla wpłat (temp_notes: „A MY MAMY LEKKI ROZJAZD"). Próba zrównania
tych dwóch liczb byłaby błędem — trzeba by albo skłamać o realnym wydatku (zapisać 100 zamiast 108),
albo nie robić redukcji, której właściciel chce.

**Wniosek dla rekonsyliacji:** scream **nie polega na zrównaniu** transakcji z kosztorysem. Polega na
porównaniu ich **na tej samej płaszczyźnie** — sprowadź obie do netto (transakcja `108 ÷ 1,08 = 100`
vs kosztorys `100`) → powinny się zgadzać; jeśli nie → **realny błąd** (brakująca transakcja, zła
kwota). Flaga płaszczyzny istnieje właśnie po to, żeby móc sprowadzić obie strony do wspólnej osi.
Oczekiwany rozjazd VAT znika przy porównaniu na jednej płaszczyźnie; zostaje tylko rozjazd błędu.

To domyka zasadę: **transakcja = realna gotówka (jedna płaszczyzna, prawda), kosztorys = billing
klienta (netto/brutto per deal). Luka między nimi to VAT — znacząca, nie błędna. Rekonsyliacja
porównuje na wspólnej płaszczyźnie, więc łapie tylko błędy, nie oczekiwaną lukę VAT.**

## Robocizna may not be a 1:1 primitive — it may be a residual (open thread, 2026-07-21)

Owner-facing user, thinking out loud: the „robocizna" line that appears **in both places** (kosztorys
and transactions) is meant to be „ile teoretycznie, **po odliczeniu wszystkich kosztów**, klient
powinien zapłacić". And: „to nie będzie zawsze jeden do jeden materiały, rabat, robocizna" — the
components don't map 1:1 between the two planes, and „brakuje nam trochę danych".

**Two readings — must disambiguate before modelling:**

- **Reading 1 — robocizna as a residual.** Robocizna = client's net obligation for labour **after
  deducting all costs** (materiały, rabat, maybe more). Derived, not a stored input. Then it can't be
  reconciled as a raw „Σ LABOR_COST vs kosztorys value" — both sides must first net out costs, and
  those costs differ per plane.
- **Reading 2 — robocizna stays the billed labour price** (today's model: an input that feeds
  `marża = robocizna − wypłaty − rabat − strata`), and the user is describing the _reconciled net
  client obligation_ = robocizna − materiały-adjustments − rabat as a **separate derived figure**,
  not a redefinition of robocizna itself.

**Tension to flag (audit):** today robocizna is an **input** feeding marża. If robocizna becomes
„net after all costs" (Reading 1), it collides with the marża formula — marża's base would shift, and
„po odliczeniu kosztów klient płaci" starts to sound like marża (company residual), not a client
price. These are different quantities; conflating them corrupts both. **Needs the owner to pin which.**

**Missing data (`brakuje danych`):** unresolved — which costs are not currently captured that should
reduce this figure? (Real materiał cost per etap? Costs outside the transaction system? Per-etap VAT
coeff?) List them before committing to a residual model.

### RESOLVED (owner-facing user, 2026-07-21): Reading 2. Robocizna stays robocizna.

„czyli robocizna robocizna, ale kwota którą płaci klient wynika z większej ilości zmiennych, a
**bilans inwestora** tego póki co nie uwzględnia."

- **Robocizna is NOT redefined.** Zostaje ceną robocizny, wchodzi do marży jak dziś. Nie ruszamy.
- **The real gap is the bilans inwestora formula.** „Ile klient realnie płaci" jest funkcją
  **większej liczby zmiennych** niż dzisiejszy płaski wzór `wpłaty − (materiał + robocizna) + rabat`.
  Ten wzór traktuje wszystko jednopłaszczyznowo i nie zna:
  1. **płaszczyzny VAT** — czy klient rozlicza się netto czy brutto (per inwestycja? per etap?),
  2. **materiału netto/brutto** — `÷(1+vat)` gdy bez VAT,
  3. **rabatu od brutto** (temp_notes: „RABAT JEST OD KWOTY BRUTTO") — dziś bilans dodaje rabat płasko,
  4. **wpłaty netto/brutto** — na której osi liczyć wpłatę (to dostarcza flaga z EX-536),
  5. potencjalnie **per-etap coeff VAT** — inna płaszczyzna per etap.
- **Wniosek:** bilans inwestora musi urosnąć o te zmienne. To jest **osobny, większy kawałek**
  (płaszczyzna transakcji = sparkowane P5). **EX-536 dostarcza jedną z brakujących zmiennych**
  (flagę netto/brutto na wpłacie) — building block, nie całość.

## Alternatives on the table (for thinking — not decided)

1. **Flaga per transakcja** (EX-536 as-is, extended to materiał, maybe robocizna). Each row carries
   its own netto/brutto flag.
   - **+** Oddaje mieszane rozliczenie (część faktura część gotówka = dwie transakcje, różne flagi).
   - **−** Dużo flag; legacy rozjazd na każdym typie; każdy typ trzeba osobno ogarnąć.
2. **Płaszczyzna per inwestycja (lub per etap).** Inwestycja/etap ma ustawienie „klient rozlicza się
   netto/brutto"; wszystkie figury liczą się na tej płaszczyźnie, bez flagi per wiersz.
   - **+** Prosto, jedna decyzja, spójne w obrębie inwestycji/etapu.
   - **−** Nie oddaje mieszanego rozliczenia w jednej inwestycji; a temp_notes mówi że bywa mieszane
     i zmienne per etap.
3. **Hybryda: baza per inwestycja/etap + override per transakcja.** Domyślna płaszczyzna
   (VAT coeff) na poziomie inwestycji/etapu, z możliwością nadpisania na konkretnej transakcji.
   - **+** Pasuje do wzorca, który zespół **już zaakceptował w kosztorysie dla rabatu** („rabat na
     całość, ale zostaje per pozycja i można nadpisać" — global base + per-position override).
   - **−** Najwięcej ruchomych części; trzeba jasno pokazać co jest bazą a co override.

**Obserwacja:** wariant 3 to ten sam kształt co istniejący model rabatu (globalna baza +
override per pozycja). Spójność z czymś, co już działa i zostało zaakceptowane, jest argumentem.

## Does the wpłata flag earn its place? — YES (owner-facing user, 2026-07-21)

Question posed: does settlement ever go **mixed within one investment** (część fakturą / z VAT, część
gotówką / bez VAT)? **Answer: „tak bywa mieszane".**

- **Consequence:** the VAT plane cannot live on the investment/etap alone (Alt 2 insufficient) — it
  must sit **on each wpłata**. So the per-wpłata flag (Alt 1) or a hybrid (Alt 3) is required.
- **Reframe — the flag ≈ payment method (gotówka/faktura), owner's own equivalence:**
  „100% gotówką → netto · 100% fakturą → brutto · część/część → mieszane" (temp_notes). So the flag
  is not abstract „netto/brutto" — it records **whether VAT was in that payment**, which is exactly
  **cash vs invoice**. The derived opposite axis (e.g. a cash/netto 100 shown as „108 brutto") is
  **poglądowe** — the client never owed that VAT on a netto deal.
- **Modeling candidate:** encode as **payment method (`gotówka`/`faktura`)** and **derive** the VAT
  plane from it, rather than a bare `amountIsGross` boolean. More truthful, concrete, and the
  `paymentMethod` field already exists on the transaction (today hardcoded `CASH`, only CASH enabled
  in `PAYMENT_METHODS`). Also naturally explains routing (cash → kasa; faktura → inny tor).
  - **CAVEAT RESOLVED — the equivalence is FALSE (owner-facing user, 2026-07-21):** „nie zawsze
    gotówka będzie bez faktury". Cash can carry a faktura VAT (brutto), cash can be bez faktury
    (netto). So **payment method (gotówka/przelew) and VAT plane (netto/brutto) are ORTHOGONAL** — the
    plane is **not** derivable from how the money moved. The paymentMethod reframe is rejected.
- **DECISION for `plan.md`:** keep an **explicit netto/brutto plane flag on the wpłata**, independent
  of paymentMethod — i.e. the original `amountIsGross` boolean stands. The owner chooses netto/brutto
  **directly** per wpłata („wybieramy netto brutto, muszą być takie albo takie"); we do not derive it
  from payment method or invoice presence. Two independent axes: _how paid_ vs _which VAT plane_.
  - **Sub-question still open:** does the flag record the plane **directly** (owner picks
    netto/brutto), or „**czy faktura VAT**" (invoice presence, plane derived)? Both are one boolean;
    direct-choice avoids inventing a second derivation that could also break. Lean: **direct
    netto/brutto**, per owner's literal framing.

## Domain facts (owner-facing user, confirmed)

- **Gotówka może być z VAT-em albo bez.** Płatność gotówką nie przesądza płaszczyzny — bywa
  z fakturą VAT (brutto) i bez faktury (netto). Dlatego metoda płatności (gotówka/przelew) i
  płaszczyzna VAT (netto/brutto) to **dwie niezależne osie**; płaszczyzny nie wolno wyprowadzać
  z metody płatności.

## Partial VAT on the obligation — „VAT tylko do części" (owner-facing user, 2026-07-21)

New realization this turn. Dotąd flaga dotyczyła strony **wpłat** (co wpłynęło). Ale jeśli
rozliczenie bywa mieszane, to **strona zobowiązania** (ile klient jest winien wg kosztorysu) też
jest mieszana — **VAT nalicza się tylko do części** wykonanej roboty, nie do całości.

**Konsekwencja: brutto kosztorysu przestaje być `suma × (1+vat)`.** Przykład — robocizna wykonana
`1000 netto`, klient: `600` fakturą (z VAT) + `400` gotówką bez VAT:

```
Brutto do zapłaty = 600 × 1,08 + 400 × 1,00 = 648 + 400 = 1048   (NIE 1080)
```

VAT dotyka tylko części z fakturą. Jedna globalna oś „brutto = całość ×1,08" jest wtedy fikcją;
prawdziwa kwota to blend. To ta sama ściana co materiał `÷(1+vat)` — **VAT to płaszczyzna nakładana
na podzbiór, nie globalny przełącznik na kosztorysie.**

**Granularność „części" — OPEN (nowa decyzja):** czym jest „część", do której nalicza się VAT?

- per **etap** (niektóre etapy z VAT, inne bez — pasuje do temp_notes „1 ETAP TAK A 2 ETAP SIAK"),
- procentowy split całości (np. 60% z VAT),
- per **pozycja** kosztorysu.

**Boundary:** to jest **osobny, większy slice** — przebudowa wzoru bilansu inwestora (dostarcza
zmienne #1 płaszczyzna VAT i #5 per-etap coeff z listy „Robocizna → Reading 2"). **NIE wchodzi do
EX-536.** EX-536 zostaje wąskie: flaga netto/brutto na wpłacie + rozdzielone wpłaty w Podsumowaniu.
Częściowy VAT na zobowiązaniu ląduje w slice bilansu inwestora.

## Direction shift (2026-07-21, cont.) — payment-method first, then a bucket model

Live discussion moved past the original „×1,08 on the wpłata" mechanic. Nothing decided; recording so
the thread survives.

### Step 1 (certain, independent): restore `paymentMethod` to the forms

- The field already exists and is fully wired (`transfers.ts:115`, DB `payment_method`, types, queries,
  filters, mapping, schemas, export, actions; app-table column at `transfers.tsx:158`). **The forms
  hardcode `'CASH'`** (`deposit-form.tsx:69`, `expense-form`, `internal-transfer-form`) so every row is
  silently gotówka. Work = stop hardcoding, expose the picker, ensure the column is visible.
- **Trim to two options: gotówka (CASH) + przelew (TRANSFER).** Drop BLIK + Karta. Caveat: check
  existing rows for BLIK/CARD before removing from the enum.
- **Orthogonal to VAT** (gotówka może być z VAT lub bez) — this is its own small change, NOT the plane
  flag. Do it first.

### The przeliczanie objection (owner-facing user) — and the bucket answer

- **Objection:** converting an already-paid wpłata ±VAT changes nothing — the real cash moved; ±VAT on
  it is cosmetic. What actually matters is **„ile POWINIEN zapłacić z VAT a ile bez"** — the
  _obligation_, not the payment. That's a pure kosztorys function (robocizna, robocizna×(1+vat)); no
  flag on any transaction needed for it.
- **Bucket model (new candidate, replaces the ×1,08 mechanic):** the netto/brutto flag on a wpłata is
  **NOT a multiplier — it is a classifier**. The real amount drops into one of two **buckets** per
  investment in the kosztorys: `bucket netto` / `bucket brutto`. No conversion anywhere; two real sums.
  This is what makes the flag earn its place — as bucketing, not calculation. **This reopens
  change.md's „DECIDED" mechanic** (flag=netto → brutto=amount×1,08) — that conversion is dropped in
  this model.
- **„Policz bez VAT" split = the buckets' targets.** Owner types a bez-VAT amount (e.g. 6000);
  `cel netto = 6000`, `cel brutto = (całość − 6000) × (1+vat)`. Then `zostało` per bucket = cel − Σ
  wpłat w tym kubełku. Real amounts throughout; nothing multiplies on the payment side.
  ```
  Całość netto 10000; Policz bez VAT 6000 → cel netto 6000, cel brutto (4000×1,08)=4320
  bucket netto:  6000 − Σ wpłat[netto]  5000 = 1000
  bucket brutto: 4320 − Σ wpłat[brutto] 2000 = 2320
  ```

### Buckets as the DEFAULT for the split — open tension

Candidate: the split field **defaults** from the buckets — `bez VAT ≈ Σ wpłat[netto]`, `z VAT ≈ Σ
wpłat[brutto]` (owner-facing user's „zaliczki − wpłaty z vat", read as all deposits minus the netto
ones). **Tension:** this couples _ile powinien_ (obligation) to _ile wpłacił_ (cash fact) — early on
(little paid) the default under-states the bez-VAT part, and the unpaid remainder's plane is
undetermined (gross it ×1,08 or not?). Two readings to disambiguate:

- **A.** default is only UX pre-fill; the obligation split stays an independent owner decision.
- **B.** the split _emerges_ from payments (no separate decision); unpaid remainder has no plane yet.
  Confirm the two default formulas.

**RESOLVED (owner-facing user): the bucket tag lives at the transaction level** — owner sets
netto/brutto per wpłata at creation. So **EX-536's storage survives** (nullable boolean on
INVESTOR_DEPOSIT, create-only, set in the form); only the downstream math changes (classify into
bucket, sum — no ×1,08 conversion). The split netto/brutto therefore **accretes from the tagged
wpłaty**.

**DECIDED (owner-facing user, 2026-07-21): B.** The netto/brutto-tagged wpłaty drive the split; no
separate „Policz bez VAT" obligation-target field for now. „If it's needed we will add it" → A is a
later increment. **Consequence to keep in view:** B ships the _payment-side_ breakdown („ile wpłacił
netto / brutto"); the owner's „ile POWINIEN z/bez VAT" (obligation side) is **deferred to A**. Unpaid
remainder of the obligation carries no plane under B — accepted.

## CONFIRMED calc model (owner-facing user, 2026-07-21) — „dokładnie"

Locked by the owner-facing user's own worked example. **Supersedes** both change.md's „flag=netto →
brutto=amount×(1+vat)" mechanic AND the earlier „two parallel lenses" table (which double-counted the
obligation). The real model is **sequential, single base, zero conversion of any wpłata**:

```
base_netto = robocizna wykonana                       (e.g. 2000)
base_left  = base_netto − Σ(wpłaty[netto])             only a FLAGGED netto wpłata eats the NET base at face value
Do zapłaty netto  = base_left − Σ(wpłaty[legacy])      remainder before VAT, minus legacy at face
Do zapłaty brutto = base_left × (1+vat) − Σ(wpłaty[brutto]) − Σ(wpłaty[legacy])
                                                       gross the remainder; brutto wpłata AND legacy
                                                       both eat THAT at face value
```

Worked (owner's numbers): base 2000, wpłata 1000 netto → base_left 1000 → Do zapłaty netto 1000,
Do zapłaty brutto 1000×1,08 = 1080. A later 1080 brutto wpłata → 1080 − 1080 = 0.

**Legacy at face on BOTH axes (owner correction, 2026-07-21 — corrected TWICE):** a wpłata **without** a
plane (`null`) still reduces the debt, but it is **NOT** in `base_left` and is **never grossed**. Legacy is
old data; it must render **identically to the pre-change code** (`toGross(R) − wpłaty`), so it subtracts at
**face on both axes**. The first correction dropped „legacy excluded"; the second dropped „fold legacy into
the net base" — that framing grossed legacy on the brutto axis and changed the number. Legacy-only
investment: base 2000, legacy 1000 → netto 1000, brutto 2000×1,08 − 1000 = **1160** — both axes match the
old code exactly. Only the **flagged** netto/brutto buckets drive the sequential model; the flag routes a
wpłata into a bucket, it never decides _whether_ a wpłata counts.

**Rule in one line:** _netto wpłata zjada bazę przed VAT-em; brutto wpłata zjada resztę już z VAT-em;
VAT dolatuje tylko do reszty zobowiązania, nigdy do wpłaty._

**Known consequence (accepted under B):** in a mixed settlement, `Do zapłaty netto` **ignores** brutto
wpłaty (counting them would require converting 540→500 = the rejected conversion), so it **overstates**
the true net remainder. Example: base 2000, 500 netto + 540 brutto paid → Do zapłaty netto shows 1500
(not 1000). The brutto figure (Do zapłaty brutto = 1500×1,08 − 540 = 1080) is the actionable one.
Accepted tradeoff of B; the two figures are a net/gross pair of the _same_ remainder, cleanest when
settlement is single-plane.

## Non-negotiable constraints (any alternative must satisfy)

- Transakcja przechowuje **realną kwotę + (opcjonalnie) flagę płaszczyzny**, nigdy przeliczonej
  wartości. Brutto/netto liczone w warstwie kalkulacji (arkusz / `lib`).
- Kasa/historia rusza się o **realną kwotę**, zawsze.
- Oś przeliczona jest **oznaczona kolorem** jako poglądowa; nie udaje gotówki.
- Rekonsyliacja z kosztorysem **krzyczy** przy rozjeździe (dziś: na robociźnie).
- Stare wiersze bez flagi = **legacy: `null` plane, bez backfillu** — ale **nadal zbijają Do zapłaty**,
  **w wartości face na OBU osiach** (NIE w `base_left`, nigdy grossowane), identycznie jak stary kod
  (owner correction 2026-07-21, poprawione dwukrotnie; patrz „Legacy at face on BOTH axes" wyżej).
  Pokazane jako osobna linia amber „bez oznaczenia VAT", która i tak odejmuje.

## What EX-536 can safely ship now vs. what's a bigger slice

- **EX-536 (this change):** wpłata netto/brutto flag (`vatPlane`, classifier not converter — **no
  `toNet`**), drop stage link, differentiated wpłaty in Podsumowanie footer, picker trimmed to investor
  wpłaty. This **unblocks** the wider plane model without committing to it.
- **Bigger, separate slice(s):** bilans netto/brutto on the investment page (touches the transfers
  plane = the parked P5 coupling), materiał netto/brutto, and any per-investment/per-etap plane
  setting. Direction to be chosen from the alternatives above.

## Open decisions (carry forward)

1. Bilans meaning — **Wariant A** (real cash, one plane) vs **Wariant B** (two lenses, derived axis
   marked). Owner leans B.
2. Plane granularity — **per transakcja** (alt 1) / **per inwestycja/etap** (alt 2) / **hybryda**
   (alt 3).
3. Materiał netto — confirm the `÷(1+vat)` reduction is the intended formula and where it applies
   (whole materiał vs per pozycja).
4. Does **robocizna** (LABOR_COST) also need a plane flag, or is it always entered on one plane?
   (Blocks any transaction-sourced bilans-brutto.)
5. **Partial VAT on the obligation** — what is the „część" VAT applies to (per etap / % split / per
   pozycja)? Makes kosztorys brutto a blend, not `suma × (1+vat)`. Bilans-inwestora slice, not EX-536.
