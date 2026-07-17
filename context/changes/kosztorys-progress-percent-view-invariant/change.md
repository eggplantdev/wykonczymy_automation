---
change_id: kosztorys-progress-percent-view-invariant
title: Pin the kosztorys completion percentage to client price so it stops swinging across price views
status: new
created: 2026-07-17
updated: 2026-07-17
archived_at: null
branch: null
worktree: null
---

## Notes

The whole-kosztorys "Wykonano %" toolbar counter and the per-section "Wykonano X% sekcji" line currently compute their completion ratio at the ACTIVE price view (totalNet/totalPlannedNet in use-kosztorys-editor.ts:179-187 and s.net/s.plannedNet in kosztorys-section-summary.tsx:205), so the same physical progress reads 108.7% / 266.0% / 43.3% across the client / w_tools / own_tools views. Decision: completion % must be view-invariant. Compute both ratios value-weighted at a FIXED 'client' price regardless of the active display view (matches the sheet's T÷S). Per-row donePercent column already view-invariant (pure quantity) — leave it. Money display columns and "Do zapłaty" keep the active view — only the progress-percent base is pinned to client price.

Why value-weighted (not raw Σqty ÷ Σprzedmiar): items carry heterogeneous units (inv 31 = 41 szt + 2 m² + 1 kpl), so summing raw quantities across rows is dimensionally meaningless. Value at a fixed client price is the only common denominator; the price enters as a constant weight, not as a per-view result. Confirmed against local DB inv 31: client 108.7%, own_tools 266.0%, w_tools 43.3% reproduced exactly.
