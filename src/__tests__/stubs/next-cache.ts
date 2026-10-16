import { vi } from 'vitest'

// `unstable_cache` needs a request scope node lacks, and `updateTag` throws outside a server
// action, so every spec that touches cached code has to stub this module. Aliased globally in
// vitest.config.ts rather than re-mocked per spec: five hand-rolled variants of this factory had
// already drifted apart across 28 files (EX-630).
//
// The tag helpers are spies so a spec can assert on them — import them from here, not from
// 'next/cache', and clear them in beforeEach (the module is a singleton per spec file).
export const revalidateTag = vi.fn()
export const updateTag = vi.fn()
export const revalidatePath = vi.fn()
export const refresh = vi.fn()

export const unstable_cache = <FnT>(fn: FnT): FnT => fn
