import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FIXTURE_DIR = join(import.meta.dirname, '.')

const FORBIDDEN: ReadonlyArray<{ what: string; pattern: RegExp }> = [
  { what: 'an e-mail address', pattern: /[\w.+-]+@[\w-]+\.[a-z]{2,}/i },
  { what: 'a phone number', pattern: /(\+?48[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/ },
  { what: 'a street address', pattern: /\b(ul\.|ulica|al\.|aleja|os\.|osiedle)\s/i },
  { what: 'a postal code', pattern: /\b\d{2}-\d{3}\b/ },
  { what: 'a person or crew name', pattern: /\b[A-ZĄĆĘŁŃÓŚŹŻ]{3,}(\s+[A-ZĄĆĘŁŃÓŚŹŻ]{2,})+\b/ },
]

const FABRICATED = /\b(BRYGADA JEDEN|EKIPA DWA)\b/g

describe('kosztorys sheet fixtures', () => {
  const files = readdirSync(FIXTURE_DIR).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
  )

  it('has fixtures to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s carries no client PII', (name) => {
    const source = readFileSync(join(FIXTURE_DIR, name), 'utf8').replace(FABRICATED, '')

    for (const { what, pattern } of FORBIDDEN) {
      const hit = source.match(pattern)
      expect(hit, `${name} looks like it contains ${what}: ${hit?.[0]}`).toBeNull()
    }
  })
})
