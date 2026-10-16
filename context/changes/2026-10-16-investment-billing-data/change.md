---
change_id: investment-billing-data
title: Structured investment address and „Dane do umowy / faktury” on investments
status: implementing
created: 2026-10-16
updated: 2026-10-16
archived_at: null
branch: staging
worktree: null
---

## Notes

Extend investments with structured site address (city, postal code, country; existing `address` relabelled „Ulica i numer”, no data migration) and an optional „Dane do umowy / faktury” group: clientType (osoba prywatna / firma), person: first/last name; company: company name, NIP, representative; billing address (street, postal code, city, country) with „Taki sam jak adres inwestycji” checkbox. All optional. No PESEL/ID stored (contract leaves a blank line). No separate Clients collection, no REGON/KRS. Surfaces: investment edit form section, /inwestycje/[id] InfoList. Groundwork for the follow-up „Umowa” dialog (generate contract from investment view, same pattern as Protokół odbioru).
