# Vercel Bug Report: Server Actions 500 with `cacheComponents: true`

## Summary

All Next.js server actions return HTTP 500 on Vercel when `cacheComponents: true` is enabled in `next.config.ts`. The error is a `JSON.parse` SyntaxError that occurs inside the Next.js framework before any application code executes. The same code works locally with `next start`. Disabling `cacheComponents` resolves the issue.

## Environment

- **Next.js**: 16.1.6 (also reproduced on 16.1.7)
- **Payload CMS**: 3.73.0 (`@payloadcms/next`: 3.73.0)
- **React**: 19.2.4
- **Node.js (local)**: 24.12.0
- **Vercel plan**: Hobby
- **Vercel function region**: iad1 (US East)
- **Database**: Neon Postgres (eu-central-1)
- **Package manager**: pnpm 10.27.0

## next.config.ts (broken)

```ts
const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true, // <-- causes server action 500s on Vercel
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  serverExternalPackages: ['payload', 'pino', 'pino-pretty', 'thread-stream'],
}
export default withPayload(nextConfig)
```

## Error

Every server action POST returns:

```
SyntaxError: Unexpected non-whitespace character after JSON at position 4 (line 1 column 5)
    at JSON.parse (<anonymous>) {
  digest: '2359527356'
}
```

RSC flight response:

```
0:{"a":"$@1","f":"","b":"_RNFa64AyST5ZaHpJOQnn","q":"","i":false}
1:E{"digest":"2359527356"}
```

## What Works vs What Breaks

| Scenario                                      | Result                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| GET requests (dashboard, pages)               | Works                                                                        |
| POST server actions (login, create transfer)  | 500 error                                                                    |
| Payload admin panel server actions            | Works (uses custom `handleServerFunctions` RPC, not standard server actions) |
| API route POST (`fetch` to `/api/auth/login`) | Works                                                                        |
| `next start` locally (same code, same DB)     | Works                                                                        |
| `next dev` locally                            | Works                                                                        |
| Vercel with `cacheComponents: true`           | Broken                                                                       |
| Vercel with `cacheComponents` disabled        | Works                                                                        |

## Key Finding: No Application Code Executes

We added `console.log` to the auth layout. On GET requests, logs appear normally. On POST (server action) requests, **zero application logs appear** — the crash happens inside the Next.js framework before any user code runs.

```
// GET /zaloguj → logs appear:
[AUTH_LAYOUT] rendering
[AUTH_LAYOUT] getCurrentUserJwt: no user

// POST /zaloguj → NO logs at all, just:
SyntaxError: Unexpected non-whitespace character after JSON at position 4
```

## What We Tried (Did Not Help)

1. **Setting `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`** — stable encryption key across deploys. Digest changed slightly but error persisted.

2. **Upgrading Next.js 16.1.6 → 16.1.7** — different digest number but same error.

3. **Force redeploying (`vercel --prod --force`)** — cleared build cache, same error.

4. **Creating a brand new Vercel project** — no Neon integration, manually set env vars, same error with `cacheComponents: true`.

5. **Rolling back to older deployments** — deployments that previously worked now also show the error (Vercel serves old deployments with current runtime).

6. **Removing `channel_binding=require` from Neon connection string** — no effect.

7. **Adding `connection()` from `next/server` to auth layout** — prevents prerender of the layout but didn't fix server actions.

8. **Removing trailing `\n` from env var** — no effect.

## What Fixed It

Disabling `cacheComponents` in `next.config.ts` and commenting out all `'use cache'`, `cacheLife()`, and `cacheTag()` directives in query files. This changes all routes from `◐` (Partial Prerender) to `ƒ` (Dynamic).

Build output with `cacheComponents: true` (broken):

```
◐ /                    ← Partial Prerender
◐ /inwestycje/[id]    ← Partial Prerender
ƒ /zaloguj            ← Dynamic
```

Build output without `cacheComponents` (working):

```
ƒ /                    ← Dynamic
ƒ /inwestycje/[id]    ← Dynamic
ƒ /zaloguj            ← Dynamic
```

## Why Payload Admin Works

Payload CMS does not use standard Next.js server actions. It routes all operations through a single `handleServerFunctions` RPC endpoint defined in the layout:

```ts
const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({ ...args, config, importMap })
}
```

This bypasses the Next.js server action resolution/encryption/decryption pipeline that appears to be broken with PPR on Vercel.

## Timeline

- **~12:30** — Neon integration preview branch connected (triggered redeployment)
- **18:11–18:15** — Server actions working (transactions created by users)
- **~18:30** — New code pushed and deployed (unrelated changes)
- **~18:45** — Server actions broken (first noticed)
- **Investigation** — Even rolling back to pre-push deployments shows the error
- **~22:00** — Confirmed: disabling `cacheComponents` fixes the issue

## Hypothesis

The Vercel serverless runtime updated between 18:15 and 18:45, or the redeployment triggered by our code push was served by a different runtime version. The `cacheComponents`/PPR feature has a bug in how it handles server action POST requests on Vercel's serverless runtime — specifically, the RSC re-render that occurs during a server action fails with a JSON parse error before any application code can execute.

The error at "position 4" suggests the framework is trying to `JSON.parse` something that starts with 4 characters of valid JSON (like `true` or `null`) followed by unexpected content — possibly a corrupted prerender cache entry or a malformed internal state.

## Reproduction

1. Create a Next.js 16 app with `cacheComponents: true`
2. Add any `'use cache'` function
3. Add a server action (standard `'use server'` file)
4. Deploy to Vercel
5. Call the server action from a client component

## Related Issues

- [payloadcms/payload#15180](https://github.com/payloadcms/payload/issues/15180) — Payload CMS + Next.js Server Actions crash in production
- [vercel/next.js#86945](https://github.com/vercel/next.js/issues/86945) — HTTP 500 on malformed request body for server action
- [vercel/next.js#86577](https://github.com/vercel/next.js/issues/86577) — cacheComponents Activity component causes significant breakage
- [vercel/next.js discussions#89990](https://github.com/vercel/next.js/discussions/89990) — cacheComponents breaks when streamed content is big enough
