# Artifact 2 — Structure (dependency graph)

> Wide Scan / structural signal for the Project Map. Evidence from `dependency-cruiser@17.4.3`
> over `src/` (config: `.dependency-cruiser.cjs`), excluding tests, mocks, `.d.ts`, migrations.
> Command: `pnpm exec depcruise src --config .dependency-cruiser.cjs --output-type <metrics|err-long>`
>
> **Re-cruised 2026-07-08** after the `lib/tables/* → components/tables/*` move (`a8691df`) and the
> `lib/cn.ts → lib/utils/cn.ts` / `lib/parse-date-range.ts → lib/utils/parse-date-range.ts` /
> `lib/tables/column-meta.ts → components/tables/column-meta.ts` relocations. Graph now:
> **399 modules, 1238 dependencies, 26 violations (0 errors, 16 warnings)**. The territory anchor
> `artifact-1-territory.md` now exists — activity claims are cross-referenced there, no longer `unknown`.

## Key observations

1. **The repo's gravitational center is `src/lib` (Ca=315).** Almost everything depends on it. Inside it, the
   instability gradient is _correct_: contract layers are stable, orchestration layers are not.
   `lib/auth` I=5%, `types` I=3%, `lib/constants` I=3% (stable, depended-upon) vs `lib/actions` I=54%,
   `lib/queries` I=63% (unstable composers). Stable things don't depend on unstable things — textbook.

