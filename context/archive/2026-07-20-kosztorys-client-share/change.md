---
id: kosztorys-client-share
slice: S-13
linear: EX-532
status: archived
branch: konradantonik/ex-532-kosztorys-client-share
worktree: .claude/worktrees/ex-532-client-share
created: 2026-07-20
updated: 2026-07-24
archived_at: 2026-07-24T13:59:02Z
---

# Kosztorys client share view

A live, read-only, token-gated client-facing view of a kosztorys. The owner shares `/k/<token>`;
the client reopens it over the life of the job and sees current per-etap progress.

The subcontractor cost view (z narzędziami / bez narzędzi) must never leak — enforced structurally
by pinning the price view to `'client'` so subcontractor prices are never computed, not filtered.

- Design: `design.md`
- Plan + execution state: `plan.md` (`## Progress` is authoritative)
