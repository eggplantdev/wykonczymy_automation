import { escapeHtml } from '@/lib/utils/escape-html'

export const section = <TEntryT>(
  title: string,
  entries: readonly TEntryT[],
  tag: 'table' | 'ul',
  row: (entry: TEntryT) => string,
): string =>
  entries.length === 0
    ? ''
    : `
    <h3>${escapeHtml(title)}</h3>
    <${tag}>
      ${entries.map(row).join('\n      ')}
    </${tag}>`
