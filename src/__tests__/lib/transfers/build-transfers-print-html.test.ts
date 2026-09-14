import { describe, it, expect } from 'vitest'
import {
  buildTransfersPrintHtml,
  type PrintColumnT,
} from '@/lib/transfers/build-transfers-print-html'
import { transferRow } from '@/__tests__/fixtures/transfer-row'

const idColumn: PrintColumnT = { id: 'id', label: 'ID', getValue: (row) => `#${row.id}` }
const descriptionColumn: PrintColumnT = {
  id: 'description',
  label: 'Opis',
  getValue: (row) => row.description,
}

describe('buildTransfersPrintHtml', () => {
  it('opens a standalone document', () => {
    const html = buildTransfersPrintHtml([], [idColumn], 'Transakcje')
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<title>Transakcje</title>')
  })

  it('emits headers in the order the columns were given', () => {
    const html = buildTransfersPrintHtml([], [descriptionColumn, idColumn], 'Transakcje')
    expect(html.indexOf('<th>Opis</th>')).toBeLessThan(html.indexOf('<th>ID</th>'))
  })

  it('escapes free text that would otherwise open a tag', () => {
    const html = buildTransfersPrintHtml(
      [transferRow({ description: '<script>a & b</script>' })],
      [descriptionColumn],
      'Transakcje',
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;a &amp; b&lt;/script&gt;')
  })

  it('escapes the title too', () => {
    const html = buildTransfersPrintHtml([], [idColumn], 'Transakcje <b>')
    expect(html).toContain('<title>Transakcje &lt;b&gt;</title>')
  })

  it('renders head-only when there are no rows', () => {
    const html = buildTransfersPrintHtml([], [idColumn], 'Transakcje')
    expect(html).toContain('<th>ID</th>')
    expect(html).toContain('<tbody></tbody>')
  })

  it('renders one cell per column per row', () => {
    const html = buildTransfersPrintHtml(
      [transferRow({ id: 7, description: 'x' }), transferRow({ id: 8, description: 'y' })],
      [idColumn, descriptionColumn],
      'Transakcje',
    )
    expect(html).toContain('<tr><td>#7</td><td>x</td></tr><tr><td>#8</td><td>y</td></tr>')
  })
})
