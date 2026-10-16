import { defineConfig, type Plugin } from 'vitest/config'
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
          testTimeout: 20_000,
        },
      },
    ],
  },
})
