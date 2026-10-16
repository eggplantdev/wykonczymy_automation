import {
  ArrowLeftRight,
  Building,
  Car,
  FileSpreadsheet,
  FileUser,
  HandCoins,
  Inbox,
  LayoutTemplate,
  ListChecks,
  ReceiptText,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { UnreadStreamT } from '@/types/notifications'

export const SECTION_IDS = {
  transactions: 'transakcje',
} as const

export const PAGE_TITLES = {
  transactions: 'Transakcje',
  registers: 'Kasy',
  investments: 'Inwestycje',
  leads: 'Zapytania z formularzy',
  workerReports: 'Zgłoszenia prac',
  expenseDrafts: 'Zgłoszenia wydatków',
  sheets: 'Kosztorysy v1',
  workCatalog: 'Katalog prac',
  templates: 'Szablony kosztorysów',
  fleet: 'Flota',
  equipment: 'Sprzęt',
  employees: 'Pracownicy',
  payouts: 'Wypłaty',
  trash: 'Kosz',
} as const

export const TRASH_HREF = '/kosz'

export type NavLinkT = {
  href: string
  label: string
  icon: LucideIcon
  unreadStream?: UnreadStreamT
}

export const NAV_LINKS: NavLinkT[] = [
  { href: '/', label: PAGE_TITLES.transactions, icon: ArrowLeftRight },
  { href: '/kasy', label: PAGE_TITLES.registers, icon: Wallet },
  { href: '/inwestycje', label: PAGE_TITLES.investments, icon: Building },
  { href: '/kosztorysy', label: PAGE_TITLES.sheets, icon: FileSpreadsheet },
  { href: '/katalog-prac', label: PAGE_TITLES.workCatalog, icon: ListChecks },
  { href: '/szablony', label: PAGE_TITLES.templates, icon: LayoutTemplate },
  { href: '/flota', label: PAGE_TITLES.fleet, icon: Car, unreadStream: 'fleet' },
  { href: '/sprzet', label: PAGE_TITLES.equipment, icon: Wrench, unreadStream: 'equipment' },
  { href: '/pracownicy', label: PAGE_TITLES.employees, icon: Users },
  {
    href: '/wyplaty',
    label: PAGE_TITLES.payouts,
    icon: HandCoins,
    unreadStream: 'rejectedPayouts',
  },
  {
    href: '/zgloszenia-prac',
    label: PAGE_TITLES.workerReports,
    icon: FileUser,
    unreadStream: 'workerReports',
  },
  {
    href: '/zgloszenia-wydatkow',
    label: PAGE_TITLES.expenseDrafts,
    icon: ReceiptText,
    unreadStream: 'expenseDrafts',
  },
  { href: '/zgloszenia', label: PAGE_TITLES.leads, icon: Inbox, unreadStream: 'leads' },
]
