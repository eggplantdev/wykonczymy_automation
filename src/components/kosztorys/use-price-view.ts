'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { PriceViewT } from '@/lib/kosztorys/calc'

// Active price view, persisted per investment in localStorage so the editor reopens on the
// last-used view for that kosztorys. Same shape as useColumnWidths: useSyncExternalStore returns a
// string (stable equality → no render loop), server and first client render yield the same snapshot
// → zero hydration mismatch, own subscription (the storage event doesn't fire in the same tab).
// Unlike useColumnWidths the key is per-investment, so getSnapshot closes over investmentId and must
// keep stable identity across renders — hence useCallback keyed on it.

const DEFAULT_VIEW: PriceViewT = 'client'
const VALID_VIEWS: readonly PriceViewT[] = ['client', 'w_tools', 'own_tools']

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function storageKey(investmentId: number): string {
  return `kosztorys-view:${investmentId}`
}

function readView(investmentId: number): PriceViewT {
  try {
    const stored = window.localStorage.getItem(storageKey(investmentId))
    return stored != null && (VALID_VIEWS as string[]).includes(stored)
      ? (stored as PriceViewT)
      : DEFAULT_VIEW
  } catch {
    return DEFAULT_VIEW
  }
}

function writeView(investmentId: number, view: PriceViewT) {
  try {
    window.localStorage.setItem(storageKey(investmentId), view)
  } catch {
    // no localStorage (SSR/private mode) — persistence skipped; since reads re-hit storage with
    // no in-memory fallback, the selection reverts to the default and won't survive here
  }
  for (const l of listeners) l()
}

export function usePriceView(investmentId: number): [PriceViewT, (view: PriceViewT) => void] {
  const getSnapshot = useCallback(() => readView(investmentId), [investmentId])
  const view = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_VIEW)

  const setView = useCallback((next: PriceViewT) => writeView(investmentId, next), [investmentId])

  return [view, setView]
}
