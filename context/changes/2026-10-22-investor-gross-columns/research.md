---
date: 2026-10-22T12:57:21+02:00
researcher: Claude (Opus 5.5)
git_commit: f3d410d73ef282f112c1fdeadc451372f13e9b62
branch: staging
repository: wykonczymy
topic: "Brutto columns on the investor's document — opt-in, default off"
tags: [research, kosztorys, client-view, disclosure, print, brutto]
status: complete
last_updated: 2026-10-22
last_updated_by: Claude (Opus 5.5)
last_updated_note: 'Owner answered the open questions — PDF out of scope, price paired, mirror twins, no per-mode default'
---

# Research: Brutto columns on the investor's document — opt-in, default off

## Research Question

„Ustawienia podglądu inwestora" offers no brutto column at all. That was a deliberate choice, but an
investor settled brutto is confused by a netto-only document. How do we make brutto showable without
it being always visible in the settings — a collapsible, or better the netto/brutto pair-checkbox
(„Kwoty: Netto / Brutto") the editor's „Kolumny" menu already has, where both families can be
switched off and brutto is off by default?

## Summary

- **The removal was an owner ruling, not a gap.** Commit `7a986a1b6` (2026-09-28, EX-884) „drop every
  brutto column from the investor's document" — „The offer is quoted netto". Recorded in
  `context/reference/kosztorys-editor-domain-notes.md:387`. Before it, EX-631 (2026-08-12) had netto and
  brutto side by side. Reopening it means rewriting that ruling, not just code.
- **Brutto is cheap to bring back.** Gross is a separate set of column keys, the value resolver
  already computes every one of them, labels exist, totals exist. The grid surfaces (preview +
  share link) render them the moment the keys enter `PREVIEW_VISIBLE_COLUMNS`. Only the PDF needs new
  code (its gross entries were deleted in `7a986a1b6`), plus the empty-settlement list and tests.
- **No migration.** Since EX-1033 a key missing from a stored `{key: hidden}` map reads as its code
  default; gross keys outside `DEFAULT_VISIBLE_COLUMNS` start hidden on every existing investment and
  on the firm-wide default.
- **The confusion has a concrete source:** on a `GROSS` investment the summary's overview tab already
  shows the investor brutto totals (`settlementModeToMoneyAxis`, `settlement-mode.ts:32-40`), while
  every grid column is netto.
- **Recommended UI:** reuse the pair-axis shape (`derivePairChecks` / `togglePairAxis`,
  `lib/kosztorys/axis-checkboxes.ts`) as a „Kwoty: ☑ Netto ☐ Brutto" section at the top of the dialog,
  as a **bulk control over the existing hidden map** — no new stored field. The per-column brutto
  checkboxes render only while „Brutto" is on. Details and the alternative below.

## Detailed Findings

### 1. The ruling and what it removed

- `7a986a1b6` removed from `CLIENT_VIEW_GROUPS` and `CLIENT_DOCUMENT_COLUMNS`: `priceGross`,
  `discountAmountGross`, `plannedGross`, `gross`, `remainingGross`, the per-etap
  `stageValueGross_<id>` group; deleted their print entries (`offer-print/columns.ts`, now
  `print/offer-columns.ts`) and settlement-column ids. 5 files, 80 deletions — a partial revert is a
  good starting point, but file paths moved since (`client-view-settings.ts` →
  `client-view/settings.ts`, `offer-print/` → `print/`).
- `942e3cfe4` (review gate, EX-884/890/891) added the guard spec „carries no brutto column"
  (`src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts:55-69`).
- Domain notes `:390-395`: the editor's money axis is a per-browser reading preference and must never
  decide what the investor sees — only the allowlist + the stored client-view settings do. Any
  design here must keep the decision in the stored settings, not in `useMoneyAxis`.

### 2. How brutto exists today

| Netto                   | Brutto                       | Label (`COLUMN_LABELS`, `column-config.ts:29-48`) |
| ----------------------- | ---------------------------- | ------------------------------------------------- |
| `price`                 | `priceGross`                 | „Cena j.m. brutto"                                |
| `plannedDiscountAmount` | `plannedDiscountAmountGross` | „Rabat kwota brutto (przedmiar)"                  |
| `discountAmount`        | `discountAmountGross`        | „Rabat kwota brutto"                              |
| `plannedNet`            | `plannedGross`               | „Wartość przedmiaru brutto"                       |
| `currentPlannedNet`     | `currentPlannedGross`        | „Wartość brutto aktualizacji przedmiaru"          |
| `net`                   | `gross`                      | „Wartość brutto (razem etapy)"                    |
| `remaining`             | `remainingGross`             | „Pozostało brutto (…)"                            |
| `stageValueNet` group   | `stageValueGross` group      | „Etapy — kwota brutto"                            |

- Values: `columnValueResolver` (`lib/kosztorys/columns/column-values.ts:40-96`) maps every gross key
  through `grossOf(net) = toGross(net, row.vatRate)`. VAT is per investment (`investments.vat_rate`),
  copied onto every row, so each surface that gets rows can compute brutto.
- Grid assembly builds gross columns in preview too (`grid/kosztorys-v2-columns.tsx:226-329`); the
  preview's column selection treats `PREVIEW_VISIBLE_COLUMNS` as ceiling and floor and overrides
  `moneyAxis` (`grid/column-selection.ts:59-60,100`).
- Footer totals for gross keys already exist (`column-totals.ts:44-62`).
- Gross labels are Polish-only: `TRANSLATED_LABEL_KEYS` (`column-config.ts:63-72`) holds net keys.

### 3. Investor surfaces

- **Preview `/podglad-inwestora/[id]` and share link `/k/[token]`** — the editor in `preview` mode.
  Hidden set = stored `hiddenColumns` ∪ `investorEmptyColumnIds` (`use-kosztorys-editor.ts:453-461`),
  order = `clientDocumentColumns(ranks)`. Adding keys to the allowlist is enough to render them.
- **PDF** (`offer-print-action.tsx` → `offerPrintColumns`, `print/offer-columns.ts:85-102`):
  `offerColumnsByKey` has no gross entries. Most come back as one-liners
  (`money('plannedGross', clientLabel('plannedGross'))`, since `valueOf` already resolves them);
  per-etap brutto needs a `stageGrossColumns` beside `stageNetColumns` (`print/columns.ts:132-143`).
  Totals row is `OFFER_TOTAL_KEYS = ['plannedNet','plannedDiscountAmount']` (`print/offer.ts:23`) and
  the box hardcodes „Razem netto" / „W tym rabat" (`build-html.ts:129-133`). Past 7 columns the print
  goes landscape (`offer.ts:26,67`) — brutto twins hit that fast.
- **Settings sanitization is server-side** (`lib/queries/kosztorys-client-view.ts:55`, the save action
  in `lib/actions/kosztorys-client-view.ts`); both run through `sanitizeClientViewSettings`, so
  widening `PREVIEW_VISIBLE_COLUMNS` is the single switch.

### 4. Empty-settlement hiding

`investorEmptyColumnIds` / `emptySettlementColumnIds` (`lib/kosztorys/settlement-columns.ts:6-64`)
hide settlement columns until the first etap entry, by net key only. Without gross twins
(`gross`, `discountAmountGross`, `remainingGross`, `currentPlannedGross`,
`plannedDiscountAmountGross`, `stageValueGross_<id>`) a ticked brutto column shows an empty column on
an offer-phase investment.

### 5. Settings UI today and reusable shapes

- Dialog: `KosztorysClientViewDialog` → `ClientViewSettingsForm` → `ViewSettingsFields` (grouped
  `CheckboxRow`s from `CLIENT_VIEW_GROUPS`) + `DocumentColumnOrderButton` (`ColumnOrderDialog` over
  `CLIENT_DOCUMENT_COLUMNS`).
- Pair-axis: editor's „Kolumny" menu (`toolbar/kosztorys-view-menu.tsx:34-65`, `AxisSection`) uses
  `derivePairChecks` / `togglePairAxis` with `MONEY_AXES` / `MONEY_PAIR_CONFIG`
  (`toolbar/kosztorys-view-axis-options.tsx:32-46`) and `KOLUMNY_HINT` („odznaczona kolumna nie będzie
  widoczna niezależnie od opcji powyżej") — the exact semantics asked for. The logic is React-free in
  `lib/`; the rendered `AxisSection` is dropdown-only (`DropdownMenuCheckboxRow`), the dialog needs a
  `CheckboxRow` twin.
- Collapsible: `ui/collapsible-section.tsx` (`size="compact"`, `defaultOpen={false}`).

## Design options

**A — pair-axis as a bulk control over the hidden map (recommended).**
Section „Kwoty: ☑ Netto ☐ Brutto". Checks are _derived_ from the hidden map: Netto is on iff any
netto-family column is visible, Brutto iff any brutto one is. Ticking Brutto unhides the brutto twin
of every netto column currently visible (a sensible mirror, not „all of them"); unticking a family
hides all of it. The brutto `FieldSet`s render only while Brutto is on, so the dialog is unchanged for
everyone who never wants brutto. Storage, sanitizer, disclosure predicate, firm-wide default: all
unchanged — the hidden map stays the single source of truth.
Cost: a netto↔brutto pairing map for the document (`price` is `AXIS_EXEMPT` in the editor, but on the
document it is plainly the netto family with `priceGross` as twin, so `COLUMN_MONEY_AXIS` can't be
reused as-is), and a dialog-flavoured axis row.

**B — stored `moneyAxis` field on the client-view settings.**
Disclosure becomes `allowed ∧ ¬hidden ∧ axisAllows`. Mirrors the editor exactly, but adds a second
disclosure input to sanitize (fail closed to `net`), to the firm default, to the print and to every
surface — two sources of truth for one question. Not worth it.

**C — collapsible „Kolumny brutto" only.**
Gross groups in a closed `CollapsibleSection`. Smallest UI change, but no one-click „brutto instead
of netto": a gross-only document means unticking ~7 netto boxes by hand.

## Code References

- `src/lib/kosztorys/client-view/columns.ts:8-50` — allowlist + document order (gross keys go here, each
  beside its net twin)
- `src/lib/kosztorys/client-view/settings.ts:23-39` — `DEFAULT_VISIBLE_COLUMNS`; gross stays out → off
  by default
- `src/components/kosztorys/editor/dialogs/view-settings/client-view-settings-form.tsx:28-47` — dialog
  body; its hint names „razem netto"
- `src/components/kosztorys/editor/dialogs/view-settings/view-settings-fields.tsx:23-77` — grouped
  checkboxes, generic over the value
- `src/lib/kosztorys/axis-checkboxes.ts` — pair-axis logic to reuse
- `src/components/kosztorys/editor/toolbar/kosztorys-view-menu.tsx:34-65` — the editor's pair-axis UI
- `src/lib/kosztorys/columns/column-values.ts:40-96` — gross values already resolved
- `src/lib/kosztorys/print/offer-columns.ts:35-102`, `print/columns.ts:132-143`, `print/offer.ts:23`,
  `print/build-html.ts:129-133` — PDF columns, totals, footer box
- `src/lib/kosztorys/settlement-columns.ts:6-64` — empty-settlement ids (net only)
- `src/lib/kosztorys/settlement-mode.ts:32-40` — summary already brutto on `GROSS` investments

Tests that move: `__tests__/components/kosztorys/editor/grid/preview-columns.test.ts:41-69` (invert the
„no brutto" guard into „brutto only when ticked"), `__tests__/lib/kosztorys/print/offer.test.ts:393-413`
(needs print entries), `__tests__/lib/kosztorys/settlement-columns.test.ts:30,39` (gross twins).
`client-view/settings.test.ts` and `columns.test.ts` pass unchanged as long as no gross key is
default-visible.

## Architecture Insights

- Disclosure = `allowed.has(key) && !hidden.has(key)` under a code ceiling (lessons.md:438-447). Option A
  keeps exactly that predicate; the axis is UI sugar over `hidden`, so no new fail-closed input exists.
- „Stored preferences record the deviation": gross keys absent from every stored map fall to the code
  default (hidden) — the new columns reach nobody until the owner ticks them.
- Inserting gross keys mid-`CLIENT_DOCUMENT_COLUMNS` shifts unranked positions (domain notes :380) —
  acceptable, each lands beside its twin.
- Worker documents keep their own catalogue (EX-887) and must stay brutto-free (domain notes :442-445);
  nothing here touches them.

## Historical Context (from prior changes)

- `7a986a1b6`, `942e3cfe4` — the 2026-09-28 no-brutto ruling and its guard (plan folder
  `context/changes/2026-09-28-document-column-order/` archived in `c8c61fe25`, pruned in `732f75678`).
- `context/reference/kosztorys-editor-domain-notes.md:387` — the ruling as current truth; must be
  rewritten when this ships.
- `context/archive/2026-10-15-document-settings-column-map/` — EX-1033, why default-off needs no
  migration.
- `context/archive/2026-10-06-offer-hides-remaining/` — settlement columns hidden until the first etap
  entry.

## Owner decisions (2026-10-22)

Option A is the chosen design. Resolved questions:

1. **PDF stays netto for now** — brutto reaches the preview and the share link only. `offerColumnsByKey`
   gets no gross entries; `offerPrintColumns` already drops a key with no print column
   (`byKey[key] ?? []`), so ticked brutto silently stays off the printout. The print spec
   `offer.test.ts:393-413` („every document key has a print column") must exempt the gross keys
   explicitly — a named preview-only set, not a weakened assertion. Accepted consequence: the investor
   sees brutto on the link and netto in the downloaded PDF.
2. **`price` is a netto-family column** on the investor's document, paired with `priceGross` —
   unticking „Netto" hides „Cena j.m." too, unlike the editor where `price` is `AXIS_EXEMPT`. The
   document's net↔gross pairing map is its own constant, not `COLUMN_MONEY_AXIS`.
3. **Ticking „Brutto" reveals the twins** of the netto columns currently visible, not every brutto
   column.
4. **No per-settlement-mode default** — brutto is off by default on every investment, `GROSS` included.
   The 2026-08-12 ruling (settlement mode never decides disclosure) stands.

The 2026-09-28 ruling in `kosztorys-editor-domain-notes.md:387` is superseded by: „Brutto na dokumencie
inwestora jest opcjonalne i domyślnie wyłączone; PDF na razie tylko netto" — rewrite it when this ships.
