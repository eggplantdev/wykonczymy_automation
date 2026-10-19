import { useState } from 'react'

export function useActiveFilter<TItem>(data: TItem[], predicate: (item: TItem) => boolean) {
  const [showOnlyActive, setShowOnlyActive] = useState(true)

  const filteredData = showOnlyActive ? data.filter(predicate) : data

  return { filteredData, showOnlyActive, setShowOnlyActive } as const
}
