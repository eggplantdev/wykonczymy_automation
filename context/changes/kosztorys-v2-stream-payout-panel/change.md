---
id: kosztorys-v2-stream-payout-panel
title: Stream the „Podsumowanie podwykonawców" footer panel via <Suspense>
status: preparing
created: 2026-07-21
updated: 2026-07-21
branch: konradantonik/ex-554-podsumowanie-dodac-figure-kwota-do-zaplaty-podwykonawcy
---

# Stream the „Podsumowanie podwykonawców" footer panel

## Intent

Investigate whether the kosztorys v2 editor page can render faster by pulling the two PAYOUT
fetches out of the blocking `Promise.all` and streaming the subcontractor summary footer behind
`<Suspense>`, rather than gating first paint on all 8 fetches.

## Outcome

Research **recommends NOT building the proposed change** — see `research.md`. The premise doesn't
hold: the payout fetches are not the bottleneck (`getKosztorysTree` is), the active-view state is
client-side (so a server-level Suspense sibling can't gate the panel per view), and the panel is
welded to live client state (`dueNet` from grid `rows`, `priceView` gating, absolute overlay
positioning). Kept as a documented investigation so the question isn't re-opened cold.
