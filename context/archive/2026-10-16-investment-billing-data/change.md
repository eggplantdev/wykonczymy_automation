---
change_id: investment-billing-data
title: Structured investment address and „Dane do umowy / faktury” on investments
status: archived
created: 2026-10-16
updated: 2026-10-18
archived_at: 2026-10-18T09:31:00Z
branch: staging
worktree: null
---

## Notes

Extend investments with structured site address (city, postal code, country; existing `address` relabelled „Ulica i numer”, no data migration) and an optional „Dane do umowy / faktury” group: clientType (osoba prywatna / firma), person: first/last name; company: company name, NIP, representative; billing address (street, postal code, city, country) with „Taki sam jak adres inwestycji” checkbox. All optional. No PESEL/ID stored (contract leaves a blank line). No separate Clients collection, no REGON/KRS. Surfaces: investment edit form section, /inwestycje/[id] InfoList. Groundwork for the follow-up „Umowa” dialog (generate contract from investment view, same pattern as Protokół odbioru).

## Decisions

- **Address split into fields, no backfill (owner ruling, 2026-10-16):** the existing free-text
  `address` is mixed-shape (63 of 196 local investments filled, e.g. „Szaserów 30b/32” vs „ul. X
  11m12, 02-699 Warszawa”) and not machine-splittable, so it was only relabelled „Ulica i numer”; the
  owner fills kod/miejscowość/kraj by hand. Don't re-propose an auto-split migration.
- **Billing data is a `billing` group on `investments`, not a Klienci collection:** repeat clients are
  rare. Revisit only if the same client shows up on several investments.
- **PESEL / nr dowodu is deliberately not stored (owner ruling, 2026-10-16):** the „Umowa” dialog
  takes it as a typed, unsaved field and prints a blank line when empty.
- **No NIP / kod pocztowy validation:** every field is optional and the country varies.
