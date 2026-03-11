import { useMemo, useState } from 'react'
import { FILTER_NONE } from '@/components/transfers/filter-multi-select'

export function useClientMultiFilter<TItem>(
  data: readonly TItem[],
  accessor: (item: TItem) => string,
) {
  const [values, setValues] = useState<string[]>([])

  const filteredData = useMemo(() => {
    const hasNone = values.length === 1 && values[0] === FILTER_NONE
    if (hasNone) return []
    if (values.length === 0) return data
    const filterSet = new Set(values)
    return data.filter((item) => filterSet.has(accessor(item)))
  }, [data, values, accessor])

  return { filteredData, values, setValues } as const
}
