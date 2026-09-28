# Protokół odbioru prac — Implementation Plan

## Overview

A new „Protokół odbioru" entry in the kosztorys editor's „Inwestor" menu opens a prefilled form
dialog. The owner checks/edits the header fields, sees a read-only preview of the scope of work and
the netto settlement, and „Generuj" prints the protocol through the browser's print window (save as
PDF) — the same mechanism as „Wygeneruj ofertę". A separate „Zaktualizuj dane inwestycji" button
writes the edited client name/address back to the investment.

Source template: `protokol-odbioru-prac.pdf` in this folder (deleted once this change ships).

## Current State Analysis

- The „Inwestor" menu (`src/components/kosztorys/editor/toolbar/menus/kosztorys-investor-menu.tsx`)
  holds four items; „Wygeneruj ofertę" (`editor/actions/offer-print-action.tsx`) builds an HTML
  string (`src/lib/kosztorys/offer-print/build-offer-print-html.ts`) and writes it into a popup
  opened by `openPrintWindow` / closed by `printThenClose` (`src/lib/utils/print-window.ts`). The
  logo-wait-then-print logic is inline in the offer action (`offer-print-action.tsx:104-120`).
- Menu item ↔ dialog state lives in `KosztorysActionsProvider`
  (`editor/actions/kosztorys-actions-context.tsx`) because the dropdown unmounts its children on
  select; dialogs are mounted as siblings in `kosztorys-actions-menu.tsx:139-149`.
- All settlement figures already exist as pure functions: `sumDeposits` (`lib/kosztorys/deposit-planes.ts:80`),
  `billedMaterials` / `computeAmountDue` (`lib/kosztorys/summary-economics.ts`),
  `effectiveMaterialsNetRate` (`lib/kosztorys/settlement-mode.ts:67`). The summary tab composes them
  in `summary-panel-content.tsx:208-229`.
- „Pomiar z natury" per pozycja = `rowTotalQtyDone(row, stages, view)` (`lib/kosztorys/settlement-rows.ts:14`).
- Editor context carries `rows`, `stages`, `tree` (settlementMode, materialsNetRate), `laborCostsNet`.
  NOT in context: `materialsGrossBase` / `materialsNetBilled` (`panelData`), `depositTransactions`,
  `investmentLoss`, `investment` — these are `KosztorysEditorBody` props
  (`kosztorys-editor-body.tsx:103-124`). `KosztorysEditorToolbar` takes no props today.
- Investment data is sparse: `address` filled on 35/138 investments, `contactPerson` on 9/138; the
  client's name usually lives in `investments.name` („Magdalena Garbacik Tytoniowa 20/39").
- `updateInvestmentAction(id, data: InvestmentFormDataT)` (`lib/actions/investments.ts:155`)
  validates the WHOLE investment form — a partial payload would reset phone/email/notes/review to ''.

## Desired End State

From the kosztorys editor of a real investment (not the szablon workbench), „Inwestor → Protokół
odbioru…" opens a dialog with:

- editable: rodzaj odbioru (częściowy / końcowy / ponowny), miejscowość, data sporządzenia, data
  odbioru, data zgłoszenia gotowości, Zamawiający, adres, termin zapłaty;
- read-only preview: zakres prac (every pozycja with Pomiar z natury > 0 — sekcja, opis, ilość, j.m.)
  and rozliczenie netto (Robocizna, Materiały, Suma, Wpłaty, Strata if any, Pozostało do zapłaty /
  Nadpłata) — the same figures the „Podsumowanie" tab shows;
- „Zaktualizuj dane inwestycji" (enabled only when Zamawiający/adres differ from the investment);
- „Generuj" → print window with the protocol, logo on top, Wykonawca „Wykończymy".

Verify: open the dialog on a seeded investment, compare the preview figures with „Podsumowanie",
generate, save as PDF, and check the printed sections against the template.

### Key Discoveries:

- Print mechanism + logo wait to reuse: `offer-print-action.tsx:58-135`, `print-window.ts`.
- Summary composition to mirror (not re-derive): `summary-panel-content.tsx:208-229`.
- Action/dialog wiring pattern: `save-version-action.tsx` + `save-version-dialog.tsx` + `useDialogToggle`.
- `FormDialogShell` (`components/ui/form-dialog-shell`) is the dialog frame; forms use `useAppForm`.

## What We're NOT Doing

