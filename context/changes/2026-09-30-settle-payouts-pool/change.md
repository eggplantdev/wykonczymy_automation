---
change_id: settle-payouts-pool
title: Kwota do rozdysponowania i saldo kasy w dialogu „Rozlicz wypłaty”
status: implemented
created: 2026-09-30
updated: 2026-09-30
archived_at: null
branch: staging
worktree: null
---

## Notes

— kwota do rozdysponowania + saldo kasy w dialogu „Rozlicz wypłaty”

Shaped via a spike (2026-09-30), approved by the owner from screenshots. The spike code is already in
the working tree (`settle-payouts-form.tsx`, `settle-payouts-table.tsx`):

- optional „Do rozdysponowania” input between „Kasa” and „Data” — client-side calculator only, never
  sent to the action or persisted;
- footer row „Zostało do rozdysponowania” = kwota − Razem (green at 0, red below);
- over-allocation disables „Wypłać” with „Przekroczono kwotę do rozdysponowania o X”;
- „Aktualne saldo” under „Kasa” (like the other forms) plus „Saldo po wypłacie” = saldo − Razem
  (informational, never blocks). The preselected default register's saldo comes back with the rows
  from `fetchSettlePayoutRows` and seeds `useRegisterBalance` — no mount effect, no second request
  (review-gate change of the plan's "fetched on mount"); a register change or a stale-figures reload
  re-reads it;
- prefill of payable rows unchanged.
