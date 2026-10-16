import { vi } from 'vitest'

// `unstable_cache` needs a request scope node lacks, and `updateTag` throws outside a server
// action, so every spec that touches cached code has to stub this module.
export const revalidateTag = vi.fn()
export const updateTag = vi.fn()
export const revalidatePath = vi.fn()
export const refresh = vi.fn()

export const unstable_cache = <FnT>(fn: FnT): FnT => fn
