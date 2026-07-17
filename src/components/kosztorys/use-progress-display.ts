'use client'

import { useSyncExternalStore } from 'react'
import { PROGRESS_DISPLAY_DEFAULT, type ProgressDisplayT } from '@/lib/kosztorys/progress-display'

// Active progress display, persisted globally in localStorage — same reasoning as useMoneyAxis
// (a reading preference of the person, not of one kosztorys, filed under the `table-columns:` family
// because it answers "which columns do I want"). See use-money-axis.ts for why the store is
// hand-rolled rather than a storage-event subscription.

const STORAGE_KEY = 'table-columns:kosztorys-progress-display'
const VALID_DISPLAYS: readonly ProgressDisplayT[] = ['values', 'percent', 'both', 'none']

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function readDisplay(): ProgressDisplayT {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored != null && (VALID_DISPLAYS as string[]).includes(stored)
      ? (stored as ProgressDisplayT)
      : PROGRESS_DISPLAY_DEFAULT
  } catch {
    return PROGRESS_DISPLAY_DEFAULT
  }
}

function writeDisplay(display: ProgressDisplayT) {
  try {
    window.localStorage.setItem(STORAGE_KEY, display)
  } catch {
    // no localStorage (SSR/private mode) — persistence skipped; the selection reverts to the default
  }
  for (const listener of listeners) listener()
}

export function useProgressDisplay(): [ProgressDisplayT, (display: ProgressDisplayT) => void] {
  const display = useSyncExternalStore(subscribe, readDisplay, () => PROGRESS_DISPLAY_DEFAULT)

  return [display, writeDisplay]
}
