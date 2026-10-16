# Vitest harness traps

Rules for specs under `src/__tests__/`. Layering, placement and skill routing live in the root
`AGENTS.md` → Testing.

- **A `'use server'` module is stubbed, not imported** (`stubServerActions` in `vitest.config.ts`).
  Without the swap Next does in the browser, one statically-imported action drags Payload, the DB
  client and a live Nodemailer socket into a jsdom spec. Every stubbed export **throws** when called:
  assert the UI on the way to the action, or `vi.mock` the action explicitly.
- **Mocking `@/lib/cache/revalidate` takes the shared stub:**
  `vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))`, importing
  the spy from that stub to assert. A hand-rolled factory misses any export it doesn't list; the
  missing one comes back `undefined` and `protectedAction` swallows the TypeError into
  `{ success: false }`, which reads as a business-logic failure. Not aliased globally because
  `revalidate.test.ts` tests the real module.
- **Never add a constant to a module specs mock by hand.** `@/lib/utils/toast` is hand-mocked in
  ~22 specs, so a constant exported from it is `undefined` in all of them. Notice wording and timing
  live in `lib/utils/notice.ts`; `toast.ts` stays the side effect alone.
- **jsdom has no layout engine** — `matchMedia`, `ResizeObserver` and `scrollIntoView` are stubbed in
  `setup/dom.ts`. Radix and cmdk gate on them; without the stubs a popover mounts and instantly hides,
  and the failure reads as a bad selector.
- **The golden master is not in the integration discovery** — it asserts the whole dataset against a
  committed fixture and runs via `pnpm test:parity`, because its neighbours create rows in the same
  shared DB. Dataset-floor counters and the seeds that fill them: `context/foundation/test-plan.md` §5.
