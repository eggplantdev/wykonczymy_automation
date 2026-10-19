import { describe, it, expect } from 'vitest'
import { compileWithReactCompiler } from '@/__tests__/helpers/react-compiler-cache'

const FILE = 'src/components/investments/investment-data-table.tsx'

// `getSearchableText` keys the search haystacks and `columns` the table — a fresh one per render re-folds
// every row or rebuilds every column on each search keystroke.
const BINDINGS = ['getSearchableText', 'columns']

describe('InvestmentDataTable under the React Compiler', () => {
  const compiled = compileWithReactCompiler(FILE)

  it.each(BINDINGS)('%s keeps its identity until its inputs change', (name) => {
    expect(compiled.bindingCached(name), `${name} is not declared in ${FILE}`).toBeDefined()
    expect(compiled.bindingCached(name)).toBe(true)
  })
})
