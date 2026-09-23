# AGENTS.md

Only what's true for THIS repo and not inferable from the framework or `@package.json`. Global conventions (style, TS/React/Next/Tailwind, git, personas) live in the user's global rules.

## Project Overview

Business management dashboard for cash registers, transfers, investments, and employees. Next.js + Payload CMS. **Polish UI, English code.** Code comments are always in English, even when the UI strings they sit next to are Polish. Versions in `@package.json`.

### Naming a financial figure

Canonical identifiers, the App↔Code translation, and the drift still to fix live in the glossary
`@context/domain/02-glossary.md` (backed by **EX-548**) — **consult it before naming a figure.** The
four rules it enforces:

1. **Polish only for sheet proper nouns.** A Polish identifier survives only as the name of a
   specific artifact in the owner's sheet with **no clean English equivalent** (`kosztorys`,
   `przedmiar`, `pomiar`). The test is the English equivalent, not "the sheet says it in Polish" —
   the sheet also says `etapy` / `robocizna`, which are `stage` / `laborCosts` in code and stay
   Polish in UI labels and prose only.
2. **Everything else is English.** A generic figure is not a sheet noun: `balance` / `margin` /
   `discount` / `deposit` / `payout` / `loss` — never `bilans` / `marza` / `rabat` / `wplaty` /
   `wyplaty` / `strata`.
3. **No half-translated identifiers.** A Polish root welded to an English affix (`robociznaNet`,
   `zaliczkiByStage`, `wplatyNet`) is banned outright — one identifier is one language, and that
   language is English.
4. **One concept, one name** — the cardinal sin is two. A figure carries the _same_ identifier in
   kosztorys as on the transfers side (`src/collections/transfers.ts`, `src/lib/db`), so nobody
   translates across the recon seam.

**Plane suffix — the only exception to rule 4.** Where a concept genuinely exists on _both_ the
kosztorys and the transactions plane and the reconciliation compares the two, keep the base name
identical and append `FromKosztorys` / `FromTransactions` — `laborCostsNetFromKosztorys` /
`laborCostsNetFromTransactions`. The shared prefix keeps the pair legible as one concept.
**Only where two planes actually collide:** a one-plane figure stays bare (`depositsByStage`), as
does an aggregate at its own source (`totalLaborCosts`). The suffix warns that a twin exists —
hang it on everything and it stops warning.

## The Owner's Reference Sheet (read this before touching kosztorys)

The kosztorys editor is a port of a live Google Sheet. **The sheet is the domain authority** — when a
question is "what does this figure mean to the business", read the sheet's formulas, don't reason from
our code. Ours is the copy; theirs is the original.

**One register per message — never mixed.** This governs **how the agent talks to the owner**, not
identifier naming — that's the `Polish UI, English code` rule above; never read this as license for
Polish code identifiers. Talk kosztorys in the sheet's names: „Przedmiar", „Pomiar
z natury", „etapy", „Cena j.m.", „rabat", „Wartość netto przedmiar". **Never** `plannedQty` /
`measuredQty` / `rowValueForView`, and never both registers in one message — not even as a
parenthetical gloss or a mapping column. Sheet names for any domain/design conversation; code
identifiers only in code review, implementation notes, and commits. The user reasons about the
business, so translating between the two is the agent's job, silently — the mapping belongs in
`context/reference/kosztorys-editor-domain-notes.md`, not in the conversation.

**Current reference** — _"Kopia aktualny arkusz 16 lipca 2026 - wersja w jakiej klient dostaje to
wstępnie"_, i.e. the state a client receives as an initial offer:

```
1kEWaMv9KRRXVaSMu3AJRw_ptxucnF4oafLR74VWeRHg    # tab kosztorys_robocizny, gid=70964819
```

Shared read-only with the service account in `GOOGLE_SERVICE_ACCOUNT_JSON`. Read it with the existing
inspector — it dumps **formulas and values side by side**, which is the whole point (a formula is
evidence, a rendered number is only a hint):

```bash
SHEET_ID=1kEWaMv9KRRXVaSMu3AJRw_ptxucnF4oafLR74VWeRHg TABS="kosztorys_robocizny" MAX_ROWS=464 \
  node --env-file=./.env scripts/inspect-sheet.mjs > /tmp/sheet.txt
```

**Filled test sheet** (better for testing than the canonical, which is a blank initial offer) —
_„wypełniony kosztorys do testów"_, real values across all figures **plus** the three v1-sync mirror
tabs (`wydatki inwestycyjne` / `transfery` / `rozliczone R+M`) baked in:

```
1qN68vcevWgq0fXckdh4cuyBJ4iGZNlivVuHDvLuzWy4    # tab kosztorys_robocizny, gid=70964819
```

Also shared read-only with the service account. Nine tabs (adds `materiały`, `pokoje`, `Podsumowanie`,
the two `zakres pracy z/bez narzędzi` catalogues). Its layout carries column `T = „komentarz"` and the
`U–AE` per-etap wartość axis (`AE` = bilans), so it's the canonical fixture for parity/import work.
**Caveat (owner):** some formulas in this test sheet are broken here and there — treat it as a rich
_shape/layout_ fixture, and cross-check any figure against the canonical sheet before trusting it as spec.

