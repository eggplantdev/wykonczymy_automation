'use client'

import { useSyncExternalStore } from 'react'
import { LAYER_DEFAULT, type LayerT } from '@/lib/kosztorys/layer'

// Active layer axis, persisted globally in localStorage — same reasoning as useMoneyAxis: it's a
// reading preference of the person, not of one kosztorys, so the key carries no investment id and
// sits in the `table-columns:` family. Own subscription because the storage event doesn't fire in the
// same tab; the snapshot is a stable string, so server and first client render agree (no hydration
// mismatch).

const STORAGE_KEY = 'table-columns:kosztorys-layer'
const VALID_LAYERS: readonly LayerT[] = ['work', 'progress', 'both', 'none']

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function readLayer(): LayerT {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored != null && (VALID_LAYERS as string[]).includes(stored)
      ? (stored as LayerT)
      : LAYER_DEFAULT
  } catch {
    return LAYER_DEFAULT
  }
}

function writeLayer(layer: LayerT) {
  try {
    window.localStorage.setItem(STORAGE_KEY, layer)
  } catch {
    // no localStorage (SSR/private mode) — persistence skipped; reads re-hit storage with no
    // in-memory fallback, so the selection reverts to the default and won't survive here
  }
  for (const l of listeners) l()
}

export function useLayer(): [LayerT, (layer: LayerT) => void] {
  const layer = useSyncExternalStore(subscribe, readLayer, () => LAYER_DEFAULT)

  return [layer, writeLayer]
}
