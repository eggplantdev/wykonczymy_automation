---
change_id: investment-notes-markdown
title: Render bold, headings and lists in investment Notatki
status: implementing
created: 2026-10-12
updated: 2026-10-12
archived_at: null
branch: investment-notes-markdown
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/investment-notes-markdown
---

## Notes

Render a minimal markdown subset in investment Notatki (`**bold**`, `##` headings, `-` lists) so the AI kosztorys notes appendix can be formatted for the owner. Plain-text notes must render as before; the owner keeps editing raw text in the textarea. Component: src/components/investments/investment-notes.tsx. Follow-up (not code): rewrite the 10 AI notes appendices (#198–#207) into the new template — total first, „Do ustalenia z klientem” with bold key word + zł impact, then Założenia, Przedmiar 0 świadomie; no repo paths.