- No persisted protocol (no collection, no history, no numbering) — the form is one-shot.
- No server-side PDF generation / PDF library — the browser print dialog makes the PDF.
- No contract fields („do umowy z dnia / nr umowy") — the app stores no contracts.
- Dropped from the template: denwi.pl footer/ad, „Reprezentowany przez" (both sides), „Inne osoby
  obecne", „Kwota zatrzymana", pkt 7 „Potwierdzenie usunięcia wad".
- No per-pozycja selection or editing of the scope; no editing of settlement figures.
- No brutto figures on the protocol — netto only.
- No wykonawca data in the DB — „Wykończymy" is a code constant.

## Implementation Approach

Pure logic first (`src/lib/kosztorys/acceptance-protocol/`), testable in node: form defaults, scope
rows, settlement, investment-update payload, and the print HTML. Then the UI layer: thread the
summary inputs the editor context lacks from `KosztorysEditorBody` into the toolbar as one
`AcceptanceProtocolSourceT` prop, add the menu item + dialog on the existing actions-provider pattern,
and pull the offer's logo-wait printing into `print-window.ts` so both prints share it.

## Critical Implementation Details

- **Timing & lifecycle** — `openPrintWindow` must run synchronously inside the „Generuj" click (an
  `await` first gets the popup blocked). Everything the print needs is already in memory, so build the
  HTML and write it in the same handler.
- **State sequencing** — the settlement must be computed with the EFFECTIVE materiały rate
  (`effectiveMaterialsNetRate(settlementMode, materialsNetRate)`), exactly as the summary does;
  passing the stored rate would print a different Materiały figure than „Podsumowanie" in tryb brutto.

## Phase 1: Protocol logic (pure functions)

### Overview

Everything the dialog and the print compute, as React-free functions with unit tests.

### Changes Required:

#### 1. Types and constants

**File**: `src/lib/kosztorys/acceptance-protocol/types.ts`, `src/lib/kosztorys/acceptance-protocol/constants.ts`

**Intent**: One home for the protocol's shapes and the fixed wykonawca name.

**Contract**: `AcceptanceKindT = 'partial' | 'final' | 'reinspection'`;
`AcceptanceProtocolFormT` (kind, place, issueDate, acceptanceDate, readinessDate, clientName,
siteAddress, paymentDueDate — dates as `YYYY-MM-DD` strings, '' when empty);
`ProtocolScopeRowT` ({ sectionName, description, qty, unit });
`ProtocolSettlementT` ({ laborCostsNet, materialsNet, totalNet, paidNet, lossNet, remainingNet, isOverpaid });
`CONTRACTOR_NAME = 'Wykończymy'`.

#### 2. Scope rows

**File**: `src/lib/kosztorys/acceptance-protocol/scope-rows.ts`

**Intent**: The zakres prac — every pozycja with executed work, in kosztorys order.

**Contract**: `protocolScopeRows(rows: KosztorysV2RowT[], stages: KosztorysStageT[]): ProtocolScopeRowT[]`
— qty = `rowTotalQtyDone(row, stages, 'client')`, keeps rows with qty > 0, preserves input order.

#### 3. Form defaults

**File**: `src/lib/kosztorys/acceptance-protocol/form-defaults.ts`

**Intent**: Prefill the form from the investment and the kosztorys.

**Contract**: `protocolFormDefaults({ investment, rows, stages, today }): AcceptanceProtocolFormT` —
clientName = `contactPerson` if non-blank, else `investment.name`; siteAddress = `address`;
issueDate = acceptanceDate = `today`; place/readinessDate/paymentDueDate = ''; kind = `'final'` when
every pozycja with Przedmiar > 0 has Pomiar ≥ Przedmiar (and at least one such pozycja exists), else
`'partial'`.

#### 4. Settlement

**File**: `src/lib/kosztorys/acceptance-protocol/settlement.ts`

**Intent**: The netto rozliczenie — the same figures as „Podsumowanie", composed from the existing
summary functions, never re-derived.

**Contract**: `protocolSettlement({ laborCostsNet, materials, settlementMode, materialsNetRate, depositTransactions, lossAmount }): ProtocolSettlementT`
— materialsNet = `billedMaterials(materials, effectiveMaterialsNetRate(...))`; paidNet =
`sumDeposits(...).net`; remainingNet = `computeAmountDue(...).net`; isOverpaid =
`roundToCents(remainingNet) < 0`.

#### 5. Investment update payload

**File**: `src/lib/kosztorys/acceptance-protocol/investment-update.ts`

**Intent**: „Zaktualizuj dane inwestycji" must change only contactPerson and address; the action
takes the whole form, so the payload carries every other field through unchanged.

