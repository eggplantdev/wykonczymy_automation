# Remount latch disarm — plan

## Desired End State

A refresh started by `handleTreeReplaced({ refetch: true })` runs inside the shell's own
`useTransition`. `useRestoreRemount` receives that transition's `isPending`; when it settles
(`true` → `false`) with the token still equal to `armedFrom`, the latch disarms. A token that moves in
the same render still fires the remount — the fire check runs first.

Verified against Next 16 (`app-router-instance.ts`): `refresh()` dispatches inside `startTransition`
with a deferred promise resolved on the server response, so a wrapping `startTransition` holds
`isPending` until the refreshed tree commits.

`undoRedo.reset()` stays at arm time — after a failed write nobody knows whether it committed, and if
it did the stack's commands close over a tree that is gone.

Out of scope: the stale-tree path (`handleStaleTree`) can also stick when another tab's change is
count- and revision-neutral.

## Phase 1: Disarm on a settled no-change refresh

### Changes Required

- `src/components/kosztorys/editor/hooks/use-restore-remount.ts` — second arg `isRefreshing`; render-phase
  disarm on settle with an unchanged token.
- `src/components/kosztorys/editor/kosztorys-editor-v2.tsx` — `useTransition`, refresh wrapped in it,
  `isRefreshing` passed to the hook.

### Success Criteria

#### Automated

- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/hooks/use-restore-remount.test.tsx` green,
  existing cases unchanged.

#### Manual Verification

- Editor: DevTools offline → „Wyczyść kosztorys” → back online; after the „…odświeżam” refresh, change VAT
  → sort/filter survive (no remount).

## Progress

### Phase 1: Disarm on a settled no-change refresh

#### Automated

- [x] 1.1 Refresh that settles with the same tree disarms the latch
- [x] 1.2 Tree landing as the refresh settles still remounts
- [x] 1.3 Shell wraps the refresh in its transition
