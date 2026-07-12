---
name: start-poc-comparison
description: >-
  Start the in-app-kosztorys POC (branch poc-kosztorys-in-app) side-by-side with main so the owner
  can compare the two editors in the browser. Use this WHENEVER the user wants to "run the POC",
  "compare POC vs main", "start the poc branch", "spin up the kosztorys POC", "see the old POC
  editor", or asks for a browser link to the POC — even if they don't name the branch. Everything is
  already set up (worktree, deps, .env, seeded wykonczymy-poc DB); this is just how to boot it.
---

# Start the kosztorys POC for comparison

The POC runs from the worktree at `/Users/konradantonik/workspace/yolo/wykonczymy-poc`, on **port
3005**, against its own DB `wykonczymy-poc`. Main is untouched on 3000/3001.

**Boot it** (background it; `next dev` directly — pnpm 10 drops `-- -p`):

```bash
cd /Users/konradantonik/workspace/yolo/wykonczymy-poc && pnpm exec next dev --turbo -p 3005
```

Poll `curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/` until it returns 307, then
give the user the link.

**Link:** log in first at http://localhost:3005/zaloguj, then open the v2 editor directly — the
route to compare is `/inwestycje/<id>/kosztorys-edytor-v2` (the `KosztorysEditorV2`
react-datasheet-grid editor; the plain `/inwestycje/<id>/kosztorys` route is just the old Sheets
iframe, not the POC editor):

- **1000-item perf dataset:** http://localhost:3005/inwestycje/7/kosztorys-edytor-v2
- **Realistic ~40-item dataset:** http://localhost:3005/inwestycje/6/kosztorys-edytor-v2

First open of the editor compiles in Turbopack (~10–15s) — the slow initial load is compile
latency, not a hang. Main holds the same data in investments 6 and 7 (`wykonczymy-db`), so it's a
clean side-by-side.

If login fails, the `ADMIN`/`PASS` env is stale — mint a temp OWNER via the Local API against
`wykonczymy-poc` (see memory `project_local_login_and_test_fixtures`). If it won't boot at all
(missing deps/DB after a machine reset), that's a re-setup, not this skill.
