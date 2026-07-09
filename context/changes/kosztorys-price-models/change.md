---
change_id: kosztorys-price-models
title: Kosztorys — finish the price-view surface (S-03 residual: persist view + label/UX polish)
status: implemented
created: 2026-07-09
updated: 2026-07-09
archived_at: null
---

## Notes

**Charter redefined 2026-07-09 after research (see `research.md`).** S-03's original scope — the
three price views + the "one dataset, three views" toggle + the coefficient/override derivation —
was **already shipped by S-01** (`kosztorys-sections-items`), which explicitly folded S-03 and
S-11 into itself (S-01 `change.md:29-48`). The roadmap was never updated to reflect that (still
`proposed`). This change is therefore the **residual polish** on top of the shipped surface, not a
build of the toggle.

Scope (path 2, owner 2026-07-09):

1. **Persist the selected price view** — today `view` resets to `'client'` every load
   (`use-kosztorys-editor.ts:67`). Persist **per-kosztorys** via localStorage, key
   `kosztorys-view:<investmentId>`, mirroring the column-widths pattern
   (`use-column-widths.ts`, `useSyncExternalStore` + SSR-stable snapshot). Per-browser; no
   migration, no server/action work.
2. **Label cleanup** — fix "Bez narzędzia" → "Bez narzędzi"; reconcile toolbar view labels with
   the section-panel coefficient labels (one vocabulary everywhere).
3. **Pricing-model explainer** — add the short "what do these views / tryb / coeff / amount mean"
   note above the table that `kosztorys-v2-columns.tsx:24-25` flags as a wanted UX follow-up.

Explicitly OUT (unchanged): hide margin from MANAGER → S-14; netto/brutto → S-12; browser E2E of
the toggle → S-08.

Also at archive: update `roadmap.md` to mark **S-03 and S-11 absorbed/done** (the never-run
S-01 archive step, S-01 `change.md:48`).

Will branch to its own worktree + PR at implement time; for now research (done) + plan only.
