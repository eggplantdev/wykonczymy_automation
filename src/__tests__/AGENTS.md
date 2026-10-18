# Vitest harness traps

Rules for specs under `src/__tests__/`. Layering, placement and skill routing live in the root
`AGENTS.md` → Testing.

- **A `'use server'` module is stubbed, not imported** (`stubServerActions` in `vitest.config.ts`).
  Without the swap Next does in the browser, one statically-imported action drags Payload, the DB
  client and a live Nodemailer socket into a jsdom spec. Every stubbed export **throws** when called:
  assert the UI on the way to the action, or `vi.mock` the action explicitly.
- **Some modules are mocked for every spec by a setup file** — never re-mock them per spec; import
  the stub's state to drive or assert them:
  - node + DB (`setup/node.ts`): `@/lib/cache/revalidate` → `stubs/cache-revalidate` (only
    `revalidate.test.ts` opts out, via `vi.unmock`); `next/server`'s `after` queues into
    `stubs/next-server`'s `scheduled` — run the work with `flushAfter()`.
  - DB only (`setup/db.ts`): the session — see below. It resets to OWNER id 1 before each file.
    Plus the pass-through seams listed there: each is the real export wrapped in a `vi.fn`, reset to
    the real one before each file. Steer one with `vi.mocked(fn)` and set an external service's
    result before the code calls it — the reset hands back the real network call. A new DB spec that
    needs a module mock adds a seam there; a per-file `vi.mock` still works but costs ~1.2 s of
    import and runs the spec isolated.
  - dom (`setup/dom.ts`): `@/lib/utils/toast` (import `toastMessage` and assert it as the mock);
    `next/navigation` → `stubs/next-navigation` (assert `router.push`, set `navigationState.pathname`
    / `.searchParams`).
- **`clearMocks` and `restoreMocks` are on** — no `vi.clearAllMocks()` / `vi.restoreAllMocks()` in a
  spec. `restoreMocks` restores every `vi.spyOn` before each test, so a spy created in `beforeAll` is
  gone by the first test: create it in `beforeEach`.
- **A DB spec that never calls `vi.mock` / `vi.doMock` runs in `db-shared`** — one module cache and
  one Payload boot for every such file. `vitest.config.ts` sorts by reading the source, so the first
  module mock moves a spec to the isolated `db` project on its own.
  `vi.spyOn` is fine: `setup/db.ts` restores every spy at the end of each file.
- **The session is mocked one level below `requireAuth`**: `get-current-user-jwt` →
  `stubs/get-current-user-jwt`, steered through its `authState`, so the real role gate runs. A DB
  spec gets it from `setup/db.ts` and never re-mocks it — a per-file `vi.mock` would move it to the
  isolated `db` project; a node or dom spec declares the `vi.mock` itself. Never mock
  `@/lib/auth/require-auth` to pass a gate — a role the app refuses must fail the spec.
  `@/hooks/use-current-user` takes `stubs/use-current-user`, which reads the same `authState`.
- **Never add a constant to `@/lib/utils/toast`** — the dom setup mocks it as `{ toastMessage }`
  alone, so any other export is `undefined` in every component spec. Notice wording and timing live in
  `lib/utils/notice.ts`.
- **jsdom has no layout engine** — `matchMedia`, `ResizeObserver` and `scrollIntoView` are stubbed in
  `setup/dom.ts`. Radix and cmdk gate on them; without the stubs a popover mounts and instantly hides,
  and the failure reads as a bad selector.
- **The golden master is not in the integration discovery** — it asserts the whole dataset against a
  committed fixture and runs via `pnpm test:parity`, because its neighbours create rows in the same
  shared DB. Both DB legs first clone that DB from a seeded template (`db:reset:test`), since E2E
  writes to the investments the fixture covers. Dataset-floor counters and the seeds that fill them: `context/foundation/test-plan.md` §5.
