'use client'

import { createContext, use, useMemo } from 'react'
import { useCurrentUser } from '@/hooks/use-current-user'
import type { SessionUserT } from '@/types/auth'
import type { OrderSettingsT } from '@/types/order-settings'
import type { ReferenceDataBaseT, ReferenceDataT } from '@/types/reference-data'

type ReferenceDataPromisesT = {
  referenceData: Promise<ReferenceDataBaseT> | null
  orderSettings: Promise<OrderSettingsT> | null
}

const ReferenceDataContext = createContext<
  (ReferenceDataPromisesT & { user: SessionUserT }) | null
>(null)

// Carries the shell's PENDING fetches: awaited in the layout, they would hold every page's own
// fetches behind them.
export function ReferenceDataProvider({
  referenceData,
  orderSettings,
  children,
}: ReferenceDataPromisesT & { children: React.ReactNode }) {
  const user = useCurrentUser()
  return (
    <ReferenceDataContext value={{ referenceData, orderSettings, user }}>
      {children}
    </ReferenceDataContext>
  )
}

// `null` outside the provider too: the kosztorys body and the transfer table also render on the
// share routes and for an EMPLOYEE.
export function useReferenceData(): ReferenceDataT | null {
  const ctx = use(ReferenceDataContext)
  const base = ctx?.referenceData ? use(ctx.referenceData) : null
  const user = ctx?.user
  // The compiler skips a function that calls only `use`; without this memo `getTransferColumns`
  // rebuilds every column on each render of the table.
  return useMemo(
    () => (base && user ? { ...base, currentUserId: user.id, currentUserRole: user.role } : null),
    [base, user],
  )
}

export function useOrderSettings(): OrderSettingsT | null {
  const promise = use(ReferenceDataContext)?.orderSettings
  return promise ? use(promise) : null
}
