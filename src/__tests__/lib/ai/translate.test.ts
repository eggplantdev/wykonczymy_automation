import { describe, it, expect, vi } from 'vitest'

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }))

vi.mock('ai', () => ({ generateText, Output: { object: (spec: unknown) => spec } }))
vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: () => (model: string) => ({ __model: model }),
}))
vi.mock('@/lib/utils/log-error', () => ({ logError: vi.fn() }))

import {
  translateTexts,
  translateToPolish,
  TRANSLATION_MODEL,
  TRANSLATION_BATCH_SIZE,
} from '@/lib/ai/translate'
import { FALLBACK_MODEL } from '@/lib/ai/openrouter-client'

type CallT = { model: { __model: string }; prompt: string }

// The prompt carries the batch as JSON after the instructions — the mock reads it back to answer per id.
const inputOf = (call: CallT) =>
  JSON.parse(call.prompt.slice(call.prompt.indexOf('[{'))) as { id: number; text: string }[]

describe('translateTexts', () => {
  it('maps each answer back to its Polish text by batch id', async () => {
    generateText.mockImplementation(async (call: CallT) => ({
      output: {
        items: inputOf(call).map(({ id, text }) => ({ id, uk: `uk:${text}`, ru: `ru:${text}` })),
      },
    }))

    const result = await translateTexts(['Malowanie ścian', ' Malowanie ścian ', 'Gruntowanie'])

    expect(generateText).toHaveBeenCalledTimes(1)
    expect(result).toEqual(
      new Map([
        ['Malowanie ścian', { uk: 'uk:Malowanie ścian', ru: 'ru:Malowanie ścian' }],
        ['Gruntowanie', { uk: 'uk:Gruntowanie', ru: 'ru:Gruntowanie' }],
      ]),
    )
  })

  it('drops an invented id, a skipped id and a blank language instead of guessing', async () => {
    generateText.mockResolvedValue({
      output: {
        items: [
          { id: 0, uk: 'Фарбування', ru: '  ' },
          { id: 7, uk: 'вигадка', ru: 'выдумка' },
        ],
      },
    })

    const result = await translateTexts(['Malowanie', 'Gruntowanie'])

    expect(result).toEqual(new Map([['Malowanie', { uk: 'Фарбування' }]]))
  })

  it('falls back to FALLBACK_MODEL when the primary throws', async () => {
    generateText.mockImplementation(async (call: CallT) => {
      if (call.model.__model === TRANSLATION_MODEL) throw new Error('model not found')
      return { output: { items: [{ id: 0, uk: 'Фарбування', ru: 'Покраска' }] } }
    })

    const result = await translateTexts(['Malowanie'])

    expect(generateText.mock.calls.map(([call]) => call.model.__model)).toEqual([
      TRANSLATION_MODEL,
      FALLBACK_MODEL,
    ])
    expect(result.get('Malowanie')).toEqual({ uk: 'Фарбування', ru: 'Покраска' })
  })

  it('leaves only the failed batch out when one batch fails on both models', async () => {
    const texts = Array.from({ length: TRANSLATION_BATCH_SIZE + 1 }, (_, i) => `Praca ${i}`)
    generateText.mockImplementation(async (call: CallT) => {
      const input = inputOf(call)
      if (input.length === TRANSLATION_BATCH_SIZE) throw new Error('provider down')
      return { output: { items: input.map(({ id }) => ({ id, uk: 'uk', ru: 'ru' })) } }
    })

    const result = await translateTexts(texts)

    expect([...result.keys()]).toEqual([`Praca ${TRANSLATION_BATCH_SIZE}`])
  })
})

describe('translateToPolish', () => {
  it('returns the detected language and Polish, and null Polish for a Polish text', async () => {
    generateText.mockResolvedValue({
      output: {
        items: [
          { id: 0, language: 'uk', polish: 'Montaż listew' },
          { id: 1, language: 'pl', polish: 'ignored' },
          { id: 2, language: 'ru', polish: '' },
        ],
      },
    })

    const result = await translateToPolish(['Монтаж плінтусів', 'Montaż listew', 'Монтаж'])

    expect(result).toEqual(
      new Map([
        ['Монтаж плінтусів', { language: 'uk', polish: 'Montaż listew' }],
        ['Montaż listew', { language: 'pl', polish: null }],
      ]),
    )
  })

  it('calls only the given model when one is passed — a manager retry skips the chain', async () => {
    generateText.mockRejectedValue(new Error('provider down'))

    const result = await translateToPolish(['Монтаж'], { model: FALLBACK_MODEL })

    expect(result.size).toBe(0)
    expect(generateText).toHaveBeenCalledTimes(1)
    expect(generateText.mock.calls[0]?.[0].model.__model).toBe(FALLBACK_MODEL)
  })
})
