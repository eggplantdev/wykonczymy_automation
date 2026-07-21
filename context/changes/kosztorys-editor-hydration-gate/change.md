---
change_id: kosztorys-editor-hydration-gate
title: Gate the kosztorys editor behind hydration to kill the first-paint settings flash
status: parked
created: 2026-07-21
updated: 2026-07-21
archived_at: null
branch: null
worktree: null
---

## Notes

**Parked → [EX-553](https://linear.app/ex-plant/issue/EX-553/kill-kosztorys-editor-first-paint-settings-flash-via-cookie-backed-ssr).**

eliminate the first-paint flash where the editor renders default view settings (price view, money axis, layer, progress display, totals-panel-open, column widths, hidden columns) then snaps to localStorage-persisted values after hydration.

The `useHydrated()` + Spinner gate was spiked and **reverted** — instrumentation showed the grid never paints at the default (view flips in the same commit as first grid paint), so the spinner only added an empty→full flash and made it worse. Real fix is cookie-backed SSR so the server renders the stored view directly; details in EX-553.
