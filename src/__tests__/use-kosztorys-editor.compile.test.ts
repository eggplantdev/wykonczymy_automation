import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Build-integrity guard for EX-496: React Compiler must memoize useKosztorysEditor.
// The hook once emitted ZERO `_c` cache slots — the compiler bailed on three constructs, and
// because `panicThreshold` defaults to skip-and-continue the bail is SILENT: no build error, no
// lint warning, no console message, the file just leaves the pipeline untransformed. Every
// compiled downstream consumer keyed on its outputs then misses on every keystroke. This test
// reproduces the de-opt by compiling the real file through the babel plugin and asserting the
// hook carries a cache — so a future edit that re-bails fails the suite instead of silently
// de-optimizing the editor.

// @babel/core is not hoisted under pnpm strict; the plugin is. Resolve core from the plugin's
// own dir (it's a peer there) rather than pinning the store's versioned path. Do NOT `pnpm add`
// babel to make this simpler — per AGENTS.md it can swap the arm64 lightningcss binary to x64.
const rootRequire = createRequire(path.join(process.cwd(), 'noop.js'))
const pluginPath = rootRequire.resolve('babel-plugin-react-compiler')
const pluginRequire = createRequire(pluginPath)
const babel = pluginRequire('@babel/core')
const reactCompiler = pluginRequire('babel-plugin-react-compiler')
const plugin = reactCompiler.default ?? reactCompiler

const HOOK_FILE = 'src/components/kosztorys/use-kosztorys-editor.ts'

type LogEventT = { kind: string; detail?: string }

function compileHook() {
  const source = readFileSync(HOOK_FILE, 'utf8')
  const events: LogEventT[] = []
  const result = babel.transformSync(source, {
    filename: HOOK_FILE,
    // No @babel/preset-typescript is installed — parse TS/JSX directly.
    parserOpts: { plugins: ['jsx', 'typescript'] },
    plugins: [
      [
        plugin,
        {
          logger: {
            logEvent: (
              _filename: string,
              event: { kind: string; detail?: { reason?: string; description?: string } },
            ) =>
              events.push({
                kind: event.kind,
                detail: event.detail?.reason ?? event.detail?.description,
              }),
          },
        },
      ],
    ],
  })
  const cacheSlots = (result?.code?.match(/_c\(/g) ?? []).length
  return { code: result?.code ?? '', events, cacheSlots }
}

describe('useKosztorysEditor React Compiler memoization', () => {
  it('compiles under React Compiler (emits a _c cache, no bail)', () => {
    const { events, cacheSlots } = compileHook()
    const bail = events.find((e) => e.kind === 'CompileError' || e.kind === 'CompileSkip')

    expect(
      bail,
      `React Compiler bailed on ${HOOK_FILE} — the hook stopped compiling and is now silently ` +
        `unmemoized (see EX-496). Bail: ${bail?.detail ?? 'unknown'}`,
    ).toBeUndefined()

    expect(
      cacheSlots,
      `${HOOK_FILE} emitted zero _c cache slots — React Compiler did not memoize it.`,
    ).toBeGreaterThan(0)
  })
})
