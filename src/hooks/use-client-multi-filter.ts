import { useState } from 'react'

export function useClientMultiFilter<TItem>(
  data: TItem[],
  accessor: (item: TItem) => string,
  initialValues: string[] = [],
) {
  const [values, setValues] = useState<string[]>(initialValues)

  const filterSet = new Set(values)
  const filteredData =
    values.length === 0 ? data : data.filter((item) => filterSet.has(accessor(item)))

  return { filteredData, values, setValues } as const
}
