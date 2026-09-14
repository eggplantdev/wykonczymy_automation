import { useDeferredValue, useMemo, useState } from 'react'
import { foldText } from '@/lib/utils/fold-text'

// Fold rather than lowercase, so an ASCII query reaches a Polish label (cmdk gets this via
// `foldFilter`).
export function foldHaystacks<TItem>(
  data: TItem[],
  getSearchableText: (item: TItem) => string,
): string[] {
  return data.map(getSearchableText).map(foldText)
}

// Split from the hook, and taking folded haystacks rather than folding per call, for two reasons:
// the matching is exercisable without a renderer, and the fold runs once per dataset instead of
// once per keystroke (`foldText` is a five-stage normalize + regex chain, and the biggest caller
// filters 5000 client-side rows that never change while the user types).
export function filterBySearch<TItem>(
  data: TItem[],
  haystacks: string[],
  searchTerm: string,
): TItem[] {
  const term = foldText(searchTerm.trim())
  if (!term) return data

  return data.filter((_, index) => haystacks[index].includes(term))
}

export function useSearchFilter<TItem>(data: TItem[], getSearchableText: (item: TItem) => string) {
  const [searchTerm, setSearchTerm] = useState('')
  // Matching is cheap; RENDERING the result is not — the katalog draws ~950 unvirtualized rows — so
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
