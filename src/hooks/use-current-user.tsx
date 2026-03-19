'use client'

import { createContext, use } from 'react'
import type { SessionUserT } from '@/types/auth'

const CurrentUserContext = createContext<SessionUserT | null>(null)

export function CurrentUserProvider({
  user,
  children,
}: {
  user: SessionUserT
  children: React.ReactNode
}) {
  return <CurrentUserContext value={user}>{children}</CurrentUserContext>
}

export function useCurrentUser(): SessionUserT {
  const user = use(CurrentUserContext)
  if (!user) throw new Error('useCurrentUser must be used within CurrentUserProvider')
  return user
}
