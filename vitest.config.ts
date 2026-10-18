import { defineConfig, type Plugin } from 'vitest/config'
import { globSync, readFileSync } from 'fs'
import path from 'path'

const alias = {
  // Most specific first — vite matches alias keys in order.
  // Resolves to the real module: the stub below would otherwise swallow this path as a prefix.
  '@/lib/env/schema': path.resolve(__dirname, './src/lib/env/schema.ts'),
  '@/lib/env/server': path.resolve(__dirname, './src/__tests__/stubs/env-server.ts'),
  '@/lib/env': path.resolve(__dirname, './src/__tests__/stubs/env.ts'),
  '@': path.resolve(__dirname, './src'),
  '@payload-config': path.resolve(__dirname, './src/payload.config.ts'),
  // Node test env lacks the `react-server` condition, so the real `server-only`
  // throws on import.
  'server-only': path.resolve(__dirname, './src/__tests__/stubs/server-only.ts'),
  // `unstable_cache` wants a request scope and `updateTag` a server action,
  // neither of which exists in node.
  'next/cache': path.resolve(__dirname, './src/__tests__/stubs/next-cache.ts'),
}

const unitAlias = {
  ...alias,
  '@payload-config': path.resolve(__dirname, './src/__tests__/stubs/payload-config.ts'),
}

// A project does not inherit the root config's `css`, and the app's own postcss.config.mjs holds a
// Tailwind plugin Vite refuses to load — so every project turns postcss off explicitly.
const postcss = { postcss: { plugins: [] } }

function stubServerActions(): Plugin {
  return {
    name: 'stub-use-server-modules',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.tsx?$/.test(id) || !/^\s*['"]use server['"]/.test(code)) return
      // A future `export const` would not match and the import fails by name — loud, not silent.
      return [...code.matchAll(/^export (?:async )?function (\w+)/gm)]
        .map(
          ([, name]) =>
            `export async function ${name}() { throw new Error('${name}: server action called from a component spec — assert the pre-action UI, or vi.mock it') }`,
        )
        .join('\n')
    },
  }
}

// A spec that mocks a module would leak that mock into every later file sharing the module cache.
const dbSpecs = globSync('src/__tests__/**/*.db.test.ts', { cwd: __dirname })
const mocksModules = (file: string) =>
  /\bvi\.(mock|doMock|spyOn)\(/.test(readFileSync(path.join(__dirname, file), 'utf8'))
const dbSpecsThatMock = dbSpecs.filter(mocksModules)
const dbSpecsMockFree = dbSpecs.filter((file) => !mocksModules(file))

const baseTest = { globals: true, css: false, clearMocks: true, restoreMocks: true }

const nodeTest = {
  ...baseTest,
  testTimeout: 15_000,
  unstubEnvs: true,
  setupFiles: ['./src/__tests__/setup/node.ts'],
}

const dbTest = {
  ...nodeTest,
  setupFiles: [...nodeTest.setupFiles, './src/__tests__/setup/db.ts'],
  // A cold Payload boot in a DB spec's beforeAll runs ~9-10s, past the 10s default.
  hookTimeout: 30_000,
}

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: unitAlias },
        css: postcss,
        test: {
          ...nodeTest,
          name: 'node',
          include: ['src/__tests__/**/*.test.ts'],
          exclude: ['src/__tests__/**/*.db.test.ts'],
        },
      },
      // Own projects so the unit run never collects them: each one loads the Payload/Drizzle graph
      // only to skip without a DB env. `pnpm test:integration` and `pnpm test:parity` select both.
      {
        resolve: { alias },
        css: postcss,
        test: {
          ...dbTest,
          name: 'db',
          include: dbSpecsThatMock,
        },
      },
      // One Payload boot for the whole project instead of one per file: ~12s against ~10s per file.
      {
        resolve: { alias },
        css: postcss,
        test: {
          ...dbTest,
          name: 'db-shared',
          include: dbSpecsMockFree,
          isolate: false,
        },
      },
      {
        resolve: { alias: unitAlias },
        css: postcss,
        plugins: [stubServerActions()],
        test: {
          ...baseTest,
          name: 'dom',
          include: ['src/__tests__/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./src/__tests__/setup/dom.ts'],
          testTimeout: 20_000,
        },
      },
    ],
  },
})
