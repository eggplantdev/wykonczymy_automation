import { describe, it, expect } from 'vitest'
import { compileWithReactCompiler } from '@/__tests__/helpers/react-compiler-cache'

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

describe('useKosztorysEditor under the React Compiler', () => {
  const compiled = compileWithReactCompiler(FILE)

  it.each(ROW_SCANS)('%s runs only when its inputs change', (name) => {
    expect(compiled.callSites(name), `${name} is not called in ${FILE}`).not.toHaveLength(0)
    expect(compiled.callSites(name)).not.toContain(false)
  })
})
