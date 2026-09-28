import {
  ArrowLeftRight,
  Building,
  Car,
  FileSpreadsheet,
  Inbox,
  LayoutTemplate,
  ListChecks,
  Trash2,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { UnreadStreamT } from '@/types/notifications'

export const SECTION_IDS = {
  transactions: 'transakcje',
} as const

export type NavLinkT = {
  href: string
  label: string
  icon: LucideIcon
  unreadStream?: UnreadStreamT
}

export const SECTION_LINKS: NavLinkT[] = [
  { href: '/', label: 'Transakcje', icon: ArrowLeftRight },
  { href: '/kasy', label: 'Kasy', icon: Wallet },
  { href: '/inwestycje', label: 'Inwestycje', icon: Building },
  { href: '/zgloszenia', label: 'Zgłoszenia', icon: Inbox, unreadStream: 'leads' },
]

export const MANAGEMENT_LINKS: NavLinkT[] = [
  { href: '/kosztorysy', label: 'Kosztorysy v1', icon: FileSpreadsheet },
  { href: '/katalog-prac', label: 'Katalog prac', icon: ListChecks },
  { href: '/szablony', label: 'Szablony kosztorysów', icon: LayoutTemplate },
  { href: '/flota', label: 'Flota', icon: Car, unreadStream: 'fleet' },
  { href: '/sprzet', label: 'Sprzęt', icon: Wrench, unreadStream: 'equipment' },
  { href: '/pracownicy', label: 'Pracownicy', icon: Users },
]

export const OWNER_LINKS: NavLinkT[] = [{ href: '/kosz', label: 'Kosz', icon: Trash2 }]
