import {
  ArrowLeftRight,
  Building,
  Car,
  ClipboardCheck,
  FileSpreadsheet,
  Inbox,
  LayoutTemplate,
  ListChecks,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { UnreadStreamT } from '@/types/notifications'

export const SECTION_IDS = {
  transactions: 'transakcje',
} as const

// One title per list page, read by its nav link, its heading and its `loading.tsx` — the loading
// title is swapped for the heading when the page lands, so two spellings would visibly flicker.
export const PAGE_TITLES = {
  transactions: 'Transakcje',
  registers: 'Kasy',
  investments: 'Inwestycje',
  leads: 'Zgłoszenia z formularzy',
  workerReports: 'Zgłoszenia wykonanych prac',
  sheets: 'Kosztorysy v1',
  workCatalog: 'Katalog prac',
  templates: 'Szablony kosztorysów',
  fleet: 'Flota',
  equipment: 'Sprzęt',
  employees: 'Pracownicy',
  trash: 'Kosz',
  reports: 'Raporty',
} as const

// Not in MANAGEMENT_LINKS: „Kosz" sits with the bottom actions, under „Admin".
export const TRASH_HREF = '/kosz'

export type NavLinkT = {
  href: string
  label: string
  icon: LucideIcon
  unreadStream?: UnreadStreamT
}

// The one route EMPLOYEE may open; every MANAGEMENT_LINKS route redirects that role back here.
export const SECTION_LINKS: NavLinkT[] = [
  { href: '/', label: PAGE_TITLES.transactions, icon: ArrowLeftRight },
]

export const MANAGEMENT_LINKS: NavLinkT[] = [
  { href: '/kasy', label: PAGE_TITLES.registers, icon: Wallet },
  { href: '/inwestycje', label: PAGE_TITLES.investments, icon: Building },
  { href: '/zgloszenia', label: PAGE_TITLES.leads, icon: Inbox, unreadStream: 'leads' },
  {
    href: '/zgloszenia-prac',
    label: PAGE_TITLES.workerReports,
    icon: ClipboardCheck,
    unreadStream: 'workerReports',
  },
  { href: '/kosztorysy', label: PAGE_TITLES.sheets, icon: FileSpreadsheet },
  { href: '/katalog-prac', label: PAGE_TITLES.workCatalog, icon: ListChecks },
  { href: '/szablony', label: PAGE_TITLES.templates, icon: LayoutTemplate },
  { href: '/flota', label: PAGE_TITLES.fleet, icon: Car, unreadStream: 'fleet' },
  { href: '/sprzet', label: PAGE_TITLES.equipment, icon: Wrench, unreadStream: 'equipment' },
  { href: '/pracownicy', label: PAGE_TITLES.employees, icon: Users },
]
