'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-value'
import { CREW_AXIS_DEFAULT, type CrewAxisT } from '@/lib/kosztorys/crew-axis'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'

// Persisted globally, like the other two axes: which crew's stawki someone reads is a property of the
// person, not of one kosztorys.
const STORAGE_KEY = 'table-columns:kosztorys-crew'
const VALID_CREW_AXES: readonly CrewAxisT[] = [...TOOL_PLANES, 'both', 'none']

export function useCrewAxis(): [CrewAxisT, (axis: CrewAxisT) => void] {
  return usePersistedEnum(STORAGE_KEY, VALID_CREW_AXES, CREW_AXIS_DEFAULT)
}
