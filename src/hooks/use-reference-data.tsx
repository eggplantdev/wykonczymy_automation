'use client'

import { createContext, use } from 'react'
import { useCurrentUser } from '@/hooks/use-current-user'
import type { SessionUserT } from '@/types/auth'
import type { OrderSettingsT } from '@/types/order-settings'
import type { ReferenceDataBaseT, ReferenceDataT } from '@/types/reference-data'

type ReferenceDataPromisesT = {
  referenceData: Promise<ReferenceDataBaseT> | null
  orderSettings: Promise<OrderSettingsT> | null
}

const ReferenceDataContext = createContext<(ReferenceDataPromisesT & { user: SessionUserT }) | null>(
  null,
)

// Carries the shell's PENDING fetches: awaited in the layout, they would hold every page's own
// fetches behind them. `null` promises for a non-management session — the data is company-wide PII.
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
  if (!ctx?.referenceData) return null
  return { ...use(ctx.referenceData), currentUserId: ctx.user.id, currentUserRole: ctx.user.role }
}

export function useOrderSettings(): OrderSettingsT | null {
  const promise = use(ReferenceDataContext)?.orderSettings
  return promise ? use(promise) : null
}
