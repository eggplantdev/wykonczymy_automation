# Manual verification — kosztorys-vat

Automated checks already passed at each phase. Work through these by hand and tick each box as you go (rendered as a checklist in your editor / on GitHub). Not gated by CI; this is the pre-ship QA pass before `/10x-archive`.

> Note: restart your dev server first — the one you were on booted before the Phase-1 migration and will serve a stale `vat_rate does not exist` error until restarted (see the lesson in `context/foundation/lessons.md`).

## Phase 1: Schema + query wiring (backend)

- [ ] Tree carries real `vatRate` (not 0) on a local investment
- [ ] Payload admin shows VAT field, default 0.08
- [ ] Human applies migration to prod before Phase 2 push

## Phase 2: Editor UI — brutto column, Suma brutto, in-editor rate input

- [ ] Netto 100.00 → Brutto 108.00; Suma brutto = Suma netto × 1.08
- [ ] Brutto toggle hides/shows column + Suma brutto cleanly (remount key)
- [ ] Editing VAT updates all brutto live and persists across reload
- [ ] Brutto consistent across all three price views
- [ ] No regressions to netto totals, coeffs, stages, autosave
