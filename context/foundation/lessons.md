# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.
>
> Distilled 2026-10-15 from 2697 lines / ~210 entries: duplicates merged, rules AGENTS.md already owns
> dropped (it wins on conflict), claims re-verified against the code. Entries are grouped by theme;
> new ones are appended at the end and regrouped at the next distillation. Each entry: the rule, then
> the evidence that earned it. Incident narratives live in git history and `context/archive/`.

# Database, migrations, Payload

## Migration filenames sort lexically — pad the counter before a date passes `_9_`

- Payload's `readMigrationFiles` runs `readdirSync().sort()`: the filename IS the run order. Name
  `YYYYMMDD_<n>_…` in dependency order; once one date would reach `_10_`, pad that whole date
  (`_09_`, `_10_`) — never mix.
- `down` is never executed (no migrate:down/refresh script) — write it to restore the DDL exactly,
  not to preserve data.

## A migration is verified only when the running app reads the column

- `payload migrate` „Done." is necessary, not sufficient — load a page that selects the column. A
  dev server booted before the migration keeps erroring until restarted.
- Restore and migrate are one operation: `pnpm db:import:test && pnpm db:migrate:test`. Shared-DB
  fixtures clean up on **entry** (`purgeFixtureUsers`), because a crashed run never reaches teardown.

## A new Payload collection's migration has a fixed checklist

- `payload_locked_documents_rels` gets a column + index; a `_rels` table for every hasMany;
  `created_at`/`updated_at` + indexes; dates are `timestamptz(3)`; register in `migrations/index.ts`;
  add the composite read index the queries actually use; dictionary seeds `ON CONFLICT DO NOTHING`;
  `down` reverses everything including `DROP TYPE`.
- A table nothing reads through Payload is a raw table, not a collection — a collection brings
  locked-documents and rels plumbing for no reader.
- FKs: `RESTRICT` + `makePreventDelete` for targets the row depends on, `SET NULL` for descriptive
  links.
- Payload `unique: true` is single-column only. Compound uniqueness is a raw `CREATE UNIQUE INDEX` in the
  migration (example: `20260707_0_add_leads.ts`, `(source, external_id)`); note it in the collection.
  NULLs are distinct under a unique index — a nullable member never collides.

## Split a migration that both ADDs and DROPs; classify by the survivable window

- AGENTS.md owns the direction rule. One file doing both halves has no safe order (each half wants the
  opposite one), so ship the ADD alone and author the DROP only after the additive deploy is live —
  park it in an issue, because a written migration file rides the next `db:migrate:prod`.
- Ask which routes read the table: a transitional 42703 on an admin list is a shrug, on the cookie-less
  `/k/:token` it is an investor-facing 500.
- A tightening (`SET NOT NULL`) is not symmetric with a DROP: Payload's `getFallbackValue` treats a
  stored `NULL` as **present**, so push-first makes every partial update of a legacy row throw
  `ValidationError`, silently. Pick the loud, bounded window (migrate first, old code gets a 23502).
- A leftover row in a shape the new resolver misreads (`variants = '{}'`) is deleted in the migration.
- When you reverse a documented order, fix every artifact that asserts the old one (header, issue,
  plan).

## Postgres DDL traps hit in this repo

- `ALTER TYPE … ADD VALUE` cannot be used (e.g. as a DEFAULT) in the same transaction — split it.
- Columns left behind by a spike make `ADD COLUMN IF NOT EXISTS` a no-op with the wrong type/default —
  drop them first.
- A correlated `jsonb_array_elements` per outer row trips JIT (an SRF is estimated at 100 rows):
  aggregate the array once in a CTE and hash-join (122 ms → 2.5 ms; live users:
  `worker-expense-drafts.ts`, `expense-duplicate-candidates.ts`). A key unique only inside its
  parent document joins on the parent id too. Replacing a stable JS sort with SQL needs
  `WITH ORDINALITY` as the tiebreaker.

## Part of this schema is invisible to Payload — reference-level rules live only in SQL, and `push: false` is the only thing guarding them

- Unique indexes encoding domain rules, NOT NULLs Payload thinks are nullable, narrower types,
  non-Payload tables: the config knows none of it. `pushDevSchema` would drop it; an auto-generated
  migration would delete or relax it. Hand-written migrations stay (AGENTS.md). Read the indexes
  before concluding a rule is unenforced.
- To re-measure the gap, diff the catalogues of two scratch DBs (prod dump + `payload migrate` vs SQL
  from `generateMigration(defaultDrizzleSnapshot, generateDrizzleJson(adapter.schema))`) on an unused
  port — never dev or test.

