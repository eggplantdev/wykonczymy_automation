import type { ContractClauseFieldT } from '@/lib/investments/contract/types'

export const CONTRACTOR = {
  name: 'Wykończymy sp. z o.o.',
  seat: 'Warszawie',
  address: 'ul. Żubrowa 2, 01-978 Warszawa',
  nip: '1182271075',
  krs: '0001062152',
  court:
    'Sądzie Rejonowym dla m.st. Warszawy w Warszawie, XII Wydział Gospodarczy Krajowego Rejestru Sądowego',
  representative: 'Bartosza Antonika – Członka Zarządu',
  bankAccount: '68 1140 2004 0000 3002 8445 4840',
} as const

export const DEFAULT_SUPERVISORS = 'Bartosz Antonik, Yuri Abramenko'

export const DEFAULT_PLACE = 'Warszawie'

export const CONTRACT_CLAUSE_FIELDS: readonly ContractClauseFieldT[] = [
  'siteAddress',
  'startWindow',
  'duration',
  'supervisors',
  'plannedNet',
]
