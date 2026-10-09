# Baseline — upload forms on the slow path (bulk expense, gallery, large invoice)

Measured 2026-10-07 on staging, before any EX-1014 code, under two network profiles. Repeat the
same protocol after the change and compare the medians.

## Summary — median t0 → success notice

| Profile                    | 1 · Bulk expense, 4 invoiced rows | 2 · 10 photos into the gallery | 3 · One 6.4 MB PDF onto an invoice cell |
| -------------------------- | --------------------------------- | ------------------------------ | --------------------------------------- |
| Warsaw LTE                 | 9 981 ms                          | 21 576 ms                      | 11 344 ms                               |
| Unthrottled                | 9 277 ms                          | 20 808 ms                      | 6 949 ms                                |
| Server share, LTE¹         | 81 % (8.1 s)                      | 86 % (18.5 s)                  | 31 % (3.5 s)                            |
| Server share, unthrottled¹ | 87 % (8.0 s)                      | 89 % (18.5 s)                  | 51 % (3.6 s)                            |

¹ The serialized `POST /api/media` chain (first media POST start → action start) plus the form's
server action, over the window, in the median run. Token requests (~0.1–0.2 s, in parallel) are left
out.

**The serialized `POST /api/media` chain sets the time for scenarios 1 and 2, and it does not depend
on the network.** It takes ~7.0–7.3 s for 4 files and ~16.6–18.2 s for 10 files under both profiles:
~1.75 s per file, one at a time, as in the EX-1012 baseline. LTE and unthrottled differ by less than
1 s in both scenarios. Only scenario 3 is bound by the network: one 6.4 MB Blob `PUT` takes ~7.5 s on
LTE and ~3.2 s unthrottled. Its single `POST /api/media` still costs 2.5–3.3 s, more than a photo's,
since the server works on the whole 6.4 MB file.

