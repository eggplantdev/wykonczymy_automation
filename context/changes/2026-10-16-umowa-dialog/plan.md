# Umowa dialog Implementation Plan

## Overview

A „Umowa” button on `/inwestycje/[id]` opens a print dialog, built like the Protokół odbioru one, that
generates the client contract from `context/reference/umowa/umowa-wykonczeniowa.pdf`. The variable
parts are prefilled from the investment („Dane do umowy”, site address) and from the kosztorys
(„Wartość przedmiaru netto”). Everything stays editable, and nothing is stored: the dialog prints HTML,
and „Zapisz jako PDF” in the print dialog gives the file.

## Current State Analysis

- **Protokół odbioru pattern.**
  - Pure lib: `src/lib/kosztorys/acceptance-protocol/` with `types.ts`, `constants.ts`, `form-defaults.ts`, `build-protocol-html.ts` and `styles.ts`.
  - Dialog: `src/components/kosztorys/editor/dialogs/acceptance-protocol-dialog.tsx`. The form uses `useAppForm({ defaultValues: protocolFormDefaults(...) })`, and „Generuj” calls `openPrintWindow` and then `writeAndPrint(buildProtocolHtml(...))` (`src/lib/utils/print-window.ts`).
  - „Edytuj dane inwestycji” is the `EditInvestmentDialog` component (`triggerText`). The body is keyed on `protocolPrefillKey(investment)`, so a save refills the fields.
- **Client data.** `InvestmentWithDetailsT.billing` (`clientType`, names, company, NIP, representative, `sameAsSite`, billing address) and the site address fields. The formatters are `formatAddress`, `formatBillingParty` and `formatBillingAddress` (`''` when `sameAsSite`) in `src/lib/investments/format-address.ts`. The protocol's private `prefilledClientName` / `prefilledSiteAddress` (`acceptance-protocol/form-defaults.ts:25-33`) already encode „who is the client / where is the site”.
- **„Wartość przedmiaru netto”** is the editor footer total `columnTotalsForRows(rows, stages, 'client', vatRate).get('plannedNet')` (`src/lib/kosztorys/columns/column-totals.ts:37`). It sums `rowPlannedNetForView(row, 'client')`, which is Przedmiar × Cena j.m. − rabat per row. No cached SQL aggregate exists: `selectKosztorysClientTotals` covers executed work only. The tree comes from `getKosztorysTree(investmentId)` (management-only, uncached) plus `treeToRows`.
- **The page** (`src/app/(frontend)/inwestycje/[id]/page.tsx:71-80`) is a server component. Its action row holds `EditInvestmentDialog`, `RequestReviewButton`, `SheetButton` and `OpenKosztorysV2Button`, and trashed investments hide the edit button. With the default v2 stats, the summary panel already builds the tree once per page view.
- **On-demand reads** that a client component triggers are `'use server'` functions in `src/lib/queries` (e.g. `register-balance.ts`: `requireAuth(MANAGEMENT_ROLES)` and then the read).
- **Print styles.** `PROTOCOL_PRINT_STYLES` holds the page/body/`.fill`/`.line`/`.signatures` rules the contract needs too. Safari's page-margin lesson lives in its comment (lessons: „Print: vertical margin on `@page`”).
- **The PDF** has 6 pages and no images (so no logo), with sections §1–§8 and signatures „Zamawiający / Przyjmujący zamówienie”. Its typos:
  - „Wykonczymy”, „Nip”, „Krs”, „Dla M.St. Warszawy W Warszawie”;
  - „zwanymi dalej (Zamawiającym)”;
  - „przyjmującego zamówienia”;
  - „dokumentacja techniczną”;
  - „150m”;
  - stray merged words and the PDF's `​` (U+200B) artefacts.

## Desired End State

- On `/inwestycje/[id]` (not trashed), clicking „Umowa” opens a dialog titled „Umowa”. It shows a short loading state while the kosztorys figure loads, then the form.
- **Fields:**
  - Numer umowy: empty.
  - Data zawarcia: today.
  - Miejscowość: „Warszawie”.
  - Zamawiający: name (billing party, or the contact person).
  - PESEL: empty; hidden for „Firma”.
  - Adres Zamawiającego: the billing address, or the site address when „taki sam”.
  - Adres inwestycji (§1 ust. 2): the full site address.
  - Termin rozpoczęcia (§2 ust. 1): empty.
  - Czas trwania (§2 ust. 1): empty.
  - Osoby odpowiedzialne (§2 ust. 3): „Bartosz Antonik, Yuri Abramenko”.
  - Kwota netto około (§3 ust. 1): „Wartość przedmiaru netto”, empty when the kosztorys has none.
