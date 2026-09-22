import { defineConfig, type Plugin } from 'vitest/config'
import path from 'path'

const alias = {
  // Most specific first — vite matches alias keys in order.
  // env/server eagerly parses the full server schema at import; swap it for a
  // process.env passthrough so unit tests needn't supply every server var.
  // Resolves to the real module: the stub below would otherwise swallow this path as a prefix.
  '@/lib/env/schema': path.resolve(__dirname, './src/lib/env/schema.ts'),
  '@/lib/env/server': path.resolve(__dirname, './src/__tests__/stubs/env-server.ts'),
  '@/lib/env': path.resolve(__dirname, './src/__tests__/stubs/env.ts'),
  '@': path.resolve(__dirname, './src'),
  '@payload-config': path.resolve(__dirname, './src/payload.config.ts'),
  // Node test env lacks the `react-server` condition, so the real `server-only`
  // throws on import. Map it to a no-op stub.
  'server-only': path.resolve(__dirname, './src/__tests__/stubs/server-only.ts'),
  // Same reason: `unstable_cache` wants a request scope and `updateTag` a server action,
  // neither of which exists in node. See the stub for why it's aliased, not per-spec mocked.
  'next/cache': path.resolve(__dirname, './src/__tests__/stubs/next-cache.ts'),
}

// A project does not inherit the root config's `css`, and the app's own postcss.config.mjs holds a
// Tailwind plugin Vite refuses to load — so every project turns postcss off explicitly. A component
// that imports a stylesheet (react-toastify does) otherwise fails to load at all.
const postcss = { postcss: { plugins: [] } }

// Next replaces a 'use server' module with an RPC stub before it reaches the browser. Vitest has no
// such step, so a component that statically imports one server action drags the whole server graph
// into a jsdom spec — Payload, the DB client, and a Nodemailer transport that really opens a socket
// to EMAIL_HOST. Do what the framework does. Calling a stub throws rather than no-ops: a component
// spec asserts what the user sees on the way to the action, and a spec that needs the call to
// resolve must say so with vi.mock instead of silently testing against a shrug.
function stubServerActions(): Plugin {
  return {
    name: 'stub-use-server-modules',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.tsx?$/.test(id) || !/^\s*['"]use server['"]/.test(code)) return
      // Only `export [async] function` appears in src/lib/actions. A future `export const` would
      // not match and the import fails by name — loud, not silent.
      return [...code.matchAll(/^export (?:async )?function (\w+)/gm)]
        .map(
          ([, name]) =>
            `export async function ${name}() { throw new Error('${name}: server action called from a component spec — assert the pre-action UI, or vi.mock it') }`,
        )
        .join('\n')
    },
  }
}

// The extension IS the environment: `.test.ts` runs in node, `.test.tsx` in jsdom. A component
// spec cannot be filed under the wrong runner by accident, and `scripts/test-integration.sh`
// keeps discovering DB specs by grep without ever pulling a DOM spec into the 5435 leg.
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        css: postcss,
        test: {
          name: 'node',
          globals: true,
          include: ['src/__tests__/**/*.test.ts'],
          css: false,
          // Three times the default. Same reason as the dom project below, milder: a WASM decode or
          // a Google-client spec that finishes in well under a second alone still blew past 5s while
          // a second agent saturated the machine. The limit is there to catch a hung spec, not to
          // measure how busy the laptop was.
          testTimeout: 15_000,
        },
      },
      {
        resolve: { alias },
        css: postcss,
        plugins: [stubServerActions()],
        test: {
          name: 'dom',
          globals: true,
          include: ['src/__tests__/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./src/__tests__/setup/dom.ts'],
          css: false,
          // Four times the default 5s. A jsdom spec that takes ~400ms alone stretches 8-15x when 49
          // of them share 8 cores with the node project, and it was the timeout — not a broken
          // assertion — that made three specs alternate red between whole-suite runs. Costs nothing
          // on a green run: the limit only fires on a spec that is genuinely stuck.
          testTimeout: 20_000,
        },
      },
    ],
  },
})
