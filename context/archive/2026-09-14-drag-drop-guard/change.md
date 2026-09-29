---
change_id: drag-drop-guard
title: Block navigation on a missed file drop + visible dropzone while dragging
status: archived
created: 2026-09-14
updated: 2026-09-14
archived_at: 2026-09-14T16:23:04Z
branch: null
worktree: null
---

## Notes

Dropping a file next to a dropzone makes the browser open the file as a document (the default `drop`
action on the document). We want to block that — but **only where drag&drop actually exists**, not
globally in the layout.

Second thread: the dropzone should be visible from the moment a file is dragged over the window
(it used to highlight only on hover), in a nicer color than `border-primary` (nearly black).

## Decisions

- **2026-09-14 (owner):** the drag&drop state color is **shared** by both dropzones — the neutral one
  (`FileInput`) and the AI one (the „Wygeneruj z paragonów" button). Rejected "shared geometry, own
  color"; the scan button's `ring-neon-cyan` gives way to the shared drop-state color.
- **2026-09-14 (owner):** the guard is mounted **per dropzone**, not in the layout or a provider.
  Every dropzone sits in a dialog, so with the dialog closed there is nothing to aim at — a layout
  guard would add nothing, and skipping Payload's own dropzone (`/admin/**`) comes for free.
- **2026-09-14 (owner):** while dragging, **all** available targets highlight (weakly) and the one
  under the cursor strongly. Showing the user where a file may be dropped IS the problem being
  solved, so we don't narrow it to one dropzone.
- **2026-09-14 (owner):** **no enlarging** the dropzone during a drag — neither by real height nor by
  `scale`. Resizing shifts content out from under the cursor mid-drag.
- **2026-09-14 (owner):** E2E for this change **canceled** (EX-774 → Canceled). The risk is purely
  browser-level with zero server logic, and a suite run takes ~1 h — the `drag-drop-guard` manual
  checks carry the verification.
