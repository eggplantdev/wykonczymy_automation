# Artifact 1 — Territory (git history)

> Wide Scan / activity signal for the Project Map. Evidence from `git log` over the
> **full repo history** (first commit 2026-02-11 → 2026-07-08, 975 commits). Because the
> repo is only ~5 months old, "last 12 months" = its entire life. Noise filtered:
> lockfiles, `payload-types.ts` (gitignored, generated), dumps, `.env`, `.json`, `.md`.
>
> This is the git-activity anchor `artifact-2-structure.md` was missing (it was run
> structure-first). Read them together: structure says _what depends on what_; this says
> _what actually gets touched_.

## Key observations

1. **The app is a transfers/finance engine first, everything else second.** The single
   most-churned file in the repo is `lib/actions/transfers.ts` (71 commits), and the
   transfer theme repeats across every layer of the top-10 files: action
   (`actions/transfers.ts` 71), constants (`constants/transfers.ts` 45), form
   (`transfer-form.tsx` 43), SQL (`db/sum-transfers.ts` 41), table (`tables/transfers` 40).
   The AGENTS.md warning that transfer business logic is the delicate core is confirmed by
   raw activity, not just by design intent.

2. **Two route pages are the real gravity wells:** `inwestycje/[id]/page.tsx` (63 commits,
   spans 52 distinct areas) and `kasa/[id]/page.tsx` (43 commits, 51 areas). These
   detail pages compose nearly the whole app — touch almost anything and one of them moves.
   They are the highest-blast-radius _editing_ surfaces (distinct from the highest-blast
   _dependency_ leaves like `lib/utils/cn.ts`, which artifact-2 covers).

3. **Work has moved in clear phases, not evenly.** Feb–Mar was a forms/UI/routes build-out
   burst (forms 344, ui 264, app 303). May pivoted hard to **Google Sheets integration**
   (`lib/google` 33, `components/sheets` 16, `actions` 57 — the kosztorys/sheets work).
   July's active front is **leads** (`lib/leads` 41 — the Facebook Lead Ads pipeline) plus a
   `components/ui` refresh (107). The hot area is a moving target; recency matters more than
   lifetime totals for "what's live right now."

4. **`__tests__` couples to actions and queries above all else** (75 co-changes with
   `lib/actions`, 52 with `lib/queries`). Tests here track the server/data layer, barely the
   UI — consistent with the repo's Vitest-on-financial-logic posture. New action/query work
   should expect to move a test in the same commit.

5. **Structure already drifted from reality once, today.** `lib/tables/*` was moved to
   `components/tables/*` in `a8691df` (2026-07-08 13:48), so `artifact-2-structure.md`
   originally referenced a dead `lib/tables/transfers.tsx` path. **Resolved:** artifact-2 was
   re-cruised the same day and now reflects the move (plus the `lib/cn.ts → lib/utils/cn.ts`
   relocation and the re-routed Payload cycle).

## Activity — where the project was really touched

### Top areas (whole history, `.ts`/`.tsx`, noise filtered)

| Area                               | Commits | Note                                                         |
| ---------------------------------- | ------- | ------------------------------------------------------------ |
| `components/forms`                 | 435     | TanStack-Form heaviest surface; forms are the app's UI spine |
| `components/ui`                    | 409     | Shadcn primitives; big July refresh                          |
| `lib/queries`                      | 222     | Server-side fetch / cached reference data                    |
| `lib/actions`                      | 219     | Mutations via `protectedAction()`                            |
| `components/transfers`             | 154     | Transfer tables/filters/buttons                              |
| `components/dialogs`               | 136     | Modal layer (tightly coupled to forms)                       |
| `lib/tables` → `components/tables` | 120     | **moved 2026-07-08** (`a8691df`)                             |
| `components/dashboard`             | 117     | Manager dashboard + tables                                   |
| `app/(frontend)/inwestycje`        | 110     | Investment detail — top route                                |
| `lib/constants`                    | 64      | Transfer-type union lives here                               |
| `lib/db`                           | 60      | Raw-SQL financial calc (money path)                          |
| `lib/google`                       | 56      | Sheets integration                                           |
| `app/(frontend)/kasa`              | 58      | Cash-register detail                                         |
| `app/(frontend)/uzytkownicy`       | 53      | User detail                                                  |
| `lib/leads`                        | 41      | FB Lead Ads pipeline (July)                                  |

### Top individual files