- „Edytuj dane inwestycji” sits in the dialog. Saving it refills the investment-derived fields.
- „Generuj” opens the print window with the full contract.
  - The fixed text is the PDF's text with typos fixed, „zwanym dalej (Zamawiającym)” and the 8% VAT line.
  - Every empty field prints as a dotted blank line for the pen.
- Nothing about the contract is persisted (PESEL included).

### Key Discoveries:

- `getKosztorysTree` does its own `requireAuth(MANAGEMENT_ROLES)`. The page is already `requireManagementPage`, so no new gate is needed.
- `writeAndPrint` handles a page without `<img>` (`print-window.ts:30`): it prints immediately.
- `openPrintWindow` must run synchronously in the click (`print-window.ts:1-4`). The kosztorys figure therefore has to be in hand **before** „Generuj”, which it is: it loads when the dialog opens.
- `formatBillingParty` already renders a company as „firma, NIP …, repr. …”.

## What We're NOT Doing

- No storing of contracts, numbers or PESEL. No numbering sequence: the number is typed by hand.
- No VAT-rate field. „8% vat (Mieszkania do 150 m²/Domy do 300 m²)” is fixed text for now.
- No edit of the legal clauses beyond typo/grammar fixes. The PDF's duplicated sentences (§1 ust. 3 ≈ §2 ust. 2) stay as the owner wrote them.
- No SQL aggregate for the przedmiar total: it is read through the tree on demand (see Approach).
- No button in the kosztorys editor. No logo, because the PDF has none.

## Implementation Approach

**Phase 1** is pure and fully unit-tested:

