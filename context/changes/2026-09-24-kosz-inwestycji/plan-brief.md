# Kosz inwestycji — Plan Brief

> Full plan: `context/changes/2026-09-24-kosz-inwestycji/plan.md`
> Research: `context/changes/2026-09-24-kosz-inwestycji/research.md`

## What & Why

Owner and admin can move an investment from the listing into a shared `/kosz` page. From there it
can be restored or deleted for good. Today the only way to remove an investment is an irreversible
hard delete from the unused `/admin`, which silently cascades away the kosztorys, its versions and
the investor link.

## Starting Point

The only guard today is `preventDeleteWithTransactions`, which blocks the delete while live
transactions exist. The listing and all pickers read from a single chokepoint, `fetchReferenceData`.
Writes pass through a single gate, `investment-gate.ts`, which today only knows the "completed"
lock.

## Desired End State

„Usuń" on the listing moves the investment to the trash. In the trash it is hidden everywhere,
frozen, and its `/k/<token>` link is dead. „Przywróć" brings it back unchanged, link included.
„Usuń na zawsze" asks for the investment's name only when its kosztorys was really used. The daily
cron empties unused investments that have been in the trash for more than 30 days.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Who may do it | Owner + admin only | Deleting is the owner's call, not the manager's. | change.md |
| Mechanism | Own `trashed_at` column, not Payload `trash` | Payload's trash fails closed on reads and risks deleting Blob bytes. | Research |
| Transactions | A live transaction blocks both trashing and deleting | Deleting would orphan money. | change.md |
| Warsztat | Can never be trashed | It is not an investment. | change.md |
| "Kosztorys w użyciu" | Przedmiar or Pomiar ≠ 0 | The szablon seeds ~310 empty items, so counting items means nothing. | change.md |
| Auto-purge | 30 days, skips a used kosztorys | Nothing the owner worked on vanishes without a click. | change.md |
| Typing the name | Only for a used kosztorys, checked server-side | An empty investment would disappear by itself anyway. | change.md |
| Files | Stay in Blob as orphans | `kosz-plikow` owns their cleanup; this change does nothing irreversible to files. | change.md |
| Where the trash lives | Shared `/kosz` + „Kosz" in the sidebar (owner/admin) | Other kinds (kasy, pracownicy) get their own sections later. | change.md |
| Message on a blocked write | Its own sentence, „Inwestycja jest w koszu…" | "Completed" would lie about the reason. | Plan |
| Share generation / previewMaterialSync | Not gated | The UI is unreachable (404), and the token resolver refuses trashed investments anyway. | Plan |

## Scope

**In scope:**

- the migration and field
- hiding at refData and on the 3 pages that bypass it (v1 kosztorys, podgląd, `/k/<token>`)
- the gate with its own message
- 3 owner/admin actions
- the `/kosz` page and nav entry
- the listing button
- the purge in `/api/cron/cleanup`

**Out of scope:**

- deleting files
- a generic trash abstraction
- the `/admin` access `Where`
- the `/kosztorysy` v1 list and equipment labels
- snapshot GC changes
- a nav counter

## Architecture / Approach

Hide at the single read chokepoint (`fetchReferenceData`) and in the 3 paths that bypass it. Refuse
at the single write gate, which now returns the refusal sentence instead of a boolean. Trashing runs
the same transaction probe as the hard delete, inside one transaction. Both the hard delete and the
purge go through `payload.delete`, so `beforeDelete` re-checks, and the child cache tags that the DB
cascade bypasses are expired by hand. One SQL fragment defines "used", and both the `/kosz` label
and the purge read it.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Column, hiding, lock | A trashed investment is invisible and read-only | Missing a read path that bypasses refData |
| 2. Actions | Trash / restore / delete forever, plus the "used" query | The name check living only in the UI |
| 3. UI | `/kosz`, the nav entry, „Usuń" on the listing | Nav role groups (the third group is new) |
| 4. Cron purge | Automatic emptying after 30 days, with counters | One step's error hiding the other's |

**Prerequisites:**

- a local DB restored from a dump with `trashed_at` migrated
- **prod migrated by a human before the push** (the migration is additive)

**Estimated effort:** ~2 sessions, 4 phases.

## Open Risks & Assumptions

- A lead promoted into a trashed investment keeps its link, which returns 404 while the investment
  is in the trash. This is acceptable, and the lead goes back to promotable after the hard delete.
- A booking racing with a trash operation (a split second at 5 users) could pin an investment in
  the trash. The purge then counts it as `blocked` rather than skipping it silently.
- The E2E for the whole flow goes to a Linear `e2e-backlog` issue at the review gate.

## Success Criteria (Summary)

- The owner removes an investment with one click and restores it unchanged, investor link included.
- Nothing the owner worked on (a used kosztorys) disappears without an explicit, typed confirmation.
- A manager has no way into the trash, and no path, including a direct action call, can write to a
  trashed investment.
