export const SECTION_IDS = {
  cashRegisters: 'kasy',
  employees: 'pracownicy',
  investments: 'inwestycje',
  transactions: 'transakcje',
} as const

export type SectionIdT = (typeof SECTION_IDS)[keyof typeof SECTION_IDS]

export const SECTION_LINKS = [
  { href: `/#${SECTION_IDS.cashRegisters}`, label: 'Kasy' },
  { href: `/#${SECTION_IDS.employees}`, label: 'Pracownicy' },
  { href: `/#${SECTION_IDS.investments}`, label: 'Inwestycje' },
  { href: `/#${SECTION_IDS.transactions}`, label: 'Transakcje' },
] as const
