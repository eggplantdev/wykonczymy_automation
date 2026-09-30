import { vi } from 'vitest'

// The `next/cache` stub's sibling, and the same lesson: 31 specs had hand-rolled this factory, each
// naming only the exports its own action happened to call, so ADDING an export to the real module
// broke the ones that didn't list it — the import came back `undefined` and `protectedAction`
// swallowed the TypeError into `{ success: false }`, which reads as a business-logic failure.
//
// Not aliased globally like `next/cache`, because `revalidate.test.ts` tests the real module.
// A spec opts in with `vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))`
// and, when it wants to assert, imports the spy from HERE rather than declaring its own.
export const revalidateCollections = vi.fn()
export const revalidateEntities = vi.fn()
export const revalidateNotificationRecipients = vi.fn()
