# Artifact 2 — Structure (dependency graph)

> Wide Scan / structural signal for the Project Map. Evidence from `dependency-cruiser@17.4.3`
> over `src/` (config: `.dependency-cruiser.cjs`), excluding tests, mocks, `.d.ts`, migrations.
> Command: `pnpm exec depcruise src --config .dependency-cruiser.cjs --output-type <metrics|err-long>`
>
> NOTE: there is no `artifact-1-territory.md` yet — this run was driven structure-first by request,
> so "active area" cross-references below are **inferred from the code**, not from git history. Marked `unknown`.

## Key observations

1. **The repo's gravitational center is `src/lib` (Ca=315).** Almost everything depends on it. Inside it, the
   instability gradient is _correct_: contract layers are stable, orchestration layers are not.
   `lib/auth` I=5%, `types` I=3%, `lib/constants` I=0% (stable, depended-upon) vs `lib/actions` I=54%,
   `lib/queries` I=63%, `lib/tables` I=61% (unstable composers). Stable things don't depend on unstable things — textbook.

2. **Both documented architectural invariants HOLD.** The two `error`-severity rules encoding AGENTS.md
   boundaries produced zero violations:
   - Payload hooks (`hooks/transfers/*`, `hooks/revalidate-collection.ts`) do **not** import `lib/cache/revalidate.ts` (which calls `updateTag`, illegal in a hook's Route Handler context).
   - The Payload CLI graph (`payload.config.ts` + `collections/`) does **not** import `env.server.ts` (`server-only`, throws under `generate:types`).

3. **17 import cycles, but only ONE is real.** 14 are the TanStack-Form `useAppForm` pattern
   (`form-hooks.ts` ↔ `form-components/*` ↔ `form-base.tsx`) — by-design mutual reference, low risk.
   The real one is a 5-node cross-layer loop through the Payload graph (see Risk Zones).

4. **The true load-bearing leaves are tiny and stable** — `lib/cn.ts` (Ca=99, I=0%), `lib/auth/roles.ts`
   (Ca=41, I=0%), `lib/constants/transfers.ts` (Ca=24, I=0%). High blast radius if changed, but they almost
   never change. The transfer-type union AGENTS.md warns about (`lib/constants/transfers.ts`) is provably a contract: 24 dependents, zero outgoing.

5. **8 orphans** — mostly framework entry points (`app/icon.tsx`, `global-error.tsx`, `template.tsx`,
   `loading.tsx`) that are legitimately import-less. Two non-route orphans deserve a dead-code check:
   `lib/tables/column-meta.ts` and `lib/parse-date-range.ts`. (`column-meta.ts` is a known module-augmentation file — grep-invisible; verify before deleting.)

## Load-bearing modules (high Ca = wide blast radius on a contract change)

| Module                                 | Ca  | Ce  | I%  | Role (evidence)                                            | Caution                                          |
| -------------------------------------- | --- | --- | --- | ---------------------------------------------------------- | ------------------------------------------------ |
| `lib/cn.ts`                            | 99  | 0   | 0   | Tailwind class merger; ubiquitous leaf                     | Repo-wide blast radius, but stable — safe        |
| `components/ui/icons/icon-variants.ts` | 48  | 0   | 0   | Shared icon variant contract                               | Stable leaf                                      |
| `components/ui/button.tsx`             | 43  | 1   | 2   | Base UI primitive                                          | Stable; API change ripples to 43 sites           |
| `lib/auth/roles.ts`                    | 41  | 0   | 0   | **Role hierarchy contract** (ADMIN/OWNER/MANAGER/EMPLOYEE) | Auth-sensitive; 41 dependents, edit deliberately |
| `types/reference-data.ts`              | 34  | 1   | 3   | Cross-layer data contract                                  | Contract change crosses many layers              |
| `lib/constants/transfers.ts`           | 24  | 0   | 0   | **Transfer-type union** (AGENTS.md)                        | Provable contract; 24 dependents                 |
| `lib/auth/require-auth.ts`             | 16  | 3   | 16  | Auth gate for actions                                      | Auth-sensitive entry guard                       |
| `lib/queries/reference-data.ts`        | 14  | 6   | 30  | Cached reference fetch                                     | Composer; depends on 6, feeds 14                 |
| `lib/db/sum-transfers.ts`              | 11  | 2   | 15  | Raw-SQL financial calc                                     | Money path; high-sensitivity                     |

## Orchestrators (high I% = fragile to neighbor changes)

| Module                                 | Ca  | Ce  | I%  | Notes                                                   |
| -------------------------------------- | --- | --- | --- | ------------------------------------------------------- |
| `lib/tables/transfers.tsx`             | 10  | 11  | 52  | Transfers table; composes 11 deps, in the real cycle    |
| `lib/actions/utils.ts`                 | 12  | 9   | 43  | Action helpers; **node in the real cycle**              |
| `payload.config.ts`                    | 20  | 11  | 35  | Payload hub; depended-on AND depends-on; **cycle node** |
| `components/forms/hooks/form-hooks.ts` | 18  | 6   | 25  | `useAppForm` core; center of the 14 form cycles         |

## Risk zones

| Zone                            | What                                                                                                                                                                         | Evidence                           | Why it matters                                                                                                                                                                                                                                                                                                                                                       | Next check                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Payload-hook ↔ action cycle** | 5-node loop: `lib/actions/utils.ts` → `payload.config.ts` → `collections/transfers.ts` → `hooks/transfers/sync-sheet.ts` → `lib/actions/sheets-sync.ts` → back to `utils.ts` | `depcruise --output-type err-long` | The transfer collection's hook reaches back into the actions layer, which reaches back into the Payload config to get a client. Editing sync-sheet, the transfer collection, or action utils can ripple unpredictably across the config graph. Classic Payload trap (hooks live in the collection's config graph but call server actions that re-import the config). | Deep Focus (M4L3) candidate. Can the sync-sheet hook avoid importing `lib/actions/*`? |
| **Financial SQL**               | `lib/db/sum-transfers.ts` Ca=11, plus `lib/db/*` raw-SQL layer                                                                                                               | metrics + AGENTS.md                | Money calculations; AGENTS.md flags `@vercel/postgres` raw SQL. High change-sensitivity.                                                                                                                                                                                                                                                                             | `unknown`: graph doesn't show SQL correctness — needs test coverage review            |
| **Auth contracts**              | `lib/auth/roles.ts` (Ca=41), `require-auth.ts` (Ca=16)                                                                                                                       | metrics                            | Wide blast radius on the access-control plane                                                                                                                                                                                                                                                                                                                        | Verify `src/access/*` consumes these consistently                                     |
| **Orphans**                     | `lib/tables/column-meta.ts`, `lib/parse-date-range.ts`                                                                                                                       | `no-orphans` rule                  | Possible dead code                                                                                                                                                                                                                                                                                                                                                   | Gate any deletion on `tsc`, not grep (column-meta is a module augmentation)           |

## Unknowns (what the static graph cannot show)

- **No territory cross-reference** — git-history "hot vs frozen" not yet captured; all activity claims here are inferred.
- **Runtime coupling invisible**: Payload hook registration, `getPayload({ config })` dynamic resolution,
  feature flags, cache-tag wiring, and Next.js route-handler boundaries don't appear as imports.
- **Cycle severity unranked by the tool** — the form cycles are by-design; only human reading separated them from the real one.
- **`src/access/` is nearly empty in the graph** (1 file) — RBAC logic may live inline in collections; the graph won't reveal that.

## Optional next step: graph render

Only after selection. Candidate single-question render: the 5-node Payload-hook cycle, via
`depcruise --focus "hooks/transfers/sync-sheet" --output-type dot | dot -T svg`. Not the whole `src/` (hairball).
