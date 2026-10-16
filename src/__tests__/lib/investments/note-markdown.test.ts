import { describe, expect, it } from 'vitest'

import { parseNoteMarkdown } from '@/lib/investments/note-markdown'

const plain = (text: string) => [{ text, isBold: false }]

describe('parseNoteMarkdown', () => {
  it('keeps a plain note as one paragraph, line by line', () => {
    expect(parseNoteMarkdown('Zakres prac: kuchnia\nłazienka')).toEqual([
      { kind: 'paragraph', lines: [plain('Zakres prac: kuchnia'), plain('łazienka')] },
    ])
  })

  it('splits paragraphs on an empty line', () => {
    expect(parseNoteMarkdown('pierwszy\n\n\ndrugi')).toEqual([
      { kind: 'paragraph', lines: [plain('pierwszy')] },
      { kind: 'paragraph', lines: [plain('drugi')] },
    ])
  })

  it('reads `#` and `##` lines as headings', () => {
    expect(parseNoteMarkdown('# Wycena AI\n## Do ustalenia z klientem')).toEqual([
      { kind: 'heading', content: plain('Wycena AI') },
      { kind: 'heading', content: plain('Do ustalenia z klientem') },
    ])
  })

  it('groups consecutive `- ` lines into one list, ended by a non-list line', () => {
    expect(parseNoteMarkdown('- podłogi\n- gładź\nreszta')).toEqual([
      { kind: 'list', items: [plain('podłogi'), plain('gładź')] },
      { kind: 'paragraph', lines: [plain('reszta')] },
    ])
  })

  it('marks `**…**` runs bold inside any block', () => {
    expect(parseNoteMarkdown('- **podłogi**: całe piętro ≈ +4,9 tys. zł')).toEqual([
      {
        kind: 'list',
        items: [
          [
            { text: 'podłogi', isBold: true },
            { text: ': całe piętro ≈ +4,9 tys. zł', isBold: false },
          ],
        ],
      },
    ])
  })

  it('leaves an unmatched `**` as literal text', () => {
    expect(parseNoteMarkdown('cena **do ustalenia')).toEqual([
      { kind: 'paragraph', lines: [plain('cena **do ustalenia')] },
    ])
  })

  it('does not treat a hyphen or hash without a following space as syntax', () => {
    expect(parseNoteMarkdown('-10% rabatu\n#207')).toEqual([
      { kind: 'paragraph', lines: [plain('-10% rabatu'), plain('#207')] },
    ])
  })

  it('returns no blocks for an empty or whitespace-only note', () => {
    expect(parseNoteMarkdown('  \n\n')).toEqual([])
  })
})
