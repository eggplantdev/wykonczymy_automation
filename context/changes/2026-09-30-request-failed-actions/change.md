---
change_id: request-failed-actions
title: A server action whose request never arrived ends in a Polish failure branch everywhere (EX-940)
status: implemented
created: 2026-09-30
updated: 2026-09-30
archived_at: null
branch: request-failed-actions
worktree: ../wykonczymy-worktrees/request-failed-actions
---

## Notes

EX-940: `settleAction` gains `code: 'REQUEST_FAILED'`; the ~23 client call sites still unwrapped (incl. 10 structural ops in `use-kosztorys-editor.ts`, the grid autosave lanes, the auth forms) go through it; an ESLint `no-restricted-syntax` guard keeps new calls from landing unwrapped. Research: `research.md`.
