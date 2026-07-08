# Repo Map — onboarding guide

> Synthesis of three Wide-Scan artifacts, **not** a re-derivation. Reads them together:
> [`artifact-1-territory.md`](artifact-1-territory.md) (git activity) ·
> [`artifact-2-structure.md`](artifact-2-structure.md) (dependency graph) ·
> [`artifact-3-contributors.md`](artifact-3-contributors.md) (authorship).
> Window: full repo history, 2026-02-11 → 2026-07-08 (975 commits, ~5 months old).
> Goal: after 15 minutes here you know where things live, what's dangerous, and where to start.

## 1. TL;DR

Wykonczymy is a **Next.js + Payload CMS business dashboard** for a finishing/renovation
company — cash registers, transfers, investments, employees, plus a Google-Sheets
"kosztorys" (cost estimate) integration and a Facebook Lead Ads pipeline. Polish UI,
English code. It is a **solo project** (one human, Konrad; 72% of commits pair-authored
with Claude agents), so `AGENTS.md` + `context/` are the only second source of truth —
treat them as load-bearing, not decoration. The system's center of gravity is the
**transfer/finance engine**: it is simultaneously the most-depended-on code (artifact-2)
and the most-churned (artifact-1). Danger concentrates in three places — the money SQL,
one real import cycle through the Payload hook graph, and the two composition-hub route
pages that touch everything.

```mermaid
graph TD
  subgraph routes["app/(frontend) — routes"]
    INW["inwestycje/[id] ⚠hub"]
    KASA["kasa/[id] ⚠hub"]
    OTHER["uzytkownicy · raporty · kosztorysy · zgloszenia"]
  end
  subgraph comp["components"]
    FORMS["forms (TanStack)"]
    DIALOGS["dialogs"]
    UI["ui (shadcn)"]
    TABLES["tables + transfers"]
  end
  subgraph lib["lib — gravity center (Ca=315)"]
    ACTIONS["actions (mutations)"]
    QUERIES["queries (fetch/cache)"]
    DB["db (raw SQL 💰)"]
    GOOGLE["google (Sheets)"]
    LEADS["leads (FB)"]
    CONST["constants/transfers ⭐contract"]
    AUTH["auth/roles ⭐contract"]
  end
  PAYLOAD["payload.config + collections + hooks 🔄cycle"]

  routes --> QUERIES
  routes --> comp
  FORMS --> ACTIONS
  DIALOGS --> FORMS
  ACTIONS --> QUERIES
  ACTIONS --> DB
  ACTIONS --> GOOGLE
  ACTIONS -.real cycle.-> PAYLOAD
  PAYLOAD -.hook.-> ACTIONS
  comp --> UI
  ACTIONS --> CONST
  routes --> AUTH
```

## 2. Terrain — big vs peripheral, deep vs shallow

**Deep, load-bearing (high responsibility):**

- `lib/` is the gravitational center — `Ca=315`, almost everything depends on it
  (artifact-2). Inside it the instability gradient is textbook-correct: contracts stable
  (`constants` I=0%, `auth` I=5%), composers unstable (`actions` I=54%, `queries` I=63%).
- `components/forms` (435 commits) + `components/ui` (409) are the most-touched surfaces —
  the app is form-heavy, built on TanStack Form via `useAppForm()`.

**Composition hubs (edit-blast-radius, not dependency-blast):**

- `app/(frontend)/inwestycje/[id]/page.tsx` (63 commits, 52 areas) and
  `kasa/[id]/page.tsx` (43 commits, 51 areas) assemble most of the app. Distinct from
  artifact-2's dependency leaves (`lib/cn.ts` Ca=99) — those are _depended-on_; these are
  where _edits land_.

**Peripheral / shallow:** `access/` (nearly empty in the graph — RBAC likely inline in
collections), `scripts/`, `seed.ts`, framework orphans (`icon.tsx`, `template.tsx`).

**Activity over time** (artifact-1): Feb–Mar build-out (forms/routes) → May Google-Sheets
pivot → **July = leads pipeline + UI refresh**. The hot area moves; weight recency.

## 3. Real coupling — what actually changes together

Cross-referencing git co-change (artifact-1) with the import graph (artifact-2):

| Coupling                                              | Source         | Kind                                                          |
| ----------------------------------------------------- | -------------- | ------------------------------------------------------------- |
| `__tests__` ↔ `lib/actions` (75) / `lib/queries` (52) | git            | **Real** — tests guard the data/mutation layer; move together |
| `components/forms` ↔ `lib/actions` (44)               | git + graph    | **Real** — a form + its server action ship as a unit          |
| `components/dialogs` ↔ `components/forms` (39)        | git + graph    | **Real** — dialogs wrap forms; near-inseparable               |
| `lib/actions` ↔ `lib/queries` (40)                    | git + graph    | **Real** — mutate-then-invalidate/read                        |
| the 5-node Payload hook cycle                         | **graph only** | **Real & risky** — invisible to git (§4)                      |
| the 14 `useAppForm` form cycles                       | **graph only** | By-design mutual refs; low risk                               |
| `migrations/index.ts` spanning 47 areas               | git only       | **Regeneration** — cheap/mechanical, _not_ a design signal    |

