# Measuring page cost (SQL round trips, payload size)

The kit in `scripts/perf/` is how EX-1019 got its before/after numbers
(`context/archive/2026-10-15-roundtrip-audit/audit.md`). Use it whenever a change claims to make a page
cheaper: measure before, change, measure after, and keep both tables.

## What the numbers mean

- **`sql`**: statements per page load. **`depth`**: the longest chain of statements that ran one after
  another, i.e. how many sequential DB round trips sit on the critical path.
- **Read counts and depth, not milliseconds.** Laptop → Neon is ~35 ms a round trip, Vercel → Neon ~1–2 ms,
  so local ms are ~20× inflated and noisy run to run. A statement removed is removed everywhere.
- **Cold vs warm.** Run 1 of each page is cold, the rest warm (median). Cold only means cold if the
  Data Cache is empty: `unstable_cache` persists in `.next/cache/fetch-cache` across restarts, so
  `rm -rf .next/cache/fetch-cache` before a cold run.
- **`orm`**: how many of the statements came from Payload's ORM (lowercase SQL) rather than the raw-SQL
  layer in `src/lib/db` (uppercase).
- **Payload size**: the RSC body is what a client navigation downloads; HTML carries the same Flight data
  inline. Anything a server component passes to a client component is serialized in full, used or not.

## Setup — in a worktree, against the preview DB

The instrument patches the Postgres client for the whole app, so it never goes into the shared checkout,
where other sessions' dev servers would pick it up.

```bash
scripts/worktree-new.sh perf-<topic>            # or any throwaway worktree
cp scripts/perf/instrumentation.ts src/instrumentation.ts
pnpm build
node --env-file=.env scripts/perf/start.mjs     # next start on :3100, DB = preview, SQL log on
```

`start.mjs` passes the preview URL and `PERF_SQL_LOG` as process env, which Next never overrides, so
nothing is written to `.env.local`. Logins are the staging QA accounts (`STAGING_QA_*` in `.env`). If
they're missing on preview: `pnpm qa:staging-user`. Logging in writes a session row, and that row lands
in the **preview** DB, never prod.

Delete `src/instrumentation.ts` before committing anything from that worktree. It reads raw
`process.env` and fails lint there on purpose.

## Tools

All output goes to `dumps/perf/` (gitignored).

| Script                                          | Answers                                                                                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `measure.mjs <label> [runs]`                    | Per page: cold/warm `sql`, `depth`, TTFB, LCP, document KB, fetches after load. `PERF_INVESTMENT` / `PERF_WORKER` pick the detail pages. |
| `probe.mjs <path> [prefetch\|rsc\|html] [role]` | One request, cold then warm, with every statement it caused. Use `prefetch` to see what a `<Link>` costs.                                |
| `size-pages.mjs [needle] [path …] [--save]`     | HTML + RSC KB per page, and how often `needle` (a field name) appears. `--save` keeps the RSC bodies.                                    |
| `rsc-rows.mjs <file.rsc> [needle]`              | Largest rows of a saved RSC body, and the rows carrying `needle`: what is actually heavy.                                                |

`PERF_SQL_STACK=<sql fragment>` (set when starting) records the caller stack of every statement
containing that fragment, which is how you find who issues a statement you don't recognise.

## Traps EX-1019 hit

- The root layout renders **twice** per request (the page, then the root not-found fallback). A query
  there without React `cache()` runs twice. Detail in `context/foundation/lessons.md` (EX-1019 entry).
- Warm numbers flatter a page whose cache a common write evicts. Measure the first load after a typical
  mutation too (the EX-849 shape: a collection-slug tag bumped by writes that touch nothing on that page).
- Removing work from a cache key or tag is a stale-data question first, a speed question second. The
  owner's bar: real gain, low risk, no stale-data risk.
