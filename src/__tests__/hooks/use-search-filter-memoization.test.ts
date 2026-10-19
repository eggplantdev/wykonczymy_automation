import { describe, it, expect } from 'vitest'
import { compileWithReactCompiler } from '@/__tests__/helpers/react-compiler-cache'

const FILE = 'src/hooks/use-search-filter.ts'

// Each walks every row of the list; run per render, a search keystroke re-folds the whole list twice.
const ROW_SCANS = ['foldHaystacks', 'filterBySearch']

describe('useSearchFilter under the React Compiler', () => {
  const compiled = compileWithReactCompiler(FILE)

  it.each(ROW_SCANS)('%s runs only when its inputs change', (name) => {
    expect(compiled.callSites(name), `${name} is not called in ${FILE}`).not.toHaveLength(0)
    expect(compiled.callSites(name)).not.toContain(false)
  })
})
