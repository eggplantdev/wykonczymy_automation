# Investment trash for the manager — Implementation Plan

## Overview

Give MANAGER full parity with ADMIN/OWNER on the investment trash: „Usuń" on the listing, „Przywróć",
„Usuń na zawsze" and the `/kosz` page. Reverses the role line of `kosz-inwestycji`; decision and
accepted risk in `change.md`.

## Current State Analysis

The trash is gated by a plain ADMIN/OWNER check at six sites; nothing else in it depends on role
(research.md → Summary). `ownerOnlyAction` only prepends `isAdminOrOwnerRole` to `protectedAction`,
which already admits `MANAGEMENT_ROLES` and keeps EMPLOYEE out. Hard delete and purge write with
`overrideAccess: true`, so the collection's `delete: isAdminOrOwner` is not on the path.

## Desired End State

A MANAGER sees „Kosz" as the last menu item, the „Usuń" button on `/inwestycje`, and can trash,
restore and delete forever with exactly the owner's guards (live transactions block, never a
szablon, typed name for a used kosztorys). EMPLOYEE sees none of it. Two specs pin the new rule.

### Key Discoveries:

- `src/lib/actions/investment-trash.ts:20,28,77,103` — `FORBIDDEN_MESSAGE` + three `ownerOnlyAction` wraps.
- `src/components/tables/investments.tsx:103,309` — `isAdminOrOwner` also gates Marża (:175) and Wypłaty (:248); only :309 changes.
- `src/lib/auth/require-management-page.ts` — the existing page guard for management-only routes.
- `src/lib/constants/sections.ts:52,61` — `MANAGEMENT_LINKS` ends with „Pracownicy", so appending `/kosz` keeps its placement.

## What We're NOT Doing

- Closing the REST `PATCH trashedAt` bypass (`collections/investments.ts:162-166`) — dismissed at the
  original review gate and grants a manager nothing the app withholds under B. That file also carries
  another session's uncommitted edits.
- Any change to the trash's guards, purge, dialogs or copy.
- A manager E2E — the harness has no MANAGER user; EX-874 stays the trash's E2E backlog.
- Rewording `investmentDeleteBlocker`'s advice for managers.

## Implementation Approach

Swap each role check onto the management-level primitive that already exists at that layer
(`protectedAction`, `requireManagementPage`, `MANAGEMENT_ROLES`, `MANAGEMENT_LINKS`). Flip the specs
first — the DB spec goes red on the current code, which proves it tests the gate.

## Critical Implementation Details

**The DB spec's `requireAuth` mock ignores its roles argument** (`investment-trash.db.test.ts:17-22`).
The MANAGER refusal it pins today comes solely from `ownerOnlyAction`'s check on `user.role`, so the
flipped test is a real signal (red before the swap, green after). The same mock cannot express an
EMPLOYEE refusal — don't add one there; `protectedAction`'s own guard owns it.

## Phase 1: Role gates + specs

### Overview

Open every trash surface to MANAGEMENT_ROLES and re-pin the rule in the two existing specs.

### Changes Required:

#### 1. DB action spec

**File**: `src/__tests__/lib/actions/investment-trash.db.test.ts`

**Intent**: Replace „refuses a MANAGER" with one test where a MANAGER trashes, restores, re-trashes
and deletes forever a fresh investment, asserting persisted `trashed_at` and the row's absence.
Written first; must fail on current code.

**Contract**: `it('lets a MANAGER trash, restore and delete forever', …)` using the existing
`session.role`, `trashedAt`, `createTestInvestment` helpers.

#### 2. Nav spec

**File**: `src/__tests__/hooks/use-nav-links.test.tsx`

**Intent**: MANAGER joins OWNER/ADMIN in „puts Kosz last"; only EMPLOYEE stays in „hides Kosz".

**Contract**: the two `it.each<RoleT>` tables at :21 and :25.

#### 3. Trash actions

**File**: `src/lib/actions/investment-trash.ts`

**Intent**: All three actions wrap `protectedAction` instead of `ownerOnlyAction`; `FORBIDDEN_MESSAGE`
and the `ownerOnlyAction` import go (no reader left).

