import { describe, it, expect } from 'vitest'
import { compileWithReactCompiler } from '@/__tests__/helpers/react-compiler-cache'

const FILE = 'src/components/work-catalogue/work-catalogue-data-table.tsx'

// `findNearDuplicates` alone costs ~0.1 s over the katalog; run per render, every search keystroke pays it.
const PER_DATA = [
  'findNearDuplicates',
  'catalogueCategoryOptions',
  'catalogueCategorySuggestions',
  'catalogueUnitOptions',
  'getWorkCatalogueColumns',
]

describe('WorkCatalogueDataTable under the React Compiler', () => {
  const compiled = compileWithReactCompiler(FILE)

  it.each(PER_DATA)('%s runs only when the katalog changes', (name) => {
    expect(compiled.callSites(name), `${name} is not called in ${FILE}`).not.toHaveLength(0)
    expect(compiled.callSites(name)).not.toContain(false)
  })

  it('ordinals keep their identity until the katalog changes', () => {
    expect(compiled.bindingCached('ordinals')).toBe(true)
  })
})
