'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Shared localStorage-backed enum store for the kosztorys column-preference hooks (layer, money axis,
// progress display, price view). Each was a hand-rolled copy of the same useSyncExternalStore + Set of
// listeners; this is the one primitive they now delegate to.
//
// One module-level listener set fans a write out to every mounted usePersistedEnum. A write notifies
// all subscribers regardless of key, but useSyncExternalStore drops the re-render for any hook whose
// own snapshot string is unchanged — so a cross-key notification is a no-op, not a behavior change.
// Own subscription (not a `storage` event) because that event doesn't fire in the same tab. The
// snapshot is a stable string, so server and first client render agree → no hydration mismatch. No
// in-memory fallback: if localStorage is unavailable (SSR/private mode) the write is skipped and reads
// revert to `fallback`, so the selection won't survive there.
const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function readEnum<T extends string>(storageKey: string, validValues: readonly T[], fallback: T): T {
  try {
    const stored = window.localStorage.getItem(storageKey)
    return stored != null && (validValues as readonly string[]).includes(stored)
      ? (stored as T)
      : fallback
  } catch {
    return fallback
  }
}

function writeEnum(storageKey: string, value: string) {
  try {
    window.localStorage.setItem(storageKey, value)
  } catch {
    // no localStorage — persistence skipped (see the store note above)
  }
  for (const listener of listeners) listener()
}

// The key can be per-investment (price view), so getSnapshot/setter close over it and must keep a
// stable identity across renders for useSyncExternalStore — hence the useCallbacks keyed on the args.
export function usePersistedEnum<T extends string>(
  storageKey: string,
  validValues: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const getSnapshot = useCallback(
    () => readEnum(storageKey, validValues, fallback),
    [storageKey, validValues, fallback],
  )
  const value = useSyncExternalStore(subscribe, getSnapshot, () => fallback)
  const setValue = useCallback((next: T) => writeEnum(storageKey, next), [storageKey])
  return [value, setValue]
}
