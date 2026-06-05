import { ArrowLeftRight, Building, Wallet } from 'lucide-react'

export const SECTION_IDS = {
  transactions: 'transakcje',
} as const

export type SectionIdT = (typeof SECTION_IDS)[keyof typeof SECTION_IDS]

export const SECTION_LINKS = [
  { href: '/', label: 'Transakcje', icon: ArrowLeftRight },
  { href: '/kasy', label: 'Kasy', icon: Wallet },
  { href: '/inwestycje', label: 'Inwestycje', icon: Building },
] as const
