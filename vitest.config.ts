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

// A spec that mocks a module, or patches Node's resolver, would leak that into every later file
// sharing the module cache.
const isolatesModules = (file: string) =>
  /\bvi\.(mock|doMock)\(|require\.cache|_resolveFilename/.test(
    readFileSync(path.join(__dirname, file), 'utf8'),
  )
const partition = (files: string[]) => ({
  isolated: files.filter(isolatesModules),
  shared: files.filter((file) => !isolatesModules(file)),
})
const specs = (pattern: string) => globSync(pattern, { cwd: __dirname })
const nodeSpecs = partition(
  specs('src/__tests__/**/*.test.ts').filter((file) => !file.endsWith('.db.test.ts')),
)
const dbSpecs = partition(specs('src/__tests__/**/*.db.test.ts'))
const domSpecs = partition(specs('src/__tests__/**/*.test.tsx'))

// `passWithNoTests`: a partition can come out empty once its last module mock is gone.
const baseTest = {
  globals: true,
  css: false,
  clearMocks: true,
  restoreMocks: true,
  passWithNoTests: true,
}

const nodeTest = {
  ...baseTest,
  testTimeout: 15_000,
  unstubEnvs: true,
  setupFiles: ['./src/__tests__/setup/stores.ts', './src/__tests__/setup/node.ts'],
}

const dbTest = {
  ...nodeTest,
  setupFiles: [...nodeTest.setupFiles, './src/__tests__/setup/db.ts'],
  hookTimeout: 30_000,
}

const nodeProject = {
  resolve: { alias: unitAlias },
  css: postcss,
}

const dbProject = {
  resolve: { alias },
  css: postcss,
}

const domProject = {
  resolve: { alias: unitAlias },
  css: postcss,
  plugins: [stubServerActions()],
}

const domTest = {
  ...baseTest,
  environment: 'jsdom',
  setupFiles: ['./src/__tests__/setup/stores.ts', './src/__tests__/setup/dom.ts'],
  testTimeout: 20_000,
}

// Each `*-shared` project keeps one module graph for all its files instead of one per file — the
// import cost (~1.2 s per DB file) is paid once per worker.
export default defineConfig({
  test: {
    projects: [
      { ...nodeProject, test: { ...nodeTest, name: 'node', include: nodeSpecs.isolated } },
      {
        ...nodeProject,
        test: { ...nodeTest, name: 'node-shared', include: nodeSpecs.shared, isolate: false },
      },
      // Own projects so the unit run never collects them: each one loads the Payload/Drizzle graph
      // only to skip without a DB env. `pnpm test:integration` and `pnpm test:parity` select both.
      { ...dbProject, test: { ...dbTest, name: 'db', include: dbSpecs.isolated } },
      {
        ...dbProject,
        test: { ...dbTest, name: 'db-shared', include: dbSpecs.shared, isolate: false },
      },
      { ...domProject, test: { ...domTest, name: 'dom', include: domSpecs.isolated } },
      {
        ...domProject,
        test: { ...domTest, name: 'dom-shared', include: domSpecs.shared, isolate: false },
      },
    ],
  },
})
