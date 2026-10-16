import { vi } from 'vitest'

// Not aliased globally like `next/cache`, because `revalidate.test.ts` tests the real module.
export const revalidateCollections = vi.fn()
export const revalidateEntities = vi.fn()
export const revalidateNotificationRecipients = vi.fn()
