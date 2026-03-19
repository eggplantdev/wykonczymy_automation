import { ArrowLeftRight, Building, Wallet } from 'lucide-react'

export const SECTION_IDS = {
  cashRegisters: 'kasy',
  investments: 'inwestycje',
  transactions: 'transakcje',
} as const

export type SectionIdT = (typeof SECTION_IDS)[keyof typeof SECTION_IDS]

export const SECTION_LINKS = [
  { href: `/#${SECTION_IDS.transactions}`, label: 'Transakcje', icon: ArrowLeftRight },
  { href: `/#${SECTION_IDS.cashRegisters}`, label: 'Kasy', icon: Wallet },
  { href: `/#${SECTION_IDS.investments}`, label: 'Inwestycje', icon: Building },
] as const
