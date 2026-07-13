---
id: kosztorys-editor-ux
title: Kosztorys editor UX pass (add-row + toolbar/grid polish)
status: shaping
created: 2026-07-11
updated: 2026-07-11
---

# Kosztorys editor UX pass

**Ongoing umbrella change** bundling a coherent round of kosztorys-editor UX work: one new
capability (Google-Sheets-style add-position) plus a set of already-filed toolbar/grid
improvements and bugs that touch the same handful of files. Each item ships and closes
independently; this folder is the shared design + tracking home.

Trigger: owner can't discover how to add a position within a section (the only paths are a 14px
`+` icon in the "Sekcje" panel and a toolbar button hidden until a section filter is active).
Owner is a Google Sheets user — the fix follows Sheets conventions.

## Scope (bundled, owner-confirmed 2026-07-11)

Grounded against current code; Linear descriptions predated some of it (reconciled below).

| Item                            | Linear                | File(s)                                                                                                       | Type        |
| ------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| Add-position context menu       | _(new — file parent)_ | `use-kosztorys-editor.ts`, `kosztorys-v2-columns.tsx`, `lib/actions/kosztorys.ts`, `lib/kosztorys/v2-rows.ts` | Feature     |
| Kosztorys/Arkusz → one toggle   | EX-427 _(cancelled)_  | `kosztorys-tab-host.tsx`                                                                                      | Improvement |
| View scope buttons → toggle group | EX-425 _(shipped)_  | `kosztorys-editor-toolbar.tsx`, `ui/toggle-group.tsx`                                                        | Improvement |
| Brutto toggle: label + tooltip  | EX-426                | `kosztorys-editor-toolbar.tsx`                                                                                | Improvement |
| Toggle layout shift             | EX-421                | toolbar buttons                                                                                               | Bug         |
| Table flicker on toggle         | EX-422                | `kosztorys-editor-body.tsx`                                                                                   | Bug         |
| Column-resize shrink floor      | EX-424                | `kosztorys-v2-columns.tsx`                                                                                    | Bug         |
| "Wersje" drawer stuck loading   | EX-423                | `kosztorys-versions-drawer.tsx`                                                                               | Bug         |
| Save/version buttons → one menu | EX-437                | `kosztorys-editor-toolbar.tsx`, `save-snapshot-button.tsx`                                                    | Improvement |

**Explicitly out:** EX-434 (kosztorys-item-autocomplete over preset prace) — a real feature with an
open product decision; not UX polish.

## Structure

- Parent Linear issue **"Kosztorys editor UX pass"** (project "Wykonczymy", team Ex-plant); the
  nine items above are its sub-issues. Each sub-issue closes on its own.
- One change folder (`this`). Full design per item: `design.md`.
- Each item gets its own `/10x-plan` when picked up (they are independent). This is not one giant
  plan.

Design: `design.md`.
