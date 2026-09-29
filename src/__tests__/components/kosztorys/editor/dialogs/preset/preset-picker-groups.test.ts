import { describe, expect, it } from 'vitest'
import {
  groupPresetSections,
  isGroupFullySelected,
} from '@/components/kosztorys/editor/dialogs/preset/preset-picker-groups'
import type { PresetSectionMetaT } from '@/lib/db/presets'

const meta = (
  presetId: number,
  sectionId: number,
  presetName = `szablon-${presetId}`,
): PresetSectionMetaT => ({
  presetId,
  presetName,
  sectionId,
  sectionName: `sekcja-${sectionId}`,
  itemCount: 3,
})

describe('groupPresetSections', () => {
  it('returns no groups for no metas', () => {
    expect(groupPresetSections([], new Set())).toEqual([])
  })

  it('collapses consecutive metas of one preset and keeps source order', () => {
    const groups = groupPresetSections(
      [meta(2, 10), meta(2, 11), meta(1, 20), meta(1, 21), meta(1, 22)],
      new Set(),
    )

    expect(groups.map((group) => group.presetId)).toEqual([2, 1])
    expect(groups[0].metas.map((item) => item.sectionId)).toEqual([10, 11])
    expect(groups[1].metas.map((item) => item.sectionId)).toEqual([20, 21, 22])
  })

  it('takes the group name from its metas', () => {
    const groups = groupPresetSections([meta(1, 10, 'Białostocka bazowy')], new Set())

    expect(groups[0].presetName).toBe('Białostocka bazowy')
  })

  // The precondition the picker's React keys rest on: `listPresetSections` returns one preset's
  // metas consecutively. Fed interleaved, grouping splits them — two groups with one presetId.
  it('splits a preset whose metas arrive non-consecutively', () => {
    const groups = groupPresetSections([meta(1, 10), meta(2, 20), meta(1, 11)], new Set())

    expect(groups.map((group) => group.presetId)).toEqual([1, 2, 1])
  })

  it('counts selections per group', () => {
    const metas = [meta(1, 10), meta(1, 11), meta(2, 20), meta(2, 21), meta(2, 22)]
    const selected = new Set([10, 20, 22])

    const groups = groupPresetSections(metas, selected)

    expect(groups[0].selectedCount).toBe(1)
    expect(groups[1].selectedCount).toBe(2)
  })

  it('ignores a selected section that is not listed', () => {
    const groups = groupPresetSections([meta(1, 10)], new Set([999]))

    expect(groups[0].selectedCount).toBe(0)
  })
})

describe('isGroupFullySelected', () => {
  // The picker derives this above its own loading/empty guard, so it runs on renders where there is
  // no active group at all — while the szablon list is still fetching, and when the library is empty.
  // Reading `.metas` there crashed the dialog on every open.
  it('is false when there is no active group', () => {
    expect(isGroupFullySelected(undefined)).toBe(false)
  })

  it('is true only once every sekcja of the group is selected', () => {
    const metas = [meta(1, 10), meta(1, 11)]

    expect(isGroupFullySelected(groupPresetSections(metas, new Set([10]))[0])).toBe(false)
    expect(isGroupFullySelected(groupPresetSections(metas, new Set([10, 11]))[0])).toBe(true)
  })
})