**Contract**: `protectedAction(label, handler, [...TAGS], investmentEntityOpts(id))` — same tags and
opts as today. `ownerOnlyAction` itself stays; other actions use it.

#### 4. Listing button

**File**: `src/components/tables/investments.tsx`

**Intent**: Render `TrashInvestmentButton` unconditionally — the listing is management-only.

**Contract**: :309 only; `isAdminOrOwner` stays for the Marża/Wypłaty columns.

#### 5. `/kosz` page and its query

**Files**: `src/app/(frontend)/kosz/page.tsx`, `src/lib/queries/trash.ts`

**Intent**: Page guards with `requireManagementPage()`; `getTrashedInvestments` guards with
`MANAGEMENT_ROLES`.

**Contract**: page redirect contract unchanged (`/zaloguj` on refusal).

#### 6. Nav

**Files**: `src/lib/constants/sections.ts`, `src/hooks/use-nav-links.ts`

**Intent**: Move the `/kosz` entry to the end of `MANAGEMENT_LINKS`; delete `OWNER_LINKS` and the
`isAdminOrOwnerRole` append — the third link group has no member left.

**Contract**: `useNavLinks()` return shape unchanged.

### Success Criteria:

#### Automated Verification:

- Flipped DB spec fails before the action swap, passes after: `pnpm exec vitest run src/__tests__/lib/actions/investment-trash.db.test.ts`
- Nav spec passes: `pnpm exec vitest run src/__tests__/hooks/use-nav-links.test.tsx`
- No `OWNER_LINKS` / `FORBIDDEN_MESSAGE` reader left: `grep -rn "OWNER_LINKS\|FORBIDDEN_MESSAGE" src/lib/actions/investment-trash.ts src/hooks src/lib/constants` is empty

#### Manual Verification:

- As MANAGER on localhost: „Kosz" is the last menu item and `/kosz` opens
- As MANAGER: „Usuń" on `/inwestycje` moves an investment to the trash; „Przywróć" brings it back
- As MANAGER: „Usuń na zawsze" asks for the name on a used kosztorys and deletes after it
- As EMPLOYEE: no „Kosz" in the menu, `/kosz` redirects

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Docs

### Overview

Point the archived decision at its replacement so nobody trusts the stale rule.

### Changes Required:

#### 1. Archived decision

**File**: `context/archive/2026-09-24-kosz-inwestycji/change.md`

**Intent**: Append to line 22 (and the „visible to owner and admin only" nav note at :44) that
MANAGER was given parity on 2026-09-29, pointing at `context/changes/2026-09-29-kosz-inwestycji-manager/`.

**Contract**: the `## Decisions from the discussion (2026-09-24)` section.

### Success Criteria:

#### Automated Verification:

- None — prose-only phase.

#### Manual Verification:

- None.

---

## Testing Strategy

### Unit Tests:

- Nav: MANAGER gets „Kosz" last, EMPLOYEE does not.

### Integration Tests:

- DB: MANAGER round-trip trash → restore → trash → delete forever on persisted rows. The existing
  owner specs (transactions block, szablon refusal, typed name) keep covering the unchanged guards.

### Manual Testing Steps:

1. Log in as MANAGER, trash an investment without transactions, find it on `/kosz`, restore it.
2. Trash it again and delete forever.
3. Log in as EMPLOYEE and open `/kosz` directly — redirected.

## Migration Notes

None — no schema change, no prod migration.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit suite passes: `pnpm test`
- DB specs pass: `pnpm test:integration`

## References

- Research: `context/changes/2026-09-29-kosz-inwestycji-manager/research.md`
- Reversed decision: `context/archive/2026-09-24-kosz-inwestycji/change.md:22`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Role gates + specs

#### Automated

- [x] 1.1 Flipped DB spec fails before the action swap, passes after
- [x] 1.2 Nav spec passes
- [x] 1.3 No `OWNER_LINKS` / `FORBIDDEN_MESSAGE` reader left

### Phase 2: Docs

#### Automated

- [ ] 2.1 None — prose-only phase
