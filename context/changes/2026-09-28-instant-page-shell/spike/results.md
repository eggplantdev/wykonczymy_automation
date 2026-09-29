# EX-877 spike — run 1 (loaded machine)

2026-09-28, 20:24–21:02. `next start` production builds: baseline `d4301ba8` on :3100, spike (titled
`loading.tsx` + `DetailPageLoading` + mobile-nav mount prefetch) on :3101. Interleaved, 1 warm-up +
7 runs per target, median ms from the click. 420 rows, 0 errors. Raw run dumps are not kept — `measure-nav.mjs` regenerates them.

**Caveat:** load average 32 at start, 4–14 through the run, and a stray duplicate run shared the
machine until 20:31 (first ~11 local scenarios). Rerun on a quiet machine before quoting numbers.

- **title** — the target page's h1 is on screen (detail routes: any new h1)
- **ready** — on the target path, title shown, no 🚧 loader left

## local (no throttling)

| Scenario                       | Baseline title = ready | Spike title | Spike ready |
| ------------------------------ | ---------------------- | ----------- | ----------- |
| desktop → /inwestycje          | 126                    | 72          | 139         |
| desktop → /kasy                | 80                     | 67          | 80          |
| desktop → /zgloszenia          | 333                    | 69          | 103         |
| desktop → /kosztorysy          | 129                    | 68          | 130         |
| desktop → /katalog-prac        | 341                    | 70          | 342         |
| desktop → /szablony            | 78                     | 69          | 76          |
| desktop → /flota               | 75                     | 66          | 79          |
| desktop → /sprzet              | 328                    | 72          | 81          |
| desktop → /pracownicy          | 73                     | 68          | 94          |
| desktop → / (dashboard)        | 183                    | 68          | 196         |
| row /kasy → /kasa/[id]         | 190                    | 194         | 194         |
| row /sprzet → /sprzet/[id]     | 330                    | 329         | 329         |
| mobile drawer → /inwestycje    | 383                    | 23          | 371         |
| mobile drawer → /szablony      | 60                     | 32          | **350**     |
| mobile quick tap → /inwestycje | 370                    | 22          | 375         |

## slow4g (150 ms RTT, 1.6 Mbps down)

| Scenario                       | Baseline title = ready | Spike title | Spike ready |
| ------------------------------ | ---------------------- | ----------- | ----------- |
| desktop → /inwestycje          | 550                    | 64          | 553         |
| desktop → /kasy                | 487                    | 73          | 479         |
| desktop → /zgloszenia          | 479                    | 68          | 481         |
| desktop → /kosztorysy          | 541                    | 73          | 558         |
| desktop → /katalog-prac        | 743                    | 71          | 763         |
| desktop → /szablony            | 478                    | 68          | 478         |
| desktop → /flota               | 478                    | 72          | 477         |
| desktop → /sprzet              | 478                    | 68          | 478         |
| desktop → /pracownicy          | 493                    | 67          | 481         |
| desktop → / (dashboard)        | 637                    | 67          | 637         |
| row /kasy → /kasa/[id]         | 690                    | 689         | 689         |
| row /sprzet → /sprzet/[id]     | 635                    | 639         | 639         |
| mobile drawer → /inwestycje    | 569                    | 26          | 575         |
| mobile drawer → /szablony      | 483                    | 27          | 482         |
| mobile quick tap → /inwestycje | 566                    | 21          | 575         |

## Reading

- **List routes: the title is instant everywhere.** Spike title is 21–73 ms (≈ one frame + click
  handling) on every list route, desktop and mobile, both profiles — independent of the network.
  Baseline waits for the whole page: 73–743 ms, ~480–740 ms on slow4g.
- **Ready is unchanged.** Spike ready tracks baseline within noise; the titled fallback adds no
  measurable cost. The local-profile outliers where the spike is faster (/zgloszenia, /sprzet) are
  load noise.
- **Detail routes (row click) are unchanged, as designed.** The record name only arrives with the
  page, so they gain the placeholder bar, not an earlier title.
- **Mobile drawer quick tap (100 ms after opening) is covered** — see run 2.
- **Mobile /szablony local ready 350 vs 60** did not survive run 2 (61 vs 335 the other way): noise.
- **Instrument gap:** `feedback` is blank on row /sprzet for both targets (main's first child never
  swaps there) — not a regression.

## Run 2 — mobile-nav mount prefetch dropped (2026-09-29 06:43, load ≈ 9)

Run 1's spike carried a `router.prefetch` of every nav link on `MobileNav` mount, so it could not show
the drawer links prefetch on their own. Rebuilt without it, mobile scenarios only.

| Scenario                       | Profile | Baseline title = ready | Spike title | Spike ready |
| ------------------------------ | ------- | ---------------------- | ----------- | ----------- |
| mobile drawer → /inwestycje    | local   | 372                    | 25          | 367         |
| mobile drawer → /szablony      | local   | 335                    | 35          | 61          |
| mobile quick tap → /inwestycje | local   | 364                    | 27          | 374         |
| mobile drawer → /inwestycje    | slow4g  | 565                    | 27          | 574         |
| mobile drawer → /szablony      | slow4g  | 485                    | 30          | 482         |
| mobile quick tap → /inwestycje | slow4g  | 565                    | 28          | 577         |

The title is still instant on a tap 100 ms after opening: the closed drawer's links are prefetched on
page load (its panel sits inside the 200 px IntersectionObserver margin, and `visibility: hidden`
doesn't stop the observer). The mount prefetch was redundant and is not shipped.
