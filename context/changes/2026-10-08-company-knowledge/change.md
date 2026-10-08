---
change_id: company-knowledge
title: Wiedza firmowa — a book of company rules in a top-bar dialog, for management and the AI agent
status: implementing
created: 2026-10-08
updated: 2026-10-08
archived_at: null
branch: staging
worktree: null
---

## Notes

EX-1032. Written-down general company knowledge — rules that belong to no single praca (the gap
`kosztorys-ai-knowledge-loop` left out of scope on purpose; „Komentarz do pracy” holds knowledge about
one katalog entry).

Agreed with the owner, 2026-10-08:

- **A dialog, not a page.** Opened from a button in the top bar; on a phone, from the mobile menu. It
  must be one click from anywhere — szablony, katalog prac, the kosztorys editor — and a note must be
  quick to write. The mobile-menu entry is a deliberate exception to the narrow phone scope in
  AGENTS.md; record it there with the change, and check the dialog at 390px.
- **Entries**: a topic + text. First entry: what wall height to assume when the inquiry gives none.
- **Management only** (ADMIN / OWNER / MANAGER) reads and writes. EMPLOYEE never sees it.
- Readers: the AI agent (reads every entry before drafting a przedmiar, and can name the entry an
  assumption came from in Komentarz AI „Co / ile założono” — EX-1030) and new management staff
  (onboarding).
- **Shape settled on a spike (2026-10-08):** the owner first leaned towards one plain document; the
  click-through spike with entries won. Required: search, sort, and drag reordering like other places
  in the app.
- After the book exists: re-run the AI cases already analysed under the new system (Komentarz AI,
  assumptions allowed — EX-1030).
