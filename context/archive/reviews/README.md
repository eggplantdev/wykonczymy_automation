# Archived branch-scoped review-gate ledgers

A `slice-review-gate` run normally writes its ledger to the change folder
(`context/changes/<change-id>/review-gate.md`), and `/10x-archive` carries it into
`context/archive/<date>-<change-id>/` along with everything else. That path has a lifecycle.

When **no single `change.md` covers the reviewed range** — a branch-wide gate, a batch of commits on
`staging`, a consolidated multi-slice branch — the gate falls back to `.review-gate/<branch-slug>.md`
at the repo root. That fallback had **no** lifecycle: six ledgers accumulated there between
2026-07-17 and 2026-07-26 with no archive step ever reaching them. This directory is that missing
destination.

**Naming:** `<date-of-the-gate>-<slug>.md`.

**Trimming.** An archived ledger is distilled the same way `/10x-archive` distils a change folder:
every `fixed` finding is removed, because its durable record is its **commit** — a ledger line
describing a change is strictly worse evidence than the change. What survives is the negative space
git cannot hold: `dismissed` / `dropped` / `skipped` findings, i.e. what a reviewer looked at and
chose _not_ to act on, and why. A `filed` finding survives in condensed form too, since a filing
leaves no commit either. Each file records its pre-trim tally so the trim is visible rather than
silent.

**Keep only what nothing else holds.** A dismissal usually ends up as a code comment and an owner
ruling in the domain notes; once it has, the ledger line is a duplicate. The 2026-09-29 archive audit
deleted all 16 ledgers on that test (git keeps them). A ledger belongs here only while it carries a reason
absent from code, commits and living docs.