## Choose the gate's layer by enumerating the plane's write paths

- Writers: app actions, raw SQL, Local API (`overrideAccess`), REST, `/admin`. An invariant **of the
  row** must hold for all of them → collection hook, beside its siblings. A side effect after a write
  still goes in the server action (memory: server actions over hooks).
- `beforeValidate` does not fire on delete — add `beforeDelete`. Locks are field-level. Refuse with
  `APIError(msg, 400|403)`; a bare `Error` in a hook surfaces as a 500 „Something went wrong".
- On update `beforeValidate` receives the **full merged doc** plus `originalDoc`: compare values, not
  key presence. A claim about a framework hook is a claim you can run — probe it against the test DB
  instead of reading the source.
- Before choosing the layer, grep specs that exercise the shape you're forbidding: a spec with the
  writer mocked (`payload.create`) can't see a hook and will keep asserting the illegal shape
  succeeds. Test the hook through `payload.update` in a DB spec.

## An `access` Where checks only the stored row

- `update` needs two arms: the stored row AND the incoming `data`. `not_equals` on a nullable
  relation matches NULL; `not_in` does not. `await base(args)` when composing. The spec asserts
  persisted state, with its own fixture per unique index.

## Payload returns instead of throwing in places — read every destructive result

- Bulk `delete({ where })` deletes one by one and collects failures in `result.errors`: a 13-of-15
  wipe reports success. A wholesale wipe is one `DELETE … WHERE parent_id = $1` per table on the tx
  handle.
- A refusal **returned** from `withPayloadTransaction` commits the writes before it — decide before
  the first write or throw.
- An invalid `sort` silently falls back to `-createdAt`: one whitelist, a validator that returns
  `undefined`, sortability derived from the whitelist.
- Never map a whole error class onto one friendly sentence: log the raw error (constraint name)
  before translating a 23505.

## Widening a relation to `hasMany` breaks `typeof x === 'number'` guards silently

- At depth 0 the relation type is loose enough that `tsc` stays green; the guard returns false on
  every array and the data vanishes. Grep each guard and make it a red-first test target.
- The FK flips: a scalar's `ON DELETE SET NULL` becomes `CASCADE` on the join row. Media is joined in
  TS (`lib/queries/media.ts` caches the table), so keep `depth: 0`.

## Rows Payload never sees still owe their cache tags and reference checks

- `ON DELETE CASCADE` children are deleted by Postgres: expire their tags by hand.
- A raw table that stores media ids registers in `findReferencedMedia` and the media delete guard.
  Two such tables today (drafts, worker reports), each with a hand-added probe — build a registry at
  the third.
- A stored match key (`match_key`) is a backfill obligation: every writer computes it the same way,
  and a drift spec with a real floor (`catalogue-key-collisions.test.ts`) asserts it. Prefer linking
  by id (`catalogueItemId`) — a stale key then bites only unlinked rows.
- One concept stored in two columns is written by independent patches — atomicity follows the write
  path (`normalizeOverridePatch`), and a migration fixes legacy pairs with `CASE WHEN`.

## The kosztorys tree is wipe-and-reinsert — know what keys on its ids

- Import and version restore delete and re-insert the tree, so every id changes. Safe only while
  external referrers tolerate it: `worker_report_lines` (`SET NULL`), `kosztorys_items.ref` (global
  sequence + Damm digit, carried by `insertItems` as `ref ?? DEFAULT`). A new referrer reopens it.
- A field added to a tree entity is not done until the raw INSERT column list knows it
  (`insert-kosztorys-tree.ts`, e.g. `STAGE_INSERT_COLUMNS`); `insert-schema-drift.test.ts` checks both
  directions against `information_schema`.
- The undo of a destructive replace is a snapshot taken **inside** the transaction, before the wipe:
  pass the transaction's `req` to `captureAutoSnapshot` / `serializeKosztorys` — without it the tree is
  read on another connection, outside the locks (EX-718). Import and `replaceTreeWithSnapshot` pass
  it; the version restore, catalogue insert and worker-report accept still don't (EX-1080).

## Snapshot payloads: bump the schema version on the rationale, type the tolerance

