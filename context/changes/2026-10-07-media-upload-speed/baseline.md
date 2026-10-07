# Baseline — worker expense-draft send („Wyślij" → dialog closed)

Measured 2026-10-07 on staging, before any EX-1012 code, under three network profiles. Repeat the
same protocol after the change and compare the medians.

## Summary — median click → dialog closed

| Profile | 1 photo | 3 photos | 6 photos | Server share at 6 photos¹ |
|---|---|---|---|---|
| Fast 4G (worst case) | 4 957 ms | 11 826 ms | 18 664 ms | 55 % (10.3 s) |
| Warsaw LTE | 3 729 ms | 7 188 ms | 11 899 ms | 81 % (9.6 s) |
| Unthrottled | 2 940 ms | 6 277 ms | 10 717 ms | 88 % (9.4 s) |

**After EX-1012** (same protocol, see [After EX-1012](#after-ex-1012)):

| Profile | 1 photo | 3 photos | 6 photos |
|---|---|---|---|
| Fast 4G (worst case) | 4 957 → **3 127 ms** (−37 %) | 11 826 → **6 975 ms** (−41 %) | 18 664 → **13 638 ms** (−27 %) |
| Warsaw LTE | 3 729 → **1 897 ms** (−49 %) | 7 188 → **5 216 ms** (−27 %)² | 11 899 → **3 957 ms** (−67 %) |
| Unthrottled | 2 940 → **1 525 ms** (−48 %) | 6 277 → **1 573 ms** (−75 %) | 10 717 → **2 634 ms** (−75 %) |

² Two of the three LTE 3-photo runs each had one slow upload of 5.0–5.5 s; the clean run took 2 344 ms.
With three runs the median does not absorb two outliers.

¹ The serialized `POST /api/media` chain (first media POST start → action start) plus the
`sendExpenseDraftAction` POST, over the window, in the median 6-photo run. These requests carry a tiny
JSON body, so their duration is server time. Token requests (~0.15 s, in parallel) are left out.

**The media-POST chain does not depend on the network.** It takes ~4.8 s for 3 photos and ~9.2–10.0 s for
6 photos (~1.6 s × N) under every profile. A faster link only shortens the upload part in front of it.
So on a good connection the send is almost entirely the per-photo server work the change targets.
A second, smaller floor: a solo Blob `PUT` of ~305 KB takes ~1.0–1.25 s even unthrottled. On the wire
that is ~0.2 s at the measured ~12 Mbps uplink, so ~1 s per PUT is Blob API overhead, not bandwidth.

## Protocol (common to all profiles)

| | |
|---|---|
| Target | `https://wykonczymy-git-staging-wykonczymys-projects.vercel.app` → deployment `dpl_AsotZdA4KNvey8Dcr7wWKziVdFcE` (created 2026-10-06 20:13), `staging` @ `3fcdefc8`; preview DB + preview Blob |
| Account | `qa-staging-worker@…` (user 85), page `/pracownicy/85`; kasa 54; inwestycja 137 „Etap 1" membership added by the OWNER through the UI |
| Viewport | 390 × 844 |
| Fixtures | 6 synthetic JPEGs (no PII), 4032×3024, q86, ~3.26 MB each; after pick-time compression **~305 KB each** (304 110–305 082 B, from the `size` field of `POST /api/media`) |
| Flow | „Dodaj wydatek" → `setInputFiles` → wait for „Wyślij" enabled → note `EX-1012 baseline Np HH:MM:SS` → click „Wyślij" |
| Window | capture-phase click listener on „Wyślij" (t0) → MutationObserver sees no open `[role=dialog]` (t1) |
| Runs | 1 warm-up (discarded) + 3 runs each at 1 / 3 / 6 photos, back to back |
| Per request | `page.on('request')` + `request.timing()`; start = ms after t0, dur = requestStart → responseEnd |
| Network | CDP `Network.emulateNetworkConditions`, set again at the start of every run; see each profile |

Harness and fixtures: `.playwright-mcp/bl/` (gitignored; `tmpl.js` Fast 4G, `tmpl2.js` LTE / unthrottled
with the delete step built in). Raw rows are in the session scratchpad and are not kept in the repo.

Ingest (pick → „Wyślij" enabled; compression, **outside** the window) does not depend on the profile:
1p 123–205 ms, 3p 294–514 ms, 6p 560–900 ms.

## Fast 4G — worst case

Measured 08:52–08:56. Throttle: latency 165 ms, down `9e6/8×0.9` B/s, up `1.5e6/8×0.9` B/s (≈1.35 Mbps
up). Profile check: a solo Blob PUT takes 2.7–3.4 s.

| Photos | Run 1 | Run 2 | Run 3 | **Median** |
|---|---|---|---|---|
| 1 | 6 446 | 4 910 | 4 957 | **4 957 ms** |
| 3 | 11 794 | 11 826 | 12 767 | **11 826 ms** |
| 6 | 18 323 | 19 242 | 18 664 | **18 664 ms** |

Warm-up (1 photo, discarded): 6 120 ms.

| Step | Requests | Duration | Notes |
|---|---|---|---|
| Token `POST /api/vercel-blob-client-upload-route` | 1 per photo | 170–310 ms | one cold outlier 2 934 ms (4th parallel token, 6p run 1) |
| Blob `PUT` | 1 per photo, ≤4 in parallel | solo 2.7–3.4 s · 3 parallel 6.3–6.9 s · 4 parallel 7.4–8.6 s | bandwidth-bound: parallel PUTs share the ≈1.35 Mbps uplink; photos 5–6 wait for a slot (2.9–3.8 s each) |
| `POST /api/media` | 1 per photo, **serialized** (`rowCreateQueue`) | 1.36–2.62 s, typically 1.5–1.8 s | tiny JSON body — pure server time |
| `sendExpenseDraftAction` | 1 | 184–354 ms | outliers 1 062 ms (first measured run), 604 ms |

| Photos | Token + PUTs (until first media POST) | Serialized media POSTs | Action |
|---|---|---|---|
| 1 | ~3.2 s | ~1.8 s | ~0.35 s |
| 3 | ~6.9 s | ~4.8 s (3 × ~1.6 s) | ~0.22 s |
| 6 | ~8.3 s | ~10.1 s (6 × ~1.7 s; PUTs 5–6 overlap the queue) | ~0.23 s |

## Warsaw LTE

Measured 09:10–09:13 in a freshly launched browser (no Chrome process left from the Fast 4G session).
Throttle: latency 50 ms, down 20 Mbps (`20e6/8` B/s), up 10 Mbps (`10e6/8` B/s).
Profile check:

- A solo Blob PUT takes 1.34–1.44 s, against 2.7–3.4 s on Fast 4G.
- A 1 MB `POST` probe takes 1 207 ms (6.6 Mbps), against 653 ms unthrottled.

| Photos | Run 1 | Run 2 | Run 3 | **Median** |
|---|---|---|---|---|
| 1 | 3 729 | 3 891 | 3 668 | **3 729 ms** |
| 3 | 7 188 | 6 852 | 8 277 | **7 188 ms** |
| 6 | 11 226 | 11 951 | 11 899 | **11 899 ms** |

Warm-up (1 photo, discarded): 7 714 ms (cold token 3 527 ms, action 856 ms).

| Step | Requests | Duration | Notes |
|---|---|---|---|
| Token | 1 per photo | 104–262 ms | one cold outlier 2 425 ms (3p run 2) |
| Blob `PUT` | 1 per photo, ≤4 in parallel | solo 1.34–1.44 s · 3 parallel 1.85–2.31 s · 4 parallel 1.76–2.37 s | photos 5–6: 1.25–1.86 s, hidden behind the media queue |
| `POST /api/media` | serialized | 1.06–2.28 s, typically 1.4–1.8 s | |
| `sendExpenseDraftAction` | 1 | 193–357 ms | |

| Photos | Token + PUTs (until first media POST) | Serialized media POSTs | Action |
|---|---|---|---|
| 1 | ~1.7 s | ~1.9 s | ~0.22 s |
| 3 | ~2.1 s | ~4.9 s | ~0.22 s |
| 6 | ~2.1 s | ~9.4 s | ~0.25 s |

## Unthrottled

Measured 09:14–09:17 in another freshly launched browser. CDP was set explicitly to `offline: false,
latency: 0, downloadThroughput: -1, uploadThroughput: -1` before the probe and before every run.
This is the machine's real link, not a lab line. Profile check:

- A 1 MB `POST` probe takes 653 ms (≈12.2 Mbps up).
- A 347 KB JS chunk (85 KB transferred) takes 65 ms.
- A solo Blob PUT takes 0.96–1.25 s.

| Photos | Run 1 | Run 2 | Run 3 | **Median** |
|---|---|---|---|---|
| 1 | 2 933 | 3 006 | 2 940 | **2 940 ms** |
| 3 | 6 240 | 6 458 | 6 277 | **6 277 ms** |
| 6 | 10 717 | 11 563 | 9 914 | **10 717 ms** |

Warm-up (1 photo, discarded): 3 008 ms.

| Step | Requests | Duration | Notes |
|---|---|---|---|
| Token | 1 per photo | 98–240 ms | one cold outlier 2 431 ms (6p run 1, delayed that photo's PUT) |
| Blob `PUT` | 1 per photo, ≤4 in parallel | solo 0.96–1.25 s · 3 parallel 1.13–1.48 s · 4 parallel 1.06–1.55 s | ~1 s floor per PUT that bandwidth does not explain |
| `POST /api/media` | serialized | 1.25–2.07 s, typically 1.35–1.75 s | |
| `sendExpenseDraftAction` | 1 | 172–263 ms | |

| Photos | Token + PUTs (until first media POST) | Serialized media POSTs | Action |
|---|---|---|---|
| 1 | ~1.4 s | ~1.4 s | ~0.19 s |
| 3 | ~1.4 s | ~4.8 s | ~0.19 s |
| 6 | ~1.3 s | ~9.2 s | ~0.22 s |

## Caveats

- **The Fast 4G session has no unthrottled control.** An extra „unthrottled" 6p run in that session
  (18 315 ms) was still throttled: the emulation persisted across CDP sessions on the same page.
  It is excluded. The LTE and unthrottled profiles were each measured in a freshly launched browser to
  avoid this, and each was checked by its solo PUT and the probes.
- The LTE upload cap (10 Mbps) is close to the real uplink (~12 Mbps). LTE and unthrottled therefore
  differ mostly by the added 50 ms latency and some upload headroom, not by an order of magnitude.
- The size of a Blob PUT body could not be captured (`postDataBuffer` is null). The compressed size comes
  from the media POST's `size` field.
- The `router.refresh()` RSC requests fire **after** the dialog closes and are outside the window.
- Each profile had one cold-function outlier (a token request of 2.4–3.5 s, or an action of ~1 s).
  The medians absorb them.
- Vercel function logs were not pulled. Per-request server time is the duration the browser observed.

## Cleanup

All 30 drafts (`EX-1012 baseline …`: 10 per profile, warm-ups included) were deleted through the worker
UI: „Usuń" → „Usunąć wydatek?" → „Usuń". `/pracownicy/85` shows none.

During the Fast 4G cleanup the drafts list did **not** update after a successful delete: the row
stayed until a full reload. The LTE / unthrottled harness reloads after every delete, so it neither
confirms nor rules this out on a fast link. All 20 of its deletes were confirmed after the reload. This
bug is not in EX-1012's scope.

Not checked: whether a deleted draft's media rows and Blob objects are removed. The OWNER-granted etap
membership on inwestycja 137 was left in place for the after-change run.

## After EX-1012

Measured 2026-10-07 12:08–12:21 (CEST) against the branch preview, not staging: the branch was pushed
on its own (`media-upload-speed` @ `74272259`) and served at
`https://wykonczymy-git-media-upload-speed-wykonczymys-projects.vercel.app`. That is the same preview
DB, preview Blob store, account, fixtures, harness and throttle profiles as the baseline. The only code
difference from the measured staging is EX-1012.

What changed in the harness:

- Requests to `POST /api/media-upload` are classified as `fast`.
- The tag is `EX-1012 after …`.
- It runs as a standalone Playwright script, with one freshly launched Chrome per profile, instead of
  the shared MCP browser, which another session held. The script is `scratchpad/run-after.mjs`
  (not kept).
- Vercel deployment protection is passed with the project's automation bypass cookie, set once on
  `/login`.

Every send in all 30 runs (warm-ups included) went through the fast path: one `POST /api/media-upload`
per photo and then the action. There was no token request, no Blob `PUT` from the browser and no
`POST /api/media`.

| Profile | Photos | Run 1 | Run 2 | Run 3 | **Median** | Warm-up |
|---|---|---|---|---|---|---|
| Warsaw LTE | 1 | 1 768 | 1 897 | 2 047 | **1 897 ms** | 1 804 |
| | 3 | 5 765 | 5 216 | 2 344 | **5 216 ms** | |
| | 6 | 3 957 | 5 270 | 3 912 | **3 957 ms** | |
| Unthrottled | 1 | 1 435 | 1 525 | 1 719 | **1 525 ms** | 1 810 |
| | 3 | 4 375 | 1 560 | 1 573 | **1 573 ms** | |
| | 6 | 2 579 | 4 517 | 2 634 | **2 634 ms** | |
| Fast 4G | 1 | 3 127 | 3 100 | 3 371 | **3 127 ms** | 3 423 |
| | 3 | 6 885 | 7 053 | 6 975 | **6 975 ms** | |
| | 6 | 13 493 | 13 638 | 17 966 | **13 638 ms** | |

| Step | LTE | Unthrottled | Fast 4G |
|---|---|---|---|
| `POST /api/media-upload`, 1 photo | 1.50–1.82 s | 1.25–1.49 s | 2.90–3.16 s |
| same, 3–4 in parallel | 1.7–2.7 s | 1.0–1.6 s | 6.4–8.9 s (shared ≈1.35 Mbps uplink) |
| `sendExpenseDraftAction` | 170–393 ms | 167–236 ms | 177–252 ms |

- **Uploads run in parallel, at most four at once.** The client caps them at 4, so photos 5–6 start
  when the first slots free up, and the 6-photo send is two waves. On LTE and unthrottled that is
  ~2.2 s + ~1.4 s. The cap stays at 4 (review gate, 2026-10-07): the second wave costs ~1.4 s only on
  fast links, which already send 6 photos in 2.6–4 s, while on Fast 4G — where a send hurts — the
  uplink is the floor and more parallel uploads would only split it.
- **Fast 4G is now bound by the uplink.** 6 × ~305 KB is ~1.83 MB, which takes ~10.8 s at
  ≈1.35 Mbps. The 13.6 s median is close to that floor. Before EX-1012, the serialized server chain was
  stacked on top of the upload.
- **The server side of one upload is mostly the Blob put.** 50 `[PERF] mediaUpload` lines from
  `vercel logs --branch media-upload-speed`:

  | | min | p50 | p90 | max |
  |---|---|---|---|---|
  | total | 572 ms | 928 ms | 1 175 ms | 5 454 ms |
  | Blob put | 559 ms | 914 ms | 1 140 ms | 5 442 ms |
  | DB insert | 12 ms | 13 ms | 54 ms | 73 ms |

  The old per-photo `POST /api/media` took ~1.6 s. The fast path's server cost is now ~0.9 s, and it
  runs in parallel instead of in series.
- **Outliers.** Six runs had one upload of 4.1–5.5 s. One of them shows in the log as a 5.4 s Blob
  put. The others have no log line in the window (the log pull returned 50 of the ~95 uploads), so
  a cold function instance is the likely cause but not confirmed. When it hits, one slow upload sets
  the whole send's time. The baseline had the same kind of outlier on the token request.

Cleanup: all 30 drafts were deleted through the worker UI. The harness confirmed 21 deletes after a
reload. The remaining 9 were checked by a second pass, which found 2 still listed, deleted them, and
then `/pracownicy/85` showed no `EX-1012` row. One of those two had been reported as gone by the
harness's own reload and then showed up again. This is the stale drafts-list behaviour noted under
Cleanup above, and it is outside EX-1012's scope.
