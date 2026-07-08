import { ArrowLeftRight, Building, Inbox, Wallet, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { UnreadLeadsBadge } from '@/components/nav/unread-leads-badge'

export const SECTION_IDS = {
  transactions: 'transakcje',
} as const

type SectionLinkT = {
  href: string
  label: string
  icon: LucideIcon
  // Optional notification bubble rendered after the label; self-gates on role/count.
  badge?: ComponentType
}

export const SECTION_LINKS: SectionLinkT[] = [
  { href: '/', label: 'Transakcje', icon: ArrowLeftRight },
  { href: '/kasy', label: 'Kasy', icon: Wallet },
  { href: '/inwestycje', label: 'Inwestycje', icon: Building },
  { href: '/zgloszenia', label: 'Zgłoszenia', icon: Inbox, badge: UnreadLeadsBadge },
]
