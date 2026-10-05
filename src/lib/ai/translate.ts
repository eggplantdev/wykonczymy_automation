import { generateObject } from 'ai'
import { z } from 'zod'
import type { TranslationTextsT } from '@/lib/i18n/description-translations'
import { TRANSLATION_LANGUAGES, type TranslationLanguageT } from '@/lib/i18n/languages'
import { logError } from '@/lib/utils/log-error'
import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'
import { FALLBACK_MODEL } from './openrouter'
import { openrouter, timeoutSignal } from './openrouter-client'

export const TRANSLATION_MODEL = 'google/gemini-3.1-flash-lite'
export const TRANSLATION_TIMEOUT_MS = 30_000

// Sized so a 1000-row kosztorys stays inside the 300 s function ceiling: distinct opisy only, ~25
// calls at most, four in flight.
export const TRANSLATION_BATCH_SIZE = 40
const TRANSLATION_CONCURRENCY = 4

// What the prompt calls each language; `Record` makes a new TRANSLATION_LANGUAGES entry a type error
// here until it is named.
const LANGUAGE_NAMES: Record<TranslationLanguageT, string> = {
  uk: 'Ukrainian',
  ru: 'Russian',
}

export const DETECTED_LANGUAGES = ['pl', 'uk', 'ru', 'other'] as const
export type DetectedLanguageT = (typeof DETECTED_LANGUAGES)[number]

// `polish` is null when the text already was Polish — there is nothing to show beside it.
export type ToPolishT = { language: DetectedLanguageT; polish: string | null }

const translationsShape = Object.fromEntries(
  TRANSLATION_LANGUAGES.map((language) => [language, z.string()]),
) as Record<TranslationLanguageT, z.ZodString>

const fromPolishSchema = z.object({
  items: z.array(z.object({ id: z.number().int(), ...translationsShape })),
})

const toPolishSchema = z.object({
  items: z.array(
    z.object({ id: z.number().int(), language: z.enum(DETECTED_LANGUAGES), polish: z.string() }),
  ),
})

const KEEP_VERBATIM =
  'Keep every number, dimension, unit (m2, mb, szt., kpl.) and product name exactly as written. Translate the meaning plainly, as a site foreman would say it; add nothing and explain nothing.'

const asInput = (texts: readonly string[]) =>
  JSON.stringify(texts.map((text, id) => ({ id, text })))

async function withFallback<T>(
  label: string,
  model: string | undefined,
  call: (model: string) => Promise<T>,
): Promise<T> {
  if (model) return call(model)
  try {
    return await call(TRANSLATION_MODEL)
  } catch (primaryError) {
    // TODO(EX-449) SENTRY-REQUIRED: a silent fallback hides that the primary model is broken.
    logError(`[translate] ${label}: primary model ${TRANSLATION_MODEL} failed — falling back`, primaryError)
    return call(FALLBACK_MODEL)
  }
}

// A failed batch is logged and leaves its texts out of the result — callers read a missing text as
// „not translated", which is the same answer a blank model reply gets.
async function inBatches<T>(
  label: string,
  texts: readonly string[],
  translateBatch: (batch: string[]) => Promise<Map<string, T>>,
): Promise<Map<string, T>> {
  const distinct = [...new Set(texts.map((text) => text.trim()).filter((text) => text !== ''))]
  const batches: string[][] = []
  for (let i = 0; i < distinct.length; i += TRANSLATION_BATCH_SIZE) {
    batches.push(distinct.slice(i, i + TRANSLATION_BATCH_SIZE))
  }
  const results = await mapWithConcurrency(batches, TRANSLATION_CONCURRENCY, (batch) =>
    translateBatch(batch).catch((error: unknown) => {
      // TODO(EX-449) SENTRY-REQUIRED: a failed translation batch is invisible to the user beyond a count.
      logError(`[translate] ${label}: batch of ${batch.length} failed`, error)
      return new Map<string, T>()
    }),
  )
  return new Map(results.flatMap((result) => [...result]))
}

/**
 * Polish opisy / section names → every translation language, keyed by the trimmed Polish text. A
 * text the model skipped, answered blank, or that a failed batch carried is simply absent.
 */
export async function translateTexts(
  texts: readonly string[],
): Promise<Map<string, TranslationTextsT>> {
  const languages = TRANSLATION_LANGUAGES.map((language) => `"${language}" (${LANGUAGE_NAMES[language]})`)
  return inBatches('pl → ' + TRANSLATION_LANGUAGES.join('/'), texts, async (batch) => {
    const prompt = [
      'Translate each Polish renovation / construction work description below.',
      `Return one item per input id with the fields ${languages.join(', ')}.`,
      KEEP_VERBATIM,
      '',
      asInput(batch),
    ].join('\n')
    const { items } = await withFallback('pl → translations', undefined, async (model) => {
      const result = await generateObject({
        model: openrouter(model),
        abortSignal: timeoutSignal(TRANSLATION_TIMEOUT_MS, 'translation'),
        schema: fromPolishSchema,
        prompt,
      })
      return result.object
    })

    const out = new Map<string, TranslationTextsT>()
    for (const item of items) {
      const source = batch[item.id]
      if (source === undefined) continue
      const texts: TranslationTextsT = {}
      for (const language of TRANSLATION_LANGUAGES) {
        const text = item[language].trim()
        if (text !== '') texts[language] = text
      }
      if (Object.keys(texts).length > 0) out.set(source, texts)
    }
    return out
  })
}

/**
 * A worker's own words → Polish, with the language they were written in. `model` skips the
 * primary → fallback chain: a manager retrying asks the stronger model straight away.
 */
export async function translateToPolish(
  texts: readonly string[],
  opts: { model?: string } = {},
): Promise<Map<string, ToPolishT>> {
  return inBatches('→ pl', texts, async (batch) => {
    const prompt = [
      'Each text below was written by a worker on a renovation site, most often in Ukrainian or Russian, sometimes in Polish.',
      'For each id, set "language" to the language it is written in ("pl", "uk", "ru", or "other") and "polish" to its Polish translation.',
      'When the text already is Polish, set "polish" to "".',
      KEEP_VERBATIM,
      '',
      asInput(batch),
    ].join('\n')
    const { items } = await withFallback('→ pl', opts.model, async (model) => {
      const result = await generateObject({
        model: openrouter(model),
        abortSignal: timeoutSignal(TRANSLATION_TIMEOUT_MS, 'translation'),
        schema: toPolishSchema,
        prompt,
      })
      return result.object
    })

    const out = new Map<string, ToPolishT>()
    for (const item of items) {
      const source = batch[item.id]
      if (source === undefined) continue
      if (item.language === 'pl') {
        out.set(source, { language: 'pl', polish: null })
        continue
      }
      const polish = item.polish.trim()
      if (polish !== '') out.set(source, { language: item.language, polish })
    }
    return out
  })
}
