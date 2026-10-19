import { serverSort } from '@/lib/table/server-sort'

export const DEFAULT_LEAD_SORT = '-submittedAt'

export const leadSort = serverSort(
  ['id', 'source', 'name', 'email', 'phone', 'formName', 'submittedAt', 'contactStatus'],
  DEFAULT_LEAD_SORT,
)
