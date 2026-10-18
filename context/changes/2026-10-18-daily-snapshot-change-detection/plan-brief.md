# Daily snapshot change detection — Plan Brief

> Full plan: `context/changes/2026-10-18-daily-snapshot-change-detection/plan.md`

## What & Why

Every deploy that adds a field to the serialized kosztorys tree makes the nightly `daily` capture store
a full copy for nearly every open investment, even though nothing changed. On prod this accounts for
60% of non-first `daily` rows (63 of 116 MB). This change compares payloads the way the investor's
history reads them, so those copies stop being written.

## Starting Point

`captureDailySnapshot` compares the raw new payload with the previous `daily` row, so a key absent
from the old row counts as a change. `snapshotToTree` already fills absent keys with their column
defaults for „Historia zmian".

## Desired End State

A `daily` row is stored only when the tree the investor would see differs from the previous day's.
Field-adding deploys store nothing. A field that gains a real value still counts.

## Key Decisions Made

| Decision               | Choice                                                                     | Why                                                                                 |
| ---------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| What "unchanged" means | Both payloads rendered through `snapshotToTree` against the same live tree | Same defaults as the history and restore readers; no new normalizer to keep in sync |
| Existing spurious rows | Left in place                                                              | Investor history; a backfill is a separate approved migration (EX-1076)             |
| Test layer             | Pure predicate in node tests + one DB case for persisted state             | Edge cases are cheap in node; the slipped bug needs a persisted-state guard         |

## Scope

**In scope:** the `daily` comparison, its unit tests, one DB regression case.

**Out of scope:** retention, payload format, `auto`/`manual`/`named`, deleting or rewriting old rows.

## Phases at a Glance

| Phase                                 | What it delivers                   | Key risk                                                                                      |
| ------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| 1. Compare through the history reader | `sameDailyState` predicate + tests | A `live` fallback masking a real change (covered: every `daily` row carries `globalDiscount`) |

**Estimated effort:** one short session.

## Success Criteria (Summary)

- The night after the deploy, `daily` rows ≈ investments actually edited that day.
- The existing flow test (store / unchanged / store after edit) stays green.
