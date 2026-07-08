import { type VisibilityState } from '@tanstack/react-table'

const STORAGE_PREFIX = 'table-columns:'

export function readVisibility(key: string): VisibilityState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    return raw ? (JSON.parse(raw) as VisibilityState) : {}
  } catch {
    return {}
  }
}

export function writeVisibility(key: string, state: VisibilityState) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state))
  } catch {
    // localStorage full or unavailable
  }
}
