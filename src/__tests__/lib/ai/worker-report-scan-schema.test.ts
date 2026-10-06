import { describe, expect, it } from 'vitest'
import { workerReportScanSchema } from '@/lib/ai/worker-report-scan-schema'

const schema = workerReportScanSchema([
  { value: 'm2', label: 'm2 — м²' },
  { value: 'szt', label: 'szt — шт.' },
])

const page = (unit: string | null) => ({
  rows: [{ ref: '35812-7', qty: 2.5, isUncertain: false }],
  extras: [{ description: 'Demontaż', unit, qty: 1, isUncertain: true }],
})

describe('workerReportScanSchema', () => {
  it('accepts a unit from the kosztorys list', () => {
    expect(schema.safeParse(page('m2')).success).toBe(true)
  })

  it('rejects a unit outside the list, including its translation', () => {
    expect(schema.safeParse(page('kg')).success).toBe(false)
    expect(schema.safeParse(page('м²')).success).toBe(false)
  })

  it('accepts a null unit for a written j.m. that fits none', () => {
    expect(schema.safeParse(page(null)).success).toBe(true)
  })
})
