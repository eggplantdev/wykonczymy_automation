import { describe, it, expect } from 'vitest'
import { compareTelmak, type TelmakAppRowT } from '@/lib/telmak/compare-telmak'
import type { TelmakDocT } from '@/lib/telmak/parse-telmak'

const REGISTER = 11
const FROM = '2026-09-01'
const TO = '2026-09-30'
const PDF = {
  id: 1,
  url: 'https://blob.test/wv.pdf',
  filename: 'wv.pdf',
  mimeType: 'application/pdf',
}

let nextId = 1000

const doc = (over: Partial<TelmakDocT> = {}): TelmakDocT => ({
  fileName: 'wv.pdf',
  kind: 'WV',
  number: 'WV 4-00123/PRG/09/2026',
  date: '2026-09-02',
  amount: 100,
  remark: null,
  problems: [],
  ...over,
})

const row = (over: Partial<TelmakAppRowT> = {}): TelmakAppRowT => ({
  id: nextId++,
  amount: 100,
  description: 'Telmak Kędzierski 02.09.2026',
  invoiceNote: 'WV 4-00123/PRG/09/2026\nFarba biała 10 l',
  cancelled: false,
  registerId: REGISTER,
  registerName: 'Telmak',
  investmentName: 'Testowa 1',
  invoices: [PDF],
  ...over,
})

const compare = (docs: TelmakDocT[], rows: TelmakAppRowT[]) =>
  compareTelmak(docs, rows, REGISTER, FROM, TO)

const only = (docs: TelmakDocT[], rows: TelmakAppRowT[]) => {
  const { results } = compare(docs, rows)
  expect(results).toHaveLength(1)
  return results[0]
}

describe('compareTelmak — one status per case', () => {
  it('ok: same number, amount, issue date, register, with a PDF', () => {
    expect(only([doc()], [row()]).status).toBe('ok')
  })

  it('matches the note’s first line regardless of spacing and case', () => {
    expect(only([doc()], [row({ invoiceNote: '\n  wv4-00123/prg/09/2026 \nreszta' })]).status).toBe(
      'ok',
    )
  })

  it('unreadable: a document with parse problems is never matched', () => {
    const result = only([doc({ problems: ['nie znaleziono daty wystawienia'] })], [])
    expect(result).toMatchObject({
      status: 'unreadable',
      issues: ['nie znaleziono daty wystawienia'],
    })
  })

  it('unreadable: a read number still claims its bookings, so they are not also app-only', () => {
    const r = row()
    const result = only([doc({ amount: null, problems: ['nie odczytano kwoty słownie'] })], [r])
    expect(result).toMatchObject({ status: 'unreadable', rows: [r] })
  })

  it('missing-in-app: no row carries the number', () => {
    expect(only([doc()], []).status).toBe('missing-in-app')
  })

  it('cancelled: the only booking is cancelled', () => {
    expect(only([doc()], [row({ cancelled: true })]).status).toBe('cancelled')
  })

  it('amount: booked total differs', () => {
    const result = only([doc({ amount: 2094 })], [row({ amount: 2034 })])
    expect(result.status).toBe('amount')
    expect(result.issues[0]).toMatch(/^kwota: faktura 2\s?094,00\szł, aplikacja 2\s?034,00\szł$/)
  })

  it('date: the description carries another issue date', () => {
    const r = row({ description: 'Telmak Kędzierski 03.09.2026' })
    const result = only([doc()], [r])
    expect(result).toMatchObject({
      status: 'date',
      issues: [`data w opisie ≠ 2026-09-02 (#${r.id})`],
    })
  })

  it('other-register: booked in another register', () => {
    const r = row({ registerId: 42, registerName: 'Farby Dulux Telmak' })
    expect(only([doc()], [r])).toMatchObject({
      status: 'other-register',
      issues: [`w innej kasie: #${r.id} Farby Dulux Telmak`],
    })
  })

  it('no-file: booked without a PDF', () => {
    const r = row({ invoices: [] })
    expect(only([doc()], [r])).toMatchObject({ status: 'no-file', issues: [`bez PDF: #${r.id}`] })
  })

  it('app-only: a register row in range whose number is not in the package', () => {
    const result = only([], [row({ invoiceNote: 'WV 4-00999/PRG/09/2026' })])
    expect(result).toMatchObject({
      status: 'app-only',
      doc: null,
      issues: ['brak dokumentu w paczce'],
    })
  })

  it('app-only: a register row in range without a number in its note', () => {
    expect(only([], [row({ invoiceNote: '' })])).toMatchObject({
      status: 'app-only',
      issues: ['brak numeru dokumentu w notatce'],
    })
  })
})

describe('compareTelmak — matching rules', () => {
  it('sums split bookings of one document', () => {
    const result = only([doc({ amount: 100 })], [row({ amount: 60 }), row({ amount: 40 })])
    expect(result.status).toBe('ok')
    expect(result.rows).toHaveLength(2)
  })

  it('ignores a cancelled booking next to a live one', () => {
    expect(only([doc()], [row({ cancelled: true }), row()]).status).toBe('ok')
  })

  it('matches a KWV against a negative CORRECTION', () => {
    const kwv = doc({ kind: 'KWV', number: 'KWV161/PRG/2026', amount: -50 })
    const correction = row({ amount: -50, invoiceNote: 'KWV161/PRG/2026' })
    expect(only([kwv], [correction]).status).toBe('ok')
  })

  it('flags a document booked with the opposite sign', () => {
    expect(only([doc()], [row({ amount: -100 })]).status).toBe('amount')
  })

  it('reports the first failing check as the status and keeps every issue', () => {
    const result = only([doc()], [row({ amount: 90, invoices: [] })])
    expect(result.status).toBe('amount')
    expect(result.issues).toHaveLength(2)
  })

  it('leaves out of the app-only list what is not the register’s live, in-range, dated row', () => {
    const rows = [
      row({ invoiceNote: 'X1', registerId: 42 }),
      row({ invoiceNote: 'X2', cancelled: true }),
      row({ invoiceNote: 'X3', description: 'Telmak Kędzierski 01.08.2026' }),
      row({ invoiceNote: 'X4', description: 'Telmak bez daty' }),
    ]
    const { results, counts } = compare([], rows)
    expect(results).toEqual([])
    expect(counts.appRows).toBe(0)
  })
})

describe('compareTelmak — order and counts', () => {
  it('sorts by status severity and counts documents, in-range rows, ok and problems', () => {
    const okRow = row()
    const appOnly = row({ invoiceNote: 'WV 4-00999/PRG/09/2026' })
    const { results, counts } = compare(
      [doc(), doc({ number: 'WV 4-00500/PRG/09/2026' }), doc({ problems: ['x'] })],
      [okRow, appOnly],
    )
    expect(results.map((r) => r.status)).toEqual(['unreadable', 'missing-in-app', 'app-only', 'ok'])
    expect(counts).toEqual({ documents: 3, appRows: 2, ok: 1, problems: 3 })
  })
})
