---
change_id: document-column-order
title: Owner-set column order for the investor and worker documents (EX-884)
status: implementing
created: 2026-09-28
updated: 2026-09-28
archived_at: null
branch: document-column-order
worktree: ../wykonczymy-worktrees/document-column-order
---

## Notes

EX-884 — kolejność kolumn w podglądzie inwestora i widoku pracownika ustawiana w ustawieniach.

The issue text predates `170d5586` (one column list per audience for preview, link and PDF): the
PDFs already iterate the same ordered list as the screen, so "do PDFs follow the order" is solved
by construction, and the per-variant question was settled by `20260928_2_client_view_single_set`.
`columnRanks` is a new Payload `json` field, so a migration IS needed (3 tables incl. the
`kosztorys-client-view-defaults` global the issue omits).