- Bump `SNAPSHOT_SCHEMA_VERSION` only when a stored payload would restore into **wrong** rows, and
  never bump and leave unreadable rows behind — the exits are spelled out in the `snapshot-format.ts`
  header (`daily`/`named` snapshots are the investor's history and are never deleted).
- A new NOT NULL column **without** DEFAULT breaks every stored payload, however additive it looks.
- Stored payloads are typed `StoredSnapshotPayloadT` (NOT NULL DEFAULT columns optional) and
  discharged to the strict type, so the `?? 0` fallbacks don't look like dead code to tsc and the
  dead-code gate.

## Raw SQL beside the ORM: fail closed, pick in TS, never take a caller's `Where` on a public surface

- `where-to-sql.ts` throws on any field/operator/value type it hasn't been taught — keep it that way.
  An unknown operator falling through widens the result set, which on a scoped page is a leak. Test
  the bridge: real filter builder → real strip → assert the emitted SQL.
- A TS spec table can't govern a choice inside SQL: return every sum and pick above the query
  (`billedAmountFor` in `lib/constants/transfers.ts`).
- An action that accepts a caller-supplied `Where` (`fetchFilteredTransfers`) can never be relaxed
  for a public or lower-privilege surface — build a scoped query instead.

## Any DB adapter or driver change re-verifies the pool identity

- Under `@vercel/postgres-adapter`, parallel Payload writes on Neon lost rows (the `VercelPool` was not
  `instanceof` the `pg.Pool` Drizzle checks). Fixed by `@payloadcms/db-postgres` (EX-855). Re-verify
  `instanceof` against the pg copy Drizzle imports on any adapter/driver bump; probes in
  `~/.local/share/wykonczymy-ex855/`.

# Cache, Next.js, rendering

## A server action that invalidates anything renders the route — that render IS the refresh

- Any `revalidateTag`/`updateTag` sets `x-action-revalidated`; a profile only moves the render to a
  follow-up GET (EX-597). To write without re-rendering, leave the action path (route handler) and own every
  affected figure on the client — one refactor, not two.
- No `router.refresh()` after a revalidating action (EX-908 removed 16): refetch only after a write
  that rendered nothing — route handler, upload API, or an action that threw.
- A latch waiting for „the next tree" arms from the token the action **started** from
  (`useRestoreRemount`'s `since`): in 3/24 runs the render had already landed.
- No expiry inside `after()` (EX-909): it skips the render but leaves the client router cache stale.
  When the page renders the result itself, return the state from the action instead of
  push + refresh + revalidate.

## `unstable_cache` dedupes across requests, never within one

- Three callers in one render each run the query on a cold entry. Wrap `cache(cached(fn))`, React's
  `cache` outside (`fetchReferenceData`). A nested `unstable_cache` bypasses the cache.
- The root layout renders twice per request: wrap shell reads in React `cache()`. For cold
  measurements clear `.next/cache/fetch-cache`.
- `cached()` keys on the deployment (AGENTS.md) because `unstable_cache` keys on `cb.toString()`,
  which never sees the mappers the callback imports. It does not cover a running dev server after a
  mapper edit (restart `pnpm dev`) or a data change that bypasses the app (purge after a
  RUN-AFTER-DEPLOY migration). In those gaps a consumer should tolerate a missing field where its
  absence would take the page down — none does today. A tag only marks stale: the old shape is
  served once more, which is the crash. A stuck entry unsticks with `updateTag` — no deploy needed.

## Prefetch and fallbacks

- A link inside `display:none` never prefetches (no intersection), so a hidden-sidebar layout on phone
  has dead links. Close the drawer on route commit; scroll-lock in an effect.
- A Suspense fallback for a warning surface is neutral — never the reassuring „all clear" state.
- `transform-gpu` on the shell makes it the containing block for every `position: fixed` child:
  portal to `document.body`.

## Platform facts are claims — check the vendor docs

- A Vercel Function body is capped at 4.5 MB; `serverActions.bodySizeLimit` covers actions only.
  Uploads: `/api/media-upload` (4 MB route) or direct-to-Blob + `/api/media-register`.
- Background cleanup goes in `after()`, collecting its promises; a test stub that no-ops `after`
  discards that work silently.
- In a git worktree with symlinked `node_modules`, `next build --webpack`.
- `.env.local` (written by `vercel env pull`) outranks `.env` — check it when an env edit has no
  effect. Key environment guards on `VERCEL_ENV`, never `NODE_ENV` (a local build sets production).
- The session cookie is `Secure` whenever `NODE_ENV === 'production'`, so `pnpm start` opened over a
  LAN IP on plain http (a phone on the same Wi-Fi) never keeps a login. A `db:import` replaces
  `users_sessions`, so every developer is logged out within the 1 h session-check backstop.

## Environment isolation means every stateful plane, on every boot path

- AGENTS.md owns the Blob/Sheets/SMTP gates. The recurring rule: enumerate object stores, queues,
  third-party sandboxes — not only the DB. Put the guard where the app cannot boot without it (zod
  `superRefine`), repeat it on every graph that can reach the destructive call (`payload.config.ts`),
  refuse mismatches in both directions, and give the one writing script its own explicit flag.
- Metered vendor operations are a shared quota: exceeding Blob's suspended **every** store including
  production (2026-08-19). No scheduled jobs against a large mirror; cap bursts.
- SMTP host = the certificate's name (`mail.wykonczymy.com.pl`); check with `openssl s_client`;
  redeploy after an env change. A failed send needs an alert, not a log line (EX-958).

## Webhooks fail loud and verify over raw bytes

- `const raw = await request.text()` → verify HMAC with `timingSafeEqual` → `JSON.parse(raw)`.
  `request.json()` re-serializes and the signature never matches.
- Check delivery config, not just code: Meta `callback_url` + `subscribed_apps`, non-expiring tokens.
  A dropped delivery must alert (`notifyShapeAlert` → `notification-recipients`); the
  `leads-reconcile` cron is the backstop.

## React Compiler bails silently

- Hooks must be called through a `use`-prefixed identifier, or the compiler demotes them to plain
  calls. Verify memoization landed (`_c(` in output) rather than assuming it.
- A closure as a default parameter (`write = () => …` in the params) makes the compiler skip the whole
  hook; it surfaced only as a now-unused `react-hooks/refs` directive. Take the optional and fall back
  with `??` in the body (`patchStageField`).
- Restoring memoization is not automatically a win: context value churn (EX-496) cost more than the
  re-renders it saved.

## Small rendering traps worth remembering

- `min-w-0` doesn't inherit across layout modes: a `grid-cols-1` child needs `[&>*]:min-w-0`. Measure
  in the browser.
- A custom font-size `@utility` must be registered in `cn.ts`'s `extendTailwindMerge`, or `cn()`
  drops it against `text-*` colours.
- Print: vertical margin on `@page`, horizontal on body padding (`print/styles.ts`); check in Safari.
- Flush on `visibilitychange`, not `sendBeacon` (server actions can't receive a beacon).
- PWA: exempt the manifest/icons/SW in the proxy matcher; iOS standalone has a separate cookie jar;
  icons need the maskable safe zone. Web Push: delete a subscription only on 404/410, always send a
  non-empty `tag`, send the absolute badge count.

# Testing & guards

## A parity test runs the real per-surface code on real data — and must be proven red

- Call each surface's own assembly (no shared stand-in), on the restored dataset; count call sites
  with grep. Pass a wrong argument once and watch it fail — a gate never seen red is untested.
- Two planes both green is not parity — the drift lives between them. Assemble the oracle by a
  different route than the subject: the same forgotten `{}` fed to both
  sides agreed perfectly while a listing drifted 63 278,90 zł.
- Two planes computing different things need a test on the bridge (e.g. sheet `expenseRow` vs app
  math). If one plane only **transliterates** the other (client loops predicting server
  `display_order`), delete it: intent-based actions (`'above' | 'below'`, an id sequence for the
  bake) resolved in the transaction.

## Golden masters over a borrowed dataset

- Fingerprint the dataset first (`DATASET_FLOOR`), in the test and on the regenerate path, so a
  refreshed DB fails as „regenerate", not as drift — and an empty DB can't freeze a snapshot of
  nothing.
- Invalidate per entity: a guard that fails wholesale on an ordinary refresh gets silenced. A skipped
  investment only `console.warn`s while the run stays green, so the `AXES` guard throws when a
  kosztorys- or brutto-carrying investment drops out of the compared set.
- Green means unchanged, not right — it freezes bugs. Count the rows of a new plane before trusting
  it (`SELECT count(*) WHERE <new column> IS NOT NULL`); zero rows = decorative, write a synthetic
  test or a seed.
- Changing a hashed column delists every investment: regenerate on a fresh DB first and prove the new
  expression reproduces the old bytes.

## Vacuous guards — the common shapes

- A test of the old definition goes tautological when the definition changes; rewrite it red-first.
- After unifying a total with its list, `Σ list === aggregate` pins its own implementation; guard the
  data invariant that makes them coincide instead.
- A spec of only `not.toContain` with a fixture in a degenerate state (null plane, empty list)
  compares nothing with nothing — assert something present from the same fixture.
- A spec helper that resolves by key must throw on an unknown key, not borrow the production lookup
  that tolerates it.
- An exhaustiveness assertion (`_AllTransferTypesCovered` in `collections/transfers.ts`) protects
  only while its two sides are written independently; deduping one into the other deletes the check.
- `describe.skipIf(!ENV_READY)`: confirm the test count is non-zero.
- A status assertion on a streamed RSC page sees nothing: the 200 ships before the render throws.
  Assert content. Break-verify every guard written for a specific failure — break the behaviour,
  watch which assertion goes red.

## Reproduce first, with an instrument you've validated

- A repro showing zero events is a broken instrument, not evidence. A negative from a grep or flag you
  configured proves nothing until it fires on a known positive.
- Read mode/state from its own control, not from inference; falsify a theory with a cheap unit spec
  before a browser run.
- Compare money with `roundToCents` on both sides — a half-cent tolerance is a coin flip; quantities
  keep their own `QTY_TOLERANCE`.

# E2E / Playwright

## Iterate against a warm server

- Start the server with `pnpm test:e2e:warm:server`, iterate with `pnpm test:e2e:warm`. Never a
  hand-pasted `next start` — without `DB_POSTGRES_URL_TEST` the specs mutate the 5433 dev DB. Never
  re-run the full build per hypothesis, never `pkill` by pattern.
- Helpers: waits in `e2e/support/wait.ts`, UI drivers in `e2e/drivers/*` (cmdk:
  `pickComboOption`). Playwright can't import the Payload graph — seed via a subprocess; wait for
  hydration (`waitForHydration`); `workers: 1`; seeds pass `context: { skipRevalidation: true }`.
- x86 pnpm under Rosetta launches emulated Chrome — use `e2e/chrome-arm64.sh`. Measure in the browser.

## The DOM is not evidence of a write

- Optimistic UI updates first and autosave waits out a 500 ms debounce; a reload can abort the
  in-flight action. Wait on the `next-action` response (`settleWrite`), and count writes
  (`settleWrites(page, count)`) — waiting by shape matches the wrong one. Confirm by label plus
  reload, or by a DB query.
- Prefetch re-poisons the router cache after a write: assert after `refreshData` / `refreshUntil`.
- In a dsg QA pass use the app's own controls and role selectors; don't instrument a defect the code
  cannot produce.

## Flake shapes and their fixes

- `toPass` never aborts its inner calls — retry with `nudgeUntil` / `RETRY_STEP_MS`
  (`e2e/support/wait.ts`), which also covers a click dropped during dialog teardown
  (`openExpenseDialog`).
- An exit animation keeps content mounted: read `aria-expanded` / `aria-checked` from the control
  before clicking.
- An open Radix menu hides the page from `getByRole`: `locator.press` / `commitCellValue`.
- A conditionally mounted element is absent, not hidden — decide what absence means in the assertion.
- A Playwright worker loads the spec once while the reporter reads files from disk: debug from the
  trace.
- A timeout usually means a stale locator or fixture: grep `src/` for the label and query the 5435 DB.

# Datasheet grid & kosztorys editor

## react-datasheet-grid: the API facts that bit

- The public `DataSheetGrid` is the static grid with frozen columns — import `DynamicDataSheetGrid`.
  Never add a remount `key` to refresh columns. Check what the barrel exports.
- A column's `component` must be stable at module scope; pass per-column data via `columnData`.
- Spreading a stock column (`{ ...textColumn, component }`) drops what the replaced component did:
  `parseUserInput`, Tab trapping (`disableKeys` returns without `preventDefault`). `stopEditing()`
  defaults to `{ nextRow: true }` — a cancel path passes `{ nextRow: false }`.
- Stock `floatColumn`: `parseFloat('12,5')` is 12 and `Intl.NumberFormat()` formats in the runtime
  locale. Parse through a reject/empty/value contract (`parseDecimalInput`) and pin the locale; guard
  with a round trip.
- Header cells are keyed by index — per-header local state follows the slot, not the entity: key it
  by id or mount it only while editing (`useInlineRename`). The built-in
  row menu is unusable under `lockRows`. Paste is positional (unfixed). Header drag is a 2–3 day job
  (horizontal virtualization), a reorder modal is hours.
- dsg CSS is unlayered and beats `@layer utilities`: colour rows via a CSS variable + a `globals.css`
  rule (`section-colors.ts`). `.dsg-container` is a stacking context — don't raise z-index above 30. In a flex parent it
  flickers: `grid-cols-[minmax(0,1fr)]`. `enableVirtualization` is a layout change (fixed sizes,
  `max-h`, row budget).

## Events and focus

- A listener on `document` shares the node React hydrates on: only
  `nativeEvent.stopImmediatePropagation()` outruns it, and only because React registered first.
  react-datasheet-grid's own keydown listener sits on `document`, so a bare `stopPropagation` in a
  cell input does not keep a key from the grid (EX-1081).
- A removed focused element fires no blur: a blur-settled draft owes three exits — commit, cancel,
  unmount. Read current logic from a latest-ref; make teardown idempotent with a ref.
- Global drag listeners use `{ capture: true }`; OS file drags fire no `dragend`; guard leave with
  `contains(relatedTarget)`.

## Editor state: mount snapshots, lanes, and server writes into autosaved cells

- Rows are seeded once at mount. Fields changed elsewhere are patched optimistically (`patchRows`),
  not via `router.refresh()`.
- Never fire a server action inside a `setState` updater (it runs twice in strict/concurrent mode).
- Undo races autosave: per-key serialized lanes (`save-lanes.ts`) — cancelling a debounce can't stop
  an in-flight action. A value stamped on a field's own save comes from the client; lanes are
  unordered across keys.
- A server write into autosaved cells: `drain(keys)` / `flushPendingSaves()` first, sum per pozycja
  before an upsert (21000), patch absolute values back, `round6`, bump `tree.revision`.
- Write count matches the real change (swap two rows, not renumber the section); DnD uses fractional
  keys.
- A stale copy (another tab replaced the tree) fails with a code (`ActionResultT.code` from
  `NotFound`), and the recovery is a **reseed** + remount, one-shot — never a revert. Never remount
  on a routine tree change: it throws away sort and filters. Never show a
  framework's bare „Nie znaleziono".
- `if (!res.success) return` and `void action()` are swallowed failures — every optimistic mutation
  owes rollback **and** a toast. Use `settleAction` / `settleTreeReplace`; ESLint flags
  `UNSETTLED_ACTION`; `unstable_rethrow` in catch blocks.

## Undo coalescing must cancel a rollback across the window boundary

- A blocked keystroke emits no `onChange`, so the 700 ms window can close between the accepted prefix
  and its rollback. Amend the command already pushed — by identity, never by position — and cancel
  only an exact there-and-back.

## Modelling editor state

- Positional identity fuses a stable id and wire order — split them.
- A figure's source follows whether it can change mid-session, not which table it lives in.
- A group-by projection can't hold an empty group: promote the parent to state (`sections` beside
  `rows`).
- A list that doubles as a name map splits into live + `trashed…` twin, upstream of
  `activeOrSelected`.
- A capability added by whichever helper a column used (`sortableHeader()`) is decided by accident:
  define the universal predicate, make exceptions fail it. A limitation note in a commit message
  ages into a believed constraint (`sortValueGetter` did handle `stage_<id>`). `reconcileSort` cancels a sort
  when its column disappears; the sort is persisted nowhere, which is why `stage_<id>` is safe as a
  key (Postgres reuses deleted stage ids).
- A namespaced column id (`price__w_tools`) splits two lookups: configuration (label, axis, layer)
  resolves by base key; disclosure matches the full id. Never rename an id persisted in a hidden set —
  a lost key falls to its default and reveals.

## Stored preferences record the deviation; disclosure settings fail closed

- Store exclusions/overrides (hidden keys, sparse `key → rank`), never a snapshot of today's defaults:
  a new column then reaches everyone who never touched the setting. The default stays live in code.
- Exception — disclosure (EX-1033): investor/worker documents store a full `{ key: hidden }` map and
  read an unmentioned key as its **code** default (`resolveHiddenColumns`).
- A disclosure filter is `allowed.has(key) && !hidden.has(key)` under a code ceiling
  (`PREVIEW_VISIBLE_COLUMNS`). When the settings read fails, 500 rather than render wider.
- A choice that decides what a second audience sees is a fact about the entity — store it on the
  entity and delete the browser layer. Re-derive every guard when a control's subject changes.

## Forms

- A hidden field still ships — hiding it in JSX doesn't clear it: drop it from the payload too (clear on type change or strip
  in `toData`). `resetField` restores the seeded default — reset is not clear.
- `formId` names the form type; a dialog locked to one entity needs an entity-scoped id
  (`inspectionDraftId(vehicleId)`).
- A store that owns recovery state broadcasts through the generic signal store (`start`/`stop` in
  `finally`), so one indicator has one keyed source and no `??` fallback.
- A container that renders several features' buttons gates them all on its own feature's condition —
  give each child its own explicit condition before deleting or splitting the container.
- An optional config field outlives its reader silently: after deleting a consumer, gate producer
  cleanup on grep + dead-code scan, not `tsc`.
- A menu item's gate uses the exact predicate its handler checks; every early return in the handler
  is a disabled state, and the spec asserts the two agree.

# Domain, figures, the owner's sheet

## The owner's sheet gives meaning, not a build spec

- Read formulas, not rendered numbers; check that a cell is actually referenced before porting it.
- Sheet column positions are a frozen external contract: never move or drop one, keep the layout list
  separate from the routing list, test the exact order.
- The owner picks a formula by what the number means, not by which makes two columns compare cleanly.
- A frozen wire value is frozen only at the boundary — translate once there; don't name internals
  after it.
- Enforce naming with an AST rule, not grep (`eslint-rules/no-domain-drift.mjs`): split identifiers
  into words, keep a frozen allowlist (`RABAT`, `KOREKTA`), visit string-literal unions. Ship a new
  guard dormant until its renames land, then as `error`.

## Changing what a figure means

- Sequence changes that redefine the same total — bundled, the wrong number is unattributable; price
  the coupling in lines.
- Cut scope by sequencing, never by distorting the model („model ma odwzorować rzeczywistość").
- Identical arithmetic in two places may hold different invariants (listing columns vs v1 tiles whose
  sum IS the balance) — check before extending a fix.
- A parameter whose absence changes a figure gets no default; spell the empty case (`NO_DEPOSITS`).
- A total and its list come from one query; derive the figure from the rows in the component.
- Money may be signed, quantities may not: consumers test qty with `> 0`, which turns a negative into
  a plausible zero. Grep `> 0` before introducing a signed quantity.
- „Unknown" vs „zero" is retired by closing the source (making the field required), never at render.
  If the source can't be closed, keep the distinction (fleet `cost` renders „—"). Watch the sort too.
- A counter's unit is its meaning (9 prace vs 38 pozycji): match units or label them. An „Open Risks"
  bullet mitigates nothing the user reads in the UI.
- An investor-hidden figure is a new type/bucket (`financialBucketOf` falls back to `'none'`);
  „Pozostało do wypłaty" has five homes — change them together.
- An empty-means-everything fallback degrades silently when the store's only writer goes: record the
  degradation or it gets „fixed".

## Identity and meaning over time

- An id whose meaning changes over time needs a guard in every reader; give each thing its own id
  (EX-893).
- A marker appended to a name that feeds an identity key is part of the key: every writer strips it
  via one shared module; a suffix keeps marked rows beside their twins. Assert the persisted key.
  Retiring the marker is the same change in reverse — dropping the strip early re-created the
  mismatch (`20260922_1_catalogue_legacy_marker_cleanup.ts`).
- Before unifying a type across carriers, confirm each carrier has a reader; a dead-code sweep of a
  resolver leaves its columns behind.
- When code implements an explicitly rejected variant, correct it down to the schema and sweep the
  prose that describes it.
- Resolve an LLM-supplied name to an id by exact match or leave it blank — never fuzzy.
- Investment status is a label, not a gate: bookability is `isBookableInvestment` /
  `isOfferedForBooking` (EX-1066), the tuple lives in `investment-status.ts`. Payout bucketing puts
  only „Zakończona" under „zakończone"; a debt on an „Odrzucona" investment would count as active, but
  that is unreachable — an Odrzucona investment has no executed work, so no debt (owner, 2026-10-15).

## Disclosure and audience

- A price-view flag is not an audience flag: owner-internal warnings gate on
  `!preview && priceView === 'client'`.
- Moving a disclosure guarantee from data to render makes every client-writable preference an attack
  surface — pin those inputs server-side.
- `(share)` layouts mount no `CurrentUserProvider`; a session read under a share-rendered component
  breaks every investor link while every other gate stays green.

## Trash, delete and status

- Soft delete is a `trashed_at` column, not Payload `trash: true` (which fails closed into Blob
  deletion). Every raw reader filters `trashed_at`; unique keys stay held while trashed.
- Trash refuses on the hard-delete predicate (`makeDeleteBlocker`). A pending request row blocks
  delete/trash of its parties.
- A row an external sweep dedupes against is erased in place (tombstone), not deleted.
- A new lockout path must expire `CACHE_TAGS.users` (AGENTS.md has the session model; EX-1020 owns the
  `refresh()` race).
- A backfill never writes a terminal status for an effect it didn't perform: only the component that
  sends writes the outcome; give the backfill an option on it (`captureLead(…, { autoReply: 'skip' })`).

## Worker drafts and paragony

- Draft pages are shared, never moved; status is derived paragon by paragon; a second decision gets
  `ALREADY_DECIDED`.
- A merged paragon row is a view over N read rows (`read_rows int[]`).
- A worker draft without an investment: every send re-reads the live flag
  (`canAddExpensesWithoutInvestment` in `findDraftTargetError`), never a value from the session.
- Wypłata confirmation is a label; the worker's answer is a raw UPDATE (`FIELD_TO_COLUMN`).
- A hand-set investments label stays out of `investmentSchema`.
- Telmak check parsing happens in the browser; reject rather than guess.
- A Blob original exists only for landing uploads; `compressImage` profiles INVOICE/PLAN; old media is
  not repaired. A restored dump has media metadata but not the bytes (mostly PDFs).

# Process, research, review

## A finding names a mechanism; measure it before planning

- Put a number on it — rows, window, call sites, frequency — before the plan. Three EX-521 findings
  collapsed on the numbers (+1 ms under a burst; a self-healing 10-minute interval; 47 call sites).
  A finding without a magnitude is a question. Watch for whole-sheet figures quoted for per-owner
  scopes.
- Neon latency is bimodal (~20–60 ms warm, ~160–200 ms cold): separate them; prefer one request that
  exposes the mechanism over a median. `perfStart` around the first `db.execute` measures the
  connection. Parallel reads cost the slowest, not the sum — time the fan-out before merging queries.
- Caller count isn't an extraction verdict, shape is; a long registry can be cohesive — judge by kinds
  and reasons to change. Cohesion is the width of the seam.
- Trace a „not validated" finding to its read path: reachability is decided at the route.
- A static-audit edge (depcruise cycle) is a candidate: read whether it's lazy before calling it debt.
  Enforce layering with ESLint `no-restricted-imports`.

## Check intent and blockers in git before acting

- A commented-out guard or `TODO re-add`: `git log -S` it. One removal is a candidate; a flip-flop is
  a decision (registers may go negative — recorded in `01-domain-distillation.md`).
- When the owner calls something unnecessary, check what they said earlier about replacing it.
  Optional flags are silent kill switches; an undocumented owner decision gets „fixed" by review.
- A deferral rationale ages into a believed dependency („behind a renderHook harness" — never true).
  Check the stated prerequisite first; when deferring, write „declined, see X" vs „blocked on Y".
- A stale branch whose integration surface was refactored is ported, not rebased.

## Retire a belief everywhere it is asserted

- When a change makes a doc, comment, test or checklist wrong, fix it in the same change. An
  `OTWARTE` marker and a comment citing a slice id are the riskiest — they read as conclusions.
- Grep the retired claim's vocabulary in `src/**`; state the correction rather than deleting the
  sentence, or the next reader re-derives it from the code shape.
- When a change absorbs another roadmap entry's scope, update that entry in the same pass with
  „shipped in X".

## Renames and types

- Split a rename at the `tsc` line: the symbol half carries the benefit and never expires; the
  persisted half (columns, JSON keys, localStorage, Payload field names) carries the risk and is worth
  ~0. Never rename a string-keyed name for readability. A generated type can't contradict its schema.
- A row type files with the producer when nominal (changes with the query), with the consumer when
  structural.
- `readonly` can be load-bearing: gate removal on `tsc`, never commit a broken typecheck.
- Before invoking a merge as urgency, check `git rev-list --count target..source`.

## Install state

- A CSS build error right after a dependency operation is install state, not your CSS. On this arm64
  machine `pnpm remove` / `install` can swap `lightningcss` to the x64 build, and the error blames
  `globals.css`. Repair both layers: `pnpm install --force` (binary — confirm
  `lightningcss.darwin-arm64.node` exists), then `rm -rf .next` and restart dev (cache). A node
  one-liner can pass while the dev server still fails — verify against the running server.
- Prod DB branch and restore-tested backups: `lesson-db-backup-resilience.md`.

## An entity that is a list of references gets tables with no room for a copy

- When a domain entity is „like X minus half of X's fields", don't store it as an X with a status:
  every unused column invites a write, and every reader of X needs a status guard the compiler never
  points to. Give it tables whose shape is the invariant (szablon = `templates` → `template_sections`
  → `template_items`, each item a katalog ref + section + order) — a missing column needs no guard
  and no spec. A shared editor doesn't need shared tables: inject the action set (`EditorActionsT`).
- Two tables sharing one id number space: every id-keyed thing (localStorage, cache tags, actions)
  gets a kind prefix or its own action — the number alone doesn't say what it points to.
- Evidence: EX-893 put szablony in `investments` (status `szablon`); EX-1075 moved them out, guards
  in the action gate, listings, counters and the golden master went with it. Moved with an additive
  copy migration first and a `RUN-AFTER-DEPLOY` drop after the deploy.