**Contract**: `investmentUpdateFromProtocol(investment: InvestmentRefT, form: Pick<AcceptanceProtocolFormT, 'clientName' | 'siteAddress'>): InvestmentFormDataT`
(presetId '' — the action strips it; `assets` omitted — the action drops it) and
`hasInvestmentChanges(investment, form): boolean` (trimmed compare) for the button's enabled state.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/acceptance-protocol/scope-rows.test.ts` passes
  (rows without stages excluded; order kept; qty = stage sum)
- `pnpm exec vitest run src/__tests__/lib/kosztorys/acceptance-protocol/form-defaults.test.ts` passes
  (contactPerson vs name fallback; final vs partial kind; empty kosztorys → partial)
- `pnpm exec vitest run src/__tests__/lib/kosztorys/acceptance-protocol/settlement.test.ts` passes
  (remaining equals the summary's `computeAmountDue(...).net` for the same inputs; tryb brutto ignores
  the stored materiały rate; overpaid flag)
- `pnpm exec vitest run src/__tests__/lib/kosztorys/acceptance-protocol/investment-update.test.ts`
  passes (phone/email/notes/review/status/name preserved; only the two fields change)

#### Manual Verification:

- none for this phase (pure logic)

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Protocol print HTML

### Overview

The printable document, built as an HTML string like the offer.

### Changes Required:

#### 1. HTML builder + styles

**File**: `src/lib/kosztorys/acceptance-protocol/build-protocol-html.ts`, `src/lib/kosztorys/acceptance-protocol/styles.ts`

**Intent**: Render the trimmed template: header (logo, miejscowość + data, title), rodzaj odbioru with
the chosen box ticked, miejsce wykonania, data odbioru + data zgłoszenia gotowości, Zamawiający,
Wykonawca = `CONTRACTOR_NAME`; 1. Zakres prac (Lp., Prace = sekcja + opis, Ilość i j.m., empty
„Zgodnie z umową?" column); 2. Dokumenty (four empty checkboxes); 3. Wynik odbioru (three empty
checkboxes, template wording); 4. Wady (four empty rows); 5. Rozliczenie netto (the settlement rows,
termin zapłaty, empty „Obniżenie wynagrodzenia" line, „Okres rękojmi i gwarancji liczy się od dnia"
= data odbioru); 6. Uwagi (empty lines); closing sentence + two signature lines. An empty form field
prints as a dotted blank line, never as an empty string glued to its label.

**Contract**: `buildProtocolHtml({ form, scope, settlement, logoUrl }): string` — every interpolated
value through `escapeHtml` (`@/lib/utils/escape-html`); dates rendered `dd.mm.yyyy`; money through
the app's existing PLN formatter (the one the offer print uses).

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/acceptance-protocol/build-protocol-html.test.ts`
  passes (chosen kind ticked and only it; scope rows rendered; user text escaped; empty date prints a
  blank line; „Wykończymy" present; settlement label switches to „Nadpłata" when overpaid)

#### Manual Verification:

- none for this phase (verified through the print in Phase 3)

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Dialog, menu item and print wiring

### Overview

The owner-facing surface: data threading, menu item, dialog with form + previews, both buttons.

### Changes Required:

#### 1. Shared print-with-logo helper

**File**: `src/lib/utils/print-window.ts`, `src/components/kosztorys/editor/actions/offer-print-action.tsx`

**Intent**: Move the offer's „wait for the logo (load / error / 4 s timeout), then print" block into
`print-window.ts` so the protocol reuses it instead of a second copy.

**Contract**: `printWhenImagesSettle(printWindow: Window, timeoutMs?: number): void`; the offer action
calls it in place of its inline block (behaviour unchanged).

#### 2. Source threading

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`,
`src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx`,
`src/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.tsx`

**Intent**: Hand the dialog the summary inputs the editor context lacks, WITHOUT adding them to
`KosztorysEditorProvider` (EX-496 value-churn rule).

**Contract**: `AcceptanceProtocolSourceT = { investment: InvestmentRefT; materials: MaterialsT; depositTransactions: DepositTransactionRowT[]; lossAmount: number }`
— built in the body only when `investment` is defined, passed as an optional `protocolSource` prop to
`KosztorysEditorToolbar` → `KosztorysActionsMenu`, which mounts the dialog and renders the menu item
only when it is present (so the szablon workbench and the shares never show it). `laborCostsNet`,
`rows`, `stages`, `tree.settlementMode`, `tree.materialsNetRate` are read from the editor context.

#### 3. Menu item + toggle

