import type { NoteBlockT, NoteInlineT } from '@/lib/investments/types'

const HEADING = /^#{1,2} /
const LIST_ITEM = /^- /
// A capture group makes `split` keep the matched text: every odd index is a bold run, and an
// unmatched `**` never matches, so it stays in the plain text around it.
const BOLD = /\*\*(.+?)\*\*/

function parseInline(text: string): NoteInlineT[] {
  return text
    .split(BOLD)
    .map((part, index) => ({ text: part, isBold: index % 2 === 1 }))
    .filter((run) => run.text !== '')
}

export function parseNoteMarkdown(note: string): NoteBlockT[] {
  const blocks: NoteBlockT[] = []
  let isBlockOpen = false
  for (const rawLine of note.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      isBlockOpen = false
      continue
    }
    if (HEADING.test(line)) {
      blocks.push({ kind: 'heading', content: parseInline(line.replace(HEADING, '')) })
      isBlockOpen = false
      continue
    }
    const open = isBlockOpen ? blocks.at(-1) : undefined
    if (LIST_ITEM.test(line)) {
      const item = parseInline(line.replace(LIST_ITEM, ''))
      if (open?.kind === 'list') open.items.push(item)
      else blocks.push({ kind: 'list', items: [item] })
    } else if (open?.kind === 'paragraph') {
      open.lines.push(parseInline(line))
    } else {
      blocks.push({ kind: 'paragraph', lines: [parseInline(line)] })
    }
    isBlockOpen = true
  }
  return blocks
}