- the contract types, defaults and HTML builder;
- a shared client/site prefill helper (de-duplicated from the protocol);
- the shared print base styles (de-duplicated from the protocol's styles).

**Phase 2** wires it up:

- a `'use server'` read for the przedmiar total;
- the dialog;
- the button.

The przedmiar total is loaded **when the dialog opens**, not on every page render. The click handler starts the server-action promise and stores it in state, and the form body reads it with React `use()` inside `<Suspense>`. That is an event-driven start with no `useEffect`, and no tree build on a page view that never opens the dialog. The figure comes from `columnTotalsForRows(...).get('plannedNet')`, so it is the exact number the editor footer shows.

## Critical Implementation Details

- **Promise lifetime:** create the promise in the open handler (`onOpenChange(true)`) and keep it in `useState`. Never create it during render: `use()` on a fresh promise every render suspends forever. Re-create it on each open, so a kosztorys edited in another tab is picked up.
- **Failure:** `.catch` the promise to `undefined`, and `logError` it with a `// TODO(EX-958) SENTRY-REQUIRED:` marker if it goes through `console.error`. The amount field then stays empty under an error `Description` („Nie udało się wczytać kwoty z kosztorysu — wpisz ją ręcznie.”). The dialog must never crash.
- **Escaping:** every form value goes through `escapeHtml`. Fixed clauses are trusted constants.
- **Remount key:** `contractPrefillKey(investment)` covers every investment-derived prefill: client name, client address, site address and `isCompany`.

## Phase 1: Contract document (pure)

### Overview

Types, defaults, the HTML builder and the shared helpers, with specs.

### Changes Required:

#### 1. Shared client/site prefill

**File**: `src/lib/investments/prefill.ts` (new); `src/lib/kosztorys/acceptance-protocol/form-defaults.ts`

**Intent**: Move `prefilledClientName` and `prefilledSiteAddress` out of the protocol's defaults into an exported module, so the protocol and the contract name the client the same way. The protocol keeps its behaviour.

**Contract**:

- `clientNameOf(investment)` returns `formatBillingParty(billing) || contactPerson.trim() || name`.
- `siteAddressOf(investment)` returns the full site address.
- `clientAddressOf(investment)` returns `formatBillingAddress(billing) || siteAddressOf(investment)`.

#### 2. Shared print base styles

**File**: `src/lib/utils/print-document-styles.ts` (new); `src/lib/kosztorys/acceptance-protocol/styles.ts`

**Intent**: Lift the document-generic rules out of `PROTOCOL_PRINT_STYLES` into `PRINT_DOCUMENT_BASE_STYLES`, keeping the Safari `@page` comment with them. The rules are `*`, `@page`, `body`, `h1`, `h2`, `p`, `.caption`, `.line`, `.fill`, `.blank-line` and `.signatures`. The protocol then composes base + its own rules, with byte-identical output in effect.

#### 3. Contract module

**Files**: `src/lib/investments/contract/{types.ts,constants.ts,form-defaults.ts,build-contract-html.ts,styles.ts}` (new)

**Intent**: The contract as data plus a builder, mirroring the protocol's file split.

**Contract**:

- `ContractFormT` is all strings (dates as `YYYY-MM-DD`): `number`, `signDate`, `place`, `clientName`, `clientPesel`, `clientAddress`, `siteAddress`, `startWindow`, `duration`, `supervisors`, `plannedNet`. It also carries `isCompany: boolean`, which is not an input and only hides PESEL.
- `constants.ts` holds:
  - the company block (name „Wykończymy sp. z o.o.”, address, NIP 1182271075, KRS 0001062152, court, representative „Bartosza Antonika – Członka Zarządu”);
  - the bank account;
  - `DEFAULT_SUPERVISORS = 'Bartosz Antonik, Yuri Abramenko'`;
  - `DEFAULT_PLACE = 'Warszawie'`.
- `contractFormDefaults({ investment, today, plannedNet })` returns:
  - `plannedNet` formatted as Polish grouping with 2 decimals and no „zł” (the clause prints „zł” itself), or `''` when `plannedNet` is `undefined` or `≤ 0`;
  - `isCompany = billing.clientType === 'company'`.
- `contractPrefillKey(investment)` returns a string.
- `buildContractHtml({ form })` returns a full `<!DOCTYPE html>` document:
  - a heading „UMOWA nr {number}”;
  - „zawarta w dniu {date} r. w {place}”;
  - the Zamawiający block (name / PESEL line when not company / address), then „zwanym dalej (Zamawiającym)”;
  - the company block;
  - §1–§8 transcribed from the PDF with typos fixed, with the fields inserted at §1 ust. 2, §2 ust. 1 (both blanks), §2 ust. 3 and §3 ust. 1;
  - signatures.
    An empty field renders as the dotted `.fill` span. The `<title>` is „Umowa nr X — client” (used as the PDF file name).
- The clauses live as structured constants (paragraph → numbered points) in `build-contract-html.ts` or a sibling `clauses.ts`, not as one HTML blob, so typos can be fixed in plain text.

### Success Criteria:

#### Automated Verification:

- Defaults spec: `pnpm exec vitest run src/__tests__/lib/investments/contract/form-defaults.test.ts`. It covers:
  - person vs company name;
  - billing address vs „taki sam” fallback;
  - „Warszawie”, today, supervisors;
  - the amount formatted, with 0 or `undefined` giving `''`;
  - `isCompany`.
- Builder spec: `pnpm exec vitest run src/__tests__/lib/investments/contract/build-contract-html.test.ts`. It covers:
  - user values are escaped;
  - empty fields print a blank `.fill`;
  - no PESEL line for a company;
  - „zwanym dalej”;
  - the amount sits in §3 next to „zł 8% VAT”;
  - NIP, KRS and the account number are present;
  - no U+200B in the output.
- Protocol specs still green after the prefill and style extraction: `pnpm exec vitest run src/__tests__/lib/kosztorys/acceptance-protocol`.

#### Manual Verification:

- None for this phase (no UI yet).

---

## Phase 2: Przedmiar read, dialog and button

### Overview

Load the figure on open, render the form, generate, and place the button on the investment page.

### Changes Required:

#### 1. On-demand przedmiar total

**File**: `src/lib/queries/contract-planned-net.ts` (new, `'use server'`)

**Intent**: Return the kosztorys „Wartość przedmiaru netto” for one investment.

**Contract**: `getContractPlannedNet(investmentId: number): Promise<number>` → `getKosztorysTree(investmentId)` (auth inside) → `columnTotalsForRows(treeToRows(tree), tree.stages, 'client', tree.vatRate).get('plannedNet') ?? 0`.

#### 2. Dialog

**Files**: `src/components/investments/contract-dialog.tsx`, `src/components/investments/contract-form.tsx` (new)

**Intent**:

- `ContractDialog` holds the „Umowa” trigger button (same size/variant as its row neighbours, `FileText`-style icon) and the `Dialog`. On open it starts `getContractPlannedNet(...).catch(() => undefined)` into state. It renders `<Suspense fallback={…loading…}>` around `ContractForm`, keyed on `contractPrefillKey(investment)`.
- `ContractForm` reads the promise with `use()` and builds `useAppForm({ defaultValues: contractFormDefaults(...) })`.
  - It lays out the fields in the protocol's two-column grid: Numer umowy, Data zawarcia (`DatePicker`), Miejscowość, Zamawiający, PESEL (hidden when `isCompany`), Adres Zamawiającego, Adres inwestycji, Termin rozpoczęcia, Czas trwania, Osoby odpowiedzialne, Kwota netto około (zł).
  - It renders `EditInvestmentDialog triggerText="Edytuj dane inwestycji"` with the same helper `Description` as the protocol.
  - It shows the load-failure `Description`.
  - `DialogActions` „Generuj” runs `openPrintWindow` → `writeAndPrint(buildContractHtml(...))` with the protocol's toast-on-failure handling.

#### 3. Page

**File**: `src/app/(frontend)/inwestycje/[id]/page.tsx`

**Intent**: Add `{!trashed && <ContractDialog investment={investment} />}` to the action row after `EditInvestmentDialog`.

### Success Criteria:

#### Automated Verification:

- None beyond the gate. The pure logic is covered in Phase 1, and the query only composes already-tested functions (`columnTotalsForRows`, `treeToRows`).

#### Manual Verification:

- An investment with „Dane do umowy” as Osoba prywatna and „taki sam” on → „Umowa”:
  - the name and site address are prefilled in Zamawiający;
  - Miejscowość is „Warszawie”, the date is today, the supervisors are prefilled;
  - Kwota equals the editor's „Wartość przedmiaru netto” footer.
- „Firma” → the name shows the company + NIP + repr., and there is no PESEL field.
- „taki sam” off with a billing address → Adres Zamawiającego is the billing address, and Adres inwestycji is still the site address.
- An investment without a kosztorys → Kwota is empty and the dialog works.
- „Edytuj dane inwestycji” → change the client name and save → the Umowa fields refill.
- „Generuj” with Numer, PESEL and the terms left empty → the print preview shows dotted blanks, „zwanym dalej (Zamawiającym)”, „Wykończymy”, the 8% VAT line and the signatures. „Zapisz jako PDF” suggests „Umowa nr … — …”.
- A trashed investment shows no „Umowa” button.

---

## Testing Strategy

### Unit Tests:

- Defaults and builder as in Phase 1. Protocol specs re-run as the regression guard for the two extractions.

### Manual Testing Steps:

- See Phase 2 Manual Verification (local, per `context/reference/manual-verification.md`). Print output is checked in Chrome and Safari (lessons: print traps).
- E2E disposition is decided at the review gate. A window-print document has no assertable browser-level state beyond what the unit specs pin, so the expected outcome is that manual checks cover it.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

## References

- Pattern: `src/components/kosztorys/editor/dialogs/acceptance-protocol-dialog.tsx`, `src/lib/kosztorys/acceptance-protocol/`
- Source document: `context/reference/umowa/umowa-wykonczeniowa.pdf` (`pdftotext -layout` for the text)
- Footer total: `src/lib/kosztorys/columns/column-totals.ts:37`
- Prior change: `context/changes/2026-10-16-investment-billing-data/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Contract document (pure)

#### Automated

- [ ] 1.1 Defaults spec passes
- [ ] 1.2 Builder spec passes
- [ ] 1.3 Protocol specs still green after the prefill and style extraction

### Phase 2: Przedmiar read, dialog and button

#### Automated

- [ ] 2.1 Gate: `pnpm typecheck` and `pnpm lint` pass
