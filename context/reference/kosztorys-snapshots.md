# Kosztorys snapshots — kinds, retention, readers

A snapshot is a frozen copy of one investment's whole kosztorys: sections, pozycje, etapy, progress,
settings and the rabat. There are four kinds. They differ in what creates them, who sees them, and how
long they live. Checked against the code on 2026-10-20; times are Warsaw summer time (CEST).
Interactive version: https://claude.ai/artifact/XtKGG6NrvGmsPyVYu8DWMh (private).

## The four kinds

| Kind     | Taken                                                                                                                                                                                                                                                                           | By                                              | Seen in                                                                                               | Lives                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `auto`   | Every 10 min while the editor is open, only if something changed since the last one. Also right **before** a risky step: deleting a pozycja, section or etap, a bulk rabat, text cleanup, layout reorder, applying the katalog, accepting a worker report, restoring a version. | The editor and the server, on the user's behalf | „Wersje" (automatic group). The investor link uses it only for days before the first nightly capture. | Age bands: every one for 30 days, one per day to 120, one per week to 365, then deleted. |
| `daily`  | Once a night for each open investment not in the trash, only if that day's kosztorys differs from the previous nightly one. Dated 23:59:59 of the day it describes.                                                                                                             | Cron `/api/cron/daily-snapshots`                | Investor link history (one entry per changed day), and „Wersje".                                      | Depends on the investment's status (below).                                              |
| `named`  | When someone clicks „Zapisz wersję" and names it.                                                                                                                                                                                                                               | A person                                        | „Wersje" (named group), and every one in the investor link history.                                   | Same as `daily`: depends on status.                                                      |
| `manual` | Right before the whole kosztorys is replaced, with a fixed label: „Przed importem z arkusza Google", „Przed wczytaniem: <szablon>", „Przed wyczyszczeniem".                                                                                                                     | The server, as part of that action              | „Wersje" (named group) only. Never shown to the investor.                                             | 365 days, then deleted. No thinning before that.                                         |

## One day of an investment

Automatic copies come in bursts while people work (none during idle stretches, since nothing changed).
The crons run on UTC: nightly capture at 23:15, cleanup at 03:30 — 01:15 and 05:30 in Warsaw summer
time, one hour earlier in winter. The nightly copy is dated the end of the previous day, so it always
describes the day that just ended.

## What each status does

`auto` and `manual` age out the same way for every investment. `daily` and `named` are the investor's
history, so they follow the investment's status instead.

| Status                     | Nightly copy taken? | `daily` + `named`                                                                        | `auto` + `manual`           |
| -------------------------- | ------------------- | ---------------------------------------------------------------------------------------- | --------------------------- |
| Wycena, Planowana, Aktywna | yes                 | Kept forever                                                                             | Age bands, gone at 365 days |
| Zakończona                 | no                  | Kept 365 days after the completion date, then all deleted together                       | Age bands, gone at 365 days |
| Odrzucona                  | no                  | Deleted at the next cleanup, whatever their age (from the first deploy after 2026-10-20) | Age bands, gone at 365 days |
| In the trash (any status)  | no                  | Everything goes with the investment when the trash is purged, 30 days after trashing     | same                        |

A Zakończona investment with no completion date (completed before the date was recorded) keeps its
history forever — the rule compares against a date that doesn't exist.

## Three investments, start to finish

**An offer that's rejected**

1. Wycena for 3 weeks. Nightly copies build up on the days it changed, plus a „Zapisz wersję" before sending.
2. Status set to Odrzucona. Nightly copies stop.
3. Next cleanup: every nightly and named copy is deleted. The investor link still opens and shows the
   current kosztorys with no history.
4. Automatic and safety copies stay in „Wersje" and age out within a year.

**A job that's completed**

1. Aktywna for 5 months. One nightly copy per changed day.
2. Status set to Zakończona. The completion date is recorded, nightly copies stop, the kosztorys becomes read-only.
3. For a year the investor can still browse the full history.
4. 365 days after completion, the next cleanup deletes all its nightly and named copies at once.

**A completed job that's reopened**

1. Zakończona, completed 8 months ago.
2. The owner sets it back to Aktywna for a correction.
3. The expiry no longer applies, because it only checks Zakończona. The history is kept again, and
   nightly copies resume that night.
4. A rejected offer moved back to Wycena is different: whatever the cleanup already deleted stays deleted.

## The same rows, two views

**„Wersje" drawer in the editor**

- Every stored row, newest first, in two groups: Nazwane wersje (`named` + `manual`) and automatic (`auto` + `daily`).
- Any of them can be restored. A restore first saves the current state as a new `auto`, so a restore can itself be undone.

**History on the investor link**

- At most one entry per day: that day's `daily`. For days before the first nightly copy existed, the last `auto` of the day.
- Today's automatic copies are never shown, because the day isn't over.
- Every `named` version is shown; `manual` never is.
- A day identical to the previous entry is skipped.

## Template snapshots

Szablony keep their own copies in a separate table: `auto` from the 10-minute editor timer, `named` from
„Zapisz wersję", and `manual` before a layout is replaced. The same age bands apply to their auto and
safety copies. There's no nightly capture and no status rule, so a template's named versions are kept
forever.

## Sources

- `src/lib/db/snapshots.ts` — band constants, every DELETE
- `src/lib/kosztorys/snapshot-gc.ts` — cleanup order
- `src/lib/kosztorys/capture-daily-snapshots.ts` — nightly capture
- `src/components/kosztorys/editor/hooks/use-auto-snapshot.ts` — 10-minute timer
- `src/lib/kosztorys/replace-tree-with-snapshot.ts` — safety copies
- `src/lib/kosztorys/history/select-history-entries.ts` — investor history
- `vercel.json` — cron schedules; `src/app/(payload)/api/cron/cleanup/route.ts` — cleanup cron
