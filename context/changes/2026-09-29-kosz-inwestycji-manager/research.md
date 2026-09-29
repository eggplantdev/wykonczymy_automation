---
date: 2026-09-29T09:43:00+02:00
researcher: Claude (Opus 5.5)
git_commit: 7f4f1933e504add9d9bc2356f85e69f0bffc682d
branch: staging
repository: wykonczymy
topic: 'Open the investment trash (trash / restore / delete forever / /kosz) to MANAGER'
tags: [research, codebase, investment-trash, roles, kosz, nav]
status: complete
last_updated: 2026-09-29
last_updated_by: Claude (Opus 5.5)
---

# Research: Open the investment trash to MANAGER

**Date**: 2026-09-29T09:43:00+02:00
**Git Commit**: 7f4f1933
**Branch**: staging

## Research Question

Can MANAGER get the same investment-trash powers as ADMIN/OWNER — „Usuń" on the listing, „Przywróć",
„Usuń na zawsze", and the `/kosz` page? Started as variant A (trash only), switched to **variant B
(full parity)** mid-research; see `change.md`.

## Summary

The role gate is a plain `ADMIN_OR_OWNER` check at **6 sites** (3 actions, the listing button, the
`/kosz` page + its query, the nav group). None of the trash's other guards (transactions,
szablon, typed name, purge) depend on role, and swapping `ownerOnlyAction` → `protectedAction`
keeps revalidation identical. Two specs pin the old rule and flip. No living doc states the
role rule — only the archived change. Nothing touches the files another session is editing
(`investment-wycena-status`).

## Detailed Findings

### Server actions — `src/lib/actions/investment-trash.ts`

