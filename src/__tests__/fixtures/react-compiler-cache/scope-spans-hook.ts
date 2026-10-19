import { useState } from 'react'

export function useScopeSpansHook(rows: number[]) {
  const spansHook = rows.map((row) => row * 2)
  const [count] = useState(0)
  spansHook.push(count)
  const cached = rows.filter(Boolean)
  const keyedOnFresh = spansHook.filter(Boolean)
  return { spansHook, cached, keyedOnFresh }
}
