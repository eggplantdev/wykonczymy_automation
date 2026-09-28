---
date: 2026-09-24T11:52:10+0200
researcher: Claude (Opus 5.5)
git_commit: 8a6552c5b2e5ff948782bcb52b376a5c34b45062
branch: staging
repository: wykonczymy
topic: "Investment trash (soft delete) with restore, owner/admin only, 30-day purge that spares kosztorys"
tags: [research, investments, soft-delete, trash, kosztorys, share-link, cron, payload-trash]
status: complete
last_updated: 2026-09-24
last_updated_by: Claude (Opus 5.5)
---

# Research: Investment trash (soft delete) with restore

**Date**: 2026-09-24T11:52:10+0200
**Git Commit**: 8a6552c5
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Owner/admin-only „Usuń" on the investments listing moves an investment to a trash; „Przywróć" brings
it back unchanged; „Usuń na zawsze" hard-deletes. Blocked while any live transaction exists; never
the warsztat. A 30-day auto-purge skips investments holding a kosztorys — those need a manual delete
confirmed by typing the investment name. While trashed: gone from listing/pickers/totals, kosztorys
read-only, share link `/k/<token>` dead (returns on restore). Decisions: `change.md`.

What has to change, where does a trashed investment leak, and is Payload's built-in `trash` the
right mechanism?

## Summary

1. **Don't use Payload's `trash: true`; add a hand-rolled `trashed_at` column.** Payload trash hides
   the row from every Local API read — and that is the wrong failure direction here. `findByID` on
   a trashed id throws NotFound, so ~10 actions start throwing raw errors, the share page turns into
   a **500** (uncaught `findByID` inside `unstable_cache`, `preview-kosztorys.ts:61`), and — worst —
   the media reference probes (`delete-unreferenced-media.ts:79-98`, `prevent-referenced-delete.ts:15`)
   stop seeing the trashed investment's `assets`, so an unrelated detach elsewhere can **delete a
   shared photo from Blob for good**, which no restore can bring back. A hand-rolled column fails the
   other way: a forgotten filter shows a trashed investment somewhere (visible, harmless), never
   destroys anything. It also avoids Payload's trash quirks: trashing is an `update`, so
   `beforeDelete` guards don't run; restore needs only `update` access, which MANAGER holds. Same
   verdict, same reason, as `kosz-plikow` rejecting „2b" (`context/changes/2026-09-22-kosz-plikow/change.md`).
2. **One chokepoint hides it almost everywhere.** `fetchReferenceData` (`src/lib/queries/reference-data.ts:64-73`)
   already excludes the warsztat; adding `AND i.trashed_at IS NULL` there removes a trashed
   investment from the listing, every picker/combobox, the dashboard, the crumb, transfer filters and
   name maps — and turns `/inwestycje/[id]` and `kosztorys_v2` into 404 (both resolve through refData).
3. **Hiding isn't locking — the write gates need the flag explicitly.** `investmentGateFor` /
   `investmentGateForRow` (`src/lib/db/investment-gate.ts:30,62`) read only `status`, so every kosztorys
   write behind `investmentAction` and every transfer booking (`hooks/transfers/validate.ts:75`) still
   passes for a trashed id from a stale dialog or `?investment=` URL. Share generation
   (`lib/actions/kosztorys-share.ts`) has no investment gate at all.
4. **Share link:** keep the share row, check `trashed_at` in `getPreviewKosztorysByToken`
   (`src/lib/queries/preview-kosztorys.ts:117-136`, uncached) and return `null` → 404. Restore brings the
   link back with no extra work; hard delete cascades the row.
5. **Purge = a step in `/api/cron/cleanup`**, one `payload.delete` per investment so
   `preventDeleteWithTransactions` re-checks, skipping any investment with kosztorys items or
   snapshots. That route has no try/catch or `maxDuration` yet — `kosz-plikow` phase 2 plans the same
   hardening; sequence the two.
