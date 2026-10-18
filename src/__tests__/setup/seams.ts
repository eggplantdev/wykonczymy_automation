import { vi, type Mock } from 'vitest'

// On `globalThis`: a module cached by an earlier shared file keeps the seam it imported then, so a
// fresh `vi.fn` per file would leave the spec steering an instance the code under test never calls.
type SeamRegistryT = { modules: Map<string, Record<string, unknown>>; seams: Mock[] }

const registry = globalThis as { seamRegistry?: SeamRegistryT }
const { modules, seams }: SeamRegistryT = (registry.seamRegistry ??= {
  modules: new Map(),
  seams: [],
})

export async function passThrough(
  importOriginal: () => Promise<Record<string, unknown>>,
  ...names: string[]
) {
  // Keyed on the export names alone: two modules seaming the same names would share one entry.
  const key = names.join()
  if (!modules.has(key)) {
    const actual = await importOriginal()
    const wrapped = names.map((name) => {
      const seam = vi.fn(actual[name] as (...args: unknown[]) => unknown)
      seams.push(seam)
      return [name, seam]
    })
    modules.set(key, { ...actual, ...Object.fromEntries(wrapped) })
  }
  return modules.get(key)!
}

export function resetSeams() {
  for (const seam of seams) seam.mockReset()
}
