# Shared investment overview + reference data provider — Plan Brief

> Full plan: `context/changes/2026-10-20-investment-overview-shared/plan.md`
> Research: `context/changes/2026-10-20-investment-overview-shared/research.md`

## What & Why

The investment page and the kosztorys „Inwestycja" tab show the same investment through two drifted copies; the
tab lacks Zamów, Umowa, Arkusz, Kierownik budowy, editable status and trashed handling. Zamów needs the reference
data, which today only the layout's `Navigation` and individual pages fetch and drill down. Hoisting it into a
provider lets every client component read it through a hook, and lets one `InvestmentOverview` serve both views.

## Starting Point

`Navigation` awaits `fetchReferenceData()` for management roles and hands it to `TopNav`; ~15 pages fetch the
same cached object again and pass slices as props. Flight serializes it once per request. The page block lives
inline in `inwestycje/[id]/page.tsx:71-134`.

## Desired End State

Reference data and order settings arrive once per management page via a provider; all client consumers use
hooks. The investment page and the kosztorys tab render the same block — the page's current one — with the
Kosztorys_v2 button page-only and the block read-only for a trashed investment. No page is slower or heavier.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Data path | Provider holding the **pending** promise, management roles only | Never blocks `children`; EMPLOYEE gets no PII | Research |
| Order settings | Same provider, own promise | One tiny cached read; avoids drilling through the editor | Plan (user) |
| Consumer scope | Every client consumer switches at once | User: wider diff is fine | Plan (user) |
| EMPLOYEE `sendableRegisters` | Stays a server prop | Provider is `null` for EMPLOYEE | Research |
| Kosztorys | Hook only in `KosztorysEditorV2`; body/panel keep the prop | They render under `(share)` | Research |
| Overview spec | The investment page's block as-is (incl. „Zdjęcia i pliki" at the bottom) | User: the page has the newer features | Plan (user) |
| Perf gate | Local interleaved A/B after the provider and at the end; Vercel field check after release | Single passes swing 6× | Research |

## Scope

**In scope:** provider + hooks + test seam; TopNav and all page → client reference-data edges; dropping dead
page fetches; `InvestmentOverview` on both views; `trashed` forwarded to the tab; two perf runs.

**Out of scope:** reference-data contents/caching, `KosztorysEditorProvider`, `(share)` routes, template editor,
any overview redesign.

## Architecture / Approach

`AuthenticatedShell` → `ReferenceDataProvider({ referenceData: Promise | null, orderSettings: Promise | null })`
→ `useReferenceData()` (merges current user from `useCurrentUser()`) / `useOrderSettings()`, both `null` outside
management. Consumers call `use()` as deep as the data is needed. `InvestmentOverview` takes `investment`,
`trashed`, `assets`, `showKosztorysButton`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Provider and hooks | Shell provider, TopNav on hooks, test stub | Awaiting in the shell / PII leak |
| 2. Perf checkpoint | A/B of the layout change alone | Noise mistaken for regression |
| 3. Switch every consumer | No reference-data props on server → client edges | A missed EMPLOYEE / `(share)` path |
| 4. Shared overview | One block on page and tab | Tab under `(share)` reading the hook |
| 5. Final perf run | Recorded after-numbers | Mapped copy defeating Flight dedupe |

**Prerequisites:** before build in `../wykonczymy-worktrees/perf-investment-overview`; new worktree via
`scripts/worktree-new.sh investment-overview-shared staging`.
**Estimated effort:** ~2 sessions.

## Open Risks & Assumptions

- Flight is assumed to still dedupe when the object arrives via a promise — verified by the `×64` count in Phase 2.
- A consumer reached from a page whose fetch is dropped suspends under that route's `loading.tsx` until the
  layout's promise resolves — expected no slower, since the page awaited the same fetch before.

## Success Criteria (Summary)

- The kosztorys „Inwestycja" tab shows the same block as the investment page, Zamów included.
- Every management dialog lists the same kasy / pracownicy / inwestycje as before; EMPLOYEE and investor links
  unchanged.
- A/B pass criteria hold on every measured page.
