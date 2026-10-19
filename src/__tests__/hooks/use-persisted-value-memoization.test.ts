import { describe, it, expect } from 'vitest'
import { compileWithReactCompiler } from '@/__tests__/helpers/react-compiler-cache'

const FILE = 'src/hooks/use-persisted-value.ts'

// The setters land in the kosztorys editor's column options; a fresh one per render rebuilds every
// column on each keystroke.
const CALLBACK_BODIES = ['writeStored', 'readEnum', 'readNumber']

describe('usePersistedValue under the React Compiler', () => {
  const compiled = compileWithReactCompiler(FILE)

  it.each(CALLBACK_BODIES)('the callback calling %s keeps its identity per storage key', (name) => {
    expect(compiled.callSites(name), `${name} is not called in ${FILE}`).not.toHaveLength(0)
    expect(compiled.callSites(name)).not.toContain(false)
  })
})