- `trashInvestmentAction` (:28), `restoreInvestmentAction` (:77), `deleteInvestmentForeverAction`
  (:103) all wrap `ownerOnlyAction` with the shared `FORBIDDEN_MESSAGE` (:20, „Tylko właściciel lub
  administrator może usuwać inwestycje.").
- `ownerOnlyAction` (`src/lib/actions/owner-only-action.ts:19-29`) only prepends
  `isAdminOrOwnerRole`; `revalidate`/`opts` pass through unchanged to `protectedAction`, which
  already requires `MANAGEMENT_ROLES` (`run-action.ts:50`) and revalidates only on success
  (`:61-63`). So `protectedAction(label, handler, tags, opts)` is a drop-in; EMPLOYEE stays refused.
- After the swap `FORBIDDEN_MESSAGE` has no reader → delete it. `ownerOnlyAction` itself stays
  (presets, worker/client view settings, notification recipients use it).
- The hard delete (`src/lib/investments/delete-investment-forever.ts:27,37`) and the purge run with
  `overrideAccess: true`, so the collection's `delete: isAdminOrOwner`
  (`src/collections/investments.ts:46`) does not need to change — it only governs the unused
  `/admin`/REST path.

### Listing button — `src/components/tables/investments.tsx:309`

- `{isAdminOrOwner && <TrashInvestmentButton …/>}`. The same `isAdminOrOwner` (:103) also gates
  Marża (:175) and Wypłaty (:248) — change only the :309 condition, not the variable.
- The listing page is management-only (`src/app/(frontend)/inwestycje/page.tsx:12`), so the
  condition can simply be dropped.
- `TrashInvestmentButton` renders nowhere else (not on the detail page, no mobile card).
- Its dialog copy „Możesz ją przywrócić z Kosza." (`trash-investment-button.tsx:31`) becomes true for
  a manager under B — no copy change needed.

### `/kosz` page and its query

- `src/app/(frontend)/kosz/page.tsx:10` — `requireAuth(ADMIN_OR_OWNER_ROLES)` + redirect. The repo
  helper for exactly this is `requireManagementPage()` (`src/lib/auth/require-management-page.ts`),
  already used by `/szablony`, `/inwestycje/[id]`.
- `src/lib/queries/trash.ts:19` — `getTrashedInvestments` guards with `requireAuth(ADMIN_OR_OWNER_ROLES)`
  itself → `MANAGEMENT_ROLES`.
- `TrashedInvestmentActions` / `DeleteForeverDialog` carry no role check of their own.

### Nav — `src/lib/constants/sections.ts:61`, `src/hooks/use-nav-links.ts:26`

- `OWNER_LINKS` holds only `/kosz`, appended when `isAdminOrOwnerRole`. `MANAGEMENT_LINKS` (:52)
  ends with „Pracownicy", so moving `/kosz` to its end keeps the archived placement („last, below
  Pracownicy"). `OWNER_LINKS` and the `isAdminOrOwnerRole` branch then have no reason to exist —
  delete both (third link group goes away).

### Tests that pin the old rule

- `src/__tests__/lib/actions/investment-trash.db.test.ts:83-91` — „refuses a MANAGER", on
  `trashInvestmentAction` only (role via hoisted `session.role`, reset to OWNER in `beforeEach`
  :76-77). Flips to „a MANAGER can trash". No spec covers restore/delete-forever by role.
- `src/__tests__/hooks/use-nav-links.test.tsx:21,25` — `['OWNER','ADMIN']` „puts Kosz last",
  `['MANAGER','EMPLOYEE']` „hides Kosz". MANAGER moves to the first table.
- No test for `TrashInvestmentButton`, the actions column by role, or the `/kosz` page gate.
- E2E: no trash spec exists (backlog **EX-874**), and the harness logs in only as OWNER
  (`e2e/global-setup.ts:8`, `src/scripts/seed-e2e-user.ts:53`) — a manager E2E needs a seeded
  MANAGER + second storage state. Not worth it for a role-list change.

### Behaviour a manager inherits (unchanged logic)

- Trashing hides the investment from listing/pickers/totals (`reference-data.ts:73`), 404s its pages
  (`queries/investments.ts:51`), kills `/k/<token>` and worker links (`preview-kosztorys.ts:125`,
  `worker-kosztorys.ts:140`), and refuses writes (`investment-gate.ts:32`). Under B the manager can
  find and restore it on `/kosz`, so `INVESTMENT_TRASHED_MESSAGE` („przywróć ją") is actionable.
- `trashInvestmentAction` does not check the „zakończona" lock — same for owner today; the
  transactions blocker makes a settled investment practically untrashable.
- `investmentDeleteBlocker`'s advice „Najpierw usuń lub przenieś transakcje."
  (`delete-blocker.ts:15`) may be partly out of a manager's reach (they cancel only their own
  transfers + LABOR_COST, `roles.ts:37-40`). Cosmetic; left as is.

## Code References

- `src/lib/actions/investment-trash.ts:20,28,77,103` — `FORBIDDEN_MESSAGE` + 3 `ownerOnlyAction` wraps
- `src/components/tables/investments.tsx:309` — listing button gate
- `src/app/(frontend)/kosz/page.tsx:10` — page gate
- `src/lib/queries/trash.ts:19` — query gate
- `src/lib/constants/sections.ts:52,61` — `MANAGEMENT_LINKS` / `OWNER_LINKS`
- `src/hooks/use-nav-links.ts:26` — owner-group append
- `src/__tests__/lib/actions/investment-trash.db.test.ts:83` — spec to flip
- `src/__tests__/hooks/use-nav-links.test.tsx:21,25` — spec to flip

## Architecture Insights

- Precedent is mixed: Kosztorysy v1 keeps delete owner-only while managers unlink
  (`sheets.ts:268`), szablony deletion is owner-only (`kosztorys-presets.ts:131,141`), yet managers
  already hard-delete catalogue items and Blob files (`work-catalogue.ts:85`,
  `investment-assets.ts:39,51`). B is a product decision, not a break from a consistent rule.
- `trashedAt` has no field-level access (`collections/investments.ts:162-166`) and managers hold
  collection `update`, so a manager could already PATCH it over REST, skipping the transactions and
  szablon checks. Dismissed at the original review gate (REST/`/admin` unused); under B it no longer
  grants a manager anything the app withholds.

## Historical Context

- `context/archive/2026-09-24-kosz-inwestycji/change.md:22` — the reversed decision. Its only stated
  reason (deleted plan-brief, `git show 15380c8b^:context/changes/2026-09-24-kosz-inwestycji/plan-brief.md:31`):
  „Deleting is the owner's call, not the manager's." No further argument recorded.
- Commits: `353c205b` (actions behind `ownerOnlyAction`), `161a2603` (`/kosz`, nav, „Usuń").
- Before the trash a manager could never delete an investment (`delete: isAdminOrOwner` since
  `5d72f612`).

## Related Research

- `context/changes/2026-09-22-kosz-plikow/` — file trash (planned), manager-inclusive by design.

## Open Questions

- None blocking. The archived change.md stays as history; this change records the reversal.
