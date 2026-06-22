// Test double for `@/lib/env.server`. The real module eagerly parses the FULL serverSchema
// at import, which would force every unit test that touches a server module to provide the
// entire server env. This passthrough reads process.env lazily per access instead, so tests
// keep seeding only the vars they exercise (and the parity test's DB gate stays untouched).
export const serverEnv = new Proxy(
  {},
  {
    get: (_target, key: string) => process.env[key],
  },
) as Record<string, string | undefined>
