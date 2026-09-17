import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useHiddenColumns } from '@/components/kosztorys/editor/hooks/use-hidden-columns'
import { DEFAULT_HIDDEN_COLUMNS } from '@/lib/kosztorys/column-config'
import {
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
} from '@/lib/kosztorys/stage-keys'

const STORAGE_KEY = 'table-columns:kosztorys'
// The picker answers per GROUP, never per stage id — one tick governs the axis across every etap.
const NET = STAGE_VALUE_NET_COLUMN_GROUP
const GROSS = STAGE_VALUE_GROSS_COLUMN_GROUP

function remount() {
  return renderHook(() => useHiddenColumns())
}

function stored() {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, boolean>
}

beforeEach(() => window.localStorage.clear())

describe('useHiddenColumns — a fresh profile', () => {
  it('hides the brutto axis of a stage and shows its netto twin', () => {
    const { result } = remount()

    expect(result.current.isHidden(GROSS)).toBe(true)
    expect(result.current.isHidden(NET)).toBe(false)
  })

  // The sparse map is the whole design: nothing is written until someone picks, so a default can
  // still be changed in code afterwards instead of being frozen into everyone's localStorage.
  it('writes nothing until a column is picked', () => {
    const { result } = remount()
    result.current.isHidden(GROSS)

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('useHiddenColumns — the pick survives a reload', () => {
  it('keeps a default-hidden column shown once it is ticked', () => {
    const { result } = remount()

    act(() => result.current.toggleColumn(GROSS))
    expect(result.current.isHidden(GROSS)).toBe(false)
    // An explicit false, not a deleted key: deleting would fall back to the default, i.e. undo the
    // very tick that asked for the column.
    expect(stored()[GROSS]).toBe(false)

    expect(remount().result.current.isHidden(GROSS)).toBe(false)
  })

  it('keeps a default-shown column hidden once it is unticked', () => {
    const { result } = remount()

    act(() => result.current.toggleColumn(NET))
    expect(result.current.isHidden(NET)).toBe(true)

    expect(remount().result.current.isHidden(NET)).toBe(true)
  })

  it('takes a whole picker’s worth of columns in one write', () => {
    const { result } = remount()

    act(() => result.current.setAllColumns([NET, GROSS], true))

    const reloaded = remount().result.current
    expect(reloaded.isHidden(NET)).toBe(true)
    expect(reloaded.isHidden(GROSS)).toBe(true)
  })
})

describe('useHiddenColumns — a corrupt stored value', () => {
  it('falls back to the declared defaults instead of blanking the grid', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not json')

    const { result } = remount()

    expect(result.current.isHidden(GROSS)).toBe(DEFAULT_HIDDEN_COLUMNS.has(GROSS))
    expect(result.current.isHidden(NET)).toBe(false)
  })
})
