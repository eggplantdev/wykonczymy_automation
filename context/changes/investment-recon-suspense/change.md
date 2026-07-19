---
id: investment-recon-suspense
linear: EX-542
branch: investment-recon-suspense
base: kosztorys-bridge
status: implementing
created: 2026-07-19
updated: 2026-07-19
---

# Stream the investment-page „z kosztorysu" recon block via Suspense

Pull `getKosztorysTree` off the investment-detail page's critical render path. It currently sits
in the page's top-level `Promise.all` purely to compute two recon scalars, so the whole page waits
on the slowest kosztorys fetch (`stage-progress limit:100000`). Defer it behind `<Suspense>`.

This is **option A** from the EX-540 options analysis (recorded on that issue). It fixes perceived
latency only — it does **not** close EX-540 (the queries still run, just off the critical path).

Base is `kosztorys-bridge`, not `main`: the recon block itself was added by EX-535 and lives only on
that branch.
