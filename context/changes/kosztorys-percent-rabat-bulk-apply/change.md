# kosztorys-percent-rabat-bulk-apply

status: implementing
updated: 2026-07-24
branch: staging

Owner decision: percent global rabat stops being stored state and becomes a one-shot bulk-apply
writing X% into every item's per-item rabat. Amount-mode global rabat keeps current semantics.
Snapshot format drops globalDiscountType/Value.

Scope added mid-implementation (owner, 2026-07-24): **rabat is a client-only concept** — subcontractor
views (`w_tools`/`own_tools`) must hide the per-item discount columns AND price gross of any rabat, so
the grid matches the rule the subcontractor summary already enforces (`executedWorkNetPreRabat`,
"rabat absorbed by company margin, not passed to the subcontractor"). Tracked here as Phase 0.
