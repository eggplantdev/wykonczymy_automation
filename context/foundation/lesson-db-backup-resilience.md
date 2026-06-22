# Lesson: Database Connectivity & Backup Resilience

**A post-incident playbook.** Written after a near-miss where production ran on the
wrong-but-invisible database, the password rotated, prod went down, and the
"backups" turned out to have been dumping a _different, frozen_ database for weeks.

**How to use this doc:**

- **Humans:** read "What happened" + "The lessons" to internalize the failure modes.
- **Agents:** jump to **"Agent audit"** at the bottom. Run it against a target repo,
  report findings against each check, and propose the listed remediations. Treat any
  ❌ as a production risk that needs sign-off before closing.

---

## What happened (the failure chain)

1. **Two databases existed, only one was used, nobody noticed.** A managed Vercel↔Neon
   integration provisioned database **A** (the project's main branch) and injected its
   connection vars. But someone had _hand-pasted_ the connection string of a **different**
   database **B** into the one env var the app actually reads — and **B was a Neon branch
   the integration had auto-created for a Git `staging` (preview) deployment.** Prod ran
   on this preview branch for months; **A** sat frozen and unused.

2. **An automated deployment-retention policy deleted B's deployment — and the database
   with it.** The project had a **30-day retention policy on Pre-Production (preview)
   deployments.** Once the old staging deployment lost its retention _exceptions_ (it was
   no longer the latest preview / dropped out of the last-N), Vercel's background job
   deleted it. Deleting the deployment fired the Neon cleanup webhook, and Neon
   **permanently deleted the linked branch (B) — i.e. production's data.** Nobody deleted
   anything by hand; a routine retention sweep did it.

3. **Total outage that looked like a code bug.** Every request failed with
   `Failed query: SELECT ...`. It looked like the latest migration. It wasn't — the real
   error underneath was `28P01 password authentication failed`. The query never reached
   the database; it failed at connection/auth. **Caveat that wasted hours:** connecting
   through Neon's _shared pooler_ host returns `28P01` even for a **deleted** branch (the
   pooler accepts the TLS connection, then can't resolve the endpoint, so it reports auth
   failure). We mistook "deleted" for "locked, recoverable." A pooled `28P01` does **not**
   prove the database still exists.

4. **The backups had been lying green for weeks.** A nightly job dumped database **A**
   (the frozen, wrong one) — because its secret pointed there — and validated only that
   the file was non-empty. It "succeeded" every night while backing up data nobody used.

5. **Recovery was lucky, not designed.** The only real backup of **B** was a 3-day-old
   dump produced as a _side effect_ of a local git pre-push hook. We restored it (losing
   3 days) into database **A** and repointed prod there. Database **B** is now orphaned —
   alive but locked behind a provider account that can't be found.

**Net result:** hours of outage, 3 days of data stranded, and the realization that the
backup system had never protected production at all.

---

## The lessons

### L1 — One database, one source of truth. Audit for drift.

Hand-pasting a connection string while a managed integration provisions a _different_
DB is how you end up with two databases silently diverging. **Every consumer — app
runtime, CI secrets, backup jobs, migration runners, local `.env` — must resolve to the
same database host.** If they don't, you have a split-brain waiting to bite.

### L2 — A backup you have never restored is not a backup.

Validating "the file is >1 KB" tells you a dump _happened_, not that it's the _right_
data or _restorable_. Real validation = **row counts of key tables + freshness +
no-shrink vs the previous backup + a periodic restore test**. Green must mean _safe_,
not _ran_.

### L3 — Read the actual error before blaming your code.

`28P01` is authentication. `connection refused` is networking. A query that fails
_before executing_ is never your migration. The error text usually contains the answer;
the timing coincidence (a deploy that happened nearby) is a liar.

### L4 — Copied credentials go stale; managed credentials rotate.

Any connection string you copy into a second place (a CI secret, another env var) is a
time bomb that detonates when the source rotates. Prefer the integration's _injected_
vars. If you must copy, **document it and own a rotation plan.**

### L9 — Never point production at a preview/branch database. (The actual root cause here.)

Managed Git-branch integrations (Vercel↔Neon, and similar "database branching" / preview-DB
features) create **ephemeral** databases per preview deployment and **auto-delete** them
when the deployment is cleaned up by a retention policy — default windows are short (this
incident: **30 days on Pre-Production deployments**). If you hand-paste a _preview/staging_
branch's connection string into production, you've pinned live data to disposable
infrastructure: a routine retention sweep silently deletes the deployment, the integration
cascades that into a **permanent** branch deletion, and prod's data is gone. **Production
must use the project's stable main/production branch — never a preview branch, never a
hand-copied branch string.** Separately, review your deployment-retention windows; a
"30 days on everything" policy is far more aggressive than most teams assume.

