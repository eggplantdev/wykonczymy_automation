export type NoteInlineT = { text: string; isBold: boolean }

export type NoteBlockT =
  | { kind: 'heading'; content: NoteInlineT[] }
  | { kind: 'list'; items: NoteInlineT[][] }
  | { kind: 'paragraph'; lines: NoteInlineT[][] }
