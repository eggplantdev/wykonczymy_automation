import type { InvestmentStatusT } from '@/lib/constants/investment-status'

// Investments, szablony and kasy share it; the file trash keeps its own, shorter window.
export const ENTITY_TRASH_RETENTION_DAYS = 30

export const KOSZTORYS_IN_USE_WARNING =
  'Kosztorys tej inwestycji jest w użyciu — ma wpisany przedmiar lub ilości na etapach.'

export const INVESTMENT_DELETE_FAILED_MESSAGE = 'Nie udało się usunąć inwestycji'

// Owner ruling (2026-10-01): an investment in progress is never deleted, whatever its kosztorys holds.
export const UNDELETABLE_INVESTMENT_STATUS = 'active' satisfies InvestmentStatusT

export const isUndeletableStatus = (status: string | null | undefined): boolean =>
  status === UNDELETABLE_INVESTMENT_STATUS

export const ACTIVE_INVESTMENT_DELETE_MESSAGE =
  'Nie można usunąć aktywnej inwestycji. Najpierw zmień jej status.'

// Its status cannot be edited from the trash, so the way out is through Przywróć.
export const TRASHED_ACTIVE_INVESTMENT_DELETE_MESSAGE =
  'Nie można usunąć aktywnej inwestycji. Przywróć ją z Kosza, zmień jej status i dopiero wtedy usuń.'
