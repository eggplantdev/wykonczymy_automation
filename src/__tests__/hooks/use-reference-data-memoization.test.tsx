import { Suspense } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { CurrentUserProvider } from '@/hooks/use-current-user'
import { ReferenceDataProvider, useReferenceData } from '@/hooks/use-reference-data'
import { orderSettingsFixture, referenceDataFor } from '@/__tests__/fixtures/reference-data'
import type { SessionUserT } from '@/types/auth'

const USER = { id: 3, role: 'OWNER' } as SessionUserT
const referenceData = Promise.resolve(referenceDataFor('OWNER'))
const orderSettings = Promise.resolve(orderSettingsFixture)

// `TransferDataTable` builds its columns from this object; a fresh one per render rebuilds every column.
describe('useReferenceData', () => {
  it('keeps its identity across renders', async () => {
    const { result, rerender } = await act(() =>
      renderHook(() => useReferenceData(), {
        wrapper: ({ children }) => (
          <CurrentUserProvider user={USER}>
            <ReferenceDataProvider referenceData={referenceData} orderSettings={orderSettings}>
              <Suspense>{children}</Suspense>
            </ReferenceDataProvider>
          </CurrentUserProvider>
        ),
      }),
    )
    const first = result.current

    rerender()

    expect(result.current).toBe(first)
    expect(first).toMatchObject({ currentUserId: 3, currentUserRole: 'OWNER' })
  })
})