Screenshots of the client-facing offer view (which columns/rows the owner hides before sending, and
the summary block at the bottom) — the target state the app must reach:

- `context/reference/kosztorys-sheet/offer-view-rows.png` — filtered item rows
- `context/reference/kosztorys-sheet/offer-view-footer.png` — summary block + section pie chart

**Load-bearing structural facts** (verified across all 435 item rows, 2026-07-16):

- `N` **Przedmiar** is typed by hand — the offered scope. `S` = `N × cena − rabat` = **the offer**.
- `O` **Pomiar z natury** is **not typed — it is a formula**: `=SUM(D:M)`, the ten stage-quantity
  columns. So in the owner's model **pomiar IS the stage sum**, and `T` = `O × cena − rabat` is what
  has actually been executed. This is the fact EX-494 turns on.
- The footer keeps `wartość netto` (`T456`) and `R netto - suma prac wykonannych` (`T463`) as separate
  named rows — read them before assuming which figure the UI's "total" should be.

Domain background (prose, may lag the sheet — verify against it): `context/reference/kosztorys-editor-domain-notes.md`.

## Backlog & Task Tracking

- **Slices:** `context/foundation/roadmap.md` is the source of truth — the v2 arc (`F-01`, `S-01`…`S-19`) in dependency order, each with a `Status` field (`ready` / `proposed` / `blocked` / `done`). Start here for what to build next. Built from `context/foundation/prd.md` via `/10x-roadmap`; per-change plans land in `context/changes/<change-id>/` via `/10x-plan`.
- **Todos & live status:** Linear project **"Wykonczymy"** (team Ex-plant) only — the slice-status mirror plus every smaller / ad-hoc task. No second todo file. The moment you start work that has a Linear issue — any slice, task, or ad-hoc item, not just slices — flip that issue to In Progress (agents routinely forget this), and to Done when complete. **Reality-check Linear access first** — if the Linear MCP isn't connected, update the slice's `Status` in `roadmap.md` rather than claim a Linear change you can't make.
- **All prose docs live under `context/`** (`foundation/` durable, `changes/` in-flight, `archive/` done, `reference/` standalone references) — never create a top-level `docs/` dir.
- **Doc lifecycle:** a one-off design/plan doc is not current truth — verify its claims against code before trusting or quoting it. When a change ships, extract the durable rationale into the right living doc (`lessons.md` / a `foundation/` or `context/reference/` doc), then **archive** the raw doc under `context/archive/<slug>/`. Delete only pure scaffolds with zero unique rationale.
- Refactor/cleanup backlog: track in Linear; record new findings there rather than spawning a standalone audit doc.
- After ANY bigger change, plan/implementation etc. update the relevant living doc and clean up stale plans/designs per the Doc lifecycle rule above.

## Common Commands

Scripts live in `@package.json`. Non-obvious ones:

```bash
pnpm build         # generate:importmap + generate:types + next build (NO migrate — see Migrations)
pnpm exec vitest run src/__tests__/some-file.test.ts  # single test file — pnpm 10 no longer forwards `--` to nested scripts
pnpm generate:types  # regenerate src/payload-types.ts (gitignored — never `git add` it)
docker compose up -d  # local Postgres on port 5433
```

### The suites are serialized machine-wide

Every heavy script (`test`, `test:integration`, `test:parity`, `test:coverage`, `test:e2e`,
`test:e2e:warm`) and the pre-push unit leg run under `scripts/with-test-lock.sh`, which delegates
to the global `with-test-lock` tool (`~/.local/bin`). The mutex is a `mkdir` on the fixed path
`/tmp/dev-test-suite.lock`, so it spans **other checkouts, worktrees and repos** on this laptop —
that is the point: several agents share these 8 cores, and two suites at once take 5x as long as
one (97s → 483s, measured 2026-09-22), fail specs on the clock alone, and make the machine
unusable. A second run waits and says whose hold it is waiting on; a dead holder's lock is taken
over automatically. `NO_TEST_LOCK=1` skips it, and a nested call inherits the parent's hold, so
pre-push's four legs don't queue behind themselves.

**A `pnpm exec vitest run <file>` is deliberately NOT locked** — a single spec is seconds of one
core, and queueing it behind someone's full suite is the cost the lock exists to avoid. Reach for
the whole suite once, at the end of a run.

Timeouts in `vitest.config.ts` are raised above the 5s default (node 15s, dom 20s) for the same
contention: the limit is there to catch a hung spec, not to measure how busy the laptop was.

### Seeding kosztorys test data (local dev DB)

Two one-off scripts populate an investment's kosztorys with test rows (each wipes that
investment's kosztorys first; `INV` selects the target investment):

```bash
INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts       # realistic rozpiska from the test sheet (~40 items)
INV=7 node --env-file=.env --import tsx src/scripts/perf-seed-kosztorys.ts  # synthetic ~1000-item perf dataset
```

`seed-kosztorys.ts` reads a live Google Sheet (needs `GOOGLE_SERVICE_ACCOUNT_JSON`), so its
shape tracks the sheet's current state. Domain background: `context/reference/kosztorys-editor-domain-notes.md`.

