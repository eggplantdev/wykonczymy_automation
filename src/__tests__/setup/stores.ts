import { vi } from 'vitest'
import type * as Zustand from 'zustand'

// On `globalThis`: a shared project creates each store once, so without a per-file reset a file
// starts from the state the previous file left behind.
const resets = vi.hoisted(
  () => ((globalThis as { storeResets?: Set<() => void> }).storeResets ??= new Set()),
)

vi.mock('zustand', async (importOriginal) => {
  const zustand = await importOriginal<typeof Zustand>()
  const register = (initializer: Zustand.StateCreator<object>) => {
    const store = zustand.create(initializer)
    const initial = store.getInitialState()
    resets.add(() => store.setState(initial, true))
    return store
  }
  return {
    ...zustand,
    create: (initializer?: Zustand.StateCreator<object>) =>
      initializer ? register(initializer) : register,
  }
})

for (const reset of resets) reset()
