# Worker link revocable when scope is blocked or the worker has no etapy — Implementation Plan

## Overview

A worker's live link (`kosztorys-worker-shares` row) can only be revoked from „Pracownicy" → „Link".
Two states cut that path while the token stays live, so it starts showing prices again the moment
the block lifts (EX-888). This change keeps revocation reachable in both.

## Current State Analysis

- `kosztorys-workers-menu.tsx:54` disables „Link" (and „Drukuj PDF") whenever the worker's scope is
  blocked — revocation lives inside that dialog, so it goes too.
- `assignedWorkers` (`src/lib/kosztorys/worker-view/assigned-workers.ts:18`) lists only workers who
  hold an etap, so a worker unpinned from every etap vanishes from the menu with a live token.
- `resolveWorkerScope` (`src/lib/kosztorys/worker-view/scope.ts:20`) already models „no etapy" as
  `blocked / 'no-stages'`, with the message „Brak przypisanych etapów" in `labels.ts` — no new
  block state is needed.
- The editor does not know who holds a link. The dialog reads the token on click
  (`readWorkerShareToken`, `src/lib/queries/worker-share-link-endpoint.ts`).
- `generateWorkerShareLinkAction` already refuses a blocked scope server-side;
  `revokeWorkerShareLinkAction` never checks scope. The server side needs no change.
- `ShareLinkPanel` (`dialogs/share/share-link-panel.tsx`) is shared with the investor dialog.

## Desired End State

- A blocked worker **with** a live link: „Link" is enabled; the dialog shows the block reason and only
  „Wyłącz link" — no address, no copy, no „Wygeneruj nowy".
- A blocked worker **without** a link: „Link" stays disabled, as today.
- A worker with a live link but no etapy appears in the menu like any blocked worker: name,
  „Brak przypisanych etapów", Podgląd enabled, „Link" enabled (revoke only), „Drukuj PDF" disabled.
- The link-holder set is read each time the menu opens, so a revoked worker drops out on the next open.

### Key Discoveries:

- `resolveWorkerScope` already returns `'no-stages'` — appending link holders to the menu rows makes
  them blocked by construction.
- The menu's fetch-on-open fits the existing „read on the click" pattern in `useWorkerActions`
  (`worker-actions.tsx:34`), with `useLatestRequest` for latest-wins.
- DOM spec `src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.test.tsx`
  already renders menu + dialog with mocked reads — extend it, don't start a new one.

## What We're NOT Doing

- No auto-revoke when a worker loses their last etap (considered, rejected: changes behaviour).
- No threading of link holders through the page → editor → context props (context churn, EX-496).
- No change to the investor share dialog's behaviour.
- No server-side change to generate/revoke actions.

## Implementation Approach

A lazy `'use server'` read of the investment's link holders, fired when the „Pracownicy" menu opens.
`assignedWorkers` takes the holder set and appends holders without etapy. The menu enables „Link" for
a blocked worker iff they hold a link, and passes the block reason to the dialog; the dialog puts
`ShareLinkPanel` into a revoke-only mode when a reason is present.

## Phase 1: Link holders in the menu

### Overview

Menu knows who holds a link, lists holders without etapy, and enables „Link" for blocked holders.

### Changes Required:

#### 1. Link-holder read

**File**: `src/lib/queries/worker-share-link-endpoint.ts`

**Intent**: Add a management-only read returning the worker ids that hold a live link for one
investment — the menu's input for „who can still be revoked".

**Contract**: `readWorkerShareHolders(investmentId: number): Promise<number[]>`, same auth guard as
`readWorkerShareToken`.

#### 2. Menu rows

**File**: `src/lib/kosztorys/worker-view/assigned-workers.ts`

**Intent**: Accept the holder ids; append holders not already listed (resolved from the whole roster,
inactive included), each carrying its scope (→ `'no-stages'`) and a `hasLink` flag.

