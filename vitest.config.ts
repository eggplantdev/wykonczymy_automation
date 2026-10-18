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
      const names = [...code.matchAll(/^export (?:async )?function (\w+)/gm)].map(
        ([, name]) => name,
      )
      return [
        "import { vi } from 'vitest'",
        'const stubs = (globalThis.serverActionStubs ??= [])',
        'const stub = (name) => {',
        '  const action = vi.fn(async () => {',
        '    throw new Error(`${name}: server action called from a component spec — assert the pre-action UI, or steer it with vi.mocked`)',
        '  })',
        '  stubs.push(action)',
        '  return action',
        '}',
        ...names.map((name) => `export const ${name} = stub('${name}')`),
      ].join('\n')
    },
  }
}

// A spec that mocks a module, or patches Node's resolver, would leak that into every later file
// sharing the module cache.
const isolatesModules = (file: string) =>
  /\bvi\.(mock|doMock|unmock|resetModules)\(|require\.cache|_resolveFilename/.test(
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

const baseTest = {
  globals: true,
  css: false,
  clearMocks: true,
  restoreMocks: true,
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
  deps: { optimizer: { client: { enabled: true, include: ['react-day-picker', 'date-fns'] } } },
}

const pair = (
  name: string,
  project: typeof nodeProject,
  test: typeof nodeTest | typeof domTest,
  files: ReturnType<typeof partition>,
) => [
  { ...project, test: { ...test, name, include: files.isolated } },
  { ...project, test: { ...test, name: `${name}-shared`, include: files.shared, isolate: false } },
]

export default defineConfig({
  test: {
    projects: [
      ...pair('node', nodeProject, nodeTest, nodeSpecs),
      // Own projects so the unit run never collects them: each one loads the Payload/Drizzle graph
      // only to skip without a DB env. `pnpm test:integration` and `pnpm test:parity` select both.
      ...pair('db', dbProject, dbTest, dbSpecs),
      ...pair('dom', domProject, domTest, domSpecs),
    ],
  },
})
