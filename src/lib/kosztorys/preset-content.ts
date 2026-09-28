import { isDeepStrictEqual } from 'node:util'
import type { SnapshotPayloadT, StoredSnapshotPayloadT } from './snapshot-format'

// The row ids come out because every „Otwórz" re-inserts the tree under freshly minted ones, and the
// mirror stores whatever ids the warsztat holds — compared as stored, a szablon nobody touched would
// always read as changed. An item keeps its sekcja by position instead. `settings` come out too:
// they are never applied on open (the warsztat keeps its own), so they are not the szablon's content.
function contentOf(payload: SnapshotPayloadT | StoredSnapshotPayloadT): unknown {
  const sectionPosition = new Map(payload.sections.map((section, index) => [section.id, index]))
  // Through JSON because the stored side went through jsonb, which drops `undefined` keys.
  return JSON.parse(
    JSON.stringify({
      schemaVersion: payload.schemaVersion,
      sections: payload.sections.map(({ id: _id, ...section }) => section),
      items: payload.items.map(({ id: _id, sectionId, ...item }) => ({
        ...item,
        section: sectionPosition.get(sectionId),
      })),
      stages: payload.stages,
      progress: payload.progress,
    }),
  )
}

export function isSamePresetContent(
  stored: StoredSnapshotPayloadT,
  next: SnapshotPayloadT,
): boolean {
  return isDeepStrictEqual(contentOf(stored), contentOf(next))
}
