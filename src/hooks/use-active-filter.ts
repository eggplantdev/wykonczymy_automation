import { useMemo, useState } from 'react'

export function useActiveFilter<TItem>(
  data: readonly TItem[],
  predicate: (item: TItem) => boolean,
) {
  const [showOnlyActive, setShowOnlyActive] = useState(true)

  const filteredData = useMemo(
    () => (showOnlyActive ? data.filter(predicate) : data),
    [data, showOnlyActive, predicate],
  )

  return { filteredData, showOnlyActive, setShowOnlyActive } as const
}
