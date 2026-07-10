---
id: kosztorys-snapshots
title: Kosztorys snapshots — save + restore point-in-time versions (S-06)
status: implementing
created: 2026-07-10
updated: 2026-07-10
---

# Kosztorys snapshots — S-06

The **durable** recovery net for the in-app kosztorys: save named point-in-time versions and
restore the whole tree (sections + items + stages + progress + editor settings) to a saved
point. Targets the "a bad edit / a cascade delete noticed a day later" failure that in-session
undo (S-07) can't catch. Additive `kosztorys_snapshots` table; restore = transactional
wipe-and-reinsert. Owner note: **this is the easy slice — keep restore dead-simple, no diffing,
no partial restore.**

- **Roadmap slice:** S-06, `context/foundation/roadmap.md`. Owner request (2026-07-10). Prereq: S-01.
- **Architecture (owner):** independent snapshots, NOT an event log. One row per snapshot with
  the serialized whole tree as `jsonb`. Rejected event-sourcing (single-editor app, no OT need).

## Owner decisions (2026-07-10)

- **Kosztorys root = `investment_id`.** One investment = one in-app kosztorys, permanently. No
  aggregate-root refactor; the legacy `kosztoryses` (Sheets-linkage) table is irrelevant and will
  be removed separately. Coeffs/VAT stay on `investments`; relocating them is out of scope.
- **Payload captures tree + investment editor-settings** (`w_tools_coeff`, `own_tools_coeff`,
  `vat_rate`) so restore is faithful; restore rewrites those settings too.
- **Versioning:** payload carries a schema-version tag; restore is **tolerant** (map known fields,
  default missing, ignore unknown extras) so old snapshots survive additive migrations.
- **Two kinds only** — `manual` (named via **"Zapisz jako…"**, **required** label) · `auto`
  (**plain client 10-min interval, fires unconditionally even when idle**) **+ forced
  unconditionally before every destructive op** (cascade delete, restore). No separate `safety`
  kind — pre-destruction protection is just a forced `auto` snapshot (owner simplification: don't
  keep two near-identical snapshots). No throttle, no dedupe, no activity check anywhere now.
- **Retention:** `manual` aged out after ~1 year · `auto` newest **50** per investment (inline
  count cap) **and** GC-dropped when older than **7 days**.
- **GC cron:** daily Vercel Cron (`CRON_SECRET`-guarded route) enforces the age caps globally,
  incl. dormant kosztorysy inline pruning never revisits. Shaped so other stale-data cleanups can
  hang off it later ("not only these").
- **Activity check deferred to S-07.** The idle-suppression gate ("skip the interval snapshot when
  nothing changed") lands with the undo-queue slice, which introduces the client edit-queue that
  makes a dirty signal cheap. Recorded in `roadmap.md` S-07. Not built now.
- **Restore is reversible** via the forced pre-restore `auto` snapshot. Single confirm dialog.
  UI = "Wersje" toolbar button → history drawer (named manual versions prominent, auto as ambient
  timestamped history). Editor **remounts** on restore success (lessons.md grid-reseed rule).
- **Access:** MANAGEMENT_ROLES (save + list + restore), the `protectedAction` default.

Plan: `plan.md`. Brief: `plan-brief.md`.
