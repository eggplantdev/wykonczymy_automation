import { describe, it, expect } from 'vitest'
import { compileWithReactCompiler } from '@/__tests__/helpers/react-compiler-cache'

const FILE = 'src/components/kosztorys/editor/kosztorys-editor-body.tsx'

// Each reaches dsg as `columns` / `gutterColumn` (or rides inside them); a fresh identity per render
// makes dsg re-process every column on every keystroke of a ~1000-pozycja kosztorys.
const GRID_PROPS = ['sectionHeader', 'sectionFooter', 'gridColumns', 'gutterColumn']

describe('KosztorysEditorBody under the React Compiler', () => {
  const compiled = compileWithReactCompiler(FILE)

  it.each(GRID_PROPS)('%s keeps its identity until its inputs change', (name) => {
    expect(compiled.bindingCached(name), `${name} is not declared in ${FILE}`).toBeDefined()
    expect(compiled.bindingCached(name)).toBe(true)
  })
})
