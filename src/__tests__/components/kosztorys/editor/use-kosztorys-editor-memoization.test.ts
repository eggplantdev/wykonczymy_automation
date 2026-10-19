import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

type NodeT = { type: string; [key: string]: unknown }
type PathT = {
  node: NodeT
  findParent: (predicate: (parent: PathT) => boolean) => PathT | null
}
type BabelT = {
  transformSync: (code: string, options: object) => { code: string } | null
  parseSync: (code: string, options: object) => NodeT
  traverse: (ast: NodeT, visitors: Record<string, (path: PathT) => void>) => void
}

const requireFromHere = createRequire(import.meta.url)
const babel = requireFromHere('next/dist/compiled/babel/core') as BabelT

const FILE = 'src/components/kosztorys/editor/use-kosztorys-editor.ts'

// Each walks every row; a keystroke re-renders the editor more than once, so an unmemoized one costs a
// frame per keystroke on a ~1000-pozycja kosztorys.
const ROW_SCANS = [
  'hasAiDraft',
  'subcontractorDueByPlane',
  'forecastByPlane',
  'divergentPriceRowIds',
  'buildCatalogueComparison',
  'qtyDoneByRow',
  'countMatching',
  'rowIdsMatching',
  'investorEmptyColumnIds',
  'workerDataHiddenColumns',
  'applyRowConditions',
  'sectionSubtotalsForView',
  'sectionIdsWhereAllMatch',
  'buildViewRows',
  'baseOrdinals',
  'stageAxisForView',
  'columnTotalsForRows',
  'groupBySection',
]

function compiledCalls(): Map<string, boolean[]> {
  const source = readFileSync(path.resolve(process.cwd(), FILE), 'utf-8')
  const compiled = babel.transformSync(source, {
    filename: path.resolve(process.cwd(), FILE),
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [[requireFromHere.resolve('babel-plugin-react-compiler'), {}]],
  })
  const code = compiled?.code ?? ''
  const ast = babel.parseSync(code, {
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['typescript', 'jsx'] },
  })
  const isCacheGuard = (parent: PathT) => {
    if (parent.node.type !== 'IfStatement') return false
    const test = parent.node.test as { start: number; end: number }
    return code.slice(test.start, test.end).includes('$[')
  }
  const calls = new Map<string, boolean[]>()
  babel.traverse(ast, {
    CallExpression(callPath) {
      const callee = callPath.node.callee as NodeT & { name?: string }
      if (callee.type !== 'Identifier' || !ROW_SCANS.includes(callee.name ?? '')) return
      const guarded = callPath.findParent(isCacheGuard) !== null
      calls.set(callee.name!, [...(calls.get(callee.name!) ?? []), guarded])
    },
  })
  return calls
}

describe('useKosztorysEditor under the React Compiler', () => {
  const calls = compiledCalls()

  it.each(ROW_SCANS)('%s runs only when its inputs change', (name) => {
    expect(calls.get(name), `${name} is not called in ${FILE}`).toBeDefined()
    expect(calls.get(name)).not.toContain(false)
  })
})
