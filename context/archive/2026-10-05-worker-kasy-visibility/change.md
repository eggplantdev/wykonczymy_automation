---
change_id: worker-kasy-visibility
title: Worker's kasy — count on /pracownicy, linked list on /pracownicy/[id] (EX-960)
status: archived
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05T06:32:28Z
branch: staging
worktree: null
---

## Notes

EX-960: since EX-918 a worker goes to the Kosz together with the kasy he owns, but the listing only shows „Domyślna kasa” — nothing says how many kasy „Do kosza” takes along. Add a „Kasy” count column to the listing and a „Kasy” section with links on the worker page. Live kasy only; no link to a filtered `/kasy` (its owner filter is client state, not a URL param).

Scope change during the review gate (owner, 2026-10-05): the worker-page section is „Przypisane kasy” and shows each kasa's saldo plus a „Razem” row (`fetchRegisterBalances`, already cached for `/kasy`) — reversing the plan's „no balances”. The „Wypłaty” total above it was removed. A MAIN kasa is hidden from MANAGER viewers, matching `/kasy`.

Coupling to keep in mind: `ownedRegisters` mirrors the set the worker-trash action takes (every untrashed owned kasa, whatever its `active` flag — `src/lib/db/worker-trash.ts`). If that set ever narrows, the helper must follow it, or the „Kasy” count drifts from what „Do kosza” moves.
