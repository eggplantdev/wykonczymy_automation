import { useMemo, useState } from 'react'

export function useClientMultiFilter<TItem>(
  data: TItem[],
  accessor: (item: TItem) => string,
  initialValues: string[] = [],
) {
  const [values, setValues] = useState<string[]>(initialValues)

  const filteredData = useMemo(() => {
    if (values.length === 0) return data
    const filterSet = new Set(values)
    return data.filter((item) => filterSet.has(accessor(item)))
  }, [data, values, accessor])

  return { filteredData, values, setValues } as const
}
