---
change_id: umowa-dialog
title: Generate the client „Umowa” from the investment view
status: archived
created: 2026-10-16
updated: 2026-10-18
archived_at: 2026-10-18T09:28:00Z
branch: staging
worktree: null
---

## Notes

„Umowa” button on /inwestycje/[id] opens a print dialog (Protokół odbioru pattern) generating the client contract from context/reference/umowa/umowa-wykonczeniowa.pdf. Single Zamawiający („zwanym”, the PDF's plural is a typo). Editable, prefilled fields: Numer umowy (empty, typed by hand, nothing stored); data zawarcia = today; miejscowość = „Warszawie”; Zamawiający block = Imię i nazwisko (from Dane do umowy, company → firma + NIP + repr.), PESEL (typed in the dialog, never stored — blank dotted line when empty), adres (billing address, or site address when „taki sam”) with kod + miejscowość; §1 ust. 2 adres inwestycji = full site address; §2 ust. 1 termin rozpoczęcia and czas trwania = free text, empty (a date or „5 tygodni”); §2 ust. 3 osoby odpowiedzialne za nadzór = prefilled „Bartosz Antonik, Yuri Abramenko”; §3 ust. 1 kwota netto około = kosztorys „Wartość netto przedmiar”, VAT fixed 8% text for now. Everything else (company data, KRS, NIP, representative, bank account, zadatek 10%/7 dni, §4–§8) fixed text in code, PDF typos fixed. Same „Edytuj dane inwestycji” button as the protocol.

## Decisions

- **Template is local-only.** `context/reference/umowa/` is gitignored (public repo), so a fresh
  clone has no PDF and `clauses.ts` is the only copy of the clause text. Whoever changes a clause
  edits `clauses.ts` and gets the PDF from the owner.
- **Clause text is the owner's.** Only typo and grammar fixes. The duplicated sentences (§1 ust. 3 ≈
  §2 ust. 2) stay as the owner wrote them (2026-10-16), and VAT is the fixed 8% text. Don't "clean up"
  either without asking the owner.
- **Kwota is read on dialog open, not on page render** — a `'use server'` read through
  `getKosztorysTree` plus `columnTotalsForRows(...).get('plannedNet')`, so it equals the editor
  footer. Rejected: `selectKosztorysClientTotals` (executed work only) and a page-render prefetch
  (builds the tree on every page view). `getKosztorysTree` is uncached — accepted at one
  management-only load per open. On failure the amount stays empty and is typed by hand.

## Untested

- `getContractPlannedNet` and the dialog/form components have no automated test (manual checks
  only); defaults and the HTML builder are covered in `src/__tests__/lib/investments/contract/`.
- No E2E (decided 2026-10-16): the print window has no browser-level state to assert.
