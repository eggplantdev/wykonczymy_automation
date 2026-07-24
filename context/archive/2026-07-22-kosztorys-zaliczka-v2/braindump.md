# Braindump — kosztorys zaliczka v2: materiały netto/brutto + tryb mieszany

Raw shaping notes captured before planning. Not current truth — verify against code/sheet before
trusting. Source: live design discussion with the owner (2026-07-22). Branch
`konradantonik/ex-536-zaliczka-v2`.

## The frame

Two sequenced pieces of work on the kosztorys **Podsumowanie** panel:

- **Slice A (start here):** materiały respect netto/brutto, with a visible formula explaining that
  for materiały VAT is **subtracted** to reach netto (the inverse of robocizna).
- **Slice B (after A):** a mixed-mode ("tryb mieszany") cash settlement view driven by a per-investment
  cash-amount input.

Both are **local-only to test** for now. A third, later slice makes the transaction/bilans model
VAT-aware — explicitly **out of scope** here.

## The load-bearing scope lock (owner, verbatim intent)

> Nie dotykamy modelu, póki co, w transakcjach i tego zliczenia bilansu. To się nie będzie zgadzać na
> razie i tak musi być. W transakcjach i bilansie apka nie rozróżnia pomiędzy materiałami z VAT
> a materiałami bez VAT-u. Dodamy to w następnej kolejności.

- Do **NOT** touch `src/lib/db/investment-financials.ts`, `calculate-balance.ts`,
  `calculate-margin.ts`, or the transactions model.
- The bilans **won't reconcile** with the kosztorys view for now. That is **accepted and intended**,
  not a bug to chase.
- Reason it can't reconcile yet: in transactions/bilans the app does not distinguish materiały
  **z VAT** from materiały **bez VAT**. That distinction is the next slice.

Earlier the owner rejected a scope-narrowing that would _distort the model to simplify the view_
("model ma odwzorować rzeczywistość, nie odwrotnie"). The resolution is **sequencing, not distortion**:
faithful-to-reality is the goal, delivered in stages. Invoices are **not always with VAT**
("faktury nie zawsze") — so a blanket netto=brutto/(1+VAT) on the whole materiały sum is wrong long
term; the per-transaction VAT flag is what fixes it, later.

## Domain facts

- **VAT applies only to prace (robocizna).** Materiały and wpłaty use `faceValue` (netto === brutto)
  in today's model. Documented in `context/reference/kosztorys-editor-domain-notes.md`
  ("VAT dotyczy wyłącznie prac"). `moneyPair(net, vat)` = {net, gross: net×(1+vat)};
  `faceValue(net)` = {net, gross: net}.
- **NEW fact (owner):** materiały transaction amounts are **brutto** (VAT already inside). So for
  materiały: `netto = brutto / (1+VAT)`, `brutto = kwota`. This **inverts** robocizna, where the stored
  figure is netto native and brutto = netto×(1+VAT). This is why the view needs an explicit formula —
  the direction of the VAT operation flips between the two cost kinds.

## Slice A — materiały netto/brutto in Podsumowanie

Two values held **per-investment, locally** (no persistence yet):

1. `C` — cash-settlement amount (only relevant to Slice B, but same local-state home).
2. flag — materiały settled **netto** or **brutto**.

Materiały figure in the view, driven by the flag:

- settled **brutto** → `netto = kwota / (1+VAT)`, `brutto = kwota` (VAT subtracted for netto)
- settled **netto** → `netto = kwota`, `brutto = kwota × (1+VAT)` (VAT added for brutto)

Show a formula/tooltip making the "co jest co" explicit — that here VAT is subtracted (materiały are
brutto), unlike robocizna above where it's added.

## Slice B — tryb mieszany (cash settlement)

Mixed view is **netto-only** — no side-by-side netto/brutto pairs, "Suma transzy" also netto-only.
Driven by the per-investment cash input `C`.

Rows:

```
Do zapłaty gotówką = C
Reszta (brutto)    = ((D − C) − Mn) × (1+VAT) + Mb
Razem              = C + Reszta
```

where `D` = całość do zapłaty netto, `Mn` = materiały netto, `Mb` = materiały brutto.

Open resolutions:

- cash cap: `C ≤ D − Mn` (proposed, owner to confirm).
- cash ordering: cash pays down robocizna first (implied by the formula).

## Later slice (explicitly deferred, "następna kolejność")

Make transactions + bilans VAT-aware for materiały:

- persist per-materiał-transaction whether settled netto or brutto (vat_plane already exists on the
  transactions column as the mechanism),
- include the VAT % in the materiały bilans,
- persist the per-investment cash-settlement amount for mixed investments.

Only after this does the kosztorys view reconcile with bilans.

## Anchors in code (verify before editing)

- `src/components/kosztorys/kosztorys-summary.tsx` — the Podsumowanie block (Robocizna / Materiały /
  Łącznie − Wpłaty → Do zapłaty; rabat now informational below Do zapłaty).
- `src/components/kosztorys/summary-totals-table.tsx` — lower grid (Wpłaty → Do zapłaty → rabat line).
- `src/components/kosztorys/kosztorys-totals-panel.tsx` — owns `moneyAxis` (Netto/Brutto/**Mieszana**
  ToggleGroup) and `doZaplaty` via `computeDoZaplatyRM`. **Has the owner's in-flight work — do not stage.**
- `src/lib/kosztorys/summary-economics.ts` — `moneyPair`, `faceValue`, `computeSummarySplit`,
  `computeDoZaplatyRM`. VAT-on-prace-only lives here.
- `materialyNet` flows from `financials.totalMaterialCosts` (a plain expense sum, VAT-unaware — the
  layer we are NOT touching).
