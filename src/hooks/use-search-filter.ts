import { useMemo, useState } from 'react'

export function useSearchFilter<TItem>(
  data: readonly TItem[],
  getSearchableText: (item: TItem) => string,
) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return data

    return data.filter((item) => getSearchableText(item).toLowerCase().includes(term))
  }, [data, searchTerm, getSearchableText])

  return { filteredData, searchTerm, setSearchTerm } as const
}
