'use client'

import { useSyncExternalStore } from 'react'
import { MONEY_AXIS_DEFAULT, type MoneyAxisT } from '@/lib/kosztorys/money-axis'

// Active money axis, persisted globally in localStorage: it's a reading preference of the person, not
// of one kosztorys, so unlike usePriceView the key carries no investment id. Filed under the
// `table-columns:` family because it answers "which columns do I want" — clearing the picker's memory
// should clear this too. The snapshot is a string (stable equality → no render loop), server and first
// client render agree → zero hydration mismatch, and the subscription is our own because the storage
// event doesn't fire in the same tab.

const STORAGE_KEY = 'table-columns:kosztorys-axis'
const VALID_AXES: readonly MoneyAxisT[] = ['net', 'gross', 'both', 'none']

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function readAxis(): MoneyAxisT {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored != null && (VALID_AXES as string[]).includes(stored)
      ? (stored as MoneyAxisT)
      : MONEY_AXIS_DEFAULT
  } catch {
    return MONEY_AXIS_DEFAULT
  }
}

function writeAxis(axis: MoneyAxisT) {
  try {
    window.localStorage.setItem(STORAGE_KEY, axis)
  } catch {
    // no localStorage (SSR/private mode) — persistence skipped; since reads re-hit storage with
    // no in-memory fallback, the selection reverts to the default and won't survive here
  }
  for (const l of listeners) l()
}

export function useMoneyAxis(): [MoneyAxisT, (axis: MoneyAxisT) => void] {
  const axis = useSyncExternalStore(subscribe, readAxis, () => MONEY_AXIS_DEFAULT)

  return [axis, writeAxis]
}
