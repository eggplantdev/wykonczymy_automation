import { describe, it, expect } from 'vitest'
import { compileWithReactCompiler } from '@/__tests__/helpers/react-compiler-cache'

const FILE = 'src/components/kosztorys/editor/hooks/use-row-sizing.ts'

// `columnLinesFor` memoises per row only while its identity holds — a fresh one per render re-measures
// every row's text; the rest reach dsg as row-height and gutter props.
const BINDINGS = [
  'measured',
  'measuredIds',
  'columnLinesFor',
  'rowResize',
  'fitRowToContent',
  'rowHeightFor',
  'isClipped',
]

describe('useRowSizing under the React Compiler', () => {
  const compiled = compileWithReactCompiler(FILE)

  it.each(BINDINGS)('%s keeps its identity until its inputs change', (name) => {
    expect(compiled.bindingCached(name), `${name} is not declared in ${FILE}`).toBeDefined()
    expect(compiled.bindingCached(name)).toBe(true)
  })
})
