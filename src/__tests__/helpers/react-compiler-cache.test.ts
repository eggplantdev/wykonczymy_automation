import { describe, it, expect } from 'vitest'
import { compileWithReactCompiler } from '@/__tests__/helpers/react-compiler-cache'

// Without a known-fresh binding, a helper that reports everything as cached passes every memoization spec.
describe('compileWithReactCompiler', () => {
  const compiled = compileWithReactCompiler(
    'src/__tests__/fixtures/react-compiler-cache/scope-spans-hook.ts',
  )

  it('reports a value whose scope spans a hook call as fresh', () => {
    expect(compiled.bindingCached('spansHook')).toBe(false)
  })

  it('reports a value derived from a fresh one as fresh', () => {
    expect(compiled.bindingCached('keyedOnFresh')).toBe(false)
  })

  it('reports a value keyed on stable inputs as cached', () => {
    expect(compiled.bindingCached('cached')).toBe(true)
  })

  it('reports an undeclared name as unknown', () => {
    expect(compiled.bindingCached('missing')).toBeUndefined()
  })
})
