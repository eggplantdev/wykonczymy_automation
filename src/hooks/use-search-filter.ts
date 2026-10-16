import { useDeferredValue, useMemo, useState } from 'react'
import { foldText } from '@/lib/utils/fold-text'

export function foldHaystacks<TItem>(
  data: TItem[],
  getSearchableText: (item: TItem) => string,
): string[] {
  return data.map(getSearchableText).map(foldText)
}

export function filterBySearch<TItem>(
  data: TItem[],
  haystacks: string[],
  searchTerm: string,
): TItem[] {
  const term = foldText(searchTerm.trim())
  if (!term) return data

  return data.filter((_, index) => haystacks[index].includes(term))
}

export function useSearchFilter<TItem>(
  data: TItem[],
  getSearchableText: (item: TItem) => string,
  initialSearchTerm = '',
) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  // Matching is cheap; RENDERING the result is not — /katalog-prac draws its ~560 rows unvirtualized — so
  // without the deferral the whole re-render sits between the keypress and the character appearing,
  // and the field itself stutters.
  const deferredTerm = useDeferredValue(searchTerm)

  const haystacks = useMemo(() => foldHaystacks(data, getSearchableText), [data, getSearchableText])

  const filteredData = useMemo(
    () => filterBySearch(data, haystacks, deferredTerm),
    [data, haystacks, deferredTerm],
  )

  return { filteredData, searchTerm, setSearchTerm } as const
}
