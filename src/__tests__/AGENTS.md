# Vitest harness traps

Rules for specs under `src/__tests__/`. Layering, placement and skill routing live in the root
`AGENTS.md` → Testing.

- **A `'use server'` module is stubbed, not imported** (`stubServerActions` in `vitest.config.ts`).
  Without the swap Next does in the browser, one statically-imported action drags Payload, the DB
  client and a live Nodemailer socket into a jsdom spec. Every stubbed export is a `vi.fn` that
  **throws** until steered and resets before each file: assert the UI on the way to the action, or
  steer it with `vi.mocked(action).mockResolvedValue(…)` — a `vi.mock` would isolate the spec.
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
  - dom (`setup/dom.ts`): `@/lib/utils/toast` (import `toastMessage` and assert it as the mock — one
    instance for every file of a worker);
    `next/navigation` → `stubs/next-navigation` (assert `router.push`, set `navigationState.pathname`
    / `.searchParams`); `react-resize-detector` → `stubs/react-resize-detector`. Plus pass-through
    seams steered the DB way: the kosztorys editor and actions contexts, `submit-with-uploads`,
    `scan-receipt-client`, `ingest-files` (`stubs/ingest-files` is a ready implementation),
    `use-current-user` (`stubs/use-current-user`), `use-reference-data` (`stubs/use-reference-data`;
    the real hook returns `null` outside the shell's provider) and `navigate-to` (jsdom can't leave
    the page).
- **`clearMocks` and `restoreMocks` are on** — no `vi.clearAllMocks()` / `vi.restoreAllMocks()` in a
  spec. `restoreMocks` restores every `vi.spyOn` before each test, so a spy created in `beforeAll` is
  gone by the first test: create it in `beforeEach`.
- **A spec that never calls `vi.mock` / `vi.doMock` runs in a shared project** (`node-shared`,
  `dom-shared`, `db-shared`) — one module cache per worker for every such file. `vitest.config.ts`
  sorts by reading the source, so the first module mock (or a `require.cache` / `_resolveFilename`
  patch) moves a spec to the isolated project on its own. `vi.spyOn`, `vi.stubGlobal` and fake
  timers are fine: the setups restore them at the end of each file.
- **Shared state is reset per file, at setup top level** — so a spec may set it at its own top level:
  every zustand store goes back to its initial state (`setup/stores.ts`); in dom also
  `navigationState`, `authState`, `location` (`/`), `localStorage` / `sessionStorage`, and the DOM
  is emptied after each test. Any other module-level state (a cache, a singleton) a spec mutates
  leaks into the next shared file — reset it in the spec.
- **The session is mocked one level below `requireAuth`**: `get-current-user-jwt` →
  `stubs/get-current-user-jwt`, steered through its `authState`, so the real role gate runs. A DB
  spec gets it from `setup/db.ts` and never re-mocks it — a per-file `vi.mock` would move it to the
  isolated `db` project; a node or dom spec declares the `vi.mock` itself. Never mock
  `@/lib/auth/require-auth` to pass a gate — a role the app refuses must fail the spec.
  In dom, `vi.mocked(useCurrentUser).mockImplementation(stubs/use-current-user)` reads the same
  `authState`.
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