**The dialog closes at once in every scenario, so the success notice is the end of the window.**
The bulk expense form submits optimistically: the dialog closes 8–12 ms after the „Zapisz" click,
and the uploads and the action run after it. The gallery and invoice-cell upload dialog closes
2–4 ms after the pick and hands the upload to the surface. A „dialog closed" t1 would measure
nothing, so t1 is the success toast for all three scenarios (see [Caveats](#caveats)).

## Protocol (common to all profiles)

|             |                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target      | `https://wykonczymy-git-staging-wykonczymys-projects.vercel.app` → deployment `dpl_5gewWaxhBRyrc8XbaWAizN8Yw1jL` (created 2026-10-07 13:50, Ready 13:54 CEST), `staging` @ `e935a89f`; preview DB + preview Blob. EX-1012 is merged here (`911d3e68`), but only the worker-draft surfaces use its fast path.                                                                                                                 |
| Account     | the fixed staging OWNER `qa-staging@wykonczymy.test` (user 68), desktop                                                                                                                                                                                                                                                                                                                                                      |
| Viewport    | 1440 × 900                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Test data   | investment 184 „EX-1014 baseline" (active), kasa 54 „QA-1001 Kasa pracownika"; target transfer #5411 „EX-1014 baseline PDF target" (1,00 zł, `INVESTMENT_EXPENSE`) for scenario 3                                                                                                                                                                                                                                            |
| Fixtures    | 10 synthetic JPEGs (no PII), 4032×3024: `fixture-1..6` from EX-1012 (~3.26 MB) plus `fixture-7..10` made with the same generator (3.09–3.24 MB, q86). After pick-time compression **~305 KB each** (291 759–305 082 B, from the `size` field of `POST /api/media`). One synthetic PDF 1.4, `ex1014-baseline-6mb.pdf`, **6 438 870 B**, two pages of embedded JPEGs (fixtures 7 and 8); PDFs are not compressed at pick time. |
| Runs        | 1 warm-up (discarded) + 3 runs per scenario, back to back, scenario order 3 → 2 → 1                                                                                                                                                                                                                                                                                                                                          |
| Per request | `page.on('request')` + `request.timing()`; start = ms after t0, dur = requestStart → responseEnd                                                                                                                                                                                                                                                                                                                             |
| Network     | CDP `Network.emulateNetworkConditions`, set again at the start of every run; see each profile                                                                                                                                                                                                                                                                                                                                |

| Scenario                                   | Flow                                                                                                                                                                                                                                                                                                               | t0                                                                                          | t1                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------- |
| 1 · Bulk expense, 4 invoiced rows          | From `/inwestycje/184`, top bar „Wydatek" → „Nowy wydatek" (Inwestycja prefilled) → Kasa „QA-1001" → „Dodaj pozycję" ×3 → per row Kwota `1`, Opis `EX-1014 baseline 4r <profile> HH:MM:SS #n`, one JPEG (fixtures 1–4) in the row's FV input → wait until 4 previews show and „Zapisz" is enabled → click „Zapisz" | capture-phase click on „Zapisz"                                                             | toast „Transakcje dodane" |
| 2 · 10 photos into the gallery             | `/inwestycje/184` with an empty gallery → „Dokumentacja inwestycji (brak plików)" → „Dodaj zdjęcia lub pliki" → `setInputFiles` with fixtures 1–10                                                                                                                                                                 | capture-phase `change` on the file input (there is no confirm step: the pick is the submit) | toast „Pliki dodane"      |
| 3 · One PDF over 4 MB onto an invoice cell | `/inwestycje/184`, transfers table, row „EX-1014 baseline PDF target" → „Dodaj fakturę" → `setInputFiles` with the PDF                                                                                                                                                                                             | capture-phase `change` on the file input (no confirm step)                                  | toast „Faktura dodana"    |

The scenario 2 gallery is emptied and the scenario 3 invoice removed through the UI after every
run, so each run starts from the same state.

Harness: a standalone Playwright script with one freshly launched Chrome per profile, in the session
scratchpad (`ex1014/h/run.mjs`, `common.mjs`, `cleanup.mjs`; not kept). It does not use the shared
MCP browser. Vercel deployment protection is passed with the project's automation bypass cookie, set
once on `/login`; login is `POST /api/users/login` from the page.

Ingest in scenario 1 (pick → „Zapisz" enabled; compression of 4 photos, **outside** the window):
575–670 ms, under both profiles. In scenario 2 the compression of 10 photos is **inside** the window:
pick → first token request takes 1.04–1.59 s on LTE and 1.15–1.19 s unthrottled.

## Warsaw LTE

Measured 14:05–14:10 (CEST) in a freshly launched browser. Throttle: latency 50 ms, down 20 Mbps
(`20e6/8` B/s), up 10 Mbps (`10e6/8` B/s). Profile check: the solo 6.44 MB PDF `PUT` takes
7.18–7.85 s (≈6.6–7.2 Mbps effective). EX-1012's LTE 1 MB probe measured 6.6 Mbps.

| Scenario                 | Run 1  | Run 2  | Run 3  | **Median**    | Warm-up |
| ------------------------ | ------ | ------ | ------ | ------------- | ------- |
| 1 · Bulk expense, 4 rows | 9 881  | 10 335 | 9 981  | **9 981 ms**  | 10 898  |
| 2 · 10 photos, gallery   | 21 576 | 22 463 | 20 494 | **21 576 ms** | 21 133  |
| 3 · 6.4 MB PDF, invoice  | 13 038 | 10 502 | 11 344 | **11 344 ms** | 11 462  |

| Step                                              | Requests                                      | Duration                                                       | Notes                                                     |
| ------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| Token `POST /api/vercel-blob-client-upload-route` | 1 per file                                    | 96–201 ms                                                      |                                                           |
| Blob `PUT` (photo)                                | 1 per photo, ≤4 in parallel                   | 4 parallel 1.85–2.61 s · photos 5–10 one at a time 1.23–1.92 s | photos 5–10 are hidden behind the media queue (see below) |
| Blob `PUT` (6.4 MB PDF)                           | 1                                             | 7.18–7.85 s                                                    | bandwidth-bound                                           |
| `POST /api/media`                                 | 1 per file, **serialized** (`rowCreateQueue`) | photo 1.29–2.33 s, typically 1.6–1.9 s · PDF 2.50–3.33 s       | tiny JSON body: pure server time                          |
| Scenario 1 action (bulk create)                   | 1                                             | 765–1 051 ms                                                   |                                                           |
| Scenario 2 action (attach to gallery)             | 1                                             | 519–608 ms                                                     |                                                           |
| Scenario 3 action (attach invoice)                | 1                                             | 635–2 035 ms                                                   | two of three runs ~2.0 s                                  |

| Scenario (median run) | Pick ingest | Token + PUTs (until first media POST) | Serialized media POSTs | Action  |
| --------------------- | ----------- | ------------------------------------- | ---------------------- | ------- |
| 1 · 4 rows            | outside     | ~2.3 s                                | ~7.0 s (4 × ~1.75 s)   | ~1.05 s |
| 2 · 10 photos         | ~1.0 s      | ~2.2 s                                | ~18.0 s (10 × ~1.8 s)  | ~0.52 s |
| 3 · PDF               | —           | ~8.0 s                                | ~2.9 s                 | ~0.64 s |

## Unthrottled

Measured 14:10–14:14 (CEST) in another freshly launched browser. CDP was set explicitly to
`offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1` before every run. This is
the machine's real link, not a lab line. Profile check: the solo 6.44 MB PDF `PUT` takes 3.01–3.87 s
(≈13–17 Mbps).

| Scenario                 | Run 1  | Run 2  | Run 3  | **Median**    | Warm-up |
| ------------------------ | ------ | ------ | ------ | ------------- | ------- |
| 1 · Bulk expense, 4 rows | 9 328  | 9 277  | 8 962  | **9 277 ms**  | 8 444   |
| 2 · 10 photos, gallery   | 20 808 | 19 787 | 21 234 | **20 808 ms** | 21 637  |
| 3 · 6.4 MB PDF, invoice  | 6 949  | 6 160  | 7 729  | **6 949 ms**  | 6 905   |

| Step                                  | Requests                    | Duration                                                       | Notes                                                              |
| ------------------------------------- | --------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Token                                 | 1 per file                  | 96–198 ms                                                      |                                                                    |
| Blob `PUT` (photo)                    | 1 per photo, ≤4 in parallel | 4 parallel 1.21–1.82 s · photos 5–10 one at a time 0.97–2.07 s | ~1 s floor per PUT that bandwidth does not explain (as in EX-1012) |
| Blob `PUT` (6.4 MB PDF)               | 1                           | 3.01–3.87 s                                                    |                                                                    |
| `POST /api/media`                     | serialized                  | photo 1.38–3.18 s, typically 1.6–1.8 s · PDF 2.60–3.34 s       |                                                                    |
| Scenario 1 action (bulk create)       | 1                           | 791–979 ms                                                     |                                                                    |
| Scenario 2 action (attach to gallery) | 1                           | 529–777 ms                                                     |                                                                    |
| Scenario 3 action (attach invoice)    | 1                           | 508–580 ms                                                     |                                                                    |

| Scenario (median run) | Pick ingest | Token + PUTs (until first media POST) | Serialized media POSTs | Action  |
| --------------------- | ----------- | ------------------------------------- | ---------------------- | ------- |
| 1 · 4 rows            | outside     | ~1.5 s                                | ~7.3 s (4 × ~1.8 s)    | ~0.79 s |
| 2 · 10 photos         | ~1.2 s      | ~1.3 s                                | ~18.0 s (10 × ~1.8 s)  | ~0.53 s |
| 3 · PDF               | —           | ~3.5 s                                | ~3.1 s                 | ~0.51 s |

## How the 10-photo upload runs

The client starts four uploads, and each upload slot is held until that file's `POST /api/media`
returns. The media POSTs are serialized, so after the first wave the slots free up one at a time,
every ~1.75 s. Photos 5–10 each start their token and `PUT` right after the previous media POST
ends, and those PUTs finish while the queue is still working on earlier files. Only the first wave's
PUTs (~1.3–2.6 s) are on the critical path. The rest of the window is the media queue: 10 × ~1.75 s.
More upload parallelism or more bandwidth would not shorten it.

## Caveats

- **t1 is the success toast, not „dialog closed".** The plan's scenario 1 window ends at „dialog
  closed", but the non-prefill expense form uses the optimistic submit: it closes 8–12 ms after the
  click and runs the uploads and `createBulkTransferAction` after that. The upload dialog of
  scenarios 2–3 also closes as soon as it has files. The harness records both times. Only the toast
  marks the work done. The toast appears when the action resolves, so it is the user's own signal.
- **No confirm step in scenarios 2–3.** The pick submits, so t0 is the file input's `change` event.
  Pick-time compression is inside those windows (~1.0–1.6 s for 10 photos, none for the PDF), while
  in scenario 1 it happens before the click and is outside.
- **Request start offsets are approximate.** The start time comes from the Node-side `request`
  event, compared with a wall clock taken just before the click or `setInputFiles`. In every run the
  action's computed end lands 0.12–0.35 s after the toast, so starts are recorded up to ~0.3 s late.
  Durations come from `request.timing()` and are not affected. The phase tables are rounded with that
  in mind.
- **Fixtures 7–10 are new.** EX-1012 had six JPEGs; four more were made with the same generator
  (different seeds) to reach 10. All ten compress to ~305 KB, so the per-file work is comparable.
- **The PDF is ~6.4 MB of embedded JPEG data** in a minimal valid PDF 1.4 (with an xref table; Payload
  rejects a PDF without one). It is over the 4 MiB route-body cap on purpose: after EX-1014 it takes
  the browser `PUT` + `POST /api/media-register` path, not the fast path.
- **What is on staging.** EX-1012 is merged, so `POST /api/media-upload` exists, but not one request
  in these runs used it. Every file took token → Blob `PUT` → serialized `POST /api/media`. That is
  the path EX-1014 replaces.
- **Throttle persistence.** As in EX-1012, CDP emulation persists across CDP sessions on one page, so
  each profile ran in its own freshly launched browser. Both were checked by the PDF `PUT`.
- The LTE upload cap (10 Mbps) is close to the real uplink (~13–17 Mbps by the PDF PUT), so for the
  photo scenarios the two profiles differ mostly by the added latency.
- Cold-function outliers: the scenario 3 attach action took ~2.0 s in two LTE runs, against
  ~0.5–0.6 s elsewhere. One unthrottled gallery media POST took 3.18 s. The medians absorb them.
- Before the measured runs, one unthrottled dry run (one pass per scenario, 14:01–14:03) checked the
  harness: 9 511 / 22 029 / 7 032 ms. It is not counted.
- Vercel function logs were not pulled. Per-request server time is the duration the browser observed.

## Cleanup

All through the OWNER UI on `/inwestycje/184`:

- **Bulk expense (scenario 1):** 36 transfers `EX-1014 baseline 4r …` (16 LTE, 16 unthrottled,
  warm-ups included, plus 4 from the dry run). For each, the invoice was removed in the cell preview
  („Usuń" → „Czy na pewno chcesz usunąć fakturę?" → „Usuń"), and then the transfer was cancelled
  („Anuluj transakcję", reason `EX-1014 baseline cleanup`, „Tak, anuluj"). The UI has no delete for
  transfers, so this leaves 36 cancelled transfers and 36 `CANCELLATION` audit rows on investment 184.
  A read-only query on the preview DB confirms that none of them has an invoice attached.
- **Gallery (scenario 2):** emptied by the harness after every run („Dokumentacja inwestycji (10)" →
  „Usuń wszystkie" → confirm). One leftover photo from setting up the harness was removed the same way.
  Investment 184 has no gallery files.
- **Invoice cell (scenario 3):** the PDF was removed after every run through the cell preview
  („Usuń" → confirm). Transfer #5411 has no invoice.

Left behind:

- Investment 184 „EX-1014 baseline" (active) and transfer #5411 „EX-1014 baseline PDF target"
  (1,00 zł, not cancelled), kept for the Phase 3 run. An investment that holds transfers cannot be
  trashed (`investmentDeleteBlocker`).
- **Three `media` rows that nothing references:** ids 2148, 2208 and 2218, all `fixture-5-….jpg`,
  created at 14:06:54, 14:11:35 and 14:12:06 (CEST) during gallery runs. No relation table points at
  them, so no UI can reach them. Every gallery run reported 10 attached files and 10 `201` media
  POSTs, and the other rows were removed on „Usuń wszystkie". So why these three survived (an extra
  row per run, or a reclaim that missed one) is open. It was not investigated here, and they were
  left in place.

## After EX-1014

Measured 2026-10-07, 14:48–14:55 (CEST), same protocol as the baseline above (same harness with the
target URL and request matchers changed, same OWNER account, investment 184, transfer #5411, fixtures,
viewport, profiles, scenario order 3 → 2 → 1, 1 warm-up + 3 runs, t0/t1 definitions). Standalone
Playwright script, one freshly launched Chrome per profile, not the shared MCP browser.

|             |                                                                                                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target      | `https://wykonczymy-git-media-upload-other-forms-wykonczymys-projects.vercel.app` → deployment `dpl_GcYkkycoPepGz6yYjRYrDdnE84py` (created 13:59, Ready, preview), branch `media-upload-other-forms` @ `81e2a1be` (`githubCommitSha`). Preview DB + preview Blob, as in the baseline. |
| Commit note | `db234b52` (the baseline doc) is on top locally and was not on origin when the deployment was built; it only touches docs, so the code served is the same.                                                                                                                            |

Every request matched the expected shape: **no `POST /api/media` in any run.**

| Scenario                 | Requests per run                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 1 · Bulk expense, 4 rows | 4 × `POST /api/media-upload` (all four start together) → 1 form action. No token, no Blob `PUT`.                |
| 2 · 10 photos            | 10 × `POST /api/media-upload` in waves of 4 + 4 + 2 → 1 action. No token, no Blob `PUT`.                        |
| 3 · 6.4 MB PDF           | token `POST /api/vercel-blob-client-upload-route` → browser Blob `PUT` → `POST /api/media-register` → 1 action. |

All requests returned 2xx; no error toasts; every run showed the success toast.

### Warsaw LTE

Same throttle as the baseline (latency 50 ms, down 20 Mbps, up 10 Mbps, set at the start of every
run). Profile check: the solo 6.44 MB PDF `PUT` takes 7.17–7.73 s (baseline 7.18–7.85 s).

| Scenario                 | Run 1 | Run 2 | Run 3 | **Median**   | Warm-up |
| ------------------------ | ----- | ----- | ----- | ------------ | ------- |
| 1 · Bulk expense, 4 rows | 2 970 | 3 296 | 5 150 | **3 296 ms** | 3 122   |
| 2 · 10 photos, gallery   | 7 075 | 7 282 | 7 384 | **7 282 ms** | 8 642   |
| 3 · 6.4 MB PDF, invoice  | 9 630 | 8 895 | 8 176 | **8 895 ms** | 10 048  |

| Step                                         | Requests                   | Duration                   | Notes                                                                           |
| -------------------------------------------- | -------------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| `POST /api/media-upload` (photo, scenario 1) | 4, all parallel            | 2.00–4.50 s, median 2.22 s | the 4.50 s is one outlier (run 3, 5 150 ms total); the other 11 are 2.00–2.59 s |
| `POST /api/media-upload` (photo, scenario 2) | 10 per run, ≤4 in parallel | 1.21–2.67 s, median 2.08 s | first wave 2.0–2.7 s, second wave ~1.9–2.1 s, last two ~1.4 s (they run alone)  |
| Token (scenario 3)                           | 1                          | 106–178 ms                 |                                                                                 |
| Blob `PUT` (6.4 MB PDF)                      | 1                          | 7.17–7.73 s                | bandwidth-bound, unchanged                                                      |
| `POST /api/media-register` (PDF)             | 1                          | 415–677 ms                 | baseline `POST /api/media` for the PDF: 2.50–3.33 s                             |
| Scenario 1 action (bulk create)              | 1                          | 741–809 ms                 |                                                                                 |
| Scenario 2 action (attach to gallery)        | 1                          | 429–847 ms                 |                                                                                 |
| Scenario 3 action (attach invoice)           | 1                          | 624–1 203 ms               |                                                                                 |

| Scenario (median run) | Pick ingest                   | Upload requests                              | Action  |
| --------------------- | ----------------------------- | -------------------------------------------- | ------- |
| 1 · 4 rows            | outside (709–1 010 ms)        | ~2.2 s (4 in parallel)                       | ~0.76 s |
| 2 · 10 photos         | ~1.1 s (pick → first request) | ~5.5 s (waves 4 + 4 + 2)                     | ~0.47 s |
| 3 · PDF               | —                             | token 0.1 s + `PUT` ~7.7 s + register ~0.6 s | ~0.85 s |

### Unthrottled

Another freshly launched browser, CDP set explicitly to no throttle before every run. Profile check:
the solo PDF `PUT` takes 2.84–3.11 s (baseline 3.01–3.87 s).

| Scenario                 | Run 1 | Run 2 | Run 3 | **Median**   | Warm-up |
| ------------------------ | ----- | ----- | ----- | ------------ | ------- |
| 1 · Bulk expense, 4 rows | 3 206 | 2 299 | 2 382 | **2 382 ms** | 3 121   |
| 2 · 10 photos, gallery   | 6 432 | 8 593 | 6 530 | **6 530 ms** | 5 748   |
| 3 · 6.4 MB PDF, invoice  | 3 855 | 3 970 | 4 281 | **3 970 ms** | 4 124   |

| Step                                         | Requests                   | Duration                   | Notes                                   |
| -------------------------------------------- | -------------------------- | -------------------------- | --------------------------------------- |
| `POST /api/media-upload` (photo, scenario 1) | 4, all parallel            | 1.43–2.47 s, median 1.52 s |                                         |
| `POST /api/media-upload` (photo, scenario 2) | 10 per run, ≤4 in parallel | 0.85–2.20 s, median 1.38 s |                                         |
| Token (scenario 3)                           | 1                          | 114–155 ms                 |                                         |
| Blob `PUT` (6.4 MB PDF)                      | 1                          | 2.84–3.11 s                |                                         |
| `POST /api/media-register` (PDF)             | 1                          | 402–479 ms                 | baseline `POST /api/media`: 2.60–3.34 s |
| Scenario 1 action (bulk create)              | 1                          | 740–907 ms                 |                                         |
| Scenario 2 action (attach to gallery)        | 1                          | 456–721 ms                 |                                         |
| Scenario 3 action (attach invoice)           | 1                          | 517–613 ms                 |                                         |

| Scenario (median run) | Pick ingest                                          | Upload requests                               | Action  |
| --------------------- | ---------------------------------------------------- | --------------------------------------------- | ------- |
| 1 · 4 rows            | outside (809–1 186 ms)                               | ~1.5 s (4 in parallel)                        | ~0.90 s |
| 2 · 10 photos         | ~2.0 s (pick → first request; 1.5–4.2 s across runs) | ~4.2 s (waves 4 + 4 + 2)                      | ~0.55 s |
| 3 · PDF               | —                                                    | token 0.15 s + `PUT` ~3.0 s + register ~0.4 s | ~0.59 s |

### Server timings (`vercel logs`)

From the deployment's `[PERF]` lines, 14:48–14:55. The CLI returns at most 50 lines per query, so
`mediaUpload` is a sample (50 of ~110 requests) and `mediaRegister` is complete (8 of 8: four runs
per profile).

| Log line                             | n   | Fields (min – median – max)                                                  |
| ------------------------------------ | --- | ---------------------------------------------------------------------------- |
| `[PERF] mediaUpload`                 | 50  | `put` (Blob) 582 – 1 002 – 1 906 ms, `insert` 11 – 13 – 957 ms               |
| `[PERF] mediaRegister` (6 438 870 B) | 8   | `head` 205 – 227 – 413 ms, `range` 78 – 83 – 95 ms, `insert` 11 – 12 – 32 ms |

The photo's server time is the Blob `put` (~1 s); the row `insert` is ~12 ms, against the ~1.75 s the
serialized Payload `POST /api/media` took per photo. The rest of the ~2 s the browser sees per photo
is the 305 KB upload plus latency while four run in parallel.

### Before → after, median t0 → success notice

| Profile     | Scenario                 | Before    | After    | Δ ms    | Δ %     |
| ----------- | ------------------------ | --------- | -------- | ------- | ------- |
| Warsaw LTE  | 1 · Bulk expense, 4 rows | 9 981 ms  | 3 296 ms | −6 685  | −67.0 % |
| Warsaw LTE  | 2 · 10 photos            | 21 576 ms | 7 282 ms | −14 294 | −66.2 % |
| Warsaw LTE  | 3 · 6.4 MB PDF           | 11 344 ms | 8 895 ms | −2 449  | −21.6 % |
| Unthrottled | 1 · Bulk expense, 4 rows | 9 277 ms  | 2 382 ms | −6 895  | −74.3 % |
| Unthrottled | 2 · 10 photos            | 20 808 ms | 6 530 ms | −14 278 | −68.6 % |
| Unthrottled | 3 · 6.4 MB PDF           | 6 949 ms  | 3 970 ms | −2 979  | −42.9 % |

Scenarios 1 and 2 lost the serialized `POST /api/media` chain (7–18 s) and the token + browser `PUT`
leg; what is left is one parallel batch of `media-upload` calls plus the action. Scenario 3 is still
bound by the one Blob `PUT` (7.2–7.7 s on LTE, 2.8–3.1 s unthrottled); the saving is the registration,
2.5–3.3 s before and 0.4–0.7 s after. The attach action did not change.

### Caveats

- The 10-photo window includes pick-time compression, so the unthrottled gallery runs vary with it
  (pick → first request 1.5 s, 4.2 s, 2.0 s in runs 1–3); run 2 (8 593 ms) is the one that waited on
  compression, not on the network.
- LTE scenario 1 run 3 (5 150 ms) holds one `media-upload` call of 4.5 s against 2.0–2.6 s for the
  other 11. The median absorbs it.
- The warm-up of scenario 2 on LTE (8 642 ms) is slower than the runs after it; discarded, as before.
- Request start offsets are approximate in the same way as in the baseline (Node-side `request`
  event); durations come from `request.timing()`.
- One new unreferenced `media` row appeared (see Cleanup).

### Cleanup

All through the OWNER UI on `/inwestycje/184`, as in the baseline:

- **Bulk expense (scenario 1):** 32 transfers `EX-1014 after 4r …` (16 LTE + 16 unthrottled, warm-ups
  included). Invoice removed in the cell preview, then the transfer cancelled with reason
  `EX-1014 after cleanup`. One cleanup pass timed out on a cancel dialog and was resumed for the last
  six; a read-only query on the preview DB confirms all 32 are cancelled and none has an invoice
  attached. That leaves 32 cancelled transfers and 32 `CANCELLATION` rows on investment 184, on top
  of the baseline's 36.
- **Gallery (scenario 2):** emptied by the harness after every run; investment 184 has 0 gallery files.
- **Invoice cell (scenario 3):** PDF removed after every run; transfer #5411 is not cancelled and has
  no invoice.

Left behind: investment 184 and transfer #5411 (kept). **One new `media` row that nothing references:**
id 2349, `fixture-7-fdda4a927ec9.jpg`, created 14:54:04 (CEST) during the unthrottled gallery runs
(checked against all eight tables with a `media_id` foreign key, read-only). None appeared in the
LTE block or in scenarios 1 and 3. Together with the baseline's 2148, 2208 and 2218 that is four such
rows, so the cause of the occasional unreferenced row is still open and was not investigated here
(the gallery runs attached 10 files and returned 10 × `200` every time).