**Contract**: `assignedWorkers(stages, roster, linkHolders: ReadonlySet<number>)` →
`AssignedWorkerT` gains `hasLink: boolean`. Holder rows come after etap-order rows.

#### 3. Fetch on open + menu wiring

**Files**: `src/components/kosztorys/editor/actions/worker-actions.tsx`,
`src/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.tsx`

**Intent**: `useWorkerActions` owns the holder set (empty until loaded) and a `requestLinkHolders()`
fired from the dropdown's `onOpenChange(true)`; a revoke in the dialog drops the worker from the set.
The menu disables „Link" only when blocked **and** not a holder; „Drukuj PDF" stays disabled when
blocked. `WorkerShareTargetT` carries the optional block reason into the dialog.

### Success Criteria:

#### Automated Verification:

- DOM spec: a no-etapy link holder appears with „Brak przypisanych etapów", „Link" enabled, „Drukuj PDF" disabled: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.test.tsx`
- DOM spec: a blocked worker without a link keeps „Link" disabled; a blocked holder has it enabled (same file)

#### Manual Verification:

- On a local investment, unpin a worker who holds a link from every etap → the worker still shows in „Pracownicy" with „Brak przypisanych etapów"

---

## Phase 2: Revoke-only dialog

### Overview

The dialog for a blocked worker offers nothing but „Wyłącz link", with the reason.

### Changes Required:

#### 1. Revoke-only mode

**File**: `src/components/kosztorys/editor/dialogs/share/share-link-panel.tsx`

**Intent**: An optional block reason puts the panel into revoke-only mode: reason text + „Wyłącz
link" (with the existing confirm) when a token exists; reason text alone when it does not (a stale
menu). No address, copy or generate in either case.

**Contract**: new optional prop on `PropsT` (e.g. `generateBlockedReason?: string`); investor dialog
does not pass it and is unchanged.

#### 2. Worker dialog

**File**: `src/components/kosztorys/editor/dialogs/share/kosztorys-worker-share-dialog.tsx`

**Intent**: Pass the target's block reason through; on successful revoke, drop the worker from the
holder set.

### Success Criteria:

#### Automated Verification:

- DOM spec: a blocked holder's dialog shows the reason and „Wyłącz link", with no address field and no „Wygeneruj nowy"; confirming calls `revokeWorkerShareLinkAction` (same spec file)

#### Manual Verification:

- Blocked worker with a link: „Link" → „Wyłącz link" → confirm → `/p/…/<token>` returns 404; reopening „Pracownicy" shows „Link" disabled (or the no-etapy worker gone)

---

## Testing Strategy

DOM spec only (`kosztorys-workers-menu.test.tsx`): mock `readWorkerShareHolders` next to the existing
`readWorkerShareToken` mock; default fixture has no holders so existing cases keep their meaning. Add
Celina (no etapy) and Bogdan (blocked) as holders in the new cases. No node spec for
`assignedWorkers` — the DOM spec observes its output through the menu.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

## Docs

- `context/reference/kosztorys-editor-domain-notes.md:371-375` — the „Zakres" bullet: blocked link
  is still revocable from the menu; a worker without etapy stays listed while holding a link.

## References

- Issue: EX-888; ledger `context/archive/reviews/2026-09-28-staging-pm.md`
- Scope rule: `src/lib/kosztorys/worker-view/scope.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Link holders in the menu

#### Automated

- [x] 1.1 DOM spec: a no-etapy link holder appears with „Brak przypisanych etapów", „Link" enabled, „Drukuj PDF" disabled — a0cdbd2a
- [x] 1.2 DOM spec: a blocked worker without a link keeps „Link" disabled; a blocked holder has it enabled — a0cdbd2a

### Phase 2: Revoke-only dialog

#### Automated

- [x] 2.1 DOM spec: a blocked holder's dialog shows the reason and „Wyłącz link", with no address field and no „Wygeneruj nowy"; confirming calls `revokeWorkerShareLinkAction` — 8de81ece