---

## The principles, distilled

- **Trace every consumer to one DB.** App, CI, backups, migrations, local — same host.
- **Validate backups by content, not size.** Rows, freshness, no-shrink, restore-test.
- **Make green mean safe.** A check that can't fail on the real failure mode is theater.
- **Own your credentials' lifecycle.** Know what rotates, what's copied, and who can reset it.
- **Be able to find and log into the account that holds prod.** Test it before you need it.
- **Alert on silence.** "Nothing changed" is a finding, not a non-event.

---

## Agent audit — run this against a target project

For each check, report **✅ / ⚠️ / ❌** with evidence, then propose the remediation.
Adapt commands to the project's stack (Neon/Supabase/RDS, GitHub Actions/other CI).

### A. Connection-string drift (L1, L5)

1. Find the env var(s) the **app reads at runtime** for its DB. Resolve the **host**.
2. Find the **managed integration's** DB vars (if any). Resolve their host.
3. Enumerate **every other consumer**: CI/Action secrets, backup job config, migration
   scripts, local `.env`, IaC. Resolve each host.
4. **❌ if any two differ.** Produce a table: consumer → host → matches-prod?
5. Confirm you can identify and log into the **provider account/project** that owns the
   prod host. **❌ if prod lives in an account no one can access.**

### B. Backup integrity (L2, L6, L7)

6. Locate the backup job. Read its **validation**. **❌ if it checks only file size /
   existence.**
7. Confirm the backup **source == prod DB** (compare hosts from A). **❌ on mismatch.**
8. Confirm validations include: **key-table row floor**, **freshness (max(created_at) or
   equivalent — not a date-grep, which future-dated rows spoof)**, **no-shrink vs the
   previous backup**. ⚠️ for each missing.
9. Confirm a **restore test** exists (dump → throwaway DB → sanity query). **❌ if never.**
10. Confirm backups are **off-platform** with sane **retention**. ⚠️ otherwise.
11. Check the last N backups aren't **identical in size** (frozen-source signal). ⚠️ if so.

### C. Credential & liveness (L3, L4)

12. Read-only **liveness test**: does the prod connection string still authenticate?
    Distinguish `auth failed` (credential) vs `refused/timeout` (gone) vs OK.
13. List which credentials are **copies** of a managed string. ⚠️ each — note rotation risk.
14. Confirm there's a documented **rotation/recovery runbook** (who resets the password,
    where the account is). **❌ if recovering prod access would be a scavenger hunt.**

### D. Restore-path readiness (L8)

15. Confirm dumps/restores use the **direct** (non-pooled) connection.
16. Confirm the restore procedure is **written down** and has been run at least once.

### E. Preview-branch pinning & retention (L9) — the actual root cause here

17. Resolve the prod connection string's **endpoint/branch** in the provider. **❌ if it
    maps to a Git-branch / preview / staging branch** (named for a git branch, or listed
    as a preview/child branch) — prod data is on disposable infra. It must be the
    main/production branch.
18. Read the platform's **deployment-retention** (and preview-DB cleanup) settings. Record
    the **preview / pre-production** window — that is the lifespan of any preview-branch DB.
    **❌ if anything production depends on lives under a finite preview-retention window**
    (here it was 30 days). ⚠️ if production deployments themselves have an aggressively
    short window.

### Output the agent should produce

- A findings table (check → status → evidence).
- A prioritized remediation list (❌ first).
- For the top risk, a concrete diff/PR or commands to fix it.
- Explicitly flag anything that needs human sign-off (prod credential changes, account
  recovery, anything that wipes data).

---

## One-line takeaways to paste into another project's rules file

- The DB the app reads, the DB CI backs up, and the DB migrations target must be the **same** host — verify, don't assume.
- Backup validation must assert **row count + freshness + no-shrink + restore-test**, never just file size.
- `28P01` / auth errors are **credentials**, not your code — read the error before touching the migration.
- A `28P01` through a **shared pooler** does NOT prove the DB exists — a deleted branch returns the same error. Verify via the direct endpoint / provider console.
- Production must use the **main/production** DB branch — **never a preview/staging branch**; a deployment-retention sweep will silently delete it (default windows are short).
- Dump/restore over the **direct** connection, never the pooler.
