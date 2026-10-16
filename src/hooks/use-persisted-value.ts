'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Own subscription (not a `storage` event) because that event doesn't fire in the same tab.
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

function writeStored(storageKey: string, value: string) {
  try {
    window.localStorage.setItem(storageKey, value)
  } catch {
    // no localStorage — persistence skipped
  }
  for (const listener of listeners) listener()
}

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
  const setValue = useCallback((next: T) => writeStored(storageKey, next), [storageKey])
  return [value, setValue]
}

function readNumber(
  storageKey: string,
  fallback: number,
  isValid: (value: number) => boolean,
): number {
  try {
    const stored = window.localStorage.getItem(storageKey)
    // `Number('')` is 0, so an empty entry must be refused before it is converted.
    if (!stored) return fallback
    const value = Number(stored)
    return isValid(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function usePersistedNumber(
  storageKey: string,
  fallback: number,
  isValid: (value: number) => boolean,
): [number, (next: number) => void] {
  const getSnapshot = useCallback(
    () => readNumber(storageKey, fallback, isValid),
    [storageKey, fallback, isValid],
  )
  const value = useSyncExternalStore(subscribe, getSnapshot, () => fallback)
  const setValue = useCallback(
    (next: number) => writeStored(storageKey, String(next)),
    [storageKey],
  )
  return [value, setValue]
}

export function usePersistedFlag(
  storageKey: string,
  words: readonly [string, string],
  fallback: boolean,
): [boolean, (next: boolean) => void] {
  const [whenTrue, whenFalse] = words
  const [state, setState] = usePersistedEnum(storageKey, words, fallback ? whenTrue : whenFalse)
  return [state === whenTrue, (next) => setState(next ? whenTrue : whenFalse)]
}