6. **Hard delete must expire child cache tags by hand** — the cascade removes rows Payload never sees
   (lessons.md „A DB-level ON DELETE CASCADE deletes rows Payload never sees").
7. **Real numbers (local DB = prod dump):** 11 of 139 investments have no live transactions; minus
   the warsztat, **4 would auto-purge** (17, 28, 89, 154) and **6 hold a kosztorys** (90, 137, 138,
   155, 156, 157 — 155/157 are the same client under two spellings, the likely motivating case).

## Detailed Findings

### Mechanism: Payload `trash: true` vs a hand-rolled column

Verified in installed `payload@3.73.0` (`P` = `node_modules/.pnpm/payload@3.73.0_…/node_modules/payload/dist`):

- `trash: true` adds a hidden, indexed `deletedAt` date field (`P/collections/config/sanitize.js:110-121`).
  With `push: false` nothing creates the column (upstream #13531) — a hand-written migration either way.
- Reads: `find`/`findByID`/`count`/`findDistinct` append `deletedAt exists:false` unless `trash: true`
  (`P/utilities/appendNonTrashedFilter.js`; `find.js:79-84`, `findByID.js:53-56`). `trash: true` returns
  live **and** trashed.
- Trash = `update({ data: { deletedAt } })`; runs `beforeChange`/`afterChange`, **not**
  `beforeDelete` (`P/collections/operations/utilities/update.js:80-121`). Checks `access.update` AND
  `access.delete` (`updateByID.js:41-61`). Restore = `update({ trash: true, data: { deletedAt: null } })`
  — only `access.update`, which is `isAdminOrOwnerOrManager`. Hard delete of a trashed doc needs
  `delete({ trash: true })` (`deleteByID.js:61-78`).
- A populated relation to a trashed doc degrades to a bare id (`P/collections/dataloader.js:60-78`,
  `relationshipPopulationPromise.js:42-45`; upstream discussion #15997).
- Validation is skipped on updates to trashed docs (`update.js:57,146-148`).

Consequences for this repo if chosen:

| Path | Effect |
|---|---|
| `src/lib/media/delete-unreferenced-media.ts:79-98`, `src/hooks/media/prevent-referenced-delete.ts:15` | Don't see a trashed investment's `assets` → a detach elsewhere (e.g. lead assets, shared since promotion re-points ids — `promote-lead.ts:15-17`) deletes the Blob bytes. **Irreversible.** |
| `src/lib/queries/preview-kosztorys.ts:61` | Uncaught `findByID` → share link 500 instead of 404 |
| `lib/actions/investments.ts:82,171`, `lib/actions/sheets.ts:110`, `lib/actions/kosztorys.ts:142-215`, `lib/media/set-upload-field.ts:33`, `lib/kosztorys/restore-kosztorys.ts:52` | Throw NotFound (raw error). `restore-kosztorys` throws **after** its raw deletes (`:35-36`) |
| `src/lib/queries/sheets.ts:24-50` (depth 1) | Sheet shows as unlinked but can't be relinked (depth-0 id still set) |

A hand-rolled `trashed_at timestamptz` (a normal hidden `date` field `trashedAt` on the collection —
**not** named `deletedAt`, so Payload's sanitizer never treats it as its own) keeps every Local API read
behaving as today; exclusion happens only where we add it.

### Read paths — where a trashed investment would surface

Raw SQL on `investments` (the full inventory; none filters trash today):

| file:line | what | action needed |
|---|---|---|
| `src/lib/queries/reference-data.ts:64-73` | refData — listing, pickers, dashboard, crumb, `/inwestycje/[id]` + `kosztorys_v2` 404, transfer filters, name maps (≈25 consumers) | **add filter — the chokepoint** |
| `src/lib/db/investment-gate.ts:30,62` | lock gate for kosztorys writes, transfer validation, `access/investment-lock.ts:65,67` | **select `trashed_at`, refuse** |
| `src/lib/db/kosztorys-client-totals.ts:76`, `src/lib/db/kosztorys-subcontractor-due.ts:62` | per-investment maps; read keyed by refData, so harmless | filter as defence in depth |
| `src/lib/db/sum-transfers.ts:168-171` | pricing columns; no live transactions on a trashed id | none |
| `src/lib/db/kosztorys-tree.ts:96-97` | editor/preview tree | none if pages 404 and preview gate added |
| `src/lib/db/workshop-investment.ts:13` | resolves warsztat | none — warsztat can't be trashed |
| `src/lib/db/equipment.ts:43,132` | „currently at" names a trashed investment | cosmetic; decide |
| `src/lib/db/snapshots.ts:46,83,97,118` | list/restore versions; `gcSnapshots` prunes by age | decide whether GC pauses for trashed |
| `src/lib/queries/investment-assets.ts:21` | gallery; also via `investment-asset-ids.ts` → lead assets dialog | cache bust only |
| `src/lib/db/lock-investment-for-replace.ts:20` | `FOR UPDATE` lock | none |

Child-table sums that don't join `investments` (register/worker balances, category/type sums,
deposit planes — `sum-transfers.ts:35,67,114,246,280`, `deposit-plane-sums.ts:29`) all filter
`cancelled IS NOT TRUE`, so they stay clean **provided trashing enforces the no-live-transactions
rule**. Cosmetic: cancelled transfers of a trashed investment list without an investment name in audit
mode (`queries/transfers.ts:109`, `transfer-mapping.ts:95`).

### Write-side gates

- `investmentGateFor`/`ForRow` → `investmentAction` (`src/lib/actions/investment-action.ts:56-80`)
  returns `INVESTMENT_LOCKED_MESSAGE` on `isLockedStatus`. Add a trashed branch with its own sentence
  („Inwestycja jest w koszu…").
- Transfers: `src/lib/actions/transfers.ts:56,101,175`, `src/hooks/transfers/validate.ts:75` (via the
  gate). `isBookableInvestment` (`src/lib/constants/investment-lock.ts:30`) takes a status string.
- `src/access/investment-lock.ts:27` hard-codes `investment.status not_equals completed` for Payload
  writes on child collections — admin-panel only (unused), but add `investment.trashedAt exists false`
  for symmetry or leave documented.
- Kosztorys editor client: `readOnly = preview || locked` (`use-kosztorys-editor.ts:161`), `locked`
  from `kosztorys_v2/page.tsx:109`. Moot if the page 404s while trashed.
- `lib/actions/kosztorys-share.ts:13,36-60,67` — no gate; add one.
- `lib/actions/sheets-sync.ts:134,217,317,330,399` — manual sync on a trashed id is ungated (not reviewed in depth).

### Guards on trash itself

`preventDeleteWithTransactions` (`src/collections/investments.ts:24-34`, wired `:49`) is a
`beforeDelete` hook built on `makePreventDelete` (`src/hooks/prevent-delete.ts:37-65`), counting
non-cancelled transactions inside the caller's transaction. It covers hard delete; the trash action has
to run the same probe (reuse the hook's probe, or call it from the action) plus refuse
`status = 'szablon'`. History: `b95c4f9e` (2026-08-19) added the guard, `7728e424` (2026-08-28)
exempted cancelled rows; `investment-lock-on-completed` decision #8
(`context/archive/2026-08-28-investment-lock-on-completed/change.md:93-96`) deliberately added no lock
gate on deleting investments.

Race: a booking between the trash check and the write. Low risk at this scale, but the probe and the
update should share a transaction (`with-payload-transaction`) or the purge simply re-checks
(`payload.delete` → `beforeDelete`) and counts a hit as `blocked`.

### Hard delete — cascades and cache

FKs into `investments` (live `pg_constraint`):
- **CASCADE:** `kosztorys_items`, `kosztorys_sections`, `kosztorys_stages`, `kosztorys_snapshots`,
  `kosztorys_shares`, `kosztorys_client_view`, `investments_rels`, `payload_locked_documents_rels`;
  second level `stage_progress` (via items and stages).
- **SET NULL:** `transactions` (only cancelled ones can remain), `kosztoryses` (sheet record goes
  unlinked — `src/collections/sheets.ts:12`), `leads` (lead reverts to promotable), `equipment_events`.
- `media` rows and Blob bytes survive; nothing sweeps them today (102 orphans already locally).

Tags to expire by hand on hard delete (afterDelete only bumps `investments`):
`KOSZTORYS_TREE_TAGS` (`src/lib/cache/tags.ts:52`), `transfers`, `kosztoryses`, `leads`,
`equipmentEvents`, `entityTag('investment', id)`. On trash/restore: `investments`,
`entityTag('investment', id)` (gallery, `investment-assets` isn't tagged with the collection),
`kosztoryses` (sheets page names the investment), `leads`.

### Purge cron

- `vercel.json`: `cleanup 0 3`, `leads-reconcile 0 4`, `fleet-reminders 0 5`, `equipment-reminders 0 6`.
  Handlers `src/app/(payload)/api/cron/*/route.ts`, auth `isAuthorizedCronRequest`
  (`src/lib/cron/verify-cron-request.ts:13`), `revalidateTag(tag, EXPIRE_NOW)`.
- `cleanup/route.ts:8-10` is the designated home for sweeps; today it runs only `gcSnapshots` with no
  try/catch/`maxDuration`. `leads-reconcile/route.ts:45-51` is the partial-failure pattern.
- Purge step: select `trashed_at < now() - 30 days` AND no kosztorys items AND no snapshots; delete one
  by one via `payload.delete` (Neon parallel-create lesson); report
  `{ purged, skippedKosztorys, blocked, failed }`.
- `kosz-plikow` (status **planned**, no code in `src/`) plans the same route hardening, a `gcMedia`
  step that would sweep a purged investment's orphaned media 7 days later, and swapping cleanup to
  `30 3` so it runs after the FTP blob mirror.

### UI

- Listing actions column: only `<EditInvestmentDialog>` (`src/components/tables/investments.tsx:286-291`);
  owner gate already computed (`:87`). Row-action precedent: `PresetRowActions`
  (`src/components/presets/preset-row-actions.tsx`) with `DeleteButton` (`src/components/ui/row-actions/`)
  + `ConfirmDialog` (`src/components/ui/confirm-dialog.tsx`).
- **No type-the-name confirm exists** (grep found none). Closest: `FormDialogShell` + `Input` +
  `confirmDisabled` (rename in `preset-row-actions.tsx:49-67`).
- No trash UI anywhere; only „Przywróć" is kosztorys versions (`kosztorys-versions-drawer.tsx:126,165`).
  Trash view options: a „Kosz (N)" toggle beside the status filter in `investment-data-table.tsx`, fed
  by its own query that bypasses the refData exclusion.
- Investment page header (`src/app/(frontend)/inwestycje/[id]/page.tsx:74-76`) is the other natural
  „Usuń" spot.

### Leads and sheets

- Promoted lead links to `/inwestycje/{id}` (`src/components/leads/promote-lead-dialog.tsx:53-60`):
  trashed → dead link; purged → `leads.investment` NULL, lead becomes promotable again with its assets.
- Sheet (`kosztoryses`): trashed → `/kosztorysy` still shows it linked; purged → silently unlinked.

### Local DB sizing (dump 2026-09-23)

| id | name | status | items | versions | shares | media | lead | sheet | cancelled tx | purge |
|---|---|---|---|---|---|---|---|---|---|---|
| 157 | Dmytro Boryshkevych | planowana | 401 | 19 | 0 | 22 | – | – | 0 | manual |
| 137 | testowe inwestycje | active | 377 | 1 | 1 | 0 | – | – | 0 | manual |
| 138 | asDasdaSD | active | 373 | 1 | 0 | 0 | – | – | 0 | manual |
| 90 | kosztorys wzór… | active | 320 | 8 | 0 | 0 | – | 1 | 11 | manual |
| 155 | Dmytro Boryshkievich | active | 310 | 2 | 0 | 0 | – | – | 0 | manual |
| 156 | Monika Wróbel | active | 310 | 0 | 0 | 0 | – | – | 0 | manual |
| 151 | Warsztat szablonów | szablon | 310 | 104 | – | – | – | – | 0 | never |
| 17, 28, 89 | … | completed/active | 0 | 0 | 0 | 0 | – | – | 1/0/2 | auto |
| 154 | Ryszard Burkacki | planowana | 0 | 0 | 0 | 1 (shared with lead) | 1 | – | 0 | auto |

## Code References

- `src/collections/investments.ts:24-34,49,57` — transaction guard, delete access `isAdminOrOwner`
- `src/hooks/prevent-delete.ts:18-20,37-65` — `excludingCancelled`, `makePreventDelete`
- `src/lib/queries/reference-data.ts:64-73,109` — refData chokepoint, `active` derivation
- `src/lib/db/investment-gate.ts:25-73` — write gate
- `src/lib/actions/investment-action.ts:56-80` — gate consumer
- `src/lib/queries/preview-kosztorys.ts:61,117-143` — share token + owner preview
- `src/lib/actions/kosztorys-share.ts` — generate/rotate/revoke, ungated
- `src/app/(payload)/api/cron/cleanup/route.ts` — sweep home
- `src/lib/media/delete-unreferenced-media.ts:30,79-98` — media reclaim probe
- `src/components/tables/investments.tsx:87,286-291` — listing owner gate, actions column
- `src/components/presets/preset-row-actions.tsx` — row actions + rename-dialog precedent

## Architecture Insights

- **Choose the failure direction.** Payload trash fails _closed_ on reads (NotFound, missing
  references) and that cascades into a destructive path (media reclaim). A column filtered by hand
  fails _open_ (a trashed row shows) — visible and harmless. Where "forgot a filter" is the likely
  bug, pick the mechanism whose forgotten filter is cheap.
- **Hide at one chokepoint, lock at the gates.** refData hides; `investment-gate` locks. The existing
  „zakończona" lock already has exactly this shape — trash is a second reason for the same gate.
- **A cascade is a cache change** — hard delete owns the child tags.

## Historical Context (from prior changes)

- `context/changes/2026-09-22-kosz-plikow/change.md` — file trash; rejected Payload `trash` („2b")
  because raw SQL bypasses it; 7-day retention; `cleanup` cron as sweep home; deleting a whole
  document reclaims its files immediately (expense-invoice precedent).
- `context/archive/2026-08-28-investment-lock-on-completed/change.md:93-96` — no lock gate on
  investment delete; transaction guard is the protection.
- `context/foundation/roadmap.md:307-310`, `prd.md:322` — PRD Q4 „hard-delete" covers kosztorys
  items, not investments; no soft delete exists anywhere in the app today.
- `context/foundation/lessons.md` — „cascade deletes rows Payload never sees" (tags); „Status
  inwestycji to etykieta, nie bramka" (don't model trash as a status); „Where→SQL translator fails
  open".

## Related Research

- `context/changes/2026-09-22-kosz-plikow/research.md`

## Open Questions

1. **Media on hard delete/purge:** reclaim the investment's unshared files immediately (the
   expense-invoice precedent; Blob has no undelete, and 03:00 runs before the 03:30 FTP mirror), or
   leave them for `kosz-plikow`'s `gcMedia` (not built yet)?
2. **Opening a trashed investment:** 404 until restored (simplest — the trash row offers only
   „Przywróć" / „Usuń na zawsze"), or a read-only page with a „W koszu" banner?
3. **Lead after purge** reverts to promotable (SET NULL) — keep, or warn in the dialog?
4. **Sheet link:** name „arkusz Google" in the hard-delete dialog? Keep the sheet linked while trashed?
5. **Version GC while trashed:** should `gcSnapshots` pause for trashed investments, so a restore
   within 30 days returns the same version history?
6. **Auto-purge of cancelled transactions' pointers** (89: 2, 17: 1) — acceptable per
   `prevent-delete.ts:7-11`; confirm for a purge nobody clicks.
7. **Sequencing with `kosz-plikow`:** both touch `/api/cron/cleanup`; whichever lands first does the
   route hardening.
