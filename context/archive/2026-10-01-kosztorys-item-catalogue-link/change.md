---
change_id: kosztorys-item-catalogue-link
title: Link a kosztorys pozycja to its work-catalogue entry by id
status: archived
created: 2026-10-01
updated: 2026-10-05
archived_at: 2026-10-05T05:37:57Z
branch: null
worktree: null
---

## Notes

Should a kosztorys pozycja store a link (id) to its work-catalogue entry instead of every reader
re-deriving the pairing from opis + j.m.? Decide whether the change makes sense at all before EX-948
(Ukrainian translations, `context/changes/2026-10-01-worker-report-translations-ua/`) is planned.

Surfaced while researching EX-948 — see the follow-up section of that change's `research.md`.
Direction stated by the user 2026-10-01: the app is moving away from Google Sheets, so building a
kosztorys in the app from the katalog is the main path from now on.

## Outcome — cancelled, nothing built (2026-10-01)

Research verdict: not now. Identity stays text (`catalogueKey(opis, j.m.)`); EX-948 recorded the same
decision. The rationale and measurements live in `context/reference/kosztorys-editor-domain-notes.md`
§ „Pozycja ↔ katalog: tożsamość zostaje tekstowa"; the full research is
`git show 4391d058:context/changes/2026-10-01-kosztorys-item-catalogue-link/research.md`.
