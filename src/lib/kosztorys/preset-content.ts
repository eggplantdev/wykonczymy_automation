import { isDeepStrictEqual } from 'node:util'
import type { SnapshotPayloadT, StoredSnapshotPayloadT } from './snapshot-format'

// The row ids come out because every „Otwórz" re-inserts the tree under freshly minted ones, and the
// mirror stores whatever ids the warsztat holds — compared as stored, a szablon nobody touched would
// always read as changed. An item keeps its sekcja by position instead. `settings` and
// `globalDiscount` come out too: neither is applied on open, so neither is the szablon's content.
// Stripped rather than picked, so a field added to the payload later is compared by default.
function contentOf(payload: SnapshotPayloadT | StoredSnapshotPayloadT): unknown {
  const { settings: _settings, globalDiscount: _globalDiscount, sections, items, ...rest } = payload
  const sectionPosition = new Map(sections.map((section, index) => [section.id, index]))
  // Through JSON because the stored side went through jsonb, which drops `undefined` keys.
  return JSON.parse(
    JSON.stringify({
      ...rest,
      sections: sections.map(({ id: _id, ...section }) => section),
      items: items.map(({ id: _id, sectionId, ...item }) => ({
        ...item,
        section: sectionPosition.get(sectionId),
      })),
    }),
  )
}

export function isSamePresetContent(
  stored: StoredSnapshotPayloadT,
  next: SnapshotPayloadT,
): boolean {
  return isDeepStrictEqual(contentOf(stored), contentOf(next))
}
