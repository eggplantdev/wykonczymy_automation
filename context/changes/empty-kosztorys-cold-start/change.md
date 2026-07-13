---
change_id: empty-kosztorys-cold-start
title: New investments auto-seed a section + blank item so the editor is never a dead blank
status: new
created: 2026-07-13
updated: 2026-07-13
archived_at: null
branch: konradantonik/ex-463-empty-kosztorys-cold-start
worktree: null
---

## Notes

Linear: **EX-463** (sub-issue of **EX-435** — kosztorys-editor-ux umbrella). Surfaced dogfooding editor v2.

**Problem:** open a fresh kosztorys with no preset → blank grid, no discoverable way to add an item. `treeToRows` (`src/lib/kosztorys/v2-rows.ts:49`) emits rows only from `section.items`, so zero sections/items = zero rows. EX-436 (right-click row → menu) is unreachable from that cold-start. The existing empty-state banner (`kosztorys-editor-v2.tsx:67`) is preset-only.

**Key correction:** a default *section alone* still renders a blank grid — must seed **1 section ("Nowa sekcja", the existing `NEW_SECTION_DEFAULTS`) + 1 blank item** so the user lands on a typable row.

**Scope (narrowed 2026-07-13, owner):** new investments only — in `createInvestmentAction` (`src/lib/actions/investments.ts:56`), when **no preset** chosen, seed 1 section + 1 blank item. Preset path already seeds — leave it. Same non-fatal pattern as the preset seed.

**Out of scope:** existing empty investments → handled by the import slice (S-12 / EX-417). No backfill migration.
