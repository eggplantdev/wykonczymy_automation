# Vercel Blob Backup & Recovery Runbook (EX-459)

> **Status:** IN PROGRESS — living document, update as we go.
> **Linear:** [EX-459](https://linear.app/ex-plant/issue/EX-459) · **Started:** 2026-07-13
> **Purpose:** Invoice/receipt files live in Vercel Blob with zero backup. Blob has no
> versioning / no undelete / no PITR — `del()` and overwrite are permanent. These are
> tax-retained faktury (~5yr). This doc is both the build plan AND the recovery procedure,
> written so it is usable _during_ an incident, not just before one.

---

## 0. TL;DR recovery (read this first in an incident)

The transaction↔receipt mapping lives in the **DB**, not the Blob. The Blob holds only bytes.
So recovery = **restore DB dump** (already backed up hourly to FTP) **+ re-upload the blob
backup by filename**. No URL rewriting is needed (see §2).

```
1. Restore the DB dump (Neon → FTP, hourly)          → gives media rows + invoice_id FKs
2. Re-upload every backup file into the target store  → put(filename, bytes, addRandomSuffix:false)
3. Open a transaction, confirm its invoice renders    → done
```

Full step-by-step in **§5**.

---

## 1. The mapping model (why recovery works)

The link between a transaction and its receipt is a **foreign key in Postgres**, not anything
stored in Blob:

```
transactions.invoice_id  →  media.id  →  media.filename  ==  blob pathname  ==  backup file
     (DB dump)               (DB dump)     (DB dump)            (Blob)            (snapshot)
```

- Everything left of "Blob" is a **column in the DB dump** you already back up hourly.
- The Blob only supplies the **bytes**, keyed by `filename`.
- Lose the Blob → you lose bytes, never the mapping. The DB still knows which `filename`
  belongs to which transaction.

| Backup                                | Holds                                | Answers                                        |
| ------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| **DB dump** (exists, hourly Neon→FTP) | `invoice_id`, `media.id`, `filename` | _which_ receipt belongs to _which_ transaction |
| **Blob snapshot** (this task)         | the bytes, keyed by `filename`       | _what the receipt actually is_                 |

**Both are required; neither alone recovers a usable system.**

---

## 2. Verified facts (as of 2026-07-13)

All verified against code + the local dump DB (5433). Re-verify before trusting during an incident.

### Blob store

- **~1771 blobs, ~174.3 MB total** (dry-run `list`, 2026-07-13; count drifts as invoices are
  uploaded — it moved 1767→1771 within minutes, confirming the store is live).
- Files: faktura PDFs + `next/image` resized derivatives (`<base>-400x300.jpg`, thumbnails).
- Access is **public** — bytes fetchable by URL with no token (Payload plugin default).

### `media` table (source of truth for the mapping)

- **940 rows, 940 distinct `filename`, 0 duplicates, 0 null** → mapping is 1:1.
- FK into it: **`transactions.invoice_id → media.id`** (note: DB table is `transactions`,
  not `transfers` — the collection slug differs from the table name).
- **`media.url` is RELATIVE:** `/api/media/file/<filename>` — **not** an absolute blob URL.
  Payload resolves bytes at request time via the _current_ store token. **The store host
  appears nowhere in the DB.** → **No URL rewrite is ever needed on restore**, same store or new.
- Join keys that matter: **`filename`** and **`sizes_thumbnail_filename`**. `url` /
  `sizes_thumbnail_url` are filename-derived and travel unchanged.

### Filename uniqueness (why keying by filename is safe)

1. **Blob keys are unique by definition** — a store cannot hold two blobs at one pathname
   (a `put` to an existing key _overwrites_). So `list()` = distinct pathnames, guaranteed.
2. **`appendShortId`** (`src/lib/utils/append-short-id.ts`, added ~2026-07) splices a 6-char
   random id before the extension at the sole upload boundary (`uploadFile` +
   `uploadFileClient`): `faktura.pdf → faktura-3f9a2c.pdf`. Prevents one upload overwriting
   another (threat #2) at write time. Pre-`appendShortId` rows were kept unique by Payload's
   auto-rename-on-collision — verified: all 940 existing rows are unique.

### Config invariant (MUST hold on restore)

- `src/payload.config.ts` → `vercelBlobStorage({ collections: { media: true }, token: BLOB_READ_WRITE_TOKEN })`.
- **`addRandomSuffix` is deliberately NOT set.** On restore you MUST re-upload with
  `addRandomSuffix: false`, else the key becomes `filename-xxxx ≠ media.filename` and
  `/api/media/file/<filename>` 404s.

### Known pre-existing gaps (not caused by us, not blockers)

- **3 media rows point at already-missing blobs** (`id` 429, 580, 581 — old WhatsApp images).
  **0 transactions reference them** → harmless orphans. The snapshot cannot include them
  (already gone from the store). Documented so they aren't mistaken for backup failures.

---

## 3. Token & safety model

- Vercel Blob has **no read-only store token** — one long-lived `BLOB_READ_WRITE_TOKEN` per
  store, always read+write. `issueSignedToken({operations:['get','head']})` exists but is
  per-pathname and can't `list`, so it can't enumerate the store.
- **Safety comes from the calls, not the token.** The snapshot passes the RW token to exactly
  **one read-only call — `list()`** (no destructive variant). The download loop uses anonymous
  `fetch()` on public URLs, no credential. `put` / `del` / `copy` / `empty-store` are never
  imported. Direction is strictly one-way: Vercel → local disk.

---

## 4. Implementation flow (phases)

### Phase 1 — Manual snapshot (NOW, the immediate safety net)

- Script: `context/changes/blob-backup/blob-snapshot.mjs` (one-off, hand-run). **Dependency-free**
  — Node built-ins + the Blob REST API only, so it runs even if `node_modules` is broken (a
  recovery tool must not depend on the thing that might be broken).
- REST `list` (read-only) → anonymous `fetch` each blob → write to `~/backups/wykonczymy-blob/blob-snapshot-<stamp>/`.
- Writes `_manifest.json` (pathname + url + size per blob) alongside the files.
- **Gate:** dry-run `list()` first (done — 1767 files), then download on explicit go.
- Output home is **durable + outside the repo** (not scratchpad, not `/tmp`).

### Phase 2 — Automate (GitHub Actions → FTP)

**Decisions (locked 2026-07-13):** separate workflow (not bolted onto the hourly db-backup) ·
daily cron · manifest-diff incremental (not per-file skip-if-exists).

Reuses the existing FTPS plumbing from `.github/workflows/db-backup.yml` (LFTP over FTPS,
secrets `FTP_HOST/USER/PASS`). New secret required: **`BLOB_READ_WRITE_TOKEN`** — in CI it
still only feeds `list()`; downloads stay anonymous.

**FTP layout (mirror-only, append-only):**

```
/blob_backups/media/<pathname>          # cumulative mirror of every blob ever seen
/blob_backups/manifests/manifest-<stamp>.json   # timestamped index (join key = filename)
```

- **NO retention/prune on `media/`** — unlike db-backup's 30-day prune. A backed-up invoice
  is NEVER deleted, even if it vanishes from Vercel (that is the whole point / threat #1).
  Manifests may be pruned; files never.

**Daily run flow:**

1. LFTP: pull the latest `manifest-*.json` from FTP → the set of already-backed-up pathnames.
2. Node: `list()` Vercel (read-only) → current pathnames. `new = current − known` (in-memory
   diff; ~3 FTP round-trips, not 1771). Download only `new` blobs (anonymous fetch) to a local
   `new/` dir. Emit an updated manifest = union of all pathnames + metadata.
3. LFTP: upload the `new/` files into `/blob_backups/media/` + upload the new manifest.
4. **Validate (mirror db-backup's paranoia):** blob-count floor (catches an empty/wrong
   `list()`), and completeness — every Vercel pathname must now exist in the manifest. Refuse
   and fail loudly on anomaly. Mirror-only means the backup count only ever grows.

**Seeding:** the first CI run would re-download all 1771. We already have that snapshot locally
(`blob-snapshot-20260713-114932`) — optionally seed FTP from it once so run #1 is a near-noop.

**Time-alignment (threat #3):** separate daily workflow = looser coupling to the DB dump.
Handled by the timestamped manifests (reconcile DB dump time ↔ nearest manifest), not by
coupling the jobs. Bounded to same-day uploads by daily cadence + immutable invoices.

### Phase 3 — Restore drill against a preview store (the acceptance test)

Rehearse recovery on a **throwaway target**, never prod:

1. Stand up a **separate preview Blob store**, bound via a preview-scoped `BLOB_READ_WRITE_TOKEN`
   (the config reads `process.env.BLOB_READ_WRITE_TOKEN`, so per-env token = per-env store).
2. Seed the preview DB from the **same prod dump** used for the backup (so preview `media`
   filenames match the snapshot; time-aligned).
3. Re-upload the backup into the preview store (`addRandomSuffix: false`).
4. **Acceptance:** open a preview transaction → its invoice **renders** (main file AND
   thumbnail via `sizes_thumbnail_filename`). "Files exist" is not the bar; "it renders" is.

**Representativeness note:** the drill is a _full populate into an empty store_ (total-loss
path — the stricter case). A real threat-#1 incident (one bad `del()`) is a _partial_ loss
repaired by re-putting only the missing keys — same mechanic. Because `media.url` is relative
(§2), same-store partial repair and new-store full rebuild are the **same operation**:
put-by-filename, no URL rewrite.

---

## 5. Recovery runbook (step-by-step)

**Trigger:** blobs lost/deleted/corrupted; `media.url` (`/api/media/file/...`) 404s.

**Preconditions:** you have (a) a DB dump and (b) a blob backup dir with `_manifest.json`,
ideally time-aligned.

1. **Restore the DB** (if the DB is also lost) from the latest Neon→FTP dump. Skip if only
   the Blob was lost and the DB is intact.
2. **Pick the target store** and its `BLOB_READ_WRITE_TOKEN`:
   - Same-store repair (partial loss) → prod store token.
   - New store (account/project loss) → new store token; also set it as the app's env var.
3. **Re-upload the backup**, for every file in the snapshot:
   ```js
   put(filename, bytes, { access: 'public', addRandomSuffix: false, token })
   ```

   - `addRandomSuffix: false` is **mandatory** (§2 config invariant).
   - Mirror-only: for a partial loss, uploading files that already exist just overwrites with
     identical bytes — safe. Never `del()`.
4. **No DB URL rewrite** — `media.url` is relative and filename-resolved (§2). Do not touch it.
5. **Verify:** open a transaction whose `invoice_id` is set → invoice renders. Spot-check a
   thumbnail (`sizes_thumbnail_filename`) too. Optionally reconcile: every
   `media.filename` now resolves (200) against the store.

**Time-alignment caveat:** if the DB dump is _newer_ than the blob backup, a just-uploaded
invoice's `media` row exists but its bytes aren't in the older snapshot → that one receipt is
unmappable until the next snapshot. Bounded to same-day uploads by the daily cadence +
immutable invoices. Phase 2's paired manifest+dump timestamp minimizes it.

---

## 6. Progress log

- **2026-07-13** — Investigation + this runbook. Verified store size (~1771/174MB), mapping
  model, relative `media.url`, filename uniqueness (940/940), 3 harmless orphans, config
  invariant. Phase 1 script written (dependency-free, ESLint-ignored per repo precedent) +
  dry-run passed.
- **2026-07-13** — **Phase 1 DONE.** First manual snapshot taken:
  `~/backups/wykonczymy-blob/blob-snapshot-20260713-114932/` — **1771/1771 files, 0 failures,
  174.30 MB**, `_manifest.json` written. Verified 3 ways (script tally = manifest = files on
  disk). Immediate safety net now exists.
- **2026-07-13** — **Phase 2 built** (not yet live). Decisions: separate workflow · daily ·
  Rung-3 manifest-diff. Files:
  - `scripts/blob-mirror.mjs` — incremental mirror (list → diff vs prev manifest → download
    new → merged manifest → floor+completeness validation). Dependency-free. **Verified live:**
    ran against the morning manifest, store had grown 1771→1781, downloaded exactly the 10 new
    files, merged manifest to 1781, passed. ESLint-ignored per repo precedent.
  - `.github/workflows/blob-backup.yml` — daily 03:30 UTC (off the hourly db window),
    `workflow_dispatch → test/` gate. FTPS pull-manifest → run script → `mirror -R` (additive,
    no `--delete`, no prune) new files + manifest.
  - Needs GitHub secret **`BLOB_READ_WRITE_TOKEN`** (+ existing FTP secrets).
  - FTP confirmed reachable; `/blob_backups/` does not exist yet (fresh); server is SHARED with
    another project (`/db_backups_chaoskitchen/`).
  - **Pending: manual seed** of `/blob_backups/media/` + `/blob_backups/manifests/` from the
    Phase-1 snapshot, so CI run #1 is a small delta, not a 1771-file cold start.
- **2026-07-13** — **Manual seed DONE.** Uploaded the Phase-1 snapshot to FTP:
  `/blob_backups/media/` now holds **1771 files** (1770 flat + 1 under `kosztorys/` — a real
  blob-pathname prefix, matches the local snapshot's structure), and
  `/blob_backups/manifests/manifest-20260713-114932.json` is the baseline manifest. CI run #1
  will now be a small delta. Verified: FTP top-level count = local snapshot top-level count.
  Two lftp gotchas hit + solved (recorded here so CI/recovery don't relearn them):
  - **Passive mode required behind local NAT.** Without `set ftp:passive-mode on` lftp fell back
    to active (PORT) and hung on the data channel. Fixed locally; also added to the workflow's
    upload step.
  - **`mirror -R <dir> <remote>` nests** (recreates `<dir>`'s basename → `media/media/`). Fix:
    `lcd` into the source and `mirror -R . <remote>` so files land flat. The initial seed nested;
    repaired server-side with fast dir renames (no re-upload). **Workflow upload step corrected to
    the `lcd .` idiom** so the daily CI run won't reproduce the nesting.
- **2026-07-13** — **`BLOB_READ_WRITE_TOKEN` secret added** to repo `eggplantdev/wykonczymy_automation`
  (Vercel Blob has no scoped read-only token — the rw token is used, but only ever feeds `list()`;
  downloads are anonymous). Branch `worktree-ex-459-blob-backup` pushed.
- **2026-07-13** — **Local end-to-end test PASS.** Ran the exact CI pipeline by hand into
  `/blob_backups/test/` (seeded `test/manifests/` with the baseline first, so it's a small delta,
  not a cold start): mirror script listed Vercel (1783), diffed vs baseline (1771 known), downloaded
  the **12**-file delta, merged manifest → 1783, floor+completeness OK; upload landed all 12 **flat**
  in `test/media/` (confirmed no `media/media/`), manifest in `test/manifests/`. Two more gotchas
  caught + fixed here:
  - `workflow_dispatch` can't run until the workflow file is on the **default branch** — GitHub
    gates the dispatch trigger on `main`. So the CI dispatch test can only happen post-merge; the
    pre-merge confidence comes from this local run.
  - **Manifest `put` path broke after the `lcd`.** `lcd ./blob-out/media` changes lftp's *local*
    cwd, so the following `put ./blob-out/manifest-*.json` resolved to `blob-out/media/blob-out/...`
    (ENOENT) — the manifest silently wouldn't upload. Fix: **`put` the manifest BEFORE the `lcd`.**
    Workflow corrected. (Also caught: my local harness missed `set xfer:clobber on`, so `get` of
    prev.json no-op'd and forced a full seed — the workflow already has that flag; harness-only.)
- **Still owed:** open PR → merge to `main` → `workflow_dispatch` (defaults to `test/`) to confirm
  green on the GitHub runner (Node 24 + `apt lftp`) → clean up `/blob_backups/test/`.