### Migrations

`pnpm migrate:create` has emitted phantom drift since ~March 2026 (missing `.json` snapshots), so **hand-write migrations**: copy the structure of the latest file in `src/migrations/` and adjust FK constraints / internal Payload tables by hand. Don't trust an auto-generated migration blindly.

**Migrations are NO LONGER run by the build.** `payload migrate` was removed from `pnpm build` so a Vercel deploy (incl. previews) can never touch the schema — code and schema are separate planes. Apply migrations to prod deliberately with **`pnpm db:migrate:prod`** (dumps Neon prod first, then `payload migrate` against `DB_POSTGRES_URL_PROD`), run by a **human**, never the agent. A `.husky/pre-push` gate reminds you on a push to `main` that adds `src/migrations/*.ts`. **Order follows the direction of the migration.** Additive (the new code needs a column that isn't there yet) → migrate prod **before** pushing. Destructive (a `DROP COLUMN`) → the reverse, because the column is what the _old_ code needs: push first, migrate once the new deploy is live, or every request in between hits a live SELECT naming a dropped column (Postgres 42703). This is a **deploy-time** gate, not a phase gate — writing the migration and the local code that reads the column is one continuous local task; do not stop implementation or mark a plan phase "blocked on prod" while nothing is being pushed. The prod step is owed only when the code actually ships. Pattern owned by the `payload-prod-migrate` skill.

### Dependencies

Prefer hand-editing `@package.json` over `pnpm remove` / `pnpm install`. On this arm64 machine those re-link `node_modules` and can swap the native `lightningcss` binary to x64 — dropping `lightningcss.darwin-arm64.node` and breaking the Tailwind v4 / Turbopack CSS build with an error that blames `src/styles/globals.css`. Repair: `pnpm install --force`, then `rm -rf .next` and restart dev. Detail: `context/foundation/lessons.md`.

## Databases And Live Data

- **The real DB is Neon Postgres** — `DB_POSTGRES_URL_PROD` in `.env` is the live prod credential. **Never run SQL, migrations, or dumps-restores against the Neon URL**; a human applies prod migrations.
- The local app points at the docker Postgres on 5433 (`DB_POSTGRES_URL`, db `wykonczymy-db`) — a copy restored from Neon dumps: `pnpm db:dump` (prod → `dumps/dump-latest.sql`, also run by the pre-push hook) and `pnpm db:import` (dump → local). Refreshable, but confirm before wiping it — a restore loses anything entered locally since the last dump.
- The **E2E suite** runs against an isolated `db-test` container on **5435** (`DB_POSTGRES_URL_TEST`, db `wykonczymy-test`), never the dev DB. Populate/reset its fixtures with `pnpm db:import:test` (same dump → test DB). `pnpm test:e2e` starts the container (`--wait` on its healthcheck) but does **not** import — run `db:import:test` once after a fresh volume or to reset.
- **A `db-test` reset is `pnpm db:import:test`; the seeds on top of it are per-plane, not a fixed ritual.** Measured 2026-09-17 against `dumps/dump-latest.sql` (15.09) and the live container: the prod dump carries **65 kosztorysów / 195 sekcji / 4130 pozycji** and **4240 transakcji**. Read `DATASET_FLOOR` (`financial-golden-master-db.test.ts`) counter by counter — each names a DIFFERENT row shape, and one dump number does not answer two of them:
  - `investments > 50`, `registers > 10`, `transactions > 1000` — cleared by the dump.
  - `kosztorysItems > 20` — cleared 4130-fold. **`seed:kosztorys:test` is not what satisfies this**; it is the ~1000-row PERF fixture and only thickens a plane the dump already fills.
  - `grossDepositsWithNet > 2` — cleared: 27 wpłaty `vat_plane='GROSS'` **z** `net_amount`, across 22 investments (the seed's own 4 rows take it to 31/24). **`seed:deposits:test` is not what satisfies this either** — it now only pins two of those investments to fixed ids and fixed kwoty, so the brutto axis is exercised at a known figure.

  A `GROSS` wpłata **bez** `net_amount` is **0 rows in the dump and 0 rows in prod** — `getNetAmountError` has refused to save one since 2026-07-26, five days after `vat_plane` shipped, so none was ever booked. The code that derived a netto for such a row at VAT was deleted 2026-09-17; today it is worth 0 zł netto and only raw SQL can create one. The 222 untagged and 6 `NET` wpłaty in the dump are a different shape and never counted here.

  The one plane the dump genuinely lacks outright is `INVESTMENT_EXPENSE_NET` — **0 rows** — which is why `pnpm seed:materials-net:test` is required by `investment-render-parity-db.test.ts` (it asserts a compared investment has a wydatek netto and the „wszystko netto" concession).

  **Count the exact shape a counter names before claiming the dump covers it** — „wpłaty bez `net_amount`" and „`GROSS` bez `net_amount`" differ by 222 rows.

- **Google Sheets: two service accounts — reads everywhere, writes only from production.** The sheet
  id comes from the DB and every non-production database is a restored prod dump, so localhost,
  preview and the E2E DB all carry **live sheet ids**. That is how eight sheets took 36 foreign rows
  in 2026-08. The gate is therefore the **credential**, not a flag, because a flag is only as strong
  as the machine it runs on — and this machine holds production's secrets.
  `GOOGLE_SERVICE_ACCOUNT_JSON` (`kosztorys-sheets-reader@…`) is a **Viewer** on all 56 sheets and is
  what `.env`, Preview and Development carry; `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON`
  (`kosztorys-sheets@…`) is the **Editor** and exists **only in Vercel Production**. So a write from
  a dev machine is refused by Google (`403`), not by our code — no env var, no `VERCEL_ENV=production`
  and no code edit can undo that. `getWritableSheetsClient`
  (`src/lib/google/writable-sheets-client.ts`) is the one place **in the app** that mints a
  write-scoped **Sheets** token, and it throws a readable sentence when the credential is absent so
  you get an explanation instead of a bare 403; reads take `getReadonlySheetsClient()`, which is
  readonly by SCOPE — on production it carries the Editor account, so one share covers a sheet. The only
  other holder of the Editor credential is `scripts/share-sheets-with-reader.mjs`, which mints a
  **Drive** token — a strictly broader power, since it can change who may edit a sheet.
  Repairing a sheet happens from production, and there is no other route. The var is **optional in
  the schema everywhere but production**, where its absence fails the boot (`env/schema.ts`
  `superRefine`) — elsewhere the absence IS the gate, but on production deleting it would break no
  request and silently stop every transfer from reaching the owner's sheet.
  **A new sheet needs ONE share for production — Edytujący for the Editor account.** Production
  reads with the Editor credential too (`getReadonlySheetsClient` mints its readonly-scoped token
  from the write credential wherever that credential exists), so the reader share is what a sheet
  needs to be readable from **localhost / Preview / the E2E DB**, never from production:

  ```
  kosztorys-sheets@wykonczymy-kosztorys-bk.iam.gserviceaccount.com          → Edytujący   (produkcja)
  kosztorys-sheets-reader@wykonczymy-kosztorys-bk.iam.gserviceaccount.com   → Przeglądający (dev/preview)
  ```

  Never give the reader Editor — that would hand write rights back to every laptop for that sheet.
  `scripts/share-sheets-with-reader.mjs` does the reader half in bulk — from production, over a
  `id<TAB>name` TSV exported from psql: `node scripts/share-sheets-with-reader.mjs sheets.tsv`
  dry-runs, `--apply` grants. It skips a sheet the reader already holds, shouts if the reader was
  given anything above Viewer, and exits non-zero on any failure.

- **Poczta wychodzi tylko z produkcji — bramką jest `EMAIL_HOST`.** Poza produkcją wskazuje na
  `disabled.invalid` (zarezerwowany TLD, RFC 2606), więc wysyłka pada na DNS; prawdziwy host stoi
  zakomentowany obok w `.env` i podmienia się go ręcznie na czas pracy nad szablonami. Pusta wartość
  nie zadziała — `serverEnv` wymaga `.min(1)`. To nie jest kosmetyka: aplikacja jest **klientem**
  SMTP firmowego serwera, więc mail z localhosta wychodził z tej samej infrastruktury co produkcyjny,
  z poprawnym SPF/DKIM, do skrzynki odbiorczej. Listy odbiorców żyją w globalu Payloada
  `notification-recipients`, czyli **w bazie**, więc każdy `db:import` wsypuje prawdziwe adresy
  pracowników do każdego środowiska i `requireRecipients` nigdy nie zadziała jako ochrona.
  Pełna mapa efektów wychodzących (co ma bramkę, co jej świadomie nie ma i dlaczego):
  `context/reference/outgoing-effects-isolation.md` — **przeczytaj przed dodaniem nowej integracji
  wychodzącej.**

- **The production Vercel Blob store belongs to production only.** Invoice bytes live in Blob, which
  has no versioning and no undelete — and the local DB is a restored prod dump, so `media.filename`
  values are the real invoices. A delete on localhost against the production store therefore destroys
  a tax-retained faktura. Local dev, Vercel Development and Preview/staging all point
  `BLOB_READ_WRITE_TOKEN` at the **preview** store; the GitHub Actions secret of the same name stays
  **production** (the nightly backup must keep backing up production). No script reads
  `BLOB_READ_WRITE_TOKEN_PROD` — it is parked in `.env` for deliberate opt-in, so reaching production
  means exporting it at the call site:
  `BLOB_READ_WRITE_TOKEN="$BLOB_READ_WRITE_TOKEN_PROD" node scripts/blob-snapshot.mjs --download`.
  Run a blob script off plain `.env` and you get the **preview** store — the read-only tools won't
  object, they will just snapshot the wrong store and report success. Three guards enforce the write
  side: the env layer refuses a store/environment mismatch in **either** direction — the production
  token when `VERCEL_ENV !== 'production'`, and the preview token when it **is** (that store is wiped
  and re-restored as scratch, so production invoices written there are lost) —
  (`src/lib/env/schema.ts`), `src/payload.config.ts` runs the same check where it hands the token to
  the Blob plugin (the env layer never loads in the Payload graph, so `/admin` would otherwise delete
  unguarded), and `scripts/blob-restore.mjs` refuses **any** target that is not the preview store
  without `--allow-prod`. Beware
  `.env.local` — `vercel env pull` writes there and Next.js prefers it over `.env`. The preview store
  is a point-in-time copy, so an invoice newer than the last restore 404s locally; top it up with
  `pnpm blob:refresh:preview` (needs `lftp`; caches the FTP mirror in `dumps/blob-mirror`, uploads at
  most `BLOB_REFRESH_MAX` files per run). Detail: `context/reference/blob-recovery-runbook.md` §3.
- **Dumpy starych arkuszy klientów leżą poza gitem** — `~/.local/share/wykonczymy-legacy-sheets/`
  (kopia w `dumps/legacy-sheets/`, wycięta przez `.gitignore`): 57 arkuszy + `raport.md`. Skrypty,
  które je pobrały, są skasowane i żyją tylko w historii. Mapa:
  `context/reference/legacy-sheet-dumps.md`.
- Never `git push`; a human pushes to remotes.

## Architecture

### Route Groups

- `src/app/(frontend)` — main authenticated app
- `src/app/(auth)` — login page
- `src/app/(payload)` — Payload admin panel and API routes

**Parallel-route slots.** Shell chrome that needs route params (it can't read them from the layout)
gets a `@slot` directory under `(frontend)/`. The slot's `page.tsx` is a **re-export only** — the
component itself lives in `src/components/nav/` — and the slot needs a `default.tsx` for routes that
don't match. `@investmentCrumb` (the investment name + back arrow in the top bar) is the first and
currently only instance; mirror its shape rather than inventing a second arrangement.

**Editor hooks (EX-521).** `use-kosztorys-editor.ts` at the editor root is the **composition entry**
— it wires sub-hooks together and owns the return shape components read. Each cohesive cluster it
delegates to (stage ops, settlement settings, view state, …) is one leaf hook under
`editor/hooks/`. A new cluster goes there, not into a second root-level hook, and **nothing moves
into `KosztorysEditorProvider`** — context value-identity churn is the EX-496 perf regression that
was reverted once already. Logic that is genuinely React-free belongs one layer further out in
`src/lib/kosztorys/`, where it is testable without rendering anything — the cheapest layer wins. A
hook whose risk is genuinely the lifecycle (overlapping async saves, teardown on unmount) gets a
`renderHook` spec under the `dom` vitest project instead; `use-kosztorys-settings.test.tsx` is the
pattern.

### Important Directories

Most are self-describing (`src/collections`, `src/access`, `src/stores`, …). The non-obvious ones:

- `src/lib/db` — the raw-SQL **data-access** layer: a statement plus its row mapper, nothing else. Auth,
  caching and view-shaping belong one layer up in `src/lib/queries`, and mutations in `src/lib/actions`.
  It started as financial calculations only and is now much wider (`get-db`, `where-to-sql`,
  `with-payload-transaction`, `snapshots`, `presets`, `notifications`, `kosztorys-tree`) — read the rule,
  not the original theme, when deciding whether a new file lands here.
  A **read** a client component invokes on demand is a `'use server'` function in `src/lib/queries`
  (`register-balance.ts`, `investment-asset-ids.ts`) — never in `src/lib/actions`, which is mutations only.
- `src/lib/cache` — cache tags + revalidation helpers
- `src/scripts/data` — input data a one-off script reads at runtime (TSV/JSON/CSV), beside its script.
  Test fixtures go to `src/__tests__/fixtures/` instead — or to `e2e/fixtures/` for a file a
  Playwright spec or an E2E seed script uploads — the only other fixtures home there is.
- Per-feature schemas/hooks live under `src/components/forms/<form>/`, not in `src/types` (which is cross-feature only).
  **A hook's home follows its consumer count, not its subject:** one form → `forms/<form>/`; two or
  more forms → `forms/hooks/`; a non-form surface → `src/hooks/`. That is why the three file-ingest
  hooks sit in three directories (`expense-form/use-invoice-files.ts`, `forms/hooks/use-file-pick-ingest.ts`,
  `hooks/use-invoice-upload.ts`) — one rule, not three accidents. `forms/hooks/` therefore means
  "shared by 2+ forms", not "domain-free form plumbing"; a domain-aware hook belongs there too once a
  second form uses it.
  The counting is over **directories, not files**: three cells in one directory sharing a hook is
  still one consumer, so `useCellDraft` stays colocated in `editor/grid/cells/` while
  `useInlineRename` — read from two directories — sits in `editor/hooks/`. Promote a hook when a second
  directory reaches for it, not when a third file in the same one does.
- `src/components/ui` is the domain-agnostic primitives layer — a component that knows it is filtering
  a list belongs in `src/components/filters/` (EX-730 moved the last four out of `ui/`; git history and
  older imports still point at the old home, so don't take a precedent from there).
  **The rule runs both ways, and `ui/` importing upward is how you spot the violation.** A primitive
  that reaches into `filters/` (or any feature directory) is in the wrong place, or the thing it reaches
  for is. EX-787 closed the last of them, in three directions: `ActiveFilterButton` and its checkbox
  twin `ActiveFilterLabel` moved **up** into `filters/` where they always belonged; `FilterGrid` moved
  **down** to `ui/control-grid.tsx` as `ControlGrid` — four consumers, only one of them in `filters/`,
  so it was a shared layout primitive filed under its first caller, not a filters component; and the
  data-table engine moved **sideways** into `tables/`. Nothing under `src/components/ui/` imports a
  feature directory today; keep it that way, because no lint rule enforces it.
- **`src/components/tables/` is the shared table layer** — per-domain column definitions
  (`transfers.tsx`, `investments.tsx`, …), the `@tanstack/react-table` module augmentation
  (`column-meta.ts`), and the generic engine in `tables/data-table/`. The engine lived in `ui/` until
  EX-787 and does not belong there: a toolbar with `search` / `filters` / `columns` / `actions` slots
  knows it is a data table, and reaching up into `filters/` from `ui/` made the directory graph cycle.
  It is nested in its own subdirectory rather than flattened beside the column defs, which are a
  different kind of thing. Its ~15 consumers are `*-data-table.tsx` files in eleven feature
  directories — there is no "beside the consumer" home for it.
- **The datasheet-grid seam runs one way.** `src/components/ui/datasheet-grid/` holds the presentational
  primitives a cell renders (`EditableCellInput`, `ReadOnlyCellText`, `CellSelectMenu`); the `Column`
  factories that know what a figure MEANS live in `src/components/kosztorys/editor/grid/cells/`. A
  factory imports a primitive, never the reverse — that is why `decimalColumn` sits under `kosztorys/`
  despite looking generic: it is parameterised by a `CellEditPolicyT`, which is domain.

## Auth And Roles

JWT auth via Payload using the `payload-token` cookie (7-day lifetime). Roles: `ADMIN`, `OWNER`, `MANAGER`, `EMPLOYEE`. Hierarchy in `src/lib/auth/roles.ts`; access control functions in `src/access`.

## Mutation Pattern

All mutations go through `protectedAction()` in `src/lib/actions`:

- `'use server'`
- `requireAuth()`
- perf logging via `perfStart()`
- return `ActionResultT`
- trigger cache revalidation where needed

## Data Fetching And Cache

- Financial calculations use raw SQL via `@vercel/postgres` (in `src/lib/db`), not the Payload ORM.
- Cache uses `unstable_cache` with tag-based invalidation; `cacheComponents` and `'use cache'` are disabled due to a Vercel bug.
- Revalidation differs by context: in **server actions** (`lib/actions`, `lib/cache/revalidate.ts`) use `updateTag()` for immediate expiration; in **Payload hooks** (`hooks/`), **Route Handlers** and **crons** use `revalidateTag()` — those run in a Route Handler context where `updateTag` throws. Never import `lib/cache/revalidate.ts` from a Payload hook.
- **A cache entry that only ever changes for ONE row is tagged with `entityTag`, not a collection slug** — and the action that writes that row expires it through `protectedAction`'s `opts.entityTags`, not its collection list. A collection slug is bumped by every write to that collection anywhere in the app: `collection:investments` alone is fired by every kosztorys settings save, every investment form save and the whole `KOSZTORYS_TREE_TAGS` group, so tagging one investment's gallery with it evicted all 65 galleries on a write that touched none of them (EX-849). Keep a collection slug on the entry only for a tag whose writes genuinely cannot name the row — `fetchInvestmentAssets` keeps `CACHE_TAGS.media` because „Oznacz jako rzut" changes `media.kind` without touching the investment. **Counting the writers is part of the change**: that gallery had five, one of them in `lib/actions/lead-assets.ts`, and an entity tag left off any one of them is a permanently stale read.
- **`revalidateTag` always takes a second argument, and it is `EXPIRE_NOW` from `lib/cache/tags.ts`** — never a named profile and never the one-arg form. The argument is a cacheLife profile; a named one (`'default'`, `'max'`) sets the tag `stale` but stamps `expired` years out, so `unstable_cache` serves the pre-write value once and recomputes in the background instead of missing. Only `{ expire: 0 }` expires on the spot. The one exception is `revalidateCollections(…, { deferRefresh: true })`, which passes `EXPIRE_NEXT` (`{ expire: 1 }`) because `expire: 0` inside a Server Action also re-renders the calling route — the cost EX-597 removed from the editor's autosaves.

## Forms

- TanStack React Form via the custom `useAppForm()` hook (not React Hook Form)
- Optimistic updates use `useOptimisticFormStore` (Zustand), fire-and-forget

## Transfer Business Logic

The transfer-type union lives in `src/collections/transfers.ts` — read it there rather than trusting a copy (this list has gone stale before).

Non-obvious rules:

- `LABOR_COST` (robocizna) has **no source register** — it is a billing/markup figure, not a cash movement. It feeds the margin (`marża = robocizna − wypłaty − rabat − strata`), not the cash ledger.
- `CORRECTION` may be negative (invoice credits).
- `RABAT` (rabat) is a labour discount: **no source register**, positive amount, requires an investment. It hits **both** figures — lowers `marża` and raises `bilans` (the client owes less) — unlike `CORRECTION`, which moves only the balance.
- `LOSS` (strata) is a company-absorbed cost: **no source register**, positive amount, investment **required** (EX-675). Like `RABAT` it hits **both** figures — lowers `marża` and raises `bilans` (the client stops owing what the company swallowed). The two differ on the brutto plane: a rabat is a concession on the _price_, so it grosses by VAT, while a strata deducts at **face value** on netto and brutto alike and never widens the VAT base.
- Cancellation is an audit trail: the original is marked `cancelled: true`, a new `CANCELLATION` row links back to it.
- Cash register balances are **not** stored — they are computed on read by cached functions. The transfer hooks (`hooks/transfers/recalculate-balances.ts`) only revalidate cache tags; nothing is written back.

**`LABOR_COST` and `RABAT` are bookable again, temporarily (EX-649, reversing EX-555 — EX-712 closes it).** EX-555 took both out of the transfer dialog because robocizna and rabat come from the **kosztorys**. That holds only once an investment's kosztorys is IN the app: while it is still a spreadsheet the reading returns 0 zł and, with the dialog also refusing the booking, the investment could be settled by no route at all. So both are offered again for **every** investment, with no gating — double-counting is made **visible** rather than prevented, by the „Robocizna v1 / v2" columns on the investments listing and by the v2 reconciliation. **EX-712 removes both entries, and those columns, once the rozjazd between the two is zero everywhere.** Everything else about the two types was never touched: the enum, existing rows, history, filters, cancellation and sheet sync.

**There is no fallback, and no figure declares its source.** No kosztorys means robocizna 0 zł and rabat 0 zł on v2 and on the listing — an empty kosztorys is an answer, not a question forwarded to the transfers. The listing RENDERS that zero as „brak danych" on its v2 columns (`components/tables/investments.tsx`), because a v2 bilans built on it reads as „the client owes nothing for work that was done"; the figure underneath is still zero and still never consults the transfers. **v1 vs v2 IS the source choice**: v1 renders the transactions plane and is where legacy robocizna booked as `LABOR_COST`/`RABAT` stays readable until someone enters that work into the kosztorys. So v1 and the listing legitimately disagree for such an investment — that gap is the to-do list, not a defect, and it is not backfilled. On the investment page the reconciliation says the same thing out loud: an empty kosztorys against booked transfers screams a mismatch until the work is entered.

How the financial figures (marża / materiały / robocizna / korekty) connect: `context/foundation/investment-financials-and-discount.md`.

## Testing

Three test homes by layer, and **the file extension picks the runner**: **unit** → `src/__tests__/**/*.test.ts` in node; **component/DOM** → `src/__tests__/**/*.test.tsx` in jsdom with `@testing-library/react`; **browser E2E** → Playwright specs under `e2e/` (`pnpm test:e2e`) against the isolated 5435 `db-test` container — harness in `context/changes/e2e-harness/`. Both Vitest projects (`node`, `dom`) run under one `pnpm test` / `pnpm vitest run`, share the aliases in `vitest.config.ts`, and are what the pre-push unit leg executes; `--project dom` narrows to one. Single-file command in **Common Commands**.

**The DOM layer exists to catch what a node spec cannot see and an E2E should not pay for** — a rendered empty state, a disabled control, a value that survives a remount, an event escaping a nested input. Route a browser-level risk here first and to Playwright only when the risk genuinely crosses client → server action → DB → revalidation; the 2026-09-15 backlog audit (`context/changes/2026-09-15-e2e-backlog-audit/audit.md`) is the worked example of that split. Two rules the harness enforces rather than documents:

- **A `'use server'` module is stubbed, not imported** (`stubServerActions` in `vitest.config.ts`) — Next swaps it for an RPC stub before it reaches the browser, and without the same swap one statically-imported action drags Payload, the DB client and a live Nodemailer socket into a jsdom spec. Every stubbed export **throws** when called: assert the UI on the way to the action, or `vi.mock` the action explicitly.
- **A spec that mocks `@/lib/cache/revalidate` takes the shared stub**, not a hand-rolled factory: `vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))`, importing the spy from that stub when it wants to assert. 34 specs each named only the exports their own action happened to call, so adding one export to the real module broke the ones that didn't list it — the missing import came back `undefined` and `protectedAction` swallowed the TypeError into `{ success: false }`, which reads as a business-logic failure, not a mock gap. It is not aliased globally like `next/cache` because `revalidate.test.ts` tests the real module.
- **jsdom has no layout engine**, so `matchMedia`, `ResizeObserver` and `scrollIntoView` are stubbed in `src/__tests__/setup/dom.ts`. Radix and cmdk gate on them; without the stubs a popover mounts and instantly hides, and the failure reads as a bad selector.

**Vitest specs live under `src/__tests__`, never colocated next to their source** — this is the
one place the feature-first rule is deliberately overridden, because `scripts/test-integration.sh`
discovers the DB-backed specs by grepping that tree. A colocated spec is simply never run by the
pre-push gate. Inside it, mirror the source path **in full, every intermediate directory included** —
`src/lib/db/x.ts` → `src/__tests__/lib/db/x.test.ts`, and a deep component path keeps its depth:
`src/components/kosztorys/editor/dialogs/preset-picker-groups.ts` →
`src/__tests__/components/kosztorys/editor/dialogs/preset-picker-groups.test.ts`. Never file a spec
under the mirror of a directory that isn't its source — a spec for a `components/**` module goes under
`__tests__/components/**` even when its subject is kosztorys logic. Several specs may share one source
file; they differ by filename, not by folder. The top level holds older specs that predate the
mirroring and cross-cutting ones. A spec that
asserts the whole dataset against a committed fixture (the golden master) is excluded from that
discovery on purpose and runs via `pnpm test:parity` instead — its neighbours create rows in the
same shared DB.

Don't hand-roll tests or pick the layer by feel — route to a skill. Always start from a risk in test-plan.md, never from "cover this file"; the cheapest layer that gives a real signal wins. The trap behind every bad test — assert observable behavior, not the implementation under test — and the full anti-pattern lists are owned by the skills (/10x-tdd, /10x-e2e's references/) and test-plan.md; don't restate them here.

- **New code, test-first** → **`/10x-tdd`** (when you can name the first failing test in one sentence and the impl isn't written yet).
- **Protecting existing code** → `/10x-research` → `/10x-plan` → `/10x-implement`, anchored on the risk.
- **Browser-level / multi-boundary risk** → **`/10x-e2e`** — Playwright harness lives in `e2e/` (`pnpm test:e2e`, isolated 5435 `db-test`); add browser specs there. A browser-level slice **owes** its E2E: author it at the review gate, or defer it into the **E2E backlog** — a Linear issue labelled `e2e-backlog` in project "Wykonczymy" (`slice-review-gate` Step 3 blocks archive until the E2E box is authored or filed with that issue id). "Deferred to `/10x-e2e`" in a commit message does **not** discharge it.
- **A bug that slipped past the tests (test-driven debugging) — mandatory, not optional.** Reproduce it with a **failing test first**, then fix — never silently patch. Assert the **persisted / observable state, not the action's return value** — a success result can hide a failed write. The repro test stays as the regression guard for the path that had none.

`context/foundation/test-plan.md` exists — anchor new tests on a risk it names rather than on "cover this file". For a risk it doesn't cover yet, extend it with `/10x-test-plan` before writing the tests.

## Tech Debt

Non-blocking refactor/cleanup findings live in Linear, in the same **"Wykonczymy"** project as everything else — there is no separate tech-debt project (an earlier "Wykonczymy v2" was never created, and two review gates have now filed into the void looking for it). Check it before starting a refactor, and record new findings there rather than spawning a standalone audit doc.

## Stack Notes

- **The Vercel account is on a PAID plan.** Hobby's limits do not apply — neither "2 cron jobs, once
  a day" (`vercel.json` declares three and all of them run) nor the 2K/month Blob advanced-operations
  allowance. Don't shrink a design to fit a cap that isn't there: a new scheduled job is a new
  `vercel.json` entry, not a second stream bolted onto another feature's handler.
  `context/reference/blob-recovery-runbook.md` documents a Hobby-era incident and reads like current state.
- React Compiler is enabled — don't hand-write `useMemo` / `useCallback` for things it handles
- **The breakpoint scale is overridden** in `src/styles/globals.css` — `sm`=768px, `md`=1024px, `lg`=1280px, where Tailwind ships 640/768/1024. `sm:` is this app's single mobile→desktop break; `md:` is a second, tablet-large step used almost only by the marketing pages. Any snippet pasted from shadcn/upstream docs assumes the stock scale and fires one step too late. **Re-map it onto this scale by intent, not by tier name (EX-624):** an upstream `sm:` and an upstream `md:` are both mobile→desktop splits here, so both become `sm:`. Never add a 640 breakpoint to reproduce upstream's — this app has one mobile→desktop line and it is 768.
- `src/app/(payload)/layout.tsx` must include `importMap`, `serverFunction`, and `handleServerFunctions`
- A `console.error` that must become a Sentry capture once Sentry is wired gets a `// TODO(EX-449) SENTRY-REQUIRED:` marker (greppable + shows in the IDE TODO panel) — never a bare comment

## Environment Variables

Read env **only** through the validated layer in `src/lib/env/` — never raw `process.env` (an ESLint
`no-restricted-syntax` rule enforces it; `NODE_ENV` is the lone exception). Schemas live in
`env/schema.ts`; client entry is `env` (`env/index.ts`, `FRONTEND_URL`), server entry `env/server.ts` (`serverEnv`).

Traps:

- `env/server.ts` is `server-only` — **never import it from the Payload CLI graph** (`payload.config.ts`
  / collections), where `server-only` throws under `payload generate:types`. That's why
  `payload.config.ts` is the one file allowlisted to read raw `process.env`.
- `(frontend)/layout.tsx` imports both entries as the build gate (a missing var fails `next build`) —
  don't delete those seemingly-unused imports.
- Tests alias both entries to passthrough stubs (`src/__tests__/stubs/`); the eager parse otherwise
  forces every server-touching test to supply the whole env.