| File                                               | Commits | Distinct areas co-touched |
| -------------------------------------------------- | ------- | ------------------------- |
| `lib/actions/transfers.ts`                         | 71      | —                         |
| `app/(frontend)/inwestycje/[id]/page.tsx`          | 63      | 52                        |
| `components/dashboard/manager-dashboard.tsx`       | 48      | —                         |
| `lib/constants/transfers.ts`                       | 45      | —                         |
| `lib/queries/reference-data.ts`                    | 43      | —                         |
| `components/forms/transfer-form/transfer-form.tsx` | 43      | —                         |
| `app/(frontend)/kasa/[id]/page.tsx`                | 43      | 51                        |
| `lib/db/sum-transfers.ts`                          | 41      | —                         |
| `components/investments/financial-stats.tsx`       | 39      | —                         |
| `lib/actions/sheets-sync.ts`                       | 32      | —                         |
| `lib/actions/settlements.ts`                       | 32      | —                         |
| `lib/google/sheets.ts`                             | 31      | —                         |

## Activity over time — how the emphasis shifted

| Window              | Dominant areas (commits)                                                 | Theme                                     |
| ------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| Feb–Mar (build-out) | forms 344 · app 303 · ui 264 · queries 162 · transfers 120 · dialogs 108 | Core CRUD + forms + transfer engine       |
| Apr (lull)          | forms 33 · app 19 · actions 11                                           | Slow month; polish                        |
| May (Sheets)        | app 77 · actions 57 · google 33 · sheets 16                              | **Google Sheets / kosztorys integration** |
| Jun (mixed)         | ui 31 · app 21 · forms 20 · constants 19 · google 14                     | Settlements + Sheets follow-through       |
| Jul (leads + UI)    | ui 107 · leads 41 · forms 33 · queries 29 · actions 26                   | **FB Leads pipeline** + UI refresh        |

## Co-changes — what moves together

### Directory couplings (files changed in the same commit)

| Pair                                      | Co-commits | Reading                                                |
| ----------------------------------------- | ---------- | ------------------------------------------------------ |
| `__tests__` ↔ `lib/actions`               | 75         | Tests guard mutations — strongest coupling in the repo |
| `__tests__` ↔ `lib/queries`               | 52         | Tests guard the data layer                             |
| `app/(frontend)` ↔ `lib/queries`          | 52         | Pages are server components that fetch directly        |
| `app/(frontend)` ↔ `components/ui`        | 50         | Route work drags primitive tweaks                      |
| `components/forms` ↔ `lib/actions`        | 44         | A form and its server action ship together             |
| `lib/actions` ↔ `lib/queries`             | 40         | Mutate-then-invalidate/read pairing                    |
| `components/dialogs` ↔ `components/forms` | 39         | Dialogs wrap forms — near-inseparable                  |
| `lib/queries` ↔ `lib/tables`              | 37         | Table needs its query (pre-move path)                  |

The action↔query↔form↔dialog cluster is the app's true working unit: a feature change
rarely stays inside one of them.

### Common-denominator files (touched across the most distinct areas)

These are "everything drags them" files — the ones a wide-reaching change ripples into.
High area-count with **low** intrinsic risk (generated/framework) vs high risk are marked:

| File                                                                   | Distinct areas | Kind                                                               |
| ---------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------ |
| `app/(frontend)/inwestycje/[id]/page.tsx`                              | 52             | Composition hub (hand-edited) — real coupling                      |
| `app/(frontend)/kasa/[id]/page.tsx`                                    | 51             | Composition hub (hand-edited) — real coupling                      |
| `components/ui/url-pagination.tsx`                                     | 50             | Shared primitive reused everywhere                                 |
| `app/(frontend)/layout.tsx`                                            | 48             | Root layout / env build-gate (AGENTS.md)                           |
| `migrations/index.ts`                                                  | 47             | **Regeneration coupling** — cheap, mechanical; not a design signal |
| `components/ui/select.tsx` / `button.tsx` / `label.tsx` / `dialog.tsx` | 38–40          | Base primitives; matches artifact-2 high-Ca leaves                 |
| `lib/queries/investments.ts`                                           | 38             | Investment data hub feeding both top route pages                   |

`migrations/index.ts` spans many areas only because every migration re-exports through it —
that's regeneration, not hand-editing, and should be weighted as near-free coupling in the
synthesis (per the M4L2 rule about generated vs hand-edited change).

## Existence check — coupled files that no longer exist

- `lib/tables/transfers.tsx` — **GONE**, moved to `components/tables/transfers.tsx`
  (`a8691df`, 2026-07-08). Any analysis quoting the `lib/tables/*` path (including
  artifact-2) is stale as of today.
- All other top-ranked files verified present.

## Unknowns (what git history cannot show)

- **Churn ≠ importance and ≠ risk.** A file edited 71× may be volatile-by-design (an active
  feature) or a pain point; git can't tell which. Cross-reference artifact-2's stability
  metrics before concluding "fragile."
- **Squashed / rewritten history** would undercount early work; this repo looks linear but
  the count is a floor, not a census.
- **The Sheets and Payload-admin planes are under-represented** — much of the Sheets logic
  runs against live Google APIs and the Payload admin is config-driven; neither shows its
  true weight in file churn.
- **Author attribution not analyzed here** — that's artifact-3 (contributors).
