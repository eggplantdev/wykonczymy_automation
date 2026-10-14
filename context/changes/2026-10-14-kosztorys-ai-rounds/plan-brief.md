# Plan brief — kosztorys-ai-rounds (EX-1057)

**What:** later AI rounds on an already-analysed kosztorys. A round appends a „Runda N” block to a
pozycja's new „Nowe informacje” field and raises „Do ponownego sprawdzenia” above its Status. Any
Status pick or typed Przedmiar lowers it. Pilot: #190 round 2.

**Guiding rule:** safety over polish — every new branch is gated on the flag, which defaults to
false, so all existing pozycje take today's path. Existing spec assertions are only added to.

**Phases**

1. **Fields and copy paths** — migration (two additive columns), collection, strict item type,
   INSERT / tree / snapshot / szablon / re-import / builders; fixes Komentarz AI leaking into a
   szablon and vanishing on re-import (regression specs first).
2. **Editor** — flag lowered client-side only (undo-safe), re-pick of Zaakceptowana copies the new
   AI przedmiar, two-line Status on flagged rows (editor only), „Nowe informacje” column, Problemy
   „do ponownego sprawdzenia”.
3. **Loader round mode** — `ROUND=N` in the local and prod loaders: only draft pozycje, only AI
   fields, append + flag, refuse a round already loaded. Shared pure module `ai-round.ts`.
4. **Pipeline + runbook** — `round-case-prod.ts` (record outside the repo), `fill-case-prod.ts`
   round mode (no rename), runbook in the old change's „Later rounds”.

**Cut for safety/scope:** server-side flag rule, collect skip record, history-on-click, Etap AI
automation, E2E (scenario goes to EX-1015 at the gate).

**Deploy risk:** additive migration must hit prod (a human) **before** the push, or every editor
load fails on the missing columns.