2. **Both documented architectural invariants HOLD.** The two `error`-severity rules encoding AGENTS.md
   boundaries produced zero violations:
   - Payload hooks (`hooks/transfers/*`, `hooks/revalidate-collection.ts`) do **not** import `lib/cache/revalidate.ts` (which calls `updateTag`, illegal in a hook's Route Handler context).
   - The Payload CLI graph (`payload.config.ts` + `collections/`) does **not** import `env.server.ts` (`server-only`, throws under `generate:types`).

3. **16 cycles, but every one is already benign.** 15 are the by-design TanStack-Form `useAppForm`
   pattern. The other "real" one is the Payload loop (`config → collections/transfers → sync-sheet →
sheets-sync → … → config`, which depcruise splits into 3 overlapping paths). **It is NOT live debt:**
   the hook→action edge is a deliberate lazy `await import()` (see `hooks/transfers/sync-sheet.ts` +
   its comment), so the module-init chain never closes — depcruise flags it only because it resolves
   dynamic imports into the graph. A separate `lib/constants/transfer-rules.ts ↔ transfers.ts` cycle is
   likewise author-documented as call-time-safe (`transfers.ts:139`). So `no-circular` here is
   **noise-only** — a tooling signal, not a code smell to fix. See Risk Zones + EX-411.

4. **The true load-bearing leaves are tiny and stable** — `lib/utils/cn.ts` (Ca=99, I=0%),
   `lib/auth/roles.ts` (Ca=44, I=0%), `lib/constants/transfers.ts` (Ca=29, I=3%). High blast radius if
   changed, but they almost never change. The transfer-type union AGENTS.md warns about
   (`lib/constants/transfers.ts`) is provably a contract: 29 dependents, one outgoing.

5. **10 orphans** — mostly framework entry points (`app/icon.tsx`, `global-error.tsx`, `template.tsx`,
   `loading.tsx`, `proxy.ts`, and the three new `app/(legal)/*` pages) that are legitimately import-less.
   Two non-route orphans: `components/tables/column-meta.ts` (module-augmentation — grep-invisible; gate
   deletion on `tsc`) and `lib/utils/parse-date-range.ts` — the latter is **NOT dead**: it's imported by
   `__tests__/small-utils.test.ts`, and depcruise excludes `__tests__`, so it shows as a false orphan.

## Load-bearing modules (high Ca = wide blast radius on a contract change)

| Module                                 | Ca  | Ce  | I%  | Role (evidence)                                            | Caution                                                            |
| -------------------------------------- | --- | --- | --- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `lib/utils/cn.ts`                      | 99  | 0   | 0   | Tailwind class merger; ubiquitous leaf                     | Repo-wide blast radius, but stable — safe                          |
| `components/ui/icons/icon-variants.ts` | 48  | 0   | 0   | Shared icon variant contract                               | Stable leaf                                                        |
| `lib/auth/roles.ts`                    | 44  | 0   | 0   | **Role hierarchy contract** (ADMIN/OWNER/MANAGER/EMPLOYEE) | Auth-sensitive; 44 dependents, edit deliberately                   |
| `components/ui/button.tsx`             | 44  | 1   | 2   | Base UI primitive                                          | Stable; API change ripples to 44 sites                             |
| `types/reference-data.ts`              | 35  | 1   | 3   | Cross-layer data contract                                  | Contract change crosses many layers                                |
| `lib/constants/transfers.ts`           | 29  | 1   | 3   | **Transfer-type union** (AGENTS.md)                        | Provable contract; 29 dependents                                   |
| `lib/auth/require-auth.ts`             | 19  | 3   | 14  | Auth gate for actions                                      | Auth-sensitive entry guard; **in the real cycle**                  |
| `lib/queries/reference-data.ts`        | 14  | 8   | 36  | Cached reference fetch                                     | Composer; depends on 8, feeds 14                                   |
| `lib/db/sum-transfers.ts`              | 5   | 5   | 50  | Raw-SQL financial calc                                     | Money path; **now unstable** (was Ca=11/I=15) — grew outgoing deps |

## Orchestrators (high I% = fragile to neighbor changes)

| Module                                 | Ca  | Ce  | I%  | Notes                                                                               |
| -------------------------------------- | --- | --- | --- | ----------------------------------------------------------------------------------- |
| `lib/actions/run-action.ts`            | 9   | 8   | 47  | Action runner; **new node in the real cycle** (replaced deleted `actions/utils.ts`) |
| `lib/actions/sheets-sync.ts`           | 4   | 7   | 64  | Sheets sync action; **cycle node**                                                  |
| `payload.config.ts`                    | 26  | 12  | 32  | Payload hub; depended-on AND depends-on; **cycle node**                             |
| `components/tables/transfers.tsx`      | 2   | 10  | 83  | Transfers table (moved from `lib/tables/`); composes 10 deps                        |
| `components/forms/hooks/form-hooks.ts` | 17  | 6   | 26  | `useAppForm` core; center of the 15 form cycles                                     |

## Risk zones

| Zone                                       | What                                                                                                  | Evidence                                       | Why it matters                                                                                                                                                                                                                                         | Next check                                                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Payload-hook cycle (already mitigated)** | `config → collections/transfers → sync-sheet → sheets-sync → … → config` (3 overlapping paths)        | `depcruise --output-type err-long` + code read | **Runtime-safe:** the hook→action edge is a lazy `await import()` (`sync-sheet.ts`, commented), so the init chain never closes; all 3 paths cross that one dynamic edge. depcruise reports it only because it resolves dynamic imports. NOT live debt. | **No code fix.** Tooling decision only: keep `no-circular` at `warn` (never block push), optionally baseline. See EX-411. |
| **Financial SQL**                          | `lib/db/sum-transfers.ts` Ca=11, plus `lib/db/*` raw-SQL layer                                        | metrics + AGENTS.md                            | Money calculations; AGENTS.md flags `@vercel/postgres` raw SQL. High change-sensitivity.                                                                                                                                                               | `unknown`: graph doesn't show SQL correctness — needs test coverage review                                                |
| **Auth contracts**                         | `lib/auth/roles.ts` (Ca=44), `require-auth.ts` (Ca=19)                                                | metrics                                        | Wide blast radius on the access-control plane                                                                                                                                                                                                          | Verify `src/access/*` consumes these consistently                                                                         |
| **Orphans**                                | `components/tables/column-meta.ts` (module augmentation), `lib/utils/parse-date-range.ts` (test-only) | `no-orphans` rule                              | `parse-date-range.ts` is a **false orphan** — imported by `__tests__/small-utils.test.ts`, which depcruise excludes. `column-meta.ts` is grep-invisible.                                                                                               | Gate any deletion on `tsc`, not grep. `parse-date-range` is live via tests — keep.                                        |

## Unknowns (what the static graph cannot show)

- **Runtime coupling invisible**: Payload hook registration, `getPayload({ config })` dynamic resolution,
  feature flags, cache-tag wiring, and Next.js route-handler boundaries don't appear as imports.
- **Cycle severity unranked by the tool** — the form cycles are by-design; only human reading separated them from the real one.
- **`src/access/` is nearly empty in the graph** (1 file) — RBAC logic may live inline in collections; the graph won't reveal that.

## Optional next step: graph render

Only after selection. Candidate single-question render: the 7-node Payload-hook cycle, via
`depcruise --focus "hooks/transfers/sync-sheet" --output-type dot | dot -T svg`. Not the whole `src/` (hairball).
