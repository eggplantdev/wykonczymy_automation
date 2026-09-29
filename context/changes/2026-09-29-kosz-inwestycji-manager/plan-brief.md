# Investment trash for the manager — Plan Brief

> Full plan: `context/changes/2026-09-29-kosz-inwestycji-manager/plan.md`
> Research: `context/changes/2026-09-29-kosz-inwestycji-manager/research.md`

## What & Why

A manager gets the whole investment trash — „Usuń", „Przywróć", „Usuń na zawsze", `/kosz` — on par
with the owner. The owner accepts that a manager can hard-delete a used kosztorys; worst case is a
hand restore from the hourly prod dump.

## Starting Point

Six role checks keep the trash ADMIN/OWNER-only (3 actions, listing button, `/kosz` page + query,
nav group). Every other guard of the trash is role-independent.

## Desired End State

A manager sees „Kosz" last in the menu and the „Usuń" button on the listing, and trashes, restores
and deletes with exactly the owner's guards. EMPLOYEE sees none of it.

## Key Decisions Made

| Decision                      | Choice                                                       | Why                                                                                                      | Source   |
| ----------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------- |
| Scope of manager powers       | Full parity (variant B)                                      | Trash-only left the manager unable to undo their own mistake, and the purge deletes after 30 days anyway | Research |
| REST `PATCH trashedAt` bypass | Leave                                                        | Dismissed before; under B grants nothing new; file has another session's edits                           | Plan     |
| Tests                         | Flip + extend DB spec to a MANAGER round-trip; flip nav spec | Pins the whole new rule at the action layer                                                              | Plan     |
| E2E                           | None                                                         | Harness has no MANAGER user; EX-874 is the trash's E2E backlog                                           | Research |

## Scope

**In scope:** the six gate sites, two specs, a supersede note in the archived change.

**Out of scope:** trash guards/purge/copy, REST field access, manager E2E.

## Architecture / Approach

Each ADMIN/OWNER check moves to the management-level primitive already at its layer:
`protectedAction`, `requireManagementPage`, `MANAGEMENT_ROLES`, `MANAGEMENT_LINKS`. `OWNER_LINKS`
and `FORBIDDEN_MESSAGE` lose their last reader and go.

## Phases at a Glance

| Phase                 | What it delivers                        | Key risk                                                                   |
| --------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| 1. Role gates + specs | Manager parity, re-pinned specs         | DB spec's auth mock ignores roles — only the MANAGER flip is a real signal |
| 2. Docs               | Archived decision points at this change | —                                                                          |

**Prerequisites:** local DB for the DB spec.
**Estimated effort:** one short session.

## Open Risks & Assumptions

- A manager can permanently delete a used kosztorys (typed name still required). Accepted by the owner.

## Success Criteria (Summary)

- A manager can trash, find, restore and delete an investment without the owner.
- EMPLOYEE still has no access to any of it.