The **action ↔ query ↔ form ↔ dialog cluster** is the app's true working unit — a feature
change rarely stays inside one of them. Where sources disagree: git can't see the Payload
hook cycle (runtime/config coupling), and the graph can't see that `migrations/index.ts`
churn is just re-exports. `access/` coupling is **`unknown`** — the graph barely covers it.

## 4. Risk zones

| Zone                                                  | Why                                                                                                                                                                                                          | Evidence                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| **Transfer/finance core**                             | Most-depended-on _and_ most-churned; `constants/transfers.ts` is a 24-dependent contract, `actions/transfers.ts` the #1 churned file. AGENTS.md warns the transfer-type union goes stale.                    | artifact-1 + artifact-2 agree     |
| **Money SQL** (`lib/db/sum-transfers.ts`)             | Raw `@vercel/postgres` financial calc; graph can't verify correctness — needs test coverage.                                                                                                                 | artifact-2 `unknown`              |
| **Payload hook ↔ action cycle**                       | 5-node loop: `actions/utils.ts` → `payload.config.ts` → `collections/transfers.ts` → `hooks/transfers/sync-sheet.ts` → `actions/sheets-sync.ts` → back. Editing sync-sheet ripples through the config graph. | artifact-2 (`depcruise err-long`) |
| **Auth contracts** (`auth/roles.ts` Ca=41)            | Wide blast radius on the access plane; `access/` logic is graph-invisible so real reach is under-measured.                                                                                                   | artifact-2                        |
| **Composition hubs** (`inwestycje/[id]`, `kasa/[id]`) | Touch almost anything and one moves; hardest pages to change safely.                                                                                                                                         | artifact-1 (52/51 areas)          |
| **Stale map path** ⚠                                  | `lib/tables/*` moved to `components/tables/*` today (`a8691df`); artifact-2 still cites the old path. Re-cruise before trusting its table-layer rows.                                                        | artifact-1 existence check        |

## 5. Who to ask

**One human — Konrad (ex-Plant) — for every area.** No knowledge distribution, no bus-factor
redundancy (artifact-3). Practical substitute for "asking an expert": read the area's
`context/` doc + relevant `AGENTS.md` section and pair with an agent — that is how 72% of the
code was written. Colder areas (`auth`, `access`, older settlements) will need a re-read even
by the author.

## 6. First day — read these, in order

1. **`AGENTS.md`** — the rulebook; non-inferable conventions (mutation pattern, cache
   `updateTag` vs `revalidateTag`, env layer, migrations-by-hand).
2. **`src/collections/transfers.ts`** — the transfer-type union; the domain's spine (AGENTS.md
   says read it here, don't trust copies).
3. **`src/lib/actions/transfers.ts`** — #1 churned file; the mutation pattern in the flesh.
4. **`src/lib/db/sum-transfers.ts`** — how the money is actually computed (raw SQL).
5. **`src/app/(frontend)/inwestycje/[id]/page.tsx`** — the biggest composition hub; shows how
   a page wires queries + components together.
6. **`src/components/forms/` + `useAppForm()`** — the form spine every feature touches.
7. **`context/foundation/investment-financials-and-discount.md`** — how marża / materiały /
   robocizna / korekty connect (the finance model the UI reflects).
8. **`context/map/artifact-2-structure.md`** — the dependency detail behind §3–4 (mind the
   stale `lib/tables` path).

## 7. Limitations

- **Window & method:** full history but only ~5 months; "12 months" = the repo's whole life.
  This is an _activity + structure_ map, not a semantic one.
- **Churn ≠ importance ≠ risk** — a file edited 71× may be volatile-by-design or a pain point;
  git can't distinguish. Always pair artifact-1 counts with artifact-2 stability.
- **What the map does NOT tell you:** runtime coupling (Payload hook registration,
  `getPayload({config})` dynamic resolution, cache-tag wiring), SQL correctness, the
  Sheets/Payload-admin planes (under-represented in file churn), and `access/` RBAC (nearly
  graph-invisible). These are `unknown`, not "no coupling."
- **Generated vs hand-edited coupling** is separated where known (`migrations/index.ts`,
  `payload-types.ts`) — regeneration churn is cheap and must not be read as design pressure.
- **One snapshot in a moving repo** — `lib/tables` moved _during_ this mapping session; expect
  further drift and re-cruise `artifact-2` when the structure feels off.
