import { describe, expect, it } from 'vitest'
import {
  renderSectionName,
  sectionNameKey,
  toSectionTemplate,
} from '@/lib/i18n/section-translations'
import { SECTION_TRANSLATION_SEED } from '@/migrations/20261002_2_section_translations'

describe('sectionNameKey', () => {
  it('ignores case and stray spaces', () => {
    expect(sectionNameKey('  Kuchnia ')).toBe('kuchnia')
    expect(sectionNameKey('Prace   dodatkowe')).toBe('prace dodatkowe')
  })

  it('turns a standalone number anywhere into a placeholder', () => {
    expect(sectionNameKey('Łazienka 2')).toBe('łazienka #')
    expect(sectionNameKey('Łazienka 1 wanna')).toBe('łazienka # wanna')
    expect(sectionNameKey('2 piętro')).toBe('# piętro')
  })

  it('keeps a number glued to letters as text', () => {
    expect(sectionNameKey('Gniazda 230V')).toBe('gniazda 230v')
    expect(sectionNameKey('Instalacja wodno-kanalizacyjna / c.o.')).toBe(
      'instalacja wodno-kanalizacyjna / c.o.',
    )
  })

  it('keeps Polish letters, so „łazienka" and „lazienka" stay two entries', () => {
    expect(sectionNameKey('Łazienka')).not.toBe(sectionNameKey('Lazienka'))
  })

  it('keys a literal „#" apart from a number', () => {
    expect(sectionNameKey('Łazienka # wanna')).not.toBe(sectionNameKey('Łazienka 7 wanna'))
  })

  it('reaches every seeded entry — a key the normaliser never produces is a silent miss', () => {
    for (const { key } of SECTION_TRANSLATION_SEED) {
      const name = key.replace(/(^| )#(?= |$)/g, '$17')
      expect(sectionNameKey(name)).toBe(key)
    }
  })

  it('seeds every entry in both languages, with the key’s own placeholder count', () => {
    const placeholders = (text: string) => text.split(' ').filter((token) => token === '#').length
    for (const { key, uk, ru } of SECTION_TRANSLATION_SEED) {
      expect(placeholders(uk)).toBe(placeholders(key))
      expect(placeholders(ru)).toBe(placeholders(key))
    }
  })
})

describe('toSectionTemplate', () => {
  it('stores the name’s numbers as placeholders and keeps the manager’s casing', () => {
    expect(toSectionTemplate('Łazienka 2 wanna', '  Ванна  кімната 2 з ванною ')).toEqual({
      ok: true,
      template: 'Ванна кімната # з ванною',
    })
  })

  it('treats empty text as removing the language', () => {
    expect(toSectionTemplate('Łazienka 2', '   ')).toEqual({ ok: true, template: '' })
  })

  it('refuses a different number', () => {
    expect(toSectionTemplate('Łazienka 2', 'Ванна кімната 3')).toEqual({
      ok: false,
      reason: 'numbers',
      expected: ['2'],
    })
  })

  it('refuses the right numbers in the wrong order', () => {
    expect(toSectionTemplate('Pokój 1 i 2', 'Кімната 2 і 1')).toMatchObject({
      ok: false,
      reason: 'numbers',
      expected: ['1', '2'],
    })
  })

  it('refuses a missing number', () => {
    expect(toSectionTemplate('Łazienka 2', 'Ванна кімната')).toMatchObject({ ok: false })
  })

  it('refuses a literal placeholder', () => {
    expect(toSectionTemplate('Łazienka 2', 'Ванна кімната #')).toMatchObject({
      ok: false,
      reason: 'hash',
    })
  })
})

describe('renderSectionName', () => {
  it('fills the section’s own numbers back in order', () => {
    expect(renderSectionName('Pokój 1 i 2', { uk: 'Кімната # і #' }, 'uk')).toBe('Кімната 1 і 2')
    expect(renderSectionName('Łazienka 3', { uk: 'Ванна кімната #' }, 'uk')).toBe('Ванна кімната 3')
  })

  it('has nothing where nobody translated the name or this language', () => {
    expect(renderSectionName('Garderoba', undefined, 'uk')).toBeNull()
    expect(renderSectionName('Kuchnia', { ru: 'Кухня' }, 'uk')).toBeNull()
    expect(renderSectionName('Kuchnia', { uk: '  ' }, 'uk')).toBeNull()
  })

  it('has nothing when the template’s placeholders don’t match the name’s numbers', () => {
    expect(renderSectionName('Łazienka 2', { uk: 'Ванна кімната' }, 'uk')).toBeNull()
  })
})
