---
change_id: etap-tool-plane
title: Per-etap tool-plane assignment + view-independent subcontractor settlement
status: planned
created: 2026-07-23
updated: 2026-07-23
archived_at: null
branch: null
worktree: null
---

## Notes

per-etap z/bez narzędzi plane assignment + view-independent subcontractor settlement

Shaped in conversation (2026-07-23), decisions locked:

1. **New etap attribute**: plane — z narzędziami / bez narzędzi. Set from the etap header
   dropdown (next to Zmień nazwę / Usuń etap), same `Wrench` / slashed-wrench icons as the
   price-view toggle (`kosztorys-toolbar-options.tsx` VIEWS). Header shows the assigned
   plane's icon.
2. **Default**: z narzędziami, but flagged as unconfirmed — `TriangleAlert` (recon-mismatch
   pattern) on the etap header AND in „Podsumowanie podwykonawców" while any defaulted etap
   contaminates the totals. Nullable plane where `null` = defaulted-with-warning is the
   natural persistence shape (settle in planning).
3. **Subcontractor settlement becomes view-independent**: „Suma wykonanej pracy" = Σ each
   etap at its OWN plane's price (z etapy at w_tools price + bez etapy at own_tools price);
   ONE shared wypłaty pool subtracted once; „Pozostało do wypłaty" true on mixed
   investments. Both Z/Bez views show this same combined block — the shared pool is the
   whole point (owner).
4. **Klient view untouched** — client totals sum everything at client prices regardless of
   plane.
5. **Grid in a subcontractor view**: other plane's etap columns stay visible, marked
   „nie dotyczy" — only the settlement math cares about planes.

Root cause being fixed: today both subcontractor views reprice 100% of executed work at
their own price (`stageTotalsForView` / `sectionSubtotalsForView` are plane-blind), so the
two views show contradictory „Suma wykonanej pracy" totals where the real relationship per
etap is OR, not AND.