**File**: `src/components/kosztorys/editor/actions/acceptance-protocol-action.tsx`,
`editor/actions/kosztorys-actions-context.tsx`, `editor/toolbar/menus/kosztorys-investor-menu.tsx`

**Intent**: „Protokół odbioru…" with a one-line description, opening the dialog via a new
`acceptanceProtocol: DialogToggleT` in the actions provider.

**Contract**: menu item placed after „Wygeneruj ofertę"; hidden when `protocolSource` is absent.

#### 4. Form schema + dialog

**File**: `src/components/forms/acceptance-protocol-form/acceptance-protocol-schema.ts`,
`src/components/kosztorys/editor/dialogs/acceptance-protocol-dialog.tsx`

**Intent**: `useAppForm` form seeded by `protocolFormDefaults` on every open (so a reopened dialog
reflects edits saved to the investment meanwhile); read-only „Zakres prac" list (count + scrollable
list) and „Rozliczenie" table from `protocolSettlement`; „Zaktualizuj dane inwestycji" calls
`updateInvestmentAction(investment.id, investmentUpdateFromProtocol(...))`, enabled only when
`hasInvestmentChanges`, success/error toast; „Generuj" disabled with a note when the scope is empty,
otherwise opens the print window synchronously, writes `buildProtocolHtml(...)` with
`logoUrl = ${origin}/logo-wykonczymy.png`, then `printWhenImagesSettle`; blocked popup → the same
toast as the offer.

**Contract**: zod schema over `AcceptanceProtocolFormT` (kind required; dates optional strings);
dialog title „Protokół odbioru prac"; confirm label „Generuj".

### Success Criteria:

#### Automated Verification:

- Existing offer print spec still passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/offer-print/build-offer-print-html.test.ts`

#### Manual Verification:

- „Inwestor → Protokół odbioru…" is present in an investment's kosztorys and absent in the szablon workbench
- Dialog prefills Zamawiający (osoba kontaktowa, else nazwa inwestycji), adres, today's dates, rodzaj odbioru
- Rozliczenie figures in the dialog equal Robocizna / Materiały / Wpłaty / Pozostało do zapłaty in „Podsumowanie" (netto)
- Zakres prac lists exactly the pozycje with a non-zero Pomiar z natury
- „Zaktualizuj dane inwestycji" is disabled until Zamawiający/adres change; after saving, the investment shows the new values and its phone/email/notes are untouched
- „Generuj" opens the print dialog with the logo loaded; saved PDF matches the trimmed template (no denwi footer, no „Reprezentowany przez", no pkt 7)
- „Generuj" is disabled with an explanation on a kosztorys with no executed work
- „Wygeneruj ofertę" still prints with its logo

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- Scope filter and order; kind default (final/partial/empty); clientName fallback
- Settlement parity with `computeAmountDue` for the same inputs, incl. tryb brutto + stored rate
- Update payload preserves every untouched field (the real data-loss risk)
- HTML: escaping, ticked kind, blank-line rendering, overpaid label

### Integration Tests:

- None — no new server path; `updateInvestmentAction` is existing, covered code.

### Manual Testing Steps:

1. Open the kosztorys of an investment with stage quantities and wpłaty; open „Inwestor → Protokół odbioru…".
2. Compare the Rozliczenie preview against „Podsumowanie".
3. Edit Zamawiający, click „Zaktualizuj dane inwestycji", reopen the investment edit dialog.
4. „Generuj" → save as PDF → compare against `protokol-odbioru-prac.pdf`.

## Performance Considerations

Scope filtering is O(rows × stages) on a click, over ≤ ~1000 rows — negligible; nothing runs until
the dialog opens.

## Migration Notes

None — no schema change.

## Whole-tree Gate

Run **once**, after the final phase.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full suite passes: `pnpm test`

## References

- Template: `context/changes/2026-09-28-protokol-odbioru/protokol-odbioru-prac.pdf`
- Similar implementation: `src/components/kosztorys/editor/actions/offer-print-action.tsx`
- Summary composition: `src/components/kosztorys/summary/summary-panel-content.tsx:208-229`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Protocol logic (pure functions)

#### Automated

- [x] 1.1 scope-rows spec passes
- [x] 1.2 form-defaults spec passes
- [x] 1.3 settlement spec passes
- [x] 1.4 investment-update spec passes

### Phase 2: Protocol print HTML

#### Automated

- [ ] 2.1 build-protocol-html spec passes

### Phase 3: Dialog, menu item and print wiring

#### Automated

- [ ] 3.1 offer print spec still passes
