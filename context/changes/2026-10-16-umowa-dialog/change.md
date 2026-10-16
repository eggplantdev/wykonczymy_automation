---
change_id: umowa-dialog
title: Generate the client „Umowa” from the investment view
status: implementing
created: 2026-10-16
updated: 2026-10-16
archived_at: null
branch: staging
worktree: null
---

## Notes

„Umowa” button on /inwestycje/[id] opens a print dialog (Protokół odbioru pattern) generating the client contract from context/reference/umowa/umowa-wykonczeniowa.pdf. Single Zamawiający („zwanym”, the PDF's plural is a typo). Editable, prefilled fields: Numer umowy (empty, typed by hand, nothing stored); data zawarcia = today; miejscowość = „Warszawie”; Zamawiający block = Imię i nazwisko (from Dane do umowy, company → firma + NIP + repr.), PESEL (typed in the dialog, never stored — blank dotted line when empty), adres (billing address, or site address when „taki sam”) with kod + miejscowość; §1 ust. 2 adres inwestycji = full site address; §2 ust. 1 termin rozpoczęcia and czas trwania = free text, empty (a date or „5 tygodni”); §2 ust. 3 osoby odpowiedzialne za nadzór = prefilled „Bartosz Antonik, Yuri Abramenko”; §3 ust. 1 kwota netto około = kosztorys „Wartość netto przedmiar”, VAT fixed 8% text for now. Everything else (company data, KRS, NIP, representative, bank account, zadatek 10%/7 dni, §4–§8) fixed text in code, PDF typos fixed. Same „Edytuj dane inwestycji” button as the protocol.
