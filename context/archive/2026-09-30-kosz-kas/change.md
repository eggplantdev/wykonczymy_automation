---
change_id: kosz-kas
title: Trash for an unused kasa — trash, restore, delete forever, a /kosz section
status: archived
created: 2026-09-30
updated: 2026-10-01
archived_at: 2026-09-30T22:20:02Z
branch: kosz-kas
worktree: ../wykonczymy-worktrees/kosz-kas
---

## Notes

Linear: **EX-917** (blocks EX-918 — pracownicy). Umbrella research:
`context/changes/2026-09-29-kosz-pozostalych-encji/research.md` § 5, § 6.4 (name maps), § 7.

Trash / restore / delete-forever for an unused cash register, plus a `/kosz` section. Also carries the
shared prep that was planned for flota (EX-915), since kasy are now the second kind in the trash:
the `TRASH_KINDS` table (design note: first comment on EX-915) and moving `TRASH_RETENTION_DAYS` out
of `src/lib/constants/investment-lock.ts`.

### Decided with the owner (2026-09-30)

1. **Cancelled transactions do not count as use.** „Unused" stays the existing live-only
   `beforeDelete` probe (`src/collections/cash-registers.ts`, cancelled rows exempt since `7728e424`).
   Accepted cost: delete-forever blanks the kasa on its cancelled rows.
2. **A worker goes to the trash together with their kasa, only if that kasa is empty** — the pair is
   EX-918's job; this change must leave a seam for it.
3. **A kasa cannot be handed over to another owner.** A worker whose kasa is used stays; `active` is
   how they leave.
4. MANAGER has full parity (umbrella decision, 2026-09-29).
